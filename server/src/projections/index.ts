/**
 * Role projections — GM / player / spectator filters for snapshot/query/events (MIG-024).
 * Location: server/src/projections/index.ts
 *
 * Client-side filters are not authorization. Secrets are removed before serialization.
 */
export type ProjectionRole = 'gm' | 'player' | 'spectator';

export type ProjectionActor = {
  readonly actorId: string;
  readonly role: ProjectionRole;
  /** Object ids explicitly revealed to this actor (party/player grants). */
  readonly revealedObjectIds?: ReadonlySet<string> | readonly string[];
};

export type ProjectableObject = {
  readonly id: string;
  readonly visibility?: 'gm_only' | 'party' | 'public' | string;
  readonly gmOnly?: boolean;
  readonly secret?: boolean;
  readonly [key: string]: unknown;
};

const SECRET_KEYS = new Set([
  'gmOnly',
  'gm_only',
  'secret',
  'gmNotes',
  'gm_notes',
  'hiddenFromPlayers',
  '__gmOnly',
]);

const SECRET_MARKER = '__SECRET_MARKER__';

export function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key) || key.startsWith('gmOnly') || key.endsWith('GmOnly');
}

function revealedSet(actor: ProjectionActor): ReadonlySet<string> {
  if (!actor.revealedObjectIds) return new Set();
  return actor.revealedObjectIds instanceof Set
    ? actor.revealedObjectIds
    : new Set(actor.revealedObjectIds);
}

function objectVisible(obj: ProjectableObject, actor: ProjectionActor, revealed: ReadonlySet<string>): boolean {
  if (actor.role === 'gm') return true;
  if (obj.gmOnly === true || obj.secret === true || obj.visibility === 'gm_only') return false;
  if (obj.visibility === 'public') return true;
  if (obj.visibility === 'party' || obj.visibility === undefined) {
    return revealed.has(obj.id);
  }
  return revealed.has(obj.id);
}

/**
 * Recursively project a value for an actor. GM sees all; others lose gm_only/secret
 * keys and objects not in their reveal set.
 */
export function projectValue(value: unknown, actor: ProjectionActor): unknown {
  const revealed = revealedSet(actor);
  return projectInner(value, actor, revealed);
}

function projectInner(value: unknown, actor: ProjectionActor, revealed: ReadonlySet<string>): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      if (item && typeof item === 'object' && !Array.isArray(item) && 'id' in item) {
        const obj = item as ProjectableObject;
        if (!objectVisible(obj, actor, revealed)) continue;
        out.push(projectInner(obj, actor, revealed));
      } else {
        out.push(projectInner(item, actor, revealed));
      }
    }
    return out;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.id === 'string' && !objectVisible(record as ProjectableObject, actor, revealed)) {
      return undefined;
    }
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(record)) {
      if (actor.role !== 'gm' && isSecretKey(key)) continue;
      const projected = projectInner(child, actor, revealed);
      if (projected !== undefined) out[key] = projected;
    }
    return out;
  }
  return value;
}

export type SessionProjectionInput = {
  readonly revision: number;
  readonly objects: readonly ProjectableObject[];
  readonly shared?: Record<string, unknown>;
  readonly events?: readonly Record<string, unknown>[];
};

export type SessionProjection = {
  readonly revision: number;
  readonly role: ProjectionRole;
  readonly objects: readonly ProjectableObject[];
  readonly shared: Record<string, unknown>;
  readonly events: readonly Record<string, unknown>[];
};

/**
 * Build a role-filtered session snapshot/delta projection.
 * When `filterEnabled` is false, secrets leak (negative canary only).
 */
export function projectSessionSnapshot(
  input: SessionProjectionInput,
  actor: ProjectionActor,
  options: { readonly filterEnabled?: boolean } = {},
): SessionProjection {
  const filterEnabled = options.filterEnabled !== false;
  if (!filterEnabled) {
    return {
      revision: input.revision,
      role: actor.role,
      objects: [...input.objects],
      shared: { ...(input.shared ?? {}) },
      events: [...(input.events ?? [])],
    };
  }
  const objects = projectValue(input.objects, actor) as ProjectableObject[];
  const shared = projectValue(input.shared ?? {}, actor) as Record<string, unknown>;
  const events = projectValue(input.events ?? [], actor) as Record<string, unknown>[];
  return {
    revision: input.revision,
    role: actor.role,
    objects,
    shared,
    events,
  };
}

/** Deterministic canary: player projection must never contain this marker when filter is on. */
export function secretMarker(): string {
  return SECRET_MARKER;
}

export function projectionContainsSecretMarker(projection: SessionProjection): boolean {
  const blob = JSON.stringify(projection);
  return blob.includes(SECRET_MARKER);
}

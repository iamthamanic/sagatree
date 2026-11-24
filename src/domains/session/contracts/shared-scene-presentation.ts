/**
 * shared-scene-presentation — Shared scene/location presentation contract (#301).
 * Location: src/domains/session/contracts/shared-scene-presentation.ts
 * Hides: presentation schema, GM input validation, forged-key stripping.
 * Never imports React or backend clients.
 * Reusable later for 3D via opaque sceneRef (no grid/fog/world-builder here).
 */

export const SCENE_PRESENTATION_SCHEMA_VERSION = 1 as const;

/** Client-forged presentation metadata — server must strip / ignore. */
export const FORGED_SCENE_PRESENTATION_KEYS = [
  'authoritative',
  'updatedAt',
  'updated_at',
  'revision',
  'schemaVersion',
] as const;

export type SceneRefKind = 'session-local' | 'adventure-scene' | 'world-location';

export type SceneVisibleActorKind = 'character' | 'npc' | 'creature' | 'other';

export type SceneVisibleActorRole = 'pc' | 'npc' | 'creature' | 'other';

export interface SceneRef {
  kind: SceneRefKind;
  id: string | null;
}

export interface SceneVisibleActor {
  kind: SceneVisibleActorKind;
  id: string | null;
  publicId: string | null;
  displayName: string;
  portraitUrl: string | null;
  role: SceneVisibleActorRole;
}

/**
 * Authoritative shared visual context under world_state.shared.scenePresentation.
 */
export interface SharedScenePresentation {
  schemaVersion: typeof SCENE_PRESENTATION_SCHEMA_VERSION;
  title: string;
  locationLabel: string | null;
  description: string | null;
  backdropUrl: string | null;
  sceneRef: SceneRef | null;
  visibleActors: readonly SceneVisibleActor[];
  updatedAt: string | null;
  authoritative: true;
}

/** GM inputs for a scene command — no server-owned fields. */
export interface SharedScenePresentationCommandInput {
  title: string;
  locationLabel: string | null;
  description: string | null;
  backdropUrl: string | null;
  /** Syncs top-level world_state.sceneId when set. */
  sceneId: string | null;
  sceneRef: SceneRef | null;
  visibleActors: readonly SceneVisibleActor[];
}

const SCENE_REF_KINDS: readonly SceneRefKind[] = [
  'session-local',
  'adventure-scene',
  'world-location',
] as const;

const ACTOR_KINDS: readonly SceneVisibleActorKind[] = [
  'character',
  'npc',
  'creature',
  'other',
] as const;

const ACTOR_ROLES: readonly SceneVisibleActorRole[] = [
  'pc',
  'npc',
  'creature',
  'other',
] as const;

const MAX_TITLE = 120;
const MAX_LOCATION = 120;
const MAX_DESCRIPTION = 500;
const MAX_URL = 2048;
const MAX_ACTORS = 24;
const MAX_NAME = 80;

export function isSceneRefKind(value: string): value is SceneRefKind {
  return (SCENE_REF_KINDS as readonly string[]).includes(value);
}

export function isSceneVisibleActorKind(value: string): value is SceneVisibleActorKind {
  return (ACTOR_KINDS as readonly string[]).includes(value);
}

export function isSceneVisibleActorRole(value: string): value is SceneVisibleActorRole {
  return (ACTOR_ROLES as readonly string[]).includes(value);
}

export function stripForgedScenePresentationKeys(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...payload };
  for (const key of FORGED_SCENE_PRESENTATION_KEYS) {
    delete next[key];
  }
  return next;
}

export function assertNoForgedScenePresentationKeys(payload: Record<string, unknown>): void {
  for (const key of FORGED_SCENE_PRESENTATION_KEYS) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      throw new Error(`Client darf Scene-Metadatenfeld nicht senden: ${key}`);
    }
  }
}

/**
 * Allow empty or http(s) URLs only — blocks javascript:/data: etc.
 */
export function isAllowedBackdropUrl(value: string | null): boolean {
  if (value === null || value === '') return true;
  if (value.length > MAX_URL) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function optionalTrimmedString(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  return trimmed.slice(0, max);
}

function parseSceneRef(raw: unknown): SceneRef | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const kindRaw = typeof row.kind === 'string' ? row.kind : '';
  if (!isSceneRefKind(kindRaw)) return null;
  const id = optionalTrimmedString(row.id, 128);
  return { kind: kindRaw, id };
}

function parseVisibleActor(raw: unknown): SceneVisibleActor | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const kindRaw = typeof row.kind === 'string' ? row.kind : 'other';
  const kind = isSceneVisibleActorKind(kindRaw) ? kindRaw : 'other';
  const roleRaw = typeof row.role === 'string' ? row.role : kind === 'character' ? 'pc' : 'other';
  const role = isSceneVisibleActorRole(roleRaw) ? roleRaw : 'other';
  const displayName = optionalTrimmedString(row.displayName, MAX_NAME);
  if (!displayName) return null;
  const portraitUrl = optionalTrimmedString(row.portraitUrl, MAX_URL);
  if (portraitUrl !== null && !isAllowedBackdropUrl(portraitUrl)) {
    return null;
  }
  return {
    kind,
    id: optionalTrimmedString(row.id, 128),
    publicId: optionalTrimmedString(row.publicId, 64),
    displayName,
    portraitUrl,
    role,
  };
}

function parseVisibleActors(raw: unknown): SceneVisibleActor[] {
  if (!Array.isArray(raw)) return [];
  const out: SceneVisibleActor[] = [];
  for (const item of raw) {
    if (out.length >= MAX_ACTORS) break;
    const actor = parseVisibleActor(item);
    if (actor) out.push(actor);
  }
  return out;
}

/**
 * Parse GM scene command payload into validated inputs (forged keys stripped).
 */
export function parseSharedScenePresentationCommandInput(
  payload: Record<string, unknown>,
): SharedScenePresentationCommandInput {
  const sanitized = stripForgedScenePresentationKeys(payload);
  const title = optionalTrimmedString(sanitized.title, MAX_TITLE);
  if (!title) {
    throw new Error('Szenen-Titel ist erforderlich.');
  }
  const backdropUrl = optionalTrimmedString(sanitized.backdropUrl, MAX_URL);
  if (!isAllowedBackdropUrl(backdropUrl)) {
    throw new Error('Backdrop-URL muss http(s) sein oder leer.');
  }
  const sceneId = optionalTrimmedString(sanitized.sceneId, 128);
  const sceneRef = parseSceneRef(sanitized.sceneRef);
  return {
    title,
    locationLabel: optionalTrimmedString(sanitized.locationLabel, MAX_LOCATION),
    description: optionalTrimmedString(sanitized.description, MAX_DESCRIPTION),
    backdropUrl,
    sceneId,
    sceneRef,
    visibleActors: parseVisibleActors(sanitized.visibleActors),
  };
}

export function buildSharedScenePresentation(input: {
  command: SharedScenePresentationCommandInput;
  updatedAt: string;
}): SharedScenePresentation {
  const sceneRef =
    input.command.sceneRef ??
    (input.command.sceneId
      ? ({ kind: 'session-local', id: input.command.sceneId } satisfies SceneRef)
      : null);
  return {
    schemaVersion: SCENE_PRESENTATION_SCHEMA_VERSION,
    title: input.command.title,
    locationLabel: input.command.locationLabel,
    description: input.command.description,
    backdropUrl: input.command.backdropUrl,
    sceneRef,
    visibleActors: input.command.visibleActors,
    updatedAt: input.updatedAt,
    authoritative: true,
  };
}

/**
 * Read presentation from world_state.shared — null if missing/invalid.
 */
export function readSharedScenePresentation(
  shared: Record<string, unknown>,
): SharedScenePresentation | null {
  const raw = shared.scenePresentation;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (row.authoritative !== true) return null;
  const title = optionalTrimmedString(row.title, MAX_TITLE);
  if (!title) return null;
  const backdropUrl = optionalTrimmedString(row.backdropUrl, MAX_URL);
  if (!isAllowedBackdropUrl(backdropUrl)) return null;
  const schemaVersion =
    typeof row.schemaVersion === 'number' && Number.isFinite(row.schemaVersion)
      ? Math.trunc(row.schemaVersion)
      : SCENE_PRESENTATION_SCHEMA_VERSION;
  if (schemaVersion !== SCENE_PRESENTATION_SCHEMA_VERSION) return null;
  return {
    schemaVersion: SCENE_PRESENTATION_SCHEMA_VERSION,
    title,
    locationLabel: optionalTrimmedString(row.locationLabel, MAX_LOCATION),
    description: optionalTrimmedString(row.description, MAX_DESCRIPTION),
    backdropUrl,
    sceneRef: parseSceneRef(row.sceneRef),
    visibleActors: parseVisibleActors(row.visibleActors),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : null,
    authoritative: true,
  };
}

export function emptySharedScenePresentationDraft(): SharedScenePresentationCommandInput {
  return {
    title: '',
    locationLabel: null,
    description: null,
    backdropUrl: null,
    sceneId: null,
    sceneRef: null,
    visibleActors: [],
  };
}

/**
 * Resolve sceneId to write at world_state top-level after a presentation command.
 */
export function resolveSceneIdFromCommand(
  command: SharedScenePresentationCommandInput,
): string | null {
  if (command.sceneId) return command.sceneId;
  if (command.sceneRef?.id) return command.sceneRef.id;
  return null;
}

/** Stable presets for GM quick-switch (no remote assets required). */
export const SCENE_PRESENTATION_PRESETS: readonly {
  id: string;
  title: string;
  locationLabel: string;
  description: string;
}[] = [
  {
    id: 'forest',
    title: 'Dunkler Wald',
    locationLabel: 'Wald',
    description: 'Hohe Bäume, feuchter Boden, fernes Knacken im Unterholz.',
  },
  {
    id: 'castle',
    title: 'Alte Burghalle',
    locationLabel: 'Schloss',
    description: 'Kalte Steine, Fackellicht, Wappen an den Wänden.',
  },
  {
    id: 'city',
    title: 'Belebte Stadtstraße',
    locationLabel: 'Stadt',
    description: 'Händler rufen, Räder knirschen, Gerüche von Würze und Rauch.',
  },
  {
    id: 'cave',
    title: 'Tropfende Höhle',
    locationLabel: 'Höhle',
    description: 'Echo, Nässe, nur schmale Lichtkegel erreichen die Wände.',
  },
  {
    id: 'tavern',
    title: 'Rauchige Taverne',
    locationLabel: 'Taverne',
    description: 'Lachen, Becherklang, ein Bardenspiel in der Ecke.',
  },
  {
    id: 'temple',
    title: 'Stiller Tempel',
    locationLabel: 'Tempel',
    description: 'Weihrauch, steinerne Gottheiten, leise Gebete.',
  },
] as const;

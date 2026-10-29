/**
 * NPC definition CRUD (#806) + instance/controller RPCs (#877).
 * Private — npc-creature public API only.
 * Location: server/src/modules/npc-creature/internal/npc-instance-store.ts
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { ProjectPorts } from '../../project/index.ts';
import {
  normalizeNpcDefinitionDraft,
  personalCopyName,
} from './npc-definition-draft.ts';
import {
  generateNpcCreaturePublicId,
  isNpcCreaturePublicId,
} from './public-npc-creature-id.ts';

export type NpcError = { readonly ok: false; readonly error: string };
export type Ok<T> = { readonly ok: true; readonly value: T };

export type NpcDefinitionRecord = {
  readonly id: string;
  readonly publicId: string;
  readonly scope: 'personal' | 'world' | 'core' | 'builtin';
  readonly worldProfileId: string | null;
  readonly ownerUserId: string | null;
  readonly status: 'active' | 'archived';
  readonly payload: Record<string, unknown>;
  readonly payloadVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type NpcInstanceRow = {
  readonly id: string;
  readonly projectId: string;
  readonly sessionId: string | null;
  readonly definitionId: string;
  readonly displayName: string;
  readonly instanceKind: string;
  readonly sequenceNumber: number;
  readonly snapshot: Record<string, unknown>;
  readonly runtime: Record<string, unknown>;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type NpcInstanceDbRow = {
  readonly id: string;
  readonly projectId: string;
  readonly sessionId: string | null;
  readonly definitionId: string;
  readonly displayName: string;
  readonly instanceKind: string;
  readonly sequenceNumber: number;
  readonly snapshot: string;
  readonly runtime: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ControllerAssignmentRow = {
  readonly projectId: string;
  readonly definitionId: string;
  readonly controllerUserId: string | null;
  readonly assignedBy: string;
  readonly updatedAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export type NpcSessionLookup = {
  readonly sessionBelongsToProject: (
    sessionId: string,
    projectId: string,
  ) => boolean;
  readonly sessionProjectId: (sessionId: string) => string | null;
};

/** World ACL via owning module / composition — no worlds SQL inside npc-creature. */
export type NpcWorldLookup = {
  readonly canReadWorldProfile: (
    actorIds: readonly string[],
    worldProfileId: string,
  ) => boolean;
  readonly canEditWorldProfile: (
    actorIds: readonly string[],
    worldProfileId: string,
  ) => boolean;
};

export class NpcInstanceStore {
  readonly #db: HostDatabase;
  readonly #project: ProjectPorts;
  readonly #session: NpcSessionLookup;
  readonly #world: NpcWorldLookup;

  constructor(
    db: HostDatabase,
    project: ProjectPorts,
    session: NpcSessionLookup,
    world: NpcWorldLookup,
  ) {
    this.#db = db;
    this.#project = project;
    this.#session = session;
    this.#world = world;
  }

  /** Narrow GM: projects.gm_user_id AND active membership (source contract). */
  #isNarrowGm(projectId: string, actorIds: readonly string[]): boolean {
    return (
      this.#project.isProjectGm(projectId, actorIds) &&
      this.#project.isActiveMember(projectId, actorIds)
    );
  }

  #isActiveMember(projectId: string, userId: string): boolean {
    return this.#project.isActiveMember(projectId, [userId]);
  }

  /**
   * personal:/world: must exist and be readable (owner or world-read).
   * core:/builtin: snapshot-only — no DB row required.
   */
  #definitionReadable(actorIds: readonly string[], definitionId: string): boolean {
    if (definitionId.startsWith('core:') || definitionId.startsWith('builtin:')) {
      return true;
    }
    if (!definitionId.startsWith('personal:') && !definitionId.startsWith('world:')) {
      return true;
    }
    const def = this.#db
      .prepare(
        `SELECT scope, owner_user_id AS ownerUserId, world_profile_id AS worldProfileId
         FROM npc_creature_definitions WHERE id = ?`,
      )
      .get(definitionId) as
      | { scope: string; ownerUserId: string | null; worldProfileId: string | null }
      | undefined;
    if (!def) return false;
    if (def.scope === 'personal') {
      return Boolean(def.ownerUserId && actorIds.includes(def.ownerUserId));
    }
    if (def.scope === 'world' && def.worldProfileId) {
      // World ownership/ACL via injected world port — no direct worlds-table SQL.
      return this.#world.canReadWorldProfile(actorIds, def.worldProfileId);
    }
    return false;
  }

  #tempControllerOk(projectId: string, runtime: unknown): NpcError | null {
    if (runtime === null || typeof runtime !== 'object' || Array.isArray(runtime)) {
      return null;
    }
    const temp = (runtime as { temporaryControllerUserId?: unknown }).temporaryControllerUserId;
    if (temp === undefined || temp === null) return null;
    if (typeof temp !== 'string' || temp.trim() === '') {
      return { ok: false, error: 'P0001:invalid temporary controller' };
    }
    if (!this.#isActiveMember(projectId, temp.trim())) {
      return { ok: false, error: 'P0001:temporary controller is not an active project member' };
    }
    return null;
  }

  #decodeJsonObject(raw: string): Record<string, unknown> | null {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  #readInstance(id: string): NpcInstanceRow | null {
    const row = this.#db
      .prepare(
        `SELECT id, project_id AS projectId, session_id AS sessionId,
                definition_id AS definitionId, display_name AS displayName,
                instance_kind AS instanceKind, sequence_number AS sequenceNumber,
                snapshot, runtime, created_by AS createdBy,
                created_at AS createdAt, updated_at AS updatedAt
         FROM npc_creature_instances WHERE id = ?`,
      )
      .get(id) as NpcInstanceDbRow | undefined;
    if (!row) return null;
    const snapshot = this.#decodeJsonObject(row.snapshot);
    const runtime = this.#decodeJsonObject(row.runtime);
    if (!snapshot || !runtime) return null;
    return {
      id: row.id,
      projectId: row.projectId,
      sessionId: row.sessionId,
      definitionId: row.definitionId,
      displayName: row.displayName,
      instanceKind: row.instanceKind,
      sequenceNumber: row.sequenceNumber,
      snapshot,
      runtime,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  seedDefinitionForTests(input: {
    readonly id: string;
    readonly scope: 'personal' | 'world' | 'core' | 'builtin';
    readonly ownerUserId?: string | null;
    readonly worldProfileId?: string | null;
    readonly status?: 'active' | 'archived';
    readonly sheetMode?: string;
    readonly publicId?: string;
  }): void {
    const now = nowIso();
    const payload = JSON.stringify({ sheetMode: input.sheetMode ?? 'full' });
    const publicId = input.publicId ?? this.#uniquePublicId();
    this.#db
      .prepare(
        `INSERT OR REPLACE INTO npc_creature_definitions
           (id, scope, owner_user_id, world_profile_id, status, payload, created_at, updated_at,
            public_id, payload_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .run(
        input.id,
        input.scope,
        input.ownerUserId ?? null,
        input.worldProfileId ?? null,
        input.status ?? 'active',
        payload,
        now,
        now,
        publicId,
      );
  }

  #uniquePublicId(): string {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const publicId = generateNpcCreaturePublicId();
      const hit = this.#db
        .prepare(`SELECT 1 AS o FROM npc_creature_definitions WHERE public_id = ? LIMIT 1`)
        .get(publicId);
      if (!hit) return publicId;
    }
    return generateNpcCreaturePublicId();
  }

  #ensurePublicId(rowId: string, existing: string | null): string | null {
    const trimmed =
      typeof existing === 'string' ? existing.trim().toUpperCase() : '';
    if (isNpcCreaturePublicId(trimmed)) return trimmed;
    const publicId = this.#uniquePublicId();
    this.#db
      .prepare(`UPDATE npc_creature_definitions SET public_id = ? WHERE id = ?`)
      .run(publicId, rowId);
    return publicId;
  }

  #mapDefinitionRow(row: {
    readonly id: string;
    readonly public_id: string | null;
    readonly scope: string;
    readonly world_profile_id: string | null;
    readonly owner_user_id: string | null;
    readonly status: string;
    readonly payload: string;
    readonly payload_version: number | null;
    readonly created_at: string;
    readonly updated_at: string;
  }): NpcDefinitionRecord | null {
    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(row.payload);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
    const publicId = this.#ensurePublicId(row.id, row.public_id);
    if (!publicId) return null;
    if (
      row.scope !== 'personal' &&
      row.scope !== 'world' &&
      row.scope !== 'core' &&
      row.scope !== 'builtin'
    ) {
      return null;
    }
    const status = row.status === 'archived' ? 'archived' : 'active';
    return {
      id: row.id,
      publicId,
      scope: row.scope,
      worldProfileId: row.world_profile_id,
      ownerUserId: row.owner_user_id,
      status,
      payload,
      payloadVersion:
        typeof row.payload_version === 'number' && row.payload_version >= 1
          ? row.payload_version
          : 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  #loadDefinition(id: string): NpcDefinitionRecord | null {
    const row = this.#db
      .prepare(
        `SELECT id, public_id, scope, world_profile_id, owner_user_id, status, payload,
                payload_version, created_at, updated_at
         FROM npc_creature_definitions WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          public_id: string | null;
          scope: string;
          world_profile_id: string | null;
          owner_user_id: string | null;
          status: string;
          payload: string;
          payload_version: number | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;
    if (!row) return null;
    return this.#mapDefinitionRow(row);
  }

  #definitionReadableForActor(
    actorIds: readonly string[],
    record: NpcDefinitionRecord,
  ): boolean {
    if (record.scope === 'core' || record.scope === 'builtin') return true;
    if (record.scope === 'personal') {
      return Boolean(record.ownerUserId && actorIds.includes(record.ownerUserId));
    }
    if (record.scope === 'world' && record.worldProfileId) {
      return this.#world.canReadWorldProfile(actorIds, record.worldProfileId);
    }
    return false;
  }

  #definitionMutableForActor(
    actorIds: readonly string[],
    record: NpcDefinitionRecord,
  ): boolean {
    if (record.scope === 'personal') {
      return Boolean(record.ownerUserId && actorIds.includes(record.ownerUserId));
    }
    if (record.scope === 'world' && record.worldProfileId) {
      return this.#world.canEditWorldProfile(actorIds, record.worldProfileId);
    }
    return false;
  }

  listDefinitions(
    actorIds: readonly string[],
    options?: {
      readonly scope?: 'personal' | 'world' | 'core' | 'builtin';
      readonly worldProfileId?: string | null;
      readonly includeArchived?: boolean;
    },
  ): Ok<readonly NpcDefinitionRecord[]> | NpcError {
    if (!actorIds[0]) return { ok: false, error: 'P0001:not authenticated' };
    const includeArchived = options?.includeArchived === true;
    const scope = options?.scope ?? null;
    const worldProfileId = options?.worldProfileId ?? null;
    const ownerPlaceholders = actorIds.map(() => '?').join(', ');
    // Candidate set: own personal rows + world/core/builtin (+ optional filters).
    // World ACL is memoized per world_profile_id below (not N queries blindly).
    const rows = this.#db
      .prepare(
        `SELECT id, public_id, scope, world_profile_id, owner_user_id, status, payload,
                payload_version, created_at, updated_at
         FROM npc_creature_definitions
         WHERE (? = 1 OR status = 'active')
           AND (? IS NULL OR scope = ?)
           AND (? IS NULL OR world_profile_id = ?)
           AND (
             (scope = 'personal' AND owner_user_id IN (${ownerPlaceholders}))
             OR scope IN ('world', 'core', 'builtin')
           )
         ORDER BY updated_at DESC`,
      )
      .all(
        includeArchived ? 1 : 0,
        scope,
        scope,
        worldProfileId,
        worldProfileId,
        ...actorIds,
      ) as Array<{
      id: string;
      public_id: string | null;
      scope: string;
      world_profile_id: string | null;
      owner_user_id: string | null;
      status: string;
      payload: string;
      payload_version: number | null;
      created_at: string;
      updated_at: string;
    }>;
    const worldReadCache = new Map<string, boolean>();
    const out: NpcDefinitionRecord[] = [];
    for (const row of rows) {
      const mapped = this.#mapDefinitionRow(row);
      if (!mapped) continue;
      if (mapped.scope === 'world' && mapped.worldProfileId) {
        let allowed = worldReadCache.get(mapped.worldProfileId);
        if (allowed === undefined) {
          allowed = this.#world.canReadWorldProfile(actorIds, mapped.worldProfileId);
          worldReadCache.set(mapped.worldProfileId, allowed);
        }
        if (!allowed) continue;
      } else if (!this.#definitionReadableForActor(actorIds, mapped)) {
        continue;
      }
      out.push(mapped);
    }
    return { ok: true, value: out };
  }

  getDefinition(
    actorIds: readonly string[],
    definitionId: string,
  ): Ok<NpcDefinitionRecord | null> | NpcError {
    if (!actorIds[0]) return { ok: false, error: 'P0001:not authenticated' };
    const id = typeof definitionId === 'string' ? definitionId.trim() : '';
    if (id.length < 10 || id.length > 160) {
      return { ok: false, error: 'P0001:invalid definition id' };
    }
    const record = this.#loadDefinition(id);
    if (!record) return { ok: true, value: null };
    if (!this.#definitionReadableForActor(actorIds, record)) {
      return { ok: false, error: 'not-authorized' };
    }
    return { ok: true, value: record };
  }

  createDefinition(
    actorIds: readonly string[],
    input: {
      readonly scope: 'personal' | 'world';
      readonly worldProfileId?: string | null;
      readonly draft: unknown;
    },
  ): Ok<NpcDefinitionRecord> | NpcError {
    if (!actorIds[0]) return { ok: false, error: 'P0001:not authenticated' };
    const normalized = normalizeNpcDefinitionDraft(input.draft);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    if (input.scope === 'world') {
      const worldProfileId =
        typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
      if (!worldProfileId) return { ok: false, error: 'missing-world-profile' };
      if (!this.#world.canEditWorldProfile(actorIds, worldProfileId)) {
        return { ok: false, error: 'not-authorized' };
      }
      return this.#insertDefinition('world', actorIds[0], worldProfileId, normalized.payload);
    }
    return this.#insertDefinition('personal', actorIds[0], null, normalized.payload);
  }

  #insertDefinition(
    scope: 'personal' | 'world',
    ownerUserId: string,
    worldProfileId: string | null,
    payload: Record<string, unknown>,
  ): Ok<NpcDefinitionRecord> | NpcError {
    const id = `${scope}:${randomUUID()}`;
    const publicId = this.#uniquePublicId();
    const now = nowIso();
    try {
      this.#db
        .prepare(
          `INSERT INTO npc_creature_definitions
             (id, scope, owner_user_id, world_profile_id, status, payload, created_at, updated_at,
              public_id, payload_version)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 1)`,
        )
        .run(
          id,
          scope,
          ownerUserId,
          worldProfileId,
          JSON.stringify(payload),
          now,
          now,
          publicId,
        );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `definition-create-failed:${message}` };
    }
    const loaded = this.#loadDefinition(id);
    if (!loaded) return { ok: false, error: 'definition-create-unreadable' };
    return { ok: true, value: loaded };
  }

  updateDefinition(
    actorIds: readonly string[],
    definitionId: string,
    draft: unknown,
  ): Ok<NpcDefinitionRecord> | NpcError {
    if (!actorIds[0]) return { ok: false, error: 'P0001:not authenticated' };
    const id = typeof definitionId === 'string' ? definitionId.trim() : '';
    if (id.length < 10 || id.length > 160) {
      return { ok: false, error: 'P0001:invalid definition id' };
    }
    const existing = this.#loadDefinition(id);
    if (!existing) return { ok: false, error: 'not-found' };
    if (!this.#definitionMutableForActor(actorIds, existing)) {
      return { ok: false, error: 'not-authorized' };
    }
    const normalized = normalizeNpcDefinitionDraft(draft);
    if (!normalized.ok) return { ok: false, error: normalized.error };
    const now = nowIso();
    this.#db
      .prepare(
        `UPDATE npc_creature_definitions
         SET payload = ?, payload_version = 1, updated_at = ?
         WHERE id = ?`,
      )
      .run(JSON.stringify(normalized.payload), now, id);
    const loaded = this.#loadDefinition(id);
    if (!loaded) return { ok: false, error: 'definition-update-unreadable' };
    return { ok: true, value: loaded };
  }

  setDefinitionStatus(
    actorIds: readonly string[],
    definitionId: string,
    status: 'active' | 'archived',
  ): Ok<NpcDefinitionRecord> | NpcError {
    if (!actorIds[0]) return { ok: false, error: 'P0001:not authenticated' };
    const id = typeof definitionId === 'string' ? definitionId.trim() : '';
    if (id.length < 10 || id.length > 160) {
      return { ok: false, error: 'P0001:invalid definition id' };
    }
    const existing = this.#loadDefinition(id);
    if (!existing) return { ok: false, error: 'not-found' };
    if (!this.#definitionMutableForActor(actorIds, existing)) {
      return { ok: false, error: 'not-authorized' };
    }
    const now = nowIso();
    this.#db
      .prepare(
        `UPDATE npc_creature_definitions SET status = ?, updated_at = ? WHERE id = ?`,
      )
      .run(status, now, id);
    const loaded = this.#loadDefinition(id);
    if (!loaded) return { ok: false, error: 'definition-status-unreadable' };
    return { ok: true, value: loaded };
  }

  duplicateDefinition(
    actorIds: readonly string[],
    sourceDefinitionId: string,
  ): Ok<NpcDefinitionRecord> | NpcError {
    if (!actorIds[0]) return { ok: false, error: 'P0001:not authenticated' };
    const sourceId =
      typeof sourceDefinitionId === 'string' ? sourceDefinitionId.trim() : '';
    if (sourceId.length < 10 || sourceId.length > 160) {
      return { ok: false, error: 'P0001:invalid definition id' };
    }
    const source = this.#loadDefinition(sourceId);
    if (!source) return { ok: false, error: 'not-found' };
    if (!this.#definitionReadableForActor(actorIds, source)) {
      return { ok: false, error: 'not-authorized' };
    }
    const name =
      typeof source.payload.name === 'string'
        ? personalCopyName(source.payload.name)
        : personalCopyName('Figur');
    const draft = { ...source.payload, name };
    return this.#insertDefinition('personal', actorIds[0], null, draft);
  }

  assignController(
    actorIds: readonly string[],
    projectId: string,
    definitionIdRaw: string,
    controllerUserId: string | null,
  ): Ok<ControllerAssignmentRow> | NpcError {
    if (!actorIds[0]) return { ok: false, error: 'P0001:not authenticated' };
    if (!projectId) return { ok: false, error: 'P0001:missing project' };
    const definitionId = typeof definitionIdRaw === 'string' ? definitionIdRaw.trim() : '';
    if (definitionId.length < 10 || definitionId.length > 160) {
      return { ok: false, error: 'P0001:invalid definition id' };
    }
    if (!this.#isNarrowGm(projectId, actorIds)) {
      if (!this.#project.isProjectGm(projectId, actorIds)) {
        return { ok: false, error: 'P0001:only gm may assign controller' };
      }
      return { ok: false, error: 'P0001:actor is not an active project member' };
    }
    if (controllerUserId !== null) {
      if (typeof controllerUserId !== 'string' || controllerUserId.trim() === '') {
        return { ok: false, error: 'P0001:invalid controller id' };
      }
      if (!this.#isActiveMember(projectId, controllerUserId.trim())) {
        return { ok: false, error: 'P0001:controller is not an active project member' };
      }
      controllerUserId = controllerUserId.trim();
    }
    if (
      (definitionId.startsWith('personal:') || definitionId.startsWith('world:')) &&
      !this.#definitionReadable(actorIds, definitionId)
    ) {
      return { ok: false, error: 'P0001:definition not readable' };
    }
    const def = this.#db
      .prepare(`SELECT status, payload FROM npc_creature_definitions WHERE id = ?`)
      .get(definitionId) as { status: string; payload: string } | undefined;
    if (def) {
      let sheetMode = '';
      try {
        sheetMode = String((JSON.parse(def.payload) as { sheetMode?: string }).sheetMode ?? '');
      } catch {
        sheetMode = '';
      }
      if (def.status !== 'active' || sheetMode !== 'full') {
        return { ok: false, error: 'P0001:definition is not a full character sheet' };
      }
    }
    const now = nowIso();
    this.#db
      .prepare(
        `INSERT INTO npc_creature_controller_assignments
           (project_id, definition_id, controller_user_id, assigned_by, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(project_id, definition_id) DO UPDATE SET
           controller_user_id = excluded.controller_user_id,
           assigned_by = excluded.assigned_by,
           updated_at = excluded.updated_at`,
      )
      .run(projectId, definitionId, controllerUserId, actorIds[0], now);
    return {
      ok: true,
      value: {
        projectId,
        definitionId,
        controllerUserId,
        assignedBy: actorIds[0],
        updatedAt: now,
      },
    };
  }

  spawnInstance(
    actorIds: readonly string[],
    input: {
      readonly projectId: string;
      readonly definitionId: string;
      readonly instanceKind: string;
      readonly snapshot: unknown;
      readonly runtime: unknown;
      readonly displayName: string;
      readonly sequenceNumber: number;
      readonly sessionId?: string | null;
    },
  ): Ok<NpcInstanceRow> | NpcError {
    if (!actorIds[0]) return { ok: false, error: 'P0001:not authenticated' };
    if (!this.#isNarrowGm(input.projectId, actorIds)) {
      return { ok: false, error: 'P0001:only gm may spawn' };
    }
    const definitionId = input.definitionId.trim();
    if (definitionId.length < 10 || definitionId.length > 160) {
      return { ok: false, error: 'P0001:invalid definition id' };
    }
    if (!['generic', 'persistent'].includes(input.instanceKind)) {
      return { ok: false, error: 'P0001:invalid instance kind' };
    }
    const displayName = input.displayName.trim();
    if (displayName.length < 1 || displayName.length > 120) {
      return { ok: false, error: 'P0001:invalid display name' };
    }
    if (
      !Number.isInteger(input.sequenceNumber) ||
      input.sequenceNumber < 1 ||
      input.sequenceNumber > 100000
    ) {
      return { ok: false, error: 'P0001:invalid sequence number' };
    }
    if (input.snapshot === null || typeof input.snapshot !== 'object' || Array.isArray(input.snapshot)) {
      return { ok: false, error: 'P0001:invalid snapshot' };
    }
    if (input.runtime === null || typeof input.runtime !== 'object' || Array.isArray(input.runtime)) {
      return { ok: false, error: 'P0001:invalid runtime' };
    }
    if (input.instanceKind === 'persistent' && input.sessionId) {
      return { ok: false, error: 'P0001:persistent instances must not bind a session' };
    }
    if (input.sessionId) {
      if (!this.#session.sessionBelongsToProject(input.sessionId, input.projectId)) {
        return { ok: false, error: 'P0001:session does not belong to project' };
      }
    }
    if (!this.#definitionReadable(actorIds, definitionId)) {
      return { ok: false, error: 'P0001:definition not readable' };
    }
    const tempErr = this.#tempControllerOk(input.projectId, input.runtime);
    if (tempErr) return tempErr;
    const id = randomUUID();
    const now = nowIso();
    this.#db
      .prepare(
        `INSERT INTO npc_creature_instances (
           id, project_id, session_id, definition_id, display_name, instance_kind,
           sequence_number, snapshot, runtime, created_by, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.projectId,
        input.sessionId ?? null,
        definitionId,
        displayName,
        input.instanceKind,
        input.sequenceNumber,
        JSON.stringify(input.snapshot),
        JSON.stringify(input.runtime),
        actorIds[0],
        now,
        now,
      );
    const row = this.#readInstance(id);
    if (!row) return { ok: false, error: 'P0001' };
    return { ok: true, value: row };
  }

  updateRuntime(
    actorIds: readonly string[],
    instanceId: string,
    runtime: unknown,
  ): Ok<NpcInstanceRow> | NpcError {
    if (!actorIds[0]) return { ok: false, error: 'P0001:not authenticated' };
    if (runtime === null || typeof runtime !== 'object' || Array.isArray(runtime)) {
      return { ok: false, error: 'P0001:invalid runtime' };
    }
    const current = this.#readInstance(instanceId);
    if (!current) return { ok: false, error: 'P0001:instance not found' };
    if (!this.#isNarrowGm(current.projectId, actorIds)) {
      return { ok: false, error: 'P0001:only gm may update runtime' };
    }
    const tempErr = this.#tempControllerOk(current.projectId, runtime);
    if (tempErr) return tempErr;
    const now = nowIso();
    this.#db
      .prepare(
        `UPDATE npc_creature_instances SET runtime = ?, updated_at = ? WHERE id = ?`,
      )
      .run(JSON.stringify(runtime), now, instanceId);
    const row = this.#readInstance(instanceId);
    if (!row) return { ok: false, error: 'P0001' };
    if (JSON.stringify(row.snapshot) !== JSON.stringify(current.snapshot)) {
      return { ok: false, error: 'P0001:snapshot mutated' };
    }
    return { ok: true, value: row };
  }

  removeInstance(
    actorIds: readonly string[],
    instanceId: string,
  ): Ok<{ readonly id: string }> | NpcError {
    if (!actorIds[0]) return { ok: false, error: 'P0001:not authenticated' };
    const current = this.#readInstance(instanceId);
    if (!current) return { ok: false, error: 'P0001:instance not found' };
    if (!this.#isNarrowGm(current.projectId, actorIds)) {
      return { ok: false, error: 'P0001:only gm may remove' };
    }
    this.#db.prepare(`DELETE FROM npc_creature_instances WHERE id = ?`).run(instanceId);
    return { ok: true, value: { id: instanceId } };
  }

  clearTempControllersForSession(
    actorIds: readonly string[],
    sessionId: string,
  ): Ok<{ readonly cleared: number }> | NpcError {
    if (!actorIds[0]) return { ok: false, error: 'P0001:not authenticated' };
    // Session project resolved via injected session port (no foreign play_sessions SQL).
    const projectId = this.#session.sessionProjectId(sessionId);
    if (!projectId) return { ok: false, error: 'P0001:session not found' };
    if (!this.#isNarrowGm(projectId, actorIds)) {
      return { ok: false, error: 'P0001:only gm may clear temp controllers' };
    }
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      const rows = this.#db
        .prepare(
          `SELECT id, runtime FROM npc_creature_instances WHERE session_id = ?`,
        )
        .all(sessionId) as { id: string; runtime: string }[];
      let cleared = 0;
      const now = nowIso();
      for (const row of rows) {
        let runtime: Record<string, unknown>;
        try {
          runtime = JSON.parse(row.runtime) as Record<string, unknown>;
        } catch {
          continue;
        }
        const temp = runtime.temporaryControllerUserId;
        if (typeof temp === 'string' && temp.trim() !== '') {
          // Canonical cleared representation is JSON null (not key deletion).
          runtime.temporaryControllerUserId = null;
          this.#db
            .prepare(
              `UPDATE npc_creature_instances SET runtime = ?, updated_at = ? WHERE id = ?`,
            )
            .run(JSON.stringify(runtime), now, row.id);
          cleared += 1;
        }
      }
      this.#db.exec('COMMIT');
      return { ok: true, value: { cleared } };
    } catch {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: 'P0001' };
    }
  }
}

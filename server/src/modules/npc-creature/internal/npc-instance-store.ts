/**
 * NPC instance + controller RPCs (#877). Private — npc-creature public API only.
 * Location: server/src/modules/npc-creature/internal/npc-instance-store.ts
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { ProjectPorts } from '../../project/index.ts';

export type NpcError = { readonly ok: false; readonly error: string };
export type Ok<T> = { readonly ok: true; readonly value: T };

export type NpcInstanceRow = {
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

export class NpcInstanceStore {
  readonly #db: HostDatabase;
  readonly #project: ProjectPorts;

  constructor(db: HostDatabase, project: ProjectPorts) {
    this.#db = db;
    this.#project = project;
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
      const ids = actorIds.filter((id) => typeof id === 'string' && id.length > 0);
      if (ids.length === 0) return false;
      const placeholders = ids.map(() => '?').join(',');
      const owner = this.#db
        .prepare(
          `SELECT 1 AS ok FROM worlds WHERE id = ? AND owner_user_id IN (${placeholders})`,
        )
        .get(def.worldProfileId, ...ids) as { ok: number } | undefined;
      if (owner) return true;
      return this.#project.actorCanAccessWorld(actorIds, def.worldProfileId);
    }
    return false;
  }

  #tempControllerOk(projectId: string, runtime: unknown): NpcError | null {
    if (runtime === null || typeof runtime !== 'object' || Array.isArray(runtime)) {
      return null;
    }
    const temp = (runtime as { temporaryControllerUserId?: unknown }).temporaryControllerUserId;
    if (typeof temp !== 'string' || temp.trim() === '') return null;
    if (!this.#isActiveMember(projectId, temp.trim())) {
      return { ok: false, error: 'P0001:temporary controller is not an active project member' };
    }
    return null;
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
      .get(id) as NpcInstanceRow | undefined;
    return row ?? null;
  }

  seedDefinitionForTests(input: {
    readonly id: string;
    readonly scope: 'personal' | 'world' | 'core' | 'builtin';
    readonly ownerUserId?: string | null;
    readonly worldProfileId?: string | null;
    readonly status?: 'active' | 'archived';
    readonly sheetMode?: string;
  }): void {
    const now = nowIso();
    const payload = JSON.stringify({ sheetMode: input.sheetMode ?? 'full' });
    this.#db
      .prepare(
        `INSERT OR REPLACE INTO npc_creature_definitions
           (id, scope, owner_user_id, world_profile_id, status, payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
      );
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
    if (controllerUserId && !this.#isActiveMember(projectId, controllerUserId)) {
      return { ok: false, error: 'P0001:controller is not an active project member' };
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
    if (!Number.isInteger(input.sequenceNumber) || input.sequenceNumber < 1) {
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
      const sess = this.#db
        .prepare(`SELECT project_id AS projectId FROM play_sessions WHERE session_id = ?`)
        .get(input.sessionId) as { projectId: string } | undefined;
      if (!sess || sess.projectId !== input.projectId) {
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
    if (!current) return { ok: false, error: 'P0002:instance not found' };
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
    if (row.snapshot !== current.snapshot) {
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
    if (!current) return { ok: false, error: 'P0002:instance not found' };
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
    const sess = this.#db
      .prepare(`SELECT project_id AS projectId FROM play_sessions WHERE session_id = ?`)
      .get(sessionId) as { projectId: string } | undefined;
    if (!sess) return { ok: false, error: 'P0002:session not found' };
    if (!this.#isNarrowGm(sess.projectId, actorIds)) {
      return { ok: false, error: 'P0001:only gm may clear temp controllers' };
    }
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
      if (
        typeof runtime.temporaryControllerUserId === 'string' &&
        runtime.temporaryControllerUserId.trim() !== ''
      ) {
        delete runtime.temporaryControllerUserId;
        this.#db
          .prepare(
            `UPDATE npc_creature_instances SET runtime = ?, updated_at = ? WHERE id = ?`,
          )
          .run(JSON.stringify(runtime), now, row.id);
        cleared += 1;
      }
    }
    return { ok: true, value: { cleared } };
  }
}

/**
 * Project provision writes — create/duplicate/ensure from saga versions (#873)
 * + FE-HOST-12 blank create/update/archive (#1117).
 * Private — import only from project public API.
 * Location: server/src/modules/project/internal/project-provision-store.ts
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import { generateSagaPublicId } from './public-project-id.ts';
import { generateProjectJoinCode } from './project-membership-store.ts';

export type ProvisionedProject = {
  readonly id: string;
  readonly publicId: string;
  readonly code: string;
  readonly title: string;
  readonly description: string | null;
  readonly gmUserId: string;
  readonly status: string;
  readonly sagaId: string;
  readonly sagaVersionId: string;
  readonly adventureRuntime: Record<string, unknown>;
  readonly worldId: string;
  readonly defaultLookProfileId: string | null;
  readonly allowPlayerCharacterLookOverride: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ProjectWritePatch = {
  readonly title?: string;
  readonly description?: string | null;
  readonly status?: string;
  readonly worldId?: string;
  readonly defaultLookProfileId?: string | null;
  readonly allowPlayerCharacterLookOverride?: boolean;
};

function newId(): string {
  return randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseRuntime(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

const PROJECT_SELECT = `id, world_id, gm_user_id, title, created_at, saga_id, saga_version_id,
                adventure_runtime, public_id, status, description, code,
                updated_at, default_look_profile_id, allow_player_character_look_override`;

type ProjectRow = {
  id: string;
  world_id: string;
  gm_user_id: string;
  title: string;
  created_at: string;
  saga_id: string | null;
  saga_version_id: string | null;
  adventure_runtime: string | null;
  public_id: string | null;
  status: string | null;
  description: string | null;
  code: string | null;
  updated_at: string | null;
  default_look_profile_id: string | null;
  allow_player_character_look_override: number | null;
};

const ALLOWED_STATUS = new Set(['active', 'paused', 'completed', 'archived']);

export class ProjectProvisionStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  #withImmediateTx<T>(fn: () => T): T {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      this.#db.exec('COMMIT');
      return value;
    } catch (err) {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  getProject(projectId: string): ProjectRow | null {
    return (
      (this.#db
        .prepare(`SELECT ${PROJECT_SELECT} FROM projects WHERE id = ?`)
        .get(projectId) as ProjectRow | undefined) ?? null
    );
  }

  findActiveGmProjectForSaga(actorId: string, sagaId: string): ProjectRow | null {
    return (
      (this.#db
        .prepare(
          `SELECT ${PROJECT_SELECT}
           FROM projects
           WHERE gm_user_id = ?
             AND saga_id = ?
             AND status IN ('active', 'paused')
           ORDER BY created_at ASC
           LIMIT 1`,
        )
        .get(actorId, sagaId) as ProjectRow | undefined) ?? null
    );
  }

  toVm(row: ProjectRow): ProvisionedProject {
    return {
      id: row.id,
      publicId: row.public_id ?? generateSagaPublicId(),
      code: typeof row.code === 'string' ? row.code : '',
      title: row.title,
      description: row.description,
      gmUserId: row.gm_user_id,
      status: row.status ?? 'active',
      sagaId: row.saga_id ?? '',
      sagaVersionId: row.saga_version_id ?? '',
      adventureRuntime: parseRuntime(row.adventure_runtime),
      worldId: row.world_id,
      defaultLookProfileId:
        typeof row.default_look_profile_id === 'string' ? row.default_look_profile_id : null,
      allowPlayerCharacterLookOverride:
        row.allow_player_character_look_override === null ||
        row.allow_player_character_look_override === undefined
          ? true
          : row.allow_player_character_look_override !== 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
    };
  }

  /**
   * Atomically: project + GM membership for a world already allocated by world module.
   */
  createFromSagaVersion(input: {
    readonly actorId: string;
    readonly worldId: string;
    readonly sagaId: string;
    readonly sagaVersionId: string;
    readonly title: string;
    readonly description: string | null;
    readonly adventureRuntime: Record<string, unknown>;
  }): { ok: true; value: ProvisionedProject } | { ok: false; error: string } {
    if (!input.actorId) return { ok: false, error: '42501' };
    if (!input.worldId) return { ok: false, error: '22023' };
    const projectId = newId();
    const createdAt = nowIso();
    const pub = generateSagaPublicId();
    const joinCode = generateProjectJoinCode();
    const memberId = newId();
    const runtimeJson = JSON.stringify(input.adventureRuntime ?? {});

    try {
      this.#withImmediateTx(() => {
        this.#db
          .prepare(
            `INSERT INTO projects (
               id, world_id, gm_user_id, title, created_at, updated_at, saga_id, saga_version_id,
               adventure_runtime, public_id, status, description, code,
               allow_player_character_look_override
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 1)`,
          )
          .run(
            projectId,
            input.worldId,
            input.actorId,
            input.title,
            createdAt,
            createdAt,
            input.sagaId,
            input.sagaVersionId,
            runtimeJson,
            pub,
            input.description,
            joinCode,
          );
        this.#db
          .prepare(
            `INSERT INTO project_members (project_id, user_id, role, active, joined_at, id, character_id)
             VALUES (?, ?, 'gm', 1, ?, ?, NULL)`,
          )
          .run(projectId, input.actorId, createdAt, memberId);
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }

    const row = this.getProject(projectId);
    if (!row) return { ok: false, error: 'P0001' };
    return { ok: true, value: this.toVm(row) };
  }

  /**
   * Blank saga create (no saga definition pin) — FE-HOST-12.
   * Caller must supply an owned/accessible worldId (route may auto-allocate).
   */
  createBlank(input: {
    readonly actorId: string;
    readonly worldId: string;
    readonly title: string;
    readonly description: string | null;
  }): { ok: true; value: ProvisionedProject } | { ok: false; error: string } {
    if (!input.actorId) return { ok: false, error: '42501' };
    if (!input.worldId) return { ok: false, error: '22023' };
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) return { ok: false, error: '22023' };

    const projectId = newId();
    const createdAt = nowIso();
    const pub = generateSagaPublicId();
    const joinCode = generateProjectJoinCode();
    const memberId = newId();

    try {
      this.#withImmediateTx(() => {
        this.#db
          .prepare(
            `INSERT INTO projects (
               id, world_id, gm_user_id, title, created_at, updated_at, saga_id, saga_version_id,
               adventure_runtime, public_id, status, description, code,
               allow_player_character_look_override
             ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, '{}', ?, 'active', ?, ?, 1)`,
          )
          .run(
            projectId,
            input.worldId,
            input.actorId,
            title,
            createdAt,
            createdAt,
            pub,
            input.description,
            joinCode,
          );
        this.#db
          .prepare(
            `INSERT INTO project_members (project_id, user_id, role, active, joined_at, id, character_id)
             VALUES (?, ?, 'gm', 1, ?, ?, NULL)`,
          )
          .run(projectId, input.actorId, createdAt, memberId);
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }

    const row = this.getProject(projectId);
    if (!row) return { ok: false, error: 'P0001' };
    return { ok: true, value: this.toVm(row) };
  }

  /**
   * GM-only patch. Actor must match projects.gm_user_id (or linked solo ids via caller).
   */
  updateOwned(
    actorIds: readonly string[],
    projectId: string,
    patch: ProjectWritePatch,
  ): { ok: true; value: ProvisionedProject } | { ok: false; error: string } {
    if (!actorIds.length) return { ok: false, error: '42501' };
    const id = typeof projectId === 'string' ? projectId.trim() : '';
    if (!id) return { ok: false, error: '22023' };
    const existing = this.getProject(id);
    if (!existing) return { ok: false, error: 'P0002' };
    if (!actorIds.includes(existing.gm_user_id)) return { ok: false, error: '42501' };

    const nextTitle =
      patch.title !== undefined
        ? typeof patch.title === 'string'
          ? patch.title.trim()
          : ''
        : existing.title;
    if (!nextTitle) return { ok: false, error: '22023' };

    const nextDescription =
      patch.description !== undefined ? patch.description : existing.description;
    const nextStatus =
      patch.status !== undefined
        ? typeof patch.status === 'string'
          ? patch.status.trim()
          : ''
        : (existing.status ?? 'active');
    if (!ALLOWED_STATUS.has(nextStatus)) return { ok: false, error: '22023' };

    const nextWorldId =
      patch.worldId !== undefined
        ? typeof patch.worldId === 'string'
          ? patch.worldId.trim()
          : ''
        : existing.world_id;
    if (!nextWorldId) return { ok: false, error: '22023' };

    const nextLook =
      patch.defaultLookProfileId !== undefined
        ? patch.defaultLookProfileId
        : existing.default_look_profile_id;
    const nextAllow =
      patch.allowPlayerCharacterLookOverride !== undefined
        ? patch.allowPlayerCharacterLookOverride
          ? 1
          : 0
        : existing.allow_player_character_look_override === null ||
            existing.allow_player_character_look_override === undefined
          ? 1
          : existing.allow_player_character_look_override;

    const updatedAt = nowIso();
    try {
      this.#db
        .prepare(
          `UPDATE projects SET
             title = ?,
             description = ?,
             status = ?,
             world_id = ?,
             default_look_profile_id = ?,
             allow_player_character_look_override = ?,
             updated_at = ?
           WHERE id = ?`,
        )
        .run(
          nextTitle,
          nextDescription,
          nextStatus,
          nextWorldId,
          nextLook,
          nextAllow,
          updatedAt,
          id,
        );
    } catch {
      return { ok: false, error: 'P0001' };
    }

    const row = this.getProject(id);
    if (!row) return { ok: false, error: 'P0002' };
    return { ok: true, value: this.toVm(row) };
  }

  /**
   * GM-only soft delete — archive so session/member FKs stay intact.
   * List endpoints omit archived rows.
   */
  archiveOwned(
    actorIds: readonly string[],
    projectId: string,
  ): { ok: true; value: { readonly id: string } } | { ok: false; error: string } {
    if (!actorIds.length) return { ok: false, error: '42501' };
    const id = typeof projectId === 'string' ? projectId.trim() : '';
    if (!id) return { ok: false, error: '22023' };
    const existing = this.getProject(id);
    if (!existing) return { ok: false, error: 'P0002' };
    if (!actorIds.includes(existing.gm_user_id)) return { ok: false, error: '42501' };
    if (existing.status === 'archived') return { ok: true, value: { id } };

    try {
      this.#db
        .prepare(`UPDATE projects SET status = 'archived', updated_at = ? WHERE id = ?`)
        .run(nowIso(), id);
    } catch {
      return { ok: false, error: 'P0001' };
    }
    return { ok: true, value: { id } };
  }
}

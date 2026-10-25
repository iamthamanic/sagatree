/**
 * Project provision writes — create/duplicate/ensure from saga versions (#873).
 * Private — import only from project public API.
 * Location: server/src/modules/project/internal/project-provision-store.ts
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type ProvisionedProject = {
  readonly id: string;
  readonly publicId: string;
  readonly title: string;
  readonly description: string | null;
  readonly gmUserId: string;
  readonly status: string;
  readonly sagaId: string;
  readonly sagaVersionId: string;
  readonly adventureRuntime: Record<string, unknown>;
  readonly worldId: string;
  readonly createdAt: string;
};

function newId(): string {
  return randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function publicIdFor(projectId: string): string {
  // SA-style short public id — stable from project uuid prefix (not authz).
  return `SA-${projectId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
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
};

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
    return this.#db
      .prepare(
        `SELECT id, world_id, gm_user_id, title, created_at, saga_id, saga_version_id,
                adventure_runtime, public_id, status, description
         FROM projects WHERE id = ?`,
      )
      .get(projectId) as ProjectRow | undefined ?? null;
  }

  findActiveGmProjectForSaga(actorId: string, sagaId: string): ProjectRow | null {
    return (
      (this.#db
        .prepare(
          `SELECT id, world_id, gm_user_id, title, created_at, saga_id, saga_version_id,
                  adventure_runtime, public_id, status, description
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
      publicId: row.public_id ?? publicIdFor(row.id),
      title: row.title,
      description: row.description,
      gmUserId: row.gm_user_id,
      status: row.status ?? 'active',
      sagaId: row.saga_id ?? '',
      sagaVersionId: row.saga_version_id ?? '',
      adventureRuntime: parseRuntime(row.adventure_runtime),
      worldId: row.world_id,
      createdAt: row.created_at,
    };
  }

  /**
   * Atomically: world + project + GM membership.
   * Host `world_id` is NOT NULL — allocate an owner world for the new play group.
   */
  createFromSagaVersion(input: {
    readonly actorId: string;
    readonly sagaId: string;
    readonly sagaVersionId: string;
    readonly title: string;
    readonly description: string | null;
    readonly adventureRuntime: Record<string, unknown>;
  }): { ok: true; value: ProvisionedProject } | { ok: false; error: string } {
    if (!input.actorId) return { ok: false, error: '42501' };
    const projectId = newId();
    const worldId = newId();
    const createdAt = nowIso();
    const pub = publicIdFor(projectId);
    const runtimeJson = JSON.stringify(input.adventureRuntime ?? {});

    try {
      this.#withImmediateTx(() => {
        this.#db
          .prepare(
            `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
          )
          .run(worldId, input.actorId, input.title, createdAt);
        this.#db
          .prepare(
            `INSERT INTO projects (
               id, world_id, gm_user_id, title, created_at, saga_id, saga_version_id,
               adventure_runtime, public_id, status, description
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
          )
          .run(
            projectId,
            worldId,
            input.actorId,
            input.title,
            createdAt,
            input.sagaId,
            input.sagaVersionId,
            runtimeJson,
            pub,
            input.description,
          );
        this.#db
          .prepare(
            `INSERT INTO project_members (project_id, user_id, role, active, joined_at)
             VALUES (?, ?, 'gm', 1, ?)`,
          )
          .run(projectId, input.actorId, createdAt);
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }

    const row = this.getProject(projectId);
    if (!row) return { ok: false, error: 'P0001' };
    return { ok: true, value: this.toVm(row) };
  }
}

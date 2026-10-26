/**
 * Project join-by-code + set-my-character writes (#874).
 * Private — import only from project public API.
 * Location: server/src/modules/project/internal/project-membership-store.ts
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type JoinByCodeResult =
  | { readonly ok: true; readonly projectId: string }
  | { readonly ok: false; readonly error: string; readonly detail?: string };

export type SetMyCharacterResult =
  | { readonly ok: true; readonly memberId: string }
  | { readonly ok: false; readonly error: string };

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function newMemberId(): string {
  return randomUUID();
}

/** Generate an 8-char uppercase join code (Postgres trigger parity). */
export function generateProjectJoinCode(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

export class ProjectMembershipStore {
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

  assignCodeIfMissing(projectId: string, preferred?: string | null): string | null {
    const existing = this.#db
      .prepare(`SELECT code FROM projects WHERE id = ?`)
      .get(projectId) as { code: string | null } | undefined;
    if (!existing) return null;
    if (existing.code && existing.code.trim() !== '') return existing.code;
    const code = preferred && preferred.trim() !== '' ? normalizeCode(preferred) : generateProjectJoinCode();
    this.#db.prepare(`UPDATE projects SET code = ? WHERE id = ?`).run(code, projectId);
    return code;
  }

  setProjectCodeForTests(projectId: string, code: string): void {
    this.#db.prepare(`UPDATE projects SET code = ? WHERE id = ?`).run(normalizeCode(code), projectId);
  }

  joinByCode(input: {
    readonly actorId: string;
    readonly code: string;
    readonly characterId: string | null;
  }): JoinByCodeResult {
    if (!input.actorId) return { ok: false, error: '42501' };
    const normalized = normalizeCode(input.code);
    if (!normalized) return { ok: false, error: '22023' };

    try {
      return this.#withImmediateTx(() => {
        const project = this.#db
          .prepare(
            `SELECT id FROM projects
             WHERE code IS NOT NULL AND UPPER(TRIM(code)) = ? AND status = 'active'`,
          )
          .get(normalized) as { id: string } | undefined;
        if (!project) return { ok: false, error: 'P0002' };

        const existing = this.#db
          .prepare(
            `SELECT active FROM project_members WHERE project_id = ? AND user_id = ?`,
          )
          .get(project.id, input.actorId) as { active: number } | undefined;
        if (existing) {
          const status = existing.active === 1 ? 'active' : 'inactive';
          return { ok: false, error: 'P0001', detail: status };
        }

        const memberId = newMemberId();
        this.#db
          .prepare(
            `INSERT INTO project_members (
               project_id, user_id, role, active, joined_at, id, character_id
             ) VALUES (?, ?, 'player', 1, ?, ?, ?)`,
          )
          .run(
            project.id,
            input.actorId,
            nowIso(),
            memberId,
            input.characterId,
          );

        return { ok: true, projectId: project.id };
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }
  }

  setMyCharacter(input: {
    readonly actorId: string;
    readonly projectId: string;
    readonly characterId: string | null;
  }): SetMyCharacterResult {
    if (!input.actorId) return { ok: false, error: '42501' };

    const updated = this.#db
      .prepare(
        `UPDATE project_members
         SET character_id = ?
         WHERE project_id = ? AND user_id = ? AND active = 1
         RETURNING id`,
      )
      .get(input.characterId, input.projectId, input.actorId) as { id: string } | undefined;

    if (!updated?.id) return { ok: false, error: 'P0002' };
    return { ok: true, memberId: updated.id };
  }

  getMemberForTests(projectId: string, userId: string): {
    readonly id: string | null;
    readonly role: string;
    readonly active: number;
    readonly characterId: string | null;
  } | null {
    const row = this.#db
      .prepare(
        `SELECT id, role, active, character_id AS characterId
         FROM project_members WHERE project_id = ? AND user_id = ?`,
      )
      .get(projectId, userId) as
      | { id: string | null; role: string; active: number; characterId: string | null }
      | undefined;
    return row ?? null;
  }
}

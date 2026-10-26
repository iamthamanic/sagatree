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

export type CharacterValidateFn = (
  characterId: string,
) => { readonly ok: true } | { readonly ok: false; readonly error: '42501' | '22023' };

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

  setProjectCodeForTests(projectId: string, code: string): void {
    this.#db.prepare(`UPDATE projects SET code = ? WHERE id = ?`).run(normalizeCode(code), projectId);
  }

  /**
   * Source contract order: auth → code required → project lookup → existing membership →
   * optional character ownership → insert. Character validation must not precede P0002/P0001.
   */
  joinByCode(input: {
    readonly actorId: string;
    readonly code: string;
    readonly characterId: string | null;
    readonly validateCharacter?: CharacterValidateFn;
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

        if (input.characterId) {
          const validate = input.validateCharacter;
          if (!validate) return { ok: false, error: '42501' };
          const check = validate(input.characterId);
          if (!check.ok) return { ok: false, error: check.error };
        }

        const memberId = newMemberId();
        this.#db
          .prepare(
            `INSERT INTO project_members (
               project_id, user_id, role, active, joined_at, id, character_id
             ) VALUES (?, ?, 'player', 1, ?, ?, ?)`,
          )
          .run(project.id, input.actorId, nowIso(), memberId, input.characterId);

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

    const row = this.#db
      .prepare(
        `SELECT id FROM project_members
         WHERE project_id = ? AND user_id = ? AND active = 1`,
      )
      .get(input.projectId, input.actorId) as { id: string | null } | undefined;
    if (!row) return { ok: false, error: 'P0002' };

    let memberId = row.id;
    if (!memberId || memberId.trim() === '') {
      memberId = newMemberId();
      this.#db
        .prepare(
          `UPDATE project_members
           SET character_id = ?, id = ?
           WHERE project_id = ? AND user_id = ? AND active = 1`,
        )
        .run(input.characterId, memberId, input.projectId, input.actorId);
    } else {
      this.#db
        .prepare(
          `UPDATE project_members
           SET character_id = ?
           WHERE project_id = ? AND user_id = ? AND active = 1`,
        )
        .run(input.characterId, input.projectId, input.actorId);
    }

    return { ok: true, memberId };
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

  resolveByPublicId(publicId: string): { id: string; gmUserId: string; publicId: string } | null {
    const normalized = normalizeCode(publicId);
    if (!normalized) return null;
    return (
      (this.#db
        .prepare(
          `SELECT id, gm_user_id AS gmUserId, public_id AS publicId FROM projects
           WHERE public_id IS NOT NULL AND UPPER(TRIM(public_id)) = ?`,
        )
        .get(normalized) as { id: string; gmUserId: string; publicId: string } | undefined) ?? null
    );
  }

  /** Atlas saga context: project public id scoped to a world (#862). */
  resolveProjectIdForWorldAndPublicId(worldId: string, publicId: string): string | null {
    const normalized = normalizeCode(publicId);
    const wid = typeof worldId === 'string' ? worldId.trim() : '';
    if (!normalized || !wid) return null;
    const row = this.#db
      .prepare(
        `SELECT id FROM projects
         WHERE world_id = ?
           AND public_id IS NOT NULL
           AND UPPER(TRIM(public_id)) = ?
         LIMIT 1`,
      )
      .get(wid, normalized) as { id: string } | undefined;
    return row?.id ?? null;
  }

  isProjectGm(projectId: string, actorIds: readonly string[]): boolean {
    const ids = actorIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (ids.length === 0) return false;
    const placeholders = ids.map(() => '?').join(',');
    const owner = this.#db
      .prepare(`SELECT 1 AS ok FROM projects WHERE id = ? AND gm_user_id IN (${placeholders})`)
      .get(projectId, ...ids) as { ok: number } | undefined;
    if (owner) return true;
    // Canonical is_project_gm: active project_members.role = 'gm' also counts.
    const memberGm = this.#db
      .prepare(
        `SELECT 1 AS ok FROM project_members
         WHERE project_id = ?
           AND user_id IN (${placeholders})
           AND active = 1
           AND role = 'gm'`,
      )
      .get(projectId, ...ids) as { ok: number } | undefined;
    return Boolean(memberGm);
  }

  isActiveMember(projectId: string, actorIds: readonly string[]): boolean {
    const ids = actorIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (ids.length === 0) return false;
    const placeholders = ids.map(() => '?').join(',');
    const row = this.#db
      .prepare(
        `SELECT 1 AS ok FROM project_members
         WHERE project_id = ? AND user_id IN (${placeholders}) AND active = 1`,
      )
      .get(projectId, ...ids) as { ok: number } | undefined;
    return Boolean(row);
  }

  listActiveMembers(projectId: string): readonly {
    memberId: string;
    userId: string;
    role: string;
    status: string;
    joinedAt: string | null;
  }[] {
    return this.#db
      .prepare(
        `SELECT id AS memberId, user_id AS userId, role,
                CASE WHEN active = 1 THEN 'active' ELSE 'inactive' END AS status,
                joined_at AS joinedAt
         FROM project_members
         WHERE project_id = ? AND active = 1
         ORDER BY joined_at`,
      )
      .all(projectId) as {
      memberId: string;
      userId: string;
      role: string;
      status: string;
      joinedAt: string | null;
    }[];
  }

  getActiveMemberById(
    projectId: string,
    memberId: string,
  ): { id: string; userId: string } | null {
    return (
      (this.#db
        .prepare(
          `SELECT id, user_id AS userId FROM project_members
           WHERE id = ? AND project_id = ? AND active = 1`,
        )
        .get(memberId, projectId) as { id: string; userId: string } | undefined) ?? null
    );
  }
}

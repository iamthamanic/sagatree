/**
 * SQLite user_profiles store — own ensure + peer-readable select (MIG-312).
 * Location: server/src/modules/user-profile/internal/user-profile-store.ts
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type UserProfileRow = {
  readonly id: string;
  readonly display_name: string | null;
  readonly avatar_path: string | null;
  readonly updated_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function isUniqueConstraint(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code?: unknown }).code ?? '') : '';
  const message = 'message' in err ? String((err as { message?: unknown }).message ?? '') : '';
  return (
    code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
    code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    /UNIQUE constraint failed/i.test(message) ||
    /PRIMARY KEY must be unique/i.test(message)
  );
}

export function createUserProfileStore(db: HostDatabase) {
  return {
    getById(id: string): UserProfileRow | null {
      const row = db
        .prepare(
          `SELECT id, display_name, avatar_path, updated_at FROM user_profiles WHERE id = ?`,
        )
        .get(id) as UserProfileRow | undefined;
      return row ?? null;
    },

    listByIds(ids: readonly string[]): readonly UserProfileRow[] {
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => '?').join(', ');
      const rows = db
        .prepare(
          `SELECT id, display_name, avatar_path, updated_at FROM user_profiles WHERE id IN (${placeholders})`,
        )
        .all(...ids) as UserProfileRow[];
      return rows;
    },

    /**
     * Select-then-insert. Concurrent insert race (SQLite UNIQUE) is success — mirrors 23505.
     */
    ensureOwn(userId: string): { ok: true } | { ok: false; error: string; code?: string } {
      try {
        const existing = this.getById(userId);
        if (existing) return { ok: true };
        db.prepare(
          `INSERT INTO user_profiles (id, display_name, avatar_path, updated_at) VALUES (?, NULL, NULL, ?)`,
        ).run(userId, nowIso());
        return { ok: true };
      } catch (err) {
        if (isUniqueConstraint(err)) return { ok: true };
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: unknown }).message ?? 'unknown')
            : 'unknown';
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code?: unknown }).code ?? '')
            : undefined;
        return { ok: false, error: message, ...(code ? { code } : {}) };
      }
    },

    updateAvatarPath(
      userId: string,
      avatarPath: string,
    ): { ok: true; row: UserProfileRow } | { ok: false; error: string; code?: string } {
      try {
        const updatedAt = nowIso();
        const result = db
          .prepare(
            `UPDATE user_profiles SET avatar_path = ?, updated_at = ? WHERE id = ?`,
          )
          .run(avatarPath, updatedAt, userId);
        if (result.changes < 1) {
          return { ok: false, error: 'Profilzeile nicht gefunden', code: 'PGRST116' };
        }
        const row = this.getById(userId);
        if (!row) {
          return { ok: false, error: 'Profilzeile nach Update nicht lesbar', code: 'PGRST116' };
        }
        return { ok: true, row };
      } catch (err) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: unknown }).message ?? 'unknown')
            : 'unknown';
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code?: unknown }).code ?? '')
            : undefined;
        return { ok: false, error: message, ...(code ? { code } : {}) };
      }
    },
  };
}

export type UserProfileStore = ReturnType<typeof createUserProfileStore>;

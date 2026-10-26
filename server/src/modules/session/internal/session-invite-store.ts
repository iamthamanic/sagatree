/**
 * session-invite-store — opaque invite tokens + join-by-code (MIG-023).
 * Location: server/src/modules/session/internal/session-invite-store.ts
 *
 * Codes/tokens are never GM proofs. Membership is always role=player from this path.
 * Client-supplied role claims in payloads are ignored.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import { isSqliteBusyError } from '../../../persistence/open-database.ts';

export type InviteErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'MISSING_TOKEN'
  | 'NOT_FOUND'
  | 'REVOKED'
  | 'EXPIRED'
  | 'SESSION_MISSING'
  | 'SESSION_COMPLETED'
  | 'PROJECT_MISSING'
  | 'CODE_REQUIRED'
  | 'REDEEM_LIMIT'
  | 'DATABASE_BUSY'
  | 'INVALID_COMMAND';

export type InviteFail = { readonly ok: false; readonly error: InviteErrorCode };
export type InviteOk<T> = { readonly ok: true } & T;
export type InviteResult<T> = InviteOk<T> | InviteFail;

export type PlaySessionRow = {
  readonly sessionId: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly joinCode: string | null;
  readonly status: string;
};

export type ProjectMemberRow = {
  readonly projectId: string;
  readonly userId: string;
  readonly role: string;
  readonly active: boolean;
};

export type SessionInviteStore = {
  readonly seedWorldProjectSession: (input: {
    readonly worldId: string;
    readonly projectId: string;
    readonly gmUserId: string;
    readonly sessionId: string;
    readonly publicId: string;
    readonly joinCode: string;
    readonly status?: string;
  }) => void;
  readonly createInvite: (
    actorUserId: string,
    sessionId: string,
    options?: { readonly maxRedemptions?: number; readonly ttlMs?: number },
  ) => InviteResult<{
    readonly id: string;
    readonly token: string;
    readonly sessionId: string;
    readonly expiresAt: string;
  }>;
  readonly revokeInvite: (actorUserId: string, token: string) => InviteResult<{ readonly id: string }>;
  readonly resolveInvite: (
    actorUserId: string,
    token: string,
  ) => InviteResult<{
    readonly sessionId: string;
    readonly projectId: string;
    readonly publicId: string;
    readonly sessionStatus: string;
    readonly alreadyMember: boolean;
    readonly isProjectGm: boolean;
  }>;
  /**
   * Redeem invite token OR session join code. Optional `claimedRole` from the client
   * is ignored — membership is always player (never gm/owner).
   */
  readonly joinByInviteOrCode: (
    actorUserId: string,
    input: {
      readonly token?: string;
      readonly joinCode?: string;
      readonly claimedRole?: string;
      readonly characterId?: string | null;
    },
  ) => InviteResult<{
    readonly sessionId: string;
    readonly projectId: string;
    readonly membership: ProjectMemberRow;
    readonly createdMembership: boolean;
    readonly createdPlayer: boolean;
  }>;
  readonly listProjectMembers: (projectId: string) => readonly ProjectMemberRow[];
  readonly getPlaySession: (sessionId: string) => PlaySessionRow | null;
};

function fail(error: InviteErrorCode): InviteFail {
  return { ok: false, error };
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}

function generateToken(): string {
  return randomBytes(24).toString('hex');
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function isProjectGm(db: HostDatabase, projectId: string, userId: string): boolean {
  const project = db.prepare('SELECT gm_user_id FROM projects WHERE id = ?').get(projectId) as
    | { gm_user_id: string }
    | undefined;
  if (project?.gm_user_id === userId) return true;
  const member = db
    .prepare(
      "SELECT role FROM project_members WHERE project_id = ? AND user_id = ? AND active = 1 AND role = 'gm'",
    )
    .get(projectId, userId) as { role: string } | undefined;
  return Boolean(member);
}

function readMember(
  db: HostDatabase,
  projectId: string,
  userId: string,
): ProjectMemberRow | null {
  const row = db
    .prepare('SELECT project_id, user_id, role, active FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(projectId, userId) as
    | { project_id: string; user_id: string; role: string; active: number }
    | undefined;
  if (!row) return null;
  return {
    projectId: row.project_id,
    userId: row.user_id,
    role: row.role,
    active: row.active === 1,
  };
}

/**
 * Ensure active player membership. Never upgrades role to gm/owner.
 * Existing gm/owner rows stay unchanged (no demotion via invite).
 */
function ensureActiveProjectPlayer(
  db: HostDatabase,
  projectId: string,
  userId: string,
): { member: ProjectMemberRow; created: boolean } {
  const existing = readMember(db, projectId, userId);
  if (existing) {
    if (!existing.active) {
      db.prepare('UPDATE project_members SET active = 1 WHERE project_id = ? AND user_id = ?').run(
        projectId,
        userId,
      );
      return {
        member: { ...existing, active: true },
        created: false,
      };
    }
    return { member: existing, created: false };
  }
  db.prepare(
    'INSERT INTO project_members (project_id, user_id, role, active, joined_at, id, character_id) VALUES (?, ?, ?, 1, ?, ?, NULL)',
  ).run(projectId, userId, 'player', nowIso(), randomUUID());
  return {
    member: { projectId, userId, role: 'player', active: true },
    created: true,
  };
}

function ensureSessionPlayer(
  db: HostDatabase,
  sessionId: string,
  userId: string,
  characterId: string | null,
): boolean {
  const existing = db
    .prepare('SELECT user_id FROM session_players WHERE session_id = ? AND user_id = ?')
    .get(sessionId, userId);
  if (existing) {
    db.prepare(
      'UPDATE session_players SET is_online = 1, left_at = NULL, character_id = COALESCE(?, character_id) WHERE session_id = ? AND user_id = ?',
    ).run(characterId, sessionId, userId);
    return false;
  }
  db.prepare(
    'INSERT INTO session_players (session_id, user_id, character_id, is_online, left_at) VALUES (?, ?, ?, 1, NULL)',
  ).run(sessionId, userId, characterId);
  return true;
}

function ensureSessionMemberReader(db: HostDatabase, sessionId: string, userId: string): void {
  // Link to MIG-022 runtime membership as reader (can_write=0) when runtime row exists.
  const runtime = db
    .prepare('SELECT session_id FROM session_runtime WHERE session_id = ?')
    .get(sessionId);
  if (!runtime) return;
  db.prepare(
    'INSERT OR IGNORE INTO session_members (session_id, actor_user_id, can_write) VALUES (?, ?, 0)',
  ).run(sessionId, userId);
}

export function createSessionInviteStore(db: HostDatabase): SessionInviteStore {
  return {
    seedWorldProjectSession(input) {
      const createdAt = nowIso();
      db.prepare(
        'INSERT OR IGNORE INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)',
      ).run(input.worldId, input.gmUserId, 'World', createdAt);
      db.prepare(
        'INSERT OR IGNORE INTO projects (id, world_id, gm_user_id, title, created_at) VALUES (?, ?, ?, ?, ?)',
      ).run(input.projectId, input.worldId, input.gmUserId, 'Project', createdAt);
      db.prepare(
        "INSERT OR IGNORE INTO project_members (project_id, user_id, role, active, joined_at, id, character_id) VALUES (?, ?, 'gm', 1, ?, ?, NULL)",
      ).run(input.projectId, input.gmUserId, createdAt, randomUUID());
      db.prepare(
        'INSERT OR REPLACE INTO play_sessions (session_id, project_id, public_id, join_code, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(
        input.sessionId,
        input.projectId,
        input.publicId,
        normalizeCode(input.joinCode),
        input.status ?? 'waiting',
        createdAt,
      );
    },

    createInvite(actorUserId, sessionId, options = {}) {
      if (!actorUserId) return fail('UNAUTHENTICATED');
      const session = db
        .prepare(
          'SELECT session_id, project_id, public_id, join_code, status FROM play_sessions WHERE session_id = ?',
        )
        .get(sessionId) as
        | {
            session_id: string;
            project_id: string;
            public_id: string;
            join_code: string | null;
            status: string;
          }
        | undefined;
      if (!session) return fail('SESSION_MISSING');
      if (!isProjectGm(db, session.project_id, actorUserId)) return fail('FORBIDDEN');

      const ttlMs = options.ttlMs ?? 7 * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();
      const id = newId('inv');
      const token = generateToken();
      const createdAt = nowIso();

      let inTx = false;
      try {
        db.exec('BEGIN IMMEDIATE');
        inTx = true;
        db.prepare(
          'UPDATE session_invites SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL',
        ).run(createdAt, sessionId);
        db.prepare(
          `INSERT INTO session_invites
            (id, session_id, token, created_by, created_at, expires_at, revoked_at, last_resolved_at, redeem_count, max_redemptions)
           VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?)`,
        ).run(id, sessionId, token, actorUserId, createdAt, expiresAt, options.maxRedemptions ?? null);
        db.exec('COMMIT');
        inTx = false;
        return { ok: true, id, token, sessionId, expiresAt };
      } catch (err) {
        if (inTx) {
          try {
            db.exec('ROLLBACK');
          } catch {
            /* ignore */
          }
        }
        if (isSqliteBusyError(err)) return fail('DATABASE_BUSY');
        throw err;
      }
    },

    revokeInvite(actorUserId, token) {
      if (!actorUserId) return fail('UNAUTHENTICATED');
      const normalized = token.trim();
      if (!normalized) return fail('MISSING_TOKEN');
      const invite = db
        .prepare(
          `SELECT i.id, i.session_id, i.revoked_at, p.project_id
             FROM session_invites i
             JOIN play_sessions p ON p.session_id = i.session_id
            WHERE i.token = ?`,
        )
        .get(normalized) as
        | { id: string; session_id: string; revoked_at: string | null; project_id: string }
        | undefined;
      if (!invite) return fail('NOT_FOUND');
      if (!isProjectGm(db, invite.project_id, actorUserId)) return fail('FORBIDDEN');
      if (invite.revoked_at == null) {
        db.prepare('UPDATE session_invites SET revoked_at = ? WHERE id = ?').run(nowIso(), invite.id);
      }
      return { ok: true, id: invite.id };
    },

    resolveInvite(actorUserId, token) {
      if (!actorUserId) return fail('UNAUTHENTICATED');
      const normalized = token.trim();
      if (!normalized) return fail('MISSING_TOKEN');

      let inTx = false;
      try {
        db.exec('BEGIN IMMEDIATE');
        inTx = true;
        const invite = db
          .prepare(
            'SELECT id, session_id, expires_at, revoked_at FROM session_invites WHERE token = ?',
          )
          .get(normalized) as
          | { id: string; session_id: string; expires_at: string; revoked_at: string | null }
          | undefined;
        if (!invite) {
          db.exec('ROLLBACK');
          inTx = false;
          return fail('NOT_FOUND');
        }
        if (invite.revoked_at) {
          db.exec('ROLLBACK');
          inTx = false;
          return fail('REVOKED');
        }
        if (Date.parse(invite.expires_at) <= Date.now()) {
          db.exec('ROLLBACK');
          inTx = false;
          return fail('EXPIRED');
        }
        const session = db
          .prepare(
            'SELECT session_id, project_id, public_id, status FROM play_sessions WHERE session_id = ?',
          )
          .get(invite.session_id) as
          | { session_id: string; project_id: string; public_id: string; status: string }
          | undefined;
        if (!session) {
          db.exec('ROLLBACK');
          inTx = false;
          return fail('SESSION_MISSING');
        }
        if (session.status === 'completed') {
          db.exec('ROLLBACK');
          inTx = false;
          return fail('SESSION_COMPLETED');
        }
        const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(session.project_id);
        if (!project) {
          db.exec('ROLLBACK');
          inTx = false;
          return fail('PROJECT_MISSING');
        }
        db.prepare('UPDATE session_invites SET last_resolved_at = ? WHERE id = ?').run(
          nowIso(),
          invite.id,
        );
        const member = readMember(db, session.project_id, actorUserId);
        const alreadyMember = Boolean(member?.active);
        const gm = isProjectGm(db, session.project_id, actorUserId);
        db.exec('COMMIT');
        inTx = false;
        return {
          ok: true,
          sessionId: session.session_id,
          projectId: session.project_id,
          publicId: session.public_id,
          sessionStatus: session.status,
          alreadyMember,
          isProjectGm: gm,
        };
      } catch (err) {
        if (inTx) {
          try {
            db.exec('ROLLBACK');
          } catch {
            /* ignore */
          }
        }
        if (isSqliteBusyError(err)) return fail('DATABASE_BUSY');
        throw err;
      }
    },

    joinByInviteOrCode(actorUserId, input) {
      if (!actorUserId) return fail('UNAUTHENTICATED');
      // claimedRole is intentionally unused — never trust client role escalation.
      void input.claimedRole;

      const token = typeof input.token === 'string' ? input.token.trim() : '';
      const joinCode =
        typeof input.joinCode === 'string' && input.joinCode.trim()
          ? normalizeCode(input.joinCode)
          : '';
      if (!token && !joinCode) return fail('INVALID_COMMAND');

      let inTx = false;
      try {
        db.exec('BEGIN IMMEDIATE');
        inTx = true;

        let sessionId: string | null = null;
        let inviteId: string | null = null;

        if (token) {
          const invite = db
            .prepare(
              'SELECT id, session_id, expires_at, revoked_at, redeem_count, max_redemptions FROM session_invites WHERE token = ?',
            )
            .get(token) as
            | {
                id: string;
                session_id: string;
                expires_at: string;
                revoked_at: string | null;
                redeem_count: number;
                max_redemptions: number | null;
              }
            | undefined;
          if (!invite) {
            db.exec('ROLLBACK');
            inTx = false;
            return fail('NOT_FOUND');
          }
          if (invite.revoked_at) {
            db.exec('ROLLBACK');
            inTx = false;
            return fail('REVOKED');
          }
          if (Date.parse(invite.expires_at) <= Date.now()) {
            db.exec('ROLLBACK');
            inTx = false;
            return fail('EXPIRED');
          }
          sessionId = invite.session_id;
          inviteId = invite.id;
        } else {
          const session = db
            .prepare(
              'SELECT session_id FROM play_sessions WHERE join_code IS NOT NULL AND join_code = ?',
            )
            .get(joinCode) as { session_id: string } | undefined;
          if (!session) {
            db.exec('ROLLBACK');
            inTx = false;
            return fail('NOT_FOUND');
          }
          sessionId = session.session_id;
        }

        const session = db
          .prepare(
            'SELECT session_id, project_id, public_id, status FROM play_sessions WHERE session_id = ?',
          )
          .get(sessionId) as
          | { session_id: string; project_id: string; public_id: string; status: string }
          | undefined;
        if (!session) {
          db.exec('ROLLBACK');
          inTx = false;
          return fail('SESSION_MISSING');
        }
        if (session.status === 'completed') {
          db.exec('ROLLBACK');
          inTx = false;
          return fail('SESSION_COMPLETED');
        }

        if (inviteId) {
          // Claim redeem slot before mutating membership (atomic under BEGIN IMMEDIATE).
          const claimed = db
            .prepare(
              `UPDATE session_invites
                  SET redeem_count = redeem_count + 1, last_resolved_at = ?
                WHERE id = ?
                  AND revoked_at IS NULL
                  AND expires_at > ?
                  AND (max_redemptions IS NULL OR redeem_count < max_redemptions)`,
            )
            .run(nowIso(), inviteId, nowIso());
          if (claimed.changes !== 1) {
            db.exec('ROLLBACK');
            inTx = false;
            return fail('REDEEM_LIMIT');
          }
        }

        const { member, created: createdMembership } = ensureActiveProjectPlayer(
          db,
          session.project_id,
          actorUserId,
        );
        // Hard invariant: invite/join path never grants gm/owner for new members.
        if (createdMembership && member.role !== 'player') {
          db.exec('ROLLBACK');
          inTx = false;
          return fail('FORBIDDEN');
        }

        const characterId =
          typeof input.characterId === 'string' && input.characterId.trim()
            ? input.characterId.trim()
            : null;
        const createdPlayer = ensureSessionPlayer(db, session.session_id, actorUserId, characterId);
        ensureSessionMemberReader(db, session.session_id, actorUserId);

        db.exec('COMMIT');
        inTx = false;
        return {
          ok: true,
          sessionId: session.session_id,
          projectId: session.project_id,
          membership: member,
          createdMembership,
          createdPlayer,
        };
      } catch (err) {
        if (inTx) {
          try {
            db.exec('ROLLBACK');
          } catch {
            /* ignore */
          }
        }
        if (isSqliteBusyError(err)) return fail('DATABASE_BUSY');
        throw err;
      }
    },

    listProjectMembers(projectId) {
      const rows = db
        .prepare('SELECT project_id, user_id, role, active FROM project_members WHERE project_id = ?')
        .all(projectId) as Array<{
        project_id: string;
        user_id: string;
        role: string;
        active: number;
      }>;
      return rows.map((row) => ({
        projectId: row.project_id,
        userId: row.user_id,
        role: row.role,
        active: row.active === 1,
      }));
    },

    getPlaySession(sessionId) {
      const row = db
        .prepare(
          'SELECT session_id, project_id, public_id, join_code, status FROM play_sessions WHERE session_id = ?',
        )
        .get(sessionId) as
        | {
            session_id: string;
            project_id: string;
            public_id: string;
            join_code: string | null;
            status: string;
          }
        | undefined;
      if (!row) return null;
      return {
        sessionId: row.session_id,
        projectId: row.project_id,
        publicId: row.public_id,
        joinCode: row.join_code,
        status: row.status,
      };
    },
  };
}

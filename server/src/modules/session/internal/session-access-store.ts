/**
 * Session join/leave + invite RPCs (#869). Private — session public API only.
 * Location: server/src/modules/session/internal/session-access-store.ts
 *
 * Legacy fixes: foreign leave is a no-op (no revision/event);
 * append_session_event stays private (RPC-SEC-ANON-EVENT-HELPER).
 */
import { randomBytes, randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { ProjectPorts } from '../../project/index.ts';
import type { PlaySessionRow } from './session-lifecycle-store.ts';

export type AccessError = { readonly ok: false; readonly error: string };
export type Ok<T> = { readonly ok: true; readonly value: T };

export type InviteCreateResult = {
  readonly id: string;
  readonly token: string;
  readonly session_id: string;
  readonly expires_at: string;
};

export type InviteResolveOk = {
  readonly ok: true;
  readonly saga_public_id: string;
  readonly session_public_id: string;
  readonly project_id: string;
  readonly session_id: string;
  readonly session_status: string;
  readonly already_member: boolean;
  readonly is_project_gm: boolean;
  readonly character_public_id: string | null;
};

export type InviteResolveFail = {
  readonly ok: false;
  readonly error_code: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function generateToken(): string {
  return randomBytes(24).toString('hex');
}

export class SessionAccessStore {
  readonly #db: HostDatabase;
  readonly #project: ProjectPorts;

  constructor(db: HostDatabase, project: ProjectPorts) {
    this.#db = db;
    this.#project = project;
  }

  #withTx<T>(fn: () => T): T {
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

  #readSession(sessionId: string): PlaySessionRow | null {
    const row = this.#db
      .prepare(
        `SELECT session_id AS sessionId, project_id AS projectId, public_id AS publicId,
                join_code AS joinCode, status, session_number AS sessionNumber, name, notes,
                runtime_revision AS runtimeRevision, world_state AS worldState,
                created_at AS createdAt, started_at AS startedAt, ended_at AS endedAt
         FROM play_sessions WHERE session_id = ?`,
      )
      .get(sessionId) as PlaySessionRow | undefined;
    return row ?? null;
  }

  #isGm(projectId: string, actorIds: readonly string[]): boolean {
    return this.#project.isProjectGm(projectId, actorIds);
  }

  #ensureRuntime(sessionId: string, projectId: string, now: string): void {
    this.#db
      .prepare(
        `INSERT INTO session_runtime (session_id, project_id, revision, state_json, updated_at)
         VALUES (?, ?, 0, ?, ?)
         ON CONFLICT(session_id) DO NOTHING`,
      )
      .run(sessionId, projectId, JSON.stringify({ status: 'waiting', roster: {}, gameplay: {} }), now);
  }

  /** Private event writer — never exported (RPC-SEC-ANON-EVENT-HELPER). */
  #appendEvent(
    sessionId: string,
    actorId: string,
    kind: string,
    payload: unknown,
    revision: number,
  ): void {
    const seqRow = this.#db
      .prepare(
        `SELECT COALESCE(MAX(event_sequence), 0) AS m FROM session_events WHERE session_id = ?`,
      )
      .get(sessionId) as { m: number };
    const nextSeq = Number(seqRow.m) + 1;
    this.#db
      .prepare(
        `INSERT INTO session_events (
           session_id, event_sequence, revision, actor_user_id, idempotency_key, payload_json
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        sessionId,
        nextSeq,
        revision,
        actorId,
        `${kind}:${actorId}:${revision}:${nextSeq}`,
        JSON.stringify({ kind, payload }),
      );
  }

  #ensureActiveProjectPlayer(
    projectId: string,
    userId: string,
    characterId: string | null,
  ): void {
    const existing = this.#db
      .prepare(
        `SELECT active, role FROM project_members WHERE project_id = ? AND user_id = ?`,
      )
      .get(projectId, userId) as { active: number; role: string } | undefined;
    if (existing) {
      if (existing.active !== 1) {
        this.#db
          .prepare(
            `UPDATE project_members SET active = 1, character_id = COALESCE(?, character_id)
             WHERE project_id = ? AND user_id = ?`,
          )
          .run(characterId, projectId, userId);
      } else if (characterId) {
        this.#db
          .prepare(
            `UPDATE project_members SET character_id = COALESCE(?, character_id)
             WHERE project_id = ? AND user_id = ?`,
          )
          .run(characterId, projectId, userId);
      }
      return;
    }
    this.#db
      .prepare(
        `INSERT INTO project_members
           (project_id, user_id, role, active, joined_at, id, character_id)
         VALUES (?, ?, 'player', 1, ?, ?, ?)`,
      )
      .run(projectId, userId, nowIso(), randomUUID(), characterId);
  }

  joinSessionByCode(
    actorIds: readonly string[],
    codeRaw: string,
    characterId: string | null,
  ): Ok<PlaySessionRow> | AccessError {
    if (!actorIds[0]) return { ok: false, error: '42501' };
    const code = normalizeCode(codeRaw ?? '');
    if (!code) return { ok: false, error: '22023:Session code is required' };
    try {
      return this.#withTx(() => {
        const session = this.#db
          .prepare(
            `SELECT session_id AS sessionId FROM play_sessions
             WHERE join_code IS NOT NULL AND join_code = ?`,
          )
          .get(code) as { sessionId: string } | undefined;
        if (!session) return { ok: false, error: 'P0002:Session not found' };
        const current = this.#readSession(session.sessionId);
        if (!current) return { ok: false, error: 'P0002:Session not found' };
        if (current.status === 'completed') {
          return { ok: false, error: '22023:Session is completed' };
        }

        let boundCharacter: string | null = null;
        if (characterId) {
          const ch = this.#db
            .prepare(
              `SELECT id, owner_user_id AS ownerUserId, character_type AS characterType,
                      sheet_status AS sheetStatus
               FROM characters WHERE id = ?`,
            )
            .get(characterId) as
            | {
                id: string;
                ownerUserId: string;
                characterType: string;
                sheetStatus: string;
              }
            | undefined;
          if (
            !ch ||
            !actorIds.includes(ch.ownerUserId) ||
            ch.characterType !== 'pc'
          ) {
            return { ok: false, error: '42501:Character is not owned by the current user' };
          }
          if ((ch.sheetStatus || 'complete') !== 'complete') {
            return {
              ok: false,
              error: '22023:Unvollständige Charakterbögen können keiner Session beitreten',
            };
          }
          boundCharacter = ch.id;
        }

        const now = nowIso();
        this.#ensureRuntime(current.sessionId, current.projectId, now);
        this.#ensureActiveProjectPlayer(current.projectId, actorIds[0], boundCharacter);

        const existingPlayer = this.#db
          .prepare(
            `SELECT user_id FROM session_players WHERE session_id = ? AND user_id = ?`,
          )
          .get(current.sessionId, actorIds[0]);
        if (existingPlayer) {
          this.#db
            .prepare(
              `UPDATE session_players
                 SET character_id = COALESCE(?, character_id), is_online = 1, left_at = NULL
               WHERE session_id = ? AND user_id = ?`,
            )
            .run(boundCharacter, current.sessionId, actorIds[0]);
        } else {
          this.#db
            .prepare(
              `INSERT INTO session_players (session_id, user_id, character_id, is_online, left_at)
               VALUES (?, ?, ?, 1, NULL)`,
            )
            .run(current.sessionId, actorIds[0], boundCharacter);
        }

        this.#db
          .prepare(
            `INSERT OR IGNORE INTO session_members (session_id, actor_user_id, can_write)
             VALUES (?, ?, 0)`,
          )
          .run(current.sessionId, actorIds[0]);

        const revision = Number(current.runtimeRevision ?? 0) + 1;
        this.#db
          .prepare(`UPDATE play_sessions SET runtime_revision = ? WHERE session_id = ?`)
          .run(revision, current.sessionId);
        this.#appendEvent(current.sessionId, actorIds[0], 'join', { characterId: boundCharacter }, revision);

        const row = this.#readSession(current.sessionId);
        if (!row) return { ok: false, error: 'P0001' };
        return { ok: true, value: row };
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }
  }

  /**
   * Leave: delete own roster row. Foreign / non-participant → no-op
   * (no revision bump, no event) — RPC-SEC-LEAVE-FOREIGN fix.
   */
  leavePlaySession(
    actorIds: readonly string[],
    sessionId: string,
  ): Ok<{ readonly left: boolean; readonly runtimeRevision: number }> | AccessError {
    if (!actorIds[0]) return { ok: false, error: '42501' };
    if (!sessionId) return { ok: false, error: '22023' };
    try {
      return this.#withTx(() => {
        const current = this.#readSession(sessionId);
        if (!current) {
          this.#db
            .prepare(`DELETE FROM session_players WHERE session_id = ? AND user_id = ?`)
            .run(sessionId, actorIds[0]);
          return { ok: true, value: { left: false, runtimeRevision: 0 } };
        }

        const del = this.#db
          .prepare(`DELETE FROM session_players WHERE session_id = ? AND user_id = ?`)
          .run(sessionId, actorIds[0]);
        if (del.changes === 0) {
          return {
            ok: true,
            value: { left: false, runtimeRevision: current.runtimeRevision },
          };
        }

        const now = nowIso();
        this.#ensureRuntime(sessionId, current.projectId, now);
        const revision = Number(current.runtimeRevision ?? 0) + 1;
        this.#db
          .prepare(`UPDATE play_sessions SET runtime_revision = ? WHERE session_id = ?`)
          .run(revision, sessionId);
        this.#appendEvent(sessionId, actorIds[0], 'leave', {}, revision);
        return { ok: true, value: { left: true, runtimeRevision: revision } };
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }
  }

  createSessionInvite(
    actorIds: readonly string[],
    sessionId: string,
  ): Ok<InviteCreateResult> | AccessError {
    if (!actorIds[0]) return { ok: false, error: '42501' };
    if (!sessionId) return { ok: false, error: '22023:session_id required' };
    try {
      return this.#withTx(() => {
        const current = this.#readSession(sessionId);
        if (!current) return { ok: false, error: 'P0002:Session not found' };
        if (current.status === 'completed') {
          return { ok: false, error: '22023:Session is completed' };
        }
        if (!this.#isGm(current.projectId, actorIds)) {
          return { ok: false, error: '42501:forbidden' };
        }
        const now = nowIso();
        this.#db
          .prepare(
            `UPDATE session_invites SET revoked_at = ? WHERE session_id = ? AND revoked_at IS NULL`,
          )
          .run(now, sessionId);
        const id = `inv_${randomBytes(12).toString('hex')}`;
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        this.#db
          .prepare(
            `INSERT INTO session_invites
               (id, session_id, token, created_by, created_at, expires_at, revoked_at,
                last_resolved_at, redeem_count, max_redemptions)
             VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL)`,
          )
          .run(id, sessionId, token, actorIds[0], now, expiresAt);
        return {
          ok: true,
          value: {
            id,
            token,
            session_id: sessionId,
            expires_at: expiresAt,
          },
        };
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }
  }

  revokeSessionInvite(
    actorIds: readonly string[],
    tokenRaw: string,
  ): Ok<{ readonly ok: true; readonly id: string }> | AccessError {
    if (!actorIds[0]) return { ok: false, error: '42501' };
    const token = (tokenRaw ?? '').trim();
    if (!token) return { ok: false, error: '22023:token required' };
    try {
      return this.#withTx(() => {
        const invite = this.#db
          .prepare(
            `SELECT i.id AS id, i.session_id AS sessionId, i.revoked_at AS revokedAt,
                    p.project_id AS projectId
             FROM session_invites i
             JOIN play_sessions p ON p.session_id = i.session_id
             WHERE i.token = ?`,
          )
          .get(token) as
          | {
              id: string;
              sessionId: string;
              revokedAt: string | null;
              projectId: string;
            }
          | undefined;
        if (!invite) return { ok: false, error: 'P0002:Invite not found' };
        if (!this.#isGm(invite.projectId, actorIds)) {
          return { ok: false, error: '42501:forbidden' };
        }
        if (invite.revokedAt == null) {
          this.#db
            .prepare(`UPDATE session_invites SET revoked_at = ? WHERE id = ?`)
            .run(nowIso(), invite.id);
        }
        return { ok: true, value: { ok: true, id: invite.id } };
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }
  }

  resolveSessionInvite(
    actorIds: readonly string[],
    tokenRaw: string,
  ): InviteResolveOk | InviteResolveFail | AccessError {
    if (!actorIds[0]) return { ok: false, error: '42501' };
    const token = (tokenRaw ?? '').trim();
    if (!token) return { ok: false, error_code: 'missing_token' };
    try {
      return this.#withTx(() => {
        const invite = this.#db
          .prepare(
            `SELECT id, session_id AS sessionId, expires_at AS expiresAt, revoked_at AS revokedAt
             FROM session_invites WHERE token = ?`,
          )
          .get(token) as
          | {
              id: string;
              sessionId: string;
              expiresAt: string;
              revokedAt: string | null;
            }
          | undefined;
        if (!invite) return { ok: false, error_code: 'not_found' };
        if (invite.revokedAt) return { ok: false, error_code: 'revoked' };
        if (Date.parse(invite.expiresAt) <= Date.now()) {
          return { ok: false, error_code: 'expired' };
        }
        const session = this.#readSession(invite.sessionId);
        if (!session) return { ok: false, error_code: 'session_missing' };
        if (session.status === 'completed') {
          return { ok: false, error_code: 'session_completed' };
        }
        const project = this.#db
          .prepare(`SELECT public_id AS publicId FROM projects WHERE id = ?`)
          .get(session.projectId) as { publicId: string | null } | undefined;
        const sagaPublicId = (project?.publicId ?? '').trim().toUpperCase();
        if (!sagaPublicId) return { ok: false, error_code: 'saga_missing' };

        this.#db
          .prepare(`UPDATE session_invites SET last_resolved_at = ? WHERE id = ?`)
          .run(nowIso(), invite.id);

        const roster = this.#db
          .prepare(
            `SELECT character_id AS characterId FROM session_players
             WHERE session_id = ? AND user_id = ? AND left_at IS NULL`,
          )
          .get(session.sessionId, actorIds[0]) as { characterId: string | null } | undefined;
        const alreadyMember = Boolean(roster);
        const isGm = this.#isGm(session.projectId, actorIds);

        return {
          ok: true,
          saga_public_id: sagaPublicId,
          session_public_id: session.publicId.toUpperCase(),
          project_id: session.projectId,
          session_id: session.sessionId,
          session_status: session.status,
          already_member: alreadyMember,
          is_project_gm: isGm,
          character_public_id: null,
        };
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }
  }
}

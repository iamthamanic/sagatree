/**
 * Session create + status transitions (#868). Private — session public API only.
 * Location: server/src/modules/session/internal/session-lifecycle-store.ts
 *
 * Direct append_session_event is NOT exported (RPC-SEC-ANON-EVENT-HELPER deny).
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { ProjectPorts } from '../../project/index.ts';
import { generateSessionJoinCode, generateSessionPublicId } from './public-session-id.ts';

export type LifecycleError = { readonly ok: false; readonly error: string };
export type Ok<T> = { readonly ok: true; readonly value: T };

export type PlaySessionRow = {
  readonly sessionId: string;
  readonly projectId: string;
  readonly publicId: string;
  readonly joinCode: string | null;
  readonly status: string;
  readonly sessionNumber: number;
  readonly name: string | null;
  readonly notes: string | null;
  readonly runtimeRevision: number;
  readonly worldState: string;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  /** Optional session Look override (FE-HOST-12). */
  readonly lookProfileId?: string | null;
  /** Project GM — populated on read for FE lobby membership checks. */
  readonly gmUserId?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

const ALLOWED: Record<string, readonly string[]> = {
  waiting: ['active', 'completed'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
};

export class SessionLifecycleStore {
  readonly #db: HostDatabase;
  readonly #project: ProjectPorts;

  constructor(db: HostDatabase, project: ProjectPorts) {
    this.#db = db;
    this.#project = project;
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

  #read(sessionId: string): PlaySessionRow | null {
    const row = this.#db
      .prepare(
        `SELECT ps.session_id AS sessionId, ps.project_id AS projectId, ps.public_id AS publicId,
                ps.join_code AS joinCode, ps.status AS status,
                ps.session_number AS sessionNumber, ps.name AS name, ps.notes AS notes,
                ps.runtime_revision AS runtimeRevision, ps.world_state AS worldState,
                ps.created_at AS createdAt, ps.started_at AS startedAt, ps.ended_at AS endedAt,
                ps.look_profile_id AS lookProfileId,
                p.gm_user_id AS gmUserId
         FROM play_sessions ps
         LEFT JOIN projects p ON p.id = ps.project_id
         WHERE ps.session_id = ?`,
      )
      .get(sessionId) as PlaySessionRow | undefined;
    return row ?? null;
  }

  #isGm(projectId: string, actorIds: readonly string[]): boolean {
    return this.#project.isProjectGm(projectId, actorIds);
  }

  /** Active gm/player member (legacy role IN ('gm','player')); observers denied. */
  #isActiveGmOrPlayer(projectId: string, actorIds: readonly string[]): boolean {
    if (this.#isGm(projectId, actorIds)) return true;
    const ids = actorIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (ids.length === 0) return false;
    const placeholders = ids.map(() => '?').join(',');
    const row = this.#db
      .prepare(
        `SELECT 1 AS ok FROM project_members
         WHERE project_id = ?
           AND user_id IN (${placeholders})
           AND active = 1
           AND role IN ('gm', 'player')`,
      )
      .get(projectId, ...ids) as { ok: number } | undefined;
    return Boolean(row);
  }

  #nextSessionNumber(projectId: string): number {
    const row = this.#db
      .prepare(
        `SELECT COALESCE(MAX(session_number), 0) AS m FROM play_sessions WHERE project_id = ?`,
      )
      .get(projectId) as { m: number };
    return Number(row.m) + 1;
  }

  #uniqueJoinCode(): string {
    for (let i = 0; i < 16; i += 1) {
      const code = generateSessionJoinCode();
      const hit = this.#db
        .prepare(`SELECT 1 AS o FROM play_sessions WHERE join_code = ? LIMIT 1`)
        .get(code);
      if (!hit) return code;
    }
    throw new Error('join-code-exhausted');
  }

  #uniquePublicId(): string {
    for (let i = 0; i < 16; i += 1) {
      const publicId = generateSessionPublicId();
      const hit = this.#db
        .prepare(`SELECT 1 AS o FROM play_sessions WHERE public_id = ? LIMIT 1`)
        .get(publicId);
      if (!hit) return publicId;
    }
    throw new Error('public-id-exhausted');
  }

  /** Seed runtime + GM writer so join-before-activate works (MIG-022 membership). */
  #ensureRuntimeSeed(sessionId: string, projectId: string, gmActorId: string, now: string): void {
    this.#db
      .prepare(
        `INSERT INTO session_runtime (session_id, project_id, revision, state_json, updated_at)
         VALUES (?, ?, 0, ?, ?)
         ON CONFLICT(session_id) DO NOTHING`,
      )
      .run(
        sessionId,
        projectId,
        JSON.stringify({ status: 'waiting', roster: [], gameplay: { sceneId: null, combatActive: false, shared: {} } }),
        now,
      );
    this.#db
      .prepare(
        `INSERT OR IGNORE INTO session_members (session_id, actor_user_id, can_write)
         VALUES (?, ?, 1)`,
      )
      .run(sessionId, gmActorId);
  }

  #runtimeRevision(sessionId: string): number {
    const row = this.#db
      .prepare(`SELECT revision FROM session_runtime WHERE session_id = ?`)
      .get(sessionId) as { revision: number } | undefined;
    return Number(row?.revision ?? 0);
  }

  #buildProjectSessionWorld(projectId: string): string {
    const proj = this.#db
      .prepare(`SELECT adventure_runtime AS adventureRuntime FROM projects WHERE id = ?`)
      .get(projectId) as { adventureRuntime: string } | undefined;
    let adventure: unknown = {};
    try {
      adventure = JSON.parse(proj?.adventureRuntime ?? '{}');
    } catch {
      adventure = {};
    }
    if (adventure === null || typeof adventure !== 'object' || Array.isArray(adventure)) {
      adventure = {};
    }

    // Prefer newest completed session that actually carries object knowledge.
    const priors = this.#db
      .prepare(
        `SELECT world_state AS worldState FROM play_sessions
         WHERE project_id = ? AND status = 'completed'
         ORDER BY session_number DESC`,
      )
      .all(projectId) as { worldState: string }[];

    let knowledge: unknown = null;
    for (const prior of priors) {
      try {
        const ws = JSON.parse(prior.worldState) as {
          shared?: { knowledge?: unknown };
        };
        const k = ws?.shared?.knowledge;
        if (k !== null && typeof k === 'object' && !Array.isArray(k)) {
          knowledge = k;
          break;
        }
      } catch {
        /* continue */
      }
    }

    const shared =
      knowledge !== null
        ? { adventure, knowledge }
        : { adventure };
    return JSON.stringify({ shared });
  }

  #upsertCompletionRecap(sessionId: string, projectId: string, now: string): void {
    const session = this.#read(sessionId);
    let adventure: Record<string, unknown> = {};
    try {
      const ws = JSON.parse(session?.worldState ?? '{}') as {
        shared?: { adventure?: unknown };
      };
      const adv = ws?.shared?.adventure;
      if (adv !== null && typeof adv === 'object' && !Array.isArray(adv)) {
        adventure = adv as Record<string, unknown>;
      }
    } catch {
      adventure = {};
    }
    // Fallback to project adventure_runtime when session has no adventure object.
    if (Object.keys(adventure).length === 0) {
      const proj = this.#db
        .prepare(`SELECT adventure_runtime AS adventureRuntime FROM projects WHERE id = ?`)
        .get(projectId) as { adventureRuntime: string } | undefined;
      try {
        const parsed = JSON.parse(proj?.adventureRuntime ?? '{}') as unknown;
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          adventure = parsed as Record<string, unknown>;
        }
      } catch {
        adventure = {};
      }
    }

    const schemaVersion = Number(adventure.schemaVersion ?? 0);
    if (schemaVersion === 1) {
      this.#db
        .prepare(`UPDATE projects SET adventure_runtime = ? WHERE id = ?`)
        .run(JSON.stringify(adventure), projectId);
    }

    const snapshot = JSON.stringify(adventure);
    const highlights = JSON.stringify([]);
    this.#db
      .prepare(
        `INSERT INTO session_recaps (
           session_id, summary_text, summary_status, highlight_lines, snapshot,
           created_at, updated_at
         ) VALUES (?, NULL, 'none', ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           highlight_lines = excluded.highlight_lines,
           snapshot = excluded.snapshot,
           updated_at = excluded.updated_at`,
      )
      .run(sessionId, highlights, snapshot, now, now);
  }

  createPlaySession(
    actorIds: readonly string[],
    projectId: string,
    name: string | null,
  ): Ok<PlaySessionRow> | LifecycleError {
    if (!actorIds[0]) return { ok: false, error: '42501' };
    if (!projectId) return { ok: false, error: '22023' };
    if (!this.#isGm(projectId, actorIds)) return { ok: false, error: '42501' };
    try {
      return this.#withImmediateTx(() => {
        const sessionId = randomUUID();
        const createdAt = nowIso();
        const sessionNumber = this.#nextSessionNumber(projectId);
        const joinCode = this.#uniqueJoinCode();
        const publicId = this.#uniquePublicId();
        const trimmed =
          typeof name === 'string' && name.trim() !== '' ? name.trim() : null;
        this.#db
          .prepare(
            `INSERT INTO play_sessions (
               session_id, project_id, public_id, join_code, status, created_at,
               session_number, name, notes, world_state, runtime_revision, updated_at
             ) VALUES (?, ?, ?, ?, 'waiting', ?, ?, ?, NULL, '{}', 0, ?)`,
          )
          .run(
            sessionId,
            projectId,
            publicId,
            joinCode,
            createdAt,
            sessionNumber,
            trimmed,
            createdAt,
          );
        this.#ensureRuntimeSeed(sessionId, projectId, actorIds[0], createdAt);
        const row = this.#read(sessionId);
        if (!row) return { ok: false, error: 'P0001' };
        return { ok: true, value: row };
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }
  }

  /**
   * create_project_session — GM or active player member may create scheduled session.
   * Carries adventure_runtime + last completed knowledge into world_state.
   */
  createProjectSession(
    actorIds: readonly string[],
    projectId: string,
    name: string | null,
    notes: string | null = null,
  ): Ok<PlaySessionRow> | LifecycleError {
    if (!actorIds[0]) return { ok: false, error: '42501' };
    if (!projectId) return { ok: false, error: '22023' };
    if (!this.#isActiveGmOrPlayer(projectId, actorIds)) {
      return { ok: false, error: '42501' };
    }
    try {
      return this.#withImmediateTx(() => {
        const sessionId = randomUUID();
        const createdAt = nowIso();
        const sessionNumber = this.#nextSessionNumber(projectId);
        const joinCode = this.#uniqueJoinCode();
        const publicId = this.#uniquePublicId();
        const trimmed =
          typeof name === 'string' && name.trim() !== '' ? name.trim() : null;
        const noteTrimmed =
          typeof notes === 'string' && notes.trim() !== '' ? notes.trim() : null;
        const worldState = this.#buildProjectSessionWorld(projectId);
        this.#db
          .prepare(
            `INSERT INTO play_sessions (
               session_id, project_id, public_id, join_code, status, created_at,
               session_number, name, notes, world_state, runtime_revision, updated_at
             ) VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?, 0, ?)`,
          )
          .run(
            sessionId,
            projectId,
            publicId,
            joinCode,
            createdAt,
            sessionNumber,
            trimmed,
            noteTrimmed,
            worldState,
            createdAt,
          );
        this.#ensureRuntimeSeed(sessionId, projectId, actorIds[0], createdAt);
        const row = this.#read(sessionId);
        if (!row) return { ok: false, error: 'P0001' };
        return { ok: true, value: row };
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }
  }

  /**
   * Membership-checked read for FE getSessionById (GM or active project player).
   */
  getPlaySession(
    actorIds: readonly string[],
    sessionId: string,
  ): Ok<PlaySessionRow> | LifecycleError {
    if (!actorIds[0]) return { ok: false, error: '42501' };
    if (!sessionId) return { ok: false, error: '22023' };
    const row = this.#read(sessionId);
    if (!row) return { ok: false, error: 'P0002' };
    if (!this.#isActiveGmOrPlayer(row.projectId, actorIds)) {
      return { ok: false, error: '42501' };
    }
    return { ok: true, value: row };
  }

  /**
   * FE-HOST-12: GM-only session Look override (null clears → inherit saga default).
   * Look ownership is validated by the HTTP/application caller before invoke.
   */
  setSessionLookProfile(
    actorIds: readonly string[],
    sessionId: string,
    lookProfileId: string | null,
  ): Ok<PlaySessionRow> | LifecycleError {
    if (!actorIds[0]) return { ok: false, error: '42501' };
    const id = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!id) return { ok: false, error: '22023' };
    const existing = this.#read(id);
    if (!existing) return { ok: false, error: 'P0002' };
    if (!this.#project.isProjectGm(existing.projectId, actorIds)) {
      return { ok: false, error: '42501' };
    }
    const next =
      lookProfileId === null || lookProfileId === undefined
        ? null
        : typeof lookProfileId === 'string'
          ? lookProfileId.trim() || null
          : null;
    try {
      this.#db
        .prepare(
          `UPDATE play_sessions SET look_profile_id = ?, updated_at = ? WHERE session_id = ?`,
        )
        .run(next, nowIso(), id);
    } catch {
      return { ok: false, error: 'P0001' };
    }
    const row = this.#read(id);
    if (!row) return { ok: false, error: 'P0002' };
    return { ok: true, value: row };
  }

  /**
   * Non-completed play sessions for projects where the actor is GM or active player,
   * plus sessions where the actor is still on session_players.
   */
  listAccessiblePlaySessions(actorIds: readonly string[]): Ok<readonly PlaySessionRow[]> | LifecycleError {
    if (!actorIds[0]) return { ok: false, error: '42501' };
    const ids = actorIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (ids.length === 0) return { ok: false, error: '42501' };
    const placeholders = ids.map(() => '?').join(',');
    // Safe projection only — never list join_code / notes / world_state across sessions.
    const rows = this.#db
      .prepare(
        `SELECT DISTINCT ps.session_id AS sessionId, ps.project_id AS projectId,
                ps.public_id AS publicId, NULL AS joinCode, ps.status AS status,
                ps.session_number AS sessionNumber, ps.name AS name, NULL AS notes,
                ps.runtime_revision AS runtimeRevision, '{}' AS worldState,
                ps.created_at AS createdAt, ps.started_at AS startedAt, ps.ended_at AS endedAt,
                p.gm_user_id AS gmUserId
         FROM play_sessions ps
         JOIN projects p ON p.id = ps.project_id
         WHERE ps.status != 'completed'
           AND (
             p.gm_user_id IN (${placeholders})
             OR EXISTS (
               SELECT 1 FROM project_members m
               WHERE m.project_id = ps.project_id
                 AND m.user_id IN (${placeholders})
                 AND m.active = 1
                 AND m.role IN ('gm', 'player')
             )
             OR EXISTS (
               SELECT 1 FROM session_players sp
               WHERE sp.session_id = ps.session_id
                 AND sp.user_id IN (${placeholders})
                 AND sp.left_at IS NULL
             )
           )
         ORDER BY ps.created_at DESC`,
      )
      .all(...ids, ...ids, ...ids) as Array<PlaySessionRow & { gmUserId?: string }>;
    return {
      ok: true,
      value: rows.map((row) => ({
        ...row,
        joinCode: null,
        notes: null,
        worldState: '{}',
      })),
    };
  }

  /**
   * GM deletes a play session. Cascades invites/players/recaps via FK;
   * clears npc instance session_id; removes session_runtime graph.
   * Idempotent missing → P0002.
   */
  deletePlaySession(
    actorIds: readonly string[],
    sessionId: string,
  ): Ok<{ readonly sessionId: string }> | LifecycleError {
    if (!actorIds[0]) return { ok: false, error: '42501' };
    const id = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!id) return { ok: false, error: '22023' };
    try {
      return this.#withImmediateTx(() => {
        const current = this.#read(id);
        if (!current) return { ok: false, error: 'P0002' };
        if (!this.#isGm(current.projectId, actorIds)) return { ok: false, error: '42501' };

        // PG parity: npc_creature_instances.session_id ON DELETE SET NULL
        this.#db
          .prepare(
            `UPDATE npc_creature_instances SET session_id = NULL, updated_at = ?
             WHERE session_id = ?`,
          )
          .run(nowIso(), id);

        // Runtime graph is not FK-bound to play_sessions — delete explicitly.
        this.#db.prepare(`DELETE FROM session_events WHERE session_id = ?`).run(id);
        this.#db.prepare(`DELETE FROM command_idempotency WHERE session_id = ?`).run(id);
        this.#db.prepare(`DELETE FROM session_members WHERE session_id = ?`).run(id);
        this.#db.prepare(`DELETE FROM session_runtime WHERE session_id = ?`).run(id);
        // Optional revlog table (may be absent on older DBs)
        try {
          this.#db.prepare(`DELETE FROM session_events_revlog WHERE session_id = ?`).run(id);
        } catch {
          /* table may not exist */
        }

        // Cascades: session_invites, session_players, session_recaps, session_outcome_promotions
        this.#db.prepare(`DELETE FROM play_sessions WHERE session_id = ?`).run(id);
        return { ok: true, value: { sessionId: id } };
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }
  }

  setSessionStatus(
    actorIds: readonly string[],
    sessionId: string,
    status: string,
  ): Ok<PlaySessionRow> | LifecycleError {
    if (!actorIds[0]) return { ok: false, error: '42501' };
    if (!['waiting', 'active', 'paused', 'completed'].includes(status)) {
      return { ok: false, error: '22023' };
    }
    try {
      return this.#withImmediateTx(() => {
        const current = this.#read(sessionId);
        if (!current) return { ok: false, error: 'P0002' };
        if (!this.#isGm(current.projectId, actorIds)) return { ok: false, error: '42501' };
        let from = current.status;
        if (from === 'scheduled') from = 'waiting';
        if (from === 'completed') return { ok: false, error: '22023' };
        const allowed = ALLOWED[from] ?? [];
        if (!allowed.includes(status)) return { ok: false, error: '22023' };
        const now = nowIso();
        this.#ensureRuntimeSeed(sessionId, current.projectId, actorIds[0], now);
        const revision = this.#runtimeRevision(sessionId) + 1;
        const startedAt =
          status === 'active' && !current.startedAt ? now : current.startedAt;
        const endedAt = status === 'completed' ? now : current.endedAt;
        this.#db
          .prepare(
            `UPDATE play_sessions
             SET status = ?, runtime_revision = ?, updated_at = ?,
                 started_at = ?, ended_at = ?
             WHERE session_id = ?`,
          )
          .run(status, revision, now, startedAt, endedAt, sessionId);
        this.#db
          .prepare(
            `UPDATE session_runtime
             SET revision = ?, updated_at = ?
             WHERE session_id = ?`,
          )
          .run(revision, now, sessionId);
        const seqRow = this.#db
          .prepare(
            `SELECT COALESCE(MAX(event_sequence), 0) AS m FROM session_events WHERE session_id = ?`,
          )
          .get(sessionId) as { m: number };
        const nextSeq = Number(seqRow.m) + 1;
        // Runtime envelope: { kind, payload } — matches SessionRuntimeStore.listEventsSince.
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
            actorIds[0],
            `status:${from}:${status}:${revision}`,
            JSON.stringify({ kind: 'status', payload: { from, to: status } }),
          );
        if (status === 'completed') {
          this.#upsertCompletionRecap(sessionId, current.projectId, now);
        }
        const row = this.#read(sessionId);
        if (!row) return { ok: false, error: 'P0001' };
        return { ok: true, value: row };
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }
  }
}

/** Intentionally absent: appendSessionEventPublic — RPC-SEC-ANON-EVENT-HELPER. */
export function appendSessionEventIsExported(): boolean {
  return false;
}

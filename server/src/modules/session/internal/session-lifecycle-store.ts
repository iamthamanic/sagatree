/**
 * Session create + status transitions (#868). Private — session public API only.
 * Location: server/src/modules/session/internal/session-lifecycle-store.ts
 *
 * Direct append_session_event is NOT exported (RPC-SEC-ANON-EVENT-HELPER deny).
 */
import { randomBytes, randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { ProjectPorts } from '../../project/index.ts';

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
};

function nowIso(): string {
  return new Date().toISOString();
}

function newJoinCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

function newPublicId(): string {
  return `SE-${randomBytes(3).toString('hex').toUpperCase()}`;
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

  #isActiveMember(projectId: string, actorIds: readonly string[]): boolean {
    return this.#project.isActiveMember(projectId, actorIds);
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
      const code = newJoinCode();
      const hit = this.#db
        .prepare(`SELECT 1 AS o FROM play_sessions WHERE join_code = ? LIMIT 1`)
        .get(code);
      if (!hit) return code;
    }
    throw new Error('join-code-exhausted');
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

    const prior = this.#db
      .prepare(
        `SELECT world_state AS worldState FROM play_sessions
         WHERE project_id = ? AND status = 'completed'
         ORDER BY session_number DESC LIMIT 1`,
      )
      .get(projectId) as { worldState: string } | undefined;

    let knowledge: unknown = null;
    if (prior?.worldState) {
      try {
        const ws = JSON.parse(prior.worldState) as {
          shared?: { knowledge?: unknown };
        };
        const k = ws?.shared?.knowledge;
        if (k !== null && typeof k === 'object' && !Array.isArray(k)) {
          knowledge = k;
        }
      } catch {
        knowledge = null;
      }
    }

    const shared =
      knowledge !== null
        ? { adventure, knowledge }
        : { adventure };
    return JSON.stringify({ shared });
  }

  #upsertCompletionRecap(sessionId: string, projectId: string, now: string): void {
    const proj = this.#db
      .prepare(`SELECT adventure_runtime AS adventureRuntime FROM projects WHERE id = ?`)
      .get(projectId) as { adventureRuntime: string } | undefined;
    let adventure: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(proj?.adventureRuntime ?? '{}') as unknown;
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        adventure = parsed as Record<string, unknown>;
      }
    } catch {
      adventure = {};
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
           session_id, summary_text, highlight_lines, snapshot, created_at, updated_at
         ) VALUES (?, NULL, ?, ?, ?, ?)
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
        const publicId = newPublicId();
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
    if (!this.#isGm(projectId, actorIds) && !this.#isActiveMember(projectId, actorIds)) {
      return { ok: false, error: '42501' };
    }
    try {
      return this.#withImmediateTx(() => {
        const sessionId = randomUUID();
        const createdAt = nowIso();
        const sessionNumber = this.#nextSessionNumber(projectId);
        const joinCode = this.#uniqueJoinCode();
        const publicId = newPublicId();
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
        const row = this.#read(sessionId);
        if (!row) return { ok: false, error: 'P0001' };
        return { ok: true, value: row };
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
        const revision = Number(current.runtimeRevision ?? 0) + 1;
        const now = nowIso();
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
        // Ensure runtime row exists so the internal status event can land (FK).
        this.#db
          .prepare(
            `INSERT INTO session_runtime (session_id, project_id, revision, state_json, updated_at)
             VALUES (?, ?, ?, '{}', ?)
             ON CONFLICT(session_id) DO UPDATE SET
               revision = excluded.revision,
               updated_at = excluded.updated_at`,
          )
          .run(sessionId, current.projectId, revision, now);
        const seqRow = this.#db
          .prepare(
            `SELECT COALESCE(MAX(event_sequence), 0) AS m FROM session_events WHERE session_id = ?`,
          )
          .get(sessionId) as { m: number };
        const nextSeq = Number(seqRow.m) + 1;
        // Status event is internal-only — no public append_session_event helper.
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
            JSON.stringify({ type: 'status', from, to: status }),
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

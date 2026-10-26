/**
 * Session recap get/save RPCs (#870). Private — session public API only.
 * Location: server/src/modules/session/internal/session-recap-store.ts
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { ProjectPorts } from '../../project/index.ts';

export type RecapError = { readonly ok: false; readonly error: string };
export type RecapDto = {
  readonly sessionId: string;
  readonly summaryText: string | null;
  readonly summaryStatus: 'draft' | 'approved' | 'none';
  readonly highlightLines: readonly RecapHighlightLine[];
  readonly createdAt: string;
  readonly updatedAt: string;
};
export type RecapHighlightLine = {
  readonly id: string;
  readonly kind: string;
  readonly summary: string;
  readonly visibility: string;
};
export type RecapOk = { readonly ok: true; readonly value: RecapDto | null };

function nowIso(): string {
  return new Date().toISOString();
}

/** Port of sagatree_build_recap_highlight_lines — GM sees all; players only public/shared. */
export function buildRecapHighlightLines(
  snapshot: unknown,
  isGm: boolean,
): RecapHighlightLine[] {
  const adventure =
    snapshot !== null && typeof snapshot === 'object' && !Array.isArray(snapshot)
      ? (snapshot as Record<string, unknown>)
      : {};
  const raw = adventure.consequences;
  if (!Array.isArray(raw)) return [];
  const sorted = [...raw]
    .filter((e) => e !== null && typeof e === 'object' && !Array.isArray(e))
    .map((e) => e as Record<string, unknown>)
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    .slice(0, 40);
  const out: RecapHighlightLine[] = [];
  for (const elem of sorted) {
    const visibility = String(elem.visibility ?? 'gm_only');
    if (isGm || visibility === 'public' || visibility === 'shared') {
      out.push({
        id: String(elem.id ?? ''),
        kind: String(elem.kind ?? 'generic'),
        summary: String(elem.summary ?? ''),
        visibility,
      });
    }
    if (out.length >= 20) break;
  }
  return out;
}

export class SessionRecapStore {
  readonly #db: HostDatabase;
  readonly #project: ProjectPorts;

  constructor(db: HostDatabase, project: ProjectPorts) {
    this.#db = db;
    this.#project = project;
  }

  #isNarrowGm(projectId: string, actorIds: readonly string[]): boolean {
    return (
      this.#project.isProjectGm(projectId, actorIds) &&
      this.#project.isActiveMember(projectId, actorIds)
    );
  }

  #isParticipant(sessionId: string, projectId: string, actorIds: readonly string[]): boolean {
    if (this.#project.isProjectGm(projectId, actorIds)) return true;
    if (this.#project.isActiveMember(projectId, actorIds)) return true;
    for (const userId of actorIds) {
      const row = this.#db
        .prepare(
          `SELECT 1 AS o FROM session_players WHERE session_id = ? AND user_id = ?`,
        )
        .get(sessionId, userId) as { o: number } | undefined;
      if (row) return true;
    }
    return false;
  }

  #projectIdForSession(sessionId: string): string | null {
    const row = this.#db
      .prepare(`SELECT project_id AS projectId FROM play_sessions WHERE session_id = ?`)
      .get(sessionId) as { projectId: string } | undefined;
    return row?.projectId ?? null;
  }

  #projectRecap(
    sessionId: string,
    actorIds: readonly string[],
    projectId: string,
  ): RecapDto | null {
    const row = this.#db
      .prepare(
        `SELECT session_id AS sessionId, summary_text AS summaryText,
                summary_status AS summaryStatus, highlight_lines AS highlightLines,
                snapshot, created_at AS createdAt, updated_at AS updatedAt
         FROM session_recaps WHERE session_id = ?`,
      )
      .get(sessionId) as
      | {
          sessionId: string;
          summaryText: string | null;
          summaryStatus: string;
          highlightLines: string;
          snapshot: string;
          createdAt: string;
          updatedAt: string;
        }
      | undefined;
    if (!row) return null;

    const isGm = this.#isNarrowGm(projectId, actorIds);
    let snapshot: unknown = {};
    try {
      snapshot = JSON.parse(row.snapshot);
    } catch {
      snapshot = {};
    }
    const statusRaw = (row.summaryStatus || 'none').toLowerCase();
    const summaryStatus =
      statusRaw === 'draft' || statusRaw === 'approved' || statusRaw === 'none'
        ? statusRaw
        : 'none';
    let summaryText = row.summaryText;
    if (!isGm && summaryStatus !== 'approved') {
      summaryText = null;
    }
    return {
      sessionId: row.sessionId,
      summaryText,
      summaryStatus,
      highlightLines: buildRecapHighlightLines(snapshot, isGm),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  getSessionRecap(actorIds: readonly string[], sessionId: string): RecapOk | RecapError {
    if (!actorIds[0]) return { ok: false, error: '42501:not authenticated' };
    const id = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!id) return { ok: false, error: 'P0002:Session not found' };
    const projectId = this.#projectIdForSession(id);
    if (!projectId) return { ok: false, error: 'P0002:Session not found' };
    if (!this.#isParticipant(id, projectId, actorIds)) {
      return { ok: false, error: '42501:forbidden' };
    }
    return { ok: true, value: this.#projectRecap(id, actorIds, projectId) };
  }

  /**
   * Canonical three-arg save only — two-arg overload ambiguity (RPC-OVERLOAD-RECAP-AMBIGUITY)
   * is intentionally not offered on the host.
   */
  saveSessionRecapSummary(
    actorIds: readonly string[],
    sessionId: string,
    summaryText: string | null,
    status: string,
  ): RecapOk | RecapError {
    if (!actorIds[0]) return { ok: false, error: '42501:not authenticated' };
    const id = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!id) return { ok: false, error: 'P0002:Session not found' };
    const vStatus = String(status ?? 'draft').trim().toLowerCase();
    if (!['draft', 'approved', 'none'].includes(vStatus)) {
      return { ok: false, error: '22023:invalid summary status' };
    }
    const projectId = this.#projectIdForSession(id);
    if (!projectId) return { ok: false, error: 'P0002:Session not found' };
    if (!this.#isNarrowGm(projectId, actorIds)) {
      return { ok: false, error: '42501:forbidden' };
    }
    const trimmed =
      typeof summaryText === 'string' ? summaryText.trim() : '';
    const storedSummary = trimmed === '' ? null : trimmed;
    const now = nowIso();
    this.#db
      .prepare(
        `INSERT INTO session_recaps (
           session_id, summary_text, summary_status, highlight_lines, snapshot,
           created_at, updated_at
         ) VALUES (?, ?, ?, '[]', '{}', ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           summary_text = excluded.summary_text,
           summary_status = excluded.summary_status,
           updated_at = excluded.updated_at`,
      )
      .run(id, storedSummary, vStatus, now, now);
    return { ok: true, value: this.#projectRecap(id, actorIds, projectId) };
  }
}

/**
 * Saga overview / lore / outcome promotion RPCs (#876). Private — saga public API.
 * Location: server/src/modules/saga/internal/saga-projections-store.ts
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { ProjectPorts } from '../../project/index.ts';
import { SagaDefinitionStore } from './saga-definition-store.ts';

export type ProjError = { readonly ok: false; readonly error: string };
export type ProjOk<T> = { readonly ok: true; readonly value: T };

export type WorldEditLookup = {
  readonly canEditWorld: (actorIds: readonly string[], worldId: string) => boolean;
};

/** Narrow lore ACL — avoids importing permissions/internal from saga. */
export type SagaLorePermissionLookup = {
  readonly hasSagaPermission: (
    projectId: string,
    actorIds: readonly string[],
    key: string,
  ) => boolean;
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function filterVisible(
  items: unknown,
  isGm: boolean,
  canHidden: boolean,
): unknown[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
    const vis = String((item as { visibility?: unknown }).visibility ?? 'public');
    if (isGm || canHidden) return true;
    return vis === 'public' || vis === 'shared' || vis === 'discovered';
  });
}

export class SagaProjectionsStore {
  readonly #db: HostDatabase;
  readonly #project: ProjectPorts;
  readonly #defs: SagaDefinitionStore;
  readonly #loreAcl: SagaLorePermissionLookup | null;
  readonly #world: WorldEditLookup;

  constructor(
    db: HostDatabase,
    project: ProjectPorts,
    defs: SagaDefinitionStore,
    loreAcl: SagaLorePermissionLookup | null,
    world: WorldEditLookup,
  ) {
    this.#db = db;
    this.#project = project;
    this.#defs = defs;
    this.#loreAcl = loreAcl;
    this.#world = world;
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

  #actorOk(actorIds: readonly string[]): string | null {
    return actorIds[0] ?? null;
  }

  #projectByPublicId(publicId: string): {
    id: string;
    gmUserId: string;
    publicId: string;
    title: string;
    status: string;
    worldId: string;
    sagaId: string | null;
    sagaVersionId: string | null;
    adventureRuntime: string;
    description: string | null;
  } | null {
    const pid = publicId.trim().toUpperCase();
    if (!pid) return null;
    return (
      (this.#db
        .prepare(
          `SELECT id, gm_user_id AS gmUserId, public_id AS publicId, title, status,
                  world_id AS worldId, saga_id AS sagaId, saga_version_id AS sagaVersionId,
                  adventure_runtime AS adventureRuntime, description
           FROM projects WHERE UPPER(public_id) = ?`,
        )
        .get(pid) as
        | {
            id: string;
            gmUserId: string;
            publicId: string;
            title: string;
            status: string;
            worldId: string;
            sagaId: string | null;
            sagaVersionId: string | null;
            adventureRuntime: string;
            description: string | null;
          }
        | undefined) ?? null
    );
  }

  #findConsequence(
    sessionId: string,
    projectId: string,
    consequenceId: string,
  ): Record<string, unknown> | null {
    const sources: string[] = [];
    const proj = this.#db
      .prepare(`SELECT adventure_runtime AS a FROM projects WHERE id = ?`)
      .get(projectId) as { a: string } | undefined;
    if (proj?.a) sources.push(proj.a);
    const recap = this.#db
      .prepare(`SELECT snapshot FROM session_recaps WHERE session_id = ?`)
      .get(sessionId) as { snapshot: string } | undefined;
    if (recap?.snapshot) sources.push(recap.snapshot);
    for (const raw of sources) {
      const obj = parseJson(raw);
      const list = obj.consequences;
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const id = String((entry as { id?: unknown }).id ?? '');
          if (id === consequenceId) return entry as Record<string, unknown>;
        }
      }
    }
    return null;
  }

  #appendPromoteEvent(
    sessionId: string,
    actorId: string,
    payload: Record<string, unknown>,
  ): void {
    const rt = this.#db
      .prepare(`SELECT revision FROM session_runtime WHERE session_id = ?`)
      .get(sessionId) as { revision: number } | undefined;
    const revision = Number(rt?.revision ?? 0);
    const seqRow = this.#db
      .prepare(
        `SELECT COALESCE(MAX(event_sequence), 0) AS m FROM session_events WHERE session_id = ?`,
      )
      .get(sessionId) as { m: number };
    const nextSeq = Number(seqRow.m) + 1;
    this.#db
      .prepare(
        `INSERT INTO session_events
           (session_id, event_sequence, revision, actor_user_id, idempotency_key, payload_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        sessionId,
        nextSeq,
        revision,
        actorId,
        `promote:${actorId}:${revision}:${nextSeq}`,
        JSON.stringify({ kind: 'adventure', payload }),
      );
  }

  getSagaOverview(
    actorIds: readonly string[],
    publicId: string,
  ): ProjOk<Record<string, unknown>> | ProjError {
    if (!this.#actorOk(actorIds)) return { ok: false, error: '42501:not authenticated' };
    const project = this.#projectByPublicId(publicId);
    if (!project?.publicId) return { ok: false, error: 'P0002:Saga not found' };
    const isGm = this.#project.isProjectGm(project.id, actorIds);
    const isMember = this.#project.isActiveMember(project.id, actorIds);
    if (!isGm && !isMember) return { ok: false, error: '42501:forbidden' };

    const role = isGm
      ? 'gamemaster'
      : (
          this.#db
            .prepare(
              `SELECT role FROM project_members WHERE project_id = ? AND user_id = ? AND active = 1`,
            )
            .get(project.id, actorIds[0]) as { role: string } | undefined
        )?.role ?? 'player';

    const adv = parseJson(project.adventureRuntime);
    const clocks = filterVisible(adv.clocks, isGm, false);
    const consequences = filterVisible(adv.consequences, isGm, false).slice(0, 20);
    const deadlines = filterVisible(adv.openDeadlines ?? adv.deadlines, isGm, false);
    const flags = Array.isArray(adv.flags) ? adv.flags.length : Number(adv.flagCount ?? 0);

    const sessions = this.#db
      .prepare(
        `SELECT session_id AS sessionId, public_id AS sessionPublicId, session_number AS sessionNumber,
                name, status, created_at AS startedAt
         FROM play_sessions WHERE project_id = ? ORDER BY session_number ASC`,
      )
      .all(project.id) as Array<{
      sessionId: string;
      sessionPublicId: string;
      sessionNumber: number | null;
      name: string | null;
      status: string;
      startedAt: string;
    }>;

    const episodes = sessions.map((s) => {
      const recap = this.#db
        .prepare(
          `SELECT summary_text AS t, summary_status AS st FROM session_recaps WHERE session_id = ?`,
        )
        .get(s.sessionId) as { t: string | null; st: string } | undefined;
      let snippet: string | null = null;
      if (recap?.t) {
        if (isGm || recap.st === 'approved') snippet = recap.t.slice(0, 160);
      }
      return {
        sessionId: s.sessionId,
        sessionPublicId: s.sessionPublicId,
        sessionNumber: s.sessionNumber ?? 0,
        name: s.name,
        status: s.status,
        startedAt: s.startedAt,
        endedAt: null,
        recapSnippet: snippet,
      };
    });

    const members = this.#project.listActiveMembers(project.id);
    const ensemble = members.map((m) => {
      const char = this.#db
        .prepare(
          `SELECT character_id AS c FROM project_members WHERE project_id = ? AND user_id = ?`,
        )
        .get(project.id, m.userId) as { c: string | null } | undefined;
      return {
        userId: m.userId,
        role: m.role,
        characterId: char?.c ?? null,
        characterName: null,
        isSelf: actorIds.includes(m.userId),
      };
    });

    const openSessions = sessions.filter((s) =>
      ['waiting', 'active', 'scheduled'].includes(s.status),
    ).length;
    let primaryAction: Record<string, unknown>;
    if (isGm) {
      primaryAction = {
        kind: openSessions > 0 ? 'continue-session' : 'host-session',
        labelDe: openSessions > 0 ? 'Session fortsetzen' : 'Session starten',
        sessionPublicId: sessions[sessions.length - 1]?.sessionPublicId ?? null,
      };
    } else {
      primaryAction = {
        kind: openSessions > 0 ? 'join-session' : 'wait',
        labelDe: openSessions > 0 ? 'Session beitreten' : 'Warten',
        sessionPublicId: sessions[sessions.length - 1]?.sessionPublicId ?? null,
      };
    }

    let versionLabel: string | null = null;
    let newerVersionAvailable = false;
    if (project.sagaVersionId) {
      const ver = this.#defs.getVersion(project.sagaVersionId);
      versionLabel = ver?.version_label ?? null;
    }

    return {
      ok: true,
      value: {
        projectId: project.id,
        sagaPublicId: project.publicId,
        title: project.title,
        blurb: project.description ?? '',
        status: project.status,
        selfRole: role === 'gm' ? 'gamemaster' : role,
        isGm,
        definitionRef: project.sagaId,
        sagaDefinitionId: project.sagaId,
        sagaVersionId: project.sagaVersionId,
        versionLabel,
        newerVersionAvailable,
        primaryAction,
        episodes,
        ensemble,
        worldProfileId: project.worldId,
        worldStateSummary: {
          clocks,
          consequences,
          openDeadlines: deadlines,
          partyLocationRef:
            typeof adv.partyLocationRef === 'string' ? adv.partyLocationRef : null,
          flagCount: flags,
          updatedAt: typeof adv.updatedAt === 'string' ? adv.updatedAt : null,
        },
      },
    };
  }

  getSagaLoreTimeline(
    actorIds: readonly string[],
    publicId: string,
  ): ProjOk<Record<string, unknown>> | ProjError {
    if (!this.#actorOk(actorIds)) return { ok: false, error: '42501:not authenticated' };
    const project = this.#projectByPublicId(publicId);
    if (!project?.publicId) return { ok: false, error: 'P0002:Saga not found' };
    const isGm = this.#project.isProjectGm(project.id, actorIds);
    const isMember = this.#project.isActiveMember(project.id, actorIds);
    if (!isGm && !isMember) return { ok: false, error: '42501:forbidden' };

    if (!isGm && this.#loreAcl) {
      if (!this.#loreAcl.hasSagaPermission(project.id, actorIds, 'saga.lore.read')) {
        return { ok: false, error: '42501:forbidden' };
      }
    }
    const canHidden =
      isGm ||
      Boolean(
        this.#loreAcl?.hasSagaPermission(project.id, actorIds, 'saga.lore.read_hidden'),
      );

    const entries: Array<Record<string, unknown>> = [];

    if (project.sagaVersionId) {
      const ver = this.#defs.getVersion(project.sagaVersionId);
      if (ver?.status === 'published') {
        const payload = parseJson(ver.payload);
        for (const fact of filterVisible(payload.knowledgeFacts, isGm, canHidden)) {
          const f = fact as Record<string, unknown>;
          entries.push({
            id: `saga:${String(f.id ?? '')}`,
            source: 'saga',
            title: String(f.summary ?? f.title ?? ''),
            visibility: String(f.visibility ?? 'public'),
            at: null,
          });
        }
      }
    }

    const recaps = this.#db
      .prepare(
        `SELECT r.session_id AS sessionId, r.summary_text AS summary, r.summary_status AS status,
                r.updated_at AS updatedAt, s.public_id AS sessionPublicId
         FROM session_recaps r
         JOIN play_sessions s ON s.session_id = r.session_id
         WHERE s.project_id = ?`,
      )
      .all(project.id) as Array<{
      sessionId: string;
      summary: string | null;
      status: string;
      updatedAt: string;
      sessionPublicId: string;
    }>;
    for (const r of recaps) {
      if (!isGm && r.status !== 'approved') continue;
      if (!r.summary) continue;
      entries.push({
        id: `recap:${r.sessionId}`,
        source: 'recap',
        title: r.summary.slice(0, 200),
        visibility: r.status === 'approved' ? 'public' : 'gm_only',
        at: r.updatedAt,
        sessionPublicId: r.sessionPublicId,
      });
    }

    return {
      ok: true,
      value: {
        projectId: project.id,
        canReadHidden: canHidden,
        entries,
      },
    };
  }

  promoteSessionOutcomeToSaga(
    actorIds: readonly string[],
    sessionId: string,
    consequenceId: string,
  ): ProjOk<Record<string, unknown>> | ProjError {
    const actorId = this.#actorOk(actorIds);
    if (!actorId) return { ok: false, error: '42501:not authenticated' };
    const sid = sessionId.trim();
    const cid = consequenceId.trim();
    if (!sid || !cid) return { ok: false, error: 'P0002:Session nicht gefunden' };

    const session = this.#db
      .prepare(`SELECT session_id AS id, project_id AS projectId FROM play_sessions WHERE session_id = ?`)
      .get(sid) as { id: string; projectId: string } | undefined;
    if (!session) return { ok: false, error: 'P0002:Session nicht gefunden' };

    if (!this.#project.isProjectGm(session.projectId, actorIds)) {
      return { ok: false, error: '42501:Nur Gamemaster darf übernehmen' };
    }

    const project = this.#db
      .prepare(`SELECT saga_id AS sagaId FROM projects WHERE id = ?`)
      .get(session.projectId) as { sagaId: string | null } | undefined;
    if (!project?.sagaId) {
      return { ok: false, error: '22023:Keine Saga-Definition an diese Gruppe gebunden' };
    }

    const def = this.#defs.getDefinition(project.sagaId);
    if (!def) return { ok: false, error: 'P0002:Saga-Definition nicht gefunden' };
    if (def.origin === 'native') {
      return {
        ok: false,
        error: '42501:Native Sagas sind unveränderlich — bitte zuerst als Kopie speichern',
      };
    }
    if (def.owner_user_id !== actorId && !actorIds.includes(def.owner_user_id ?? '')) {
      return {
        ok: false,
        error: '42501:Nur die Autorin/der Autor der Saga darf in die Definition übernehmen',
      };
    }

    const existing = this.#db
      .prepare(
        `SELECT target_ref AS targetRef FROM session_outcome_promotions
         WHERE project_id = ? AND source_kind = 'consequence' AND source_id = ?
           AND target_kind = 'saga_fact'`,
      )
      .get(session.projectId, cid) as { targetRef: string } | undefined;
    if (existing) {
      return {
        ok: true,
        value: {
          ok: true,
          idempotent: true,
          targetKind: 'saga_fact',
          targetRef: existing.targetRef,
        },
      };
    }

    const cons = this.#findConsequence(sid, session.projectId, cid);
    if (!cons) return { ok: false, error: 'P0002:Ereignis nicht gefunden' };
    const summary = String(cons.summary ?? '').trim();
    if (!summary) return { ok: false, error: '22023:Ereignis ohne Text' };
    let visibility = String(cons.visibility ?? 'shared').trim() || 'shared';
    if (
      !['public', 'shared', 'gm_only', 'discovered', 'character_specific'].includes(visibility)
    ) {
      visibility = 'shared';
    }
    const factId = `promoted:${cid.slice(0, 64)}`;

    try {
      this.#withImmediateTx(() => {
        const draft = this.#defs.ensureDraft(project.sagaId);
        const payload = parseJson(draft.payload);
        const facts = Array.isArray(payload.knowledgeFacts)
          ? [...payload.knowledgeFacts]
          : [];
        const exists = facts.some(
          (f) =>
            f &&
            typeof f === 'object' &&
            !Array.isArray(f) &&
            String((f as { id?: unknown }).id ?? '') === factId,
        );
        if (!exists) {
          facts.push({
            id: factId,
            visibility,
            summary: summary.slice(0, 200),
          });
          payload.knowledgeFacts = facts;
          const now = nowIso();
          this.#db
            .prepare(`UPDATE saga_definition_versions SET payload = ? WHERE id = ?`)
            .run(JSON.stringify(payload), draft.id);
          this.#db
            .prepare(
              `UPDATE saga_definitions SET draft_revision = draft_revision + 1, updated_at = ? WHERE id = ?`,
            )
            .run(now, project.sagaId);
        }

        const now = nowIso();
        this.#db
          .prepare(
            `INSERT INTO session_outcome_promotions
               (id, project_id, session_id, source_kind, source_id, target_kind, target_ref, created_by, created_at)
             VALUES (?, ?, ?, 'consequence', ?, 'saga_fact', ?, ?, ?)`,
          )
          .run(randomUUID(), session.projectId, sid, cid, factId, actorId, now);

        this.#appendPromoteEvent(sid, actorId, {
          op: 'promote_outcome',
          target: 'saga',
          consequenceId: cid,
          factId,
        });
      });
    } catch {
      return { ok: false, error: 'P0001:promote failed' };
    }

    return {
      ok: true,
      value: {
        ok: true,
        idempotent: false,
        targetKind: 'saga_fact',
        targetRef: factId,
        messageDe: 'Ereignis in die Saga übernommen',
      },
    };
  }

  promoteSessionOutcomeToWorld(
    actorIds: readonly string[],
    sessionId: string,
    consequenceId: string,
  ): ProjOk<Record<string, unknown>> | ProjError {
    const actorId = this.#actorOk(actorIds);
    if (!actorId) return { ok: false, error: '42501:not authenticated' };
    const sid = sessionId.trim();
    const cid = consequenceId.trim();
    if (!sid || !cid) return { ok: false, error: 'P0002:Session nicht gefunden' };

    const session = this.#db
      .prepare(`SELECT session_id AS id, project_id AS projectId FROM play_sessions WHERE session_id = ?`)
      .get(sid) as { id: string; projectId: string } | undefined;
    if (!session) return { ok: false, error: 'P0002:Session nicht gefunden' };
    if (!this.#project.isProjectGm(session.projectId, actorIds)) {
      return { ok: false, error: '42501:Nur Gamemaster darf übernehmen' };
    }

    const project = this.#db
      .prepare(`SELECT world_id AS worldId FROM projects WHERE id = ?`)
      .get(session.projectId) as { worldId: string } | undefined;
    if (!project?.worldId) {
      return { ok: false, error: '22023:Keine Welt an diese Gruppe gebunden' };
    }
    if (!this.#world.canEditWorld(actorIds, project.worldId)) {
      return {
        ok: false,
        error: '42501:Nur die Welt-Besitzerin/der Welt-Besitzer darf übernehmen',
      };
    }

    const existing = this.#db
      .prepare(
        `SELECT target_ref AS targetRef FROM session_outcome_promotions
         WHERE project_id = ? AND source_kind = 'consequence' AND source_id = ?
           AND target_kind = 'world_fact'`,
      )
      .get(session.projectId, cid) as { targetRef: string } | undefined;
    if (existing) {
      return {
        ok: true,
        value: {
          ok: true,
          idempotent: true,
          targetKind: 'world_fact',
          targetRef: existing.targetRef,
        },
      };
    }

    const cons = this.#findConsequence(sid, session.projectId, cid);
    if (!cons) return { ok: false, error: 'P0002:Ereignis nicht gefunden' };
    const summary = String(cons.summary ?? '').trim();
    if (!summary) return { ok: false, error: '22023:Ereignis ohne Text' };
    const visibility = String(cons.visibility ?? 'shared');
    const factId = `promoted:${cid.slice(0, 64)}`;

    const world = this.#db
      .prepare(`SELECT payload FROM worlds WHERE id = ?`)
      .get(project.worldId) as { payload: string } | undefined;
    if (!world) return { ok: false, error: '22023:Welt nicht gefunden' };

    try {
      this.#withImmediateTx(() => {
        const payload = parseJson(world.payload);
        const modules =
          payload.modules && typeof payload.modules === 'object' && !Array.isArray(payload.modules)
            ? ({ ...(payload.modules as Record<string, unknown>) } as Record<string, unknown>)
            : {};
        const promotedLore =
          modules.promotedLore &&
          typeof modules.promotedLore === 'object' &&
          !Array.isArray(modules.promotedLore)
            ? ({ ...(modules.promotedLore as Record<string, unknown>) } as Record<string, unknown>)
            : {};
        const facts = Array.isArray(promotedLore.facts) ? [...promotedLore.facts] : [];
        const exists = facts.some(
          (f) =>
            f &&
            typeof f === 'object' &&
            !Array.isArray(f) &&
            String((f as { id?: unknown }).id ?? '') === factId,
        );
        if (!exists) {
          facts.push({
            id: factId,
            summary: summary.slice(0, 200),
            visibility,
            sourceSessionId: sid,
            sourceConsequenceId: cid,
          });
          promotedLore.facts = facts;
          modules.promotedLore = promotedLore;
          payload.modules = modules;
          this.#db
            .prepare(`UPDATE worlds SET payload = ? WHERE id = ?`)
            .run(JSON.stringify(payload), project.worldId);
        }

        const now = nowIso();
        this.#db
          .prepare(
            `INSERT INTO session_outcome_promotions
               (id, project_id, session_id, source_kind, source_id, target_kind, target_ref, created_by, created_at)
             VALUES (?, ?, ?, 'consequence', ?, 'world_fact', ?, ?, ?)`,
          )
          .run(randomUUID(), session.projectId, sid, cid, factId, actorId, now);

        this.#appendPromoteEvent(sid, actorId, {
          op: 'promote_outcome',
          target: 'world',
          consequenceId: cid,
          factId,
        });
      });
    } catch {
      return { ok: false, error: 'P0001:promote failed' };
    }

    return {
      ok: true,
      value: {
        ok: true,
        idempotent: false,
        targetKind: 'world_fact',
        targetRef: factId,
        messageDe: 'In die Welt übernommen.',
      },
    };
  }
}

/**
 * Saga overview / lore / outcome promotion RPCs (#876). Private — saga public API.
 * Location: server/src/modules/saga/internal/saga-projections-store.ts
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { ProjectPorts } from '../../project/index.ts';
import type { SessionPromoteLookup } from '../../session/index.ts';
import { SagaDefinitionStore } from './saga-definition-store.ts';

export type ProjError = { readonly ok: false; readonly error: string };
export type ProjOk<T> = { readonly ok: true; readonly value: T };

export type WorldPromoteLookup = {
  readonly canEditWorld: (actorIds: readonly string[], worldId: string) => boolean;
  readonly appendPromotedLoreFact: (
    worldId: string,
    fact: Record<string, unknown>,
  ) => { readonly ok: true } | { readonly ok: false; readonly error: string };
};

/** Narrow lore ACL — avoids importing permissions/internal from saga. */
export type SagaLorePermissionLookup = {
  readonly hasSagaPermission: (
    projectId: string,
    actorIds: readonly string[],
    key: string,
  ) => boolean;
  readonly listBindings?: (
    actorIds: readonly string[],
    publicId: string,
    assetKind: string | null,
  ) =>
    | {
        readonly ok: true;
        readonly value: readonly {
          readonly id: string;
          readonly assetKind: string;
          readonly assetId: string;
          readonly reveal: string;
          readonly label: string | null;
        }[];
      }
    | { readonly ok: false; readonly error: string };
};

export type CharacterNameLookup = {
  readonly getDisplayName: (characterId: string) => string | null;
};

/** @deprecated alias kept for call-site clarity */
export type WorldEditLookup = WorldPromoteLookup;

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

function asItemList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, unknown>);
  return [];
}

function adventureVisibility(raw: unknown): string {
  if (typeof raw === 'string' && ['public', 'shared', 'gm_only'].includes(raw)) return raw;
  return 'gm_only';
}

/** Player/viewer audience: only public|shared. Missing/malformed → gm_only (fail closed). */
function filterAdventureVisible(items: unknown, isGm: boolean): unknown[] {
  return asItemList(items).filter((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
    const vis = adventureVisibility((item as { visibility?: unknown }).visibility);
    if (isGm) return true;
    return vis === 'public' || vis === 'shared';
  });
}

function filterLoreVisible(items: unknown, isGm: boolean, canHidden: boolean): unknown[] {
  return asItemList(items).filter((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return false;
    const vis = String((item as { visibility?: unknown }).visibility ?? 'gm_only');
    if (isGm || canHidden) return true;
    return vis === 'public' || vis === 'shared' || vis === 'discovered';
  });
}

function flagCount(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (raw && typeof raw === 'object') return Object.keys(raw as Record<string, unknown>).length;
  return Number((raw as { length?: unknown } | null)?.length ?? 0) || 0;
}

function openDeadlines(raw: unknown, isGm: boolean): unknown[] {
  const list = asItemList(raw);
  return filterAdventureVisible(
    list.filter((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      const status = String((item as { status?: unknown }).status ?? 'open');
      return status !== 'fired' && status !== 'resolved' && status !== 'closed';
    }),
    isGm,
  );
}

export class SagaProjectionsStore {
  readonly #db: HostDatabase;
  readonly #project: ProjectPorts;
  readonly #defs: SagaDefinitionStore;
  readonly #loreAcl: SagaLorePermissionLookup | null;
  readonly #world: WorldPromoteLookup;
  readonly #sessionPromote: SessionPromoteLookup;
  readonly #characterNames: CharacterNameLookup | null;

  constructor(
    db: HostDatabase,
    project: ProjectPorts,
    defs: SagaDefinitionStore,
    loreAcl: SagaLorePermissionLookup | null,
    world: WorldPromoteLookup,
    sessionPromote: SessionPromoteLookup,
    characterNames: CharacterNameLookup | null = null,
  ) {
    this.#db = db;
    this.#project = project;
    this.#defs = defs;
    this.#loreAcl = loreAcl;
    this.#world = world;
    this.#sessionPromote = sessionPromote;
    this.#characterNames = characterNames;
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
    // Prefer the selected session's immutable recap snapshot, then live project runtime.
    const sources: string[] = [];
    const recap = this.#db
      .prepare(`SELECT snapshot FROM session_recaps WHERE session_id = ?`)
      .get(sessionId) as { snapshot: string } | undefined;
    if (recap?.snapshot && recap.snapshot !== '{}' && recap.snapshot.trim()) {
      sources.push(recap.snapshot);
    }
    const proj = this.#db
      .prepare(`SELECT adventure_runtime AS a FROM projects WHERE id = ?`)
      .get(projectId) as { a: string } | undefined;
    if (proj?.a) sources.push(proj.a);
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
    const clocks = filterAdventureVisible(adv.clocks, isGm);
    const consequences = filterAdventureVisible(adv.consequences, isGm)
      .slice()
      .sort((a, b) => {
        const at = String((a as { createdAt?: unknown }).createdAt ?? '');
        const bt = String((b as { createdAt?: unknown }).createdAt ?? '');
        return bt.localeCompare(at);
      })
      .slice(0, 20);
    const deadlines = openDeadlines(adv.openDeadlines ?? adv.deadlines, isGm);
    const flags = flagCount(adv.flags);

    const sessions = this.#db
      .prepare(
        `SELECT session_id AS sessionId, public_id AS sessionPublicId, session_number AS sessionNumber,
                name, status,
                COALESCE(started_at, created_at) AS startedAt,
                ended_at AS endedAt
         FROM play_sessions WHERE project_id = ? ORDER BY session_number ASC`,
      )
      .all(project.id) as Array<{
      sessionId: string;
      sessionPublicId: string;
      sessionNumber: number | null;
      name: string | null;
      status: string;
      startedAt: string | null;
      endedAt: string | null;
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
        endedAt: s.endedAt,
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
      const characterId = char?.c ?? null;
      return {
        userId: m.userId,
        role: m.role,
        characterId,
        characterName: characterId
          ? (this.#characterNames?.getDisplayName(characterId) ?? null)
          : null,
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
    if (project.sagaVersionId && project.sagaId) {
      const ver = this.#defs.getVersion(project.sagaVersionId);
      versionLabel = ver?.version_label ?? null;
      const latest = this.#defs.latestPublished(project.sagaId);
      if (latest && latest.id !== project.sagaVersionId) {
        const pinnedAt = ver?.published_at ?? ver?.created_at ?? '';
        const latestAt = latest.published_at ?? latest.created_at ?? '';
        newerVersionAvailable = latestAt > pinnedAt || Boolean(latest.id);
      }
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

    const recaps = this.#db
      .prepare(
        `SELECT r.session_id AS sessionId, r.summary_text AS summary, r.summary_status AS status,
                r.updated_at AS updatedAt, s.public_id AS sessionPublicId, s.name AS sessionName,
                s.session_number AS sessionNumber
         FROM session_recaps r
         JOIN play_sessions s ON s.session_id = r.session_id
         WHERE s.project_id = ?
         ORDER BY COALESCE(s.session_number, 0) DESC, r.updated_at DESC
         LIMIT 40`,
      )
      .all(project.id) as Array<{
      sessionId: string;
      summary: string | null;
      status: string;
      updatedAt: string;
      sessionPublicId: string;
      sessionName: string | null;
      sessionNumber: number | null;
    }>;
    for (const r of recaps) {
      if (!isGm && r.status !== 'approved') continue;
      if (!r.summary) continue;
      entries.push({
        id: `recap:${r.sessionPublicId || r.sessionId}`,
        kind: 'recap',
        title: r.sessionName || 'Episode',
        summary: r.summary.slice(0, 200),
        visibility: r.status === 'approved' ? 'shared' : 'gm_only',
        occurredAt: r.updatedAt,
        meta: {
          sessionPublicId: r.sessionPublicId,
          sessionNumber: r.sessionNumber,
        },
      });
    }

    if (project.sagaVersionId) {
      const ver = this.#defs.getVersion(project.sagaVersionId);
      if (ver?.status === 'published') {
        const payload = parseJson(ver.payload);
        for (const fact of filterLoreVisible(payload.knowledgeFacts, isGm, canHidden)) {
          const f = fact as Record<string, unknown>;
          const fid = String(f.id ?? '');
          entries.push({
            id: `fact:${fid || 'unknown'}`,
            kind: 'knowledge',
            title: fid || 'Wissen',
            summary: String(f.summary ?? ''),
            visibility: String(f.visibility ?? 'gm_only'),
            occurredAt: null,
            meta: {},
          });
        }
      }
    }

    if (this.#loreAcl?.listBindings) {
      const bindings = this.#loreAcl.listBindings(actorIds, project.publicId, 'lore');
      if (bindings.ok) {
        for (const b of bindings.value) {
          if (b.reveal === 'gm_only' && !isGm && !canHidden) continue;
          entries.push({
            id: `binding:${b.id}`,
            kind: 'lore_binding',
            title: b.label || b.assetId || 'Lore',
            summary: '',
            visibility: b.reveal === 'party' ? 'shared' : b.reveal,
            occurredAt: null,
            meta: { assetId: b.assetId, reveal: b.reveal },
          });
        }
      }
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

        this.#sessionPromote.recordOutcomePromotion({
          projectId: session.projectId,
          sessionId: sid,
          sourceId: cid,
          targetKind: 'saga_fact',
          targetRef: factId,
          createdBy: actorId,
        });
        this.#sessionPromote.appendPromoteAuditEvent(sid, actorId, {
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

    try {
      this.#withImmediateTx(() => {
        const wrote = this.#world.appendPromotedLoreFact(project.worldId, {
          id: factId,
          summary: summary.slice(0, 200),
          visibility,
          sourceSessionId: sid,
          sourceConsequenceId: cid,
        });
        if (!wrote.ok) throw new Error(wrote.error);
        this.#sessionPromote.recordOutcomePromotion({
          projectId: session.projectId,
          sessionId: sid,
          sourceId: cid,
          targetKind: 'world_fact',
          targetRef: factId,
          createdBy: actorId,
        });
        this.#sessionPromote.appendPromoteAuditEvent(sid, actorId, {
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

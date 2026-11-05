/**
 * Character-owned adventure arcs + developments (CUT-09 / #1144).
 * Private — import only from character public API.
 * Location: server/src/modules/character/internal/character-adventure-arc-store.ts
 *
 * Membership/session enrichment is supplied by callers (projection ports) —
 * this store never queries project_members or play_sessions.
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { CharacterSheetResult } from './character-sheet-store.ts';

export type AdventureDevelopmentKind = 'level' | 'species-trait' | 'skill' | 'note';
export type AdventureArcStatus = 'active' | 'completed' | 'left';

export type AdventureDevelopmentRecord = {
  readonly id: string;
  readonly at: string;
  readonly kind: AdventureDevelopmentKind;
  readonly title: string;
  readonly detail?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
};

export type AdventureArcRecord = {
  readonly id: string;
  readonly characterId: string;
  readonly projectId: string;
  readonly status: AdventureArcStatus;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly summary: string;
  readonly developments: readonly AdventureDevelopmentRecord[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AdventureMembershipProjection = {
  readonly projectId: string;
  readonly joinedAt: string | null;
  readonly status: 'active' | 'inactive';
};

export type AdventureArcEnrichment = {
  readonly projectName: string;
  readonly projectStatus: string | null;
  readonly sessionCount: number;
};

export type AdventureArcView = AdventureArcRecord & AdventureArcEnrichment;

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKind(value: unknown): value is AdventureDevelopmentKind {
  return value === 'level' || value === 'species-trait' || value === 'skill' || value === 'note';
}

function isStatus(value: unknown): value is AdventureArcStatus {
  return value === 'active' || value === 'completed' || value === 'left';
}

function parseDevelopments(raw: string | null | undefined): AdventureDevelopmentRecord[] {
  try {
    const parsed: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    const out: AdventureDevelopmentRecord[] = [];
    for (const item of parsed) {
      if (!isRecord(item)) continue;
      if (typeof item.id !== 'string' || typeof item.at !== 'string' || typeof item.title !== 'string') {
        continue;
      }
      if (!isKind(item.kind)) continue;
      const title = item.title.trim();
      if (!title) continue;
      const entry: AdventureDevelopmentRecord = {
        id: item.id,
        at: item.at,
        kind: item.kind,
        title,
      };
      if (typeof item.detail === 'string' && item.detail.trim()) {
        (entry as { detail?: string }).detail = item.detail.trim();
      }
      if (isRecord(item.meta)) {
        (entry as { meta?: Readonly<Record<string, unknown>> }).meta = item.meta;
      }
      out.push(entry);
    }
    return out;
  } catch {
    return [];
  }
}

type ArcRow = {
  id: string;
  character_id: string;
  project_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  developments_json: string;
  created_at: string;
  updated_at: string;
};

function mapRow(row: ArcRow): AdventureArcRecord {
  return {
    id: row.id,
    characterId: row.character_id,
    projectId: row.project_id,
    status: isStatus(row.status) ? row.status : 'active',
    startedAt: row.started_at,
    endedAt: row.ended_at,
    summary: typeof row.summary === 'string' ? row.summary : '',
    developments: parseDevelopments(row.developments_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CharacterAdventureArcStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  #listForCharacter(characterId: string): AdventureArcRecord[] {
    const rows = this.#db
      .prepare(
        `SELECT id, character_id, project_id, status, started_at, ended_at, summary,
                developments_json, created_at, updated_at
         FROM character_adventure_arcs
         WHERE character_id = ?
         ORDER BY started_at DESC`,
      )
      .all(characterId) as ArcRow[];
    return rows.map(mapRow);
  }

  #getById(arcId: string): AdventureArcRecord | null {
    const row = this.#db
      .prepare(
        `SELECT id, character_id, project_id, status, started_at, ended_at, summary,
                developments_json, created_at, updated_at
         FROM character_adventure_arcs
         WHERE id = ?`,
      )
      .get(arcId) as ArcRow | undefined;
    return row ? mapRow(row) : null;
  }

  /**
   * Ensure arcs exist for active memberships; leave historical arcs untouched.
   * Does not mark left automatically (FE list historically only created missing).
   */
  syncAndList(
    actorId: string,
    characterId: string,
    memberships: readonly AdventureMembershipProjection[],
  ): CharacterSheetResult<readonly AdventureArcRecord[]> {
    const trimmed = characterId.trim();
    if (!trimmed) return { ok: false, error: 'invalid-character-id' };

    const owned = this.#db
      .prepare(
        `SELECT id FROM characters
         WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
         LIMIT 1`,
      )
      .get(trimmed, actorId) as { id: string } | undefined;
    if (!owned) return { ok: false, error: 'not-found' };

    const existing = this.#listForCharacter(trimmed);
    const byProject = new Map(existing.map((arc) => [arc.projectId, arc]));

    for (const membership of memberships) {
      if (membership.status !== 'active') continue;
      if (byProject.has(membership.projectId)) continue;
      const id = randomUUID();
      const createdAt = nowIso();
      const startedAt = membership.joinedAt?.trim() || createdAt;
      try {
        this.#db
          .prepare(
            `INSERT INTO character_adventure_arcs
               (id, character_id, project_id, status, started_at, ended_at, summary,
                developments_json, created_at, updated_at)
             VALUES (?, ?, ?, 'active', ?, NULL, NULL, '[]', ?, ?)`,
          )
          .run(id, trimmed, membership.projectId, startedAt, createdAt, createdAt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/UNIQUE|unique/i.test(message)) continue;
        return { ok: false, error: `Abenteuer-Bogen konnte nicht angelegt werden: ${message}` };
      }
    }

    return { ok: true, value: this.#listForCharacter(trimmed) };
  }

  appendDevelopment(
    actorId: string,
    arcId: string,
    input: {
      readonly kind: AdventureDevelopmentKind;
      readonly title: string;
      readonly detail?: string;
      readonly meta?: Readonly<Record<string, unknown>>;
    },
  ): CharacterSheetResult<AdventureArcRecord> {
    const title = input.title.trim();
    if (!title) return { ok: false, error: 'Titel der Entwicklung ist erforderlich.' };
    if (!isKind(input.kind)) return { ok: false, error: 'Ungültige Entwicklungsart.' };

    const current = this.#getById(arcId);
    if (!current) return { ok: false, error: 'not-found' };

    const owned = this.#db
      .prepare(
        `SELECT id FROM characters
         WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
         LIMIT 1`,
      )
      .get(current.characterId, actorId) as { id: string } | undefined;
    if (!owned) return { ok: false, error: 'not-authorized' };

    const nextEntry: AdventureDevelopmentRecord = {
      id: randomUUID(),
      at: nowIso(),
      kind: input.kind,
      title,
    };
    const detail = input.detail?.trim();
    if (detail) (nextEntry as { detail?: string }).detail = detail;
    if (input.meta && Object.keys(input.meta).length > 0) {
      (nextEntry as { meta?: Readonly<Record<string, unknown>> }).meta = input.meta;
    }

    const nextDevelopments = [...current.developments, nextEntry];
    const updatedAt = nowIso();
    const changed = this.#db
      .prepare(
        `UPDATE character_adventure_arcs
         SET developments_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(JSON.stringify(nextDevelopments), updatedAt, arcId);
    if (changed.changes !== 1) return { ok: false, error: 'not-found' };

    const refreshed = this.#getById(arcId);
    if (!refreshed) return { ok: false, error: 'not-found' };
    return { ok: true, value: refreshed };
  }

  getOwnedArc(
    actorId: string,
    arcId: string,
  ): CharacterSheetResult<AdventureArcRecord> {
    const current = this.#getById(arcId);
    if (!current) return { ok: false, error: 'not-found' };
    const owned = this.#db
      .prepare(
        `SELECT id FROM characters
         WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
         LIMIT 1`,
      )
      .get(current.characterId, actorId) as { id: string } | undefined;
    if (!owned) return { ok: false, error: 'not-authorized' };
    return { ok: true, value: current };
  }
}

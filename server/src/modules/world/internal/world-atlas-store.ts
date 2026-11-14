/**
 * world_atlas_maps persistence (RPC-ATLAS-MAPS / #862).
 * Private — import only from world public API.
 * Location: server/src/modules/world/internal/world-atlas-store.ts
 */
import { randomUUID } from 'node:crypto';
import {
  filterPartyLayers,
  redactPartyGeneratorMeta,
} from './party-map-projection.ts';
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type PartyRevealedAtlasMapIds = (
  worldProfileId: string,
  projectId: string,
) => readonly string[];

export type WorldAtlasMapKind =
  | 'world'
  | 'region'
  | 'settlement'
  | 'scene'
  | 'legacy_tiles';

export type WorldAtlasMapSummary = {
  readonly id: string;
  readonly worldProfileId: string;
  readonly parentMapId: string | null;
  readonly kind: WorldAtlasMapKind;
  readonly title: string;
  readonly sortOrder: number;
  readonly revision: number;
  readonly updatedAt: string | null;
  readonly hasAzgaarMap: boolean;
  readonly hasBasemap: boolean;
};

export type WorldAtlasMapVm = WorldAtlasMapSummary & {
  readonly bounds: Record<string, unknown>;
  readonly layers: Record<string, unknown>;
  readonly basemapStoragePath: string | null;
  readonly azgaarMapStoragePath: string | null;
  readonly generatorMeta: Record<string, unknown>;
};

export type UpsertWorldAtlasMapInput = {
  readonly worldProfileId: string;
  readonly mapId: string | null;
  readonly parentMapId: string | null;
  readonly kind: string | null;
  readonly title: string | null;
  readonly sortOrder: number | null;
  readonly bounds: Record<string, unknown> | null;
  readonly layers: Record<string, unknown> | null;
  readonly basemapStoragePath: string | null;
  readonly azgaarMapStoragePath: string | null;
  readonly generatorMeta: Record<string, unknown> | null;
  readonly expectedRevision: number | null;
};

const ALLOWED_KINDS: readonly WorldAtlasMapKind[] = [
  'world',
  'region',
  'settlement',
  'scene',
  'legacy_tiles',
];

const EMPTY_LAYERS: Record<string, unknown> = { type: 'FeatureCollection', features: [] };
const DEFAULT_BOUNDS: Record<string, unknown> = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };

type MapRow = {
  id: string;
  world_profile_id: string;
  parent_map_id: string | null;
  kind: string;
  title: string;
  sort_order: number;
  bounds: string;
  layers: string;
  basemap_storage_path: string | null;
  azgaar_map_storage_path: string | null;
  generator_meta: string;
  revision: number;
  updated_at: string | null;
};

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

function isAllowedKind(kind: string): kind is WorldAtlasMapKind {
  return (ALLOWED_KINDS as readonly string[]).includes(kind);
}

export class WorldAtlasStore {
  readonly #db: HostDatabase;
  readonly #canAccessWorld: (actorIds: readonly string[], worldId: string) => boolean;
  readonly #resolveSagaProject: (worldId: string, sagaPublicId: string) => string | null;
  readonly #isActiveProjectMember: (projectId: string, actorIds: readonly string[]) => boolean;
  readonly #partyRevealedMapIds: PartyRevealedAtlasMapIds;

  constructor(
    db: HostDatabase,
    deps: {
      readonly canAccessWorld: (actorIds: readonly string[], worldId: string) => boolean;
      readonly resolveSagaProject: (worldId: string, sagaPublicId: string) => string | null;
      readonly isActiveProjectMember: (projectId: string, actorIds: readonly string[]) => boolean;
      readonly partyRevealedMapIds: PartyRevealedAtlasMapIds;
    },
  ) {
    this.#db = db;
    this.#canAccessWorld = deps.canAccessWorld;
    this.#resolveSagaProject = deps.resolveSagaProject;
    this.#isActiveProjectMember = deps.isActiveProjectMember;
    this.#partyRevealedMapIds = deps.partyRevealedMapIds;
  }

  isWorldOwner(actorIds: readonly string[], worldId: string): boolean {
    const ids = actorIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (ids.length === 0) return false;
    const placeholders = ids.map(() => '?').join(',');
    const row = this.#db
      .prepare(
        `SELECT 1 AS ok FROM worlds WHERE id = ? AND owner_user_id IN (${placeholders})`,
      )
      .get(worldId, ...ids) as { ok: number } | undefined;
    return Boolean(row);
  }

  canReadWorld(actorIds: readonly string[], worldId: string): boolean {
    if (this.isWorldOwner(actorIds, worldId)) return true;
    return this.#canAccessWorld(actorIds, worldId);
  }

  canEditWorld(actorIds: readonly string[], worldId: string): boolean {
    return this.isWorldOwner(actorIds, worldId);
  }

  worldExists(worldId: string): boolean {
    const row = this.#db.prepare(`SELECT 1 AS ok FROM worlds WHERE id = ?`).get(worldId) as
      | { ok: number }
      | undefined;
    return Boolean(row);
  }

  #loadRow(mapId: string): MapRow | null {
    return (
      (this.#db
        .prepare(
          `SELECT id, world_profile_id, parent_map_id, kind, title, sort_order,
                  bounds, layers, basemap_storage_path, azgaar_map_storage_path,
                  generator_meta, revision, updated_at
           FROM world_atlas_maps WHERE id = ?`,
        )
        .get(mapId) as MapRow | undefined) ?? null
    );
  }

  #toSummary(
    row: MapRow,
    partyOnly: boolean,
    allowed: ReadonlySet<string> | readonly string[],
  ): WorldAtlasMapSummary {
    const allowedSet = allowed instanceof Set ? allowed : new Set(allowed);
    let parentMapId = row.parent_map_id;
    if (partyOnly && parentMapId !== null && !allowedSet.has(parentMapId)) {
      parentMapId = null;
    }
    return {
      id: row.id,
      worldProfileId: row.world_profile_id,
      parentMapId,
      kind: isAllowedKind(row.kind) ? row.kind : 'world',
      title: row.title,
      sortOrder: row.sort_order,
      revision: row.revision,
      updatedAt: row.updated_at,
      hasAzgaarMap: partyOnly ? false : row.azgaar_map_storage_path !== null,
      hasBasemap: row.basemap_storage_path !== null,
    };
  }

  #toVm(row: MapRow, partyOnly: boolean, allowed: readonly string[]): WorldAtlasMapVm {
    const summary = this.#toSummary(row, partyOnly, allowed);
    let layers = parseJsonObject(row.layers);
    if (!layers.type) layers = { ...EMPTY_LAYERS };
    let meta = parseJsonObject(row.generator_meta);
    let parentMapId = summary.parentMapId;
    if (partyOnly) {
      layers = filterPartyLayers(layers);
      meta = redactPartyGeneratorMeta(meta);
    }
    return {
      ...summary,
      parentMapId,
      bounds: parseJsonObject(row.bounds),
      layers,
      basemapStoragePath: row.basemap_storage_path,
      azgaarMapStoragePath: partyOnly ? null : row.azgaar_map_storage_path,
      generatorMeta: meta,
    };
  }

  #resolveProjectForSaga(
    worldId: string,
    sagaPublicId: string | null | undefined,
    actorIds: readonly string[],
  ): { ok: true; projectId: string | null } | { ok: false; error: string } {
    const saga = typeof sagaPublicId === 'string' ? sagaPublicId.trim() : '';
    if (!saga) return { ok: true, projectId: null };
    const projectId = this.#resolveSagaProject(worldId, saga);
    if (!projectId) return { ok: false, error: '42501' };
    if (!this.#isActiveProjectMember(projectId, actorIds)) {
      return { ok: false, error: '42501' };
    }
    return { ok: true, projectId };
  }

  listMaps(
    actorIds: readonly string[],
    worldProfileId: string,
    playerView: boolean,
    sagaPublicId: string | null | undefined,
  ): { ok: true; value: readonly WorldAtlasMapSummary[] } | { ok: false; error: string } {
    const worldId = worldProfileId.trim();
    if (!worldId) return { ok: false, error: '22023' };
    if (!this.worldExists(worldId) || !this.canReadWorld(actorIds, worldId)) {
      return { ok: false, error: '42501' };
    }

    const canEdit = this.canEditWorld(actorIds, worldId);
    const partyOnly = !canEdit || playerView === true;

    // Saga membership is only required for party projection. Editors/owners keep
    // the full catalog even when a foreign saga public id is supplied (Postgres list parity).
    if (partyOnly) {
      const sagaResolved = this.#resolveProjectForSaga(worldId, sagaPublicId, actorIds);
      if (!sagaResolved.ok) return sagaResolved;
      const projectId = sagaResolved.projectId;
      if (!projectId) return { ok: true, value: [] };
      const allowed = this.#partyRevealedMapIds(worldId, projectId);
      if (allowed.length === 0) return { ok: true, value: [] };
      const allowedSet = new Set(allowed);
      const placeholders = allowed.map(() => '?').join(',');
      const rows = this.#db
        .prepare(
          `SELECT id, world_profile_id, parent_map_id, kind, title, sort_order,
                  bounds, layers, basemap_storage_path, azgaar_map_storage_path,
                  generator_meta, revision, updated_at
           FROM world_atlas_maps
           WHERE world_profile_id = ? AND id IN (${placeholders})
           ORDER BY sort_order, title`,
        )
        .all(worldId, ...allowed) as MapRow[];
      return { ok: true, value: rows.map((r) => this.#toSummary(r, true, allowedSet)) };
    }

    const rows = this.#db
      .prepare(
        `SELECT id, world_profile_id, parent_map_id, kind, title, sort_order,
                bounds, layers, basemap_storage_path, azgaar_map_storage_path,
                generator_meta, revision, updated_at
         FROM world_atlas_maps
         WHERE world_profile_id = ?
         ORDER BY sort_order, title`,
      )
      .all(worldId) as MapRow[];
    return { ok: true, value: rows.map((r) => this.#toSummary(r, false, [])) };
  }

  ensureRoot(
    actorIds: readonly string[],
    worldProfileId: string,
  ): { ok: true; value: readonly WorldAtlasMapSummary[] } | { ok: false; error: string } {
    const worldId = worldProfileId.trim();
    if (!worldId) return { ok: false, error: '22023' };
    if (!this.worldExists(worldId) || !this.canEditWorld(actorIds, worldId)) {
      return { ok: false, error: '42501' };
    }

    const existing = this.#db
      .prepare(
        `SELECT id FROM world_atlas_maps
         WHERE world_profile_id = ? AND parent_map_id IS NULL
         ORDER BY CASE WHEN kind = 'legacy_tiles' THEN 0 ELSE 1 END, sort_order
         LIMIT 1`,
      )
      .get(worldId) as { id: string } | undefined;

    if (!existing) {
      const legacy = this.#db
        .prepare(`SELECT 1 AS ok FROM world_maps WHERE world_id = ?`)
        .get(worldId) as { ok: number } | undefined;
      const hasLegacy = Boolean(legacy);
      const now = new Date().toISOString();
      const id = randomUUID();
      const kind = hasLegacy ? 'legacy_tiles' : 'world';
      const title = hasLegacy ? 'Kachelkarte (Legacy)' : 'Weltkarte';
      const engine = hasLegacy ? 'legacy_tiles' : 'manual';
      this.#db
        .prepare(
          `INSERT INTO world_atlas_maps (
             id, world_profile_id, parent_map_id, kind, title, sort_order,
             bounds, layers, generator_meta, revision, created_at, updated_at
           ) VALUES (?, ?, NULL, ?, ?, 0, ?, ?, ?, 1, ?, ?)`,
        )
        .run(
          id,
          worldId,
          kind,
          title,
          JSON.stringify(DEFAULT_BOUNDS),
          JSON.stringify(EMPTY_LAYERS),
          JSON.stringify({ engine }),
          now,
          now,
        );
    }

    return this.listMaps(actorIds, worldId, false, null);
  }

  getMap(
    actorIds: readonly string[],
    mapId: string,
    playerView: boolean,
    sagaPublicId: string | null | undefined,
  ): { ok: true; value: WorldAtlasMapVm } | { ok: false; error: string } {
    const id = mapId.trim();
    if (!id) return { ok: false, error: '22023' };
    const row = this.#loadRow(id);
    if (!row) return { ok: false, error: 'P0002' };
    if (!this.canReadWorld(actorIds, row.world_profile_id)) {
      return { ok: false, error: '42501' };
    }

    const canEdit = this.canEditWorld(actorIds, row.world_profile_id);
    const partyOnly = !canEdit || playerView === true;
    let allowed: readonly string[] = [];
    let projectId: string | null = null;

    if (partyOnly) {
      const saga = typeof sagaPublicId === 'string' ? sagaPublicId.trim() : '';
      if (saga) {
        const resolved = this.#resolveProjectForSaga(row.world_profile_id, saga, actorIds);
        if (!resolved.ok) return resolved;
        projectId = resolved.projectId;
        if (!projectId) return { ok: false, error: '42501' };
      } else {
        return { ok: false, error: 'P0002' };
      }
      allowed = this.#partyRevealedMapIds(row.world_profile_id, projectId);
      if (!new Set(allowed).has(id)) return { ok: false, error: 'P0002' };
    }

    return { ok: true, value: this.#toVm(row, partyOnly, allowed) };
  }

  upsertMap(
    actorIds: readonly string[],
    input: UpsertWorldAtlasMapInput,
  ): { ok: true; value: WorldAtlasMapVm } | { ok: false; error: string } {
    const worldId = input.worldProfileId.trim();
    if (!worldId) return { ok: false, error: '22023' };
    if (!this.worldExists(worldId) || !this.canEditWorld(actorIds, worldId)) {
      return { ok: false, error: '42501' };
    }

    const kindRaw = typeof input.kind === 'string' ? input.kind.trim() : '';
    const kind = kindRaw.length > 0 ? kindRaw : 'world';
    if (!isAllowedKind(kind)) return { ok: false, error: '22023' };

    const titleRaw = typeof input.title === 'string' ? input.title.trim() : '';
    const title = titleRaw.length > 0 ? titleRaw : 'Weltkarte';

    let layers: Record<string, unknown>;
    if (input.layers === null || input.layers === undefined) {
      layers = EMPTY_LAYERS;
    } else if (typeof input.layers === 'object' && !Array.isArray(input.layers)) {
      layers = input.layers;
    } else {
      return { ok: false, error: '22023' };
    }
    const layerJson = JSON.stringify(layers);
    if (Buffer.byteLength(layerJson, 'utf8') > 1_500_000) {
      return { ok: false, error: '22023' };
    }
    if (layers.type !== 'FeatureCollection') return { ok: false, error: '22023' };

    const bounds =
      input.bounds && typeof input.bounds === 'object' && !Array.isArray(input.bounds)
        ? input.bounds
        : DEFAULT_BOUNDS;
    const meta =
      input.generatorMeta && typeof input.generatorMeta === 'object' && !Array.isArray(input.generatorMeta)
        ? input.generatorMeta
        : {};

    let parentMapId =
      typeof input.parentMapId === 'string' && input.parentMapId.trim().length > 0
        ? input.parentMapId.trim()
        : null;
    if (parentMapId) {
      const parent = this.#loadRow(parentMapId);
      if (!parent || parent.world_profile_id !== worldId) {
        return { ok: false, error: '22023' };
      }
    }

    const now = new Date().toISOString();
    const mapId =
      typeof input.mapId === 'string' && input.mapId.trim().length > 0 ? input.mapId.trim() : null;

    try {
      this.#db.exec('BEGIN IMMEDIATE');
      if (!mapId) {
        const newId = randomUUID();
        this.#db
          .prepare(
            `INSERT INTO world_atlas_maps (
               id, world_profile_id, parent_map_id, kind, title, sort_order,
               bounds, layers, basemap_storage_path, azgaar_map_storage_path,
               generator_meta, revision, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          )
          .run(
            newId,
            worldId,
            parentMapId,
            kind,
            title,
            input.sortOrder ?? 0,
            JSON.stringify(bounds),
            layerJson,
            input.basemapStoragePath,
            input.azgaarMapStoragePath,
            JSON.stringify(meta),
            now,
            now,
          );
        this.#db.exec('COMMIT');
        const created = this.#loadRow(newId);
        if (!created) return { ok: false, error: 'P0002' };
        return { ok: true, value: this.#toVm(created, false, []) };
      }

      const existing = this.#loadRow(mapId);
      if (!existing || existing.world_profile_id !== worldId) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '40001' };
      }
      // ATL2-B03: updates require explicit CAS revision — null must not overwrite.
      const expected = input.expectedRevision;
      if (typeof expected !== 'number' || !Number.isFinite(expected) || expected < 0) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '22023' };
      }
      if (existing.revision !== expected) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '40001' };
      }

      // ATL2-E01: primary-linked maps keep their hierarchy parent_map_id (no silent reparent).
      const primaryLink = this.#db
        .prepare(
          `SELECT place_id AS placeId FROM world_place_map_links
           WHERE map_id = ? AND usage = 'primary' LIMIT 1`,
        )
        .get(mapId) as { placeId: string } | undefined;
      if (primaryLink) {
        parentMapId = existing.parent_map_id;
      } else if (parentMapId === mapId) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '23514' };
      } else if (parentMapId && this.#mapWouldCycle(mapId, parentMapId)) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '23514' };
      }

      const nextSort =
        input.sortOrder === null || input.sortOrder === undefined
          ? existing.sort_order
          : input.sortOrder;
      const basemap =
        input.basemapStoragePath === null || input.basemapStoragePath === undefined
          ? existing.basemap_storage_path
          : input.basemapStoragePath;
      const azgaar =
        input.azgaarMapStoragePath === null || input.azgaarMapStoragePath === undefined
          ? existing.azgaar_map_storage_path
          : input.azgaarMapStoragePath;

      const update = this.#db
        .prepare(
          `UPDATE world_atlas_maps SET
             parent_map_id = ?,
             kind = ?,
             title = ?,
             sort_order = ?,
             bounds = ?,
             layers = ?,
             basemap_storage_path = ?,
             azgaar_map_storage_path = ?,
             generator_meta = ?,
             revision = revision + 1,
             updated_at = ?
           WHERE id = ? AND world_profile_id = ? AND revision = ?`,
        )
        .run(
          parentMapId,
          kind,
          title,
          nextSort,
          JSON.stringify(bounds),
          layerJson,
          basemap,
          azgaar,
          JSON.stringify(meta),
          now,
          mapId,
          worldId,
          expected,
        );
      if (update.changes !== 1) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '40001' };
      }
      this.#db.exec('COMMIT');
      const updated = this.#loadRow(mapId);
      if (!updated) return { ok: false, error: 'P0002' };
      return { ok: true, value: this.#toVm(updated, false, []) };
    } catch {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: 'P0001' };
    }
  }

  /**
   * Delete a non-primary atlas map (ATL2-E01).
   * Refuses world-root maps, primary-linked maps, and maps that still have children.
   */
  deleteMap(
    actorIds: readonly string[],
    worldProfileId: string,
    mapIdRaw: string,
  ): { ok: true; value: { readonly deletedMapId: string } } | { ok: false; error: string } {
    const worldId = worldProfileId.trim();
    const mapId = mapIdRaw.trim();
    if (!worldId || !mapId) return { ok: false, error: '22023' };
    if (!this.worldExists(worldId) || !this.canEditWorld(actorIds, worldId)) {
      return { ok: false, error: '42501' };
    }

    try {
      this.#db.exec('BEGIN IMMEDIATE');
      const row = this.#loadRow(mapId);
      if (!row || row.world_profile_id !== worldId) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: 'P0002' };
      }
      if (row.parent_map_id == null) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '23514' };
      }
      const primary = this.#db
        .prepare(
          `SELECT 1 AS ok FROM world_place_map_links
           WHERE map_id = ? AND usage = 'primary' LIMIT 1`,
        )
        .get(mapId) as { ok: number } | undefined;
      if (primary) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '23514' };
      }
      const child = this.#db
        .prepare(
          `SELECT 1 AS ok FROM world_atlas_maps WHERE parent_map_id = ? LIMIT 1`,
        )
        .get(mapId) as { ok: number } | undefined;
      if (child) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '23514' };
      }

      this.#db
        .prepare(`DELETE FROM world_place_map_links WHERE map_id = ?`)
        .run(mapId);
      const del = this.#db.prepare(`DELETE FROM world_atlas_maps WHERE id = ?`).run(mapId);
      if (del.changes !== 1) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: 'P0001' };
      }
      this.#db.exec('COMMIT');
      return { ok: true, value: { deletedMapId: mapId } };
    } catch {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: 'P0001' };
    }
  }

  /** True if setting mapId.parent = candidateParent would create a cycle. */
  #mapWouldCycle(mapId: string, candidateParent: string): boolean {
    let cursor: string | null = candidateParent;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === mapId) return true;
      if (seen.has(cursor)) return true;
      seen.add(cursor);
      const row = this.#loadRow(cursor);
      if (!row) return false;
      cursor = row.parent_map_id;
    }
    return false;
  }
}

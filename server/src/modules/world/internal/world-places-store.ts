/**
 * world_places + world_place_map_links persistence (RPC-WORLD-PLACES / #863)
 * + create/rename world node (RPC-WORLD-CREATE / #864).
 * Private — import only from world public API.
 * Location: server/src/modules/world/internal/world-places-store.ts
 *
 * Successor fix: saga membership required before party projection
 * (RPC-SEC-CROSS-SAGA-REVEAL).
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import {
  isCanonicalKind,
  mapKindForNode,
  missingAncestorChain,
  placeholderStem,
  requiredParentKind,
  tipSatisfies,
} from './world-create-helpers.ts';

export type WorldPlaceKind =
  | 'continent'
  | 'realm'
  | 'region'
  | 'settlement'
  | 'district'
  | 'site'
  | 'building'
  | 'interior'
  | 'dungeon'
  | 'area'
  | 'country'
  | 'place'
  | 'room';

export type WorldPlaceStatus = 'placeholder' | 'draft' | 'canonical' | 'archived';

export type WorldPlaceMapUsage =
  | 'overview'
  | 'footprint'
  | 'entrance'
  | 'interior'
  | 'dungeon'
  | 'battlemap'
  | 'primary';

export type WorldPlaceVm = {
  readonly id: string;
  readonly worldProfileId: string;
  readonly parentPlaceId: string | null;
  readonly kind: WorldPlaceKind;
  readonly name: string;
  readonly description: string | null;
  readonly status: WorldPlaceStatus;
  readonly seedKey: string | null;
  readonly sortOrder: number;
  readonly revision: number;
  readonly bindingReveal?: string;
  readonly bindingAssetId?: string;
};

export type WorldPlaceMapLinkVm = {
  readonly id: string;
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
  readonly usage: WorldPlaceMapUsage;
  readonly featureId: string | null;
  readonly anchor: Record<string, unknown>;
};

export type UpsertWorldPlaceInput = {
  readonly worldProfileId: string;
  readonly placeId: string | null;
  readonly parentPlaceId: string | null;
  readonly kind: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: string | null;
  readonly seedKey: string | null;
  readonly sortOrder: number | null;
};

export type UpsertWorldPlaceMapLinkInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
  readonly usage: string;
  readonly featureId: string | null;
  readonly anchor: Record<string, unknown> | null;
};

export type CreateWorldNodeInput = {
  readonly worldProfileId: string;
  readonly kind: string;
  readonly name: string;
  readonly idempotencyKey: string;
  readonly subtype?: string | null;
  readonly parentPlaceId?: string | null;
  readonly description?: string | null;
};

export type CreateWorldNodeCreatedEntry = {
  readonly placeId: string;
  readonly kind: string;
  readonly name: string;
  readonly status: string;
  readonly mapId: string;
  readonly role: 'ancestor_placeholder' | 'target';
};

export type CreateWorldNodeResult = {
  readonly worldProfileId: string;
  readonly worldRootMapId: string;
  readonly targetPlaceId: string;
  readonly targetMapId: string;
  readonly created: readonly CreateWorldNodeCreatedEntry[];
  readonly idempotencyKey: string;
};

export type RenameWorldNodeInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly name: string;
};

export type ReparentWorldNodeInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly newParentPlaceId: string | null;
  readonly confirmRelocate: boolean;
};

export type ReparentWorldNodeResult = {
  readonly place: WorldPlaceVm;
  readonly primaryMapId: string | null;
  readonly parentMapId: string;
  readonly relocated: true;
};

export type DuplicateWorldNodeInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly deep: boolean;
};

export type DuplicateWorldNodeCreatedEntry = {
  readonly placeId: string;
  readonly mapId: string;
  readonly sourcePlaceId: string;
  readonly role: 'root' | 'deep_copy';
};

export type DuplicateWorldNodeResult = {
  readonly rootPlaceId: string;
  readonly rootMapId: string;
  readonly deep: boolean;
  readonly created: readonly DuplicateWorldNodeCreatedEntry[];
};

const DEFAULT_MAP_BOUNDS = '{"minX":0,"minY":0,"maxX":1000,"maxY":1000}';
const EMPTY_LAYERS = '{"type":"FeatureCollection","features":[]}';

const ALLOWED_KINDS: ReadonlySet<string> = new Set<WorldPlaceKind>([
  'continent',
  'realm',
  'region',
  'settlement',
  'district',
  'site',
  'building',
  'interior',
  'dungeon',
  'area',
  'country',
  'place',
  'room',
]);

const ALLOWED_STATUSES: ReadonlySet<string> = new Set<WorldPlaceStatus>([
  'placeholder',
  'draft',
  'canonical',
  'archived',
]);

const ALLOWED_USAGES: ReadonlySet<string> = new Set<WorldPlaceMapUsage>([
  'overview',
  'footprint',
  'entrance',
  'interior',
  'dungeon',
  'battlemap',
  'primary',
]);

type PlaceRow = {
  id: string;
  world_profile_id: string;
  parent_place_id: string | null;
  kind: string;
  name: string;
  description: string | null;
  status: string;
  seed_key: string | null;
  sort_order: number;
  revision: number;
};

type LinkRow = {
  id: string;
  world_profile_id: string;
  place_id: string;
  map_id: string;
  usage: string;
  feature_id: string | null;
  anchor: string;
};

type PartyPlaceRow = PlaceRow & {
  binding_reveal: string;
  binding_asset_id: string;
};

function isKind(v: string): v is WorldPlaceKind {
  return ALLOWED_KINDS.has(v);
}

function isStatus(v: string): v is WorldPlaceStatus {
  return ALLOWED_STATUSES.has(v);
}

function isUsage(v: string): v is WorldPlaceMapUsage {
  return ALLOWED_USAGES.has(v);
}

function mapConstraintError(err: unknown): '23505' | '23514' | 'P0001' {
  const msg = err instanceof Error ? err.message : String(err);
  // CHECK/FOREIGN messages also contain the word "constraint" — test them first.
  if (/CHECK|FOREIGN/i.test(msg)) return '23514';
  if (/UNIQUE/i.test(msg)) return '23505';
  if (/constraint/i.test(msg)) return '23505';
  return 'P0001';
}

function parseAnchor(raw: string | null | undefined): Record<string, unknown> {
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

function toPlaceVm(
  row: PlaceRow,
  binding?: { reveal: string; assetId: string },
): WorldPlaceVm {
  const base: WorldPlaceVm = {
    id: row.id,
    worldProfileId: row.world_profile_id,
    parentPlaceId: row.parent_place_id,
    kind: isKind(row.kind) ? row.kind : 'site',
    name: row.name,
    description: row.description,
    status: isStatus(row.status) ? row.status : 'draft',
    seedKey: row.seed_key,
    sortOrder: row.sort_order,
    revision: row.revision,
  };
  if (binding) {
    return { ...base, bindingReveal: binding.reveal, bindingAssetId: binding.assetId };
  }
  return base;
}

function toLinkVm(row: LinkRow): WorldPlaceMapLinkVm {
  return {
    id: row.id,
    worldProfileId: row.world_profile_id,
    placeId: row.place_id,
    mapId: row.map_id,
    usage: isUsage(row.usage) ? row.usage : 'overview',
    featureId: row.feature_id,
    anchor: parseAnchor(row.anchor),
  };
}

export class WorldPlacesStore {
  readonly #db: HostDatabase;
  readonly #canAccessWorld: (actorIds: readonly string[], worldId: string) => boolean;
  readonly #resolveSagaProject: (worldId: string, sagaPublicId: string) => string | null;
  readonly #isActiveProjectMember: (projectId: string, actorIds: readonly string[]) => boolean;

  constructor(
    db: HostDatabase,
    deps: {
      readonly canAccessWorld: (actorIds: readonly string[], worldId: string) => boolean;
      readonly resolveSagaProject: (worldId: string, sagaPublicId: string) => string | null;
      readonly isActiveProjectMember: (projectId: string, actorIds: readonly string[]) => boolean;
    },
  ) {
    this.#db = db;
    this.#canAccessWorld = deps.canAccessWorld;
    this.#resolveSagaProject = deps.resolveSagaProject;
    this.#isActiveProjectMember = deps.isActiveProjectMember;
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

  #loadPlace(placeId: string): PlaceRow | null {
    return (
      (this.#db
        .prepare(
          `SELECT id, world_profile_id, parent_place_id, kind, name, description,
                  status, seed_key, sort_order, revision
           FROM world_places WHERE id = ?`,
        )
        .get(placeId) as PlaceRow | undefined) ?? null
    );
  }

  #loadLink(linkId: string): LinkRow | null {
    return (
      (this.#db
        .prepare(
          `SELECT id, world_profile_id, place_id, map_id, usage, feature_id, anchor
           FROM world_place_map_links WHERE id = ?`,
        )
        .get(linkId) as LinkRow | undefined) ?? null
    );
  }

  /**
   * Party path: empty saga → empty projection.
   * Resolved saga without membership → 42501 (RPC-SEC-CROSS-SAGA-REVEAL).
   */
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

  #wouldCreateCycle(placeId: string, parentPlaceId: string | null): boolean {
    if (!parentPlaceId) return false;
    if (parentPlaceId === placeId) return true;
    let current: string | null = parentPlaceId;
    const seen = new Set<string>();
    while (current) {
      if (current === placeId) return true;
      if (seen.has(current)) return true;
      seen.add(current);
      const row = this.#loadPlace(current);
      current = row?.parent_place_id ?? null;
    }
    return false;
  }

  /**
   * Parity with trg_world_places_same_world + parent_not_self; host also rejects cycles
   * (worldbuilder 104 cycle ERRCODE) before committing.
   */
  #enforceParentEdge(
    worldId: string,
    placeId: string | null,
    parentPlaceId: string | null,
  ): { ok: true } | { ok: false; error: string } {
    if (!parentPlaceId) return { ok: true };
    if (placeId && parentPlaceId === placeId) return { ok: false, error: '23514' };
    const parent = this.#loadPlace(parentPlaceId);
    if (!parent || parent.world_profile_id !== worldId) {
      return { ok: false, error: '23514' };
    }
    if (placeId && this.#wouldCreateCycle(placeId, parentPlaceId)) {
      return { ok: false, error: '23514' };
    }
    return { ok: true };
  }

  listPlaces(
    actorIds: readonly string[],
    worldProfileId: string,
    playerView: boolean,
    sagaPublicId: string | null | undefined,
  ): { ok: true; value: readonly WorldPlaceVm[] } | { ok: false; error: string } {
    const worldId = worldProfileId.trim();
    if (!worldId) return { ok: false, error: '22023' };
    if (!this.worldExists(worldId) || !this.canReadWorld(actorIds, worldId)) {
      return { ok: false, error: '42501' };
    }

    const canEdit = this.canEditWorld(actorIds, worldId);
    const partyOnly = !canEdit || playerView === true;

    if (partyOnly) {
      const sagaResolved = this.#resolveProjectForSaga(worldId, sagaPublicId, actorIds);
      if (!sagaResolved.ok) return sagaResolved;
      const projectId = sagaResolved.projectId;
      if (!projectId) return { ok: true, value: [] };

      const rows = this.#db
        .prepare(
          `SELECT p.id, p.world_profile_id, p.parent_place_id, p.kind, p.name, p.description,
                  p.status, p.seed_key, p.sort_order, p.revision,
                  b.reveal AS binding_reveal, b.asset_id AS binding_asset_id
           FROM world_places p
           INNER JOIN saga_asset_bindings b
             ON b.world_place_id = p.id
            AND b.project_id = ?
            AND b.asset_kind = 'location'
            AND b.reveal = 'party'
           WHERE p.world_profile_id = ?
             AND p.status <> 'archived'
           ORDER BY p.sort_order, p.name`,
        )
        .all(projectId, worldId) as PartyPlaceRow[];

      return {
        ok: true,
        value: rows.map((r) =>
          toPlaceVm(r, { reveal: r.binding_reveal, assetId: r.binding_asset_id }),
        ),
      };
    }

    const rows = this.#db
      .prepare(
        `SELECT id, world_profile_id, parent_place_id, kind, name, description,
                status, seed_key, sort_order, revision
         FROM world_places
         WHERE world_profile_id = ?
           AND status <> 'archived'
         ORDER BY sort_order, name`,
      )
      .all(worldId) as PlaceRow[];
    return { ok: true, value: rows.map((r) => toPlaceVm(r)) };
  }

  listMapLinks(
    actorIds: readonly string[],
    worldProfileId: string,
    playerView: boolean,
    sagaPublicId: string | null | undefined,
  ): { ok: true; value: readonly WorldPlaceMapLinkVm[] } | { ok: false; error: string } {
    const worldId = worldProfileId.trim();
    if (!worldId) return { ok: false, error: '22023' };
    if (!this.worldExists(worldId) || !this.canReadWorld(actorIds, worldId)) {
      return { ok: false, error: '42501' };
    }

    const canEdit = this.canEditWorld(actorIds, worldId);
    const partyOnly = !canEdit || playerView === true;

    if (partyOnly) {
      const sagaResolved = this.#resolveProjectForSaga(worldId, sagaPublicId, actorIds);
      if (!sagaResolved.ok) return sagaResolved;
      const projectId = sagaResolved.projectId;
      if (!projectId) return { ok: true, value: [] };

      // Align with listPlaces party path: never project links for archived places.
      const rows = this.#db
        .prepare(
          `SELECT l.id, l.world_profile_id, l.place_id, l.map_id, l.usage, l.feature_id, l.anchor
           FROM world_place_map_links l
           INNER JOIN world_places p
             ON p.id = l.place_id
            AND p.status <> 'archived'
           INNER JOIN saga_asset_bindings b
             ON b.world_place_id = l.place_id
            AND b.project_id = ?
            AND b.asset_kind = 'location'
            AND b.reveal = 'party'
           WHERE l.world_profile_id = ?
           ORDER BY l.usage, l.created_at`,
        )
        .all(projectId, worldId) as LinkRow[];
      return { ok: true, value: rows.map(toLinkVm) };
    }

    const rows = this.#db
      .prepare(
        `SELECT id, world_profile_id, place_id, map_id, usage, feature_id, anchor
         FROM world_place_map_links
         WHERE world_profile_id = ?
         ORDER BY usage, created_at`,
      )
      .all(worldId) as LinkRow[];
    return { ok: true, value: rows.map(toLinkVm) };
  }

  upsertPlace(
    actorIds: readonly string[],
    input: UpsertWorldPlaceInput,
  ): { ok: true; value: WorldPlaceVm } | { ok: false; error: string } {
    const worldId = input.worldProfileId.trim();
    if (!worldId) return { ok: false, error: '22023' };
    if (!this.worldExists(worldId) || !this.canEditWorld(actorIds, worldId)) {
      return { ok: false, error: '42501' };
    }

    const kindRaw = typeof input.kind === 'string' ? input.kind.trim() : '';
    const nameRaw = typeof input.name === 'string' ? input.name.trim() : '';
    if (!kindRaw || !nameRaw) return { ok: false, error: '22023' };
    if (!isKind(kindRaw)) return { ok: false, error: '22023' };

    const parentPlaceId =
      typeof input.parentPlaceId === 'string' && input.parentPlaceId.trim().length > 0
        ? input.parentPlaceId.trim()
        : null;

    const placeId =
      typeof input.placeId === 'string' && input.placeId.trim().length > 0
        ? input.placeId.trim()
        : null;

    const descriptionRaw =
      typeof input.description === 'string' ? input.description.trim() : '';
    const description = descriptionRaw.length > 0 ? descriptionRaw : null;

    const statusRaw =
      typeof input.status === 'string' && input.status.trim().length > 0
        ? input.status.trim()
        : null;
    if (statusRaw && !isStatus(statusRaw)) return { ok: false, error: '22023' };

    const seedRaw = typeof input.seedKey === 'string' ? input.seedKey.trim() : '';
    const seedKey = seedRaw.length > 0 ? seedRaw : null;

    const now = new Date().toISOString();

    try {
      // Cheap optimistic reject before taking the single-writer lock
      // (still inside try so SQLITE_BUSY etc. map to structured errors).
      const parentPre = this.#enforceParentEdge(worldId, placeId, parentPlaceId);
      if (!parentPre.ok) return parentPre;
      if (placeId) {
        const existingPre = this.#loadPlace(placeId);
        if (!existingPre || existingPre.world_profile_id !== worldId) {
          return { ok: false, error: 'P0002' };
        }
      }

      this.#db.exec('BEGIN IMMEDIATE');
      // Re-check under write lock (no TOCTOU).
      const parentOk = this.#enforceParentEdge(worldId, placeId, parentPlaceId);
      if (!parentOk.ok) {
        this.#db.exec('ROLLBACK');
        return parentOk;
      }
      if (!placeId) {
        const newId = randomUUID();
        const status = statusRaw ?? 'draft';
        this.#db
          .prepare(
            `INSERT INTO world_places (
               id, world_profile_id, parent_place_id, kind, name, description,
               status, seed_key, sort_order, revision, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          )
          .run(
            newId,
            worldId,
            parentPlaceId,
            kindRaw,
            nameRaw,
            description,
            status,
            seedKey,
            input.sortOrder ?? 0,
            now,
            now,
          );
        this.#db.exec('COMMIT');
        const created = this.#loadPlace(newId);
        if (!created) return { ok: false, error: 'P0002' };
        return { ok: true, value: toPlaceVm(created) };
      }

      const existing = this.#loadPlace(placeId);
      if (!existing || existing.world_profile_id !== worldId) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: 'P0002' };
      }

      const nextStatus = statusRaw ?? existing.status;
      const nextSeed = seedKey ?? existing.seed_key;
      const nextSort =
        input.sortOrder === null || input.sortOrder === undefined
          ? existing.sort_order
          : input.sortOrder;

      this.#db
        .prepare(
          `UPDATE world_places SET
             parent_place_id = ?,
             kind = ?,
             name = ?,
             description = ?,
             status = ?,
             seed_key = ?,
             sort_order = ?,
             revision = revision + 1,
             updated_at = ?
           WHERE id = ? AND world_profile_id = ?`,
        )
        .run(
          parentPlaceId,
          kindRaw,
          nameRaw,
          description,
          nextStatus,
          nextSeed,
          nextSort,
          now,
          placeId,
          worldId,
        );
      this.#db.exec('COMMIT');
      const updated = this.#loadPlace(placeId);
      if (!updated) return { ok: false, error: 'P0002' };
      return { ok: true, value: toPlaceVm(updated) };
    } catch (err) {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: mapConstraintError(err) };
    }
  }

  upsertMapLink(
    actorIds: readonly string[],
    input: UpsertWorldPlaceMapLinkInput,
  ): { ok: true; value: WorldPlaceMapLinkVm } | { ok: false; error: string } {
    const worldId = input.worldProfileId.trim();
    if (!worldId) return { ok: false, error: '22023' };
    if (!this.worldExists(worldId) || !this.canEditWorld(actorIds, worldId)) {
      return { ok: false, error: '42501' };
    }

    const placeId = typeof input.placeId === 'string' ? input.placeId.trim() : '';
    const mapId = typeof input.mapId === 'string' ? input.mapId.trim() : '';
    const usageRaw = typeof input.usage === 'string' ? input.usage.trim() : '';
    if (!placeId || !mapId || !usageRaw) return { ok: false, error: '22023' };
    if (!isUsage(usageRaw)) return { ok: false, error: '22023' };

    const featureRaw =
      typeof input.featureId === 'string' ? input.featureId.trim() : '';
    const featureId = featureRaw.length > 0 ? featureRaw : null;
    const anchor =
      input.anchor && typeof input.anchor === 'object' && !Array.isArray(input.anchor)
        ? input.anchor
        : {};

    const now = new Date().toISOString();

    try {
      // Optimistic same-world check before write lock (inside try for structured errors).
      const placePre = this.#loadPlace(placeId);
      if (!placePre || placePre.world_profile_id !== worldId) {
        return { ok: false, error: '22023' };
      }
      const mapPre = this.#db
        .prepare(`SELECT id, world_profile_id FROM world_atlas_maps WHERE id = ?`)
        .get(mapId) as { id: string; world_profile_id: string } | undefined;
      if (!mapPre || mapPre.world_profile_id !== worldId) {
        return { ok: false, error: '22023' };
      }

      this.#db.exec('BEGIN IMMEDIATE');

      const place = this.#loadPlace(placeId);
      if (!place || place.world_profile_id !== worldId) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '22023' };
      }
      const map = this.#db
        .prepare(`SELECT id, world_profile_id FROM world_atlas_maps WHERE id = ?`)
        .get(mapId) as { id: string; world_profile_id: string } | undefined;
      if (!map || map.world_profile_id !== worldId) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '22023' };
      }

      const existing = this.#db
        .prepare(
          `SELECT id FROM world_place_map_links
           WHERE place_id = ? AND map_id = ? AND usage = ?`,
        )
        .get(placeId, mapId, usageRaw) as { id: string } | undefined;

      if (existing) {
        this.#db
          .prepare(
            `UPDATE world_place_map_links SET
               feature_id = ?,
               anchor = ?,
               updated_at = ?
             WHERE id = ?`,
          )
          .run(featureId, JSON.stringify(anchor), now, existing.id);
        this.#db.exec('COMMIT');
        const updated = this.#loadLink(existing.id);
        if (!updated) return { ok: false, error: 'P0002' };
        return { ok: true, value: toLinkVm(updated) };
      }

      if (usageRaw === 'primary') {
        const otherPrimary = this.#db
          .prepare(
            `SELECT id FROM world_place_map_links
             WHERE place_id = ? AND usage = 'primary'`,
          )
          .get(placeId) as { id: string } | undefined;
        if (otherPrimary) {
          this.#db.exec('ROLLBACK');
          return { ok: false, error: '23505' };
        }
      }

      const newId = randomUUID();
      this.#db
        .prepare(
          `INSERT INTO world_place_map_links (
             id, world_profile_id, place_id, map_id, usage, feature_id, anchor,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          newId,
          worldId,
          placeId,
          mapId,
          usageRaw,
          featureId,
          JSON.stringify(anchor),
          now,
          now,
        );
      this.#db.exec('COMMIT');
      const created = this.#loadLink(newId);
      if (!created) return { ok: false, error: 'P0002' };
      return { ok: true, value: toLinkVm(created) };
    } catch (err) {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: mapConstraintError(err) };
    }
  }

  #ensureWorldRootMap(worldId: string, now: string): string {
    const existing = this.#db
      .prepare(
        `SELECT id FROM world_atlas_maps
         WHERE world_profile_id = ?
           AND kind = 'world'
           AND parent_map_id IS NULL
         ORDER BY sort_order ASC, created_at ASC
         LIMIT 1`,
      )
      .get(worldId) as { id: string } | undefined;
    if (existing) return existing.id;

    const id = randomUUID();
    this.#db
      .prepare(
        `INSERT INTO world_atlas_maps (
           id, world_profile_id, parent_map_id, kind, title, sort_order,
           bounds, layers, generator_meta, revision, created_at, updated_at
         ) VALUES (?, ?, NULL, 'world', 'Weltkarte', 0, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        id,
        worldId,
        DEFAULT_MAP_BOUNDS,
        EMPTY_LAYERS,
        JSON.stringify({ engine: 'unified_canvas', mapStatus: 'unsketched' }),
        now,
        now,
      );
    return id;
  }

  #primaryMapId(placeId: string): string | null {
    const row = this.#db
      .prepare(
        `SELECT map_id AS id FROM world_place_map_links
         WHERE place_id = ? AND usage = 'primary'
         LIMIT 1`,
      )
      .get(placeId) as { id: string } | undefined;
    return row?.id ?? null;
  }

  #nextPlaceholderName(worldId: string, parentId: string | null, kind: string): string {
    const stem = placeholderStem(kind);
    const row = this.#db
      .prepare(
        parentId === null
          ? `SELECT COUNT(*) AS n FROM world_places
             WHERE world_profile_id = ? AND kind = ? AND status = 'placeholder'
               AND parent_place_id IS NULL`
          : `SELECT COUNT(*) AS n FROM world_places
             WHERE world_profile_id = ? AND kind = ? AND status = 'placeholder'
               AND parent_place_id = ?`,
      )
      .get(
        ...(parentId === null ? [worldId, kind] : [worldId, kind, parentId]),
      ) as { n: number };
    return `${stem} ${Number(row.n) + 1}`;
  }

  #createPrimaryMap(
    worldId: string,
    placeId: string,
    kind: string,
    title: string,
    parentMapId: string,
    now: string,
  ): string {
    const mapId = randomUUID();
    const mapKind = mapKindForNode(kind);
    this.#db
      .prepare(
        `INSERT INTO world_atlas_maps (
           id, world_profile_id, parent_map_id, kind, title, sort_order,
           bounds, layers, generator_meta, revision, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        mapId,
        worldId,
        parentMapId,
        mapKind,
        title,
        DEFAULT_MAP_BOUNDS,
        EMPTY_LAYERS,
        JSON.stringify({
          engine: 'unified_canvas',
          mapStatus: 'unlocated',
          placeId,
        }),
        now,
        now,
      );
    const linkId = randomUUID();
    this.#db
      .prepare(
        `INSERT INTO world_place_map_links (
           id, world_profile_id, place_id, map_id, usage, feature_id, anchor,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, 'primary', NULL, '{}', ?, ?)`,
      )
      .run(linkId, worldId, placeId, mapId, now, now);
    return mapId;
  }

  createWorldNodeWithMaps(
    actorIds: readonly string[],
    input: CreateWorldNodeInput,
  ): { ok: true; value: CreateWorldNodeResult } | { ok: false; error: string } {
    const worldId =
      typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
    const kind = typeof input.kind === 'string' ? input.kind.trim() : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const key =
      typeof input.idempotencyKey === 'string' ? input.idempotencyKey.trim() : '';
    if (!worldId || !kind || !name || !key) return { ok: false, error: '22023' };
    if (!isCanonicalKind(kind)) return { ok: false, error: '22023' };
    if (!this.worldExists(worldId) || !this.canEditWorld(actorIds, worldId)) {
      return { ok: false, error: '42501' };
    }

    const cached = this.#db
      .prepare(
        `SELECT result FROM world_node_create_idempotency
         WHERE world_profile_id = ? AND idempotency_key = ?`,
      )
      .get(worldId, key) as { result: string } | undefined;
    if (cached) {
      try {
        const parsed = JSON.parse(cached.result) as CreateWorldNodeResult;
        return { ok: true, value: parsed };
      } catch {
        return { ok: false, error: 'P0001' };
      }
    }

    let parentId =
      typeof input.parentPlaceId === 'string' && input.parentPlaceId.trim().length > 0
        ? input.parentPlaceId.trim()
        : null;
    let parentKind: string | null = null;
    if (parentId) {
      const parent = this.#loadPlace(parentId);
      if (!parent || parent.world_profile_id !== worldId) {
        return { ok: false, error: '23514' };
      }
      parentKind = parent.kind;
    }

    const chain = missingAncestorChain(kind, parentKind, parentId !== null);
    if (chain.length === 0) {
      const need = requiredParentKind(kind);
      if (!tipSatisfies(need, parentKind)) {
        return { ok: false, error: '23514' };
      }
    } else if (parentId !== null) {
      const needForTip = requiredParentKind(chain[0]!);
      if (!tipSatisfies(needForTip, parentKind)) {
        return { ok: false, error: '23514' };
      }
    }

    const subtypeRaw =
      typeof input.subtype === 'string' ? input.subtype.trim() : '';
    const subtype = subtypeRaw.length > 0 ? subtypeRaw : null;
    const descriptionValue =
      typeof input.description === 'string'
        ? input.description.trim().length > 0
          ? input.description.trim()
          : null
        : null;

    const now = new Date().toISOString();
    const created: CreateWorldNodeCreatedEntry[] = [];

    try {
      this.#db.exec('BEGIN IMMEDIATE');

      const cachedAgain = this.#db
        .prepare(
          `SELECT result FROM world_node_create_idempotency
           WHERE world_profile_id = ? AND idempotency_key = ?`,
        )
        .get(worldId, key) as { result: string } | undefined;
      if (cachedAgain) {
        this.#db.exec('COMMIT');
        return { ok: true, value: JSON.parse(cachedAgain.result) as CreateWorldNodeResult };
      }

      const rootMapId = this.#ensureWorldRootMap(worldId, now);
      let parentMapId: string | null = parentId ? this.#primaryMapId(parentId) : null;
      if (!parentMapId) parentMapId = rootMapId;

      for (const ancestorKind of chain) {
        const phName = this.#nextPlaceholderName(worldId, parentId, ancestorKind);
        const placeId = randomUUID();
        this.#db
          .prepare(
            `INSERT INTO world_places (
               id, world_profile_id, parent_place_id, kind, name, description,
               status, seed_key, sort_order, revision, subtype, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, NULL, 'placeholder', NULL, 0, 0, NULL, ?, ?)`,
          )
          .run(placeId, worldId, parentId, ancestorKind, phName, now, now);
        const mapId = this.#createPrimaryMap(
          worldId,
          placeId,
          ancestorKind,
          `${phName} (Karte)`,
          parentMapId,
          now,
        );
        created.push({
          placeId,
          kind: ancestorKind,
          name: phName,
          status: 'placeholder',
          mapId,
          role: 'ancestor_placeholder',
        });
        parentId = placeId;
        parentKind = ancestorKind;
        parentMapId = mapId;
      }

      const targetId = randomUUID();
      this.#db
        .prepare(
          `INSERT INTO world_places (
             id, world_profile_id, parent_place_id, kind, name, description,
             status, seed_key, sort_order, revision, subtype, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, 0, 0, ?, ?, ?)`,
        )
        .run(
          targetId,
          worldId,
          parentId,
          kind,
          name,
          descriptionValue,
          subtype,
          now,
          now,
        );
      const targetMapId = this.#createPrimaryMap(
        worldId,
        targetId,
        kind,
        `${name} (Karte)`,
        parentMapId,
        now,
      );
      created.push({
        placeId: targetId,
        kind,
        name,
        status: 'draft',
        mapId: targetMapId,
        role: 'target',
      });

      const result: CreateWorldNodeResult = {
        worldProfileId: worldId,
        worldRootMapId: rootMapId,
        targetPlaceId: targetId,
        targetMapId,
        created,
        idempotencyKey: key,
      };

      this.#db
        .prepare(
          `INSERT INTO world_node_create_idempotency
             (world_profile_id, idempotency_key, result, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(worldId, key, JSON.stringify(result), now);

      this.#db.exec('COMMIT');
      return { ok: true, value: result };
    } catch (err) {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: mapConstraintError(err) };
    }
  }

  renameWorldNode(
    actorIds: readonly string[],
    input: RenameWorldNodeInput,
  ): { ok: true; value: WorldPlaceVm } | { ok: false; error: string } {
    const worldId =
      typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
    const placeId = typeof input.placeId === 'string' ? input.placeId.trim() : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!worldId || !placeId) return { ok: false, error: '22023' };
    if (!name) return { ok: false, error: '22023' };
    if (!this.worldExists(worldId) || !this.canEditWorld(actorIds, worldId)) {
      return { ok: false, error: '42501' };
    }

    const existing = this.#loadPlace(placeId);
    if (!existing || existing.world_profile_id !== worldId) {
      return { ok: false, error: 'P0002' };
    }

    const now = new Date().toISOString();

    try {
      this.#db.exec('BEGIN IMMEDIATE');
      const row = this.#loadPlace(placeId);
      if (!row || row.world_profile_id !== worldId) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: 'P0002' };
      }
      const status = row.status === 'placeholder' ? 'draft' : row.status;
      this.#db
        .prepare(
          `UPDATE world_places SET
             name = ?,
             status = ?,
             revision = revision + 1,
             updated_at = ?
           WHERE id = ? AND world_profile_id = ?`,
        )
        .run(name, status, now, placeId, worldId);
      this.#db.exec('COMMIT');
      const updated = this.#loadPlace(placeId);
      if (!updated) return { ok: false, error: 'P0002' };
      return { ok: true, value: toPlaceVm(updated) };
    } catch (err) {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: mapConstraintError(err) };
    }
  }

  #descendantIds(worldId: string, rootPlaceId: string): string[] {
    // Single recursive CTE under the write lock (UNION dedupes cycles).
    const rows = this.#db
      .prepare(
        `WITH RECURSIVE tree(id) AS (
           SELECT id FROM world_places
           WHERE world_profile_id = ? AND parent_place_id = ?
           UNION
           SELECT p.id FROM world_places p
           INNER JOIN tree t ON p.parent_place_id = t.id
           WHERE p.world_profile_id = ?
         )
         SELECT id FROM tree`,
      )
      .all(worldId, rootPlaceId, worldId) as { id: string }[];
    return rows.map((r) => r.id);
  }

  #markMapUnlocated(mapId: string, parentMapId: string, now: string): void {
    const row = this.#db
      .prepare(`SELECT generator_meta FROM world_atlas_maps WHERE id = ?`)
      .get(mapId) as { generator_meta: string } | undefined;
    let meta: Record<string, unknown> = {};
    if (row?.generator_meta) {
      try {
        const parsed: unknown = JSON.parse(row.generator_meta);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          meta = { ...(parsed as Record<string, unknown>) };
        }
      } catch {
        meta = {};
      }
    }
    meta.mapStatus = 'unlocated';
    this.#db
      .prepare(
        `UPDATE world_atlas_maps SET
           parent_map_id = ?,
           generator_meta = ?,
           revision = revision + 1,
           updated_at = ?
         WHERE id = ?`,
      )
      .run(parentMapId, JSON.stringify(meta), now, mapId);
  }

  reparentWorldNode(
    actorIds: readonly string[],
    input: ReparentWorldNodeInput,
  ): { ok: true; value: ReparentWorldNodeResult } | { ok: false; error: string } {
    const worldId =
      typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
    const placeId = typeof input.placeId === 'string' ? input.placeId.trim() : '';
    if (!worldId || !placeId) return { ok: false, error: '22023' };
    if (!this.worldExists(worldId) || !this.canEditWorld(actorIds, worldId)) {
      return { ok: false, error: '42501' };
    }
    if (input.confirmRelocate !== true) return { ok: false, error: '22023' };

    const newParentId =
      typeof input.newParentPlaceId === 'string' && input.newParentPlaceId.trim().length > 0
        ? input.newParentPlaceId.trim()
        : null;
    if (newParentId === placeId) return { ok: false, error: '23514' };

    const now = new Date().toISOString();
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      // Revalidate hierarchy under the write lock (Codex P2 / concurrent upsertPlace).
      const row = this.#loadPlace(placeId);
      if (!row || row.world_profile_id !== worldId) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: 'P0002' };
      }
      if (!isCanonicalKind(row.kind)) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '22023' };
      }

      let parentKind: string | null = null;
      if (newParentId) {
        if (newParentId === placeId) {
          this.#db.exec('ROLLBACK');
          return { ok: false, error: '23514' };
        }
        const descendants = this.#descendantIds(worldId, placeId);
        if (descendants.includes(newParentId)) {
          this.#db.exec('ROLLBACK');
          return { ok: false, error: '23514' };
        }
        const parent = this.#loadPlace(newParentId);
        if (!parent || parent.world_profile_id !== worldId) {
          this.#db.exec('ROLLBACK');
          return { ok: false, error: '23514' };
        }
        parentKind = parent.kind;
      }

      const need = requiredParentKind(row.kind);
      if (!tipSatisfies(need, parentKind)) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: '23514' };
      }

      const rootMapId = this.#ensureWorldRootMap(worldId, now);
      let parentMapId = newParentId ? this.#primaryMapId(newParentId) : null;
      if (!parentMapId) parentMapId = rootMapId;

      this.#db
        .prepare(
          `UPDATE world_places SET
             parent_place_id = ?,
             revision = revision + 1,
             updated_at = ?
           WHERE id = ? AND world_profile_id = ?`,
        )
        .run(newParentId, now, placeId, worldId);

      const primaryMapId = this.#primaryMapId(placeId);
      if (primaryMapId) {
        this.#markMapUnlocated(primaryMapId, parentMapId, now);
      }

      this.#db.exec('COMMIT');
      const updated = this.#loadPlace(placeId);
      if (!updated) return { ok: false, error: 'P0002' };
      return {
        ok: true,
        value: {
          place: toPlaceVm(updated),
          primaryMapId,
          parentMapId,
          relocated: true,
        },
      };
    } catch (err) {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: mapConstraintError(err) };
    }
  }

  duplicateWorldNode(
    actorIds: readonly string[],
    input: DuplicateWorldNodeInput,
  ): { ok: true; value: DuplicateWorldNodeResult } | { ok: false; error: string } {
    const worldId =
      typeof input.worldProfileId === 'string' ? input.worldProfileId.trim() : '';
    const placeId = typeof input.placeId === 'string' ? input.placeId.trim() : '';
    if (!worldId || !placeId) return { ok: false, error: '22023' };
    if (!this.worldExists(worldId) || !this.canEditWorld(actorIds, worldId)) {
      return { ok: false, error: '42501' };
    }

    const deep = input.deep === true;
    const now = new Date().toISOString();
    const created: DuplicateWorldNodeCreatedEntry[] = [];
    const idMap = new Map<string, string>();

    try {
      this.#db.exec('BEGIN IMMEDIATE');
      const src = this.#loadPlace(placeId);
      if (!src || src.world_profile_id !== worldId) {
        this.#db.exec('ROLLBACK');
        return { ok: false, error: 'P0002' };
      }
      const rootMapId = this.#ensureWorldRootMap(worldId, now);
      let parentMapId = src.parent_place_id ? this.#primaryMapId(src.parent_place_id) : null;
      if (!parentMapId) parentMapId = rootMapId;

      const rootId = randomUUID();
      const copyName = `${src.name} (Kopie)`;
      const srcExtra = this.#db
        .prepare(`SELECT subtype, description, sort_order FROM world_places WHERE id = ?`)
        .get(placeId) as
        | { subtype: string | null; description: string | null; sort_order: number }
        | undefined;

      this.#db
        .prepare(
          `INSERT INTO world_places (
             id, world_profile_id, parent_place_id, kind, name, description,
             status, seed_key, sort_order, revision, subtype, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, ?, 0, ?, ?, ?)`,
        )
        .run(
          rootId,
          worldId,
          src.parent_place_id,
          src.kind,
          copyName,
          srcExtra?.description ?? src.description,
          srcExtra?.sort_order ?? src.sort_order,
          srcExtra?.subtype ?? null,
          now,
          now,
        );
      const rootMap = this.#createPrimaryMap(
        worldId,
        rootId,
        src.kind,
        `${copyName} (Karte)`,
        parentMapId,
        now,
      );
      created.push({
        placeId: rootId,
        mapId: rootMap,
        sourcePlaceId: placeId,
        role: 'root',
      });
      idMap.set(placeId, rootId);

      if (deep) {
        type TreeRow = {
          id: string;
          parent_place_id: string | null;
          kind: string;
          name: string;
          description: string | null;
          subtype: string | null;
          sort_order: number;
          depth: number;
        };
        // Cycle-safe BFS (seen set); parent-before-child by depth for idMap inserts.
        const byDepth: TreeRow[] = [];
        const seen = new Set<string>([placeId]);
        let frontier = this.#db
          .prepare(
            `SELECT id, parent_place_id, kind, name, description, subtype, sort_order
             FROM world_places
             WHERE world_profile_id = ? AND parent_place_id = ?`,
          )
          .all(worldId, placeId) as Omit<TreeRow, 'depth'>[];
        let depth = 1;
        while (frontier.length > 0) {
          const next: Omit<TreeRow, 'depth'>[] = [];
          for (const row of frontier) {
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            byDepth.push({ ...row, depth });
            const kids = this.#db
              .prepare(
                `SELECT id, parent_place_id, kind, name, description, subtype, sort_order
                 FROM world_places
                 WHERE world_profile_id = ? AND parent_place_id = ?`,
              )
              .all(worldId, row.id) as Omit<TreeRow, 'depth'>[];
            for (const k of kids) {
              if (!seen.has(k.id)) next.push(k);
            }
          }
          frontier = next;
          depth += 1;
        }

        for (const row of byDepth) {
          const newParent = row.parent_place_id ? idMap.get(row.parent_place_id) : undefined;
          if (!newParent) {
            this.#db.exec('ROLLBACK');
            return { ok: false, error: 'P0001' };
          }
          const childId = randomUUID();
          this.#db
            .prepare(
              `INSERT INTO world_places (
                 id, world_profile_id, parent_place_id, kind, name, description,
                 status, seed_key, sort_order, revision, subtype, created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, ?, 0, ?, ?, ?)`,
            )
            .run(
              childId,
              worldId,
              newParent,
              row.kind,
              row.name,
              row.description,
              row.sort_order,
              row.subtype,
              now,
              now,
            );
          let childParentMap = this.#primaryMapId(newParent);
          if (!childParentMap) childParentMap = rootMapId;
          const childMap = this.#createPrimaryMap(
            worldId,
            childId,
            row.kind,
            `${row.name} (Karte)`,
            childParentMap,
            now,
          );
          idMap.set(row.id, childId);
          created.push({
            placeId: childId,
            mapId: childMap,
            sourcePlaceId: row.id,
            role: 'deep_copy',
          });
        }
      }

      this.#db.exec('COMMIT');
      return {
        ok: true,
        value: {
          rootPlaceId: rootId,
          rootMapId: rootMap,
          deep,
          created,
        },
      };
    } catch (err) {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: mapConstraintError(err) };
    }
  }
}

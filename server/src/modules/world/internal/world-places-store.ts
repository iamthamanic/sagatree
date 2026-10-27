/**
 * world_places + world_place_map_links persistence (RPC-WORLD-PLACES / #863).
 * Private — import only from world public API.
 * Location: server/src/modules/world/internal/world-places-store.ts
 *
 * Successor fix: saga membership required before party projection
 * (RPC-SEC-CROSS-SAGA-REVEAL).
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';

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

const ALLOWED_KINDS: readonly WorldPlaceKind[] = [
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
];

const ALLOWED_STATUSES: readonly WorldPlaceStatus[] = [
  'placeholder',
  'draft',
  'canonical',
  'archived',
];

const ALLOWED_USAGES: readonly WorldPlaceMapUsage[] = [
  'overview',
  'footprint',
  'entrance',
  'interior',
  'dungeon',
  'battlemap',
  'primary',
];

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
  return (ALLOWED_KINDS as readonly string[]).includes(v);
}

function isStatus(v: string): v is WorldPlaceStatus {
  return (ALLOWED_STATUSES as readonly string[]).includes(v);
}

function isUsage(v: string): v is WorldPlaceMapUsage {
  return (ALLOWED_USAGES as readonly string[]).includes(v);
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

      const rows = this.#db
        .prepare(
          `SELECT l.id, l.world_profile_id, l.place_id, l.map_id, l.usage, l.feature_id, l.anchor
           FROM world_place_map_links l
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

    const parentOk = this.#enforceParentEdge(worldId, placeId, parentPlaceId);
    if (!parentOk.ok) return parentOk;

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
      this.#db.exec('BEGIN IMMEDIATE');
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
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNIQUE|constraint/i.test(msg)) return { ok: false, error: '23505' };
      if (/CHECK|FOREIGN/i.test(msg)) return { ok: false, error: '23514' };
      return { ok: false, error: 'P0001' };
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

    const place = this.#loadPlace(placeId);
    if (!place || place.world_profile_id !== worldId) {
      return { ok: false, error: '22023' };
    }
    const map = this.#db
      .prepare(
        `SELECT id, world_profile_id FROM world_atlas_maps WHERE id = ?`,
      )
      .get(mapId) as { id: string; world_profile_id: string } | undefined;
    if (!map || map.world_profile_id !== worldId) {
      return { ok: false, error: '22023' };
    }

    const featureRaw =
      typeof input.featureId === 'string' ? input.featureId.trim() : '';
    const featureId = featureRaw.length > 0 ? featureRaw : null;
    const anchor =
      input.anchor && typeof input.anchor === 'object' && !Array.isArray(input.anchor)
        ? input.anchor
        : {};
    const now = new Date().toISOString();

    try {
      this.#db.exec('BEGIN IMMEDIATE');

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
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNIQUE|constraint/i.test(msg)) return { ok: false, error: '23505' };
      if (/CHECK|FOREIGN/i.test(msg)) return { ok: false, error: '23514' };
      return { ok: false, error: 'P0001' };
    }
  }
}

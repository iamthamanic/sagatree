/**
 * Legacy world_maps persistence (RPC-WORLD-MAP / #861).
 * Private — import only from world public API.
 * Location: server/src/modules/world/internal/world-map-store.ts
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type WorldMapDto = {
  readonly worldProfileId: string;
  readonly revision: number;
  readonly mapData: Record<string, unknown>;
  readonly updatedAt: string | null;
};

const EMPTY_MAP: Record<string, unknown> = {
  size: 24,
  tiles: {},
  countries: [],
  pins: [],
};

function parseMapData(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return { ...EMPTY_MAP };
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return { ...EMPTY_MAP };
}

function filterPlayerPins(mapData: Record<string, unknown>): Record<string, unknown> {
  const pins = Array.isArray(mapData.pins) ? mapData.pins : [];
  const visible = pins.filter((pin) => {
    if (!pin || typeof pin !== 'object' || Array.isArray(pin)) return false;
    const discovered = (pin as { discovered?: unknown }).discovered;
    return discovered !== false;
  });
  return { ...mapData, pins: visible };
}

export class WorldMapStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  worldExists(worldId: string): boolean {
    const row = this.#db.prepare(`SELECT 1 AS ok FROM worlds WHERE id = ?`).get(worldId) as
      | { ok: number }
      | undefined;
    return Boolean(row);
  }

  isWorldOwner(actorId: string, worldId: string): boolean {
    const row = this.#db
      .prepare(`SELECT 1 AS ok FROM worlds WHERE id = ? AND owner_user_id = ?`)
      .get(worldId, actorId) as { ok: number } | undefined;
    return Boolean(row);
  }

  /** Owner or active member/GM on a project bound to this world. */
  canReadWorld(actorId: string, worldId: string): boolean {
    if (this.isWorldOwner(actorId, worldId)) return true;
    const row = this.#db
      .prepare(
        `SELECT 1 AS ok
         FROM projects p
         WHERE p.world_id = ?
           AND (
             p.gm_user_id = ?
             OR EXISTS (
               SELECT 1 FROM project_members pm
               WHERE pm.project_id = p.id AND pm.user_id = ? AND pm.active = 1
             )
           )
         LIMIT 1`,
      )
      .get(worldId, actorId, actorId) as { ok: number } | undefined;
    return Boolean(row);
  }

  canEditWorld(actorId: string, worldId: string): boolean {
    return this.isWorldOwner(actorId, worldId);
  }

  getMap(worldId: string, forcePlayerView: boolean): WorldMapDto {
    const row = this.#db
      .prepare(
        `SELECT world_id, revision, map_data, updated_at FROM world_maps WHERE world_id = ?`,
      )
      .get(worldId) as
      | { world_id: string; revision: number; map_data: string; updated_at: string | null }
      | undefined;
    if (!row) {
      return {
        worldProfileId: worldId,
        revision: 0,
        mapData: { ...EMPTY_MAP },
        updatedAt: null,
      };
    }
    let mapData = parseMapData(row.map_data);
    if (forcePlayerView) mapData = filterPlayerPins(mapData);
    return {
      worldProfileId: row.world_id,
      revision: row.revision,
      mapData,
      updatedAt: row.updated_at,
    };
  }

  saveMap(
    worldId: string,
    expectedRevision: number | null,
    mapData: Record<string, unknown>,
  ): { ok: true; value: WorldMapDto } | { ok: false; error: string } {
    const sizeRaw = mapData.size;
    const size = typeof sizeRaw === 'number' ? sizeRaw : Number(sizeRaw ?? 24);
    if (!Number.isFinite(size) || size < 1 || size > 60) {
      return { ok: false, error: '22023' };
    }
    const pins = Array.isArray(mapData.pins) ? mapData.pins : [];
    for (const pin of pins) {
      if (!pin || typeof pin !== 'object' || Array.isArray(pin)) continue;
      const imagePath = typeof (pin as { imagePath?: unknown }).imagePath === 'string'
        ? (pin as { imagePath: string }).imagePath
        : '';
      if (imagePath.startsWith('data:') || imagePath.length > 512) {
        return { ok: false, error: '22023' };
      }
    }

    const existing = this.#db
      .prepare(`SELECT revision FROM world_maps WHERE world_id = ?`)
      .get(worldId) as { revision: number } | undefined;
    const updatedAt = new Date().toISOString();
    const json = JSON.stringify(mapData);

    this.#db.exec('BEGIN IMMEDIATE');
    try {
      if (existing) {
        const expected = expectedRevision ?? -1;
        if (expected >= 0 && existing.revision !== expected) {
          this.#db.exec('ROLLBACK');
          return { ok: false, error: '40001' };
        }
        const next = existing.revision + 1;
        this.#db
          .prepare(
            `UPDATE world_maps SET map_data = ?, revision = ?, updated_at = ? WHERE world_id = ?`,
          )
          .run(json, next, updatedAt, worldId);
      } else {
        this.#db
          .prepare(
            `INSERT INTO world_maps (world_id, revision, map_data, updated_at) VALUES (?, 1, ?, ?)`,
          )
          .run(worldId, json, updatedAt);
      }
      this.#db.exec('COMMIT');
    } catch {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: 'P0001' };
    }

    return { ok: true, value: this.getMap(worldId, false) };
  }
}

/**
 * Party-revealed atlas map ids — reads world links + permissions bindings (#862).
 * Private — wired from world module factory only.
 * Location: server/src/modules/world/internal/atlas-party-projection.ts
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { PartyRevealedAtlasMapIds } from './world-atlas-store.ts';

export function createPartyRevealedAtlasMapIds(db: HostDatabase): PartyRevealedAtlasMapIds {
  const stmt = db.prepare(
    `SELECT DISTINCT l.map_id AS mapId
     FROM world_place_map_links l
     INNER JOIN world_places p
       ON p.id = l.place_id
      AND p.world_profile_id = ?
      AND p.status = 'canonical'
     INNER JOIN saga_asset_bindings b
       ON b.world_place_id = p.id
      AND b.project_id = ?
      AND b.asset_kind = 'location'
      AND b.reveal = 'party'
     WHERE l.world_profile_id = ?
       AND l.usage = 'primary'`,
  );
  return (worldProfileId: string, projectId: string): readonly string[] => {
    const rows = stmt.all(worldProfileId, projectId, worldProfileId) as { mapId: string }[];
    return rows.map((r) => r.mapId);
  };
}

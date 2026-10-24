/**
 * Documented restore drill: export → empty host → import → checksum + ownership (MIG-502).
 * Location: server/src/migration/bundles/restore-drill.ts
 */
import type { HostDatabase } from '../../persistence/open-database.ts';
import { canonicalTableChecksum } from '../postgres/checksum.ts';
import { exportHostBundle } from './export-bundle.ts';
import { importHostBundle } from './import-bundle.ts';
import type { BundleAtlasNode, BundleInventoryItem, BundleNpc, BundleResult } from './types.ts';

export type RestoreDrillInput = {
  readonly sourceDb: HostDatabase;
  readonly targetDb: HostDatabase;
  readonly sourceOwnerUserId: string;
  readonly restoreOwnerUserId: string;
  readonly assetBytesById: ReadonlyMap<string, Uint8Array>;
  readonly atlasNodes?: readonly BundleAtlasNode[];
  readonly npcs?: readonly BundleNpc[];
  readonly inventory?: readonly BundleInventoryItem[];
  /** Foreign actor for negative ownership checks on the restored host. */
  readonly strangerUserId: string;
};

export type RestoreDrillReport = {
  readonly payloadChecksum: string;
  readonly worldChecksum: string;
  readonly assetChecksum: string;
  readonly missingAtlasGeometryIds: readonly string[];
  readonly strangerWorldCount: number;
  readonly ownerWorldCount: number;
};

export function runRestoreDrill(input: RestoreDrillInput): BundleResult<RestoreDrillReport> {
  const exported = exportHostBundle({
    db: input.sourceDb,
    ownerUserId: input.sourceOwnerUserId,
    assetBytesById: input.assetBytesById,
    atlasNodes: input.atlasNodes,
    npcs: input.npcs,
    inventory: input.inventory,
  });
  if (!exported.ok) return exported;

  const imported = importHostBundle({
    db: input.targetDb,
    bundle: exported.value,
    importingOwnerUserId: input.restoreOwnerUserId,
    refuseExistingIds: true,
  });
  if (!imported.ok) return imported;

  const worlds = input.targetDb
    .prepare(`SELECT id, owner_user_id, title FROM worlds ORDER BY id`)
    .all() as Record<string, unknown>[];
  const assets = input.targetDb
    .prepare(`SELECT id, owner_user_id, checksum_sha256, storage_key FROM assets ORDER BY id`)
    .all() as Record<string, unknown>[];

  const ownerWorldCount = worlds.filter((w) => w.owner_user_id === input.restoreOwnerUserId).length;
  const strangerWorldCount = worlds.filter((w) => w.owner_user_id === input.strangerUserId).length;

  return {
    ok: true,
    value: {
      payloadChecksum: imported.value.payloadChecksum,
      worldChecksum: canonicalTableChecksum(worlds),
      assetChecksum: canonicalTableChecksum(assets),
      missingAtlasGeometryIds: imported.value.missingAtlasGeometryIds,
      strangerWorldCount,
      ownerWorldCount,
    },
  };
}

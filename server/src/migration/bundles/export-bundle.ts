/**
 * Export a versioned host world/saga bundle from SQLite + in-memory asset bytes (MIG-502).
 * Location: server/src/migration/bundles/export-bundle.ts
 */
import type { HostDatabase } from '../../persistence/open-database.ts';
import { signBundle } from './checksum.ts';
import {
  BUNDLE_FORMAT,
  BUNDLE_FORMAT_VERSION,
  type BundleAssetMeta,
  type BundleAtlasNode,
  type BundleInventoryItem,
  type BundleNpc,
  type BundlePayload,
  type BundleResult,
  type SignedBundle,
} from './types.ts';

export type ExportBundleInput = {
  readonly db: HostDatabase;
  readonly ownerUserId: string;
  /** assetId → raw bytes already owned by the export owner */
  readonly assetBytesById: ReadonlyMap<string, Uint8Array>;
  readonly atlasNodes?: readonly BundleAtlasNode[];
  readonly npcs?: readonly BundleNpc[];
  readonly inventory?: readonly BundleInventoryItem[];
};

function rows(db: HostDatabase, sql: string, ...params: unknown[]): Record<string, unknown>[] {
  return db.prepare(sql).all(...params) as Record<string, unknown>[];
}

export function exportHostBundle(input: ExportBundleInput): BundleResult<SignedBundle> {
  const { db, ownerUserId } = input;
  if (!ownerUserId) return { ok: false, error: 'missing-owner' };

  const worlds = rows(db, `SELECT * FROM worlds WHERE owner_user_id = ?`, ownerUserId);
  const worldIds = worlds.map((w) => String(w.id));
  const projects =
    worldIds.length === 0
      ? []
      : rows(
          db,
          `SELECT * FROM projects WHERE world_id IN (${worldIds.map(() => '?').join(',')})`,
          ...worldIds,
        );
  const projectIds = projects.map((p) => String(p.id));
  const projectMembers =
    projectIds.length === 0
      ? []
      : rows(
          db,
          `SELECT * FROM project_members WHERE project_id IN (${projectIds.map(() => '?').join(',')})`,
          ...projectIds,
        );

  const sagaDefinitions = rows(
    db,
    `SELECT * FROM saga_definitions WHERE owner_user_id = ? OR origin = 'native'`,
    ownerUserId,
  );
  const sagaIds = sagaDefinitions.map((s) => String(s.id));
  const sagaDefinitionVersions =
    sagaIds.length === 0
      ? []
      : rows(
          db,
          `SELECT * FROM saga_definition_versions WHERE saga_id IN (${sagaIds.map(() => '?').join(',')})`,
          ...sagaIds,
        );

  const assetRows = rows(
    db,
    `SELECT id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published
     FROM assets WHERE owner_user_id = ? AND published = 1`,
    ownerUserId,
  );
  const assets: BundleAssetMeta[] = [];
  const assetBytes: Record<string, string> = {};
  for (const row of assetRows) {
    const id = String(row.id);
    const storageKey = String(row.storage_key);
    const bytes = input.assetBytesById.get(id);
    if (!bytes) return { ok: false, error: `missing-asset-bytes:${id}` };
    assets.push({
      id,
      ownerUserId: String(row.owner_user_id),
      contentType: String(row.content_type),
      byteSize: Number(row.byte_size),
      checksumSha256: String(row.checksum_sha256),
      storageKey,
    });
    assetBytes[storageKey] = Buffer.from(bytes).toString('base64');
  }

  const atlasNodes = input.atlasNodes ?? [];
  const missingAtlasGeometryIds = atlasNodes
    .filter((n) => n.geometry === null)
    .map((n) => n.id);

  const payload: BundlePayload = {
    format: BUNDLE_FORMAT,
    formatVersion: BUNDLE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    sourceOwnerUserId: ownerUserId,
    worlds,
    projects,
    projectMembers,
    sagaDefinitions,
    sagaDefinitionVersions,
    assets,
    assetBytes,
    atlasNodes,
    npcs: input.npcs ?? [],
    inventory: input.inventory ?? [],
    missingAtlasGeometryIds,
  };

  return { ok: true, value: signBundle(payload) };
}

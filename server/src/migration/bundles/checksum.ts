/**
 * Bundle payload checksum helpers (MIG-502).
 * Location: server/src/migration/bundles/checksum.ts
 */
import { createHash } from 'node:crypto';
import { stableStringify } from '../postgres/checksum.ts';
import type { BundlePayload, SignedBundle } from './types.ts';

export function payloadForChecksum(bundle: BundlePayload | SignedBundle): BundlePayload {
  const {
    format,
    formatVersion,
    exportedAt,
    sourceOwnerUserId,
    worlds,
    projects,
    projectMembers,
    sagaDefinitions,
    sagaDefinitionVersions,
    assets,
    assetBytes,
    atlasNodes,
    npcs,
    inventory,
    missingAtlasGeometryIds,
  } = bundle;
  return {
    format,
    formatVersion,
    exportedAt,
    sourceOwnerUserId,
    worlds,
    projects,
    projectMembers,
    sagaDefinitions,
    sagaDefinitionVersions,
    assets,
    assetBytes,
    atlasNodes,
    npcs,
    inventory,
    missingAtlasGeometryIds,
  };
}

export function checksumBundlePayload(bundle: BundlePayload | SignedBundle): string {
  return createHash('sha256').update(stableStringify(payloadForChecksum(bundle)), 'utf8').digest('hex');
}

export function signBundle(bundle: BundlePayload): SignedBundle {
  return { ...bundle, checksumSha256: checksumBundlePayload(bundle) };
}

export function verifyBundleChecksum(bundle: SignedBundle): boolean {
  return checksumBundlePayload(bundle) === bundle.checksumSha256;
}

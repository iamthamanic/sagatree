/**
 * character-avatar-export-service — materialize owner-scoped GLB on Character Save (#7 / CUT-12).
 * Location: src/infrastructure/character/avatar/character-avatar-export-service.ts
 *
 * Validates/builds domain payload, uploads once via host AssetPorts (CUT-20).
 */
import type { CharacterAvatarDto } from '../../../domains/character/domain/character.entity';
import {
  buildAvatarSaveExportPayload,
  encodeAvatarExportGlb,
  type AvatarSaveExportArtifact,
  type AvatarSaveExportUiStatus,
  type RuntimeTraitOverlay,
} from '../../../domains/character/avatar';
import { resolveBaseBodyModelUrl } from './base-body-catalog';
import { isHostLibraryEnabled, publishHostAvatarModel } from '../../host/host-library-http';
import { getHostAuthBaseUrl } from '../../../lib/hostAuthBridge';

/** Matches server AssetPorts.publish DEFAULT_ASSET_MAX_BYTES (host avatar-model path). */
const HOST_AVATAR_MODEL_MAX_BYTES = 16 * 1024 * 1024;

export interface AvatarSaveExportProgress {
  status: AvatarSaveExportUiStatus;
  message: string;
  artifact?: AvatarSaveExportArtifact;
}

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

function usesHostAssetCredentials(url: string): boolean {
  if (url.includes('/api/v1/assets/')) return true;
  const hostBase = getHostAuthBaseUrl();
  if (!hostBase) return false;
  try {
    return new URL(url).origin === new URL(hostBase).origin && url.includes('/api/v1/assets/');
  } catch {
    return false;
  }
}

async function tryFetchSourceMeshBytes(url: string | undefined): Promise<Uint8Array | undefined> {
  if (!url) return undefined;
  try {
    const response = await fetch(url, {
      credentials: usesHostAssetCredentials(url) ? 'include' : 'omit',
    });
    if (!response.ok) return undefined;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    return undefined;
  }
}

/**
 * Materialize one export GLB for the current compact avatar.
 * Runtime overlays are accepted only so they can be discarded by the domain builder.
 */
export async function materializeAvatarSaveExport(
  input: {
    avatar: CharacterAvatarDto;
    characterId?: string | null;
    runtimeOverlays?: readonly RuntimeTraitOverlay[];
    sourceModelUrl?: string;
    onProgress?: (progress: AvatarSaveExportProgress) => void;
  },
): Promise<AvatarSaveExportArtifact> {
  assertHost();
  const report = (
    status: AvatarSaveExportUiStatus,
    message: string,
    artifact?: AvatarSaveExportArtifact,
  ) => {
    input.onProgress?.({ status, message, artifact });
  };

  report('preparing', 'Avatar-Export wird vorbereitet …');

  const sourceUrl = input.sourceModelUrl ?? input.avatar.model_url ?? resolveBaseBodyModelUrl();
  const sourceBytes = await tryFetchSourceMeshBytes(sourceUrl);
  const embedsSourceMesh = Boolean(sourceBytes && sourceBytes.byteLength > 12);

  const payload = buildAvatarSaveExportPayload({
    avatar: input.avatar,
    runtimeOverlays: input.runtimeOverlays,
    embedsSourceMesh,
    catalogBasePath: embedsSourceMesh ? undefined : 'sagatree-base-humanoid-v1.vrm',
  });

  const bytes = encodeAvatarExportGlb({
    payload,
    sourceMeshBytes: sourceBytes,
  });

  report('uploading', 'Avatar-Artefakt wird gespeichert …');
  const artifactId = crypto.randomUUID();

  if (bytes.byteLength > HOST_AVATAR_MODEL_MAX_BYTES) {
    report('error', 'Avatar-Export zu groß für den Host-Speicher.');
    throw new Error(
      `Avatar-Export zu groß für den Host-Speicher (max. ${HOST_AVATAR_MODEL_MAX_BYTES} Bytes).`,
    );
  }
  const blob = new File([new Uint8Array(bytes)], `avatar-export-${artifactId}.glb`, {
    type: 'model/gltf-binary',
  });
  let published;
  try {
    published = await publishHostAvatarModel(blob, { assetId: artifactId });
  } catch (error) {
    report('error', 'Avatar-Export fehlgeschlagen. Bitte erneut speichern.');
    throw new Error(
      error instanceof Error ? error.message : 'Avatar-Export-Upload fehlgeschlagen',
    );
  }
  report('activating', 'Export wird aktiviert …');
  const artifact: AvatarSaveExportArtifact = {
    artifactId,
    storagePath: published.storagePath,
    modelUrl: published.url,
    byteSize: bytes.byteLength,
    format: 'glb',
    payload,
  };
  report('success', 'Avatar-Export materialisiert.', artifact);
  return artifact;
}

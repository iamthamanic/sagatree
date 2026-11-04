/**
 * character-avatar-export-service — materialize owner-scoped GLB on Character Save (#7).
 * Location: src/infrastructure/character/avatar/character-avatar-export-service.ts
 *
 * Validates/builds domain payload, uploads once, activates exactly one artifact.
 * On failure: does not activate; caller must keep prior model_url + draft.
 */

import { supabase } from '../../../lib/supabase';
import type { CharacterAvatarDto } from '../../../domains/character/domain/character.entity';
import {
  AVATAR_SAVE_EXPORT_VERSION,
  MORPH_CONTRACT_VERSION,
  buildAvatarExportStoragePath,
  buildAvatarSaveExportPayload,
  encodeAvatarExportGlb,
  type AvatarSaveExportArtifact,
  type AvatarSaveExportUiStatus,
  type RuntimeTraitOverlay,
} from '../../../domains/character/avatar';
import { resolveBaseBodyModelUrl } from './base-body-catalog';
import { assertHostProductSurfaceAvailable } from '../../host/host-product-deny';

const BUCKET = 'character-avatars';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365;

async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    throw new Error('Anmeldung erforderlich, um den Avatar zu exportieren.');
  }
  return data.user.id;
}

export interface AvatarSaveExportProgress {
  status: AvatarSaveExportUiStatus;
  message: string;
  artifact?: AvatarSaveExportArtifact;
}

async function tryFetchSourceMeshBytes(url: string | undefined): Promise<Uint8Array | undefined> {
  if (!url) return undefined;
  try {
    const response = await fetch(url);
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
  assertHostProductSurfaceAvailable('Avatar-Export');
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
  const ownerUserId = await getAuthenticatedUserId();
  const artifactId = crypto.randomUUID();
  const storagePath = buildAvatarExportStoragePath({ ownerUserId, artifactId });

  const blob = new Blob([new Uint8Array(bytes)], { type: 'model/gltf-binary' });
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, blob, {
    contentType: 'model/gltf-binary',
    upsert: false,
  });
  if (uploadError) {
    report('error', 'Avatar-Export fehlgeschlagen. Bitte erneut speichern.');
    throw new Error(`Avatar-Export-Upload fehlgeschlagen: ${uploadError.message}`);
  }

  report('activating', 'Export wird aktiviert …');

  // Deactivate previous active export for this character (exactly-one active).
  if (input.characterId) {
    await supabase
      .from('character_avatar_export_assets')
      .update({ is_active: false })
      .eq('owner_user_id', ownerUserId)
      .eq('character_id', input.characterId)
      .eq('is_active', true);
  }

  const { error: insertError } = await supabase.from('character_avatar_export_assets').insert({
    id: artifactId,
    owner_user_id: ownerUserId,
    character_id: input.characterId ?? null,
    format: 'glb',
    mime: 'model/gltf-binary',
    byte_size: bytes.byteLength,
    storage_path: storagePath,
    export_contract_version: AVATAR_SAVE_EXPORT_VERSION,
    morph_contract_version: MORPH_CONTRACT_VERSION,
    embeds_source_mesh: embedsSourceMesh,
    is_active: true,
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    report('error', 'Avatar-Export konnte nicht bestätigt werden.');
    throw new Error(`Avatar-Export-Artefakt konnte nicht gespeichert werden: ${insertError.message}`);
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
  if (signedError || !signed?.signedUrl) {
    // Roll back active flag so previous artifact remains the only active one.
    await supabase
      .from('character_avatar_export_assets')
      .update({ is_active: false })
      .eq('id', artifactId)
      .eq('owner_user_id', ownerUserId);
    report('error', 'Export-URL konnte nicht erzeugt werden.');
    throw new Error(signedError?.message ?? 'Signed URL fehlt');
  }

  const artifact: AvatarSaveExportArtifact = {
    artifactId,
    storagePath,
    modelUrl: signed.signedUrl,
    byteSize: bytes.byteLength,
    format: 'glb',
    payload,
  };

  report('success', 'Avatar-Export materialisiert.', artifact);
  return artifact;
}

/**
 * character-avatar-import-service — validate + owner-scoped VRM/GLB upload (#5 / #261 / CUT-12).
 * Location: src/infrastructure/character/avatar/character-avatar-import-service.ts
 *
 * Authoritative byte validation runs before storage write.
 * Import Flow v2: upload+analyze stays inactive until „Original behalten“.
 * Capabilities are never written by the client.
 * Host-first: publish via /api/v1/assets (purpose=avatar-model) + CUT-11 artifact ports.
 */

import { supabase } from '../../../lib/supabase';
import { getAuthenticatedUserId } from '../../../lib/authenticatedUser';
import {
  AVATAR_IMPORT_MAX_BYTES,
  buildAvatarImportStoragePath,
  buildImportAnalysisSummary,
  buildImportOriginalKeepSeed,
  earlyCheckAvatarImportFile,
  validateAvatarImportBytes,
  type AvatarImportArtifact,
  type AvatarImportUiStatus,
  type ImportAnalysisSummaryV1,
  type ImportOriginalKeepSeedV1,
} from '../../../domains/character/avatar';
import {
  activateAvatarArtifact,
  materializeArtifactFromImportAsset,
} from './character-avatar-artifact-service';
import { previewAnalyzeAvatarGlbBytes } from './avatar-structure-scanner';
import { resolveFamilyCompatibilityFromAnalysis } from './body-profile-metrics';
import {
  isHostLibraryEnabled,
  publishHostAvatarModel,
} from '../../host/host-library-http';

const BUCKET = 'character-avatars';
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365;

async function readFileBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

export interface AvatarImportProgress {
  status: AvatarImportUiStatus;
  message: string;
  artifact?: AvatarImportArtifact;
  summary?: ImportAnalysisSummaryV1;
}

export interface AvatarImportDraftV2 {
  importAssetId: string;
  artifactId: string;
  format: AvatarImportArtifact['format'];
  byteSize: number;
  storagePath: string;
  modelUrl: string;
  /** Non-authoritative preview analysis for UX — never escalate capabilities. */
  summary: ImportAnalysisSummaryV1;
  keepSeed: ImportOriginalKeepSeedV1;
}

type ProgressReporter = (
  status: AvatarImportUiStatus,
  message: string,
  extra?: { artifact?: AvatarImportArtifact; summary?: ImportAnalysisSummaryV1 },
) => void;

async function analyzeImportBytes(
  bytes: Uint8Array,
  report: ProgressReporter,
): Promise<ImportAnalysisSummaryV1> {
  report('analyzing', 'Modell wird analysiert …');
  try {
    const analysis = await previewAnalyzeAvatarGlbBytes(bytes);
    const { compatibility } = resolveFamilyCompatibilityFromAnalysis(analysis);
    return buildImportAnalysisSummary({ analysis, compatibility });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Analyse fehlgeschlagen. Bitte erneut versuchen.';
    report('failed', message);
    throw new Error(message);
  }
}

function finishDraft(input: {
  importAssetId: string;
  artifactId: string;
  format: AvatarImportArtifact['format'];
  byteSize: number;
  storagePath: string;
  modelUrl: string;
  summary: ImportAnalysisSummaryV1;
  report: ProgressReporter;
}): AvatarImportDraftV2 {
  const keepSeed = buildImportOriginalKeepSeed({
    modelUrl: input.modelUrl,
    artifactId: input.artifactId,
    importAssetId: input.importAssetId,
    analysis: {
      anatomy: input.summary.anatomy,
      modularity: input.summary.modularity,
    },
    compatibility: {
      recommendedFamily: input.summary.recommendedFamily,
      status:
        input.summary.flowStatus === 'ready-humanoid' ? 'family-compatible' : 'custom',
    },
  });

  const legacyArtifact: AvatarImportArtifact = {
    artifactId: input.importAssetId,
    format: input.format,
    byteSize: input.byteSize,
    storagePath: input.storagePath,
    modelUrl: input.modelUrl,
    rigAnalysisStatus: 'pending',
  };

  const uiStatus: AvatarImportUiStatus =
    input.summary.flowStatus === 'ready-humanoid' ||
    input.summary.flowStatus === 'ready-custom' ||
    input.summary.flowStatus === 'limited' ||
    input.summary.flowStatus === 'failed'
      ? input.summary.flowStatus
      : 'analyzing';

  input.report(uiStatus, input.summary.headlineDe, {
    artifact: legacyArtifact,
    summary: input.summary,
  });

  return {
    importAssetId: input.importAssetId,
    artifactId: input.artifactId,
    format: input.format,
    byteSize: input.byteSize,
    storagePath: input.storagePath,
    modelUrl: input.modelUrl,
    summary: input.summary,
    keepSeed,
  };
}

async function uploadAndAnalyzeHost(
  file: File,
  bytes: Uint8Array,
  format: AvatarImportArtifact['format'],
  mime: string,
  options: {
    characterId?: string | null;
    report: ProgressReporter;
  },
): Promise<AvatarImportDraftV2> {
  options.report('uploading', 'Modell wird hochgeladen …');
  const importAssetId = crypto.randomUUID();
  const blob = new File([new Uint8Array(bytes)], file.name || `avatar.${format}`, {
    type: mime,
  });
  let published;
  try {
    published = await publishHostAvatarModel(blob, { assetId: importAssetId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Upload fehlgeschlagen. Bitte erneut versuchen.';
    options.report('failed', message);
    throw new Error(message);
  }

  let v2ArtifactId: string = importAssetId;
  try {
    const artifact = await materializeArtifactFromImportAsset({
      importAssetId,
      characterId: options.characterId,
      storagePath: published.storagePath,
      format,
    });
    v2ArtifactId = artifact.artifactId;
  } catch (error) {
    console.warn(
      '[avatar-import] V2 artifact materialize skipped:',
      error instanceof Error ? error.message : error,
    );
  }

  const summary = await analyzeImportBytes(bytes, options.report);
  return finishDraft({
    importAssetId,
    artifactId: v2ArtifactId,
    format,
    byteSize: bytes.byteLength,
    storagePath: published.storagePath,
    modelUrl: published.url,
    summary,
    report: options.report,
  });
}

async function uploadAndAnalyzeLegacy(
  file: File,
  bytes: Uint8Array,
  format: AvatarImportArtifact['format'],
  mime: string,
  options: {
    characterId?: string | null;
    report: ProgressReporter;
  },
): Promise<AvatarImportDraftV2> {
  options.report('uploading', 'Modell wird hochgeladen …');
  const ownerUserId = await getAuthenticatedUserId();
  const importAssetId = crypto.randomUUID();
  const storagePath = buildAvatarImportStoragePath({
    ownerUserId,
    artifactId: importAssetId,
    format,
  });

  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, blob, {
    contentType: mime,
    upsert: false,
  });
  if (uploadError) {
    options.report('failed', 'Upload fehlgeschlagen. Bitte erneut versuchen.');
    throw new Error(`Avatar-Upload fehlgeschlagen: ${uploadError.message}`);
  }

  // Draft row — inactive so a failed analysis never replaces the active avatar.
  const { error: insertError } = await supabase.from('character_avatar_import_assets').insert({
    id: importAssetId,
    owner_user_id: ownerUserId,
    character_id: options.characterId ?? null,
    format,
    mime,
    byte_size: bytes.byteLength,
    storage_path: storagePath,
    rig_analysis_status: 'pending',
    is_active: false,
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    options.report('failed', 'Import konnte nicht bestätigt werden.');
    throw new Error(`Avatar-Artefakt konnte nicht gespeichert werden: ${insertError.message}`);
  }

  let v2ArtifactId: string = importAssetId;
  try {
    const artifact = await materializeArtifactFromImportAsset({
      importAssetId,
      characterId: options.characterId,
      storagePath,
      format,
    });
    v2ArtifactId = artifact.artifactId;
  } catch (error) {
    // Artifact table may be unavailable in older envs — keep import draft usable.
    console.warn(
      '[avatar-import] V2 artifact materialize skipped:',
      error instanceof Error ? error.message : error,
    );
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_SECONDS);
  if (signedError || !signed?.signedUrl) {
    options.report('failed', 'Vorschau-URL konnte nicht erzeugt werden.');
    throw new Error(signedError?.message ?? 'Signed URL fehlt');
  }

  const summary = await analyzeImportBytes(bytes, options.report);
  return finishDraft({
    importAssetId,
    artifactId: v2ArtifactId,
    format,
    byteSize: bytes.byteLength,
    storagePath,
    modelUrl: signed.signedUrl,
    summary,
    report: options.report,
  });
}

/**
 * Upload + analyze without activating. Previous active avatar stays untouched.
 * Call `keepOriginalImportedAvatar` to activate and hand the model to the editor.
 */
export async function uploadAndAnalyzeCharacterAvatarModel(
  file: File,
  options: {
    characterId?: string | null;
    onProgress?: (progress: AvatarImportProgress) => void;
  } = {},
): Promise<AvatarImportDraftV2> {
  const report: ProgressReporter = (status, message, extra) => {
    options.onProgress?.({ status, message, artifact: extra?.artifact, summary: extra?.summary });
  };

  report('validating', 'Datei wird geprüft …');
  const early = earlyCheckAvatarImportFile({ fileName: file.name, byteSize: file.size });
  if (!early.ok) {
    report('failed', early.message ?? 'Datei ungültig.');
    throw new Error(early.message ?? 'Datei ungültig.');
  }

  const bytes = await readFileBytes(file);
  let format: AvatarImportArtifact['format'];
  let mime: string;
  try {
    const validated = validateAvatarImportBytes({
      bytes,
      fileName: file.name,
      claimedMime: file.type,
    });
    format = validated.format;
    mime = validated.mime;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Validierung fehlgeschlagen.';
    report('failed', message);
    throw new Error(message);
  }

  if (isHostLibraryEnabled()) {
    return uploadAndAnalyzeHost(file, bytes, format, mime, {
      characterId: options.characterId,
      report,
    });
  }

  return uploadAndAnalyzeLegacy(file, bytes, format, mime, {
    characterId: options.characterId,
    report,
  });
}

/**
 * Activate draft import + V2 artifact. Previous active import rows for the character
 * are deactivated only here — never during upload/analyze failure paths.
 */
export async function keepOriginalImportedAvatar(input: {
  draft: AvatarImportDraftV2;
  characterId?: string | null;
}): Promise<ImportOriginalKeepSeedV1> {
  if (!input.draft.summary.canKeepOriginal || input.draft.summary.flowStatus === 'failed') {
    throw new Error('Original behalten ist für dieses Analyseergebnis nicht verfügbar.');
  }

  if (isHostLibraryEnabled()) {
    try {
      const activated = await activateAvatarArtifact(input.draft.artifactId);
      if (activated.ok === false) {
        throw new Error(activated.reasonDe);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Import konnte nicht aktiviert werden.';
      throw new Error(message);
    }
    return input.draft.keepSeed;
  }

  const ownerUserId = await getAuthenticatedUserId();

  if (input.characterId) {
    await supabase
      .from('character_avatar_import_assets')
      .update({ is_active: false })
      .eq('owner_user_id', ownerUserId)
      .eq('character_id', input.characterId)
      .eq('is_active', true);
  }

  const { error: activateImportError } = await supabase
    .from('character_avatar_import_assets')
    .update({ is_active: true })
    .eq('id', input.draft.importAssetId)
    .eq('owner_user_id', ownerUserId);

  if (activateImportError) {
    throw new Error(
      `Import konnte nicht aktiviert werden: ${activateImportError.message}`,
    );
  }

  try {
    const activated = await activateAvatarArtifact(input.draft.artifactId);
    if (activated.ok === false) {
      console.warn('[avatar-import] V2 artifact activate:', activated.reasonDe);
    }
  } catch (error) {
    console.warn(
      '[avatar-import] V2 artifact activate skipped:',
      error instanceof Error ? error.message : error,
    );
  }

  return input.draft.keepSeed;
}

/**
 * Legacy one-shot import (immediate activate). Prefer uploadAndAnalyze + keepOriginal for V2.
 * @deprecated Use uploadAndAnalyzeCharacterAvatarModel + keepOriginalImportedAvatar.
 */
export async function importCharacterAvatarModel(
  file: File,
  options: {
    characterId?: string | null;
    onProgress?: (progress: AvatarImportProgress) => void;
  } = {},
): Promise<AvatarImportArtifact> {
  const draft = await uploadAndAnalyzeCharacterAvatarModel(file, options);
  if (draft.summary.flowStatus === 'failed') {
    throw new Error(draft.summary.detailDe);
  }
  const seed = await keepOriginalImportedAvatar({
    draft,
    characterId: options.characterId,
  });
  options.onProgress?.({
    status: 'success',
    message: '3D-Charakter importiert. Rig-Analyse folgt automatisch.',
    artifact: {
      artifactId: draft.importAssetId,
      format: draft.format,
      byteSize: draft.byteSize,
      storagePath: draft.storagePath,
      modelUrl: seed.modelUrl,
      rigAnalysisStatus: 'pending',
    },
    summary: draft.summary,
  });
  return {
    artifactId: draft.importAssetId,
    format: draft.format,
    byteSize: draft.byteSize,
    storagePath: draft.storagePath,
    modelUrl: seed.modelUrl,
    rigAnalysisStatus: 'pending',
  };
}

export function avatarImportLimits() {
  return {
    maxBytes: AVATAR_IMPORT_MAX_BYTES,
    accept: '.vrm,.glb,model/gltf-binary,application/octet-stream',
  };
}

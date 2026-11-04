/**
 * character-avatar-artifact-service — Supabase facade for Avatar V2 artifacts (#251).
 * Location: src/infrastructure/character/avatar/character-avatar-artifact-service.ts
 *
 * create / read / activate + map legacy import/generate rows. Domain owns validation;
 * App slices must not import supabase directly.
 */

import { supabase } from '../../../lib/supabase';
import {
  assertCanActivateAvatarArtifact,
  assertLogicalAvatarArtifactAssetKey,
  assertOwnerScopedStoragePath,
  mapGenerateJobToArtifactInput,
  mapImportAssetToArtifactInput,
  mapTemplateToArtifactInput,
  materializeAvatarArtifact,
  type AvatarArtifactAnalysisStatus,
  type AvatarArtifactFormat,
  type AvatarArtifactMaterializationStatus,
  type AvatarArtifactV2,
  type AvatarArtifactActivateResult,
  type AvatarStructureAnalysisResultV2,
} from '../../../domains/character/avatar';
import type { AvatarV2Source } from '../../../domains/character/avatar';
import { assertHostProductSurfaceAvailable } from '../../host/host-product-deny';

interface ArtifactRow {
  id: string;
  owner_user_id: string;
  character_id: string | null;
  origin: string;
  asset_key: string;
  storage_path: string;
  format: string;
  analysis_status: string;
  materialization_status: string;
  is_active: boolean;
  schema_version: number;
  import_asset_id: string | null;
  generate_job_id: string | null;
  template_id: string | null;
  provider_id: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

async function getAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    throw new Error('Anmeldung erforderlich für Avatar-Artefakte.');
  }
  return data.user.id;
}

function rowToArtifact(row: ArtifactRow): AvatarArtifactV2 {
  assertLogicalAvatarArtifactAssetKey(row.asset_key);
  assertOwnerScopedStoragePath({
    ownerUserId: row.owner_user_id,
    storagePath: row.storage_path,
  });
  return {
    contractVersion: 'SagaTreeAvatarArtifactV2',
    artifactId: row.id,
    ownerUserId: row.owner_user_id,
    characterId: row.character_id,
    source: {
      origin: row.origin as AvatarV2Source,
      importAssetId: row.import_asset_id ?? undefined,
      generateJobId: row.generate_job_id ?? undefined,
      templateId: row.template_id ?? undefined,
      providerId: row.provider_id ?? undefined,
    },
    asset: {
      assetKey: row.asset_key,
      storagePath: row.storage_path,
      format: row.format as AvatarArtifactFormat,
    },
    analysisStatus: row.analysis_status as AvatarArtifactAnalysisStatus,
    materializationStatus: row.materialization_status as AvatarArtifactMaterializationStatus,
    isActive: row.is_active,
    schemaVersion: 2,
    idempotencyKey: row.idempotency_key ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function artifactToInsert(artifact: AvatarArtifactV2) {
  return {
    id: artifact.artifactId,
    owner_user_id: artifact.ownerUserId,
    character_id: artifact.characterId,
    origin: artifact.source.origin,
    asset_key: artifact.asset.assetKey,
    storage_path: artifact.asset.storagePath,
    format: artifact.asset.format,
    analysis_status: artifact.analysisStatus,
    materialization_status: artifact.materializationStatus,
    is_active: false,
    schema_version: 2,
    import_asset_id: artifact.source.importAssetId ?? null,
    generate_job_id: artifact.source.generateJobId ?? null,
    template_id: artifact.source.templateId ?? null,
    provider_id: artifact.source.providerId ?? null,
    idempotency_key: artifact.idempotencyKey ?? null,
  };
}

/**
 * Persist a newly materialized artifact (inactive). Idempotent when idempotencyKey set.
 */
export async function createAvatarArtifact(
  artifact: AvatarArtifactV2,
): Promise<AvatarArtifactV2> {
  assertHostProductSurfaceAvailable('Avatar-Artefakte');
  const ownerUserId = await getAuthenticatedUserId();
  if (artifact.ownerUserId !== ownerUserId) {
    throw new Error('Artefakt-Owner stimmt nicht mit der Session überein.');
  }
  if (artifact.isActive) {
    throw new Error('Neues Artefakt darf nicht direkt aktiv sein — activate verwenden.');
  }

  if (artifact.idempotencyKey) {
    const existing = await findAvatarArtifactByIdempotencyKey(
      ownerUserId,
      artifact.idempotencyKey,
    );
    if (existing) return existing;
  }

  const { data, error } = await supabase
    .from('character_avatar_artifacts')
    .insert(artifactToInsert(artifact))
    .select('*')
    .single();

  if (error) {
    // Unique idempotency race — re-read.
    if (artifact.idempotencyKey && /duplicate|unique/i.test(error.message)) {
      const again = await findAvatarArtifactByIdempotencyKey(
        ownerUserId,
        artifact.idempotencyKey,
      );
      if (again) return again;
    }
    throw new Error(`Avatar-Artefakt konnte nicht gespeichert werden: ${error.message}`);
  }

  return rowToArtifact(data as ArtifactRow);
}

export async function getAvatarArtifactById(
  artifactId: string,
): Promise<AvatarArtifactV2 | null> {
  assertHostProductSurfaceAvailable('Avatar-Artefakte');
  const ownerUserId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from('character_avatar_artifacts')
    .select('*')
    .eq('id', artifactId)
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(`Avatar-Artefakt lesen fehlgeschlagen: ${error.message}`);
  }
  if (!data) return null;
  return rowToArtifact(data as ArtifactRow);
}

export async function findAvatarArtifactByIdempotencyKey(
  ownerUserId: string,
  idempotencyKey: string,
): Promise<AvatarArtifactV2 | null> {
  assertHostProductSurfaceAvailable('Avatar-Artefakte');
  const { data, error } = await supabase
    .from('character_avatar_artifacts')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .eq('idempotency_key', idempotencyKey)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new Error(`Idempotency-Lookup fehlgeschlagen: ${error.message}`);
  }
  if (!data) return null;
  return rowToArtifact(data as ArtifactRow);
}

export async function listAvatarArtifacts(options: {
  characterId?: string | null;
} = {}): Promise<readonly AvatarArtifactV2[]> {
  assertHostProductSurfaceAvailable('Avatar-Artefakte');
  const ownerUserId = await getAuthenticatedUserId();
  let query = supabase
    .from('character_avatar_artifacts')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (options.characterId !== undefined) {
    query =
      options.characterId === null
        ? query.is('character_id', null)
        : query.eq('character_id', options.characterId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Avatar-Artefakte listen fehlgeschlagen: ${error.message}`);
  }
  return (data as ArtifactRow[]).map(rowToArtifact);
}

/**
 * Activate exactly one artifact per (owner, character). Failed/incomplete → no-op error.
 */
export async function activateAvatarArtifact(
  artifactId: string,
): Promise<AvatarArtifactActivateResult> {
  assertHostProductSurfaceAvailable('Avatar-Artefakte');
  const ownerUserId = await getAuthenticatedUserId();
  const current = await getAvatarArtifactById(artifactId);
  if (!current) {
    return { ok: false, reasonDe: 'Artefakt nicht gefunden oder fremder Owner.' };
  }
  const gate = assertCanActivateAvatarArtifact(current);
  if (!gate.ok) return gate;

  if (current.characterId) {
    const { error: deactivateError } = await supabase
      .from('character_avatar_artifacts')
      .update({ is_active: false })
      .eq('owner_user_id', ownerUserId)
      .eq('character_id', current.characterId)
      .eq('is_active', true)
      .is('deleted_at', null);
    if (deactivateError) {
      return {
        ok: false,
        reasonDe: `Vorheriges Artefakt konnte nicht deaktiviert werden: ${deactivateError.message}`,
      };
    }
  }

  const { data, error } = await supabase
    .from('character_avatar_artifacts')
    .update({ is_active: true })
    .eq('id', artifactId)
    .eq('owner_user_id', ownerUserId)
    .eq('materialization_status', 'materialized')
    .neq('analysis_status', 'failed')
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      reasonDe: error?.message ?? 'Aktivierung fehlgeschlagen.',
    };
  }

  return { ok: true, artifact: rowToArtifact(data as ArtifactRow) };
}

/** Map a confirmed import asset row into a persisted (inactive) V2 artifact. */
export async function materializeArtifactFromImportAsset(input: {
  importAssetId: string;
  characterId?: string | null;
  storagePath: string;
  format: 'vrm' | 'glb';
}): Promise<AvatarArtifactV2> {
  assertHostProductSurfaceAvailable('Avatar-Artefakte');
  const ownerUserId = await getAuthenticatedUserId();
  const draft = materializeAvatarArtifact(
    mapImportAssetToArtifactInput({
      importAssetId: input.importAssetId,
      ownerUserId,
      characterId: input.characterId,
      storagePath: input.storagePath,
      format: input.format,
    }),
  );
  return createAvatarArtifact(draft);
}

/** Map a succeeded generate job (storage already owner-scoped) into a V2 artifact. */
export async function materializeArtifactFromGenerateJob(input: {
  generateJobId: string;
  characterId?: string | null;
  storagePath: string;
  providerId?: string;
}): Promise<AvatarArtifactV2> {
  assertHostProductSurfaceAvailable('Avatar-Artefakte');
  const ownerUserId = await getAuthenticatedUserId();
  const draft = materializeAvatarArtifact(
    mapGenerateJobToArtifactInput({
      generateJobId: input.generateJobId,
      ownerUserId,
      characterId: input.characterId,
      storagePath: input.storagePath,
      providerId: input.providerId,
    }),
  );
  return createAvatarArtifact(draft);
}

/** Map a SagaTree template selection into a V2 artifact. */
export async function materializeArtifactFromTemplate(input: {
  artifactId: string;
  templateId: string;
  characterId?: string | null;
  storagePath: string;
}): Promise<AvatarArtifactV2> {
  assertHostProductSurfaceAvailable('Avatar-Artefakte');
  const ownerUserId = await getAuthenticatedUserId();
  const draft = materializeAvatarArtifact(
    mapTemplateToArtifactInput({
      artifactId: input.artifactId,
      ownerUserId,
      characterId: input.characterId,
      templateId: input.templateId,
      storagePath: input.storagePath,
    }),
  );
  return createAvatarArtifact(draft);
}

/**
 * Persist an authoritative AnalysisResult on an owner-scoped artifact.
 * Callers must obtain `result` from the server Analyzer (authoritative=true).
 * Browser sessions cannot escalate analysis_status via RLS/trigger.
 */
export async function persistAuthoritativeArtifactAnalysis(input: {
  artifactId: string;
  result: AvatarStructureAnalysisResultV2;
}): Promise<void> {
  assertHostProductSurfaceAvailable('Avatar-Artefakte');
  if (!input.result.authoritative) {
    throw new Error('Nur autoritative Analyse-Ergebnisse dürfen persistiert werden.');
  }
  const ownerUserId = await getAuthenticatedUserId();
  const analysisStatus =
    input.result.status === 'ready'
      ? 'ready'
      : input.result.status === 'limited'
        ? 'limited'
        : input.result.status === 'unsupported'
          ? 'unsupported'
          : 'failed';

  // Client RLS blocks trusted status writes — this path is intended for
  // Edge/service_role callers. Authenticated clients will fail closed here.
  const { error } = await supabase
    .from('character_avatar_artifacts')
    .update({
      analysis_status: analysisStatus,
      analysis_result: input.result,
    })
    .eq('id', input.artifactId)
    .eq('owner_user_id', ownerUserId)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Analyse-Persistenz fehlgeschlagen: ${error.message}`);
  }
}

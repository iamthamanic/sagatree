/**
 * character-avatar-artifact-service — Avatar V2 artifacts facade (#251 / CUT-11).
 * Location: src/infrastructure/character/avatar/character-avatar-artifact-service.ts
 *
 * Host Library HTTP + CharacterPorts only (CUT-20). Domain owns validation.
 */
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
import {
  activateHostLibraryAvatarArtifact,
  createHostLibraryAvatarArtifact,
  fetchHostLibraryAvatarArtifactById,
  fetchHostLibraryAvatarArtifacts,
  isHostLibraryEnabled,
} from '../../host/host-library-http';

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

function parseHostArtifact(raw: unknown): AvatarArtifactV2 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Ungültige Host-Avatar-Artefakt-Antwort.');
  }
  const row = raw as Record<string, unknown>;
  const source =
    row.source && typeof row.source === 'object' && !Array.isArray(row.source)
      ? (row.source as Record<string, unknown>)
      : {};
  const asset =
    row.asset && typeof row.asset === 'object' && !Array.isArray(row.asset)
      ? (row.asset as Record<string, unknown>)
      : {};
  const artifactId = typeof row.artifactId === 'string' ? row.artifactId : '';
  const ownerUserId = typeof row.ownerUserId === 'string' ? row.ownerUserId : '';
  const assetKey = typeof asset.assetKey === 'string' ? asset.assetKey : '';
  const storagePath = typeof asset.storagePath === 'string' ? asset.storagePath : '';
  const format = typeof asset.format === 'string' ? asset.format : '';
  const origin = typeof source.origin === 'string' ? source.origin : '';
  if (!artifactId || !ownerUserId || !assetKey || !storagePath || !format || !origin) {
    throw new Error('Unvollständige Host-Avatar-Artefakt-Antwort.');
  }
  assertLogicalAvatarArtifactAssetKey(assetKey);
  assertOwnerScopedStoragePath({ ownerUserId, storagePath });
  return {
    contractVersion: 'SagaTreeAvatarArtifactV2',
    artifactId,
    ownerUserId,
    characterId: typeof row.characterId === 'string' ? row.characterId : null,
    source: {
      origin: origin as AvatarV2Source,
      importAssetId: typeof source.importAssetId === 'string' ? source.importAssetId : undefined,
      generateJobId: typeof source.generateJobId === 'string' ? source.generateJobId : undefined,
      templateId: typeof source.templateId === 'string' ? source.templateId : undefined,
      providerId: typeof source.providerId === 'string' ? source.providerId : undefined,
    },
    asset: {
      assetKey,
      storagePath,
      format: format as AvatarArtifactFormat,
    },
    analysisStatus: (typeof row.analysisStatus === 'string'
      ? row.analysisStatus
      : 'pending') as AvatarArtifactAnalysisStatus,
    materializationStatus: (typeof row.materializationStatus === 'string'
      ? row.materializationStatus
      : 'draft') as AvatarArtifactMaterializationStatus,
    isActive: row.isActive === true,
    schemaVersion: 2,
    idempotencyKey:
      typeof row.idempotencyKey === 'string' ? row.idempotencyKey : undefined,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
  };
}

/**
 * Persist a newly materialized artifact (inactive). Idempotent when idempotencyKey set.
 */
export async function createAvatarArtifact(
  artifact: AvatarArtifactV2,
): Promise<AvatarArtifactV2> {
  assertHost();
  if (artifact.isActive) {
    throw new Error('Neues Artefakt darf nicht direkt aktiv sein — activate verwenden.');
  }
  return parseHostArtifact(await createHostLibraryAvatarArtifact(artifact));
}

export async function getAvatarArtifactById(
  artifactId: string,
): Promise<AvatarArtifactV2 | null> {
  assertHost();
  const raw = await fetchHostLibraryAvatarArtifactById(artifactId);
  return raw ? parseHostArtifact(raw) : null;
}

export async function findAvatarArtifactByIdempotencyKey(
  ownerUserId: string,
  idempotencyKey: string,
): Promise<AvatarArtifactV2 | null> {
  assertHost();
  const listed = await fetchHostLibraryAvatarArtifacts();
  for (const raw of listed) {
    const artifact = parseHostArtifact(raw);
    if (artifact.ownerUserId === ownerUserId && artifact.idempotencyKey === idempotencyKey) {
      return artifact;
    }
  }
  return null;
}

export async function listAvatarArtifacts(options: {
  characterId?: string | null;
} = {}): Promise<readonly AvatarArtifactV2[]> {
  assertHost();
  const listed = await fetchHostLibraryAvatarArtifacts({
    characterId: options.characterId,
  });
  return listed.map(parseHostArtifact);
}

/**
 * Activate exactly one artifact per (owner, character). Failed/incomplete → no-op error.
 */
export async function activateAvatarArtifact(
  artifactId: string,
): Promise<AvatarArtifactActivateResult> {
  assertHost();
  const result = await activateHostLibraryAvatarArtifact(artifactId);
  if (result.ok === false) {
    return { ok: false, reasonDe: result.reasonDe };
  }
  return { ok: true, artifact: parseHostArtifact(result.artifact) };
}

/** Map a confirmed import asset row into a persisted (inactive) V2 artifact. */
export async function materializeArtifactFromImportAsset(input: {
  importAssetId: string;
  characterId?: string | null;
  storagePath: string;
  format: 'vrm' | 'glb';
}): Promise<AvatarArtifactV2> {
  assertHost();
  const ownerFromPath = input.storagePath.split('/')[0] ?? '';
  if (!ownerFromPath) {
    throw new Error('Storage-Pfad muss owner-scoped sein.');
  }
  const draft = materializeAvatarArtifact(
    mapImportAssetToArtifactInput({
      importAssetId: input.importAssetId,
      ownerUserId: ownerFromPath,
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
  assertHost();
  const ownerFromPath = input.storagePath.split('/')[0] ?? '';
  const draft = materializeAvatarArtifact(
    mapGenerateJobToArtifactInput({
      generateJobId: input.generateJobId,
      ownerUserId: ownerFromPath || 'host-pending',
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
  assertHost();
  const ownerFromPath = input.storagePath.split('/')[0] ?? '';
  const draft = materializeAvatarArtifact(
    mapTemplateToArtifactInput({
      artifactId: input.artifactId,
      ownerUserId: ownerFromPath || 'host-pending',
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
 */
export async function persistAuthoritativeArtifactAnalysis(input: {
  artifactId: string;
  result: AvatarStructureAnalysisResultV2;
}): Promise<void> {
  void input;
  assertHost();
  throw new Error(
    'Autoritative Avatar-Analyse ist im Host-Modus nur serverseitig verfügbar.',
  );
}

/**
 * Avatar V2 Artifact Contract — source-neutral materialization (#251 / Epic #248).
 * Location: src/domains/character/avatar/avatar-artifact-contract-v2.ts
 *
 * Pure domain: Template / Import / Generate land on one owner-scoped AvatarArtifact.
 * Capabilities/analysis are never trusted from the client. No React / backend clients / Three.
 */

import {
  isAvatarV2Source,
  toAvatarV2Source,
  type AvatarV2Source,
} from './composition-contract-v2';
import type { AvatarSource } from './avatar-source';

export const AVATAR_ARTIFACT_CONTRACT_VERSION = 'SagaTreeAvatarArtifactV2' as const;

export const AVATAR_ARTIFACT_FORMATS = ['vrm', 'glb', 'template'] as const;
export type AvatarArtifactFormat = (typeof AVATAR_ARTIFACT_FORMATS)[number];

/** Analysis owned by Analyzer (#252 / #6) — client may only keep pending or mark failed. */
export const AVATAR_ARTIFACT_ANALYSIS_STATUSES = [
  'pending',
  'analyzing',
  'ready',
  'limited',
  'failed',
  'unsupported',
] as const;
export type AvatarArtifactAnalysisStatus =
  (typeof AVATAR_ARTIFACT_ANALYSIS_STATUSES)[number];

export const AVATAR_ARTIFACT_MATERIALIZATION_STATUSES = [
  'draft',
  'materialized',
  'failed',
  'superseded',
] as const;
export type AvatarArtifactMaterializationStatus =
  (typeof AVATAR_ARTIFACT_MATERIALIZATION_STATUSES)[number];

const ASSET_KEY_PREFIX = 'avatar-asset:';

/** Logical owner-scoped asset reference — never a free URL. */
export interface AvatarArtifactAssetRef {
  assetKey: string;
  /** Path inside private `character-avatars` bucket (`{owner}/{id}.{ext}`). */
  storagePath: string;
  format: AvatarArtifactFormat;
}

/**
 * Provenance without duplicating Import/Generate blobs.
 * Legacy rows stay readable; artifact holds FK-style ids when present.
 */
export interface AvatarArtifactSourceRef {
  origin: AvatarV2Source;
  /** Legacy wire (`meshy`) when mapping from v1 source. */
  legacySource?: AvatarSource;
  importAssetId?: string;
  generateJobId?: string;
  templateId?: string;
  /** Infrastructure adapter id (meshy, tripo, …) — never a capability proof. */
  providerId?: string;
}

export interface AvatarArtifactV2 {
  contractVersion: typeof AVATAR_ARTIFACT_CONTRACT_VERSION;
  artifactId: string;
  ownerUserId: string;
  characterId: string | null;
  source: AvatarArtifactSourceRef;
  asset: AvatarArtifactAssetRef;
  analysisStatus: AvatarArtifactAnalysisStatus;
  materializationStatus: AvatarArtifactMaterializationStatus;
  isActive: boolean;
  /** Monotonic domain schema; DB column mirrors this. */
  schemaVersion: 2;
  /** Optional client/provider retry key — unique per owner when set. */
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AvatarArtifactMaterializeInput {
  artifactId: string;
  ownerUserId: string;
  characterId?: string | null;
  origin: AvatarV2Source;
  legacySource?: AvatarSource;
  format: AvatarArtifactFormat;
  storagePath: string;
  importAssetId?: string;
  generateJobId?: string;
  templateId?: string;
  providerId?: string;
  idempotencyKey?: string;
  /** Wall-clock ISO; tests may inject. */
  nowIso?: string;
}

export type AvatarArtifactActivateResult =
  | { ok: true; artifact: AvatarArtifactV2 }
  | { ok: false; reasonDe: string };

export interface AvatarArtifactRepository {
  create(artifact: AvatarArtifactV2): Promise<AvatarArtifactV2>;
  getById(ownerUserId: string, artifactId: string): Promise<AvatarArtifactV2 | null>;
  listByOwner(ownerUserId: string, characterId?: string | null): Promise<readonly AvatarArtifactV2[]>;
  activate(ownerUserId: string, artifactId: string): Promise<AvatarArtifactActivateResult>;
  findByIdempotencyKey(
    ownerUserId: string,
    idempotencyKey: string,
  ): Promise<AvatarArtifactV2 | null>;
}

export function isAvatarArtifactFormat(value: unknown): value is AvatarArtifactFormat {
  return (
    typeof value === 'string' &&
    (AVATAR_ARTIFACT_FORMATS as readonly string[]).includes(value)
  );
}

export function isAvatarArtifactAnalysisStatus(
  value: unknown,
): value is AvatarArtifactAnalysisStatus {
  return (
    typeof value === 'string' &&
    (AVATAR_ARTIFACT_ANALYSIS_STATUSES as readonly string[]).includes(value)
  );
}

export function isAvatarArtifactMaterializationStatus(
  value: unknown,
): value is AvatarArtifactMaterializationStatus {
  return (
    typeof value === 'string' &&
    (AVATAR_ARTIFACT_MATERIALIZATION_STATUSES as readonly string[]).includes(value)
  );
}

export function buildAvatarArtifactAssetKey(input: {
  ownerUserId: string;
  artifactId: string;
}): string {
  const owner = input.ownerUserId.trim();
  const id = input.artifactId.trim();
  if (!owner || !id) throw new Error('Owner oder Artefakt-Id fehlt.');
  if (owner.includes(':') || id.includes(':') || owner.includes('/') || id.includes('/')) {
    throw new Error('Ungültige Artefakt-Id für Asset-Key.');
  }
  return `${ASSET_KEY_PREFIX}${owner}:${id}`;
}

export function assertLogicalAvatarArtifactAssetKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed.startsWith(ASSET_KEY_PREFIX) || trimmed.length <= ASSET_KEY_PREFIX.length) {
    throw new Error('Avatar-Artefakt akzeptiert nur logische avatar-asset:-Keys.');
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.includes('://')) {
    throw new Error('Freie URLs sind für Avatar-Artefakte verboten.');
  }
  return trimmed;
}

export function assertOwnerScopedStoragePath(input: {
  ownerUserId: string;
  storagePath: string;
}): string {
  const owner = input.ownerUserId.trim();
  const path = input.storagePath.trim();
  if (!owner || !path) throw new Error('Owner oder Storage-Pfad fehlt.');
  if (path.includes('://') || path.startsWith('/')) {
    throw new Error('Freie oder absolute Asset-URLs sind verboten.');
  }
  if (!path.startsWith(`${owner}/`)) {
    throw new Error('Storage-Pfad muss owner-scoped sein.');
  }
  return path;
}

/**
 * Build a materialized artifact. Always analysis=pending; never active.
 * Failed ingest must call `markAvatarArtifactMaterializationFailed` instead.
 */
export function materializeAvatarArtifact(
  input: AvatarArtifactMaterializeInput,
): AvatarArtifactV2 {
  if (!isAvatarV2Source(input.origin)) {
    throw new Error('Unbekannte Artifact-Origin.');
  }
  if (!isAvatarArtifactFormat(input.format)) {
    throw new Error('Unbekanntes Artifact-Format.');
  }
  const ownerUserId = input.ownerUserId.trim();
  const artifactId = input.artifactId.trim();
  if (!ownerUserId || !artifactId) throw new Error('Owner oder Artefakt-Id fehlt.');

  const storagePath = assertOwnerScopedStoragePath({
    ownerUserId,
    storagePath: input.storagePath,
  });
  const assetKey = buildAvatarArtifactAssetKey({ ownerUserId, artifactId });
  const now = input.nowIso ?? new Date().toISOString();

  return {
    contractVersion: AVATAR_ARTIFACT_CONTRACT_VERSION,
    artifactId,
    ownerUserId,
    characterId: input.characterId ?? null,
    source: {
      origin: input.origin,
      legacySource: input.legacySource,
      importAssetId: input.importAssetId?.trim() || undefined,
      generateJobId: input.generateJobId?.trim() || undefined,
      templateId: input.templateId?.trim() || undefined,
      providerId: input.providerId?.trim() || undefined,
    },
    asset: {
      assetKey,
      storagePath,
      format: input.format,
    },
    analysisStatus: 'pending',
    materializationStatus: 'materialized',
    isActive: false,
    schemaVersion: 2,
    idempotencyKey: input.idempotencyKey?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function markAvatarArtifactMaterializationFailed(
  draft: AvatarArtifactV2,
  nowIso?: string,
): AvatarArtifactV2 {
  return {
    ...draft,
    materializationStatus: 'failed',
    isActive: false,
    analysisStatus: 'failed',
    updatedAt: nowIso ?? new Date().toISOString(),
  };
}

export function assertCanActivateAvatarArtifact(
  artifact: AvatarArtifactV2,
): AvatarArtifactActivateResult {
  if (artifact.materializationStatus === 'failed') {
    return { ok: false, reasonDe: 'Fehlgeschlagener Ingest kann nicht aktiviert werden.' };
  }
  if (artifact.materializationStatus !== 'materialized') {
    return { ok: false, reasonDe: 'Unvollständiges Artefakt kann nicht aktiviert werden.' };
  }
  if (artifact.analysisStatus === 'failed') {
    return { ok: false, reasonDe: 'Artefakt mit fehlgeschlagener Analyse bleibt inaktiv.' };
  }
  return { ok: true, artifact };
}

/**
 * Strip client-supplied escalations. Trusted analysis upgrades stay pending.
 * Origin cannot be rewritten to a different ingress family by the browser.
 */
export function sanitizeClientAvatarArtifactMutation(
  existing: AvatarArtifactV2,
  patch: Partial<{
    analysisStatus: unknown;
    origin: unknown;
    isActive: unknown;
    materializationStatus: unknown;
    assetKey: unknown;
    storagePath: unknown;
  }>,
): AvatarArtifactV2 {
  let analysisStatus = existing.analysisStatus;
  if (patch.analysisStatus === 'failed' || patch.analysisStatus === 'pending') {
    analysisStatus = patch.analysisStatus;
  }
  // Ignore ready / limited / analyzing / unsupported from client.

  let materializationStatus = existing.materializationStatus;
  if (
    patch.materializationStatus === 'failed' ||
    patch.materializationStatus === 'superseded'
  ) {
    materializationStatus = patch.materializationStatus;
  }

  return {
    ...existing,
    analysisStatus,
    materializationStatus,
    // Client cannot flip active here — repository.activate owns that.
    isActive: existing.isActive,
    source: { ...existing.source },
    asset: { ...existing.asset },
  };
}

export function mapImportAssetToArtifactInput(input: {
  importAssetId: string;
  ownerUserId: string;
  characterId?: string | null;
  storagePath: string;
  format: 'vrm' | 'glb';
  idempotencyKey?: string;
  nowIso?: string;
}): AvatarArtifactMaterializeInput {
  return {
    artifactId: input.importAssetId,
    ownerUserId: input.ownerUserId,
    characterId: input.characterId,
    origin: 'import',
    legacySource: 'import',
    format: input.format,
    storagePath: input.storagePath,
    importAssetId: input.importAssetId,
    idempotencyKey: input.idempotencyKey ?? `import:${input.importAssetId}`,
    nowIso: input.nowIso,
  };
}

export function mapGenerateJobToArtifactInput(input: {
  generateJobId: string;
  ownerUserId: string;
  characterId?: string | null;
  storagePath: string;
  format?: 'glb';
  providerId?: string;
  idempotencyKey?: string;
  nowIso?: string;
}): AvatarArtifactMaterializeInput {
  return {
    artifactId: input.generateJobId,
    ownerUserId: input.ownerUserId,
    characterId: input.characterId,
    origin: 'generate',
    legacySource: 'meshy',
    format: input.format ?? 'glb',
    storagePath: input.storagePath,
    generateJobId: input.generateJobId,
    providerId: input.providerId ?? 'meshy',
    idempotencyKey: input.idempotencyKey ?? `generate:${input.generateJobId}`,
    nowIso: input.nowIso,
  };
}

export function mapTemplateToArtifactInput(input: {
  artifactId: string;
  ownerUserId: string;
  characterId?: string | null;
  templateId: string;
  storagePath: string;
  format?: 'template' | 'glb';
  nowIso?: string;
}): AvatarArtifactMaterializeInput {
  return {
    artifactId: input.artifactId,
    ownerUserId: input.ownerUserId,
    characterId: input.characterId,
    origin: 'sagatree',
    legacySource: 'sagatree',
    format: input.format ?? 'template',
    storagePath: input.storagePath,
    templateId: input.templateId,
    idempotencyKey: `template:${input.templateId}:${input.artifactId}`,
    nowIso: input.nowIso,
  };
}

/** Map legacy AvatarSource → V2 origin for ingress materialization. */
export function originFromLegacyAvatarSource(source: AvatarSource): AvatarV2Source {
  return toAvatarV2Source(source);
}

/**
 * In-memory repository for integration tests:
 * cross-owner denial, failed materialization, exactly-one-active, idempotent retry.
 */
export function createInMemoryAvatarArtifactRepository(
  seed: readonly AvatarArtifactV2[] = [],
): AvatarArtifactRepository {
  const byId = new Map<string, AvatarArtifactV2>();
  for (const row of seed) {
    byId.set(row.artifactId, structuredClone(row));
  }

  function ownerKey(ownerUserId: string, artifactId: string): string {
    return `${ownerUserId}::${artifactId}`;
  }

  // Index also by composite so cross-owner get misses.
  const owned = new Map<string, string>();
  for (const row of seed) {
    owned.set(ownerKey(row.ownerUserId, row.artifactId), row.artifactId);
  }

  return {
    async create(artifact) {
      if (artifact.idempotencyKey) {
        for (const existing of byId.values()) {
          if (
            existing.ownerUserId === artifact.ownerUserId &&
            existing.idempotencyKey === artifact.idempotencyKey
          ) {
            return structuredClone(existing);
          }
        }
      }
      const copy = structuredClone(artifact);
      byId.set(copy.artifactId, copy);
      owned.set(ownerKey(copy.ownerUserId, copy.artifactId), copy.artifactId);
      return structuredClone(copy);
    },

    async getById(ownerUserId, artifactId) {
      if (!owned.has(ownerKey(ownerUserId, artifactId))) return null;
      const row = byId.get(artifactId);
      return row ? structuredClone(row) : null;
    },

    async listByOwner(ownerUserId, characterId) {
      return [...byId.values()]
        .filter((row) => row.ownerUserId === ownerUserId)
        .filter((row) =>
          characterId === undefined ? true : row.characterId === (characterId ?? null),
        )
        .map((row) => structuredClone(row));
    },

    async findByIdempotencyKey(ownerUserId, idempotencyKey) {
      const key = idempotencyKey.trim();
      if (!key) return null;
      for (const row of byId.values()) {
        if (row.ownerUserId === ownerUserId && row.idempotencyKey === key) {
          return structuredClone(row);
        }
      }
      return null;
    },

    async activate(ownerUserId, artifactId) {
      const row = byId.get(artifactId);
      if (!row || row.ownerUserId !== ownerUserId) {
        return { ok: false, reasonDe: 'Artefakt nicht gefunden oder fremder Owner.' };
      }
      const gate = assertCanActivateAvatarArtifact(row);
      if (!gate.ok) return gate;

      const now = new Date().toISOString();
      for (const other of byId.values()) {
        if (
          other.ownerUserId === ownerUserId &&
          other.characterId === row.characterId &&
          other.characterId != null &&
          other.isActive &&
          other.artifactId !== artifactId
        ) {
          other.isActive = false;
          other.updatedAt = now;
        }
      }
      row.isActive = true;
      row.updatedAt = now;
      return { ok: true, artifact: structuredClone(row) };
    },
  };
}

/**
 * Character-owned Avatar V2 artifacts (CUT-11 / #1146).
 * Private — import only from character public API.
 * Location: server/src/modules/character/internal/character-avatar-artifact-store.ts
 *
 * Mirrors Postgres 036/037 semantics without RLS: owner scope + activation gates
 * enforced in this store. Authoritative analysis writes are host-only (this path).
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { CharacterSheetResult } from './character-sheet-store.ts';

export type AvatarArtifactFormat = 'vrm' | 'glb' | 'template';
export type AvatarArtifactOrigin = 'sagadrive' | 'import' | 'generate';
export type AvatarArtifactAnalysisStatus =
  | 'pending'
  | 'analyzing'
  | 'ready'
  | 'limited'
  | 'failed'
  | 'unsupported';
export type AvatarArtifactMaterializationStatus =
  | 'draft'
  | 'materialized'
  | 'failed'
  | 'superseded';

export type AvatarArtifactRecord = {
  readonly artifactId: string;
  readonly ownerUserId: string;
  readonly characterId: string | null;
  readonly origin: AvatarArtifactOrigin;
  readonly assetKey: string;
  readonly storagePath: string;
  readonly format: AvatarArtifactFormat;
  readonly analysisStatus: AvatarArtifactAnalysisStatus;
  readonly materializationStatus: AvatarArtifactMaterializationStatus;
  readonly isActive: boolean;
  readonly schemaVersion: 2;
  readonly importAssetId: string | null;
  readonly generateJobId: string | null;
  readonly templateId: string | null;
  readonly providerId: string | null;
  readonly idempotencyKey: string | null;
  readonly analysisResult: unknown | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AvatarArtifactCreateInput = {
  readonly artifactId?: string;
  readonly characterId?: string | null;
  readonly origin: AvatarArtifactOrigin;
  readonly assetKey: string;
  readonly storagePath: string;
  readonly format: AvatarArtifactFormat;
  readonly analysisStatus?: AvatarArtifactAnalysisStatus;
  readonly materializationStatus?: AvatarArtifactMaterializationStatus;
  readonly importAssetId?: string | null;
  readonly generateJobId?: string | null;
  readonly templateId?: string | null;
  readonly providerId?: string | null;
  readonly idempotencyKey?: string | null;
};

export type AvatarArtifactActivateResult =
  | { readonly ok: true; readonly artifact: AvatarArtifactRecord }
  | { readonly ok: false; readonly reasonDe: string };

type ArtifactRow = {
  id: string;
  owner_user_id: string;
  character_id: string | null;
  origin: string;
  asset_key: string;
  storage_path: string;
  format: string;
  analysis_status: string;
  materialization_status: string;
  is_active: number;
  schema_version: number;
  import_asset_id: string | null;
  generate_job_id: string | null;
  template_id: string | null;
  provider_id: string | null;
  idempotency_key: string | null;
  analysis_result: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const ORIGINS = new Set<AvatarArtifactOrigin>(['sagadrive', 'import', 'generate']);
const FORMATS = new Set<AvatarArtifactFormat>(['vrm', 'glb', 'template']);
const ANALYSIS = new Set<AvatarArtifactAnalysisStatus>([
  'pending',
  'analyzing',
  'ready',
  'limited',
  'failed',
  'unsupported',
]);
const MATERIALIZATION = new Set<AvatarArtifactMaterializationStatus>([
  'draft',
  'materialized',
  'failed',
  'superseded',
]);

function nowIso(): string {
  return new Date().toISOString();
}

function isOrigin(value: string): value is AvatarArtifactOrigin {
  return ORIGINS.has(value as AvatarArtifactOrigin);
}

function isFormat(value: string): value is AvatarArtifactFormat {
  return FORMATS.has(value as AvatarArtifactFormat);
}

function isAnalysis(value: string): value is AvatarArtifactAnalysisStatus {
  return ANALYSIS.has(value as AvatarArtifactAnalysisStatus);
}

function isMaterialization(value: string): value is AvatarArtifactMaterializationStatus {
  return MATERIALIZATION.has(value as AvatarArtifactMaterializationStatus);
}

function assertLogicalAssetKey(key: string): CharacterSheetResult<string> {
  const trimmed = key.trim();
  if (!trimmed.startsWith('avatar-asset:') || trimmed.length <= 'avatar-asset:'.length) {
    return { ok: false, error: 'invalid-asset-key' };
  }
  if (trimmed.includes('://')) return { ok: false, error: 'invalid-asset-key' };
  return { ok: true, value: trimmed };
}

function assertOwnerStoragePath(
  ownerUserId: string,
  storagePath: string,
): CharacterSheetResult<string> {
  const path = storagePath.trim();
  if (!path || path.includes('://') || path.startsWith('/')) {
    return { ok: false, error: 'invalid-storage-path' };
  }
  if (!path.startsWith(`${ownerUserId}/`)) {
    return { ok: false, error: 'invalid-storage-path' };
  }
  return { ok: true, value: path };
}

function rowToRecord(row: ArtifactRow): AvatarArtifactRecord {
  let analysisResult: unknown | null = null;
  if (row.analysis_result) {
    try {
      analysisResult = JSON.parse(row.analysis_result) as unknown;
    } catch {
      analysisResult = null;
    }
  }
  return {
    artifactId: row.id,
    ownerUserId: row.owner_user_id,
    characterId: row.character_id,
    origin: isOrigin(row.origin) ? row.origin : 'import',
    assetKey: row.asset_key,
    storagePath: row.storage_path,
    format: isFormat(row.format) ? row.format : 'glb',
    analysisStatus: isAnalysis(row.analysis_status) ? row.analysis_status : 'pending',
    materializationStatus: isMaterialization(row.materialization_status)
      ? row.materialization_status
      : 'draft',
    isActive: row.is_active === 1,
    schemaVersion: 2,
    importAssetId: row.import_asset_id,
    generateJobId: row.generate_job_id,
    templateId: row.template_id,
    providerId: row.provider_id,
    idempotencyKey: row.idempotency_key,
    analysisResult,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function canActivate(artifact: AvatarArtifactRecord): AvatarArtifactActivateResult {
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

export class CharacterAvatarArtifactStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  findByIdempotencyKey(
    ownerUserId: string,
    idempotencyKey: string,
  ): CharacterSheetResult<AvatarArtifactRecord | null> {
    const key = idempotencyKey.trim();
    if (!key) return { ok: true, value: null };
    const row = this.#db
      .prepare(
        `SELECT * FROM character_avatar_artifacts
         WHERE owner_user_id = ? AND idempotency_key = ? AND deleted_at IS NULL
         LIMIT 1`,
      )
      .get(ownerUserId, key) as ArtifactRow | undefined;
    return { ok: true, value: row ? rowToRecord(row) : null };
  }

  getOwned(
    ownerUserId: string,
    artifactId: string,
  ): CharacterSheetResult<AvatarArtifactRecord | null> {
    const id = artifactId.trim();
    if (!id) return { ok: false, error: 'invalid-artifact-id' };
    const row = this.#db
      .prepare(
        `SELECT * FROM character_avatar_artifacts
         WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
         LIMIT 1`,
      )
      .get(id, ownerUserId) as ArtifactRow | undefined;
    return { ok: true, value: row ? rowToRecord(row) : null };
  }

  listOwned(
    ownerUserId: string,
    options: { readonly characterId?: string | null } = {},
  ): CharacterSheetResult<readonly AvatarArtifactRecord[]> {
    let sql = `SELECT * FROM character_avatar_artifacts
               WHERE owner_user_id = ? AND deleted_at IS NULL`;
    const params: unknown[] = [ownerUserId];
    if (options.characterId !== undefined) {
      if (options.characterId === null) {
        sql += ` AND character_id IS NULL`;
      } else {
        sql += ` AND character_id = ?`;
        params.push(options.characterId);
      }
    }
    sql += ` ORDER BY created_at DESC`;
    const rows = this.#db.prepare(sql).all(...params) as ArtifactRow[];
    return { ok: true, value: rows.map(rowToRecord) };
  }

  createOwned(
    ownerUserId: string,
    input: AvatarArtifactCreateInput,
  ): CharacterSheetResult<AvatarArtifactRecord> {
    const pathCheck = assertOwnerStoragePath(ownerUserId, input.storagePath);
    if (!pathCheck.ok) return pathCheck;
    if (!isOrigin(input.origin)) return { ok: false, error: 'invalid-origin' };
    if (!isFormat(input.format)) return { ok: false, error: 'invalid-format' };

    const analysisStatus = input.analysisStatus ?? 'pending';
    const materializationStatus = input.materializationStatus ?? 'draft';
    if (!isAnalysis(analysisStatus)) return { ok: false, error: 'invalid-analysis-status' };
    if (!isMaterialization(materializationStatus)) {
      return { ok: false, error: 'invalid-materialization-status' };
    }
    // Client-equivalent insert policy: pending analysis; not active.
    if (analysisStatus !== 'pending') {
      return { ok: false, error: 'analysis-escalation-forbidden' };
    }

    const idempotencyKey =
      typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim()
        ? input.idempotencyKey.trim()
        : null;
    if (idempotencyKey) {
      const existing = this.findByIdempotencyKey(ownerUserId, idempotencyKey);
      if (!existing.ok) return existing;
      if (existing.value) return { ok: true, value: existing.value };
    }

    const id =
      typeof input.artifactId === 'string' && input.artifactId.trim()
        ? input.artifactId.trim()
        : randomUUID();
    // Authority: logical key is always derived from verified actor + artifact id.
    const expectedKey = `avatar-asset:${ownerUserId}:${id}`;
    if (input.assetKey.trim() && input.assetKey.trim() !== expectedKey) {
      const provided = assertLogicalAssetKey(input.assetKey);
      if (!provided.ok) return provided;
      // Reject foreign-owner keys; otherwise overwrite with actor-scoped key.
      if (!input.assetKey.trim().startsWith(`avatar-asset:${ownerUserId}:`)) {
        return { ok: false, error: 'asset-key-owner-mismatch' };
      }
    }
    const assetKey = expectedKey;

    const characterId =
      input.characterId === undefined || input.characterId === null || input.characterId === ''
        ? null
        : input.characterId.trim();
    const now = nowIso();

    try {
      this.#db
        .prepare(
          `INSERT INTO character_avatar_artifacts (
             id, owner_user_id, character_id, origin, asset_key, storage_path, format,
             analysis_status, materialization_status, is_active, schema_version,
             import_asset_id, generate_job_id, template_id, provider_id, idempotency_key,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 2, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          ownerUserId,
          characterId,
          input.origin,
          assetKey,
          pathCheck.value,
          input.format,
          analysisStatus,
          materializationStatus,
          input.importAssetId ?? null,
          input.generateJobId ?? null,
          input.templateId ?? null,
          input.providerId ?? null,
          idempotencyKey,
          now,
          now,
        );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (idempotencyKey && /UNIQUE|idempotency/i.test(message)) {
        const again = this.findByIdempotencyKey(ownerUserId, idempotencyKey);
        if (again.ok && again.value) return { ok: true, value: again.value };
      }
      if (/foreign-character-owner/i.test(message)) {
        return { ok: false, error: 'foreign-character-owner' };
      }
      return { ok: false, error: 'create-failed' };
    }

    const created = this.getOwned(ownerUserId, id);
    if (!created.ok || !created.value) return { ok: false, error: 'create-failed' };
    return { ok: true, value: created.value };
  }

  activateOwned(
    ownerUserId: string,
    artifactId: string,
  ): AvatarArtifactActivateResult {
    const current = this.getOwned(ownerUserId, artifactId);
    if (!current.ok || !current.value) {
      return { ok: false, reasonDe: 'Artefakt nicht gefunden oder fremder Owner.' };
    }
    const gate = canActivate(current.value);
    if (!gate.ok) return gate;

    const now = nowIso();
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      if (current.value.characterId) {
        this.#db
          .prepare(
            `UPDATE character_avatar_artifacts
             SET is_active = 0, updated_at = ?
             WHERE owner_user_id = ? AND character_id = ? AND is_active = 1
               AND deleted_at IS NULL`,
          )
          .run(now, ownerUserId, current.value.characterId);
      }
      const result = this.#db
        .prepare(
          `UPDATE character_avatar_artifacts
           SET is_active = 1, updated_at = ?
           WHERE id = ? AND owner_user_id = ?
             AND materialization_status = 'materialized'
             AND analysis_status <> 'failed'
             AND deleted_at IS NULL`,
        )
        .run(now, artifactId, ownerUserId);
      this.#db.exec('COMMIT');
      if (result.changes < 1) {
        return { ok: false, reasonDe: 'Aktivierung fehlgeschlagen.' };
      }
    } catch (error) {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, reasonDe: `Aktivierung fehlgeschlagen: ${message}` };
    }

    const updated = this.getOwned(ownerUserId, artifactId);
    if (!updated.ok || !updated.value) {
      return { ok: false, reasonDe: 'Aktivierung fehlgeschlagen.' };
    }
    return { ok: true, artifact: updated.value };
  }

  persistAuthoritativeAnalysis(
    ownerUserId: string,
    artifactId: string,
    result: { readonly authoritative: boolean; readonly status: string },
  ): CharacterSheetResult<{ readonly ok: true }> {
    if (!result.authoritative) {
      return { ok: false, error: 'analysis-not-authoritative' };
    }
    const analysisStatus: AvatarArtifactAnalysisStatus =
      result.status === 'ready'
        ? 'ready'
        : result.status === 'limited'
          ? 'limited'
          : result.status === 'unsupported'
            ? 'unsupported'
            : 'failed';
    const now = nowIso();
    try {
      const updated = this.#db
        .prepare(
          `UPDATE character_avatar_artifacts
           SET analysis_status = ?, analysis_result = ?, updated_at = ?
           WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL`,
        )
        .run(analysisStatus, JSON.stringify(result), now, artifactId, ownerUserId);
      if (updated.changes < 1) return { ok: false, error: 'not-found' };
    } catch {
      return { ok: false, error: 'persist-failed' };
    }
    return { ok: true, value: { ok: true } };
  }
}

/**
 * Filesystem + SQLite store for optional resumable upload sessions (MIG-501).
 * Private — import only from uploads public API.
 * Location: server/src/assets/uploads/internal/upload-session-store.ts
 */
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import {
  DEFAULT_ASSET_MAX_BYTES,
  LARGE_UPLOAD_MAX_BYTES,
} from '../../internal/local-asset-store.ts';
import { ensureDir, isSafeAssetToken, resolveUnderRoot } from '../../internal/path-safety.ts';

export type UploadSessionRow = {
  readonly id: string;
  readonly owner_user_id: string;
  readonly content_type: string;
  readonly upload_length: number;
  readonly byte_offset: number;
  readonly storage_key: string;
  readonly finalized_asset_id: string | null;
  readonly pending_asset_id: string | null;
  readonly created_at: string;
};

const CONTENT_TYPE_RE = /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]{0,126}\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]{0,126}$/;

export class UploadSessionStore {
  readonly #db: HostDatabase;
  readonly #uploadsRoot: string;

  constructor(db: HostDatabase, assetsRoot: string) {
    this.#db = db;
    const root = resolveUnderRoot(assetsRoot, ['.uploads']);
    if (!root.ok) throw new Error(`invalid uploads root: ${root.error}`);
    this.#uploadsRoot = root.path;
    ensureDir(this.#uploadsRoot);
  }

  create(input: {
    readonly ownerUserId: string;
    readonly uploadLength: number;
    readonly contentType?: string;
  }): { ok: true; value: { uploadId: string; offset: number; uploadLength: number } } | { ok: false; error: string } {
    if (!input.ownerUserId || typeof input.ownerUserId !== 'string') {
      return { ok: false, error: 'missing-actor' };
    }
    if (
      typeof input.uploadLength !== 'number' ||
      !Number.isInteger(input.uploadLength) ||
      input.uploadLength <= 0
    ) {
      return { ok: false, error: 'invalid-upload-length' };
    }
    if (input.uploadLength > LARGE_UPLOAD_MAX_BYTES) {
      return { ok: false, error: 'bytes-too-large' };
    }

    const contentType =
      typeof input.contentType === 'string' && input.contentType.trim().length > 0
        ? input.contentType.trim()
        : 'application/octet-stream';
    if (!CONTENT_TYPE_RE.test(contentType)) {
      return { ok: false, error: 'invalid-content-type' };
    }

    const uploadId = randomUUID().replace(/-/g, '');
    if (!isSafeAssetToken(uploadId)) return { ok: false, error: 'invalid-upload-id' };
    const storageKey = uploadId;
    const file = resolveUnderRoot(this.#uploadsRoot, [storageKey]);
    if (!file.ok) return { ok: false, error: file.error };

    const createdAt = new Date().toISOString();
    try {
      const fd = openSync(file.path, 'wx', 0o600);
      closeSync(fd);
      this.#db
        .prepare(
          `INSERT INTO asset_upload_sessions
           (id, owner_user_id, content_type, upload_length, byte_offset, storage_key, finalized_asset_id, pending_asset_id, created_at)
           VALUES (?, ?, ?, ?, 0, ?, NULL, NULL, ?)`,
        )
        .run(uploadId, input.ownerUserId, contentType, input.uploadLength, storageKey, createdAt);
    } catch {
      try {
        unlinkSync(file.path);
      } catch {
        /* ignore */
      }
      return { ok: false, error: 'create-failed' };
    }

    return {
      ok: true,
      value: { uploadId, offset: 0, uploadLength: input.uploadLength },
    };
  }

  get(uploadId: string): { ok: true; value: UploadSessionRow } | { ok: false; error: string } {
    if (!isSafeAssetToken(uploadId)) return { ok: false, error: 'not-found' };
    const row = this.#db
      .prepare(
        `SELECT id, owner_user_id, content_type, upload_length, byte_offset, storage_key,
                finalized_asset_id, pending_asset_id, created_at
         FROM asset_upload_sessions WHERE id = ?`,
      )
      .get(uploadId) as UploadSessionRow | undefined;
    if (!row) return { ok: false, error: 'not-found' };
    return {
      ok: true,
      value: {
        ...row,
        pending_asset_id: row.pending_asset_id ?? null,
      },
    };
  }

  /** Read staged bytes when the session is fully received but not yet finalized. */
  readAssembledBytes(uploadId: string, ownerUserId: string):
    | { ok: true; value: { bytes: Uint8Array; contentType: string; uploadLength: number; pendingAssetId: string | null } }
    | { ok: false; error: string } {
    const session = this.get(uploadId);
    if (!session.ok) return session;
    const row = session.value;
    if (row.owner_user_id !== ownerUserId) return { ok: false, error: 'not-authorized' };
    if (row.finalized_asset_id) return { ok: false, error: 'already-finalized' };
    if (row.byte_offset !== row.upload_length) return { ok: false, error: 'incomplete' };
    const file = resolveUnderRoot(this.#uploadsRoot, [row.storage_key]);
    if (!file.ok || !existsSync(file.path)) return { ok: false, error: 'not-found' };
    try {
      const assembled = readFileSync(file.path);
      if (assembled.byteLength !== row.upload_length) return { ok: false, error: 'length-mismatch' };
      return {
        ok: true,
        value: {
          bytes: new Uint8Array(assembled),
          contentType: row.content_type,
          uploadLength: row.upload_length,
          pendingAssetId: row.pending_asset_id,
        },
      };
    } catch {
      return { ok: false, error: 'read-failed' };
    }
  }

  setPendingAssetId(uploadId: string, assetId: string): { ok: true } | { ok: false; error: string } {
    if (!isSafeAssetToken(uploadId) || !isSafeAssetToken(assetId)) {
      return { ok: false, error: 'invalid-id' };
    }
    try {
      this.#db
        .prepare(
          `UPDATE asset_upload_sessions SET pending_asset_id = ?
           WHERE id = ? AND finalized_asset_id IS NULL`,
        )
        .run(assetId, uploadId);
      const row = this.get(uploadId);
      if (!row.ok || row.value.pending_asset_id !== assetId) {
        return { ok: false, error: 'pending-bind-failed' };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'pending-bind-failed' };
    }
  }

  appendChunk(input: {
    readonly uploadId: string;
    readonly ownerUserId: string;
    readonly offset: number;
    readonly bytes: Uint8Array;
  }):
    | {
        ok: true;
        value: {
          offset: number;
          uploadLength: number;
          complete: boolean;
          contentType: string;
          bytes?: Uint8Array;
        };
      }
    | { ok: false; error: string } {
    const session = this.get(input.uploadId);
    if (!session.ok) return session;
    const row = session.value;

    if (row.owner_user_id !== input.ownerUserId) {
      return { ok: false, error: 'not-authorized' };
    }
    if (row.finalized_asset_id) {
      return { ok: false, error: 'already-finalized' };
    }
    // Full payload already on disk (lost finalize response / publish crash): allow
    // empty finalize retry or re-send of the completing chunk without rewriting.
    if (row.byte_offset === row.upload_length) {
      const completingRetry =
        (input.bytes?.byteLength ?? 0) === 0 ||
        input.offset + (input.bytes?.byteLength ?? 0) === row.upload_length ||
        input.offset === row.upload_length;
      if (!completingRetry) {
        return { ok: false, error: 'offset-mismatch' };
      }
      const assembled = this.readAssembledBytes(input.uploadId, input.ownerUserId);
      if (!assembled.ok) return assembled;
      return {
        ok: true,
        value: {
          offset: row.upload_length,
          uploadLength: row.upload_length,
          complete: true,
          contentType: assembled.value.contentType,
          bytes: assembled.value.bytes,
        },
      };
    }
    if (
      typeof input.offset !== 'number' ||
      !Number.isInteger(input.offset) ||
      input.offset < 0 ||
      input.offset !== row.byte_offset
    ) {
      return { ok: false, error: 'offset-mismatch' };
    }
    if (!input.bytes || !(input.bytes instanceof Uint8Array) || input.bytes.byteLength === 0) {
      return { ok: false, error: 'invalid-bytes' };
    }

    const nextOffset = row.byte_offset + input.bytes.byteLength;
    if (nextOffset > row.upload_length) {
      return { ok: false, error: 'bytes-too-large' };
    }

    const file = resolveUnderRoot(this.#uploadsRoot, [row.storage_key]);
    if (!file.ok) return { ok: false, error: file.error };
    if (!existsSync(file.path)) return { ok: false, error: 'not-found' };

    try {
      const fd = openSync(file.path, 'r+', 0o600);
      try {
        writeSync(fd, input.bytes, 0, input.bytes.byteLength, row.byte_offset);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      this.#db
        .prepare(`UPDATE asset_upload_sessions SET byte_offset = ? WHERE id = ? AND finalized_asset_id IS NULL`)
        .run(nextOffset, row.id);
    } catch {
      return { ok: false, error: 'write-failed' };
    }

    const complete = nextOffset === row.upload_length;
    if (!complete) {
      return {
        ok: true,
        value: {
          offset: nextOffset,
          uploadLength: row.upload_length,
          complete: false,
          contentType: row.content_type,
        },
      };
    }

    let assembled: Buffer;
    try {
      assembled = readFileSync(file.path);
    } catch {
      return { ok: false, error: 'read-failed' };
    }
    if (assembled.byteLength !== row.upload_length) {
      return { ok: false, error: 'length-mismatch' };
    }

    return {
      ok: true,
      value: {
        offset: nextOffset,
        uploadLength: row.upload_length,
        complete: true,
        contentType: row.content_type,
        bytes: new Uint8Array(assembled),
      },
    };
  }

  markFinalized(uploadId: string, assetId: string): { ok: true } | { ok: false; error: string } {
    if (!isSafeAssetToken(uploadId) || !isSafeAssetToken(assetId)) {
      return { ok: false, error: 'invalid-id' };
    }
    try {
      this.#db
        .prepare(
          `UPDATE asset_upload_sessions SET finalized_asset_id = ? WHERE id = ? AND finalized_asset_id IS NULL`,
        )
        .run(assetId, uploadId);
      const row = this.get(uploadId);
      if (!row.ok || row.value.finalized_asset_id !== assetId) {
        return { ok: false, error: 'finalize-failed' };
      }
      const file = resolveUnderRoot(this.#uploadsRoot, [row.value.storage_key]);
      if (file.ok && existsSync(file.path)) {
        try {
          unlinkSync(file.path);
        } catch {
          /* ignore staging cleanup */
        }
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'finalize-failed' };
    }
  }
}

export { DEFAULT_ASSET_MAX_BYTES, LARGE_UPLOAD_MAX_BYTES };

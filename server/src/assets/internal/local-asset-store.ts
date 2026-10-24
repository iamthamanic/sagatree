/**
 * Atomic local asset byte store under dataDir/assets (MIG-500).
 * Private — import only from assets public API / composition root.
 * Location: server/src/assets/internal/local-asset-store.ts
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
  readdirSync,
} from 'node:fs';
import type { HostDatabase } from '../../persistence/open-database.ts';
import { isAbsolute } from 'node:path';
import { ensureDir, isSafeAssetToken, resolveUnderRoot } from './path-safety.ts';

export type AssetMetaRow = {
  readonly id: string;
  readonly owner_user_id: string;
  readonly content_type: string;
  readonly byte_size: number;
  readonly checksum_sha256: string;
  readonly storage_key: string;
  readonly published: number;
  readonly created_at: string;
};

/** Default single-shot publish ceiling (MIG-500). */
export const DEFAULT_ASSET_MAX_BYTES = 16 * 1024 * 1024;
/** Capability-gated resumable upload ceiling (MIG-501) — still hard-capped. */
export const LARGE_UPLOAD_MAX_BYTES = 64 * 1024 * 1024;
const CONTENT_TYPE_RE = /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]{0,126}\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]{0,126}$/;

export type PublishInput = {
  readonly bytes: Uint8Array;
  readonly contentType?: string;
  /**
   * Optional raised ceiling for capability-gated resumable finalize (MIG-501).
   * Clamped to LARGE_UPLOAD_MAX_BYTES; never expands beyond that.
   */
  readonly maxBytes?: number;
};

export type PublishedAsset = {
  readonly assetId: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly checksumSha256: string;
};

export type ReadAsset = PublishedAsset & {
  readonly bytes: Uint8Array;
};

export class LocalAssetStore {
  readonly #db: HostDatabase;
  readonly #assetsRoot: string;

  constructor(db: HostDatabase, dataDir: string) {
    this.#db = db;
    const root = resolveUnderRoot(dataDir, ['assets']);
    if (!root.ok) {
      // dataDir itself is trusted host config; create assets/ as first segment.
      throw new Error(`invalid asset root: ${root.error}`);
    }
    // resolveUnderRoot requires safe tokens; 'assets' is safe — but we need the dir
    // even when it does not exist yet. Rebuild via join semantics on dataDir.
    this.#assetsRoot = root.path;
    ensureDir(this.#assetsRoot);
    const tmp = resolveUnderRoot(this.#assetsRoot, ['.tmp']);
    if (tmp.ok) ensureDir(tmp.path);
    this.#cleanupOrphanTmp();
  }

  /** Reject incomplete publishes left as temp files after crash. */
  #cleanupOrphanTmp(): void {
    const tmp = resolveUnderRoot(this.#assetsRoot, ['.tmp']);
    if (!tmp.ok || !existsSync(tmp.path)) return;
    try {
      for (const name of readdirSync(tmp.path)) {
        if (!isSafeAssetToken(name)) continue;
        const file = resolveUnderRoot(this.#assetsRoot, ['.tmp', name]);
        if (!file.ok) continue;
        try {
          unlinkSync(file.path);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }

  publish(ownerUserId: string, input: PublishInput): { ok: true; value: PublishedAsset } | { ok: false; error: string } {
    if (!ownerUserId || typeof ownerUserId !== 'string') {
      return { ok: false, error: 'missing-actor' };
    }
    if (!input?.bytes || !(input.bytes instanceof Uint8Array)) {
      return { ok: false, error: 'invalid-bytes' };
    }
    if (input.bytes.byteLength === 0) return { ok: false, error: 'empty-bytes' };
    // When maxBytes is omitted or ≤ default, keep MIG-500 ceiling.
    const effectiveLimit =
      typeof input.maxBytes === 'number' &&
      Number.isFinite(input.maxBytes) &&
      input.maxBytes > DEFAULT_ASSET_MAX_BYTES
        ? Math.min(Math.floor(input.maxBytes), LARGE_UPLOAD_MAX_BYTES)
        : DEFAULT_ASSET_MAX_BYTES;
    if (input.bytes.byteLength > effectiveLimit) return { ok: false, error: 'bytes-too-large' };

    const contentType =
      typeof input.contentType === 'string' && input.contentType.trim().length > 0
        ? input.contentType.trim()
        : 'application/octet-stream';
    if (!CONTENT_TYPE_RE.test(contentType)) {
      return { ok: false, error: 'invalid-content-type' };
    }

    const assetId = randomUUID().replace(/-/g, '');
    if (!isSafeAssetToken(assetId)) return { ok: false, error: 'invalid-asset-id' };

    // storage_key is an opaque token under assets/ — never a caller path.
    const storageKey = assetId;

    const checksumSha256 = createHash('sha256').update(input.bytes).digest('hex');
    const createdAt = new Date().toISOString();

    const tmpName = `${assetId}${randomUUID().replace(/-/g, '')}`;
    if (!isSafeAssetToken(tmpName)) return { ok: false, error: 'invalid-tmp-name' };

    const tmpResolved = resolveUnderRoot(this.#assetsRoot, ['.tmp', tmpName]);
    if (!tmpResolved.ok) return { ok: false, error: tmpResolved.error };

    const finalResolved = resolveUnderRoot(this.#assetsRoot, [storageKey]);
    if (!finalResolved.ok) return { ok: false, error: finalResolved.error };

    // Stage bytes first — asset is not visible until metadata published=1.
    try {
      const fd = openSync(tmpResolved.path, 'wx', 0o600);
      try {
        writeSync(fd, input.bytes);
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    } catch {
      return { ok: false, error: 'write-failed' };
    }

    try {
      // Insert unpublished, rename, then mark published — crash between leaves no published row.
      this.#db
        .prepare(
          `INSERT INTO assets (id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
        )
        .run(assetId, ownerUserId, contentType, input.bytes.byteLength, checksumSha256, storageKey, createdAt);

      renameSync(tmpResolved.path, finalResolved.path);

      this.#db.prepare(`UPDATE assets SET published = 1 WHERE id = ?`).run(assetId);
    } catch {
      try {
        unlinkSync(tmpResolved.path);
      } catch {
        /* ignore */
      }
      try {
        this.#db.prepare(`DELETE FROM assets WHERE id = ? AND published = 0`).run(assetId);
      } catch {
        /* ignore */
      }
      return { ok: false, error: 'publish-failed' };
    }

    return {
      ok: true,
      value: {
        assetId,
        contentType,
        byteSize: input.bytes.byteLength,
        checksumSha256,
      },
    };
  }

  /**
   * Read published bytes for an already-authorized asset id.
   * Path is derived only from durable storage_key — never from caller paths.
   */
  readPublished(assetId: string): { ok: true; value: ReadAsset } | { ok: false; error: string } {
    if (!isSafeAssetToken(assetId)) return { ok: false, error: 'path-traversal-denied' };

    const row = this.#db
      .prepare(
        `SELECT id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published, created_at
         FROM assets WHERE id = ?`,
      )
      .get(assetId) as AssetMetaRow | undefined;

    if (!row || row.published !== 1) return { ok: false, error: 'asset-not-found' };

    // storage_key is server-assigned; still validate token form before resolve.
    const key = row.storage_key;
    if (typeof key !== 'string' || !isSafeAssetToken(key)) {
      return { ok: false, error: 'path-traversal-denied' };
    }

    const file = resolveUnderRoot(this.#assetsRoot, [key]);
    if (!file.ok) return { ok: false, error: file.error };

    let bytes: Buffer;
    try {
      bytes = readFileSync(file.path);
    } catch {
      return { ok: false, error: 'asset-not-found' };
    }

    const checksum = createHash('sha256').update(bytes).digest('hex');
    if (checksum !== row.checksum_sha256) {
      return { ok: false, error: 'checksum-mismatch' };
    }

    return {
      ok: true,
      value: {
        assetId: row.id,
        contentType: row.content_type,
        byteSize: row.byte_size,
        checksumSha256: row.checksum_sha256,
        bytes: new Uint8Array(bytes),
      },
    };
  }

  /** Test/helper: attempt resolve of a caller-supplied relative path (always deny unsafe). */
  tryResolveCallerPath(relative: string): { ok: true; path: string } | { ok: false; error: string } {
    if (typeof relative !== 'string' || relative.length === 0) {
      return { ok: false, error: 'path-traversal-denied' };
    }
    // Absolute / UNC / drive paths are never valid asset-relative inputs.
    if (isAbsolute(relative) || relative.startsWith('/') || relative.startsWith('\\')) {
      return { ok: false, error: 'path-traversal-denied' };
    }
    // Split on both separators so "../" and "..\\" are rejected as segments.
    const parts = relative.split(/[/\\]+/).filter((p) => p.length > 0);
    if (parts.length === 0) return { ok: false, error: 'path-traversal-denied' };
    return resolveUnderRoot(this.#assetsRoot, parts);
  }
}

/**
 * Optional resumable (tus-style) large uploads into MIG-500 asset publish (MIG-501 / #842).
 * Location: server/src/assets/uploads/index.ts — Zielpfad per migration contract.
 *
 * Capability-gated: when disabled, create returns `capability-disabled` while small
 * `assets.publish` continues to work. Each chunk re-checks actor ownership, offset, and limits.
 * Finalize/retry is idempotent over uploadId (#938): lost responses and publish/mark
 * crashes recover to the same single asset.
 */
import type { Actor } from '../../modules/identity/index.ts';
import type { PolicyDecision, PolicyOp, PolicyResource } from '../../modules/permissions/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import type { AssetPorts, AssetResult, PublishedAsset } from '../index.ts';
import { LARGE_UPLOAD_MAX_BYTES } from '../internal/local-asset-store.ts';
import { ensureDir, isSafeAssetToken, resolveUnderRoot } from '../internal/path-safety.ts';
import { UploadSessionStore } from './internal/upload-session-store.ts';

export type UploadCreateInput = {
  readonly uploadLength: number;
  readonly contentType?: string;
};

export type UploadPatchInput = {
  readonly uploadId: string;
  readonly offset: number;
  readonly bytes: Uint8Array;
};

export type UploadSessionInfo = {
  readonly uploadId: string;
  readonly offset: number;
  readonly uploadLength: number;
  readonly complete: boolean;
  readonly assetId?: string;
};

export type UploadPatchResult = UploadSessionInfo & {
  readonly asset?: PublishedAsset;
};

export type ResumableUploadPorts = {
  readonly moduleId: 'asset-uploads';
  readonly largeUploadsEnabled: boolean;
  readonly create: (actor: Actor, input: UploadCreateInput) => AssetResult<UploadSessionInfo>;
  readonly head: (actor: Actor, uploadId: string) => AssetResult<UploadSessionInfo>;
  readonly patch: (actor: Actor, input: UploadPatchInput) => AssetResult<UploadPatchResult>;
};

type AuthorizeFn = (op: PolicyOp, actor: Actor, resource?: PolicyResource) => PolicyDecision;

function stableAssetIdForUpload(uploadId: string): string {
  // Upload ids are already safe opaque tokens; reuse as asset id for single-asset idempotency.
  return uploadId;
}

export function createResumableUploadPorts(deps: {
  readonly dataDir: string;
  readonly db: HostDatabase;
  readonly authorize: AuthorizeFn;
  readonly assets: AssetPorts;
  /** When false, create/patch return capability-disabled (Fall 3). */
  readonly enabled: boolean;
}): ResumableUploadPorts {
  const assetsRoot = resolveUnderRoot(deps.dataDir, ['assets']);
  if (!assetsRoot.ok) {
    throw new Error(`invalid asset root for uploads: ${assetsRoot.error}`);
  }
  ensureDir(assetsRoot.path);
  const store = new UploadSessionStore(deps.db, assetsRoot.path);
  const { authorize, assets, enabled } = deps;

  const loadPublishedAsset = (
    actor: Actor,
    assetId: string,
  ): AssetResult<PublishedAsset> => {
    const got = assets.get(actor, assetId);
    if (!got.ok) return got;
    return {
      ok: true,
      value: {
        assetId: got.value.assetId,
        contentType: got.value.contentType,
        byteSize: got.value.byteSize,
        checksumSha256: got.value.checksumSha256,
      },
    };
  };

  const finalizeComplete = (
    actor: Actor,
    uploadId: string,
    payload: { bytes: Uint8Array; contentType: string; uploadLength: number },
    pendingAssetId: string | null,
  ): AssetResult<UploadPatchResult> => {
    const assetId =
      pendingAssetId && isSafeAssetToken(pendingAssetId)
        ? pendingAssetId
        : stableAssetIdForUpload(uploadId);
    if (!pendingAssetId) {
      const bound = store.setPendingAssetId(uploadId, assetId);
      if (!bound.ok) return { ok: false, error: bound.error };
    }

    const published = assets.publish(actor, {
      bytes: payload.bytes,
      contentType: payload.contentType,
      maxBytes: LARGE_UPLOAD_MAX_BYTES,
      assetId,
    });
    if (!published.ok) return published;

    const marked = store.markFinalized(uploadId, published.value.assetId);
    if (!marked.ok) {
      // Publish may have succeeded — head/patch retry recovers via pending/finalized id.
      return { ok: false, error: marked.error };
    }

    return {
      ok: true,
      value: {
        uploadId,
        offset: payload.uploadLength,
        uploadLength: payload.uploadLength,
        complete: true,
        assetId: published.value.assetId,
        asset: published.value,
      },
    };
  };

  return {
    moduleId: 'asset-uploads',
    largeUploadsEnabled: enabled,

    create(actor, input) {
      if (!actor?.actorId) return { ok: false, error: 'missing-actor' };
      if (!enabled) return { ok: false, error: 'capability-disabled' };

      const decision = authorize('asset.publish', actor, {});
      if (!decision.allow) {
        return { ok: false, error: decision.reason === 'missing-actor' ? 'missing-actor' : 'not-authorized' };
      }

      const created = store.create({
        ownerUserId: actor.actorId,
        uploadLength: input.uploadLength,
        contentType: input.contentType,
      });
      if (!created.ok) return created;
      return {
        ok: true,
        value: {
          uploadId: created.value.uploadId,
          offset: created.value.offset,
          uploadLength: created.value.uploadLength,
          complete: false,
        },
      };
    },

    head(actor, uploadId) {
      if (!actor?.actorId) return { ok: false, error: 'missing-actor' };
      if (!enabled) return { ok: false, error: 'capability-disabled' };

      const session = store.get(uploadId);
      if (!session.ok) return { ok: false, error: 'not-found' };
      if (session.value.owner_user_id !== actor.actorId) {
        return { ok: false, error: 'not-authorized' };
      }
      const finalized = session.value.finalized_asset_id;
      return {
        ok: true,
        value: {
          uploadId: session.value.id,
          offset: session.value.byte_offset,
          uploadLength: session.value.upload_length,
          complete: Boolean(finalized) || session.value.byte_offset === session.value.upload_length,
          ...(finalized ? { assetId: finalized } : {}),
        },
      };
    },

    patch(actor, input) {
      if (!actor?.actorId) return { ok: false, error: 'missing-actor' };
      if (!enabled) return { ok: false, error: 'capability-disabled' };

      const decision = authorize('asset.publish', actor, {});
      if (!decision.allow) {
        return { ok: false, error: decision.reason === 'missing-actor' ? 'missing-actor' : 'not-authorized' };
      }

      const existing = store.get(input.uploadId);
      if (!existing.ok) return { ok: false, error: 'not-found' };
      if (existing.value.owner_user_id !== actor.actorId) {
        return { ok: false, error: 'not-authorized' };
      }

      if (existing.value.finalized_asset_id) {
        const asset = loadPublishedAsset(actor, existing.value.finalized_asset_id);
        if (!asset.ok) return asset;
        return {
          ok: true,
          value: {
            uploadId: input.uploadId,
            offset: existing.value.upload_length,
            uploadLength: existing.value.upload_length,
            complete: true,
            assetId: asset.value.assetId,
            asset: asset.value,
          },
        };
      }

      // Bytes already complete — finalize without requiring a new chunk body.
      if (existing.value.byte_offset === existing.value.upload_length) {
        const assembled = store.readAssembledBytes(input.uploadId, actor.actorId);
        if (!assembled.ok) return assembled;
        return finalizeComplete(
          actor,
          input.uploadId,
          {
            bytes: assembled.value.bytes,
            contentType: assembled.value.contentType,
            uploadLength: assembled.value.uploadLength,
          },
          assembled.value.pendingAssetId,
        );
      }

      const appended = store.appendChunk({
        uploadId: input.uploadId,
        ownerUserId: actor.actorId,
        offset: input.offset,
        bytes: input.bytes,
      });
      if (!appended.ok) return appended;

      if (!appended.value.complete || !appended.value.bytes) {
        return {
          ok: true,
          value: {
            uploadId: input.uploadId,
            offset: appended.value.offset,
            uploadLength: appended.value.uploadLength,
            complete: false,
          },
        };
      }

      const pending = store.get(input.uploadId);
      const pendingAssetId = pending.ok ? pending.value.pending_asset_id : null;
      return finalizeComplete(
        actor,
        input.uploadId,
        {
          bytes: appended.value.bytes,
          contentType: appended.value.contentType,
          uploadLength: appended.value.uploadLength,
        },
        pendingAssetId,
      );
    },
  };
}

/** Stub when persistence unavailable or module not composed. */
export function createResumableUploadPortsStub(enabled = false): ResumableUploadPorts {
  const deny = (): AssetResult<never> =>
    enabled ? { ok: false, error: 'store-unavailable' } : { ok: false, error: 'capability-disabled' };
  return {
    moduleId: 'asset-uploads',
    largeUploadsEnabled: enabled,
    create: () => deny(),
    head: () => deny(),
    patch: () => deny(),
  };
}
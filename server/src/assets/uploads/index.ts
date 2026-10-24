/**
 * Optional resumable (tus-style) large uploads into MIG-500 asset publish (MIG-501 / #842).
 * Location: server/src/assets/uploads/index.ts — Zielpfad per migration contract.
 *
 * Capability-gated: when disabled, create returns `capability-disabled` while small
 * `assets.publish` continues to work. Each chunk re-checks actor ownership, offset, and limits.
 */
import type { Actor } from '../../modules/identity/index.ts';
import type { PolicyDecision, PolicyOp, PolicyResource } from '../../modules/permissions/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import type { AssetPorts, AssetResult, PublishedAsset } from '../index.ts';
import { LARGE_UPLOAD_MAX_BYTES } from '../internal/local-asset-store.ts';
import { ensureDir, resolveUnderRoot } from '../internal/path-safety.ts';
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
};

export type UploadPatchResult = UploadSessionInfo & {
  readonly complete: boolean;
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
      return {
        ok: true,
        value: {
          uploadId: session.value.id,
          offset: session.value.byte_offset,
          uploadLength: session.value.upload_length,
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

      const published = assets.publish(actor, {
        bytes: appended.value.bytes,
        contentType: appended.value.contentType,
        maxBytes: LARGE_UPLOAD_MAX_BYTES,
      });
      if (!published.ok) return published;

      const marked = store.markFinalized(input.uploadId, published.value.assetId);
      if (!marked.ok) return { ok: false, error: marked.error };

      return {
        ok: true,
        value: {
          uploadId: input.uploadId,
          offset: appended.value.offset,
          uploadLength: appended.value.uploadLength,
          complete: true,
          asset: published.value,
        },
      };
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

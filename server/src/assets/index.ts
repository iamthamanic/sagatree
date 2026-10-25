/**
 * Local protected asset service public API (MIG-500 / #841).
 * Location: server/src/assets/index.ts — Zielpfad per migration contract.
 *
 * Bytes live under dataDir/assets/; metadata in SQLite `assets` (media module).
 * Authorization goes through permissions.authorize — path/URL is never proof.
 */
import type { Actor } from '../modules/identity/index.ts';
import type { PolicyDecision, PolicyOp, PolicyResource } from '../modules/permissions/index.ts';
import type { HostDatabase } from '../persistence/open-database.ts';
import {
  DEFAULT_ASSET_MAX_BYTES,
  LARGE_UPLOAD_MAX_BYTES,
  LocalAssetStore,
  type PublishInput,
  type PublishedAsset,
  type ReadAsset,
} from './internal/local-asset-store.ts';

export type { PublishInput, PublishedAsset, ReadAsset };
export { DEFAULT_ASSET_MAX_BYTES, LARGE_UPLOAD_MAX_BYTES };

export type AssetResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

export type AssetPorts = {
  readonly moduleId: 'assets';
  /** Direct publish — always DEFAULT_ASSET_MAX_BYTES; ignores any caller maxBytes. */
  readonly publish: (actor: Actor, input: PublishInput) => AssetResult<PublishedAsset>;
  /**
   * Capability-gated resumable finalize only (#939). Raises ceiling to LARGE_UPLOAD_MAX_BYTES.
   * Not for general callers — uploads module after owner/capability checks.
   */
  readonly publishResumableFinalize: (actor: Actor, input: PublishInput) => AssetResult<PublishedAsset>;
  readonly get: (actor: Actor, assetId: string) => AssetResult<ReadAsset>;
  /** Negative-path helper for self-tests — rejects traversal before any IO. */
  readonly tryResolveCallerPath: (relative: string) => AssetResult<{ path: string }>;
};

type AuthorizeFn = (op: PolicyOp, actor: Actor, resource?: PolicyResource) => PolicyDecision;

export function createAssetPorts(deps: {
  readonly dataDir: string;
  readonly db: HostDatabase;
  readonly authorize: AuthorizeFn;
  /**
   * When false (default), `publishResumableFinalize` returns `capability-disabled`.
   * Only the host composition that enables `SAGATREE_LARGE_UPLOADS` may set true (#939 P1).
   */
  readonly allowElevatedPublish?: boolean;
}): AssetPorts {
  const store = new LocalAssetStore(deps.db, deps.dataDir);
  const { authorize } = deps;
  const allowElevatedPublish = deps.allowElevatedPublish === true;

  return {
    moduleId: 'assets',

    publish(actor: Actor, input: PublishInput): AssetResult<PublishedAsset> {
      if (!actor?.actorId) return { ok: false, error: 'missing-actor' };
      const decision = authorize('asset.publish', actor, {});
      if (!decision.allow) {
        return { ok: false, error: decision.reason === 'missing-actor' ? 'missing-actor' : 'not-authorized' };
      }
      // Strip sneaky maxBytes / unknown fields — public path never raises ceiling (#939).
      const safe: PublishInput = {
        bytes: input.bytes,
        contentType: input.contentType,
        assetId: input.assetId,
      };
      const result = store.publish(actor.actorId, safe, DEFAULT_ASSET_MAX_BYTES);
      if (!result.ok) return result;
      return { ok: true, value: result.value };
    },

    publishResumableFinalize(actor: Actor, input: PublishInput): AssetResult<PublishedAsset> {
      if (!allowElevatedPublish) return { ok: false, error: 'capability-disabled' };
      if (!actor?.actorId) return { ok: false, error: 'missing-actor' };
      const decision = authorize('asset.publish', actor, {});
      if (!decision.allow) {
        return { ok: false, error: decision.reason === 'missing-actor' ? 'missing-actor' : 'not-authorized' };
      }
      const safe: PublishInput = {
        bytes: input.bytes,
        contentType: input.contentType,
        assetId: input.assetId,
      };
      const result = store.publish(actor.actorId, safe, LARGE_UPLOAD_MAX_BYTES);
      if (!result.ok) return result;
      return { ok: true, value: result.value };
    },

    get(actor: Actor, assetId: string): AssetResult<ReadAsset> {
      if (!actor?.actorId) return { ok: false, error: 'missing-actor' };
      const id = typeof assetId === 'string' ? assetId.trim() : '';
      if (!id) return { ok: false, error: 'missing-asset' };

      // Traversal-shaped ids never reach disk / policy row lookup as paths.
      const decision = authorize('asset.read', actor, { assetId: id });
      if (!decision.allow) {
        if (decision.reason === 'missing-asset' || decision.reason === 'asset-not-found') {
          return { ok: false, error: decision.reason === 'missing-asset' ? 'missing-asset' : 'not-authorized' };
        }
        return { ok: false, error: 'not-authorized' };
      }

      const result = store.readPublished(id);
      if (!result.ok) {
        return { ok: false, error: result.error === 'path-traversal-denied' ? 'path-traversal-denied' : 'not-authorized' };
      }
      return { ok: true, value: result.value };
    },

    tryResolveCallerPath(relative: string): AssetResult<{ path: string }> {
      const resolved = store.tryResolveCallerPath(relative);
      if (!resolved.ok) return { ok: false, error: resolved.error };
      return { ok: true, value: { path: resolved.path } };
    },
  };
}

/** Stub when persistence is unavailable. */
export function createAssetPortsStub(): AssetPorts {
  return {
    moduleId: 'assets',
    publish: () => ({ ok: false, error: 'store-unavailable' }),
    publishResumableFinalize: () => ({ ok: false, error: 'store-unavailable' }),
    get: () => ({ ok: false, error: 'store-unavailable' }),
    tryResolveCallerPath: () => ({ ok: false, error: 'store-unavailable' }),
  };
}

/**
 * user-profile module public API — table user_profiles + user-avatars storage (MIG-312 / #811).
 * Location: server/src/modules/user-profile/index.ts
 *
 * 0 RPCs. HTTP publicActivation remains false (cutover → MIG-600).
 * Peer-readable batch select mirrors lobby RLS; writes are own-actor only.
 */
import { randomUUID } from 'node:crypto';
import type { Actor } from '../identity/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import {
  USER_AVATAR_MAX_BYTES,
  USER_AVATAR_MIME_EXTENSIONS,
  USER_AVATAR_SIGNED_SECONDS,
  sniffUserAvatarMime,
  type UserAvatarMime,
} from './internal/user-avatar-mime.ts';
import { createUserAvatarStore } from './internal/user-avatar-store.ts';
import { createUserProfileStore, type UserProfileRow } from './internal/user-profile-store.ts';

/** Host user-profile ports are transport-free until MIG-600. */
export const USER_PROFILE_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export {
  USER_AVATAR_MAX_BYTES,
  USER_AVATAR_MIME_EXTENSIONS,
  USER_AVATAR_SIGNED_SECONDS,
  assertOwnerScopedAvatarPath,
  sniffUserAvatarMime,
  type UserAvatarMime,
} from './internal/user-avatar-mime.ts';

export type UserProfileVm = {
  readonly id: string;
  readonly displayName: string | null;
  readonly avatarPath: string | null;
  readonly avatarUrl: string | null;
  readonly updatedAt: string | null;
};

export type UserProfileResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly code?: string };

export type UploadUserAvatarInput = {
  readonly bytes: Uint8Array;
  /** Declared MIME; must match sniffed magic when provided. */
  readonly contentType?: string;
  /**
   * Never trusted as authority. When present and ≠ actor.actorId → DENY
   * (client cannot claim foreign owner for write).
   */
  readonly claimedOwnerUserId?: string;
};

export type UserProfilePorts = {
  readonly moduleId: 'user-profile';
  readonly ensureOwnProfileRow: (actor: Actor) => UserProfileResult<void>;
  readonly getOwnProfile: (actor: Actor) => UserProfileResult<UserProfileVm | null>;
  readonly getProfilesByUserIds: (
    actor: Actor,
    userIds: readonly string[],
  ) => UserProfileResult<readonly UserProfileVm[]>;
  readonly uploadAvatar: (
    actor: Actor,
    input: UploadUserAvatarInput,
  ) => UserProfileResult<UserProfileVm>;
};

function requireActor(actor: Actor | null | undefined): actor is Actor {
  return Boolean(actor?.actorId);
}

function formatError(message: string, code?: string): string {
  const parts = [message, code ? `[${code}]` : null]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(' ') : 'unbekannter Fehler';
}

function mapRow(row: UserProfileRow, avatarUrl: string | null): UserProfileVm {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    avatarUrl,
    updatedAt: row.updated_at,
  };
}

function defaultSignAvatarUrl(path: string | null): string | null {
  if (!path) return null;
  return `sagatree-user-avatar://${encodeURIComponent(path)}?ttl=${USER_AVATAR_SIGNED_SECONDS}`;
}

export function createUserProfilePorts(deps: {
  readonly db: HostDatabase;
  readonly dataDir: string;
  /**
   * Optional signer; return null to simulate signing failure (batch avatarUrl null).
   * Defaults to opaque local signed URL (not HTTP public).
   */
  readonly signAvatarUrl?: (path: string | null) => string | null;
  /**
   * Test-only: when current===true, next avatar_path update fails after object write
   * (proves orphan cleanup + prior row retention).
   */
  readonly failNextAvatarPathUpdate?: { current: boolean };
}): UserProfilePorts {
  const store = createUserProfileStore(deps.db);
  const avatars = createUserAvatarStore(deps.dataDir);
  const sign = deps.signAvatarUrl ?? defaultSignAvatarUrl;

  return {
    moduleId: 'user-profile',

    ensureOwnProfileRow(actor) {
      if (!requireActor(actor)) {
        return { ok: false, error: 'missing-actor', code: '42501' };
      }
      const ensured = store.ensureOwn(actor.actorId);
      if (!ensured.ok) {
        return {
          ok: false,
          error: `Profil konnte nicht angelegt werden: ${formatError(ensured.error, ensured.code)}`,
          code: ensured.code,
        };
      }
      return { ok: true, value: undefined };
    },

    getOwnProfile(actor) {
      if (!requireActor(actor)) {
        return { ok: false, error: 'missing-actor', code: '42501' };
      }
      const ensured = store.ensureOwn(actor.actorId);
      if (!ensured.ok) {
        return {
          ok: false,
          error: `Profil konnte nicht geladen werden: ${formatError(ensured.error, ensured.code)}`,
          code: ensured.code,
        };
      }
      const row = store.getById(actor.actorId);
      if (!row) return { ok: true, value: null };
      return { ok: true, value: mapRow(row, sign(row.avatar_path)) };
    },

    getProfilesByUserIds(actor, userIds) {
      if (!requireActor(actor)) {
        return { ok: false, error: 'missing-actor', code: '42501' };
      }
      const ids = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
      if (ids.length === 0) return { ok: true, value: [] };
      try {
        const rows = store.listByIds(ids);
        const mapped = rows.map((row) => mapRow(row, sign(row.avatar_path)));
        return { ok: true, value: mapped };
      } catch (err) {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: unknown }).message ?? 'unknown')
            : 'unknown';
        return {
          ok: false,
          error: `Profile konnten nicht geladen werden: ${formatError(message)}`,
        };
      }
    },

    uploadAvatar(actor, input) {
      if (!requireActor(actor)) {
        return { ok: false, error: 'missing-actor', code: '42501' };
      }
      if (
        typeof input.claimedOwnerUserId === 'string' &&
        input.claimedOwnerUserId.length > 0 &&
        input.claimedOwnerUserId !== actor.actorId
      ) {
        return { ok: false, error: 'not-authorized', code: '42501' };
      }

      const ensured = store.ensureOwn(actor.actorId);
      if (!ensured.ok) {
        return {
          ok: false,
          error: `Profil konnte nicht geladen werden: ${formatError(ensured.error, ensured.code)}`,
          code: ensured.code,
        };
      }

      const sniffed = sniffUserAvatarMime(input.bytes);
      if (!sniffed) {
        return {
          ok: false,
          error: 'Ungültiger Dateityp. Nur PNG, JPEG und WEBP sind erlaubt.',
        };
      }
      if (input.contentType && input.contentType !== sniffed) {
        return {
          ok: false,
          error: 'Deklarierter Bildtyp stimmt nicht mit dem Dateiinhalt überein.',
        };
      }
      if (input.bytes.byteLength > USER_AVATAR_MAX_BYTES) {
        return { ok: false, error: 'Datei zu groß. Maximum ist 5MB.' };
      }

      const extension = USER_AVATAR_MIME_EXTENSIONS[sniffed as UserAvatarMime];
      const filePath = `${actor.actorId}/${randomUUID()}.${extension}`;
      const written = avatars.writeOwnerObject(actor.actorId, filePath, input.bytes);
      if (!written.ok) {
        return {
          ok: false,
          error: `Avatar-Upload fehlgeschlagen: ${written.error}`,
        };
      }

      const previous = store.getById(actor.actorId);
      const previousPath = previous?.avatar_path ?? null;

      if (deps.failNextAvatarPathUpdate?.current === true) {
        deps.failNextAvatarPathUpdate.current = false;
        avatars.removeBestEffort(filePath);
        return {
          ok: false,
          error: 'Avatar konnte nicht gespeichert werden: simulated-update-failure [TEST]',
          code: 'TEST',
        };
      }

      const updated = store.updateAvatarPath(actor.actorId, filePath);
      if (!updated.ok) {
        // Best-effort cleanup of orphan object; keep prior avatar_path on row.
        avatars.removeBestEffort(filePath);
        return {
          ok: false,
          error: `Avatar konnte nicht gespeichert werden: ${formatError(updated.error, updated.code)}`,
          code: updated.code,
        };
      }

      if (previousPath && previousPath !== filePath) {
        // Asynchronous / fire-and-forget parity with FE void remove.
        void Promise.resolve().then(() => avatars.removeBestEffort(previousPath));
      }

      return { ok: true, value: mapRow(updated.row, sign(updated.row.avatar_path)) };
    },
  };
}

export function createUserProfilePortsStub(): UserProfilePorts {
  const unavailable = { ok: false as const, error: 'store-unavailable' };
  return {
    moduleId: 'user-profile',
    ensureOwnProfileRow: () => unavailable,
    getOwnProfile: () => unavailable,
    getProfilesByUserIds: () => unavailable,
    uploadAvatar: () => unavailable,
  };
}

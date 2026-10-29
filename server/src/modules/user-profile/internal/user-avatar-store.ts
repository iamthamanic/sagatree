/**
 * Local user-avatars object store under dataDir (MIG-312 / #811).
 * Location: server/src/modules/user-profile/internal/user-avatar-store.ts
 *
 * Bucket parity with Supabase `user-avatars`. Path prefix is owner-scoped;
 * object deletion is best-effort and separate from profile row updates.
 */
import { mkdirSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { assertOwnerScopedAvatarPath } from './user-avatar-mime.ts';

function resolveUnderAvatarsRoot(
  avatarsRoot: string,
  relativePath: string,
): { ok: true; absolute: string } | { ok: false; error: string } {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) {
    return { ok: false, error: 'path-traversal-denied' };
  }
  const absolute = join(avatarsRoot, ...normalized.split('/'));
  if (!absolute.startsWith(avatarsRoot)) {
    return { ok: false, error: 'path-traversal-denied' };
  }
  return { ok: true, absolute };
}

export function createUserAvatarStore(dataDir: string) {
  const avatarsRoot = join(dataDir, 'user-avatars');
  mkdirSync(avatarsRoot, { recursive: true });

  return {
    root: avatarsRoot,

    writeOwnerObject(
      ownerUserId: string,
      relativePath: string,
      bytes: Uint8Array,
    ): { ok: true } | { ok: false; error: string } {
      try {
        assertOwnerScopedAvatarPath(relativePath, ownerUserId);
      } catch {
        return { ok: false, error: 'not-authorized' };
      }
      const resolved = resolveUnderAvatarsRoot(avatarsRoot, relativePath);
      if (!resolved.ok) return resolved;
      mkdirSync(dirname(resolved.absolute), { recursive: true });
      writeFileSync(resolved.absolute, bytes);
      return { ok: true };
    },

    /**
     * Best-effort remove — failures are swallowed (legacy defect parity).
     */
    removeBestEffort(relativePath: string): void {
      try {
        const resolved = resolveUnderAvatarsRoot(avatarsRoot, relativePath);
        if (!resolved.ok) return;
        if (existsSync(resolved.absolute)) {
          unlinkSync(resolved.absolute);
        }
      } catch {
        /* best-effort */
      }
    },

    exists(relativePath: string): boolean {
      const resolved = resolveUnderAvatarsRoot(avatarsRoot, relativePath);
      if (!resolved.ok) return false;
      return existsSync(resolved.absolute);
    },
  };
}

export type UserAvatarStore = ReturnType<typeof createUserAvatarStore>;

/**
 * Owner-scoped look-reference media bytes under dataDir/media (CUT-15 / #1150).
 * Location: server/src/modules/look/internal/look-reference-media-store.ts
 *
 * Mirrors Edge bucket layout `{ownerUserId}/…` on the host filesystem.
 * Never trusts absolute/UNC paths or `..` segments.
 */
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import {
  LOOK_REF_ANALYSIS_MAX_BYTES,
  assertOwnerScopedStoragePath,
} from './look-reference-image.ts';

function ensureTrailingSep(dir: string): string {
  return dir.endsWith(sep) ? dir : `${dir}${sep}`;
}

/**
 * Safe relative segments for media filenames (letters/digits/_-/. only; no empty/..).
 */
function isSafeMediaSegment(segment: string): boolean {
  if (!segment || segment === '.' || segment === '..') return false;
  if (segment.includes('/') || segment.includes('\\') || segment.includes('\0')) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(segment);
}

function resolveUnderMediaRoot(
  mediaRoot: string,
  segments: readonly string[],
): { ok: true; path: string } | { ok: false; error: string } {
  if (!mediaRoot || typeof mediaRoot !== 'string') return { ok: false, error: 'invalid-root' };
  if (!Array.isArray(segments) || segments.length === 0) {
    return { ok: false, error: 'invalid-path' };
  }
  for (const segment of segments) {
    if (!isSafeMediaSegment(segment) || isAbsolute(segment)) {
      return { ok: false, error: 'path-traversal-denied' };
    }
  }
  const rootResolved = resolve(mediaRoot);
  const candidate = resolve(join(rootResolved, ...segments));
  const rootPrefix = ensureTrailingSep(rootResolved);
  if (candidate !== rootResolved && !candidate.startsWith(rootPrefix)) {
    return { ok: false, error: 'path-traversal-denied' };
  }
  if (existsSync(candidate)) {
    try {
      const st = lstatSync(candidate);
      if (st.isSymbolicLink()) {
        const real = realpathSync(candidate);
        if (real !== rootResolved && !real.startsWith(rootPrefix)) {
          return { ok: false, error: 'path-traversal-denied' };
        }
      }
    } catch {
      return { ok: false, error: 'path-traversal-denied' };
    }
  }
  return { ok: true, path: candidate };
}

export function createLookReferenceMediaStore(dataDir: string): {
  readonly fetchOwnerBytes: (
    storagePath: string,
    ownerUserId: string,
  ) => Promise<Uint8Array>;
} {
  const mediaRoot = join(resolve(dataDir), 'media');
  return {
    async fetchOwnerBytes(storagePath, ownerUserId) {
      const scoped = assertOwnerScopedStoragePath(storagePath, ownerUserId);
      const segments = scoped.split('/').filter((p) => p.length > 0);
      const resolved = resolveUnderMediaRoot(mediaRoot, segments);
      if (!resolved.ok) throw new Error(resolved.error);
      if (!existsSync(resolved.path)) throw new Error('Stored image not found');
      const bytes = new Uint8Array(readFileSync(resolved.path));
      if (bytes.byteLength === 0 || bytes.byteLength > LOOK_REF_ANALYSIS_MAX_BYTES) {
        throw new Error('Stored image exceeds size limit');
      }
      return bytes;
    },
  };
}

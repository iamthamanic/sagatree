/**
 * Resolve paths strictly under an asset root — no traversal / symlink escape.
 * Location: server/src/assets/internal/path-safety.ts
 */
import { existsSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';

/** Asset ids and storage keys: opaque tokens only (never path segments from callers). */
export const SAFE_ASSET_TOKEN_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export function isSafeAssetToken(value: string): boolean {
  return typeof value === 'string' && SAFE_ASSET_TOKEN_RE.test(value);
}

function ensureTrailingSep(dir: string): string {
  return dir.endsWith(sep) ? dir : `${dir}${sep}`;
}

/**
 * Resolve `segments` under `rootDir`. Rejects absolute segments, `..`, empty
 * parts, and (when the target exists) symlink escapes outside the root.
 */
export function resolveUnderRoot(
  rootDir: string,
  segments: readonly string[],
): { ok: true; path: string } | { ok: false; error: string } {
  if (!rootDir || typeof rootDir !== 'string') {
    return { ok: false, error: 'invalid-root' };
  }
  if (!Array.isArray(segments) || segments.length === 0) {
    return { ok: false, error: 'invalid-path' };
  }

  for (const segment of segments) {
    if (typeof segment !== 'string' || segment.length === 0) {
      return { ok: false, error: 'path-traversal-denied' };
    }
    if (isAbsolute(segment) || segment.includes('\0')) {
      return { ok: false, error: 'path-traversal-denied' };
    }
    if (segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\')) {
      return { ok: false, error: 'path-traversal-denied' };
    }
    if (!isSafeAssetToken(segment) && segment !== '.tmp') {
      // Allow only `.tmp` as a reserved staging directory name under the root.
      return { ok: false, error: 'path-traversal-denied' };
    }
  }

  const rootResolved = resolve(rootDir);
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

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

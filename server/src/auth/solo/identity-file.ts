/**
 * Durable solo/loopback host identity file (MIG-015).
 * Location: server/src/auth/solo/identity-file.ts
 *
 * One actorId per dataDir across restarts. Never echoes file contents in errors.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const HOST_IDENTITY_FILENAME = 'host-identity.json';

export type SoloIdentityLoadResult =
  | { ok: true; actorId: string }
  | { ok: false; error: string };

/** True when an id was minted by this host's solo identity path. */
export function isSoloActorId(actorId: string): boolean {
  return typeof actorId === 'string' && actorId.startsWith('solo-') && actorId.length > 5;
}

export function hostIdentityPath(dataDir: string): string {
  return join(dataDir, HOST_IDENTITY_FILENAME);
}

/**
 * Load or create solo identity. Fail closed on corrupt files — never invent a
 * new owner when a file exists but is unreadable.
 */
export function ensureSoloIdentityFile(dataDir: string): SoloIdentityLoadResult {
  const path = hostIdentityPath(dataDir);
  try {
    if (existsSync(path)) {
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(path, 'utf8'));
      } catch {
        return { ok: false, error: 'Host identity file is unreadable or invalid' };
      }
      const actorId =
        raw &&
        typeof raw === 'object' &&
        'actorId' in raw &&
        typeof (raw as { actorId: unknown }).actorId === 'string'
          ? (raw as { actorId: string }).actorId.trim()
          : '';
      if (isSoloActorId(actorId)) return { ok: true, actorId };
      return { ok: false, error: 'Host identity file is unreadable or invalid' };
    }
    const actorId = `solo-${randomUUID()}`;
    writeFileSync(path, `${JSON.stringify({ actorId }, null, 2)}\n`, 'utf8');
    return { ok: true, actorId };
  } catch {
    return { ok: false, error: 'Host identity file is unreadable or invalid' };
  }
}

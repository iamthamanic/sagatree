/**
 * Explicit solo → remote account linking (MIG-015 Fall 3).
 * Location: server/src/auth/solo/account-link.ts
 *
 * Mode switch never silently maps solo ownership onto a remote session.
 * Missing link → caller surfaces ACCOUNT_LINK_REQUIRED via policy.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSoloActorId } from './identity-file.ts';

export const SOLO_ACCOUNT_LINKS_FILENAME = 'solo-account-links.json';

export type SoloAccountLink = {
  readonly soloActorId: string;
  readonly remoteAccountId: string;
  readonly linkedAt: string;
};

type LinkFile = {
  readonly version: 1;
  readonly links: readonly SoloAccountLink[];
};

export type LinkSoloAccountResult =
  | { ok: true; link: SoloAccountLink }
  | {
      ok: false;
      code:
        | 'ACCOUNT_LINK_MISMATCH'
        | 'ACCOUNT_LINK_TAKEN'
        | 'INVALID_LINK_REQUEST'
        | 'LINK_STORE_UNREADABLE';
    };

export function soloAccountLinksPath(dataDir: string): string {
  return join(dataDir, SOLO_ACCOUNT_LINKS_FILENAME);
}

function emptyFile(): LinkFile {
  return { version: 1, links: [] };
}

function readLinkFile(dataDir: string): LinkFile | { error: 'LINK_STORE_UNREADABLE' } {
  const path = soloAccountLinksPath(dataDir);
  if (!existsSync(path)) return emptyFile();
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { error: 'LINK_STORE_UNREADABLE' };
    }
    const record = raw as { version?: unknown; links?: unknown };
    if (record.version !== 1 || !Array.isArray(record.links)) {
      return { error: 'LINK_STORE_UNREADABLE' };
    }
    const links: SoloAccountLink[] = [];
    for (const entry of record.links) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const row = entry as Record<string, unknown>;
      const soloActorId = typeof row.soloActorId === 'string' ? row.soloActorId.trim() : '';
      const remoteAccountId =
        typeof row.remoteAccountId === 'string' ? row.remoteAccountId.trim() : '';
      const linkedAt = typeof row.linkedAt === 'string' ? row.linkedAt : '';
      if (!soloActorId || !remoteAccountId || !linkedAt) continue;
      links.push({ soloActorId, remoteAccountId, linkedAt });
    }
    return { version: 1, links };
  } catch {
    return { error: 'LINK_STORE_UNREADABLE' };
  }
}

function writeLinkFile(dataDir: string, file: LinkFile): void {
  writeFileSync(soloAccountLinksPath(dataDir), `${JSON.stringify(file, null, 2)}\n`, 'utf8');
}

/** Solo actor ids already linked to this remote Better Auth user. */
export function loadLinkedSoloActorIds(dataDir: string, remoteAccountId: string): readonly string[] {
  const file = readLinkFile(dataDir);
  if ('error' in file) return [];
  const id = remoteAccountId.trim();
  if (!id) return [];
  return file.links.filter((link) => link.remoteAccountId === id).map((link) => link.soloActorId);
}

/**
 * Record an explicit solo→remote link. `expectedHostSoloActorId` must equal this
 * host's persisted solo identity — foreign/forged solo ids are rejected.
 */
export function linkSoloAccount(input: {
  readonly dataDir: string;
  readonly expectedHostSoloActorId: string;
  readonly claimedSoloActorId: string;
  readonly remoteAccountId: string;
  readonly confirm: boolean;
}): LinkSoloAccountResult {
  if (!input.confirm) {
    return { ok: false, code: 'INVALID_LINK_REQUEST' };
  }
  const claimed = input.claimedSoloActorId.trim();
  const remote = input.remoteAccountId.trim();
  const expected = input.expectedHostSoloActorId.trim();
  if (!claimed || !remote || !expected || !isSoloActorId(claimed)) {
    return { ok: false, code: 'INVALID_LINK_REQUEST' };
  }
  if (claimed !== expected) {
    return { ok: false, code: 'ACCOUNT_LINK_MISMATCH' };
  }

  const file = readLinkFile(input.dataDir);
  if ('error' in file) {
    return { ok: false, code: 'LINK_STORE_UNREADABLE' };
  }

  const existingExact = file.links.find(
    (link) => link.soloActorId === claimed && link.remoteAccountId === remote,
  );
  if (existingExact) {
    return { ok: true, link: existingExact };
  }

  // One remote account per host solo id — no shared-secret multi-linker elevation.
  const takenByOther = file.links.find(
    (link) => link.soloActorId === claimed && link.remoteAccountId !== remote,
  );
  if (takenByOther) {
    return { ok: false, code: 'ACCOUNT_LINK_TAKEN' };
  }

  const link: SoloAccountLink = {
    soloActorId: claimed,
    remoteAccountId: remote,
    linkedAt: new Date().toISOString(),
  };
  writeLinkFile(input.dataDir, { version: 1, links: [...file.links, link] });
  return { ok: true, link };
}

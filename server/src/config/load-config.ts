/**
 * Host configuration loader — loopback-first, cookie-auth fail-closed for remote.
 * Location: server/src/config/load-config.ts
 */
import { accessSync, constants, mkdirSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { assertCookieAuthSecret } from '../auth/cookie-profile.ts';
import { normalizeOrigin, normalizeTrustedOrigins } from '../auth/origin.ts';
import {
  assertSoloLoopbackBind,
  isLoopbackHost,
  SOLO_REQUIRES_LOOPBACK,
} from '../auth/solo/index.ts';

export type HostAuthConfig = {
  readonly secret: string;
  readonly baseURL: string;
  /** Canonical URL.origin strings (no trailing slash). */
  readonly trustedOrigins: readonly string[];
  readonly cookieSecure: boolean;
};

export type HostConfig = {
  readonly host: string;
  readonly port: number;
  readonly dataDir: string;
  readonly mode: 'solo' | 'remote';
  /** Null only in solo mode without Better Auth enabled. */
  readonly auth: HostAuthConfig | null;
};

export type ConfigError = {
  readonly code: 'INVALID_CONFIG' | 'DATA_DIR_NOT_WRITABLE' | 'AUTH_MISCONFIG';
  readonly message: string;
};

function redacted(message: string): string {
  return message.replace(/(?:token|key|secret|password)=[^\s]+/gi, '$1=[redacted]');
}

function parseTrustedOrigins(
  raw: string | undefined,
  baseURL: string,
): string[] | { error: string } {
  const entries =
    !raw || !raw.trim()
      ? [baseURL]
      : raw
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
  const normalized = normalizeTrustedOrigins(entries);
  if (!normalized) {
    return { error: 'SAGATREE_AUTH_TRUSTED_ORIGINS must be valid http(s) origins' };
  }
  return normalized;
}

/** Wildcard / all-interfaces binds must not invent a loopback auth base URL. */
function isWildcardBindHost(host: string): boolean {
  return host === '0.0.0.0' || host === '::' || host === '[::]';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): HostConfig | ConfigError {
  const host = (env.SAGATREE_HOST ?? '127.0.0.1').trim();
  const allowRemote = env.SAGATREE_ALLOW_REMOTE_BIND === '1';
  const modeEnv = (env.SAGATREE_HOST_MODE ?? '').trim().toLowerCase();

  // GATE-02 common-7: explicit solo mode cannot bind publicly (even with allow-remote).
  if (modeEnv === 'solo') {
    const soloBindErr = assertSoloLoopbackBind('solo', host);
    if (soloBindErr) {
      return { code: 'INVALID_CONFIG', message: SOLO_REQUIRES_LOOPBACK };
    }
  }

  const mode: 'solo' | 'remote' =
    modeEnv === 'remote' || (modeEnv !== 'solo' && allowRemote && !isLoopbackHost(host))
      ? 'remote'
      : 'solo';

  if (!isLoopbackHost(host) && !allowRemote) {
    return {
      code: 'INVALID_CONFIG',
      message: redacted(
        `Remote bind to ${host} requires SAGATREE_ALLOW_REMOTE_BIND=1; default is loopback only.`,
      ),
    };
  }

  const soloBindErr = assertSoloLoopbackBind(mode, host);
  if (soloBindErr) {
    return { code: 'INVALID_CONFIG', message: SOLO_REQUIRES_LOOPBACK };
  }

  // Cookie profile must never enable JWT minting — fail closed on explicit opt-in.
  if (env.SAGATREE_AUTH_ALLOW_JWT === '1' || env.SAGATREE_AUTH_ENABLE_JWT === '1') {
    return {
      code: 'AUTH_MISCONFIG',
      message: redacted(
        'JWT issuance is forbidden on the GATE-02 cookie profile (unset SAGATREE_AUTH_ALLOW_JWT / SAGATREE_AUTH_ENABLE_JWT).',
      ),
    };
  }

  const portRaw = env.SAGATREE_PORT ?? '8787';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { code: 'INVALID_CONFIG', message: redacted(`Invalid SAGATREE_PORT: ${portRaw}`) };
  }

  const dataDirRaw = env.SAGATREE_DATA_DIR;
  if (!dataDirRaw || !String(dataDirRaw).trim()) {
    return { code: 'INVALID_CONFIG', message: 'SAGATREE_DATA_DIR is required' };
  }
  const dataDir = isAbsolute(dataDirRaw) ? dataDirRaw : resolve(process.cwd(), dataDirRaw);

  try {
    mkdirSync(dataDir, { recursive: true });
    accessSync(dataDir, constants.W_OK);
  } catch {
    return {
      code: 'DATA_DIR_NOT_WRITABLE',
      message: redacted(`Data directory is not writable: ${dataDir}`),
    };
  }

  // Test-only: exercise the post-mkdir writability failure path without chmod/root assumptions.
  if (env.SAGATREE_TEST_FORCE_DATA_DIR_UNWRITABLE === '1') {
    return {
      code: 'DATA_DIR_NOT_WRITABLE',
      message: redacted(`Data directory is not writable: ${dataDir}`),
    };
  }

  const wantAuth =
    mode === 'remote' ||
    env.SAGATREE_BETTER_AUTH_SECRET !== undefined ||
    env.SAGATREE_ENABLE_HOST_AUTH === '1';

  let auth: HostAuthConfig | null = null;
  if (wantAuth) {
    const secret = env.SAGATREE_BETTER_AUTH_SECRET ?? '';
    const secretErr = assertCookieAuthSecret(secret);
    if (secretErr) {
      return { code: 'AUTH_MISCONFIG', message: redacted(secretErr) };
    }

    const explicitBase = (env.SAGATREE_AUTH_BASE_URL ?? '').trim();
    if (isWildcardBindHost(host) && !explicitBase) {
      return {
        code: 'AUTH_MISCONFIG',
        message: redacted(
          'Wildcard bind (0.0.0.0 / ::) requires explicit SAGATREE_AUTH_BASE_URL; loopback auth URL is not substituted.',
        ),
      };
    }
    if (!isLoopbackHost(host) && !isWildcardBindHost(host) && !explicitBase) {
      return {
        code: 'AUTH_MISCONFIG',
        message: redacted(
          'Non-loopback bind requires explicit SAGATREE_AUTH_BASE_URL matching the public auth origin.',
        ),
      };
    }

    const baseURL = explicitBase || `http://${host}:${port}`;
    const baseOrigin = normalizeOrigin(baseURL);
    if (!baseOrigin) {
      return { code: 'AUTH_MISCONFIG', message: 'SAGATREE_AUTH_BASE_URL is not a valid URL' };
    }
    let baseParsed: URL;
    try {
      baseParsed = new URL(baseURL);
    } catch {
      return { code: 'AUTH_MISCONFIG', message: 'SAGATREE_AUTH_BASE_URL is not a valid URL' };
    }

    const cookieSecure =
      env.SAGATREE_AUTH_COOKIE_SECURE === '1' || baseParsed.protocol === 'https:';
    if (baseParsed.protocol === 'https:' && !cookieSecure) {
      return {
        code: 'AUTH_MISCONFIG',
        message: 'HTTPS auth baseURL requires Secure cookies',
      };
    }

    const trustedParsed = parseTrustedOrigins(env.SAGATREE_AUTH_TRUSTED_ORIGINS, baseOrigin);
    if ('error' in trustedParsed) {
      return { code: 'AUTH_MISCONFIG', message: trustedParsed.error };
    }
    // Always include the auth base origin so same-origin clients remain trusted.
    const trustedOrigins = trustedParsed.includes(baseOrigin)
      ? trustedParsed
      : [baseOrigin, ...trustedParsed];
    // Canonical origin form — no trailing slash (matches browser Origin).
    auth = {
      secret,
      baseURL: baseOrigin,
      trustedOrigins,
      cookieSecure,
    };
  }

  if (mode === 'remote' && !auth) {
    return {
      code: 'AUTH_MISCONFIG',
      message: redacted(
        'Remote-reachable host requires Better Auth cookie profile (SAGATREE_BETTER_AUTH_SECRET).',
      ),
    };
  }

  return { host, port, dataDir, mode, auth };
}

/**
 * GATE-02 Variant A — Better Auth cookie-only profile (no JWT plugin).
 * Location: server/src/auth/cookie-profile.ts
 *
 * Private to host composition / identity wiring. Product code must not load
 * better-auth/plugins jwt or bearer on this profile.
 */
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';

export type CookieAuthProfileConfig = {
  readonly databasePath: string;
  readonly baseURL: string;
  readonly secret: string;
  readonly trustedOrigins: readonly string[];
  /** When true, Set-Cookie uses Secure (required for HTTPS baseURL). */
  readonly cookieSecure: boolean;
};

export type HostBetterAuth = ReturnType<typeof betterAuth>;

const MIN_SECRET_BYTES = 32;

export function assertCookieAuthSecret(secret: string): string | null {
  const trimmed = secret.trim();
  if (trimmed.length < MIN_SECRET_BYTES) {
    return `SAGATREE_BETTER_AUTH_SECRET must be at least ${MIN_SECRET_BYTES} characters`;
  }
  return null;
}

/**
 * Fail-closed guards for the cookie profile before any listener opens.
 */
export function validateCookieAuthConfig(config: CookieAuthProfileConfig): string | null {
  const secretErr = assertCookieAuthSecret(config.secret);
  if (secretErr) return secretErr;
  let base: URL;
  try {
    base = new URL(config.baseURL);
  } catch {
    return 'SAGATREE_AUTH_BASE_URL is not a valid URL';
  }
  if (base.protocol === 'https:' && !config.cookieSecure) {
    return 'HTTPS auth baseURL requires Secure cookies (cookieSecure=true)';
  }
  if (config.trustedOrigins.length === 0) {
    return 'trustedOrigins must not be empty for cookie auth';
  }
  for (const origin of config.trustedOrigins) {
    try {
      new URL(origin);
    } catch {
      return `trusted origin is not a valid URL: ${origin}`;
    }
  }
  return null;
}

export async function createCookieAuthProfile(
  config: CookieAuthProfileConfig,
): Promise<{ ok: true; auth: HostBetterAuth; db: DatabaseSync } | { ok: false; error: string }> {
  const invalid = validateCookieAuthConfig(config);
  if (invalid) return { ok: false, error: invalid };

  let db: DatabaseSync;
  try {
    db = new DatabaseSync(config.databasePath);
    db.exec('PRAGMA foreign_keys=ON');
    db.exec('PRAGMA journal_mode=WAL');
    db.exec('PRAGMA synchronous=FULL');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'auth database open failed';
    return { ok: false, error: message.replace(/(?:token|key|secret|password)=[^\s]+/gi, '[redacted]') };
  }

  // Cookie profile: intentionally empty plugins — never jwt() / bearer().
  const auth = betterAuth({
    database: db,
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [...config.trustedOrigins],
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    session: { cookieCache: { enabled: false } },
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.cookieSecure,
      },
      useSecureCookies: config.cookieSecure,
    },
    rateLimit: { enabled: false },
    logger: { disabled: true },
    plugins: [],
  });

  try {
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
  } catch (err) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    const message = err instanceof Error ? err.message : 'auth migrations failed';
    return { ok: false, error: message.replace(/(?:token|key|secret|password)=[^\s]+/gi, '[redacted]') };
  }

  return { ok: true, auth, db };
}

/** Test helper — generate a secret that passes length checks. */
export function generateAuthSecret(): string {
  return randomBytes(48).toString('base64url');
}

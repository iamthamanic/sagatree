/**
 * ollama-url-policy — SSRF-safe validation for user-supplied Ollama base URLs.
 * Location: supabase/functions/_shared/ollama-url-policy.ts
 */

export const OLLAMA_CLOUD_OPENAI_BASE = 'https://ollama.com/v1';
export const OLLAMA_CLOUD_TAGS_URL = 'https://ollama.com/api/tags';
export const OLLAMA_PROVIDER_ID = 'ollama';
export const OLLAMA_NONE_SECRET = '';

const BLOCKED_HOSTS = new Set([
  'metadata.google.internal',
  'metadata',
  '169.254.169.254',
]);

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

function parseIpv4(host: string): [number, number, number, number] | null {
  if (!isIpv4(host)) return null;
  const parts = host.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return [parts[0], parts[1], parts[2], parts[3]];
}

function isPrivateOrLoopbackIpv4(host: string): boolean {
  const ip = parseIpv4(host);
  if (!ip) return false;
  const [a, b] = ip;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return false; // link-local / cloud metadata range
  return false;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host === '0.0.0.0' || host === '::' || host === '[::]') return true;
  if (host.endsWith('.internal') && host.includes('metadata')) return true;
  const ip = parseIpv4(host);
  if (ip && ip[0] === 169 && ip[1] === 254) return true;
  return false;
}

function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host === '[::1]') return true;
  if (isPrivateOrLoopbackIpv4(host)) return true;
  // Docker / compose service names (single label, no public TLD)
  if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(host) && !host.includes('.')) {
    return true;
  }
  if (host.endsWith('.local') || host.endsWith('.localhost')) return true;
  return false;
}

export type SafeUrlResult =
  | { ok: true; baseUrl: string }
  | { ok: false; message: string };

/**
 * Accept http(s) Ollama bases. Public internet requires https.
 * Blocks cloud-metadata and link-local ranges.
 */
export function assertSafeOllamaBaseUrl(raw: string): SafeUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: 'Base-URL fehlt.' };
  }
  if (trimmed.length > 500) {
    return { ok: false, message: 'Base-URL ist zu lang.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, message: 'Base-URL ist ungültig.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: 'Nur http(s) Base-URLs sind erlaubt.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: 'Base-URL darf keine Credentials enthalten.' };
  }
  if (parsed.hash) {
    return { ok: false, message: 'Base-URL darf keinen Hash enthalten.' };
  }

  const hostname = parsed.hostname;
  if (!hostname || isBlockedHost(hostname)) {
    return { ok: false, message: 'Diese Base-URL ist nicht erlaubt.' };
  }

  const local = isLocalOrPrivateHost(hostname);
  if (!local && parsed.protocol !== 'https:') {
    return { ok: false, message: 'Öffentliche Hosts benötigen https.' };
  }

  const normalized = trimTrailingSlash(`${parsed.origin}${parsed.pathname}`);
  return { ok: true, baseUrl: normalized };
}

/** Native Ollama host for /api/* (strip trailing /v1). */
export function toOllamaNativeBase(baseUrl: string): string {
  const trimmed = trimTrailingSlash(baseUrl);
  return trimmed.replace(/\/v1$/i, '');
}

export function resolveTagsUrl(useCloud: boolean, baseUrl: string): string {
  if (useCloud) return OLLAMA_CLOUD_TAGS_URL;
  return `${toOllamaNativeBase(baseUrl)}/api/tags`;
}

export function defaultLocalOllamaBase(
  envGet: (key: string) => string | undefined = (k) => Deno.env.get(k),
): string {
  const fromEnv = (
    envGet('CHARACTER_AI_BASE_URL') ||
    envGet('OLLAMA_HOST') ||
    'http://ollama:11434'
  ).trim();
  const safe = assertSafeOllamaBaseUrl(fromEnv);
  return safe.ok ? safe.baseUrl : 'http://ollama:11434';
}

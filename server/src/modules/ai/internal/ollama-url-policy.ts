/**
 * Ollama base URL SSRF allowlist (MIG-402).
 * Location: server/src/modules/ai/internal/ollama-url-policy.ts
 */
import { OLLAMA_CLOUD_OPENAI_BASE } from './registry.ts';

export function defaultLocalOllamaBase(): string {
  return 'http://127.0.0.1:11434';
}

/**
 * Reject non-http(s), credentials-in-URL, private-ish cloud hosts that are not
 * the known Ollama cloud, and obviously unsafe schemes. Localhost/loopback OK.
 */
export function assertSafeOllamaBaseUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: 'Base-URL fehlt.' };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, message: 'Ungültige Base-URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: 'Nur http(s) Base-URLs erlaubt.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: 'URL darf keine Credentials enthalten.' };
  }
  const host = parsed.hostname.toLowerCase();
  const cloudHost = new URL(OLLAMA_CLOUD_OPENAI_BASE).hostname.toLowerCase();
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const isCloud = host === cloudHost;
  if (!isLoopback && !isCloud && (host.endsWith('.internal') || host.endsWith('.local') || host === '0.0.0.0')) {
    return { ok: false, message: 'Base-URL nicht erlaubt.' };
  }
  // Block link-local / metadata style hosts
  if (host.startsWith('169.254.') || host === 'metadata.google.internal') {
    return { ok: false, message: 'Base-URL nicht erlaubt.' };
  }
  return { ok: true, url: trimmed.replace(/\/+$/, '') };
}

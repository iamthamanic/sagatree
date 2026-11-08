/**
 * AES-256-GCM helpers for user AI provider secrets (Edge-only).
 * Location: supabase/functions/_shared/ai-provider-crypto.ts
 */

const PREFIX = 'v1';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const withPad = padded + '='.repeat(padLen);
  const binary = atob(withPad);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Accept 64-char hex or standard/base64url 32-byte key material. */
export function parseCredentialsEncryptionKey(
  raw: string | undefined,
): Uint8Array | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return null;

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
      out[i] = Number.parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }

  try {
    const decoded = base64UrlToBytes(trimmed);
    if (decoded.byteLength === 32) return decoded;
  } catch {
    // fall through
  }

  try {
    const binary = atob(trimmed);
    if (binary.length === 32) {
      const out = new Uint8Array(32);
      for (let i = 0; i < 32; i += 1) out[i] = binary.charCodeAt(i);
      return out;
    }
  } catch {
    // fall through
  }

  return null;
}

async function importAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  const keyBytes = new Uint8Array(rawKey);
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptProviderSecret(
  plaintext: string,
  rawKey: Uint8Array,
): Promise<string> {
  const key = await importAesKey(rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const cipher = new Uint8Array(cipherBuf);
  return `${PREFIX}.${bytesToBase64Url(iv)}.${bytesToBase64Url(cipher)}`;
}

export async function decryptProviderSecret(
  ciphertext: string,
  rawKey: Uint8Array,
): Promise<string> {
  const parts = ciphertext.split('.');
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    throw new Error('CIPHER_FORMAT');
  }
  const iv = new Uint8Array(base64UrlToBytes(parts[1]));
  const data = new Uint8Array(base64UrlToBytes(parts[2]));
  const key = await importAesKey(rawKey);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(plainBuf);
}

export function buildKeyHint(apiKey: string): string {
  const trimmed = apiKey.trim();
  const tail = trimmed.slice(-4);
  return `••••${tail}`;
}

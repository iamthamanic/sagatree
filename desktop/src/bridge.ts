/**
 * MIG-703 desktop bridge allowlist. Location: desktop/src/bridge.ts
 *
 * Foreign web origins and manipulated messages must not gain host file/network
 * privileges. Only explicitly allowlisted operations run. Trusted origin +
 * expectedNonce come from native connection context — never from the payload.
 */
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const ALLOWED_OPS = new Set([
  'host.health',
  'host.dataDir.probe',
  'host.update.check',
  'host.update.rollback',
]);

const bridgePayloadSchema = z.object({
  op: z.string().min(1),
  payload: z.unknown().optional(),
  nonce: z.string().min(8),
});

const trustedContextSchema = z.object({
  /** Origin derived from the native window / IPC connection. */
  origin: z.string().min(1),
  /** Host-issued nonce from the handshake; never taken from the payload. */
  expectedNonce: z.string().min(8),
});

export type BridgePayload = z.infer<typeof bridgePayloadSchema>;
export type BridgeTrustedContext = z.infer<typeof trustedContextSchema>;

export type BridgeResult =
  | { readonly ok: true; readonly op: string }
  | {
      readonly ok: false;
      readonly code: 'foreign-origin' | 'unknown-op' | 'manipulated-message';
      readonly detail: string;
    };

function originAllowed(origin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol === 'tauri:') {
    return host === 'localhost' || host === '';
  }
  if (parsed.protocol === 'https:' && host === 'tauri.localhost') {
    return true;
  }
  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  }
  return false;
}

function noncesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function handleBridgeMessage(raw: unknown, trustedRaw: unknown): BridgeResult {
  const trusted = trustedContextSchema.safeParse(trustedRaw);
  if (!trusted.success) {
    return { ok: false, code: 'manipulated-message', detail: trusted.error.message };
  }
  const parsed = bridgePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: 'manipulated-message', detail: parsed.error.message };
  }
  const msg = parsed.data;
  if (!noncesMatch(msg.nonce, trusted.data.expectedNonce)) {
    return { ok: false, code: 'manipulated-message', detail: 'nonce mismatch' };
  }
  if (!originAllowed(trusted.data.origin)) {
    return { ok: false, code: 'foreign-origin', detail: `origin ${trusted.data.origin} not allowlisted` };
  }
  if (!ALLOWED_OPS.has(msg.op)) {
    return { ok: false, code: 'unknown-op', detail: `op ${msg.op} not allowlisted` };
  }
  return { ok: true, op: msg.op };
}

/**
 * MIG-703 desktop bridge allowlist. Location: desktop/src/bridge.ts
 *
 * Foreign web origins and manipulated messages must not gain host file/network
 * privileges. Only explicitly allowlisted operations run.
 */
import { z } from 'zod';

const ALLOWED_ORIGINS = new Set(['tauri://localhost', 'http://localhost', 'https://tauri.localhost']);

const ALLOWED_OPS = new Set([
  'host.health',
  'host.dataDir.probe',
  'host.update.check',
  'host.update.rollback',
] as const);

const bridgeRequestSchema = z.object({
  origin: z.string().min(1),
  op: z.string().min(1),
  payload: z.unknown().optional(),
  /** Integrity tag; missing/mismatched → reject. */
  nonce: z.string().min(8),
  expectedNonce: z.string().min(8),
});

export type BridgeRequest = z.infer<typeof bridgeRequestSchema>;

export type BridgeResult =
  | { readonly ok: true; readonly op: string }
  | { readonly ok: false; readonly code: 'foreign-origin' | 'unknown-op' | 'manipulated-message'; readonly detail: string };

export function handleBridgeMessage(raw: unknown): BridgeResult {
  const parsed = bridgeRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: 'manipulated-message', detail: parsed.error.message };
  }
  const msg = parsed.data;
  if (msg.nonce !== msg.expectedNonce) {
    return { ok: false, code: 'manipulated-message', detail: 'nonce mismatch' };
  }
  if (!ALLOWED_ORIGINS.has(msg.origin)) {
    return { ok: false, code: 'foreign-origin', detail: `origin ${msg.origin} not allowlisted` };
  }
  if (!(ALLOWED_OPS as Set<string>).has(msg.op)) {
    return { ok: false, code: 'unknown-op', detail: `op ${msg.op} not allowlisted` };
  }
  return { ok: true, op: msg.op };
}

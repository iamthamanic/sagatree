/**
 * Canonical JSON + digest helpers for session command fingerprints (ADR-ST-08).
 * Location: server/src/modules/session/internal/canonical.ts
 */
import { createHash } from 'node:crypto';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digest(value: unknown): string {
  const body = typeof value === 'string' ? value : canonicalJson(value);
  return createHash('sha256').update(body).digest('hex');
}

/**
 * Canonical row checksums for dry-run integrity reports.
 * Location: server/src/migration/postgres/checksum.ts
 */
import { createHash } from 'node:crypto';

/** Stable JSON stringify: sorted object keys, arrays preserved. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * Canonical checksum over table rows: sort by stable stringify of each row, then hash.
 */
export function canonicalTableChecksum(rows: readonly Record<string, unknown>[]): string {
  const sorted = [...rows]
    .map((row) => stableStringify(row))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return createHash('sha256').update(sorted.join('\n'), 'utf8').digest('hex');
}

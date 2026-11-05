/**
 * Canonical WO-XXXXX public ids (CUT-10 / #1145).
 * Location: server/src/modules/world/internal/public-world-id.ts
 *
 * Mirrors resource-id alphabet (no O/0/I/1); host must not import FE domains.
 */
import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BODY_LENGTH = 5;

function hasLetterAndDigit(body: string): boolean {
  let hasLetter = false;
  let hasDigit = false;
  for (const ch of body) {
    if (ch >= 'A' && ch <= 'Z') hasLetter = true;
    if (ch >= '2' && ch <= '9') hasDigit = true;
  }
  return hasLetter && hasDigit;
}

/** Returns `WO-` + 5-char body matching Public ID contract. */
export function generateWorldPublicId(): string {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    let body = '';
    for (let i = 0; i < BODY_LENGTH; i += 1) {
      body += ALPHABET[randomInt(ALPHABET.length)] ?? 'A';
    }
    if (hasLetterAndDigit(body)) return `WO-${body}`;
  }
  return 'WO-A2BC3';
}

export function isWorldPublicId(value: string): boolean {
  return /^WO-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(value);
}

export function normalizeWorldPublicId(value: string): string {
  return value.trim().toUpperCase();
}

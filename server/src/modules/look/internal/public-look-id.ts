/**
 * Canonical LK-XXXXX public ids (MIG-304 / #803).
 * Location: server/src/modules/look/internal/public-look-id.ts
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

/** Returns `LK-` + 5-char body matching Public ID contract. */
export function generateLookPublicId(): string {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    let body = '';
    for (let i = 0; i < BODY_LENGTH; i += 1) {
      body += ALPHABET[randomInt(ALPHABET.length)] ?? 'A';
    }
    if (hasLetterAndDigit(body)) return `LK-${body}`;
  }
  return 'LK-A2BC3';
}

export function isLookPublicId(value: string): boolean {
  return /^LK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(value);
}

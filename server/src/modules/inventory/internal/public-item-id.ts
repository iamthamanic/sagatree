/**
 * Canonical IT-XXXXX public ids (#802 / resource-id contract).
 * Location: server/src/modules/inventory/internal/public-item-id.ts
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

/** Returns `IT-` + 5-char body matching Public ID contract. */
export function generateItemPublicId(): string {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    let body = '';
    for (let i = 0; i < BODY_LENGTH; i += 1) {
      body += ALPHABET[randomInt(ALPHABET.length)] ?? 'A';
    }
    if (hasLetterAndDigit(body)) return `IT-${body}`;
  }
  return 'IT-A2BC3';
}

/**
 * Canonical NPCC-XXXXX public ids (MIG-307 / #806).
 * Location: server/src/modules/npc-creature/internal/public-npc-creature-id.ts
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

/** Returns `NPCC-` + 5-char body matching Public ID contract. */
export function generateNpcCreaturePublicId(): string {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    let body = '';
    for (let i = 0; i < BODY_LENGTH; i += 1) {
      body += ALPHABET[randomInt(ALPHABET.length)] ?? 'A';
    }
    if (hasLetterAndDigit(body)) return `NPCC-${body}`;
  }
  return 'NPCC-A2BC3';
}

export function isNpcCreaturePublicId(value: string): boolean {
  return /^NPCC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(value);
}

/**
 * Canonical SE-XXXXX public ids + 6-char join codes (#868).
 * Location: server/src/modules/session/internal/public-session-id.ts
 *
 * Mirrors src/domains/resource-id alphabet (no O/0/I/1); host must not import FE domains.
 */
import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BODY_LENGTH = 5;
const JOIN_CODE_LENGTH = 6;

function hasLetterAndDigit(body: string): boolean {
  let hasLetter = false;
  let hasDigit = false;
  for (const ch of body) {
    if (ch >= 'A' && ch <= 'Z') hasLetter = true;
    if (ch >= '2' && ch <= '9') hasDigit = true;
  }
  return hasLetter && hasDigit;
}

/** Returns `SE-` + 5-char body matching Public ID contract. */
export function generateSessionPublicId(): string {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    let body = '';
    for (let i = 0; i < BODY_LENGTH; i += 1) {
      body += ALPHABET[randomInt(ALPHABET.length)] ?? 'A';
    }
    if (hasLetterAndDigit(body)) return `SE-${body}`;
  }
  return 'SE-A2BC3';
}

/** Six-character join code (legacy generate_unique_session_code alphabet). */
export function generateSessionJoinCode(): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)] ?? 'A';
  }
  return code;
}

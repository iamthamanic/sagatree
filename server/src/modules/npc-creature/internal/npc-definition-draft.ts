/**
 * Structural NPC definition draft normalization (MIG-307 / #806).
 * Location: server/src/modules/npc-creature/internal/npc-definition-draft.ts
 *
 * Host must not import FE domains. Full domain validate stays on Supabase path;
 * here we fail-closed on identity smuggling and required catalog fields.
 */

const KINDS = new Set(['npc', 'creature']);
const CATEGORIES = new Set([
  'npc',
  'tier',
  'kreatur',
  'konstrukt',
  'untot',
  'geist',
  'sonstige',
]);
const SHEET_MODES = new Set(['compact', 'full']);
const COMBAT_PROFILES = new Set([
  'noncombat',
  'balanced',
  'tough',
  'offensive',
  'mobile',
  'ranged',
  'control_support',
]);
const COMBAT_ROLES = new Set(['standard', 'elite', 'boss']);
const MAX_NAME_LEN = 120;

export type NormalizedNpcDefinitionPayload = {
  readonly name: string;
  readonly description: string;
  readonly kind: string;
  readonly category: string;
  readonly sheetMode: string;
  readonly level: number;
  readonly combatProfile: string;
  readonly combatRole: string;
  readonly tags: readonly string[];
  readonly payloadVersion: 1;
  readonly [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Normalize a write draft into a JSON-serializable payload (no id/scope).
 * Rejects client-supplied identity columns.
 */
export function normalizeNpcDefinitionDraft(
  draftRaw: unknown,
): { readonly ok: true; readonly payload: NormalizedNpcDefinitionPayload } | { readonly ok: false; readonly error: string } {
  if (!isRecord(draftRaw)) {
    return { ok: false, error: 'invalid-draft' };
  }
  if ('id' in draftRaw || 'scope' in draftRaw) {
    return { ok: false, error: 'identity-in-draft' };
  }
  const nameRaw = draftRaw.name;
  if (typeof nameRaw !== 'string' || nameRaw.trim().length < 1) {
    return { ok: false, error: 'missing-name' };
  }
  const name = nameRaw.trim();
  if (name.length > MAX_NAME_LEN) {
    return { ok: false, error: 'name-too-long' };
  }
  if (!KINDS.has(String(draftRaw.kind))) {
    return { ok: false, error: 'invalid-kind' };
  }
  if (!CATEGORIES.has(String(draftRaw.category))) {
    return { ok: false, error: 'invalid-category' };
  }
  if (!SHEET_MODES.has(String(draftRaw.sheetMode))) {
    return { ok: false, error: 'invalid-sheet-mode' };
  }
  const level = draftRaw.level;
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 0 || level > 20) {
    return { ok: false, error: 'invalid-level' };
  }
  if (!COMBAT_PROFILES.has(String(draftRaw.combatProfile))) {
    return { ok: false, error: 'invalid-combat-profile' };
  }
  if (!COMBAT_ROLES.has(String(draftRaw.combatRole))) {
    return { ok: false, error: 'invalid-combat-role' };
  }

  const description =
    typeof draftRaw.description === 'string' ? draftRaw.description : '';
  const tags = Array.isArray(draftRaw.tags)
    ? draftRaw.tags.filter((t): t is string => typeof t === 'string')
    : [];

  // Preserve extra authoring fields (statOverrides, notes, fullSheet, …) when present.
  const rest: Record<string, unknown> = { ...draftRaw };
  delete rest.id;
  delete rest.scope;
  delete rest.payloadVersion;

  return {
    ok: true,
    payload: {
      ...rest,
      name,
      description,
      kind: String(draftRaw.kind),
      category: String(draftRaw.category),
      sheetMode: String(draftRaw.sheetMode),
      level,
      combatProfile: String(draftRaw.combatProfile),
      combatRole: String(draftRaw.combatRole),
      tags,
      payloadVersion: 1,
    },
  };
}

export function personalCopyName(name: string): string {
  const suffix = ' (Kopie)';
  const base = name.trim() || 'Figur';
  if (base.length + suffix.length <= MAX_NAME_LEN) return `${base}${suffix}`;
  return `${base.slice(0, MAX_NAME_LEN - suffix.length)}${suffix}`;
}

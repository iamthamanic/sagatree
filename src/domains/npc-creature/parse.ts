/**
 * Parse / normalize NPC-creature definition payloads (#196).
 * Location: src/domains/npc-creature/parse.ts
 *
 * Identity (id, scope) comes from trusted columns — never from payload.
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import {
  isSagaTreeNpcLevel,
  normalizeCombatRoleForProfile,
  type SagaTreeCombatProfile,
  type SagaTreeCombatRole,
  type SagaTreeNpcLevel,
} from '../rules/sagatree/npc-creature-power';
import type {
  NpcCreatureCombatDetails,
  NpcCreatureDefinition,
  NpcCreatureDefinitionWriteDraft,
  NpcCreatureDetailExtras,
  NpcCreatureStatOverrides,
} from './definition';
import { NPC_CREATURE_DEFINITION_PAYLOAD_VERSION } from './payload';
import {
  isNpcCreatureCategory,
  isNpcCreatureKind,
  isNpcCreatureScope,
  isNpcCreatureSheetMode,
  type NpcCreatureScope,
} from './taxonomy';
import { validateNpcCreatureDefinition } from './validate';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const COMBAT_PROFILES: readonly string[] = [
  'noncombat',
  'balanced',
  'tough',
  'offensive',
  'mobile',
  'ranged',
  'control_support',
];

const COMBAT_ROLES: readonly string[] = ['standard', 'elite', 'boss'];

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readTags(value: unknown): readonly string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const tags: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    tags.push(entry);
  }
  return tags;
}

function readOptionalNonNegInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

function readStatOverrides(value: unknown): NpcCreatureStatOverrides | null | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  const health = readOptionalNonNegInt(value.health);
  if (health === null) return null;
  const defense = readOptionalNonNegInt(value.defense);
  if (defense === null) return null;
  const movementMeters = readOptionalNonNegInt(value.movementMeters);
  if (movementMeters === null) return null;
  const resistanceHigh = readOptionalNonNegInt(value.resistanceHigh);
  if (resistanceHigh === null) return null;
  const resistanceNormal = readOptionalNonNegInt(value.resistanceNormal);
  if (resistanceNormal === null) return null;
  const resistanceLow = readOptionalNonNegInt(value.resistanceLow);
  if (resistanceLow === null) return null;

  let attributes: readonly [number, number, number, number, number, number] | undefined;
  if (value.attributes !== undefined) {
    if (!Array.isArray(value.attributes) || value.attributes.length !== 6) return null;
    const parsed: number[] = [];
    for (const entry of value.attributes) {
      if (typeof entry !== 'number' || !Number.isFinite(entry) || !Number.isInteger(entry) || entry < 0) {
        return null;
      }
      parsed.push(entry);
    }
    attributes = parsed as [number, number, number, number, number, number];
  }

  const result: NpcCreatureStatOverrides = {
    ...(health !== undefined ? { health } : {}),
    ...(defense !== undefined ? { defense } : {}),
    ...(movementMeters !== undefined ? { movementMeters } : {}),
    ...(resistanceHigh !== undefined ? { resistanceHigh } : {}),
    ...(resistanceNormal !== undefined ? { resistanceNormal } : {}),
    ...(resistanceLow !== undefined ? { resistanceLow } : {}),
    ...(attributes !== undefined ? { attributes } : {}),
  };
  return result;
}

function readStringFields(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, string> | null | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  const result: Record<string, string> = {};
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) return null;
    const entry = value[key];
    if (entry === undefined) continue;
    if (typeof entry !== 'string') return null;
    result[key] = entry;
  }
  return result;
}

/**
 * Build a definition from trusted id/scope columns + untrusted payload.
 * Returns null when the row cannot be read as a valid SagaTree definition.
 */
export function parseNpcCreatureDefinition(
  id: string,
  scope: NpcCreatureScope,
  payload: unknown,
): NpcCreatureDefinition | null {
  if (!isNpcCreatureScope(scope)) return null;
  if (typeof id !== 'string' || !id.startsWith(`${scope}:`)) return null;
  if (!isRecord(payload)) return null;

  // Payload must never declare a conflicting identity.
  if ('id' in payload || 'scope' in payload) return null;

  const name = readString(payload.name);
  const description = readString(payload.description) ?? '';
  if (!name) return null;

  if (!isNpcCreatureKind(payload.kind)) return null;
  if (!isNpcCreatureCategory(payload.category)) return null;
  if (!isNpcCreatureSheetMode(payload.sheetMode)) return null;

  const levelRaw = payload.level;
  if (typeof levelRaw !== 'number' || !isSagaTreeNpcLevel(levelRaw)) return null;
  const level: SagaTreeNpcLevel = levelRaw;

  if (typeof payload.combatProfile !== 'string' || !COMBAT_PROFILES.includes(payload.combatProfile)) {
    return null;
  }
  if (typeof payload.combatRole !== 'string' || !COMBAT_ROLES.includes(payload.combatRole)) {
    return null;
  }
  const combatProfile = payload.combatProfile as SagaTreeCombatProfile;
  const combatRole = payload.combatRole as SagaTreeCombatRole;
  if (normalizeCombatRoleForProfile(combatProfile, combatRole) !== combatRole) return null;

  const tags = readTags(payload.tags);
  if (tags === null) return null;

  const iconKey = payload.iconKey === undefined
    ? undefined
    : readString(payload.iconKey) ?? null;
  if (iconKey === null) return null;

  const portraitAssetKey = payload.portraitAssetKey === undefined
    ? undefined
    : readString(payload.portraitAssetKey) ?? null;
  if (portraitAssetKey === null) return null;

  const notes = payload.notes === undefined ? undefined : readString(payload.notes);
  if (payload.notes !== undefined && notes === null) return null;

  const statOverrides = readStatOverrides(payload.statOverrides);
  if (statOverrides === null) return null;

  const combatDetailsRaw = readStringFields(payload.combatDetails, [
    'attacks',
    'reactions',
    'signatures',
    'impulseOptions',
    'wendepunkt',
    'resistancesNotes',
    'weaknessesNotes',
    'immunitiesNotes',
  ]);
  if (combatDetailsRaw === null) return null;
  const combatDetails = combatDetailsRaw as NpcCreatureCombatDetails | undefined;

  const detailExtrasRaw = readStringFields(payload.detailExtras, [
    'senses',
    'behavior',
    'loot',
  ]);
  if (detailExtrasRaw === null) return null;
  const detailExtras = detailExtrasRaw as NpcCreatureDetailExtras | undefined;

  let fullSheet: Readonly<Record<string, unknown>> | undefined;
  if (payload.fullSheet !== undefined) {
    if (!isRecord(payload.fullSheet)) return null;
    fullSheet = payload.fullSheet;
  }

  const candidate: NpcCreatureDefinition = {
    id,
    scope,
    name: name.trim(),
    description,
    kind: payload.kind,
    category: payload.category,
    sheetMode: payload.sheetMode,
    level,
    combatProfile,
    combatRole,
    tags,
    ...(iconKey !== undefined ? { iconKey } : {}),
    ...(portraitAssetKey !== undefined ? { portraitAssetKey } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(statOverrides !== undefined ? { statOverrides } : {}),
    ...(combatDetails !== undefined ? { combatDetails } : {}),
    ...(detailExtras !== undefined ? { detailExtras } : {}),
    ...(fullSheet !== undefined ? { fullSheet } : {}),
  };

  const validation = validateNpcCreatureDefinition(candidate);
  if (!validation.ok) return null;
  return candidate;
}

/**
 * Payload column contents: everything except identity columns.
 * Stamps payloadVersion for the #196 contract.
 */
export function toNpcCreatureDefinitionPayload(
  definition: NpcCreatureDefinition,
): Record<string, unknown> {
  const { id: _id, scope: _scope, ...rest } = definition;
  return {
    ...rest,
    tags: [...rest.tags],
    payloadVersion: NPC_CREATURE_DEFINITION_PAYLOAD_VERSION,
  };
}

/** Assemble a write draft into a candidate definition for pre-write validation. */
export function assembleNpcCreatureDefinition(
  id: string,
  scope: NpcCreatureScope,
  draft: NpcCreatureDefinitionWriteDraft,
): NpcCreatureDefinition {
  return {
    ...draft,
    id,
    scope,
    tags: draft.tags ?? [],
  };
}

/**
 * NPC/creature promotion use cases (#200): Template→Character and Compact→Full.
 * Location: src/domains/npc-creature/promotion.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 * Illegal compact values become unresolved legal choices — never a silent Full build.
 */

import { isValidSagaTreeBaseAttributeDistribution } from '../rules/sagatree/attribute-progression';
import type { CharacterAttributesDto } from '../character/domain/character.entity';
import type { NpcCreatureDefinition, NpcCreatureDefinitionWriteDraft } from './definition';
import { librarySourceOf } from './library-query';
import {
  canMutateNpcCreatureDefinition,
  type NpcCreatureCatalogRecord,
  type NpcCreatureMutationContext,
} from './policy';
import { resolveNpcCreatureEffectiveStats } from './derived';
import type { NpcCreatureSheetMode } from './taxonomy';

/** Library row action classification for promotion / controller flows. */
export type NpcLibraryPromotionAction =
  | 'template-to-character'
  | 'compact-to-full'
  | 'controller-assign';

export type NpcUnresolvedChoiceKey =
  | 'gender_reading'
  | 'archetype'
  | 'essence'
  | 'species_traits'
  | 'background'
  | 'attributes'
  | 'skills'
  | 'race';

export interface NpcUnresolvedChoice {
  key: NpcUnresolvedChoiceKey;
  /** German UI label. */
  labelDe: string;
  reason: string;
}

/**
 * Partial CharacterEditor seed — intentionally incomplete until legal choices resolve.
 * Must not be treated as a valid CharacterPresetSnapshot.
 */
export interface NpcCharacterEditorSeed {
  name: string;
  description: string;
  level: number;
  race: string;
  notes?: string;
  /** Present only when compact attrs are a legal Full base distribution. */
  attributes?: CharacterAttributesDto;
  /** Compact reference values shown when attributes are unresolved. */
  compactAttributeReference?: CharacterAttributesDto;
  speciesProfileName?: string;
}

export interface NpcPromotionPlan {
  kind: 'template-to-character' | 'compact-to-full';
  sourceDefinitionId: string;
  /** Template path: false. Compact→Full: true (same definition id). */
  preserveIdentity: boolean;
  mappedFields: readonly string[];
  unresolvedChoices: readonly NpcUnresolvedChoice[];
  editorSeed: NpcCharacterEditorSeed;
}

export interface NpcPromotionPlanResult {
  ok: true;
  plan: NpcPromotionPlan;
}

export interface NpcPromotionPlanError {
  ok: false;
  code: 'not_template' | 'not_compact' | 'already_full' | 'cannot_mutate' | 'core_immutable';
  message: string;
}

const ATTR_KEYS = [
  'strength',
  'dexterity',
  'endurance',
  'mind',
  'perception',
  'charisma',
] as const;

const CATEGORY_RACE_HINT: Record<string, { race: string; speciesProfileName?: string }> = {
  npc: { race: 'human' },
  tier: { race: 'alien', speciesProfileName: 'Tier' },
  kreatur: { race: 'alien', speciesProfileName: 'Kreatur' },
  konstrukt: { race: 'alien', speciesProfileName: 'Konstrukt' },
  untot: { race: 'alien', speciesProfileName: 'Untot' },
  geist: { race: 'alien', speciesProfileName: 'Geist' },
  sonstige: { race: 'alien', speciesProfileName: 'Wesen' },
};

function tupleToAttributes(
  tuple: readonly [number, number, number, number, number, number],
): CharacterAttributesDto {
  return {
    strength: tuple[0],
    dexterity: tuple[1],
    endurance: tuple[2],
    mind: tuple[3],
    perception: tuple[4],
    charisma: tuple[5],
  };
}

/** Whether attributes form a legal Level-1 Full base distribution (budget + caps). */
export function isLegalFullBaseAttributes(attributes: CharacterAttributesDto): boolean {
  return isValidSagaTreeBaseAttributeDistribution(attributes);
}

/**
 * Classify which Library promotion action applies to a definition.
 * Controller-assign only when sheet is already full (UI still needs campaign context).
 */
export function classifyNpcLibraryPromotionAction(
  definition: NpcCreatureDefinition,
): NpcLibraryPromotionAction | null {
  const source = librarySourceOf(definition);
  if (source === 'core' || source === 'pack') {
    return 'template-to-character';
  }
  if (definition.sheetMode === 'compact') {
    return 'compact-to-full';
  }
  if (definition.sheetMode === 'full') {
    return 'controller-assign';
  }
  return null;
}

function buildCommonUnresolved(): NpcUnresolvedChoice[] {
  return [
    {
      key: 'gender_reading',
      labelDe: 'Geschlechts-Lesart',
      reason: 'Compact-Statblocks tragen keine Geschlechts-Lesart.',
    },
    {
      key: 'archetype',
      labelDe: 'Archetyp',
      reason: 'Ein vollständiger Charakter braucht einen Archetyp.',
    },
    {
      key: 'essence',
      labelDe: 'Essenz',
      reason: 'Ein vollständiger Charakter braucht eine Essenz.',
    },
    {
      key: 'species_traits',
      labelDe: 'Speziesmerkmale',
      reason: 'Speziesmerkmale müssen im CharacterEditor legal gewählt werden.',
    },
    {
      key: 'background',
      labelDe: 'Hintergrund',
      reason: 'Mechanischer Hintergrund ist im Compact-Statblock nicht enthalten.',
    },
    {
      key: 'skills',
      labelDe: 'Fertigkeiten',
      reason: 'Start-Fertigkeitsquellen müssen im CharacterEditor verteilt werden.',
    },
  ];
}

function buildEditorSeed(definition: NpcCreatureDefinition): {
  seed: NpcCharacterEditorSeed;
  mappedFields: string[];
  unresolved: NpcUnresolvedChoice[];
} {
  const mappedFields: string[] = ['name', 'description', 'level', 'notes'];
  const unresolved = buildCommonUnresolved();
  const raceHint = CATEGORY_RACE_HINT[definition.category] ?? { race: 'alien', speciesProfileName: 'Wesen' };
  const effective = resolveNpcCreatureEffectiveStats(definition);
  const compactAttrs = tupleToAttributes(effective.attributes);

  const seed: NpcCharacterEditorSeed = {
    name: definition.name,
    description: definition.description,
    level: definition.level,
    race: raceHint.race,
    notes: definition.notes,
    compactAttributeReference: compactAttrs,
    ...(raceHint.speciesProfileName
      ? { speciesProfileName: definition.name || raceHint.speciesProfileName }
      : {}),
  };

  if (raceHint.race === 'alien') {
    unresolved.push({
      key: 'race',
      labelDe: 'Speziesprofil',
      reason: 'Kreaturen-/Kategorie-Hinweise müssen als legales Speziesprofil bestätigt werden.',
    });
  }

  if (isLegalFullBaseAttributes(compactAttrs)) {
    seed.attributes = compactAttrs;
    mappedFields.push('attributes');
  } else {
    unresolved.push({
      key: 'attributes',
      labelDe: 'Attribute',
      reason:
        'Compact-Attributwerte liegen außerhalb eines legalen Full-Builds (Budget/Cap) und müssen neu gewählt werden.',
    });
  }

  return { seed, mappedFields, unresolved };
}

/** Generic template → new character identity (template unchanged). */
export function planTemplateToCharacterPromotion(
  definition: NpcCreatureDefinition,
): NpcPromotionPlanResult | NpcPromotionPlanError {
  const action = classifyNpcLibraryPromotionAction(definition);
  if (action !== 'template-to-character') {
    return {
      ok: false,
      code: 'not_template',
      message: 'Nur Core-/Pack-Vorlagen erzeugen einen neuen Charakter.',
    };
  }

  const { seed, mappedFields, unresolved } = buildEditorSeed(definition);
  return {
    ok: true,
    plan: {
      kind: 'template-to-character',
      sourceDefinitionId: definition.id,
      preserveIdentity: false,
      mappedFields,
      unresolvedChoices: unresolved,
      editorSeed: seed,
    },
  };
}

/**
 * Concrete compact → same identity Full. Requires mutate permission.
 * Does not write — caller persists after CharacterEditor completes a legal build.
 */
export function planCompactToFullPromotion(
  record: NpcCreatureCatalogRecord,
  context: NpcCreatureMutationContext,
): NpcPromotionPlanResult | NpcPromotionPlanError {
  const { definition } = record;
  if (definition.scope === 'core') {
    return {
      ok: false,
      code: 'core_immutable',
      message: 'Core-/Pack-Definitionen können nicht in-place ausgebaut werden.',
    };
  }
  if (definition.sheetMode !== 'compact') {
    return {
      ok: false,
      code: definition.sheetMode === 'full' ? 'already_full' : 'not_compact',
      message:
        definition.sheetMode === 'full'
          ? 'Figur ist bereits ein vollständiger Charakterbogen.'
          : 'Nur Compact-Statblocks können ausgebaut werden.',
    };
  }
  if (!canMutateNpcCreatureDefinition(record, context)) {
    return {
      ok: false,
      code: 'cannot_mutate',
      message: 'Keine Berechtigung, diese Figur auszubauen.',
    };
  }

  const { seed, mappedFields, unresolved } = buildEditorSeed(definition);
  return {
    ok: true,
    plan: {
      kind: 'compact-to-full',
      sourceDefinitionId: definition.id,
      preserveIdentity: true,
      mappedFields,
      unresolvedChoices: unresolved,
      editorSeed: seed,
    },
  };
}

/**
 * Build a write draft that flips compact → full with an opaque fullSheet snapshot.
 * Rejects if sheetMode would stay compact or fullSheet is missing/empty.
 */
export function buildCompactToFullWriteDraft(
  definition: NpcCreatureDefinition,
  fullSheet: Readonly<Record<string, unknown>>,
): NpcCreatureDefinitionWriteDraft | null {
  if (definition.sheetMode !== 'compact' && definition.sheetMode !== 'full') {
    return null;
  }
  if (!fullSheet || typeof fullSheet !== 'object' || Array.isArray(fullSheet)) {
    return null;
  }
  if (Object.keys(fullSheet).length === 0) {
    return null;
  }

  const {
    id: _id,
    scope: _scope,
    ...rest
  } = definition;

  return {
    ...rest,
    sheetMode: 'full' as NpcCreatureSheetMode,
    // Compact combat-role overlay is identity-orthogonal; keep profile/role for history
    // but Full play uses fullSheet. Strip compact-only overrides that could imply illegal math.
    fullSheet,
  };
}

/**
 * Assert a planned Full save does not smuggle illegal attributes into fullSheet.
 * Callers should only pass CharacterEditor snapshots that already passed collectValidationProblems.
 */
export function assertFullSheetHasNoSilentIllegalAttributes(
  fullSheet: Readonly<Record<string, unknown>>,
): { ok: true } | { ok: false; message: string } {
  const attrs = fullSheet.attributes;
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) {
    return { ok: false, message: 'Full Sheet braucht gültige Attribute.' };
  }
  const candidate = attrs as CharacterAttributesDto;
  for (const key of ATTR_KEYS) {
    if (typeof candidate[key] !== 'number' || !Number.isFinite(candidate[key])) {
      return { ok: false, message: `Attribut ${key} fehlt oder ist ungültig.` };
    }
  }
  if (!isLegalFullBaseAttributes(candidate)) {
    // Higher-level builds may include advances in the displayed attributes object.
    // Accept when sagatree_profile.baseAttributes is present and legal instead.
    const profile = fullSheet.sagatree_profile;
    if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
      const base = (profile as { baseAttributes?: CharacterAttributesDto }).baseAttributes;
      if (base && isLegalFullBaseAttributes(base)) {
        return { ok: true };
      }
    }
    return {
      ok: false,
      message: 'Full Sheet enthält keine legale Basis-Attributverteilung.',
    };
  }
  return { ok: true };
}

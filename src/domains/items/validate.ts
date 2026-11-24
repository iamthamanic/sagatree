/**
 * validateItemDefinitionMetadata — fail-closed taxonomy checks (#134).
 * Does not require combat fields; allows kindKey=device with any inventory type.
 * Location: src/domains/items/validate.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { ItemDefinition } from './definition';
import {
  isItemCapability,
  isItemContext,
  isItemKindKey,
  isItemOrigin,
  isItemRole,
  isItemSettingTag,
  isItemTechLevel,
} from './taxonomy';

/** Result of pure metadata validation. */
export type ItemDefinitionMetadataValidation =
  | { ok: true }
  | { ok: false; errors: string[] };

function validateTagList(
  values: readonly unknown[] | undefined,
  label: string,
  isKnown: (value: unknown) => boolean,
  errors: string[],
): void {
  if (values === undefined) return;
  for (const value of values) {
    if (!isKnown(value)) {
      errors.push(`${label}: unknown value ${JSON.stringify(value)}`);
    }
  }
}

/**
 * Rejects unknown taxonomy tags fail-closed. Absent optional fields are fine.
 * Combat mechanics are never required. kindKey=device is valid for any type.
 */
export function validateItemDefinitionMetadata(
  def: ItemDefinition,
): ItemDefinitionMetadataValidation {
  const errors: string[] = [];

  if (def.kindKey !== undefined && !isItemKindKey(def.kindKey)) {
    errors.push(`kindKey: unknown value ${JSON.stringify(def.kindKey)}`);
  }

  validateTagList(def.settingTags, 'settingTags', isItemSettingTag, errors);
  validateTagList(def.contexts, 'contexts', isItemContext, errors);
  validateTagList(def.capabilities, 'capabilities', isItemCapability, errors);
  validateTagList(def.roles, 'roles', isItemRole, errors);

  if (def.techLevel !== undefined && !isItemTechLevel(def.techLevel)) {
    errors.push(`techLevel: unknown value ${JSON.stringify(def.techLevel)}`);
  }

  if (def.origin !== undefined && !isItemOrigin(def.origin)) {
    errors.push(`origin: unknown value ${JSON.stringify(def.origin)}`);
  }

  if (def.basedOnDefinitionId !== undefined) {
    if (typeof def.basedOnDefinitionId !== 'string' || def.basedOnDefinitionId.length === 0) {
      errors.push('basedOnDefinitionId: must be a non-empty string when present');
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

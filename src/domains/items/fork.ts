/**
 * buildForkedItemDefinitionDraft — copy a source definition into a new
 * Personal or World draft with provenance (#136). Never reuses the source id.
 * Location: src/domains/items/fork.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { ItemDefinitionScope } from '../character/inventory-v2/primitives';
import type { ItemDefinition } from './definition';
import { normalizeItemDefinition } from './normalize';
import type { ItemOrigin } from './taxonomy';

/** Draft shape for create/fork — identity (`id`, `scope`) assigned by persistence. */
export type ItemDefinitionWriteDraft = Omit<ItemDefinition, 'id' | 'scope'>;

const ORIGIN_FOR_TARGET: Record<'personal' | 'world', ItemOrigin> = {
  personal: 'personal',
  world: 'world',
};

/**
 * Build a writable draft from any readable source (Core/builtin/World/Personal).
 * Copies mechanical + taxonomy values; sets `basedOnDefinitionId` to the immediate
 * source id and `origin` to the target scope's provenance. Does not copy id/scope.
 */
export function buildForkedItemDefinitionDraft(
  source: ItemDefinition,
  targetScope: Extract<ItemDefinitionScope, 'personal' | 'world'>,
): ItemDefinitionWriteDraft {
  const normalized = normalizeItemDefinition(source);
  const {
    id: _id,
    scope: _scope,
    basedOnDefinitionId: _basedOn,
    origin: _origin,
    assetKey: _assetKey,
    model3d: _model3d,
    ...rest
  } = normalized;

  return {
    ...rest,
    basedOnDefinitionId: source.id,
    origin: ORIGIN_FOR_TARGET[targetScope],
  };
}

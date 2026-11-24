/**
 * resolve-binding-image — Map saga binding asset ids to Library static icon URLs.
 * Location: src/domains/saga/bindings/resolve-binding-image.ts
 *
 * Pure domain: uses core/builtin catalogs only (no React, no backend clients).
 */
import type { SagaAssetKind } from '../permissions/catalog';
import { sagatreeNativePregenPortraitUrl } from '../../character/use-cases/sagatree-native-pregen-portraits';
import {
  buildItemIconPublicSrc,
  builtinDefinitionIdToIconKey,
  getBuiltinStandardDefinition,
} from '../../items';
import {
  buildNpcCreatureIconPublicSrc,
  builtinNpcCreatureIdToIconKey,
  getBuiltinNpcCreatureDefinition,
  getCoreNpcCreatureDefinition,
} from '../../npc-creature';

/** Dornhain / prepared-adventure spawn ids → Core archetype icons. */
const NPC_BINDING_TO_CORE_ID: Readonly<Record<string, string>> = Object.freeze({
  'npc.innkeeper': 'core:npc.merchant',
  'npc.guard': 'core:npc.guard',
  'npc.bandit-a': 'core:npc.bandit',
  'npc.bandit-b': 'core:npc.bandit',
  'npc.hidden-villager': 'core:npc.citizen',
});

/** Binding-only item ids without a builtin pack row → closest icon. */
const ITEM_BINDING_ICON_FALLBACK: Readonly<Record<string, string>> = Object.freeze({
  'item.relic-shard': 'builtin-fantasy-gemstone',
});

function resolveNpcIconSrc(assetId: string): string | null {
  const trimmed = assetId.trim();
  if (!trimmed) return null;

  const mappedCoreId = NPC_BINDING_TO_CORE_ID[trimmed];
  const core = mappedCoreId
    ? getCoreNpcCreatureDefinition(mappedCoreId)
    : getCoreNpcCreatureDefinition(trimmed);
  if (core?.iconKey) {
    return buildNpcCreatureIconPublicSrc(core.iconKey);
  }

  const builtin = getBuiltinNpcCreatureDefinition(trimmed);
  if (builtin?.iconKey) {
    return buildNpcCreatureIconPublicSrc(builtin.iconKey);
  }

  return buildNpcCreatureIconPublicSrc(builtinNpcCreatureIdToIconKey(trimmed));
}

function resolveItemIconSrc(assetId: string): string | null {
  const trimmed = assetId.trim();
  if (!trimmed) return null;

  const definition = getBuiltinStandardDefinition(trimmed);
  if (definition?.iconKey) {
    return buildItemIconPublicSrc(definition.iconKey);
  }

  const fallbackSlug = ITEM_BINDING_ICON_FALLBACK[trimmed];
  if (fallbackSlug) {
    return buildItemIconPublicSrc(fallbackSlug);
  }

  return buildItemIconPublicSrc(builtinDefinitionIdToIconKey(trimmed));
}

/**
 * Public image URL for a saga binding card (SVG icon under /assets/…), or null.
 */
export function resolveSagaBindingImageSrc(
  assetKind: SagaAssetKind | string,
  assetId: string,
): string | null {
  if (assetKind === 'npc') return resolveNpcIconSrc(assetId);
  if (assetKind === 'item') return resolveItemIconSrc(assetId);
  if (assetKind === 'character') return sagatreeNativePregenPortraitUrl(assetId);
  return null;
}

/** SVG icons should `contain`; character portraits `cover`. */
export function resolveSagaBindingImageObjectFit(
  assetKind: SagaAssetKind | string,
): 'cover' | 'contain' {
  return assetKind === 'character' ? 'cover' : 'contain';
}

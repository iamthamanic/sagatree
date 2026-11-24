/**
 * Item taxonomy registries — setting/tech/context/capability/role/provenance
 * vocabularies for ItemDefinition metadata (#134).
 * Location: src/domains/items/taxonomy.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

/** Semantic item kind — independent of InventoryItemType inventory behavior. */
export const ITEM_KIND_KEYS = [
  'weapon',
  'armor',
  'shield',
  'tool',
  'device',
  'consumable',
  'container',
  'document',
  'currency',
  'key',
  'food',
  'medical',
  'clothing',
  'resource',
  'sport',
  'entertainment',
  'misc',
] as const;

export type ItemKindKey = (typeof ITEM_KIND_KEYS)[number];

export const ITEM_SETTING_TAGS = ['fantasy', 'sci-fi', 'contemporary'] as const;

export type ItemSettingTag = (typeof ITEM_SETTING_TAGS)[number];

export const ITEM_TECH_LEVELS = [
  'primitive',
  'medieval',
  'industrial',
  'modern',
  'near-future',
  'advanced',
] as const;

export type ItemTechLevel = (typeof ITEM_TECH_LEVELS)[number];

export const ITEM_CONTEXTS = [
  'combat',
  'exploration',
  'survival',
  'medical',
  'social',
  'domestic',
  'office',
  'sports',
  'science',
  'engineering',
  'travel',
  'entertainment',
  'urban',
] as const;

export type ItemContext = (typeof ITEM_CONTEXTS)[number];

export const ITEM_CAPABILITIES = [
  'attack',
  'defend',
  'heal',
  'communicate',
  'navigate',
  'illuminate',
  'repair',
  'scan',
  'record',
  'access',
  'carry',
  'consume',
  'trade',
  'unlock',
  'disguise',
  'entertain',
  'research',
  'survive',
] as const;

export type ItemCapability = (typeof ITEM_CAPABILITIES)[number];

export const ITEM_ROLES = [
  'ordinary',
  'valuable',
  'quest',
  'evidence',
  'contraband',
  'key-item',
  'personal',
  'collectible',
] as const;

export type ItemRole = (typeof ITEM_ROLES)[number];

/** Provenance of a definition — not a marketplace source. */
export const ITEM_ORIGINS = [
  'core-archetype',
  'builtin-standard',
  'personal',
  'world',
] as const;

export type ItemOrigin = (typeof ITEM_ORIGINS)[number];

const KIND_KEY_SET: ReadonlySet<string> = new Set(ITEM_KIND_KEYS);
const SETTING_TAG_SET: ReadonlySet<string> = new Set(ITEM_SETTING_TAGS);
const TECH_LEVEL_SET: ReadonlySet<string> = new Set(ITEM_TECH_LEVELS);
const CONTEXT_SET: ReadonlySet<string> = new Set(ITEM_CONTEXTS);
const CAPABILITY_SET: ReadonlySet<string> = new Set(ITEM_CAPABILITIES);
const ROLE_SET: ReadonlySet<string> = new Set(ITEM_ROLES);
const ORIGIN_SET: ReadonlySet<string> = new Set(ITEM_ORIGINS);

export function isItemKindKey(value: unknown): value is ItemKindKey {
  return typeof value === 'string' && KIND_KEY_SET.has(value);
}

export function isItemSettingTag(value: unknown): value is ItemSettingTag {
  return typeof value === 'string' && SETTING_TAG_SET.has(value);
}

export function isItemTechLevel(value: unknown): value is ItemTechLevel {
  return typeof value === 'string' && TECH_LEVEL_SET.has(value);
}

export function isItemContext(value: unknown): value is ItemContext {
  return typeof value === 'string' && CONTEXT_SET.has(value);
}

export function isItemCapability(value: unknown): value is ItemCapability {
  return typeof value === 'string' && CAPABILITY_SET.has(value);
}

export function isItemRole(value: unknown): value is ItemRole {
  return typeof value === 'string' && ROLE_SET.has(value);
}

export function isItemOrigin(value: unknown): value is ItemOrigin {
  return typeof value === 'string' && ORIGIN_SET.has(value);
}

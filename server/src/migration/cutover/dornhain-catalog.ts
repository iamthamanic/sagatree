/**
 * Dornhain hard-requirement catalog for MIG-700 cutover drills.
 * Location: server/src/migration/cutover/dornhain-catalog.ts
 *
 * Owner RELEASE 2026-11-01: world + adventure + characters + items + monsters + NPCs
 * must survive Freeze→import. Non-Dornhain user data is disposable.
 */
export const DORHAIN_SLUG = 'dornhain.whisper' as const;
export const DORHAIN_WORLD_TITLE = 'Dornhain' as const;
export const DORHAIN_SAGA_TITLE = 'Dornhain — Whisper' as const;

export type DornhainCharacter = {
  readonly id: string;
  readonly publicId: string;
  readonly displayName: string;
  readonly archetype: string;
};

export type DornhainMonster = {
  readonly id: string;
  readonly publicId: string;
  readonly displayName: string;
};

export type DornhainCatalog = {
  readonly worldTitle: typeof DORHAIN_WORLD_TITLE;
  readonly sagaSlug: typeof DORHAIN_SLUG;
  readonly sagaTitle: typeof DORHAIN_SAGA_TITLE;
  readonly characters: readonly DornhainCharacter[];
  readonly monsters: readonly DornhainMonster[];
  readonly itemDefinitionIds: readonly string[];
  readonly npcPublicIds: readonly string[];
};

/** Canonical fixture catalog used by the cutover drill (stable IDs for checksums). */
export function dornhainFixtureCatalog(): DornhainCatalog {
  return {
    worldTitle: DORHAIN_WORLD_TITLE,
    sagaSlug: DORHAIN_SLUG,
    sagaTitle: DORHAIN_SAGA_TITLE,
    characters: [
      { id: 'dh-ch-warrior', publicId: 'CH-DHW01', displayName: 'Brenna Steelsong', archetype: 'warrior' },
      { id: 'dh-ch-scout', publicId: 'CH-DHS01', displayName: 'Kael Softstep', archetype: 'scout' },
      { id: 'dh-ch-diplomat', publicId: 'CH-DHD01', displayName: 'Seris Vale', archetype: 'diplomat' },
      { id: 'dh-ch-mystic', publicId: 'CH-DHM01', displayName: 'Orrin Ashveil', archetype: 'mystic' },
    ],
    monsters: [
      { id: 'dh-mon-wolf', publicId: 'MN-DHW01', displayName: 'Dornhain Timber Wolf' },
      { id: 'dh-mon-bandit', publicId: 'MN-DHB01', displayName: 'Whisper Road Bandit' },
    ],
    itemDefinitionIds: ['dh-item-torch', 'dh-item-rations', 'dh-item-shortsword'],
    npcPublicIds: ['NPCC-DHG01', 'NPCC-DHM01'],
  };
}

export type CatalogPresenceReport = {
  readonly ok: boolean;
  readonly missing: readonly string[];
};

export function assertDornhainCatalogPresent(input: {
  readonly worldTitles: readonly string[];
  readonly sagaSlugs: readonly string[];
  readonly characterIds: readonly string[];
  readonly monsterIds: readonly string[];
  readonly itemDefinitionIds: readonly string[];
  readonly npcPublicIds: readonly string[];
  readonly catalog?: DornhainCatalog;
}): CatalogPresenceReport {
  const catalog = input.catalog ?? dornhainFixtureCatalog();
  const missing: string[] = [];
  if (!input.worldTitles.includes(catalog.worldTitle)) missing.push(`world:${catalog.worldTitle}`);
  if (!input.sagaSlugs.includes(catalog.sagaSlug)) missing.push(`saga:${catalog.sagaSlug}`);
  for (const ch of catalog.characters) {
    if (!input.characterIds.includes(ch.id)) missing.push(`character:${ch.id}`);
  }
  for (const mon of catalog.monsters) {
    if (!input.monsterIds.includes(mon.id)) missing.push(`monster:${mon.id}`);
  }
  for (const itemId of catalog.itemDefinitionIds) {
    if (!input.itemDefinitionIds.includes(itemId)) missing.push(`item:${itemId}`);
  }
  for (const npcId of catalog.npcPublicIds) {
    if (!input.npcPublicIds.includes(npcId)) missing.push(`npc:${npcId}`);
  }
  return { ok: missing.length === 0, missing };
}

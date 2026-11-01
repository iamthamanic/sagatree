/**
 * Cutover drills (MIG-700+). Location: server/src/migration/cutover/index.ts
 */
export {
  DORHAIN_SLUG,
  DORHAIN_WORLD_TITLE,
  DORHAIN_SAGA_TITLE,
  dornhainFixtureCatalog,
  assertDornhainCatalogPresent,
  type DornhainCatalog,
  type DornhainCharacter,
  type DornhainMonster,
  type CatalogPresenceReport,
} from './dornhain-catalog.ts';

export {
  runDornhainCutoverDrill,
  type DornhainDrillInput,
  type DornhainDrillReport,
} from './dornhain-drill.ts';

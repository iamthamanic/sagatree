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
  applyDornhainCatalogToHost,
  type DornhainDrillInput,
  type DornhainDrillReport,
} from './dornhain-drill.ts';

export {
  captureParitySnapshot,
  compareParitySnapshots,
  seedDornhainParityAuthority,
  runDornhainParityWindowDrill,
  archiveParityRollbackDecision,
  type ProjectionRow,
  type ParityDiscrepancy,
  type ParityCompareReport,
  type ParityRollbackArchive,
  type ParityWindowReport,
} from './parity-window.ts';

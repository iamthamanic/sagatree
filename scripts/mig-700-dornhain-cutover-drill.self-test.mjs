#!/usr/bin/env node
/**
 * mig-700-dornhain-cutover-drill.self-test — Freeze/import/rollback with Dornhain hard req (#849).
 * Location: scripts/mig-700-dornhain-cutover-drill.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const cutoverUrl = pathToFileURL(join(root, 'server/src/migration/cutover/index.ts')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const {
  runDornhainCutoverDrill,
  dornhainFixtureCatalog,
  assertDornhainCatalogPresent,
  DORHAIN_WORLD_TITLE,
  DORHAIN_SLUG,
} = await import(cutoverUrl);

function boot(label) {
  const work = mkdtempSync(join(tmpdir(), `mig700-${label}-`));
  const dataDir = join(work, 'data');
  mkdirSync(dataDir);
  const result = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(result.ok, `bootstrap ${label}`);
  return { work, dataDir, db: result.db };
}

// --- unit: catalog presence helper ---
{
  const catalog = dornhainFixtureCatalog();
  const miss = assertDornhainCatalogPresent({
    worldTitles: [],
    sagaSlugs: [],
    characterIds: [],
    monsterIds: [],
    itemDefinitionIds: [],
    npcPublicIds: [],
    catalog,
  });
  assert(!miss.ok && miss.missing.length > 0, 'empty host must miss Dornhain catalog');
  const hit = assertDornhainCatalogPresent({
    worldTitles: [DORHAIN_WORLD_TITLE],
    sagaSlugs: [DORHAIN_SLUG],
    characterIds: catalog.characters.map((c) => c.id),
    monsterIds: catalog.monsters.map((m) => m.id),
    itemDefinitionIds: [...catalog.itemDefinitionIds],
    npcPublicIds: [...catalog.npcPublicIds],
    catalog,
  });
  assert(hit.ok, 'full catalog must pass');
}

const source = boot('src');
const target = boot('dst');

try {
  const report = runDornhainCutoverDrill({
    sourceDb: source.db,
    targetDb: target.db,
    targetDataDir: target.dataDir,
    sourceOwnerUserId: 'owner-dornhain',
    restoreOwnerUserId: 'restore-dornhain',
    strangerUserId: 'stranger-x',
  });
  assert(report.ok, `drill failed: ${report.ok ? '' : report.error}`);
  assert(report.value.phase === 'rollback-ok', 'phase rollback-ok');
  assert(report.value.strangerWorldCount === 0, 'stranger must own zero worlds');
  assert(report.value.writerDuringFreeze === 'owner-dornhain', 'single writer during freeze');
  assert(report.value.competingWriteExcluded === true, 'stranger competing write excluded from freeze');
  assert(report.value.restoreOwnerCanAccessWorld === true, 'restore owner policy allow');
  assert(report.value.strangerCanAccessWorld === false, 'stranger policy deny');
  assert(report.value.missingAfterImport.length === 0, 'no missing after import');
  assert(report.value.missingAfterRollback.length === 0, 'no missing after rollback');
  assert(existsSync(report.value.catalogPath), 'catalog sidecar written');
  assert(report.value.payloadChecksum.length >= 32, 'payload checksum');

  // Authoritative host tables after rollback (not bundle echo).
  const chars = target.db.prepare('SELECT id FROM characters').all();
  assert(chars.length >= 4, 'characters table restored');
  const items = target.db.prepare('SELECT id FROM inventory_item_definitions').all();
  assert(items.length >= 3, 'item definitions restored');
  const defs = target.db.prepare('SELECT id FROM npc_creature_definitions').all();
  assert(defs.length >= 4, 'npc/monster defs restored');
  const corrupted = target.db.prepare(`SELECT COUNT(*) AS c FROM worlds WHERE title = 'CORRUPTED'`).get();
  assert(corrupted.c === 0, 'poisoned title gone after rollback onto target');

  // Ops docs present
  assert(existsSync(join(root, 'docs/ops/cutover/README.md')), 'cutover README');
  assert(existsSync(join(root, 'docs/ops/cutover/dornhain-pilot.md')), 'dornhain pilot doc');
  assert(
    existsSync(join(root, 'docs/architecture/migration-owner-release-2026-11-01-dornhain.md')),
    'owner release doc',
  );
  const approvals = JSON.parse(
    readFileSync(join(root, '.qa/evidence/stack-migration-prep/architecture-approvals.json'), 'utf8'),
  );
  assert(
    approvals.releases?.['CUTOVER-DORHAIN']?.status === 'APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF',
    'CUTOVER-DORHAIN approval registered',
  );
  assert(
    ['APPROVED_TO_EXECUTE', 'APPROVED'].includes(approvals.decisions['GATE-05']?.status),
    'GATE-05 execute or full APPROVED',
  );

  console.log('PASS: mig-700 dornhain cutover drill (freeze/import/rollback + hard catalog)');
} finally {
  source.db.close?.();
  target.db.close?.();
  rmSync(source.work, { recursive: true, force: true });
  rmSync(target.work, { recursive: true, force: true });
}

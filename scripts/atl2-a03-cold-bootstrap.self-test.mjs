#!/usr/bin/env node
/**
 * ATL2-A03 cold bootstrap — six-level Golden hierarchy on fresh ensure.
 * Location: scripts/atl2-a03-cold-bootstrap.self-test.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const ensureUrl = pathToFileURL(join(root, 'server/src/bootstrap/ensure-dornhain-default.ts')).href;
const seedUrl = pathToFileURL(
  join(root, 'server/src/bootstrap/dornhain-golden-hierarchy-seed.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { ensureDornhainDefaultCatalog } = await import(ensureUrl);
const {
  DORHAIN_GOLDEN_MAP_SEEDS,
  DORHAIN_GOLDEN_PLACE_SEEDS,
  DORHAIN_UNIFIED_SEED,
} = await import(seedUrl);

const EXPECTED_MAP_SEEDS = [
  DORHAIN_UNIFIED_SEED,
  ...DORHAIN_GOLDEN_MAP_SEEDS.map((m) => m.seedKey),
];

const work = mkdtempSync(join(tmpdir(), 'atl2-a03-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert.equal(boot.ok, true, `bootstrap: ${boot.ok ? '' : boot.error}`);
  const db = boot.db;
  const owner = `solo-atl2-a03-${randomUUID().slice(0, 8)}`;

  const first = ensureDornhainDefaultCatalog(db, owner);
  assert.ok(first.worldId, 'worldId');
  assert.equal(first.seeded, true, 'fresh seed');

  function mapsBySeed(worldId) {
    const rows = db
      .prepare(
        `SELECT id, parent_map_id, title, kind, generator_meta
         FROM world_atlas_maps WHERE world_profile_id = ?`,
      )
      .all(worldId);
    const bySeed = new Map();
    for (const row of rows) {
      let seed = null;
      try {
        const meta = JSON.parse(row.generator_meta);
        seed = typeof meta.seed === 'string' ? meta.seed : null;
      } catch {
        seed = null;
      }
      if (seed) bySeed.set(seed, row);
    }
    return { rows, bySeed };
  }

  const afterFirst = mapsBySeed(first.worldId);
  assert.equal(
    afterFirst.bySeed.size >= EXPECTED_MAP_SEEDS.length,
    true,
    `expected ≥${EXPECTED_MAP_SEEDS.length} seeded maps, got ${afterFirst.bySeed.size}`,
  );
  for (const seed of EXPECTED_MAP_SEEDS) {
    assert.ok(afterFirst.bySeed.has(seed), `missing map seed ${seed}`);
  }

  const worldRoot = afterFirst.bySeed.get(DORHAIN_UNIFIED_SEED);
  assert.equal(worldRoot.parent_map_id, null, 'world root parent null');
  assert.equal(worldRoot.title, 'Welt');

  for (const spec of DORHAIN_GOLDEN_MAP_SEEDS) {
    const row = afterFirst.bySeed.get(spec.seedKey);
    const parentSeed = spec.parentMapSeedKey ?? DORHAIN_UNIFIED_SEED;
    const parentRow = afterFirst.bySeed.get(parentSeed);
    assert.ok(parentRow, `parent seed present ${parentSeed}`);
    assert.equal(row.parent_map_id, parentRow.id, `${spec.seedKey} parent chain`);
    const meta = JSON.parse(row.generator_meta);
    assert.equal(meta.golden, true, `${spec.seedKey} golden`);
    assert.ok(
      Array.isArray(meta.unifiedCanvas?.rooms) && meta.unifiedCanvas.rooms.length >= 1,
      `${spec.seedKey} non-empty canvas`,
    );
    assert.equal(
      meta.mapFrame?.parentAnchor?.parentMapId,
      parentRow.id,
      `${spec.seedKey} frame`,
    );
  }
  const dornhainMap = afterFirst.bySeed.get('dornhain.map.place.dornhain');

  const places = db
    .prepare(
      `SELECT id, seed_key, parent_place_id, name FROM world_places WHERE world_profile_id = ?`,
    )
    .all(first.worldId);
  const placeBySeed = new Map(places.map((p) => [p.seed_key, p]));
  for (const spec of DORHAIN_GOLDEN_PLACE_SEEDS) {
    assert.ok(placeBySeed.has(spec.seedKey), `place ${spec.seedKey}`);
    const row = placeBySeed.get(spec.seedKey);
    if (spec.parentSeedKey === null) {
      assert.equal(row.parent_place_id, null, `${spec.seedKey} root place`);
    } else {
      assert.equal(
        row.parent_place_id,
        placeBySeed.get(spec.parentSeedKey).id,
        `${spec.seedKey} place parent`,
      );
    }
  }

  const primaryLinks = db
    .prepare(
      `SELECT COUNT(*) AS c FROM world_place_map_links
       WHERE world_profile_id = ? AND usage = 'primary'`,
    )
    .get(first.worldId);
  assert.ok(primaryLinks.c >= 5, `primary links ≥5 got ${primaryLinks.c}`);

  // User non-Golden map must survive re-ensure
  const userMapId = randomUUID();
  db.prepare(
    `INSERT INTO world_atlas_maps (
       id, world_profile_id, parent_map_id, kind, title, sort_order,
       bounds, layers, generator_meta, revision, created_at, updated_at
     ) VALUES (?, ?, ?, 'scene', 'User Custom Crypt', 99, ?, ?, ?, 1, ?, ?)`,
  ).run(
    userMapId,
    first.worldId,
    dornhainMap.id,
    JSON.stringify({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }),
    JSON.stringify({ type: 'FeatureCollection', features: [] }),
    JSON.stringify({ engine: 'unified_canvas', seed: 'user.custom.crypt', golden: false }),
    new Date().toISOString(),
    new Date().toISOString(),
  );

  const second = ensureDornhainDefaultCatalog(db, owner);
  assert.equal(second.seeded, false, 'idempotent ensure');
  assert.equal(second.worldId, first.worldId);

  const afterSecond = mapsBySeed(second.worldId);
  assert.ok(afterSecond.bySeed.has('user.custom.crypt'), 'user map preserved');
  assert.equal(
    afterSecond.rows.filter((r) => {
      try {
        return JSON.parse(r.generator_meta).seed === 'dornhain.map.continent.westmark';
      } catch {
        return false;
      }
    }).length,
    1,
    'no duplicate Golden continent',
  );
  for (const seed of EXPECTED_MAP_SEEDS) {
    assert.ok(afterSecond.bySeed.has(seed), `still has ${seed}`);
  }

  // Source contracts
  const ensureSrc = readFileSync(
    join(root, 'server/src/bootstrap/ensure-dornhain-default.ts'),
    'utf8',
  );
  assert.match(ensureSrc, /seedDornhainGoldenHierarchy/);
  const seedSrc = readFileSync(
    join(root, 'server/src/bootstrap/dornhain-golden-hierarchy-seed.ts'),
    'utf8',
  );
  assert.match(seedSrc, /dornhain\.map\.loc\.crypt/);
  assert.match(seedSrc, /continent\.westmark/);

  const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
  assert.match(gate, /atl2-a03-cold-bootstrap\.self-test\.mjs/);

  const acceptance = readFileSync(
    join(root, '.qa/acceptance/atl2-a03-cold-bootstrap.md'),
    'utf8',
  );
  assert.match(acceptance, /ATL2-A03/);

  console.log('atl2-a03-cold-bootstrap self-test: PASS');
} finally {
  rmSync(work, { recursive: true, force: true });
}

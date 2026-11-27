#!/usr/bin/env node
/**
 * ATL2-H03 — Golden-E2E guards (#1236).
 * Location: scripts/atl2-h03-golden-e2e.self-test.mjs
 *
 * Locks: frozen Golden names (Welt → Kontinent Westmark → Nordreich → Dornhain →
 * Taverne Zum Flüstern / Krypta unter dem Hügel) identical in FE domain, host seed and G04
 * fixtures; stable seed keys/ids unchanged (display rename only); existing worlds get the
 * frozen title on bootstrap without touching authored canvases or user-renamed maps; the
 * Golden journey Browser E2E keeps its coverage contract and restores Golden.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const FROZEN = ['Kontinent Westmark', 'Nordreich', 'Dornhain', 'Taverne Zum Flüstern', 'Krypta unter dem Hügel'];
const LEGACY = 'Land Westmark';

// 1) FE domain Golden maps + G04 fixtures preserve all frozen titles in order; seed keys unchanged.
const fe = jiti(join(root, 'src/domains/world/atlas/dornhain-golden-hierarchy.ts'));
const feTitles = fe.DORNHAIN_GOLDEN_MAPS.map((m) => m.title);
assert.deepEqual(
  feTitles.filter((t) => FROZEN.includes(t)),
  FROZEN,
  'FE Golden map titles preserve frozen reference order',
);
const feCountry = fe.DORNHAIN_GOLDEN_MAPS.find((m) => m.title === 'Nordreich');
assert.equal(feCountry.seedKey, 'dornhain.map.country.westmark', 'seed key stays (no data migration)');
const visual = jiti(join(root, 'src/domains/world/atlas/atlas-golden-visual.ts'));
const fixtures = visual.ATLAS_GOLDEN_VISUAL_FIXTURES;
assert.ok(Array.isArray(fixtures), 'G04 fixture list exported');
const countryFixture = fixtures.find((f) => f.id === 'country');
assert.equal(countryFixture.uiMapTitleDe, 'Nordreich', 'G04 country fixture title');
assert.ok(!JSON.stringify(fixtures.map((f) => [f.labelDe, f.uiMapTitleDe])).includes(LEGACY), 'no legacy name in G04');

// 2) Host seed mirrors the FE titles 1:1 (host must not import FE code).
const seedUrl = pathToFileURL(join(root, 'server/src/bootstrap/dornhain-golden-hierarchy-seed.ts')).href;
const seed = await import(seedUrl);
assert.deepEqual(seed.DORHAIN_GOLDEN_MAP_SEEDS.map((m) => m.title), feTitles, 'host Golden map titles match FE 1:1');
const countryPlace = seed.DORHAIN_GOLDEN_PLACE_SEEDS.find((p) => p.seedKey === 'country.westmark');
assert.equal(countryPlace.name, 'Nordreich');
assert.equal(countryPlace.stableId, 'dh-place-country-westmark', 'stable place id unchanged');
assert.deepEqual(seed.DORHAIN_GOLDEN_LEGACY_MAP_TITLES['dornhain.map.country.westmark'], [LEGACY]);

// 3) No stray legacy display name in shipped code / tests (legacy list + rename comment excepted).
function walk(dir) {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(root, rel));
    if (st.isDirectory()) {
      if (name === 'node_modules' || name.endsWith('-snapshots')) continue;
      out.push(...walk(rel));
    } else if (/\.(tsx?|mjs)$/.test(name)) out.push(rel);
  }
  return out;
}
const SELF = 'scripts/atl2-h03-golden-e2e.self-test.mjs';
const ALLOWED = new Set([
  SELF,
  'e2e/atl2-h03-golden-journey.spec.ts', // asserts the legacy name is gone
  'server/src/bootstrap/dornhain-golden-hierarchy-seed.ts',
  'src/domains/world/atlas/dornhain-golden-hierarchy.ts',
]);
const stray = ['src', 'server/src', 'e2e', 'scripts']
  .flatMap(walk)
  .filter((f) => !ALLOWED.has(f) && read(f).includes(LEGACY));
assert.deepEqual(stray, [], 'legacy Golden name only in the documented rename spots');

// 4) Existing world: legacy title → frozen title; canvas + user renames untouched.
const { bootstrapHostPersistence } = await import(pathToFileURL(join(root, 'server/src/persistence/index.ts')).href);
const { ensureDornhainDefaultCatalog } = await import(
  pathToFileURL(join(root, 'server/src/bootstrap/ensure-dornhain-default.ts')).href
);
const work = mkdtempSync(join(tmpdir(), 'atl2-h03-'));
mkdirSync(join(work, 'data'));
try {
  const boot = bootstrapHostPersistence({ dataDir: join(work, 'data'), migrationsDir: join(root, 'server/migrations') });
  assert.equal(boot.ok, true, 'host bootstrap');
  const db = boot.db;
  const owner = `solo-atl2-h03-${randomUUID().slice(0, 8)}`;
  const first = ensureDornhainDefaultCatalog(db, owner);
  const bySeed = () => {
    const m = new Map();
    for (const r of db
      .prepare('SELECT id, title, generator_meta, revision FROM world_atlas_maps WHERE world_profile_id = ?')
      .all(first.worldId)) {
      const s = JSON.parse(r.generator_meta).seed;
      if (typeof s === 'string') m.set(s, r);
    }
    return m;
  };
  const fresh = bySeed();
  assert.equal(fresh.get('dornhain.map.country.westmark').title, 'Nordreich', 'fresh world title');
  // Simulate a pre-freeze world + a user-renamed Golden map.
  const country = fresh.get('dornhain.map.country.westmark');
  const crypt = fresh.get('dornhain.map.loc.crypt');
  db.prepare('UPDATE world_atlas_maps SET title = ? WHERE id = ?').run(LEGACY, country.id);
  db.prepare('UPDATE world_atlas_maps SET title = ? WHERE id = ?').run('Meine Krypta', crypt.id);
  db.prepare("UPDATE world_places SET name = ? WHERE world_profile_id = ? AND seed_key = 'country.westmark'").run(
    LEGACY,
    first.worldId,
  );
  const canvasBefore = db.prepare('SELECT generator_meta FROM world_atlas_maps WHERE id = ?').get(country.id).generator_meta;
  ensureDornhainDefaultCatalog(db, owner);
  const after = bySeed();
  assert.equal(after.get('dornhain.map.country.westmark').title, 'Nordreich', 'legacy title migrated');
  assert.equal(after.get('dornhain.map.country.westmark').generator_meta, canvasBefore, 'canvas untouched');
  assert.equal(after.get('dornhain.map.loc.crypt').title, 'Meine Krypta', 'user rename preserved');
  const place = db
    .prepare("SELECT name FROM world_places WHERE world_profile_id = ? AND seed_key = 'country.westmark'")
    .get(first.worldId);
  assert.equal(place.name, 'Nordreich', 'place name refreshed on bootstrap');
  db.close();
} finally {
  rmSync(work, { recursive: true, force: true });
}

// 5) Golden journey Browser E2E coverage contract.
const SPEC = 'e2e/atl2-h03-golden-journey.spec.ts';
assert.ok(existsSync(join(root, SPEC)), 'Golden journey spec');
const spec = read(SPEC);
for (const needle of [
  "country: 'Nordreich'",
  "continent: 'Kontinent Westmark'",
  'room-schankraum',
  'room-gruftkammer',
  'data-atlas-dungeon-generate',
  "toSurface(page, '2d')",
  'page.reload()',
  'data-atlas-undo',
  'data-atlas-redo',
  'data-world-atlas-hierarchy-back',
  'toBe(409)',
  'setOffline(true)',
  'player1@sagatree.local',
  "name: 'phone'",
  "name: 'tablet'",
  'resetToGolden(page)',
  'software-webgl',
]) {
  assert.ok(spec.includes(needle), `journey covers ${needle}`);
}
const helper = read('e2e/helpers/atlas-host.ts');
for (const fn of ['focusAtlasNavTitle', 'openAtlasWorldRoot', 'atlasWorldId']) {
  assert.ok(helper.includes(`export async function ${fn}`), `shared helper ${fn}`);
}
for (const doc of ['.qa/acceptance/atl2-h03.md', '.qa/design/atl2-h03-golden-e2e.md']) {
  assert.ok(existsSync(join(root, doc)), doc);
}
assert.ok(read('.qa/design/atl2-h03-golden-e2e.md').includes('#1302'), 'design notes V01 conflict risk');

console.log('atl2-h03-golden-e2e.self-test: OK');

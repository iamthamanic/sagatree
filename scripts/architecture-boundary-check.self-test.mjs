#!/usr/bin/env node
/**
 * architecture-boundary-check.self-test — Deterministic fixtures for boundary rules.
 * Location: scripts/architecture-boundary-check.self-test.mjs
 */
import process from 'node:process';
import {
  checkAllowedSrcCodeRoots,
  checkAppCrossAreaImports,
  checkAppRootEntryConsumers,
  checkCharacterCrossSliceImports,
  checkCompositionRootImports,
  checkContentImportPaths,
  checkEradicatedLegacyRoots,
  checkLegacyFreeze,
  checkRegisteredHostPackages,
  checkHostDrizzlePersistenceBoundaries,
  matchPathPattern,
  extractImportPaths,
  findDirectedCycles,
  resolveRelativeImport,
  resolveServerImport,
  runArchitectureBoundaryCheck,
} from './architecture-boundary-check.mjs';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function assertViolation(label, filePath, content, expectedRuleFragment) {
  const violations = checkCharacterCrossSliceImports(filePath, content);
  assert(
    violations.some((entry) => entry.rule.includes(expectedRuleFragment)),
    `${label}: expected violation containing "${expectedRuleFragment}", got ${JSON.stringify(violations)}`,
  );
}

function assertNoCrossSliceViolation(label, filePath, content) {
  const violations = checkCharacterCrossSliceImports(filePath, content);
  assert(violations.length === 0, `${label}: expected no cross-slice violations, got ${JSON.stringify(violations)}`);
}

assertViolation(
  'private cross-slice import (slice root)',
  '/repo/src/app/character/edit/CharacterEditor.tsx',
  "import { Foo } from '../creation/CharacterArchetypePanel';",
  'private cross-slice import',
);

assertViolation(
  'private cross-slice import (nested file)',
  '/repo/src/app/character/edit/components/Header.tsx',
  "import { Foo } from '../../creation/CharacterArchetypePanel';",
  'private cross-slice import',
);

assertNoCrossSliceViolation(
  'public slice import (slice root)',
  '/repo/src/app/character/edit/CharacterEditor.tsx',
  "import { CharacterArchetypePanel } from '../creation';",
);

assertNoCrossSliceViolation(
  'public slice import (nested file)',
  '/repo/src/app/character/edit/components/Header.tsx',
  "import { CharacterArchetypePanel } from '../../creation';",
);

assertViolation(
  'slice barrel private re-export',
  '/repo/src/app/character/progression/index.ts',
  "export { Foo } from '../creation/CharacterArchetypePanel';",
  'private cross-slice import',
);

assertNoCrossSliceViolation(
  'slice barrel own-slice re-export',
  '/repo/src/app/character/creation/index.ts',
  "export { CharacterArchetypePanel } from './CharacterArchetypePanel';",
);

assertNoCrossSliceViolation(
  'slice barrel allowed public re-export',
  '/repo/src/app/character/edit/index.ts',
  "export { CharacterArchetypePanel } from '../creation';",
);

assertNoCrossSliceViolation(
  'slice barrel inventory non-slice path',
  '/repo/src/app/character/progression/index.ts',
  "export { CharacterInventoryV2Panel } from '../inventory/CharacterInventoryV2Panel';",
);

const dynamicSupabase = "const client = await import('../../../lib/supabase');";
const appDynamicViolations = checkContentImportPaths(
  dynamicSupabase,
  [
    { label: 'Supabase client', test: (p) => p.includes('supabase') },
    { label: 'Supabase lib', test: (p) => /(?:^|\/)lib\/supabase(?:\.|$)/.test(p) },
  ],
  'app',
  'src/app/character/edit/CharacterEditor.tsx',
);
assert(
  appDynamicViolations.some((entry) => entry.rule.includes('Supabase')),
  `dynamic supabase import should fail, got ${JSON.stringify(appDynamicViolations)}`,
);

assert(
  extractImportPaths(dynamicSupabase).includes('../../../lib/supabase'),
  'extractImportPaths should capture dynamic imports',
);

assert(
  resolveRelativeImport('/repo/src/app/character/edit/components/Panel.tsx', '../../creation/Foo').endsWith(
    'app/character/creation/Foo',
  ),
  'resolveRelativeImport should normalize nested cross-slice paths',
);

const domainReactViolations = checkContentImportPaths(
  "import { useState } from 'react';",
  [{ label: 'React', test: (p) => /^react(?:\/|$)/.test(p) }],
  'domains',
  'src/domains/character/example.ts',
);
assert(domainReactViolations.length === 1, 'domain React import should fail');

const domainSharedUiRules = [
  { label: 'UI components', test: (p) => p.includes('/components/') },
  { label: 'Shared UI', test: (p) => /(?:^|\/)shared\/ui(?:\/|$)/.test(p) || p.includes('@/shared/ui') },
];
assert(
  checkContentImportPaths(
    "import { Button } from '../../shared/ui/button';",
    domainSharedUiRules,
    'domains',
    'src/domains/character/example.ts',
  ).some((v) => v.rule === 'Shared UI'),
  'domain → shared/ui relative must fail',
);
assert(
  checkContentImportPaths(
    "import { Button } from '@/shared/ui/button';",
    domainSharedUiRules,
    'domains',
    'src/domains/character/example.ts',
  ).some((v) => v.rule === 'Shared UI'),
  'domain → @/shared/ui must fail',
);

assert(
  extractImportPaths("const m = await import(`@/app/project/hooks/useProjects`);").includes(
    '@/app/project/hooks/useProjects',
  ),
  'extractImportPaths should capture static template-literal dynamic imports',
);
assert(
  !extractImportPaths("const m = await import(`@/app/${name}`);").length,
  'extractImportPaths should ignore interpolated template dynamic imports',
);

assert(
  checkLegacyFreeze(
    ['src/modules/characters/foo.ts', 'src/modules/characters/bar.ts'],
    ['src/modules/characters/foo.ts'],
  ).some((v) => v.file === 'src/modules/characters/bar.ts'),
  'legacy freeze must reject paths absent from baseline',
);

assert(
  checkLegacyFreeze(['src/modules/characters/foo.ts'], [
    'src/modules/characters/foo.ts',
    'src/modules/characters/old.ts',
  ]).length === 0,
  'legacy freeze must allow deletions relative to baseline',
);

assert(
  checkLegacyFreeze(['src/components/BrandNewScreen.tsx'], []).some((v) =>
    v.file.includes('BrandNewScreen'),
  ),
  'legacy freeze must reject new feature screens under src/components/**',
);

assert(
  checkEradicatedLegacyRoots().length === 0,
  'live repo must not contain src/modules or src/components',
);

const privateCrossArea = checkAppCrossAreaImports(
  '/repo/src/app/character/edit/CharacterBackgroundComposer.tsx',
  "import { useProjects } from '../../project/hooks/useProjects';",
);
assert(
  privateCrossArea.some((v) => v.rule.includes('private cross-area import')),
  `private cross-area import must fail, got ${JSON.stringify(privateCrossArea)}`,
);

const aliasPrivateCrossArea = checkAppCrossAreaImports(
  '/repo/src/app/character/edit/CharacterBackgroundComposer.tsx',
  "import { useProjects } from '@/app/project/hooks/useProjects';",
);
assert(
  aliasPrivateCrossArea.some((v) => v.rule.includes('private cross-area import')),
  `@/ alias private cross-area import must fail, got ${JSON.stringify(aliasPrivateCrossArea)}`,
);

const publicCrossArea = checkAppCrossAreaImports(
  '/repo/src/app/character/edit/CharacterBackgroundComposer.tsx',
  "import { useProjects } from '../../project';",
);
assert(
  publicCrossArea.length === 0,
  `public area barrel must pass, got ${JSON.stringify(publicCrossArea)}`,
);

const aliasPublicCrossArea = checkAppCrossAreaImports(
  '/repo/src/app/character/edit/CharacterBackgroundComposer.tsx',
  "import { useProjects } from '@/app/project';",
);
assert(
  aliasPublicCrossArea.length === 0,
  `@/ public area barrel must pass, got ${JSON.stringify(aliasPublicCrossArea)}`,
);

const areaBarrelPrivateCross = checkAppCrossAreaImports(
  '/repo/src/app/character/index.ts',
  "export { useProjects } from '../project/hooks/useProjects';",
);
assert(
  areaBarrelPrivateCross.some((v) => v.rule.includes('private cross-area import')),
  `area barrel must not re-export other areas' private paths, got ${JSON.stringify(areaBarrelPrivateCross)}`,
);

const areaBarrelOwnInternals = checkAppCrossAreaImports(
  '/repo/src/app/character/index.ts',
  "export { useCharacters } from './list';",
);
assert(
  areaBarrelOwnInternals.length === 0,
  `area barrel may re-export own internals, got ${JSON.stringify(areaBarrelOwnInternals)}`,
);

const areaBarrelPublicCross = checkAppCrossAreaImports(
  '/repo/src/app/character/index.ts',
  "export { useProjects } from '../project';",
);
assert(
  areaBarrelPublicCross.length === 0,
  `area barrel may re-export other areas via public barrel, got ${JSON.stringify(areaBarrelPublicCross)}`,
);

const fixtureRoot = mkdtempSync(join(tmpdir(), 'arch-allowlist-'));
mkdirSync(join(fixtureRoot, 'src/features'), { recursive: true });
writeFileSync(join(fixtureRoot, 'src/features/dump.ts'), 'export const x = 1;\n');
mkdirSync(join(fixtureRoot, 'src/domains'), { recursive: true });
writeFileSync(join(fixtureRoot, 'src/domains/ok.ts'), 'export const y = 1;\n');
writeFileSync(join(fixtureRoot, 'src/NewCharacterService.ts'), 'export const z = 1;\n');
writeFileSync(join(fixtureRoot, 'src/App.tsx'), 'export {};\n');
const allowlistHits = checkAllowedSrcCodeRoots(fixtureRoot);
assert(
  allowlistHits.some((v) => v.file === 'src/features' && v.rule.includes('allowlist')),
  `unknown src root must fail, got ${JSON.stringify(allowlistHits)}`,
);
assert(
  allowlistHits.some((v) => v.file === 'src/NewCharacterService.ts'),
  `unknown top-level src file must fail, got ${JSON.stringify(allowlistHits)}`,
);
assert(
  !allowlistHits.some((v) => v.file === 'src/App.tsx' || v.file === 'src/domains'),
  'allowed roots/files must not be flagged',
);

const compositionPrivate = checkCompositionRootImports(
  '/repo/src/App.tsx',
  "import { CharacterEditor } from './app/character/edit/CharacterEditor';",
);
assert(
  compositionPrivate.some((v) => v.rule.includes('composition root private app import')),
  `composition root private path must fail, got ${JSON.stringify(compositionPrivate)}`,
);

const compositionPublic = checkCompositionRootImports(
  '/repo/src/App.tsx',
  [
    "import { Dashboard } from './app/dashboard';",
    "import { AuthGate } from './app/shell';",
    "const X = lazy(() => import('./app/character/root'));",
    "const Y = lazy(() => import('./app/library/root'));",
  ].join('\n'),
);
assert(
  compositionPublic.length === 0,
  `composition root barrels/roots must pass, got ${JSON.stringify(compositionPublic)}`,
);

const nonRootUsingRoot = checkAppRootEntryConsumers(
  '/repo/src/app/dashboard/Dashboard.tsx',
  "import { CharacterEditor } from '../character/root';",
);
assert(
  nonRootUsingRoot.some((v) => v.rule.includes('composition-root only')),
  `non-composition consumers of /root must fail, got ${JSON.stringify(nonRootUsingRoot)}`,
);

const live = runArchitectureBoundaryCheck();
assert(live.violations.length === 0, `live repo should pass, got ${JSON.stringify(live.violations)}`);
assert(
  typeof live.counts.legacyBaseline === 'number' && live.counts.legacyBaseline > 0,
  'live check must load legacy freeze baseline',
);
assert(
  live.counts.legacyCurrent <= live.counts.legacyBaseline,
  'live legacy path count must not exceed baseline',
);

// --- Host modular monolith (Epic #773 / MIG-010) ---
assert(
  resolveServerImport(
    'server/src/modules/session/internal/action.ts',
    '../../world/persistence/repo.js',
  ) === 'server/src/modules/world/persistence/repo',
  'resolveServerImport must resolve relative private paths across modules',
);

assert(
  findDirectedCycles(
    new Map([
      ['session', new Set(['world'])],
      ['world', new Set(['session'])],
    ]),
  ).some((cycle) => cycle.includes('session') && cycle.includes('world')),
  'findDirectedCycles must detect session↔world',
);

const hostFixture = mkdtempSync(join(tmpdir(), 'host-mod-'));
function writeHost(rel, body) {
  const abs = join(hostFixture, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body);
}
writeHost('server/README.md', 'See docs/architecture/host-modular-monolith.md\n');
writeHost('server/src/modules/world/persistence/repo.ts', 'export const worldRepo = 1;\n');
writeHost('server/src/modules/world/index.ts', "export { worldRepo as world } from './persistence/repo.js';\n");
writeHost(
  'server/src/modules/session/internal/action.ts',
  "import { worldRepo } from '../../world/persistence/repo.js';\nexport const action = worldRepo;\n",
);
writeHost('server/src/modules/session/index.ts', "export { world } from '../world/index.js';\n");
writeHost('server/src/http/debug.ts', "import { worldRepo } from '../modules/world/persistence/repo.js';\nexport const d = worldRepo;\n");
// Make the cycle mutual: world public barrel also imports session.
writeHost('server/src/modules/world/index.ts', "export { session } from '../session/index.js';\nexport const world = 1;\n");
writeHost('server/src/modules/session/index.ts', "export { world } from '../world/index.js';\nexport const session = 1;\n");

const hostViolations = checkRegisteredHostPackages(hostFixture);
assert(
  hostViolations.some(
    (v) =>
      v.file.includes('session/internal/action') &&
      /private path of world|forbidden private module import/.test(v.rule),
  ),
  `relative cross-module private import must fail, got ${JSON.stringify(hostViolations)}`,
);
assert(
  hostViolations.some((v) => /forbidden module dependency cycle/.test(v.rule)),
  `public session↔world cycle must fail, got ${JSON.stringify(hostViolations)}`,
);
assert(
  hostViolations.some(
    (v) => v.file.includes('http/debug') && /forbidden private module import|private path of world/.test(v.rule),
  ),
  `non-composition http/debug private import must fail, got ${JSON.stringify(hostViolations)}`,
);
rmSync(hostFixture, { recursive: true, force: true });

const hostOk = mkdtempSync(join(tmpdir(), 'host-ok-'));
function writeOk(rel, body) {
  const abs = join(hostOk, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body);
}
writeOk('server/README.md', 'host-modular-monolith contract\n');
writeOk('server/src/modules/world/persistence/repo.ts', 'export const worldRepo = 1;\n');
writeOk('server/src/modules/world/index.ts', "export { worldRepo as readWorld } from './persistence/repo.js';\n");
writeOk(
  'server/src/modules/session/internal/action.ts',
  "import { readWorld } from '../index.js';\nexport const action = readWorld;\n",
);
writeOk(
  'server/src/modules/session/index.ts',
  "import { readWorld } from '../world/index.js';\nexport const session = readWorld;\n",
);
writeOk(
  'server/src/http/route-registry.ts',
  "import { worldRepo } from '../modules/world/persistence/repo.js';\nexport const routes = worldRepo;\n",
);
writeOk(
  'server/src/bootstrap/main.ts',
  "import { worldRepo } from '../modules/world/persistence/repo.js';\nexport const boot = worldRepo;\n",
);
const hostOkViolations = checkRegisteredHostPackages(hostOk);
assert(
  hostOkViolations.length === 0,
  `public + same-module + composition wiring must pass, got ${JSON.stringify(hostOkViolations)}`,
);
rmSync(hostOk, { recursive: true, force: true });

// --- GATE-01 drizzle / node:sqlite import boundary (#1044) ---
assert(
  matchPathPattern('server/src/persistence/host-drizzle.ts', 'server/src/persistence/**'),
  'persistence/** must match nested file',
);
assert(
  matchPathPattern(
    'server/src/modules/world/internal/world-write-store.ts',
    'server/src/modules/world/internal/world-write-store.ts',
  ),
  'grandfathered world-write-store path must match exactly',
);
assert(
  !matchPathPattern(
    'server/src/modules/session/internal/session-runtime-store.ts',
    'server/src/modules/world/internal/world-write-store.ts',
  ),
  'other internal stores must not inherit world-write allow',
);

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const liveDrizzle = checkHostDrizzlePersistenceBoundaries(repoRoot);
assert(
  liveDrizzle.length === 0,
  `live repo host drizzle boundary must PASS, got ${JSON.stringify(liveDrizzle)}`,
);

const missingPolicyFx = mkdtempSync(join(tmpdir(), 'drizzle-missing-policy-'));
const missingPolicy = checkHostDrizzlePersistenceBoundaries(missingPolicyFx);
assert(
  missingPolicy.some((v) => /missing host drizzle exceptions policy/.test(v.rule)),
  `missing policy must FAIL, got ${JSON.stringify(missingPolicy)}`,
);
rmSync(missingPolicyFx, { recursive: true, force: true });

const drizzleFx = mkdtempSync(join(tmpdir(), 'drizzle-boundary-'));
function writeFx(rel, body) {
  const abs = join(drizzleFx, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body);
}
const policy = readFileSync(join(repoRoot, '.qa/architecture/host-drizzle-exceptions.json'), 'utf8');
writeFx('.qa/architecture/host-drizzle-exceptions.json', policy);
writeFx(
  'server/package.json',
  JSON.stringify({ name: '@sagatree/host-fixture', dependencies: { 'drizzle-orm': '1.0.0-rc.5' } }, null, 2),
);
writeFx(
  'server/src/persistence/host-drizzle.ts',
  "import { drizzle } from 'drizzle-orm/node-sqlite';\nexport function createHostDatabase() { return drizzle; }\n",
);
writeFx('server/src/persistence/open-database.ts', "import { DatabaseSync } from 'node:sqlite';\nexport const open = DatabaseSync;\n");
writeFx(
  'server/src/repositories/world/read.ts',
  "import { eq } from 'drizzle-orm';\nexport const q = eq;\n",
);
writeFx(
  'server/src/modules/world/internal/world-write-store.ts',
  "import { eq } from 'drizzle-orm';\nexport const w = eq;\n",
);

const okFx = checkHostDrizzlePersistenceBoundaries(drizzleFx);
assert(okFx.length === 0, `valid drizzle fixture must PASS, got ${JSON.stringify(okFx)}`);

writeFx(
  'server/src/application/health/index.ts',
  "import { drizzle } from 'drizzle-orm/node-sqlite';\nexport const leak = drizzle;\n",
);
const httpBypass = checkHostDrizzlePersistenceBoundaries(drizzleFx);
assert(
  httpBypass.some((v) => /forbidden drizzle-orm import in zone/.test(v.rule)),
  `application drizzle import must FAIL, got ${JSON.stringify(httpBypass)}`,
);
rmSync(join(drizzleFx, 'server/src/application'), { recursive: true, force: true });

writeFx(
  'server/src/api/routes.ts',
  "import { DatabaseSync } from 'node:sqlite';\nexport const db = DatabaseSync;\n",
);
const rawBypass = checkHostDrizzlePersistenceBoundaries(drizzleFx);
assert(
  rawBypass.some((v) => /forbidden node:sqlite import in zone/.test(v.rule)),
  `api node:sqlite import must FAIL, got ${JSON.stringify(rawBypass)}`,
);
rmSync(join(drizzleFx, 'server/src/api'), { recursive: true, force: true });

writeFx(
  'server/src/modules/session/internal/session-runtime-store.ts',
  "import { eq } from 'drizzle-orm';\nexport const bad = eq;\n",
);
const foreignModule = checkHostDrizzlePersistenceBoundaries(drizzleFx);
assert(
  foreignModule.some((v) => /drizzle-orm import outside owning persistence/.test(v.rule)),
  `non-grandfathered internal store drizzle import must FAIL, got ${JSON.stringify(foreignModule)}`,
);
rmSync(join(drizzleFx, 'server/src/modules/session'), { recursive: true, force: true });

writeFx(
  'src/domains/character/x.ts',
  "export { drizzle } from 'drizzle-orm/node-sqlite';\n",
);
writeFx(
  'src/shared/ui/leak.ts',
  "const x = require('drizzle-orm');\nexport const y = x;\n",
);
const reexport = checkHostDrizzlePersistenceBoundaries(drizzleFx);
assert(
  reexport.some((v) => /forbidden drizzle-orm import in zone/.test(v.rule)),
  `domain/shared drizzle import must FAIL, got ${JSON.stringify(reexport)}`,
);
rmSync(join(drizzleFx, 'src'), { recursive: true, force: true });

writeFx(
  'server/package.json',
  JSON.stringify(
    { name: '@sagatree/host-fixture', dependencies: {}, devDependencies: { 'drizzle-orm': '1.0.0-rc.5' } },
    null,
    2,
  ),
);
const missingDep = checkHostDrizzlePersistenceBoundaries(drizzleFx);
assert(
  missingDep.some((v) => /missing runtime dependency drizzle-orm in dependencies/.test(v.rule)),
  `devDependency-only drizzle must FAIL, got ${JSON.stringify(missingDep)}`,
);

writeFx(
  'server/package.json',
  JSON.stringify({ name: '@sagatree/host-fixture', dependencies: { 'drizzle-orm': '1.0.0-rc.5' } }, null, 2),
);
writeFx(
  'server/src/persistence/host-drizzle.ts',
  "// import { drizzle } from 'drizzle-orm/node-sqlite';\nexport function createHostDatabase() { return null; }\n",
);
const commentOnly = checkHostDrizzlePersistenceBoundaries(drizzleFx);
assert(
  commentOnly.some((v) => /missing required import: drizzle-orm\/node-sqlite/.test(v.rule)),
  `comment-only proof token must FAIL, got ${JSON.stringify(commentOnly)}`,
);

rmSync(drizzleFx, { recursive: true, force: true });

console.log('Architecture boundary self-test passed.');

import { execFileSync, spawnSync } from 'node:child_process';
import process from 'node:process';

const root = process.cwd();
const gitOutputMaxBuffer = 32 * 1024 * 1024;

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: gitOutputMaxBuffer,
  }).trim();
}

function hasRef(ref) {
  try {
    git(['rev-parse', '--verify', '--quiet', ref]);
    return true;
  } catch {
    return false;
  }
}

function resolveDiffBase() {
  const baseRef = process.env.GITHUB_BASE_REF ?? '';
  const currentRef = process.env.GITHUB_REF_NAME ?? '';

  if (baseRef && hasRef(`origin/${baseRef}`)) {
    return git(['merge-base', 'HEAD', `origin/${baseRef}`]);
  }

  if (currentRef === 'main' && hasRef('HEAD^')) return 'HEAD^';
  if (hasRef('origin/main')) return git(['merge-base', 'HEAD', 'origin/main']);
  if (hasRef('main')) return git(['merge-base', 'HEAD', 'main']);
  if (hasRef('HEAD^')) return 'HEAD^';

  return undefined;
}

function changedDenoFunctionFiles() {
  const base = resolveDiffBase();
  if (!base) return [];

  const output = git([
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    `${base}..HEAD`,
    '--',
    'supabase/functions',
  ]);

  return output
    ? output.split('\n').filter((path) => path.endsWith('.ts'))
    : [];
}

function trackedDenoTestFiles() {
  const output = git(['ls-files', 'supabase/functions']);
  return output
    ? output.split('\n').filter((path) => path.endsWith('_test.ts'))
    : [];
}

function runDeno(args, label) {
  const result = spawnSync('deno', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`${label} could not start: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

function checkChangedDenoFunctions() {
  const files = changedDenoFunctionFiles();
  if (files.length === 0) {
    console.log('Deno Edge Function check skipped (no changed TypeScript files).');
    return;
  }

  console.log(`Deno Edge Function check: ${files.length} changed TypeScript file(s).`);
  runDeno(['check', ...files], 'Deno Edge Function check');
  console.log('Deno Edge Function check passed.');

  const testFiles = trackedDenoTestFiles();
  if (testFiles.length === 0) {
    console.log('Deno Edge Function tests skipped (no tracked *_test.ts files).');
    return;
  }

  console.log(`Deno Edge Function tests: ${testFiles.length} test file(s).`);
  runDeno(['test', ...testFiles], 'Deno Edge Function tests');
  console.log('Deno Edge Function tests passed.');
}


function checkPlayerTestSessionSecurity() {
  console.log('Player-test session security (#296): checking RPCs, no hosted join, lifecycle domain...');
  execFileSync(process.execPath, ['scripts/player-test-session-security-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkPlayerTestRealtimeRuntime() {
  console.log('Player-test realtime runtime (#297): checking revision, events, snapshot+subscribe...');
  execFileSync(process.execPath, ['scripts/player-test-realtime-runtime-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkPlayerTestPlayerPanel() {
  console.log('Player-test player panel V1 (#298): checking panel domain, wiring, no CharacterEditor...');
  execFileSync(process.execPath, ['scripts/player-test-player-panel-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkPlayerTestSharedRolls() {
  console.log('Player-test shared rolls (#299): checking rules kernel probe + authoritative roll RPC...');
  execFileSync(process.execPath, ['scripts/player-test-shared-rolls-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkPlayerTestSharedScenePresentation() {
  console.log('Player-test shared scene presentation (#301): checking presentation contract + GM publish path...');
  execFileSync(process.execPath, ['scripts/player-test-shared-scene-presentation-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkPlayerTestPreparedAdventureFixture() {
  console.log('Player-test prepared adventure fixture (#302): checking fixture + SessionJoin + world_profile_id...');
  execFileSync(process.execPath, ['scripts/player-test-prepared-adventure-fixture-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkPlayerTestCombatEncounter() {
  console.log('Player-test combat encounter V1 (#300): checking encounter contract + authoritative combat RPC...');
  execFileSync(process.execPath, ['scripts/player-test-combat-encounter-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkPlayerTestMultiuserE2eSecurity() {
  console.log('Player-test multi-user E2E + security (#303): Phase 8 checklist + failure classification...');
  execFileSync(process.execPath, ['scripts/player-test-multiuser-e2e-security-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkPlayerTestInstrumentationRunbook() {
  console.log('Player-test instrumentation & runbook (#304): Phase 9–10 evidence pack + metrics contract...');
  execFileSync(process.execPath, ['scripts/player-test-instrumentation-runbook-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkProjectMembershipSecurity() {
  console.log('Project membership security contract: checking RLS and client write paths...');
  execFileSync(process.execPath, ['scripts/project-membership-security-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLocalAuthEmailSagatree() {
  console.log('Local auth emails (@sagatree.local): seeds + rename migration vs app shortcuts...');
  execFileSync(process.execPath, ['scripts/local-auth-email-sagatree-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLocalAdminAuthPolicy() {
  console.log('Local Admin JWT policy: adopt while wanted / discard after logout...');
  execFileSync(process.execPath, ['scripts/local-admin-auth-policy.self-test.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkDonaluP0AuthGate() {
  console.log('Donalu P0 auth gate: world/atlas JWT assert (no anon RLS)...');
  execFileSync(process.execPath, ['scripts/donalu-p0-auth-gate-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkDonaluWorldPlaces() {
  console.log('Donalu world places: domain + migration + UX + dungeon guard...');
  execFileSync(process.execPath, ['scripts/donalu-world-places-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaStateColumnPrivileges() {
  console.log('Saga state column privileges (#569): checking REVOKE + safe selects...');
  execFileSync(process.execPath, ['scripts/saga-state-column-privileges-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagatreeCoreWorkflowsContract() {
  console.log('SagaTree core workflows (#606): checking live evidence contract...');
  execFileSync(process.execPath, ['scripts/sagatree-core-workflows-contract-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkRealtimeComposeBootContract() {
  console.log('Realtime compose boot (#604): checking SECRET_KEY_BASE / Kong /socket wiring...');
  execFileSync(process.execPath, ['scripts/realtime-compose-boot-contract-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkComposeHardenDefaults() {
  console.log('Compose harden defaults (#605): Kong workers / VERIFY_JWT / loopback binds...');
  execFileSync(process.execPath, ['scripts/compose-harden-defaults-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkNegativeAuthzSuite() {
  console.log('Negative authz suite (#607): JWT gate + deny evidence contract...');
  execFileSync(process.execPath, ['scripts/negative-authz-suite-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkEdgeDispatcherAllowlist() {
  console.log('Edge dispatcher allowlist (#668): deny-by-default mounts...');
  execFileSync(process.execPath, ['scripts/edge-dispatcher-allowlist-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkRlsOpenTables() {
  console.log('RLS open tables (#669): rulesets / world_graphs migration contract...');
  execFileSync(process.execPath, ['scripts/rls-open-tables-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAiGmAuthRateLimit() {
  console.log('AI GM + auth rate limits (#670): persistent RPC + Kong/GoTrue...');
  execFileSync(process.execPath, ['scripts/ai-gm-auth-rate-limit-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkNoCommittedAnonJwt() {
  console.log('No committed anon JWTs (#672): src must use env only...');
  execFileSync(process.execPath, ['scripts/no-committed-anon-jwt-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaOverviewRpc() {
  console.log('Saga overview RPC (#570): checking migration, domain VM, hook, audience safety...');
  execFileSync(process.execPath, ['scripts/saga-overview-rpc-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaOverviewHubUi() {
  console.log('Saga overview hub UI (#571): checking 4 sections + Library primary CTA...');
  execFileSync(process.execPath, ['scripts/saga-overview-hub-ui-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaPermissionGrants() {
  console.log('Saga permission grants (#617): catalog, bundles, reveal, Lore, Settings Rechte...');
  execFileSync(process.execPath, ['scripts/saga-permission-grants-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkDornhainFullCatalogSeed() {
  console.log('Dornhain full catalog seed (#618): bindings reveal mix + Welt UI...');
  execFileSync(process.execPath, ['scripts/dornhain-full-catalog-seed-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkDornhainPregenFullSheets() {
  console.log('Dornhain pregen full sheets: race/archetype/essence seed + editor hydrate...');
  execFileSync(process.execPath, ['scripts/dornhain-pregen-full-sheets-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSessionRecapPersistHandover() {
  console.log('Session recap persist + handover (#572): table, hydrate, domain, hook...');
  execFileSync(process.execPath, ['scripts/session-recap-persist-handover-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSessionRecapAiSummary() {
  console.log('Session recap AI summary (#573): edge, rate limit, prompt redaction, hook...');
  execFileSync(process.execPath, ['scripts/session-recap-ai-summary-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaDefinitionsVersions() {
  console.log('Saga definitions + versions (#574): tables, Dornhain seed, client redaction...');
  execFileSync(process.execPath, ['scripts/saga-definitions-versions-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaEditorV1() {
  console.log('Saga editor v1 (#575): draft RPCs, hook, route, AU markers...');
  execFileSync(process.execPath, ['scripts/saga-editor-v1-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaEditorV2() {
  console.log('Saga editor v2 (#579): threats, deadlines, rules, factions...');
  execFileSync(process.execPath, ['scripts/saga-editor-v2-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkWorldMapScriptonyPort() {
  console.log('World map Scriptony port (#580): registry, 6 UI, RPCs, soft-cap...');
  execFileSync(process.execPath, ['scripts/world-map-scriptony-port-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkWorldMapPartyPosition() {
  console.log('World map party position (#581): overview partyLocationRef, GM panel, marker...');
  execFileSync(process.execPath, ['scripts/world-map-party-position-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkWorldAtlasEditor() {
  console.log('World atlas editor (#702): dual nav, Leaflet/Geoman workbench, migration...');
  execFileSync(process.execPath, ['scripts/world-atlas-editor-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Unified atlas dungeon generator (Dungeon Forge MIT extract)...');
  execFileSync(process.execPath, ['scripts/unified-atlas-dungeon-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Atlas settlement presets: Großstadt/Stadt/Dorf seedKeys...');
  execFileSync(process.execPath, ['scripts/atlas-settlement-presets.self-test.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Atlas place nav LOD anchors...');
  execFileSync(process.execPath, ['scripts/atlas-place-nav.self-test.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Dornhain unified world map (ocean blank v3)...');
  execFileSync(process.execPath, ['scripts/dornhain-unified-world-map.self-test.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Atlas prototype LOD layers (HTML v3 port)...');
  execFileSync(process.execPath, ['scripts/atlas-prototype-lod.self-test.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Atlas prototype 3D exact embed...');
  execFileSync(process.execPath, ['scripts/atlas-prototype-3d-embed.self-test.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaPromoteToWorld() {
  console.log('Saga promote to world/saga (#582): RPCs, ledger, recap UI...');
  execFileSync(process.execPath, ['scripts/saga-promote-to-world-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaTreeBrandPhaseA() {
  console.log('SagaTree brand Phase A (#589): title, shell, package, smoke...');
  execFileSync(process.execPath, ['scripts/sagatree-brand-phase-a-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaTreeBrandPhaseB() {
  console.log('SagaTree brand Phase B: SagaTree Core visible ruleset label...');
  execFileSync(process.execPath, ['scripts/sagatree-brand-phase-b-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaSimulationKernel() {
  console.log('Saga simulation kernel (#576): advanceTime, v1→v2, determinism...');
  execFileSync(process.execPath, ['scripts/saga-simulation-kernel-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaSimulationLiveOps() {
  console.log('Saga simulation live ops (#577): batch patch, hook, GM panel...');
  execFileSync(process.execPath, ['scripts/saga-simulation-live-ops-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaBetweenSessionsBote() {
  console.log('Saga between-sessions + Bote (#578): Prepare, Bote, open deadlines...');
  execFileSync(process.execPath, ['scripts/saga-between-sessions-bote-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkCharacterEditorRegressions() {
  console.log('Character editor regression contract: checking persistence, avatar replay, and legacy project status...');
  execFileSync(process.execPath, ['scripts/character-editor-regression-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkCharacterPresetsRegressions() {
  console.log('Character presets regression contract: checking create chooser, settings Preset tab, and RLS migration...');
  execFileSync(process.execPath, ['scripts/character-presets-regression-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkInventoryV2Domain() {
  console.log('Inventory v2 domain contract (#106): checking slots, stacks, containers, equipment, and quick access...');
  execFileSync(process.execPath, ['scripts/inventory-v2-domain-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkInventoryCatalog() {
  console.log('Inventory v2 catalog contract (#107): checking world-profile resolution, scope isolation, archive semantics, and RLS...');
  execFileSync(process.execPath, ['scripts/inventory-catalog-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkInventoryCoreCatalog() {
  console.log('Inventory v2 Core catalog contract: checking 36 stable definitions, schema, and type coverage...');
  execFileSync(process.execPath, ['scripts/inventory-core-catalog-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkInventoryLegacyMigration() {
  console.log('Inventory v2 legacy migration contract (#109): checking lossless ItemDto[] → v2 migration...');
  execFileSync(process.execPath, ['scripts/inventory-legacy-migration-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkInventoryDesktopUi() {
  console.log('Inventory v2 desktop UI contract (#110): checking grid, catalog wiring, and CharacterEditor inventory_v2...');
  execFileSync(process.execPath, ['scripts/inventory-desktop-ui-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkInventoryWorldCatalogUi() {
  console.log('Inventory v2 World catalog authoring UI (#112): checking World editor section, form mode, and scope badges...');
  execFileSync(process.execPath, ['scripts/inventory-world-catalog-ui-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkInventoryEquipmentUi() {
  console.log('Inventory v2 equipment UI contract (#111): checking Ausrüstung and containers...');
  execFileSync(process.execPath, ['scripts/inventory-equipment-ui-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkInventoryMobileUi() {
  console.log('Inventory v2 mobile UX contract (#113): checking Inventar|Ausrüstung segment, grid, and touch targets...');
  execFileSync(process.execPath, ['scripts/inventory-mobile-ui-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAdaptiveSharedUiPrimitives() {
  console.log('Adaptive shared UI primitives (#482): bands, 8 patterns, AU markers...');
  execFileSync(process.execPath, ['scripts/adaptive-shared-ui-primitives-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMobileUiQualityGate() {
  console.log('Mobile UI quality gate (#483): Playwright matrix + adaptive helpers...');
  execFileSync(process.execPath, ['scripts/mobile-ui-quality-gate-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkGoldenMobileJourneys() {
  console.log('Golden Mobile Journeys (#484): AU surfaces, journey IDs, #378 npm entry...');
  execFileSync(process.execPath, ['scripts/golden-mobile-journeys-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveSessionGoldenE2eGate() {
  console.log('Live Session Golden E2E Gate (#378): multi-role scenarios + security + Dornhain/#484 hooks...');
  execFileSync(process.execPath, ['scripts/live-session-golden-e2e-gate-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkInventoryE2eIntegration() {
  console.log('Inventory v2 E2E integration (#114): child gates, architecture, docs sync, catalog size, inventory_v2 save...');
  execFileSync(process.execPath, ['scripts/inventory-e2e-integration-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemRoutingFoundation() {
  console.log('Item Epic routing foundation (#133): History paths, placeholders, no parallel currentView...');
  execFileSync(process.execPath, ['scripts/item-routing-foundation-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaRoutingPublicIdFoundation() {
  console.log('Saga routing + Public ID foundation (#276): IDs, deep links, live role rules...');
  execFileSync(process.execPath, ['scripts/saga-routing-public-id-foundation-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLookProfileDomain() {
  console.log('LookProfile domain (#339): contracts, resolution, capabilities...');
  execFileSync(process.execPath, ['scripts/look-profile-domain-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerContracts() {
  console.log('Media optimizer contracts (#625): kinds, profiles, budgets, result invariants...');
  execFileSync(process.execPath, ['scripts/media-optimizer-contracts-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerFacadeStubs() {
  console.log('Media optimizer facade stubs (#628): kind dispatch, unsupported stubs, codec-free...');
  execFileSync(process.execPath, ['scripts/media-optimizer-facade-stubs-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerImageEngine() {
  console.log('Media optimizer image engine (#630): WebP budget ladder, policy, jsquash dep...');
  execFileSync(process.execPath, ['scripts/media-optimizer-image-engine-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerLazyWorker() {
  console.log('Media optimizer lazy worker (#632): worker URL, abort, resource limits, chunk...');
  execFileSync(process.execPath, ['scripts/media-optimizer-lazy-worker-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerPreviewIntake() {
  console.log('Media optimizer preview intake (#634): Object URL, race, abort, AU status labels...');
  execFileSync(process.execPath, ['scripts/media-optimizer-preview-intake-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerCharacterPortrait() {
  console.log('Media optimizer character portrait (#636): intake + canvas + service prepare...');
  execFileSync(process.execPath, ['scripts/media-optimizer-character-portrait-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerUserAvatar() {
  console.log('Media optimizer user avatar (#682): intake + profile + lobby batch...');
  execFileSync(process.execPath, ['scripts/media-optimizer-user-avatar-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerWorldPin() {
  console.log('Media optimizer world pin (#637): map-pin intake + storage path...');
  execFileSync(process.execPath, ['scripts/media-optimizer-world-pin-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerLookReference() {
  console.log('Media optimizer look reference (#639): optimize before Base64 + 12 MiB aggregate...');
  execFileSync(process.execPath, ['scripts/media-optimizer-look-reference-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerItemWebpContract() {
  console.log('Media optimizer item WebP contract (#641): domain/edge/bucket/DB/Meshy...');
  execFileSync(process.execPath, ['scripts/media-optimizer-item-webp-contract-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerItemIntake() {
  console.log('Media optimizer item intake (#643): optimize before thumbnail Edge upload...');
  execFileSync(process.execPath, ['scripts/media-optimizer-item-intake-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}




function checkMediaOptimizerServerProof() {
  console.log('Media optimizer server proof (#645): Deno WASM/CPU/RAM feasibility...');
  execFileSync(process.execPath, ['scripts/media-optimizer-server-proof-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerProviderOutput() {
  console.log('Media optimizer provider output (#647): Meshy optimize before Storage...');
  execFileSync(process.execPath, ['scripts/media-optimizer-provider-output-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkMediaOptimizerGoldenQa() {
  console.log('Media optimizer golden QA (#649): fixtures, surfaces, lazy WASM...');
  execFileSync(process.execPath, ['scripts/media-optimizer-golden-qa-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLookProfilePersistence() {
  console.log('LookProfile persistence (#340): migration/RLS, draft validation, append-only versions...');
  execFileSync(process.execPath, ['scripts/look-profile-persistence-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLookLibrary() {
  console.log('Look Library browser (#343): Bibliothek › Looks UI + routes + filter domain...');
  execFileSync(process.execPath, ['scripts/look-library-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLookWorldCapabilityStubs() {
  console.log('Look world capability stubs (#346): reserved domains metadata + docs...');
  execFileSync(process.execPath, ['scripts/look-world-capability-stubs-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAdvancedLookContract() {
  console.log('Advanced Look Adaption contract (#355): modes + guides + negotiation...');
  execFileSync(process.execPath, ['scripts/advanced-look-contract-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAdvancedLookAdaptionUx() {
  console.log('Advanced Look Adaption UX (#356): capability status in Look Editor...');
  execFileSync(process.execPath, ['scripts/advanced-look-adaption-ux-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkCharacterStartingTemplatesDesignV1() {
  console.log('Character starting templates design V1 (#465): ten Level-1 build contracts...');
  execFileSync(process.execPath, ['scripts/character-starting-templates-design-v1-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkCharacterStartingTemplatesV1() {
  console.log('Character starting templates V1 catalog (#463): domain builds + validators...');
  execFileSync(process.execPath, ['scripts/character-starting-templates-v1-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkReleaseReadinessContract() {
  console.log('Release readiness contract: IDs, dependencies, flows, milestones...');
  execFileSync(process.execPath, ['scripts/release-readiness.mjs', '--validate-only'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveSessionRoleCapabilityContract() {
  console.log('Live Session role/capability contract (#362): access, visibility, director...');
  execFileSync(process.execPath, ['scripts/live-session-role-capability-contract-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveSessionMediaPlane() {
  console.log('Live Session media plane (#363): domain policy, token edge, degrade...');
  execFileSync(process.execPath, ['scripts/live-session-media-plane-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('LiveAct session transport (#364): network frame + remote consumer + data plane...');
  execFileSync(process.execPath, ['scripts/liveact-session-transport-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Live Program Output (#365): presentation state + display runtime...');
  execFileSync(process.execPath, ['scripts/live-program-output-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Live Scene Runtime V2 (#366): reference container + V1 normalize...');
  execFileSync(process.execPath, ['scripts/live-scene-runtime-v2-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Session Knowledge / Reveals (#367): audience projections + reveal command...');
  execFileSync(process.execPath, ['scripts/session-knowledge-reveals-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Session entry role routing (#477): canonical Saga→Session live entry...');
  execFileSync(process.execPath, ['scripts/session-entry-role-routing-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Player join character assignment (#478): picker + membership resolve...');
  execFileSync(process.execPath, ['scripts/player-join-character-assignment-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Player Live Screen V2 (#368): Program stage + private rail...');
  execFileSync(process.execPath, ['scripts/player-live-screen-v2-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Gamemaster Live Screen V2 (#369): Control Room composition...');
  execFileSync(process.execPath, ['scripts/gamemaster-live-screen-v2-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Viewer Live Screen (#370): read-only Program + public context...');
  execFileSync(process.execPath, ['scripts/viewer-live-screen-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Generic GM Actions (#371): catalog + palette...');
  execFileSync(process.execPath, ['scripts/generic-gm-actions-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Live Inventory Lifecycle (#372): Inventory V2 session ops...');
  execFileSync(process.execPath, ['scripts/live-inventory-lifecycle-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Session Death Lifecycle (#373): downed / stabilize / dead...');
  execFileSync(process.execPath, ['scripts/session-death-lifecycle-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Adventure Runtime World State (#374): typed playthrough...');
  execFileSync(process.execPath, ['scripts/adventure-runtime-world-state-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Director Runtime Cues (#375): automatic mode + override...');
  execFileSync(process.execPath, ['scripts/director-runtime-cues-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Director Control Room (#376): Preview/Program UI...');
  execFileSync(process.execPath, ['scripts/director-control-room-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Golden Adventure Dornhain (#377): package instantiate...');
  execFileSync(process.execPath, ['scripts/golden-adventure-dornhain-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkToonLabCompatibilitySpike() {
  console.log('ToonLab compatibility spike (#341): peers, fixtures, BLOCKED decision...');
  execFileSync(process.execPath, ['scripts/toonlab-compatibility-spike-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLookRuntimeAdapter() {
  console.log('Look runtime adapter (#342): provider-neutral apply/restore, host-mtoon, ToonLab stub...');
  execFileSync(process.execPath, ['scripts/look-runtime-adapter-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLookEditorWorkspace() {
  console.log('Look editor workspace (#344): canonical 3-column editor, inspectors, draft round-trip...');
  execFileSync(process.execPath, ['scripts/look-editor-workspace-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLookPreviewStage() {
  console.log('Look preview stage (#345): modes, cameras, fixtures, LookRuntime compare...');
  execFileSync(process.execPath, ['scripts/look-preview-stage-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaDefaultLook() {
  console.log('Saga default Look (#348): project fields, GM settings UI, resolution fallback...');
  execFileSync(process.execPath, ['scripts/saga-default-look-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkCharacterLookPreview() {
  console.log('Character Look preview (#347): selector, origin labels, AvatarSurfaceViewer bridge...');
  execFileSync(process.execPath, ['scripts/character-look-preview-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSessionLookOverride() {
  console.log('Session Look override (#349): session column, GM inherit/override UI, world resolve...');
  execFileSync(process.execPath, ['scripts/session-look-override-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkWorldLookPreview() {
  console.log('World Look preview (#350): Saga world panel, temp preview, apply/reset, return context...');
  execFileSync(process.execPath, ['scripts/world-look-preview-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkPlayerCharacterLookOverride() {
  console.log('Player character Look override (#351): write gate + resolution ignore when forbidden...');
  execFileSync(process.execPath, ['scripts/player-character-look-override-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkBasicLookReferenceAnalysis() {
  console.log('Basic Look reference analysis (#352): provider-neutral contract + edge path...');
  execFileSync(process.execPath, ['scripts/basic-look-reference-analysis-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkBasicLookAdaptionUx() {
  console.log('Basic Look Adaption UX (#353): create chooser, references, reanalyze...');
  execFileSync(process.execPath, ['scripts/basic-look-adaption-ux-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkCanonicalSagaWorkspace() {
  console.log('Canonical Saga workspace (#489): list/create/join terminology...');
  execFileSync(process.execPath, ['scripts/canonical-saga-workspace-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSessionInviteShareEntry() {
  console.log('Session invite share entry (#490): create/resolve/copy journey...');
  execFileSync(process.execPath, ['scripts/session-invite-share-entry-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSessionLobbyPreflight() {
  console.log('Session lobby preflight (#491): lobby route + media opt-in + enter...');
  execFileSync(process.execPath, ['scripts/session-lobby-preflight-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSessionLobbyMediaPreview() {
  console.log('Session lobby media preview (#678): Meet-style cam/mic/LiveAct...');
  execFileSync(process.execPath, ['scripts/session-lobby-media-preview-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSessionPrepareRecap() {
  console.log('Session prepare/recap (#492): lifecycle screens + status resolution...');
  execFileSync(process.execPath, ['scripts/session-prepare-recap-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkProductionUxIntegrity() {
  console.log('Production UX integrity (#493): dead controls / demo / deferred CTAs...');
  execFileSync(process.execPath, ['scripts/production-ux-integrity-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkBackgroundFrameworkRegressions() {
  console.log('Background framework regression contract: checking universal catalog and legacy IDs...');
  execFileSync(process.execPath, ['scripts/background-framework-regression-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarRuntimeRegressions() {
  console.log('Avatar runtime regression contract: checking VRM/GLB runtime, URL safety, portrait canvas, and dependencies...');
  execFileSync(process.execPath, ['scripts/avatar-runtime-regression-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarTraitLifecycle() {
  console.log('Avatar trait lifecycle (#13): pure core contracts + dispose/stale-load guards...');
  execFileSync(process.execPath, ['scripts/avatar-trait-lifecycle-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarModularTraits() {
  console.log('Avatar modular traits (#4): base/overlay resolve + card picker + allowlist...');
  execFileSync(process.execPath, ['scripts/avatar-modular-traits-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarCustomImport() {
  console.log('Avatar custom VRM/GLB import (#5): validation + owner storage + UI states...');
  execFileSync(process.execPath, ['scripts/avatar-custom-import-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarRigNormalization() {
  console.log('Avatar rig normalization (#6): humanoid contract + aliases + analyzer...');
  execFileSync(process.execPath, ['scripts/avatar-rig-normalization-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarMorphContract() {
  console.log('Avatar morph contract (#212): SagaTreeAvatarMorphV1 bounds + migration...');
  execFileSync(process.execPath, ['scripts/avatar-morph-contract-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarBaseBodies() {
  console.log('Avatar base bodies (#213): morphable humanoid manifest + species presets...');
  execFileSync(process.execPath, ['scripts/avatar-base-bodies-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarMtoonProfile() {
  console.log('Avatar MToon profile (#214): SagaTreeMToonProfileV1 + style applier...');
  execFileSync(process.execPath, ['scripts/avatar-mtoon-profile-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarBodyFaceEditor() {
  console.log('Avatar body/face editor (#215): morph UI + live apply...');
  execFileSync(process.execPath, ['scripts/avatar-body-face-editor-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarFitRange() {
  console.log('Avatar fit range (#216): AvatarFitRangeV1 compatibility...');
  execFileSync(process.execPath, ['scripts/avatar-fit-range-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarSaveExport() {
  console.log('Avatar save export (#7): materialized GLB on Character Save...');
  execFileSync(process.execPath, ['scripts/avatar-save-export-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarAnimationRetarget() {
  console.log('Avatar animation retarget (#8): Idle/Walk/Combat/Emote via humanoid rig...');
  execFileSync(process.execPath, ['scripts/avatar-animation-retarget-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarFacialExpressions() {
  console.log('Avatar facial expressions (#11): blink/emotion/viseme VRM API...');
  execFileSync(process.execPath, ['scripts/avatar-facial-expressions-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarFaceTracking() {
  console.log('Avatar face tracking (#12): local MediaPipe head/eyes/expressions...');
  execFileSync(process.execPath, ['scripts/avatar-face-tracking-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActCore() {
  console.log('LiveAct core (#329): provider-neutral contract + engine...');
  execFileSync(process.execPath, ['scripts/liveact-core-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActViewportUi() {
  console.log('LiveAct viewport UI (#330): permanent gear + camera PiP...');
  execFileSync(process.execPath, ['scripts/liveact-viewport-ui-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceDiagnostics() {
  console.log('LiveAct face diagnostics (#331): overlay + neutral calibration...');
  execFileSync(process.execPath, ['scripts/liveact-face-diagnostics-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActDiagnosticsV2() {
  console.log('LiveAct diagnostics V2 (#397): RAW→APPLIED stage trace...');
  execFileSync(process.execPath, ['scripts/liveact-diagnostics-v2-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceAnchorsV1() {
  console.log('LiveAct face anchors V1 (#399): SagaTreeFaceAnchorsV1 mesh bindings...');
  execFileSync(process.execPath, ['scripts/liveact-face-anchors-v1-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceMappingAuthoring() {
  console.log('LiveAct face mapping authoring (#419): sidecar cache-bust + provenance...');
  execFileSync(process.execPath, ['scripts/liveact-face-mapping-authoring-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkFaceAnchorAgentReview() {
  console.log('Face anchor agent review v1: 5/5 visual + evidence + deterministic gates...');
  execFileSync(process.execPath, ['scripts/face-anchor-agent-review-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceMappingManual() {
  console.log('LiveAct face mapping manual (#420): Face Setup 21 markers + raycast...');
  execFileSync(process.execPath, ['scripts/liveact-face-mapping-manual-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceMappingAuto() {
  console.log('LiveAct face mapping auto (#421): IMAGE MediaPipe + shared raycast...');
  execFileSync(process.execPath, ['scripts/liveact-face-mapping-auto-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceMappingAutoCaptureVisibility() {
  console.log('LiveAct face mapping auto capture visibility (#421 P2): hide equipment for MediaPipe...');
  execFileSync(process.execPath, ['scripts/liveact-face-mapping-auto-capture-visibility-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceMappingGtMarkCopy() {
  console.log('LiveAct face mapping GT mark vs clipboard (#421 P3)...');
  execFileSync(process.execPath, ['scripts/liveact-face-mapping-gt-mark-copy-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceAnchorsCharacterPersist() {
  console.log('LiveAct face anchors character persist: avatar.face_anchors + override...');
  execFileSync(process.execPath, ['scripts/liveact-face-anchors-character-persist-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActExpandDriveBind() {
  console.log('LiveAct expand drive bind: Setup modal XOR card bindOutput...');
  execFileSync(process.execPath, ['scripts/liveact-expand-drive-bind-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActReferenceVrmGoldenAvatar() {
  console.log('LiveAct Golden Reference VRM (ARKit52) diagnostic path...');
  execFileSync(process.execPath, ['scripts/liveact-reference-vrm-golden-avatar-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaHumanCanonicalV1() {
  console.log('Saga Human Canonical V1 PoC: sources, build report, sidecars, runtime isolation...');
  execFileSync(process.execPath, ['scripts/saga-human-canonical-v1-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFidelity() {
  console.log('LiveAct fidelity: calibration once + range gains, idle ownership, teeth binds...');
  execFileSync(process.execPath, ['scripts/liveact-fidelity-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceMappingVisualGuides() {
  console.log(
    'LiveAct face mapping visual guides: binding labels + smooth guides + pulse/detail...',
  );
  execFileSync(process.execPath, ['scripts/liveact-face-mapping-visual-guides-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceAnchorAnatomy() {
  console.log('LiveAct face anchor anatomy QA: SagaTreeFaceAnchorAnatomyQaV1...');
  execFileSync(process.execPath, ['scripts/liveact-face-anchor-anatomy-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActCameraOverlayMetrics() {
  console.log('LiveAct camera overlay metrics (#398): object-cover + HUD...');
  execFileSync(process.execPath, ['scripts/liveact-camera-overlay-metrics-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActCharacterFaceOverlay() {
  console.log('LiveAct character face overlay (#400): deformed mesh anchors...');
  execFileSync(process.execPath, ['scripts/liveact-character-face-overlay-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActAvatarOutput() {
  console.log('LiveAct avatar output (#332): VRM/GLB atomic frame apply...');
  execFileSync(process.execPath, ['scripts/liveact-avatar-output-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActCapabilityOwnership() {
  console.log('LiveAct capability ownership (#381): Input vs Avatar compose...');
  execFileSync(process.execPath, ['scripts/liveact-capability-ownership-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceAssetContract() {
  console.log('LiveAct face asset contract (#382): core-v1 / full-v1 / gazeMode...');
  execFileSync(process.execPath, ['scripts/liveact-face-asset-contract-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceAssetValidator() {
  console.log('LiveAct face asset validator (#383): Khronos + SagaTree gate...');
  execFileSync(process.execPath, ['scripts/liveact-face-asset-validator-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceSemanticValidator() {
  console.log('LiveAct semantic face morph validator (#401): region/side/combination QA...');
  execFileSync(process.execPath, ['scripts/liveact-face-semantic-validator-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceFunctionalValidator() {
  console.log('LiveAct face functional validator (#422): reviewed GT morph function QA...');
  execFileSync(process.execPath, ['scripts/liveact-face-functional-validator-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceFunctionalMorphAuthor() {
  console.log('LiveAct face functional morph author (#423): GT-aware jawOpen rewrite...');
  execFileSync(process.execPath, ['scripts/liveact-face-functional-morph-author-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceAuthoringQtmesh() {
  console.log('LiveAct face authoring qtmesh adapter (#384): fake CLI + report gates...');
  execFileSync(process.execPath, ['scripts/liveact-face-authoring-qtmesh-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActRetargetProfile() {
  console.log('LiveAct retarget profile (#385): gain/deadZone domain + engine wiring...');
  execFileSync(process.execPath, ['scripts/liveact-retarget-profile-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFacialFidelityV2() {
  console.log('LiveAct facial fidelity V2 (#403): exclusive gaze + channel table...');
  execFileSync(process.execPath, ['scripts/liveact-facial-fidelity-v2-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarVrmPack() {
  console.log('Avatar VRM pack (#404): deterministic VRM 1.0 packaging...');
  execFileSync(process.execPath, ['scripts/avatar-vrm-pack-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceFidelityE2E() {
  console.log('LiveAct face fidelity E2E (#406): aggregate VRM runtime gate...');
  execFileSync(process.execPath, ['scripts/liveact-face-fidelity-e2e-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceSetupE2E() {
  console.log('LiveAct face setup E2E (#424): Face Setup + RAW→APPLIED + identity retarget...');
  execFileSync(process.execPath, ['scripts/liveact-face-setup-e2e-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActPerfectFidelityBenchmark() {
  console.log(
    'LiveAct Perfect Fidelity benchmark (#444): contract + capture + motion/speech metrics...',
  );
  execFileSync(process.execPath, ['scripts/liveact-perfect-fidelity-benchmark-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActDenseFaceFeatures() {
  console.log(
    'LiveAct dense face features (#445): semantic geometry + face-local normalize + regions...',
  );
  execFileSync(process.execPath, ['scripts/liveact-dense-face-features-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActIrisGazeSolver() {
  console.log(
    'LiveAct iris gaze solver (#446): head-local per-eye iris + A/B vs blendshape...',
  );
  execFileSync(process.execPath, ['scripts/liveact-iris-gaze-solver-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActHybridMouthFaceSolver() {
  console.log(
    'LiveAct hybrid mouth/face solver (#447): semantic+dense fusion + A/B vs V1...',
  );
  execFileSync(process.execPath, ['scripts/liveact-hybrid-mouth-face-solver-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActAdaptiveTemporalSolver() {
  console.log(
    'LiveAct adaptive temporal solver (#448): dt-based per-group policies + A/B vs V1 EMA...',
  );
  execFileSync(process.execPath, ['scripts/liveact-adaptive-temporal-solver-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log(
    'LiveAct personal calibration V2 (#449): 20–40s local profile + A/B vs V1 generic...',
  );
  execFileSync(process.execPath, ['scripts/liveact-personal-calibration-v2-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log(
    'SagaTree Performance Face V2 (#450): Premium contract + compose with Caps V1...',
  );
  execFileSync(process.execPath, ['scripts/sagatree-performance-face-v2-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log(
    'LiveAct Perfect Fidelity V2 E2E (#451): dual-avatar Premium gate + contour...',
  );
  execFileSync(process.execPath, ['scripts/liveact-perfect-fidelity-v2-e2e-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFacePipelineDocs() {
  console.log('LiveAct face pipeline docs (#386): AUTHORING v1.1 + FACE-AUTHORING...');
  execFileSync(process.execPath, ['scripts/liveact-face-pipeline-doc-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActFaceHumanRepro() {
  console.log('LiveAct face human repro (#387): m5+f5 core-v1 public assets...');
  execFileSync(process.execPath, ['scripts/liveact-face-human-repro-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActRigDebug() {
  console.log('LiveAct rig debug (#333): SkeletonHelper + capability inspector...');
  execFileSync(process.execPath, ['scripts/liveact-rig-debug-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActSurfaceMigration() {
  console.log('LiveAct surface migration (#334): editor/player/session shared engine...');
  execFileSync(process.execPath, ['scripts/liveact-surface-migration-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkLiveActHardening() {
  console.log('LiveAct hardening (#335): backpressure, privacy, races, E2E contract...');
  execFileSync(process.execPath, ['scripts/liveact-hardening-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2CompositionContract() {
  console.log('Avatar V2 composition contract (#249): orthogonal axes + legacy mapping...');
  execFileSync(process.execPath, ['scripts/avatar-v2-composition-contract-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2ModularGlbContract() {
  console.log('Avatar V2 modular GLB contract (#250): extras.sagatree roles/slots...');
  execFileSync(process.execPath, ['scripts/avatar-v2-modular-glb-contract-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2ArtifactPipeline() {
  console.log('Avatar V2 artifact pipeline (#251): source-neutral materialization...');
  execFileSync(process.execPath, ['scripts/avatar-v2-artifact-pipeline-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2StructureAnalyzer() {
  console.log('Avatar V2 structure analyzer (#252): anatomy/modularity evidence...');
  execFileSync(process.execPath, ['scripts/avatar-v2-structure-analyzer-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2BodyProfile() {
  console.log('Avatar V2 body profile (#253): standard/compact/heavy compatibility...');
  execFileSync(process.execPath, ['scripts/avatar-v2-body-profile-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2AssetAuthoring() {
  console.log('Avatar V2 asset authoring (#254): provider-neutral publish workflow...');
  execFileSync(process.execPath, ['scripts/avatar-v2-asset-authoring-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2CanonicalBodyFamilies() {
  console.log('Avatar V2 canonical body families (#255): standard/compact/heavy...');
  execFileSync(process.execPath, ['scripts/avatar-v2-canonical-body-families-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2SpeciesTemplatePack() {
  console.log('Avatar V2 species template pack (#256): seven species on families...');
  execFileSync(process.execPath, ['scripts/avatar-v2-species-template-pack-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2StarterWardrobe() {
  console.log('Avatar V2 starter wardrobe (#257): 6 wearables × 3 family fits...');
  execFileSync(process.execPath, ['scripts/avatar-v2-starter-wardrobe-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2SkinnedWearableRuntime() {
  console.log('Avatar V2 skinned wearable runtime (#258): family fit + rebind + masks...');
  execFileSync(process.execPath, ['scripts/avatar-v2-skinned-wearable-runtime-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2CapabilityEditor() {
  console.log('Avatar V2 capability editor (#259): surfaces from capabilities not source...');
  execFileSync(process.execPath, ['scripts/avatar-v2-capability-editor-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2TemplateCreatorFlow() {
  console.log('Avatar V2 template creator flow (#260): Vorlage anpassen vertical slice...');
  execFileSync(process.execPath, ['scripts/avatar-v2-template-creator-flow-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSpeciesTemplateGenderModelPreview() {
  console.log('Species template gender model preview: Mensch m/w GLB wiring...');
  execFileSync(process.execPath, ['scripts/species-template-gender-model-preview-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2ImportOriginalFlow() {
  console.log('Avatar V2 import original flow (#261): Analyse + Original behalten...');
  execFileSync(process.execPath, ['scripts/avatar-v2-import-original-flow-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarSpikePromote() {
  console.log('Avatar spike/benchmark promote (#323): production filenames...');
  execFileSync(process.execPath, ['scripts/avatar-spike-promote-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2IdentityTransfer() {
  console.log('Avatar V2 identity transfer (#262/#323): default + degraded conversion plan...');
  execFileSync(process.execPath, ['scripts/avatar-v2-identity-transfer-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2BodyConversionFlow() {
  console.log('Avatar V2 body conversion flow (#263): Standard/Compact/Heavy transfer...');
  execFileSync(process.execPath, ['scripts/avatar-v2-body-conversion-flow-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2CustomCreatureContract() {
  console.log('Avatar V2 custom creature rig/capability contract (#264)...');
  execFileSync(process.execPath, ['scripts/avatar-v2-custom-creature-contract-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2CustomRigDecision() {
  console.log('Avatar V2 custom rig decision (#265/#323): Meshy/SkinTokens/Import defaults...');
  execFileSync(process.execPath, ['scripts/avatar-v2-custom-rig-decision-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2CustomCreatureFlow() {
  console.log('Avatar V2 custom creature original vertical slice (#266)...');
  execFileSync(process.execPath, ['scripts/avatar-v2-custom-creature-flow-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2GenerateUx() {
  console.log('Avatar V2 generate UX Editierbar vs Freie Form (#267)...');
  execFileSync(process.execPath, ['scripts/avatar-v2-generate-ux-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2GenerateDecomposition() {
  console.log('Avatar V2 modular generate decomposition (#268/#323)...');
  execFileSync(
    process.execPath,
    ['scripts/avatar-v2-generate-decomposition-check.mjs'],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
}

function checkAvatarV2ModularGenerateFlow() {
  console.log('Avatar V2 modular generate Editierbar vertical slice (#269)...');
  execFileSync(process.execPath, ['scripts/avatar-v2-modular-generate-flow-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarV2FinalAcceptance() {
  console.log('Avatar V2 final acceptance golden matrix (#270)...');
  execFileSync(process.execPath, ['scripts/avatar-v2-final-acceptance-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarContentPack() {
  console.log('Avatar content pack (#217): Fantasy/Sci-Fi curated assets...');
  execFileSync(process.execPath, ['scripts/avatar-content-pack-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarMeshyGeneration() {
  console.log('Avatar Meshy generation (#10): prompt job + SSRF + pending #6...');
  execFileSync(process.execPath, ['scripts/avatar-meshy-generation-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('Avatar 3D generation (provider-agnostic): presets + Meshy adapter...');
  execFileSync(process.execPath, ['scripts/avatar-3d-generation-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarSourceSelector() {
  console.log('Avatar source selector (#14): sagatree|import|meshy + legacy...');
  execFileSync(process.execPath, ['scripts/avatar-source-selector-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSharedAvatarSurfaces() {
  console.log('Shared avatar surfaces (#9): portrait/compact/full + bounds...');
  execFileSync(process.execPath, ['scripts/shared-avatar-surfaces-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarEquipmentVisualContract() {
  console.log('Avatar equipment visual contract (#158): binding + projection...');
  execFileSync(process.execPath, ['scripts/avatar-equipment-visual-contract-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarRigidEquipmentRuntime() {
  console.log('Avatar rigid equipment runtime (#159): attach plan + cache...');
  execFileSync(process.execPath, ['scripts/avatar-rigid-equipment-runtime-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemAvatarFitWorkbench() {
  console.log('Item avatar fit workbench (#160): defaults + Ausrichtung section...');
  execFileSync(process.execPath, ['scripts/item-avatar-fit-workbench-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarRiggingProviders() {
  console.log('Avatar rigging providers (#161): Meshy + SkinTokens mocks...');
  execFileSync(process.execPath, ['scripts/avatar-rigging-providers-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarSkinnedWearables() {
  console.log('Avatar skinned wearables (#162): plan + capability gate...');
  execFileSync(process.execPath, ['scripts/avatar-skinned-wearables-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarItemsFinalAcceptance() {
  console.log('Avatar items final acceptance (#163): equip/rig/wearable matrix...');
  execFileSync(process.execPath, ['scripts/avatar-items-final-acceptance-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarCreatorFinalAcceptance() {
  console.log('Avatar creator final visual/UX acceptance (#218): combo + golden matrix...');
  execFileSync(process.execPath, ['scripts/avatar-creator-final-acceptance-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAvatarAssetCatalogRegressions() {
  console.log('Avatar asset catalog regression contract: checking race mappings, provenance, licenses, and pinned fallbacks...');
  execFileSync(process.execPath, ['scripts/avatar-asset-catalog-regression-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkWorldProfilesValidation() {
  console.log('World profiles validation (#30): deterministic §4.7/§16 audit...');
  execFileSync(process.execPath, ['scripts/validate-world-profiles-modules.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAllCoreSkillsValidation() {
  console.log('All core skills validation (#28): deterministic §5 skill catalog & boundaries...');
  execFileSync(process.execPath, ['scripts/validate-all-core-skills.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkNoncombatProjectsSocialValidation() {
  console.log('Noncombat/projects/social validation (#27): deterministic §2.8/§14 E1 scenarios...');
  execFileSync(process.execPath, ['scripts/validate-noncombat-projects-social.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkConditionsResistancesValidation() {
  console.log('Conditions/resistances validation (#33): deterministic §9/§6.5 C3 scenarios...');
  execFileSync(process.execPath, ['scripts/validate-conditions-resistances.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkTravelChaseVehiclesValidation() {
  console.log('Travel/chase/vehicles validation (#29): deterministic §10.4/§14.2/§14.10 E2 scenarios...');
  execFileSync(process.execPath, ['scripts/validate-travel-chase-vehicles.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkCharacterEditorRulesUxValidation() {
  console.log('Character editor rules UX validation (#21): B1 structural + E2E contract...');
  execFileSync(process.execPath, ['scripts/validate-character-editor-rules-ux.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkGearResourcesLoadValidation() {
  console.log('Gear/resources/load validation (#32): tools, traits, Traglast, affordability...');
  execFileSync(process.execPath, ['scripts/validate-gear-resources-load.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkDriveMomentumValidation() {
  console.log('Drive/momentum validation (#26): deterministic §2.10–2.12/§16.3 audit...');
  execFileSync(process.execPath, ['scripts/validate-drive-momentum.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAnalogEndToEndPlaytestValidation() {
  console.log('Analog E2E playtest validation (#31): deterministic Phase G1 paper-play ledger...');
  execFileSync(process.execPath, ['scripts/validate-analog-end-to-end-playtest.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkPowersEssencesValidation() {
  console.log('Powers/essences validation (#25): deterministic §12 power model audit...');
  execFileSync(process.execPath, ['scripts/validate-powers-essences-ranks.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkCharacterCreationValidation() {
  console.log('Character creation validation (#20): deterministic §17/§13 build audit...');
  execFileSync(process.execPath, ['scripts/validate-character-creation-progression.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkEnemyEncounterBossValidation() {
  console.log('Enemy/encounter/boss validation (#24): seeded C4 encounter simulation...');
  execFileSync(process.execPath, ['scripts/validate-enemy-encounter-boss-balance.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkDamageHealingDyingValidation() {
  console.log('Damage/healing/dying validation (#23): exact damage & dying curves...');
  execFileSync(process.execPath, ['scripts/validate-damage-healing-dying.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkCombatActionEconomyValidation() {
  console.log('Combat action economy validation (#22): deterministic C1 scenario play-through...');
  execFileSync(process.execPath, ['scripts/validate-combat-action-economy.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkCoreProbabilityValidation() {
  console.log('Core probability validation (#19): exact A1 matrix over the core probe...');
  execFileSync(process.execPath, ['scripts/validate-core-probability.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function scanAddedLinesForSecrets() {
  const base = resolveDiffBase();
  if (!base) {
    console.log('Secrets diff scan skipped (no diff base available).');
    return;
  }

  const diff = git(['diff', '--unified=0', `${base}..HEAD`, '--', '.']);
  const addedLines = diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));

  const secretPatterns = [
    { label: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
    { label: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
    { label: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
    { label: 'OpenAI-style secret', pattern: /\bsk-[A-Za-z0-9_-]{24,}\b/ },
  ];

  const findings = [];
  for (const line of addedLines) {
    for (const rule of secretPatterns) {
      if (rule.pattern.test(line)) findings.push(rule.label);
    }
  }

  if (findings.length > 0) {
    console.error(`Secrets diff scan failed: ${[...new Set(findings)].join(', ')}`);
    process.exit(1);
  }

  console.log('Secrets diff scan passed.');
}

function reportDependencyAudit() {
  // #671 — blocking gate (same bar as verify.yml): fail on high/critical.
  const result = spawnSync('npm', ['audit', '--audit-level=high', '--json'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const raw = result.stdout || result.stderr;
  if (!raw) {
    console.error('Dependency audit unavailable — cannot verify supply-chain gate.');
    process.exit(1);
  }

  try {
    const report = JSON.parse(raw);
    const vulnerabilities = report?.metadata?.vulnerabilities;
    if (!vulnerabilities || typeof vulnerabilities !== 'object') {
      console.error('Dependency audit returned no vulnerability summary.');
      process.exit(1);
    }

    const critical = Number(vulnerabilities.critical ?? 0);
    const high = Number(vulnerabilities.high ?? 0);
    const summary = ['critical', 'high', 'moderate', 'low']
      .map((level) => `${level}=${Number(vulnerabilities[level] ?? 0)}`)
      .join(', ');

    if (critical > 0 || high > 0 || result.status !== 0) {
      console.error(`Dependency audit failed (high+ must be 0): ${summary}.`);
      process.exit(1);
    }

    console.log(`Dependency audit (blocking high+): ${summary}.`);
  } catch {
    console.error('Dependency audit output could not be parsed.');
    process.exit(1);
  }
}

function checkArchitectureBoundaries() {
  console.log('Architecture boundary check (#94): layer and slice import rules...');
  execFileSync(process.execPath, ['scripts/architecture-boundary-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  execFileSync(process.execPath, ['scripts/architecture-boundary-check.self-test.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('SagaTree name ban: legacy product name must not reappear...');
  execFileSync(process.execPath, ['scripts/sagatree-name-ban-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAssetLicenseInventory() {
  console.log('Asset license inventory: tracked media must be classified (no uncleared)...');
  execFileSync(process.execPath, ['scripts/asset-license-inventory-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkEdgeCorsShared() {
  console.log('Edge CORS shared helper (#305): _shared/cors + no local Origin literals...');
  execFileSync(process.execPath, ['scripts/edge-cors-shared-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemDomainTaxonomy() {
  console.log('Item domain taxonomy & provenance (#134): ItemDefinition owner, normalize/validate...');
  execFileSync(process.execPath, ['scripts/item-domain-taxonomy-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkSagaTreeItemRulesKernel() {
  console.log('SagaTree item rules kernel (#135): load/cost/protection/Traglast/tool contracts...');
  execFileSync(process.execPath, ['scripts/sagatree-item-rules-kernel-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkCombatCreateOpportunity() {
  console.log('Combat create opportunity (#194): Gelegenheit schaffen kernel + docs...');
  execFileSync(process.execPath, ['scripts/combat-create-opportunity-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkNpcCreaturePowerFramework() {
  console.log('NPC/creature power framework (#195): benchmarks, profiles, roles...');
  execFileSync(process.execPath, ['scripts/npc-creature-power-framework-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkNpcCreatureDomainPersistence() {
  console.log('NPC/creature domain persistence (#196): definitions CRUD contracts + RLS wiring...');
  execFileSync(process.execPath, ['scripts/npc-creature-domain-persistence-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkNpcCreatureLibraryBrowser() {
  console.log('NPC/creature library browser (#197): tab, EntityBrowser, filters, statblock...');
  execFileSync(process.execPath, ['scripts/npc-creature-library-browser-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkNpcCreatureCreatorEditor() {
  console.log('NPC/creature creator editor (#198): quick create, editor, live statblock...');
  execFileSync(process.execPath, ['scripts/npc-creature-creator-editor-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkNpcCreatureWorldCatalog() {
  console.log('NPC/creature world catalog (#199): packs + pure resolver + world UI...');
  execFileSync(process.execPath, ['scripts/npc-creature-world-catalog-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkNpcCreaturePromotion() {
  console.log('NPC/creature promotion + controller (#200): template/compact/assign wiring...');
  execFileSync(process.execPath, ['scripts/npc-creature-promotion-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkNpcCreatureSessionInstances() {
  console.log('NPC/creature session instances (#201): spawn/runtime/snapshot isolation...');
  execFileSync(process.execPath, ['scripts/npc-creature-session-instances-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemDefinitionPersistence() {
  console.log('ItemDefinition persistence lifecycle & security (#136): CRUD/fork/taxonomy roundtrip...');
  execFileSync(process.execPath, ['scripts/item-definition-persistence-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemStandardPacks() {
  console.log('Builtin standard item packs (#137): Fantasy/Sci-Fi/Contemporary 40/40/40 + context packs...');
  execFileSync(process.execPath, ['scripts/item-standard-packs-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemLibraryBrowser() {
  console.log('Item Epic Library Items browser (#138): slice composition, filters, UI contract...');
  execFileSync(process.execPath, ['scripts/item-library-browser-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemWorkbench() {
  console.log('Item Epic Workbench (#139): create/edit/readonly/fork UI + catalog wiring...');
  execFileSync(process.execPath, ['scripts/item-workbench-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemThumbnailAssets() {
  console.log('Item Epic thumbnails + Meshy (#140): upload/generate contract, secrets fail-closed...');
  execFileSync(process.execPath, ['scripts/item-thumbnail-assets-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemIconAssets() {
  console.log('Item static SVG icons: Cursor→PNG→VTracer pipeline contract...');
  execFileSync(process.execPath, ['scripts/item-icon-assets-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkNpcCreatureIconAssets() {
  console.log('NPC/creature static SVG icons: catalog iconKey + public assets...');
  execFileSync(process.execPath, ['scripts/npc-creature-icon-assets-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkAiProviderCredentials() {
  console.log('AI provider credentials (BYOK): vault + Meshy validate + prod user-keys-only...');
  execFileSync(process.execPath, ['scripts/ai-provider-credentials-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemModel3dAssets() {
  console.log('Item Epic 3D + Meshy Image-to-3D (#141): GLB upload/generate contract, secrets fail-closed...');
  execFileSync(process.execPath, ['scripts/item-model3d-assets-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemWorldCatalogModule() {
  console.log('Item Epic world item-catalog module (#142): pack selection + pure resolver...');
  execFileSync(process.execPath, ['scripts/item-world-catalog-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemInventoryWorldCatalogWire() {
  console.log('Item Epic inventory ↔ world catalog wire (#143): add-catalog composition + labels...');
  execFileSync(process.execPath, ['scripts/item-inventory-world-catalog-wire-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

function checkItemEpicAcceptance() {
  console.log('Item Epic final acceptance (#144): child gates, docs sync, no VITE Meshy, e2e...');
  execFileSync(process.execPath, ['scripts/item-epic-acceptance-check.mjs'], {
    cwd: root,
    stdio: 'inherit',
  });
}

console.log('Test Gate: running project checks...');
execFileSync('npm', ['run', 'checks'], {
  cwd: root,
  stdio: 'inherit',
});

checkChangedDenoFunctions();
checkArchitectureBoundaries();
checkEdgeCorsShared();
checkItemDomainTaxonomy();
checkSagaTreeItemRulesKernel();
checkCombatCreateOpportunity();
checkItemDefinitionPersistence();
checkItemStandardPacks();
checkItemLibraryBrowser();
checkItemWorkbench();
checkItemThumbnailAssets();
checkItemIconAssets();
checkNpcCreatureIconAssets();
checkItemModel3dAssets();
checkAiProviderCredentials();
checkItemWorldCatalogModule();
checkItemInventoryWorldCatalogWire();
checkItemEpicAcceptance();
checkItemRoutingFoundation();
checkSagaRoutingPublicIdFoundation();
checkLookProfileDomain();
checkMediaOptimizerContracts();
checkMediaOptimizerFacadeStubs();
checkMediaOptimizerImageEngine();
checkMediaOptimizerLazyWorker();
checkMediaOptimizerPreviewIntake();
checkMediaOptimizerCharacterPortrait();
checkMediaOptimizerUserAvatar();
checkMediaOptimizerWorldPin();
checkMediaOptimizerLookReference();
checkMediaOptimizerItemWebpContract();
checkMediaOptimizerItemIntake();
checkMediaOptimizerServerProof();
checkMediaOptimizerProviderOutput();
checkMediaOptimizerGoldenQa();
checkLookProfilePersistence();
checkLookLibrary();
checkLookWorldCapabilityStubs();
checkAdvancedLookContract();
checkAdvancedLookAdaptionUx();
checkToonLabCompatibilitySpike();
checkLookRuntimeAdapter();
checkLookEditorWorkspace();
checkLookPreviewStage();
checkSagaDefaultLook();
checkCharacterLookPreview();
checkSessionLookOverride();
checkWorldLookPreview();
checkPlayerCharacterLookOverride();
checkBasicLookReferenceAnalysis();
checkBasicLookAdaptionUx();
checkCanonicalSagaWorkspace();
checkSessionInviteShareEntry();
checkSessionLobbyPreflight();
checkSessionLobbyMediaPreview();
checkSessionPrepareRecap();
checkProductionUxIntegrity();
checkCharacterStartingTemplatesDesignV1();
checkCharacterStartingTemplatesV1();
checkReleaseReadinessContract();
checkLiveSessionRoleCapabilityContract();
checkLiveSessionMediaPlane();
checkPlayerTestSessionSecurity();
checkPlayerTestRealtimeRuntime();
checkPlayerTestPlayerPanel();
checkPlayerTestSharedRolls();
checkPlayerTestSharedScenePresentation();
checkPlayerTestPreparedAdventureFixture();
checkPlayerTestCombatEncounter();
checkPlayerTestMultiuserE2eSecurity();
checkPlayerTestInstrumentationRunbook();
checkProjectMembershipSecurity();
checkLocalAuthEmailSagatree();
checkLocalAdminAuthPolicy();
checkDonaluP0AuthGate();
checkDonaluWorldPlaces();
checkSagaStateColumnPrivileges();
checkSagatreeCoreWorkflowsContract();
checkRealtimeComposeBootContract();
checkComposeHardenDefaults();
checkNegativeAuthzSuite();
checkEdgeDispatcherAllowlist();
checkRlsOpenTables();
checkAiGmAuthRateLimit();
checkNoCommittedAnonJwt();
checkSagaOverviewRpc();
checkSagaOverviewHubUi();
checkSagaPermissionGrants();
checkDornhainFullCatalogSeed();
checkDornhainPregenFullSheets();
checkSessionRecapPersistHandover();
checkSessionRecapAiSummary();
checkSagaDefinitionsVersions();
checkSagaEditorV1();
checkSagaEditorV2();
checkWorldMapScriptonyPort();
checkWorldMapPartyPosition();
checkWorldAtlasEditor();
checkSagaPromoteToWorld();
checkSagaTreeBrandPhaseA();
checkSagaTreeBrandPhaseB();
checkSagaSimulationKernel();
checkSagaSimulationLiveOps();
checkSagaBetweenSessionsBote();
checkCharacterEditorRegressions();
checkCharacterPresetsRegressions();
checkInventoryV2Domain();
checkInventoryCatalog();
checkInventoryCoreCatalog();
checkInventoryLegacyMigration();
checkInventoryDesktopUi();
checkInventoryWorldCatalogUi();
checkInventoryEquipmentUi();
checkInventoryMobileUi();
checkAdaptiveSharedUiPrimitives();
checkMobileUiQualityGate();
checkGoldenMobileJourneys();
checkLiveSessionGoldenE2eGate();
checkInventoryE2eIntegration();
checkBackgroundFrameworkRegressions();
checkAvatarRuntimeRegressions();
checkAvatarTraitLifecycle();
checkAvatarModularTraits();
checkAvatarCustomImport();
checkAvatarRigNormalization();
checkAvatarMorphContract();
checkAvatarBaseBodies();
checkAvatarMtoonProfile();
checkAvatarBodyFaceEditor();
checkAvatarFitRange();
checkAvatarSaveExport();
checkAvatarAnimationRetarget();
checkAvatarFacialExpressions();
checkAvatarFaceTracking();
checkLiveActCore();
checkLiveActViewportUi();
checkLiveActFaceDiagnostics();
checkLiveActDiagnosticsV2();
checkLiveActFaceAnchorsV1();
checkLiveActFaceMappingAuthoring();
checkFaceAnchorAgentReview();
checkLiveActFaceMappingManual();
checkLiveActFaceMappingAuto();
checkLiveActFaceMappingAutoCaptureVisibility();
checkLiveActFaceMappingGtMarkCopy();
checkLiveActFaceAnchorsCharacterPersist();
checkLiveActExpandDriveBind();
checkLiveActReferenceVrmGoldenAvatar();
checkSagaHumanCanonicalV1();
checkLiveActFidelity();
checkLiveActFaceMappingVisualGuides();
checkLiveActFaceAnchorAnatomy();
checkLiveActCameraOverlayMetrics();
checkLiveActCharacterFaceOverlay();
checkLiveActAvatarOutput();
checkLiveActCapabilityOwnership();
checkLiveActFaceAssetContract();
checkLiveActFaceAssetValidator();
checkLiveActFaceSemanticValidator();
checkLiveActFaceFunctionalValidator();
checkLiveActFaceFunctionalMorphAuthor();
checkLiveActFaceAuthoringQtmesh();
checkLiveActRetargetProfile();
checkLiveActFacialFidelityV2();
checkAvatarVrmPack();
checkLiveActFaceFidelityE2E();
checkLiveActFaceSetupE2E();
checkLiveActPerfectFidelityBenchmark();
checkLiveActDenseFaceFeatures();
checkLiveActIrisGazeSolver();
checkLiveActHybridMouthFaceSolver();
checkLiveActAdaptiveTemporalSolver();
checkLiveActFacePipelineDocs();
checkLiveActFaceHumanRepro();
checkLiveActRigDebug();
checkLiveActSurfaceMigration();
checkLiveActHardening();
checkAvatarV2CompositionContract();
checkAvatarV2ModularGlbContract();
checkAvatarV2ArtifactPipeline();
checkAvatarV2StructureAnalyzer();
checkAvatarV2BodyProfile();
checkAvatarV2AssetAuthoring();
checkAvatarV2CanonicalBodyFamilies();
checkAvatarV2SpeciesTemplatePack();
checkAvatarV2StarterWardrobe();
checkAvatarV2SkinnedWearableRuntime();
checkAvatarV2CapabilityEditor();
checkAvatarV2TemplateCreatorFlow();
checkSpeciesTemplateGenderModelPreview();
checkAvatarV2ImportOriginalFlow();
checkAvatarSpikePromote();
checkAvatarV2IdentityTransfer();
checkAvatarV2BodyConversionFlow();
checkAvatarV2CustomCreatureContract();
checkAvatarV2CustomRigDecision();
checkAvatarV2CustomCreatureFlow();
checkAvatarV2GenerateUx();
checkAvatarV2GenerateDecomposition();
checkAvatarV2ModularGenerateFlow();
checkAvatarV2FinalAcceptance();
checkAvatarContentPack();
checkAvatarMeshyGeneration();
checkAvatarSourceSelector();
checkSharedAvatarSurfaces();
checkAvatarEquipmentVisualContract();
checkAvatarRigidEquipmentRuntime();
checkItemAvatarFitWorkbench();
checkAvatarRiggingProviders();
checkAvatarSkinnedWearables();
checkAvatarItemsFinalAcceptance();
checkAvatarCreatorFinalAcceptance();
checkAvatarAssetCatalogRegressions();
checkCoreProbabilityValidation();
checkCombatActionEconomyValidation();
checkDamageHealingDyingValidation();
checkEnemyEncounterBossValidation();
checkNpcCreaturePowerFramework();
checkNpcCreatureDomainPersistence();
checkNpcCreatureLibraryBrowser();
checkNpcCreatureCreatorEditor();
checkNpcCreatureWorldCatalog();
checkNpcCreaturePromotion();
checkNpcCreatureSessionInstances();
checkCharacterCreationValidation();
checkPowersEssencesValidation();
checkDriveMomentumValidation();
checkWorldProfilesValidation();
checkAllCoreSkillsValidation();
checkNoncombatProjectsSocialValidation();
checkConditionsResistancesValidation();
checkTravelChaseVehiclesValidation();
checkCharacterEditorRulesUxValidation();
checkGearResourcesLoadValidation();
checkAnalogEndToEndPlaytestValidation();
checkAssetLicenseInventory();
scanAddedLinesForSecrets();
reportDependencyAudit();

console.log('Test Gate passed.');

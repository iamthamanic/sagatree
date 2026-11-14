#!/usr/bin/env node
/**
 * AIB-06 self-test — Read/Nav tool registry, deny paths, navigate allowlist, flags.
 * Location: scripts/aiberto-aib-06-tools-read.self-test.mjs
 *
 * Avoids Atlas #1283 / AIB-03 #1287 conflict files (e2e phase-a, playwright, atlas barrels).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outdir = join(root, 'node_modules', '.cache', 'aiberto-aib-06-tools-read');
mkdirSync(outdir, { recursive: true });

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function check(condition, message) {
  if (!condition) fail(message);
}

const esbuild =
  [
    join(root, 'node_modules', '.bin', 'esbuild'),
    join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'),
  ].find((p) => existsSync(p)) ?? null;
check(esbuild, 'esbuild available');

console.log('AIB-06: static surfaces + flags…');

const flags = readFileSync(join(root, 'src/app/ai-assistant/aiberto-flags.ts'), 'utf8');
check(flags.includes('isAibertoToolsReadEnabled'), 'tools flag export');
check(flags.includes('VITE_AIBERTO_TOOLS_READ_ENABLED'), 'VITE tools flag');

const card = readFileSync(join(root, 'src/app/ai-assistant/AibertoToolActivityCard.tsx'), 'utf8');
check(card.includes('data-aiberto-tool-activity'), 'tool activity marker');
check(!card.includes('dangerouslySetInnerHTML'), 'no HTML injection in activity card');

const chat = readFileSync(join(root, 'src/app/ai-assistant/AibertoChatPanel.tsx'), 'utf8');
check(chat.includes('isAibertoToolsReadEnabled'), 'chat gates tools surface');
check(chat.includes('AibertoToolActivityList'), 'activity list composed');
check(chat.includes('invokeAibertoTool'), 'uses tools service');

const infra = readFileSync(join(root, 'src/infrastructure/ai/aiberto-tools-service.ts'), 'utf8');
check(infra.includes('/api/v1/ai/aiberto-tools/capabilities'), 'capabilities path');
check(infra.includes('/api/v1/ai/aiberto-tools/invoke'), 'invoke path');
check(infra.includes("credentials: 'include'"), 'cookie credentials');

const policy = readFileSync(
  join(root, 'server/src/modules/permissions/internal/policy-service.ts'),
  'utf8',
);
check(policy.includes("'aiberto.tools'"), 'policy op aiberto.tools');
check(!/character\.read/.test(policy), 'no invented character.read PolicyOp');

const atlasWorkbench = join(root, 'src/app/world/atlas/WorldAtlasWorkbench.tsx');
check(existsSync(atlasWorkbench), 'atlas workbench exists (untouched expectation)');
// Overlap guards vs open sibling PRs
check(!existsSync(join(root, 'e2e/aiberto-tools.spec.ts')), 'no stolen AIB-03-style e2e path');

const registrySrc = readFileSync(
  join(root, 'server/src/modules/ai/internal/registry.ts'),
  'utf8',
);
check(
  /export type AiModality = 'image' \| '3d' \| 'video' \| 'audio';/.test(registrySrc),
  'AiModality media catalog unchanged',
);

console.log('AIB-06: ensure rulebook host-runtime…');
execFileSync(process.execPath, [join(root, 'scripts/build-rulebook-index.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

console.log('AIB-06: bundle aiberto-tools…');
const bundleOut = join(outdir, 'aiberto-tools.mjs');
execFileSync(
  esbuild,
  [
    join(root, 'server/src/application/aiberto-tools/index.ts'),
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--packages=external',
    `--outfile=${bundleOut}`,
  ],
  { stdio: 'inherit' },
);

const toolsMod = await import(pathToFileURL(bundleOut).href);
const {
  createAibertoToolsUseCases,
  isAibertoToolsReadEnabled,
  resolveNavigateAllowlist,
  listAibertoToolCapabilities,
  AIBERTO_TOOL_IDS,
} = toolsMod;

check(isAibertoToolsReadEnabled(() => undefined) === false, 'tools flag default off');
check(
  isAibertoToolsReadEnabled((k) => (k === 'AIBERTO_TOOLS_READ_ENABLED' ? '1' : undefined)) ===
    true,
  'tools flag on',
);

const caps = listAibertoToolCapabilities();
check(caps.length === AIBERTO_TOOL_IDS.length, 'capabilities count matches registry');
check(
  caps.every((t) => AIBERTO_TOOL_IDS.includes(t.id)),
  'capabilities ⊆ registry',
);

const navOk = resolveNavigateAllowlist('library');
check(navOk.ok === true && navOk.action.path.includes('/library'), 'navigate library allow');
const navDeny = resolveNavigateAllowlist('https://evil.example/');
check(navDeny.ok === false, 'navigate absolute URL deny');
const navGm = resolveNavigateAllowlist('/gamemaster');
check(navGm.ok === false, 'navigate gamemaster not allowlisted');
const navLive = resolveNavigateAllowlist('/sagas/SA-ABCDE/sessions/SE-1/live');
check(navLive.ok === false, 'navigate live path deny');

const actor = { kind: 'solo-local', actorId: '11111111-1111-4111-8111-111111111111' };
const strangerOwner = '22222222-2222-4222-8222-222222222222';

const ownedRows = [
  {
    id: 'char-own-1',
    publicId: 'CH-OWN01',
    ownerUserId: actor.actorId,
    characterType: 'pc',
    sheetStatus: 'complete',
    name: 'Held',
    description: '',
    level: 1,
    sheet: {},
    portraitStoragePath: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const rulebookRuntime = await import(
  pathToFileURL(join(root, 'src/domains/rulebook/generated/host-runtime.mjs')).href
);

function makeUc(overrides = {}) {
  return createAibertoToolsUseCases({
    envGet: (k) => (k === 'AIBERTO_TOOLS_READ_ENABLED' ? '1' : undefined),
    authorize: (a) =>
      a?.actorId ? { allow: true, reason: 'ok' } : { allow: false, reason: 'missing-actor' },
    authorizeWorldRead: () => ({ allow: true, reason: 'ok' }),
    character: {
      moduleId: 'character',
      listOwnedCharacters: (actorId) => ({
        ok: true,
        value: ownedRows.filter((r) => r.ownerUserId === actorId),
      }),
      getOwnedCharacter: (actorId, characterId) => {
        const row = ownedRows.find((r) => r.id === characterId && r.ownerUserId === actorId);
        return { ok: true, value: row ?? null };
      },
    },
    inventory: {
      moduleId: 'inventory',
      getOwnedInventory: (actorId, characterId) => {
        if (actorId !== actor.actorId) return { ok: false, error: 'forbidden' };
        const owned = ownedRows.find((r) => r.id === characterId);
        if (!owned) return { ok: true, value: null };
        return {
          ok: true,
          value: {
            characterId,
            schemaVersion: 1,
            inventory: { slots: [] },
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        };
      },
    },
    world: {
      moduleId: 'world',
      read: {
        listOwnedWorlds: () => ({ ok: true, value: [] }),
        getWorld: () => ({ ok: false, error: 'not-found' }),
        getWorldByPublicId: () => ({ ok: false, error: 'not-found' }),
      },
    },
    session: null,
    // Bundled self-test cannot resolve packaged host-runtime via import.meta — inject.
    loadRulebook: async () => rulebookRuntime,
    ...overrides,
  });
}

console.log('AIB-06: TOOL_UNKNOWN / INVALID_ARGS / cross-owner…');
const uc = makeUc();

const disabledUc = makeUc({ envGet: () => undefined });
const disabled = await disabledUc.invoke(actor, {
  toolId: 'rulebook.search',
  args: { query: 'x' },
});
check(disabled.status === 'disabled', 'flag off → disabled');

const unknown = await uc.invoke(actor, { toolId: 'shell.exec', args: {} });
check(unknown.status === 'error' && unknown.code === 'TOOL_UNKNOWN', 'TOOL_UNKNOWN before use-case');

const badArgs = await uc.invoke(actor, { toolId: 'rulebook.search', args: {} });
check(badArgs.status === 'error' && badArgs.code === 'INVALID_ARGS', 'INVALID_ARGS before use-case');

const forged = await uc.invoke(actor, {
  toolId: 'character.get',
  args: { characterId: 'char-foreign', ownerUserId: strangerOwner, role: 'gm' },
});
check(
  forged.status === 'error' && forged.code === 'FORBIDDEN',
  'cross-owner / missing owned → FORBIDDEN (SCN-012)',
);

const list = await uc.invoke(actor, { toolId: 'character.list', args: { role: 'gm' } });
check(list.status === 'ok', 'character.list ok');
check(
  list.data.characters.length === 1 && !('ownerUserId' in list.data.characters[0]),
  'character DTO filtered',
);

const own = await uc.invoke(actor, { toolId: 'character.get', args: { characterId: 'char-own-1' } });
check(own.status === 'ok' && own.data.character.publicId === 'CH-OWN01', 'owned get ok');

const nav = await uc.invoke(actor, { toolId: 'app.navigate', args: { route: 'dashboard' } });
check(
  nav.status === 'ok' && nav.clientAction?.path === '/',
  'app.navigate ClientAction allowlist',
);

const search = await uc.invoke(actor, {
  toolId: 'rulebook.search',
  args: { query: 'Erfahrungsbonus', limit: 3 },
});
check(search.status === 'ok' && Array.isArray(search.data.hits), 'rulebook.search ok');

const capsResult = uc.capabilities(actor);
check(capsResult.status === 'ok' && capsResult.note.includes('capabilities'), 'capabilities note');

// Budget: force 1/min then second call fails (shared in-memory store inside use-case)
const budgetUc = makeUc({ budgetPerMinute: 1 });
const first = await budgetUc.invoke(actor, { toolId: 'character.list', args: {} });
const second = await budgetUc.invoke(actor, { toolId: 'character.list', args: {} });
check(first.status === 'ok', 'budget first ok');
check(second.status === 'error' && second.code === 'BUDGET_EXCEEDED', 'budget second denied');

writeFileSync(join(outdir, 'ok'), 'ok\n');
console.log('AIB-06 tools-read self-test passed.');

#!/usr/bin/env node
/**
 * saga-editor-v1-check — #575 editor route, hook API, save/publish RPCs.
 * Location: scripts/saga-editor-v1-check.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function fail(message) {
  console.error(`Saga editor v1 check failed: ${message}`);
  process.exit(1);
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) fail(`missing ${label}`);
}

const migrationPath = 'supabase/migrations/064_saga_editor_v1.sql';
if (!existsSync(join(root, migrationPath))) fail(`missing ${migrationPath}`);
const migration = read(migrationPath);
requireMatch(migration, /draft_revision/i, 'draft_revision');
requireMatch(migration, /save_saga_definition_draft/i, 'save RPC');
requireMatch(migration, /publish_saga_definition_version/i, 'publish RPC');
requireMatch(migration, /copy_native_saga_definition/i, 'copy RPC');
requireMatch(migration, /create_user_saga_definition/i, 'create RPC');
requireMatch(migration, /get_saga_definition_editor/i, 'editor load RPC');
requireMatch(migration, /Native Sagas sind unveränderlich/i, 'native immutable');

const hook = read('src/app/saga/editor/useSagaDefinitionEditor.ts');
requireMatch(hook, /export function useSagaDefinitionEditor/i, 'hook export');
requireMatch(hook, /publishVersion/i, 'publishVersion');
requireMatch(hook, /createCopyFromNative/i, 'createCopyFromNative');
requireMatch(hook, /isDirty/i, 'isDirty');
requireMatch(hook, /revision/i, 'revision');
requireMatch(hook, /800/i, 'debounce 800ms');
requireMatch(hook, /useState|useEffect|useRef/i, 'allowed hooks');
if (/\buseCallback\b|\buseMemo\b|\buseQuery\b/.test(hook)) {
  fail('hook must not use useCallback/useMemo/useQuery');
}

const screen = read('src/app/saga/editor/SagaEditorScreen.tsx');
requireMatch(screen, /data-saga-editor-publish/i, 'publish CTA');
requireMatch(screen, /data-saga-editor-copy-native/i, 'native copy CTA');
requireMatch(screen, /data-au-surface="journey"/i, 'AU journey surface');
requireMatch(screen, /min-h-11/i, 'Fitts touch targets');
requireMatch(screen, /safe-area-inset/i, 'safe areas');

const routes = read('src/app/shell/routing/routes.ts');
requireMatch(routes, /saga-definition-edit/i, 'route kind');
requireMatch(routes, /pathForSagaDefinitionEdit/i, 'path helper');
requireMatch(routes, /\/story-definitions\//i, 'story-definitions path');

const service = read('src/infrastructure/saga/saga-definition-service.ts');
requireMatch(service, /saveHostSagaDefinitionDraft/i, 'service save host HTTP (CUT-20)');
requireMatch(service, /publishHostSagaDefinitionVersion/i, 'service publish host HTTP (CUT-20)');
requireMatch(service, /copyHostNativeSagaDefinition/i, 'service copy host HTTP (CUT-20)');
requireMatch(service, /isHostLibraryEnabled/i, 'service host library gate');
if (
  /save_saga_definition_draft|publish_saga_definition_version|copy_native_saga_definition|\.rpc\s*\(|supabase/.test(
    service,
  )
) {
  fail('service must not call legacy saga-editor RPCs (CUT-20)');
}

const domain = read('src/domains/saga/contracts/saga-definition.ts');
requireMatch(domain, /SagaDefinitionDraft/i, 'draft type');
requireMatch(domain, /validateSagaDefinitionDraft/i, 'validation');
requireMatch(domain, /pregens/i, 'pregens field');
requireMatch(domain, /blurb/i, 'blurb field');

// Library card no longer embeds story-edit CTA (#workspace UX); create stays.
const library = read('src/app/library/Library.tsx');
requireMatch(library, /data-library-saga-create/i, 'library saga create CTA');
requireMatch(library, /pathForSagaNew/i, 'library saga new path');
// Story definition editor remains reachable via routed path helper (routes check above).

const apply = read('scripts/apply-migrations.sh');
if (!apply.includes('064_saga_editor_v1.sql')) fail('apply-migrations must list 064');

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('saga-editor-v1-check.mjs')) {
  fail('test-gate must invoke saga-editor-v1-check.mjs');
}

const docs = read('docs/navigation-public-ids.md');
requireMatch(docs, /story-definitions/i, 'docs story-definitions');

const touched = [hook, screen, service, domain, routes];
for (const content of touched) {
  if (/\bas any\b|eslint-disable|@ts-ignore|@ts-expect-error/.test(content)) {
    fail('type escape hatch in touched files');
  }
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/saga-editor-v1-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'def.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/saga/contracts/saga-definition.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});
const mod = await import(pathToFileURL(out).href);

const draft = {
  sagaId: 's',
  sagaSlug: 'u',
  origin: 'user',
  canEdit: true,
  title: '',
  blurb: 'x',
  locations: [],
  knowledgeFacts: [],
  pregens: [],
  packageId: null,
  simulation: {
    startDay: 0,
    deadlines: [],
    threats: [],
    rules: [],
    factions: [],
  },
}
const errors = mod.validateSagaDefinitionDraft(draft);
if (!errors.title) fail('expected empty title validation error');

const payload = mod.draftToPayload({ ...draft, title: 'T' });
if (payload.synopsis !== 'x' || payload.blurb !== 'x') fail('blurb should sync to synopsis');

console.log('Saga editor v1 check passed.');

#!/usr/bin/env node
/**
 * mig-408-export-quarantine.self-test — preserve 404; isolate fixtures (#824).
 * Location: scripts/mig-408-export-quarantine.self-test.mjs
 */
import { createServer } from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const modUrl = pathToFileURL(join(root, 'server/src/modules/media/index.ts')).href;
const {
  EXPORT_PDF_IS_VALIDATED_PIPELINE,
  EXPORT_PUBLIC_ACTIVATION_AUTHORIZED,
  buildExport,
  exportJson,
  exportMarkdown,
  exportPdf,
  parseImportContent,
} = await import(modUrl);

const allowUrl = pathToFileURL(
  join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
).href;
const { isEdgeDispatcherAllowed, EDGE_DISPATCHER_ALLOWLIST } = await import(allowUrl);
const { createRouteHandler } = await import(
  pathToFileURL(join(root, 'server/src/http/route-registry.ts')).href
);

function stubDeps(extra = {}) {
  return {
    health: { execute: () => ({ ready: true, mode: 'solo', dataDirFingerprint: 't' }) },
    ops: {
      getHealth: () => ({ ready: true, mode: 'solo', dataDirFingerprint: 't' }),
      acceptMutations: () => true,
    },
    permissions: { authorize: () => ({ allow: true, reason: 'test' }) },
    identity: {
      resolveSoloActor: () => ({ kind: 'solo-local', actorId: 'test' }),
      resolveRemoteSession: async () => ({ ok: false, code: 'AUTH_NOT_CONFIGURED' }),
      linkSoloToRemoteAccount: () => ({ ok: false, code: 'INVALID_LINK_REQUEST' }),
    },
    transport: {
      applyCommand: () => ({ ok: false, error: 'INVALID_PAYLOAD' }),
      getSnapshot: () => ({ ok: false, error: 'INVALID_PAYLOAD' }),
    },
    recordPing: () => ({ ok: true }),
    authHandlerRef: { current: null },
    tryAuthorizedProjectTouch: () => ({ ok: false, status: 403, error: 'test' }),
    tryAuthorizedWorldTouch: () => ({ ok: false, status: 403, error: 'test' }),
    ...extra,
  };
}

async function withHandler(deps, fn) {
  const handler = createRouteHandler(deps);
  const server = createServer((req, res) => {
    void Promise.resolve(handler(req, res));
  });
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve).on('error', reject);
  });
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

// --- Fall 1: export/import stay 404 ---
assert(EXPORT_PUBLIC_ACTIVATION_AUTHORIZED === false, 'activation denied');
assert(isEdgeDispatcherAllowed('export') === false, 'allowlist deny');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('export'), 'not in allowlist');

await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of [
    '/export',
    '/export/export',
    '/export/import',
    '/functions/v1/export',
    '/functions/v1/export/export',
    '/functions/v1/export/import',
  ]) {
    for (const method of ['GET', 'POST', 'OPTIONS']) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify({ content: '{}' }) : undefined,
      });
      assert(res.status === 404, `${method} ${path} → 404, got ${res.status}`);
    }
  }
});

// --- Fall 2: JSON indent, markdown, PDF header/filename; invalid → 400 ---
const data = {
  name: 'Hero',
  race: 'Elf',
  class: 'Wizard',
  level: 3,
  attributes: { strength: 8 },
  equipment: [{ name: 'Staff', equipped: true }],
};
const json = exportJson(data);
assert(json === JSON.stringify(data, null, 2), 'JSON indentation null,2');
assert(json.includes('\n  "name"'), 'pretty-printed');

const md = exportMarkdown(data, 'character');
assert(md.startsWith('# Hero'), 'md title');
assert(md.includes('**Race:** Elf') && md.includes('Staff (equipped)'), 'md fields');
const falsyMd = exportMarkdown({ name: '', race: '', class: '', level: 0 }, 'character');
assert(falsyMd.startsWith('# Character'), 'falsy name → Character');
assert(falsyMd.includes('**Race:** Unknown') && falsyMd.includes('**Level:** 1'), 'falsy || defaults');

const pdf = exportPdf(data, 'character');
const pdfText = new TextDecoder().decode(pdf);
assert(pdfText.startsWith('%PDF-1.4'), 'PDF header');
assert(pdfText.includes('Hero'), 'PDF embeds markdown content');

const builtJson = buildExport({ type: 'character', id: 'c1', format: 'json', data });
assert(!('error' in builtJson) && builtJson.filename === 'character-c1.json', 'json filename');
const builtMd = buildExport({ type: 'character', id: 'c1', format: 'markdown', data });
assert(!('error' in builtMd) && builtMd.filename === 'character-c1.md', 'md filename');
const builtPdf = buildExport({ type: 'character', id: 'c1', format: 'pdf', data });
assert(!('error' in builtPdf) && builtPdf.filename === 'character-c1.pdf', 'pdf filename');

const badFmt = buildExport({ type: 'character', id: 'c1', format: 'xml', data });
assert('error' in badFmt && badFmt.status === 400 && badFmt.error === 'Invalid format', 'invalid format 400');

const badImport = parseImportContent('{not-json');
assert(!badImport.ok && badImport.status === 400 && badImport.error === 'Invalid JSON', 'invalid JSON 400');

// --- Fall 3: import parse is not persistence ---
const imported = parseImportContent(JSON.stringify({ arbitrary: true, nested: { x: 1 } }));
assert(imported.ok && imported.persisted === false, 'import not persisted');
assert(imported.ok && imported.data?.arbitrary === true, 'arbitrary content accepted');

// --- Fall 4: no auth; typed-as-any content; PDF not validated pipeline ---
assert(EXPORT_PDF_IS_VALIDATED_PIPELINE === false, 'PDF not validated pipeline');
assert(EXPORT_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no auth activation');

console.log('PASS mig-408-export-quarantine.self-test');

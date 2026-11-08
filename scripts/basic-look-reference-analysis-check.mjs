#!/usr/bin/env node
/**
 * basic-look-reference-analysis-check — Provider-neutral Look reference analysis (#352).
 * Location: scripts/basic-look-reference-analysis-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const require = createRequire(import.meta.url);
let failures = 0;
let group = '';

function section(name) {
  group = name;
}

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message}`);
  }
}

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

function mustExist(relPath) {
  check(existsSync(join(root, relPath)), `missing ${relPath}`);
}

section('1 · files');
[
  'src/domains/look/reference-analysis.ts',
  'src/infrastructure/look/look-reference-analysis-service.ts',
  'src/infrastructure/look/look-service.ts',
  'archive/supabase-legacy/supabase/functions/look-reference-analysis/index.ts',
  'archive/supabase-legacy/supabase/functions/_shared/look-reference-analysis-provider.ts',
  'archive/supabase-legacy/supabase/functions/_shared/look-reference-analysis-image.ts',
  'archive/supabase-legacy/supabase/functions/_shared/look-reference-analysis-rate-limit.ts',
  '.qa/acceptance/basic-look-reference-analysis.md',
].forEach(mustExist);

section('2 · domain has no provider leak');
{
  const domain = read('src/domains/look/reference-analysis.ts');
  check(!/LOOK_AI_|CHARACTER_AI_|Bearer |sk-/.test(domain), 'domain free of provider secrets/env');
  check(
    !/from ['"].*look-reference-analysis-provider/.test(domain),
    'domain does not import edge provider',
  );
  check(/LOOK_REFERENCE_ANALYSIS_VERSION/.test(domain), 'analysis version constant');
  check(/LookReferenceAnalyzer/.test(domain), 'analyzer contract');
  check(/normalizeLookReferenceAnalysisPayload/.test(domain), 'normalize export');
  check(/source:\s*'reference-analysis'/.test(domain), 'write draft source');
}

section('3 · edge + infra wiring');
{
  const edge = read('archive/supabase-legacy/supabase/functions/look-reference-analysis/index.ts');
  const provider = read('archive/supabase-legacy/supabase/functions/_shared/look-reference-analysis-provider.ts');
  const service = read('src/infrastructure/look/look-reference-analysis-service.ts');
  const lookService = read('src/infrastructure/look/look-service.ts');
  check(/authenticate/.test(edge), 'edge auth');
  check(/consumeLookReferenceAnalysisRateLimit/.test(edge), 'edge rate limit');
  check(/assertOwnerScopedStoragePath/.test(edge), 'owner-scoped storage');
  check(/analyzeLookReferencesWithVision/.test(provider), 'vision adapter');
  check(/LOOK_AI_API_KEY|CHARACTER_AI_API_KEY/.test(provider), 'server secrets only in provider');
  check(/normalizeLookReferenceAnalysisPayload/.test(service), 'client re-normalizes');
  check(/createLookProfileFromReferenceAnalysis/.test(lookService), 'gated persist helper');
  check(
    /\/api\/v1\/ai\/look-reference-analysis/.test(service) && !/functions\.invoke/.test(service),
    'invokes host look-reference-analysis API (CUT-20)',
  );
}

section('4 · domain smoke');
{
  const esbuild = require('esbuild');
  const outfile = join(
    root,
    'node_modules/.cache/basic-look-reference-analysis-check/domain.mjs',
  );
  esbuild.buildSync({
    entryPoints: [join(root, 'src/domains/look/reference-analysis.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const m = await import(pathToFileURL(outfile).href);

  const styleRef = {
    id: 'r-style',
    kind: 'style',
    mime: 'image/png',
    uri: 'owner/ref-style.png',
    weight: 0.8,
  };
  const contentRef = {
    id: 'r-content',
    kind: 'content',
    mime: 'image/jpeg',
    uri: 'owner/ref-content.jpg',
    weight: 0.5,
  };

  const tooMany = m.assertLookReferenceAnalysisInput(
    Array.from({ length: 11 }, (_, i) => ({
      id: `r${i}`,
      kind: 'style',
      mime: 'image/png',
      uri: `u/${i}.png`,
    })),
  );
  check(tooMany.ok === false && tooMany.code === 'reference-count', 'rejects >10');

  const badMime = m.assertLookReferenceAnalysisInput([
    { id: 'x', kind: 'style', mime: 'image/gif', uri: 'u/x.gif' },
  ]);
  check(badMime.ok === false && badMime.code === 'invalid-mime', 'rejects gif');

  const okPayload = m.normalizeLookReferenceAnalysisPayload(
    {
      displayName: 'Ink Toon',
      palette: {
        primary: '#112233',
        secondary: '#445566',
        accent: '#ffaa00',
        background: '#000000',
      },
      knobs: {
        characterStylization: 80,
        characterOutline: 70,
        lightingWarmth: 40,
        lightingKey: 65,
        postFxContrast: 55,
        postFxSaturation: 45,
      },
      contentNotes: 'hero with cape',
    },
    { references: [styleRef, contentRef], analyzedAtIso: '2026-01-01T00:00:00.000Z' },
  );
  check(okPayload.ok === true, 'valid payload ok');
  if (okPayload.ok) {
    check(okPayload.writeDraft.source === 'reference-analysis', 'write source');
    check(
      okPayload.draft.provenance.analysisVersion === m.LOOK_REFERENCE_ANALYSIS_VERSION,
      'provenance version',
    );
    check(
      okPayload.draft.provenance.styleReferenceCount === 1 &&
        okPayload.draft.provenance.contentReferenceCount === 1,
      'style/content counts',
    );
    check(
      okPayload.writeDraft.references.some((r) => r.id === 'r-content' && r.kind === 'content'),
      'content ref preserved as content',
    );
    check(
      okPayload.writeDraft.references.some((r) => r.id === 'ref.sagatree-palette-v1'),
      'palette structured ref',
    );
    check(
      okPayload.writeDraft.references.some((r) => r.id === 'ref.sagatree-knobs-v1'),
      'knobs structured ref',
    );
  }

  const leak = m.normalizeLookReferenceAnalysisPayload(
    { apiKey: 'secret', knobs: { characterStylization: 10 } },
    { references: [styleRef] },
  );
  check(leak.ok === false && leak.code === 'provider-leak', 'rejects provider leak');

  const contentOnly = m.normalizeLookReferenceAnalysisPayload(
    {
      displayName: 'Subject only',
      palette: {
        primary: '#ff0000',
        secondary: '#00ff00',
        accent: '#0000ff',
        background: '#ffffff',
      },
      knobs: {
        characterStylization: 99,
        characterOutline: 99,
        lightingWarmth: 99,
        lightingKey: 99,
        postFxContrast: 99,
        postFxSaturation: 99,
      },
      contentNotes: 'knight',
    },
    { references: [contentRef] },
  );
  check(contentOnly.ok === true, 'content-only accepted');
  if (contentOnly.ok) {
    check(
      contentOnly.draft.knobs.characterStylization === 55 &&
        contentOnly.draft.palette.primary === '#4a5568',
      'content-only does not apply style from payload',
    );
    check(contentOnly.draft.contentNotes === 'knight', 'content notes kept');
  }

  const freeText = m.normalizeLookReferenceAnalysisPayload('just text', {
    references: [styleRef],
  });
  check(freeText.ok === false, 'rejects free text');
}

section('5 · barrel + acceptance + test-gate');
{
  const barrel = read('src/domains/look/index.ts');
  check(/reference-analysis/.test(barrel), 'domain barrel exports analysis');
  const acceptance = read('.qa/acceptance/basic-look-reference-analysis.md');
  check(/#352|LookReferenceAnalyzer|look-ref-analysis-v1/.test(acceptance), 'acceptance present');
  const gate = read('scripts/test-gate.mjs');
  check(/basic-look-reference-analysis-check\.mjs/.test(gate), 'test-gate wiring');
}

if (failures > 0) {
  console.error(`\nbasic-look-reference-analysis-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('basic-look-reference-analysis-check: OK (#352)');

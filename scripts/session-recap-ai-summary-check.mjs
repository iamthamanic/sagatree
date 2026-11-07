#!/usr/bin/env node
/**
 * session-recap-ai-summary-check — #573 edge + prompt redaction + hook contract.
 * Location: scripts/session-recap-ai-summary-check.mjs
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
  console.error(`Session recap AI summary check failed: ${message}`);
  process.exit(1);
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) fail(`missing ${label}`);
}

const migrationPath = 'supabase/migrations/062_session_recap_ai_summary.sql';
if (!existsSync(join(root, migrationPath))) fail(`missing ${migrationPath}`);
const migration = read(migrationPath);
requireMatch(migration, /summary_status/i, 'summary_status column');
requireMatch(migration, /consume_session_recap_rate_limit/i, 'rate limit RPC');
requireMatch(migration, /REVOKE ALL ON TABLE public\.session_recaps FROM anon, authenticated/i, 'revoke table SELECT');
requireMatch(migration, /v_status IS DISTINCT FROM 'approved'/i, 'draft hidden from non-GM');

const edge = read('supabase/functions/session-recap/index.ts');
requireMatch(edge, /corsHeaders|handleOptions/i, 'shared CORS');
requireMatch(edge, /consumePersistentSessionRecapRateLimit/i, 'rate limit consume');
requireMatch(edge, /Client-Prompt-Payload/i, 'reject client prompt payload');
requireMatch(edge, /buildSessionRecapPrompt/i, 'server prompt build');
requireMatch(edge, /summary_status:\s*'draft'/i, 'persist draft');

const sharedPrompt = read('supabase/functions/_shared/session-recap-prompt.ts');
requireMatch(sharedPrompt, /gm_only/i, 'spoiler filter');

const domain = read('src/domains/session/contracts/episode-summary-prompt.ts');
requireMatch(domain, /filterSpoilerSafeHighlightLines/i, 'domain filter');
requireMatch(domain, /buildEpisodeSummaryPrompt/i, 'domain builder');

const hook = read('src/app/session/hooks/useEpisodeSummary.ts');
requireMatch(hook, /generating/i, 'generating state');
requireMatch(hook, /AbortController/i, 'abort');
requireMatch(hook, /useState|useEffect|useRef/i, 'allowed hooks');
if (/useMemo|useCallback/.test(hook)) fail('hook must not use useMemo/useCallback');

const panel = read('src/app/session/EpisodeSummaryPanel.tsx');
requireMatch(panel, /data-episode-summary-generate/i, 'generate CTA');
requireMatch(panel, /data-episode-summary-approve/i, 'approve CTA');
requireMatch(panel, /isGm/i, 'GM gate');

const service = read('src/infrastructure/session/session-recap-ai-service.ts');
requireMatch(service, /generateHostSessionRecapDraft/i, 'host generate (CUT-20)');
requireMatch(service, /saveHostSessionRecapSummary/i, 'host save summary (CUT-20)');
if (/functions\.invoke|\.rpc\s*\(|supabase/.test(service)) {
  fail('service must not invoke Edge/RPC (CUT-20 host HTTP)');
}
if (/\bas any\b|eslint-disable|@ts-ignore/.test(service + domain + hook)) {
  fail('type escape hatch');
}

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('session-recap-ai-summary-check.mjs')) {
  fail('test-gate must invoke session-recap-ai-summary-check.mjs');
}

const apply = read('scripts/apply-migrations.sh');
if (!apply.includes('062_session_recap_ai_summary.sql')) {
  fail('apply-migrations must list 062');
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/session-recap-ai-summary-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'prompt.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/episode-summary-prompt.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});
const mod = await import(pathToFileURL(out).href);

const filtered = mod.filterSpoilerSafeHighlightLines([
  { id: '1', kind: 'note', summary: 'Geheim', visibility: 'gm_only' },
  { id: '2', kind: 'note', summary: 'Öffentlich', visibility: 'shared' },
]);
if (filtered.length !== 1 || filtered[0].summary !== 'Öffentlich') {
  fail('expected gm_only redaction');
}

const prompt = mod.buildEpisodeSummaryPrompt({
  sessionName: 'Nacht 1',
  sagaTitle: 'Dornhain',
  highlightLines: [
    { id: '1', kind: 'note', summary: 'Geheim', visibility: 'gm_only' },
    { id: '2', kind: 'note', summary: 'Tor geöffnet', visibility: 'public' },
  ],
});
if (prompt.user.includes('Geheim')) fail('prompt must not include gm_only text');
if (!prompt.user.includes('Tor geöffnet')) fail('prompt must include public events');
if (prompt.version !== 'episode-summary-v1') fail('prompt version');

console.log('Session recap AI summary check passed.');

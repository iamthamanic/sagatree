#!/usr/bin/env node
/**
 * session-knowledge-reveals-check — Knowledge / Secrets / Reveals (#367).
 * Location: scripts/session-knowledge-reveals-check.mjs
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function mustInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${label}: missing ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

function mustNotInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (text.includes(needle)) {
      throw new Error(`${label}: forbidden ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

mustInclude(
  'archive/supabase-legacy/supabase/migrations/048_session_knowledge_reveals.sql',
  [
    'sagadrive_apply_knowledge_reveal',
    'sagadrive_project_shared_knowledge',
    "p_kind = 'reveal'",
    'shared.knowledge',
    'get_session_runtime_snapshot',
  ],
  'knowledge migration',
);

mustInclude(
  'src/domains/session/knowledge/knowledge-contract.ts',
  [
    'projectKnowledgeForAccess',
    'KnowledgeVisibility',
    'RevealTarget',
    'applyRevealToKnowledgeState',
    'gm_only',
    'character_specific',
  ],
  'knowledge domain',
);

mustNotInclude(
  'src/domains/session/knowledge/knowledge-contract.ts',
  ['supabase', "from 'react'", 'from "react"'],
  'pure knowledge domain',
);

mustInclude(
  'src/domains/session/contracts/session-runtime.ts',
  ["| 'reveal'", "'reveal'"],
  'reveal event kind',
);

mustInclude(
  'src/app/session/hooks/useSessionKnowledge.ts',
  ["kind: 'reveal'", 'projectKnowledgeForAccess'],
  'knowledge hook',
);

mustInclude(
  'src/app/session/knowledge/KnowledgeGmControls.tsx',
  ['data-knowledge-gm="v1"', 'Reveal senden'],
  'GM knowledge UI',
);

mustInclude(
  'src/app/session/GamemasterPanel.tsx',
  ['KnowledgeGmControls', 'useSessionKnowledge'],
  'GM panel wiring',
);

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('session-knowledge-reveals-check.mjs')) {
  throw new Error('test-gate must invoke session-knowledge-reveals-check.mjs');
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/session-knowledge-reveals-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'knowledge.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/knowledge/knowledge-contract.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});
const mod = await import(pathToFileURL(out).href);

let state = mod.emptyKnowledgeState('t0');
state = mod.upsertKnowledgeFact(
  state,
  {
    id: 'secret-1',
    title: 'Geheimes Siegel',
    visibility: 'gm_only',
    body: 'SUPERSECRET',
    handoutRef: null,
    characterId: null,
  },
  't1',
);
state = mod.upsertKnowledgeFact(
  state,
  {
    id: 'pc-note',
    title: 'Aria Notiz',
    visibility: 'character_specific',
    body: 'PC ONLY',
    handoutRef: null,
    characterId: 'char-aria',
  },
  't1',
);

const shared = { knowledge: state };
const viewer = mod.projectKnowledgeForAccess(shared, {
  role: 'viewer',
  capabilities: [],
  characterId: null,
});
if (viewer.facts.some((f) => f.body === 'SUPERSECRET' || f.id === 'secret-1')) {
  throw new Error('viewer must not see gm_only secret');
}

const playerOther = mod.projectKnowledgeForAccess(shared, {
  role: 'player',
  capabilities: [],
  characterId: 'char-other',
});
if (playerOther.facts.some((f) => f.body === 'PC ONLY' || f.body === 'SUPERSECRET')) {
  throw new Error('player must not see other character / gm secret bodies');
}

const playerAria = mod.projectKnowledgeForAccess(shared, {
  role: 'player',
  capabilities: [],
  characterId: 'char-aria',
});
const ariaFact = playerAria.facts.find((f) => f.id === 'pc-note');
if (!ariaFact || ariaFact.body !== 'PC ONLY') {
  throw new Error('assigned character must see character_specific body');
}

state = mod.applyRevealToKnowledgeState(
  state,
  { factId: 'secret-1', target: { kind: 'everyone' } },
  { revealId: 'r1', revealedAt: 't2', byUserId: 'gm' },
);
const after = mod.projectKnowledgeForAccess(
  { knowledge: state },
  { role: 'player', capabilities: [], characterId: 'char-other' },
);
const revealed = after.facts.find((f) => f.id === 'secret-1');
if (!revealed || revealed.body !== 'SUPERSECRET') {
  throw new Error('after everyone reveal player must see body');
}

console.log('session-knowledge-reveals-check PASS');

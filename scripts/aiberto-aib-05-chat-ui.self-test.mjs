#!/usr/bin/env node
/**
 * AIB-05 self-test — chat capability flag, safe markdown, companion wiring (no AIB-03 e2e).
 * Location: scripts/aiberto-aib-05-chat-ui.self-test.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outdir = join(root, 'node_modules', '.cache', 'aiberto-aib-05-chat-ui');
mkdirSync(outdir, { recursive: true });

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function check(condition, message) {
  if (!condition) fail(message);
}

console.log('AIB-05: static surface + safe markdown + host client…');

const flags = readFileSync(join(root, 'src/app/ai-assistant/aiberto-flags.ts'), 'utf8');
check(flags.includes('isAibertoChatEnabled'), 'chat flag export');
check(flags.includes('VITE_AIBERTO_CHAT_ENABLED'), 'VITE chat flag');
check(/defaultEnabled,\s*false\)|false\)/.test(flags.replace(/\s+/g, '')), 'chat default off');

const companion = readFileSync(join(root, 'src/app/ai-assistant/AibertoCompanion.tsx'), 'utf8');
check(companion.includes('isAibertoChatEnabled'), 'companion gates chat tab');
check(companion.includes('data-aiberto-tab="chat"'), 'chat tab marker');
check(companion.includes('AibertoChatPanel'), 'chat panel composed');
check(companion.includes('onOpenSection'), 'citation → section wiring');
check(!companion.includes('dangerouslySetInnerHTML'), 'no raw HTML in companion');

const chat = readFileSync(join(root, 'src/app/ai-assistant/AibertoChatPanel.tsx'), 'utf8');
check(chat.includes('streamAibertoAsk'), 'uses aiberto-ask service');
check(chat.includes('data-aiberto-chat-stop'), 'stop control');
check(chat.includes('AbortController'), 'abortable stream');
check(chat.includes('renderSafeChatMarkdown'), 'safe markdown renderer');
check(!chat.includes('dangerouslySetInnerHTML'), 'no HTML injection in chat');

const md = readFileSync(join(root, 'src/app/ai-assistant/safe-chat-markdown.tsx'), 'utf8');
check(md.includes('escapeHtml') || md.includes('stripCitationMarkers'), 'safe markdown helpers');
check(md.includes('renderSafeChatMarkdown'), 'renderSafeChatMarkdown');
check(!/\bdangerouslySetInnerHTML\b/.test(md), 'safe markdown no innerHTML API');

const infra = readFileSync(join(root, 'src/infrastructure/ai/aiberto-ask-service.ts'), 'utf8');
check(infra.includes('/api/v1/ai/aiberto-ask/stream'), 'SSE stream path');
check(infra.includes("credentials: 'include'"), 'cookie credentials');
check(infra.includes('text/event-stream'), 'SSE accept');

const browser = readFileSync(join(root, 'src/app/ai-assistant/RulebookBrowser.tsx'), 'utf8');
check(browser.includes('selectedSectionId'), 'controlled section for citations');

const barrel = readFileSync(join(root, 'src/app/ai-assistant/index.ts'), 'utf8');
check(barrel.includes('isAibertoChatEnabled'), 'barrel exports chat flag');
check(barrel.includes('AibertoChatPanel'), 'barrel exports chat panel');

// Prefer not colliding with AIB-03 Phase-A e2e files.
check(!existsSync(join(root, 'e2e/aiberto-phase-b-chat.spec.ts')), 'no AIB-03-style e2e stolen path');
check(!existsSync(join(root, 'e2e/aiberto-chat.spec.ts')), 'no parallel chat e2e path');
// AIB-03 owns Phase-A e2e + Playwright config (PR #1287) — do not edit those here.

const files = [
  'src/app/ai-assistant/AibertoChatPanel.tsx',
  'src/app/ai-assistant/safe-chat-markdown.tsx',
  'src/infrastructure/ai/aiberto-ask-service.ts',
];
for (const rel of files) {
  const src = readFileSync(join(root, rel), 'utf8');
  check(!/\bas\s+any\b|@ts-ignore|@ts-expect-error/.test(src), `${rel}: no type escape`);
}

writeFileSync(join(outdir, 'ok'), 'ok\n');
console.log('AIB-05 chat UI self-test passed.');

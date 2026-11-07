#!/usr/bin/env node
/**
 * session-invite-share-entry-check — #490 invite create/resolve/share journey.
 * Location: scripts/session-invite-share-entry-check.mjs
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
  'supabase/migrations/055_session_invites.sql',
  [
    'create_session_invite',
    'resolve_session_invite',
    'revoke_session_invite',
    'session_invites',
    'is_project_gm',
  ],
  'invite migration',
);

mustInclude(
  'src/domains/session/contracts/session-invite.ts',
  [
    'buildSessionInvitePath',
    'decideInvitePostResolveNavigation',
    'mapInviteResolvePayload',
    'setInviteReturnPath',
    'takeInviteReturnPath',
  ],
  'invite domain',
);

mustNotInclude(
  'src/domains/session/contracts/session-invite.ts',
  ['supabase', "from 'react'", 'from "react"'],
  'pure invite domain',
);

mustInclude(
  'src/infrastructure/session/session-service.ts',
  [
    'createHostSessionInvite',
    'resolveHostSessionInvite',
    'revokeHostSessionInvite',
    'host-session-http',
  ],
  'session-service invite host HTTP (CUT-20)',
);

mustInclude(
  'src/app/session/SessionInviteResolve.tsx',
  ['resolveSessionInvite', 'buildSessionJoinPath', 'data-session-invite-resolve'],
  'invite resolve UI',
);

mustInclude(
  'src/app/session/SessionInviteShareButton.tsx',
  ['Einladung kopieren', 'createSessionInvite', 'data-session-invite-copy'],
  'invite share button',
);

// Join-code + invite copy live on Lobby after create (no SessionJoin interstitial).
mustInclude(
  'src/app/session/SessionLobbyScreen.tsx',
  ['SessionInviteShareButton', 'data-session-lobby-join-code'],
  'SessionLobby share wiring',
);

mustInclude(
  'src/app/session/GamemasterLiveScreen.tsx',
  ['SessionInviteShareButton'],
  'GM Live share wiring',
);

mustInclude(
  'src/app/shell/auth/AuthGate.tsx',
  ['setInviteReturnPath', '/session-invite'],
  'AuthGate invite return stash',
);

mustInclude(
  'src/App.tsx',
  ['SessionInviteResolve', 'takeInviteReturnPath', "case 'session-invite'"],
  'App invite wiring',
);

mustInclude(
  'src/app/shell/routing/routes.ts',
  ["'session-invite'", '/session-invite'],
  'session-invite route',
);

mustInclude(
  '.qa/acceptance/session-invite-share-entry.md',
  ['session-invite-share-entry', '#490'],
  'acceptance',
);

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('session-invite-share-entry-check.mjs')) {
  throw new Error('test-gate must invoke session-invite-share-entry-check.mjs');
}

const touched = [
  'src/domains/session/contracts/session-invite.ts',
  'src/app/session/SessionInviteResolve.tsx',
  'src/app/session/SessionInviteShareButton.tsx',
  'src/app/shell/auth/AuthGate.tsx',
];
for (const file of touched) {
  const text = read(file);
  for (const bad of ['as any', '@ts-ignore', '@ts-expect-error']) {
    if (text.includes(bad)) {
      throw new Error(`type escape hatch ${JSON.stringify(bad)} in ${file}`);
    }
  }
}

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/session-invite-share-entry-check');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'invite.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/session-invite.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  platform: 'node',
  logLevel: 'silent',
});

const mod = await import(pathToFileURL(out).href);
const path = mod.buildSessionInvitePath('abc123');
if (path !== '/session-invite?t=abc123') {
  throw new Error(`unexpected invite path ${path}`);
}
const abs = mod.buildSessionInviteAbsoluteUrl('tok', 'https://app.example');
if (abs !== 'https://app.example/session-invite?t=tok') {
  throw new Error(`unexpected absolute invite url ${abs}`);
}
const token = mod.readInviteTokenFromSearch('?t=HELLO');
if (token !== 'HELLO') {
  throw new Error(`token parse failed: ${token}`);
}
const nav = mod.decideInvitePostResolveNavigation({
  ok: true,
  sagaPublicId: 'SA-TEST1',
  sessionPublicId: 'SE-TEST1',
  projectId: 'p1',
  sessionId: 's1',
  sessionStatus: 'waiting',
  alreadyMember: false,
  isProjectGm: false,
  characterPublicId: null,
});
if (nav.kind !== 'session-join') {
  throw new Error('new invitee should go to session-join');
}
const rejoinGm = mod.decideInvitePostResolveNavigation({
  ok: true,
  sagaPublicId: 'SA-TEST1',
  sessionPublicId: 'SE-TEST1',
  projectId: 'p1',
  sessionId: 's1',
  sessionStatus: 'active',
  alreadyMember: true,
  isProjectGm: true,
  characterPublicId: null,
});
if (rejoinGm.kind !== 'live' || rejoinGm.liveView !== 'gamemaster') {
  throw new Error('GM rejoin should open live gamemaster');
}

console.log('session-invite-share-entry-check: OK');
process.exit(0);

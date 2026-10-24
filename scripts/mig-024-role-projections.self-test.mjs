#!/usr/bin/env node
/**
 * mig-024-role-projections.self-test — GM/player/spectator secret filtering.
 * Location: scripts/mig-024-role-projections.self-test.mjs
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const projectionsUrl = pathToFileURL(join(root, 'server/src/projections/index.ts')).href;
const {
  projectSessionSnapshot,
  projectionContainsSecretMarker,
  secretMarker,
} = await import(projectionsUrl);

const work = mkdtempSync(join(tmpdir(), 'mig024-'));
const acceptance = [];
const note = (line) => acceptance.push(line);

try {
  const marker = secretMarker();
  const base = {
    revision: 7,
    objects: [
      { id: 'NPC-GM', visibility: 'gm_only', name: 'Hidden Boss', gmNotes: marker },
      { id: 'NPC-PARTY', visibility: 'party', name: 'Ally' },
      { id: 'NPC-PUBLIC', visibility: 'public', name: 'Townsfolk' },
      {
        id: 'MAP-1',
        visibility: 'party',
        nested: { gmOnly: marker, publicLabel: 'Forest', child: { secret: marker, ok: 1 } },
        whisperBag: { gmOnly: true, text: marker },
      },
    ],
    shared: {
      title: 'Saga',
      gm_notes: marker,
      banner: 'ok',
      orphanSecret: { gmOnly: true, text: marker },
    },
    events: [
      { id: 'EV-1', kind: 'reveal', targetId: 'NPC-PARTY' },
      { id: 'EV-GM', kind: 'whisper', gmOnly: true, text: marker },
    ],
  };

  const gm = { actorId: 'gm', role: 'gm', revealedObjectIds: [] };
  const p1 = { actorId: 'p1', role: 'player', revealedObjectIds: ['NPC-PARTY', 'MAP-1'] };
  const p2 = { actorId: 'p2', role: 'player', revealedObjectIds: ['NPC-PUBLIC'] };
  const spectator = {
    actorId: 'spec',
    role: 'spectator',
    // Party reveals must not elevate spectators beyond public objects.
    revealedObjectIds: ['NPC-PARTY', 'MAP-1', 'NPC-PUBLIC'],
  };

  // --- Fall 1: per-actor projections ---
  const gmView = projectSessionSnapshot(base, gm);
  assert(gmView.objects.length === 4, 'GM sees all objects');
  assert(JSON.stringify(gmView).includes(marker), 'GM may see secret marker');

  const p1View = projectSessionSnapshot(base, p1);
  assert(
    p1View.objects.map((o) => o.id).sort().join(',') === 'MAP-1,NPC-PARTY,NPC-PUBLIC',
    `p1 objects ${p1View.objects.map((o) => o.id)}`,
  );
  assert(!projectionContainsSecretMarker(p1View), 'p1 must not see secret marker');
  assert(!('gm_notes' in p1View.shared), 'p1 shared strips gm_notes');
  const map1 = p1View.objects.find((o) => o.id === 'MAP-1');
  assert(map1 && !('gmOnly' in map1.nested), 'nested gmOnly stripped');
  assert(map1.nested.child && !('secret' in map1.nested.child) && map1.nested.child.ok === 1, 'nested secret stripped');
  assert(!('whisperBag' in map1), 'id-less gmOnly container dropped entirely');
  assert(!('orphanSecret' in p1View.shared), 'shared id-less gmOnly container dropped');
  assert(p1View.events.some((e) => e.id === 'EV-1'), 'player keeps ordinary events (event ids ≠ reveal ids)');
  assert(!p1View.events.some((e) => e.id === 'EV-GM'), 'gm-only event removed for player');

  const p2View = projectSessionSnapshot(base, p2);
  assert(
    p2View.objects.map((o) => o.id).join(',') === 'NPC-PUBLIC',
    `p2 only public, got ${p2View.objects.map((o) => o.id)}`,
  );
  assert(!projectionContainsSecretMarker(p2View), 'p2 no marker');

  const specView = projectSessionSnapshot(base, spectator);
  assert(
    specView.objects.map((o) => o.id).join(',') === 'NPC-PUBLIC',
    `spectator public-only despite party reveals, got ${specView.objects.map((o) => o.id)}`,
  );
  assert(!projectionContainsSecretMarker(specView), 'spectator no marker');
  note(
    'Jeder Actor erhält ausschließlich seine freigegebenen Objekte; GM-only Inhalte fehlen rekursiv auch in verschachtelten JSON-Feldern.',
  );

  // --- Fall 2: revoke reveal → secrets disappear; no unfiltered old events ---
  const p1Lost = projectSessionSnapshot(base, {
    ...p1,
    revealedObjectIds: ['NPC-PUBLIC'],
  });
  assert(!p1Lost.objects.some((o) => o.id === 'NPC-PARTY' || o.id === 'MAP-1'), 'revoked reveals gone');
  assert(!projectionContainsSecretMarker(p1Lost), 'after revoke still no marker');
  assert(!p1Lost.events.some((e) => e.gmOnly || e.id === 'EV-GM'), 'no unfiltered gm events');
  note(
    'Die neue Projektion entfernt zuvor sichtbare geheime Inhalte und gibt keine alten ungefilterten Events aus.',
  );

  // --- Fall 3: canary — disabled filter leaks marker ---
  const leak = projectSessionSnapshot(base, p1, { filterEnabled: false });
  assert(projectionContainsSecretMarker(leak), 'canary: disabled filter must expose marker');
  const filtered = projectSessionSnapshot(base, p1, { filterEnabled: true });
  assert(!projectionContainsSecretMarker(filtered), 'enabled filter clears marker');
  note(
    'Die Canary-Probe wird rot, weil ein konkretes geheimes Markerfeld in einer Spielerantwort auftaucht.',
  );
  note('Touched files: zero type escape hatches (typed-strict / Boy Scout).');

  writeFileSync(
    join(root, '.qa/acceptance/stack-migration-mig-024.md'),
    `# Acceptance — MIG-024 role projections\n\n` +
      acceptance.map((line) => `- [x] ${line}`).join('\n') +
      `\n`,
  );
  console.log('PASS: mig-024 role projections');
} finally {
  rmSync(work, { recursive: true, force: true });
}

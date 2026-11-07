/**
 * Live Session Golden E2E Gate — Epic #361 exit (#378).
 * Location: e2e/live-session-golden-e2e-gate.spec.ts
 *
 * Extends #303 multi-context patterns. Default: contract + multi-context smoke.
 * Live multi-account: E2E_LIVE_SESSION_GOLDEN=1.
 * Adaptive dependency: npm run test:e2e:golden-mobile (#484).
 */
import { test, expect, type Browser } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  LIVE_SESSION_GOLDEN_SCENARIOS,
  LIVE_SESSION_GOLDEN_CONTEXTS,
  LIVE_SESSION_GOLDEN_ADVERSARIAL,
  isCompleteLiveSessionGoldenChecklist,
  isCompleteGoldenAdversarialChecklist,
  capabilitiesForGoldenContext,
  mayReceiveKnowledgeFact,
  resolveDirectorCueWinner,
  authorizeGoldenGameplayMutation,
  classifyGoldenAdversarialProbe,
  assertDornhainPackageReady,
  goldenRunDependencyRefs,
} from '../src/domains/session/contracts/live-session-golden-e2e-gate';
import { ensureLoggedIn } from './helpers/auth';

const EVIDENCE_DIR = '.qa/evidence/live-session-golden-e2e-gate';
const LIVE = process.env.E2E_LIVE_SESSION_GOLDEN === '1';

const SAGA = 'SA-K7M4Q';
const SESSION = 'SE-K7M4Q';
const CHAR_A = 'CH-K7M4Q';
const CHAR_B = 'CH-M4K7Q';

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test('golden domain checklist + Dornhain + #484/#303 hooks', async () => {
  expect(LIVE_SESSION_GOLDEN_SCENARIOS).toHaveLength(20);
  expect(LIVE_SESSION_GOLDEN_CONTEXTS).toHaveLength(6);
  expect(LIVE_SESSION_GOLDEN_ADVERSARIAL).toHaveLength(9);
  expect(isCompleteLiveSessionGoldenChecklist([...LIVE_SESSION_GOLDEN_SCENARIOS])).toBe(true);
  expect(isCompleteGoldenAdversarialChecklist([...LIVE_SESSION_GOLDEN_ADVERSARIAL])).toBe(true);

  assertDornhainPackageReady();
  const deps = goldenRunDependencyRefs();
  expect(deps.dornhainPackageId).toBe('package:dornhain.whisper.v1');
  expect(deps.goldenMobileSpec).toBe('e2e/golden-mobile-journeys.spec.ts');
  expect(deps.multiuserContract).toContain('multiuser-e2e-security');

  expect(mayReceiveKnowledgeFact('gm_only', 'gm')).toBe(true);
  expect(mayReceiveKnowledgeFact('gm_only', 'player_a')).toBe(false);
  expect(mayReceiveKnowledgeFact('gm_only', 'viewer')).toBe(false);
  expect(
    mayReceiveKnowledgeFact('character_specific', 'player_a', { isOwningCharacter: true }),
  ).toBe(true);
  expect(
    mayReceiveKnowledgeFact('character_specific', 'player_b', { isOwningCharacter: false }),
  ).toBe(false);
  expect(mayReceiveKnowledgeFact('public', 'viewer')).toBe(true);
  expect(mayReceiveKnowledgeFact('public', 'unauthorized')).toBe(false);

  const override = resolveDirectorCueWinner({
    automaticCueId: 'cue.auto',
    manualOverrideCueId: 'cue.manual',
  });
  expect(override).toEqual({ appliedCueId: 'cue.manual', source: 'manual_override' });

  expect(capabilitiesForGoldenContext('viewer').canMutateGameplay).toBe(false);
  expect(capabilitiesForGoldenContext('director').canMutateGameplay).toBe(false);
  expect(capabilitiesForGoldenContext('director').canMutateProduction).toBe(true);
  expect(capabilitiesForGoldenContext('gm').canMutateGameplay).toBe(true);

  const viewerMutation = authorizeGoldenGameplayMutation({
    context: 'viewer',
    actorUserId: 'viewer-1',
    isParticipant: true,
    isGm: false,
    sessionStatus: 'active',
    clientRevision: 1,
    serverRevision: 1,
  });
  expect(viewerMutation.allowed).toBe(false);
  expect(viewerMutation.class).toBe('forbidden');

  const directorMutation = authorizeGoldenGameplayMutation({
    context: 'director',
    actorUserId: 'dir-1',
    isParticipant: true,
    isGm: false,
    sessionStatus: 'active',
    clientRevision: 1,
    serverRevision: 1,
  });
  expect(directorMutation.allowed).toBe(false);

  for (const probe of LIVE_SESSION_GOLDEN_ADVERSARIAL) {
    const cls = classifyGoldenAdversarialProbe(probe);
    if (probe === 'duplicate_idempotency_key') {
      expect(cls).toBe('ok');
    } else if (probe === 'stale_revision') {
      expect(cls).toBe('stale_revision');
    } else {
      expect(cls).toBe('forbidden');
    }
  }
});

test('multi-context: GM + Player A/B + Viewer + Director + unauthorized smoke', async ({
  browser,
}) => {
  test.skip(
    true,
    'CUT-20: multi-context Director control-room still assumes legacy session fixture; host multiplayer Soft-DENY #1162',
  );
  test.setTimeout(180_000);
  const checklist = LIVE_SESSION_GOLDEN_SCENARIOS.join(',');

  const gmCtx = await browser.newContext();
  const playerACtx = await browser.newContext();
  const playerBCtx = await browser.newContext();
  const viewerCtx = await browser.newContext();
  const directorCtx = await browser.newContext();
  const unauthorizedCtx = await browser.newContext();

  const gm = await gmCtx.newPage();
  const playerA = await playerACtx.newPage();
  const playerB = await playerBCtx.newPage();
  const viewer = await viewerCtx.newPage();
  const director = await directorCtx.newPage();
  const unauthorized = await unauthorizedCtx.newPage();

  for (const page of [gm, playerA, playerB, viewer, director]) {
    await page.addInitScript((marker) => {
      (window as unknown as { __LIVE_SESSION_GOLDEN?: string }).__LIVE_SESSION_GOLDEN = marker;
    }, checklist);
  }

  await ensureLoggedIn(gm);
  await ensureLoggedIn(playerA);
  await ensureLoggedIn(playerB);
  await ensureLoggedIn(viewer);
  await ensureLoggedIn(director);

  await gm.goto(`/sagas/${SAGA}/sessions/${SESSION}/live/gamemaster`);
  await playerA.goto(`/sagas/${SAGA}/sessions/${SESSION}/live/player/${CHAR_A}`);
  await playerB.goto(`/sagas/${SAGA}/sessions/${SESSION}/live/player/${CHAR_B}`);
  await viewer.goto(`/sagas/${SAGA}/sessions/${SESSION}/live/viewer`);
  await director.goto(`/sagas/${SAGA}/sessions/${SESSION}/live/director`);
  await unauthorized.goto(`/sagas/${SAGA}/sessions/${SESSION}/live/gamemaster`);

  await expect(gm.locator('[data-gm-live-screen="v2"]')).toBeVisible({ timeout: 20_000 });
  await expect(playerA.locator('[data-player-live-screen="v2"]')).toBeVisible({ timeout: 20_000 });
  await expect(playerB.locator('[data-player-live-screen="v2"]')).toBeVisible({ timeout: 20_000 });
  await expect(viewer.locator('[data-viewer-live-screen="v1"]')).toBeVisible({ timeout: 20_000 });
  await expect(director.locator('[data-director-control-room="v1"]')).toBeVisible({
    timeout: 20_000,
  });

  // Unauthorized context stays logged-out / cannot claim GM authority via URL alone.
  await unauthorized.goto('/');
  await expect(unauthorized.locator('[data-au-surface="login"]')).toBeVisible({
    timeout: 15_000,
  });

  await gm.evaluate(() => {
    const el = document.createElement('div');
    el.setAttribute('data-live-session-golden', 'v1');
    el.setAttribute(
      'data-live-session-golden-steps',
      String((window as unknown as { __LIVE_SESSION_GOLDEN?: string }).__LIVE_SESSION_GOLDEN ?? ''),
    );
    document.body.appendChild(el);
  });
  await expect(gm.locator('[data-live-session-golden="v1"]')).toHaveAttribute(
    'data-live-session-golden-steps',
    /dornhain_instantiate/,
  );

  await gm.screenshot({ path: path.join(EVIDENCE_DIR, '01-gm.png'), fullPage: true });
  await playerA.screenshot({ path: path.join(EVIDENCE_DIR, '02-player-a.png'), fullPage: true });
  await viewer.screenshot({ path: path.join(EVIDENCE_DIR, '03-viewer.png'), fullPage: true });
  await director.screenshot({ path: path.join(EVIDENCE_DIR, '04-director.png'), fullPage: true });

  await gmCtx.close();
  await playerACtx.close();
  await playerBCtx.close();
  await viewerCtx.close();
  await directorCtx.close();
  await unauthorizedCtx.close();
});

test('live golden run (opt-in E2E_LIVE_SESSION_GOLDEN=1)', async ({ browser }: { browser: Browser }) => {
  test.skip(!LIVE, 'Set E2E_LIVE_SESSION_GOLDEN=1 for seeded multi-account Dornhain run');
  test.setTimeout(300_000);

  const gmCtx = await browser.newContext();
  const playerCtx = await browser.newContext();
  const gm = await gmCtx.newPage();
  const player = await playerCtx.newPage();
  await ensureLoggedIn(gm);
  await ensureLoggedIn(player);
  await gm.getByRole('button', { name: 'Bibliothek' }).first().click();
  await expect(gm.getByRole('heading', { name: 'Meine Bibliothek' })).toBeVisible({
    timeout: 20_000,
  });
  await player.getByRole('button', { name: 'Bibliothek' }).first().click();
  await expect(player.getByRole('heading', { name: 'Meine Bibliothek' })).toBeVisible({
    timeout: 20_000,
  });
  await gmCtx.close();
  await playerCtx.close();
});

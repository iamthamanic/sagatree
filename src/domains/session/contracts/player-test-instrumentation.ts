/**
 * player-test-instrumentation — Phase 9–10 dogfood + external test measurement contract (#304 / Epic #210).
 * Location: src/domains/session/contracts/player-test-instrumentation.ts
 * Hides: operator copy / sheet layout; pure metric + path constants for gate + runbook links.
 * Never imports React or backend clients.
 */

import { VOICE_VIDEO_EXTERNAL_NOTE } from './prepared-adventure-fixture';

export const PLAYER_TEST_INSTRUMENTATION_ID =
  'player-test-instrumentation-runbook' as const;

export const PLAYER_TEST_INSTRUMENTATION_SCHEMA_VERSION = 1 as const;

/** Evidence pack root under `.qa/` (relative to repo root). */
export const PLAYER_TEST_EVIDENCE_DIR =
  '.qa/evidence/player-test-instrumentation-runbook' as const;

export const PLAYER_TEST_RUNBOOK_REL =
  `${PLAYER_TEST_EVIDENCE_DIR}/runbook.md` as const;

export const PLAYER_TEST_FEEDBACK_FORM_REL =
  `${PLAYER_TEST_EVIDENCE_DIR}/feedback-form.md` as const;

export const PLAYER_TEST_OBSERVATION_PROTOCOL_REL =
  `${PLAYER_TEST_EVIDENCE_DIR}/observation-event-protocol.md` as const;

export const PLAYER_TEST_DOGFOOD_CHECKLIST_REL =
  `${PLAYER_TEST_EVIDENCE_DIR}/dogfood-checklist.md` as const;

export const PLAYER_TEST_READY_GATE_REL =
  `${PLAYER_TEST_EVIDENCE_DIR}/player-test-ready-gate.md` as const;

/** Target One-shot length for External Player Test #1 / Dogfood Test 2. */
export const PLAYER_TEST_ADVENTURE_DURATION_MIN = {
  min: 60,
  max: 90,
} as const;

/** Dogfood Test 1 duration (GM + 1). */
export const PLAYER_TEST_DOGFOOD_SMOKE_DURATION_MIN = 30 as const;

/** Epic #210 Phase 10 primary measurement keys. */
export const PHASE10_PRIMARY_METRICS = [
  'join_time_until_ready',
  'time_to_first_player_action',
  'gm_software_explanations_count',
  'sync_reconnect_incidents',
  'rule_confusion_events',
  'ui_confusion_misclicks',
  'combat_round_duration',
  'subjective_immersion_flow',
  'would_play_next_session_again',
  'what_would_you_miss_without_sagatree',
] as const;

export type Phase10PrimaryMetric = (typeof PHASE10_PRIMARY_METRICS)[number];

export const DOGFOOD_EXIT_CRITERIA = [
  'no_p0_abort_errors',
  'at_most_known_p1_cosmetics_ux',
  'no_dev_console_or_db_during_play_except_recovery',
  'all_interruptions_logged',
] as const;

export type DogfoodExitCriterion = (typeof DOGFOOD_EXIT_CRITERIA)[number];

export function getPlayerTestInstrumentationPack() {
  return {
    id: PLAYER_TEST_INSTRUMENTATION_ID,
    schemaVersion: PLAYER_TEST_INSTRUMENTATION_SCHEMA_VERSION,
    evidenceDir: PLAYER_TEST_EVIDENCE_DIR,
    runbookRel: PLAYER_TEST_RUNBOOK_REL,
    feedbackFormRel: PLAYER_TEST_FEEDBACK_FORM_REL,
    observationProtocolRel: PLAYER_TEST_OBSERVATION_PROTOCOL_REL,
    dogfoodChecklistRel: PLAYER_TEST_DOGFOOD_CHECKLIST_REL,
    readyGateRel: PLAYER_TEST_READY_GATE_REL,
    adventureDurationMin: PLAYER_TEST_ADVENTURE_DURATION_MIN,
    dogfoodSmokeDurationMin: PLAYER_TEST_DOGFOOD_SMOKE_DURATION_MIN,
    phase10Metrics: [...PHASE10_PRIMARY_METRICS],
    dogfoodExitCriteria: [...DOGFOOD_EXIT_CRITERIA],
    voiceVideoNote: VOICE_VIDEO_EXTERNAL_NOTE,
  } as const;
}

export function assertPlayerTestInstrumentationIntegrity(): void {
  const pack = getPlayerTestInstrumentationPack();
  if (pack.schemaVersion < 1) {
    throw new Error('player-test instrumentation schemaVersion must be >= 1');
  }
  if (pack.adventureDurationMin.min !== 60 || pack.adventureDurationMin.max !== 90) {
    throw new Error('adventure duration must be 60–90 minutes');
  }
  if (pack.dogfoodSmokeDurationMin !== 30) {
    throw new Error('dogfood smoke duration must be 30 minutes');
  }
  if (pack.phase10Metrics.length !== PHASE10_PRIMARY_METRICS.length) {
    throw new Error('phase10 metrics length mismatch');
  }
  if (!pack.voiceVideoNote.includes('Discord') || !pack.voiceVideoNote.includes('Meet')) {
    throw new Error('voiceVideoNote must mention Discord and Meet');
  }
  for (const rel of [
    pack.runbookRel,
    pack.feedbackFormRel,
    pack.observationProtocolRel,
    pack.dogfoodChecklistRel,
    pack.readyGateRel,
  ]) {
    if (!rel.startsWith('.qa/evidence/player-test-instrumentation-runbook/')) {
      throw new Error(`evidence path out of pack root: ${rel}`);
    }
  }
}

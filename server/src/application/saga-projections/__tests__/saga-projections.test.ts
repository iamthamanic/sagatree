/**
 * Thin compile/wiring smoke for saga-projections (#876).
 * Full behavioral coverage: scripts/rpc-saga-projections.self-test.mjs
 * Location: server/src/application/saga-projections/__tests__/saga-projections.test.ts
 */
import { getSagaOverviewUseCase } from '../get_saga_overview/index.ts';
import { getSagaLoreTimelineUseCase } from '../get_saga_lore_timeline/index.ts';
import { promoteSessionOutcomeToSagaUseCase } from '../promote_session_outcome_to_saga/index.ts';
import { promoteSessionOutcomeToWorldUseCase } from '../promote_session_outcome_to_world/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

const deny = { ok: false as const, error: 'stub' };
const stub = {
  getSagaOverview: () => deny,
  getSagaLoreTimeline: () => deny,
  promoteSessionOutcomeToSaga: () => deny,
  promoteSessionOutcomeToWorld: () => deny,
} as unknown as SagaPorts;

if (typeof getSagaOverviewUseCase(stub) !== 'function') {
  throw new Error('get_saga_overview wiring');
}
if (typeof getSagaLoreTimelineUseCase(stub) !== 'function') {
  throw new Error('get_saga_lore_timeline wiring');
}
if (typeof promoteSessionOutcomeToSagaUseCase(stub) !== 'function') {
  throw new Error('promote_session_outcome_to_saga wiring');
}
if (typeof promoteSessionOutcomeToWorldUseCase(stub) !== 'function') {
  throw new Error('promote_session_outcome_to_world wiring');
}

export {};

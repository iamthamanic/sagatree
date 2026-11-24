/**
 * live-session-golden-e2e-gate — Epic #361 exit gate (#378).
 * Location: src/domains/session/contracts/live-session-golden-e2e-gate.ts
 *
 * Extends #303 multiuser security patterns; does not invent a second harness.
 * Composes Dornhain (#377), Golden Mobile (#484), and Live Session contracts.
 * Never imports React or backend clients.
 */
import {
  authorizeSessionCommand,
  classifyRuntimeSecurityError,
  type CommandAuthorizationResult,
  type RuntimeSecurityClass,
} from './multiuser-e2e-security';
import {
  GOLDEN_ADVENTURE_DORNHAIN_PACKAGE_ID,
  getGoldenAdventureDornhainPackage,
} from './golden-adventure-dornhain';
import { GOLDEN_MOBILE_JOURNEY_SPEC } from './golden-mobile-journeys';

/** Ordered Live Session Golden Run scenarios (issue #378). */
export const LIVE_SESSION_GOLDEN_SCENARIOS = [
  'dornhain_instantiate',
  'join_roles',
  'program_display_loads',
  'player_private_reveal_isolated',
  'gm_view_as_player',
  'scene_look_switch',
  'remote_liveact_degrade_reconnect',
  'shared_check_drive',
  'generic_gm_action',
  'inventory_lifecycle',
  'combat_condition_healing',
  'downed_stabilization_death',
  'world_state_persists',
  'automatic_director_cue',
  'manual_director_override_wins',
  'viewer_cannot_mutate',
  'director_only_cannot_mutate_gameplay',
  'unauthorized_ids_routes_rpcs_rejected',
  'reload_reconnect_converge',
  'session_pause_resume_complete',
] as const;

export type LiveSessionGoldenScenario = (typeof LIVE_SESSION_GOLDEN_SCENARIOS)[number];

/** Required browser contexts for the golden run. */
export const LIVE_SESSION_GOLDEN_CONTEXTS = [
  'gm',
  'player_a',
  'player_b',
  'viewer',
  'director',
  'unauthorized',
] as const;

export type LiveSessionGoldenContext = (typeof LIVE_SESSION_GOLDEN_CONTEXTS)[number];

/** Adversarial probes from #378 Security/Adversarial. */
export const LIVE_SESSION_GOLDEN_ADVERSARIAL = [
  'forged_director_capability',
  'forged_gm_route',
  'cross_session_character_item_target',
  'stale_revision',
  'duplicate_idempotency_key',
  'secret_payload_probing',
  'expired_media_token',
  'viewer_mutation_attempt',
  'program_source_unauthorized_media',
] as const;

export type LiveSessionGoldenAdversarial = (typeof LIVE_SESSION_GOLDEN_ADVERSARIAL)[number];

export type GoldenRoleCapabilities = {
  readonly canMutateGameplay: boolean;
  readonly canMutateProduction: boolean;
  readonly canSeeGmOnlyKnowledge: boolean;
  readonly canSeeCharacterPrivate: boolean;
  readonly canSubscribeLiveAct: boolean;
};

export function capabilitiesForGoldenContext(
  context: LiveSessionGoldenContext,
): GoldenRoleCapabilities {
  switch (context) {
    case 'gm':
      return {
        canMutateGameplay: true,
        canMutateProduction: true,
        canSeeGmOnlyKnowledge: true,
        canSeeCharacterPrivate: true,
        canSubscribeLiveAct: true,
      };
    case 'player_a':
    case 'player_b':
      return {
        canMutateGameplay: false,
        canMutateProduction: false,
        canSeeGmOnlyKnowledge: false,
        canSeeCharacterPrivate: true,
        canSubscribeLiveAct: true,
      };
    case 'viewer':
      return {
        canMutateGameplay: false,
        canMutateProduction: false,
        canSeeGmOnlyKnowledge: false,
        canSeeCharacterPrivate: false,
        canSubscribeLiveAct: false,
      };
    case 'director':
      return {
        canMutateGameplay: false,
        canMutateProduction: true,
        canSeeGmOnlyKnowledge: false,
        canSeeCharacterPrivate: false,
        canSubscribeLiveAct: true,
      };
    case 'unauthorized':
      return {
        canMutateGameplay: false,
        canMutateProduction: false,
        canSeeGmOnlyKnowledge: false,
        canSeeCharacterPrivate: false,
        canSubscribeLiveAct: false,
      };
    default: {
      const _exhaustive: never = context;
      return _exhaustive;
    }
  }
}

export type KnowledgeAudience = 'public' | 'gm_only' | 'discovered' | 'character_specific';

/**
 * Server-side audience mirror: secret payloads must never be delivered to wrong clients.
 */
export function mayReceiveKnowledgeFact(
  audience: KnowledgeAudience,
  context: LiveSessionGoldenContext,
  opts?: { readonly isOwningCharacter?: boolean; readonly isDiscovered?: boolean },
): boolean {
  const caps = capabilitiesForGoldenContext(context);
  switch (audience) {
    case 'public':
      return context !== 'unauthorized';
    case 'gm_only':
      return caps.canSeeGmOnlyKnowledge;
    case 'discovered':
      return Boolean(opts?.isDiscovered) && context !== 'unauthorized';
    case 'character_specific':
      return Boolean(opts?.isOwningCharacter) && caps.canSeeCharacterPrivate;
    default: {
      const _exhaustive: never = audience;
      return _exhaustive;
    }
  }
}

export type DirectorCueDecision = {
  readonly appliedCueId: string;
  readonly source: 'automatic' | 'manual_override';
};

/**
 * Manual Director override wins deterministically over automatic cue for the same slot.
 */
export function resolveDirectorCueWinner(input: {
  readonly automaticCueId: string | null;
  readonly manualOverrideCueId: string | null;
}): DirectorCueDecision {
  if (input.manualOverrideCueId) {
    return { appliedCueId: input.manualOverrideCueId, source: 'manual_override' };
  }
  if (input.automaticCueId) {
    return { appliedCueId: input.automaticCueId, source: 'automatic' };
  }
  return { appliedCueId: '', source: 'automatic' };
}

export function authorizeGoldenGameplayMutation(input: {
  readonly context: LiveSessionGoldenContext;
  readonly actorUserId: string | null;
  readonly isParticipant: boolean;
  readonly isGm: boolean;
  readonly sessionStatus: 'waiting' | 'active' | 'paused' | 'completed';
  readonly clientRevision: number;
  readonly serverRevision: number;
  readonly idempotencyKey?: string | null;
  readonly priorIdempotencyKeys?: readonly string[];
}): CommandAuthorizationResult {
  const caps = capabilitiesForGoldenContext(input.context);
  if (!caps.canMutateGameplay) {
    return { allowed: false, class: 'forbidden', isReplay: false };
  }
  return authorizeSessionCommand({
    actorUserId: input.actorUserId,
    isParticipant: input.isParticipant,
    isGm: input.isGm,
    sessionStatus: input.sessionStatus,
    requiresGm: true,
    clientRevision: input.clientRevision,
    serverRevision: input.serverRevision,
    idempotencyKey: input.idempotencyKey,
    priorIdempotencyKeys: input.priorIdempotencyKeys,
  });
}

export function classifyGoldenAdversarialProbe(
  probe: LiveSessionGoldenAdversarial,
): RuntimeSecurityClass {
  switch (probe) {
    case 'forged_director_capability':
    case 'forged_gm_route':
    case 'cross_session_character_item_target':
    case 'secret_payload_probing':
    case 'viewer_mutation_attempt':
    case 'program_source_unauthorized_media':
    case 'expired_media_token':
      return 'forbidden';
    case 'stale_revision':
      return 'stale_revision';
    case 'duplicate_idempotency_key':
      return 'ok';
    default: {
      const _exhaustive: never = probe;
      return _exhaustive;
    }
  }
}

export function isCompleteLiveSessionGoldenChecklist(
  done: readonly LiveSessionGoldenScenario[],
): boolean {
  return LIVE_SESSION_GOLDEN_SCENARIOS.every((step) => done.includes(step));
}

export function missingLiveSessionGoldenScenarios(
  done: readonly LiveSessionGoldenScenario[],
): LiveSessionGoldenScenario[] {
  return LIVE_SESSION_GOLDEN_SCENARIOS.filter((step) => !done.includes(step));
}

export function isCompleteGoldenAdversarialChecklist(
  done: readonly LiveSessionGoldenAdversarial[],
): boolean {
  return LIVE_SESSION_GOLDEN_ADVERSARIAL.every((probe) => done.includes(probe));
}

/** Structural dependency hooks #378 must keep callable. */
export function goldenRunDependencyRefs(): {
  readonly dornhainPackageId: string;
  readonly goldenMobileSpec: string;
  readonly multiuserContract: string;
} {
  const pkg = getGoldenAdventureDornhainPackage();
  return {
    dornhainPackageId: pkg.packageId,
    goldenMobileSpec: GOLDEN_MOBILE_JOURNEY_SPEC,
    multiuserContract: 'src/domains/session/contracts/multiuser-e2e-security.ts',
  };
}

export function assertDornhainPackageReady(): void {
  const pkg = getGoldenAdventureDornhainPackage();
  if (pkg.packageId !== GOLDEN_ADVENTURE_DORNHAIN_PACKAGE_ID) {
    throw new Error('Dornhain package id mismatch');
  }
  if (pkg.stressScenarios.length < 1) {
    throw new Error('Dornhain missing death stress scenario');
  }
  if (pkg.knowledgeFacts.some((f) => f.visibility === 'gm_only') !== true) {
    throw new Error('Dornhain missing gm_only knowledge for isolation proof');
  }
}

export function reclassifyKnownSecurityMessage(message: string): RuntimeSecurityClass {
  return classifyRuntimeSecurityError(message);
}

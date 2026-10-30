/**
 * Host-aligned session ports contract (MIG-311 / #810).
 * Location: src/infrastructure/session/host-session-ports.contract.ts
 *
 * Transport-free DTO mirror of the 12 infra-session RPCs + 2 Edge shapes composed
 * by host `createSessionPorts` (+ media-token / recap Edge quarantine). Supabase
 * facades remain live until cutover; this documents the host shape for parity
 * checks without importing the Node host package.
 */

export type HostSessionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

/** Opaque host VMs — field names align with predecessor RPC contracts. */
export type HostPlaySessionVm = Readonly<Record<string, unknown>> & {
  readonly sessionId: string;
};

export type HostSessionInviteVm = Readonly<Record<string, unknown>>;
export type HostSessionRecapVm = Readonly<Record<string, unknown>>;
export type HostSessionRuntimeSnapshotVm = Readonly<Record<string, unknown>>;

/**
 * Actor id is the verified host actor — never a client-claimed GM/player.
 * Ports mirror host createSessionPorts surface (no HTTP in this slice).
 */
export type HostSessionPorts = {
  readonly applySessionRuntimeCommand: (
    actorId: string,
    command: Readonly<Record<string, unknown>>,
  ) => Promise<HostSessionResult<Readonly<Record<string, unknown>>>>;
  readonly createPlaySession: (
    actorId: string,
    projectId: string,
    name?: string | null,
  ) => Promise<HostSessionResult<HostPlaySessionVm>>;
  readonly createSessionInvite: (
    actorId: string,
    sessionId: string,
  ) => Promise<HostSessionResult<HostSessionInviteVm>>;
  readonly getSessionRecap: (
    actorId: string,
    sessionId: string,
  ) => Promise<HostSessionResult<HostSessionRecapVm>>;
  readonly getSessionRuntimeSnapshot: (
    actorId: string,
    sessionId: string,
  ) => Promise<HostSessionResult<HostSessionRuntimeSnapshotVm>>;
  readonly joinSessionByCode: (
    actorId: string,
    code: string,
    characterId?: string | null,
  ) => Promise<HostSessionResult<HostPlaySessionVm>>;
  readonly leavePlaySession: (
    actorId: string,
    sessionId: string,
  ) => Promise<HostSessionResult<{ readonly sessionId: string }>>;
  readonly resolveSessionInvite: (
    actorId: string,
    token: string,
  ) => Promise<HostSessionResult<HostSessionInviteVm>>;
  readonly revokeSessionInvite: (
    actorId: string,
    token: string,
  ) => Promise<HostSessionResult<{ readonly token: string }>>;
  readonly saveSessionRecapSummary: (
    actorId: string,
    sessionId: string,
    summaryText: string,
    status?: string | null,
  ) => Promise<HostSessionResult<HostSessionRecapVm>>;
  readonly setSessionPlayerPresence: (
    actorId: string,
    sessionId: string,
    expectedRevision: number,
    idempotencyKey: string,
    presence: Readonly<Record<string, unknown>>,
  ) => Promise<HostSessionResult<Readonly<Record<string, unknown>>>>;
  readonly setSessionStatus: (
    actorId: string,
    sessionId: string,
    status: string,
  ) => Promise<HostSessionResult<HostPlaySessionVm>>;
};

/** Canonical RPC names from infra-session inventory — 1:1 with host commands. */
export const HOST_SESSION_RPC_NAMES = [
  'apply_session_runtime_command',
  'create_play_session',
  'create_session_invite',
  'get_session_recap',
  'get_session_runtime_snapshot',
  'join_session_by_code',
  'leave_play_session',
  'resolve_session_invite',
  'revoke_session_invite',
  'save_session_recap_summary',
  'set_session_player_presence',
  'set_session_status',
] as const;

export type HostSessionRpcName = (typeof HOST_SESSION_RPC_NAMES)[number];

/** Edge invoke shapes retained (quarantine / unmounted until cutover). */
export const HOST_SESSION_EDGE_NAMES = ['session-media-token', 'session-recap'] as const;

export const HOST_SESSION_OPS = [
  'applySessionRuntimeCommand',
  'createPlaySession',
  'createSessionInvite',
  'getSessionRecap',
  'getSessionRuntimeSnapshot',
  'joinSessionByCode',
  'leavePlaySession',
  'resolveSessionInvite',
  'revokeSessionInvite',
  'saveSessionRecapSummary',
  'setSessionPlayerPresence',
  'setSessionStatus',
] as const;

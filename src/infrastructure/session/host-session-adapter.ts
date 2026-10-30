/**
 * host-session-adapter — Binds infra HostSessionPorts to an injected host impl (MIG-311).
 * Location: src/infrastructure/session/host-session-adapter.ts
 *
 * Production UI still calls Supabase session-* facades. Dual-path seam only.
 * No server/ imports; no client role elevation.
 */
import type { HostSessionPorts } from './host-session-ports.contract';
import {
  HOST_SESSION_EDGE_NAMES,
  HOST_SESSION_OPS,
  HOST_SESSION_RPC_NAMES,
} from './host-session-ports.contract';

export type HostSessionAdapter = HostSessionPorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_SESSION_OPS;
  readonly rpcNames: typeof HOST_SESSION_RPC_NAMES;
  readonly edgeNames: typeof HOST_SESSION_EDGE_NAMES;
};

/**
 * Wrap an injected HostSessionPorts implementation. Callers must supply a
 * verified-actor-backed implementation (host composition / test double).
 */
export function createHostSessionAdapter(ports: HostSessionPorts): HostSessionAdapter {
  return {
    transport: 'host',
    ops: HOST_SESSION_OPS,
    rpcNames: HOST_SESSION_RPC_NAMES,
    edgeNames: HOST_SESSION_EDGE_NAMES,
    applySessionRuntimeCommand: (actorId, command) =>
      ports.applySessionRuntimeCommand(actorId, command),
    createPlaySession: (actorId, projectId, name) =>
      ports.createPlaySession(actorId, projectId, name),
    createSessionInvite: (actorId, sessionId) => ports.createSessionInvite(actorId, sessionId),
    getSessionRecap: (actorId, sessionId) => ports.getSessionRecap(actorId, sessionId),
    getSessionRuntimeSnapshot: (actorId, sessionId) =>
      ports.getSessionRuntimeSnapshot(actorId, sessionId),
    joinSessionByCode: (actorId, code, characterId) =>
      ports.joinSessionByCode(actorId, code, characterId),
    leavePlaySession: (actorId, sessionId) => ports.leavePlaySession(actorId, sessionId),
    resolveSessionInvite: (actorId, token) => ports.resolveSessionInvite(actorId, token),
    revokeSessionInvite: (actorId, token) => ports.revokeSessionInvite(actorId, token),
    saveSessionRecapSummary: (actorId, sessionId, summaryText, status) =>
      ports.saveSessionRecapSummary(actorId, sessionId, summaryText, status),
    setSessionPlayerPresence: (actorId, sessionId, presence) =>
      ports.setSessionPlayerPresence(actorId, sessionId, presence),
    setSessionStatus: (actorId, sessionId, status) =>
      ports.setSessionStatus(actorId, sessionId, status),
  };
}

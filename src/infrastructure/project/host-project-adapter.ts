/**
 * host-project-adapter — Binds infra HostProjectPorts to an injected host impl (MIG-308).
 * Location: src/infrastructure/project/host-project-adapter.ts
 *
 * Production UI still calls Supabase project / member / saga facades. This adapter
 * is the typed dual-path seam: tests and future host transport inject HostProjectPorts.
 * No server/ imports; no client role elevation.
 */
import type { HostProjectPorts } from './host-project-ports.contract';
import { HOST_PROJECT_OPS, HOST_PROJECT_RPC_NAMES } from './host-project-ports.contract';

export type HostProjectAdapter = HostProjectPorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_PROJECT_OPS;
  readonly rpcNames: typeof HOST_PROJECT_RPC_NAMES;
};

/**
 * Wrap an injected HostProjectPorts implementation. Callers must supply a
 * verified-actor-backed implementation (host composition / test double).
 */
export function createHostProjectAdapter(ports: HostProjectPorts): HostProjectAdapter {
  return {
    transport: 'host',
    ops: HOST_PROJECT_OPS,
    rpcNames: HOST_PROJECT_RPC_NAMES,
    createProjectSession: (actorId, projectId, name, notes) =>
      ports.createProjectSession(actorId, projectId, name, notes),
    ensureNativeStarterProject: (actorId, slug) =>
      ports.ensureNativeStarterProject(actorId, slug),
    getMySagaPermissions: (actorId, publicId) =>
      ports.getMySagaPermissions(actorId, publicId),
    getSagaLoreTimeline: (actorId, publicId) =>
      ports.getSagaLoreTimeline(actorId, publicId),
    getSagaOverview: (actorId, publicId) => ports.getSagaOverview(actorId, publicId),
    joinProjectByCode: (actorId, code, characterId) =>
      ports.joinProjectByCode(actorId, code, characterId),
    listSagaBindings: (actorId, publicId, assetKind) =>
      ports.listSagaBindings(actorId, publicId, assetKind),
    listSagaMemberPermissionState: (actorId, publicId) =>
      ports.listSagaMemberPermissionState(actorId, publicId),
    setMyProjectCharacter: (actorId, projectId, characterId) =>
      ports.setMyProjectCharacter(actorId, projectId, characterId),
    setSagaBindingReveal: (actorId, projectId, bindingId, reveal) =>
      ports.setSagaBindingReveal(actorId, projectId, bindingId, reveal),
    setSagaMemberBundle: (actorId, projectId, memberId, bundleId) =>
      ports.setSagaMemberBundle(actorId, projectId, memberId, bundleId),
  };
}

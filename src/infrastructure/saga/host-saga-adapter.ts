/**
 * host-saga-adapter — Binds infra HostSagaPorts to an injected host impl (MIG-310).
 * Location: src/infrastructure/saga/host-saga-adapter.ts
 *
 * Production UI still calls Supabase saga-definition / promote facades. This adapter
 * is the typed dual-path seam: tests and future host transport inject HostSagaPorts.
 * No server/ imports; no client role elevation.
 */
import type { HostSagaPorts } from './host-saga-ports.contract';
import { HOST_SAGA_OPS, HOST_SAGA_RPC_NAMES } from './host-saga-ports.contract';

export type HostSagaAdapter = HostSagaPorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_SAGA_OPS;
  readonly rpcNames: typeof HOST_SAGA_RPC_NAMES;
};

/**
 * Wrap an injected HostSagaPorts implementation. Callers must supply a
 * verified-actor-backed implementation (host composition / test double).
 */
export function createHostSagaAdapter(ports: HostSagaPorts): HostSagaAdapter {
  return {
    transport: 'host',
    ops: HOST_SAGA_OPS,
    rpcNames: HOST_SAGA_RPC_NAMES,
    copyNativeSagaDefinition: (actorId, sourceSagaId) =>
      ports.copyNativeSagaDefinition(actorId, sourceSagaId),
    createProjectFromSagaVersion: (actorId, sagaId, versionId, name) =>
      ports.createProjectFromSagaVersion(actorId, sagaId, versionId, name),
    createUserSagaDefinition: (actorId, title, blurb) =>
      ports.createUserSagaDefinition(actorId, title, blurb),
    duplicateSagaPlaythrough: (actorId, projectId, mode) =>
      ports.duplicateSagaPlaythrough(actorId, projectId, mode),
    getNativeSagaDefinitionBySlug: (actorId, slug) =>
      ports.getNativeSagaDefinitionBySlug(actorId, slug),
    getSagaDefinitionEditor: (actorId, sagaId) =>
      ports.getSagaDefinitionEditor(actorId, sagaId),
    getSagaDefinitionVersion: (actorId, versionId) =>
      ports.getSagaDefinitionVersion(actorId, versionId),
    promoteSessionOutcomeToSaga: (actorId, sessionId, consequenceId) =>
      ports.promoteSessionOutcomeToSaga(actorId, sessionId, consequenceId),
    promoteSessionOutcomeToWorld: (actorId, sessionId, consequenceId) =>
      ports.promoteSessionOutcomeToWorld(actorId, sessionId, consequenceId),
    publishSagaDefinitionVersion: (actorId, sagaId, expectedRevision) =>
      ports.publishSagaDefinitionVersion(actorId, sagaId, expectedRevision),
    saveSagaDefinitionDraft: (actorId, sagaId, payload, expectedRevision) =>
      ports.saveSagaDefinitionDraft(actorId, sagaId, payload, expectedRevision),
  };
}

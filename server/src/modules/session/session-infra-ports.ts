/**
 * Flat session infra ports for MIG-311 dual-path (#810).
 * Location: server/src/modules/session/session-infra-ports.ts
 *
 * Bridges nested session module ports to the FE HostSessionPorts shape without
 * importing the Vite package. No HTTP activation.
 */
import type { Actor } from '../identity/index.ts';
import type { ApplyCommandInput, ApplyCommandResult } from './internal/session-runtime-store.ts';

export const SESSION_INFRA_PORTS_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export type SessionInfraResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

type NestedOk<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

/** Minimal nested surface required by the flat bridge. */
export type SessionPortsForInfra = {
  readonly commands: {
    readonly apply: (actor: Actor, command: ApplyCommandInput) => ApplyCommandResult;
  };
  readonly queries: {
    readonly getSnapshot: (
      actor: Actor,
      sessionId: string,
    ) =>
      | { readonly ok: true; readonly snapshot: unknown; readonly projectId: string }
      | { readonly ok: false; readonly error: string };
  };
  readonly lifecycle: {
    readonly createPlaySession: (
      actor: Actor,
      projectId: string,
      name?: string | null,
    ) => NestedOk<Record<string, unknown>>;
    readonly setSessionStatus: (
      actor: Actor,
      sessionId: string,
      status: string,
    ) => NestedOk<Record<string, unknown>>;
  };
  readonly access: {
    readonly createSessionInvite: (actor: Actor, sessionId: string) => NestedOk<Record<string, unknown>>;
    readonly joinSessionByCode: (
      actor: Actor,
      code: string,
      characterId?: string | null,
    ) => NestedOk<Record<string, unknown>>;
    readonly leavePlaySession: (actor: Actor, sessionId: string) => NestedOk<unknown>;
    readonly resolveSessionInvite: (actor: Actor, token: string) => NestedOk<Record<string, unknown>>;
    readonly revokeSessionInvite: (actor: Actor, token: string) => NestedOk<unknown>;
  };
  readonly recap: {
    readonly getSessionRecap: (actor: Actor, sessionId: string) => NestedOk<Record<string, unknown>>;
    readonly saveSessionRecapSummary: (
      actor: Actor,
      sessionId: string,
      summaryText: string,
      status: string,
    ) => NestedOk<Record<string, unknown>>;
  };
};

function asActor(actorId: string): Actor {
  return { kind: 'remote-account', actorId, sessionId: `auth-${actorId}`, email: null };
}

/**
 * Wrap nested session module ports into the flat dual-path surface used by
 * `createHostSessionAdapter` / HostSessionPorts.
 */
export function createSessionInfraPorts(session: SessionPortsForInfra) {
  return {
    moduleId: 'session-infra' as const,
    applySessionRuntimeCommand(
      actorId: string,
      command: ApplyCommandInput,
    ): SessionInfraResult<Record<string, unknown>> {
      const r = session.commands.apply(asActor(actorId), command);
      return r.ok
        ? { ok: true, value: { committed: r.committed, snapshot: r.snapshot } }
        : { ok: false, error: r.error };
    },
    createPlaySession(
      actorId: string,
      projectId: string,
      name?: string | null,
    ): SessionInfraResult<Record<string, unknown>> {
      const r = session.lifecycle.createPlaySession(asActor(actorId), projectId, name ?? null);
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
    },
    createSessionInvite(
      actorId: string,
      sessionId: string,
    ): SessionInfraResult<Record<string, unknown>> {
      const r = session.access.createSessionInvite(asActor(actorId), sessionId);
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
    },
    getSessionRecap(
      actorId: string,
      sessionId: string,
    ): SessionInfraResult<Record<string, unknown>> {
      const r = session.recap.getSessionRecap(asActor(actorId), sessionId);
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
    },
    getSessionRuntimeSnapshot(
      actorId: string,
      sessionId: string,
    ): SessionInfraResult<Record<string, unknown>> {
      const r = session.queries.getSnapshot(asActor(actorId), sessionId);
      return r.ok
        ? { ok: true, value: { snapshot: r.snapshot, projectId: r.projectId } }
        : { ok: false, error: r.error };
    },
    joinSessionByCode(
      actorId: string,
      code: string,
      characterId?: string | null,
    ): SessionInfraResult<Record<string, unknown>> {
      const r = session.access.joinSessionByCode(asActor(actorId), code, characterId ?? null);
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
    },
    leavePlaySession(
      actorId: string,
      sessionId: string,
    ): SessionInfraResult<{ readonly sessionId: string }> {
      const r = session.access.leavePlaySession(asActor(actorId), sessionId);
      return r.ok
        ? { ok: true, value: { sessionId } }
        : { ok: false, error: r.error };
    },
    resolveSessionInvite(
      actorId: string,
      token: string,
    ): SessionInfraResult<Record<string, unknown>> {
      const r = session.access.resolveSessionInvite(asActor(actorId), token);
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
    },
    revokeSessionInvite(
      actorId: string,
      token: string,
    ): SessionInfraResult<{ readonly token: string }> {
      const r = session.access.revokeSessionInvite(asActor(actorId), token);
      return r.ok
        ? { ok: true, value: { token } }
        : { ok: false, error: r.error };
    },
    saveSessionRecapSummary(
      actorId: string,
      sessionId: string,
      summaryText: string,
      status?: string | null,
    ): SessionInfraResult<Record<string, unknown>> {
      const r = session.recap.saveSessionRecapSummary(
        asActor(actorId),
        sessionId,
        summaryText,
        status ?? 'draft',
      );
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
    },
    setSessionPlayerPresence(
      actorId: string,
      sessionId: string,
      expectedRevision: number,
      idempotencyKey: string,
      presence: Readonly<Record<string, unknown>>,
    ): SessionInfraResult<Record<string, unknown>> {
      const r = session.commands.apply(asActor(actorId), {
        sessionId,
        expectedRevision,
        idempotencyKey,
        op: { kind: 'presence', payload: presence },
      });
      return r.ok
        ? { ok: true, value: { committed: r.committed, snapshot: r.snapshot } }
        : { ok: false, error: r.error };
    },
    setSessionStatus(
      actorId: string,
      sessionId: string,
      status: string,
    ): SessionInfraResult<Record<string, unknown>> {
      const r = session.lifecycle.setSessionStatus(asActor(actorId), sessionId, status);
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
    },
  };
}

export type SessionInfraPorts = ReturnType<typeof createSessionInfraPorts>;

/**
 * Flat session infra ports for MIG-311 dual-path (#810).
 * Location: server/src/modules/session/session-infra-ports.ts
 *
 * Bridges nested session module ports to the FE HostSessionPorts shape without
 * importing the Vite package. No HTTP activation.
 */
import type { Actor } from '../identity/index.ts';
import type {
  InviteResolveFail,
  InviteResolveOk,
} from './internal/session-access-store.ts';
import type { ApplyCommandInput, ApplyCommandResult } from './internal/session-runtime-store.ts';

export const SESSION_INFRA_PORTS_PUBLIC_ACTIVATION_AUTHORIZED = true as const;

export type SessionInfraResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

type NestedOk<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

type InviteResolveResult =
  | InviteResolveOk
  | InviteResolveFail
  | { readonly ok: false; readonly error: string };

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
    readonly getPlaySession: (
      actor: Actor,
      sessionId: string,
    ) => NestedOk<Record<string, unknown>>;
    readonly listAccessiblePlaySessions: (
      actor: Actor,
    ) => NestedOk<readonly Record<string, unknown>[]>;
    readonly setSessionLookProfile: (
      actor: Actor,
      sessionId: string,
      lookProfileId: string | null,
    ) => NestedOk<Record<string, unknown>>;
    readonly deletePlaySession: (
      actor: Actor,
      sessionId: string,
    ) => NestedOk<{ readonly sessionId: string }>;
  };
  readonly access: {
    readonly createSessionInvite: (actor: Actor, sessionId: string) => NestedOk<Record<string, unknown>>;
    readonly joinSessionByCode: (
      actor: Actor,
      code: string,
      characterId?: string | null,
    ) => NestedOk<Record<string, unknown>>;
    readonly leavePlaySession: (actor: Actor, sessionId: string) => NestedOk<unknown>;
    readonly resolveSessionInvite: (actor: Actor, token: string) => InviteResolveResult;
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
  return {
    kind: 'remote-account',
    actorId,
    sessionId: `auth-${actorId}`,
    email: null,
    linkedSoloActorIds: [],
  };
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
      if (!r.ok) return { ok: false, error: r.error };
      // Flat RPC-shaped payload (revision/status/roster on value.*), plus projectId.
      const snap =
        r.snapshot && typeof r.snapshot === 'object'
          ? (r.snapshot as Record<string, unknown>)
          : {};
      return { ok: true, value: { ...snap, projectId: r.projectId } };
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
    deletePlaySession(
      actorOrId: Actor | string,
      sessionId: string,
    ): SessionInfraResult<{ readonly sessionId: string }> {
      // Prefer resolved Actor so linkedSoloActorIds survive (asActor drops them → false 403).
      const actor = typeof actorOrId === 'string' ? asActor(actorOrId) : actorOrId;
      const r = session.lifecycle.deletePlaySession(actor, sessionId);
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
    },
    resolveSessionInvite(
      actorId: string,
      token: string,
    ): SessionInfraResult<Record<string, unknown>> {
      const r = session.access.resolveSessionInvite(asActor(actorId), token);
      if (r.ok) {
        const { ok: _ok, ...invite } = r;
        return { ok: true, value: invite };
      }
      if ('error' in r && typeof r.error === 'string') {
        return { ok: false, error: r.error };
      }
      return { ok: false, error: r.error_code };
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
      actorOrId: Actor | string,
      sessionId: string,
      summaryText: string,
      status?: string | null,
    ): SessionInfraResult<Record<string, unknown>> {
      // Prefer resolved Actor so linkedSoloActorIds survive (asActor drops them → false 403).
      const actor = typeof actorOrId === 'string' ? asActor(actorOrId) : actorOrId;
      const r = session.recap.saveSessionRecapSummary(
        actor,
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
      const payload = {
        ...presence,
        userId:
          typeof presence.userId === 'string' && presence.userId.trim()
            ? presence.userId
            : actorId,
      };
      const r = session.commands.apply(asActor(actorId), {
        sessionId,
        expectedRevision,
        idempotencyKey,
        op: { kind: 'presence', payload },
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
    getPlaySession(
      actorId: string,
      sessionId: string,
    ): SessionInfraResult<Record<string, unknown>> {
      const r = session.lifecycle.getPlaySession(asActor(actorId), sessionId);
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
    },
    listAccessiblePlaySessions(
      actorId: string,
    ): SessionInfraResult<readonly Record<string, unknown>[]> {
      const r = session.lifecycle.listAccessiblePlaySessions(asActor(actorId));
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
    },
    setSessionLookProfile(
      actorOrId: Actor | string,
      sessionId: string,
      lookProfileId: string | null,
    ): SessionInfraResult<Record<string, unknown>> {
      // Prefer the resolved Actor so linkedSoloActorIds survive the infra bridge
      // (asActor(id) alone drops linked solos and falsely 403s migrated owners).
      const actor = typeof actorOrId === 'string' ? asActor(actorOrId) : actorOrId;
      const r = session.lifecycle.setSessionLookProfile(
        actor,
        sessionId,
        lookProfileId,
      );
      return r.ok ? { ok: true, value: r.value } : { ok: false, error: r.error };
    },
  };
}

export type SessionInfraPorts = ReturnType<typeof createSessionInfraPorts>;

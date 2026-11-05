/**
 * Session product HTTP — FE-HOST-02 dual-path adapters over sessionInfra ports.
 * Location: server/src/api/session-routes.ts
 *
 * Actor from cookie session / solo AUTH_NOT_CONFIGURED loopback only.
 * MIG-020 transport canary on /snapshot + /commands stays separate.
 */
import type { Hono } from 'hono';
import type { Actor, IdentityPorts } from '../modules/identity/index.ts';
import type { SessionInfraPorts } from '../modules/session/index.ts';
import { authDenyStatus } from './errors.ts';

export type SessionHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly sessionInfra?: SessionInfraPorts | null;
  /** Optional Look ownership checks for session Look PATCH (FE-HOST-12). */
  readonly look?: import('../modules/look/index.ts').LookProfilePorts | null;
  /** CUT-03 — clear temporary NPC controllers on session end. */
  readonly npcCreature?: import('../modules/npc-creature/index.ts').NpcCreaturePorts | null;
  /** CUT-05 — session outcome promote via saga-infra ports. */
  readonly sagaInfra?: import('../application/saga-infra/index.ts').SagaInfraPorts | null;
};

function normalizeHostname(hostname: string): string {
  const raw = hostname.trim().toLowerCase();
  if (raw.startsWith('[') && raw.endsWith(']')) return raw.slice(1, -1);
  return raw;
}

function isLoopbackHost(hostname: string | null): boolean {
  if (!hostname) return false;
  const host = normalizeHostname(hostname);
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function requestHostName(headers: Headers): string | null {
  const host = headers.get('host');
  if (!host) return null;
  try {
    return normalizeHostname(new URL(`http://${host}`).hostname);
  } catch {
    return null;
  }
}

function soloLoopbackAllowed(headers: Headers): boolean {
  if (!isLoopbackHost(requestHostName(headers))) return false;
  const origin = headers.get('origin');
  if (!origin) return true;
  try {
    return isLoopbackHost(normalizeHostname(new URL(origin).hostname));
  } catch {
    return false;
  }
}

async function resolveSessionActor(
  deps: SessionHttpDeps,
  headers: Headers,
  allowSameOriginRead: boolean,
  body?: unknown,
): Promise<{ ok: true; actor: Actor } | { ok: false; status: number; error: string }> {
  const remote = await deps.identity.resolveRemoteSession(headers, {
    allowSameOriginRead,
    body,
  });
  if (remote.ok) return { ok: true, actor: remote.actor };
  if (
    deps.hostMode === 'solo' &&
    remote.code === 'AUTH_NOT_CONFIGURED' &&
    soloLoopbackAllowed(headers)
  ) {
    return { ok: true, actor: deps.identity.resolveSoloActor() };
  }
  return { ok: false, status: authDenyStatus(remote.code), error: remote.code };
}

async function readJsonSafe(c: {
  req: { json: () => Promise<unknown>; text: () => Promise<string> };
}): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    const text = await c.req.text();
    if (!text || text.trim().length === 0) return { ok: true, body: {} };
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function infraStatus(error: string): number {
  if (
    error === 'UNAUTHENTICATED' ||
    error === 'FORBIDDEN' ||
    error === 'not-authorized' ||
    error.startsWith('42501') ||
    /forbidden|not[_-]?authorized/i.test(error)
  ) {
    return 403;
  }
  if (
    error === 'SESSION_NOT_FOUND' ||
    error === 'P0002' ||
    error.startsWith('P0002:') ||
    /not[_-]?found/i.test(error)
  ) {
    return 404;
  }
  if (error === 'STALE_REVISION' || error === 'INVALID_REVISION') return 409;
  if (
    error === 'INVALID_COMMAND' ||
    error === 'INVALID_PAYLOAD' ||
    error === 'INVALID_OPERATION' ||
    error === 'INVALID_IDEMPOTENCY_KEY' ||
    error === '22023' ||
    error.startsWith('22023:')
  ) {
    return 422;
  }
  if (error === 'store-unavailable' || error === 'DATABASE_BUSY') return 503;
  return 400;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

/** Strip GM-only fields from list/detail unless includeJoinCode (create/join). */
function publicSessionDto(
  raw: Record<string, unknown>,
  opts: { readonly includeJoinCode?: boolean } = {},
): Record<string, unknown> {
  return {
    sessionId: raw.sessionId,
    projectId: raw.projectId,
    publicId: raw.publicId,
    joinCode: opts.includeJoinCode === true ? (raw.joinCode ?? raw.code ?? null) : null,
    status: raw.status,
    sessionNumber: raw.sessionNumber,
    name: raw.name,
    createdAt: raw.createdAt,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
    gmUserId: typeof raw.gmUserId === 'string' ? raw.gmUserId : '',
  };
}

/**
 * Mount product session lifecycle / runtime / invite routes for browser cutover.
 */
export function mountSessionHttpRoutes(app: Hono, deps: SessionHttpDeps): void {
  if (!deps.sessionInfra) return;
  const infra = deps.sessionInfra;

  app.get('/api/v1/sessions', async (c) => {
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const listed = infra.listAccessiblePlaySessions(actorResult.actor.actorId);
    if (!listed.ok) {
      return c.json({ error: listed.error }, infraStatus(listed.error));
    }
    return c.json(
      {
        sessions: listed.value.map((row) =>
          publicSessionDto(row as Record<string, unknown>, { includeJoinCode: false }),
        ),
      },
      200,
    );
  });

  app.post('/api/v1/sessions', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const projectId = typeof body.projectId === 'string' ? body.projectId : '';
    const name = typeof body.name === 'string' ? body.name : null;
    if (!projectId) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const created = infra.createPlaySession(actorResult.actor.actorId, projectId, name);
    if (!created.ok) {
      return c.json({ error: created.error }, infraStatus(created.error));
    }
    return c.json(
      {
        session: publicSessionDto(
          { ...created.value, gmUserId: actorResult.actor.actorId },
          { includeJoinCode: true },
        ),
      },
      201,
    );
  });

  app.get('/api/v1/sessions/:sessionId', async (c) => {
    const sessionId = c.req.param('sessionId');
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const got = infra.getPlaySession(actorResult.actor.actorId, sessionId);
    if (!got.ok) {
      return c.json({ error: got.error }, infraStatus(got.error));
    }
    return c.json(
      {
        session: publicSessionDto(got.value as Record<string, unknown>, {
          includeJoinCode: false,
        }),
      },
      200,
    );
  });

  app.post('/api/v1/sessions/join', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const code = typeof body.code === 'string' ? body.code : '';
    const characterId = typeof body.characterId === 'string' ? body.characterId : null;
    if (!code.trim()) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const joined = infra.joinSessionByCode(actorResult.actor.actorId, code, characterId);
    if (!joined.ok) {
      return c.json({ error: joined.error }, infraStatus(joined.error));
    }
    return c.json(
      {
        session: publicSessionDto(joined.value as Record<string, unknown>, {
          includeJoinCode: true,
        }),
      },
      200,
    );
  });

  app.post('/api/v1/sessions/:sessionId/status', async (c) => {
    const sessionId = c.req.param('sessionId');
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const status = typeof body.status === 'string' ? body.status : '';
    if (!status) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const updated = infra.setSessionStatus(actorResult.actor.actorId, sessionId, status);
    if (!updated.ok) {
      return c.json({ error: updated.error }, infraStatus(updated.error));
    }
    return c.json(
      {
        session: publicSessionDto(updated.value as Record<string, unknown>, {
          includeJoinCode: false,
        }),
      },
      200,
    );
  });

  app.patch('/api/v1/sessions/:sessionId/look', async (c) => {
    const sessionId = c.req.param('sessionId');
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!('lookProfileId' in body) && !('look_profile_id' in body)) {
      return c.json({ error: '22023' }, 422);
    }
    const raw =
      'lookProfileId' in body ? body.lookProfileId : body.look_profile_id;
    if (raw !== null && raw !== undefined && typeof raw !== 'string') {
      return c.json({ error: '22023' }, 422);
    }
    const lookProfileId =
      raw === null || raw === undefined ? null : String(raw).trim() || null;
    if (lookProfileId && deps.look) {
      const owned = deps.look.getProfileById(actorResult.actor, lookProfileId);
      if (!owned.ok) {
        return c.json({ error: owned.error }, infraStatus(owned.error));
      }
      if (!owned.value) {
        return c.json({ error: '42501' }, 403);
      }
      if (owned.value.status !== 'active') {
        return c.json({ error: '42501' }, 403);
      }
    } else if (lookProfileId && !deps.look) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const updated = infra.setSessionLookProfile(
      actorResult.actor,
      sessionId,
      lookProfileId,
    );
    if (!updated.ok) {
      return c.json({ error: updated.error }, infraStatus(updated.error));
    }
    const value = updated.value as Record<string, unknown>;
    return c.json(
      {
        session: {
          id:
            typeof value.sessionId === 'string'
              ? value.sessionId
              : typeof value.id === 'string'
                ? value.id
                : sessionId,
          projectId:
            typeof value.projectId === 'string'
              ? value.projectId
              : typeof value.project_id === 'string'
                ? value.project_id
                : '',
          lookProfileId:
            typeof value.lookProfileId === 'string'
              ? value.lookProfileId
              : value.lookProfileId === null
                ? null
                : lookProfileId,
          publicId: typeof value.publicId === 'string' ? value.publicId : '',
          status: typeof value.status === 'string' ? value.status : '',
          sessionNumber:
            typeof value.sessionNumber === 'number' ? value.sessionNumber : null,
          name: typeof value.name === 'string' ? value.name : null,
        },
      },
      200,
    );
  });

  /**
   * CUT-04 — GM deletes play session (cascade dependents).
   * NPC instance session_id detach via owning npc-creature port first.
   */
  app.delete('/api/v1/sessions/:sessionId', async (c) => {
    const sessionId = c.req.param('sessionId');
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!infra?.deletePlaySession) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    if (deps.npcCreature?.detachInstancesFromSession) {
      const detached = deps.npcCreature.detachInstancesFromSession(
        actorResult.actor,
        sessionId,
      );
      if (!detached.ok) {
        const err = detached.error;
        // Missing session here is OK — deletePlaySession returns P0002 next.
        if (err !== 'P0001:session not found') {
          const status =
            err === 'P0001:only gm may detach session instances' ||
            err === 'P0001:actor is not an active project member'
              ? 403
              : err === 'P0001:not authenticated' || err === 'missing-actor'
                ? 401
                : 400;
          return c.json({ error: err }, status);
        }
      }
    }
    const deleted = infra.deletePlaySession(actorResult.actor, sessionId);
    if (!deleted.ok) {
      return c.json({ error: deleted.error }, infraStatus(deleted.error));
    }
    return c.json({ ok: true, sessionId: deleted.value.sessionId }, 200);
  });

  app.post('/api/v1/sessions/:sessionId/leave', async (c) => {
    const sessionId = c.req.param('sessionId');
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const left = infra.leavePlaySession(actorResult.actor.actorId, sessionId);
    if (!left.ok) {
      return c.json({ error: left.error }, infraStatus(left.error));
    }
    return c.json(left.value, 200);
  });

  app.get('/api/v1/sessions/:sessionId/runtime', async (c) => {
    const sessionId = c.req.param('sessionId');
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const snap = infra.getSessionRuntimeSnapshot(actorResult.actor.actorId, sessionId);
    if (!snap.ok) {
      return c.json({ error: snap.error }, infraStatus(snap.error));
    }
    return c.json(snap.value, 200);
  });

  app.post('/api/v1/sessions/:sessionId/runtime/commands', async (c) => {
    const sessionId = c.req.param('sessionId');
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const expectedRevision =
      typeof body.expectedRevision === 'number' ? body.expectedRevision : Number.NaN;
    const kind = typeof body.kind === 'string' ? body.kind : '';
    const idempotencyKey =
      typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : `fe-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const payload =
      body.payload !== null && typeof body.payload === 'object' && !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : {};
    if (!Number.isFinite(expectedRevision) || !kind) {
      return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    }
    try {
      const applied = infra.applySessionRuntimeCommand(actorResult.actor.actorId, {
        sessionId,
        expectedRevision,
        idempotencyKey,
        op: { kind, payload },
      });
      if (!applied.ok) {
        return c.json({ error: applied.error }, infraStatus(applied.error));
      }
      const snapshot = applied.value.snapshot;
      return c.json(snapshot ?? applied.value, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'INVALID_OPERATION';
      return c.json({ error: message }, infraStatus(message));
    }
  });

  app.post('/api/v1/sessions/:sessionId/runtime/presence', async (c) => {
    const sessionId = c.req.param('sessionId');
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const expectedRevision =
      typeof body.expectedRevision === 'number' ? body.expectedRevision : 0;
    const idempotencyKey =
      typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : `presence-${Date.now()}`;
    const isOnline = body.isOnline === true;
    const applied = infra.setSessionPlayerPresence(
      actorResult.actor.actorId,
      sessionId,
      expectedRevision,
      idempotencyKey,
      { isOnline },
    );
    if (!applied.ok) {
      return c.json({ error: applied.error }, infraStatus(applied.error));
    }
    const snapshot = applied.value.snapshot;
    return c.json(snapshot ?? applied.value, 200);
  });

  app.post('/api/v1/sessions/:sessionId/invites', async (c) => {
    const sessionId = c.req.param('sessionId');
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const created = infra.createSessionInvite(actorResult.actor.actorId, sessionId);
    if (!created.ok) {
      return c.json({ error: created.error }, infraStatus(created.error));
    }
    return c.json({ invite: created.value }, 201);
  });

  app.post('/api/v1/sessions/invites/resolve', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token.trim()) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const resolved = infra.resolveSessionInvite(actorResult.actor.actorId, token);
    if (!resolved.ok) {
      return c.json({ error: resolved.error }, infraStatus(resolved.error));
    }
    return c.json({ invite: resolved.value }, 200);
  });

  app.post('/api/v1/sessions/invites/revoke', async (c) => {
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const token = typeof body.token === 'string' ? body.token : '';
    if (!token.trim()) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const revoked = infra.revokeSessionInvite(actorResult.actor.actorId, token);
    if (!revoked.ok) {
      return c.json({ error: revoked.error }, infraStatus(revoked.error));
    }
    return c.json(revoked.value, 200);
  });

  app.get('/api/v1/sessions/:sessionId/recap', async (c) => {
    const sessionId = c.req.param('sessionId');
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, true);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const recap = infra.getSessionRecap(actorResult.actor.actorId, sessionId);
    if (!recap.ok) {
      return c.json({ error: recap.error }, infraStatus(recap.error));
    }
    return c.json({ recap: recap.value }, 200);
  });

  /** FE-HOST-14: manual recap save (no Edge AI required). */
  app.put('/api/v1/sessions/:sessionId/recap', async (c) => {
    const sessionId = c.req.param('sessionId');
    const parsed = await readJsonSafe(c);
    if (!parsed.ok) return c.json({ error: 'INVALID_PAYLOAD' }, 422);
    const body = asRecord(parsed.body);
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false, parsed.body);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    const summaryText =
      typeof body.summaryText === 'string'
        ? body.summaryText
        : typeof body.summary_text === 'string'
          ? body.summary_text
          : '';
    const statusRaw =
      typeof body.status === 'string'
        ? body.status
        : typeof body.summaryStatus === 'string'
          ? body.summaryStatus
          : 'draft';
    const status = statusRaw === 'approved' ? 'approved' : 'draft';
    const saved = infra.saveSessionRecapSummary(
      actorResult.actor,
      sessionId,
      summaryText,
      status,
    );
    if (!saved.ok) {
      return c.json({ error: saved.error }, infraStatus(saved.error));
    }
    return c.json({ recap: saved.value }, 200);
  });

  /**
   * CUT-03 — clear temporary NPC controllers for session-scoped instances.
   * Does not touch campaign controller assignments.
   */
  app.post('/api/v1/sessions/:sessionId/npc-temp-controllers/clear', async (c) => {
    const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.npcCreature?.clearTempControllersForSession) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const cleared = deps.npcCreature.clearTempControllersForSession(
      actorResult.actor,
      c.req.param('sessionId'),
    );
    if (!cleared.ok) {
      const err = cleared.error;
      const status =
        err === 'P0001:only gm may clear temp controllers' ||
        err === 'P0001:actor is not an active project member'
          ? 403
          : err === 'P0001:session not found'
            ? 404
            : err === 'P0001:not authenticated' || err === 'missing-actor'
              ? 401
              : 400;
      return c.json({ error: err }, status);
    }
    return c.json({ cleared: cleared.value.cleared }, 200);
  });

  /**
   * CUT-05 — promote accepted session consequence into saga definition.
   * Reuses SagaInfraPorts.promoteSessionOutcomeToSaga (no Postgres RPC).
   */
  app.post(
    '/api/v1/sessions/:sessionId/outcomes/:consequenceId/promote/saga',
    async (c) => {
      const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false);
      if (!actorResult.ok) {
        return c.json({ error: actorResult.error }, actorResult.status);
      }
      if (!deps.sagaInfra?.promoteSessionOutcomeToSaga) {
        return c.json({ error: 'store-unavailable' }, 503);
      }
      const promoted = deps.sagaInfra.promoteSessionOutcomeToSaga(
        actorResult.actor,
        c.req.param('sessionId'),
        c.req.param('consequenceId'),
      );
      if (!promoted.ok) {
        return c.json({ error: promoted.error }, infraStatus(promoted.error));
      }
      return c.json(promoted.value, 200);
    },
  );

  /**
   * CUT-05 — promote accepted session consequence into world lore.
   * Reuses SagaInfraPorts.promoteSessionOutcomeToWorld (no Postgres RPC).
   */
  app.post(
    '/api/v1/sessions/:sessionId/outcomes/:consequenceId/promote/world',
    async (c) => {
      const actorResult = await resolveSessionActor(deps, c.req.raw.headers, false);
      if (!actorResult.ok) {
        return c.json({ error: actorResult.error }, actorResult.status);
      }
      if (!deps.sagaInfra?.promoteSessionOutcomeToWorld) {
        return c.json({ error: 'store-unavailable' }, 503);
      }
      const promoted = deps.sagaInfra.promoteSessionOutcomeToWorld(
        actorResult.actor,
        c.req.param('sessionId'),
        c.req.param('consequenceId'),
      );
      if (!promoted.ok) {
        return c.json({ error: promoted.error }, infraStatus(promoted.error));
      }
      return c.json(promoted.value, 200);
    },
  );
}

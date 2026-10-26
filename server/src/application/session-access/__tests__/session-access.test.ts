/**
 * Lightweight shape tests for session-access use-cases (#869).
 * Location: server/src/application/session-access/__tests__/session-access.test.ts
 *
 * Full behavioral coverage: scripts/rpc-session-access.self-test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { joinSessionByCodeUseCase } from '../join_session_by_code/index.ts';
import { leavePlaySessionUseCase } from '../leave_play_session/index.ts';
import { createSessionInviteUseCase } from '../create_session_invite/index.ts';
import { resolveSessionInviteUseCase } from '../resolve_session_invite/index.ts';
import { revokeSessionInviteUseCase } from '../revoke_session_invite/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';

function stubSession(access: SessionPorts['access']): SessionPorts {
  return {
    moduleId: 'session',
    commands: { apply: () => ({ ok: false, error: 'stub' }) },
    queries: { getSnapshot: () => ({ ok: false, error: 'stub' }) },
    store: {} as SessionPorts['store'],
    invites: {} as SessionPorts['invites'],
    lifecycle: {
      createPlaySession: () => ({ ok: false, error: 'stub' }),
      createProjectSession: () => ({ ok: false, error: 'stub' }),
      setSessionStatus: () => ({ ok: false, error: 'stub' }),
    },
    access,
  };
}

describe('session-access use-cases', () => {
  it('join delegates to access port', () => {
    let seen = '';
    const session = stubSession({
      joinSessionByCode: (_a, code) => {
        seen = code;
        return { ok: false, error: 'x' };
      },
      leavePlaySession: () => ({ ok: false, error: 'x' }),
      createSessionInvite: () => ({ ok: false, error: 'x' }),
      revokeSessionInvite: () => ({ ok: false, error: 'x' }),
      resolveSessionInvite: () => ({ ok: false, error: 'x' }),
    });
    joinSessionByCodeUseCase(session)({ kind: 'solo-local', actorId: 'a' }, 'ABC123');
    assert.equal(seen, 'ABC123');
  });

  it('leave/invite/resolve/revoke are wired', () => {
    const calls: string[] = [];
    const session = stubSession({
      joinSessionByCode: () => ({ ok: false, error: 'x' }),
      leavePlaySession: () => {
        calls.push('leave');
        return { ok: true, value: { left: false, runtimeRevision: 0 } };
      },
      createSessionInvite: () => {
        calls.push('create');
        return { ok: false, error: 'x' };
      },
      revokeSessionInvite: () => {
        calls.push('revoke');
        return { ok: false, error: 'x' };
      },
      resolveSessionInvite: () => {
        calls.push('resolve');
        return { ok: false, error_code: 'not_found' };
      },
    });
    const actor = { kind: 'solo-local' as const, actorId: 'a' };
    leavePlaySessionUseCase(session)(actor, 's1');
    createSessionInviteUseCase(session)(actor, 's1');
    revokeSessionInviteUseCase(session)(actor, 'tok');
    resolveSessionInviteUseCase(session)(actor, 'tok');
    assert.deepEqual(calls, ['leave', 'create', 'revoke', 'resolve']);
  });
});

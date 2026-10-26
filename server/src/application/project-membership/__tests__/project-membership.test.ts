/**
 * Application-level smoke for project-membership use-cases (#874).
 * Location: server/src/application/project-membership/__tests__/project-membership.test.ts
 *
 * Full fixture coverage lives in scripts/rpc-project-membership.self-test.mjs.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { joinProjectByCodeUseCase } from '../join_project_by_code/index.ts';
import { setMyProjectCharacterUseCase } from '../set_my_project_character/index.ts';

describe('project-membership use-cases', () => {
  it('denies unauthenticated join and set', () => {
    const project = {
      joinByCode: () => ({ ok: true as const, projectId: 'p1' }),
      setMyCharacter: () => ({ ok: true as const, memberId: 'm1' }),
    };
    const character = {
      assertOwnedCompletePc: () => ({ ok: true as const }),
    };
    const join = joinProjectByCodeUseCase({
      project: project as never,
      character: character as never,
    });
    const set = setMyProjectCharacterUseCase({
      project: project as never,
      character: character as never,
    });
    assert.equal(join({ kind: 'solo-local', actorId: '' }, 'CODE').ok, false);
    assert.equal(set({ kind: 'solo-local', actorId: '' }, 'p1', null).ok, false);
  });
});

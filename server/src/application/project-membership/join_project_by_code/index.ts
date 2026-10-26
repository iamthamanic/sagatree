/**
 * join_project_by_code use-case (RPC-PROJECT-MEMBERSHIP / #874).
 * Location: server/src/application/project-membership/join_project_by_code/index.ts
 *
 * Normalizes join code, enforces character ownership via character ports, inserts one active player row.
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { CharacterPorts } from '../../../modules/character/index.ts';
import type { ProjectPorts } from '../../../modules/project/index.ts';

export function joinProjectByCodeUseCase(deps: {
  readonly project: ProjectPorts;
  readonly character: CharacterPorts;
}) {
  const { project, character } = deps;

  return (
    actor: Actor,
    codeRaw: string,
    characterIdRaw?: string | null,
  ):
    | { readonly ok: true; readonly projectId: string }
    | { readonly ok: false; readonly error: string; readonly detail?: string } => {
    if (!actor?.actorId) return { ok: false, error: '42501' };

    const characterId =
      typeof characterIdRaw === 'string' && characterIdRaw.trim() !== ''
        ? characterIdRaw.trim()
        : null;

    if (characterId) {
      const check = character.assertOwnedCompletePc(actor.actorId, characterId);
      if (!check.ok) return { ok: false, error: check.error };
    }

    return project.joinByCode({
      actorId: actor.actorId,
      code: typeof codeRaw === 'string' ? codeRaw : '',
      characterId,
    });
  };
}

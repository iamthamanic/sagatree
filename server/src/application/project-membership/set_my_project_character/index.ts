/**
 * set_my_project_character use-case (RPC-PROJECT-MEMBERSHIP / #874).
 * Location: server/src/application/project-membership/set_my_project_character/index.ts
 *
 * Binds or clears the caller's active membership character_id; never mutates foreign rows.
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { CharacterPorts } from '../../../modules/character/index.ts';
import type { ProjectPorts } from '../../../modules/project/index.ts';

export function setMyProjectCharacterUseCase(deps: {
  readonly project: ProjectPorts;
  readonly character: CharacterPorts;
}) {
  const { project, character } = deps;

  return (
    actor: Actor,
    projectIdRaw: string,
    characterIdRaw?: string | null,
  ):
    | { readonly ok: true; readonly memberId: string }
    | { readonly ok: false; readonly error: string } => {
    if (!actor?.actorId) return { ok: false, error: '42501' };

    const projectId = typeof projectIdRaw === 'string' ? projectIdRaw.trim() : '';
    if (!projectId) return { ok: false, error: 'P0002' };

    const characterId =
      typeof characterIdRaw === 'string' && characterIdRaw.trim() !== ''
        ? characterIdRaw.trim()
        : null;

    if (characterId) {
      const check = character.assertOwnedCompletePc(actor.actorId, characterId);
      if (!check.ok) return { ok: false, error: check.error };
    }

    return project.setMyCharacter({
      actorId: actor.actorId,
      projectId,
      characterId,
    });
  };
}

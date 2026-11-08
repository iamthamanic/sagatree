export interface CharacterLoreWorldGrant {
  creatorUserId: string | null;
  isPublic: boolean;
}

/**
 * Private world lore is usable only when the authority that owns the reference owns the world.
 * For direct world requests that authority is the caller. For project-linked world lore it is
 * the project's GM, so project membership cannot turn an arbitrary private world UUID into a grant.
 */
export function canUseWorldLoreReference(
  world: CharacterLoreWorldGrant,
  callerUserId: string,
  projectGmUserId?: string,
): boolean {
  if (world.isPublic) return true;
  const referenceOwnerUserId = projectGmUserId ?? callerUserId;
  return world.creatorUserId === referenceOwnerUserId;
}

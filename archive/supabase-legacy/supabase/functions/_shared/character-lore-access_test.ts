import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { canUseWorldLoreReference } from './character-lore-access.ts';

Deno.test('direct private world lore is limited to its creator', () => {
  assertEquals(
    canUseWorldLoreReference(
      { creatorUserId: 'user-a', isPublic: false },
      'user-a',
    ),
    true,
  );
  assertEquals(
    canUseWorldLoreReference(
      { creatorUserId: 'user-a', isPublic: false },
      'user-b',
    ),
    false,
  );
});

Deno.test('public world lore is readable regardless of owner', () => {
  assertEquals(
    canUseWorldLoreReference(
      { creatorUserId: 'user-a', isPublic: true },
      'user-b',
    ),
    true,
  );
});

Deno.test('project-linked private world must be owned by the project GM', () => {
  assertEquals(
    canUseWorldLoreReference(
      { creatorUserId: 'gm-a', isPublic: false },
      'member-b',
      'gm-a',
    ),
    true,
  );
  assertEquals(
    canUseWorldLoreReference(
      { creatorUserId: 'other-owner', isPublic: false },
      'member-b',
      'gm-a',
    ),
    false,
  );
});

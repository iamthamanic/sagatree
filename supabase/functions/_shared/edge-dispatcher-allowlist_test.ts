/**
 * edge-dispatcher-allowlist_test — unit tests for Edge mount allowlist (#668).
 * Location: supabase/functions/_shared/edge-dispatcher-allowlist_test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  EDGE_DISPATCHER_ALLOWLIST,
  isEdgeDispatcherAllowed,
} from './edge-dispatcher-allowlist.ts';

Deno.test('allowlist includes hardened surfaces from #668', () => {
  for (const name of [
    'character-lore',
    'item-thumbnail',
    'item-model3d',
    'session-recap',
    'ai-provider-credentials',
    'ollama-settings',
  ] as const) {
    assertEquals(isEdgeDispatcherAllowed(name), true, name);
  }
  assertEquals(EDGE_DISPATCHER_ALLOWLIST.length >= 6, true);
});

Deno.test('legacy unauthenticated workers are denied', () => {
  for (const name of [
    'characters',
    'sessions',
    'ai-gm',
    'export',
    'marketplace',
    'dm-tools',
    'rulesets',
    'bestiary',
    'items',
    'lorekeeper',
    'media',
    'npcs',
    'quests',
    'spellbook',
    'world',
  ]) {
    assertEquals(isEdgeDispatcherAllowed(name), false, name);
  }
});

Deno.test('main and _shared and path traversal are denied', () => {
  assertEquals(isEdgeDispatcherAllowed('main'), false);
  assertEquals(isEdgeDispatcherAllowed('_shared'), false);
  assertEquals(isEdgeDispatcherAllowed('../etc'), false);
  assertEquals(isEdgeDispatcherAllowed(''), false);
});

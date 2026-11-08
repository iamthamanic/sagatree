import {
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  consumePersistentCharacterLoreRateLimit,
  type CharacterLoreRateLimitConfig,
} from './character-lore-rate-limit.ts';

const config: CharacterLoreRateLimitConfig = {
  url: 'http://supabase-kong:8000/',
  serviceRoleKey: 'server-only-test-key',
  limit: 6,
  windowSeconds: 60,
};

Deno.test('persistent character lore rate limit calls the service-role RPC with the authenticated user', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;

  const allowed = await consumePersistentCharacterLoreRateLimit(
    config,
    '00000000-0000-4000-8000-000000000001',
    async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return new Response('true', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  );

  assertEquals(allowed, true);
  assertEquals(
    requestedUrl,
    'http://supabase-kong:8000/rest/v1/rpc/consume_character_lore_rate_limit',
  );
  assertEquals(requestedInit?.method, 'POST');
  assertEquals(
    (requestedInit?.headers as Record<string, string> | undefined)?.Authorization,
    'Bearer server-only-test-key',
  );
  assertEquals(
    JSON.parse(String(requestedInit?.body)),
    {
      p_user_id: '00000000-0000-4000-8000-000000000001',
      p_limit: 6,
      p_window_seconds: 60,
    },
  );
});

Deno.test('persistent character lore rate limit returns false when the shared quota is exhausted', async () => {
  const allowed = await consumePersistentCharacterLoreRateLimit(
    config,
    '00000000-0000-4000-8000-000000000002',
    async () => new Response('false', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

  assertEquals(allowed, false);
});

Deno.test('persistent character lore rate limit fails closed when the RPC is unavailable', async () => {
  await assertRejects(
    () => consumePersistentCharacterLoreRateLimit(
      config,
      '00000000-0000-4000-8000-000000000003',
      async () => new Response('{"message":"missing rpc"}', { status: 404 }),
    ),
    Error,
    'Persistent rate limit RPC returned 404',
  );
});

Deno.test('persistent character lore rate limit rejects malformed RPC responses', async () => {
  await assertRejects(
    () => consumePersistentCharacterLoreRateLimit(
      config,
      '00000000-0000-4000-8000-000000000004',
      async () => new Response('{"allowed":true}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
    Error,
    'Persistent rate limit RPC returned an invalid response',
  );
});

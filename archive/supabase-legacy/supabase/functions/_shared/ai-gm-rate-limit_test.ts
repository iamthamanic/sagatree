/**
 * ai-gm-rate-limit_test — unit tests for #670 persistent AI GM limiter.
 * Location: supabase/functions/_shared/ai-gm-rate-limit_test.ts
 */
import { assertEquals, assertRejects } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { consumePersistentAiGmRateLimit } from './ai-gm-rate-limit.ts';

Deno.test('consumePersistentAiGmRateLimit returns RPC boolean', async () => {
  const allowed = await consumePersistentAiGmRateLimit(
    {
      url: 'http://example.test',
      serviceRoleKey: 'service-role',
      limit: 10,
      windowSeconds: 60,
    },
    '11111111-1111-1111-1111-111111111111',
    async () =>
      new Response(JSON.stringify(true), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  assertEquals(allowed, true);
});

Deno.test('consumePersistentAiGmRateLimit fails closed on non-OK RPC', async () => {
  await assertRejects(
    () =>
      consumePersistentAiGmRateLimit(
        {
          url: 'http://example.test',
          serviceRoleKey: 'service-role',
          limit: 10,
          windowSeconds: 60,
        },
        '11111111-1111-1111-1111-111111111111',
        async () => new Response('nope', { status: 500 }),
      ),
    Error,
    'Persistent rate limit RPC returned 500',
  );
});

Deno.test('consumePersistentAiGmRateLimit rejects empty user id', async () => {
  await assertRejects(
    () =>
      consumePersistentAiGmRateLimit(
        {
          url: 'http://example.test',
          serviceRoleKey: 'service-role',
          limit: 10,
          windowSeconds: 60,
        },
        '  ',
      ),
    Error,
    'Rate limit user id is required',
  );
});

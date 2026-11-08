/**
 * edge-jwt-gate_test — unit tests for Edge Bearer JWT gate (#607).
 * Location: supabase/functions/_shared/edge-jwt-gate_test.ts
 */
import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  extractBearerToken,
  gateEdgeRequestJwt,
  isJwtVerificationEnabled,
} from './edge-jwt-gate.ts';

function envMap(entries: Record<string, string>) {
  return {
    get(key: string) {
      return entries[key];
    },
  };
}

async function mintHs256(secret: string, payload: Record<string, unknown>): Promise<string> {
  const enc = new TextEncoder();
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${header}.${body}.${sig}`;
}

Deno.test('isJwtVerificationEnabled defaults true', () => {
  assertEquals(isJwtVerificationEnabled(envMap({})), true);
  assertEquals(isJwtVerificationEnabled(envMap({ VERIFY_JWT: 'true' })), true);
  assertEquals(isJwtVerificationEnabled(envMap({ VERIFY_JWT: 'false' })), false);
});

Deno.test('extractBearerToken', () => {
  assertEquals(extractBearerToken(null), null);
  assertEquals(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assertEquals(extractBearerToken('Basic x'), null);
});

Deno.test('gateEdgeRequestJwt denies missing bearer when enabled', async () => {
  const denied = await gateEdgeRequestJwt(
    new Request('http://local/functions/v1/dm-tools/dice', { method: 'POST' }),
    envMap({ VERIFY_JWT: 'true', JWT_SECRET: 'test-secret' }),
  );
  assertExists(denied);
  assertEquals(denied.status, 401);
});

Deno.test('gateEdgeRequestJwt allows OPTIONS', async () => {
  const allowed = await gateEdgeRequestJwt(
    new Request('http://local/functions/v1/dm-tools/dice', { method: 'OPTIONS' }),
    envMap({ VERIFY_JWT: 'true', JWT_SECRET: 'test-secret' }),
  );
  assertEquals(allowed, null);
});

Deno.test('gateEdgeRequestJwt accepts valid HS256', async () => {
  const secret = 'test-secret';
  const token = await mintHs256(secret, {
    role: 'anon',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const allowed = await gateEdgeRequestJwt(
    new Request('http://local/functions/v1/dm-tools/dice', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
    envMap({ VERIFY_JWT: 'true', JWT_SECRET: secret }),
  );
  assertEquals(allowed, null);
});

Deno.test('gateEdgeRequestJwt denies invalid signature', async () => {
  const token = await mintHs256('other-secret', {
    role: 'anon',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const denied = await gateEdgeRequestJwt(
    new Request('http://local/functions/v1/dm-tools/dice', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
    envMap({ VERIFY_JWT: 'true', JWT_SECRET: 'test-secret' }),
  );
  assertExists(denied);
  assertEquals(denied.status, 401);
});

/**
 * Offline tests for AI provider crypto + Meshy validate helpers.
 * Location: supabase/functions/_shared/ai-provider-credentials_test.ts
 */
import {
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  buildKeyHint,
  decryptProviderSecret,
  encryptProviderSecret,
  parseCredentialsEncryptionKey,
} from './ai-provider-crypto.ts';
import { looksLikeMeshyApiKey, validateMeshyApiKey } from './ai-provider-meshy.ts';
import { getProviderDefinition, listProvidersForModality } from './ai-provider-registry.ts';
import { hostAiProviderKeysAllowed, resolveHostMeshyApiKey } from './ai-provider-resolve-meshy.ts';

Deno.test('parseCredentialsEncryptionKey accepts hex32', () => {
  const hex = 'a'.repeat(64);
  const key = parseCredentialsEncryptionKey(hex);
  assertEquals(key?.byteLength, 32);
});

Deno.test('encrypt/decrypt roundtrip', async () => {
  const key = parseCredentialsEncryptionKey('b'.repeat(64));
  if (!key) throw new Error('expected key');
  const cipher = await encryptProviderSecret('msy_test_secret_value_12345', key);
  assertEquals(cipher.startsWith('v1.'), true);
  const plain = await decryptProviderSecret(cipher, key);
  assertEquals(plain, 'msy_test_secret_value_12345');
});

Deno.test('decrypt rejects bad format', async () => {
  const key = parseCredentialsEncryptionKey('c'.repeat(64));
  if (!key) throw new Error('expected key');
  await assertRejects(() => decryptProviderSecret('not-valid', key));
});

Deno.test('buildKeyHint masks secret', () => {
  assertEquals(buildKeyHint('msy_abcdefghij'), '••••ghij');
});

Deno.test('meshy key shape', () => {
  assertEquals(looksLikeMeshyApiKey('msy_' + 'x'.repeat(20)), true);
  assertEquals(looksLikeMeshyApiKey('sk-openai'), false);
});

Deno.test('validateMeshyApiKey success via mock fetch', async () => {
  const result = await validateMeshyApiKey('msy_' + 'x'.repeat(20), {
    fetchImpl: async () =>
      new Response(JSON.stringify({ balance: 42.7 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  });
  assertEquals(result.ok, true);
  if (result.ok) assertEquals(result.credits, 43);
});

Deno.test('validateMeshyApiKey rejects 401', async () => {
  const result = await validateMeshyApiKey('msy_' + 'x'.repeat(20), {
    fetchImpl: async () => new Response('nope', { status: 401 }),
  });
  assertEquals(result.ok, false);
});

Deno.test('registry meshy on image and 3d', () => {
  assertEquals(listProvidersForModality('image').some((p) => p.id === 'meshy'), true);
  assertEquals(listProvidersForModality('3d').some((p) => p.id === 'meshy'), true);
  assertEquals(listProvidersForModality('video').length, 0);
  assertEquals(getProviderDefinition('meshy')?.displayName, 'Meshy');
});

Deno.test('host keys fail-closed without allow flag', () => {
  const env = {
    get(key: string): string | undefined {
      if (key === 'MESHY_API_KEY') return 'msy_host';
      return undefined;
    },
  };
  assertEquals(hostAiProviderKeysAllowed(env), false);
  assertEquals(resolveHostMeshyApiKey(env), null);

  const allowed = {
    get(key: string): string | undefined {
      if (key === 'AI_PROVIDER_ALLOW_HOST_KEYS') return '1';
      if (key === 'MESHY_API_KEY') return 'msy_host';
      return undefined;
    },
  };
  assertEquals(hostAiProviderKeysAllowed(allowed), true);
  assertEquals(resolveHostMeshyApiKey(allowed), 'msy_host');
});

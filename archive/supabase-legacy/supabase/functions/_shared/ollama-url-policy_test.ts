/**
 * Offline tests for Ollama URL SSRF policy + tags URL helpers.
 * Location: supabase/functions/_shared/ollama-url-policy_test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  assertSafeOllamaBaseUrl,
  OLLAMA_CLOUD_OPENAI_BASE,
  OLLAMA_CLOUD_TAGS_URL,
  resolveTagsUrl,
  toOllamaNativeBase,
} from './ollama-url-policy.ts';
import { prefsToProviderConfig } from './ollama-llm-resolve.ts';

Deno.test('allows ollama.com/v1 cloud base', () => {
  const result = assertSafeOllamaBaseUrl(OLLAMA_CLOUD_OPENAI_BASE);
  assertEquals(result.ok, true);
  if (result.ok) assertEquals(result.baseUrl, OLLAMA_CLOUD_OPENAI_BASE);
});

Deno.test('allows docker service host http', () => {
  const result = assertSafeOllamaBaseUrl('http://ollama:11434');
  assertEquals(result.ok, true);
});

Deno.test('blocks metadata IP', () => {
  const result = assertSafeOllamaBaseUrl('http://169.254.169.254/latest');
  assertEquals(result.ok, false);
});

Deno.test('blocks http to public host', () => {
  const result = assertSafeOllamaBaseUrl('http://example.com/v1');
  assertEquals(result.ok, false);
});

Deno.test('allows https public host', () => {
  const result = assertSafeOllamaBaseUrl('https://example.com/v1');
  assertEquals(result.ok, true);
});

Deno.test('strips /v1 for native tags', () => {
  assertEquals(toOllamaNativeBase('http://ollama:11434/v1'), 'http://ollama:11434');
  assertEquals(resolveTagsUrl(true, OLLAMA_CLOUD_OPENAI_BASE), OLLAMA_CLOUD_TAGS_URL);
  assertEquals(
    resolveTagsUrl(false, 'http://ollama:11434'),
    'http://ollama:11434/api/tags',
  );
});

Deno.test('prefsToProviderConfig maps cloud to openai-compatible', () => {
  const cfg = prefsToProviderConfig({
    useCloud: true,
    baseUrl: OLLAMA_CLOUD_OPENAI_BASE,
    model: 'gemma4:31b',
    apiKey: 'test-key',
  });
  assertEquals(cfg?.provider, 'openai-compatible');
  assertEquals(cfg?.baseUrl, OLLAMA_CLOUD_OPENAI_BASE);
  assertEquals(cfg?.apiKey, 'test-key');
});

Deno.test('prefsToProviderConfig maps local to ollama native', () => {
  const cfg = prefsToProviderConfig({
    useCloud: false,
    baseUrl: 'http://ollama:11434/v1',
    model: 'llama3.2',
    apiKey: '',
  });
  assertEquals(cfg?.provider, 'ollama');
  assertEquals(cfg?.baseUrl, 'http://ollama:11434');
});

Deno.test('cloud without key fails', () => {
  const cfg = prefsToProviderConfig({
    useCloud: true,
    baseUrl: OLLAMA_CLOUD_OPENAI_BASE,
    model: 'gemma4:31b',
    apiKey: '',
  });
  assertEquals(cfg, null);
});

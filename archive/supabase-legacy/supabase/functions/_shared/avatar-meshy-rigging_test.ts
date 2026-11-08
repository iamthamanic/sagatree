/**
 * Offline unit tests for avatar Meshy auto-rig helpers.
 * Location: supabase/functions/_shared/avatar-meshy-rigging_test.ts
 */
import {
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  createLiveMeshyRiggingProvider,
  createMockMeshyRiggingProvider,
  normalizeMeshyRiggingBaseUrl,
  parseMeshyRiggingTask,
} from './avatar-meshy-rigging.ts';

Deno.test('normalizeMeshyRiggingBaseUrl maps v2 → v1', () => {
  assertEquals(
    normalizeMeshyRiggingBaseUrl('https://api.meshy.ai/openapi/v2'),
    'https://api.meshy.ai/openapi/v1',
  );
  assertEquals(normalizeMeshyRiggingBaseUrl(''), 'https://api.meshy.ai/openapi/v1');
});

Deno.test('parseMeshyRiggingTask reads nested rigged GLB', () => {
  const task = parseMeshyRiggingTask({
    id: 'rig-1',
    status: 'SUCCEEDED',
    progress: 100,
    result: {
      rigged_character_glb_url: 'https://assets.meshy.ai/rigged.glb',
    },
  });
  assertEquals(task.riggedGlbUrl, 'https://assets.meshy.ai/rigged.glb');
});

Deno.test('mock rigging provider create + succeed', async () => {
  const provider = createMockMeshyRiggingProvider();
  const created = await provider.createTask({ inputTaskId: 'mesh-1' });
  assertEquals(created.taskId, 'mock-meshy-rig-task');
  const task = await provider.getTask(created.taskId);
  assertEquals(task.status, 'SUCCEEDED');
  assertEquals(task.riggedGlbUrl?.startsWith('https://assets.meshy.ai/'), true);
});

Deno.test('live rigging provider posts input_task_id and parses result', async () => {
  const calls: { url: string; body?: string }[] = [];
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const rawBody = init && 'body' in init ? init.body : undefined;
    calls.push({ url, body: typeof rawBody === 'string' ? rawBody : undefined });
    if (init && 'method' in init && init.method === 'POST' && url.endsWith('/rigging')) {
      return Promise.resolve(
        new Response(JSON.stringify({ result: 'rig-99' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: 'rig-99',
          status: 'SUCCEEDED',
          progress: 100,
          result: { rigged_character_glb_url: 'https://assets.meshy.ai/r.glb' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }) as typeof fetch;
  const provider = createLiveMeshyRiggingProvider(
    { apiKey: 'k', baseUrl: 'https://api.meshy.ai/openapi/v2' },
    fetchImpl,
  );
  const created = await provider.createTask({ inputTaskId: 'mesh-1', heightMeters: 1.8 });
  assertEquals(created.taskId, 'rig-99');
  assertEquals(calls[0]?.url, 'https://api.meshy.ai/openapi/v1/rigging');
  assertEquals(calls[0]?.body?.includes('"input_task_id":"mesh-1"'), true);
  const task = await provider.getTask('rig-99');
  assertEquals(task.riggedGlbUrl, 'https://assets.meshy.ai/r.glb');
});

Deno.test('mock rigging fails closed without input', async () => {
  const provider = createMockMeshyRiggingProvider();
  await assertRejects(() => provider.createTask({}));
});

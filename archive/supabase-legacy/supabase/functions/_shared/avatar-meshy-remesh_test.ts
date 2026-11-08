/**
 * Offline unit tests for avatar Meshy remesh + GLB budget helpers.
 * Location: supabase/functions/_shared/avatar-meshy-remesh_test.ts
 */
import {
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  AVATAR_MESHY_REMESH_TARGET_POLYCOUNT,
  createMockMeshyRemeshProvider,
  createLiveMeshyRemeshProvider,
  normalizeMeshyRemeshBaseUrl,
} from './avatar-meshy-remesh.ts';
import {
  AVATAR_MESHY_GLB_MAX_BYTES,
  AVATAR_MESHY_GLB_SOFT_BYTES,
  AVATAR_MESHY_GLB_STORE_MAX_BYTES,
  probeMeshyGlbContentLength,
} from './item-model3d-glb.ts';

Deno.test('avatar GLB budgets: soft < store < hard download', () => {
  assertEquals(AVATAR_MESHY_GLB_SOFT_BYTES, 80 * 1024 * 1024);
  assertEquals(AVATAR_MESHY_GLB_STORE_MAX_BYTES, 150 * 1024 * 1024);
  assertEquals(AVATAR_MESHY_GLB_MAX_BYTES, 200 * 1024 * 1024);
  assertEquals(AVATAR_MESHY_GLB_SOFT_BYTES < AVATAR_MESHY_GLB_STORE_MAX_BYTES, true);
  assertEquals(AVATAR_MESHY_GLB_STORE_MAX_BYTES < AVATAR_MESHY_GLB_MAX_BYTES, true);
});

Deno.test('normalizeMeshyRemeshBaseUrl forces openapi v1', () => {
  assertEquals(
    normalizeMeshyRemeshBaseUrl('https://api.meshy.ai/openapi/v2'),
    'https://api.meshy.ai/openapi/v1',
  );
  assertEquals(
    normalizeMeshyRemeshBaseUrl('https://api.meshy.ai/openapi/v1/'),
    'https://api.meshy.ai/openapi/v1',
  );
  assertEquals(normalizeMeshyRemeshBaseUrl(''), 'https://api.meshy.ai/openapi/v1');
});

Deno.test('mock remesh provider create + succeed without network', async () => {
  const provider = createMockMeshyRemeshProvider();
  const created = await provider.createTask({
    inputTaskId: 'src-task',
    targetPolycount: AVATAR_MESHY_REMESH_TARGET_POLYCOUNT,
  });
  assertEquals(created.taskId, 'mock-meshy-remesh-task');
  const task = await provider.getTask(created.taskId);
  assertEquals(task.status, 'SUCCEEDED');
  assertEquals(task.model_urls?.glb?.startsWith('https://assets.meshy.ai/'), true);
});

Deno.test('live remesh provider posts target_polycount and parses result', async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const rawBody = init && 'body' in init ? init.body : undefined;
    const body = rawBody != null ? JSON.parse(String(rawBody)) : null;
    calls.push({ url, body });
    if (init && 'method' in init && init.method === 'POST') {
      return Promise.resolve(
        new Response(JSON.stringify({ result: 'remesh-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: 'remesh-1',
          status: 'SUCCEEDED',
          progress: 100,
          model_urls: { glb: 'https://assets.meshy.ai/remesh.glb' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }) as typeof fetch;
  const provider = createLiveMeshyRemeshProvider(
    { apiKey: 'k', baseUrl: 'https://api.meshy.ai/openapi/v2' },
    fetchImpl,
  );
  const created = await provider.createTask({
    inputTaskId: 'text-task-9',
    targetPolycount: 50_000,
  });
  assertEquals(created.taskId, 'remesh-1');
  assertEquals(calls[0]?.url, 'https://api.meshy.ai/openapi/v1/remesh');
  assertEquals((calls[0]?.body as { input_task_id: string }).input_task_id, 'text-task-9');
  assertEquals((calls[0]?.body as { target_polycount: number }).target_polycount, 50_000);
  const task = await provider.getTask('remesh-1');
  assertEquals(task.status, 'SUCCEEDED');
  assertEquals(task.model_urls?.glb, 'https://assets.meshy.ai/remesh.glb');
});

Deno.test('probeMeshyGlbContentLength reads Content-Length via HEAD', async () => {
  const fetchImpl: typeof fetch = () =>
    Promise.resolve(
      new Response(null, {
        status: 200,
        headers: { 'Content-Length': String(90 * 1024 * 1024) },
      }),
    );
  const len = await probeMeshyGlbContentLength(
    'https://assets.meshy.ai/tasks/x/model.glb',
    fetchImpl,
  );
  assertEquals(len, 90 * 1024 * 1024);
});

Deno.test('probeMeshyGlbContentLength rejects non-allowlisted hosts', async () => {
  const len = await probeMeshyGlbContentLength('https://evil.example/x.glb');
  assertEquals(len, null);
});

Deno.test('mock remesh provider can fail closed', async () => {
  const provider = createMockMeshyRemeshProvider({ fail: true });
  await assertRejects(() => provider.createTask({
    inputTaskId: 'x',
    targetPolycount: 1000,
  }));
});

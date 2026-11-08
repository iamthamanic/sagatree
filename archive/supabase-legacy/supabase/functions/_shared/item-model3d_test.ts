/**
 * Offline unit tests for item-model3d shared modules (#141).
 * Location: supabase/functions/_shared/item-model3d_test.ts
 */
import {
  assertEquals,
  assertRejects,
  assertThrows,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  buildItemModel3dAssetKey,
  buildItemModel3dStoragePath,
  downloadMeshyGlbBytes,
  sniffItemModel3dGlb,
  validateGlbBytes,
} from './item-model3d-glb.ts';
import {
  createMockMeshyImageTo3dProvider,
  mapMeshyImageTo3dStatusToJob,
  resolveMeshyImageTo3dConfig,
} from './item-model3d-meshy.ts';

function minimalGlb(): Uint8Array {
  // "glTF" magic + padding
  return new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0, 1, 2, 3]);
}

Deno.test('sniff GLB magic bytes', () => {
  assertEquals(sniffItemModel3dGlb(minimalGlb()), true);
  assertEquals(sniffItemModel3dGlb(new Uint8Array([1, 2, 3, 4])), false);
  assertEquals(sniffItemModel3dGlb(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), false);
});

Deno.test('validateGlbBytes rejects non-GLB and oversized claims', () => {
  assertThrows(() => validateGlbBytes(new Uint8Array([1, 2, 3])));
  const ok = validateGlbBytes(minimalGlb(), 'model/gltf-binary');
  assertEquals(ok.mime, 'model/gltf-binary');
  assertThrows(() => validateGlbBytes(minimalGlb(), 'image/png'));
});

Deno.test('storage path is owner/world scoped with random asset id', () => {
  const personal = buildItemModel3dStoragePath({
    ownerUserId: 'user-1',
    definitionId: 'personal:abc',
    assetId: 'asset-1',
  });
  assertEquals(personal, 'user-1/personal:abc/asset-1.glb');

  const world = buildItemModel3dStoragePath({
    ownerUserId: 'user-1',
    definitionId: 'world:xyz',
    worldProfileId: 'world-9',
    assetId: 'asset-2',
  });
  assertEquals(world, 'user-1/world/world-9/world:xyz/asset-2.glb');
  assertEquals(buildItemModel3dAssetKey('asset-2'), 'model3d:asset-2');
});

Deno.test('downloadMeshyGlbBytes rejects non-allowlisted hosts', async () => {
  await assertRejects(
    () => downloadMeshyGlbBytes('https://evil.example/x.glb'),
    Error,
    'allowlisted',
  );
});

Deno.test('downloadMeshyGlbBytes accepts meshy host with valid GLB', async () => {
  const glb = minimalGlb();
  const body = new ArrayBuffer(glb.byteLength);
  new Uint8Array(body).set(glb);
  const fetchImpl: typeof fetch = (_input, _init) =>
    Promise.resolve(
      new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'model/gltf-binary',
          'Content-Length': String(glb.length),
        },
      }),
    );
  const result = await downloadMeshyGlbBytes(
    'https://assets.meshy.ai/tasks/abc/output.glb',
    fetchImpl,
  );
  assertEquals(result.mime, 'model/gltf-binary');
  assertEquals(result.bytes.length, glb.length);
});

Deno.test('downloadMeshyGlbBytes aborts when streamed body exceeds maxBytes', async () => {
  const chunk = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0, 1, 2, 3, 4, 5]);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.close();
    },
  });
  const fetchImpl: typeof fetch = () =>
    Promise.resolve(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'model/gltf-binary' },
      }),
    );
  await assertRejects(
    () =>
      downloadMeshyGlbBytes('https://assets.meshy.ai/big.glb', fetchImpl, {
        maxBytes: 12,
      }),
    Error,
    'size limit',
  );
});

Deno.test('mock Meshy Image-to-3D provider progresses without network', async () => {
  const provider = createMockMeshyImageTo3dProvider();
  const created = await provider.createTask({
    kind: 'image_url',
    imageUrl: 'data:image/png;base64,aaa',
  });
  const first = await provider.getTask(created.taskId);
  assertEquals(first.status, 'IN_PROGRESS');
  const second = await provider.getTask(created.taskId);
  assertEquals(second.status, 'SUCCEEDED');
  assertEquals(second.model_urls?.glb?.startsWith('https://assets.meshy.ai/'), true);
});

Deno.test('mapMeshyImageTo3dStatusToJob covers pending and failed', () => {
  assertEquals(mapMeshyImageTo3dStatusToJob('PENDING').status, 'waiting');
  assertEquals(mapMeshyImageTo3dStatusToJob('FAILED').status, 'failed');
});

Deno.test('resolveMeshyImageTo3dConfig fails closed without key', () => {
  const emptyEnv = { get: (_key: string) => undefined };
  assertEquals(resolveMeshyImageTo3dConfig(emptyEnv), null);
  const withKey = {
    get: (key: string) => (key === 'MESHY_API_KEY' ? 'test-key' : undefined),
  };
  const config = resolveMeshyImageTo3dConfig(withKey);
  assertEquals(config?.apiKey, 'test-key');
  assertEquals(config?.model, 'latest');
});

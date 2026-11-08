/**
 * Offline unit tests for item-thumbnail shared modules (#140).
 * Location: supabase/functions/_shared/item-thumbnail_test.ts
 */
import {
  assertEquals,
  assertRejects,
  assertThrows,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  buildItemThumbnailPrompt,
  assertSafeUserExtra,
} from './item-thumbnail-prompt.ts';
import {
  buildItemThumbnailAssetKey,
  buildItemThumbnailStoragePath,
  sniffItemThumbnailMime,
  validateThumbnailBytes,
  downloadMeshyImageBytes,
} from './item-thumbnail-image.ts';
import {
  createMockMeshyProvider,
  mapMeshyStatusToJob,
  resolveMeshyProviderConfig,
} from './item-thumbnail-meshy.ts';

Deno.test('buildItemThumbnailPrompt includes art direction and truncates', () => {
  const prompt = buildItemThumbnailPrompt({
    name: 'Kurzschwert',
    description: 'Ein scharfes Klingenstück für Nahkampf.',
    setting: 'fantasy',
    kindKey: 'weapon',
    userExtra: 'silberner Griff',
  });
  assertEquals(prompt.includes('Kurzschwert'), true);
  assertEquals(prompt.includes('inventory item illustration'), true);
  assertEquals(prompt.includes('no watermarks'), true);
  assertEquals(prompt.length <= 600, true);
});

Deno.test('assertSafeUserExtra rejects non-strings', () => {
  assertThrows(() => assertSafeUserExtra(12));
  assertEquals(assertSafeUserExtra('  ok  '), 'ok');
});

Deno.test('sniff PNG, JPEG and WebP magic bytes', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2]);
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0, 1,
  ]);
  assertEquals(sniffItemThumbnailMime(png), 'image/png');
  assertEquals(sniffItemThumbnailMime(jpeg), 'image/jpeg');
  assertEquals(sniffItemThumbnailMime(webp), 'image/webp');
  assertEquals(sniffItemThumbnailMime(new Uint8Array([1, 2, 3])), null);
});

Deno.test('validateThumbnailBytes rejects mismatched mime', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1]);
  assertThrows(() => validateThumbnailBytes(png, 'image/jpeg'));
  assertThrows(() => validateThumbnailBytes(png, 'image/webp'));
  const ok = validateThumbnailBytes(png, 'image/png');
  assertEquals(ok.mime, 'image/png');
  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0, 1,
  ]);
  const webpOk = validateThumbnailBytes(webp, 'image/webp');
  assertEquals(webpOk.mime, 'image/webp');
});

Deno.test('storage path is owner/world scoped with random asset id', () => {
  const personal = buildItemThumbnailStoragePath({
    ownerUserId: 'user-1',
    definitionId: 'personal:abc',
    assetId: 'asset-1',
    mime: 'image/png',
  });
  assertEquals(personal, 'user-1/personal:abc/asset-1.png');

  const world = buildItemThumbnailStoragePath({
    ownerUserId: 'user-1',
    definitionId: 'world:xyz',
    worldProfileId: 'world-9',
    assetId: 'asset-2',
    mime: 'image/jpeg',
  });
  assertEquals(world, 'user-1/world/world-9/world:xyz/asset-2.jpg');
  const webpPath = buildItemThumbnailStoragePath({
    ownerUserId: 'user-1',
    definitionId: 'personal:abc',
    assetId: 'asset-3',
    mime: 'image/webp',
  });
  assertEquals(webpPath, 'user-1/personal:abc/asset-3.webp');
  assertEquals(buildItemThumbnailAssetKey('asset-2'), 'thumbnail2d:asset-2');
});

Deno.test('downloadMeshyImageBytes rejects non-allowlisted hosts', async () => {
  await assertRejects(
    () => downloadMeshyImageBytes('https://evil.example/x.png'),
    Error,
    'allowlisted',
  );
});

Deno.test('downloadMeshyImageBytes accepts meshy host with valid PNG', async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2]);
  const fetchImpl = (_input: string | URL | Request) =>
    Promise.resolve(
      new Response(png, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Content-Length': String(png.length) },
      }),
    );
  const result = await downloadMeshyImageBytes(
    'https://assets.meshy.ai/tasks/abc/output.png',
    fetchImpl as typeof fetch,
  );
  assertEquals(result.mime, 'image/png');
  assertEquals(result.bytes.length, png.length);
});

Deno.test('mock Meshy provider progresses to succeeded without network', async () => {
  const provider = createMockMeshyProvider();
  const created = await provider.createTask('test prompt');
  const first = await provider.getTask(created.taskId);
  assertEquals(first.status, 'IN_PROGRESS');
  const second = await provider.getTask(created.taskId);
  assertEquals(second.status, 'SUCCEEDED');
  assertEquals(second.image_urls?.[0]?.startsWith('https://assets.meshy.ai/'), true);
});

Deno.test('mapMeshyStatusToJob covers pending and failed', () => {
  assertEquals(mapMeshyStatusToJob('PENDING').status, 'waiting');
  assertEquals(mapMeshyStatusToJob('FAILED').status, 'failed');
});

Deno.test('resolveMeshyProviderConfig fails closed without key', () => {
  const emptyEnv = { get: (_key: string) => undefined };
  assertEquals(resolveMeshyProviderConfig(emptyEnv), null);
  const withKey = {
    get: (key: string) => (key === 'MESHY_API_KEY' ? 'test-key' : undefined),
  };
  const config = resolveMeshyProviderConfig(withKey);
  assertEquals(config?.apiKey, 'test-key');
  assertEquals(config?.model, 'nano-banana');
});

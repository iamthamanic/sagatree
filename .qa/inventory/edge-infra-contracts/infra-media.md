# Infrastructure contract: media

**Status: SPEC; current branch source verified.** Implementation issue: **#805**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-media.json](source-contracts/infra-media.json) (SHA-256 `334043c5e667576e582ed4de89767d4424d923f8889164ca2800c346b7eed2d0`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Browser media optimizer dispatches image/audio/video/model3d engines, lazy worker messaging and budgets; current infrastructure/media has no Supabase RPC, table, Edge or realtime calls.

No host data dependency should be invented. Preserve memory/byte budgets, MIME decoding and worker cancellation/error behavior.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (0): none.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 0.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|


## Acceptance and negative tests (required, not executed)

- Optimize image to target WebP budget with valid dimensions; cancel/reject oversized/unsupported input deterministically.
- Audio/video/model3d capability/degraded contracts remain explicit; no new remote service required for current local optimizer.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

This area has no RPC, Edge, table, storage, realtime, fetch or auth calls. Its public browser processing/worker API is retained in the complete public declarations.

## Complete public declarations and facade operation contracts

### src/infrastructure/media/optimizer/engines/audio/index.ts:14

```ts
export type AudioEngineRequest = {
  readonly input: MediaOptimizeInputMeta;
  readonly signal?: AbortSignal;
};
```

### src/infrastructure/media/optimizer/engines/audio/index.ts:19

```ts
export async function optimizeAudio(
  request: AudioEngineRequest,
): Promise<MediaOptimizeResult> {
  if (request.signal?.aborted) {
    return {
      status: 'aborted',
      kind: 'audio',
      profileId: request.input.profileId,
      input: { ...request.input, kind: 'audio' },
      code: 'aborted',
      message: 'Audio-Optimierung abgebrochen.',
    };
  }

  return {
    status: 'unsupported',
    kind: 'audio',
    profileId: request.input.profileId,
    input: { ...request.input, kind: 'audio' },
    code: 'unsupported-kind',
    message:
      'Audio-Transcoding ist in V1 nicht verfügbar (Ausbau-TODO: geprüfte Codec-Pipeline).',
  };
}
```

### src/infrastructure/media/optimizer/engines/image/image.worker.ts:9

```ts
export type ImageWorkerEncodeRequest = {
  readonly type: 'encode';
  readonly requestId: string;
  readonly width: number;
  readonly height: number;
  /** RGBA pixel buffer (transferred). */
  readonly rgba: ArrayBuffer;
  readonly targetBytes: number;
  readonly maxUploadBytes: number;
  readonly maxOutputBytes: number;
  readonly minQuality: number;
  readonly minEdgePx?: number;
};
```

### src/infrastructure/media/optimizer/engines/image/image.worker.ts:23

```ts
export type ImageWorkerResponse =
  | {
      readonly type: 'result';
      readonly requestId: string;
      readonly ok: true;
      readonly buffer: ArrayBuffer;
      readonly width: number;
      readonly height: number;
    }
  | {
      readonly type: 'result';
      readonly requestId: string;
      readonly ok: false;
      readonly reason: 'over-budget' | 'encode-failed' | 'aborted';
      readonly message: string;
      readonly attemptedByteSize?: number;
    };
```

### src/infrastructure/media/optimizer/engines/image/index.ts:35

```ts
export async function optimizeImage(
  request: ImageEngineRequest,
): Promise<MediaOptimizeResult> {
  return runOptimizeImage(request);
}
```

### src/infrastructure/media/optimizer/engines/image/optimize-image.ts:47

```ts
export async function runOptimizeImage(
  request: ImageEngineRequest,
): Promise<MediaOptimizeResult> {
  const input = { ...request.input, kind: 'image' as const };

  if (request.signal?.aborted) {
    return abortedResult(request);
  }

  if (!request.bytes) {
    return {
      status: 'failed',
      kind: 'image',
      profileId: input.profileId,
      input,
      code: 'invalid-input',
      message: 'Bildbytes fehlen für die Image-Engine.',
    };
  }

  const inputLimit = assertImageInputByteLimit(input.byteSize);
  if (inputLimit.ok === false) {
    if (inputLimit.code === 'over-max-upload') {
      return {
        status: 'over-budget',
        kind: 'image',
        profileId: input.profileId,
        input,
        code: 'over-max-upload',
        message: inputLimit.message,
        attemptedByteSize: input.byteSize,
      };
    }
    return {
      status: 'failed',
      kind: 'image',
      profileId: input.profileId,
      input,
      code: 'invalid-input',
      message: inputLimit.message,
    };
  }

  const policyEval = evaluateImageAgainstPolicy(input, {
    imageCountInRequest: request.imageCountInRequest,
    aggregateRequestBytes: request.aggregateRequestBytes,
  });
  if (policyEval.ok === false) {
    if (
      policyEval.reason === 'over-max-upload' ||
      policyEval.reason === 'over-aggregate-budget'
    ) {
      return {
        status: 'over-budget',
        kind: 'image',
        profileId: input.profileId,
        input,
        code: policyEval.reason,
        message: policyEval.message,
        attemptedByteSize: input.byteSize,
      };
    }
    return {
      status: 'unsupported',
      kind: 'image',
      profileId: input.profileId,
      input,
      code: 'unsupported-mime',
      message: policyEval.message,
    };
  }

  const policy = policyEval.policy;
  const mime = normalizeImageMime(input.mimeType);

  // Animated GIF keep is only valid when policy allows animation without convert.
  if (mime === 'image/gif' && input.hasAnimation === true && policy.gifAnimation === 'allow') {
    if (input.byteSize <= policy.budget.maxUploadBytes) {
      return {
        status: 'unchanged',
        kind: 'image',
        profileId: input.profileId,
        input,
        outputMimeType: input.mimeType,
        outputByteSize: input.byteSize,
      };
    }
  }

  // Small valid originals: unchanged (no Dateiwachstum / no unnecessary encode).
  const needsGifConvert =
    mime === 'image/gif' && policy.gifAnimation === 'convert-static-required';
  const withinTarget = input.byteSize <= policy.budget.targetBytes;
  if (!needsGifConvert && withinTarget && input.byteSize <= policy.budget.maxUploadBytes) {
    return {
      status: 'unchanged',
      kind: 'image',
      profileId: input.profileId,
      input,
      outputMimeType: input.mimeType,
      outputByteSize: input.byteSize,
    };
  }

  if (!policy.allowWebpOutput) {
    if (input.byteSize <= policy.budget.maxUploadBytes) {
      return {
        status: 'unchanged',
        kind: 'image',
        profileId: input.profileId,
        input,
        outputMimeType: input.mimeType,
        outputByteSize: input.byteSize,
      };
    }
    return {
      status: 'over-budget',
      kind: 'image',
      profileId: input.profileId,
      input,
      code: 'over-max-upload',
      message:
        'Item-Thumbnail überschreitet maxUploadBytes; WebP-Ausgabe ist für dieses Profil noch nicht freigeschaltet.',
      attemptedByteSize: input.byteSize,
    };
  }

  if (request.signal?.aborted) {
    return abortedResult(request);
  }

  let imageData: ImageData;
  try {
    const blob = toBlob(request.bytes, mime);
    // Downscale into policy maxEdge + engine pixel ceiling during decode —
    // large phone photos must not hard-fail before WebP budget encode.
    imageData = await blobToImageDataFittingLimits(blob, {
      maxEdgePx: policy.maxEdgePx,
      maxPixels: IMAGE_ENGINE_MAX_PIXELS,
    });
  } catch (error) {
    return {
      status: 'failed',
      kind: 'image',
      profileId: input.profileId,
      input,
      code: 'encode-failed',
      message: `Raster-Decode fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const pixelLimit = assertImagePixelLimit(imageData.width, imageData.height);
  if (pixelLimit.ok === false) {
    // Should be unreachable after fitting decode; keep fail-closed.
    if (pixelLimit.code === 'over-max-upload') {
      return {
        status: 'over-budget',
        kind: 'image',
        profileId: input.profileId,
        input,
        code: 'over-max-upload',
        message: pixelLimit.message,
        attemptedByteSize: input.byteSize,
      };
    }
    return {
      status: 'failed',
      kind: 'image',
      profileId: input.profileId,
      input,
      code: 'invalid-input',
      message: pixelLimit.message,
    };
  }

  const budgeted = await encodeWebpWithWorkerFallback({
    imageData,
    targetBytes: policy.budget.targetBytes,
    maxUploadBytes: policy.budget.maxUploadBytes,
    maxOutputBytes: input.byteSize,
    minQuality: policy.minQuality,
    signal: request.signal,
  });

  if (budgeted.ok === false) {
    if (budgeted.reason === 'aborted') {
      return abortedResult(request);
    }
    if (budgeted.reason === 'over-budget') {
      return {
        status: 'over-budget',
        kind: 'image',
        profileId: input.profileId,
        input,
        code: 'over-max-upload',
        message: budgeted.message,
        attemptedByteSize: budgeted.attemptedByteSize,
      };
    }
    return {
      status: 'failed',
      kind: 'image',
      profileId: input.profileId,
      input,
      code: 'encode-failed',
      message: budgeted.message,
    };
  }

  // Guard: never claim optimized if we grew the file
  if (budgeted.buffer.byteLength > input.byteSize) {
    return {
      status: 'failed',
      kind: 'image',
      profileId: input.profileId,
      input,
      code: 'encode-failed',
      message: 'WebP-Ausgabe wäre größer als das Original — abgelehnt.',
    };
  }

  const outputBytes = new Uint8Array(budgeted.buffer);
  if (request.onOptimizedBytes) {
    request.onOptimizedBytes(outputBytes);
  }

  return {
    status: 'optimized',
    kind: 'image',
    profileId: input.profileId,
    input,
    outputMimeType: 'image/webp',
    outputByteSize: budgeted.buffer.byteLength,
    width: budgeted.width,
    height: budgeted.height,
  };
}
```

### src/infrastructure/media/optimizer/engines/image/raster-decode.ts:16

```ts
export async function blobToImageData(blob: Blob): Promise<ImageData> {
  return blobToImageDataFittingLimits(blob, {
    maxEdgePx: MAX_DIMENSION,
    maxPixels: IMAGE_ENGINE_MAX_PIXELS,
  });
}
```

### src/infrastructure/media/optimizer/engines/image/raster-decode.ts:27

```ts
export async function blobToImageDataFittingLimits(
  blob: Blob,
  limits: { readonly maxEdgePx: number; readonly maxPixels: number },
): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  try {
    const w = bitmap.width;
    const h = bitmap.height;
    if (w < 1 || h < 1) {
      throw new Error(`Bildabmessungen nicht unterstützt (${w}×${h})`);
    }
    // Cap policy edge by absolute engine edge; oversize edges scale down instead of reject.
    const effectiveMaxEdge = Math.min(
      limits.maxEdgePx > 0 ? limits.maxEdgePx : MAX_DIMENSION,
      MAX_DIMENSION,
    );
    const scale = computeImageDownscaleFactor(w, h, effectiveMaxEdge, limits.maxPixels);
    const tw = Math.max(1, Math.floor(w * scale));
    const th = Math.max(1, Math.floor(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Canvas 2D nicht verfügbar');
    }
    ctx.drawImage(bitmap, 0, 0, tw, th);
    return ctx.getImageData(0, 0, tw, th);
  } finally {
    bitmap.close();
  }
}
```

### src/infrastructure/media/optimizer/engines/image/raster-decode.ts:60

```ts
export async function scaleImageData(
  source: ImageData,
  targetW: number,
  targetH: number,
): Promise<ImageData> {
  const bmp = await createImageBitmap(source);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D nicht verfügbar');
    ctx.drawImage(bmp, 0, 0, targetW, targetH);
    return ctx.getImageData(0, 0, targetW, targetH);
  } finally {
    bmp.close();
  }
}
```

### src/infrastructure/media/optimizer/engines/image/resource-limits.ts:7

```ts
export const IMAGE_ENGINE_MAX_INPUT_BYTES = 40 * 1024 * 1024;
```

### src/infrastructure/media/optimizer/engines/image/resource-limits.ts:10

```ts
export const IMAGE_ENGINE_ABSOLUTE_MAX_EDGE_PX = 8192;
```

### src/infrastructure/media/optimizer/engines/image/resource-limits.ts:13

```ts
export const IMAGE_ENGINE_MAX_PIXELS = 16_777_216;
```

### src/infrastructure/media/optimizer/engines/image/resource-limits.ts:19

```ts
export function computeImageDownscaleFactor(
  width: number,
  height: number,
  maxEdgePx: number,
  maxPixels: number = IMAGE_ENGINE_MAX_PIXELS,
): number {
  if (width < 1 || height < 1) return 1;
  let scale = 1;
  const longest = Math.max(width, height);
  if (maxEdgePx > 0 && longest > maxEdgePx) {
    scale = Math.min(scale, maxEdgePx / longest);
  }
  const pixels = width * height;
  if (maxPixels > 0 && pixels * scale * scale > maxPixels) {
    scale = Math.min(scale, Math.sqrt(maxPixels / pixels));
  }
  return scale;
}
```

### src/infrastructure/media/optimizer/engines/image/resource-limits.ts:38

```ts
export type ResourceLimitFailure = {
  readonly ok: false;
  readonly code: 'invalid-input' | 'over-max-upload';
  readonly message: string;
};
```

### src/infrastructure/media/optimizer/engines/image/resource-limits.ts:44

```ts
export type ResourceLimitSuccess = { readonly ok: true };
```

### src/infrastructure/media/optimizer/engines/image/resource-limits.ts:46

```ts
export function assertImageInputByteLimit(
  byteSize: number,
): ResourceLimitSuccess | ResourceLimitFailure {
  if (byteSize <= 0) {
    return {
      ok: false,
      code: 'invalid-input',
      message: 'Bildbytes ungültig (Größe 0).',
    };
  }
  if (byteSize > IMAGE_ENGINE_MAX_INPUT_BYTES) {
    return {
      ok: false,
      code: 'over-max-upload',
      message: `Eingabe ${byteSize} Bytes überschreitet Engine-Limit ${IMAGE_ENGINE_MAX_INPUT_BYTES}.`,
    };
  }
  return { ok: true };
}
```

### src/infrastructure/media/optimizer/engines/image/resource-limits.ts:66

```ts
export function assertImagePixelLimit(
  width: number,
  height: number,
): ResourceLimitSuccess | ResourceLimitFailure {
  if (width < 1 || height < 1) {
    return {
      ok: false,
      code: 'invalid-input',
      message: `Ungültige Abmessungen (${width}×${height}).`,
    };
  }
  if (
    width > IMAGE_ENGINE_ABSOLUTE_MAX_EDGE_PX ||
    height > IMAGE_ENGINE_ABSOLUTE_MAX_EDGE_PX
  ) {
    return {
      ok: false,
      code: 'invalid-input',
      message: `Kante überschreitet ${IMAGE_ENGINE_ABSOLUTE_MAX_EDGE_PX}px (${width}×${height}).`,
    };
  }
  const pixels = width * height;
  if (pixels > IMAGE_ENGINE_MAX_PIXELS) {
    return {
      ok: false,
      code: 'over-max-upload',
      message: `Pixelanzahl ${pixels} überschreitet Limit ${IMAGE_ENGINE_MAX_PIXELS}.`,
    };
  }
  return { ok: true };
}
```

### src/infrastructure/media/optimizer/engines/image/types.ts:8

```ts
export type ImageEngineRequest = {
  readonly input: MediaOptimizeInputMeta;
  readonly signal?: AbortSignal;
  /** Raw image bytes — required for encode/decode. */
  readonly bytes?: Blob | ArrayBuffer | Uint8Array;
  readonly imageCountInRequest?: number;
  readonly aggregateRequestBytes?: number;
  /** Optional sink for optimized WebP bytes (keeps Blob out of domain results). */
  readonly onOptimizedBytes?: (bytes: Uint8Array) => void;
};
```

### src/infrastructure/media/optimizer/engines/image/webp-budget.ts:9

```ts
export type WebpEncodeOptions = {
  readonly lossless?: number;
  readonly exact?: number;
  readonly quality?: number;
  readonly method?: number;
  readonly alpha_quality?: number;
};
```

### src/infrastructure/media/optimizer/engines/image/webp-budget.ts:17

```ts
export type WebpEncodeFn = (
  data: ImageData,
  opts: WebpEncodeOptions,
) => Promise<ArrayBuffer>;
```

### src/infrastructure/media/optimizer/engines/image/webp-budget.ts:22

```ts
export type ScaleImageDataFn = (
  source: ImageData,
  targetW: number,
  targetH: number,
) => Promise<ImageData>;
```

### src/infrastructure/media/optimizer/engines/image/webp-budget.ts:28

```ts
export type WebpBudgetParams = {
  readonly imageData: ImageData;
  readonly encode: WebpEncodeFn;
  readonly scaleImageData: ScaleImageDataFn;
  /** Soft goal for the ladder (preferred encoded size). */
  readonly targetBytes: number;
  /** Hard ceiling — failure if nothing ≤ this. */
  readonly maxUploadBytes: number;
  /** Reject candidates larger than the original payload (kein Dateiwachstum). */
  readonly maxOutputBytes: number;
  readonly minQuality: number;
  readonly minEdgePx?: number;
  readonly signal?: AbortSignal;
};
```

### src/infrastructure/media/optimizer/engines/image/webp-budget.ts:43

```ts
export type WebpBudgetSuccess = {
  readonly ok: true;
  readonly buffer: ArrayBuffer;
  readonly width: number;
  readonly height: number;
};
```

### src/infrastructure/media/optimizer/engines/image/webp-budget.ts:50

```ts
export type WebpBudgetFailure = {
  readonly ok: false;
  readonly reason: 'over-budget' | 'aborted' | 'encode-failed';
  readonly message: string;
  readonly attemptedByteSize?: number;
};
```

### src/infrastructure/media/optimizer/engines/image/webp-budget.ts:57

```ts
export type WebpBudgetResult = WebpBudgetSuccess | WebpBudgetFailure;
```

### src/infrastructure/media/optimizer/engines/image/webp-budget.ts:81

```ts
export async function encodeWebpUnderBudget(
  params: WebpBudgetParams,
): Promise<WebpBudgetResult> {
  const {
    encode,
    scaleImageData,
    targetBytes,
    maxUploadBytes,
    maxOutputBytes,
    minQuality,
    signal,
  } = params;
  const minEdge = params.minEdgePx ?? 320;
  let imageData = params.imageData;
  let bestUnderMax: { buffer: ArrayBuffer; width: number; height: number } | null =
    null;

  const consider = (
    buffer: ArrayBuffer,
    width: number,
    height: number,
  ): WebpBudgetSuccess | null => {
    const size = buffer.byteLength;
    if (!isAcceptable(size, maxUploadBytes, maxOutputBytes)) {
      return null;
    }
    if (!bestUnderMax || size < bestUnderMax.buffer.byteLength) {
      bestUnderMax = { buffer, width, height };
    }
    if (size <= targetBytes) {
      return { ok: true, buffer, width, height };
    }
    return null;
  };

  try {
    throwIfAborted(signal);

    // 1) Lossless
    {
      const buffer = await encode(imageData, { lossless: 1, exact: 1 });
      const hit = consider(buffer, imageData.width, imageData.height);
      if (hit) return hit;
    }

    // 2) Lossy qualities (respect profile minQuality floor)
    const qualities = DEFAULT_QUALITIES.filter((q) => q >= minQuality);
    const ladder = qualities.length > 0 ? qualities : [minQuality];
    for (const quality of ladder) {
      throwIfAborted(signal);
      const buffer = await encode(imageData, {
        lossless: 0,
        quality,
        method: 6,
        alpha_quality: 100,
      });
      const hit = consider(buffer, imageData.width, imageData.height);
      if (hit) return hit;
    }

    // 3) Downscale + mid quality
    let w = imageData.width;
    let h = imageData.height;
    let scale = 0.9;
    while (scale > 0.35 && (w > minEdge || h > minEdge)) {
      throwIfAborted(signal);
      const nw = Math.max(1, Math.floor(w * scale));
      const nh = Math.max(1, Math.floor(h * scale));
      imageData = await scaleImageData(imageData, nw, nh);
      w = nw;
      h = nh;
      const q = Math.max(minQuality, 78);
      const buffer = await encode(imageData, {
        lossless: 0,
        quality: q,
        method: 6,
        alpha_quality: 100,
      });
      const hit = consider(buffer, w, h);
      if (hit) return hit;
      scale *= 0.88;
    }

    if (bestUnderMax) {
      return {
        ok: true,
        buffer: bestUnderMax.buffer,
        width: bestUnderMax.width,
        height: bestUnderMax.height,
      };
    }

    return {
      ok: false,
      reason: 'over-budget',
      message: `Bild konnte nicht unter ${(maxUploadBytes / (1024 * 1024)).toFixed(0)} MiB komprimiert werden.`,
      attemptedByteSize: maxOutputBytes,
    };
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.message === 'aborted')) {
      return {
        ok: false,
        reason: 'aborted',
        message: 'Bildoptimierung abgebrochen.',
      };
    }
    return {
      ok: false,
      reason: 'encode-failed',
      message: `WebP-Encoder-Fehler: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
```

### src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts:14

```ts
export type WorkerEncodeParams = {
  readonly imageData: ImageData;
  readonly targetBytes: number;
  readonly maxUploadBytes: number;
  readonly maxOutputBytes: number;
  readonly minQuality: number;
  readonly minEdgePx?: number;
  readonly signal?: AbortSignal;
};
```

### src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts:26

```ts
export function isImageWorkerSupported(): boolean {
  if (workerSupported !== null) return workerSupported;
  workerSupported =
    typeof Worker !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined';
  return workerSupported;
}
```

### src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts:63

```ts
export async function encodeWebpWithWorkerFallback(
  params: WorkerEncodeParams,
): Promise<WebpBudgetResult> {
  if (params.signal?.aborted) {
    return {
      ok: false,
      reason: 'aborted',
      message: 'Bildoptimierung abgebrochen.',
    };
  }

  if (!isImageWorkerSupported()) {
    return encodeOnMainThread(params);
  }

  return new Promise<WebpBudgetResult>((resolve) => {
    let settled = false;
    const requestId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let worker: Worker;
    try {
      worker = createImageWorker();
    } catch {
      void encodeOnMainThread(params).then(resolve);
      return;
    }

    const finish = (result: WebpBudgetResult) => {
      if (settled) return;
      settled = true;
      params.signal?.removeEventListener('abort', onAbort);
      try {
        worker.terminate();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const onAbort = () => {
      finish({
        ok: false,
        reason: 'aborted',
        message: 'Bildoptimierung abgebrochen.',
      });
    };

    params.signal?.addEventListener('abort', onAbort, { once: true });

    worker.onmessage = (event: MessageEvent<ImageWorkerResponse>) => {
      const msg = event.data;
      if (!msg || msg.requestId !== requestId) return;
      if (msg.ok === true) {
        finish({
          ok: true,
          buffer: msg.buffer,
          width: msg.width,
          height: msg.height,
        });
        return;
      }
      if (msg.ok === false) {
        finish({
          ok: false,
          reason: msg.reason,
          message: msg.message,
          attemptedByteSize: msg.attemptedByteSize,
        });
      }
    };

    worker.onerror = () => {
      // Worker failed to boot — fall back once.
      if (settled) return;
      settled = true;
      params.signal?.removeEventListener('abort', onAbort);
      try {
        worker.terminate();
      } catch {
        /* ignore */
      }
      void encodeOnMainThread(params).then(resolve);
    };

    const rgbaCopy = params.imageData.data.buffer.slice(
      params.imageData.data.byteOffset,
      params.imageData.data.byteOffset + params.imageData.data.byteLength,
    );

    const request: ImageWorkerEncodeRequest = {
      type: 'encode',
      requestId,
      width: params.imageData.width,
      height: params.imageData.height,
      rgba: rgbaCopy,
      targetBytes: params.targetBytes,
      maxUploadBytes: params.maxUploadBytes,
      maxOutputBytes: params.maxOutputBytes,
      minQuality: params.minQuality,
      minEdgePx: params.minEdgePx,
    };

    worker.postMessage(request, [rgbaCopy]);
  });
}
```

### src/infrastructure/media/optimizer/engines/model3d/index.ts:14

```ts
export type Model3dEngineRequest = {
  readonly input: MediaOptimizeInputMeta;
  readonly signal?: AbortSignal;
};
```

### src/infrastructure/media/optimizer/engines/model3d/index.ts:19

```ts
export async function optimizeModel3d(
  request: Model3dEngineRequest,
): Promise<MediaOptimizeResult> {
  if (request.signal?.aborted) {
    return {
      status: 'aborted',
      kind: 'model3d',
      profileId: request.input.profileId,
      input: { ...request.input, kind: 'model3d' },
      code: 'aborted',
      message: '3D-Optimierung abgebrochen.',
    };
  }

  return {
    status: 'unsupported',
    kind: 'model3d',
    profileId: request.input.profileId,
    input: { ...request.input, kind: 'model3d' },
    code: 'unsupported-kind',
    message:
      '3D-Optimierung ist in V1 nicht verfügbar (Ausbau-TODO: glTF Transform / meshopt).',
  };
}
```

### src/infrastructure/media/optimizer/engines/video/index.ts:14

```ts
export type VideoEngineRequest = {
  readonly input: MediaOptimizeInputMeta;
  readonly signal?: AbortSignal;
};
```

### src/infrastructure/media/optimizer/engines/video/index.ts:19

```ts
export async function optimizeVideo(
  request: VideoEngineRequest,
): Promise<MediaOptimizeResult> {
  if (request.signal?.aborted) {
    return {
      status: 'aborted',
      kind: 'video',
      profileId: request.input.profileId,
      input: { ...request.input, kind: 'video' },
      code: 'aborted',
      message: 'Video-Optimierung abgebrochen.',
    };
  }

  return {
    status: 'unsupported',
    kind: 'video',
    profileId: request.input.profileId,
    input: { ...request.input, kind: 'video' },
    code: 'unsupported-kind',
    message:
      'Video-Transcoding ist in V1 nicht verfügbar (Ausbau-TODO: Mediabunny / geprüfte Runtime).',
  };
}
```

### src/infrastructure/media/optimizer/media-optimizer.ts:20

```ts
export type OptimizeMediaRequest = {
  readonly kind: MediaKind;
  readonly profileId: AssetProfileId;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly width?: number;
  readonly height?: number;
  readonly hasAnimation?: boolean;
  readonly hasAlpha?: boolean;
  readonly signal?: AbortSignal;
  /** Image payload for the WebP engine (#630); ignored by stub engines. */
  readonly bytes?: Blob | ArrayBuffer | Uint8Array;
  readonly imageCountInRequest?: number;
  readonly aggregateRequestBytes?: number;
  readonly onOptimizedBytes?: (bytes: Uint8Array) => void;
};
```

### src/infrastructure/media/optimizer/media-optimizer.ts:54

```ts
export async function optimizeMedia(
  request: OptimizeMediaRequest,
): Promise<MediaOptimizeResult> {
  if (!isMediaKind(request.kind)) {
    const input = toInputMeta({ ...request, kind: 'image' });
    return {
      status: 'unsupported',
      kind: 'image',
      profileId: request.profileId,
      input,
      code: 'unsupported-kind',
      message: `Unbekannte MediaKind: ${String(request.kind)}`,
    };
  }

  if (request.signal?.aborted) {
    const input = toInputMeta(request);
    return {
      status: 'aborted',
      kind: request.kind,
      profileId: request.profileId,
      input,
      code: 'aborted',
      message: 'Media-Optimierung abgebrochen.',
    };
  }

  const input = toInputMeta(request);
  let result: MediaOptimizeResult;

  switch (request.kind) {
    case 'image': {
      const { optimizeImage } = await import('./engines/image/index');
      result = await optimizeImage({
        input,
        signal: request.signal,
        bytes: request.bytes,
        imageCountInRequest: request.imageCountInRequest,
        aggregateRequestBytes: request.aggregateRequestBytes,
        onOptimizedBytes: request.onOptimizedBytes,
      });
      break;
    }
    case 'video': {
      const { optimizeVideo } = await import('./engines/video/index');
      result = await optimizeVideo({ input, signal: request.signal });
      break;
    }
    case 'audio': {
      const { optimizeAudio } = await import('./engines/audio/index');
      result = await optimizeAudio({ input, signal: request.signal });
      break;
    }
    case 'model3d': {
      const { optimizeModel3d } = await import('./engines/model3d/index');
      result = await optimizeModel3d({ input, signal: request.signal });
      break;
    }
    default: {
      const _exhaustive: never = request.kind;
      result = {
        status: 'unsupported',
        kind: 'image',
        profileId: request.profileId,
        input,
        code: 'unsupported-kind',
        message: `Unbehandelte MediaKind: ${String(_exhaustive)}`,
      };
    }
  }

  const invariants = assertMediaOptimizeResultInvariants(result);
  if (invariants.ok === false) {
    return {
      status: 'failed',
      kind: request.kind,
      profileId: request.profileId,
      input,
      code: 'invalid-input',
      message: `Optimizer-Ergebnis verletzt Invarianten: ${invariants.reason}`,
    };
  }

  return result;
}
```


## Remaining backend helper operations

All backend operations are included in the public declarations above.

## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/media/index.ts` | `768ded2d0f0fd1d510d660924e787817673955dbeff021d7de9e0a8d8e38bdec` |
| `src/domains/media/optimization-contract.ts` | `ba9216dab79a9c03f66a16b77dedf1c26d4d00d6ae2693cc5a68919d1647846d` |
| `src/domains/media/optimization-policy.ts` | `6145574bc08d1eb94f54d488ebc1f8bc030c2a956e3e3fd24cb15a7c8e50c5ec` |
| `src/infrastructure/media/optimizer/engines/audio/index.ts` | `7585190a705085692bff0896e08b4d78f791895b47e24d57deeaaa10bb669d4e` |
| `src/infrastructure/media/optimizer/engines/image/image.worker.ts` | `d34793b4de682556d9306194cfbcd05fdafdf215da25393f955d2669c7499276` |
| `src/infrastructure/media/optimizer/engines/image/index.ts` | `4944001b7e0f7784d487da2e60d06d845aa564e9ddd7516ff50633af1591a322` |
| `src/infrastructure/media/optimizer/engines/image/optimize-image.ts` | `bf73e826651227f704aff5ed584546a087f22f26c68a4c45ba918dfefbe7ce3e` |
| `src/infrastructure/media/optimizer/engines/image/raster-decode.ts` | `8ba5eda07565b10d1fb3d4090d068d12b1415399088c6c6b4a2aadc3fe4d290c` |
| `src/infrastructure/media/optimizer/engines/image/resource-limits.ts` | `1178fc226c85aee4f4989a7bd650d0b9830b37657c7499c1cec174b4aa9af364` |
| `src/infrastructure/media/optimizer/engines/image/types.ts` | `501095579c8bf1cc3af3a93147f4ab9fe1f280909c02e759d3d95c0f7151d45d` |
| `src/infrastructure/media/optimizer/engines/image/webp-budget.ts` | `7e7a1669b42c38b713f35952517260a61ca636cc6f84f29c76b949e3bcc2f70c` |
| `src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts` | `718b74e3146c6723862f0a4639eb5b7905a35f70a8c0e3c6e33d530a4ef80b84` |
| `src/infrastructure/media/optimizer/engines/model3d/index.ts` | `bcc13ca0c9f7bfa1a68e6c893509b21e682fe2c44732945fba85215042ac6d62` |
| `src/infrastructure/media/optimizer/engines/video/index.ts` | `d8c6aaaabb2ad762d4c15f9ef4aa9bc016f5968b2512cfe52f71cb09655dd842` |
| `src/infrastructure/media/optimizer/index.ts` | `c1b162af47239195707de742a8991bea14d85f2238108968613c3bad3d91cf02` |
| `src/infrastructure/media/optimizer/media-optimizer.ts` | `7d58424f12b7855ccb3c0153270628850e03afc15c285b1fc2b47218918255d9` |


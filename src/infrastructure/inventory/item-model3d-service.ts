/**
 * item-model3d-service — client facade for Workbench GLB upload / Meshy Image-to-3D (#141 / CUT-17).
 * Location: src/infrastructure/inventory/item-model3d-service.ts
 *
 * CUT-17: host-first via POST `/api/v1/items/model3d` when host library is on.
 * Legacy Edge `item-model3d` remains until dual-path removal (CUT-20).
 */
import { getHostAuthBaseUrl } from '../../lib/hostAuthBridge';
import { rewriteBrowserStorageUrl } from '../../lib/supabase';
import { isHostLibraryEnabled } from '../host/host-library-http';
import {
  ITEM_MODEL3D_MAX_BYTES,
  ITEM_MODEL3D_MIME,
  isAllowedItemModel3dMime,
  parseItemModel3dAssetKey,
  sniffItemModel3dGlb,
  type ItemModel3dMime,
} from '../../domains/items';

export type ItemModel3dJobUiStatus =
  | 'idle'
  | 'waiting'
  | 'generating'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export interface ItemModel3dConfig {
  meshyConfigured: boolean;
  maxBytes: number;
  allowedMime: readonly string[];
}

export interface ItemModel3dUploadResult {
  model3d: string;
  signedUrl: string;
  mime: ItemModel3dMime;
  byteSize: number;
}

export interface ItemModel3dJobSnapshot {
  jobId: string;
  jobStatus: ItemModel3dJobUiStatus;
  progress: number;
  errorMessage?: string;
  model3d?: string;
  signedUrl?: string;
}

type FunctionResponse =
  | { status: 'ok' } & Record<string, unknown>
  | { status: 'not-configured'; message: string }
  | { status: 'error'; message: string; code?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseResponse(value: unknown): FunctionResponse {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return { status: 'error', message: 'Ungültige Serverantwort.' };
  }
  if (value.status === 'ok') return value as FunctionResponse;
  if (
    (value.status === 'not-configured' || value.status === 'error') &&
    typeof value.message === 'string'
  ) {
    return {
      status: value.status,
      message: value.message,
      code: typeof value.code === 'string' ? value.code : undefined,
    };
  }
  return { status: 'error', message: 'Ungültige Serverantwort.' };
}

function hasResponseContext(error: unknown): error is { context: Response } {
  return isRecord(error) && error.context instanceof Response;
}

async function getFunctionErrorMessage(error: unknown): Promise<string | undefined> {
  if (!hasResponseContext(error)) return undefined;
  try {
    const body: unknown = await error.context.clone().json();
    const parsed = parseResponse(body);
    return parsed.status === 'ok' ? undefined : parsed.message;
  } catch {
    return undefined;
  }
}

async function invokeHost(body: Record<string, unknown>): Promise<FunctionResponse> {
  if (!isHostLibraryEnabled()) {
    return { status: 'error', message: '3D-Modell-Dienst nicht erreichbar.' };
  }
  const base = getHostAuthBaseUrl()?.replace(/\/$/, '') ?? '';
  if (!base) {
    return { status: 'error', message: '3D-Modell-Dienst nicht erreichbar.' };
  }
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1/items/model3d`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 'error', message: '3D-Modell-Dienst nicht erreichbar.' };
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { status: 'error', message: '3D-Modell-Dienst nicht erreichbar.' };
  }
  return parseResponse(data);
}

async function invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
  return invokeHost(body);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Datei konnte nicht gelesen werden.'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

async function readFileMagic(file: File): Promise<Uint8Array> {
  const buffer = await file.slice(0, 8).arrayBuffer();
  return new Uint8Array(buffer);
}

export async function validateModel3dFileClient(file: File): Promise<ItemModel3dMime> {
  if (file.size > ITEM_MODEL3D_MAX_BYTES) {
    throw new Error('Datei zu groß (max. 50 MB).');
  }
  const nameOk = file.name.toLowerCase().endsWith('.glb');
  const mimeOk = isAllowedItemModel3dMime(file.type) || file.type === '' || nameOk;
  if (!mimeOk) {
    throw new Error('Nur GLB-Dateien sind erlaubt.');
  }
  const magic = await readFileMagic(file);
  if (!sniffItemModel3dGlb(magic)) {
    throw new Error('Datei ist kein gültiges GLB (glTF Binary).');
  }
  return ITEM_MODEL3D_MIME;
}

class ItemModel3dService {
  async getConfig(): Promise<ItemModel3dConfig> {
    try {
      const response = await invoke({ action: 'config' });
      if (response.status !== 'ok') {
        return {
          meshyConfigured: false,
          maxBytes: ITEM_MODEL3D_MAX_BYTES,
          allowedMime: [ITEM_MODEL3D_MIME],
        };
      }
      return {
        meshyConfigured: response.meshyConfigured === true,
        maxBytes: typeof response.maxBytes === 'number' ? response.maxBytes : ITEM_MODEL3D_MAX_BYTES,
        allowedMime: Array.isArray(response.allowedMime)
          ? response.allowedMime.filter((m): m is string => typeof m === 'string')
          : [ITEM_MODEL3D_MIME],
      };
    } catch {
      return {
        meshyConfigured: false,
        maxBytes: ITEM_MODEL3D_MAX_BYTES,
        allowedMime: [ITEM_MODEL3D_MIME],
      };
    }
  }

  async uploadModel(definitionId: string, file: File): Promise<ItemModel3dUploadResult> {
    const mime = await validateModel3dFileClient(file);
    const contentBase64 = await fileToBase64(file);
    const response = await invoke({
      action: 'upload',
      definitionId,
      contentBase64,
      mime,
    });
    if (response.status !== 'ok') throw new Error(response.message);
    if (
      typeof response.model3d !== 'string' ||
      typeof response.signedUrl !== 'string' ||
      typeof response.mime !== 'string' ||
      typeof response.byteSize !== 'number'
    ) {
      throw new Error('Upload-Antwort unvollständig.');
    }
    if (response.mime !== ITEM_MODEL3D_MIME) {
      throw new Error('Upload-Antwort: ungültiger MIME-Typ.');
    }
    return {
      model3d: response.model3d,
      signedUrl: rewriteBrowserStorageUrl(response.signedUrl),
      mime: ITEM_MODEL3D_MIME,
      byteSize: response.byteSize,
    };
  }

  async startGenerate(definitionId: string): Promise<ItemModel3dJobSnapshot> {
    const response = await invoke({
      action: 'generate',
      definitionId,
    });
    if (response.status === 'not-configured') {
      throw new Error(response.message);
    }
    if (response.status !== 'ok') throw new Error(response.message);
    if (typeof response.jobId !== 'string') throw new Error('Job-ID fehlt.');
    return {
      jobId: response.jobId,
      jobStatus: typeof response.jobStatus === 'string'
        ? (response.jobStatus as ItemModel3dJobUiStatus)
        : 'waiting',
      progress: typeof response.progress === 'number' ? response.progress : 5,
    };
  }

  async pollJob(jobId: string): Promise<ItemModel3dJobSnapshot> {
    const response = await invoke({ action: 'status', jobId });
    if (response.status !== 'ok') throw new Error(response.message);
    if (typeof response.jobId !== 'string') throw new Error('Job-ID fehlt.');
    return {
      jobId: response.jobId,
      jobStatus: typeof response.jobStatus === 'string'
        ? (response.jobStatus as ItemModel3dJobUiStatus)
        : 'waiting',
      progress: typeof response.progress === 'number' ? response.progress : 0,
      errorMessage: typeof response.errorMessage === 'string' ? response.errorMessage : undefined,
      model3d: typeof response.model3d === 'string' ? response.model3d : undefined,
      signedUrl:
        typeof response.signedUrl === 'string'
          ? rewriteBrowserStorageUrl(response.signedUrl)
          : undefined,
    };
  }

  async loadLatestJob(definitionId: string): Promise<ItemModel3dJobSnapshot | null> {
    const response = await invoke({ action: 'latest-job', definitionId });
    if (response.status !== 'ok') return null;
    if (!isRecord(response.job)) return null;
    const job = response.job;
    if (typeof job.jobId !== 'string') return null;
    return {
      jobId: job.jobId,
      jobStatus: typeof job.jobStatus === 'string'
        ? (job.jobStatus as ItemModel3dJobUiStatus)
        : 'idle',
      progress: typeof job.progress === 'number' ? job.progress : 0,
      errorMessage: typeof job.errorMessage === 'string' ? job.errorMessage : undefined,
      model3d: typeof job.model3d === 'string' ? job.model3d : undefined,
    };
  }

  async resolveSignedUrl(model3d: string): Promise<string | null> {
    if (!parseItemModel3dAssetKey(model3d)) return null;
    try {
      const response = await invoke({ action: 'resolve', model3d });
      if (response.status !== 'ok' || typeof response.signedUrl !== 'string') return null;
      return rewriteBrowserStorageUrl(response.signedUrl);
    } catch {
      return null;
    }
  }

  async removeModel(definitionId: string): Promise<void> {
    const response = await invoke({ action: 'remove', definitionId });
    if (response.status !== 'ok') throw new Error(response.message);
  }
}

export const itemModel3dService = new ItemModel3dService();

/**
 * Edge-side avatar 3D generation settings — mirrors domain generation contracts.
 * Source of truth for UI: src/domains/character/avatar/generation/*
 * Location: supabase/functions/_shared/avatar-3d-generation.ts
 *
 * Keep Meshy field names here only; orchestrator must not hardcode vendor knobs.
 */

export type GeometryQuality = 'low' | 'standard' | 'high' | 'maximum' | 'smart-topology';
export type TextureQuality = 'standard' | '2k' | '4k' | '8k';
export type PoseMode = 'a-pose' | 't-pose' | 'none';
export type TopologyMode = 'triangle' | 'quad';

export interface Avatar3dGenerationSettings {
  modelId: string;
  geometryQuality: GeometryQuality;
  textureQuality: TextureQuality;
  pose: PoseMode;
  topology: TopologyMode;
  imageEnhancement: boolean;
  pbr: boolean;
  initialRemesh: boolean;
  targetPolycount: number;
  outputFormat: 'glb';
  keepMaster: boolean;
  runtimePolycount: number;
  providerExtras?: Record<string, string | number | boolean>;
}

export interface MeshyImageTo3dMappedParams {
  ai_model: string;
  model_type: 'standard' | 'smart-topology';
  texture_resolution: '2k' | '4k' | '8k';
  pose_mode: 'a-pose' | 't-pose' | '';
  enable_pbr: boolean;
  image_enhancement: boolean;
  should_texture: boolean;
  should_remesh: boolean;
  topology: 'triangle' | 'quad';
  target_polycount?: number;
  ultra_mode: boolean;
  save_pre_remeshed_model: boolean;
  target_formats: ['glb'];
}

export const DEFAULT_RECOMMENDED_SETTINGS: Avatar3dGenerationSettings = {
  modelId: 'latest',
  geometryQuality: 'high',
  textureQuality: '4k',
  pose: 'a-pose',
  topology: 'triangle',
  imageEnhancement: false,
  pbr: true,
  initialRemesh: false,
  targetPolycount: 50_000,
  outputFormat: 'glb',
  keepMaster: true,
  runtimePolycount: 50_000,
};

const GEOMETRY = new Set(['low', 'standard', 'high', 'maximum', 'smart-topology']);
const TEXTURE = new Set(['standard', '2k', '4k', '8k']);
const POSE = new Set(['a-pose', 't-pose', 'none']);
const TOPOLOGY = new Set(['triangle', 'quad']);
const PRESET_IDS = new Set(['fast', 'recommended', 'maximum', 'custom']);
/** Meshy Image-to-3D model ids accepted on the trust boundary (P-04 allowlist). */
const MESHY_MODEL_IDS = new Set(['latest', 'meshy-5', 'meshy-6', 'meshy-7', 'meshy-t1', 'meshy-t2']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateGenerationSettings(
  raw: unknown,
): { ok: true; settings: Avatar3dGenerationSettings } | { ok: false; message: string } {
  if (!isRecord(raw)) return { ok: false, message: 'Generation-Einstellungen ungültig.' };
  const modelId = typeof raw.modelId === 'string' ? raw.modelId.trim() : '';
  if (!modelId || !MESHY_MODEL_IDS.has(modelId)) {
    return { ok: false, message: 'Modell ungültig oder nicht erlaubt.' };
  }
  if (!GEOMETRY.has(String(raw.geometryQuality))) return { ok: false, message: 'Geometrie-Qualität ungültig.' };
  if (!TEXTURE.has(String(raw.textureQuality))) return { ok: false, message: 'Texture-Qualität ungültig.' };
  if (!POSE.has(String(raw.pose))) return { ok: false, message: 'Pose ungültig.' };
  if (!TOPOLOGY.has(String(raw.topology))) return { ok: false, message: 'Topology ungültig.' };
  const targetPolycount = Number(raw.targetPolycount);
  const runtimePolycount = Number(raw.runtimePolycount);
  if (!Number.isFinite(targetPolycount) || targetPolycount < 100 || targetPolycount > 300_000) {
    return { ok: false, message: 'Polycount ungültig.' };
  }
  if (!Number.isFinite(runtimePolycount) || runtimePolycount < 1000 || runtimePolycount > 300_000) {
    return { ok: false, message: 'Runtime-Polycount ungültig.' };
  }
  if (raw.outputFormat !== 'glb') return { ok: false, message: 'Output-Format muss GLB sein.' };

  let providerExtras: Record<string, string | number | boolean> | undefined;
  if (raw.providerExtras !== undefined) {
    if (!isRecord(raw.providerExtras)) return { ok: false, message: 'Provider-Extras ungültig.' };
    providerExtras = {};
    for (const [key, value] of Object.entries(raw.providerExtras)) {
      if (!/^[a-z][a-z0-9_]{0,40}$/i.test(key)) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        providerExtras[key] = value;
      }
    }
    if (Object.keys(providerExtras).length === 0) providerExtras = undefined;
  }

  return {
    ok: true,
    settings: {
      modelId,
      geometryQuality: raw.geometryQuality as GeometryQuality,
      textureQuality: raw.textureQuality as TextureQuality,
      pose: raw.pose as PoseMode,
      topology: raw.topology as TopologyMode,
      imageEnhancement: raw.imageEnhancement === true,
      pbr: raw.pbr === true,
      initialRemesh: raw.initialRemesh === true,
      targetPolycount: Math.round(targetPolycount),
      outputFormat: 'glb',
      keepMaster: raw.keepMaster === true,
      runtimePolycount: Math.round(runtimePolycount),
      ...(providerExtras ? { providerExtras } : {}),
    },
  };
}

export function parseProviderId(value: unknown): 'meshy' | null {
  return value === 'meshy' ? 'meshy' : null;
}

export function parsePresetMeta(payload: Record<string, unknown>): {
  presetId: string;
  presetVersion: number;
  presetDirty: boolean;
} {
  const presetId =
    typeof payload.presetId === 'string' && PRESET_IDS.has(payload.presetId)
      ? payload.presetId
      : 'recommended';
  const presetVersion =
    typeof payload.presetVersion === 'number' && Number.isFinite(payload.presetVersion)
      ? Math.max(1, Math.round(payload.presetVersion))
      : 1;
  const presetDirty = payload.presetDirty === true;
  return { presetId, presetVersion, presetDirty };
}

export function mapSettingsToMeshyImageTo3d(
  settings: Avatar3dGenerationSettings,
): MeshyImageTo3dMappedParams {
  const smart = settings.geometryQuality === 'smart-topology';
  const model_type = smart ? 'smart-topology' : 'standard';
  // Ultra only when geometryQuality is maximum — ignore client providerExtras.ultra_mode alone.
  const ultra = settings.geometryQuality === 'maximum';
  let ai_model = settings.modelId.trim() || 'latest';
  if (smart) ai_model = 'meshy-t2';
  if (!MESHY_MODEL_IDS.has(ai_model)) {
    ai_model = smart ? 'meshy-t2' : 'latest';
  }

  let texture_resolution: '2k' | '4k' | '8k' = '2k';
  if (settings.textureQuality === '4k') texture_resolution = '4k';
  else if (settings.textureQuality === '8k') texture_resolution = '8k';
  else if (settings.textureQuality === 'standard') texture_resolution = '2k';
  else texture_resolution = '2k';

  const pose_mode =
    settings.pose === 'a-pose' || settings.pose === 't-pose' ? settings.pose : '';

  const should_remesh = settings.initialRemesh && !smart;
  const mapped: MeshyImageTo3dMappedParams = {
    ai_model,
    model_type,
    texture_resolution,
    pose_mode,
    enable_pbr: settings.pbr,
    image_enhancement: settings.imageEnhancement,
    should_texture: true,
    should_remesh,
    topology: settings.topology,
    ultra_mode: ultra && !smart,
    save_pre_remeshed_model: settings.keepMaster && should_remesh,
    target_formats: ['glb'],
  };

  if (should_remesh || smart) {
    const max = smart ? 15_000 : 300_000;
    mapped.target_polycount = Math.max(
      100,
      Math.min(max, Math.round(settings.targetPolycount) || 50_000),
    );
  }
  return mapped;
}

export function buildGenerationSettingsJson(input: {
  providerId: string;
  providerModel: string;
  presetId: string;
  presetVersion: number;
  presetDirty: boolean;
  settings: Avatar3dGenerationSettings;
  sourceMode: 'text' | 'image';
  providerTaskId?: string;
  mappedProviderParams?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    contractVersion: 'SagaTreeAvatar3dGenerationV1',
    providerId: input.providerId,
    providerModel: input.providerModel,
    presetId: input.presetId,
    presetVersion: input.presetVersion,
    presetDirty: input.presetDirty,
    settings: input.settings,
    generatedAt: new Date().toISOString(),
    sourceMode: input.sourceMode,
    ...(input.providerTaskId ? { providerTaskId: input.providerTaskId } : {}),
    ...(input.mappedProviderParams ? { mappedProviderParams: input.mappedProviderParams } : {}),
  };
}

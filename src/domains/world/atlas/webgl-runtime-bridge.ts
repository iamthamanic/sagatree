/**
 * webgl-runtime-bridge — Sync WebGL prototype state via generator_meta (#721).
 * Location: src/domains/world/atlas/webgl-runtime-bridge.ts
 *
 * Product maps must not use localStorage as world SoT. Runtime state is stored
 * under generator_meta.webglRuntimeV3 alongside UnifiedCanvasDoc.
 */
import {
  extractUnifiedCanvasFromGeneratorMeta,
  mergeUnifiedCanvasIntoGeneratorMeta,
  type UnifiedCanvasDoc,
  type UnifiedCanvasObject,
  type UnifiedCanvasStampType,
} from './unified-canvas-doc';

export const WEBGL_RUNTIME_META_KEY = 'webglRuntimeV3' as const;
export const LEGACY_WEBGL_LOCAL_STORAGE_KEY = 'sagatree-atlas-webgl-v3' as const;

export type WebglRuntimeState = {
  readonly props: readonly unknown[];
  readonly strokes: readonly unknown[];
  readonly walls: readonly unknown[];
  readonly rooms?: readonly unknown[];
  readonly layers: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
};

const PROP_TYPE_TO_STAMP: Readonly<Record<string, UnifiedCanvasStampType>> = {
  tree: 'baum',
  pine: 'tanne',
  house: 'haus',
  rock: 'fels',
  crate: 'kiste',
  table: 'tisch',
  torch: 'lampe',
  crystal: 'fels',
  pillar: 'turm',
};

export function parseWebglRuntimeState(raw: unknown): WebglRuntimeState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (!Array.isArray(s.props) || !Array.isArray(s.strokes) || !Array.isArray(s.walls)) {
    return null;
  }
  if (!s.layers || typeof s.layers !== 'object') return null;
  return s as WebglRuntimeState;
}

export function extractWebglRuntimeFromGeneratorMeta(
  meta: Readonly<Record<string, unknown>> | null | undefined,
): WebglRuntimeState | null {
  if (!meta || typeof meta !== 'object') return null;
  return parseWebglRuntimeState(meta[WEBGL_RUNTIME_META_KEY]);
}

export function mergeWebglRuntimeIntoGeneratorMeta(
  meta: Readonly<Record<string, unknown>> | null | undefined,
  runtime: WebglRuntimeState,
  canvasDoc?: UnifiedCanvasDoc | null,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(meta ?? {}) };
  base[WEBGL_RUNTIME_META_KEY] = runtime;
  if (canvasDoc) {
    return mergeUnifiedCanvasIntoGeneratorMeta(base, canvasDoc);
  }
  return base;
}

/** Prefer unified canvas doc; fall back to empty product doc when only runtime exists. */
export function resolveProductCanvasDoc(
  meta: Readonly<Record<string, unknown>> | null | undefined,
  fallback: UnifiedCanvasDoc,
): UnifiedCanvasDoc {
  return extractUnifiedCanvasFromGeneratorMeta(meta) ?? fallback;
}

/**
 * One-shot read of historical prototype local JSON (non-secret).
 * Does not write; caller decides whether to merge into generator_meta.
 */
export function readLegacyWebglLocalStorage(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): WebglRuntimeState | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(LEGACY_WEBGL_LOCAL_STORAGE_KEY);
    if (!text) return null;
    return parseWebglRuntimeState(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Project WebGL props into UnifiedCanvasDoc objects (stable ids). */
export function syncWebglPropsIntoCanvasDoc(
  doc: UnifiedCanvasDoc,
  runtime: WebglRuntimeState,
): UnifiedCanvasDoc {
  const objects: UnifiedCanvasObject[] = [];
  for (const raw of runtime.props) {
    if (!raw || typeof raw !== 'object') continue;
    const p = raw as Record<string, unknown>;
    if (typeof p.id !== 'string') continue;
    if (typeof p.x !== 'number' || typeof p.z !== 'number') continue;
    const stamp = PROP_TYPE_TO_STAMP[String(p.type ?? '')];
    if (!stamp) continue;
    const size = typeof p.size === 'number' && Number.isFinite(p.size) ? p.size : 1;
    const angle = typeof p.rotation === 'number' && Number.isFinite(p.rotation) ? p.rotation : 0;
    objects.push({ id: p.id, type: stamp, x: p.x, y: p.z, size, angle });
  }
  if (objects.length === 0) return doc;
  const byId = new Map(doc.objects.map((o) => [o.id, o]));
  for (const o of objects) byId.set(o.id, o);
  return { ...doc, objects: [...byId.values()], demoSeed: false };
}

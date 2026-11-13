/**
 * atlas-webgl-write-retire — ATL2-B04: unifiedCanvas is the only persisted geometry SoT.
 * Location: src/domains/world/atlas/atlas-webgl-write-retire.ts
 *
 * webglRuntimeV3 remains a documented legacy read adapter + ephemeral 3D seed source.
 * Product saves must not dual-write geometry into that sidecar (ghost / shadow copies).
 * Pure domain — no React / Host HTTP.
 */

import {
  emptyUnifiedCanvasDoc,
  extractUnifiedCanvasFromGeneratorMeta,
  mergeUnifiedCanvasIntoGeneratorMeta,
  type UnifiedCanvasDoc,
} from './unified-canvas-doc';
import {
  WEBGL_RUNTIME_META_KEY,
  extractWebglRuntimeFromGeneratorMeta,
  mergeWebglRuntimeIntoGeneratorMeta,
  syncWebglPropsIntoCanvasDoc,
  type WebglRuntimeState,
} from './webgl-runtime-bridge';

/** One-shot geometry backup when stripping webglRuntimeV3 on persist (rollback). */
export const WEBGL_GEOMETRY_BACKUP_META_KEY = 'webglRuntimeV3GeometryBackup' as const;

export type WebglGeometryBackup = {
  readonly capturedAt: string;
  readonly props: readonly unknown[];
  readonly walls: readonly unknown[];
  readonly strokes: readonly unknown[];
  readonly rooms: readonly unknown[];
  readonly doors?: readonly unknown[];
  readonly layers: Readonly<Record<string, unknown>>;
};

export function webglRuntimeHasGeometry(
  runtime: WebglRuntimeState | null | undefined,
): boolean {
  if (!runtime) return false;
  return (
    runtime.props.length > 0 ||
    runtime.walls.length > 0 ||
    runtime.strokes.length > 0 ||
    (runtime.rooms?.length ?? 0) > 0 ||
    (runtime.doors?.length ?? 0) > 0
  );
}

export function canvasDocHasGeometry(doc: UnifiedCanvasDoc | null | undefined): boolean {
  if (!doc) return false;
  return (
    doc.objects.length > 0 ||
    doc.walls.length > 0 ||
    doc.strokes.length > 0 ||
    doc.rooms.length > 0 ||
    (doc.doors?.length ?? 0) > 0
  );
}

/** Keep layers / non-geometry extras; clear props/walls/strokes/rooms/doors. */
export function geometryFreeWebglRuntime(runtime: WebglRuntimeState): WebglRuntimeState {
  return {
    ...runtime,
    props: [],
    walls: [],
    strokes: [],
    rooms: [],
    doors: [],
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

export function parseWebglGeometryBackup(raw: unknown): WebglGeometryBackup | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.capturedAt !== 'string' ||
    !Array.isArray(raw.props) ||
    !Array.isArray(raw.walls) ||
    !Array.isArray(raw.strokes) ||
    !isRecord(raw.layers)
  ) {
    return null;
  }
  return {
    capturedAt: raw.capturedAt,
    props: raw.props,
    walls: raw.walls,
    strokes: raw.strokes,
    rooms: Array.isArray(raw.rooms) ? raw.rooms : [],
    ...(Array.isArray(raw.doors) ? { doors: raw.doors } : {}),
    layers: raw.layers,
  };
}

function captureGeometryBackup(
  runtime: WebglRuntimeState,
  capturedAt: string,
): WebglGeometryBackup {
  return {
    capturedAt,
    props: runtime.props,
    walls: runtime.walls,
    strokes: runtime.strokes,
    rooms: runtime.rooms ?? [],
    doors: runtime.doors ?? [],
    layers: runtime.layers,
  };
}

/**
 * Prefer unifiedCanvas when the key is present (even if empty — intentional deletes).
 * One-shot import from webglRuntimeV3 only when the canonical document is absent.
 */
export function hydrateCanvasFromLegacyWebgl(
  meta: Readonly<Record<string, unknown>> | null | undefined,
  fallbackDemoSeed = true,
): {
  readonly canvas: UnifiedCanvasDoc;
  readonly runtime: WebglRuntimeState | null;
  readonly migrated: boolean;
  readonly meta: Record<string, unknown>;
} {
  const runtime = extractWebglRuntimeFromGeneratorMeta(meta);
  const parsed = extractUnifiedCanvasFromGeneratorMeta(meta);
  if (parsed != null) {
    return {
      canvas: parsed,
      runtime,
      migrated: false,
      meta: { ...(meta ?? {}) },
    };
  }
  const canvas = emptyUnifiedCanvasDoc(fallbackDemoSeed);
  if (!webglRuntimeHasGeometry(runtime)) {
    return {
      canvas,
      runtime,
      migrated: false,
      meta: { ...(meta ?? {}) },
    };
  }
  const imported = syncWebglPropsIntoCanvasDoc(canvas, runtime);
  return {
    canvas: imported,
    runtime,
    migrated: true,
    meta: mergeUnifiedCanvasIntoGeneratorMeta(meta, imported),
  };
}

/**
 * Product persist: write unifiedCanvas only for geometry; strip sidecar geometry
 * (with one-shot backup) while preserving layers / extras.
 */
export function mergeCanonicalAtlasGeometryForPersist(
  priorMeta: Readonly<Record<string, unknown>> | null | undefined,
  canvas: UnifiedCanvasDoc,
  runtime: WebglRuntimeState | null | undefined,
  options?: { readonly capturedAt?: string },
): Record<string, unknown> {
  const capturedAt = options?.capturedAt ?? new Date().toISOString();
  let meta: Record<string, unknown> = { ...(priorMeta ?? {}) };
  const priorRuntime = extractWebglRuntimeFromGeneratorMeta(meta);
  if (
    priorRuntime &&
    webglRuntimeHasGeometry(priorRuntime) &&
    parseWebglGeometryBackup(meta[WEBGL_GEOMETRY_BACKUP_META_KEY]) == null
  ) {
    meta[WEBGL_GEOMETRY_BACKUP_META_KEY] = captureGeometryBackup(priorRuntime, capturedAt);
  }
  meta = mergeUnifiedCanvasIntoGeneratorMeta(meta, canvas);
  const extras = persistableWebglSidecar(priorRuntime, runtime);
  if (extras) {
    meta = mergeWebglRuntimeIntoGeneratorMeta(meta, extras);
  }
  return meta;
}

/**
 * Layers/extras for persist: merge prior sidecar extras under current in-memory
 * extras, always with geometry cleared (no shadow SoT).
 */
export function persistableWebglSidecar(
  prior: WebglRuntimeState | null | undefined,
  current: WebglRuntimeState | null | undefined,
): WebglRuntimeState | null {
  if (!prior && !current) return null;
  const freedPrior = prior ? geometryFreeWebglRuntime(prior) : null;
  const freedCurrent = current ? geometryFreeWebglRuntime(current) : null;
  if (!freedCurrent) return freedPrior;
  if (!freedPrior) return freedCurrent;
  return {
    ...freedPrior,
    ...freedCurrent,
    props: [],
    walls: [],
    strokes: [],
    rooms: [],
    doors: [],
    layers: freedCurrent.layers ?? freedPrior.layers,
  };
}

/** Restore geometry sidecar from backup (rollback). Does not remove unifiedCanvas. */
export function restoreWebglGeometryBackup(
  meta: Readonly<Record<string, unknown>> | null | undefined,
): Record<string, unknown> | null {
  const base: Record<string, unknown> = { ...(meta ?? {}) };
  const backup = parseWebglGeometryBackup(base[WEBGL_GEOMETRY_BACKUP_META_KEY]);
  if (!backup) return null;
  const current = extractWebglRuntimeFromGeneratorMeta(base);
  // Merge geometry into existing extras (placeNames/worlds) — do not replace wholesale.
  base[WEBGL_RUNTIME_META_KEY] = {
    ...(current ?? {
      props: [],
      walls: [],
      strokes: [],
      rooms: [],
      doors: [],
      layers: backup.layers,
    }),
    props: backup.props,
    walls: backup.walls,
    strokes: backup.strokes,
    rooms: backup.rooms,
    doors: backup.doors ?? [],
    layers: backup.layers,
  };
  delete base[WEBGL_GEOMETRY_BACKUP_META_KEY];
  return base;
}

/** True when persisted meta has no webgl geometry shadow (or key absent). */
export function persistedMetaHasNoWebglGeometryShadow(
  meta: Readonly<Record<string, unknown>> | null | undefined,
): boolean {
  const runtime = extractWebglRuntimeFromGeneratorMeta(meta);
  return !webglRuntimeHasGeometry(runtime);
}

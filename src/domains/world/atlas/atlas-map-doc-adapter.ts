/**
 * atlas-map-doc-adapter — ATL2-B02 lossless V1↔V2 map document adapter.
 * Location: src/domains/world/atlas/atlas-map-doc-adapter.ts
 *
 * Persist wire remains UnifiedCanvasDoc V1. V2 is a versioned in-memory /
 * generator_meta sidecar view (classification + hints) that round-trips
 * without inventing geometry or IDs. Pure domain — no React / Host HTTP.
 */

import {
  ATLAS_CANONICAL_CATALOG_VERSION,
  ATLAS_WIRE_FORMAT_DECISION,
  classifyStroke,
  classifyUnifiedCanvasDoc,
  inferGoldenStrokeProvenance,
  type AtlasCanonicalDocClassification,
  type AtlasCanonicalFeatureRef,
  type AtlasStrokeProvenance,
} from './atlas-canonical-features';
import {
  UNIFIED_CANVAS_FORMAT,
  UNIFIED_CANVAS_META_KEY,
  extractUnifiedCanvasFromGeneratorMeta,
  mergeUnifiedCanvasIntoGeneratorMeta,
  parseUnifiedCanvasDoc,
  serializeUnifiedCanvasDoc,
  type UnifiedCanvasDoc,
} from './unified-canvas-doc';

/** Optional sidecar under generator_meta — never replaces unifiedCanvas wire. */
export const ATLAS_MAP_DOC_V2_META_KEY = 'atlasMapDocV2' as const;
export const ATLAS_MAP_DOC_V2_FORMAT = 'sagatree-atlas-map-doc-v2' as const;
export const ATLAS_MAP_DOC_BACKUP_META_KEY = 'atlasMapDocBackup' as const;

export type AtlasMapDocScale = 'world' | 'interior' | 'unknown';

export type AtlasStrokeHintMap = Readonly<Record<string, AtlasStrokeProvenance>>;

export type AtlasMapDocV2 = {
  readonly format: typeof ATLAS_MAP_DOC_V2_FORMAT;
  readonly catalogVersion: typeof ATLAS_CANONICAL_CATALOG_VERSION;
  readonly wireFormat: typeof UNIFIED_CANVAS_FORMAT;
  readonly wireDecision: typeof ATLAS_WIRE_FORMAT_DECISION;
  readonly scale: AtlasMapDocScale;
  /** Explicit stroke provenance; never inferred from material alone. */
  readonly strokeHints: AtlasStrokeHintMap;
  readonly canvas: UnifiedCanvasDoc;
  readonly classification: AtlasCanonicalDocClassification;
};

export type AtlasMapDocAdaptResult =
  | { readonly ok: true; readonly doc: AtlasMapDocV2 }
  | {
      readonly ok: false;
      readonly reason: 'missing_canvas' | 'invalid_canvas' | 'unsupported_format';
      readonly detail: string;
    };

export type AtlasMapDocBackup = {
  readonly capturedAt: string;
  readonly unifiedCanvas: UnifiedCanvasDoc;
  readonly atlasMapDocV2: AtlasMapDocV2 | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function parseStrokeHints(raw: unknown): AtlasStrokeHintMap {
  if (!isRecord(raw)) return {};
  const out: Record<string, AtlasStrokeProvenance> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (value === 'road' || value === 'river' || value === 'brush') out[id] = value;
  }
  return out;
}

function tallyCounts(
  features: readonly AtlasCanonicalFeatureRef[],
): AtlasCanonicalDocClassification['counts'] {
  const counts: {
    -readonly [K in keyof AtlasCanonicalDocClassification['counts']]: number;
  } = {
    terrain_area: 0,
    political_area: 0,
    path_way: 0,
    path_river: 0,
    terrain_brush: 0,
    building_footprint: 0,
    floor_plan_room: 0,
    wall: 0,
    door: 0,
    prop_object: 0,
    heightfield: 0,
    layer_toggle: 0,
    raster_reference: 0,
    world_node_ref: 0,
    legacy_area_ambiguous: 0,
    legacy_stroke_ambiguous: 0,
  };
  for (const f of features) counts[f.kind] += 1;
  return counts;
}

function classifyWithHints(
  canvas: UnifiedCanvasDoc,
  scale: AtlasMapDocScale,
  strokeHints: AtlasStrokeHintMap,
): AtlasCanonicalDocClassification {
  const base = classifyUnifiedCanvasDoc(canvas, { scale });
  const features: AtlasCanonicalFeatureRef[] = [];
  for (const f of base.features) {
    if (f.v1Slot !== 'stroke') {
      features.push(f);
      continue;
    }
    const stroke = canvas.strokes.find((s) => s.id === f.id);
    if (!stroke) {
      features.push(f);
      continue;
    }
    const hint = strokeHints[f.id] ?? null;
    features.push(classifyStroke(stroke, hint));
  }
  return {
    catalogVersion: base.catalogVersion,
    wireDecision: base.wireDecision,
    features,
    counts: tallyCounts(features),
  };
}

/**
 * Build Golden stroke hints from known Dornhain id mnemonics.
 * Material alone is never used.
 */
export function goldenStrokeHintsFromCanvas(canvas: UnifiedCanvasDoc): AtlasStrokeHintMap {
  const out: Record<string, AtlasStrokeProvenance> = {};
  for (const stroke of canvas.strokes) {
    const hint = inferGoldenStrokeProvenance(stroke.id);
    if (hint) out[stroke.id] = hint;
  }
  return out;
}

export function buildAtlasMapDocV2(
  canvas: UnifiedCanvasDoc,
  options?: {
    readonly scale?: AtlasMapDocScale;
    readonly strokeHints?: AtlasStrokeHintMap;
  },
): AtlasMapDocV2 {
  const scale = options?.scale ?? 'unknown';
  const strokeHints = options?.strokeHints ?? {};
  const serialized = serializeUnifiedCanvasDoc(canvas);
  return {
    format: ATLAS_MAP_DOC_V2_FORMAT,
    catalogVersion: ATLAS_CANONICAL_CATALOG_VERSION,
    wireFormat: UNIFIED_CANVAS_FORMAT,
    wireDecision: ATLAS_WIRE_FORMAT_DECISION,
    scale,
    strokeHints,
    canvas: serialized,
    classification: classifyWithHints(serialized, scale, strokeHints),
  };
}

/**
 * Adapt generator_meta (or a raw unified canvas) into V2.
 * Rejects unknown formats; does not invent canvas content.
 */
export function adaptGeneratorMetaToV2(
  meta: Readonly<Record<string, unknown>> | null | undefined,
  options?: {
    readonly scale?: AtlasMapDocScale;
    readonly strokeHints?: AtlasStrokeHintMap;
    readonly preferStoredHints?: boolean;
  },
): AtlasMapDocAdaptResult {
  if (meta == null) {
    return { ok: false, reason: 'missing_canvas', detail: 'generator_meta is null' };
  }
  if (meta.format != null && meta.format !== UNIFIED_CANVAS_FORMAT && meta.format !== ATLAS_MAP_DOC_V2_FORMAT) {
    if (!isRecord(meta[UNIFIED_CANVAS_META_KEY]) && !isRecord(meta[ATLAS_MAP_DOC_V2_META_KEY])) {
      return {
        ok: false,
        reason: 'unsupported_format',
        detail: `unsupported format ${String(meta.format)}`,
      };
    }
  }

  const storedV2 = meta[ATLAS_MAP_DOC_V2_META_KEY];
  let storedHints: AtlasStrokeHintMap = {};
  let storedScale: AtlasMapDocScale | undefined;
  if (isRecord(storedV2) && storedV2.format === ATLAS_MAP_DOC_V2_FORMAT) {
    storedHints = parseStrokeHints(storedV2.strokeHints);
    if (storedV2.scale === 'world' || storedV2.scale === 'interior' || storedV2.scale === 'unknown') {
      storedScale = storedV2.scale;
    }
  }

  const canvas = extractUnifiedCanvasFromGeneratorMeta(meta);
  if (!canvas) {
    return { ok: false, reason: 'invalid_canvas', detail: 'unifiedCanvas parse failed' };
  }

  const scale = options?.scale ?? storedScale ?? 'unknown';
  const strokeHints =
    options?.strokeHints ??
    (options?.preferStoredHints === false ? {} : storedHints);

  return {
    ok: true,
    doc: buildAtlasMapDocV2(canvas, { scale, strokeHints }),
  };
}

/** Project V2 back to V1 wire document (geometry/IDs only — lossless). */
export function projectAtlasMapDocV2ToV1Wire(doc: AtlasMapDocV2): UnifiedCanvasDoc {
  return serializeUnifiedCanvasDoc(doc.canvas);
}

/**
 * Persist V1 wire + V2 sidecar. Never drops unrelated generator_meta keys
 * (e.g. webglRuntimeV3). Captures backup of prior canvas when present.
 */
export function mergeAtlasMapDocV2IntoGeneratorMeta(
  existing: Readonly<Record<string, unknown>>,
  doc: AtlasMapDocV2,
  options?: { readonly writeBackup?: boolean; readonly nowIso?: string },
): Record<string, unknown> {
  const wire = projectAtlasMapDocV2ToV1Wire(doc);
  let next = mergeUnifiedCanvasIntoGeneratorMeta(existing, wire);

  if (options?.writeBackup !== false) {
    const prior = extractUnifiedCanvasFromGeneratorMeta(existing);
    if (prior) {
      const priorV2 = adaptGeneratorMetaToV2(existing, {
        scale: doc.scale,
        preferStoredHints: true,
      });
      const backup: AtlasMapDocBackup = {
        capturedAt: options?.nowIso ?? new Date().toISOString(),
        unifiedCanvas: serializeUnifiedCanvasDoc(prior),
        atlasMapDocV2: priorV2.ok ? priorV2.doc : null,
      };
      next = { ...next, [ATLAS_MAP_DOC_BACKUP_META_KEY]: backup };
    }
  }

  const sidecar = {
    format: doc.format,
    catalogVersion: doc.catalogVersion,
    wireFormat: doc.wireFormat,
    wireDecision: doc.wireDecision,
    scale: doc.scale,
    strokeHints: { ...doc.strokeHints },
  };
  return { ...next, [ATLAS_MAP_DOC_V2_META_KEY]: sidecar };
}

export function restoreAtlasMapDocBackup(
  meta: Readonly<Record<string, unknown>>,
): AtlasMapDocAdaptResult {
  const raw = meta[ATLAS_MAP_DOC_BACKUP_META_KEY];
  if (!isRecord(raw) || !isRecord(raw.unifiedCanvas)) {
    return { ok: false, reason: 'missing_canvas', detail: 'no atlasMapDocBackup' };
  }
  const canvas = parseUnifiedCanvasDoc(raw.unifiedCanvas);
  if (!canvas) {
    return { ok: false, reason: 'invalid_canvas', detail: 'backup unifiedCanvas invalid' };
  }
  const hints = isRecord(raw.atlasMapDocV2)
    ? parseStrokeHints(raw.atlasMapDocV2.strokeHints)
    : {};
  const scale =
    isRecord(raw.atlasMapDocV2) &&
    (raw.atlasMapDocV2.scale === 'world' ||
      raw.atlasMapDocV2.scale === 'interior' ||
      raw.atlasMapDocV2.scale === 'unknown')
      ? raw.atlasMapDocV2.scale
      : 'unknown';
  return { ok: true, doc: buildAtlasMapDocV2(canvas, { scale, strokeHints: hints }) };
}

/**
 * Structural equality for lossless roundtrip proofs (IDs + geometry + secrets).
 */
export function unifiedCanvasRoundtripEqual(a: UnifiedCanvasDoc, b: UnifiedCanvasDoc): boolean {
  return JSON.stringify(serializeUnifiedCanvasDoc(a)) === JSON.stringify(serializeUnifiedCanvasDoc(b));
}

/**
 * True when classification did not invent political areas and preserved secrets.
 */
export function adapterRespectsAmbiguity(doc: AtlasMapDocV2): boolean {
  if (doc.classification.counts.political_area > 0) return false;
  for (const obj of doc.canvas.objects) {
    if (obj.secret === true) {
      const ref = doc.classification.features.find((f) => f.id === obj.id);
      if (!ref || ref.secret !== true) return false;
    }
  }
  return true;
}

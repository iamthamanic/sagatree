/**
 * atlas-world-space — SWS-01: recursive World-Space transforms + hierarchy guards.
 * Location: src/domains/world/atlas/atlas-world-space.ts
 *
 * Pure domain — no React, no Three.js, no Host SDKs.
 *
 * ADR-SWS-01 §3: a single Unified World Space derived by composing each map's
 * `ParentSpatialAnchor` up to the world root. Local coordinate systems
 * (UnifiedCanvasDoc 0…1000) are preserved; the world coordinate is a DERIVED,
 * computed value — never persisted.
 *
 * Hardening (SWS-01 / Snapshot §1.7–1.8):
 *  - Cycle detection is FAIL-CLOSED on read AND intended for the write guard.
 *  - Shear rule: rotation ≠ 0 requires uniform extents (extentX == extentY),
 *    otherwise a rotated non-uniform anchor would shear the world.
 *  - Unlocated children never invent geography (honest failure, IV-*).
 */
import {
  childLocalToParentPoint,
  parentPointToChildLocal,
  type ParentSpatialAnchor,
} from './map-frame';
import { DEFAULT_ATLAS_BOUNDS, type WorldAtlasBounds } from './world-atlas.types';

/** Minimal map node needed to walk the anchor chain to the world root. */
export type AtlasWorldSpaceNode = {
  readonly id: string;
  /** Räumlicher Anchor in den Parent-Space; null = Wurzel (World Space). */
  readonly parentAnchor: ParentSpatialAnchor | null;
  /** Lokale Bounds; default 0…1000. */
  readonly bounds?: WorldAtlasBounds;
};

export type AtlasPoint2 = { readonly x: number; readonly y: number };

export type AtlasWorldTransformError =
  | 'cycle'          // Hierarchie-Zyklus auf dem Weg zur Wurzel
  | 'unlocated'      // Anchor fehlt auf einem Nicht-Wurzel-Knoten
  | 'missing-node'   // Referenzierte Parent-Map nicht im Graph
  | 'shear'          // rotierter, nicht-uniformer Anchor (Scherung)
  | 'invalid';       // nicht-finite Eingabe

export type AtlasWorldErrorResult = {
  readonly ok: false;
  readonly error: AtlasWorldTransformError;
  readonly atMapId: string;
};

export type AtlasWorldResult<T> =
  | { readonly ok: true; readonly value: T; readonly depth: number }
  | AtlasWorldErrorResult;

export function isAtlasWorldError<T>(res: AtlasWorldResult<T>): res is AtlasWorldErrorResult {
  return res.ok === false;
}

function finitePoint(p: AtlasPoint2): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

/** Toleranz für den Uniform-Extent-Vergleich (relative). */
export const ATLAS_UNIFORM_EXTENT_EPSILON = 1e-9;

/**
 * Shear rule: a rotated anchor MUST have uniform extents, else the
 * non-uniform scale combined with rotation shears the world (Snapshot §1.8).
 * rotation ≈ 0 is always allowed (pure axis scale, no shear).
 */
export function anchorHasShear(anchor: ParentSpatialAnchor): boolean {
  const rotated = Math.abs(anchor.rotationRad) > ATLAS_UNIFORM_EXTENT_EPSILON;
  if (!rotated) return false;
  const rel =
    Math.abs(anchor.extentX - anchor.extentY) /
    Math.max(Math.abs(anchor.extentX), Math.abs(anchor.extentY), Number.EPSILON);
  return rel > ATLAS_UNIFORM_EXTENT_EPSILON;
}

/**
 * Walk mapId → root, returning the ordered chain (map first, root last).
 * Fail-closed on cycle / unlocated / missing parent / shear.
 */
export function resolveWorldChain(
  nodes: ReadonlyMap<string, AtlasWorldSpaceNode> | Readonly<Record<string, AtlasWorldSpaceNode>>,
  mapId: string,
): AtlasWorldResult<readonly AtlasWorldSpaceNode[]> {
  const get = (id: string): AtlasWorldSpaceNode | undefined =>
    nodes instanceof Map ? nodes.get(id) : (nodes as Readonly<Record<string, AtlasWorldSpaceNode>>)[id];

  const start = get(mapId);
  if (!start) return { ok: false, error: 'missing-node', atMapId: mapId };

  const chain: AtlasWorldSpaceNode[] = [];
  const visited = new Set<string>();
  let cur: AtlasWorldSpaceNode | undefined = start;
  let descendantRotated = false;

  while (cur) {
    if (visited.has(cur.id)) return { ok: false, error: 'cycle', atMapId: cur.id };
    visited.add(cur.id);
    chain.push(cur);

    const anchor = cur.parentAnchor;
    if (!anchor) return { ok: true, value: chain, depth: chain.length }; // Wurzel erreicht
    if (anchorHasShear(anchor)) return { ok: false, error: 'shear', atMapId: cur.id };

    // Composed-chain shear guard: an unrotated non-uniformly scaled ancestor applied after
    // a rotated descendant shears the child's orthogonal axes in World Space.
    if (descendantRotated) {
      const b = cur.bounds ?? DEFAULT_ATLAS_BOUNDS;
      const spanX = Math.max(Number.EPSILON, b.maxX - b.minX);
      const spanY = Math.max(Number.EPSILON, b.maxY - b.minY);
      const scaleX = (2 * anchor.extentX) / spanX;
      const scaleY = (2 * anchor.extentY) / spanY;
      const rel = Math.abs(scaleX - scaleY) / Math.max(Math.abs(scaleX), Math.abs(scaleY), Number.EPSILON);
      if (rel > ATLAS_UNIFORM_EXTENT_EPSILON) {
        return { ok: false, error: 'shear', atMapId: cur.id };
      }
    }
    if (Math.abs(anchor.rotationRad) > ATLAS_UNIFORM_EXTENT_EPSILON) {
      descendantRotated = true;
    }

    const parentId = anchor.parentMapId.trim();
    const parent: AtlasWorldSpaceNode | undefined = get(parentId);
    if (!parent) return { ok: false, error: 'missing-node', atMapId: parentId };
    cur = parent;
  }
  // defensiv: while verlässt nur via return
  return { ok: false, error: 'invalid', atMapId: mapId };
}

/**
 * Local point on `mapId` → World Space. Composes the full anchor chain.
 * Depth = Anzahl der durchlaufenen Ebenen (1 = map ist Wurzel).
 */
export function localToWorld(
  nodes: ReadonlyMap<string, AtlasWorldSpaceNode> | Readonly<Record<string, AtlasWorldSpaceNode>>,
  mapId: string,
  point: AtlasPoint2,
): AtlasWorldResult<AtlasPoint2> {
  if (!finitePoint(point)) return { ok: false, error: 'invalid', atMapId: mapId };
  const chainRes = resolveWorldChain(nodes, mapId);
  if (isAtlasWorldError(chainRes)) return chainRes;

  let p: AtlasPoint2 = point;
  for (const node of chainRes.value) {
    const anchor = node.parentAnchor;
    if (!anchor) break; // Wurzel: p ist jetzt World Space
    p = childLocalToParentPoint(anchor, p, node.bounds ?? DEFAULT_ATLAS_BOUNDS);
    if (!finitePoint(p)) return { ok: false, error: 'invalid', atMapId: node.id };
  }
  return { ok: true, value: p, depth: chainRes.depth };
}

/**
 * World-Space point → local coordinates on `mapId`. Inverse of `localToWorld`.
 * Walks the chain root→map applying `parentPointToChildLocal` in reverse order.
 */
export function worldToLocal(
  nodes: ReadonlyMap<string, AtlasWorldSpaceNode> | Readonly<Record<string, AtlasWorldSpaceNode>>,
  mapId: string,
  point: AtlasPoint2,
): AtlasWorldResult<AtlasPoint2> {
  if (!finitePoint(point)) return { ok: false, error: 'invalid', atMapId: mapId };
  const chainRes = resolveWorldChain(nodes, mapId);
  if (isAtlasWorldError(chainRes)) return chainRes;

  let p: AtlasPoint2 = point;
  // Wurzel → map (umgekehrte Reihenfolge), Wurzel selbst hat keinen Anchor.
  for (let i = chainRes.value.length - 1; i >= 0; i -= 1) {
    const node = chainRes.value[i]!;
    const anchor = node.parentAnchor;
    if (!anchor) continue; // Wurzel überspringen
    p = parentPointToChildLocal(anchor, p, node.bounds ?? DEFAULT_ATLAS_BOUNDS);
    if (!finitePoint(p)) return { ok: false, error: 'invalid', atMapId: node.id };
  }
  return { ok: true, value: p, depth: chainRes.depth };
}

/** Kompakte Welt-Transform (alle Schritte) — nützlich für den Scene-Plan (SWS-03). */
export type AtlasWorldTransformChain = {
  readonly mapId: string;
  readonly depth: number;
  readonly nodeIds: readonly string[]; // map → … → root
};

export function describeWorldChain(
  nodes: ReadonlyMap<string, AtlasWorldSpaceNode> | Readonly<Record<string, AtlasWorldSpaceNode>>,
  mapId: string,
): AtlasWorldResult<AtlasWorldTransformChain> {
  const chainRes = resolveWorldChain(nodes, mapId);
  if (isAtlasWorldError(chainRes)) return chainRes;
  return {
    ok: true,
    depth: chainRes.depth,
    value: {
      mapId,
      depth: chainRes.depth,
      nodeIds: chainRes.value.map((n) => n.id),
    },
  };
}

// ─── Deutsche UI-Texte (Fehler sind produkt-sichtbar) ────────────────────────
export const WORLD_SPACE_ERROR_DE: Readonly<Record<AtlasWorldTransformError, string>> = {
  cycle: 'Hierarchie-Zyklus erkannt — Karte kann nicht in die Welt eingebettet werden.',
  unlocated: 'Ausschnitt nicht verortet — kein maßstabsgetreuer Weltbezug.',
  'missing-node': 'Elternkarte fehlt — Weltbezug unterbrochen.',
  shear: 'Verzerrter Raumanker — rotierte Ausschnitte müssen gleiche Ausdehnung haben.',
  invalid: 'Ungültige Koordinate.',
};

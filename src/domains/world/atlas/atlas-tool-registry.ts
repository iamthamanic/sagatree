/**
 * atlas-tool-registry — contextual AtlasTool allow-list by WorldNodeKind (#720).
 * Location: src/domains/world/atlas/atlas-tool-registry.ts
 *
 * Presentation chrome stays in the editor; this registry is the semantic SoT for
 * which tools are valid at a hierarchy tip (preview/commit/cancel/undo remain
 * editor-owned via MapEditOperation).
 */
import type { WorldNodeKind } from '../hierarchy';
import type { UnifiedCanvasTool } from './unified-canvas-doc';

export type AtlasToolId = UnifiedCanvasTool;

export type AtlasToolDef = {
  readonly id: AtlasToolId;
  readonly labelDe: string;
  /** Hierarchy tips where the tool is offered (empty = never). */
  readonly allowedKinds: readonly WorldNodeKind[];
  /** Prefer footprint / structural placement over decorative stamp. */
  readonly role: 'navigate' | 'terrain' | 'border' | 'path' | 'structure' | 'detail' | 'erase';
  readonly createsCanonicalNode: false;
};

/** Always available navigation tools. */
const NAV_TOOLS: readonly AtlasToolDef[] = [
  {
    id: 'hand',
    labelDe: 'Hand',
    allowedKinds: ['continent', 'country', 'place', 'building', 'room'],
    role: 'navigate',
    createsCanonicalNode: false,
  },
  {
    id: 'select',
    labelDe: 'Auswahl',
    allowedKinds: ['continent', 'country', 'place', 'building', 'room'],
    role: 'navigate',
    createsCanonicalNode: false,
  },
];

const CONTENT_TOOLS: readonly AtlasToolDef[] = [
  {
    id: 'brush',
    labelDe: 'Gelände',
    allowedKinds: ['continent', 'country'],
    role: 'terrain',
    createsCanonicalNode: false,
  },
  {
    id: 'road',
    labelDe: 'Weg / Grenze',
    allowedKinds: ['place', 'country'],
    role: 'border',
    createsCanonicalNode: false,
  },
  {
    id: 'wall',
    labelDe: 'Wand',
    allowedKinds: ['building', 'room'],
    role: 'structure',
    createsCanonicalNode: false,
  },
  {
    id: 'room',
    labelDe: 'Raumumriss',
    allowedKinds: ['building', 'room'],
    role: 'structure',
    createsCanonicalNode: false,
  },
  {
    id: 'stamp',
    labelDe: 'Footprint / Stempel',
    allowedKinds: ['place', 'building'],
    role: 'structure',
    createsCanonicalNode: false,
  },
  {
    id: 'erase',
    labelDe: 'Radierer',
    allowedKinds: ['continent', 'country', 'place', 'building', 'room'],
    role: 'erase',
    createsCanonicalNode: false,
  },
];

export const ATLAS_TOOL_REGISTRY: readonly AtlasToolDef[] = [...NAV_TOOLS, ...CONTENT_TOOLS];

/**
 * Tools allowed for the active hierarchy tip. When tip is null (world root /
 * unknown), expose navigation + terrain only.
 */
export function atlasToolsForKind(kind: WorldNodeKind | null): readonly AtlasToolDef[] {
  if (kind === null) {
    return ATLAS_TOOL_REGISTRY.filter(
      (t) => t.id === 'hand' || t.id === 'select' || t.id === 'brush' || t.id === 'erase',
    );
  }
  return ATLAS_TOOL_REGISTRY.filter((t) => t.allowedKinds.includes(kind));
}

export function isAtlasToolAllowed(
  toolId: AtlasToolId,
  kind: WorldNodeKind | null,
): boolean {
  return atlasToolsForKind(kind).some((t) => t.id === toolId);
}

/**
 * WebGL runtime tool ids (prototype uses `paint` for registry `brush`).
 * `select` / `road` are listed for chrome but may be disabled until fully wired.
 */
export type WebglRuntimeToolId =
  | 'hand'
  | 'select'
  | 'paint'
  | 'road'
  | 'stamp'
  | 'wall'
  | 'room'
  | 'erase';

const WEBGL_RUNTIME_SUPPORT: Readonly<Record<AtlasToolId, boolean>> = {
  hand: true,
  select: false,
  brush: true,
  road: false,
  wall: true,
  room: true,
  stamp: true,
  erase: true,
};

/** Map registry id → runtime data-tool id. */
export function atlasToolToWebglRuntimeId(toolId: AtlasToolId): WebglRuntimeToolId {
  if (toolId === 'brush') return 'paint';
  return toolId;
}

/** Inverse: runtime id → registry id (for allow checks). */
export function webglRuntimeIdToAtlasTool(runtimeId: string): AtlasToolId | null {
  if (runtimeId === 'paint') return 'brush';
  const known: readonly AtlasToolId[] = [
    'hand',
    'select',
    'brush',
    'road',
    'wall',
    'room',
    'stamp',
    'erase',
  ];
  return known.includes(runtimeId as AtlasToolId) ? (runtimeId as AtlasToolId) : null;
}

export type WebglToolChromeItem = {
  readonly atlasId: AtlasToolId;
  readonly runtimeId: WebglRuntimeToolId;
  readonly labelDe: string;
  readonly role: AtlasToolDef['role'];
  readonly enabled: boolean;
  readonly disabledReason: string | null;
  readonly createsCanonicalNode: false;
};

/**
 * Product WebGL toolbar rows for a hierarchy tip — always from ATLAS_TOOL_REGISTRY.
 * Unsupported runtime tools stay visible but disabled (no silent drop).
 */
export function webglToolChromeForKind(
  kind: WorldNodeKind | null,
): readonly WebglToolChromeItem[] {
  return atlasToolsForKind(kind).map((t) => {
    const supported = WEBGL_RUNTIME_SUPPORT[t.id];
    return {
      atlasId: t.id,
      runtimeId: atlasToolToWebglRuntimeId(t.id),
      labelDe: t.labelDe,
      role: t.role,
      enabled: supported,
      disabledReason: supported ? null : 'In 3D noch nicht verfügbar',
      createsCanonicalNode: false as const,
    };
  });
}

/** Safe fallback when tip/kind changes invalidate the active tool. */
export function resolveWebglToolAfterKindChange(
  runtimeToolId: string,
  kind: WorldNodeKind | null,
): WebglRuntimeToolId {
  const atlas = webglRuntimeIdToAtlasTool(runtimeToolId);
  if (atlas && isAtlasToolAllowed(atlas, kind) && WEBGL_RUNTIME_SUPPORT[atlas]) {
    return atlasToolToWebglRuntimeId(atlas);
  }
  return 'hand';
}

/**
 * Reject illegal kind-tool pairs and unauthorized commits (presentation ≠ authz;
 * RPC/RLS remain the authority — this blocks client-side optimistic writes).
 */
export function assertWebglToolCommit(input: {
  readonly runtimeToolId: string;
  readonly kind: WorldNodeKind | null;
  readonly canEdit: boolean;
}): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (!input.canEdit) {
    return { ok: false, reason: 'Keine Bearbeitungsrechte' };
  }
  const atlas = webglRuntimeIdToAtlasTool(input.runtimeToolId);
  if (!atlas) {
    return { ok: false, reason: 'Unbekanntes Werkzeug' };
  }
  if (!isAtlasToolAllowed(atlas, input.kind)) {
    return { ok: false, reason: 'Werkzeug für diese Ebene nicht erlaubt' };
  }
  if (!WEBGL_RUNTIME_SUPPORT[atlas]) {
    return { ok: false, reason: 'Werkzeug in 3D nicht verfügbar' };
  }
  return { ok: true };
}

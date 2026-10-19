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
    labelDe: 'Weg',
    allowedKinds: ['place', 'country'],
    role: 'path',
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

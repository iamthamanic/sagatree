/**
 * unified atlas barrel — Canvas multi-scale editor + productive Custom-WebGL 3D host.
 * Location: src/app/world/atlas/unified/index.ts
 *
 * ATL2-H01 (#1234): `AtlasSpatialViewport` (Three.js inventory) is intentionally NOT
 * re-exported — quarantined non-product path per ADR-ST-10 until #1296 decides reuse.
 */
export { UnifiedAtlasEditor } from './UnifiedAtlasEditor';
export type {
  UnifiedAtlasCreatePlaceInput,
  UnifiedAtlasEditorProps,
} from './UnifiedAtlasEditor';
export { AtlasDefinePlacePanel } from './AtlasDefinePlacePanel';
export type {
  AtlasDefinePlacePanelProps,
  AtlasDefinePlaceRequest,
} from './AtlasDefinePlacePanel';
export { AtlasNative3dEditor } from './AtlasNative3dEditor';
export type { AtlasNative3dEditorProps } from './AtlasNative3dEditor';

/**
 * atlas-native-3d-look — pure dungeon-look resolution + remount key for the 3D host.
 * Location: src/app/world/atlas/unified/atlas-native-3d-look.ts
 *
 * G05 Undo/Redo root cause: AtlasNative3dEditor remounted the WebGL runtime whenever the
 * `dungeonLookDoc` object identity changed — i.e. on every canvas edit — which wiped the
 * runtime's undo history. The host now remounts only when this *value* key changes.
 */
import {
  buildAtlasDungeonLookPlan,
  emptyUnifiedCanvasDoc,
  type AtlasDungeonLookPlan,
  type AtlasGraphicsPresetId,
  type DungeonThemeKey,
  type UnifiedCanvasDoc,
} from '../../../../domains/world/atlas';

export type AtlasNative3dDungeonLook = {
  readonly themeKey: string;
  readonly floor: string;
  readonly wall: string;
  readonly door: string;
  readonly accent: string;
  readonly light: string;
  readonly torchIntensity: number;
  readonly bloomEnabled: boolean;
  readonly particlesEnabled: boolean;
  readonly maxTorchInstances: number;
  readonly maxInstances: number;
  readonly fogDensity: number;
  readonly fogColor: string;
  readonly clearColor: AtlasDungeonLookPlan['light']['clearColor'];
  readonly ambient: number;
  readonly daylightDir: AtlasDungeonLookPlan['light']['daylightDir'];
  readonly shadowStrength: number;
  readonly geometryFingerprint: string;
  readonly lookFingerprint: string;
  readonly floorIds: readonly string[];
  readonly wallIds: readonly string[];
  readonly doorIds: readonly string[];
  readonly torchIds: readonly string[];
  readonly propIds: readonly string[];
};

/** ATL2-F04 dungeon look for the runtime; null for non-dungeon maps (diorama light stays). */
export function resolveAtlasNative3dDungeonLook(
  doc: UnifiedCanvasDoc | null,
  themeKey: DungeonThemeKey | null,
  graphicsPresetId: AtlasGraphicsPresetId,
): AtlasNative3dDungeonLook | null {
  const plan: AtlasDungeonLookPlan = buildAtlasDungeonLookPlan(doc ?? emptyUnifiedCanvasDoc(false), {
    themeKey,
    graphicsPresetId,
  });
  if (plan.counts.instances <= 0) return null;
  const batchIds = (kind: AtlasDungeonLookPlan['batches'][number]['kind']) =>
    plan.batches.find((b) => b.kind === kind)?.instanceIds ?? [];
  return {
    themeKey: plan.themeKey,
    floor: plan.palette.floor,
    wall: plan.palette.wall,
    door: plan.palette.door,
    accent: plan.palette.accent,
    light: plan.palette.light,
    torchIntensity: plan.light.torchIntensity,
    bloomEnabled: plan.budget.bloomEnabled,
    particlesEnabled: plan.budget.particlesEnabled,
    maxTorchInstances: plan.budget.maxTorchInstances,
    maxInstances: plan.budget.maxInstances,
    fogDensity: plan.light.fogDensity,
    fogColor: plan.light.fogColor,
    clearColor: plan.light.clearColor,
    ambient: plan.light.ambient,
    daylightDir: plan.light.daylightDir,
    shadowStrength: plan.light.shadowStrength,
    geometryFingerprint: plan.geometryFingerprint,
    lookFingerprint: plan.lookFingerprint,
    /* Empty arrays mean deny-all for that kind (exhausted budget). */
    floorIds: [...batchIds('floor')],
    wallIds: [...batchIds('wall')],
    doorIds: [...batchIds('door')],
    torchIds: [...batchIds('torch')],
    propIds: [...batchIds('prop')],
  };
}

/**
 * Value key for remounting: changes only when the dungeon look (theme, palette, light,
 * batched instance ids) changes — never for plain prop/stroke edits on non-dungeon maps.
 */
export function atlasNative3dDungeonLookKey(look: AtlasNative3dDungeonLook | null): string {
  if (!look) return 'none';
  return [
    look.themeKey,
    look.lookFingerprint,
    look.geometryFingerprint,
    look.floorIds.join(','),
    look.wallIds.join(','),
    look.doorIds.join(','),
    look.torchIds.join(','),
    look.propIds.join(','),
  ].join('|');
}

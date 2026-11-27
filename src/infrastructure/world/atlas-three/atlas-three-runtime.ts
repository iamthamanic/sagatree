/**
 * atlas-three-runtime — Productive interactive Three.js Atlas engine (ADR-ST-11 / V7-V17).
 * Location: src/infrastructure/world/atlas-three/atlas-three-runtime.ts
 *
 * Features:
 *  - Camera-following INFINITE Ocean / Meadow / Cavern horizon planes + Atmospheric Sky Dome
 *    + exponential FogExp2 so ZERO square edges ever appear at any zoom level.
 *  - Silky Google-Maps inertia zoom & pan with cursor-pinned logarithmic scaling and
 *    automatic zoom-based Diorama pitch curve.
 *  - V7/V8 Dornhain visual craft: procedural PBR textures, PCFShadowMap, ACES Filmic,
 *    ground contact AO discs, animated chimney smoke, alpine peak mist, warm lanterns/torches,
 *    multi-cluster instanced trees/mountains, and PBR / Illustrativ / Cel style presets.
 *  - Interactive 3D Tactical Battle Grid, 3D raycast picking, Cyan/Gold Transform Gizmo,
 *    WebGL context-loss recovery, and screen-projected HTML Place Pins.
 */
import * as THREE from 'three';
import {
  buildAtlasWorldScenePlan,
  createAtlasWorldCameraState,
  type AtlasGraphicsPresetId,
  type AtlasMapPin,
  type AtlasMapScale,
  type AtlasScatterKind,
  type AtlasWorldCameraState,
  type AtlasWorldSceneMapInput,
  type AtlasWorldScenePlan,
  type UnifiedCanvasDoc,
} from '../../../domains/world/atlas';
import {
  AtlasThreeMultiMapGraph,
  type AtlasThreeMultiMapStats,
  type AtlasThreeWorldMapSource,
} from './atlas-three-multimap';
import {
  autoAtlasThreePitchForSpan,
  buildAtlasThreeCameraRig,
  buildAtlasThreeFogBand,
  clampAtlasThreePitch,
  dampAtlasThreeView,
  defaultAtlasThreePitch,
  interpolateAtlasThreeView,
  solveAnchoredCameraFocus,
  type AtlasThreeCameraMode,
  type AtlasThreeCameraView,
  type AtlasThreeWorldPoint3,
} from './atlas-three-camera';
import {
  ATLAS_THREE_SURFACES,
  buildAtlasScatterGeometry,
  buildAtlasThreeScenePlan,
  type AtlasThreeLook,
  type AtlasThreeScenePlan,
  type AtlasThreeSurfaceKey,
} from './atlas-three-scene';
import { AtlasPbrTextureLibrary } from './pbr-textures';

export type AtlasThreeLightingMode = 'day' | 'evening' | 'night';
export type AtlasThreeStyleMode = 'pbr' | 'illustrated' | 'cel';

export type AtlasThreeProjectedPin = {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly left: number;
  readonly top: number;
  readonly visible: boolean;
};

export type AtlasThreeRuntimeConfig = {
  readonly canvas: HTMLCanvasElement;
  readonly presetId: AtlasGraphicsPresetId;
  readonly onCameraChange?: (view: AtlasThreeCameraView) => void;
  readonly onProjectedPins?: (pins: readonly AtlasThreeProjectedPin[]) => void;
  readonly onContextLostChange?: (lost: boolean) => void;
  /** SCM-05 / SCM-07: emits camera-driven `activeEditorMapId` from AtlasWorldScenePlan without doc-swap. */
  readonly onActiveEditorMapChange?: (mapId: string | null) => void;
};

type LightingSpec = {
  readonly skyZenith: string;
  readonly skyHorizon: string;
  readonly sunGlow: string;
  readonly hemiSky: string;
  readonly hemiGround: string;
  readonly hemiIntensity: number;
  readonly sunColor: string;
  readonly sunIntensity: number;
  readonly fillColor: string;
  readonly fillIntensity: number;
  readonly exposure: number;
  readonly waterDeep: string;
  readonly waterShallow: string;
  readonly waterSky: string;
  readonly meadowLight: string;
  readonly meadowDark: string;
  readonly sunDir: readonly [number, number, number];
};

const OUTDOOR_LIGHTING: Readonly<Record<AtlasThreeLightingMode, LightingSpec>> = {
  day: {
    // Balanced sunlit V8 Dornhain golden-afternoon atmosphere (crisp relief & shadows, no washout)
    skyZenith: '#386d86',
    skyHorizon: '#98bec3',
    sunGlow: '#ffefd0',
    hemiSky: '#dfece2',
    hemiGround: '#4a5f42',
    hemiIntensity: 1.62,
    sunColor: '#ffe4bc',
    sunIntensity: 3.15,
    fillColor: '#91bcd4',
    fillIntensity: 0.68,
    exposure: 1.06,
    waterDeep: '#12465d',
    waterShallow: '#318696',
    waterSky: '#a4cbd0',
    meadowLight: '#83a85d',
    meadowDark: '#567c44',
    sunDir: [-12, 16, 10],
  },
  evening: {
    skyZenith: '#2c3d59',
    skyHorizon: '#b9836a',
    sunGlow: '#ffba73',
    hemiSky: '#f2c199',
    hemiGround: '#433b42',
    hemiIntensity: 1.4,
    sunColor: '#ffaa5c',
    sunIntensity: 3.55,
    fillColor: '#8ba2c7',
    fillIntensity: 0.62,
    exposure: 1.12,
    waterDeep: '#1d394f',
    waterShallow: '#4e6f82',
    waterSky: '#dfa580',
    meadowLight: '#869653',
    meadowDark: '#52633c',
    sunDir: [-18, 8.5, 11],
  },
  night: {
    skyZenith: '#0a1421',
    skyHorizon: '#1c3145',
    sunGlow: '#9ec2f0',
    hemiSky: '#6d8cb8',
    hemiGround: '#1e2733',
    hemiIntensity: 0.92,
    sunColor: '#b7d0f5',
    sunIntensity: 1.42,
    fillColor: '#4c6588',
    fillIntensity: 0.48,
    exposure: 1.02,
    waterDeep: '#0a1c2b',
    waterShallow: '#1b3e52',
    waterSky: '#4a688c',
    meadowLight: '#3b5748',
    meadowDark: '#263a33',
    sunDir: [8, 15, -10],
  },
};

const INDOOR_LIGHTING: LightingSpec = {
  skyZenith: '#11161d',
  skyHorizon: '#191f26',
  sunGlow: '#ffd4a3',
  hemiSky: '#c9bba6',
  hemiGround: '#4a3829',
  hemiIntensity: 1.55,
  sunColor: '#ffe0b4',
  sunIntensity: 2.6,
  fillColor: '#a6b8cc',
  fillIntensity: 0.56,
  exposure: 1.16,
  waterDeep: '#102f3a',
  waterShallow: '#2a6670',
  waterSky: '#4e6c72',
  meadowLight: '#242930',
  meadowDark: '#14181e',
  sunDir: [-9, 17, 7],
};

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunGlow;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.58));
  float sunAmt = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunGlow * pow(sunAmt, 14.0) * 0.28;
  col += uSunGlow * pow(sunAmt, 128.0) * 0.45;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const WATER_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const WATER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uTile;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform vec2 uFocus;
uniform float uSpan;
uniform float uOpacity;
uniform sampler2D uWorldHeightTex;
uniform float uHasWorldHeight;
uniform float uHeightMin;
uniform float uHeightMax;
uniform float uWaterLevel;
varying vec3 vWorld;

float wave(vec2 p) {
  return sin(p.x * 1.18 + p.y * 0.34 + uTime * 0.72) * 0.36
       + sin(p.y * 1.62 - p.x * 0.41 - uTime * 0.58) * 0.28
       + sin((p.x - p.y) * 2.55 + uTime * 0.98) * 0.20
       + sin((p.x * 1.3 + p.y * 0.9) * 4.7 - uTime * 1.28) * 0.16;
}

void main() {
  // Multi-scale crisp ocean ripples (no low-res diagonal banding!)
  vec2 p = vWorld.xz / uTile;
  float h1 = wave(p * 1.65);
  float h2 = wave(p * 4.2 + vec2(3.7, -2.3));
  float eps = 0.06;
  float gx = (wave((p + vec2(eps, 0.0)) * 1.65) - h1) * 0.65
           + (wave((p + vec2(eps * 0.6, 0.0)) * 4.2 + vec2(3.7, -2.3)) - h2) * 0.32;
  float gz = (wave((p + vec2(0.0, eps)) * 1.65) - h1) * 0.65
           + (wave((p + vec2(0.0, eps * 0.6)) * 4.2 + vec2(3.7, -2.3)) - h2) * 0.32;
  vec3 n = normalize(vec3(gx, 0.82, gz));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.6);

  // Real world-heightfield bathymetry & organic shoreline surf hugging actual continents!
  float coastal = 0.0;
  float foam = 0.0;
  if (uHasWorldHeight > 0.5) {
    vec2 huv = vWorld.xz / 1000.0;
    if (huv.x >= 0.0 && huv.x <= 1.0 && huv.y >= 0.0 && huv.y <= 1.0) {
      float hNorm = texture2D(uWorldHeightTex, huv).r;
      float bedH = mix(uHeightMin, uHeightMax, hNorm);
      float depth = uWaterLevel - bedH;
      coastal = 1.0 - smoothstep(0.0, 7.2, max(0.0, depth));
      // Subtle animated shoreline surf ripples right where terrain emerges from the sea
      float shoreBand = (1.0 - smoothstep(0.0, 1.35, abs(depth - 0.25)));
      float surfWave = 0.5 + 0.5 * sin(depth * 9.5 - uTime * 2.1 + h1 * 3.0);
      foam = shoreBand * smoothstep(0.42, 0.88, surfWave) * 0.42;
    }
  } else {
    float centerDist = length(vWorld.xz - vec2(500.0, 500.0));
    coastal = 1.0 - smoothstep(260.0, 920.0, centerDist);
  }

  float swell = 0.5 + 0.5 * sin(vWorld.x * 0.015 + uTime * 0.32) * cos(vWorld.z * 0.017 - uTime * 0.25);
  vec3 col = mix(uDeep, uShallow, clamp(0.14 + coastal * 0.64 + 0.12 * h1 + 0.06 * swell, 0.0, 1.0));
  col = mix(col, uSky, clamp(fres * 0.34, 0.0, 0.5));
  col = mix(col, vec3(0.87, 0.94, 0.93), clamp(foam, 0.0, 0.48));
  // Sunlit wave glint
  col += vec3(1.0, 0.96, 0.86) * pow(max(dot(reflect(-normalize(uSunDir), n), v), 0.0), 76.0) * 0.44;
  // Seamless distant horizon melt
  float horizDist = length(vWorld.xz - uFocus);
  float fogF = smoothstep(uSpan * 2.4, uSpan * 7.2, horizDist);
  col = mix(col, uFogColor, clamp(fogF * 0.86, 0.0, 1.0));
  gl_FragColor = vec4(col, clamp(uOpacity, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const MEADOW_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const MEADOW_FRAGMENT = /* glsl */ `
uniform vec3 uLight;
uniform vec3 uDark;
uniform vec3 uFogColor;
uniform vec2 uFocus;
uniform float uSpan;
uniform float uIndoor;
varying vec3 vWorld;

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
    mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec2 w = vWorld.xz;
  float macro = vnoise(w * 0.0075) * 0.58 + vnoise(w * 0.022) * 0.42;
  float blade = vnoise(w * 0.19) * 0.65 + vnoise(w * 0.48) * 0.35;
  vec3 col = mix(uDark, uLight, clamp(macro * 0.78 + blade * 0.28, 0.0, 1.0));
  if (uIndoor > 0.5) {
    // Deep cavern stone grain & radial shadow for underground dungeons
    float d = length(w - vec2(500.0, 500.0));
    col *= mix(1.08, 0.52, smoothstep(170.0, 820.0, d));
  } else {
    // Warm sunlit golden-meadow patches (V7/V8 Dornhain warmth)
    float sunPatch = smoothstep(0.56, 0.84, vnoise(w * 0.012 + vec2(11.3, -4.7)));
    col = mix(col, col * vec3(1.12, 1.08, 0.88), sunPatch * 0.45);
  }
  // Fragment-accurate distant horizon melt (keeps village/dungeon meadow 100% lush & crisp!)
  float horizDist = length(vWorld.xz - uFocus);
  float fogF = smoothstep(uSpan * 2.2, uSpan * 6.4, horizDist);
  col = mix(col, uFogColor, clamp(fogF * 0.88, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const GRID_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const GRID_FRAGMENT = /* glsl */ `
uniform float uStep;
uniform vec3 uColor;
uniform vec2 uFocus;
uniform float uSpan;
uniform float uOpacity;
varying vec3 vWorld;
void main() {
  vec2 coord = vWorld.xz / uStep;
  vec2 fw = max(fwidth(coord), vec2(0.0005));
  vec2 grid = abs(fract(coord - 0.5) - 0.5) / fw;
  float line = min(grid.x, grid.y);
  float minorAlpha = (1.0 - min(line, 1.0)) * 0.42;

  // Major 5-square tactical lines slightly stronger for tabletop readability
  vec2 majorCoord = coord * 0.2;
  vec2 majorFw = max(fwidth(majorCoord), vec2(0.0005));
  vec2 majorGrid = abs(fract(majorCoord - 0.5) - 0.5) / majorFw;
  float majorLine = min(majorGrid.x, majorGrid.y);
  float majorAlpha = (1.0 - min(majorLine, 1.0)) * 0.68;

  float dist = length(vWorld.xz - uFocus);
  float distFade = 1.0 - smoothstep(uSpan * 0.95, uSpan * 2.4, dist);
  float finalAlpha = max(minorAlpha, majorAlpha) * distFade;
  if (finalAlpha < 0.025) discard;
  gl_FragColor = vec4(uColor, finalAlpha);
}`;

function createRadialSoftTexture(innerRgba: string, midRgba: string, outerRgba: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, innerRgba);
    g.addColorStop(0.42, midRgba);
    g.addColorStop(1, outerRgba);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createProceduralWarmEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0.0, '#4a7fa0');
    grad.addColorStop(0.35, '#9cc4d0');
    grad.addColorStop(0.5, '#f5dfc0');
    grad.addColorStop(0.62, '#8b7a5e');
    grad.addColorStop(1.0, '#2a332b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 64);
    // Warm sunlit highlight spot for realistic specular gleam on brass, roofs & wood
    const sunGrad = ctx.createRadialGradient(34, 20, 1, 34, 20, 22);
    sunGrad.addColorStop(0, 'rgba(255, 246, 220, 0.95)');
    sunGrad.addColorStop(0.45, 'rgba(255, 214, 150, 0.45)');
    sunGrad.addColorStop(1, 'rgba(255, 214, 150, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, 128, 64);
  }
  const src = new THREE.CanvasTexture(c);
  src.mapping = THREE.EquirectangularReflectionMapping;
  src.colorSpace = THREE.SRGBColorSpace;
  src.flipY = false;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(src).texture;
  src.dispose();
  pmrem.dispose();
  return env;
}

export class AtlasThreeRuntime {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private readonly root = new THREE.Group();
  private readonly multiMap: AtlasThreeMultiMapGraph;
  private worldMaps: readonly AtlasWorldSceneMapInput[] = [];
  private worldSources = new Map<string, AtlasThreeWorldMapSource>();
  private worldScenePlan: AtlasWorldScenePlan | null = null;
  private focusTargetMapId: string | null = null;
  private lastReportedEditorMapId: string | null | undefined = undefined;
  private clearRootCount = 0;
  private readonly gizmoGroup = new THREE.Group();
  private readonly selectionRing: THREE.Mesh;
  private readonly gizmoAxisX: THREE.Mesh;
  private readonly gizmoAxisZ: THREE.Mesh;
  private readonly skyDome: THREE.Mesh;
  private readonly skyMat: THREE.ShaderMaterial;
  private readonly infiniteOcean: THREE.Mesh;
  private readonly infiniteMeadow: THREE.Mesh;
  private readonly meadowMat: THREE.ShaderMaterial;
  private readonly gridMesh: THREE.Mesh;
  private readonly gridMat: THREE.ShaderMaterial;
  private readonly hemi = new THREE.HemisphereLight();
  private readonly sun = new THREE.DirectionalLight();
  private readonly fill = new THREE.DirectionalLight();
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = new THREE.OrthographicCamera();
  private readonly pbr: AtlasPbrTextureLibrary;
  private readonly materials = new Map<AtlasThreeSurfaceKey, THREE.MeshStandardMaterial>();
  private readonly waterMat: THREE.ShaderMaterial;
  private readonly haloMat: THREE.SpriteMaterial;
  private readonly haloTex: THREE.CanvasTexture;
  private readonly aoMat: THREE.MeshBasicMaterial;
  private readonly aoTex: THREE.CanvasTexture;
  private readonly mistMat: THREE.SpriteMaterial;
  private readonly mistTex: THREE.CanvasTexture;
  private readonly smokePuffs: Array<{
    readonly sprite: THREE.Sprite;
    readonly base: THREE.Vector3;
    readonly phase: number;
  }> = [];
  private readonly torchLights: Array<{
    readonly light: THREE.PointLight;
    readonly baseIntensity: number;
    readonly phase: number;
  }> = [];
  private readonly envMap: THREE.Texture;
  private readonly pickables: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private presetId: AtlasGraphicsPresetId;
  private doc: UnifiedCanvasDoc | null = null;
  private mapScale: AtlasMapScale = 'world';
  private look: AtlasThreeLook = 'outdoor';
  private seed = 'dornhain.unified.v4';
  private hideRoofs = false;
  private lightingMode: AtlasThreeLightingMode = 'day';
  private styleMode: AtlasThreeStyleMode = 'pbr';
  private showGrid = false;
  private pins: readonly AtlasMapPin[] = [];
  private selectedId: string | null = null;
  private gizmoVisible = false;
  private plan: AtlasThreeScenePlan | null = null;
  private sceneKey = '';
  private docRevision = 0;
  private manualPitchOverride = false;
  private view: AtlasThreeCameraView = {
    mode: 'diorama-oblique',
    x: 500,
    z: 500,
    span: 430,
    yawRad: 0.42,
    pitchRad: autoAtlasThreePitchForSpan('diorama-oblique', 430),
  };
  private targetView: AtlasThreeCameraView = { ...this.view };
  /** Active cursor-pinned 3D world anchor maintained across every intermediate damped frame (Phase A). */
  private zoomAnchor: {
    readonly anchorWorld: AtlasThreeWorldPoint3;
    readonly targetNdcX: number;
    readonly targetNdcY: number;
    readonly screenPx: number;
    readonly screenPy: number;
  } | null = null;
  private flight: {
    readonly from: AtlasThreeCameraView;
    readonly to: AtlasThreeCameraView;
    readonly startMs: number;
    readonly durationMs: number;
  } | null = null;
  private rafId = 0;
  private startTime = performance.now();
  private lastFrameMs = performance.now();
  private lastCameraNotifyMs = 0;
  private lastPinEmitKey = '';
  private disposed = false;
  private contextLost = false;
  private readonly onCameraChange?: (view: AtlasThreeCameraView) => void;
  private readonly onProjectedPins?: (pins: readonly AtlasThreeProjectedPin[]) => void;
  private readonly onContextLostChange?: (lost: boolean) => void;
  private readonly onContextLostListener: (ev: Event) => void;
  private readonly onContextRestoredListener: () => void;

  constructor(private readonly config: AtlasThreeRuntimeConfig) {
    this.presetId = config.presetId;
    this.onCameraChange = config.onCameraChange;
    this.onProjectedPins = config.onProjectedPins;
    this.onContextLostChange = config.onContextLostChange;

    this.renderer = new THREE.WebGLRenderer({
      canvas: config.canvas,
      antialias: config.presetId !== 'lite',
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.applyQualityProfile(config.presetId);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const texSize = config.presetId === 'high' ? 512 : 256;
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.pbr = new AtlasPbrTextureLibrary(texSize, aniso);
    this.envMap = createProceduralWarmEnvMap(this.renderer);
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.58;

    // 1) Atmospheric Sky Dome (follows camera — seamless horizon!)
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color('#3e748c') },
        uHorizon: { value: new THREE.Color('#9ec2c6') },
        uSunGlow: { value: new THREE.Color('#fff1d1') },
        uSunDir: { value: new THREE.Vector3(-12, 16, 10).normalize() },
      },
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(18000, 32, 16), this.skyMat);
    this.skyDome.frustumCulled = false;
    this.skyDome.renderOrder = -10;

    // 2) Infinite Ocean Plane (28,000×28,000, locked to camera X/Z every frame — ZERO square borders!)
    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uTile: { value: 26 },
        uDeep: { value: new THREE.Color('#134f6e') },
        uShallow: { value: new THREE.Color('#2f8ea1') },
        uSky: { value: new THREE.Color('#a8cfd4') },
        uSunDir: { value: new THREE.Vector3(-12, 16, 10).normalize() },
        uFogColor: { value: new THREE.Color('#9ec2c6') },
        uFocus: { value: new THREE.Vector2(500, 500) },
        uSpan: { value: 430 },
        uOpacity: { value: 1.0 },
        uWorldHeightTex: { value: null },
        uHasWorldHeight: { value: 0.0 },
        uHeightMin: { value: -12.0 },
        uHeightMax: { value: 36.0 },
        uWaterLevel: { value: 0.0 },
      },
    });
    const oceanGeo = new THREE.PlaneGeometry(28000, 28000, 1, 1);
    oceanGeo.rotateX(-Math.PI / 2);
    this.infiniteOcean = new THREE.Mesh(oceanGeo, this.waterMat);
    this.infiniteOcean.frustumCulled = false;
    this.infiniteOcean.renderOrder = 1;

    // 3) Infinite Meadow / Cavern Horizon Plane (for settlement / interior scales — zero edges!)
    this.meadowMat = new THREE.ShaderMaterial({
      vertexShader: MEADOW_VERTEX,
      fragmentShader: MEADOW_FRAGMENT,
      side: THREE.DoubleSide,
      uniforms: {
        uLight: { value: new THREE.Color('#8bb562') },
        uDark: { value: new THREE.Color('#5d874a') },
        uFogColor: { value: new THREE.Color('#9ec2c6') },
        uFocus: { value: new THREE.Vector2(500, 500) },
        uSpan: { value: 220 },
        uIndoor: { value: 0 },
      },
    });
    const meadowGeo = new THREE.PlaneGeometry(28000, 28000, 1, 1);
    meadowGeo.rotateX(-Math.PI / 2);
    this.infiniteMeadow = new THREE.Mesh(meadowGeo, this.meadowMat);
    this.infiniteMeadow.frustumCulled = false;
    this.infiniteMeadow.receiveShadow = true;

    // 4) Interactive 3D Tactical Battle Grid (toggled via bottom taskbar ▦ button!)
    this.gridMat = new THREE.ShaderMaterial({
      vertexShader: GRID_VERTEX,
      fragmentShader: GRID_FRAGMENT,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      uniforms: {
        uStep: { value: 40 },
        uColor: { value: new THREE.Color('#06b6d4') },
        uFocus: { value: new THREE.Vector2(500, 500) },
        uSpan: { value: 220 },
      },
    });
    const gridGeo = new THREE.PlaneGeometry(8000, 8000, 1, 1);
    gridGeo.rotateX(-Math.PI / 2);
    this.gridMesh = new THREE.Mesh(gridGeo, this.gridMat);
    this.gridMesh.frustumCulled = false;
    this.gridMesh.renderOrder = 4;
    this.gridMesh.visible = false;

    this.sun.castShadow = true;
    this.scene.add(
      this.skyDome,
      this.infiniteOcean,
      this.infiniteMeadow,
      this.gridMesh,
      this.hemi,
      this.sun,
      this.sun.target,
      this.fill,
      this.fill.target,
      this.root,
      this.gizmoGroup,
    );

    // 5) 3D Selection Ring + Transform Gizmo handles (SagaTree Cyan + Gold)
    const ringGeo = new THREE.RingGeometry(0.85, 1.0, 48);
    ringGeo.rotateX(-Math.PI / 2);
    this.selectionRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        side: THREE.DoubleSide,
        depthWrite: false,
        transparent: true,
        opacity: 0.94,
      }),
    );
    const axisGeoX = new THREE.BoxGeometry(1.6, 0.08, 0.08);
    axisGeoX.translate(0.8, 0.14, 0);
    this.gizmoAxisX = new THREE.Mesh(
      axisGeoX,
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false }),
    );
    const axisGeoZ = new THREE.BoxGeometry(0.08, 0.08, 1.6);
    axisGeoZ.translate(0, 0.14, 0.8);
    this.gizmoAxisZ = new THREE.Mesh(
      axisGeoZ,
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, depthTest: false }),
    );
    this.gizmoGroup.add(this.selectionRing, this.gizmoAxisX, this.gizmoAxisZ);
    this.gizmoGroup.visible = false;

    // 6) Atmospheric sprite & contact-shadow textures
    this.haloTex = createRadialSoftTexture(
      'rgba(255,240,198,1)',
      'rgba(255,178,94,0.52)',
      'rgba(255,140,60,0)',
    );
    this.haloMat = new THREE.SpriteMaterial({
      map: this.haloTex,
      color: 0xffb86c,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.aoTex = createRadialSoftTexture(
      'rgba(10,18,14,0.52)',
      'rgba(10,18,14,0.22)',
      'rgba(10,18,14,0)',
    );
    this.aoMat = new THREE.MeshBasicMaterial({
      map: this.aoTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.mistTex = createRadialSoftTexture(
      'rgba(232,242,244,0.38)',
      'rgba(220,235,238,0.16)',
      'rgba(210,228,232,0)',
    );
    this.mistMat = new THREE.SpriteMaterial({
      map: this.mistTex,
      transparent: true,
      depthWrite: false,
      fog: true,
    });

    this.onContextLostListener = (ev: Event) => {
      ev.preventDefault();
      this.contextLost = true;
      this.onContextLostChange?.(true);
    };
    this.onContextRestoredListener = () => {
      this.contextLost = false;
      this.sceneKey = '';
      this.onContextLostChange?.(false);
    };
    this.multiMap = new AtlasThreeMultiMapGraph(
      (key) => this.getMaterial(key),
      this.waterMat,
      this.aoMat,
    );
    this.scene.add(this.multiMap.rootGroup);
    config.canvas.addEventListener('webglcontextlost', this.onContextLostListener);
    config.canvas.addEventListener('webglcontextrestored', this.onContextRestoredListener);

    this.startLoop();
  }

  applyQualityProfile(presetId: AtlasGraphicsPresetId): void {
    this.presetId = presetId;
    const maxDpr = presetId === 'high' ? 2 : presetId === 'balanced' ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    const shadowSize = presetId === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.radius = presetId === 'high' ? 3 : 1.5;
    this.sceneKey = '';
  }

  setSceneState(input: {
    readonly doc: UnifiedCanvasDoc;
    readonly mapScale: AtlasMapScale;
    readonly look: AtlasThreeLook;
    readonly seed: string;
    readonly hideRoofs: boolean;
    readonly lightingMode: AtlasThreeLightingMode;
    readonly styleMode?: AtlasThreeStyleMode;
    readonly showGrid?: boolean;
    readonly pins: readonly AtlasMapPin[];
    readonly selectedId: string | null;
    readonly gizmoVisible: boolean;
  }): void {
    const docChanged = this.doc !== input.doc;
    const scaleChanged = this.mapScale !== input.mapScale;
    const lookChanged = this.look !== input.look;
    const seedChanged = this.seed !== input.seed;
    const roofChanged = this.hideRoofs !== input.hideRoofs;
    const lightChanged = this.lightingMode !== input.lightingMode;
    const nextStyle = input.styleMode ?? this.styleMode;
    const styleChanged = this.styleMode !== nextStyle;
    this.doc = input.doc;
    this.mapScale = input.mapScale;
    this.look = input.look;
    this.seed = input.seed;
    this.hideRoofs = input.hideRoofs;
    this.lightingMode = input.lightingMode;
    this.styleMode = nextStyle;
    this.showGrid = Boolean(input.showGrid);
    this.gridMesh.visible = this.showGrid;
    this.pins = input.pins;
    this.selectedId = input.selectedId;
    this.gizmoVisible = input.gizmoVisible;
    if (styleChanged) {
      this.applyStyleToMaterials();
    }
    if (docChanged || scaleChanged || lookChanged || seedChanged || roofChanged || lightChanged) {
      this.docRevision += 1;
      this.sceneKey = '';
    }
    this.updateSelectionGizmo();
  }

  private applyStyleToMaterials(): void {
    for (const [key, mat] of this.materials) {
      const spec = ATLAS_THREE_SURFACES[key];
      if (this.styleMode === 'cel') {
        mat.roughness = Math.min(1, spec.roughness + 0.08);
        mat.normalScale.set(spec.normalScale * 0.35, spec.normalScale * 0.35);
      } else if (this.styleMode === 'illustrated') {
        mat.roughness = Math.min(1, spec.roughness + 0.03);
        mat.normalScale.set(spec.normalScale * 0.72, spec.normalScale * 0.72);
      } else {
        mat.roughness = spec.roughness;
        mat.normalScale.set(spec.normalScale, spec.normalScale);
      }
      mat.needsUpdate = true;
    }
    this.multiMap.applyStyleMode(this.styleMode);
  }

  setFocusTargetMapId(mapId: string | null): void {
    this.focusTargetMapId = mapId;
  }

  isFlightActive(): boolean {
    return this.flight !== null;
  }

  getActiveScenePlan(): AtlasWorldScenePlan | null {
    return this.worldScenePlan;
  }

  /**
   * Register the spatial world map hierarchy for incremental Multi-Map rendering
   * (SWS-04, Checklist D1–D5). When non-empty, `ensureScene()` mounts/updates
   * map groups at their `ParentSpatialAnchor` transforms without calling `clearRoot()`.
   */
  setWorldSceneGraph(input: {
    readonly maps: readonly AtlasWorldSceneMapInput[];
    readonly sources: readonly AtlasThreeWorldMapSource[];
  }): void {
    this.worldMaps = input.maps;
    this.worldSources = new Map(input.sources.map((s) => [s.mapId, s] as const));
    this.worldScenePlan = null;
    this.lastReportedEditorMapId = undefined;
  }

  getWorldCameraState(): AtlasWorldCameraState {
    return createAtlasWorldCameraState({
      focusWorld: { x: this.view.x, y: this.view.z, z: 0 },
      span: this.view.span,
      yawRad: this.view.yawRad,
      pitchRad: this.view.pitchRad,
      projection: this.view.mode,
    });
  }

  setWorldCameraState(
    state: AtlasWorldCameraState,
    animate = false,
    opts?: { readonly preserveMinSpan?: boolean },
  ): void {
    this.setView(
      {
        mode: state.projection,
        x: state.focusWorld.x,
        z: state.focusWorld.y,
        span: state.span,
        yawRad: state.yawRad,
        pitchRad: state.pitchRad,
      },
      animate,
      opts,
    );
  }

  /** Two-finger trackpad scroll / drag pan in screen pixels (respects camera yaw). */
  panByScreenDelta(deltaPxX: number, deltaPxY: number): AtlasThreeCameraView {
    this.flight = null;
    this.zoomAnchor = null;
    const h = Math.max(1, this.config.canvas.clientHeight || 800);
    const worldPerPx = (this.targetView.span * 2) / h;
    const dx = deltaPxX * worldPerPx;
    const dy = deltaPxY * worldPerPx;
    const cos = Math.cos(this.targetView.yawRad);
    const sin = Math.sin(this.targetView.yawRad);
    this.targetView = {
      ...this.targetView,
      x: this.targetView.x + (dx * cos + dy * sin),
      z: this.targetView.z + (-dx * sin + dy * cos),
    };
    return { ...this.targetView };
  }

  /** Incremental yaw/pitch orbit delta (Shift+Wheel / Trackpad orbit). */
  orbitByDelta(deltaYawRad: number, deltaPitchRad: number): AtlasThreeCameraView {
    this.flight = null;
    this.zoomAnchor = null;
    const nextMode: AtlasThreeCameraMode =
      this.targetView.mode === 'ortho-topdown' ? 'diorama-oblique' : this.targetView.mode;
    this.manualPitchOverride = true;
    this.targetView = {
      ...this.targetView,
      mode: nextMode,
      yawRad: this.targetView.yawRad + deltaYawRad,
      pitchRad: clampAtlasThreePitch(nextMode, this.targetView.pitchRad + deltaPitchRad),
    };
    return { ...this.targetView };
  }

  getMultiMapStats(): AtlasThreeMultiMapStats {
    const stats = this.multiMap.getStats();
    return {
      ...stats,
      clearRootCount: this.clearRootCount,
    };
  }

  getView(): AtlasThreeCameraView {
    return { ...this.view };
  }

  getTargetView(): AtlasThreeCameraView {
    return { ...this.targetView };
  }

  setView(
    next: Partial<AtlasThreeCameraView>,
    animate = false,
    opts?: {
      readonly manualPitch?: boolean;
      readonly preserveMinSpan?: boolean;
      readonly durationMs?: number;
    },
  ): void {
    this.zoomAnchor = null;
    const targetMode: AtlasThreeCameraMode = next.mode ?? this.targetView.mode;
    const minSpan = this.worldMaps.length > 0 || opts?.preserveMinSpan ? 0.08 : 16;
    const nextSpan = Math.max(minSpan, Math.min(2400, next.span ?? this.targetView.span));
    if (opts?.manualPitch) {
      this.manualPitchOverride = true;
    } else if (next.mode) {
      this.manualPitchOverride = false;
    }
    const pitch =
      next.pitchRad !== undefined
        ? clampAtlasThreePitch(targetMode, next.pitchRad)
        : next.mode || !this.manualPitchOverride
          ? autoAtlasThreePitchForSpan(targetMode, nextSpan)
          : this.targetView.pitchRad;
    const target: AtlasThreeCameraView = {
      mode: targetMode,
      x: next.x ?? this.targetView.x,
      z: next.z ?? this.targetView.z,
      span: nextSpan,
      yawRad: next.yawRad ?? this.targetView.yawRad,
      pitchRad: pitch,
    };
    if (animate) {
      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this.targetView = target;
      const durationMs = Math.max(120, Math.min(600, opts?.durationMs ?? 420));
      this.flight = reduced
        ? null
        : { from: { ...this.view }, to: target, startMs: performance.now(), durationMs };
      if (!this.flight) {
        this.view = target;
        this.onCameraChange?.(this.view);
      }
    } else {
      this.flight = null;
      this.targetView = target;
      this.view = target;
      this.onCameraChange?.(this.view);
    }
  }

  /**
   * True 3D surface/terrain raycast under canvas pixel `(px, py)` (Phase A):
   * hits rendered terrain chunks and buildings/plazas first, with a clean heightfield-corrected
   * ground-plane fallback over open ocean or empty space.
   */
  pickWorldPointAtScreen(
    px: number,
    py: number,
  ): {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly hitKind: 'surface' | 'terrain' | 'plane';
  } | null {
    const w = Math.max(1, this.config.canvas.clientWidth || 1);
    const h = Math.max(1, this.config.canvas.clientHeight || 1);
    const ndc = new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);

    if (this.worldMaps.length > 0) {
      // Check rendered buildings/overlays AND shared terrain chunks
      const targets: THREE.Object3D[] = [
        ...this.multiMap.getAllPickables(),
        ...this.multiMap.worldTerrain.getChunkMeshes(),
      ];
      if (targets.length > 0) {
        const hits = this.raycaster.intersectObjects(targets, false);
        for (const hit of hits) {
          // Ignore ocean backing planes when solid terrain/building is hit
          const name = hit.object.name || '';
          if (name.includes('ocean') || name.includes('water')) continue;
          const hitKind = name.startsWith('atlas3:terrain-chunk:') ? 'terrain' : 'surface';
          return { x: hit.point.x, y: hit.point.y, z: hit.point.z, hitKind };
        }
      }
    } else if (this.pickables.length > 0) {
      const hits = this.raycaster.intersectObjects(this.pickables, false);
      for (const hit of hits) {
        if (hit.object.name === 'atlas3:water') continue;
        return { x: hit.point.x, y: hit.point.y, z: hit.point.z, hitKind: 'surface' };
      }
    }

    const out = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, out)) return null;
    const sampledY =
      this.worldMaps.length > 0 ? this.multiMap.getActiveEditorElevationY(out.x, out.z) : out.y;
    return { x: out.x, y: sampledY, z: out.z, hitKind: 'plane' };
  }

  /**
   * Exact projection-anchored zoom by a multiplicative span factor around canvas pixel `(px, py)`.
   * Shared by mouse wheel, trackpad pinch, AND +/- zoom buttons so every zoom path preserves
   * the exact 3D world point under `(px, py)` across every intermediate damped frame.
   */
  zoomByFactorAtScreen(factor: number, px: number, py: number): AtlasThreeCameraView {
    this.flight = null;
    const w = Math.max(1, this.config.canvas.clientWidth || 1280);
    const h = Math.max(1, this.config.canvas.clientHeight || 800);
    const aspect = w / h;
    const ndcX = (px / w) * 2 - 1;
    const ndcY = -(py / h) * 2 + 1;

    // Keep the exact original 3D world anchor across consecutive ticks at the same screen spot (<= 4 px)
    // so zero raycast quantization drift accumulates during a multi-step wheel gesture!
    let anchorWorld: AtlasThreeWorldPoint3 | null = null;
    if (
      this.zoomAnchor &&
      Math.hypot(px - this.zoomAnchor.screenPx, py - this.zoomAnchor.screenPy) <= 4
    ) {
      anchorWorld = this.zoomAnchor.anchorWorld;
    } else {
      const picked = this.pickWorldPointAtScreen(px, py);
      if (picked) {
        anchorWorld = { x: picked.x, y: picked.y, z: picked.z };
      }
    }

    const minSpan = this.worldMaps.length > 0 ? 0.08 : 16;
    const safeFactor = Math.max(0.45, Math.min(2.2, Number.isFinite(factor) ? factor : 1));
    const nextSpan = Math.max(minSpan, Math.min(2400, this.targetView.span * safeFactor));

    const nextPitch =
      this.targetView.mode === 'ortho-topdown'
        ? Math.PI / 2
        : this.manualPitchOverride
          ? this.targetView.pitchRad
          : autoAtlasThreePitchForSpan(this.targetView.mode, nextSpan);

    const sampleFocusElevation =
      this.worldMaps.length > 0
        ? (wx: number, wz: number) => this.multiMap.getActiveEditorElevationY(wx, wz)
        : undefined;

    let nextX = this.targetView.x;
    let nextZ = this.targetView.z;
    let nextY = this.targetView.y ?? 0;

    if (anchorWorld) {
      const candidate: AtlasThreeCameraView = {
        ...this.targetView,
        span: nextSpan,
        pitchRad: nextPitch,
      };
      const solved = solveAnchoredCameraFocus({
        view: candidate,
        anchorWorld,
        targetNdcX: ndcX,
        targetNdcY: ndcY,
        aspect,
        sampleFocusElevation,
      });
      nextX = solved.x;
      nextZ = solved.z;
      nextY = solved.y;
      this.zoomAnchor = {
        anchorWorld,
        targetNdcX: ndcX,
        targetNdcY: ndcY,
        screenPx: px,
        screenPy: py,
      };
    }

    this.targetView = {
      ...this.targetView,
      x: nextX,
      z: nextZ,
      y: nextY,
      span: nextSpan,
      pitchRad: nextPitch,
    };

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.view = { ...this.targetView };
      this.zoomAnchor = null;
      this.onCameraChange?.(this.view);
    }

    return { ...this.targetView };
  }

  /**
   * Cursor-anchored logarithmic wheel/pinch zoom toward the exact 3D point under `(px, py)`.
   */
  zoomAtScreen(deltaY: number, px: number, py: number): AtlasThreeCameraView {
    const clampedDelta = Math.max(-240, Math.min(240, Number.isFinite(deltaY) ? deltaY : 0));
    const factor = Math.exp(clampedDelta * 0.00125);
    return this.zoomByFactorAtScreen(factor, px, py);
  }

  /** Smoothly ease yaw (e.g. clicking the compass dial snaps smoothly back to 0° North). */
  setYawAnimated(yawRad: number): void {
    this.setView({ yawRad }, true);
  }

  flyTo(x: number, z: number, span: number): void {
    this.manualPitchOverride = false;
    this.setView(
      {
        x,
        z,
        span,
        pitchRad: autoAtlasThreePitchForSpan(this.targetView.mode, span),
      },
      true,
    );
  }

  /** Capture the current WebGL frame as a lightweight JPEG data URL for seamless flight transitions. */
  captureFrameDataUrl(): string | null {
    try {
      this.renderer.render(this.scene, this.camera);
      return this.config.canvas.toDataURL('image/jpeg', 0.84);
    } catch {
      return null;
    }
  }

  /** Smooth arrival glide onto the newly loaded map's exact content center. */
  frameContentBounds(opts?: { readonly animateFrom?: 'in' | 'out' | null }): void {
    this.ensureScene();
    const bounds = this.plan?.contentBounds ?? {
      centerX: this.mapScale === 'settlement' ? 370 : 500,
      centerZ: this.mapScale === 'settlement' ? 485 : 500,
      fitSpan: this.mapScale === 'world' ? 430 : this.mapScale === 'settlement' ? 195 : 220,
    };
    const mode = this.targetView.mode;
    const targetSpan = bounds.fitSpan;
    // SWS-05 (E2): preserve current yaw orientation across mode/map framing.
    const targetYaw = this.targetView.yawRad;
    const targetPitch = autoAtlasThreePitchForSpan(mode, targetSpan);
    this.manualPitchOverride = false;

    if (opts?.animateFrom) {
      const startSpan =
        opts.animateFrom === 'in'
          ? Math.min(1800, targetSpan * 1.48)
          : Math.max(48, targetSpan * 0.68);
      this.view = {
        mode,
        x: bounds.centerX,
        z: bounds.centerZ,
        span: startSpan,
        yawRad: targetYaw,
        pitchRad: autoAtlasThreePitchForSpan(mode, startSpan),
      };
      this.targetView = { ...this.view };
      this.setView(
        {
          mode,
          x: bounds.centerX,
          z: bounds.centerZ,
          span: targetSpan,
          yawRad: targetYaw,
          pitchRad: targetPitch,
        },
        true,
      );
      return;
    }

    this.setView(
      {
        mode,
        x: bounds.centerX,
        z: bounds.centerZ,
        span: targetSpan,
        yawRad: targetYaw,
        pitchRad: targetPitch,
      },
      false,
    );
  }

  resetCamera(): void {
    this.ensureScene();
    const bounds = this.plan?.contentBounds ?? {
      centerX: this.mapScale === 'settlement' ? 370 : 500,
      centerZ: this.mapScale === 'settlement' ? 485 : 500,
      fitSpan: this.mapScale === 'world' ? 430 : this.mapScale === 'settlement' ? 195 : 220,
    };
    const mode = this.targetView.mode;
    this.manualPitchOverride = false;
    this.setView(
      {
        mode,
        x: bounds.centerX,
        z: bounds.centerZ,
        span: bounds.fitSpan,
        yawRad: mode === 'ortho-topdown' ? 0 : 0.42,
        pitchRad: autoAtlasThreePitchForSpan(mode, bounds.fitSpan),
      },
      true,
    );
  }

  /** Raycast screen coordinates (px relative to canvas) to ground plane (x, z). */
  screenToGround(px: number, py: number): { readonly x: number; readonly z: number } | null {
    const w = this.config.canvas.clientWidth || 1;
    const h = this.config.canvas.clientHeight || 1;
    const ndc = new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const out = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, out)) return null;
    return { x: out.x, z: out.z };
  }

  /** Read-only projection from World Space (x, y, z) to canvas pixels (px, py). */
  projectWorldPointToScreen(
    x: number,
    z: number,
    y?: number,
  ): { readonly px: number; readonly py: number; readonly visible: boolean } {
    const w = Math.max(1, this.config.canvas.clientWidth || 1);
    const h = Math.max(1, this.config.canvas.clientHeight || 1);
    const pyWorld = y ?? (this.worldMaps.length > 0 ? this.multiMap.getActiveEditorElevationY(x, z) : 0);
    const v = new THREE.Vector3(x, pyWorld, z).project(this.camera);
    const px = ((v.x + 1) * 0.5) * w;
    const py = ((1 - v.y) * 0.5) * h;
    return {
      px: Math.round(px * 100) / 100,
      py: Math.round(py * 100) / 100,
      visible: v.z >= -1 && v.z <= 1 && px >= 0 && px <= w && py >= 0 && py <= h,
    };
  }

  /** Read-only WebGL renderer identification (hardware vs software labelling, A.3). */
  getRendererInfo(): {
    readonly webglRenderer: string;
    readonly webglVendor: string;
    readonly isSoftwareWebgl: boolean;
  } {
    const gl = this.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const webglRenderer = String(
      dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
    const webglVendor = String(
      dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    );
    const isSoftwareWebgl = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(webglRenderer);
    return { webglRenderer, webglVendor, isSoftwareWebgl };
  }

  /** Raycast screen coordinates to canonical feature ID (objects prioritized over terrain/floors). */
  pickCanonicalId(px: number, py: number): string | null {
    const w = this.config.canvas.clientWidth || 1;
    const h = this.config.canvas.clientHeight || 1;
    const ndc = new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const allPickables: THREE.Object3D[] =
      this.worldMaps.length > 0 ? [...this.multiMap.getAllPickables()] : this.pickables;
    const hits = this.raycaster.intersectObjects(allPickables, false);
    const objectIds = new Set<string>((this.doc?.objects ?? []).map((o) => o.id));
    if (this.worldMaps.length > 0) {
      for (const src of this.worldSources.values()) {
        for (const o of src.doc.objects) objectIds.add(o.id);
      }
    }
    let fallback: string | null = null;
    for (const hit of hits) {
      let id: string | null = null;
      const triIds = hit.object.userData.triIds as string[] | undefined;
      const instIds = hit.object.userData.instanceIds as string[] | undefined;
      if (triIds && typeof hit.faceIndex === 'number') {
        id = triIds[hit.faceIndex] ?? null;
      } else if (instIds && typeof hit.instanceId === 'number') {
        id = instIds[hit.instanceId] ?? null;
      }
      if (!id || id.startsWith('__') || id === 'g.ocean' || id === 'w.ocean') continue;
      if (objectIds.has(id)) return id;
      if (!fallback) fallback = id;
    }
    return fallback;
  }

  getRenderedIds(): string[] {
    if (this.worldMaps.length > 0) {
      return this.multiMap.getRenderedIds();
    }
    return [...(this.plan?.ids ?? [])].sort();
  }

  getStats(): {
    readonly calls: number;
    readonly triangles: number;
    readonly rooms: number;
    readonly clearRootCount: number;
    readonly activeMapCount: number;
  } {
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      rooms: this.doc?.rooms.length ?? 0,
      clearRootCount: this.clearRootCount,
      activeMapCount: this.worldMaps.length > 0 ? this.multiMap.getStats().groupCount : 1,
    };
  }

  private getMaterial(key: AtlasThreeSurfaceKey): THREE.MeshStandardMaterial {
    const hit = this.materials.get(key);
    if (hit) return hit;
    const spec = ATLAS_THREE_SURFACES[key];
    const mat = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: spec.roughness,
      metalness: 'metalness' in spec ? spec.metalness : 0,
      vertexColors: 'vertexColors' in spec ? spec.vertexColors : false,
    });
    if (spec.pbr) {
      const tex = this.pbr.get(spec.pbr);
      mat.map = tex.map;
      mat.normalMap = tex.normal;
      mat.roughnessMap = tex.rough;
      mat.normalScale.set(spec.normalScale, spec.normalScale);
    }
    if ('emissive' in spec) {
      mat.emissive = new THREE.Color(spec.emissive);
      mat.emissiveIntensity = 1.9;
      mat.toneMapped = false;
    }
    this.materials.set(key, mat);
    return mat;
  }

  private clearRoot(): void {
    if (this.root.children.length > 0) {
      this.clearRootCount += 1;
    }
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      if (child instanceof THREE.Mesh) child.geometry.dispose();
      if (child instanceof THREE.PointLight) child.dispose();
    }
    this.smokePuffs.length = 0;
    this.torchLights.length = 0;
    this.pickables.length = 0;
  }

  private ensureScene(dtSec?: number): void {
    if (this.worldMaps.length > 0) {
      // SWS-04 + Phase 1/2 Multi-Map Scene Graph: shared chunked world terrain +
      // smooth `detailWeight` crossfade with ZERO clearRoot() calls during zoom/navigation.
      this.root.visible = false;
      this.multiMap.rootGroup.visible = true;
      const w = Math.max(1, this.config.canvas.clientWidth || 1280);
      const h = Math.max(1, this.config.canvas.clientHeight || 800);
      const camState = this.getWorldCameraState();
      const nextPlan = buildAtlasWorldScenePlan({
        maps: this.worldMaps,
        camera: camState,
        viewportPx: { width: w, height: h },
        previousPlan: this.worldScenePlan,
        focusTargetMapId: this.focusTargetMapId,
      });
      this.worldScenePlan = nextPlan;
      if (nextPlan.activeEditorMapId !== this.lastReportedEditorMapId) {
        this.lastReportedEditorMapId = nextPlan.activeEditorMapId;
        this.config.onActiveEditorMapChange?.(nextPlan.activeEditorMapId);
      }
      this.multiMap.sync({
        scenePlan: nextPlan,
        sources: this.worldSources,
        presetId: this.presetId,
        hideRoofs: this.hideRoofs,
        viewSpan: this.view.span,
        camera: camState,
        viewportPx: { width: w, height: h },
        dtSec,
      });
      this.applyStyleToMaterials();
      this.updateSelectionGizmo();
      return;
    }

    this.root.visible = true;
    this.multiMap.rootGroup.visible = false;
    if (!this.doc) return;
    // Automatic smooth roof cutaway when zoomed deep into a settlement building.
    const autoCutaway = this.mapScale === 'settlement' && this.view.span < 58;
    const effectiveHideRoofs = this.hideRoofs || autoCutaway;
    // SWS-04 (D2): do NOT key on zoom lodBucket — zooming never triggers clearRoot()!
    const key = `${this.docRevision}|${this.presetId}|${effectiveHideRoofs ? 'cut' : 'full'}`;
    if (key === this.sceneKey && this.plan) return;

    this.clearRoot();
    const warmWindows = true;
    const plan = buildAtlasThreeScenePlan(this.doc, {
      mapScale: this.mapScale,
      look: this.look,
      span: this.view.span,
      presetId: this.presetId,
      seed: this.seed,
      hideRoofs: effectiveHideRoofs,
      warmWindows,
    });

    for (const [surfaceKey, builder] of plan.builders) {
      if (builder.triangleCount === 0) continue;
      const mesh = new THREE.Mesh(builder.build(), this.getMaterial(surfaceKey));
      const flat = surfaceKey.startsWith('sheet') || surfaceKey.startsWith('floor');
      mesh.castShadow = !flat;
      mesh.receiveShadow = true;
      mesh.userData.triIds = builder.triIds;
      mesh.name = `atlas3:${surfaceKey}`;
      this.root.add(mesh);
      this.pickables.push(mesh);
    }

    if (plan.water.triangleCount > 0) {
      const mesh = new THREE.Mesh(plan.water.build(), this.waterMat);
      mesh.userData.triIds = plan.water.triIds;
      mesh.name = 'atlas3:water';
      mesh.renderOrder = 2;
      this.root.add(mesh);
      this.pickables.push(mesh);
    }

    if (plan.terrain) {
      const mesh = new THREE.Mesh(plan.terrain, this.getMaterial('terrain'));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'atlas3:terrain';
      this.root.add(mesh);
    }

    if (plan.doorInstances.matrices.length > 0) {
      const inst = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        this.getMaterial('wood-dark'),
        plan.doorInstances.matrices.length,
      );
      plan.doorInstances.matrices.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.userData.instanceIds = plan.doorInstances.ids;
      inst.name = 'atlas3:doors';
      this.root.add(inst);
      this.pickables.push(inst);
    }

    // Instanced suggestive scenery scatter (1 draw call per mesh part!)
    for (const batch of plan.scatterBatches) {
      const { parts } = buildAtlasScatterGeometry(batch.kind);
      for (const part of parts) {
        const inst = new THREE.InstancedMesh(
          part.geo,
          this.getMaterial(part.surface),
          batch.matrices.length,
        );
        batch.matrices.forEach((m, i) => inst.setMatrixAt(i, m));
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        inst.castShadow = batch.kind !== 'flower' && batch.kind !== 'rubble';
        inst.receiveShadow = true;
        inst.name = `atlas3:scatter:${batch.kind}`;
        this.root.add(inst);
      }
    }

    // Soft Ground Contact Shadow AO Discs (single InstancedMesh draw call!)
    if (plan.aoDiscs.length > 0) {
      const discGeo = new THREE.PlaneGeometry(2, 2);
      discGeo.rotateX(-Math.PI / 2);
      const aoInst = new THREE.InstancedMesh(discGeo, this.aoMat, plan.aoDiscs.length);
      const mat4 = new THREE.Matrix4();
      const quat = new THREE.Quaternion();
      plan.aoDiscs.forEach((d, i) => {
        mat4.compose(new THREE.Vector3(d.x, d.y, d.z), quat, new THREE.Vector3(d.radius, 1, d.radius));
        aoInst.setMatrixAt(i, mat4);
      });
      aoInst.instanceMatrix.needsUpdate = true;
      aoInst.computeBoundingSphere();
      aoInst.renderOrder = 2;
      aoInst.name = 'atlas3:ao';
      this.root.add(aoInst);
    }

    // Animated Chimney Smoke Puffs (V7/V8 Dornhain cozy life!)
    for (const base of plan.smokePoints.slice(0, 12)) {
      for (let k = 0; k < 3; k += 1) {
        const sprite = new THREE.Sprite(this.mistMat);
        sprite.position.copy(base);
        sprite.scale.setScalar(10);
        sprite.renderOrder = 4;
        this.root.add(sprite);
        this.smokePuffs.push({ sprite, base: base.clone(), phase: k / 3 });
      }
    }

    // Subtle Alpine Peak Mist Sprites
    for (const m of plan.mistPoints.slice(0, 14)) {
      const sprite = new THREE.Sprite(this.mistMat);
      sprite.position.copy(m.position);
      sprite.scale.set(m.scale * 1.4, m.scale * 0.65, 1);
      sprite.renderOrder = 3;
      this.root.add(sprite);
    }

    // Warm Torches, Hearth Fires, Tavern Candles & Street Lanterns
    const torchColor = new THREE.Color(0xffb154);
    for (let ti = 0; ti < Math.min(20, plan.torches.length); ti += 1) {
      const t = plan.torches[ti]!;
      const intensityScale =
        this.look === 'indoor' || this.lightingMode === 'night'
          ? 1.18
          : this.lightingMode === 'evening'
            ? 0.84
            : 0.36;
      const baseIntensity = 1.9 * (t.radius / 4) ** 2 * intensityScale;
      const light = new THREE.PointLight(torchColor, baseIntensity, t.radius, 2);
      light.position.copy(t.position);
      this.root.add(light);
      this.torchLights.push({ light, baseIntensity, phase: ti * 1.37 });
      const sprite = new THREE.Sprite(this.haloMat);
      sprite.position.copy(t.position);
      sprite.scale.setScalar(t.radius * 0.24);
      sprite.renderOrder = 3;
      this.root.add(sprite);
    }

    this.plan = plan;
    this.sceneKey = key;
    this.applyStyleToMaterials();
    this.updateSelectionGizmo();
  }

  private updateSelectionGizmo(): void {
    if (!this.selectedId || !this.doc) {
      this.gizmoGroup.visible = false;
      return;
    }
    const obj = this.doc.objects.find((o) => o.id === this.selectedId);
    if (!obj) {
      this.gizmoGroup.visible = false;
      return;
    }
    const radius = Math.max(16, obj.size * 44);
    this.gizmoGroup.position.set(obj.x, (obj.z ?? 0) + 1.2, obj.y);
    this.selectionRing.scale.set(radius, 1, radius);
    this.gizmoAxisX.scale.set(radius * 0.85, 1, 1);
    this.gizmoAxisZ.scale.set(1, 1, radius * 0.85);
    this.gizmoAxisX.visible = this.gizmoVisible;
    this.gizmoAxisZ.visible = this.gizmoVisible;
    this.gizmoGroup.visible = true;
  }

  private syncCameraAndLighting(w: number, h: number, elapsedSec: number): void {
    const aspect = w / Math.max(1, h);
    const sampledY =
      this.worldMaps.length > 0 ? this.multiMap.getActiveEditorElevationY(this.view.x, this.view.z) : 0;
    const activeY =
      this.zoomAnchor && Number.isFinite(this.view.y) ? this.view.y! : sampledY;
    this.groundPlane.constant = -activeY;
    const rig = buildAtlasThreeCameraRig({ ...this.view, y: activeY }, aspect);
    if (rig.perspective) {
      const cam =
        this.camera instanceof THREE.PerspectiveCamera
          ? this.camera
          : new THREE.PerspectiveCamera();
      cam.fov = rig.fovYDeg;
      cam.aspect = aspect;
      cam.near = rig.near;
      cam.far = rig.far;
      this.camera = cam;
    } else {
      const cam =
        this.camera instanceof THREE.OrthographicCamera
          ? this.camera
          : new THREE.OrthographicCamera();
      cam.left = -rig.halfWidth;
      cam.right = rig.halfWidth;
      cam.top = rig.halfHeight;
      cam.bottom = -rig.halfHeight;
      cam.near = rig.near;
      cam.far = rig.far;
      this.camera = cam;
    }
    this.camera.position.set(rig.eye[0], rig.eye[1], rig.eye[2]);
    this.camera.up.set(rig.up[0], rig.up[1], rig.up[2]);
    this.camera.lookAt(rig.at[0], rig.at[1], rig.at[2]);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);

    const spec = this.look === 'indoor' ? INDOOR_LIGHTING : OUTDOOR_LIGHTING[this.lightingMode];
    const at = new THREE.Vector3(rig.at[0], rig.at[1], rig.at[2]);
    const sunDir = new THREE.Vector3(spec.sunDir[0], spec.sunDir[1], spec.sunDir[2]).normalize();
    const fillDir = new THREE.Vector3(7, 6, -7).normalize();
    const band = buildAtlasThreeFogBand(rig, this.look);

    // Seamless Exponential Fog + Sky Dome matched 1:1
    this.scene.background = new THREE.Color(spec.skyHorizon);
    this.scene.fog = new THREE.FogExp2(spec.skyHorizon, band.expDensity);
    this.skyDome.position.set(rig.eye[0], 0, rig.eye[2]);
    this.skyMat.uniforms.uZenith!.value.set(spec.skyZenith);
    this.skyMat.uniforms.uHorizon!.value.set(spec.skyHorizon);
    this.skyMat.uniforms.uSunGlow!.value.set(spec.sunGlow);
    this.skyMat.uniforms.uSunDir!.value.copy(sunDir);

    // Lock INFINITE surround planes to camera target X/Z — zero borders at ANY zoom!
    const isWorldOcean = this.look === 'outdoor' && this.mapScale === 'world';
    this.infiniteOcean.visible = isWorldOcean;
    this.infiniteMeadow.visible = !isWorldOcean;
    const wy = this.plan ? this.plan.waterLevel : -0.52;
    this.infiniteOcean.position.set(this.view.x, wy, this.view.z);
    this.infiniteMeadow.position.set(this.view.x, -0.54, this.view.z);
    this.meadowMat.uniforms.uLight!.value.set(spec.meadowLight);
    this.meadowMat.uniforms.uDark!.value.set(spec.meadowDark);
    this.meadowMat.uniforms.uFogColor!.value.set(spec.skyHorizon);
    this.meadowMat.uniforms.uFocus!.value.set(this.view.x, this.view.z);
    this.meadowMat.uniforms.uSpan!.value = this.view.span;
    this.meadowMat.uniforms.uIndoor!.value = this.look === 'indoor' ? 1 : 0;

    // Tactical grid follows camera target (sits crisply above cobblestone/wood/meadow)
    this.gridMesh.position.set(this.view.x, this.mapScale === 'world' ? 2.2 : 0.72, this.view.z);
    this.gridMat.uniforms.uStep!.value =
      this.view.span > 500 ? 100 : this.view.span > 160 ? 32 : 16;
    this.gridMat.uniforms.uFocus!.value.set(this.view.x, this.view.z);
    this.gridMat.uniforms.uSpan!.value = this.view.span;
    this.gridMat.uniforms.uColor!.value.set(
      this.lightingMode === 'evening' ? '#fde68a' : '#22d3ee',
    );

    // Style-aware lighting & exposure
    const styleExp =
      this.styleMode === 'illustrated' ? 1.06 : this.styleMode === 'cel' ? 0.96 : 1.0;
    this.hemi.color.set(spec.hemiSky);
    this.hemi.groundColor.set(spec.hemiGround);
    this.hemi.intensity = spec.hemiIntensity;
    this.sun.color.set(spec.sunColor);
    this.sun.intensity = spec.sunIntensity * (this.styleMode === 'cel' ? 1.15 : 1.0);
    // Dynamic scale-tight PCF shadow frustum: crisp 2048px shadows at Planet, Village AND Tavern scales!
    const shadowHalf = Math.max(1.4, Math.min(680, this.view.span * 1.55));
    const sunDist = Math.max(12, shadowHalf * 2.1);
    this.sun.position.copy(at).addScaledVector(sunDir, sunDist);
    this.sun.target.position.copy(at);
    this.sun.shadow.camera.left = -shadowHalf;
    this.sun.shadow.camera.right = shadowHalf;
    this.sun.shadow.camera.top = shadowHalf;
    this.sun.shadow.camera.bottom = -shadowHalf;
    this.sun.shadow.camera.near = Math.max(0.5, sunDist * 0.08);
    this.sun.shadow.camera.far = Math.max(40, sunDist * 3.0);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = Math.min(0.028, Math.max(0.002, shadowHalf * 0.0007));
    this.sun.shadow.camera.updateProjectionMatrix();

    this.fill.color.set(spec.fillColor);
    this.fill.intensity = spec.fillIntensity;
    this.fill.position.copy(at).addScaledVector(fillDir, Math.max(20, this.view.span * 1.8));
    this.fill.target.position.copy(at);

    this.renderer.toneMappingExposure = spec.exposure * styleExp;
    this.waterMat.uniforms.uTime!.value = elapsedSec;
    this.waterMat.uniforms.uDeep!.value.set(spec.waterDeep);
    this.waterMat.uniforms.uShallow!.value.set(spec.waterShallow);
    this.waterMat.uniforms.uSky!.value.set(spec.waterSky);
    this.waterMat.uniforms.uSunDir!.value.copy(sunDir);
    this.waterMat.uniforms.uFogColor!.value.set(spec.skyHorizon);
    this.waterMat.uniforms.uFocus!.value.set(this.view.x, this.view.z);
    this.waterMat.uniforms.uSpan!.value = this.view.span;
    if (this.worldMaps.length > 0) {
      const hfTex = this.multiMap.worldTerrain.getHeightFieldTexture();
      this.waterMat.uniforms.uWorldHeightTex!.value = hfTex.texture;
      this.waterMat.uniforms.uHasWorldHeight!.value = hfTex.texture ? 1.0 : 0.0;
      this.waterMat.uniforms.uHeightMin!.value = hfTex.minH;
      this.waterMat.uniforms.uHeightMax!.value = hfTex.maxH;
      this.waterMat.uniforms.uWaterLevel!.value = hfTex.waterLevel;
      this.multiMap.syncWaterUniforms(this.waterMat);
    } else {
      this.waterMat.uniforms.uHasWorldHeight!.value = 0.0;
    }

    // Gentle rising chimney smoke animation
    for (const puff of this.smokePuffs) {
      const cycle = (elapsedSec * 0.22 + puff.phase) % 1;
      puff.sprite.position.set(
        puff.base.x + Math.sin(elapsedSec * 0.7 + puff.phase * 6) * 4 + cycle * 12,
        puff.base.y + cycle * 26,
        puff.base.z + cycle * 6,
      );
      const s = 6 + cycle * 14;
      puff.sprite.scale.setScalar(s);
    }

    // Subtle organic firelight flicker on hearth fires, candles & dungeon torches
    for (const tl of this.torchLights) {
      const wave =
        Math.sin(elapsedSec * 6.4 + tl.phase) * 0.055 +
        Math.sin(elapsedSec * 11.3 + tl.phase * 2.1) * 0.03;
      tl.light.intensity = tl.baseIntensity * (1 + wave);
    }

    // Adjust IBL bounce for outdoor daylight vs warm tavern/crypt interior
    this.scene.environmentIntensity =
      this.look === 'indoor' ? 0.42 : this.lightingMode === 'night' ? 0.28 : 0.62;
  }

  private emitProjectedPins(w: number, h: number): void {
    if (!this.onProjectedPins) return;
    if (this.pins.length === 0) {
      if (this.lastPinEmitKey !== '') {
        this.lastPinEmitKey = '';
        this.onProjectedPins([]);
      }
      return;
    }
    const projected: AtlasThreeProjectedPin[] = [];
    const v = new THREE.Vector3();
    for (const pin of this.pins) {
      v.set(pin.x, 14, pin.y).project(this.camera);
      const visible = v.z >= -1 && v.z <= 1;
      const left = Math.round(((v.x + 1) * 0.5) * w);
      const top = Math.round(((1 - v.y) * 0.5) * h);
      projected.push({
        id: pin.id,
        label: pin.label,
        kind: pin.kind ?? 'place',
        left,
        top,
        visible: visible && left >= -80 && left <= w + 80 && top >= -40 && top <= h + 40,
      });
    }
    const key = projected.map((p) => `${p.id}:${p.left},${p.top},${p.visible ? 1 : 0}`).join('|');
    if (key !== this.lastPinEmitKey) {
      this.lastPinEmitKey = key;
      this.onProjectedPins(projected);
    }
  }

  private startLoop(): void {
    const tick = (now: number) => {
      if (this.disposed) return;
      this.rafId = window.requestAnimationFrame(tick);
      if (this.contextLost || !this.doc) return;
      const dtSec = Math.min(0.05, Math.max(0.001, (now - this.lastFrameMs) / 1000));
      this.lastFrameMs = now;

      const w = this.config.canvas.clientWidth;
      const h = this.config.canvas.clientHeight;
      if (w < 8 || h < 8) return;
      if (this.config.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
        this.renderer.setSize(w, h, false);
      }

      if (this.flight) {
        const t = (now - this.flight.startMs) / this.flight.durationMs;
        this.view = interpolateAtlasThreeView(this.flight.from, this.flight.to, t);
        if (t >= 1) {
          this.view = this.flight.to;
          this.targetView = { ...this.view };
          this.flight = null;
          this.onCameraChange?.(this.view);
        } else if (now - this.lastCameraNotifyMs > 48) {
          this.lastCameraNotifyMs = now;
          this.onCameraChange?.(this.view);
        }
      } else {
        const aspect = w / Math.max(1, h);
        const anchorCtx = this.zoomAnchor
          ? {
              anchorWorld: this.zoomAnchor.anchorWorld,
              targetNdcX: this.zoomAnchor.targetNdcX,
              targetNdcY: this.zoomAnchor.targetNdcY,
              aspect,
              sampleFocusElevation:
                this.worldMaps.length > 0
                  ? (wx: number, wz: number) => this.multiMap.getActiveEditorElevationY(wx, wz)
                  : undefined,
            }
          : null;
        const damped = dampAtlasThreeView(this.view, this.targetView, dtSec, 12.5, anchorCtx);
        if (!damped.settled) {
          this.view = damped.next;
          if (now - this.lastCameraNotifyMs > 48) {
            this.lastCameraNotifyMs = now;
            this.onCameraChange?.(this.view);
          }
        } else if (
          this.view.x !== damped.next.x ||
          this.view.z !== damped.next.z ||
          this.view.span !== damped.next.span ||
          this.view.yawRad !== damped.next.yawRad ||
          this.view.pitchRad !== damped.next.pitchRad
        ) {
          this.view = damped.next;
          this.targetView = { ...damped.next };
          this.zoomAnchor = null;
          this.onCameraChange?.(this.view);
        } else {
          this.zoomAnchor = null;
        }
      }

      this.ensureScene(dtSec);
      this.syncCameraAndLighting(w, h, (now - this.startTime) * 0.001);
      this.renderer.render(this.scene, this.camera);
      this.emitProjectedPins(w, h);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.rafId);
    this.config.canvas.removeEventListener('webglcontextlost', this.onContextLostListener);
    this.config.canvas.removeEventListener('webglcontextrestored', this.onContextRestoredListener);
    this.multiMap.dispose();
    this.clearRoot();
    for (const mat of this.materials.values()) mat.dispose();
    this.materials.clear();
    this.pbr.dispose();
    this.envMap.dispose();
    this.skyDome.geometry.dispose();
    this.skyMat.dispose();
    this.infiniteOcean.geometry.dispose();
    this.waterMat.dispose();
    this.infiniteMeadow.geometry.dispose();
    this.meadowMat.dispose();
    this.gridMesh.geometry.dispose();
    this.gridMat.dispose();
    this.haloTex.dispose();
    this.haloMat.dispose();
    this.aoTex.dispose();
    this.aoMat.dispose();
    this.mistTex.dispose();
    this.mistMat.dispose();
    this.selectionRing.geometry.dispose();
    this.gizmoAxisX.geometry.dispose();
    this.gizmoAxisZ.geometry.dispose();
    this.renderer.dispose();
  }
}

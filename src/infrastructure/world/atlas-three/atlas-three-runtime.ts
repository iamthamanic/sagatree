/**
 * atlas-three-runtime — Productive interactive Three.js Atlas engine (ATL3/ATL4).
 * Location: src/infrastructure/world/atlas-three/atlas-three-runtime.ts
 *
 * Renders the single canonical `UnifiedCanvasDoc` with procedural PBR textures,
 * PCFSoftShadowMap, ACES Filmic tone mapping, animated GLSL water, instanced
 * suggestive scenery, Time-of-Day lighting, 3D raycast picking, 3D selection &
 * transform gizmo (Move/Rotate/Scale), direct terrain/stamp authoring callbacks,
 * smooth camera flight, and screen-projected HTML pin coordinates.
 */
import * as THREE from 'three';
import type {
  AtlasGraphicsPresetId,
  AtlasMapPin,
  AtlasMapScale,
  AtlasScatterKind,
  UnifiedCanvasDoc,
} from '../../../domains/world/atlas';
import {
  buildAtlasThreeCameraRig,
  buildAtlasThreeFogBand,
  clampAtlasThreePitch,
  defaultAtlasThreePitch,
  interpolateAtlasThreeView,
  type AtlasThreeCameraMode,
  type AtlasThreeCameraView,
} from './atlas-three-camera';
import {
  ATLAS_THREE_SURFACES,
  buildAtlasThreeScenePlan,
  type AtlasThreeLook,
  type AtlasThreeScenePlan,
  type AtlasThreeSurfaceKey,
} from './atlas-three-scene';
import { AtlasPbrTextureLibrary } from './pbr-textures';

export type AtlasThreeLightingMode = 'day' | 'evening' | 'night';

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
};

type LightingSpec = {
  readonly background: string;
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
  readonly sunDir: readonly [number, number, number];
};

const OUTDOOR_LIGHTING: Readonly<Record<AtlasThreeLightingMode, LightingSpec>> = {
  day: {
    background: '#739aa8',
    hemiSky: '#d4ece4',
    hemiGround: '#54684d',
    hemiIntensity: 1.9,
    sunColor: '#ffe4bc',
    sunIntensity: 3.3,
    fillColor: '#a6cde2',
    fillIntensity: 0.78,
    exposure: 1.18,
    waterDeep: '#1d586c',
    waterShallow: '#4c99a5',
    waterSky: '#b5d6de',
    sunDir: [-10, 17, 9],
  },
  evening: {
    background: '#6e5f66',
    hemiSky: '#f2c199',
    hemiGround: '#433f47',
    hemiIntensity: 1.45,
    sunColor: '#ffad66',
    sunIntensity: 3.4,
    fillColor: '#8fa4c8',
    fillIntensity: 0.65,
    exposure: 1.12,
    waterDeep: '#244156',
    waterShallow: '#58788c',
    waterSky: '#e8b38c',
    sunDir: [-16, 9, 10],
  },
  night: {
    background: '#162433',
    hemiSky: '#6d8cb8',
    hemiGround: '#242c36',
    hemiIntensity: 0.95,
    sunColor: '#b7d0f5',
    sunIntensity: 1.45,
    fillColor: '#4c6588',
    fillIntensity: 0.5,
    exposure: 1.02,
    waterDeep: '#0d2233',
    waterShallow: '#21455c',
    waterSky: '#587599',
    sunDir: [8, 15, -10],
  },
};

const INDOOR_LIGHTING: LightingSpec = {
  background: '#162026',
  hemiSky: '#98b2b6',
  hemiGround: '#35312c',
  hemiIntensity: 1.3,
  sunColor: '#ffe0b8',
  sunIntensity: 2.35,
  fillColor: '#90b6cc',
  fillIntensity: 0.42,
  exposure: 1.08,
  waterDeep: '#102f3a',
  waterShallow: '#2a6670',
  waterSky: '#4e6c72',
  sunDir: [-8, 16, 6],
};

const WATER_VERTEX = /* glsl */ `
varying vec3 vWorld;
varying float vDepth;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mv = viewMatrix * world;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const WATER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uTile;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
varying vec3 vWorld;
varying float vDepth;
float wave(vec2 p) {
  return sin(p.x * 1.4 + uTime * 0.85) * 0.42
       + sin(p.y * 1.9 - uTime * 0.65) * 0.32
       + sin((p.x - p.y) * 3.1 + uTime * 1.25) * 0.16
       + sin((p.x + p.y) * 5.2 - uTime * 1.55) * 0.10;
}
void main() {
  vec2 p = vWorld.xz / uTile;
  float h = wave(p);
  vec3 n = normalize(vec3(wave(p + vec2(0.05, 0.0)) - h, 0.48, wave(p + vec2(0.0, 0.05)) - h));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.2);
  vec3 col = mix(uDeep, uShallow, 0.35 + 0.22 * h);
  col = mix(col, uSky, clamp(fres * 0.52, 0.0, 1.0));
  col += vec3(1.0, 0.94, 0.82) * pow(max(dot(reflect(-uSunDir, n), v), 0.0), 64.0) * 0.45;
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vDepth));
  gl_FragColor = vec4(col, 0.99);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function createTorchHaloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,238,196,1)');
    g.addColorStop(0.28, 'rgba(255,182,102,0.55)');
    g.addColorStop(1, 'rgba(255,146,66,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Build shared low-overhead geometry for instanced suggestive scatter kinds. */
function buildScatterGeometry(kind: AtlasScatterKind): {
  readonly parts: readonly { readonly geo: THREE.BufferGeometry; readonly surface: AtlasThreeSurfaceKey }[];
} {
  switch (kind) {
    case 'pine': {
      const trunk = new THREE.CylinderGeometry(2.4, 4.4, 16, 6);
      trunk.translate(0, 8, 0);
      const c1 = new THREE.ConeGeometry(22, 36, 7);
      c1.translate(0, 26, 0);
      const c2 = new THREE.ConeGeometry(16, 30, 7);
      c2.translate(0, 44, 0);
      const c3 = new THREE.ConeGeometry(10, 24, 6);
      c3.translate(0, 58, 0);
      return {
        parts: [
          { geo: trunk, surface: 'wood-dark' },
          { geo: c1, surface: 'leaf-pine' },
          { geo: c2, surface: 'leaf-pine' },
          { geo: c3, surface: 'leaf-pine' },
        ],
      };
    }
    case 'birch': {
      const trunk = new THREE.CylinderGeometry(2.1, 3.6, 18, 6);
      trunk.translate(0, 9, 0);
      const crown = new THREE.DodecahedronGeometry(18, 1);
      crown.translate(0, 28, 0);
      return {
        parts: [
          { geo: trunk, surface: 'bark-birch' },
          { geo: crown, surface: 'leaf-birch' },
        ],
      };
    }
    case 'oak': {
      const trunk = new THREE.CylinderGeometry(3.2, 5.2, 16, 6);
      trunk.translate(0, 8, 0);
      const crown = new THREE.DodecahedronGeometry(21, 1);
      crown.translate(0, 28, 0);
      return {
        parts: [
          { geo: trunk, surface: 'wood-dark' },
          { geo: crown, surface: 'leaf' },
        ],
      };
    }
    case 'bush': {
      const g = new THREE.DodecahedronGeometry(11, 0);
      g.scale(1.2, 0.72, 1.1);
      g.translate(0, 6, 0);
      return { parts: [{ geo: g, surface: 'leaf' }] };
    }
    case 'flower': {
      const g = new THREE.DodecahedronGeometry(5, 0);
      g.scale(1.2, 0.45, 1.2);
      g.translate(0, 2.2, 0);
      return { parts: [{ geo: g, surface: 'flower' }] };
    }
    case 'mountain': {
      const base = new THREE.ConeGeometry(42, 58, 7);
      base.translate(0, 26, 0);
      const cap = new THREE.ConeGeometry(16, 22, 7);
      cap.translate(0, 46, 0);
      return {
        parts: [
          { geo: base, surface: 'rock' },
          { geo: cap, surface: 'snow' },
        ],
      };
    }
    case 'barrel': {
      const g = new THREE.CylinderGeometry(7, 8, 15, 8);
      g.translate(0, 7.5, 0);
      return { parts: [{ geo: g, surface: 'wood' }] };
    }
    case 'crate': {
      const g = new THREE.BoxGeometry(13, 13, 13);
      g.translate(0, 6.5, 0);
      return { parts: [{ geo: g, surface: 'wood-dark' }] };
    }
    case 'rubble': {
      const g = new THREE.DodecahedronGeometry(6.5, 0);
      g.scale(1.3, 0.48, 1.1);
      g.translate(0, 2.5, 0);
      return { parts: [{ geo: g, surface: 'rock' }] };
    }
    case 'rock':
    default: {
      const g = new THREE.DodecahedronGeometry(13, 0);
      g.scale(1.25, 0.75, 1.05);
      g.translate(0, 7, 0);
      return { parts: [{ geo: g, surface: 'rock' }] };
    }
  }
}

export class AtlasThreeRuntime {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private readonly root = new THREE.Group();
  private readonly gizmoGroup = new THREE.Group();
  private readonly selectionRing: THREE.Mesh;
  private readonly gizmoAxisX: THREE.Mesh;
  private readonly gizmoAxisZ: THREE.Mesh;
  private readonly hemi = new THREE.HemisphereLight();
  private readonly sun = new THREE.DirectionalLight();
  private readonly fill = new THREE.DirectionalLight();
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = new THREE.OrthographicCamera();
  private readonly pbr: AtlasPbrTextureLibrary;
  private readonly materials = new Map<AtlasThreeSurfaceKey, THREE.MeshStandardMaterial>();
  private readonly waterMat: THREE.ShaderMaterial;
  private readonly haloMat: THREE.SpriteMaterial;
  private readonly haloTex: THREE.CanvasTexture;
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
  private pins: readonly AtlasMapPin[] = [];
  private selectedId: string | null = null;
  private gizmoVisible = false;
  private plan: AtlasThreeScenePlan | null = null;
  private sceneKey = '';
  private docRevision = 0;
  private view: AtlasThreeCameraView = {
    mode: 'diorama-oblique',
    x: 500,
    z: 500,
    span: 470,
    yawRad: 0.35,
    pitchRad: defaultAtlasThreePitch('diorama-oblique'),
  };
  private flight: {
    readonly from: AtlasThreeCameraView;
    readonly to: AtlasThreeCameraView;
    readonly startMs: number;
    readonly durationMs: number;
  } | null = null;
  private rafId = 0;
  private startTime = performance.now();
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

    const texSize = config.presetId === 'high' ? 256 : 128;
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.pbr = new AtlasPbrTextureLibrary(texSize, aniso);

    this.sun.castShadow = true;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target, this.root, this.gizmoGroup);

    // 3D Selection Ring + Transform Gizmo handles (ATL4-A01 #1309 — Cyan/Gold SagaTree brand roles!)
    const ringGeo = new THREE.RingGeometry(0.85, 1.0, 48);
    ringGeo.rotateX(-Math.PI / 2);
    this.selectionRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        side: THREE.DoubleSide,
        depthWrite: false,
        transparent: true,
        opacity: 0.92,
      }),
    );
    const axisGeoX = new THREE.BoxGeometry(1.6, 0.08, 0.08);
    axisGeoX.translate(0.8, 0.12, 0);
    this.gizmoAxisX = new THREE.Mesh(
      axisGeoX,
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false }),
    );
    const axisGeoZ = new THREE.BoxGeometry(0.08, 0.08, 1.6);
    axisGeoZ.translate(0, 0.12, 0.8);
    this.gizmoAxisZ = new THREE.Mesh(
      axisGeoZ,
      new THREE.MeshBasicMaterial({ color: 0x06b6d4, depthTest: false }),
    );
    this.gizmoGroup.add(this.selectionRing, this.gizmoAxisX, this.gizmoAxisZ);
    this.gizmoGroup.visible = false;

    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uTile: { value: 24 },
        uDeep: { value: new THREE.Color('#1d586c') },
        uShallow: { value: new THREE.Color('#4c99a5') },
        uSky: { value: new THREE.Color('#b5d6de') },
        uSunDir: { value: new THREE.Vector3(-10, 17, 9).normalize() },
        uFogColor: { value: new THREE.Color('#739aa8') },
        uFogNear: { value: 1e6 },
        uFogFar: { value: 2e6 },
      },
    });
    this.haloTex = createTorchHaloTexture();
    this.haloMat = new THREE.SpriteMaterial({
      map: this.haloTex,
      color: 0xffb36b,
      blending: THREE.AdditiveBlending,
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
    this.doc = input.doc;
    this.mapScale = input.mapScale;
    this.look = input.look;
    this.seed = input.seed;
    this.hideRoofs = input.hideRoofs;
    this.lightingMode = input.lightingMode;
    this.pins = input.pins;
    this.selectedId = input.selectedId;
    this.gizmoVisible = input.gizmoVisible;
    if (docChanged || scaleChanged || lookChanged || seedChanged || roofChanged || lightChanged) {
      this.docRevision += 1;
      this.sceneKey = '';
    }
    this.updateSelectionGizmo();
  }

  getView(): AtlasThreeCameraView {
    return { ...this.view };
  }

  setView(next: Partial<AtlasThreeCameraView>, animate = false): void {
    const targetMode: AtlasThreeCameraMode = next.mode ?? this.view.mode;
    const target: AtlasThreeCameraView = {
      mode: targetMode,
      x: next.x ?? this.view.x,
      z: next.z ?? this.view.z,
      span: Math.max(24, Math.min(1400, next.span ?? this.view.span)),
      yawRad: next.yawRad ?? this.view.yawRad,
      pitchRad: clampAtlasThreePitch(
        targetMode,
        next.pitchRad ?? (next.mode ? defaultAtlasThreePitch(targetMode) : this.view.pitchRad),
      ),
    };
    if (animate) {
      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this.flight = reduced
        ? null
        : { from: { ...this.view }, to: target, startMs: performance.now(), durationMs: 520 };
      if (!this.flight) {
        this.view = target;
        this.onCameraChange?.(this.view);
      }
    } else {
      this.flight = null;
      this.view = target;
      this.onCameraChange?.(this.view);
    }
  }

  flyTo(x: number, z: number, span: number): void {
    this.setView({ x, z, span }, true);
  }

  resetCamera(): void {
    const mode = this.view.mode;
    const defaultSpan = this.mapScale === 'world' ? 470 : this.mapScale === 'settlement' ? 320 : 280;
    this.setView(
      {
        mode,
        x: 500,
        z: 500,
        span: defaultSpan,
        yawRad: mode === 'ortho-topdown' ? 0 : 0.35,
        pitchRad: defaultAtlasThreePitch(mode),
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

  /** Raycast screen coordinates to canonical feature ID (objects prioritized over terrain/floors). */
  pickCanonicalId(px: number, py: number): string | null {
    const w = this.config.canvas.clientWidth || 1;
    const h = this.config.canvas.clientHeight || 1;
    const ndc = new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    const objectIds = new Set((this.doc?.objects ?? []).map((o) => o.id));
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

  /** Expose canonical IDs currently rendered in Three.js. */
  getRenderedIds(): string[] {
    return [...(this.plan?.ids ?? [])].sort();
  }

  getStats(): { readonly calls: number; readonly triangles: number; readonly rooms: number } {
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      rooms: this.doc?.rooms.length ?? 0,
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
      mat.emissiveIntensity = 1.85;
      mat.toneMapped = false;
    }
    this.materials.set(key, mat);
    return mat;
  }

  private clearRoot(): void {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      if (child instanceof THREE.Mesh) child.geometry.dispose();
      if (child instanceof THREE.PointLight) child.dispose();
    }
    this.pickables.length = 0;
  }

  private ensureScene(): void {
    if (!this.doc) return;
    const lodBucket = this.view.span >= 420 ? 'far' : this.view.span >= 180 ? 'mid' : 'near';
    const key = `${this.docRevision}|${lodBucket}|${this.presetId}|${this.hideRoofs ? 'cut' : 'full'}`;
    if (key === this.sceneKey && this.plan) return;

    this.clearRoot();
    const warmWindows = this.look === 'indoor' || this.lightingMode !== 'day';
    const plan = buildAtlasThreeScenePlan(this.doc, {
      mapScale: this.mapScale,
      look: this.look,
      span: this.view.span,
      presetId: this.presetId,
      seed: this.seed,
      hideRoofs: this.hideRoofs,
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

    // Instanced suggestive scenery scatter (ATL3-D01 #1327) — 1 draw call per mesh part!
    for (const batch of plan.scatterBatches) {
      const { parts } = buildScatterGeometry(batch.kind);
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

    const torchColor = new THREE.Color(0xffaa56);
    for (const t of plan.torches) {
      const intensityScale = this.look === 'indoor' || this.lightingMode === 'night' ? 1.0 : 0.4;
      const light = new THREE.PointLight(
        torchColor,
        1.7 * (t.radius / 4) ** 2 * intensityScale,
        t.radius,
        2,
      );
      light.position.copy(t.position);
      this.root.add(light);
      const sprite = new THREE.Sprite(this.haloMat);
      sprite.position.copy(t.position);
      sprite.scale.setScalar(t.radius * 0.3);
      sprite.renderOrder = 3;
      this.root.add(sprite);
    }

    this.plan = plan;
    this.sceneKey = key;
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

  private syncCameraAndLighting(w: number, h: number): void {
    const aspect = w / Math.max(1, h);
    const rig = buildAtlasThreeCameraRig(this.view, aspect);
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
    this.scene.background = new THREE.Color(spec.background);
    const band = buildAtlasThreeFogBand(rig, this.look);
    this.scene.fog = new THREE.Fog(spec.background, band.near, band.far);
    this.hemi.color.set(spec.hemiSky);
    this.hemi.groundColor.set(spec.hemiGround);
    this.hemi.intensity = spec.hemiIntensity;
    this.sun.color.set(spec.sunColor);
    this.sun.intensity = spec.sunIntensity;
    this.fill.color.set(spec.fillColor);
    this.fill.intensity = spec.fillIntensity;
    this.renderer.toneMappingExposure = spec.exposure;

    const ext = this.view.span * aspect * (rig.perspective ? 2.1 : 1.4);
    const reach = rig.distance * 1.4 + 600;
    this.sun.position.copy(at).addScaledVector(sunDir, reach);
    this.sun.target.position.copy(at);
    this.fill.position.copy(at).addScaledVector(fillDir, reach);
    this.fill.target.position.copy(at);
    const sc = this.sun.shadow.camera;
    sc.left = -ext;
    sc.right = ext;
    sc.top = ext;
    sc.bottom = -ext;
    sc.near = 1;
    sc.far = reach * 2 + 400;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = ((ext * 2) / this.sun.shadow.mapSize.x) * 1.25;
    this.sun.target.updateMatrixWorld();
    this.fill.target.updateMatrixWorld();

    const u = this.waterMat.uniforms;
    u.uDeep.value.set(spec.waterDeep);
    u.uShallow.value.set(spec.waterShallow);
    u.uSky.value.set(spec.waterSky);
    u.uSunDir.value.copy(sunDir);
    u.uFogColor.value.set(spec.background);
    u.uFogNear.value = band.near;
    u.uFogFar.value = band.far;
  }

  private lastPinEmitKey = '';

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
      v.set(pin.x, 12, pin.y).project(this.camera);
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
      const w = this.config.canvas.clientWidth;
      const h = this.config.canvas.clientHeight;
      if (w < 8 || h < 8) return;

      if (this.flight) {
        const t = (now - this.flight.startMs) / Math.max(1, this.flight.durationMs);
        this.view = interpolateAtlasThreeView(this.flight.from, this.flight.to, t);
        if (t >= 1) {
          this.flight = null;
          this.onCameraChange?.(this.view);
        }
      }

      if (this.config.canvas.width !== Math.round(w * this.renderer.getPixelRatio()) ||
          this.config.canvas.height !== Math.round(h * this.renderer.getPixelRatio())) {
        this.renderer.setSize(w, h, false);
      }

      this.ensureScene();
      this.syncCameraAndLighting(w, h);
      this.waterMat.uniforms.uTime.value = (now - this.startTime) * 0.001;
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
    this.clearRoot();
    this.selectionRing.geometry.dispose();
    (this.selectionRing.material as THREE.Material).dispose();
    this.gizmoAxisX.geometry.dispose();
    (this.gizmoAxisX.material as THREE.Material).dispose();
    this.gizmoAxisZ.geometry.dispose();
    (this.gizmoAxisZ.material as THREE.Material).dispose();
    for (const mat of this.materials.values()) mat.dispose();
    this.materials.clear();
    this.waterMat.dispose();
    this.haloMat.dispose();
    this.haloTex.dispose();
    this.pbr.dispose();
    this.renderer.dispose();
  }
}

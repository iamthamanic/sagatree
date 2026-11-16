/**
 * r01b-poc-runtime — ATL3-R01B (#1296) isolated Three.js renderer prototype.
 * Location: src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-runtime.ts
 *
 * Renders an `R01bScenePlan` (same canonical data/IDs as the productive custom WebGL)
 * with the Atlas-V8 look: PBR atlas (map/normal/roughness), MeshStandardMaterial,
 * PCF shadow maps, ACES tone mapping, sRGB output, fog, InstancedMesh, torch point
 * lights and a prototype-GLSL water ShaderMaterial. Read-only: no write/persist path.
 * Not product-mounted (ADR-ST-11); exercised only by e2e/atl3-r01b-three-poc.spec.ts.
 */
import * as THREE from 'three';
import type { UnifiedCanvasDoc } from '../../../domains/world/atlas/unified-canvas-doc';
import { r01bCameraRig, r01bFogBand, type R01bCameraRig, type R01bView } from './r01b-poc-camera';
import {
  buildR01bScenePlan,
  R01B_PBR_KINDS,
  R01B_SURFACES,
  type R01bLook,
  type R01bMapScale,
  type R01bPbrKind,
  type R01bScenePlan,
  type R01bSurfaceKey,
} from './r01b-poc-scene';

export type R01bQuality = 'high' | 'balanced';
export type R01bPbrTextureSet = { readonly map: string; readonly normal: string; readonly rough: string };
export type R01bPbrAtlas = Readonly<Record<R01bPbrKind, R01bPbrTextureSet>>;

export type R01bRenderInfo = {
  readonly calls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
};

export type R01bLoadTimings = {
  readonly textureDecodeMs: number;
  readonly sceneBuildMs: number;
  readonly shaderCompileMs: number;
  readonly firstFrameMs: number;
};

const LOOKS = {
  outdoor: {
    background: '#799eaa', hemiSky: '#c5dfd8', hemiGround: '#53664b', hemi: 2.0,
    sun: '#ffdfb4', sunI: 3.5, fill: '#a8cde3', fillI: 0.8, exposure: 1.2,
    deep: '#1f5a6e', shallow: '#4f9aa6', sky: '#a9cbd3',
  },
  indoor: {
    background: '#1a262b', hemiSky: '#9fb6b8', hemiGround: '#3a3530', hemi: 1.35,
    sun: '#ffe2bd', sunI: 2.6, fill: '#a8cde3', fillI: 0.45, exposure: 1.1,
    deep: '#123540', shallow: '#2f6f78', sky: '#56757a',
  },
} as const;

/** V8 sun / fill directions (relative to the focus point). */
const SUN_DIR = new THREE.Vector3(-10, 17, 9).normalize();
const FILL_DIR = new THREE.Vector3(7, 6, -7).normalize();

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

/** Prototype GLSL (issue #1296): analytic waves, fresnel sky, sun glint, own fog band. */
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
  return sin(p.x * 0.9 + uTime * 0.8) * 0.5 + sin(p.y * 1.3 - uTime * 0.6) * 0.35
       + sin((p.x + p.y) * 2.1 + uTime * 1.3) * 0.15;
}
void main() {
  vec2 p = vWorld.xz / uTile;
  float h = wave(p);
  vec3 n = normalize(vec3(wave(p + vec2(0.06, 0.0)) - h, 0.32, wave(p + vec2(0.0, 0.06)) - h));
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = mix(uDeep, uShallow, 0.4 + 0.3 * h);
  col = mix(col, uSky, clamp(fres * 0.65, 0.0, 1.0));
  col += vec3(1.0, 0.93, 0.8) * pow(max(dot(reflect(-uSunDir, n), v), 0.0), 64.0) * 0.55;
  col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vDepth));
  gl_FragColor = vec4(col, 0.93);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Procedural radial glow as a CanvasTexture (issue #1296: CanvasTexture path) for torch halos. */
function torchHaloTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,236,190,1)');
    g.addColorStop(0.25, 'rgba(255,184,104,0.55)');
    g.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

async function loadTexture(loader: THREE.TextureLoader, url: string, srgb: boolean, anisotropy: number): Promise<THREE.Texture> {
  const t = await loader.loadAsync(url);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export class R01bThreePoc {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private readonly root = new THREE.Group();
  private readonly hemi = new THREE.HemisphereLight();
  private readonly sun = new THREE.DirectionalLight();
  private readonly fill = new THREE.DirectionalLight();
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = new THREE.PerspectiveCamera();
  private readonly pbr = new Map<R01bPbrKind, { map: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture }>();
  private readonly materials = new Map<R01bSurfaceKey, THREE.MeshStandardMaterial>();
  private readonly water: THREE.ShaderMaterial;
  private readonly halo: THREE.SpriteMaterial;
  private readonly pickables: THREE.Mesh[] = [];
  private plan: R01bScenePlan | null = null;
  private doc: UnifiedCanvasDoc | null = null;
  private rig: R01bCameraRig | null = null;
  private sceneKey = '';
  private lastSceneBuildMs = 0;
  private contextLost = false;
  readonly timings: { textureDecodeMs: number; sceneBuildMs: number; shaderCompileMs: number; firstFrameMs: number } = {
    textureDecodeMs: 0, sceneBuildMs: 0, shaderCompileMs: 0, firstFrameMs: 0,
  };

  constructor(readonly canvas: HTMLCanvasElement, readonly quality: R01bQuality) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality === 'high',
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(quality === 'high' ? Math.min(window.devicePixelRatio || 1, 1.65) : 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.sun.castShadow = true;
    const size = quality === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.radius = quality === 'high' ? 3 : 1.5;
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target, this.root);
    this.water = new THREE.ShaderMaterial({
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uTile: { value: 38 },
        uDeep: { value: new THREE.Color() },
        uShallow: { value: new THREE.Color() },
        uSky: { value: new THREE.Color() },
        uSunDir: { value: SUN_DIR.clone() },
        uFogColor: { value: new THREE.Color() },
        uFogNear: { value: 1e6 },
        uFogFar: { value: 2e6 },
      },
    });
    this.halo = new THREE.SpriteMaterial({
      map: torchHaloTexture(),
      color: 0xffb36b,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    canvas.addEventListener('webglcontextlost', () => { this.contextLost = true; });
    canvas.addEventListener('webglcontextrestored', () => { this.contextLost = false; });
  }

  get isContextLost(): boolean {
    return this.contextLost;
  }

  async loadAtlas(atlas: R01bPbrAtlas): Promise<void> {
    const t0 = performance.now();
    const loader = new THREE.TextureLoader();
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    await Promise.all(
      R01B_PBR_KINDS.map(async (kind) => {
        const set = atlas[kind];
        const [map, normal, rough] = await Promise.all([
          loadTexture(loader, set.map, true, aniso),
          loadTexture(loader, set.normal, false, aniso),
          loadTexture(loader, set.rough, false, aniso),
        ]);
        this.pbr.set(kind, { map, normal, rough });
      }),
    );
    this.timings.textureDecodeMs = performance.now() - t0;
  }

  private material(key: R01bSurfaceKey): THREE.MeshStandardMaterial {
    const hit = this.materials.get(key);
    if (hit) return hit;
    const spec = R01B_SURFACES[key];
    const m = new THREE.MeshStandardMaterial({ color: spec.color, roughness: spec.roughness, metalness: 'metalness' in spec ? spec.metalness : 0 });
    const tex = spec.pbr ? this.pbr.get(spec.pbr) : undefined;
    if (tex) {
      m.map = tex.map;
      m.normalMap = tex.normal;
      m.roughnessMap = tex.rough;
      m.normalScale.set(spec.normalScale, spec.normalScale);
    }
    if ('emissive' in spec) {
      m.emissive = new THREE.Color(spec.emissive);
      m.emissiveIntensity = 2.2;
      m.toneMapped = false;
    }
    this.materials.set(key, m);
    return m;
  }

  /** Read-only: swap the canonical doc (e.g. after a 2D edit captured from the product). */
  setDoc(doc: UnifiedCanvasDoc, mapScale: R01bMapScale, look: R01bLook): void {
    this.doc = doc;
    this.sceneKey = '';
    this.plan = null;
    this.mapScale = mapScale;
    this.look = look;
  }
  private mapScale: R01bMapScale = 'settlement';
  private look: R01bLook = 'outdoor';

  private clearRoot(): void {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      if (child instanceof THREE.Mesh) child.geometry.dispose();
      if (child instanceof THREE.PointLight) child.dispose();
      // Sprites share one material/texture (disposed in dispose()).
    }
    this.pickables.length = 0;
  }

  /** (Re)build meshes when doc / LOD stride changes — mirrors the runtime fingerprint rebuild. */
  private ensureScene(view: R01bView): void {
    const doc = this.doc;
    if (!doc) throw new Error('R01B PoC: no doc');
    const span = view.span;
    const lodKey = span >= 280 ? 'far' : span >= 90 ? 'mid' : 'near';
    const key = `${lodKey}|${this.mapScale}|${this.look}|${this.quality}`;
    if (key === this.sceneKey && this.plan) return;
    const t0 = performance.now();
    this.clearRoot();
    const plan = buildR01bScenePlan(doc, { mapScale: this.mapScale, look: this.look, span, fullDetail: this.quality === 'high' });
    for (const [key2, builder] of plan.builders) {
      if (builder.triangleCount === 0) continue;
      const mesh = new THREE.Mesh(builder.build(), this.material(key2));
      const flat = key2.startsWith('sheet') || key2.startsWith('floor');
      mesh.castShadow = !flat;
      mesh.receiveShadow = true;
      mesh.userData.triIds = builder.triIds;
      mesh.name = `r01b:${key2}`;
      this.root.add(mesh);
      this.pickables.push(mesh);
    }
    if (plan.water.triangleCount > 0) {
      const mesh = new THREE.Mesh(plan.water.build(), this.water);
      mesh.userData.triIds = plan.water.triIds;
      mesh.name = 'r01b:water';
      mesh.renderOrder = 2;
      this.root.add(mesh);
      this.pickables.push(mesh);
    }
    if (plan.terrain) {
      const mats = plan.terrain.groups.map((g) => this.material(g.surface));
      plan.terrain.groups.forEach((g, i) => plan.terrain?.geometry.addGroup(g.start, g.count, i));
      const mesh = new THREE.Mesh(plan.terrain.geometry, mats);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'r01b:terrain';
      this.root.add(mesh);
    }
    if (plan.doorInstances.matrices.length) {
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.material('wood-dark'), plan.doorInstances.matrices.length);
      plan.doorInstances.matrices.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.userData.instanceIds = plan.doorInstances.ids;
      inst.name = 'r01b:doors';
      this.root.add(inst);
      this.pickables.push(inst);
    }
    const torchColor = new THREE.Color(0xffa858);
    for (const t of plan.torches) {
      const light = new THREE.PointLight(torchColor, 1.65 * (t.radius / 4) ** 2 * (this.look === 'indoor' ? 1 : 0.35), t.radius, 2);
      light.position.copy(t.position);
      light.name = `r01b:torch:${t.id}`;
      this.root.add(light);
      const sprite = new THREE.Sprite(this.halo);
      sprite.position.copy(t.position);
      sprite.scale.setScalar(t.radius * 0.32);
      sprite.renderOrder = 3;
      sprite.name = `r01b:halo:${t.id}`;
      this.root.add(sprite);
    }
    this.plan = plan;
    this.sceneKey = key;
    this.lastSceneBuildMs = performance.now() - t0;
    this.timings.sceneBuildMs = this.lastSceneBuildMs;
  }

  private applyView(view: R01bView): void {
    const w = this.canvas.clientWidth || this.canvas.width, h = this.canvas.clientHeight || this.canvas.height;
    this.renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    const rig = r01bCameraRig(view, aspect);
    this.rig = rig;
    if (rig.perspective) {
      const cam = this.camera instanceof THREE.PerspectiveCamera ? this.camera : new THREE.PerspectiveCamera();
      cam.fov = rig.fovYDeg;
      cam.aspect = aspect;
      cam.near = rig.near;
      cam.far = rig.far;
      this.camera = cam;
    } else {
      const cam = this.camera instanceof THREE.OrthographicCamera ? this.camera : new THREE.OrthographicCamera();
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

    const look = LOOKS[this.look];
    const at = new THREE.Vector3(rig.at[0], rig.at[1], rig.at[2]);
    this.scene.background = new THREE.Color(look.background);
    const band = r01bFogBand(rig, this.look);
    this.scene.fog = new THREE.Fog(look.background, band.near, band.far);
    this.hemi.color.set(look.hemiSky);
    this.hemi.groundColor.set(look.hemiGround);
    this.hemi.intensity = look.hemi;
    this.sun.color.set(look.sun);
    this.sun.intensity = look.sunI;
    this.fill.color.set(look.fill);
    this.fill.intensity = look.fillI;
    this.renderer.toneMappingExposure = look.exposure;
    // Shadow frustum fitted to the visible ground (perspective sees further than ortho).
    const ext = view.span * aspect * (rig.perspective ? 2.2 : 1.35);
    const reach = rig.distance * 1.5 + 600;
    this.sun.position.copy(at).addScaledVector(SUN_DIR, reach);
    this.sun.target.position.copy(at);
    this.fill.position.copy(at).addScaledVector(FILL_DIR, reach);
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
    this.sun.shadow.normalBias = ((ext * 2) / this.sun.shadow.mapSize.x) * 1.2;
    this.sun.target.updateMatrixWorld();
    this.fill.target.updateMatrixWorld();

    const u = this.water.uniforms;
    u.uDeep.value.set(look.deep);
    u.uShallow.value.set(look.shallow);
    u.uSky.value.set(look.sky);
    u.uFogColor.value.set(look.background);
    u.uFogNear.value = band.near;
    u.uFogFar.value = band.far;
  }

  /** Render one frame. Returns ms spent in scene build (0 when cached). */
  render(view: R01bView, timeSec = 0): number {
    const before = this.sceneKey;
    this.ensureScene(view);
    this.applyView(view);
    this.water.uniforms.uTime.value = timeSec;
    this.renderer.render(this.scene, this.camera);
    return before === this.sceneKey ? 0 : this.lastSceneBuildMs;
  }

  /** First render incl. explicit shader compile timing (cold-load evidence). */
  firstRender(view: R01bView): void {
    const t0 = performance.now();
    this.ensureScene(view);
    this.applyView(view);
    const c0 = performance.now();
    this.renderer.compile(this.scene, this.camera);
    this.timings.shaderCompileMs = performance.now() - c0;
    this.renderer.render(this.scene, this.camera);
    const gl = this.renderer.getContext();
    gl.finish();
    this.timings.firstFrameMs = performance.now() - t0;
  }

  info(): R01bRenderInfo {
    const i = this.renderer.info;
    return {
      calls: i.render.calls,
      triangles: i.render.triangles,
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      programs: i.programs?.length ?? 0,
    };
  }

  /** Canonical ids present in the Three scene (2D↔3D id stability evidence). */
  ids(): string[] {
    return [...(this.plan?.ids ?? [])].sort();
  }

  /** Position of an id's first triangle centroid / instance (edit-path evidence). */
  centroidOf(id: string): [number, number, number] | null {
    for (const mesh of this.pickables) {
      const triIds: unknown = mesh.userData.triIds;
      if (!Array.isArray(triIds)) continue;
      const pos = mesh.geometry.getAttribute('position');
      let sx = 0, sy = 0, sz = 0, n = 0;
      triIds.forEach((t, tri) => {
        if (t !== id) return;
        for (let k = 0; k < 3; k += 1) {
          sx += pos.getX(tri * 3 + k);
          sy += pos.getY(tri * 3 + k);
          sz += pos.getZ(tri * 3 + k);
          n += 1;
        }
      });
      if (n) return [sx / n, sy / n, sz / n];
    }
    return null;
  }

  /** Raycast pick at canvas pixel → canonical id (camera/picking parity evidence). */
  pick(px: number, py: number): string | null {
    const w = this.canvas.clientWidth || this.canvas.width, h = this.canvas.clientHeight || this.canvas.height;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((px / w) * 2 - 1, 1 - (py / h) * 2), this.camera);
    for (const hit of ray.intersectObjects(this.pickables, false)) {
      const obj = hit.object;
      const instanceIds: unknown = obj.userData.instanceIds;
      if (Array.isArray(instanceIds) && typeof hit.instanceId === 'number') {
        const v: unknown = instanceIds[hit.instanceId];
        if (typeof v === 'string') return v;
      }
      const triIds: unknown = obj.userData.triIds;
      if (Array.isArray(triIds) && typeof hit.faceIndex === 'number') {
        const v: unknown = triIds[hit.faceIndex];
        if (typeof v === 'string' && !v.startsWith('__')) return v;
      }
    }
    return null;
  }

  /** Project world point to canvas pixels with the current camera. */
  project(x: number, y: number, z: number): [number, number] {
    const w = this.canvas.clientWidth || this.canvas.width, h = this.canvas.clientHeight || this.canvas.height;
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return [(v.x * 0.5 + 0.5) * w, (0.5 - v.y * 0.5) * h];
  }

  forceContextLoss(): void {
    this.renderer.forceContextLoss();
  }

  forceContextRestore(): void {
    this.renderer.forceContextRestore();
  }

  dispose(): void {
    this.clearRoot();
    for (const m of this.materials.values()) m.dispose();
    this.materials.clear();
    for (const t of this.pbr.values()) {
      t.map.dispose();
      t.normal.dispose();
      t.rough.dispose();
    }
    this.pbr.clear();
    this.water.dispose();
    this.halo.map?.dispose();
    this.halo.dispose();
    this.renderer.dispose();
  }

  get currentRig(): R01bCameraRig | null {
    return this.rig;
  }
}

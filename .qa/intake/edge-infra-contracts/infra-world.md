# Infrastructure contract: world

**Status: SPEC; current branch source verified.** Implementation issue: **#812**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-world.json](source-contracts/infra-world.json) (SHA-256 `11a41c643aae13b78f564bd34d08fd46f01ebc94d42717c2977f6487b7b081ca`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

World profiles and17 world/atlas/place RPCs, item/NPC definition reads, world-atlas image storage and world-map-pins uploads. Class-field this.tableName resolves to world_profiles.

Owner/editor read differs from saga-player reveal projection; preserve p_saga_public_id,p_player_view and no private catalog/map/layer/title exposure.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (0): none.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 0.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| infra | `media` | #805 |  |

## Acceptance and negative tests (required, not executed)

- Create world/node/maps; edit/rename/reparent/duplicate/archive/delete with consequence preview and reload into DB-backed tree.
- Player sees only explicitly revealed map/place projection for the selected saga; owner without GM privileges follows actual per-RPC policy.
- Map pin upload uses storage bucket (not a table); every17 RPC dependency and profile CRUD transport ready before facade cutover.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

This area has no RPC, Edge, table, storage, realtime, fetch or auth calls. Its public browser processing/worker API is retained in the complete public declarations.

## Complete public declarations and facade operation contracts

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-camera.ts:10

```ts
export type R01bCameraMode = 'ortho-topdown' | 'diorama-oblique' | 'perspective';
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-camera.ts:12

```ts
export type R01bView = {
  readonly mode: R01bCameraMode;
  /** Canvas x (world x). */
  readonly x: number;
  /** Canvas y (world z). */
  readonly z: number;
  /** Half view height in world units (custom runtime `cameraState.span`). */
  readonly span: number;
  readonly yawRad: number;
  readonly pitchRad: number;
};
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-camera.ts:24

```ts
export type R01bCameraRig = {
  readonly eye: readonly [number, number, number];
  readonly at: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  /** Eye → focus distance used by the custom runtime (`d`). */
  readonly distance: number;
  readonly near: number;
  readonly far: number;
  readonly perspective: boolean;
  readonly fovYDeg: number;
  /** Ortho half extents (only meaningful when `perspective` is false). */
  readonly halfHeight: number;
  readonly halfWidth: number;
};
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-camera.ts:44

```ts
export function r01bClampPitch(mode: R01bCameraMode, pitch: number): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') return clamp(pitch, 0.61, 1.22);
  return clamp(pitch, 0.35, 1.35);
}
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-camera.ts:51

```ts
export function r01bCameraRig(view: R01bView, aspect: number): R01bCameraRig {
  const safeAspect = Math.max(0.2, aspect);
  const pitch = r01bClampPitch(view.mode, view.pitchRad);
  const forward: readonly [number, number] = [Math.sin(view.yawRad), Math.cos(view.yawRad)];
  const perspective = view.mode === 'perspective';
  const distance = view.span * (perspective ? 2.4 : 3.0);
  const at: readonly [number, number, number] = [view.x, 0, view.z];
  const topdown = view.mode === 'ortho-topdown';
  const eye: readonly [number, number, number] = topdown
    ? [view.x, distance + 5, view.z]
    : [
        view.x + forward[0] * Math.cos(pitch) * distance,
        Math.sin(pitch) * distance + 5,
        view.z + forward[1] * Math.cos(pitch) * distance,
      ];
  const up: readonly [number, number, number] = topdown ? [-forward[0], 0, -forward[1]] : [0, 1, 0];
  return {
    eye,
    at,
    up,
    distance,
    near: perspective ? Math.max(0.2, distance * 0.02) : 0.1,
    far: Math.max(8000, distance * 4 + 200),
    perspective,
    fovYDeg: 50,
    halfHeight: view.span,
    halfWidth: view.span * safeAspect,
  };
}
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-camera.ts:82

```ts
export function r01bFogBand(
  rig: R01bCameraRig,
  look: 'outdoor' | 'indoor',
): { readonly near: number; readonly far: number } {
  const d = rig.distance;
  // V8 ratios (city 18..40 @ d=22, crypt 13..32): fog starts behind the focus point.
  return look === 'indoor' ? { near: d * 0.95, far: d * 2.6 } : { near: d * 0.9, far: d * 3.2 };
}
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-harness.ts:15

```ts
export type R01bHarnessFrameStats = {
  readonly p50: number;
  readonly p95: number;
  readonly frames: number;
  /** Raw rAF deltas (ms) so callers can use the same percentile rule as ATL3-V01. */
  readonly deltas: readonly number[];
};
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-harness.ts:23

```ts
export type R01bHarnessApi = {
  readonly create: (opts: {
    readonly canvasId: string;
    readonly quality: R01bQuality;
    readonly atlas: R01bPbrAtlas;
  }) => Promise<{ readonly coldLoadMs: number; readonly textureDecodeMs: number }>;
  readonly setDoc: (raw: unknown, mapScale: R01bMapScale, look: R01bLook) => { readonly ok: boolean; readonly ids: number };
  readonly first: (view: R01bView) => { readonly shaderCompileMs: number; readonly firstFrameMs: number; readonly sceneBuildMs: number };
  readonly render: (view: R01bView) => R01bRenderInfo;
  readonly frames: (view: R01bView, count: number) => Promise<R01bHarnessFrameStats>;
  readonly ids: () => string[];
  readonly centroidOf: (id: string) => [number, number, number] | null;
  readonly pick: (px: number, py: number) => string | null;
  readonly project: (x: number, y: number, z: number) => [number, number];
  readonly contextLossRoundTrip: (view: R01bView) => Promise<{ readonly lost: boolean; readonly restored: boolean; readonly restoreMs: number; readonly info: R01bRenderInfo }>;
  readonly heapMb: () => number | null;
  /** Edge case "Ladefehler": a corrupt PBR texture must reject (no hang, no partial scene). */
  readonly loadErrorProbe: (atlas: R01bPbrAtlas) => Promise<{ readonly rejected: boolean; readonly ms: number; readonly message: string }>;
  readonly dispose: () => void;
};
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-runtime.ts:25

```ts
export type R01bQuality = 'high' | 'balanced';
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-runtime.ts:26

```ts
export type R01bPbrTextureSet = { readonly map: string; readonly normal: string; readonly rough: string };
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-runtime.ts:27

```ts
export type R01bPbrAtlas = Readonly<Record<R01bPbrKind, R01bPbrTextureSet>>;
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-runtime.ts:29

```ts
export type R01bRenderInfo = {
  readonly calls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
};
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-runtime.ts:37

```ts
export type R01bLoadTimings = {
  readonly textureDecodeMs: number;
  readonly sceneBuildMs: number;
  readonly shaderCompileMs: number;
  readonly firstFrameMs: number;
};
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-runtime.ts:133

```ts
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
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts:19

```ts
export type R01bMapScale = 'world' | 'settlement' | 'interior';
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts:20

```ts
export type R01bLook = 'outdoor' | 'indoor';
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts:21

```ts
export const R01B_PBR_KINDS = [
  'grass', 'dirt', 'moss', 'rock', 'wall', 'wood', 'roof', 'cobble', 'plaster', 'gravel',
] as const;
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts:24

```ts
export type R01bPbrKind = (typeof R01B_PBR_KINDS)[number];
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts:38

```ts
export const R01B_SURFACES = {
  'terrain-grass': { pbr: 'grass', color: '#ffffff', roughness: 0.97, normalScale: 0.63, tile: 70 },
  'terrain-shore': { pbr: 'gravel', color: '#e5d9c1', roughness: 0.93, normalScale: 0.51, tile: 50 },
  'terrain-bed': { pbr: 'gravel', color: '#75938a', roughness: 0.87, normalScale: 0.56, tile: 50 },
  'terrain-cliff': { pbr: 'rock', color: '#a9b2a0', roughness: 0.94, normalScale: 0.77, tile: 60 },
  'sheet-outdoor': { pbr: 'grass', color: '#c9d6b5', roughness: 0.97, normalScale: 0.5, tile: 70 },
  'sheet-indoor': { pbr: 'rock', color: '#4d565a', roughness: 0.96, normalScale: 0.7, tile: 60 },
  'floor-cobble': { pbr: 'cobble', color: '#d2c9b2', roughness: 0.9, normalScale: 0.68, tile: 34 },
  'floor-stone': { pbr: 'cobble', color: '#a8a59a', roughness: 0.92, normalScale: 0.72, tile: 30 },
  'floor-wood': { pbr: 'wood', color: '#d3a77b', roughness: 0.86, normalScale: 0.56, tile: 30 },
  'floor-dirt': { pbr: 'dirt', color: '#c6b18a', roughness: 0.98, normalScale: 0.58, tile: 40 },
  'floor-gravel': { pbr: 'gravel', color: '#e5d9c1', roughness: 0.93, normalScale: 0.51, tile: 40 },
  'floor-grass': { pbr: 'grass', color: '#ffffff', roughness: 0.97, normalScale: 0.63, tile: 60 },
  'floor-moss': { pbr: 'moss', color: '#a1c3a1', roughness: 0.94, normalScale: 0.56, tile: 40 },
  wall: { pbr: 'wall', color: '#ddd6bf', roughness: 0.94, normalScale: 0.58, tile: 26 },
  'wall-indoor': { pbr: 'wall', color: '#b8b19e', roughness: 0.95, normalScale: 0.66, tile: 22 },
  plaster: { pbr: 'plaster', color: '#f0dfbf', roughness: 0.97, normalScale: 0.33, tile: 22 },
  roof: { pbr: 'roof', color: '#f4c0a7', roughness: 0.85, normalScale: 0.81, tile: 18 },
  wood: { pbr: 'wood', color: '#d3a77b', roughness: 0.86, normalScale: 0.56, tile: 16 },
  'wood-dark': { pbr: 'wood', color: '#8d6a4b', roughness: 0.88, normalScale: 0.6, tile: 14 },
  rock: { pbr: 'rock', color: '#a9b2a0', roughness: 0.94, normalScale: 0.77, tile: 28 },
  leaf: { pbr: 'moss', color: '#8fbf8a', roughness: 0.94, normalScale: 0.56, tile: 18 },
  'leaf-pine': { pbr: 'moss', color: '#6f9f86', roughness: 0.94, normalScale: 0.56, tile: 18 },
  window: { pbr: null, color: '#2a3a48', roughness: 0.25, normalScale: 0, tile: 1, metalness: 0.1 },
  flame: { pbr: null, color: '#ffb35c', roughness: 1, normalScale: 0, tile: 1, emissive: '#ffa858' },
} as const satisfies Record<string, SurfaceSpec>;
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts:64

```ts
export type R01bSurfaceKey = keyof typeof R01B_SURFACES;
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts:67

```ts
export function r01bFloorSurface(material: string | undefined, scale: R01bMapScale): R01bSurfaceKey | 'water' {
  const m = (material ?? '').toLowerCase();
  if (m === 'wasser' || m === 'water') return 'water';
  if (m === 'holz' || m === 'wood') return 'floor-wood';
  if (m === 'pflaster' || m === 'paving') return 'floor-cobble';
  if (m === 'stein' || m === 'stone') return scale === 'interior' ? 'floor-stone' : 'floor-cobble';
  if (m === 'erde' || m === 'earth') return 'floor-dirt';
  if (m === 'sand') return 'floor-gravel';
  if (m === 'moos' || m === 'moss') return 'floor-moss';
  return 'floor-grass';
}
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts:80

```ts
export class R01bGeoBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly triIds: string[] = [];

  constructor(private readonly tile: number) {}

  get triangleCount(): number {
    return this.triIds.length;
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, id: string, normal?: THREE.Vector3): void {
    const n = normal ?? new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (const p of [a, b, c]) {
      this.positions.push(p.x, p.y, p.z);
      this.normals.push(n.x, n.y, n.z);
      if (ay >= ax && ay >= az) this.uvs.push(p.x / this.tile, p.z / this.tile);
      else if (az >= ax) this.uvs.push(p.x / this.tile, p.y / this.tile);
      else this.uvs.push(p.z / this.tile, p.y / this.tile);
    }
    this.triIds.push(id);
  }

  /** Append a (possibly indexed) Three geometry transformed by `matrix`. */
  geometry(source: THREE.BufferGeometry, matrix: THREE.Matrix4, id: string): void {
    const g = source.index ? source.toNonIndexed() : source.clone();
    g.applyMatrix4(matrix);
    const pos = g.getAttribute('position');
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, i);
      const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
      this.tri(a, b, c, id);
    }
    g.dispose();
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.computeBoundingSphere();
    return g;
  }
}
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts:141

```ts
export type R01bScenePlan = {
  readonly builders: Map<R01bSurfaceKey, R01bGeoBuilder>;
  readonly water: R01bGeoBuilder;
  readonly terrain: {
    readonly geometry: THREE.BufferGeometry;
    readonly groups: readonly { readonly surface: R01bSurfaceKey; readonly start: number; readonly count: number }[];
    readonly stride: number;
  } | null;
  /** Door jambs + lintels as instances of one unit box (InstancedMesh). */
  readonly doorInstances: { readonly matrices: THREE.Matrix4[]; readonly ids: string[] };
  readonly torches: readonly { readonly id: string; readonly position: THREE.Vector3; readonly radius: number }[];
  readonly ids: ReadonlySet<string>;
  readonly planFingerprint: string;
  readonly look: R01bLook;
  readonly mapScale: R01bMapScale;
};
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts:159

```ts
export function r01bTerrainStride(span: number, cols: number, rows: number): number {
  const preferred = span >= 280 ? 4 : span >= 90 ? 2 : 1;
  const maxTris = preferred >= 4 ? 800 : preferred >= 2 ? 2500 : 8000;
  let stride = Math.max(1, preferred);
  const estimate = (s: number): number => Math.ceil((cols - 1) / s) * Math.ceil((rows - 1) / s) * 2;
  while (estimate(stride) > maxTris && stride < Math.max(cols, rows)) stride += 1;
  return stride;
}
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts:374

```ts
export type R01bSceneOptions = {
  readonly mapScale: R01bMapScale;
  readonly look: R01bLook;
  /** Camera span — drives the terrain LOD stride exactly like the custom runtime. */
  readonly span: number;
  readonly fullDetail: boolean;
};
```

### src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts:383

```ts
export function buildR01bScenePlan(doc: UnifiedCanvasDoc, opts: R01bSceneOptions): R01bScenePlan {
  const plan = buildAtlasProductGeometryPlan(doc, { mapScale: opts.mapScale });
  const builders = new Map<R01bSurfaceKey, R01bGeoBuilder>();
  const get = (k: R01bSurfaceKey): R01bGeoBuilder => {
    let b = builders.get(k);
    if (!b) {
      b = new R01bGeoBuilder(R01B_SURFACES[k].tile);
      builders.set(k, b);
    }
    return b;
  };
  const water = new R01bGeoBuilder(60);
  const ids = new Set<string>();
  const torches: { id: string; position: THREE.Vector3; radius: number }[] = [];
  const doorInstances: { matrices: THREE.Matrix4[]; ids: string[] } = { matrices: [], ids: [] };
  const up = new THREE.Vector3(0, 1, 0);

  // Sheet (non-world product maps) at y −0.5 — PRODUCT_FRAME 1000×1000.
  if (opts.mapScale !== 'world') {
    const b = get(opts.look === 'indoor' ? 'sheet-indoor' : 'sheet-outdoor');
    const y = -0.5;
    const p = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    b.tri(p(0, 0), p(0, 1000), p(1000, 1000), '__sheet', up);
    b.tri(p(0, 0), p(1000, 1000), p(1000, 0), '__sheet', up);
  }

  const rooms = plan.primitives.filter((q): q is Extract<AtlasProductGeometryPrimitive, { kind: 'area' | 'room' }> => q.kind === 'area' || q.kind === 'room');
  const dyR = Math.min(0.075, 0.3 / Math.max(1, rooms.length));
  const roomMaterial = new Map(doc.rooms.map((r) => [r.id, r.material] as const));
  rooms.forEach((rm, i) => {
    const y = -0.48 + i * dyR;
    const surface = r01bFloorSurface(roomMaterial.get(rm.id), opts.mapScale);
    const b = surface === 'water' ? water : get(surface);
    for (const [ia, ib, ic] of rm.triangles) {
      const a = rm.points[ia], c = rm.points[ib], d = rm.points[ic];
      if (!a || !c || !d) continue;
      const va = new THREE.Vector3(a[0], y, a[1]), vb = new THREE.Vector3(c[0], y, c[1]), vc = new THREE.Vector3(d[0], y, d[1]);
      // Canvas winding varies — always emit an upward-facing triangle.
      const n = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va));
      if (n.y >= 0) b.tri(va, vb, vc, rm.id, up);
      else b.tri(va, vc, vb, rm.id, up);
    }
    ids.add(rm.id);
  });

  const paths = plan.primitives.filter((q): q is Extract<AtlasProductGeometryPrimitive, { kind: 'path' }> => q.kind === 'path');
  const dyS = Math.min(0.03, 0.11 / Math.max(1, paths.length));
  const strokeMaterial = new Map(doc.strokes.map((s) => [s.id, s.material] as const));
  paths.forEach((pt, i) => {
    const surface = r01bFloorSurface(strokeMaterial.get(pt.id), opts.mapScale);
    ribbon(surface === 'water' ? water : get(surface), pt.points, pt.width, -0.16 + i * dyS, pt.id);
    ids.add(pt.id);
  });

  const wallH = opts.mapScale === 'interior' ? 22 : opts.mapScale === 'settlement' ? 8 : 3;
  const doorsByWall = new Map<string, Extract<AtlasProductGeometryPrimitive, { kind: 'door' }>[]>();
  for (const q of plan.primitives) {
    if (q.kind !== 'door') continue;
    const list = doorsByWall.get(q.wallId) ?? [];
    list.push(q);
    doorsByWall.set(q.wallId, list);
  }
  const wallKey: R01bSurfaceKey = opts.look === 'indoor' ? 'wall-indoor' : 'wall';
  for (const q of plan.primitives) {
    if (q.kind !== 'wall') continue;
    ids.add(q.id);
    const dx = q.end[0] - q.start[0], dz = q.end[1] - q.start[1], length = Math.hypot(dx, dz);
    if (length < 0.02) continue;
    const thick = Math.max(0.3, q.width || wallH * 0.15);
    const gaps = (doorsByWall.get(q.id) ?? [])
      .map((d) => {
        const halfT = Math.min(0.49, Math.max(0.4, d.width || 1.2) / 2 / length);
        const t = Math.min(1, Math.max(0, d.t || 0.5));
        return [Math.max(0, t - halfT), Math.min(1, t + halfT)] as [number, number];
      })
      .sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const g of gaps) {
      const last = merged[merged.length - 1];
      if (!last || g[0] > last[1] + 1e-4) merged.push([g[0], g[1]]);
      else last[1] = Math.max(last[1], g[1]);
    }
    let cursor = 0;
    const at = (t: number): readonly [number, number] => [q.start[0] + dx * t, q.start[1] + dz * t];
    for (const [g0, g1] of merged) {
      if (g0 - cursor > 1e-3) wallBox(get(wallKey), at(cursor), at(g0), thick, -0.02, wallH, q.id);
      cursor = g1;
    }
    if (1 - cursor > 1e-3) wallBox(get(wallKey), at(cursor), q.end, thick, -0.02, wallH, q.id);
  }

  // Doors: jambs + lintel (same dimensions as productDoorInto) → one InstancedMesh.
  for (const q of plan.primitives) {
    if (q.kind !== 'door') continue;
    ids.add(q.id);
    const width = Math.max(0.4, q.width || 1.2), openH = Math.max(1.2, wallH * 0.82), lintelH = Math.max(0.25, wallH - openH);
    const [tx, tz] = q.tangent, [x, z] = q.position;
    const half = width / 2, jamb = Math.max(0.18, width * 0.08), thick = Math.max(0.25, width * 0.12);
    const rot = Math.atan2(-tz, tx);
    for (const side of [-1, 1]) {
      const cx = x + tx * side * (half - jamb / 2), cz = z + tz * side * (half - jamb / 2);
      doorInstances.matrices.push(boxMatrix(cx, -0.02 + openH / 2, cz, jamb, openH, thick * 2, rot).clone());
      doorInstances.ids.push(q.id);
    }
    doorInstances.matrices.push(boxMatrix(x, -0.02 + openH + lintelH / 2, z, width, lintelH, thick * 2, rot).clone());
    doorInstances.ids.push(q.id);
  }

  for (const q of plan.primitives) {
    if (q.kind !== 'prop' && q.kind !== 'building_footprint') continue;
    ids.add(q.id);
    propInto(get, q, torches, opts.fullDetail);
  }

  const hf = doc.heightfield ?? null;
  const terrain = hf ? buildTerrain(hf, opts.span) : null;
  if (hf && terrain) {
    // Water plane at shore level over the heightfield chunk (runtime parity).
    const y = hf.waterLevel - 0.02, x0 = hf.originX, z0 = hf.originZ;
    const x1 = x0 + hf.cols * hf.cellSize, z1 = z0 + hf.rows * hf.cellSize;
    water.tri(new THREE.Vector3(x0, y, z0), new THREE.Vector3(x0, y, z1), new THREE.Vector3(x1, y, z1), '__terrain-water', up);
    water.tri(new THREE.Vector3(x0, y, z0), new THREE.Vector3(x1, y, z1), new THREE.Vector3(x1, y, z0), '__terrain-water', up);
  }

  return {
    builders,
    water,
    terrain,
    doorInstances,
    torches,
    ids,
    planFingerprint: plan.contentFingerprint,
    look: opts.look,
    mapScale: opts.mapScale,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:9

```ts
export type AtlasThreeCameraMode = 'ortho-topdown' | 'diorama-oblique' | 'perspective';
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:11

```ts
export type AtlasThreeCameraView = {
  readonly mode: AtlasThreeCameraMode;
  readonly x: number;
  readonly z: number;
  readonly span: number;
  readonly yawRad: number;
  readonly pitchRad: number;
};
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:20

```ts
export type AtlasThreeCameraRig = {
  readonly eye: readonly [number, number, number];
  readonly at: readonly [number, number, number];
  readonly up: readonly [number, number, number];
  readonly distance: number;
  readonly near: number;
  readonly far: number;
  readonly perspective: boolean;
  readonly fovYDeg: number;
  readonly halfHeight: number;
  readonly halfWidth: number;
};
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:37

```ts
export function clampAtlasThreePitch(mode: AtlasThreeCameraMode, pitch: number): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') return clamp(pitch, 0.55, 1.25);
  return clamp(pitch, 0.32, 1.38);
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:43

```ts
export function defaultAtlasThreePitch(mode: AtlasThreeCameraMode): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') return 1.02;
  return 0.88;
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:49

```ts
export function buildAtlasThreeCameraRig(
  view: AtlasThreeCameraView,
  aspect: number,
): AtlasThreeCameraRig {
  const safeAspect = Math.max(0.2, aspect);
  const pitch = clampAtlasThreePitch(view.mode, view.pitchRad);
  const forward: readonly [number, number] = [Math.sin(view.yawRad), Math.cos(view.yawRad)];
  const perspective = view.mode === 'perspective';
  const distance = view.span * (perspective ? 2.4 : 3.0);
  const at: readonly [number, number, number] = [view.x, 0, view.z];
  const topdown = view.mode === 'ortho-topdown';
  const eye: readonly [number, number, number] = topdown
    ? [view.x, distance + 5, view.z]
    : [
        view.x + forward[0] * Math.cos(pitch) * distance,
        Math.sin(pitch) * distance + 5,
        view.z + forward[1] * Math.cos(pitch) * distance,
      ];
  const up: readonly [number, number, number] = topdown
    ? [-forward[0], 0, -forward[1]]
    : [0, 1, 0];

  return {
    eye,
    at,
    up,
    distance,
    near: perspective ? Math.max(0.2, distance * 0.02) : 0.1,
    far: Math.max(8000, distance * 4 + 400),
    perspective,
    fovYDeg: 48,
    halfHeight: view.span,
    halfWidth: view.span * safeAspect,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:85

```ts
export function buildAtlasThreeFogBand(
  rig: AtlasThreeCameraRig,
  look: 'outdoor' | 'indoor',
): { readonly near: number; readonly far: number } {
  const d = rig.distance;
  return look === 'indoor'
    ? { near: d * 0.95, far: d * 2.8 }
    : { near: d * 0.95, far: d * 3.6 };
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:96

```ts
export function interpolateAtlasThreeView(
  from: AtlasThreeCameraView,
  to: AtlasThreeCameraView,
  t: number,
): AtlasThreeCameraView {
  const k = clamp(t, 0, 1);
  const e = k * k * (3 - 2 * k);
  const logFrom = Math.log(Math.max(1, from.span));
  const logTo = Math.log(Math.max(1, to.span));
  return {
    mode: to.mode,
    x: from.x + (to.x - from.x) * e,
    z: from.z + (to.z - from.z) * e,
    span: Math.exp(logFrom + (logTo - logFrom) * e),
    yawRad: from.yawRad + (to.yawRad - from.yawRad) * e,
    pitchRad: from.pitchRad + (to.pitchRad - from.pitchRad) * e,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-three-runtime.ts:37

```ts
export type AtlasThreeLightingMode = 'day' | 'evening' | 'night';
```

### src/infrastructure/world/atlas-three/atlas-three-runtime.ts:39

```ts
export type AtlasThreeProjectedPin = {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly left: number;
  readonly top: number;
  readonly visible: boolean;
};
```

### src/infrastructure/world/atlas-three/atlas-three-runtime.ts:48

```ts
export type AtlasThreeRuntimeConfig = {
  readonly canvas: HTMLCanvasElement;
  readonly presetId: AtlasGraphicsPresetId;
  readonly onCameraChange?: (view: AtlasThreeCameraView) => void;
  readonly onProjectedPins?: (pins: readonly AtlasThreeProjectedPin[]) => void;
  readonly onContextLostChange?: (lost: boolean) => void;
};
```

### src/infrastructure/world/atlas-three/atlas-three-runtime.ts:295

```ts
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
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:28

```ts
export type AtlasThreeLook = 'outdoor' | 'indoor';
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:30

```ts
export type AtlasThreeSurfaceSpec = {
  readonly pbr: AtlasPbrKind | null;
  readonly color: string;
  readonly roughness: number;
  readonly normalScale: number;
  readonly tile: number;
  readonly emissive?: string;
  readonly metalness?: number;
  readonly vertexColors?: boolean;
};
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:41

```ts
export const ATLAS_THREE_SURFACES = {
  terrain: {
    pbr: 'grass',
    color: '#ffffff',
    roughness: 0.94,
    normalScale: 0.72,
    tile: 74,
    vertexColors: true,
  },
  'sheet-outdoor': { pbr: 'grass', color: '#bdd0a8', roughness: 0.96, normalScale: 0.52, tile: 74 },
  'sheet-indoor': { pbr: 'rock', color: '#465056', roughness: 0.95, normalScale: 0.7, tile: 54 },
  'floor-cobble': { pbr: 'cobble', color: '#d8cfb8', roughness: 0.88, normalScale: 0.7, tile: 34 },
  'floor-stone': { pbr: 'cobble', color: '#a8a69d', roughness: 0.9, normalScale: 0.75, tile: 28 },
  'floor-wood': { pbr: 'wood', color: '#d5aa7e', roughness: 0.84, normalScale: 0.56, tile: 28 },
  'floor-dirt': { pbr: 'dirt', color: '#c8b28d', roughness: 0.96, normalScale: 0.58, tile: 42 },
  'floor-sand': { pbr: 'sand', color: '#e4d5af', roughness: 0.9, normalScale: 0.54, tile: 46 },
  'floor-grass': { pbr: 'grass', color: '#d7e2c2', roughness: 0.95, normalScale: 0.65, tile: 62 },
  'floor-moss': { pbr: 'moss', color: '#9fc29b', roughness: 0.94, normalScale: 0.6, tile: 42 },
  wall: { pbr: 'wall', color: '#ded7c2', roughness: 0.92, normalScale: 0.62, tile: 26 },
  'wall-indoor': { pbr: 'wall', color: '#b6b09f', roughness: 0.94, normalScale: 0.7, tile: 22 },
  plaster: { pbr: 'plaster', color: '#f2e3c7', roughness: 0.95, normalScale: 0.36, tile: 22 },
  'roof-tile': { pbr: 'roofTile', color: '#f2c4ae', roughness: 0.84, normalScale: 0.82, tile: 18 },
  'roof-slate': { pbr: 'roofSlate', color: '#b4c2cf', roughness: 0.76, normalScale: 0.78, tile: 18 },
  'roof-moss': { pbr: 'roofMoss', color: '#bed0a8', roughness: 0.88, normalScale: 0.8, tile: 18 },
  wood: { pbr: 'wood', color: '#d3a77b', roughness: 0.84, normalScale: 0.56, tile: 16 },
  'wood-dark': { pbr: 'wood', color: '#8a6648', roughness: 0.86, normalScale: 0.6, tile: 14 },
  'bark-birch': { pbr: 'plaster', color: '#dfd8c8', roughness: 0.86, normalScale: 0.4, tile: 14 },
  rock: { pbr: 'rock', color: '#b4bcb0', roughness: 0.92, normalScale: 0.82, tile: 32 },
  snow: { pbr: 'snow', color: '#eef4f8', roughness: 0.76, normalScale: 0.35, tile: 36 },
  leaf: { pbr: 'moss', color: '#7eb276', roughness: 0.92, normalScale: 0.55, tile: 18 },
  'leaf-birch': { pbr: 'moss', color: '#a1c97b', roughness: 0.9, normalScale: 0.5, tile: 18 },
  'leaf-pine': { pbr: 'moss', color: '#4f866a', roughness: 0.94, normalScale: 0.58, tile: 18 },
  flower: { pbr: null, color: '#e8c468', roughness: 0.85, normalScale: 0, tile: 1 },
  window: { pbr: null, color: '#2b3e4f', roughness: 0.22, normalScale: 0, tile: 1, metalness: 0.18 },
  'window-warm': {
    pbr: null,
    color: '#ffcf7d',
    roughness: 0.4,
    normalScale: 0,
    tile: 1,
    emissive: '#ffb658',
  },
  flame: { pbr: null, color: '#ffb961', roughness: 1, normalScale: 0, tile: 1, emissive: '#ffa64c' },
} as const satisfies Record<string, AtlasThreeSurfaceSpec>;
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:86

```ts
export type AtlasThreeSurfaceKey = keyof typeof ATLAS_THREE_SURFACES;
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:88

```ts
export function atlasThreeFloorSurface(
  material: string | undefined,
  scale: AtlasMapScale,
): AtlasThreeSurfaceKey | 'water' {
  const m = (material ?? '').toLowerCase();
  if (m === 'wasser' || m === 'water') return 'water';
  if (m === 'holz' || m === 'wood') return 'floor-wood';
  if (m === 'pflaster' || m === 'paving') return 'floor-cobble';
  if (m === 'stein' || m === 'stone') return scale === 'interior' ? 'floor-stone' : 'rock';
  if (m === 'erde' || m === 'earth') return 'floor-dirt';
  if (m === 'sand') return 'floor-sand';
  if (m === 'moos' || m === 'moss') return 'floor-moss';
  if (m === 'schnee' || m === 'snow') return 'snow';
  return 'floor-grass';
}
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:104

```ts
export class AtlasThreeGeoBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly triIds: string[] = [];

  constructor(private readonly tile: number) {}

  get triangleCount(): number {
    return this.triIds.length;
  }

  tri(
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    id: string,
    normal?: THREE.Vector3,
  ): void {
    const n =
      normal ??
      new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    for (const p of [a, b, c]) {
      this.positions.push(p.x, p.y, p.z);
      this.normals.push(n.x, n.y, n.z);
      if (ay >= ax && ay >= az) this.uvs.push(p.x / this.tile, p.z / this.tile);
      else if (az >= ax) this.uvs.push(p.x / this.tile, p.y / this.tile);
      else this.uvs.push(p.z / this.tile, p.y / this.tile);
    }
    this.triIds.push(id);
  }

  geometry(source: THREE.BufferGeometry, matrix: THREE.Matrix4, id: string): void {
    const g = source.index ? source.toNonIndexed() : source.clone();
    g.applyMatrix4(matrix);
    const pos = g.getAttribute('position');
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, i);
      const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
      this.tri(a, b, c, id);
    }
    g.dispose();
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.computeBoundingSphere();
    return g;
  }
}
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:189

```ts
export type AtlasThreeScatterBatch = {
  readonly kind: AtlasScatterKind;
  readonly matrices: readonly THREE.Matrix4[];
};
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:194

```ts
export type AtlasThreeScenePlan = {
  readonly builders: Map<AtlasThreeSurfaceKey, AtlasThreeGeoBuilder>;
  readonly water: AtlasThreeGeoBuilder;
  readonly terrain: THREE.BufferGeometry | null;
  readonly doorInstances: { readonly matrices: THREE.Matrix4[]; readonly ids: string[] };
  readonly scatterBatches: readonly AtlasThreeScatterBatch[];
  readonly torches: readonly {
    readonly id: string;
    readonly position: THREE.Vector3;
    readonly radius: number;
  }[];
  readonly ids: ReadonlySet<string>;
  readonly look: AtlasThreeLook;
  readonly mapScale: AtlasMapScale;
};
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:824

```ts
export type BuildAtlasThreeSceneOptions = {
  readonly mapScale: AtlasMapScale;
  readonly look: AtlasThreeLook;
  readonly span: number;
  readonly presetId: AtlasGraphicsPresetId;
  readonly seed: string;
  readonly hideRoofs?: boolean;
  readonly warmWindows?: boolean;
};
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:834

```ts
export function buildAtlasThreeScenePlan(
  doc: UnifiedCanvasDoc,
  opts: BuildAtlasThreeSceneOptions,
): AtlasThreeScenePlan {
  const plan = buildAtlasProductGeometryPlan(doc, { mapScale: opts.mapScale });
  const builders = new Map<AtlasThreeSurfaceKey, AtlasThreeGeoBuilder>();
  const get = (k: AtlasThreeSurfaceKey): AtlasThreeGeoBuilder => {
    let b = builders.get(k);
    if (!b) {
      b = new AtlasThreeGeoBuilder(ATLAS_THREE_SURFACES[k].tile);
      builders.set(k, b);
    }
    return b;
  };
  const water = new AtlasThreeGeoBuilder(56);
  const ids = new Set<string>();
  const torches: { id: string; position: THREE.Vector3; radius: number }[] = [];
  const doorInstances: { matrices: THREE.Matrix4[]; ids: string[] } = { matrices: [], ids: [] };
  const up = new THREE.Vector3(0, 1, 0);

  // Determine active terrain heightfield: canonical heightfield OR suggestive 3D fantasy world relief!
  const syntheticRelief =
    opts.look === 'outdoor' && !doc.heightfield && doc.layers.terrain !== false
      ? synthesizeWorldReliefHeightfield(doc, opts.seed)
      : null;
  const activeTerrainHf = doc.heightfield ?? syntheticRelief;
  const sampleGroundY = (x: number, z: number, fallback: number): number => {
    if (!activeTerrainHf) return fallback;
    const sampled = sampleHeightfield(activeTerrainHf, x, z);
    if (sampled === null || !Number.isFinite(sampled)) return fallback;
    return syntheticRelief ? Math.max(0.2, sampled) : sampled > fallback ? sampled : fallback;
  };

  // Full ocean surround (world), lush meadow horizon (settlement), or dark slate sheet (interior).
  if (opts.look === 'indoor') {
    const b = get('sheet-indoor');
    const y = -0.52;
    const p = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    b.tri(p(-600, -600), p(-600, 1600), p(1600, 1600), '__sheet', up);
    b.tri(p(-600, -600), p(1600, 1600), p(1600, -600), '__sheet', up);
  } else if (opts.mapScale === 'settlement') {
    const b = get('sheet-outdoor');
    const y = -0.54;
    const p = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    b.tri(p(-1400, -1400), p(-1400, 2400), p(2400, 2400), '__meadow', up);
    b.tri(p(-1400, -1400), p(2400, 2400), p(2400, -1400), '__meadow', up);
  } else {
    const wy = activeTerrainHf ? activeTerrainHf.waterLevel : -0.52;
    const p = (x: number, z: number): THREE.Vector3 => new THREE.Vector3(x, wy, z);
    water.tri(p(-1400, -1400), p(-1400, 2400), p(2400, 2400), '__ocean', up);
    water.tri(p(-1400, -1400), p(2400, 2400), p(2400, -1400), '__ocean', up);
  }

  const rooms = plan.primitives.filter(
    (q): q is Extract<AtlasProductGeometryPrimitive, { kind: 'area' | 'room' }> =>
      q.kind === 'area' || q.kind === 'room',
  );
  const dyR = Math.min(0.075, 0.3 / Math.max(1, rooms.length));
  const roomMaterial = new Map(doc.rooms.map((r) => [r.id, r.material] as const));
  rooms.forEach((rm, i) => {
    ids.add(rm.id);
    const matName = roomMaterial.get(rm.id);
    // When suggestive 3D fantasy terrain relief is active, the continuous terrain mesh
    // renders the land & water biomes cleanly without flat z-fighting slabs (keep paved squares!).
    if (syntheticRelief && matName !== 'pflaster') {
      return;
    }
    const y =
      syntheticRelief && matName === 'pflaster'
        ? sampleGroundY(
            rm.points.reduce((a, p) => a + p[0], 0) / Math.max(1, rm.points.length),
            rm.points.reduce((a, p) => a + p[1], 0) / Math.max(1, rm.points.length),
            4.5,
          ) + 0.38
        : -0.45 + i * dyR;
    // Settlement valley surround: render g.ocean / w.ocean as a lush grassy valley floor
    // instead of a flat water sheet so settlements like Dornhain sit in green hills.
    const surface: AtlasThreeSurfaceKey | 'water' =
      opts.mapScale === 'settlement' && (rm.id === 'g.ocean' || rm.id === 'w.ocean')
        ? 'sheet-outdoor'
        : atlasThreeFloorSurface(matName, opts.mapScale);
    const b = surface === 'water' ? water : get(surface);
    for (const [ia, ib, ic] of rm.triangles) {
      const a = rm.points[ia];
      const c = rm.points[ib];
      const d = rm.points[ic];
      if (!a || !c || !d) continue;
      const va = new THREE.Vector3(a[0], y, a[1]);
      const vb = new THREE.Vector3(c[0], y, c[1]);
      const vc = new THREE.Vector3(d[0], y, d[1]);
      const n = new THREE.Vector3().subVectors(vb, va).cross(new THREE.Vector3().subVectors(vc, va));
      if (n.y >= 0) b.tri(va, vb, vc, rm.id, up);
      else b.tri(va, vc, vb, rm.id, up);
    }
  });

  if (doc.layers.roads !== false) {
    const paths = plan.primitives.filter(
      (q): q is Extract<AtlasProductGeometryPrimitive, { kind: 'path' }> => q.kind === 'path',
    );
    const dyS = Math.min(0.03, 0.12 / Math.max(1, paths.length));
    const strokeMaterial = new Map(doc.strokes.map((s) => [s.id, s.material] as const));
    paths.forEach((pt, i) => {
      ids.add(pt.id);
      const matName = strokeMaterial.get(pt.id);
      // Rivers & mountain ridges are already sculpted directly into the suggestive 3D terrain!
      if (syntheticRelief && (matName === 'wasser' || matName === 'stein')) {
        return;
      }
      const surface = atlasThreeFloorSurface(matName, opts.mapScale);
      const lift = 0.55 + i * dyS;
      buildRibbon(
        surface === 'water' ? water : get(surface),
        pt.points,
        pt.width,
        -0.14 + i * dyS,
        pt.id,
        syntheticRelief ? (rx, rz) => sampleGroundY(rx, rz, 4.5) + lift : undefined,
      );
    });
  }

  const wallH = opts.mapScale === 'interior' ? 24 : opts.mapScale === 'settlement' ? 9 : 4;
  const doorsByWall = new Map<string, Extract<AtlasProductGeometryPrimitive, { kind: 'door' }>[]>();
  for (const q of plan.primitives) {
    if (q.kind !== 'door') continue;
    const list = doorsByWall.get(q.wallId) ?? [];
    list.push(q);
    doorsByWall.set(q.wallId, list);
  }
  const wallKey: AtlasThreeSurfaceKey = opts.look === 'indoor' ? 'wall-indoor' : 'wall';
  for (const q of plan.primitives) {
    if (q.kind !== 'wall') continue;
    ids.add(q.id);
    const dx = q.end[0] - q.start[0];
    const dz = q.end[1] - q.start[1];
    const length = Math.hypot(dx, dz);
    if (length < 0.02) continue;
    const thick = Math.max(0.4, q.width);
    const doors = (doorsByWall.get(q.id) ?? []).slice().sort((a, b) => a.t - b.t);
    const pt = (t: number): readonly [number, number] => [
      q.start[0] + dx * t,
      q.start[1] + dz * t,
    ];
    let cursor = 0;
    for (const dr of doors) {
      ids.add(dr.id);
      const half = Math.min(0.45, Math.max(0.2, dr.width) / (2 * length));
      const a = Math.max(cursor, dr.t - half);
      const b = Math.min(1, dr.t + half);
      if (a - cursor > 1e-3) wallBox(get(wallKey), pt(cursor), pt(a), thick, -0.42, wallH, q.id);
      const doorH = wallH * 0.72;
      const lintelH = wallH - doorH;
      if (lintelH > 0.2) wallBox(get(wallKey), pt(a), pt(b), thick, -0.42 + doorH, lintelH, q.id);
      const rot = Math.atan2(-dz, dx);
      const jambW = Math.max(0.25, thick * 0.45);
      for (const endT of [a, b]) {
        const [jx, jz] = pt(endT);
        doorInstances.matrices.push(
          composeMatrix(jx, -0.42 + doorH / 2, jz, jambW, doorH, thick * 1.18, rot),
        );
        doorInstances.ids.push(dr.id);
      }
      const [mx, mz] = pt((a + b) / 2);
      doorInstances.matrices.push(
        composeMatrix(mx, -0.42 + doorH, mz, Math.max(0.2, (b - a) * length), jambW, thick * 1.2, rot),
      );
      doorInstances.ids.push(dr.id);
      cursor = Math.max(cursor, b);
    }
    if (1 - cursor > 1e-3) wallBox(get(wallKey), pt(cursor), pt(1), thick, -0.42, wallH, q.id);
  }

  const objAngles = new Map(doc.objects.map((o) => [o.id, o.angle ?? 0] as const));
  const fullDetail = opts.presetId === 'high' || opts.span < 380;
  const showCanonicalObjects =
    opts.mapScale === 'world' ? doc.layers.terrain !== false : doc.layers.objects !== false;
  if (showCanonicalObjects) {
    for (const q of plan.primitives) {
      if (q.kind !== 'prop' && q.kind !== 'building_footprint') continue;
      ids.add(q.id);
      const groundElevation = sampleGroundY(q.x, q.y, -0.35);
      emitCanonicalProp(get, q, objAngles.get(q.id) ?? 0, torches, {
        fullDetail,
        hideRoofs: Boolean(opts.hideRoofs),
        warmWindows: Boolean(opts.warmWindows),
        groundElevation,
      });
    }
  }

  const terrain =
    doc.layers.terrain !== false && activeTerrainHf
      ? buildBlendedTerrain(activeTerrainHf, opts.span)
      : null;

  // Suggestive scenery scatter (ATL3-D01 #1327) grouped by kind for InstancedMesh rendering.
  const scatter = buildAtlasSceneScatter({
    doc,
    seed: opts.seed,
    mapScale: opts.mapScale,
    presetId: opts.presetId,
    elevationSampler: activeTerrainHf
      ? (x, y) => sampleGroundY(x, y, 0)
      : undefined,
  });
  const scatterByKind = new Map<AtlasScatterKind, THREE.Matrix4[]>();
  for (const inst of scatter.instances) {
    const list = scatterByKind.get(inst.kind) ?? [];
    list.push(
      composeMatrix(
        inst.x,
        inst.elevation,
        inst.y,
        inst.scale,
        inst.scale,
        inst.scale,
        inst.rotationRad,
      ),
    );
    scatterByKind.set(inst.kind, list);
  }
  const scatterBatches: AtlasThreeScatterBatch[] = [];
  for (const [kind, matrices] of scatterByKind) {
    if (matrices.length > 0) scatterBatches.push({ kind, matrices });
  }

  return {
    builders,
    water,
    terrain,
    doorInstances,
    scatterBatches,
    torches,
    ids,
    look: opts.look,
    mapScale: opts.mapScale,
  };
}
```

### src/infrastructure/world/atlas-three/pbr-textures.ts:11

```ts
export const ATLAS_PBR_KINDS = [
  'grass',
  'dirt',
  'moss',
  'rock',
  'snow',
  'sand',
  'gravel',
  'cobble',
  'wall',
  'plaster',
  'wood',
  'roofTile',
  'roofSlate',
  'roofMoss',
] as const;
```

### src/infrastructure/world/atlas-three/pbr-textures.ts:28

```ts
export type AtlasPbrKind = (typeof ATLAS_PBR_KINDS)[number];
```

### src/infrastructure/world/atlas-three/pbr-textures.ts:30

```ts
export type AtlasPbrTextureSet = {
  readonly map: THREE.CanvasTexture;
  readonly normal: THREE.CanvasTexture;
  readonly rough: THREE.CanvasTexture;
};
```

### src/infrastructure/world/atlas-three/pbr-textures.ts:344

```ts
export class AtlasPbrTextureLibrary {
  private readonly sets = new Map<AtlasPbrKind, AtlasPbrTextureSet>();

  constructor(
    private readonly size: number,
    private readonly anisotropy: number,
  ) {}

  get(kind: AtlasPbrKind): AtlasPbrTextureSet {
    const cached = this.sets.get(kind);
    if (cached) return cached;
    const created = synthesizeSurface(kind, this.size, this.anisotropy);
    this.sets.set(kind, created);
    return created;
  }

  dispose(): void {
    for (const set of this.sets.values()) {
      set.map.dispose();
      set.normal.dispose();
      set.rough.dispose();
    }
    this.sets.clear();
  }
}
```

### src/infrastructure/world/host-world-adapter.ts:13

```ts
export type HostWorldAdapter = HostWorldPorts & {
  readonly transport: 'host';
  readonly rpcNames: typeof HOST_WORLD_RPC_NAMES;
};
```

### src/infrastructure/world/host-world-adapter.ts:22

```ts
export function createHostWorldAdapter(ports: HostWorldPorts): HostWorldAdapter {
  return {
    transport: 'host',
    rpcNames: HOST_WORLD_RPC_NAMES,
    listOwnedWorlds: (actorId) => ports.listOwnedWorlds(actorId),
    getWorld: (actorId, worldId) => ports.getWorld(actorId, worldId),
    createOwnedWorld: (actorId, title) => ports.createOwnedWorld(actorId, title),
    updateOwnedWorld: (actorId, worldId, title) => ports.updateOwnedWorld(actorId, worldId, title),
    deleteOwnedWorld: (actorId, worldId) => ports.deleteOwnedWorld(actorId, worldId),
    getWorldMap: (actorId, worldProfileId, playerView) =>
      ports.getWorldMap(actorId, worldProfileId, playerView),
    saveWorldMap: (actorId, worldProfileId, expectedRevision, mapData) =>
      ports.saveWorldMap(actorId, worldProfileId, expectedRevision, mapData),
    ensureWorldAtlasRoot: (actorId, worldProfileId) =>
      ports.ensureWorldAtlasRoot(actorId, worldProfileId),
    listWorldAtlasMaps: (actorId, worldProfileId, playerView, sagaPublicId) =>
      ports.listWorldAtlasMaps(actorId, worldProfileId, playerView, sagaPublicId),
    getWorldAtlasMap: (actorId, mapId, playerView, sagaPublicId) =>
      ports.getWorldAtlasMap(actorId, mapId, playerView, sagaPublicId),
    upsertWorldAtlasMap: (actorId, input) => ports.upsertWorldAtlasMap(actorId, input),
    deleteWorldAtlasMap: (actorId, worldProfileId, mapId) =>
      ports.deleteWorldAtlasMap(actorId, worldProfileId, mapId),
    listWorldPlaces: (actorId, worldProfileId, playerView, sagaPublicId) =>
      ports.listWorldPlaces(actorId, worldProfileId, playerView, sagaPublicId),
    listWorldPlaceMapLinks: (actorId, worldProfileId, playerView, sagaPublicId) =>
      ports.listWorldPlaceMapLinks(actorId, worldProfileId, playerView, sagaPublicId),
    upsertWorldPlace: (actorId, input) => ports.upsertWorldPlace(actorId, input),
    upsertWorldPlaceMapLink: (actorId, input) => ports.upsertWorldPlaceMapLink(actorId, input),
    createWorldNodeWithMaps: (actorId, input) => ports.createWorldNodeWithMaps(actorId, input),
    renameWorldNode: (actorId, input) => ports.renameWorldNode(actorId, input),
    reparentWorldNode: (actorId, input) => ports.reparentWorldNode(actorId, input),
    duplicateWorldNode: (actorId, input) => ports.duplicateWorldNode(actorId, input),
    previewWorldNodeConsequences: (actorId, input) =>
      ports.previewWorldNodeConsequences(actorId, input),
    archiveWorldNodeSubtree: (actorId, input) => ports.archiveWorldNodeSubtree(actorId, input),
    deleteWorldNode: (actorId, input) => ports.deleteWorldNode(actorId, input),
    publishWorldAsset: (actorId, input) => ports.publishWorldAsset(actorId, input),
  };
}
```

### src/infrastructure/world/host-world-ports.contract.ts:16

```ts
export type HostWorldMapDto = {
  readonly worldProfileId: string;
  readonly revision: number;
  readonly mapData: Readonly<Record<string, unknown>>;
  readonly updatedAt: string | null;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:23

```ts
export type HostWorldAtlasMapSummary = {
  readonly id: string;
  readonly worldProfileId: string;
  readonly parentMapId: string | null;
  readonly kind: string;
  readonly title: string;
  readonly sortOrder: number;
  readonly revision: number;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:33

```ts
export type HostWorldAtlasMapVm = HostWorldAtlasMapSummary & {
  readonly bounds: Readonly<Record<string, unknown>>;
  readonly layers: Readonly<Record<string, unknown>>;
  readonly basemapStoragePath: string | null;
  readonly azgaarMapStoragePath: string | null;
  readonly generatorMeta: Readonly<Record<string, unknown>>;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:42

```ts
export type HostWorldPlaceVm = Readonly<Record<string, unknown>> & {
  readonly id: string;
  readonly worldProfileId: string;
  readonly name: string;
  readonly kind: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:49

```ts
export type HostWorldPlaceMapLinkVm = Readonly<Record<string, unknown>> & {
  readonly id: string;
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:57

```ts
export type HostUpsertWorldAtlasMapInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:61

```ts
export type HostCreateWorldNodeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly kind: string;
  readonly name: string;
  readonly idempotencyKey: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:68

```ts
export type HostCreateWorldNodeResult = Readonly<Record<string, unknown>> & {
  readonly targetPlaceId: string;
  readonly worldProfileId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:73

```ts
export type HostRenameWorldNodeInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly name: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:79

```ts
export type HostReparentWorldNodeInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly newParentPlaceId: string | null;
  readonly confirmRelocate: boolean;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:86

```ts
export type HostDuplicateWorldNodeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:91

```ts
export type HostPreviewWorldNodeConsequencesInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:96

```ts
export type HostArchiveWorldNodeSubtreeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:101

```ts
export type HostDeleteWorldNodeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:106

```ts
export type HostUpsertWorldPlaceInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly kind: string;
  readonly name: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:112

```ts
export type HostUpsertWorldPlaceMapLinkInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:119

```ts
export type HostWorldAssetPublishInput = {
  readonly worldProfileId: string;
  readonly kind: 'map-pin' | 'world-atlas';
  readonly bytes: Uint8Array;
  readonly contentType: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:126

```ts
export type HostWorldAssetPublishResult = {
  readonly assetId: string;
  readonly contentType: string;
  /** Opaque storage reference (successor of Supabase bucket path). */
  readonly storageRef: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:137

```ts
export type HostWorldPorts = HostWorldReadPort & {
  readonly createOwnedWorld: (
    actorId: string,
    title: string,
  ) => Promise<HostWorldReadResult<{ readonly id: string; readonly title: string; readonly createdAt: string }>>;
  readonly updateOwnedWorld: (
    actorId: string,
    worldId: string,
    title: string,
  ) => Promise<HostWorldReadResult<HostWorldReadDto>>;
  readonly deleteOwnedWorld: (
    actorId: string,
    worldId: string,
  ) => Promise<HostWorldReadResult<{ readonly deleted: true }>>;

  readonly getWorldMap: (
    actorId: string,
    worldProfileId: string,
    playerView?: boolean,
  ) => Promise<HostWorldReadResult<HostWorldMapDto>>;
  readonly saveWorldMap: (
    actorId: string,
    worldProfileId: string,
    expectedRevision: number | null,
    mapData: Readonly<Record<string, unknown>>,
  ) => Promise<HostWorldReadResult<HostWorldMapDto>>;

  readonly ensureWorldAtlasRoot: (
    actorId: string,
    worldProfileId: string,
  ) => Promise<HostWorldReadResult<readonly HostWorldAtlasMapSummary[]>>;
  readonly listWorldAtlasMaps: (
    actorId: string,
    worldProfileId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => Promise<HostWorldReadResult<readonly HostWorldAtlasMapSummary[]>>;
  readonly getWorldAtlasMap: (
    actorId: string,
    mapId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => Promise<HostWorldReadResult<HostWorldAtlasMapVm>>;
  readonly upsertWorldAtlasMap: (
    actorId: string,
    input: HostUpsertWorldAtlasMapInput,
  ) => Promise<HostWorldReadResult<HostWorldAtlasMapVm>>;
  /** ATL2-E01 — delete secondary atlas map (not primary / not root). */
  readonly deleteWorldAtlasMap: (
    actorId: string,
    worldProfileId: string,
    mapId: string,
  ) => Promise<HostWorldReadResult<{ readonly deletedMapId: string }>>;

  readonly listWorldPlaces: (
    actorId: string,
    worldProfileId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => Promise<HostWorldReadResult<readonly HostWorldPlaceVm[]>>;
  readonly listWorldPlaceMapLinks: (
    actorId: string,
    worldProfileId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => Promise<HostWorldReadResult<readonly HostWorldPlaceMapLinkVm[]>>;
  readonly upsertWorldPlace: (
    actorId: string,
    input: HostUpsertWorldPlaceInput,
  ) => Promise<HostWorldReadResult<HostWorldPlaceVm>>;
  readonly upsertWorldPlaceMapLink: (
    actorId: string,
    input: HostUpsertWorldPlaceMapLinkInput,
  ) => Promise<HostWorldReadResult<HostWorldPlaceMapLinkVm>>;

  readonly createWorldNodeWithMaps: (
    actorId: string,
    input: HostCreateWorldNodeInput,
  ) => Promise<HostWorldReadResult<HostCreateWorldNodeResult>>;
  readonly renameWorldNode: (
    actorId: string,
    input: HostRenameWorldNodeInput,
  ) => Promise<HostWorldReadResult<HostWorldPlaceVm>>;
  readonly reparentWorldNode: (
    actorId: string,
    input: HostReparentWorldNodeInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;
  readonly duplicateWorldNode: (
    actorId: string,
    input: HostDuplicateWorldNodeInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;
  readonly previewWorldNodeConsequences: (
    actorId: string,
    input: HostPreviewWorldNodeConsequencesInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;
  readonly archiveWorldNodeSubtree: (
    actorId: string,
    input: HostArchiveWorldNodeSubtreeInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;
  readonly deleteWorldNode: (
    actorId: string,
    input: HostDeleteWorldNodeInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;

  /**
   * Storage successor for `world-map-pins` / `world-atlas` buckets.
   * Must not write pin/atlas bytes into world SQL tables.
   * Implementations MUST authorize `world.edit` for `input.worldProfileId`
   * before publishing bytes (no cross-world asset attach by actor id alone).
   */
  readonly publishWorldAsset: (
    actorId: string,
    input: HostWorldAssetPublishInput,
  ) => Promise<HostWorldReadResult<HostWorldAssetPublishResult>>;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:254

```ts
export const HOST_WORLD_RPC_NAMES = [
  'archive_world_node_subtree',
  'create_world_node_with_maps',
  'delete_world_atlas_map',
  'delete_world_node',
  'duplicate_world_node',
  'ensure_world_atlas_root',
  'get_world_atlas_map',
  'get_world_map',
  'list_world_atlas_maps',
  'list_world_place_map_links',
  'list_world_places',
  'preview_world_node_consequences',
  'rename_world_node',
  'reparent_world_node',
  'save_world_map',
  'upsert_world_atlas_map',
  'upsert_world_place',
  'upsert_world_place_map_link',
] as const;
```

### src/infrastructure/world/host-world-ports.contract.ts:275

```ts
export type HostWorldRpcName = (typeof HOST_WORLD_RPC_NAMES)[number];
```

### src/infrastructure/world/host-world-read.contract.ts:12

```ts
export type HostWorldReadDto = {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
};
```

### src/infrastructure/world/host-world-read.contract.ts:18

```ts
export type HostWorldReadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };
```

### src/infrastructure/world/host-world-read.contract.ts:26

```ts
export type HostWorldReadPort = {
  readonly listOwnedWorlds: (actorId: string) => Promise<HostWorldReadResult<readonly HostWorldReadDto[]>>;
  readonly getWorld: (actorId: string, worldId: string) => Promise<HostWorldReadResult<HostWorldReadDto>>;
};
```

### src/infrastructure/world/world-atlas-service.ts:34

```ts
export type UpsertWorldAtlasMapInput = {
  readonly worldProfileId: string;
  readonly mapId?: string | null;
  readonly parentMapId?: string | null;
  readonly kind: WorldAtlasMapKind;
  readonly title: string;
  readonly sortOrder?: number;
  readonly bounds: WorldAtlasBounds;
  readonly layers: WorldAtlasFeatureCollection;
  readonly basemapStoragePath?: string | null;
  readonly azgaarMapStoragePath?: string | null;
  readonly generatorMeta?: Readonly<Record<string, unknown>>;
  readonly expectedRevision?: number | null;
};
```

### src/infrastructure/world/world-atlas-service.ts:143

```ts
export const worldAtlasService = new WorldAtlasService();
```

### src/infrastructure/world/world-map-service.ts:20

```ts
export type UploadPinImageOptions = {
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};
```

### src/infrastructure/world/world-map-service.ts:32

```ts
export async function prepareWorldMapPinFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  if (file.size > MAP_PIN_MAX_BYTES) {
    throw new Error('Bild ist zu groß. Maximum 5 MB');
  }
  if (!MAP_PIN_ALLOWED_MIME.has(file.type)) {
    throw new Error('Nur PNG, JPEG oder WebP sind als Pin-Bild erlaubt.');
  }
  const { optimizeMedia } = await import('../media/optimizer');
  let optimizedBytes: Uint8Array | undefined;
  const result = await optimizeMedia({
    kind: 'image',
    profileId: 'map-pin',
    mimeType: file.type || 'application/octet-stream',
    byteSize: file.size,
    bytes: file,
    signal,
    onOptimizedBytes: (bytes) => {
      optimizedBytes = bytes;
    },
  });

  if (result.status === 'unchanged') {
    return file;
  }

  if (result.status === 'optimized') {
    if (!optimizedBytes || optimizedBytes.byteLength === 0) {
      throw new Error('Pin-Bild-Optimierung lieferte keine Bytes (kein stilles Original).');
    }
    if (!MAP_PIN_ALLOWED_MIME.has(result.outputMimeType)) {
      throw new Error(`Optimiertes MIME ${result.outputMimeType} ist nicht erlaubt.`);
    }
    const copy = new Uint8Array(optimizedBytes.byteLength);
    copy.set(optimizedBytes);
    const base = file.name.replace(/\.[^.]+$/, '') || 'pin';
    const ext =
      result.outputMimeType === 'image/webp'
        ? 'webp'
        : result.outputMimeType === 'image/png'
          ? 'png'
          : 'jpg';
    return new File([copy], `${base}.${ext}`, { type: result.outputMimeType });
  }

  if (result.status === 'aborted') {
    throw new Error(result.message || 'Pin-Bild-Optimierung abgebrochen.');
  }

  const message =
    'message' in result && typeof result.message === 'string'
      ? result.message
      : 'Pin-Bild-Optimierung fehlgeschlagen.';
  throw new Error(message);
}
```

### src/infrastructure/world/world-map-service.ts:141

```ts
export const worldMapService = new WorldMapService();
```

### src/infrastructure/world/world-place-service.ts:32

```ts
export type ListWorldPlacesOptions = {
  readonly playerView?: boolean;
  readonly sagaPublicId?: string | null;
};
```

### src/infrastructure/world/world-place-service.ts:37

```ts
export type LinkWorldPlaceMapInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
  readonly usage: WorldPlaceMapUsage;
  readonly featureId?: string | null;
  readonly anchor?: Readonly<Record<string, unknown>>;
};
```

### src/infrastructure/world/world-place-service.ts:228

```ts
export const worldPlaceService = new WorldPlaceService();
```

### src/infrastructure/world/world-profile-service.ts:150

```ts
export const worldProfileService = new WorldProfileService();
```


## Remaining backend helper operations

All backend operations are included in the public declarations above.

## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/character/inventory-v2/primitives.ts` | `7fd8dd5bddc63580ede1b8e0d6c89c146531ba7751128b664bf731c405343c86` |
| `src/domains/items/definition.ts` | `e47891149c62504d1ff96fb38e6a86ca26bf2e9a52795b7cd876a66b90c78b4a` |
| `src/domains/items/pack.ts` | `3214e2a3cbe1db088fb0eaca3d52503911f3c3601c6b01ed08bb75ef2707d975` |
| `src/domains/items/packs/build-standard-item.ts` | `1c2654f0e7980b409762995fe9025649f9cc2bd5324df3a6d50dd4642bdfe569` |
| `src/domains/items/packs/contemporary-basic.ts` | `c72535324491133bc1331abd5fb050d6c328f2177976b8d76f39b2438118f1c1` |
| `src/domains/items/packs/context-packs.ts` | `768e1cf834ea03ecb0b6b3e2335da8e4356682da34bf045df5ba18a1dd9df6fb` |
| `src/domains/items/packs/core-snapshots.ts` | `440e4fe239eedb982555c2e4aa82ea45ae3d687cb26e057516c1b36feccbc19e` |
| `src/domains/items/packs/fantasy-basic.ts` | `0d18e6a46d5d0603b66eade2eaa92f56a0531ad0e71dc1361bfca6cb4f507c2a` |
| `src/domains/items/packs/index.ts` | `d851952181c448d93ac61a51e2f4d02d89253447ef74ca93ff1048590bfff43d` |
| `src/domains/items/packs/scifi-basic.ts` | `6bfed5584dfaabcbc1ce6c323ebd6d9ababc286e9a94d77106c8355667379333` |
| `src/domains/items/taxonomy.ts` | `fa58dde95e4f9fa424244137f845ee4dbf8ae77d3e4e3ec1d114b74b1debc54a` |
| `src/domains/items/world-catalog.ts` | `fc39966cc6290f6c59bfdef799cd9e972e7799978299b8fe83a6a8b4b1162941` |
| `src/domains/media/index.ts` | `768ded2d0f0fd1d510d660924e787817673955dbeff021d7de9e0a8d8e38bdec` |
| `src/domains/media/optimization-contract.ts` | `ba9216dab79a9c03f66a16b77dedf1c26d4d00d6ae2693cc5a68919d1647846d` |
| `src/domains/media/optimization-policy.ts` | `6145574bc08d1eb94f54d488ebc1f8bc030c2a956e3e3fd24cb15a7c8e50c5ec` |
| `src/domains/npc-creature/definition.ts` | `c5cfbd3e9b937142fd04b2d9d8ef1470382062ae1565d4cf3622eb6053c05a45` |
| `src/domains/npc-creature/pack.ts` | `401d1450f6060c6984ec3a937ad4a5127602ce34f0e169fe008b860392892e25` |
| `src/domains/npc-creature/packs/animals.ts` | `728cbea35f072058db6974ce5dd3c80686012a9bd00e4de85c80e0d9f969b021` |
| `src/domains/npc-creature/packs/build-builtin.ts` | `ce343c3558c918920fd328fa1891d5085d00cf4c7fd3360709f749a3fe0c20c7` |
| `src/domains/npc-creature/packs/context-packs.ts` | `a95d23684c4c3687a02b4c98c3437155ef3a1eb01b02e39e8db50d8cf4b36ec6` |
| `src/domains/npc-creature/packs/fantasy-basics.ts` | `81ca439a786d0fcb2fa3bf28d801f68f068d7ff201831c157c2cec876f78561b` |
| `src/domains/npc-creature/packs/index.ts` | `7bb8adddd9ea09409db03785cfcce0656338fe948a86a2f5b4aa14f6a986aeb7` |
| `src/domains/npc-creature/taxonomy.ts` | `3dbc3aaed85858710186551bb41eeaac7475bcb573e1b980a9e64e63852936bc` |
| `src/domains/npc-creature/world-catalog.ts` | `6f87522e1d00aa2ed1b9e1e0310d47f8bb25506fc33d6bee9048f98705ddba2f` |
| `src/domains/rules/sagatree/items/carry-capacity.ts` | `1ea1910d07cbfcbbe5373a78a9256e79a746273f16a3c2e2e82693f1a17037df` |
| `src/domains/rules/sagatree/items/index.ts` | `ab296a0e5462aecb9c94a1e5b530a1afac2b1556d793c09eab631cad6bd62822` |
| `src/domains/rules/sagatree/items/resource-affordability.ts` | `ed42c8faa66a711bd8c7be240df38530bb2d02fff435d1f3aa200538f9388a09` |
| `src/domains/rules/sagatree/items/tool-rules.ts` | `3026c3797388370309b0ea33d1366969abc05b803654cf99c68c4eff42832f18` |
| `src/domains/rules/sagatree/items/types.ts` | `af76e6a5ebcec4a5e8acc3d3fd6461abfe083065c025080ef0b2ca851fdc6ff2` |
| `src/domains/rules/sagatree/items/validators.ts` | `257732bceab776a0afc34f01340eb7e47a94b5c9d984ebf3fff8e0bb7c8ff543` |
| `src/domains/rules/sagatree/npc-creature-power/benchmarks.ts` | `d102fe585bfec2eb44e556fc133d67086fb9915da4ba65497c83869fa82eb54d` |
| `src/domains/rules/sagatree/npc-creature-power/combat-roles.ts` | `28a1ddccaf3a34292e919a768bac20a226e9a4fbb423f17ab7c3cf70be27f512` |
| `src/domains/rules/sagatree/npc-creature-power/compute.ts` | `8085e6151a610bc1465cf129ea22845850042d6cff3c93aa052055039ead49f8` |
| `src/domains/rules/sagatree/npc-creature-power/damage-steps.ts` | `8bc739457eeeb77336b6124153d3f3a3642877c50c23fa7dab1f82b075c26a58` |
| `src/domains/rules/sagatree/npc-creature-power/index.ts` | `ff26d6741c491b687d01d8eaa87722a89df1fe25251794625d98e35a0f3fb5c6` |
| `src/domains/rules/sagatree/npc-creature-power/machtgrad.ts` | `19d4daafb9580b890ed2337feccffed19122a01dfb23c2eeb2dadd2523778f7a` |
| `src/domains/rules/sagatree/npc-creature-power/profiles.ts` | `aa3d450842ddce7548f6e8e826225cdbdeae6de7660e09798fe43663dc9ce1fa` |
| `src/domains/rules/sagatree/npc-creature-power/types.ts` | `de25ba46549bab20e0e55a513fb0745e722449d8f1b61bb51887d986653c4eab` |
| `src/domains/world/atlas/atlas-biome-brush.ts` | `4ccfcc1605b213b904137ab1e62661a249dc5804c4246152a03741e4825ea7e9` |
| `src/domains/world/atlas/atlas-canonical-features.ts` | `a7e2b9471c960d3839e39f93fe1f6b332f5822620ef589ba4e1a0805dda6c3bd` |
| `src/domains/world/atlas/atlas-continuous-zoom.ts` | `ddb4ca5b0611b2c122aa8b5b8cb0f5738daaa601a64d47f8bfde7f213d2d372f` |
| `src/domains/world/atlas/atlas-diorama-look.ts` | `a0c2f5ea6af2faabed685d4eff4035dad43b1e82f3d6b2a67e017ddcddf99ea6` |
| `src/domains/world/atlas/atlas-dungeon-look.ts` | `b28dfd123ebb46472258442834d636b2962ed78a7261d458bc57a5ad1d3f352c` |
| `src/domains/world/atlas/atlas-edit-history.ts` | `13a91efde301ec766d3b0f183affcd794abba9f4c4872c00549e9f631947e294` |
| `src/domains/world/atlas/atlas-golden-visual.ts` | `91958356d646ac68021110bf3b2faa5c63ad42de142bc00236d3e07bd5c426ec` |
| `src/domains/world/atlas/atlas-heightfield.ts` | `1fafa49c651ac14ba5ae1e9a226b38ffeea636935b7e486daa1cdd41090b71fb` |
| `src/domains/world/atlas/atlas-hierarchy-lod.ts` | `d8f476a6aab1a6f8c63ee4d465401869e5b4191154b89b238f60fdba6c8b9bff` |
| `src/domains/world/atlas/atlas-hierarchy-nav.ts` | `d9df6c10f147e7f325dfc735306fe481e4aa1fc601e215a1f79df0f53b190be7` |
| `src/domains/world/atlas/atlas-map-doc-adapter.ts` | `d85a2ed7b2e6cd9650c4d87664fb09e7b4621779f2a820ed65c421e353caf04a` |
| `src/domains/world/atlas/atlas-map-pins.ts` | `1421ca01edd55307c341adc3ac74f4c5a7cef87f60fadbbe0faaa141898b4791` |
| `src/domains/world/atlas/atlas-perf-budgets.ts` | `3a74334bd3b91af40731ea970d9a79cd189ca672b830e40025adfc71dbe4cf33` |
| `src/domains/world/atlas/atlas-persist-state.ts` | `84ab0edbd0b525c95b5db85afeb683d335351884ba6c612e94f327719a6b60ca` |
| `src/domains/world/atlas/atlas-product-camera.ts` | `6d65226fe7e6594079b61df81ec39a226d5b79788327ef95609dc70f9980d179` |
| `src/domains/world/atlas/atlas-product-geometry-plan.ts` | `de94ca0b6c23374ae5aed057fa756539285295574df9925598a0ed029a2a3ce9` |
| `src/domains/world/atlas/atlas-prototype-lod.ts` | `2fb7c706ad2210f7a3f389f22564f60e3f22aa615ec49af49695e388ae582256` |
| `src/domains/world/atlas/atlas-renderer-target.ts` | `f51d6dc7122851ef8b88e1c567984f50f743a1630cf5f36212205fe70c8662ff` |
| `src/domains/world/atlas/atlas-revision-contract.ts` | `d01c356239143862f9aa8f3fd44fca79105e3ed390327c34b9be6ce1902c78d6` |
| `src/domains/world/atlas/atlas-scene-scatter.ts` | `b83c860ca82ff993a5141463b6e152097bf5783cb7bc7369a1a09683892bb1aa` |
| `src/domains/world/atlas/atlas-selection.ts` | `6c16fb40fe26addea8e33e718a89a019de099c6008c1000dd697d48fa12849a7` |
| `src/domains/world/atlas/atlas-terrain-mesh.ts` | `50dc7ef6c013f87f82f2030317c69a8ad619c7b4db1b65db0a7571a18186dd5d` |
| `src/domains/world/atlas/atlas-tool-registry.ts` | `be0492bd7d71f1dafa260c6a1a75165f8c587bd1f55d3178f96fbd67ac5988af` |
| `src/domains/world/atlas/atlas-webgl-write-retire.ts` | `baf40e97aaa9c74c873f3919e72b4d9049e8c7781566ed58ce52ccf2f168ce69` |
| `src/domains/world/atlas/atlas-workstation-adaptive.ts` | `2a87a8f4cf36e532f9bbb0faa0085013f4169fedc26622a1bbef800b46f59846` |
| `src/domains/world/atlas/canvas-polygon.ts` | `a1bf513b449cf21b8e7d449d291c1f7965303072916f0192a214328a90920cea` |
| `src/domains/world/atlas/dornhain-golden-hierarchy.ts` | `0eb37f4a217a2bd4f67bcd3bf20d407ec08440f3d20e41e5d0ed738de91faa3e` |
| `src/domains/world/atlas/dornhain-golden-reset.ts` | `993c1935fda833ddaf0f51c8f1c10b8b25a28e944c2e783ec2d89f2e9e95e9eb` |
| `src/domains/world/atlas/dornhain-unified-starter.ts` | `5e9afab7ec94b7bef19535be6311b51a2f77c59b5f82b36fcd8b78007cc336f5` |
| `src/domains/world/atlas/dungeon-forge-workflow.ts` | `c9fdba0da576bc5f5516bb6c637d6efc993c9fab630fa2e42b725836f4ef0317` |
| `src/domains/world/atlas/dungeon-generator.ts` | `6bbed5a42d16ec727e2745b0e1f47dc9d3f1dcc219ee0ccb06f15340307908e1` |
| `src/domains/world/atlas/dungeon-grid.ts` | `56d9698047b1405a3ba4525146a189e8c8d299d0270fd6d678a0dafa5a0a8854` |
| `src/domains/world/atlas/index.ts` | `0ab497de1b528fb163c1479a0166241de3cd267ad3d512f3087bde4d761990f2` |
| `src/domains/world/atlas/map-edit-ops.ts` | `3440965957e4212748d109f74ce202fa7a320840d5c9f1347b0457347c797b95` |
| `src/domains/world/atlas/map-frame.ts` | `7a5bc6fb6ddcb38efd09fa3adf71889709fa230313a8d241d09cb9f5fa98e7a5` |
| `src/domains/world/atlas/party-map-projection.ts` | `eeb742f12fa5e35e03a2a2c57f2c92f8ddb9d996562c88d6de96169d61b82fc9` |
| `src/domains/world/atlas/unified-canvas-doc.ts` | `59fa68591c71d2f0bba3185fffb4adecf8d325464df4701309af76a2a99fbd82` |
| `src/domains/world/atlas/validate-world-atlas.ts` | `3042c993e644808c908331970dd87367649889dbf9421c5507f88b7b415b009e` |
| `src/domains/world/atlas/webgl-runtime-bridge.ts` | `4d7acacb2a3ded8df55b0d333bb35d51d2b291f8e3849b24577a44f87785434d` |
| `src/domains/world/atlas/world-atlas.types.ts` | `094fa1a6f46a54063fe396c7d641c6c34d5b8907c3f6e0127a2ae9e6443dcee7` |
| `src/domains/world/contracts/world.types.ts` | `ad676f8bf83b6d55627a568c28d5221bd8f4f616e33eae31fab502223c74f6fb` |
| `src/domains/world/hierarchy/create-plan.ts` | `6fefab23a8f62fb9a6ebe716c3f44704fa7ab5466b8d5fe0de904920f5aee38e` |
| `src/domains/world/hierarchy/index.ts` | `05ef0b33d0950512a3ac12eb64497fb3e3321f43d81b4fcf76e909a2ef52efe2` |
| `src/domains/world/hierarchy/legacy-kind-map.ts` | `8b9d99f4d56c970e274250c11849b746dbd8597eeade1c5401d327fa65335316` |
| `src/domains/world/hierarchy/migration-plan.ts` | `2226b97b89db2c2ca56631f3bae26d94bbd4dc9e8973a3f1cff0a2cd26c599a8` |
| `src/domains/world/hierarchy/mutations.ts` | `15e52f9f6460d4e5ec19d71f3ec42057b1a81e8468bc0d9490f58d7f6f5a6dcc` |
| `src/domains/world/hierarchy/primary-map-links.ts` | `7d01ecbbb2cb467379eed308f37aa0eac0bd223768077b86ee210414a32a2ece` |
| `src/domains/world/hierarchy/world-hierarchy.ts` | `eb78e102eb0701a84c7a9b16e6da2321f4722755246ff30e3b4cac04bbd311ea` |
| `src/domains/world/hierarchy/world-node.types.ts` | `6baf15ffbb844e3483d8d351751aaa9c03c7b0ff17ce7746703154ad7e142e58` |
| `src/domains/world/hierarchy/world-scoped-inventory.ts` | `d4d2116ff392a949e0ef6c7b94cbffbc217b976f9948ba8d15f1a9c8b2e9354d` |
| `src/domains/world/map/atlas-camera.ts` | `e6f12a22831e1abe42cd69ee4040e68689b89924e67b7e63d978972683d84c48` |
| `src/domains/world/map/constants.ts` | `4310089141e333e8d740199f8c4ed212ce65dfdcbc119ef81ce8b3f8b6b1f707` |
| `src/domains/world/map/dornhain-starter-map.ts` | `b4bb022827d2b2fe7f4d0b490e1348b5f9fc1045ba1547b1e734d9130e335b8c` |
| `src/domains/world/map/index.ts` | `7ed8b7504cf841d0c40932c5bccf90c96871e0bb1e69ce1a51815c4615721624` |
| `src/domains/world/map/validate-world-map.ts` | `0209b9dfc4f8113ad8d0f620c482f0c0fd24af5a9d0a49ac19b07c7c439d91ec` |
| `src/domains/world/map/world-map.types.ts` | `3f84174b19f1ea1237560bf26c8874073ace59703dafe46cd14b7b63944dc8d2` |
| `src/domains/world/places/atlas-place-nav.ts` | `c8a53a66f401166edec26e6e43eb561143590998465d3401e218a487b4423142` |
| `src/domains/world/places/atlas-webgl-nav-tree.ts` | `e6f5bcaad2b6873f76bbfe8359677c9ae4ed0d8fe289348b3e5c1c0ebd67b740` |
| `src/domains/world/places/index.ts` | `32f10c6001d7fd81cc5ef6b991d18005469105cf296a4d4eb73ddde1c7633952` |
| `src/domains/world/places/parse-world-place.ts` | `05aab634ce97dd167871331376a1184f8f5ebad15fe970680bfc9feecb8d89de` |
| `src/domains/world/places/settlement-presets.ts` | `b2b5b95f43524fda6c7a76eeb332150202f9750c47db5d7a6518fee98b796199` |
| `src/domains/world/places/world-place.types.ts` | `32081a2c16516c68393e879ebc4e888441ca4e5009b20404158c6b25d09f4ef0` |
| `src/domains/world/worldModuleRegistry.ts` | `9683d27ea65c7a22456245c0e2e706168285f61e229f6ea181e0fb6a65064cc0` |
| `src/infrastructure/host/host-library-http.ts` | `c56b88c60d6c9491fc7b6e6e1143ac4985ffdab5dff16afef8a54bce79629a07` |
| `src/infrastructure/host/host-world-http.ts` | `4e5b1a2d336b907aec8ef7f58505f4605eef1674d15ed6ce4a109d47f352b6bd` |
| `src/infrastructure/media/optimizer/engines/audio/index.ts` | `7585190a705085692bff0896e08b4d78f791895b47e24d57deeaaa10bb669d4e` |
| `src/infrastructure/media/optimizer/engines/image/image.worker.ts` | `d34793b4de682556d9306194cfbcd05fdafdf215da25393f955d2669c7499276` |
| `src/infrastructure/media/optimizer/engines/image/index.ts` | `4944001b7e0f7784d487da2e60d06d845aa564e9ddd7516ff50633af1591a322` |
| `src/infrastructure/media/optimizer/engines/image/optimize-image.ts` | `bf73e826651227f704aff5ed584546a087f22f26c68a4c45ba918dfefbe7ce3e` |
| `src/infrastructure/media/optimizer/engines/image/raster-decode.ts` | `8ba5eda07565b10d1fb3d4090d068d12b1415399088c6c6b4a2aadc3fe4d290c` |
| `src/infrastructure/media/optimizer/engines/image/resource-limits.ts` | `1178fc226c85aee4f4989a7bd650d0b9830b37657c7499c1cec174b4aa9af364` |
| `src/infrastructure/media/optimizer/engines/image/types.ts` | `501095579c8bf1cc3af3a93147f4ab9fe1f280909c02e759d3d95c0f7151d45d` |
| `src/infrastructure/media/optimizer/engines/image/webp-budget.ts` | `7e7a1669b42c38b713f35952517260a61ca636cc6f84f29c76b949e3bcc2f70c` |
| `src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts` | `718b74e3146c6723862f0a4639eb5b7905a35f70a8c0e3c6e33d530a4ef80b84` |
| `src/infrastructure/media/optimizer/engines/model3d/index.ts` | `bcc13ca0c9f7bfa1a68e6c893509b21e682fe2c44732945fba85215042ac6d62` |
| `src/infrastructure/media/optimizer/engines/video/index.ts` | `d8c6aaaabb2ad762d4c15f9ef4aa9bc016f5968b2512cfe52f71cb09655dd842` |
| `src/infrastructure/media/optimizer/index.ts` | `c1b162af47239195707de742a8991bea14d85f2238108968613c3bad3d91cf02` |
| `src/infrastructure/media/optimizer/media-optimizer.ts` | `7d58424f12b7855ccb3c0153270628850e03afc15c285b1fc2b47218918255d9` |
| `src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-camera.ts` | `dd6241e785bdbde6276b261fef7c56eaef13500075f413169a8fadd767ae7cc3` |
| `src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-harness.ts` | `7cb604c899852fcf48364b031180e8c2c4acae92f779e68cc2416e58686e536a` |
| `src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-runtime.ts` | `f250027a4c5a9674e377313738dac7f70a8a253464c46033f6a400a229b53c82` |
| `src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts` | `f63e63b2be555ef8348d15141ed44a01e70670667e3d0946221db2720cc32d8c` |
| `src/infrastructure/world/atlas-three/atlas-three-camera.ts` | `25c501f4e7d8804e49084c3e66246f03954113bd59ed223062f8cbd45f4e2a80` |
| `src/infrastructure/world/atlas-three/atlas-three-runtime.ts` | `58cf1d1801535807d3ed1e1bc97d41447332fae979778cfb45f2dde2125dc80b` |
| `src/infrastructure/world/atlas-three/atlas-three-scene.ts` | `6b38edebaa6c3d159e8128f3ba0d96488d0d8406fdbb35618225c96b5fc718fe` |
| `src/infrastructure/world/atlas-three/index.ts` | `addbc7fa4de485ef268730e10046a86aa5eb5ebfe59aad5b6bb8d489b1ab1aaf` |
| `src/infrastructure/world/atlas-three/pbr-textures.ts` | `f0beec174b3d506ac90814d7180c3aa64bad0c384e82eb727431d7dd8ffbccec` |
| `src/infrastructure/world/host-world-adapter.ts` | `8fbaad8d6d4ec9cc42070444441fae94fb20af020cdada2125a705877ea4e1f1` |
| `src/infrastructure/world/host-world-ports.contract.ts` | `9d11c1085646775f6c6eb5bdc29baa7ed40af0245354589bd767d4f80da1d582` |
| `src/infrastructure/world/host-world-read.contract.ts` | `271a052d5f621ddf7f3344eaa55e3a58579c5cf629fe76a4827393d0d1c7a05c` |
| `src/infrastructure/world/world-atlas-service.ts` | `63cdb7aea8402a51c8bf6480e325fd15d951c33c28aa1a7923340251878c5c1d` |
| `src/infrastructure/world/world-map-service.ts` | `d99faed233ee5c66d96d08397c0e292113a44e43efb51f4b30b7cc6a21a91103` |
| `src/infrastructure/world/world-place-service.ts` | `5fe2e68dd3949fb193547aa9ee498c15fc0e3f368bf546156a39086e805312bb` |
| `src/infrastructure/world/world-profile-service.ts` | `10935d830086c8f9972b9f9f982e7ba8203609facd408020c634df4400032610` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |


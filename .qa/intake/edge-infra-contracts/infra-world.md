# Infrastructure contract: world

**Status: SPEC; current branch source verified.** Implementation issue: **#812**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-world.json](source-contracts/infra-world.json) (SHA-256 `99af39db5c8bb987d307832ca165fa59b200b9223a095c15644d4d9a27d54696`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

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

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:11

```ts
export type AtlasThreeCameraMode = 'ortho-topdown' | 'diorama-oblique' | 'perspective';
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:13

```ts
export type AtlasThreeCameraView = {
  readonly mode: AtlasThreeCameraMode;
  readonly x: number;
  readonly z: number;
  /** Optional target elevation Y (world units, defaults to 0). */
  readonly y?: number;
  readonly span: number;
  readonly yawRad: number;
  readonly pitchRad: number;
};
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:24

```ts
export type AtlasThreeWorldPoint3 = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:30

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

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:52

```ts
export function clampAtlasThreePitch(mode: AtlasThreeCameraMode, pitch: number): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') return clamp(pitch, 0.52, 1.38);
  return clamp(pitch, 0.34, 1.42);
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:58

```ts
export function defaultAtlasThreePitch(mode: AtlasThreeCameraMode): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  if (mode === 'diorama-oblique') return 0.96;
  return 0.82;
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:74

```ts
export function autoAtlasThreePitchForSpan(
  mode: AtlasThreeCameraMode,
  span: number,
): number {
  if (mode === 'ortho-topdown') return Math.PI / 2;
  const safeSpan = clamp(span, 0.08, 2400);
  const logSpan = Math.log(safeSpan);

  // Broad macro curve: settlement (~4 wu) -> world (~800 wu)
  const macroT = smoothstep(Math.log(3.2), Math.log(780), logSpan);
  // Interior readability lift: building/room (~1.6 wu -> 0.14 wu) gently raises camera angle
  const interiorT = 1 - smoothstep(Math.log(0.16), Math.log(2.2), logSpan);

  if (mode === 'perspective') {
    const base = 0.68 + macroT * 0.38; // ~39° at village -> ~61° at planet
    const interiorLift = interiorT * 0.24; // rises smoothly to ~53° inside rooms
    return clampAtlasThreePitch(mode, base + interiorLift);
  }

  // diorama-oblique
  const base = 0.78 + macroT * 0.40; // ~44.7° at village -> ~67.6° at planet
  const interiorLift = interiorT * 0.24; // rises smoothly to ~58.5° inside cutaway rooms
  return clampAtlasThreePitch(mode, base + interiorLift);
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:107

```ts
export function computeVisibleGroundSpanWu(
  view: Pick<AtlasThreeCameraView, 'mode' | 'span' | 'pitchRad'> & {
    readonly x?: number;
    readonly z?: number;
    readonly y?: number;
    readonly yawRad?: number;
  },
  aspect = 16 / 10,
): number {
  const safeSpan = clamp(Number.isFinite(view.span) ? view.span : 430, 0.05, 2400);
  const pitch = clampAtlasThreePitch(view.mode, Number.isFinite(view.pitchRad) ? view.pitchRad : autoAtlasThreePitchForSpan(view.mode, safeSpan));
  if (view.mode === 'ortho-topdown') {
    return safeSpan * 2;
  }
  if (view.mode === 'diorama-oblique') {
    return (safeSpan * 2) / Math.max(0.25, Math.sin(pitch));
  }
  // Perspective: measure real central ground span via rig unprojection onto the focus plane
  const fullView: AtlasThreeCameraView = {
    mode: 'perspective',
    x: view.x ?? 0,
    z: view.z ?? 0,
    y: view.y ?? 0,
    span: safeSpan,
    yawRad: view.yawRad ?? 0,
    pitchRad: pitch,
  };
  const rig = buildAtlasThreeCameraRig(fullView, aspect);
  const planeY = fullView.y ?? 0;
  const nearPt = unprojectNdcToPlaneWithRig(rig, 0, -0.5, planeY);
  const farPt = unprojectNdcToPlaneWithRig(rig, 0, 0.5, planeY);
  if (nearPt && farPt) {
    const centralSpan = Math.hypot(farPt.x - nearPt.x, farPt.z - nearPt.z) * 2;
    if (Number.isFinite(centralSpan) && centralSpan > 0) {
      return centralSpan;
    }
  }
  return (safeSpan * 2) / Math.max(0.25, Math.sin(pitch));
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:204

```ts
export function formatAtlasTruthfulScaleHud(
  span: number,
  options?: {
    readonly isWorldSceneGraph?: boolean;
    readonly metersPerUnit?: number | null;
    readonly mode?: AtlasThreeCameraMode;
    readonly pitchRad?: number;
    readonly aspect?: number;
  },
): {
  readonly shortLabel: string;
  readonly zoomLevel: number;
  readonly visibleGroundWu: number;
  readonly visibleMeters: number | null;
  readonly calibrated: boolean;
  readonly detailTitleDe: string;
} {
  const safeSpan = clamp(Number.isFinite(span) ? span : 430, 0.05, 2400);
  const isWorld = options?.isWorldSceneGraph ?? true;
  const mode: AtlasThreeCameraMode = options?.mode ?? 'ortho-topdown';
  const pitchRad =
    options?.pitchRad !== undefined && Number.isFinite(options.pitchRad)
      ? options.pitchRad
      : autoAtlasThreePitchForSpan(mode, safeSpan);
  const zoomLevel = Math.round(clamp(1 + Math.log2(1024 / safeSpan), 1, 15) * 10) / 10;
  const visibleGroundWu = computeVisibleGroundSpanWu(
    { mode, span: safeSpan, pitchRad },
    options?.aspect ?? 16 / 10,
  );
  const mpu =
    typeof options?.metersPerUnit === 'number' &&
    Number.isFinite(options.metersPerUnit) &&
    options.metersPerUnit > 0
      ? options.metersPerUnit
      : null;

  if (mpu !== null) {
    const visibleMeters = visibleGroundWu * mpu;
    const { shortLabel, scaleText } = formatCalibratedMetersDe(visibleMeters);
    const scopeLabel = isWorld ? `Weltmaßstab Z${zoomLevel.toFixed(1)}` : 'Kartenmaßstab';
    return {
      shortLabel,
      zoomLevel,
      visibleGroundWu,
      visibleMeters,
      calibrated: true,
      detailTitleDe: `${scopeLabel} · ${scaleText} (${mpu} m/WE · Klick zentriert)`,
    };
  }

  // Uncalibrated: NEVER invent meters/kilometers!
  const { shortLabel, scaleText } = formatUncalibratedUnitsDe(visibleGroundWu);
  const scopeLabel = isWorld ? `Unkalibriert Z${zoomLevel.toFixed(1)}` : 'Einzelkarte (unkalibriert)';
  return {
    shortLabel,
    zoomLevel,
    visibleGroundWu,
    visibleMeters: null,
    calibrated: false,
    detailTitleDe: `${scopeLabel} · ${scaleText} (Klick zentriert)`,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:267

```ts
export function buildAtlasThreeCameraRig(
  view: AtlasThreeCameraView,
  aspect: number,
): AtlasThreeCameraRig {
  const safeAspect = Math.max(0.2, aspect);
  const pitch = clampAtlasThreePitch(view.mode, view.pitchRad);
  const forward: readonly [number, number] = [Math.sin(view.yawRad), Math.cos(view.yawRad)];
  const perspective = view.mode === 'perspective';
  // Perspective distance calibrated so vertical visible ground height at target matches `2 * span`
  // (fovY = 46° => tan(23°) = 0.4244748 => dist = span / tan(23°) ≈ 2.3558 * span)
  const fovYDeg = 46;
  const tanHalfFov = Math.tan((fovYDeg * Math.PI) / 360);
  const distance = perspective ? view.span / tanHalfFov : view.span * 3.0;
  const targetY = Number.isFinite(view.y) ? view.y! : 0;
  const at: readonly [number, number, number] = [view.x, targetY, view.z];
  const topdown = view.mode === 'ortho-topdown';
  // Pure geometric eye placement (zero non-linear eyeLift kink!) so pitch & projection stay 100% consistent
  const eye: readonly [number, number, number] = topdown
    ? [view.x, targetY + distance, view.z]
    : [
        view.x + forward[0] * Math.cos(pitch) * distance,
        targetY + Math.sin(pitch) * distance,
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
    near: perspective ? Math.max(0.002, distance * 0.008) : Math.max(0.002, distance * 0.004),
    far: Math.max(26000, distance * 8 + 4000),
    perspective,
    fovYDeg,
    halfHeight: view.span,
    halfWidth: view.span * safeAspect,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:347

```ts
export function projectWorldPointWithRig(
  rig: AtlasThreeCameraRig,
  point: AtlasThreeWorldPoint3,
): { readonly ndcX: number; readonly ndcY: number; readonly depth: number; readonly visible: boolean } {
  const { right, camUp, forward } = buildCameraBasis(rig);
  const rel: Vec3 = [point.x - rig.eye[0], point.y - rig.eye[1], point.z - rig.eye[2]];
  const cx = dot3(rel, right);
  const cy = dot3(rel, camUp);
  const cz = dot3(rel, forward); // positive in front of camera

  if (rig.perspective) {
    if (cz <= 1e-6) {
      return { ndcX: 0, ndcY: 0, depth: cz, visible: false };
    }
    const tanHalfFov = Math.tan((rig.fovYDeg * Math.PI) / 360);
    const aspect = rig.halfWidth / Math.max(1e-6, rig.halfHeight);
    const ndcX = cx / (cz * tanHalfFov * aspect);
    const ndcY = cy / (cz * tanHalfFov);
    return {
      ndcX,
      ndcY,
      depth: cz,
      visible: cz >= rig.near && cz <= rig.far && Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1,
    };
  }

  const ndcX = cx / Math.max(1e-6, rig.halfWidth);
  const ndcY = cy / Math.max(1e-6, rig.halfHeight);
  return {
    ndcX,
    ndcY,
    depth: cz,
    visible: cz >= rig.near && cz <= rig.far && Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:387

```ts
export function unprojectNdcToPlaneWithRig(
  rig: AtlasThreeCameraRig,
  ndcX: number,
  ndcY: number,
  planeY: number,
): { readonly x: number; readonly z: number } | null {
  const { right, camUp, forward } = buildCameraBasis(rig);
  if (rig.perspective) {
    const tanHalfFov = Math.tan((rig.fovYDeg * Math.PI) / 360);
    const aspect = rig.halfWidth / Math.max(1e-6, rig.halfHeight);
    const dx = ndcX * tanHalfFov * aspect;
    const dy = ndcY * tanHalfFov;
    const dir: Vec3 = [
      forward[0] + right[0] * dx + camUp[0] * dy,
      forward[1] + right[1] * dx + camUp[1] * dy,
      forward[2] + right[2] * dx + camUp[2] * dy,
    ];
    if (Math.abs(dir[1]) < 1e-7) return null;
    const t = (planeY - rig.eye[1]) / dir[1];
    if (t <= 0) return null;
    return {
      x: rig.eye[0] + dir[0] * t,
      z: rig.eye[2] + dir[2] * t,
    };
  }

  // Orthographic ray originates on the near/eye plane offset by (ndcX * halfWidth, ndcY * halfHeight)
  const ox = rig.eye[0] + right[0] * (ndcX * rig.halfWidth) + camUp[0] * (ndcY * rig.halfHeight);
  const oy = rig.eye[1] + right[1] * (ndcX * rig.halfWidth) + camUp[1] * (ndcY * rig.halfHeight);
  const oz = rig.eye[2] + right[2] * (ndcX * rig.halfWidth) + camUp[2] * (ndcY * rig.halfHeight);
  if (Math.abs(forward[1]) < 1e-7) return null;
  const t = (planeY - oy) / forward[1];
  return {
    x: ox + forward[0] * t,
    z: oz + forward[2] * t,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:434

```ts
export function solveAnchoredCameraFocus(input: {
  readonly view: AtlasThreeCameraView;
  readonly anchorWorld: AtlasThreeWorldPoint3;
  readonly targetNdcX: number;
  readonly targetNdcY: number;
  readonly aspect: number;
  readonly sampleFocusElevation?: (x: number, z: number) => number;
}): { readonly x: number; readonly z: number; readonly y: number } {
  const { view, anchorWorld, targetNdcX, targetNdcY, aspect, sampleFocusElevation } = input;
  const pitch = clampAtlasThreePitch(view.mode, view.pitchRad);
  const probeRig = buildAtlasThreeCameraRig(view, aspect);
  // Guarantee the camera eye stays safely above an elevated 3D anchor (e.g. mountain peak / roof)
  // at tight zoom spans so perspective rays never invert behind the camera.
  const minFyForAnchor = anchorWorld.y - Math.sin(pitch) * probeRig.distance * 0.5;
  const resolveFy = (x: number, z: number): number => {
    const raw = sampleFocusElevation
      ? sampleFocusElevation(x, z)
      : Number.isFinite(view.y)
        ? view.y!
        : 0;
    return Math.max(raw, minFyForAnchor);
  };

  let fx = view.x;
  let fz = view.z;
  let fy = resolveFy(fx, fz);

  for (let iter = 0; iter < 6; iter += 1) {
    const rig = buildAtlasThreeCameraRig({ ...view, x: fx, z: fz, y: fy }, aspect);
    const hit = unprojectNdcToPlaneWithRig(rig, targetNdcX, targetNdcY, anchorWorld.y);
    if (!hit) break;
    const dx = anchorWorld.x - hit.x;
    const dz = anchorWorld.z - hit.z;
    fx += dx;
    fz += dz;
    const nextFy = resolveFy(fx, fz);
    const dy = Math.abs(nextFy - fy);
    fy = nextFy;
    if (Math.hypot(dx, dz) < 1e-5 && dy < 1e-5) break;
  }

  return { x: fx, z: fz, y: fy };
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:478

```ts
export function buildAtlasThreeFogBand(
  rig: AtlasThreeCameraRig,
  look: 'outdoor' | 'indoor',
): { readonly near: number; readonly far: number; readonly expDensity: number } {
  const d = Math.max(80, rig.distance);
  if (look === 'indoor') {
    return {
      near: d * 1.15,
      far: d * 4.2,
      expDensity: 0.2 / d,
    };
  }
  return {
    near: d * 1.65,
    far: d * 7.0,
    expDensity: 0.072 / d,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:498

```ts
export function interpolateAtlasThreeView(
  from: AtlasThreeCameraView,
  to: AtlasThreeCameraView,
  t: number,
): AtlasThreeCameraView {
  const k = clamp(t, 0, 1);
  const e = k * k * (3 - 2 * k);
  const logFrom = Math.log(Math.max(0.05, from.span));
  const logTo = Math.log(Math.max(0.05, to.span));
  const yFrom = Number.isFinite(from.y) ? from.y! : 0;
  const yTo = Number.isFinite(to.y) ? to.y! : 0;
  return {
    mode: to.mode,
    x: from.x + (to.x - from.x) * e,
    z: from.z + (to.z - from.z) * e,
    y: yFrom + (yTo - yFrom) * e,
    span: Math.exp(logFrom + (logTo - logFrom) * e),
    yawRad: from.yawRad + (to.yawRad - from.yawRad) * e,
    pitchRad: from.pitchRad + (to.pitchRad - from.pitchRad) * e,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-three-camera.ts:526

```ts
export function dampAtlasThreeView(
  current: AtlasThreeCameraView,
  target: AtlasThreeCameraView,
  dtSeconds: number,
  speed = 12,
  anchor?: {
    readonly anchorWorld: AtlasThreeWorldPoint3;
    readonly targetNdcX: number;
    readonly targetNdcY: number;
    readonly aspect: number;
    readonly sampleFocusElevation?: (x: number, z: number) => number;
  } | null,
): { readonly next: AtlasThreeCameraView; readonly settled: boolean } {
  const alpha = 1 - Math.exp(-Math.max(0.001, Math.min(0.1, dtSeconds)) * speed);
  const logCur = Math.log(Math.max(0.05, current.span));
  const logTgt = Math.log(Math.max(0.05, target.span));
  const nspan = Math.exp(logCur + (logTgt - logCur) * alpha);
  const nyaw = current.yawRad + (target.yawRad - current.yawRad) * alpha;
  const npitch = current.pitchRad + (target.pitchRad - current.pitchRad) * alpha;

  const epsSpan = Math.min(0.04, target.span * 0.0015);
  const angleSettled =
    Math.abs(nyaw - target.yawRad) < 0.0004 &&
    Math.abs(npitch - target.pitchRad) < 0.0004 &&
    Math.abs(nspan - target.span) < epsSpan;

  if (anchor) {
    const baseView: AtlasThreeCameraView = angleSettled
      ? { ...target }
      : {
          mode: target.mode,
          x: current.x + (target.x - current.x) * alpha,
          z: current.z + (target.z - current.z) * alpha,
          y: current.y,
          span: nspan,
          yawRad: nyaw,
          pitchRad: npitch,
        };
    const solved = solveAnchoredCameraFocus({
      view: baseView,
      anchorWorld: anchor.anchorWorld,
      targetNdcX: anchor.targetNdcX,
      targetNdcY: anchor.targetNdcY,
      aspect: anchor.aspect,
      sampleFocusElevation: anchor.sampleFocusElevation,
    });
    return {
      next: {
        ...baseView,
        x: solved.x,
        z: solved.z,
        y: solved.y,
      },
      settled: angleSettled,
    };
  }

  const nx = current.x + (target.x - current.x) * alpha;
  const nz = current.z + (target.z - current.z) * alpha;
  const curY = Number.isFinite(current.y) ? current.y! : 0;
  const tgtY = Number.isFinite(target.y) ? target.y! : 0;
  const ny = curY + (tgtY - curY) * alpha;

  const epsPos = Math.min(0.04, target.span * 0.002);
  const settled =
    angleSettled &&
    Math.abs(nx - target.x) < epsPos &&
    Math.abs(nz - target.z) < epsPos &&
    Math.abs(ny - tgtY) < 0.001;

  return {
    next: settled
      ? { ...target }
      : {
          mode: target.mode,
          x: nx,
          z: nz,
          y: ny,
          span: nspan,
          yawRad: nyaw,
          pitchRad: npitch,
        },
    settled,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-three-multimap.ts:45

```ts
export type AtlasThreeWorldMapSource = {
  readonly mapId: string;
  readonly doc: UnifiedCanvasDoc;
  readonly mapScale: AtlasMapScale;
  readonly look: AtlasThreeLook;
  readonly bounds?: WorldAtlasBounds;
  readonly revisionKey?: string;
};
```

### src/infrastructure/world/atlas-three/atlas-three-multimap.ts:59

```ts
export type AtlasThreeMapGroupNode = {
  readonly mapId: string;
  readonly depth: number;
  readonly pivot: THREE.Group;
  readonly content: THREE.Group;
  readonly pickables: THREE.Object3D[];
  readonly overlayMeshes: THREE.Object3D[];
  readonly waterMeshes: THREE.Object3D[];
  readonly scenePlan: AtlasThreeScenePlan;
  readonly buildSignature: string;
  readonly geometries: THREE.BufferGeometry[];
  readonly materials: ClonedGroupMaterial[];
  readonly cutoutSignature: string;
  readonly hasOwnTerrain: boolean;
  lodState: string;
  detailWeight: number;
  targetOpacity: number;
  currentOpacity: number;
  targetWaterOpacity: number;
  currentWaterOpacity: number;
  exiting: boolean;
};
```

### src/infrastructure/world/atlas-three/atlas-three-multimap.ts:82

```ts
export type AtlasThreeGroupOpacitySnapshot = {
  readonly detailWeight: number;
  readonly opacity: number;
  readonly waterOpacity: number;
  readonly depth: number;
  readonly lodState: string;
  readonly exiting: boolean;
};
```

### src/infrastructure/world/atlas-three/atlas-three-multimap.ts:103

```ts
export function computeMacroOverlayTargetOpacity(input: {
  readonly depth: number;
  readonly detailWeight: number;
  readonly viewSpan: number;
  readonly childWeight: number;
  readonly hasActiveSettlementOrDeeper: boolean;
}): number {
  const { depth, detailWeight, viewSpan, childWeight, hasActiveSettlementOrDeeper } = input;
  if (depth <= 1) {
    if (hasActiveSettlementOrDeeper) return 0;
    const spanFade = smoothstep01(80, 195, viewSpan);
    const childFade = 1 - smoothstep01(0.45, 0.95, childWeight);
    return Math.max(0, Math.min(1, spanFade * childFade));
  }
  if (depth === 2) {
    if (hasActiveSettlementOrDeeper) return 0;
    const spanFade = smoothstep01(30, 88, viewSpan);
    const childFade = 1 - smoothstep01(0.25, 0.85, childWeight);
    return Math.max(0, Math.min(1, detailWeight * spanFade * childFade));
  }
  // depth === 3 (Country): fades smoothly to 0 as settlement comes into close-up view
  const spanFade = smoothstep01(9, 28, viewSpan);
  const childFade = 1 - smoothstep01(0.15, 0.72, childWeight);
  return Math.max(0, Math.min(1, detailWeight * spanFade * childFade));
}
```

### src/infrastructure/world/atlas-three/atlas-three-multimap.ts:135

```ts
export function computeMacroWaterTargetOpacity(input: {
  readonly depth: number;
  readonly detailWeight: number;
  readonly viewSpan: number;
  readonly childWeight: number;
  readonly hasActiveSettlementOrDeeper: boolean;
}): number {
  const { depth, detailWeight, viewSpan, childWeight, hasActiveSettlementOrDeeper } = input;
  if (depth <= 1) {
    if (hasActiveSettlementOrDeeper) return 0;
    return Math.max(0, Math.min(1, 1 - smoothstep01(0.35, 0.9, childWeight)));
  }
  if (depth === 2) {
    if (hasActiveSettlementOrDeeper && viewSpan < 10) return 0;
    return Math.max(0, Math.min(1, detailWeight * (1 - smoothstep01(0.35, 0.9, childWeight))));
  }
  // depth === 3 (Country): stays active through regional approach (`span >= 8`), then hands off
  // smoothly (`span 8 -> 2.8`) once the calibrated local settlement river owns the frame.
  const closeHandoff = hasActiveSettlementOrDeeper ? smoothstep01(2.8, 8.0, viewSpan) : 1;
  return Math.max(0, Math.min(1, Math.max(detailWeight, hasActiveSettlementOrDeeper ? 0.95 : 0) * closeHandoff));
}
```

### src/infrastructure/world/atlas-three/atlas-three-multimap.ts:157

```ts
export type AtlasThreeMultiMapStats = {
  readonly activeMapIds: readonly string[];
  readonly activeEditorMapId: string | null;
  readonly groupCount: number;
  readonly liveGeometryCount: number;
  readonly clearRootCount: number;
  readonly incrementalSyncCount: number;
  readonly ownPerMapTerrainCount: number;
  readonly terrain: AtlasThreeWorldTerrainStats;
  readonly groupOpacities: Readonly<Record<string, AtlasThreeGroupOpacitySnapshot>>;
};
```

### src/infrastructure/world/atlas-three/atlas-three-multimap.ts:203

```ts
export function applyLocalCutoutFilter(
  doc: UnifiedCanvasDoc,
  cutouts: readonly AtlasLocalCutoutRect[],
): UnifiedCanvasDoc {
  if (cutouts.length === 0) return doc;
  const rooms = doc.rooms.filter((r) => {
    if (r.id === 'w.ocean' || r.id === 'g.ocean') return true;
    return !rectFullyInsideAnyCutout(r.x, r.y, r.w, r.h, cutouts);
  });
  const objects = doc.objects.filter((o) => !pointInsideAnyCutout(o.x, o.y, cutouts));
  const strokes: UnifiedCanvasStroke[] = [];
  for (const s of doc.strokes) {
    const clippedSegments = clipPolylineOutsideRects(s.points, cutouts);
    for (let i = 0; i < clippedSegments.length; i += 1) {
      const seg = clippedSegments[i]!;
      if (seg.length < 2) continue;
      strokes.push({
        ...s,
        id: i === 0 ? s.id : `${s.id}#clip${i}`,
        points: seg,
      });
    }
  }
  return {
    ...doc,
    rooms,
    objects,
    strokes,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-three-multimap.ts:246

```ts
export function multiMapDepthLiftY(depth: number): number {
  const table = [0, 0.08, 0.14, 0.18, 0.184, 0.187];
  const idx = Math.max(0, depth - 1);
  if (idx < table.length) return table[idx]!;
  return 0.187 + (idx - (table.length - 1)) * 0.003;
}
```

### src/infrastructure/world/atlas-three/atlas-three-multimap.ts:257

```ts
export function applyWorldTransformToGroup(
  pivot: THREE.Group,
  content: THREE.Group,
  entry: AtlasWorldSceneGroupPlan,
  bounds: WorldAtlasBounds = DEFAULT_ATLAS_BOUNDS,
  baseElevationY = 0,
): void {
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;
  const { centerX, centerY, scaleX, scaleY, rotationRad } = entry.worldTransform;
  const verticalScale = Math.sqrt(Math.max(1e-8, scaleX * scaleY));
  const depthLiftY = multiMapDepthLiftY(entry.depth);

  pivot.position.set(centerX, baseElevationY + depthLiftY, centerY);
  pivot.rotation.set(0, -rotationRad, 0);
  pivot.scale.set(scaleX, verticalScale, scaleY);
  content.position.set(-midX, 0, -midY);
  pivot.updateMatrixWorld(true);
}
```

### src/infrastructure/world/atlas-three/atlas-three-multimap.ts:305

```ts
export class AtlasThreeMultiMapGraph {
  readonly rootGroup = new THREE.Group();
  readonly worldTerrain: AtlasThreeWorldTerrain;
  private readonly groups = new Map<string, AtlasThreeMapGroupNode>();
  private activeEditorMapId: string | null = null;
  private clearRootCount = 0;
  private incrementalSyncCount = 0;
  private lastTerrainSourceKey = '';

  constructor(
    private readonly getMaterial: (key: AtlasThreeSurfaceKey) => THREE.Material,
    private readonly waterMaterial: THREE.Material,
    private readonly aoMaterial?: THREE.Material,
  ) {
    this.rootGroup.name = 'atlas3:multimap-root';
    this.worldTerrain = new AtlasThreeWorldTerrain(() => this.getMaterial('terrain'));
    this.rootGroup.add(this.worldTerrain.rootGroup);
  }

  /**
   * Synchronize the shared chunked world terrain source from the root map's heightfield
   * plus any localized fine heightfield overlays (e.g. Dornhain hills) projected into World Space.
   */
  private ensureSharedWorldTerrainSource(
    scenePlan: AtlasWorldScenePlan,
    sources: ReadonlyMap<string, AtlasThreeWorldMapSource>,
  ): void {
    const rootId = scenePlan.rootMapId;
    const rootSource = rootId ? sources.get(rootId) : undefined;
    const rootHf = rootSource?.doc.heightfield ?? null;
    if (!rootHf || !rootSource) {
      if (this.lastTerrainSourceKey !== '') {
        this.lastTerrainSourceKey = '';
        this.worldTerrain.setSource(null);
      }
      return;
    }

    const overlays: AtlasWorldHeightfieldOverlay[] = [];
    const overlayParts: string[] = [];
    for (const entry of scenePlan.entries) {
      if (entry.depth === 1) continue;
      const src = sources.get(entry.mapId);
      if (!src || src.look !== 'outdoor' || !src.doc.heightfield) continue;
      const hf = src.doc.heightfield;
      const verticalScale = Math.sqrt(
        Math.max(1e-8, entry.worldTransform.scaleX * entry.worldTransform.scaleY),
      );
      const elevationScale = Math.max(0.012, Math.min(0.06, verticalScale * 4));
      overlays.push({
        id: entry.mapId,
        worldBounds: {
          minX: entry.worldAabb.minX,
          minZ: entry.worldAabb.minY,
          maxX: entry.worldAabb.maxX,
          maxZ: entry.worldAabb.maxY,
        },
        heightfield: hf,
        elevationScale,
        featherRatio: 0.24,
      });
      const placementKey = `${Math.round(entry.worldAabb.minX * 100)},${Math.round(entry.worldAabb.minY * 100)},${Math.round(entry.worldAabb.maxX * 100)},${Math.round(entry.worldAabb.maxY * 100)},${Math.round(elevationScale * 10000)}`;
      overlayParts.push(`${entry.mapId}:${hfVersionKey(hf)}@${placementKey}`);
    }

    const key = `${rootId}:${hfVersionKey(rootHf)}|${overlayParts.sort().join(',')}`;
    if (key === this.lastTerrainSourceKey) return;
    this.lastTerrainSourceKey = key;

    this.worldTerrain.setSource(
      createAtlasWorldHeightfieldSource({
        rootHeightfield: rootHf,
        revisionKey: key,
        overlays,
      }),
    );
  }

  /**
   * Incrementally sync the shared chunked world terrain AND Three.js overlay groups
   * to match `scenePlan`.
   *
   * - Never calls `clearRoot()`.
   * - Consumes `entry.detailWeight` continuously via per-group cloned materials without
   *   rebuilding geometry when only opacity/transform changes.
   * - When `dtSec` is provided (live render loop), smoothly damps opacity (~180 ms)
   *   and fades exiting groups out to 0 before disposing them.
   */
  sync(input: {
    readonly scenePlan: AtlasWorldScenePlan;
    readonly sources: ReadonlyMap<string, AtlasThreeWorldMapSource>;
    readonly presetId: AtlasGraphicsPresetId;
    readonly hideRoofs: boolean;
    readonly viewSpan: number;
    readonly camera?: AtlasWorldCameraState;
    readonly viewportPx?: { readonly width: number; readonly height: number };
    readonly dtSec?: number;
  }): void {
    this.incrementalSyncCount += 1;
    this.activeEditorMapId = input.scenePlan.activeEditorMapId;

    // 0) Sync the ONE shared chunked world terrain (Phase 1.3)
    this.ensureSharedWorldTerrainSource(input.scenePlan, input.sources);
    const hasSharedTerrain = Boolean(this.worldTerrain.getSource());
    if (hasSharedTerrain && input.camera && input.viewportPx) {
      this.worldTerrain.sync({
        camera: input.camera,
        viewportPx: input.viewportPx,
      });
    }

    const wantedIds = new Set(input.scenePlan.entries.map((e) => e.mapId));
    const useSmoothDamp = typeof input.dtSec === 'number' && Number.isFinite(input.dtSec);
    const dampAlpha = useSmoothDamp
      ? 1 - Math.exp(-OPACITY_DAMP_RATE * Math.max(0.001, Math.min(0.1, input.dtSec!)))
      : 1;

    // 1) Fade out or dispose groups that left the active scene plan
    for (const [mapId, node] of [...this.groups.entries()]) {
      if (wantedIds.has(mapId)) continue;
      if (
        useSmoothDamp &&
        node.depth > 1 &&
        (node.currentOpacity > OPACITY_EXIT_EPSILON || node.currentWaterOpacity > OPACITY_EXIT_EPSILON)
      ) {
        node.exiting = true;
        node.targetOpacity = 0;
        node.targetWaterOpacity = 0;
        node.detailWeight = 0;
        node.currentOpacity += (0 - node.currentOpacity) * dampAlpha;
        node.currentWaterOpacity += (0 - node.currentWaterOpacity) * dampAlpha;
        this.applyOpacityToNode(node);
        if (
          node.currentOpacity <= OPACITY_EXIT_EPSILON &&
          node.currentWaterOpacity <= OPACITY_EXIT_EPSILON
        ) {
          this.disposeGroupNode(node);
          this.groups.delete(mapId);
        }
      } else {
        this.disposeGroupNode(node);
        this.groups.delete(mapId);
      }
    }

    // Compute highest active child detailWeight per parent so coarse outdoor parent overlays
    // (coarse land roads, world landmark icons) smoothly yield to detailed settlements/buildings
    // while the ONE shared chunked world terrain stays 100% opaque underneath!
    const maxChildWeightByParent = new Map<string, number>();
    const hasIndoorChildByParent = new Map<string, boolean>();
    let hasActiveSettlementOrDeeper = false;
    for (const e of input.scenePlan.entries) {
      if (e.depth >= 4 && e.detailWeight > 0.25) {
        hasActiveSettlementOrDeeper = true;
      }
      if (!e.parentMapId) continue;
      const prev = maxChildWeightByParent.get(e.parentMapId) ?? 0;
      if (e.detailWeight > prev) {
        maxChildWeightByParent.set(e.parentMapId, e.detailWeight);
      }
      const childSrc = input.sources.get(e.mapId);
      if (childSrc?.look === 'indoor' && e.detailWeight > 0.25) {
        hasIndoorChildByParent.set(e.parentMapId, true);
      }
    }

    // 2) Mount new groups or incrementally update transform & continuous opacity
    for (const entry of input.scenePlan.entries) {
      const source = input.sources.get(entry.mapId);
      if (!source) continue;

      const cSig = cutoutSignature(entry.cutoutRectsLocal);
      const rev = source.revisionKey ?? 'v0';
      const terrainSig = hasSharedTerrain ? this.lastTerrainSourceKey : 'local';
      // Auto roof-cutaway on a settlement when an interior building/room inside it is active!
      const effectiveHideRoofs =
        input.hideRoofs || Boolean(hasIndoorChildByParent.get(entry.mapId));
      const sig = `${rev}|${source.mapScale}|${source.look}|${input.presetId}|${effectiveHideRoofs ? 1 : 0}|${cSig}|${terrainSig}`;

      const childWeight = maxChildWeightByParent.get(entry.mapId) ?? 0;
      // Scale-aware 2-channel handover:
      //  - Macro non-water overlays (macro landmark markers & coarse roads on depth 1..3) fade
      //    completely to exact `0` before settlement scale (ZERO `0.08` ghost geometry!).
      //  - Macro rivers (`water`) stay active on the immediate regional carrier around Liang-Barsky
      //    settlement cutouts so calibrated local settlement rivers hand off without abrupt breaks.
      const isSharedMacroOutdoor =
        hasSharedTerrain && source.look === 'outdoor' && source.mapScale === 'world';
      let targetOpacity: number;
      let targetWaterOpacity: number;
      if (isSharedMacroOutdoor) {
        targetOpacity = computeMacroOverlayTargetOpacity({
          depth: entry.depth,
          detailWeight: entry.detailWeight,
          viewSpan: input.viewSpan,
          childWeight,
          hasActiveSettlementOrDeeper,
        });
        targetWaterOpacity = computeMacroWaterTargetOpacity({
          depth: entry.depth,
          detailWeight: entry.detailWeight,
          viewSpan: input.viewSpan,
          childWeight,
          hasActiveSettlementOrDeeper,
        });
      } else if (entry.depth === 1) {
        targetOpacity = 1;
        targetWaterOpacity = 1;
      } else if (source.look === 'outdoor' && hasIndoorChildByParent.get(entry.mapId)) {
        // Keep settlement surroundings gently visible as context around an active indoor building
        targetOpacity = Math.max(0.45, Math.min(1, entry.detailWeight * 0.72));
        targetWaterOpacity = targetOpacity;
      } else {
        targetOpacity = Math.max(0, Math.min(1, entry.detailWeight));
        targetWaterOpacity = targetOpacity;
      }

      const baseElevationY =
        hasSharedTerrain && source.look === 'indoor'
          ? this.worldTerrain.sampleElevation(
            entry.worldTransform.centerX,
            entry.worldTransform.centerY,
          ) + 0.003
          : 0;

      const existing = this.groups.get(entry.mapId);
      if (existing && existing.buildSignature === sig) {
        // Zero rebuild: update world transform AND smoothly ramp continuous opacity!
        existing.exiting = false;
        existing.lodState = entry.lodState;
        existing.detailWeight = entry.detailWeight;
        existing.targetOpacity = targetOpacity;
        existing.targetWaterOpacity = targetWaterOpacity;
        existing.currentOpacity =
          useSmoothDamp
            ? existing.currentOpacity + (targetOpacity - existing.currentOpacity) * dampAlpha
            : targetOpacity;
        existing.currentWaterOpacity =
          useSmoothDamp
            ? existing.currentWaterOpacity +
            (targetWaterOpacity - existing.currentWaterOpacity) * dampAlpha
            : targetWaterOpacity;
        if (Math.abs(existing.currentOpacity - targetOpacity) < 0.004) {
          existing.currentOpacity = targetOpacity;
        }
        if (Math.abs(existing.currentWaterOpacity - targetWaterOpacity) < 0.004) {
          existing.currentWaterOpacity = targetWaterOpacity;
        }
        applyWorldTransformToGroup(
          existing.pivot,
          existing.content,
          entry,
          source.bounds,
          baseElevationY,
        );
        this.applyOpacityToNode(existing);
        continue;
      }

      const prevOpacity = existing?.currentOpacity;
      const prevWaterOpacity = existing?.currentWaterOpacity;
      if (existing) {
        this.disposeGroupNode(existing);
        this.groups.delete(entry.mapId);
      }

      const filteredDoc = applyLocalCutoutFilter(source.doc, entry.cutoutRectsLocal);
      const bounds = source.bounds ?? DEFAULT_ATLAS_BOUNDS;
      const midX = (bounds.minX + bounds.maxX) / 2;
      const midY = (bounds.minY + bounds.maxY) / 2;
      const { centerX, centerY, scaleX, scaleY, rotationRad } = entry.worldTransform;
      const cosR = Math.cos(rotationRad);
      const sinR = Math.sin(rotationRad);
      const verticalScale = Math.sqrt(Math.max(1e-8, scaleX * scaleY));
      const depthLiftY = multiMapDepthLiftY(entry.depth);

      const sharedWorldTerrain: SharedWorldTerrainBinding | undefined =
        hasSharedTerrain && source.look === 'outdoor'
          ? {
            sampleElevationWorld: (wx, wz) => this.worldTerrain.sampleElevation(wx, wz),
            mapToWorld: (lx, lz) => {
              const dx = (lx - midX) * scaleX;
              const dz = (lz - midY) * scaleY;
              return [centerX + dx * cosR - dz * sinR, centerY + dx * sinR + dz * cosR] as const;
            },
            verticalScale,
            depthLiftY,
            waterLevel: this.worldTerrain.getSource()?.waterLevel ?? 0,
          }
          : undefined;

      const plan = buildAtlasThreeScenePlan(filteredDoc, {
        mapScale: source.mapScale,
        look: source.look,
        span: Math.max(24, input.viewSpan / Math.max(1e-4, entry.worldTransform.scaleX)),
        presetId: input.presetId,
        seed: entry.mapId,
        hideRoofs: effectiveHideRoofs,
        warmWindows: true,
        sharedWorldTerrain,
        exclusionRects: entry.cutoutRectsLocal,
      });

      const pivot = new THREE.Group();
      pivot.name = `atlas3:map-pivot:${entry.mapId}`;
      pivot.userData.mapId = entry.mapId;
      pivot.userData.depth = entry.depth;

      const content = new THREE.Group();
      content.name = `atlas3:map-content:${entry.mapId}`;
      pivot.add(content);

      const pickables: THREE.Object3D[] = [];
      const overlayMeshes: THREE.Object3D[] = [];
      const waterMeshes: THREE.Object3D[] = [];
      const geometries: THREE.BufferGeometry[] = [];
      const materials: ClonedGroupMaterial[] = [];

      const clonedMatCache = new Map<AtlasThreeSurfaceKey, THREE.Material>();
      const cloneSurfaceMat = (surfaceKey: AtlasThreeSurfaceKey): THREE.Material => {
        const cached = clonedMatCache.get(surfaceKey);
        if (cached) return cached;
        const cloned = this.getMaterial(surfaceKey).clone();
        clonedMatCache.set(surfaceKey, cloned);
        materials.push({ material: cloned, surfaceKey });
        return cloned;
      };

      for (const [surfaceKey, builder] of plan.builders) {
        if (builder.triangleCount === 0) continue;
        const geo = builder.build();
        geometries.push(geo);
        const mat = cloneSurfaceMat(surfaceKey);
        const mesh = new THREE.Mesh(geo, mat);
        const flat = surfaceKey.startsWith('sheet') || surfaceKey.startsWith('floor');
        mesh.castShadow = !flat;
        mesh.receiveShadow = true;
        mesh.userData.triIds = builder.triIds;
        mesh.userData.mapId = entry.mapId;
        mesh.name = `atlas3:${entry.mapId}:${surfaceKey}`;
        content.add(mesh);
        overlayMeshes.push(mesh);
        pickables.push(mesh);
      }

      if (plan.water.triangleCount > 0) {
        const geo = plan.water.build();
        geometries.push(geo);
        const waterClone = this.waterMaterial.clone();
        materials.push({ material: waterClone, surfaceKey: 'water' });
        const mesh = new THREE.Mesh(geo, waterClone);
        mesh.userData.triIds = plan.water.triIds;
        mesh.userData.mapId = entry.mapId;
        mesh.name = `atlas3:${entry.mapId}:water`;
        mesh.renderOrder = 2;
        content.add(mesh);
        waterMeshes.push(mesh);
        pickables.push(mesh);
      }

      if (plan.doorInstances.matrices.length > 0) {
        const doorGeo = new THREE.BoxGeometry(1, 1, 1);
        geometries.push(doorGeo);
        const inst = new THREE.InstancedMesh(
          doorGeo,
          cloneSurfaceMat('wood-dark'),
          plan.doorInstances.matrices.length,
        );
        plan.doorInstances.matrices.forEach((m, i) => inst.setMatrixAt(i, m));
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        inst.castShadow = true;
        inst.receiveShadow = true;
        inst.userData.instanceIds = plan.doorInstances.ids;
        inst.userData.mapId = entry.mapId;
        inst.name = `atlas3:${entry.mapId}:doors`;
        content.add(inst);
        overlayMeshes.push(inst);
        pickables.push(inst);
      }

      // Suggestive scatter (settlement perimeter woods/bushes/flowers & interior rubble)
      // — skip coarse world-level scatter on depth 1–3 outdoor overview maps when shared terrain
      // is active so zooming in never lingers on giant coarse trees before reaching Dornhain!
      const emitScatterForGroup =
        !hasSharedTerrain || source.mapScale === 'settlement' || source.look === 'indoor';
      if (emitScatterForGroup) {
        for (const batch of plan.scatterBatches) {
          const { parts } = buildAtlasScatterGeometry(batch.kind);
          for (const part of parts) {
            geometries.push(part.geo);
            const inst = new THREE.InstancedMesh(
              part.geo,
              cloneSurfaceMat(part.surface),
              batch.matrices.length,
            );
            batch.matrices.forEach((m, i) => inst.setMatrixAt(i, m));
            inst.instanceMatrix.needsUpdate = true;
            inst.computeBoundingSphere();
            inst.castShadow = batch.kind !== 'flower' && batch.kind !== 'rubble';
            inst.receiveShadow = true;
            inst.userData.mapId = entry.mapId;
            inst.name = `atlas3:${entry.mapId}:scatter:${batch.kind}`;
            content.add(inst);
            overlayMeshes.push(inst);
          }
        }
      }

      if (this.aoMaterial && plan.aoDiscs.length > 0 && source.mapScale !== 'world') {
        const discGeo = new THREE.PlaneGeometry(2, 2);
        discGeo.rotateX(-Math.PI / 2);
        geometries.push(discGeo);
        const aoClone = this.aoMaterial.clone();
        materials.push({ material: aoClone, surfaceKey: 'ao' });
        const aoInst = new THREE.InstancedMesh(discGeo, aoClone, plan.aoDiscs.length);
        const mat4 = new THREE.Matrix4();
        const quat = new THREE.Quaternion();
        plan.aoDiscs.forEach((d, i) => {
          mat4.compose(new THREE.Vector3(d.x, d.y, d.z), quat, new THREE.Vector3(d.radius, 1, d.radius));
          aoInst.setMatrixAt(i, mat4);
        });
        aoInst.instanceMatrix.needsUpdate = true;
        aoInst.computeBoundingSphere();
        aoInst.renderOrder = 2;
        aoInst.name = `atlas3:${entry.mapId}:ao`;
        content.add(aoInst);
        overlayMeshes.push(aoInst);
      }

      // Per-map terrain only if no shared world terrain source exists (legacy fallback)
      let hasOwnTerrain = false;
      if (plan.terrain) {
        hasOwnTerrain = true;
        geometries.push(plan.terrain);
        const mat = cloneSurfaceMat('terrain');
        const mesh = new THREE.Mesh(plan.terrain, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.mapId = entry.mapId;
        mesh.name = `atlas3:${entry.mapId}:terrain`;
        content.add(mesh);
        overlayMeshes.push(mesh);
      }

      applyWorldTransformToGroup(pivot, content, entry, source.bounds, baseElevationY);
      this.rootGroup.add(pivot);

      // Start freshly entering child maps from 0 (damped fade-in) instead of jumping 0→100%
      const initialOpacity =
        prevOpacity !== undefined
          ? prevOpacity
          : entry.depth === 1
            ? targetOpacity
            : useSmoothDamp
              ? targetOpacity * dampAlpha
              : targetOpacity;
      const initialWaterOpacity =
        prevWaterOpacity !== undefined
          ? prevWaterOpacity
          : entry.depth === 1
            ? targetWaterOpacity
            : useSmoothDamp
              ? targetWaterOpacity * dampAlpha
              : targetWaterOpacity;

      const node: AtlasThreeMapGroupNode = {
        mapId: entry.mapId,
        depth: entry.depth,
        pivot,
        content,
        pickables,
        overlayMeshes,
        waterMeshes,
        scenePlan: plan,
        buildSignature: sig,
        geometries,
        materials,
        cutoutSignature: cSig,
        hasOwnTerrain,
        lodState: entry.lodState,
        detailWeight: entry.detailWeight,
        targetOpacity,
        currentOpacity: initialOpacity,
        targetWaterOpacity,
        currentWaterOpacity: initialWaterOpacity,
        exiting: false,
      };
      this.applyOpacityToNode(node);
      this.groups.set(entry.mapId, node);
    }
  }

  /** Propagate lighting/style roughness & normalScale updates to cloned per-group materials. */
  applyStyleMode(styleMode: 'pbr' | 'illustrated' | 'cel'): void {
    for (const node of this.groups.values()) {
      for (const entry of node.materials) {
        if (entry.surfaceKey === 'water' || entry.surfaceKey === 'ao') continue;
        if (!(entry.material instanceof THREE.MeshStandardMaterial)) continue;
        const spec = ATLAS_THREE_SURFACES[entry.surfaceKey];
        if (!spec) continue;
        if (styleMode === 'cel') {
          entry.material.roughness = Math.min(1, spec.roughness + 0.08);
          entry.material.normalScale.set(spec.normalScale * 0.35, spec.normalScale * 0.35);
        } else if (styleMode === 'illustrated') {
          entry.material.roughness = Math.min(1, spec.roughness + 0.03);
          entry.material.normalScale.set(spec.normalScale * 0.72, spec.normalScale * 0.72);
        } else {
          entry.material.roughness = spec.roughness;
          entry.material.normalScale.set(spec.normalScale, spec.normalScale);
        }
      }
    }
  }

  /** Propagate animated water shader uniforms to cloned per-group river/water materials. */
  syncWaterUniforms(sourceWater: THREE.ShaderMaterial): void {
    for (const node of this.groups.values()) {
      for (const entry of node.materials) {
        if (entry.surfaceKey !== 'water' || !(entry.material instanceof THREE.ShaderMaterial)) continue;
        const dst = entry.material.uniforms;
        const src = sourceWater.uniforms;
        if (dst.uTime && src.uTime) dst.uTime.value = src.uTime.value;
        if (dst.uDeep && src.uDeep) dst.uDeep.value.copy(src.uDeep.value);
        if (dst.uShallow && src.uShallow) dst.uShallow.value.copy(src.uShallow.value);
        if (dst.uSky && src.uSky) dst.uSky.value.copy(src.uSky.value);
        if (dst.uSunDir && src.uSunDir) dst.uSunDir.value.copy(src.uSunDir.value);
        if (dst.uFogColor && src.uFogColor) dst.uFogColor.value.copy(src.uFogColor.value);
        if (dst.uFocus && src.uFocus) dst.uFocus.value.copy(src.uFocus.value);
        if (dst.uSpan && src.uSpan) dst.uSpan.value = src.uSpan.value;
        if (dst.uWorldHeightTex && src.uWorldHeightTex) dst.uWorldHeightTex.value = src.uWorldHeightTex.value;
        if (dst.uHasWorldHeight && src.uHasWorldHeight) dst.uHasWorldHeight.value = src.uHasWorldHeight.value;
        if (dst.uHeightMin && src.uHeightMin) dst.uHeightMin.value = src.uHeightMin.value;
        if (dst.uHeightMax && src.uHeightMax) dst.uHeightMax.value = src.uHeightMax.value;
        if (dst.uWaterLevel && src.uWaterLevel) dst.uWaterLevel.value = src.uWaterLevel.value;
      }
    }
  }

  private applyOpacityToNode(node: AtlasThreeMapGroupNode): void {
    const op = Math.max(0, Math.min(1, node.currentOpacity));
    const waterOp = Math.max(0, Math.min(1, node.currentWaterOpacity));
    const showOverlay = op > 0.005;
    const showWater = waterOp > 0.005;
    for (const m of node.materials) {
      applyMaterialOpacity(m, m.surfaceKey === 'water' ? waterOp : op);
    }
    for (const mesh of node.overlayMeshes) {
      mesh.visible = showOverlay;
    }
    for (const mesh of node.waterMeshes) {
      mesh.visible = showWater;
    }
    node.pivot.visible = showOverlay || showWater;
  }

  getGroup(mapId: string): AtlasThreeMapGroupNode | undefined {
    return this.groups.get(mapId);
  }

  getAllPickables(): readonly THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const g of this.groups.values()) {
      if (!g.pivot.visible || g.exiting) continue;
      for (const p of g.pickables) {
        if (p.visible) out.push(p);
      }
    }
    return out;
  }

  getActiveEditorElevationY(focusX?: number, focusZ?: number): number {
    const activeGroup = this.activeEditorMapId ? this.groups.get(this.activeEditorMapId) : undefined;
    if (activeGroup && activeGroup.pivot.position.y > 0.5) {
      return activeGroup.pivot.position.y;
    }
    const terrainSource = this.worldTerrain.getSource();
    if (terrainSource && focusX !== undefined && focusZ !== undefined) {
      return Math.max(terrainSource.waterLevel, this.worldTerrain.sampleElevation(focusX, focusZ));
    }
    return activeGroup ? activeGroup.pivot.position.y : 0;
  }

  getRenderedIds(): string[] {
    const out = new Set<string>();
    for (const g of this.groups.values()) {
      for (const id of g.scenePlan.ids) out.add(id);
    }
    return [...out].sort();
  }

  getStats(): AtlasThreeMultiMapStats {
    const terrain = this.worldTerrain.getStats();
    let liveGeometryCount = terrain.liveGeometryCount;
    let ownPerMapTerrainCount = 0;
    const groupOpacities: Record<string, AtlasThreeGroupOpacitySnapshot> = {};
    for (const g of this.groups.values()) {
      liveGeometryCount += g.geometries.length;
      if (g.hasOwnTerrain) ownPerMapTerrainCount += 1;
      groupOpacities[g.mapId] = {
        detailWeight: Math.round(g.detailWeight * 1000) / 1000,
        opacity: Math.round(g.currentOpacity * 1000) / 1000,
        waterOpacity: Math.round(g.currentWaterOpacity * 1000) / 1000,
        depth: g.depth,
        lodState: g.lodState,
        exiting: g.exiting,
      };
    }
    return {
      activeMapIds: [...this.groups.keys()],
      activeEditorMapId: this.activeEditorMapId,
      groupCount: this.groups.size,
      liveGeometryCount,
      clearRootCount: this.clearRootCount,
      incrementalSyncCount: this.incrementalSyncCount,
      ownPerMapTerrainCount,
      terrain,
      groupOpacities,
    };
  }

  /** True while any group is still smoothly fading opacity in or out (keeps 60fps during transitions). */
  hasPendingOpacityTransition(): boolean {
    for (const node of this.groups.values()) {
      if (
        node.exiting ||
        Math.abs(node.currentOpacity - node.targetOpacity) > OPACITY_EXIT_EPSILON ||
        Math.abs(node.currentWaterOpacity - node.targetWaterOpacity) > OPACITY_EXIT_EPSILON
      ) {
        return true;
      }
    }
    return false;
  }

  /** Teardown all groups + shared terrain chunks and release 100% of GPU geometries & cloned materials. */
  dispose(): void {
    this.worldTerrain.dispose();
    for (const node of this.groups.values()) {
      this.disposeGroupNode(node);
    }
    this.groups.clear();
    this.activeEditorMapId = null;
    this.lastTerrainSourceKey = '';
  }

  private disposeGroupNode(node: AtlasThreeMapGroupNode): void {
    this.rootGroup.remove(node.pivot);
    for (const geo of node.geometries) {
      geo.dispose();
    }
    for (const entry of node.materials) {
      entry.material.dispose();
    }
    node.geometries.length = 0;
    node.materials.length = 0;
    node.pickables.length = 0;
    node.overlayMeshes.length = 0;
    node.waterMeshes.length = 0;
  }
}
```

### src/infrastructure/world/atlas-three/atlas-three-runtime.ts:57

```ts
export type AtlasThreeLightingMode = 'day' | 'evening' | 'night';
```

### src/infrastructure/world/atlas-three/atlas-three-runtime.ts:58

```ts
export type AtlasThreeStyleMode = 'pbr' | 'illustrated' | 'cel';
```

### src/infrastructure/world/atlas-three/atlas-three-runtime.ts:60

```ts
export type AtlasThreeProjectedPin = {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly left: number;
  readonly top: number;
  readonly visible: boolean;
  /** Projected screen-space pixel span of the pin's World-Space footprint (for hierarchy reveal). */
  readonly projectedSpanPx?: number;
};
```

### src/infrastructure/world/atlas-three/atlas-three-runtime.ts:71

```ts
export type AtlasThreeRuntimeConfig = {
  readonly canvas: HTMLCanvasElement;
  readonly presetId: AtlasGraphicsPresetId;
  readonly onCameraChange?: (view: AtlasThreeCameraView) => void;
  readonly onProjectedPins?: (pins: readonly AtlasThreeProjectedPin[]) => void;
  readonly onContextLostChange?: (lost: boolean) => void;
  /** SCM-05 / SCM-07: emits camera-driven `activeEditorMapId` from AtlasWorldScenePlan without doc-swap. */
  readonly onActiveEditorMapChange?: (mapId: string | null) => void;
};
```

### src/infrastructure/world/atlas-three/atlas-three-runtime.ts:431

```ts
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
  private lastIdleRenderMs = 0;
  private renderDirty = true;
  private worldMapsTopologySig = '';
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
      this.renderDirty = true;
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
    this.renderDirty = true;
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
    this.renderDirty = true;
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
    this.renderDirty = true;
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
    const nextTopologySig = input.maps
      .map((m) => {
        const a = m.parentAnchor;
        const aKey = a
          ? `${a.parentMapId}:${a.centerX},${a.centerY},${a.extentX},${a.extentY},${a.rotationRad}`
          : 'root';
        return `${m.id}:${m.status ?? ''}:${aKey}`;
      })
      .join('|');
    this.worldMaps = input.maps;
    this.worldSources = new Map(input.sources.map((s) => [s.mapId, s] as const));
    this.renderDirty = true;
    if (nextTopologySig !== this.worldMapsTopologySig) {
      this.worldMapsTopologySig = nextTopologySig;
      this.worldScenePlan = null;
      this.lastReportedEditorMapId = undefined;
    }
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
    this.focusTargetMapId = null;
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
    this.renderDirty = true;
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
    this.renderDirty = true;
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
    this.renderDirty = true;
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
    this.renderDirty = true;

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
        config: {
          maxActiveMaps: 6,
          sseRefinePx: 140,
          sseCoarsenPx: 95,
          sseReplaceParentPx: 210,
        },
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
    const isWorldMode = this.worldMaps.length > 0;
    const terrainSrc = isWorldMode ? this.multiMap.worldTerrain.getSource() : null;
    const pinLift = isWorldMode
      ? Math.min(7.5, Math.max(0.05, this.view.span * 0.032))
      : 14;
    const denom = Math.max(1e-6, this.view.span * 2);

    for (const pin of this.pins) {
      let pinY = pinLift;
      if (terrainSrc) {
        const groundY = this.multiMap.worldTerrain.sampleElevation(pin.x, pin.y);
        pinY = (Number.isFinite(groundY) ? Math.max(terrainSrc.waterLevel, groundY) : 0) + pinLift;
      }
      v.set(pin.x, pinY, pin.y).project(this.camera);
      const visible = v.z >= -1 && v.z <= 1;
      const left = Math.round(((v.x + 1) * 0.5) * w);
      const top = Math.round(((1 - v.y) * 0.5) * h);
      const projectedSpanPx =
        typeof pin.worldSpan === 'number' && Number.isFinite(pin.worldSpan) && pin.worldSpan > 0
          ? Math.round(((pin.worldSpan / denom) * h) * 10) / 10
          : undefined;
      projected.push({
        id: pin.id,
        label: pin.label,
        kind: pin.kind ?? 'place',
        left,
        top,
        visible: visible && left >= -80 && left <= w + 80 && top >= -40 && top <= h + 40,
        ...(projectedSpanPx !== undefined ? { projectedSpanPx } : {}),
      });
    }
    const key = projected
      .map((p) => `${p.id}:${p.left},${p.top},${p.visible ? 1 : 0},${p.projectedSpanPx ?? ''}`)
      .join('|');
    if (key !== this.lastPinEmitKey) {
      this.lastPinEmitKey = key;
      this.onProjectedPins(projected);
    }
  }

  private startLoop(): void {
    const IDLE_RENDER_INTERVAL_MS = 250;
    const tick = (now: number) => {
      if (this.disposed) return;
      this.rafId = window.requestAnimationFrame(tick);
      if (this.contextLost || !this.doc) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      const dtSec = Math.min(0.05, Math.max(0.001, (now - this.lastFrameMs) / 1000));
      this.lastFrameMs = now;

      const w = this.config.canvas.clientWidth;
      const h = this.config.canvas.clientHeight;
      if (w < 8 || h < 8) return;
      let resized = false;
      if (this.config.canvas.width !== Math.round(w * this.renderer.getPixelRatio())) {
        this.renderer.setSize(w, h, false);
        resized = true;
      }

      let cameraActive = false;
      if (this.flight) {
        cameraActive = true;
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
          cameraActive = true;
          this.view = damped.next;
          if (now - this.lastCameraNotifyMs > 48) {
            this.lastCameraNotifyMs = now;
            this.onCameraChange?.(this.view);
          }
        } else {
          const changed =
            this.view.x !== damped.next.x ||
            this.view.z !== damped.next.z ||
            (this.view.y ?? 0) !== (damped.next.y ?? 0) ||
            this.view.span !== damped.next.span ||
            this.view.yawRad !== damped.next.yawRad ||
            this.view.pitchRad !== damped.next.pitchRad;
          // Always finalize both `view` and `targetView` to `damped.next` BEFORE clearing
          // `zoomAnchor` so the next frame never re-damps unanchored or suffers a Y jump!
          this.view = damped.next;
          this.targetView = { ...damped.next };
          this.zoomAnchor = null;
          if (changed) {
            cameraActive = true;
            this.onCameraChange?.(this.view);
          }
        }
      }

      const needsFullRate =
        cameraActive ||
        resized ||
        this.renderDirty ||
        this.multiMap.hasPendingOpacityTransition();
      if (!needsFullRate && now - this.lastIdleRenderMs < IDLE_RENDER_INTERVAL_MS) {
        return;
      }
      this.renderDirty = false;
      this.lastIdleRenderMs = now;

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
  'floor-cobble': { pbr: 'cobble', color: '#e2d7be', roughness: 0.86, normalScale: 0.72, tile: 20 },
  'floor-stone': { pbr: 'cobble', color: '#b0aca0', roughness: 0.88, normalScale: 0.74, tile: 18 },
  'floor-wood': { pbr: 'wood', color: '#deb486', roughness: 0.72, normalScale: 0.58, tile: 34 },
  'floor-dirt': { pbr: 'dirt', color: '#c8b28d', roughness: 0.96, normalScale: 0.58, tile: 42 },
  'floor-sand': { pbr: 'sand', color: '#e4d5af', roughness: 0.9, normalScale: 0.54, tile: 46 },
  'floor-grass': { pbr: 'grass', color: '#d7e2c2', roughness: 0.95, normalScale: 0.65, tile: 62 },
  'floor-moss': { pbr: 'moss', color: '#9fc29b', roughness: 0.94, normalScale: 0.6, tile: 42 },
  wall: { pbr: 'wall', color: '#ded7c2', roughness: 0.92, normalScale: 0.62, tile: 26 },
  'wall-indoor': { pbr: 'wall', color: '#b6b09f', roughness: 0.94, normalScale: 0.7, tile: 22 },
  plaster: { pbr: 'plaster', color: '#f2e3c7', roughness: 0.95, normalScale: 0.36, tile: 22 },
  'roof-tile': { pbr: 'roofTile', color: '#e69b78', roughness: 0.82, normalScale: 0.88, tile: 16 },
  'roof-slate': { pbr: 'roofSlate', color: '#90a3b5', roughness: 0.74, normalScale: 0.82, tile: 16 },
  'roof-moss': { pbr: 'roofMoss', color: '#a5bd88', roughness: 0.88, normalScale: 0.84, tile: 16 },
  wood: { pbr: 'wood', color: '#c8986b', roughness: 0.84, normalScale: 0.62, tile: 15 },
  'wood-dark': { pbr: 'wood', color: '#5c412c', roughness: 0.86, normalScale: 0.66, tile: 14 },
  'bark-birch': { pbr: 'plaster', color: '#dfd8c8', roughness: 0.86, normalScale: 0.44, tile: 14 },
  rock: { pbr: 'rock', color: '#9ea89e', roughness: 0.92, normalScale: 0.9, tile: 30 },
  snow: { pbr: 'snow', color: '#f2f7fa', roughness: 0.74, normalScale: 0.36, tile: 34 },
  leaf: { pbr: 'moss', color: '#5f9458', roughness: 0.9, normalScale: 0.6, tile: 16 },
  'leaf-sun': { pbr: 'moss', color: '#8fbe65', roughness: 0.88, normalScale: 0.56, tile: 16 },
  'leaf-birch': { pbr: 'moss', color: '#9bc46e', roughness: 0.88, normalScale: 0.52, tile: 16 },
  'leaf-pine': { pbr: 'moss', color: '#3b6f54', roughness: 0.92, normalScale: 0.62, tile: 16 },
  'gold-accent': { pbr: null, color: '#eab95a', roughness: 0.28, normalScale: 0, tile: 1, metalness: 0.72 },
  'iron-dark': { pbr: null, color: '#394048', roughness: 0.42, normalScale: 0, tile: 1, metalness: 0.68 },
  'fabric-crimson': { pbr: 'fabric', color: '#d85852', roughness: 0.92, normalScale: 0.35, tile: 32 },
  'bottle-emerald': { pbr: null, color: '#2b8a64', roughness: 0.14, normalScale: 0, tile: 1, metalness: 0.12 },
  flower: { pbr: null, color: '#f3d474', roughness: 0.85, normalScale: 0, tile: 1 },
  window: { pbr: null, color: '#2b3e4f', roughness: 0.22, normalScale: 0, tile: 1, metalness: 0.18 },
  'window-warm': {
    pbr: null,
    color: '#ffd584',
    roughness: 0.35,
    normalScale: 0,
    tile: 1,
    emissive: '#ffae45',
  },
  flame: { pbr: null, color: '#ffbe66', roughness: 1, normalScale: 0, tile: 1, emissive: '#ffa342' },
} as const satisfies Record<string, AtlasThreeSurfaceSpec>;
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:91

```ts
export type AtlasThreeSurfaceKey = keyof typeof ATLAS_THREE_SURFACES;
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:93

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

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:109

```ts
export class AtlasThreeGeoBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly triIds: string[] = [];

  constructor(private readonly tile: number) { }

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

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:194

```ts
export type AtlasThreeScatterBatch = {
  readonly kind: AtlasScatterKind;
  readonly matrices: readonly THREE.Matrix4[];
};
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:199

```ts
export type AtlasThreeAoDisc = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
};
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:206

```ts
export type AtlasThreeContentBounds = {
  readonly centerX: number;
  readonly centerZ: number;
  readonly fitSpan: number;
};
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:212

```ts
export type AtlasThreeScenePlan = {
  readonly builders: Map<AtlasThreeSurfaceKey, AtlasThreeGeoBuilder>;
  readonly water: AtlasThreeGeoBuilder;
  readonly terrain: THREE.BufferGeometry | null;
  readonly waterLevel: number;
  readonly contentBounds: AtlasThreeContentBounds;
  readonly doorInstances: { readonly matrices: THREE.Matrix4[]; readonly ids: string[] };
  readonly scatterBatches: readonly AtlasThreeScatterBatch[];
  readonly aoDiscs: readonly AtlasThreeAoDisc[];
  readonly smokePoints: readonly THREE.Vector3[];
  readonly mistPoints: readonly { readonly position: THREE.Vector3; readonly scale: number }[];
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

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:234

```ts
export function terrainColorAt(height: number, waterLevel: number, slope: number): THREE.Color {
  const c = new THREE.Color();
  if (height < waterLevel - 0.55) {
    const depthT = Math.min(1, (waterLevel - 0.55 - height) / 7.5);
    c.set('#28646e').lerp(new THREE.Color('#143b49'), depthT);
    return c;
  }
  if (height < waterLevel + 1.55) {
    // Organic damp-pebble to warm sunlit beach sand transition along physical coastline
    const t = Math.max(0, Math.min(1, (height - (waterLevel - 0.55)) / 2.1));
    c.set('#5e8f84').lerp(new THREE.Color('#d8c79a'), t);
    if (slope > 0.24) {
      c.lerp(new THREE.Color('#7f8376'), Math.min(0.75, (slope - 0.24) * 2.4));
    }
    return c;
  }
  if (height < 11.5) {
    // Lowland meadow -> lush forest floor with warm earth & exposed hillside rock on steep slopes
    const t = Math.max(0, Math.min(1, (height - (waterLevel + 1.55)) / 10));
    c.set('#84a660').lerp(new THREE.Color('#4a7648'), t);
    if (slope > 0.16 && slope <= 0.34) {
      c.lerp(new THREE.Color('#7b7054'), Math.min(0.45, (slope - 0.16) * 2.2));
    }
    if (slope > 0.24) {
      c.lerp(new THREE.Color('#848a80'), Math.min(0.86, (slope - 0.24) * 2.3));
    }
    return c;
  }
  if (height < 23) {
    const t = Math.max(0, Math.min(1, (height - 11.5) / 11.5));
    c.set('#64765a').lerp(new THREE.Color('#8e958d'), t);
    if (slope > 0.26) {
      c.lerp(new THREE.Color('#6f7673'), Math.min(0.82, (slope - 0.26) * 2.1));
    }
    return c;
  }
  const snowT = Math.max(0, Math.min(1, (height - 23) / 13));
  c.set('#969f99').lerp(new THREE.Color('#eff5f8'), snowT);
  if (slope > 0.42) {
    c.lerp(new THREE.Color('#767e7e'), Math.min(0.55, (slope - 0.42) * 1.6));
  }
  return c;
}
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:980

```ts
export type SharedWorldTerrainBinding = {
  /** Sample the single authoritative world elevation at `(worldX, worldZ)`. */
  readonly sampleElevationWorld: (worldX: number, worldZ: number) => number;
  /** Map this map's local `(x, z)` into World Space `(worldX, worldZ)`. */
  readonly mapToWorld: (localX: number, localZ: number) => readonly [number, number];
  /** Group pivot's vertical scale factor and Y lift so local Y lands flush on the world terrain. */
  readonly verticalScale: number;
  readonly depthLiftY: number;
  readonly waterLevel: number;
};
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:991

```ts
export type BuildAtlasThreeSceneOptions = {
  readonly mapScale: AtlasMapScale;
  readonly look: AtlasThreeLook;
  readonly span: number;
  readonly presetId: AtlasGraphicsPresetId;
  readonly seed: string;
  readonly hideRoofs?: boolean;
  readonly warmWindows?: boolean;
  /**
   * Phase 1.3: When present (Multi-Map outdoor maps), this map renders ONLY overlays
   * (borders, roads, rivers, plazas, buildings, props) sampled onto the single shared
   * chunked world terrain — NEVER generating a second separate landmass terrain mesh.
   */
  readonly sharedWorldTerrain?: SharedWorldTerrainBinding;
  /** Local-space rects occupied by active child maps (keeps coarse parent scatter clear of settlements). */
  readonly exclusionRects?: ReadonlyArray<{
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  }>;
};
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:1014

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
  const aoDiscs: AtlasThreeAoDisc[] = [];
  const smokePoints: THREE.Vector3[] = [];
  const mistPoints: { position: THREE.Vector3; scale: number }[] = [];
  const doorInstances: { matrices: THREE.Matrix4[]; ids: string[] } = { matrices: [], ids: [] };
  const up = new THREE.Vector3(0, 1, 0);

  // Phase 1.3: When shared world terrain is active on outdoor Multi-Map maps, sample
  // directly from the ONE chunked world heightfield and NEVER build a per-map terrain mesh!
  const sharedTerrain = opts.look === 'outdoor' ? opts.sharedWorldTerrain ?? null : null;
  const syntheticRelief =
    !sharedTerrain && opts.look === 'outdoor' && !doc.heightfield && doc.layers.terrain !== false
      ? synthesizeWorldReliefHeightfield(doc, opts.seed)
      : null;
  const activeTerrainHf = sharedTerrain ? null : (doc.heightfield ?? syntheticRelief);
  const waterLevel = sharedTerrain
    ? sharedTerrain.waterLevel
    : activeTerrainHf
      ? activeTerrainHf.waterLevel
      : -0.52;
  const sampleGroundY = (x: number, z: number, fallback: number): number => {
    if (sharedTerrain) {
      const [wx, wz] = sharedTerrain.mapToWorld(x, z);
      const worldY = sharedTerrain.sampleElevationWorld(wx, wz);
      if (!Number.isFinite(worldY)) return fallback;
      const safeScale = Math.max(1e-4, sharedTerrain.verticalScale);
      return (worldY - sharedTerrain.depthLiftY) / safeScale;
    }
    if (!activeTerrainHf) return fallback;
    const sampled = sampleHeightfield(activeTerrainHf, x, z);
    if (sampled === null || !Number.isFinite(sampled)) return fallback;
    return syntheticRelief ? Math.max(0.2, sampled) : sampled > fallback ? sampled : fallback;
  };
  const terrainDrivenElevation = Boolean(sharedTerrain || syntheticRelief);

  // NOTE: Infinite ocean / infinite meadow / infinite dark cavern horizon surround is rendered
  // by AtlasThreeRuntime (camera-following 28k×28k plane + sky dome + FogExp2) so zero
  // rectangular edges ever appear when zooming out!

  const rooms = plan.primitives.filter(
    (q): q is Extract<AtlasProductGeometryPrimitive, { kind: 'area' | 'room' }> =>
      q.kind === 'area' || q.kind === 'room',
  );
  const dyR = Math.min(0.075, 0.3 / Math.max(1, rooms.length));
  const roomMaterial = new Map(doc.rooms.map((r) => [r.id, r.material] as const));
  rooms.forEach((rm, i) => {
    ids.add(rm.id);
    const matName = roomMaterial.get(rm.id);
    // Skip ocean backdrop polygons — handled seamlessly by the infinite camera-following surround.
    if (rm.id === 'g.ocean' || rm.id === 'w.ocean') {
      return;
    }
    // When shared chunked world terrain (or standalone suggestive relief) renders the ground,
    // skip landmass/biome polygons so zero stacked island slabs ever appear.
    // On settlement maps, preserve built architectural ground surfaces (`pflaster`, `holz`, `stein`)
    // such as paved plazas, timber docks/platforms, and stone courtyards!
    const isBuiltSettlementSurface =
      opts.mapScale === 'settlement' &&
      (matName === 'pflaster' || matName === 'holz' || matName === 'stein');
    const keepOverlaySurface = matName === 'pflaster' || isBuiltSettlementSurface;
    if (terrainDrivenElevation && !keepOverlaySurface) {
      return;
    }
    const cx = rm.points.reduce((a, p) => a + p[0], 0) / Math.max(1, rm.points.length);
    const cz = rm.points.reduce((a, p) => a + p[1], 0) / Math.max(1, rm.points.length);
    const y =
      terrainDrivenElevation && keepOverlaySurface
        ? sampleGroundY(cx, cz, 4.5) +
        (sharedTerrain
          ? (0.04 + i * 0.004) / Math.max(1e-4, sharedTerrain.verticalScale)
          : 0.38 + i * dyR)
        : -0.45 + i * dyR;
    const surface: AtlasThreeSurfaceKey | 'water' = atlasThreeFloorSurface(matName, opts.mapScale);
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

    // V7/V8 Dornhain touch: stone village fountain, glowing corner lanterns, striped market stall & fences on plazas!
    if (opts.mapScale === 'settlement' && matName === 'pflaster' && opts.presetId !== 'lite') {
      const minX = Math.min(...rm.points.map((p) => p[0]));
      const maxX = Math.max(...rm.points.map((p) => p[0]));
      const minZ = Math.min(...rm.points.map((p) => p[1]));
      const maxZ = Math.max(...rm.points.map((p) => p[1]));
      if (maxX - minX >= 100 && maxZ - minZ >= 80) {
        const fx = (minX + maxX) * 0.5;
        const fz = (minZ + maxZ) * 0.5;
        const rimGeo = new THREE.CylinderGeometry(12, 13.8, 5, 14);
        get('wall').geometry(rimGeo, composeMatrix(fx, y + 2.5, fz, 1, 1, 1), '__fountain');
        rimGeo.dispose();
        const spireGeo = new THREE.CylinderGeometry(2.3, 3.8, 11.5, 8);
        get('wall').geometry(spireGeo, composeMatrix(fx, y + 5.7, fz, 1, 1, 1), '__fountain');
        spireGeo.dispose();
        const capGeo = new THREE.CylinderGeometry(5.8, 2.5, 2.6, 12);
        get('wall').geometry(capGeo, composeMatrix(fx, y + 10.2, fz, 1, 1, 1), '__fountain');
        capGeo.dispose();
        const poolGeo = new THREE.CylinderGeometry(10.2, 10.2, 0.7, 14);
        water.geometry(poolGeo, composeMatrix(fx, y + 4.3, fz, 1, 1, 1), '__fountain-water');
        poolGeo.dispose();
        aoDiscs.push({ x: fx, y: y + 0.14, z: fz, radius: 19 });

        // Warm medieval wooden street lanterns at plaza corners (V7/V8 evening magic!)
        const lampCorners: readonly [number, number][] = [
          [minX + 12, minZ + 12],
          [maxX - 12, minZ + 12],
          [minX + 12, maxZ - 12],
          [maxX - 12, maxZ - 12],
        ];
        for (let lc = 0; lc < lampCorners.length; lc += 1) {
          const [lx, lz] = lampCorners[lc]!;
          get('wood-dark').geometry(UNIT_BOX, composeMatrix(lx, y + 11, lz, 2.6, 22, 2.6), '__streetlamp');
          get('iron-dark').geometry(UNIT_BOX, composeMatrix(lx + 2.2, y + 21, lz, 6, 1.4, 1.8), '__streetlamp');
          get('flame').geometry(UNIT_BOX, composeMatrix(lx + 4.2, y + 19, lz, 3.2, 4, 3.2), '__streetlamp');
          torches.push({
            id: `__streetlamp-${lc}`,
            position: new THREE.Vector3(lx + 4.2, y + 19.5, lz),
            radius: 68,
          });
        }

        // Festive crimson & oak market stall tucked near the northeast plaza edge
        const sx = maxX - 30;
        const sz = minZ + 22;
        get('wood').geometry(UNIT_BOX, composeMatrix(sx, y + 5.5, sz, 24, 11, 12), '__market-stall');
        for (const px of [-11, 11]) {
          for (const pz of [-5, 5]) {
            get('wood-dark').geometry(UNIT_BOX, composeMatrix(sx + px, y + 13, sz + pz, 2, 16, 2), '__market-stall');
          }
        }
        get('fabric-crimson').geometry(UNIT_BOX, composeMatrix(sx, y + 21.5, sz, 28, 2.6, 16), '__market-stall');
        aoDiscs.push({ x: sx, y: y + 0.14, z: sz, radius: 18 });
      }
    }

    // Dungeon-Alchemist Interior Dressing: transform bare wooden/stone rooms into rich cozy taverns!
    if (opts.mapScale === 'interior' && opts.presetId !== 'lite') {
      const minX = Math.min(...rm.points.map((p) => p[0]));
      const maxX = Math.max(...rm.points.map((p) => p[0]));
      const minZ = Math.min(...rm.points.map((p) => p[1]));
      const maxZ = Math.max(...rm.points.map((p) => p[1]));
      const rw = maxX - minX;
      const rh = maxZ - minZ;

      // 1) Main wooden tavern hall: grand stone fireplace, crimson hearth rug, oak benches, bookshelves, wall sconces & entrance double door!
      if (matName === 'holz' && rw >= 180 && rh >= 160) {
        // Grand stone hearth fireplace on the east-north wall
        const hx = maxX - 18;
        const hz = minZ + rh * 0.48;
        get('wall-indoor').geometry(UNIT_BOX, composeMatrix(hx + 6, y + 16, hz, 24, 32, 64), '__hearth');
        get('iron-dark').geometry(UNIT_BOX, composeMatrix(hx - 2, y + 9, hz, 12, 17, 36), '__hearth');
        get('wood-dark').geometry(UNIT_BOX, composeMatrix(hx - 2, y + 21, hz, 18, 4, 72), '__hearth');
        get('wood-dark').geometry(UNIT_BOX, composeMatrix(hx - 4, y + 3, hz, 8, 5, 22), '__hearth-logs');
        get('flame').geometry(UNIT_BOX, composeMatrix(hx - 4, y + 8, hz, 7, 10, 20), '__hearth-fire');
        // Mantlepiece candles
        for (const mz of [-22, 22]) {
          get('gold-accent').geometry(UNIT_BOX, composeMatrix(hx - 4, y + 24, hz + mz, 3.5, 2, 3.5), '__hearth');
          get('plaster').geometry(UNIT_BOX, composeMatrix(hx - 4, y + 27.5, hz + mz, 2.2, 6, 2.2), '__hearth');
          get('flame').geometry(UNIT_BOX, composeMatrix(hx - 4, y + 31.5, hz + mz, 2.4, 3, 2.4), '__hearth');
        }
        torches.push({
          id: '__hearth-light',
          position: new THREE.Vector3(hx - 14, y + 18, hz),
          radius: 290,
        });

        // Cozy woven crimson-gold hearth rug in front of fireplace + central hall runner
        get('fabric-crimson').geometry(
          UNIT_BOX,
          composeMatrix(hx - 54, y + 0.7, hz, 64, 1.2, 92),
          '__tavern-rug',
        );
        get('fabric-crimson').geometry(
          UNIT_BOX,
          composeMatrix(minX + rw * 0.44, y + 0.65, maxZ - 64, 118, 1.1, 46),
          '__tavern-runner',
        );

        // Second cozy tavern booth (oak trestle table + dual wooden benches + glowing candle) in southeast corner
        const bx = maxX - 88;
        const bz = maxZ - 68;
        const boothClear = !doc.objects.some((o) => Math.hypot(o.x - bx, o.y - bz) < 75);
        if (boothClear) {
          get('wood').geometry(UNIT_BOX, composeMatrix(bx, y + 18, bz, 62, 4.5, 34), '__booth');
          get('wood-dark').geometry(UNIT_BOX, composeMatrix(bx - 22, y + 9, bz, 5, 18, 28), '__booth');
          get('wood-dark').geometry(UNIT_BOX, composeMatrix(bx + 22, y + 9, bz, 5, 18, 28), '__booth');
          get('wood').geometry(UNIT_BOX, composeMatrix(bx, y + 10.5, bz - 28, 56, 3.5, 12), '__booth');
          get('wood').geometry(UNIT_BOX, composeMatrix(bx, y + 10.5, bz + 28, 56, 3.5, 12), '__booth');
          get('gold-accent').geometry(UNIT_BOX, composeMatrix(bx + 12, y + 22.5, bz + 4, 4, 5, 4), '__booth');
          get('plaster').geometry(UNIT_BOX, composeMatrix(bx - 4, y + 23.5, bz, 2.4, 7, 2.4), '__booth');
          get('flame').geometry(UNIT_BOX, composeMatrix(bx - 4, y + 28, bz, 2.8, 3.4, 2.8), '__booth');
          torches.push({
            id: '__booth-candle',
            position: new THREE.Vector3(bx - 4, y + 30, bz),
            radius: 175,
          });
          aoDiscs.push({ x: bx, y: y + 0.14, z: bz, radius: 46 });
        }

        // Tall oak wall bookshelf / trophy cabinet along the north wall (east of bar)
        const sx = maxX - 96;
        const sz = minZ + 14;
        get('wood-dark').geometry(UNIT_BOX, composeMatrix(sx, y + 15, sz, 66, 30, 14), '__shelf');
        get('wood').geometry(UNIT_BOX, composeMatrix(sx, y + 8, sz + 3, 58, 2, 10), '__shelf');
        get('wood').geometry(UNIT_BOX, composeMatrix(sx, y + 17, sz + 3, 58, 2, 10), '__shelf');
        get('bottle-emerald').geometry(UNIT_BOX, composeMatrix(sx - 18, y + 12.5, sz + 3, 4.5, 8, 4.5), '__shelf');
        get('fabric-crimson').geometry(UNIT_BOX, composeMatrix(sx + 4, y + 12.5, sz + 3, 14, 7.5, 8), '__shelf');
        get('gold-accent').geometry(UNIT_BOX, composeMatrix(sx + 20, y + 21, sz + 3, 5, 6, 5), '__shelf');

        // Heavy carved oak tavern double entrance doors on south wall
        const dxDoor = minX + rw * 0.44;
        get('wood-dark').geometry(UNIT_BOX, composeMatrix(dxDoor, y + 13, maxZ - 3, 52, 26, 11), '__tavern-door');
        get('iron-dark').geometry(UNIT_BOX, composeMatrix(dxDoor, y + 8, maxZ - 8.5, 48, 2.2, 1.2), '__tavern-door');
        get('iron-dark').geometry(UNIT_BOX, composeMatrix(dxDoor, y + 19, maxZ - 8.5, 48, 2.2, 1.2), '__tavern-door');
        get('gold-accent').geometry(UNIT_BOX, composeMatrix(dxDoor - 4, y + 13, maxZ - 9, 2.4, 2.4, 2.4), '__tavern-door');
        get('gold-accent').geometry(UNIT_BOX, composeMatrix(dxDoor + 4, y + 13, maxZ - 9, 2.4, 2.4, 2.4), '__tavern-door');

        // Warm wrought-iron wall sconces around perimeter for rich golden-amber ambiance
        const sconces: readonly [number, number][] = [
          [minX + 12, minZ + rh * 0.52],
          [minX + 12, maxZ - 48],
          [minX + rw * 0.55, minZ + 12],
          [maxX - 48, maxZ - 12],
        ];
        for (let sc = 0; sc < sconces.length; sc += 1) {
          const [scx, scz] = sconces[sc]!;
          get('iron-dark').geometry(UNIT_BOX, composeMatrix(scx, y + 17, scz, 4, 8, 4), '__sconce');
          get('flame').geometry(UNIT_BOX, composeMatrix(scx, y + 22, scz, 3.6, 4.5, 3.6), '__sconce');
          torches.push({
            id: `__sconce-${sc}`,
            position: new THREE.Vector3(scx, y + 24, scz),
            radius: 195,
          });
        }
      }

      // 2) Tavern stone bar corner (e.g. `g.tav.bar`): carved L-shaped oak counter, tap kegs, bottle shelf & barstools!
      if (matName === 'stein' && rw >= 80 && rw <= 200 && rh >= 50 && rh <= 130) {
        const hasWoodHall = doc.rooms.some((r) => r.material === 'holz' && r.w >= 180);
        if (hasWoodHall) {
          // Main front bar counter along south edge + return along east edge
          get('wood-dark').geometry(UNIT_BOX, composeMatrix(minX + rw * 0.5, y + 10, maxZ - 6, rw - 8, 20, 14), '__bar-counter');
          get('wood').geometry(UNIT_BOX, composeMatrix(minX + rw * 0.5, y + 20.8, maxZ - 6, rw - 2, 3, 18), '__bar-counter');
          get('gold-accent').geometry(UNIT_BOX, composeMatrix(minX + rw * 0.5, y + 3.5, maxZ + 3, rw - 10, 1.8, 1.8), '__bar-counter');
          get('wood-dark').geometry(UNIT_BOX, composeMatrix(maxX - 6, y + 10, minZ + rh * 0.5, 14, 20, rh - 10), '__bar-counter');
          get('wood').geometry(UNIT_BOX, composeMatrix(maxX - 6, y + 20.8, minZ + rh * 0.5, 18, 3, rh - 4), '__bar-counter');

          // 3 brass-tapped ale kegs + emerald bottles along the back bar
          for (let k = 0; k < 3; k += 1) {
            const kx = minX + 26 + k * 34;
            const kz = minZ + 18;
            const kegGeo = new THREE.CylinderGeometry(8.5, 9, 18, 10);
            get('wood').geometry(kegGeo, composeMatrix(kx, y + 11, kz, 1, 1, 1), '__bar-keg');
            kegGeo.dispose();
            const hoopGeo = new THREE.CylinderGeometry(9.4, 9.4, 2, 10);
            get('iron-dark').geometry(hoopGeo, composeMatrix(kx, y + 16, kz, 1, 1, 1), '__bar-keg');
            hoopGeo.dispose();
            get('bottle-emerald').geometry(UNIT_BOX, composeMatrix(kx + 14, y + 25.5, maxZ - 6, 3.2, 8.5, 3.2), '__bar-bottle');
          }
          // 3 carved oak barstools along the front of the bar
          for (let s = 0; s < 3; s += 1) {
            const stx = minX + 28 + s * 38;
            const stz = maxZ + 18;
            const seatGeo = new THREE.CylinderGeometry(8, 8, 2.5, 10);
            get('wood').geometry(seatGeo, composeMatrix(stx, y + 14, stz, 1, 1, 1), '__barstool');
            seatGeo.dispose();
            const legGeo = new THREE.CylinderGeometry(2.4, 4.5, 13, 6);
            get('wood-dark').geometry(legGeo, composeMatrix(stx, y + 7, stz, 1, 1, 1), '__barstool');
            legGeo.dispose();
            aoDiscs.push({ x: stx, y: y + 0.14, z: stz, radius: 11 });
          }
          // Warm bar lantern
          get('gold-accent').geometry(UNIT_BOX, composeMatrix(maxX - 8, y + 25, maxZ - 6, 5, 6, 5), '__bar-lamp');
          get('flame').geometry(UNIT_BOX, composeMatrix(maxX - 8, y + 29, maxZ - 6, 3.5, 4, 3.5), '__bar-lamp');
          torches.push({
            id: '__bar-lantern',
            position: new THREE.Vector3(maxX - 8, y + 31, maxZ - 6),
            radius: 210,
          });
        }
      }
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
      const isSharedMacroStroke = Boolean(sharedTerrain && opts.mapScale === 'world');
      const effectiveWidth = isSharedMacroStroke
        ? Math.min(pt.width, surface === 'water' ? 3.2 : 4.8)
        : pt.width;
      const lift = 0.55 + i * dyS;
      buildRibbon(
        surface === 'water' ? water : get(surface),
        pt.points,
        effectiveWidth,
        -0.14 + i * dyS,
        pt.id,
        terrainDrivenElevation
          ? (rx, rz) =>
            sampleGroundY(rx, rz, 4.5) +
            (sharedTerrain ? (0.18 + i * 0.015) / Math.max(1e-4, sharedTerrain.verticalScale) : lift)
          : undefined,
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

    // Architectural interior detailing: oak wainscoting baseboard, beveled capstone & corner timber pilasters!
    if (opts.mapScale === 'interior' && opts.presetId !== 'lite') {
      const capKey: AtlasThreeSurfaceKey = doc.rooms.some((r) => r.material === 'holz') ? 'wood-dark' : 'rock';
      wallBox(get(capKey), q.start, q.end, thick * 1.24, -0.42 + wallH, 1.8, '__wall-cap');
      wallBox(get(capKey), q.start, q.end, thick * 1.22, -0.42, 4.2, '__wall-base');
      const postCount = Math.max(2, Math.round(length / 95) + 1);
      for (let pi = 0; pi < postCount; pi += 1) {
        const [px, pz] = pt(pi / Math.max(1, postCount - 1));
        get(capKey).geometry(
          UNIT_BOX,
          composeMatrix(px, -0.42 + wallH * 0.5, pz, thick * 1.45, wallH + 2.4, thick * 1.45),
          '__wall-pilaster',
        );
      }
    }
  }

  const objAngles = new Map(doc.objects.map((o) => [o.id, o.angle ?? 0] as const));
  const fullDetail = opts.presetId === 'high' || opts.span < 380;
  const showCanonicalObjects =
    opts.mapScale === 'world' ? doc.layers.terrain !== false : doc.layers.objects !== false;
  if (showCanonicalObjects) {
    for (const q of plan.primitives) {
      if (q.kind !== 'prop' && q.kind !== 'building_footprint') continue;
      if (sharedTerrain && opts.mapScale === 'world') {
        const [wx, wz] = sharedTerrain.mapToWorld(q.x, q.y);
        const worldElev = sharedTerrain.sampleElevationWorld(wx, wz);
        // Prevent legacy world-overview landmarks from floating in open deep ocean
        if (worldElev < sharedTerrain.waterLevel - 0.6) continue;
      }
      ids.add(q.id);
      const groundElevation = sampleGroundY(q.x, q.y, -0.35);
      if (sharedTerrain && opts.mapScale === 'world') {
        emitMacroLandmarkMarker(get, q, { groundElevation });
      } else {
        emitCanonicalProp(get, q, objAngles.get(q.id) ?? 0, torches, aoDiscs, smokePoints, mistPoints, {
          fullDetail,
          hideRoofs: Boolean(opts.hideRoofs),
          warmWindows: Boolean(opts.warmWindows),
          groundElevation,
        });
      }
    }
  }

  const terrain =
    !sharedTerrain && doc.layers.terrain !== false && activeTerrainHf
      ? buildBlendedTerrain(activeTerrainHf, opts.span)
      : null;

  // Suggestive scenery scatter (ATL3-D01 #1327) grouped by kind for InstancedMesh rendering.
  // On macro world/continent/country maps in continuous Shared World Space, skip giant macro
  // scatter trees/mountains completely so real 4-WE settlements never sit beside 40-WE macro props.
  const scatter =
    sharedTerrain && opts.mapScale === 'world'
      ? { format: 'atl3-d01-scatter-plan-v1' as const, seed: opts.seed, presetId: opts.presetId, maxBudget: 0, instances: [] }
      : buildAtlasSceneScatter({
          doc,
          seed: opts.seed,
          mapScale: opts.mapScale,
          presetId: opts.presetId,
          elevationSampler:
            sharedTerrain || activeTerrainHf ? (x, y) => sampleGroundY(x, y, 0) : undefined,
          exclusionRects: opts.exclusionRects,
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
    if (inst.kind === 'oak' || inst.kind === 'birch' || inst.kind === 'pine' || inst.kind === 'mountain') {
      aoDiscs.push({
        x: inst.x,
        y: inst.elevation + 0.14,
        z: inst.y,
        radius: inst.kind === 'mountain' ? inst.scale * 46 : inst.scale * 24,
      });
    }
    if (inst.kind === 'mountain' && mistPoints.length < 18) {
      mistPoints.push({
        position: new THREE.Vector3(inst.x, inst.elevation + inst.scale * 36, inst.y),
        scale: inst.scale * 72,
      });
    }
  }
  const scatterBatches: AtlasThreeScatterBatch[] = [];
  for (const [kind, matrices] of scatterByKind) {
    if (matrices.length > 0) scatterBatches.push({ kind, matrices });
  }

  // Compute exact content bounding box so every map (e.g. Taverne at 200..600) frames dead-center!
  let minCX = Infinity;
  let maxCX = -Infinity;
  let minCZ = Infinity;
  let maxCZ = -Infinity;
  for (const r of doc.rooms) {
    if (r.id === 'w.ocean' || r.id === 'g.ocean') continue;
    const pts = r.points && r.points.length >= 3
      ? r.points
      : [
        [r.x, r.y],
        [r.x + r.w, r.y + r.h],
      ];
    for (const [px, pz] of pts) {
      if (px < minCX) minCX = px;
      if (px > maxCX) maxCX = px;
      if (pz < minCZ) minCZ = pz;
      if (pz > maxCZ) maxCZ = pz;
    }
  }
  for (const o of doc.objects) {
    if (o.x < minCX) minCX = o.x;
    if (o.x > maxCX) maxCX = o.x;
    if (o.y < minCZ) minCZ = o.y;
    if (o.y > maxCZ) maxCZ = o.y;
  }
  const hasBounds = Number.isFinite(minCX) && Number.isFinite(maxCX) && maxCX > minCX;
  const contentBounds: AtlasThreeContentBounds = hasBounds
    ? {
      centerX: (minCX + maxCX) * 0.5,
      centerZ: (minCZ + maxCZ) * 0.5,
      fitSpan:
        opts.mapScale === 'world'
          ? Math.max(360, Math.min(500, Math.max(maxCX - minCX, maxCZ - minCZ) * 0.54))
          : opts.mapScale === 'settlement'
            ? Math.max(175, Math.min(280, Math.max(maxCX - minCX, maxCZ - minCZ) * 0.58))
            : Math.max(210, Math.min(340, Math.max(maxCX - minCX, maxCZ - minCZ) * 0.74)),
    }
    : {
      centerX: 500,
      centerZ: 500,
      fitSpan: opts.mapScale === 'world' ? 430 : 210,
    };

  return {
    builders,
    water,
    terrain,
    waterLevel,
    contentBounds,
    doorInstances,
    scatterBatches,
    aoDiscs,
    smokePoints,
    mistPoints,
    torches,
    ids,
    look: opts.look,
    mapScale: opts.mapScale,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-three-scene.ts:1569

```ts
export function buildAtlasScatterGeometry(kind: AtlasScatterKind): {
  readonly parts: readonly { readonly geo: THREE.BufferGeometry; readonly surface: AtlasThreeSurfaceKey }[];
} {
  switch (kind) {
    case 'pine': {
      const trunk = new THREE.CylinderGeometry(2.2, 4.6, 17, 6);
      trunk.translate(0, 8.5, 0);
      const c1 = new THREE.ConeGeometry(23, 28, 8);
      c1.scale(1.08, 1, 0.94);
      c1.translate(0, 22, 0);
      const c2 = new THREE.ConeGeometry(18.5, 26, 8);
      c2.rotateY(0.42);
      c2.translate(0.8, 36, -0.6);
      const c3 = new THREE.ConeGeometry(13.5, 22, 7);
      c3.rotateY(0.85);
      c3.translate(-0.6, 49, 0.5);
      const c4 = new THREE.ConeGeometry(7.8, 16, 6);
      c4.translate(0, 59, 0);
      return {
        parts: [
          { geo: trunk, surface: 'wood-dark' },
          { geo: c1, surface: 'leaf-pine' },
          { geo: c2, surface: 'leaf-pine' },
          { geo: c3, surface: 'leaf' },
          { geo: c4, surface: 'leaf-sun' },
        ],
      };
    }
    case 'birch': {
      const trunk = new THREE.CylinderGeometry(2.0, 3.8, 21, 6);
      trunk.translate(0, 10.5, 0);
      const c1 = new THREE.DodecahedronGeometry(16.5, 1);
      c1.scale(1.12, 0.95, 1.04);
      c1.translate(0, 28, 0);
      const c2 = new THREE.DodecahedronGeometry(13, 1);
      c2.translate(8, 34, 4);
      const c3 = new THREE.DodecahedronGeometry(11, 1);
      c3.translate(-7, 35, -5);
      return {
        parts: [
          { geo: trunk, surface: 'bark-birch' },
          { geo: c1, surface: 'leaf-birch' },
          { geo: c2, surface: 'leaf-sun' },
          { geo: c3, surface: 'leaf-birch' },
        ],
      };
    }
    case 'oak': {
      const trunk = new THREE.CylinderGeometry(3.4, 5.8, 18, 7);
      trunk.translate(0, 9, 0);
      const base = new THREE.DodecahedronGeometry(19, 1);
      base.scale(1.16, 0.88, 1.08);
      base.translate(0, 27, 0);
      const sideA = new THREE.DodecahedronGeometry(13.5, 1);
      sideA.translate(-11, 29, 7);
      const sideB = new THREE.DodecahedronGeometry(12.5, 1);
      sideB.translate(10, 28, -8);
      const top = new THREE.DodecahedronGeometry(14.5, 1);
      top.translate(4, 37, -2);
      return {
        parts: [
          { geo: trunk, surface: 'wood-dark' },
          { geo: base, surface: 'leaf' },
          { geo: sideA, surface: 'leaf' },
          { geo: sideB, surface: 'leaf' },
          { geo: top, surface: 'leaf-sun' },
        ],
      };
    }
    case 'bush': {
      const g = new THREE.DodecahedronGeometry(11, 1);
      g.scale(1.28, 0.72, 1.12);
      g.translate(0, 6, 0);
      return { parts: [{ geo: g, surface: 'leaf-sun' }] };
    }
    case 'flower': {
      const g = new THREE.DodecahedronGeometry(5.5, 0);
      g.scale(1.3, 0.48, 1.3);
      g.translate(0, 2.4, 0);
      return { parts: [{ geo: g, surface: 'flower' }] };
    }
    case 'mountain': {
      const base = new THREE.ConeGeometry(46, 78, 7);
      base.scale(1.22, 1, 0.92);
      base.translate(0, 35, 0);
      const shoulder = new THREE.ConeGeometry(31, 56, 6);
      shoulder.rotateY(0.5);
      shoulder.translate(23, 24, -14);
      const ridge = new THREE.ConeGeometry(25, 44, 6);
      ridge.rotateY(-0.4);
      ridge.translate(-20, 19, 13);
      const capMain = new THREE.ConeGeometry(16, 30, 7);
      capMain.scale(1.18, 1, 0.9);
      capMain.translate(0, 61, 0);
      const capSub = new THREE.ConeGeometry(10.5, 19, 6);
      capSub.translate(23, 44, -14);
      return {
        parts: [
          { geo: base, surface: 'rock' },
          { geo: shoulder, surface: 'rock' },
          { geo: ridge, surface: 'rock' },
          { geo: capMain, surface: 'snow' },
          { geo: capSub, surface: 'snow' },
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
```

### src/infrastructure/world/atlas-three/atlas-three-world-terrain.ts:35

```ts
export type AtlasThreeWorldTerrainStats = {
  readonly enabled: boolean;
  readonly revisionKey: string | null;
  readonly chunkCount: number;
  readonly maxActiveLod: number;
  readonly coarseBaseCount: number;
  readonly totalTriangles: number;
  readonly liveGeometryCount: number;
  readonly incrementalSyncCount: number;
  readonly chunks: readonly AtlasTerrainChunkDescriptor[];
};
```

### src/infrastructure/world/atlas-three/atlas-three-world-terrain.ts:54

```ts
export function buildTerrainChunkGeometry(
  source: AtlasWorldHeightfieldSource,
  descriptor: AtlasTerrainChunkDescriptor,
): { readonly geometry: THREE.BufferGeometry; readonly triangleCount: number } {
  const { resolution: res, heights } = sampleWorldChunkHeightGrid(source, descriptor);
  const stride = res + 1;
  const { minX, minZ, maxX, maxZ } = descriptor.boundsWorld;
  const stepX = (maxX - minX) / res;
  const stepZ = (maxZ - minZ) / res;
  // Subtle monotonic lift by LOD level so finer chunks always win depth over L0 coarse base
  // without burying fine settlement architecture (~0.18 wu tall at Dornhain scale).
  const lodLift = descriptor.lodLevel * TERRAIN_LOD_LIFT_STEP;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];

  const hAt = (c: number, r: number): number => {
    if (c >= 0 && c <= res && r >= 0 && r <= res) {
      return heights[r * stride + c] ?? 0;
    }
    return sampleWorldHeight(source, minX + c * stepX, minZ + r * stepZ);
  };

  for (let r = 0; r <= res; r += 1) {
    const wz = minZ + r * stepZ;
    for (let c = 0; c <= res; c += 1) {
      const wx = minX + c * stepX;
      const elev = hAt(c, r);
      const hL = hAt(c - 1, r);
      const hR = hAt(c + 1, r);
      const hU = hAt(c, r - 1);
      const hD = hAt(c, r + 1);
      // Continuous cross-chunk analytical normal (eliminates chunk border seams & skirt normal bleed!)
      const nx = hL - hR;
      const ny = Math.max(0.25, stepX + stepZ);
      const nz = hU - hD;
      const nLen = Math.hypot(nx, ny, nz) || 1;
      const slope = Math.hypot(nx, nz) / ny;
      const col = terrainColorAt(elev, source.waterLevel, slope);
      positions.push(wx, elev + lodLift, wz);
      normals.push(nx / nLen, ny / nLen, nz / nLen);
      uvs.push(wx / 72, wz / 72);
      colors.push(col.r, col.g, col.b);
    }
  }

  const index: number[] = [];
  for (let r = 0; r < res; r += 1) {
    for (let c = 0; c < res; c += 1) {
      const i00 = r * stride + c;
      const i10 = r * stride + c + 1;
      const i01 = (r + 1) * stride + c;
      const i11 = (r + 1) * stride + c + 1;
      index.push(i00, i11, i10, i00, i01, i11);
    }
  }

  // Append downward skirts along all 4 chunk borders using copied surface normals
  // so skirts hide T-junction cracks without bleeding vertical normals into chunk edges!
  const appendSkirtEdge = (edgeIndices: readonly number[]) => {
    const baseStart = positions.length / 3;
    for (let k = 0; k < edgeIndices.length; k += 1) {
      const srcIdx = edgeIndices[k]!;
      const p3 = srcIdx * 3;
      const p2 = srcIdx * 2;
      positions.push(positions[p3]!, positions[p3 + 1]! - SKIRT_DROP, positions[p3 + 2]!);
      normals.push(normals[p3]!, normals[p3 + 1]!, normals[p3 + 2]!);
      uvs.push(uvs[p2]!, uvs[p2 + 1]!);
      colors.push(colors[p3]! * 0.94, colors[p3 + 1]! * 0.94, colors[p3 + 2]! * 0.94);
    }
    for (let k = 0; k + 1 < edgeIndices.length; k += 1) {
      const top0 = edgeIndices[k]!;
      const top1 = edgeIndices[k + 1]!;
      const bot0 = baseStart + k;
      const bot1 = baseStart + k + 1;
      index.push(top0, bot1, top1, top0, bot0, bot1);
    }
  };

  if (descriptor.lodLevel > 0) {
    const north: number[] = [];
    const south: number[] = [];
    const west: number[] = [];
    const east: number[] = [];
    for (let i = 0; i <= res; i += 1) {
      north.push(i);
      south.push(res * stride + (res - i));
      west.push((res - i) * stride);
      east.push(i * stride + res);
    }
    appendSkirtEdge(north);
    appendSkirtEdge(south);
    appendSkirtEdge(west);
    appendSkirtEdge(east);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return { geometry, triangleCount: index.length / 3 };
}
```

### src/infrastructure/world/atlas-three/atlas-three-world-terrain.ts:172

```ts
export function enhanceWorldTerrainMaterial(base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const mat = base.clone();
  mat.vertexColors = true;
  mat.roughness = 0.92;
  mat.metalness = 0.0;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vAtlasWorldPos;
varying vec3 vAtlasWorldNormal;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vec4 atlasWp = modelMatrix * vec4(transformed, 1.0);
vAtlasWorldPos = atlasWp.xyz;
vAtlasWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vAtlasWorldPos;
varying vec3 vAtlasWorldNormal;
float atlasHash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float atlasVNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(atlasHash2(i), atlasHash2(i + vec2(1.0, 0.0)), u.x),
    mix(atlasHash2(i + vec2(0.0, 1.0)), atlasHash2(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 wp = vAtlasWorldPos.xz;
  float wy = vAtlasWorldPos.y;
  float slopeAmt = 1.0 - clamp(vAtlasWorldNormal.y, 0.0, 1.0);

  // Tri-scale world-space procedural variation: macro biome (90 wu), mid meadow (11 wu), micro blade/pebble (0.8 wu)
  float macro = atlasVNoise(wp * 0.011 + vec2(3.7, -2.1)) * 0.62 + atlasVNoise(wp * 0.029) * 0.38;
  float mid = atlasVNoise(wp * 0.095 + vec2(-5.2, 8.4)) * 0.6 + atlasVNoise(wp * 0.24) * 0.4;
  float micro = atlasVNoise(wp * 1.15) * 0.55 + atlasVNoise(wp * 2.85 + vec2(1.9, 4.3)) * 0.45;

  // Warm sunlit meadow vs rich forest soil variation (breaks flat green plastic look at ALL spans)
  vec3 warmEarth = vec3(0.56, 0.49, 0.34);
  vec3 sunGrass = vec3(0.60, 0.72, 0.38);
  vec3 cliffRock = vec3(0.47, 0.49, 0.46);
  vec3 wetSand = vec3(0.58, 0.55, 0.41);

  float earthPatch = smoothstep(0.54, 0.84, macro) * smoothstep(1.2, 4.0, wy) * (1.0 - smoothstep(10.0, 18.0, wy));
  diffuseColor.rgb = mix(diffuseColor.rgb, warmEarth, earthPatch * 0.28);
  diffuseColor.rgb = mix(diffuseColor.rgb, sunGrass, smoothstep(0.42, 0.78, mid) * 0.16 * (1.0 - slopeAmt));

  // Steep slope rock strata blending (only on real cliffs/ridges, never gentle rolling meadows)
  float rockMask = smoothstep(0.18, 0.44, slopeAmt);
  float strata = 0.88 + 0.20 * sin(wy * 2.6 + macro * 6.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, cliffRock * strata, rockMask * 0.65);

  // Coastal damp-sand & shoreline darkening near water level
  float coastBand = 1.0 - smoothstep(0.0, 1.8, abs(wy - 0.15));
  diffuseColor.rgb = mix(diffuseColor.rgb, wetSand, coastBand * 0.32);

  // Multi-scale crisp luminance grain (stays readable from planet zoom down to tavern close-up!)
  float grain = (macro - 0.5) * 0.14 + (mid - 0.5) * 0.14 + (micro - 0.5) * 0.16;
  diffuseColor.rgb *= clamp(1.0 + grain, 0.74, 1.24);
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
{
  float wyR = vAtlasWorldPos.y;
  float wetShore = 1.0 - smoothstep(-0.2, 0.85, wyR);
  roughnessFactor = mix(roughnessFactor, 0.42, wetShore * 0.55);
}`,
      );
  };
  mat.customProgramCacheKey = () => 'atlas-world-terrain-triscale-v1';
  mat.needsUpdate = true;
  return mat;
}
```

### src/infrastructure/world/atlas-three/atlas-three-world-terrain.ts:265

```ts
export class AtlasThreeWorldTerrain {
  readonly rootGroup = new THREE.Group();
  private readonly chunks = new Map<string, TerrainChunkNode>();
  private source: AtlasWorldHeightfieldSource | null = null;
  private lastPlan: AtlasWorldTerrainChunkPlan | null = null;
  private incrementalSyncCount = 0;
  private enhancedMaterial: THREE.MeshStandardMaterial | null = null;
  private heightTex: THREE.DataTexture | null = null;
  private heightTexRevision = '';

  constructor(private readonly getTerrainMaterial: () => THREE.Material) {
    this.rootGroup.name = 'atlas3:shared-world-terrain';
  }

  setSource(source: AtlasWorldHeightfieldSource | null): void {
    if (this.source?.revisionKey === source?.revisionKey && Boolean(this.source) === Boolean(source)) {
      return;
    }
    this.source = source;
    if (!source) {
      this.dispose();
    } else {
      this.rebuildHeightTexture(source);
    }
  }

  getSource(): AtlasWorldHeightfieldSource | null {
    return this.source;
  }

  /** Lightweight 128×128 normalized heightfield bathymetry texture for organic shoreline water shading. */
  getHeightFieldTexture(): {
    readonly texture: THREE.DataTexture | null;
    readonly minH: number;
    readonly maxH: number;
    readonly waterLevel: number;
  } {
    return {
      texture: this.heightTex,
      minH: HEIGHT_TEX_MIN,
      maxH: HEIGHT_TEX_MAX,
      waterLevel: this.source?.waterLevel ?? 0,
    };
  }

  private rebuildHeightTexture(source: AtlasWorldHeightfieldSource): void {
    if (this.heightTex && this.heightTexRevision === source.revisionKey) return;
    if (this.heightTex) {
      this.heightTex.dispose();
      this.heightTex = null;
    }
    const data = new Uint8Array(HEIGHT_TEX_RES * HEIGHT_TEX_RES * 4);
    const invRange = 1 / (HEIGHT_TEX_MAX - HEIGHT_TEX_MIN);
    for (let r = 0; r < HEIGHT_TEX_RES; r += 1) {
      const wz = ((r + 0.5) / HEIGHT_TEX_RES) * 1000;
      for (let c = 0; c < HEIGHT_TEX_RES; c += 1) {
        const wx = ((c + 0.5) / HEIGHT_TEX_RES) * 1000;
        const h = sampleWorldHeight(source, wx, wz);
        const norm = Math.max(0, Math.min(1, (h - HEIGHT_TEX_MIN) * invRange));
        const byte = Math.round(norm * 255);
        const off = (r * HEIGHT_TEX_RES + c) * 4;
        data[off] = byte;
        data[off + 1] = byte;
        data[off + 2] = byte;
        data[off + 3] = 255;
      }
    }
    const tex = new THREE.DataTexture(data, HEIGHT_TEX_RES, HEIGHT_TEX_RES, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.flipY = false;
    tex.needsUpdate = true;
    this.heightTex = tex;
    this.heightTexRevision = source.revisionKey;
  }

  private resolveChunkMaterial(): THREE.Material {
    if (this.enhancedMaterial) return this.enhancedMaterial;
    const base = this.getTerrainMaterial();
    if (base instanceof THREE.MeshStandardMaterial) {
      this.enhancedMaterial = enhanceWorldTerrainMaterial(base);
      return this.enhancedMaterial;
    }
    return base;
  }

  /** Mounted terrain chunk meshes for accurate 3D raycast picking under cursor (Phase A). */
  getChunkMeshes(): readonly THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const node of this.chunks.values()) {
      out.push(node.mesh);
    }
    return out;
  }

  sampleElevation(worldX: number, worldZ: number): number {
    if (!this.source) return 0;
    return sampleWorldHeight(this.source, worldX, worldZ) + ATLAS_TERRAIN_CHUNK_MAX_LOD * TERRAIN_LOD_LIFT_STEP;
  }

  sync(input: {
    readonly camera: AtlasWorldCameraState;
    readonly viewportPx: { readonly width: number; readonly height: number };
    readonly config?: Partial<AtlasWorldTerrainChunkPlanConfig>;
  }): AtlasWorldTerrainChunkPlan | null {
    if (!this.source) return null;
    this.incrementalSyncCount += 1;
    const plan = planWorldTerrainChunks({
      source: this.source,
      camera: input.camera,
      viewportPx: input.viewportPx,
      config: input.config,
    });
    this.lastPlan = plan;

    const wantedIds = new Set(plan.chunks.map((c) => c.chunkId));
    for (const [id, node] of [...this.chunks.entries()]) {
      if (!wantedIds.has(id) || node.revisionKey !== this.source.revisionKey) {
        this.disposeChunkNode(node);
        this.chunks.delete(id);
      }
    }

    const material = this.resolveChunkMaterial();
    for (const desc of plan.chunks) {
      const existing = this.chunks.get(desc.chunkId);
      if (existing && existing.descriptor.resolution === desc.resolution) {
        continue;
      }
      if (existing) {
        this.disposeChunkNode(existing);
        this.chunks.delete(desc.chunkId);
      }
      const { geometry, triangleCount } = buildTerrainChunkGeometry(this.source, desc);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = desc.lodLevel >= 1;
      mesh.receiveShadow = true;
      mesh.name = `atlas3:terrain-chunk:${desc.chunkId}`;
      mesh.userData.chunkId = desc.chunkId;
      mesh.userData.lodLevel = desc.lodLevel;
      mesh.renderOrder = desc.isCoarseBase && desc.lodLevel === 0 ? 0 : 1;
      this.rootGroup.add(mesh);
      this.chunks.set(desc.chunkId, {
        chunkId: desc.chunkId,
        revisionKey: this.source.revisionKey,
        descriptor: desc,
        mesh,
        geometry,
        triangleCount,
      });
    }

    return plan;
  }

  getStats(): AtlasThreeWorldTerrainStats {
    let totalTriangles = 0;
    for (const node of this.chunks.values()) {
      totalTriangles += node.triangleCount;
    }
    return {
      enabled: Boolean(this.source),
      revisionKey: this.source?.revisionKey ?? null,
      chunkCount: this.chunks.size,
      maxActiveLod: this.lastPlan?.maxActiveLod ?? 0,
      coarseBaseCount: this.lastPlan?.coarseBaseCount ?? 0,
      totalTriangles,
      liveGeometryCount: this.chunks.size,
      incrementalSyncCount: this.incrementalSyncCount,
      chunks: this.lastPlan?.chunks ?? [],
    };
  }

  dispose(): void {
    for (const node of this.chunks.values()) {
      this.disposeChunkNode(node);
    }
    this.chunks.clear();
    if (this.heightTex) {
      this.heightTex.dispose();
      this.heightTex = null;
      this.heightTexRevision = '';
    }
    if (this.enhancedMaterial) {
      this.enhancedMaterial.dispose();
      this.enhancedMaterial = null;
    }
    this.lastPlan = null;
  }

  private disposeChunkNode(node: TerrainChunkNode): void {
    this.rootGroup.remove(node.mesh);
    node.geometry.dispose();
  }
}
```

### src/infrastructure/world/atlas-three/atlas-unified-input.ts:15

```ts
export type NormalizedWheelInput = {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode: number;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly clientX: number;
  readonly clientY: number;
  readonly viewportHeight: number;
};
```

### src/infrastructure/world/atlas-three/atlas-unified-input.ts:27

```ts
export type UnifiedWheelAction =
  | {
      readonly kind: 'pinch-zoom';
      readonly zoomDelta: number;
      readonly clientX: number;
      readonly clientY: number;
    }
  | {
      readonly kind: 'wheel-zoom';
      readonly zoomDelta: number;
      readonly clientX: number;
      readonly clientY: number;
    }
  | {
      readonly kind: 'pan';
      readonly deltaX: number;
      readonly deltaY: number;
    }
  | {
      readonly kind: 'orbit';
      readonly deltaYawRad: number;
      readonly deltaPitchRad: number;
    };
```

### src/infrastructure/world/atlas-three/atlas-unified-input.ts:63

```ts
export function normalizeWheelDelta(
  deltaX: number,
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
): { readonly dx: number; readonly dy: number } {
  const safeH = Math.max(100, Number.isFinite(viewportHeight) ? viewportHeight : 800);
  const mult = deltaMode === 1 ? LINE_HEIGHT_PX : deltaMode === 2 ? safeH : 1;
  return {
    dx: Number.isFinite(deltaX) ? deltaX * mult : 0,
    dy: Number.isFinite(deltaY) ? deltaY * mult : 0,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-unified-input.ts:81

```ts
export function classifyUnifiedWheelGesture(ev: NormalizedWheelInput): UnifiedWheelAction {
  const { dx, dy } = normalizeWheelDelta(ev.deltaX, ev.deltaY, ev.deltaMode, ev.viewportHeight);

  // 1) Chromium / Firefox Trackpad Pinch (or Ctrl+Wheel) → Zoom toward cursor (E3)
  if (ev.ctrlKey) {
    // Trackpad pinch wheel deltas are typically small (~±2..25 px); scale smoothly & clamp.
    return {
      kind: 'pinch-zoom',
      zoomDelta: clampZoomDelta(dy * 4.5),
      clientX: ev.clientX,
      clientY: ev.clientY,
    };
  }

  // 2) Shift + Wheel/Trackpad → Orbit camera
  if (ev.shiftKey) {
    return {
      kind: 'orbit',
      deltaYawRad: -(dx !== 0 ? dx : dy) * 0.0045,
      deltaPitchRad: (dx !== 0 ? dy : 0) * 0.0035,
    };
  }

  // 3) Meta/Cmd + Wheel → Zoom toward cursor
  if (ev.metaKey) {
    return {
      kind: 'wheel-zoom',
      zoomDelta: clampZoomDelta(dy),
      clientX: ev.clientX,
      clientY: ev.clientY,
    };
  }

  // 4) Two-Finger Trackpad Scroll → Pan (E4):
  // macOS trackpad emits pixel-mode (deltaMode===0) events with horizontal deltaX
  // or smooth sub-notch vertical deltas (< 48px, non-120 multiples).
  const isMouseNotch =
    ev.deltaMode !== 0 ||
    (Math.abs(dx) < 0.01 && Math.abs(dy) >= 48 && Math.abs(dy % 40) < 0.5);

  if (!isMouseNotch && (Math.abs(dx) > 0.01 || Math.abs(dy) < 48)) {
    return {
      kind: 'pan',
      deltaX: dx,
      deltaY: dy,
    };
  }

  // 5) Standard physical mouse wheel → Zoom toward cursor
  return {
    kind: 'wheel-zoom',
    zoomDelta: clampZoomDelta(dy),
    clientX: ev.clientX,
    clientY: ev.clientY,
  };
}
```

### src/infrastructure/world/atlas-three/atlas-unified-input.ts:139

```ts
export type SafariGestureEventLike = Event & {
  readonly scale?: number;
  readonly clientX?: number;
  readonly clientY?: number;
};
```

### src/infrastructure/world/atlas-three/atlas-unified-input.ts:149

```ts
export function safariGestureScaleToZoomDelta(prevScale: number, nextScale: number): number {
  const safePrev = Math.max(0.05, Number.isFinite(prevScale) ? prevScale : 1);
  const safeNext = Math.max(0.05, Number.isFinite(nextScale) ? nextScale : safePrev);
  const ratio = safeNext / safePrev;
  // Positive delta zooms out, negative delta zooms in (matches wheel deltaY convention).
  return -Math.log(ratio) * 620;
}
```

### src/infrastructure/world/atlas-three/atlas-unified-input.ts:157

```ts
export type AtlasUnifiedInputCallbacks = {
  readonly onZoomAtScreen: (zoomDelta: number, px: number, py: number) => void;
  readonly onPanByScreen: (deltaX: number, deltaY: number) => void;
  readonly onOrbitByDelta: (deltaYawRad: number, deltaPitchRad: number) => void;
};
```

### src/infrastructure/world/atlas-three/atlas-unified-input.ts:167

```ts
export function bindAtlasUnifiedInput(
  element: HTMLElement,
  callbacks: AtlasUnifiedInputCallbacks,
): () => void {
  let lastSafariScale = 1;

  const onWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    const rect = element.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const action = classifyUnifiedWheelGesture({
      deltaX: ev.deltaX,
      deltaY: ev.deltaY,
      deltaMode: ev.deltaMode,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      metaKey: ev.metaKey,
      clientX: px,
      clientY: py,
      viewportHeight: rect.height || window.innerHeight || 800,
    });

    if (action.kind === 'pinch-zoom' || action.kind === 'wheel-zoom') {
      callbacks.onZoomAtScreen(action.zoomDelta, action.clientX, action.clientY);
    } else if (action.kind === 'pan') {
      callbacks.onPanByScreen(action.deltaX, action.deltaY);
    } else if (action.kind === 'orbit') {
      callbacks.onOrbitByDelta(action.deltaYawRad, action.deltaPitchRad);
    }
  };

  const onGestureStart = (raw: Event) => {
    const ev = raw as SafariGestureEventLike;
    ev.preventDefault();
    lastSafariScale = typeof ev.scale === 'number' && Number.isFinite(ev.scale) ? ev.scale : 1;
  };

  const onGestureChange = (raw: Event) => {
    const ev = raw as SafariGestureEventLike;
    ev.preventDefault();
    const nextScale = typeof ev.scale === 'number' && Number.isFinite(ev.scale) ? ev.scale : lastSafariScale;
    const zoomDelta = safariGestureScaleToZoomDelta(lastSafariScale, nextScale);
    lastSafariScale = nextScale;
    if (Math.abs(zoomDelta) < 0.01) return;
    const rect = element.getBoundingClientRect();
    const px = typeof ev.clientX === 'number' ? ev.clientX - rect.left : rect.width / 2;
    const py = typeof ev.clientY === 'number' ? ev.clientY - rect.top : rect.height / 2;
    callbacks.onZoomAtScreen(zoomDelta, px, py);
  };

  const onGestureEnd = (ev: Event) => {
    ev.preventDefault();
    lastSafariScale = 1;
  };

  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('gesturestart', onGestureStart, { passive: false } as AddEventListenerOptions);
  element.addEventListener('gesturechange', onGestureChange, { passive: false } as AddEventListenerOptions);
  element.addEventListener('gestureend', onGestureEnd, { passive: false } as AddEventListenerOptions);

  return () => {
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('gesturestart', onGestureStart);
    element.removeEventListener('gesturechange', onGestureChange);
    element.removeEventListener('gestureend', onGestureEnd);
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
  'fabric',
] as const;
```

### src/infrastructure/world/atlas-three/pbr-textures.ts:29

```ts
export type AtlasPbrKind = (typeof ATLAS_PBR_KINDS)[number];
```

### src/infrastructure/world/atlas-three/pbr-textures.ts:31

```ts
export type AtlasPbrTextureSet = {
  readonly map: THREE.CanvasTexture;
  readonly normal: THREE.CanvasTexture;
  readonly rough: THREE.CanvasTexture;
};
```

### src/infrastructure/world/atlas-three/pbr-textures.ts:369

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
| `src/domains/world/atlas/atlas-continuous-zoom.ts` | `e91303c0fee7b8365286f5c50a8dc6d2cbaa9213ab2e5e829999829942991ca0` |
| `src/domains/world/atlas/atlas-default-world.ts` | `27f6110a18963e8d5ba9865b0d285df8e7873132dc89dbecdf4ce7dcda915b3e` |
| `src/domains/world/atlas/atlas-diorama-look.ts` | `a0c2f5ea6af2faabed685d4eff4035dad43b1e82f3d6b2a67e017ddcddf99ea6` |
| `src/domains/world/atlas/atlas-dungeon-look.ts` | `b28dfd123ebb46472258442834d636b2962ed78a7261d458bc57a5ad1d3f352c` |
| `src/domains/world/atlas/atlas-edit-history.ts` | `13a91efde301ec766d3b0f183affcd794abba9f4c4872c00549e9f631947e294` |
| `src/domains/world/atlas/atlas-geometry-ownership.ts` | `fc0edfa99d2215bdc33255fbb842855f98a4a85030388ce5baba066789055a14` |
| `src/domains/world/atlas/atlas-golden-visual.ts` | `2e1e5798e9bd75c899927183803d27969c30d06b0e5a902fa078632b337d4724` |
| `src/domains/world/atlas/atlas-heightfield.ts` | `c1536888d96c1d73adcaf2d8ccc7fd49f54fa5c285a9ed9a209e18e5b3409406` |
| `src/domains/world/atlas/atlas-hierarchy-lod.ts` | `d8f476a6aab1a6f8c63ee4d465401869e5b4191154b89b238f60fdba6c8b9bff` |
| `src/domains/world/atlas/atlas-hierarchy-nav.ts` | `d9df6c10f147e7f325dfc735306fe481e4aa1fc601e215a1f79df0f53b190be7` |
| `src/domains/world/atlas/atlas-label-hierarchy.ts` | `130e5768641d53e5f39fc004f77df424873e3858bcdf9dd594abaaf4bb47a64d` |
| `src/domains/world/atlas/atlas-map-doc-adapter.ts` | `d85a2ed7b2e6cd9650c4d87664fb09e7b4621779f2a820ed65c421e353caf04a` |
| `src/domains/world/atlas/atlas-map-pins.ts` | `274afd450b4bc9701fc0e6de6a6f8559b5ba19ed2e01481268815ba3368eb661` |
| `src/domains/world/atlas/atlas-perf-budgets.ts` | `3a74334bd3b91af40731ea970d9a79cd189ca672b830e40025adfc71dbe4cf33` |
| `src/domains/world/atlas/atlas-persist-state.ts` | `84ab0edbd0b525c95b5db85afeb683d335351884ba6c612e94f327719a6b60ca` |
| `src/domains/world/atlas/atlas-product-camera.ts` | `6d65226fe7e6594079b61df81ec39a226d5b79788327ef95609dc70f9980d179` |
| `src/domains/world/atlas/atlas-product-geometry-plan.ts` | `de94ca0b6c23374ae5aed057fa756539285295574df9925598a0ed029a2a3ce9` |
| `src/domains/world/atlas/atlas-prototype-lod.ts` | `2fb7c706ad2210f7a3f389f22564f60e3f22aa615ec49af49695e388ae582256` |
| `src/domains/world/atlas/atlas-renderer-target.ts` | `f51d6dc7122851ef8b88e1c567984f50f743a1630cf5f36212205fe70c8662ff` |
| `src/domains/world/atlas/atlas-revision-contract.ts` | `d01c356239143862f9aa8f3fd44fca79105e3ed390327c34b9be6ce1902c78d6` |
| `src/domains/world/atlas/atlas-scene-scatter.ts` | `0e4d47d172f1cd5267691e82a97989df2bc9d4972315da008450a5d52a76d096` |
| `src/domains/world/atlas/atlas-selection.ts` | `6c16fb40fe26addea8e33e718a89a019de099c6008c1000dd697d48fa12849a7` |
| `src/domains/world/atlas/atlas-spatial-containment.ts` | `b4d0dd0186856c2df5adb7cbaa58743ec9e786deb9726b281fbaa7966594e8f7` |
| `src/domains/world/atlas/atlas-spatial-edit-prefs.ts` | `7248152b93c7b0c2748b1682bb12fd174ac64b88fda12f0d0cca588c4a21ee1c` |
| `src/domains/world/atlas/atlas-spatial-propagation.ts` | `61720d09fcf09248c30f2d6ab17181e0968f0aacaf88b1823da30b660bd45abb` |
| `src/domains/world/atlas/atlas-spatial-world-bridge.ts` | `fdde808af62f5d1fc1e4ae2d91e582abaea224dcdd6d40617cf5bb498d40c8cb` |
| `src/domains/world/atlas/atlas-terrain-mesh.ts` | `76aa0ae181cc9817561db31f6b5ccea8cac0a22b73fa46e6292b022b53978ba7` |
| `src/domains/world/atlas/atlas-tool-registry.ts` | `be0492bd7d71f1dafa260c6a1a75165f8c587bd1f55d3178f96fbd67ac5988af` |
| `src/domains/world/atlas/atlas-webgl-write-retire.ts` | `baf40e97aaa9c74c873f3919e72b4d9049e8c7781566ed58ce52ccf2f168ce69` |
| `src/domains/world/atlas/atlas-workstation-adaptive.ts` | `2a87a8f4cf36e532f9bbb0faa0085013f4169fedc26622a1bbef800b46f59846` |
| `src/domains/world/atlas/atlas-world-camera.ts` | `b0ac5e7eac73a8cdaa0e21e6758f6d6cfa1e448d935a9d763213a6ce9bc9a127` |
| `src/domains/world/atlas/atlas-world-focus.ts` | `e8da0d711424bb7a4fa87c1533111d2d4ce1bf06799334e8d5a72128cf610bfd` |
| `src/domains/world/atlas/atlas-world-operation-history.ts` | `edeaad892bd3b95e08466a4e9b8d6cf02997facac309a48e3aeea4fc64079aae` |
| `src/domains/world/atlas/atlas-world-scene-plan.ts` | `060e03785a1b39bbe2de76cb61ad9088a523e0edca58ba0355ec7a26ced66af9` |
| `src/domains/world/atlas/atlas-world-space.ts` | `9023fa99f88df8873ac68934fe0c7389dcafa991f02b27769099e60bbedd91af` |
| `src/domains/world/atlas/atlas-world-terrain-chunks.ts` | `42307761b5c6ab4228336f127d6bc02829120a4e4841abb4f3a499ce2a76c0b5` |
| `src/domains/world/atlas/atlas-zoom-layer-state.ts` | `5ca6e612df637008f3b683e128b9c88ca59a0608956a79ce5d3ea3304ef5a6f1` |
| `src/domains/world/atlas/canvas-polygon.ts` | `a1bf513b449cf21b8e7d449d291c1f7965303072916f0192a214328a90920cea` |
| `src/domains/world/atlas/dornhain-golden-hierarchy.ts` | `80a9d41a65cef12235c4936b21f1ec7540ec28de054c22d4e5e7afd0a3a254f9` |
| `src/domains/world/atlas/dornhain-golden-reset.ts` | `986cf4a9e3bc0b9c62c425bf93e58150132d58e20406d9c8c18b8b2c81ba1a6a` |
| `src/domains/world/atlas/dornhain-unified-starter.ts` | `59ee930bdf3f8598acadc105427c5a084997b55c36bd668e143c3853d7bb48bf` |
| `src/domains/world/atlas/dungeon-forge-workflow.ts` | `c9fdba0da576bc5f5516bb6c637d6efc993c9fab630fa2e42b725836f4ef0317` |
| `src/domains/world/atlas/dungeon-generator.ts` | `6bbed5a42d16ec727e2745b0e1f47dc9d3f1dcc219ee0ccb06f15340307908e1` |
| `src/domains/world/atlas/dungeon-grid.ts` | `56d9698047b1405a3ba4525146a189e8c8d299d0270fd6d678a0dafa5a0a8854` |
| `src/domains/world/atlas/index.ts` | `72b8bd545672ac16f745d054d1aa12d34e316a439421de59f91748fa4850c783` |
| `src/domains/world/atlas/map-edit-ops.ts` | `3440965957e4212748d109f74ce202fa7a320840d5c9f1347b0457347c797b95` |
| `src/domains/world/atlas/map-frame.ts` | `f40cdfd6d6a7f399e04a9c816a55624bee43d82e9b128804469fa49c3dc74e0c` |
| `src/domains/world/atlas/party-map-projection.ts` | `eeb742f12fa5e35e03a2a2c57f2c92f8ddb9d996562c88d6de96169d61b82fc9` |
| `src/domains/world/atlas/unified-canvas-doc.ts` | `59fa68591c71d2f0bba3185fffb4adecf8d325464df4701309af76a2a99fbd82` |
| `src/domains/world/atlas/validate-world-atlas.ts` | `3042c993e644808c908331970dd87367649889dbf9421c5507f88b7b415b009e` |
| `src/domains/world/atlas/webgl-runtime-bridge.ts` | `4d7acacb2a3ded8df55b0d333bb35d51d2b291f8e3849b24577a44f87785434d` |
| `src/domains/world/atlas/world-atlas.types.ts` | `094fa1a6f46a54063fe396c7d641c6c34d5b8907c3f6e0127a2ae9e6443dcee7` |
| `src/domains/world/contracts/world.types.ts` | `ad676f8bf83b6d55627a568c28d5221bd8f4f616e33eae31fab502223c74f6fb` |
| `src/domains/world/hierarchy/create-plan.ts` | `6fefab23a8f62fb9a6ebe716c3f44704fa7ab5466b8d5fe0de904920f5aee38e` |
| `src/domains/world/hierarchy/index.ts` | `05ef0b33d0950512a3ac12eb64497fb3e3321f43d81b4fcf76e909a2ef52efe2` |
| `src/domains/world/hierarchy/legacy-kind-map.ts` | `6a9ff5b58a400f8ba0e06b584823bc530ed430fe2380dce6639950d2e80f8391` |
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
| `src/infrastructure/world/atlas-three/atlas-three-camera.ts` | `5de04e8dffb048daa6ad01466ae68c30ce7cbc1084d694fb0de510db56713faa` |
| `src/infrastructure/world/atlas-three/atlas-three-multimap.ts` | `c4e307c46fd61316b6b3a14632088d284a8b85826ffd734a6d8ad3e33295958a` |
| `src/infrastructure/world/atlas-three/atlas-three-runtime.ts` | `97bdbe7bbf8d035d22e414f641172b799597b157aff6513df2c7562c0f6ccc03` |
| `src/infrastructure/world/atlas-three/atlas-three-scene.ts` | `a5b39d21d3e6e01befdbd0f7d5f2dd73e58ddce692e23958c4dbeb7fba13e439` |
| `src/infrastructure/world/atlas-three/atlas-three-world-terrain.ts` | `05daaa14fddd5080ef6ca7abf7fd6b9db24de7cede3cf98cc2ec6bc421b78ff9` |
| `src/infrastructure/world/atlas-three/atlas-unified-input.ts` | `ab0b8b75470742020a6bf335045118e981e831fb9a6d0358dec7148e89b63bb9` |
| `src/infrastructure/world/atlas-three/index.ts` | `41080205df69bc1f433e5dd7928411b4e245ac0ecb730b109881cb681e46bca7` |
| `src/infrastructure/world/atlas-three/pbr-textures.ts` | `e5eb4eb6a63888eb95f95368e9e19400c8331b2d880f3b566708aeed2fc060b8` |
| `src/infrastructure/world/host-world-adapter.ts` | `8fbaad8d6d4ec9cc42070444441fae94fb20af020cdada2125a705877ea4e1f1` |
| `src/infrastructure/world/host-world-ports.contract.ts` | `9d11c1085646775f6c6eb5bdc29baa7ed40af0245354589bd767d4f80da1d582` |
| `src/infrastructure/world/host-world-read.contract.ts` | `271a052d5f621ddf7f3344eaa55e3a58579c5cf629fe76a4827393d0d1c7a05c` |
| `src/infrastructure/world/world-atlas-service.ts` | `63cdb7aea8402a51c8bf6480e325fd15d951c33c28aa1a7923340251878c5c1d` |
| `src/infrastructure/world/world-map-service.ts` | `d99faed233ee5c66d96d08397c0e292113a44e43efb51f4b30b7cc6a21a91103` |
| `src/infrastructure/world/world-place-service.ts` | `5fe2e68dd3949fb193547aa9ee498c15fc0e3f368bf546156a39086e805312bb` |
| `src/infrastructure/world/world-profile-service.ts` | `10935d830086c8f9972b9f9f982e7ba8203609facd408020c634df4400032610` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |


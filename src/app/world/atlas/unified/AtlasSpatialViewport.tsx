/**
 * AtlasSpatialViewport — editable Three.js 2.5D/3D view bound to UnifiedCanvasDoc.
 * Location: src/app/world/atlas/unified/AtlasSpatialViewport.tsx
 *
 * Hybrid path: Canvas2D remains the texture/brush editor; this viewport edits the same document.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { UnifiedCanvasDoc } from '../../../../domains/world/atlas';
import { applyMapEdit, pickObjectAt } from '../../../../domains/world/atlas';
import type { AtlasCamera } from '../../../../domains/world/map';

export type AtlasSpatialViewportProps = {
  readonly doc: UnifiedCanvasDoc;
  readonly canEdit: boolean;
  readonly camera2d: AtlasCamera;
  readonly selectedId: string | null;
  readonly onSelect: (id: string | null) => void;
  readonly onDocChange: (next: UnifiedCanvasDoc) => void;
  /** Planet-level: stronger tilt + horizon disc (viewer, not a second doc). */
  readonly globeMode?: boolean;
  readonly className?: string;
};

const BUILDING_TYPES = new Set(['haus', 'turm']);

function objectHeight(type: string, size: number, height?: number): number {
  if (typeof height === 'number' && height > 0) return height;
  if (BUILDING_TYPES.has(type)) return size * 0.85;
  return Math.max(0.4, size * 0.45);
}

type Engine = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  root: THREE.Group;
  camera: THREE.PerspectiveCamera;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  ground: THREE.Plane;
  hitPoint: THREE.Vector3;
  dragId: string | null;
  raf: number;
};

export function AtlasSpatialViewport({
  doc,
  canEdit,
  camera2d,
  selectedId,
  onSelect,
  onDocChange,
  globeMode = false,
  className,
}: AtlasSpatialViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const docRef = useRef(doc);
  const selectedRef = useRef(selectedId);
  const cam2dRef = useRef(camera2d);
  const onDocChangeRef = useRef(onDocChange);
  const onSelectRef = useRef(onSelect);
  const canEditRef = useRef(canEdit);
  const globeRef = useRef(globeMode);

  docRef.current = doc;
  selectedRef.current = selectedId;
  cam2dRef.current = camera2d;
  onDocChangeRef.current = onDocChange;
  onSelectRef.current = onSelect;
  canEditRef.current = canEdit;
  globeRef.current = globeMode;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x0b1220, 1);
    host.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, {
      width: '100%',
      height: '100%',
      display: 'block',
      touchAction: 'none',
    });

    const scene = new THREE.Scene();
    const root = new THREE.Group();
    scene.add(root);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.05);
    sun.position.set(80, 120, 40);
    scene.add(sun);
    const hemi = new THREE.HemisphereLight(0x6ec8ff, 0x1a2a1a, 0.35);
    scene.add(hemi);

    const engine: Engine = {
      renderer,
      scene,
      root,
      camera: new THREE.PerspectiveCamera(48, 1, 0.1, 5000),
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      ground: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      hitPoint: new THREE.Vector3(),
      dragId: null,
      raf: 0,
    };
    engineRef.current = engine;

    const clearRoot = () => {
      while (root.children.length > 0) {
        const child = root.children[0];
        root.remove(child);
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      }
    };

    const rebuild = () => {
      clearRoot();
      const d = docRef.current;
      const globe = globeRef.current;
      if (globe) {
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(920, 64),
          new THREE.MeshStandardMaterial({
            color: 0x1a3a4a,
            roughness: 0.92,
            metalness: 0.05,
            side: THREE.DoubleSide,
          }),
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = -0.4;
        disc.userData = { kind: 'globe-disc' };
        root.add(disc);
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(900, 18, 8, 64),
          new THREE.MeshStandardMaterial({
            color: 0x3a7a9a,
            emissive: 0x0a2030,
            roughness: 0.7,
          }),
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.y = -0.2;
        rim.userData = { kind: 'globe-rim' };
        root.add(rim);
        renderer.setClearColor(0x071018, 1);
      } else {
        renderer.setClearColor(0x0b1220, 1);
      }
      for (const r of d.rooms) {
        const geo = new THREE.BoxGeometry(Math.max(0.05, r.w), 0.12, Math.max(0.05, r.h));
        const mat = new THREE.MeshStandardMaterial({
          color: r.material === 'stein' ? 0x5c626e : r.material === 'wasser' ? 0x2a6f8f : 0x3d6b4f,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(r.x + r.w / 2, 0.06, r.y + r.h / 2);
        mesh.userData = { kind: 'room', id: r.id };
        root.add(mesh);
      }
      for (const w of d.walls) {
        const dx = w.x2 - w.x1;
        const dz = w.y2 - w.y1;
        const len = Math.hypot(dx, dz) || 0.05;
        const geo = new THREE.BoxGeometry(len, 2.4, Math.max(0.08, w.width));
        const mat = new THREE.MeshStandardMaterial({ color: 0xb4b6aa });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((w.x1 + w.x2) / 2, 1.2, (w.y1 + w.y2) / 2);
        mesh.rotation.y = -Math.atan2(dz, dx);
        mesh.userData = { kind: 'wall', id: w.id };
        root.add(mesh);
      }
      for (const o of d.objects) {
        const h = objectHeight(o.type, o.size, o.height);
        const geo = new THREE.BoxGeometry(o.size, h, o.size * (o.type === 'haus' ? 0.9 : 1));
        const mat = new THREE.MeshStandardMaterial({
          color: o.id === selectedRef.current ? 0x06b6d4 : BUILDING_TYPES.has(o.type) ? 0xc4a574 : 0xe8a641,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(o.x, h / 2 + (o.z ?? 0), o.y);
        mesh.rotation.y = -((o.angle ?? 0) * Math.PI) / 180;
        mesh.userData = { kind: 'object', id: o.id };
        root.add(mesh);
      }
    };

    const paint = () => {
      const { clientWidth: width, clientHeight: height } = host;
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      const cam = cam2dRef.current;
      const globe = globeRef.current;
      const span = Math.max(8, (Math.max(width, height) / Math.max(1, cam.pixelsPerUnit)) * 0.55);
      engine.camera.aspect = width / Math.max(1, height);
      engine.camera.fov = globe ? 42 : 48;
      if (globe) {
        engine.camera.position.set(
          cam.center.x + span * 0.95,
          span * 1.35,
          cam.center.y + span * 1.15,
        );
        engine.camera.lookAt(cam.center.x, span * 0.08, cam.center.y);
      } else {
        engine.camera.position.set(cam.center.x + span * 0.55, span * 0.85, cam.center.y + span * 0.7);
        engine.camera.lookAt(cam.center.x, 0, cam.center.y);
      }
      engine.camera.updateProjectionMatrix();
      rebuild();
      renderer.render(scene, engine.camera);
    };

    const loop = () => {
      paint();
      engine.raf = requestAnimationFrame(loop);
    };

    const setPointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      engine.pointer.x = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      engine.pointer.y = -((ev.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    };

    const onDown = (ev: PointerEvent) => {
      if (!canEditRef.current) return;
      setPointer(ev);
      engine.raycaster.setFromCamera(engine.pointer, engine.camera);
      const hits = engine.raycaster.intersectObjects(root.children, false);
      const hit = hits.find((h) => h.object.userData.kind === 'object');
      if (hit) {
        engine.dragId = String(hit.object.userData.id);
        onSelectRef.current(engine.dragId);
        renderer.domElement.setPointerCapture(ev.pointerId);
        return;
      }
      if (engine.raycaster.ray.intersectPlane(engine.ground, engine.hitPoint)) {
        const picked = pickObjectAt(docRef.current, engine.hitPoint.x, engine.hitPoint.z);
        onSelectRef.current(picked?.id ?? null);
      }
    };

    const onMove = (ev: PointerEvent) => {
      if (!engine.dragId || !canEditRef.current) return;
      setPointer(ev);
      engine.raycaster.setFromCamera(engine.pointer, engine.camera);
      if (!engine.raycaster.ray.intersectPlane(engine.ground, engine.hitPoint)) return;
      onDocChangeRef.current(
        applyMapEdit(docRef.current, {
          op: 'move_object',
          id: engine.dragId,
          x: engine.hitPoint.x,
          y: engine.hitPoint.z,
          z: 0,
        }),
      );
    };

    const onUp = (ev: PointerEvent) => {
      engine.dragId = null;
      try {
        renderer.domElement.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    };

    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onUp);
    engine.raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(engine.raf);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onUp);
      clearRoot();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      engineRef.current = null;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={className}
      data-atlas-spatial-viewport
      data-atlas-globe-mode={globeMode ? 'true' : undefined}
      role="img"
      aria-label={globeMode ? 'Planet-Globus-Ansicht' : 'Räumliche 3D-Kartenansicht'}
    />
  );
}

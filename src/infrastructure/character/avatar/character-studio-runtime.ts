/**
 * character-studio-runtime — Three.js / VRM avatar runtime (no React).
 * Location: src/infrastructure/character/avatar/character-studio-runtime.ts
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import {
  parseFaceAnchorsManifestV1,
  resolveEffectiveTraits,
  type AvatarRigAnalysisResult,
  type BaseTraitSelection,
  type RuntimeTraitOverlay,
} from '../../../domains/character/avatar';
import { normalizeAvatarModelUrl } from '../../../domains/character/use-cases/avatar-presets';
import type { CharacterAvatarDto } from '../../../domains/character/domain/character.entity';
import type { AvatarAssetManifest } from './avatar-asset-manifests';
import {
  createTraitLifecycleThreeAdapter,
  type TraitLifecycleThreeAdapter,
} from './trait-lifecycle-three-adapter';
import { analyzeAvatarRigFromObject3D } from './rig-analyzer';
import {
  applyMtoonProfileToModel,
  applyMtoonProfileToRenderer,
  applyMtoonProfileToScene,
  applyNeutralPreviewLights,
  captureMaterialStyleSnapshots,
  capturePortraitFromRenderer,
  createMtoonStyleLights,
  restoreMaterialStyleSnapshots,
  type MaterialStyleSnapshot,
  type MtoonStyleLights,
} from './mtoon-style-applier';
import {
  createSagaTreeMToonProfileV1,
  type MtoonStyleCompatibility,
  type SagaTreeMToonProfileV1,
} from '../../../domains/character/avatar/mtoon-profile';
import {
  AvatarAnimationRuntime,
  type AvatarAnimationRuntimeState,
} from './avatar-animation-runtime';
import type { AvatarAnimationActionId } from '../../../domains/character/avatar/animation-contract';
import {
  AvatarFacialRuntime,
  type AvatarFacialRuntimeState,
} from './avatar-facial-runtime';
import type { FacialCanonicalKey } from '../../../domains/character/avatar/facial-contract';
import type { LookExecutionMode, LookProfileVersion } from '../../../domains/look/types';
import { createLookRuntime, type LookRuntime } from '../../look/look-runtime';
import type { LookRuntimeApplyResult } from '../../look/look-runtime-types';
import type { FaceTrackingDrive } from '../../../domains/character/avatar/face-tracking-contract';
import type { LiveActAvatarCapabilities } from '../../../domains/character/liveact';
import {
  createLiveActAvatarOutput,
  type LiveActAvatarOutput,
} from '../liveact/liveact-avatar-output';
import {
  createLiveActRigDebugController,
  type LiveActRigDebugController,
} from '../liveact/liveact-rig-debug';
import {
  createLiveActCharacterFaceDebugController,
  type LiveActCharacterFaceDebugController,
  type LiveActCharacterFaceDebugHandle,
} from '../liveact/liveact-character-face-debug';
import { listFaceAnchorsManifestUrlCandidates } from '../liveact/face-anchors-manifest-url';
import type {
  SagaTreeFaceAnchorId,
  SagaTreeFaceAnchorTriangleBinding,
  SagaTreeFaceAnchorsManifestV1,
} from '../../../domains/character/avatar/face-anchor-contract';
import {
  buildFaceAnchorNodeIndex,
  evaluateFaceAnchorWorldPosition,
} from './face-anchor-runtime';
import {
  listFaceMappingRaycastCandidates,
  raycastFaceMappingPointer,
  type FaceMappingRaycastCandidateV1,
  type FaceMappingRaycastHitV1,
} from './face-mapping-raycast';
import {
  computeFaceMappingFaceWidthWorld,
  selectFaceMappingSurfaceAwareCandidate,
} from '../../../domains/character/avatar/face-mapping-auto-surface-select-v1';

export type { LiveActCharacterFaceDebugHandle, FaceMappingRaycastHitV1 };
import type { AvatarEquipmentVisual } from '../../../domains/character/avatar';
import {
  AvatarRigidEquipmentRuntime,
  type ResolveRigidEquipmentUrl,
} from './avatar-rigid-equipment-runtime';
import {
  AvatarSkinnedWearableRuntime,
  type ResolveSkinnedWearableUrl,
} from './avatar-skinned-wearable-runtime';
import { beginFaceMappingBaseFaceCaptureVisibility } from './face-mapping-base-face-capture-visibility';

export type AvatarRuntimeState =
  | { status: 'loading'; message: string }
  | { status: 'ready'; message: string }
  | { status: 'error'; message: string };

/** Quick camera frames for the Character Editor 3D preview. */
export type AvatarCameraFrameId = 'full' | 'portrait' | 'face' | 'feet';

type RuntimeStateListener = (state: AvatarRuntimeState) => void;
type RigAnalysisListener = (analysis: AvatarRigAnalysisResult) => void;
type AnimationStateListener = (state: AvatarAnimationRuntimeState) => void;
type FacialStateListener = (state: AvatarFacialRuntimeState) => void;

function includesHint(value: string, hints: readonly string[]): boolean {
  const normalized = value.toLowerCase();
  return hints.some((hint) => normalized.includes(hint));
}

function clothingTint(clothing: string | undefined): string {
  switch (clothing) {
    case 'robe':
      return '#315985';
    case 'armor':
      return '#667586';
    case 'leather':
      return '#744B32';
    case 'noble':
      return '#71508C';
    default:
      return '#465A70';
  }
}

function materialsOf(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function prepareModel(root: THREE.Object3D): void {
  root.traverse((object) => {
    object.frustumCulled = false;
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

function centerModel(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= bounds.min.y;
  root.updateWorldMatrix(true, true);
}

function getVrm(gltfUserData: unknown): VRM | undefined {
  if (typeof gltfUserData !== 'object' || gltfUserData === null || !('vrm' in gltfUserData)) return undefined;
  const candidate = gltfUserData.vrm;
  return candidate instanceof VRM ? candidate : undefined;
}

export class CharacterStudioRuntime {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  private readonly controls: OrbitControls;
  private readonly loader = new GLTFLoader();
  private readonly modelContainer = new THREE.Group();
  private readonly overlaysGroup = new THREE.Group();
  private readonly clock = new THREE.Clock();
  private readonly traitLifecycle: TraitLifecycleThreeAdapter;
  private currentRoot?: THREE.Object3D;
  private currentVrm?: VRM;
  private currentAvatar?: CharacterAvatarDto;
  private currentManifest?: AvatarAssetManifest;
  /** Runtime-only overlays (equipment etc.) — never written to appearance.avatar.traits. */
  private runtimeOverlays: RuntimeTraitOverlay[] = [];
  private lastRigAnalysis?: AvatarRigAnalysisResult;
  private loadVersion = 0;
  private disposed = false;
  private readonly styleProfile: SagaTreeMToonProfileV1 = createSagaTreeMToonProfileV1();
  private readonly styleLights: MtoonStyleLights;
  private styleCompatibility: MtoonStyleCompatibility = {
    path: 'pbr-fallback',
    noticeDe: null,
  };
  /** Editor preview: SagaTree MToon profile on/off. Default off until loadModel sets VRM vs GLB. Not persisted. */
  private mtoonStyleEnabled = false;
  private materialStyleSnapshots: MaterialStyleSnapshot[] = [];
  /** Provider-neutral LookRuntime (#342) — ToonLab never imported here. */
  private readonly lookRuntime: LookRuntime = createLookRuntime();
  private lastLookApply: LookRuntimeApplyResult | null = null;
  private readonly animationRuntime: AvatarAnimationRuntime;
  private readonly facialRuntime: AvatarFacialRuntime;
  private readonly rigidEquipmentRuntime: AvatarRigidEquipmentRuntime;
  private readonly skinnedWearableRuntime: AvatarSkinnedWearableRuntime;
  private headBone: THREE.Object3D | null = null;
  private leftFootBone: THREE.Object3D | null = null;
  private rightFootBone: THREE.Object3D | null = null;
  private inspectMode = false;
  private readonly headRestQuaternion = new THREE.Quaternion();
  private readonly headScratchEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly headScratchQuaternion = new THREE.Quaternion();
  private readonly eyeLookTarget = new THREE.Vector3();
  private liveActAvatarOutput: LiveActAvatarOutput | null = null;
  private readonly liveActRigDebug: LiveActRigDebugController;
  private readonly liveActCharacterFaceDebug: LiveActCharacterFaceDebugController;
  private faceAnchorManifestLoadToken = 0;
  /** Model URL whose anchors are bound; null until the current model is ready. */
  private faceAnchorsModelUrl: string | null = null;
  /** Last bound `avatar.face_anchors` reference — hydration can change it without a model reload. */
  private faceAnchorsOverrideSource: SagaTreeFaceAnchorsManifestV1 | null = null;
  /** When true, LiveAct drive application is suppressed for Face Setup (#420). */
  private faceMappingAuthoringActive = false;
  /** Nested base-face capture scopes (equipment hidden / masked bases revealed). */
  private faceMappingBaseFaceCaptureDepth = 0;
  private faceMappingBaseFaceCaptureRestore: (() => void) | null = null;
  /** Independent suspend reasons — either keeps procedural clips paused. */
  private liveActDriveSuspendReason = false;
  private faceMappingSuspendReason = false;
  private readonly faceMappingProjectScratch = new THREE.Vector3();

  constructor(
    canvas: HTMLCanvasElement,
    private readonly onStateChange: RuntimeStateListener,
    private readonly onRigAnalysis?: RigAnalysisListener,
    private readonly onAnimationState?: AnimationStateListener,
    private readonly onFacialState?: FacialStateListener,
  ) {
    this.animationRuntime = new AvatarAnimationRuntime(this.onAnimationState);
    this.facialRuntime = new AvatarFacialRuntime(this.onFacialState);
    this.rigidEquipmentRuntime = new AvatarRigidEquipmentRuntime();
    this.skinnedWearableRuntime = new AvatarSkinnedWearableRuntime();
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.animationRuntime.setPrefersReducedMotion(
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
    }
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    applyMtoonProfileToRenderer(this.renderer, this.styleProfile);

    this.modelContainer.add(this.overlaysGroup);
    this.scene.add(this.modelContainer);
    this.liveActRigDebug = createLiveActRigDebugController(this.scene);
    this.liveActCharacterFaceDebug = createLiveActCharacterFaceDebugController({
      camera: this.camera,
      getCanvasSize: () => {
        const canvas = this.renderer.domElement;
        return {
          width: Math.max(1, Math.round(canvas.clientWidth)),
          height: Math.max(1, Math.round(canvas.clientHeight)),
        };
      },
    });
    this.traitLifecycle = createTraitLifecycleThreeAdapter(this.overlaysGroup);

    this.styleLights = createMtoonStyleLights(this.styleProfile);
    this.scene.add(this.styleLights.hemisphere);
    this.scene.add(this.styleLights.key);
    this.scene.add(this.styleLights.fill);
    this.scene.add(this.styleLights.rim);
    applyMtoonProfileToScene(this.scene, this.styleLights, this.styleProfile);

    const floorMaterial = new THREE.MeshStandardMaterial({
      color: '#111C2E',
      roughness: 0.82,
      metalness: 0.12,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.8, 64), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: '#3B82F6',
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.52, 1.57, 96), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;
    this.scene.add(ring);

    this.camera.position.set(0, 1.2, 4.2);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.applyOrbitLimits('default');
    this.controls.target.set(0, 1, 0);
    this.controls.update();

    this.loader.crossOrigin = 'anonymous';
    this.loader.register((parser) => new VRMLoaderPlugin(parser));

    this.renderer.setAnimationLoop(() => {
      if (this.disposed) return;
      const delta = this.clock.getDelta();
      this.currentVrm?.update(delta);
      this.animationRuntime.update(delta);
      this.controls.update();
      this.resize();
      this.renderer.render(this.scene, this.camera);
    });
  }

  async loadModel(url: string, avatar: CharacterAvatarDto, manifest: AvatarAssetManifest): Promise<void> {
    if (this.disposed) return;

    const version = ++this.loadVersion;
    this.currentAvatar = avatar;
    this.currentManifest = manifest;
    // Anchors of the incoming model must not be bound onto the outgoing mesh mid-load.
    this.faceAnchorsModelUrl = null;

    const safeUrl = normalizeAvatarModelUrl(url);
    if (!safeUrl) {
      this.removeCurrentModel();
      this.onStateChange({
        status: 'error',
        message: 'Die 3D-Modell-URL ist nicht zulässig. Erlaubt sind lokale oder HTTPS-VRM/GLB-Dateien.',
      });
      return;
    }

    this.onStateChange({ status: 'loading', message: `Lade ${manifest.displayName} …` });

    try {
      // Host AssetPorts URLs need the Better Auth cookie on cross-origin absolute hosts.
      this.loader.setWithCredentials(/\/api\/v1\/assets\//.test(safeUrl));
      const gltf = await this.loader.loadAsync(safeUrl);
      const vrm = getVrm(gltf.userData as unknown);
      if (vrm) {
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        VRMUtils.combineMorphs(vrm);
        VRMUtils.rotateVRM0(vrm);
      }

      const root = vrm?.scene ?? gltf.scene;
      prepareModel(root);
      centerModel(root);

      if (this.disposed || version !== this.loadVersion) {
        VRMUtils.deepDispose(root);
        return;
      }

      this.removeCurrentModel();
      this.currentRoot = root;
      this.currentVrm = vrm;
      this.modelContainer.add(root);
      // VRM ships MToon materials — enable profile by default.
      // Meshy/species GLBs are PBR: start with style off so authored maps/factors stay intact.
      this.mtoonStyleEnabled = Boolean(vrm);
      this.materialStyleSnapshots = captureMaterialStyleSnapshots(root);
      this.applyAppearance(this.currentAvatar ?? avatar, this.currentManifest ?? manifest);
      this.setInspectMode(false);
      this.fitCamera();
      this.lastRigAnalysis = analyzeAvatarRigFromObject3D(root, { vrm });
      this.onRigAnalysis?.(this.lastRigAnalysis);
      this.animationRuntime.bind(root, this.lastRigAnalysis);
      this.facialRuntime.bind(vrm);
      this.bindHumanoidBones(vrm, this.lastRigAnalysis);
      this.rebuildLiveActAvatarOutput();
      this.liveActRigDebug.bindModelRoot(root);
      this.liveActCharacterFaceDebug.bindModelRoot(root);
      this.faceAnchorsModelUrl = safeUrl;
      this.syncCharacterFaceAnchors(this.currentAvatar ?? avatar, true);
      this.rigidEquipmentRuntime.bindAvatar(root, this.lastRigAnalysis);
      this.skinnedWearableRuntime.bindAvatar(root, this.lastRigAnalysis);
      this.onStateChange({
        status: 'ready',
        message: vrm ? `${manifest.displayName} · VRM` : `${manifest.displayName} · glTF`,
      });
    } catch (error) {
      if (this.disposed || version !== this.loadVersion) return;
      const detail = error instanceof Error ? error.message : 'Unbekannter Ladefehler';
      this.onStateChange({ status: 'error', message: `3D-Modell konnte nicht geladen werden: ${detail}` });
    }
  }

  /**
   * Replace runtime overlays (e.g. helmet that hides hair). Does not touch persisted base traits.
   */
  setRuntimeOverlays(overlays: readonly RuntimeTraitOverlay[]): void {
    this.runtimeOverlays = [...overlays];
    if (this.currentAvatar && this.currentManifest) {
      this.applyAppearance(this.currentAvatar, this.currentManifest);
    }
  }

  setRigidEquipmentUrlResolver(resolveUrl: ResolveRigidEquipmentUrl): void {
    this.rigidEquipmentRuntime.setUrlResolver(resolveUrl);
  }

  /** Apply #158 visual projection — rigid only; fail-soft; no inventory mutation. */
  async applyRigidEquipmentVisuals(visuals: readonly AvatarEquipmentVisual[]): Promise<void> {
    await this.rigidEquipmentRuntime.applyVisuals(visuals);
  }

  setSkinnedWearableUrlResolver(resolveUrl: ResolveSkinnedWearableUrl): void {
    this.skinnedWearableRuntime.setUrlResolver(resolveUrl);
  }

  async applySkinnedWearableVisuals(visuals: readonly AvatarEquipmentVisual[]): Promise<void> {
    await this.skinnedWearableRuntime.applyVisuals(visuals);
  }

  getRigidEquipmentRuntime(): AvatarRigidEquipmentRuntime {
    return this.rigidEquipmentRuntime;
  }

  getSkinnedWearableRuntime(): AvatarSkinnedWearableRuntime {
    return this.skinnedWearableRuntime;
  }

  getLastRigAnalysis(): AvatarRigAnalysisResult | undefined {
    return this.lastRigAnalysis;
  }

  getTraitLifecycle(): TraitLifecycleThreeAdapter {
    return this.traitLifecycle;
  }

  getStyleCompatibility(): MtoonStyleCompatibility {
    return this.styleCompatibility;
  }

  getStyleProfile(): SagaTreeMToonProfileV1 {
    return this.styleProfile;
  }

  /** Editor-only preview toggle — not written to appearance.avatar. */
  isMtoonStyleEnabled(): boolean {
    return this.mtoonStyleEnabled;
  }

  setMtoonStyleEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.mtoonStyleEnabled = enabled;
    if (this.currentAvatar && this.currentManifest) {
      this.applyAppearance(this.currentAvatar, this.currentManifest);
    }
  }

  getLookRuntime(): LookRuntime {
    return this.lookRuntime;
  }

  getLastLookApplyResult(): LookRuntimeApplyResult | null {
    return this.lastLookApply;
  }

  /**
   * Apply a LookProfileVersion via provider-neutral LookRuntime (#342).
   * Restores material baseline before apply; AvatarCanvas stays ToonLab-free.
   */
  applyLookProfile(
    version: LookProfileVersion,
    executionMode: LookExecutionMode = 'realtime',
  ): LookRuntimeApplyResult {
    if (this.disposed || !this.currentRoot || !this.currentAvatar) {
      const empty: LookRuntimeApplyResult = {
        status: 'unsupported',
        providerId: 'none',
        profileId: version.profileId,
        version: version.version,
        executionMode,
        capabilities: [],
        noticeDe: 'Kein Avatar geladen.',
      };
      this.lastLookApply = empty;
      return empty;
    }
    const clothingColor = clothingTint(this.currentAvatar.traits.clothing);
    const result = this.lookRuntime.applyLookProfile(
      version,
      {
        root: this.currentRoot,
        scene: this.scene,
        styleLights: this.styleLights,
        materialSnapshots: this.materialStyleSnapshots,
        isImportModel: Boolean(this.currentAvatar.model_url),
        colors: {
          skin: this.currentAvatar.colors.skin,
          hair: this.currentAvatar.colors.hair,
          clothing: clothingColor,
          eyes: this.currentAvatar.colors.eyes,
        },
      },
      executionMode,
    );
    this.lastLookApply = result;
    this.mtoonStyleEnabled = result.status === 'applied' || result.status === 'partial';
    this.renderNow();
    return result;
  }

  /** Restore load-time PBR Neutral baseline (#342). */
  restorePbrNeutralLook(): LookRuntimeApplyResult {
    if (this.disposed || !this.currentRoot) {
      const empty: LookRuntimeApplyResult = {
        status: 'unsupported',
        providerId: 'none',
        profileId: null,
        version: null,
        executionMode: null,
        capabilities: [],
        noticeDe: 'Kein Avatar geladen.',
      };
      this.lastLookApply = empty;
      return empty;
    }
    const result = this.lookRuntime.restorePbrNeutral({
      root: this.currentRoot,
      scene: this.scene,
      styleLights: this.styleLights,
      materialSnapshots: this.materialStyleSnapshots,
      isImportModel: Boolean(this.currentAvatar?.model_url),
      colors: {},
    });
    this.lastLookApply = result;
    this.mtoonStyleEnabled = false;
    if (this.currentAvatar && this.currentManifest) {
      this.applyAppearance(this.currentAvatar, this.currentManifest);
    } else {
      this.renderNow();
    }
    return result;
  }

  playAnimation(actionId: AvatarAnimationActionId): boolean {
    return this.animationRuntime.play(actionId);
  }

  getAnimationRuntime(): AvatarAnimationRuntime {
    return this.animationRuntime;
  }

  setPrefersReducedMotion(value: boolean): void {
    this.animationRuntime.setPrefersReducedMotion(value);
  }

  setFacialWeight(key: FacialCanonicalKey, weight: number): boolean {
    return this.facialRuntime.setWeight(key, weight);
  }

  resetFacialToNeutral(): void {
    this.facialRuntime.resetToNeutral();
  }

  getFacialRuntime(): AvatarFacialRuntime {
    return this.facialRuntime;
  }

  /** LiveAct output adapter for the loaded model; null until ready. */
  getLiveActAvatarOutput(): LiveActAvatarOutput | null {
    if (this.faceMappingAuthoringActive) return null;
    return this.liveActAvatarOutput;
  }

  /** Procedural clips pause while LiveAct drives this runtime so they cannot overwrite the head pose. */
  setLiveActDriveActive(active: boolean): void {
    this.liveActDriveSuspendReason = active;
    this.syncAnimationSuspendReasons();
  }

  /**
   * Merge independent suspension reasons so LiveAct cleanup cannot resume clips
   * while Face Mapping authoring still needs a frozen pose.
   */
  private syncAnimationSuspendReasons(): void {
    this.animationRuntime.setSuspended(
      this.liveActDriveSuspendReason || this.faceMappingSuspendReason,
    );
  }

  /** Asset/bone/morph inventory only — compose with engine input in app (#381). */
  getLiveActAvatarCapabilities(): LiveActAvatarCapabilities | null {
    return this.liveActAvatarOutput?.getAvatarCapabilities() ?? null;
  }

  /** True when the loaded model exposes a skinned skeleton for debug overlay. */
  hasLiveActSkeleton(): boolean {
    return this.liveActRigDebug.hasSkeleton();
  }

  /** Ephemeral viewport debug — not persisted (#333). */
  setLiveActRigDebugEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.liveActRigDebug.setEnabled(enabled);
  }

  /** Deformed mesh face anchor overlay — not persisted (#400). */
  setLiveActCharacterFaceDebugEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.liveActCharacterFaceDebug.setEnabled(enabled);
  }

  /** True when face-anchors.json loaded and bound for the current model. */
  hasLiveActCharacterFaceMapping(): boolean {
    return this.liveActCharacterFaceDebug.isMappingAvailable();
  }

  /** Read-only handle for app-layer canvas overlay (no Three.js leaks). */
  getLiveActCharacterFaceDebugHandle(): LiveActCharacterFaceDebugHandle {
    return this.liveActCharacterFaceDebug.getHandle();
  }

  /** Bound SagaTreeFaceAnchorsV1 for the current model (may be null). */
  getFaceAnchorsManifest(): SagaTreeFaceAnchorsManifestV1 | null {
    return this.liveActCharacterFaceDebug.getManifest();
  }

  /**
   * Session-local rebind for Face Mapping „Übernehmen“ — does not write disk/network.
   */
  bindFaceAnchorsManifestSession(manifest: SagaTreeFaceAnchorsManifestV1 | null): void {
    if (this.disposed) return;
    this.liveActCharacterFaceDebug.bindManifest(manifest);
  }

  /** Face Setup authoring: neutralize pose, suppress LiveAct drive, frame face frontal. */
  setFaceMappingAuthoringActive(active: boolean): void {
    if (this.disposed) return;
    this.faceMappingAuthoringActive = active;
    // Independent of LiveAct drive — cleanup must not unsuspend while authoring.
    this.faceMappingSuspendReason = active;
    this.syncAnimationSuspendReasons();
    if (active) {
      this.resetLiveActPose();
      this.resetFaceTrackingPose();
      this.setLiveActCharacterFaceDebugEnabled(false);
      this.setLiveActRigDebugEnabled(false);
      this.applyCameraFrame('face');
      // Zoom/pan allowed for precise placement; rotate stays off so marker drag wins.
      this.applyFaceMappingOrbitMode(false);
    } else {
      this.controls.enableRotate = true;
      this.controls.enabled = true;
      this.applyOrbitLimits(this.inspectMode ? 'inspect' : 'default');
    }
  }

  isFaceMappingAuthoringActive(): boolean {
    return this.faceMappingAuthoringActive;
  }

  /**
   * During Face Mapping: disable rotate always; disable zoom/pan only while dragging a marker.
   * Outside Face Mapping: toggles OrbitControls.enabled (legacy #420).
   */
  setOrbitControlsEnabled(enabled: boolean): void {
    if (this.disposed) return;
    if (this.faceMappingAuthoringActive) {
      this.applyFaceMappingOrbitMode(!enabled);
      return;
    }
    this.controls.enabled = enabled;
  }

  /**
   * Scroll-wheel zoom while the marker overlay owns pointer events.
   * Positive deltaY = zoom out, negative = zoom in (browser wheel convention).
   */
  dollyFaceMappingCamera(deltaY: number): void {
    if (this.disposed || !this.faceMappingAuthoringActive) return;
    if (!Number.isFinite(deltaY) || deltaY === 0) return;

    const offset = this.camera.position.clone().sub(this.controls.target);
    const distance = offset.length();
    if (!(distance > 1e-6)) return;

    // ~10% per 100px wheel notch; clamp to face-mapping limits.
    const factor = Math.exp(deltaY * 0.0015);
    const minD = 0.06;
    const maxD = 2.5;
    const next = Math.min(maxD, Math.max(minD, distance * factor));
    offset.multiplyScalar(next / distance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  /**
   * Screen-space pan (CSS pixels). Drag up → look higher on the face (Stirn).
   * Moves camera + orbit target together so framing stays frontal.
   */
  panFaceMappingCamera(deltaXPx: number, deltaYPx: number): void {
    if (this.disposed || !this.faceMappingAuthoringActive) return;
    if (!Number.isFinite(deltaXPx) || !Number.isFinite(deltaYPx)) return;
    if (deltaXPx === 0 && deltaYPx === 0) return;

    const canvas = this.renderer.domElement;
    const height = Math.max(1, canvas.clientHeight);
    const distance = this.camera.position.distanceTo(this.controls.target);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const worldPerPixel = (2 * Math.tan(fov / 2) * distance) / height;

    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    right.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    up.setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();

    // Drag right → content moves right (camera left); drag up (negative deltaY) → look higher.
    const move = right
      .multiplyScalar(-deltaXPx * worldPerPixel)
      .addScaledVector(up, -deltaYPx * worldPerPixel);

    this.camera.position.add(move);
    this.controls.target.add(move);
    this.controls.update();
  }

  /** Face-mapping camera: zoom + pan, no rotate. `draggingMarker` freezes camera. */
  private applyFaceMappingOrbitMode(draggingMarker: boolean): void {
    this.controls.enabled = true;
    this.controls.enableRotate = false;
    this.controls.enableZoom = !draggingMarker;
    this.controls.enablePan = !draggingMarker;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.06;
    this.controls.maxDistance = 2.5;
    this.controls.minPolarAngle = 0.05;
    this.controls.maxPolarAngle = Math.PI - 0.05;
    this.controls.update();
  }

  /**
   * Shared Face Mapping world scale (Manual + Auto): interocular distance between
   * anatomical outer canthi in world space.
   *
   * Prefer evaluated draft bindings; else first allowlisted ray hits at canvas points
   * (Auto MediaPipe outer-eye samples). Returns null when scale cannot be measured.
   */
  resolveFaceMappingFaceWidthWorld(input?: {
    readonly leftOuterBinding?: SagaTreeFaceAnchorTriangleBinding | null;
    readonly rightOuterBinding?: SagaTreeFaceAnchorTriangleBinding | null;
    readonly leftOuterCanvas?: { readonly x: number; readonly y: number } | null;
    readonly rightOuterCanvas?: { readonly x: number; readonly y: number } | null;
  }): number | null {
    if (this.disposed || !this.currentRoot) return null;

    const leftBinding = input?.leftOuterBinding ?? null;
    const rightBinding = input?.rightOuterBinding ?? null;
    if (leftBinding && rightBinding) {
      const lp = this.evaluateFaceMappingBindingWorld(leftBinding, 'eyeLeftOuter');
      const rp = this.evaluateFaceMappingBindingWorld(rightBinding, 'eyeRightOuter');
      const fromBindings = computeFaceMappingFaceWidthWorld(lp, rp);
      if (fromBindings != null) return fromBindings;
    }

    const leftCanvas = input?.leftOuterCanvas ?? null;
    const rightCanvas = input?.rightOuterCanvas ?? null;
    if (leftCanvas && rightCanvas) {
      const lHits = this.listFaceMappingRaycastCandidatesAtCanvas(leftCanvas.x, leftCanvas.y);
      const rHits = this.listFaceMappingRaycastCandidatesAtCanvas(rightCanvas.x, rightCanvas.y);
      const lp = lHits[0]?.worldPoint ?? null;
      const rp = rHits[0]?.worldPoint ?? null;
      return computeFaceMappingFaceWidthWorld(lp, rp);
    }

    return null;
  }

  /**
   * Raycast canvas-local pointer to a triangle binding on allowlisted avatar meshes.
   * Manual Mapping: same screen ray → scale-aware strict surface select (no screen-snap,
   * no expanded pass). When `anchorId` is omitted, falls back to nearest hit (legacy).
   */
  raycastFaceMappingAtCanvas(
    canvasX: number,
    canvasY: number,
    options?: {
      readonly anchorId?: SagaTreeFaceAnchorId;
      readonly faceWidthWorld?: number | null;
      /** Draft outer-eye bindings used when faceWidthWorld is omitted. */
      readonly leftOuterBinding?: SagaTreeFaceAnchorTriangleBinding | null;
      readonly rightOuterBinding?: SagaTreeFaceAnchorTriangleBinding | null;
    },
  ): FaceMappingRaycastHitV1 | null {
    if (this.disposed || !this.currentRoot) return null;
    const canvas = this.renderer.domElement;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    const anchorId = options?.anchorId;
    const faceWidthWorld =
      options?.faceWidthWorld !== undefined
        ? options.faceWidthWorld
        : this.resolveFaceMappingFaceWidthWorld({
            leftOuterBinding: options?.leftOuterBinding,
            rightOuterBinding: options?.rightOuterBinding,
          });
    return raycastFaceMappingPointer({
      camera: this.camera,
      root: this.currentRoot,
      canvasWidth: width,
      canvasHeight: height,
      canvasX,
      canvasY,
      selectCandidate: anchorId
        ? (candidates) => {
            const selection = selectFaceMappingSurfaceAwareCandidate(
              candidates.map((c) => ({
                order: c.order,
                distance: c.distance,
                nodeIdentity: c.nodeIdentity,
              })),
              anchorId,
              {
                faceWidthWorld,
                allowSameRayExpandedDepth: false,
              },
            );
            if (selection.selectedIndex == null) return null;
            return candidates[selection.selectedIndex] ?? null;
          }
        : undefined,
    });
  }

  /** Ordered allowlisted hits for Auto surface-aware selection (#421). */
  listFaceMappingRaycastCandidatesAtCanvas(
    canvasX: number,
    canvasY: number,
  ): FaceMappingRaycastCandidateV1[] {
    if (this.disposed || !this.currentRoot) return [];
    const canvas = this.renderer.domElement;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    return listFaceMappingRaycastCandidates({
      camera: this.camera,
      root: this.currentRoot,
      canvasWidth: width,
      canvasHeight: height,
      canvasX,
      canvasY,
    });
  }

  /** Project world point to canvas CSS pixels (null if behind camera). */
  projectWorldToFaceMappingCanvas(
    x: number,
    y: number,
    z: number,
  ): { x: number; y: number } | null {
    if (this.disposed) return null;
    const canvas = this.renderer.domElement;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    this.faceMappingProjectScratch.set(x, y, z).project(this.camera);
    if (
      !Number.isFinite(this.faceMappingProjectScratch.x) ||
      !Number.isFinite(this.faceMappingProjectScratch.y)
    ) {
      return null;
    }
    if (this.faceMappingProjectScratch.z > 1) return null;
    return {
      x: (this.faceMappingProjectScratch.x * 0.5 + 0.5) * width,
      y: (-this.faceMappingProjectScratch.y * 0.5 + 0.5) * height,
    };
  }

  /** Evaluate a draft binding to world coordinates (null if unavailable). */
  evaluateFaceMappingBindingWorld(
    binding: SagaTreeFaceAnchorTriangleBinding,
    anchorId: SagaTreeFaceAnchorId = 'noseTip',
  ): { x: number; y: number; z: number } | null {
    if (this.disposed || !this.currentRoot) return null;
    const index = buildFaceAnchorNodeIndex(this.currentRoot);
    const result = evaluateFaceAnchorWorldPosition(index, anchorId, binding);
    if (result.status !== 'available') return null;
    return { x: result.x, y: result.y, z: result.z };
  }

  getFaceMappingCanvasElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * Shared camera/pose state for Auto Mapping capture + GT screen freeze (#421).
   * Keeps reference and proposal projections on the same face frame.
   */
  applyFaceMappingAutoCameraState(): void {
    if (this.disposed) return;
    this.resetLiveActPose();
    this.resetFaceTrackingPose();
    this.applyCameraFrame('face');
    this.controls.update();
  }

  /**
   * Run fn with face-mapping-excluded equipment hidden and masked base surfaces revealed.
   * Nestable: visibility is restored only when the outermost scope exits (always in finally).
   * Use around MediaPipe capture AND subsequent Auto raycasts so 2D detection and 3D binding
   * see the same uncovered base face.
   */
  withFaceMappingBaseFaceCapture<T>(fn: () => T): T {
    this.beginFaceMappingBaseFaceCaptureScope();
    try {
      return fn();
    } finally {
      this.endFaceMappingBaseFaceCaptureScope();
    }
  }

  private beginFaceMappingBaseFaceCaptureScope(): void {
    if (this.faceMappingBaseFaceCaptureDepth === 0) {
      if (!this.currentRoot || this.disposed) {
        this.faceMappingBaseFaceCaptureRestore = () => undefined;
      } else {
        const restoreRigid = this.rigidEquipmentRuntime.beginFaceMappingBaseFaceCapture();
        const restoreSkinned = this.skinnedWearableRuntime.beginFaceMappingBaseFaceCapture();
        const restoreExcludedMarkers = this.beginFaceMappingExcludedMarkerCapture(this.currentRoot);
        this.faceMappingBaseFaceCaptureRestore = () => {
          restoreExcludedMarkers();
          restoreSkinned();
          restoreRigid();
        };
      }
    }
    this.faceMappingBaseFaceCaptureDepth += 1;
  }

  private endFaceMappingBaseFaceCaptureScope(): void {
    this.faceMappingBaseFaceCaptureDepth = Math.max(0, this.faceMappingBaseFaceCaptureDepth - 1);
    if (this.faceMappingBaseFaceCaptureDepth === 0 && this.faceMappingBaseFaceCaptureRestore) {
      const restore = this.faceMappingBaseFaceCaptureRestore;
      this.faceMappingBaseFaceCaptureRestore = null;
      restore();
    }
  }

  /**
   * Deterministic frontal capture for Auto Mapping (#421).
   * Neutral pose + face camera frame; returns a 2D canvas copy (no upload/persist).
   * CSS size matches Manual Mapping raycast coordinates.
   *
   * Opens a nestable base-face visibility scope for the render. Prefer wrapping the full
   * Auto Mapping capture+raycast flow in `withFaceMappingBaseFaceCapture` so raycasts still
   * see the uncovered face after this method returns.
   */
  captureFaceMappingAutoFrame(): {
    image: HTMLCanvasElement;
    canvasWidth: number;
    canvasHeight: number;
  } | null {
    if (this.disposed || !this.currentRoot) return null;

    return this.withFaceMappingBaseFaceCapture(() => {
      this.applyFaceMappingAutoCameraState();
      this.renderer.render(this.scene, this.camera);

      const src = this.renderer.domElement;
      const canvasWidth = Math.max(1, Math.round(src.clientWidth));
      const canvasHeight = Math.max(1, Math.round(src.clientHeight));
      if (!(src.width > 0) || !(src.height > 0)) return null;

      const image = document.createElement('canvas');
      image.width = src.width;
      image.height = src.height;
      const ctx = image.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(src, 0, 0);
      return { image, canvasWidth, canvasHeight };
    });
  }

  /**
   * Hide objects explicitly marked sagatreeExcludeFaceMapping for one capture frame.
   * Complements rigid/skinned runtime groups (same exclude contract as raycast).
   */
  private beginFaceMappingExcludedMarkerCapture(root: THREE.Object3D): () => void {
    const hide: THREE.Object3D[] = [];
    root.traverse((obj) => {
      if (obj.userData?.sagatreeExcludeFaceMapping === true) {
        hide.push(obj);
      }
    });
    if (hide.length === 0) {
      return () => undefined;
    }
    return beginFaceMappingBaseFaceCaptureVisibility({ hide, reveal: [] });
  }

  /**
   * Apply local face-tracking drive (#12) onto head bone + facial weights.
   * Ephemeral only — never written into appearance.avatar.
   */
  applyFaceTrackingDrive(drive: FaceTrackingDrive): void {
    if (this.disposed || this.faceMappingAuthoringActive) return;
    if (this.headBone) {
      this.headScratchEuler.set(drive.head.pitch, drive.head.yaw, drive.head.roll, 'YXZ');
      this.headScratchQuaternion.setFromEuler(this.headScratchEuler);
      this.headBone.quaternion.copy(this.headRestQuaternion).multiply(this.headScratchQuaternion);
    }
    const lookAt = this.currentVrm?.lookAt;
    if (lookAt) {
      this.eyeLookTarget.set(
        drive.eyeLookX * 0.35,
        1.55 + drive.eyeLookY * 0.2,
        1.2,
      );
      lookAt.lookAt(this.eyeLookTarget);
    }
    const batch: Partial<Record<FacialCanonicalKey, number>> = {};
    for (const [key, weight] of Object.entries(drive.facialWeights)) {
      batch[key as FacialCanonicalKey] = weight ?? 0;
    }
    this.facialRuntime.applyWeightsBatch(batch);
  }

  resetFaceTrackingPose(): void {
    if (this.headBone) {
      this.headBone.quaternion.copy(this.headRestQuaternion);
    }
    this.facialRuntime.resetToNeutral();
  }

  resetLiveActPose(): void {
    this.liveActAvatarOutput?.resetLiveActPose();
  }

  /** True when a model is loaded and can be snapshotted. */
  isPortraitReady(): boolean {
    return !this.disposed && Boolean(this.currentRoot);
  }

  isInspectMode(): boolean {
    return this.inspectMode;
  }

  /**
   * Inspect mode: pan + closer zoom so users can look at face, shoes, etc.
   * Default mode keeps the locked full-body orbit from launch.
   */
  setInspectMode(enabled: boolean): void {
    if (this.disposed) return;
    this.inspectMode = enabled;
    this.applyOrbitLimits(enabled ? 'inspect' : 'default');
    this.controls.update();
  }

  /** Jump orbit target to a body region; close frames auto-enable inspect. */
  applyCameraFrame(frame: AvatarCameraFrameId): void {
    if (this.disposed || !this.currentRoot) return;
    if (frame === 'face' || frame === 'feet' || frame === 'portrait') {
      this.setInspectMode(true);
    }
    if (frame === 'full') {
      this.fitCamera();
      return;
    }
    if (frame === 'portrait') {
      this.fitPortraitCamera();
      return;
    }
    if (frame === 'face') {
      this.fitRegionCamera({
        bandMin: 0.78,
        bandMax: 1,
        heightScale: 0.55,
        preferBone: this.headBone,
        boneYBias: -0.04,
      });
      return;
    }
    this.fitRegionCamera({
      bandMin: 0,
      bandMax: 0.18,
      heightScale: 0.5,
      preferBone: this.leftFootBone ?? this.rightFootBone,
      boneYBias: 0.06,
    });
  }

  /** Exit inspect limits and restore full-body framing. */
  resetCamera(): void {
    if (this.disposed) return;
    this.setInspectMode(false);
    this.fitCamera();
  }

  /**
   * Portrait capture — same renderer/style path as live preview.
   * Temporarily frames head + upper torso, then restores the live camera.
   */
  capturePortraitDataUrl(): string {
    const prevTarget = this.controls.target.clone();
    const prevPosition = this.camera.position.clone();
    const prevNear = this.camera.near;
    const prevFar = this.camera.far;
    try {
      this.fitPortraitCamera();
      return this.liveActCharacterFaceDebug.runWithoutSampling(() =>
        this.liveActRigDebug.runWithoutHelper(() => {
          this.renderNow();
          return capturePortraitFromRenderer(this.renderer);
        }),
      );
    } finally {
      this.controls.target.copy(prevTarget);
      this.camera.position.copy(prevPosition);
      this.camera.near = prevNear;
      this.camera.far = prevFar;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this.renderNow();
    }
  }

  applyAppearance(avatar: CharacterAvatarDto, manifest: AvatarAssetManifest): void {
    this.currentAvatar = avatar;
    this.currentManifest = manifest;
    this.syncCharacterFaceAnchors(avatar);
    const root = this.currentRoot;
    if (!root) return;

    const base: BaseTraitSelection = {
      head: avatar.traits.head,
      ears: avatar.traits.ears,
      hair: avatar.traits.hair,
      clothing: avatar.traits.clothing,
      accessory: avatar.traits.accessory,
    };
    const effective = resolveEffectiveTraits(base, this.runtimeOverlays);
    const hairHidden =
      effective.hiddenGroups.includes('hair') || effective.traits.hair === 'bald';

    const widthScale = 0.88 + avatar.body.size * 0.0024;
    const heightScale = 0.88 + avatar.body.height * 0.0024;
    this.modelContainer.scale.set(
      manifest.modelScale * widthScale,
      manifest.modelScale * heightScale,
      manifest.modelScale * widthScale,
    );

    const clothingColor = clothingTint(effective.traits.clothing ?? avatar.traits.clothing);
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const semanticName = `${object.name}`.toLowerCase();
      if (includesHint(semanticName, manifest.materialHints.hair)) {
        object.visible = !hairHidden;
      }
    });

    // Always restore load-time baseline before (re)applying profile — keeps toggle + re-tint stable.
    if (this.materialStyleSnapshots.length > 0) {
      restoreMaterialStyleSnapshots(this.materialStyleSnapshots);
    }

    const isImportModel = Boolean(avatar.model_url);
    if (this.mtoonStyleEnabled) {
      applyMtoonProfileToScene(this.scene, this.styleLights, this.styleProfile);
      this.styleCompatibility = applyMtoonProfileToModel({
        root,
        profile: this.styleProfile,
        isImportModel,
        colors: {
          skin: avatar.colors.skin,
          hair: avatar.colors.hair,
          clothing: clothingColor,
          eyes: avatar.colors.eyes,
        },
      });
    } else {
      applyNeutralPreviewLights(this.scene, this.styleLights);
      this.styleCompatibility = {
        path: 'pbr-fallback',
        noticeDe: null,
      };
    }
  }

  renderNow(): void {
    if (this.disposed) return;
    this.resize();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Apply morph contract values to existing morph targets without reloading the model.
   * Unknown target names are skipped (fail-safe).
   */
  applyMorphState(morph: {
    body: Readonly<Record<string, number>>;
    face: Readonly<Record<string, number>>;
  }): void {
    const root = this.currentRoot;
    if (!root) return;

    const weights: Record<string, number> = {};
    for (const [key, value] of Object.entries(morph.body)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        weights[`sd_body_${key}`] = Math.max(-1, Math.min(1, value));
      }
    }
    for (const [key, value] of Object.entries(morph.face)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        weights[`sd_face_${key}`] = Math.max(-1, Math.min(1, value));
      }
    }

    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const dictionary = object.morphTargetDictionary;
      const influences = object.morphTargetInfluences;
      if (!dictionary || !influences) return;
      for (const [targetName, weight] of Object.entries(weights)) {
        const index = dictionary[targetName];
        if (typeof index !== 'number') continue;
        // Morph targets typically expect 0..1; map [-1,1] → [0,1] around neutral 0.5.
        influences[index] = (weight + 1) / 2;
      }
    });
  }

  private fitCamera(): void {
    if (!this.currentRoot) return;
    this.modelContainer.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(this.modelContainer);
    if (bounds.isEmpty()) return;

    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = Math.max(1.6, (size.y * 0.58) / Math.tan(verticalFov / 2));
    this.controls.target.set(center.x, center.y * 0.96, center.z);
    this.camera.position.set(center.x, center.y * 0.98, center.z + distance * 1.08);
    this.camera.near = Math.max(0.01, distance / 100);
    this.camera.far = Math.max(30, distance * 8);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /**
   * Frame head + upper torso for portrait snapshots (Meshy/import and manual generate).
   * Prefers VRM head bone when present; otherwise uses the top ~55% of the model AABB.
   */
  private fitPortraitCamera(): void {
    this.fitRegionCamera({
      bandMin: 0.45,
      bandMax: 1,
      heightScale: 0.72,
      preferBone: this.headBone,
      boneYBias: -0.18,
      minDistance: 0.85,
    });
  }

  private fitRegionCamera(options: {
    bandMin: number;
    bandMax: number;
    heightScale: number;
    preferBone: THREE.Object3D | null;
    boneYBias: number;
    minDistance?: number;
  }): void {
    if (!this.currentRoot) return;
    this.modelContainer.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(this.modelContainer);
    if (bounds.isEmpty()) return;

    const size = bounds.getSize(new THREE.Vector3());
    const fullCenter = bounds.getCenter(new THREE.Vector3());
    const regionMinY = bounds.min.y + size.y * options.bandMin;
    const regionMaxY = bounds.min.y + size.y * options.bandMax;
    const regionHeight = Math.max(0.2, regionMaxY - regionMinY);
    const center = new THREE.Vector3(fullCenter.x, (regionMinY + regionMaxY) / 2, fullCenter.z);

    if (options.preferBone) {
      const boneWorld = new THREE.Vector3();
      options.preferBone.getWorldPosition(boneWorld);
      center.x = boneWorld.x;
      center.z = boneWorld.z;
      center.y = boneWorld.y + regionHeight * options.boneYBias;
    }

    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = Math.max(
      options.minDistance ?? 0.45,
      (regionHeight * options.heightScale) / Math.tan(verticalFov / 2),
    );
    this.controls.target.copy(center);
    this.camera.position.set(center.x, center.y + regionHeight * 0.02, center.z + distance);
    this.camera.near = Math.max(0.01, distance / 100);
    this.camera.far = Math.max(30, distance * 8);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private applyOrbitLimits(mode: 'default' | 'inspect'): void {
    if (mode === 'inspect') {
      this.controls.enablePan = true;
      this.controls.screenSpacePanning = true;
      this.controls.minDistance = 0.35;
      this.controls.maxDistance = 8;
      this.controls.minPolarAngle = 0.08;
      this.controls.maxPolarAngle = Math.PI - 0.08;
      return;
    }
    this.controls.enablePan = false;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 7;
    this.controls.minPolarAngle = Math.PI * 0.18;
    this.controls.maxPolarAngle = Math.PI * 0.72;
  }

  private resize(): void {
    const canvas = this.renderer.domElement;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.round(width * pixelRatio);
    const targetHeight = Math.round(height * pixelRatio);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Rebinds character anchors whenever `avatar.face_anchors` changes for the loaded model
   * (e.g. hydration of a draft whose model URL/manifest stayed the same).
   */
  private syncCharacterFaceAnchors(avatar: CharacterAvatarDto, force = false): void {
    const modelUrl = this.faceAnchorsModelUrl;
    if (!modelUrl) return;
    const override = avatar.face_anchors ?? null;
    if (!force && override === this.faceAnchorsOverrideSource) return;
    this.faceAnchorsOverrideSource = override;
    void this.loadFaceAnchorsManifestForModel(modelUrl, override);
  }

  private async loadFaceAnchorsManifestForModel(
    modelUrl: string,
    characterOverride: SagaTreeFaceAnchorsManifestV1 | null = null,
  ): Promise<void> {
    const token = ++this.faceAnchorManifestLoadToken;
    // Character-persisted anchors win over asset sidecar (#persist).
    if (characterOverride) {
      const parsed = parseFaceAnchorsManifestV1(characterOverride);
      if (parsed.ok && token === this.faceAnchorManifestLoadToken) {
        this.liveActCharacterFaceDebug.bindManifest(parsed.manifest);
        return;
      }
    }
    this.liveActCharacterFaceDebug.bindManifest(null);
    const candidates = listFaceAnchorsManifestUrlCandidates(modelUrl);
    if (!candidates.length) return;
    for (const manifestUrl of candidates) {
      try {
        const response = await fetch(manifestUrl);
        if (!response.ok || token !== this.faceAnchorManifestLoadToken) continue;
        const payload: unknown = await response.json();
        if (token !== this.faceAnchorManifestLoadToken) return;
        const parsed = parseFaceAnchorsManifestV1(payload);
        if (parsed.ok) {
          this.liveActCharacterFaceDebug.bindManifest(parsed.manifest);
          return;
        }
      } catch {
        // Try next candidate — mapping stays unavailable if all fail (#400).
      }
    }
  }

  private bindHumanoidBones(
    vrm: VRM | undefined,
    rigAnalysis: AvatarRigAnalysisResult | undefined,
  ): void {
    this.headBone = null;
    this.leftFootBone = null;
    this.rightFootBone = null;
    const humanoid = vrm?.humanoid as
      | {
          getNormalizedBoneNode?: (name: string) => THREE.Object3D | null;
          getRawBoneNode?: (name: string) => THREE.Object3D | null;
        }
      | undefined;
    if (humanoid) {
      const pick = (name: string): THREE.Object3D | null =>
        humanoid.getNormalizedBoneNode?.(name) ?? humanoid.getRawBoneNode?.(name) ?? null;
      const head = pick('head');
      if (head) {
        this.headBone = head;
        this.headRestQuaternion.copy(head.quaternion);
      }
      this.leftFootBone = pick('leftFoot') ?? pick('leftToes');
      this.rightFootBone = pick('rightFoot') ?? pick('rightToes');
      return;
    }

    const headBoneName = rigAnalysis?.rig.bones.head;
    if (headBoneName && this.currentRoot) {
      const head = this.currentRoot.getObjectByName(headBoneName);
      if (head) {
        this.headBone = head;
        this.headRestQuaternion.copy(head.quaternion);
      }
    }
  }

  private rebuildLiveActAvatarOutput(): void {
    this.liveActAvatarOutput?.dispose();
    this.liveActAvatarOutput = null;
    if (!this.currentRoot) return;
    this.liveActAvatarOutput = createLiveActAvatarOutput({
      root: this.currentRoot,
      vrm: this.currentVrm,
      headBone: this.headBone,
      headRestQuaternion: this.headRestQuaternion,
      headScratchEuler: this.headScratchEuler,
      headScratchQuaternion: this.headScratchQuaternion,
    });
  }

  private removeCurrentModel(): void {
    this.animationRuntime.stopAll();
    this.facialRuntime.resetToNeutral();
    this.liveActRigDebug.bindModelRoot(null);
    this.faceAnchorManifestLoadToken += 1;
    this.faceAnchorsModelUrl = null;
    this.faceAnchorsOverrideSource = null;
    this.liveActCharacterFaceDebug.bindModelRoot(null);
    this.liveActCharacterFaceDebug.bindManifest(null);
    this.liveActAvatarOutput?.dispose();
    this.liveActAvatarOutput = null;
    this.headBone = null;
    this.leftFootBone = null;
    this.rightFootBone = null;
    this.materialStyleSnapshots = [];
    this.rigidEquipmentRuntime.bindAvatar(null, null);
    this.skinnedWearableRuntime.bindAvatar(null, null);
    if (!this.currentRoot) return;
    this.modelContainer.remove(this.currentRoot);
    VRMUtils.deepDispose(this.currentRoot);
    this.currentRoot = undefined;
    this.currentVrm = undefined;
    this.modelContainer.scale.set(1, 1, 1);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.loadVersion += 1;
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.animationRuntime.dispose();
    this.facialRuntime.dispose();
    this.rigidEquipmentRuntime.dispose();
    this.skinnedWearableRuntime.dispose();
    this.liveActAvatarOutput?.dispose();
    this.liveActAvatarOutput = null;
    this.liveActRigDebug.dispose();
    this.liveActCharacterFaceDebug.dispose();
    this.traitLifecycle.dispose();
    this.runtimeOverlays = [];
    this.headBone = null;
    this.removeCurrentModel();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of materialsOf(object)) material.dispose();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

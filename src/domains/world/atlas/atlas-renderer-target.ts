/**
 * atlas-renderer-target — ATL2-D01 productive 3D renderer decision (pure domain).
 * Location: src/domains/world/atlas/atlas-renderer-target.ts
 *
 * Records the single productive 3D target for Phase D. No React / Host SDKs.
 */

/** Known 3D renderer candidates inventory (product vs parallel). */
export type AtlasRendererCandidateId =
  | 'custom-webgl-prototype-runtime'
  | 'three-spatial-viewport'
  | 'unified-three-poc'
  /** ATL3-R01B (#1296) isolated Three.js scene PoC — not mounted in the product. */
  | 'three-r01b-scene';

/** Graphics quality presets for degradable devices (AU / CE performance). */
export type AtlasGraphicsPresetId = 'high' | 'balanced' | 'lite';

export type AtlasGraphicsPreset = {
  readonly id: AtlasGraphicsPresetId;
  readonly labelDe: string;
  readonly maxPixelRatio: number;
  /** Prefer AtlasLite3D software projection when WebGL init fails or preset is lite. */
  readonly preferSoftwareFallback: boolean;
  readonly antialias: boolean;
};

export const ATLAS_GRAPHICS_PRESETS: readonly AtlasGraphicsPreset[] = [
  {
    id: 'high',
    labelDe: 'Hoch — volle WebGL-Qualität',
    maxPixelRatio: 2,
    preferSoftwareFallback: false,
    antialias: true,
  },
  {
    id: 'balanced',
    labelDe: 'Ausgewogen — begrenztes Pixelverhältnis',
    maxPixelRatio: 1.5,
    preferSoftwareFallback: false,
    antialias: true,
  },
  {
    id: 'lite',
    labelDe: 'Sparsam — Software-Fallback bevorzugt',
    maxPixelRatio: 1,
    preferSoftwareFallback: true,
    antialias: false,
  },
] as const;

/** Sole productive 3D target after ATL2-D01 (Epic #1196). */
export const ATLAS_PRODUCT_3D_TARGET: AtlasRendererCandidateId =
  'custom-webgl-prototype-runtime';

export const ATLAS_PRODUCT_3D_MODULE_PATH =
  'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs' as const;

export const ATLAS_PRODUCT_3D_HOST_PATH =
  'src/app/world/atlas/unified/AtlasNative3dEditor.tsx' as const;

/** Parallel inventory — must not be a second product chrome path. */
export const ATLAS_PARALLEL_THREE_VIEWPORT_PATH =
  'src/app/world/atlas/unified/AtlasSpatialViewport.tsx' as const;

/**
 * Where the parallel Three inventory (`AtlasSpatialViewport`) is retired.
 * - `atl2-h-cleanup`: quarantined in ATL2-H (#1234, H01-3) — historical value.
 * - `atl3-r02-adapter`: ATL3-R01B (#1296, ADR-ST-11) — deleted by the R02 scene adapter (#1267), which starts
 *   from the R01B scene module instead; never re-exported or mounted before that.
 */
export type AtlasRetireParallelIn = 'atl2-h-cleanup' | 'atl3-r02-adapter' | 'none';

export type AtlasRendererDecision = {
  readonly target: AtlasRendererCandidateId;
  readonly issue: 1212;
  readonly reasonDe: string;
  readonly rollbackDe: string;
  readonly retireParallelIn: AtlasRetireParallelIn;
};

export const ATLAS_RENDERER_DECISION: AtlasRendererDecision = {
  target: ATLAS_PRODUCT_3D_TARGET,
  issue: 1212,
  reasonDe:
    'Produkt-3D ist bereits die gesteuerte custom-WebGL-Runtime (AtlasGL + AtlasLite3D). ' +
    'AtlasSpatialViewport (Three.js) ist ungenutzt im Produkt-Chrome; ein Tausch würde ' +
    'Nav/Tools/Golden-Parität ohne gemessenen Gewinn riskieren.',
  rollbackDe:
    'Bei kritischem Regression: Draufsicht (Canvas2D) bleibt Authoring-Quelle; 3D-Ansicht ' +
    'kann auf controlled seed ohne Mutation zurückfallen. Parallel-Three nicht reaktivieren.',
  /** Updated with the #1296 ADR (H01-3): SpatialViewport is not the reuse vehicle; R02 removes it. */
  retireParallelIn: 'atl3-r02-adapter',
};

/** Product default when the user has not chosen a preset (ATL3-V01 #1295). */
export const ATLAS_GRAPHICS_PRESET_DEFAULT: AtlasGraphicsPresetId = 'balanced';

/** Device-local preference key for the Atlas graphics quality switch. */
export const ATLAS_GRAPHICS_PRESET_STORAGE_KEY = 'sagatree-atlas-graphics-preset' as const;

/** Strict parse of an untrusted preset id (storage / form value); null when unknown. */
export function parseAtlasGraphicsPresetId(raw: unknown): AtlasGraphicsPresetId | null {
  if (typeof raw !== 'string') return null;
  return ATLAS_GRAPHICS_PRESETS.some((p) => p.id === raw) ? (raw as AtlasGraphicsPresetId) : null;
}

export function resolveAtlasGraphicsPreset(
  id: AtlasGraphicsPresetId,
): AtlasGraphicsPreset {
  const found = ATLAS_GRAPHICS_PRESETS.find((p) => p.id === id);
  if (!found) return ATLAS_GRAPHICS_PRESETS[1]!;
  return found;
}

export function clampAtlasPixelRatio(
  devicePixelRatio: number,
  preset: AtlasGraphicsPreset,
): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(preset.maxPixelRatio, dpr);
}

export function isProductAtlasRendererTarget(id: AtlasRendererCandidateId): boolean {
  return id === ATLAS_PRODUCT_3D_TARGET;
}

/**
 * ATL2-R01 (#1266) — Hybrid/Three reuse GO/NO-GO for follow-on R02–R05.
 * Completing R01 does not auto-greenlight #1267–#1270; only `GO` does.
 */
export type AtlasRendererHybridVerdict = 'GO' | 'NO-GO';

export type AtlasRendererHybridDecision = {
  readonly issue: 1266;
  readonly verdict: AtlasRendererHybridVerdict;
  readonly productiveOwner: AtlasRendererCandidateId;
  readonly followOnIssues: readonly [1267, 1268, 1269, 1270];
  readonly reasonDe: string;
  readonly evidencePaths: readonly string[];
};

export const ATLAS_R01_RENDERER_HYBRID_DECISION: AtlasRendererHybridDecision = {
  issue: 1266,
  verdict: 'NO-GO',
  productiveOwner: ATLAS_PRODUCT_3D_TARGET,
  followOnIssues: [1267, 1268, 1269, 1270],
  reasonDe:
    'Kein entscheidender Messgewinn für Three als Produkt-Backend; SpatialViewport fehlt ' +
    'Heightfield/Diorama/Lite-Fallback; Phase-D/E/F-Investition bleibt auf Custom-WebGL. ' +
    'R02–R05 nicht starten — not_planned bis neue ADR mit Paritäts-CLEAR.',
  evidencePaths: [
    '.qa/design/atl2-r01-renderer-decision.md',
    '.qa/design/atl2-r01-reuse-matrix.md',
    '.qa/evidence/atl2-r01-renderer-poc/results.json',
  ],
};

export function atlasR01AllowsFollowOnRendererWork(
  decision: AtlasRendererHybridDecision = ATLAS_R01_RENDERER_HYBRID_DECISION,
): boolean {
  return decision.verdict === 'GO';
}

/**
 * ATL3-R01B (#1296, ADR-ST-11) — Three.js equal-fidelity PoC verdict.
 * GO is a recommendation bound to explicit gates: R02–R05 (#1267–#1270) stay closed and the custom WebGL
 * runtime stays the sole productive owner until owner approval AND a hardware-WebGL evidence run of the
 * R01B spec within the V01 hardware budgets are recorded here (software WebGL is never sole proof).
 * ADR-ST-10 / #1266 stay immutable; ADR-ST-11 supersedes ADR-ST-10 only once both gates are `passed`.
 */
export type AtlasR01bGateState = 'pending' | 'passed' | 'failed';

export type AtlasR01bRendererDecision = {
  readonly issue: 1296;
  readonly adr: 'ADR-ST-11';
  readonly verdict: AtlasRendererHybridVerdict;
  /** Candidate the follow-on slices would promote (R02 starts from the R01B scene module). */
  readonly proposedOwner: AtlasRendererCandidateId;
  /** Productive owner until the R04 (#1269) switch; there is never a second productive mount. */
  readonly productiveOwner: AtlasRendererCandidateId;
  readonly gates: {
    readonly ownerApproval: AtlasR01bGateState;
    readonly hardwareEvidence: AtlasR01bGateState;
  };
  readonly followOnIssues: readonly [1267, 1268, 1269, 1270];
  readonly pocModulePath: string;
  readonly reasonDe: string;
  readonly rollbackDe: string;
  readonly evidencePaths: readonly string[];
};

export const ATLAS_R01B_RENDERER_DECISION: AtlasR01bRendererDecision = {
  issue: 1296,
  adr: 'ADR-ST-11',
  verdict: 'GO',
  proposedOwner: 'three-r01b-scene',
  productiveOwner: ATLAS_PRODUCT_3D_TARGET,
  gates: { ownerApproval: 'pending', hardwareEvidence: 'pending' },
  followOnIssues: [1267, 1268, 1269, 1270],
  pocModulePath: 'src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene.ts',
  reasonDe:
    'Three.js rendert dieselben gespeicherten Golden-Objekte (Dornhain + Krypta) mit denselben V01-Kameras und ' +
    'identischen IDs (2D-Edit → 3D gleiche Objekt-ID, Picking, Context-Restore) und schließt die Material-/' +
    'Licht-/Schattenlücke zu Atlas V8 (PBR-Atlas, PCF-Schatten, ACES, Instancing). Custom-WebGL bräuchte dafür ' +
    'eine eigene Engine-Schicht. Software-WebGL-Frame-Zeiten sind langsamer und nur informativ.',
  rollbackDe:
    'Bis zum R04-Schalter bleibt Custom-WebGL (AtlasGL + AtlasLite3D) einziger Produkt-Renderer; danach bleibt ' +
    'er nur als Rollback-Pfad bis R05/#1300 CLEAR. AtlasLite3D bleibt Lite-/No-WebGL-Fallback.',
  evidencePaths: [
    'docs/architecture/ADR-ST-11-atl3-r01b-three-renderer-go.md',
    '.qa/design/atl3-r01b-three-equal-fidelity-adr.md',
    '.qa/evidence/atl3-r01b-three-poc/results.json',
  ],
};

/** Fail-closed: only an explicit GO with both gates `passed` reopens #1267–#1270. */
export function atlasR01bAllowsFollowOnRendererWork(
  decision: AtlasR01bRendererDecision = ATLAS_R01B_RENDERER_DECISION,
): boolean {
  return (
    decision.verdict === 'GO' &&
    decision.gates.ownerApproval === 'passed' &&
    decision.gates.hardwareEvidence === 'passed'
  );
}

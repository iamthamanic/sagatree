// src/domains/character/liveact/liveact-performance-face-contract.ts
var SAGATREE_PERFORMANCE_FACE_CONTRACT = "SagaTreePerformanceFaceV2";
var PERFORMANCE_FACE_VALIDATOR_VERSION = "performance-face-validator-v1";
var PERFORMANCE_FACE_MANIFEST_VERSION = "SagaTreePerformanceFaceManifestV1";
var PERFORMANCE_FACE_AUTHORING_SPEC = "sagatree-performance-face-authoring-v1";
var LIVEACT_ACTIVE_CAPABILITY_CONTRACT = "SagaTreeLiveActActiveCapabilityV2";
var PERFORMANCE_FACE_CAPABILITY_LEVELS = [0, 1, 2, 3];
var PERFORMANCE_FACE_LEVEL_LABELS = {
  0: "Display",
  1: "Animated Humanoid",
  2: "LiveAct Standard",
  3: "LiveAct Premium"
};
var PERFORMANCE_FACE_REQUIRED_PREMIUM_CONTROLS = [
  "nasolabialFoldLeft",
  "nasolabialFoldRight",
  "cheekVolumeLeft",
  "cheekVolumeRight",
  "lipContourUpperLeft",
  "lipContourUpperRight",
  "lipContourLowerLeft",
  "lipContourLowerRight"
];
var PERFORMANCE_FACE_OPTIONAL_PREMIUM_CONTROLS = [
  "lidTightenLeft",
  "lidTightenRight"
];
var PERFORMANCE_FACE_ALL_CONTROLS = [
  ...PERFORMANCE_FACE_REQUIRED_PREMIUM_CONTROLS,
  ...PERFORMANCE_FACE_OPTIONAL_PREMIUM_CONTROLS
];
function isPerformanceFaceControlId(id) {
  return PERFORMANCE_FACE_ALL_CONTROLS.includes(id);
}
function isPerformanceFaceCapabilityLevel(value) {
  return typeof value === "number" && PERFORMANCE_FACE_CAPABILITY_LEVELS.includes(value);
}
function clampPerformanceFaceWeight(value) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
function computeCorrectiveWeight(driverWeights, rule) {
  if (driverWeights.length === 0) return 0;
  const clamped = driverWeights.map(clampPerformanceFaceWeight);
  if (rule === "min") {
    let min = clamped[0] ?? 0;
    for (let i = 1; i < clamped.length; i += 1) {
      const w = clamped[i] ?? 0;
      if (w < min) min = w;
    }
    return min;
  }
  let product = 1;
  for (const w of clamped) product *= w;
  return clampPerformanceFaceWeight(product);
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseCorrectiveDeclaration(entry) {
  if (!isPlainObject(entry)) return null;
  if (typeof entry.id !== "string" || entry.id.length === 0) return null;
  if (!Array.isArray(entry.drivers) || entry.drivers.length === 0) return null;
  const drivers = [];
  for (const d of entry.drivers) {
    if (typeof d !== "string" || d.length === 0) return null;
    drivers.push(d);
  }
  if (entry.weightRule !== "min" && entry.weightRule !== "multiply") return null;
  if (entry.required !== void 0 && typeof entry.required !== "boolean") return null;
  return {
    id: entry.id,
    drivers,
    weightRule: entry.weightRule,
    required: entry.required === true ? true : void 0
  };
}
function parsePerformanceFaceManifestV1(raw) {
  if (!isPlainObject(raw)) return null;
  if (raw.contractVersion !== PERFORMANCE_FACE_MANIFEST_VERSION) return null;
  let claimedLevel;
  if (raw.claimedLevel !== void 0) {
    if (!isPerformanceFaceCapabilityLevel(raw.claimedLevel)) return null;
    claimedLevel = raw.claimedLevel;
  }
  let correctives;
  if (raw.correctives !== void 0) {
    if (!Array.isArray(raw.correctives)) return null;
    correctives = [];
    for (const entry of raw.correctives) {
      const decl = parseCorrectiveDeclaration(entry);
      if (!decl) return null;
      correctives.push(decl);
    }
  }
  return {
    contractVersion: PERFORMANCE_FACE_MANIFEST_VERSION,
    claimedLevel,
    correctives
  };
}
export {
  LIVEACT_ACTIVE_CAPABILITY_CONTRACT,
  PERFORMANCE_FACE_ALL_CONTROLS,
  PERFORMANCE_FACE_AUTHORING_SPEC,
  PERFORMANCE_FACE_CAPABILITY_LEVELS,
  PERFORMANCE_FACE_LEVEL_LABELS,
  PERFORMANCE_FACE_MANIFEST_VERSION,
  PERFORMANCE_FACE_OPTIONAL_PREMIUM_CONTROLS,
  PERFORMANCE_FACE_REQUIRED_PREMIUM_CONTROLS,
  PERFORMANCE_FACE_VALIDATOR_VERSION,
  SAGATREE_PERFORMANCE_FACE_CONTRACT,
  clampPerformanceFaceWeight,
  computeCorrectiveWeight,
  isPerformanceFaceCapabilityLevel,
  isPerformanceFaceControlId,
  parsePerformanceFaceManifestV1
};

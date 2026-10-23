// src/domains/character/liveact/liveact-face-contract.ts
var LIVEACT_FACE_CHANNELS = [
  "_neutral",
  "browDownLeft",
  "browDownRight",
  "browInnerUp",
  "browOuterUpLeft",
  "browOuterUpRight",
  "cheekPuff",
  "cheekSquintLeft",
  "cheekSquintRight",
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "eyeLookDownLeft",
  "eyeLookDownRight",
  "eyeLookInLeft",
  "eyeLookInRight",
  "eyeLookOutLeft",
  "eyeLookOutRight",
  "eyeLookUpLeft",
  "eyeLookUpRight",
  "eyeSquintLeft",
  "eyeSquintRight",
  "eyeWideLeft",
  "eyeWideRight",
  "jawForward",
  "jawLeft",
  "jawOpen",
  "jawRight",
  "mouthClose",
  "mouthDimpleLeft",
  "mouthDimpleRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "mouthFunnel",
  "mouthLeft",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "mouthPressLeft",
  "mouthPressRight",
  "mouthPucker",
  "mouthRight",
  "mouthRollLower",
  "mouthRollUpper",
  "mouthShrugLower",
  "mouthShrugUpper",
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthStretchLeft",
  "mouthStretchRight",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
  "noseSneerLeft",
  "noseSneerRight"
];

// src/domains/character/liveact/liveact-capabilities.ts
var LIVEACT_CAPABILITIES_VERSION = "SagaTreeLiveActCapabilitiesV1";
function composeLiveActCapabilities(input, avatar) {
  return {
    contractVersion: LIVEACT_CAPABILITIES_VERSION,
    input: {
      face: input.face === true,
      headPose: input.headPose === true,
      eyeGaze: input.eyeGaze === true
    },
    avatarBones: { ...avatar.avatarBones },
    avatarFace: avatar.avatarFace,
    activeFaceChannelCount: avatar.activeFaceChannelCount,
    totalFaceChannelCount: avatar.totalFaceChannelCount,
    gazeDrivePath: avatar.gazeDrivePath,
    runtimeKind: avatar.runtimeKind
  };
}

// src/domains/character/liveact/liveact-face-asset-contract.ts
var LIVEACT_FACE_ASSET_CORE_V1_CHANNELS = [
  "eyeBlinkLeft",
  "eyeBlinkRight",
  "jawOpen",
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthFrownLeft",
  "mouthFrownRight",
  "mouthPucker",
  "mouthShrugUpper",
  "mouthShrugLower"
];
var LIVEACT_FACE_ASSET_FULL_V1_CHANNELS = LIVEACT_FACE_CHANNELS.filter((id) => id !== "_neutral");
var LIVEACT_FACE_ASSET_GAZE_MORPH_CHANNELS = [
  "eyeLookDownLeft",
  "eyeLookDownRight",
  "eyeLookInLeft",
  "eyeLookInRight",
  "eyeLookOutLeft",
  "eyeLookOutRight",
  "eyeLookUpLeft",
  "eyeLookUpRight"
];
function liveActFaceAssetRequiredChannels(profileId) {
  return profileId === "core-v1" ? LIVEACT_FACE_ASSET_CORE_V1_CHANNELS : LIVEACT_FACE_ASSET_FULL_V1_CHANNELS;
}
function checkLiveActFaceAssetProfile(inventory, profileId, gazeMode) {
  const present = new Set(inventory.presentChannels);
  const required = liveActFaceAssetRequiredChannels(profileId);
  const missingChannels = required.filter((id) => !present.has(id));
  let missingGaze = false;
  if (gazeMode === "morphs") {
    missingGaze = LIVEACT_FACE_ASSET_GAZE_MORPH_CHANNELS.some((id) => !present.has(id));
  } else if (gazeMode === "bones") {
    missingGaze = !inventory.hasEyeBones;
  }
  return {
    profileId,
    gazeMode,
    ok: missingChannels.length === 0 && !missingGaze,
    missingChannels,
    missingGaze
  };
}

// src/domains/character/liveact/liveact-performance-face-contract.ts
var SAGATREE_PERFORMANCE_FACE_CONTRACT = "SagaTreePerformanceFaceV2";
var PERFORMANCE_FACE_VALIDATOR_VERSION = "performance-face-validator-v1";
var LIVEACT_ACTIVE_CAPABILITY_CONTRACT = "SagaTreeLiveActActiveCapabilityV2";
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

// src/domains/character/liveact/liveact-performance-face-aliases.ts
function pascalCase(id) {
  if (!id.length) return id;
  return id.charAt(0).toUpperCase() + id.slice(1);
}
function aliasesForControl(id) {
  const list = [id, pascalCase(id)];
  const underscored = id.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  if (underscored !== id) list.push(underscored);
  return list;
}
var PERFORMANCE_FACE_TARGET_ALIASES = Object.fromEntries(
  PERFORMANCE_FACE_ALL_CONTROLS.map((id) => [id, aliasesForControl(id)])
);
function resolvePerformanceFaceTargets(presentTargetNames) {
  const present = new Set(presentTargetNames);
  const resolvedNames = {};
  const supported = /* @__PURE__ */ new Set();
  for (const id of PERFORMANCE_FACE_ALL_CONTROLS) {
    const aliases = PERFORMANCE_FACE_TARGET_ALIASES[id];
    const match = aliases.find((alias) => present.has(alias));
    if (match) {
      supported.add(id);
      resolvedNames[id] = match;
    }
  }
  return { supported, resolvedNames };
}

// src/domains/character/liveact/liveact-performance-face-validate.ts
function evaluateCorrectives(presentTargetNames, declarations) {
  if (!declarations || declarations.length === 0) {
    return { present: [], missingRequired: [], missingOptional: [] };
  }
  const present = [];
  const missingRequired = [];
  const missingOptional = [];
  for (const decl of declarations) {
    if (presentTargetNames.has(decl.id)) {
      present.push(decl.id);
      continue;
    }
    if (decl.required === true) missingRequired.push(decl.id);
    else missingOptional.push(decl.id);
  }
  return { present, missingRequired, missingOptional };
}
function validatePerformanceFaceV2(inventory) {
  const warnings = [];
  const resolution = resolvePerformanceFaceTargets(inventory.presentTargetNames);
  const presentNames = new Set(inventory.presentTargetNames);
  const supportedControls = [];
  for (const id of PERFORMANCE_FACE_ALL_CONTROLS) {
    if (resolution.supported.has(id)) supportedControls.push(id);
  }
  const missingRequired = PERFORMANCE_FACE_REQUIRED_PREMIUM_CONTROLS.filter(
    (id) => !resolution.supported.has(id)
  );
  const missingOptional = PERFORMANCE_FACE_OPTIONAL_PREMIUM_CONTROLS.filter(
    (id) => !resolution.supported.has(id)
  );
  for (const id of missingOptional) {
    warnings.push(`Optionales Premium-Control fehlt: ${id}`);
  }
  const correctiveCapability = evaluateCorrectives(
    presentNames,
    inventory.manifest?.correctives
  );
  for (const id of correctiveCapability.missingOptional) {
    warnings.push(`Optionales Corrective fehlt: ${id}`);
  }
  for (const id of correctiveCapability.missingRequired) {
    warnings.push(`Erforderliches Corrective fehlt: ${id}`);
  }
  if (inventory.filenameHint) {
    const lower = inventory.filenameHint.toLowerCase();
    if (lower.includes("premium") || lower.includes("performance")) {
      warnings.push(
        "Dateiname/URL enth\xE4lt \u201Epremium/performance\u201C \u2014 wird f\xFCr Eligibility ignoriert"
      );
    }
  }
  const arkitPresent = inventory.arkitPresentChannels;
  const coreCheck = checkLiveActFaceAssetProfile(
    {
      presentChannels: arkitPresent,
      hasEyeBones: inventory.gazeDrivePath === "bones" || inventory.gazeDrivePath === "lookAt"
    },
    "core-v1",
    inventory.gazeDrivePath === "morphs" ? "morphs" : inventory.gazeDrivePath === "bones" || inventory.gazeDrivePath === "lookAt" ? "bones" : "none"
  );
  const standardFaceOk = coreCheck.ok && !coreCheck.missingGaze;
  const gazeOk = inventory.gazeDrivePath !== "none";
  const standardEligible = inventory.hasHumanoid && inventory.hasHead && standardFaceOk && (gazeOk || standardFaceOk);
  if (inventory.manifest?.claimedLevel === 3 && missingRequired.length > 0) {
    warnings.push(
      "Manifest beansprucht Premium, aber erforderliche Morph-/Expression-Controls fehlen"
    );
  }
  if (inventory.manifest?.claimedLevel === 3 && missingRequired.length === 0 && correctiveCapability.missingRequired.length === 0 && supportedControls.length === 0) {
    warnings.push("Manifest-Premium ohne aufgel\xF6ste Controls \u2014 Morph-Evidenz fehlt");
  }
  const premiumControlsOk = missingRequired.length === 0;
  const premiumCorrectivesOk = correctiveCapability.missingRequired.length === 0;
  const premiumEligible = standardEligible && premiumControlsOk && premiumCorrectivesOk;
  let capabilityLevel = 0;
  if (!inventory.hasHumanoid) {
    capabilityLevel = 0;
  } else if (!standardEligible) {
    capabilityLevel = 1;
  } else if (!premiumEligible) {
    capabilityLevel = 2;
  } else {
    capabilityLevel = 3;
  }
  return {
    contractVersion: SAGATREE_PERFORMANCE_FACE_CONTRACT,
    validatorVersion: PERFORMANCE_FACE_VALIDATOR_VERSION,
    capabilityLevel,
    standardEligible,
    premiumEligible,
    supportedControls,
    missingRequired,
    missingOptional,
    warnings,
    gazeCapability: inventory.gazeDrivePath,
    correctiveCapability,
    importAllowed: true,
    resolvedTargetNames: resolution.resolvedNames
  };
}
function composeLiveActWithPerformanceFace(input, avatar, performanceFace) {
  const liveact = composeLiveActCapabilities(input, avatar);
  return {
    contractVersion: LIVEACT_ACTIVE_CAPABILITY_CONTRACT,
    liveact,
    performanceFace,
    capabilityLevel: performanceFace.capabilityLevel
  };
}
function evaluatePerformanceFaceForImport(inventory) {
  const report = validatePerformanceFaceV2(inventory);
  return {
    importAllowed: true,
    blocksImport: false,
    report
  };
}
function formatPerformanceFaceReportDe(report) {
  const lines = [
    `LiveAct Standard: ${report.standardEligible ? "PASS" : "NOT AVAILABLE"}`,
    `LiveAct Premium: ${report.premiumEligible ? "PASS" : "NOT AVAILABLE"}`,
    `Stufe: ${report.capabilityLevel} (${PERFORMANCE_FACE_LEVEL_LABELS[report.capabilityLevel]})`
  ];
  const missing = [
    ...report.missingRequired.map((id) => `${id} (erforderlich f\xFCr Premium)`),
    ...report.missingOptional.map((id) => `${id} (optional)`),
    ...report.correctiveCapability.missingRequired.map(
      (id) => `Corrective ${id} (erforderlich)`
    ),
    ...report.correctiveCapability.missingOptional.map(
      (id) => `Corrective ${id} (optional)`
    )
  ];
  if (missing.length > 0) {
    lines.push("Missing:");
    for (const m of missing) lines.push(`- ${m}`);
  } else {
    lines.push("Missing: \u2014");
  }
  if (report.standardEligible) {
    lines.push("Fallback: ARKit52-kompatibles Face bleibt verf\xFCgbar.");
  } else if (report.capabilityLevel >= 1) {
    lines.push("Fallback: Humanoid/Animation ohne LiveAct-Face.");
  } else {
    lines.push("Fallback: Darstellung ohne LiveAct-Promise.");
  }
  if (report.warnings.length > 0) {
    lines.push("Hinweise:");
    for (const w of report.warnings) lines.push(`- ${w}`);
  }
  lines.push(`Import: erlaubt (Premium fehlt blockiert den Import nicht).`);
  return lines.join("\n");
}
function applyPerformanceFaceWeights(input) {
  for (const id of PERFORMANCE_FACE_ALL_CONTROLS) {
    const target = input.resolvedNames[id];
    if (!target) continue;
    const w = input.weights[id];
    if (w === void 0) continue;
    input.writeWeight(target, clampPerformanceFaceWeight(w));
  }
  if (!input.correctives?.length || !input.driverWeights) return;
  for (const decl of input.correctives) {
    const driverVals = decl.drivers.map((d) => input.driverWeights?.[d] ?? 0);
    const weight = computeCorrectiveWeight(driverVals, decl.weightRule);
    input.writeWeight(decl.id, weight);
  }
}
export {
  applyPerformanceFaceWeights,
  composeLiveActWithPerformanceFace,
  evaluatePerformanceFaceForImport,
  formatPerformanceFaceReportDe,
  validatePerformanceFaceV2
};

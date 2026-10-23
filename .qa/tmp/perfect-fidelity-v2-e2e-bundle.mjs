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
function clampLiveActChannel(value) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
function createNeutralLiveActFaceChannels() {
  const out = {};
  for (const id of LIVEACT_FACE_CHANNELS) {
    out[id] = id === "_neutral" ? 1 : 0;
  }
  return out;
}
function mergeLiveActFaceChannels(partial) {
  const base = createNeutralLiveActFaceChannels();
  if (!partial) return base;
  for (const id of LIVEACT_FACE_CHANNELS) {
    const raw = partial[id];
    if (typeof raw === "number") {
      base[id] = clampLiveActChannel(raw);
    }
  }
  return base;
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

// src/domains/character/liveact/liveact-hybrid-face-contract.ts
var LIVEACT_HYBRID_FACE_CONTRACT = "SagaTreeLiveActHybridFaceV1";
var LIVEACT_HYBRID_FACE_CONTROL_IDS = [
  "mouthSmileLeft",
  "mouthSmileRight",
  "mouthPucker",
  "mouthFunnel",
  "mouthPressLeft",
  "mouthPressRight",
  "mouthRollUpper",
  "mouthRollLower",
  "mouthUpperUpLeft",
  "mouthUpperUpRight",
  "mouthLowerDownLeft",
  "mouthLowerDownRight",
  "cheekSquintLeft",
  "cheekSquintRight",
  "cheekPuff",
  "noseSneerLeft",
  "noseSneerRight",
  "jawOpen",
  "jawForward"
];
var LIVEACT_HYBRID_DENSE_MIN_CONFIDENCE = 0.45;
var LIVEACT_HYBRID_DISAGREE_ABS = 0.35;
function unavailableHybridControl(semanticInput = null) {
  return {
    value: null,
    confidence: 0,
    source: "unavailable",
    semanticInput,
    denseEvidence: null
  };
}
function semanticPassthroughControl(semantic, confidence = 1) {
  if (semantic === null || !Number.isFinite(semantic)) {
    return unavailableHybridControl(null);
  }
  const v = clamp01(semantic);
  return {
    value: v,
    confidence: clamp01(confidence),
    source: "semantic",
    semanticInput: v,
    denseEvidence: null
  };
}
function createEmptyHybridFace(input) {
  const controls = {};
  for (const id of LIVEACT_HYBRID_FACE_CONTROL_IDS) {
    controls[id] = unavailableHybridControl(null);
  }
  return {
    contractVersion: LIVEACT_HYBRID_FACE_CONTRACT,
    sequence: input.sequence,
    timestampMs: input.timestampMs,
    presence: false,
    denseSequenceAligned: false,
    controls
  };
}
function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

// src/domains/character/liveact/liveact-hybrid-face-fusion.ts
function clamp012(n) {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}
function readSemantic(face, id) {
  const v = face[id];
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return clamp012(v);
}
function denseScalar(f) {
  if (!f || !f.available || f.value === null || !Number.isFinite(f.value)) {
    return { available: false, value: null, confidence: f?.confidence ?? 0 };
  }
  return {
    available: true,
    value: f.value,
    confidence: clamp012(f.confidence)
  };
}
function denseActivationFromSigned(value, available, positiveMeansActive = true) {
  if (!available || value === null || !Number.isFinite(value)) return null;
  const signed = positiveMeansActive ? value : -value;
  return clamp012(signed * 2.2);
}
function fuseSemanticDense(input) {
  const sem = input.semantic;
  const dense = input.denseEvidence;
  const dConf = clamp012(input.denseConfidence);
  const sConf = input.semanticConfidence !== void 0 ? clamp012(input.semanticConfidence) : sem === null ? 0 : 0.85;
  if (sem === null && (dense === null || dConf < LIVEACT_HYBRID_DENSE_MIN_CONFIDENCE)) {
    return unavailableHybridControl(null);
  }
  if (dense === null || dConf < LIVEACT_HYBRID_DENSE_MIN_CONFIDENCE) {
    return semanticPassthroughControl(sem, sConf);
  }
  if (sem === null) {
    if (input.allowDenseOnly && dConf >= LIVEACT_HYBRID_DENSE_MIN_CONFIDENCE) {
      return {
        value: clamp012(dense),
        confidence: dConf * 0.85,
        source: "dense",
        semanticInput: null,
        denseEvidence: clamp012(dense)
      };
    }
    return unavailableHybridControl(null);
  }
  const s = clamp012(sem);
  const d = clamp012(dense);
  const diff = Math.abs(s - d);
  const agree = diff <= LIVEACT_HYBRID_DISAGREE_ABS;
  if (!agree && s >= 0.45 && sConf >= 0.7 && dConf >= 0.7) {
    return {
      value: s,
      confidence: clamp012(Math.min(sConf, dConf) * 0.55),
      source: "semantic",
      semanticInput: s,
      denseEvidence: d
    };
  }
  if (s < d - 0.12 && dConf >= LIVEACT_HYBRID_DENSE_MIN_CONFIDENCE) {
    const w2 = clamp012(dConf * 0.75);
    const value2 = clamp012(s * (1 - w2 * 0.7) + d * (w2 * 0.7));
    return {
      value: value2,
      confidence: clamp012(0.4 * sConf + 0.6 * dConf),
      source: "hybrid",
      semanticInput: s,
      denseEvidence: d
    };
  }
  if (s > d + 0.15 && dConf >= LIVEACT_HYBRID_DENSE_MIN_CONFIDENCE) {
    const w2 = clamp012(dConf * 0.55);
    const value2 = clamp012(s * (1 - w2) + d * w2);
    return {
      value: value2,
      confidence: clamp012(0.55 * sConf + 0.45 * dConf),
      source: "hybrid",
      semanticInput: s,
      denseEvidence: d
    };
  }
  if (agree) {
    const nudge = (d - s) * 0.12 * dConf;
    const value2 = clamp012(s + nudge);
    return {
      value: value2,
      confidence: clamp012(Math.max(sConf, 0.4 * sConf + 0.6 * dConf)),
      source: Math.abs(nudge) > 1e-4 ? "hybrid" : "semantic",
      semanticInput: s,
      denseEvidence: d
    };
  }
  const w = clamp012(dConf / (sConf + dConf + 1e-6)) * 0.4;
  const value = clamp012(s * (1 - w) + d * w);
  return {
    value,
    confidence: clamp012(0.45 * sConf + 0.45 * dConf),
    source: "hybrid",
    semanticInput: s,
    denseEvidence: d
  };
}
function combineDenseEvidence(parts, mode = "max") {
  const ok = parts.filter((p) => p.available && p.value !== null);
  if (ok.length === 0) return { value: null, confidence: 0 };
  if (mode === "max") {
    let best = ok[0];
    for (const p of ok) {
      if ((p.value ?? 0) > (best.value ?? 0)) best = p;
    }
    return { value: clamp012(best.value), confidence: clamp012(best.confidence) };
  }
  let sum = 0;
  let cSum = 0;
  for (const p of ok) {
    sum += p.value;
    cSum += p.confidence;
  }
  return {
    value: clamp012(sum / ok.length),
    confidence: clamp012(cSum / ok.length)
  };
}

// src/domains/character/liveact/liveact-hybrid-face-solve.ts
function ctrl(map, id, result) {
  map[id] = result;
}
function solveHybridFace(input) {
  const empty = createEmptyHybridFace({
    sequence: input.sequence,
    timestampMs: input.timestampMs
  });
  const dense = input.dense;
  const denseSeq = typeof input.denseSequence === "number" ? input.denseSequence : dense?.sequence;
  const aligned = dense !== null && dense.presence && dense.normalizationStatus === "ok" && denseSeq === input.sequence;
  const controls = {};
  if (!aligned || !dense) {
    for (const id of LIVEACT_HYBRID_FACE_CONTROL_IDS) {
      ctrl(controls, id, fuseSemanticDense({
        semantic: readSemantic(input.semanticFace, id),
        denseEvidence: null,
        denseConfidence: 0
      }));
    }
    return {
      contractVersion: LIVEACT_HYBRID_FACE_CONTRACT,
      sequence: input.sequence,
      timestampMs: input.timestampMs,
      presence: Object.values(controls).some((c) => c.value !== null),
      denseSequenceAligned: false,
      controls
    };
  }
  const lips = dense.lips;
  const cheeks = dense.cheeks;
  const nose = dense.nose;
  const jaw = dense.jaw;
  const cornerL = denseScalar(lips.cornerLeft);
  const cornerR = denseScalar(lips.cornerRight);
  const curv = denseScalar(lips.curvature);
  const raiseL = denseScalar(cheeks.raiseLeft);
  const raiseR = denseScalar(cheeks.raiseRight);
  const cornerActL = denseActivationFromSigned(cornerL.value, cornerL.available);
  const cornerActR = denseActivationFromSigned(cornerR.value, cornerR.available);
  const sideActive = (cornerAct, raise) => cornerAct !== null && cornerAct > 0.08 || raise.available && (raise.value ?? 0) > 0.08;
  const smileDenseL = combineDenseEvidence(
    [
      {
        available: cornerL.available,
        value: cornerActL,
        confidence: cornerL.confidence
      },
      {
        available: raiseL.available,
        value: raiseL.available && raiseL.value !== null ? clamp012(raiseL.value) : null,
        confidence: raiseL.confidence
      },
      {
        available: curv.available && sideActive(cornerActL, raiseL),
        value: denseActivationFromSigned(curv.value, curv.available),
        confidence: curv.confidence * 0.55
      }
    ],
    "mean"
  );
  const smileDenseR = combineDenseEvidence(
    [
      {
        available: cornerR.available,
        value: cornerActR,
        confidence: cornerR.confidence
      },
      {
        available: raiseR.available,
        value: raiseR.available && raiseR.value !== null ? clamp012(raiseR.value) : null,
        confidence: raiseR.confidence
      },
      {
        available: curv.available && sideActive(cornerActR, raiseR),
        value: denseActivationFromSigned(curv.value, curv.available),
        confidence: curv.confidence * 0.55
      }
    ],
    "mean"
  );
  ctrl(
    controls,
    "mouthSmileLeft",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "mouthSmileLeft"),
      denseEvidence: smileDenseL.value,
      denseConfidence: smileDenseL.confidence,
      allowDenseOnly: true
    })
  );
  ctrl(
    controls,
    "mouthSmileRight",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "mouthSmileRight"),
      denseEvidence: smileDenseR.value,
      denseConfidence: smileDenseR.confidence,
      allowDenseOnly: true
    })
  );
  const width = denseScalar(lips.width);
  const protrude = denseScalar(lips.protrusion);
  const compress = denseScalar(lips.compression);
  const gapC = denseScalar(lips.gapCenter);
  const puckerGate = protrude.available && (protrude.value ?? 0) > 0.12 || compress.available && (compress.value ?? 0) > 0.12;
  const puckerDense = combineDenseEvidence(
    [
      {
        available: protrude.available,
        value: protrude.value !== null ? clamp012(protrude.value) : null,
        confidence: protrude.confidence
      },
      {
        available: compress.available,
        value: compress.value !== null ? clamp012(compress.value) : null,
        confidence: compress.confidence
      },
      {
        available: puckerGate && gapC.available && gapC.value !== null,
        value: gapC.value !== null ? clamp012(1 - gapC.value) : null,
        confidence: gapC.confidence * 0.45
      }
    ],
    "mean"
  );
  const funnelGate = gapC.available && (gapC.value ?? 0) > 0.08 || protrude.available && (protrude.value ?? 0) > 0.12;
  const funnelDense = combineDenseEvidence(
    [
      {
        available: funnelGate && protrude.available,
        value: protrude.value !== null ? clamp012(protrude.value * 0.9) : null,
        confidence: protrude.confidence
      },
      {
        available: funnelGate && gapC.available,
        value: gapC.value !== null ? clamp012(gapC.value) : null,
        confidence: gapC.confidence
      }
    ],
    "mean"
  );
  ctrl(
    controls,
    "mouthPucker",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "mouthPucker"),
      denseEvidence: puckerDense.value,
      denseConfidence: puckerDense.confidence
    })
  );
  ctrl(
    controls,
    "mouthFunnel",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "mouthFunnel"),
      denseEvidence: funnelDense.value,
      denseConfidence: funnelDense.confidence
    })
  );
  const gapL = denseScalar(lips.gapLeft);
  const gapR = denseScalar(lips.gapRight);
  const pressCompressActive = compress.available && compress.value !== null && compress.value > 0.12;
  const pressDenseL = combineDenseEvidence(
    [
      {
        available: pressCompressActive,
        value: compress.value,
        confidence: compress.confidence
      },
      {
        available: pressCompressActive && gapL.available && gapL.value !== null,
        value: gapL.value !== null ? clamp012(1 - gapL.value) : null,
        confidence: gapL.confidence * 0.55
      }
    ],
    "mean"
  );
  const pressDenseR = combineDenseEvidence(
    [
      {
        available: pressCompressActive,
        value: compress.value,
        confidence: compress.confidence
      },
      {
        available: pressCompressActive && gapR.available && gapR.value !== null,
        value: gapR.value !== null ? clamp012(1 - gapR.value) : null,
        confidence: gapR.confidence * 0.55
      }
    ],
    "mean"
  );
  ctrl(
    controls,
    "mouthPressLeft",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "mouthPressLeft"),
      denseEvidence: pressDenseL.value,
      denseConfidence: pressDenseL.confidence
    })
  );
  ctrl(
    controls,
    "mouthPressRight",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "mouthPressRight"),
      denseEvidence: pressDenseR.value,
      denseConfidence: pressDenseR.confidence
    })
  );
  const upperConf = lips.upperContour.available ? lips.upperContour.confidence : 0;
  const lowerConf = lips.lowerContour.available ? lips.lowerContour.confidence : 0;
  const rollCompressActive = compress.available && compress.value !== null && compress.value > 0.12;
  const rollUpperDense = lips.upperContour.available && rollCompressActive ? {
    value: clamp012(
      ((compress.value ?? 0) + (gapC.available && gapC.value !== null ? 1 - gapC.value : 0)) / 2
    ),
    confidence: clamp012(0.5 * upperConf + 0.5 * compress.confidence)
  } : { value: null, confidence: 0 };
  const rollLowerDense = lips.lowerContour.available && rollCompressActive ? {
    value: clamp012(
      ((compress.value ?? 0) + (gapC.available && gapC.value !== null ? 1 - gapC.value : 0)) / 2
    ),
    confidence: clamp012(0.5 * lowerConf + 0.5 * compress.confidence)
  } : { value: null, confidence: 0 };
  ctrl(
    controls,
    "mouthRollUpper",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "mouthRollUpper"),
      denseEvidence: rollUpperDense.value,
      denseConfidence: rollUpperDense.confidence
    })
  );
  ctrl(
    controls,
    "mouthRollLower",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "mouthRollLower"),
      denseEvidence: rollLowerDense.value,
      denseConfidence: rollLowerDense.confidence
    })
  );
  const upperStations = lips.upperContour.stations;
  const lowerStations = lips.lowerContour.stations;
  const stationAct = (stations, index, conf) => {
    if (!stations) return { value: null, confidence: 0 };
    const s = stations[index];
    if (!s || !s.available || s.value === null) return { value: null, confidence: 0 };
    return {
      value: clamp012(Math.abs(s.value) * 2),
      confidence: clamp012(Math.min(conf, s.confidence))
    };
  };
  const upL = stationAct(upperStations, 1, upperConf);
  const upR = stationAct(upperStations, 3, upperConf);
  const lowL = stationAct(lowerStations, 1, lowerConf);
  const lowR = stationAct(lowerStations, 3, lowerConf);
  ctrl(
    controls,
    "mouthUpperUpLeft",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "mouthUpperUpLeft"),
      denseEvidence: upL.value,
      denseConfidence: upL.confidence
    })
  );
  ctrl(
    controls,
    "mouthUpperUpRight",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "mouthUpperUpRight"),
      denseEvidence: upR.value,
      denseConfidence: upR.confidence
    })
  );
  ctrl(
    controls,
    "mouthLowerDownLeft",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "mouthLowerDownLeft"),
      denseEvidence: lowL.value,
      denseConfidence: lowL.confidence
    })
  );
  ctrl(
    controls,
    "mouthLowerDownRight",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "mouthLowerDownRight"),
      denseEvidence: lowR.value,
      denseConfidence: lowR.confidence
    })
  );
  const compL = denseScalar(cheeks.compressionLeft);
  const compR = denseScalar(cheeks.compressionRight);
  const volL = denseScalar(cheeks.volumeProxyLeft);
  const volR = denseScalar(cheeks.volumeProxyRight);
  ctrl(
    controls,
    "cheekSquintLeft",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "cheekSquintLeft"),
      denseEvidence: combineDenseEvidence(
        [
          {
            available: raiseL.available,
            value: raiseL.value !== null ? clamp012(raiseL.value) : null,
            confidence: raiseL.confidence
          },
          {
            available: compL.available,
            value: compL.value !== null ? clamp012(compL.value) : null,
            confidence: compL.confidence * 0.7
          }
        ],
        "mean"
      ).value,
      denseConfidence: Math.max(raiseL.confidence, compL.confidence * 0.7)
    })
  );
  ctrl(
    controls,
    "cheekSquintRight",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "cheekSquintRight"),
      denseEvidence: combineDenseEvidence(
        [
          {
            available: raiseR.available,
            value: raiseR.value !== null ? clamp012(raiseR.value) : null,
            confidence: raiseR.confidence
          },
          {
            available: compR.available,
            value: compR.value !== null ? clamp012(compR.value) : null,
            confidence: compR.confidence * 0.7
          }
        ],
        "mean"
      ).value,
      denseConfidence: Math.max(raiseR.confidence, compR.confidence * 0.7)
    })
  );
  const puffDense = combineDenseEvidence(
    [
      {
        available: volL.available || volR.available,
        value: clamp012(((volL.value ?? 0) + (volR.value ?? 0)) / 2),
        confidence: clamp012((volL.confidence + volR.confidence) / 2)
      },
      {
        available: compL.available || compR.available,
        value: clamp012(((compL.value ?? 0) + (compR.value ?? 0)) / 2),
        confidence: clamp012((compL.confidence + compR.confidence) / 2) * 0.6
      }
    ],
    "mean"
  );
  ctrl(
    controls,
    "cheekPuff",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "cheekPuff"),
      denseEvidence: puffDense.value,
      denseConfidence: puffDense.confidence
    })
  );
  const alarL = denseScalar(nose.alarLeft);
  const alarR = denseScalar(nose.alarRight);
  const nlL = denseScalar(nose.nasolabialLeft);
  const nlR = denseScalar(nose.nasolabialRight);
  ctrl(
    controls,
    "noseSneerLeft",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "noseSneerLeft"),
      denseEvidence: combineDenseEvidence(
        [
          {
            available: alarL.available,
            value: alarL.value !== null ? clamp012(alarL.value) : null,
            confidence: alarL.confidence
          },
          {
            available: nlL.available,
            value: nlL.value !== null ? clamp012(nlL.value) : null,
            confidence: nlL.confidence * 0.8
          }
        ],
        "mean"
      ).value,
      denseConfidence: Math.max(alarL.confidence, nlL.confidence * 0.8)
    })
  );
  ctrl(
    controls,
    "noseSneerRight",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "noseSneerRight"),
      denseEvidence: combineDenseEvidence(
        [
          {
            available: alarR.available,
            value: alarR.value !== null ? clamp012(alarR.value) : null,
            confidence: alarR.confidence
          },
          {
            available: nlR.available,
            value: nlR.value !== null ? clamp012(nlR.value) : null,
            confidence: nlR.confidence * 0.8
          }
        ],
        "mean"
      ).value,
      denseConfidence: Math.max(alarR.confidence, nlR.confidence * 0.8)
    })
  );
  void jaw;
  const jawOpenGapActive = gapC.available && gapC.value !== null && gapC.value > 0.08;
  const jawOpenDense = jawOpenGapActive ? {
    value: clamp012(gapC.value),
    confidence: gapC.confidence
  } : { value: null, confidence: 0 };
  ctrl(
    controls,
    "jawOpen",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "jawOpen"),
      denseEvidence: jawOpenDense.value,
      denseConfidence: jawOpenDense.confidence
    })
  );
  ctrl(
    controls,
    "jawForward",
    fuseSemanticDense({
      semantic: readSemantic(input.semanticFace, "jawForward"),
      denseEvidence: null,
      denseConfidence: 0
    })
  );
  void width;
  void empty;
  return {
    contractVersion: LIVEACT_HYBRID_FACE_CONTRACT,
    sequence: input.sequence,
    timestampMs: input.timestampMs,
    presence: true,
    denseSequenceAligned: true,
    controls
  };
}

// src/domains/character/liveact/liveact-performance-face-contract.ts
var SAGATREE_PERFORMANCE_FACE_CONTRACT = "SagaTreePerformanceFaceV2";
var PERFORMANCE_FACE_VALIDATOR_VERSION = "performance-face-validator-v1";
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

// src/domains/character/liveact/liveact-performance-face-drive.ts
function hybridOrFace(hybrid, face, hybridKey, faceKey) {
  const h = hybrid?.controls[hybridKey];
  if (h && typeof h.value === "number" && Number.isFinite(h.value)) {
    return clampPerformanceFaceWeight(h.value);
  }
  if (face && typeof face[faceKey] === "number") {
    return clampLiveActChannel(face[faceKey]);
  }
  return 0;
}
function max2(a, b) {
  return a >= b ? a : b;
}
function drivePerformanceFaceWeights(input) {
  const { hybrid, face } = input;
  const out = {
    nasolabialFoldLeft: hybridOrFace(hybrid, face, "noseSneerLeft", "noseSneerLeft"),
    nasolabialFoldRight: hybridOrFace(hybrid, face, "noseSneerRight", "noseSneerRight"),
    cheekVolumeLeft: max2(
      hybridOrFace(hybrid, face, "cheekSquintLeft", "cheekSquintLeft"),
      hybridOrFace(hybrid, face, "cheekPuff", "cheekPuff") * 0.85
    ),
    cheekVolumeRight: max2(
      hybridOrFace(hybrid, face, "cheekSquintRight", "cheekSquintRight"),
      hybridOrFace(hybrid, face, "cheekPuff", "cheekPuff") * 0.85
    ),
    lipContourUpperLeft: hybridOrFace(
      hybrid,
      face,
      "mouthUpperUpLeft",
      "mouthUpperUpLeft"
    ),
    lipContourUpperRight: hybridOrFace(
      hybrid,
      face,
      "mouthUpperUpRight",
      "mouthUpperUpRight"
    ),
    lipContourLowerLeft: hybridOrFace(
      hybrid,
      face,
      "mouthLowerDownLeft",
      "mouthLowerDownLeft"
    ),
    lipContourLowerRight: hybridOrFace(
      hybrid,
      face,
      "mouthLowerDownRight",
      "mouthLowerDownRight"
    ),
    lidTightenLeft: face ? clampLiveActChannel(face.eyeSquintLeft) : 0,
    lidTightenRight: face ? clampLiveActChannel(face.eyeSquintRight) : 0
  };
  for (const id of PERFORMANCE_FACE_ALL_CONTROLS) {
    const w = out[id];
    if (w === void 0) continue;
    out[id] = clampPerformanceFaceWeight(w);
  }
  return out;
}
function measurePerformanceFaceContourProxy(weights) {
  const keys = [
    "lipContourUpperLeft",
    "lipContourUpperRight",
    "lipContourLowerLeft",
    "lipContourLowerRight"
  ];
  let sum = 0;
  let n = 0;
  for (const id of keys) {
    const w = weights[id];
    if (typeof w === "number" && Number.isFinite(w)) {
      sum += w;
      n += 1;
    }
  }
  if (n === 0) return { mean: 0, sampleCount: 0, status: "NOT_MEASURED" };
  return { mean: sum / n, sampleCount: n, status: "MEASURED" };
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

// src/domains/character/liveact/liveact-perfect-fidelity-v2-e2e.ts
var LIVEACT_PERFECT_FIDELITY_V2_E2E_CONTRACT = "SagaTreeLiveActPerfectFidelityV2E2E";
function buildCoreArkitChannels() {
  return [...LIVEACT_FACE_ASSET_CORE_V1_CHANNELS];
}
function buildCanonicalFace3Inventory() {
  const arkit = buildCoreArkitChannels();
  return {
    presentTargetNames: [...arkit],
    hasHumanoid: true,
    hasHead: true,
    gazeDrivePath: "bones",
    arkitPresentChannels: arkit,
    filenameHint: "m5-face3.glb"
  };
}
function buildExternalPremiumInventory() {
  const arkit = buildCoreArkitChannels();
  return {
    presentTargetNames: [
      ...arkit,
      ...PERFORMANCE_FACE_REQUIRED_PREMIUM_CONTROLS,
      "lidTightenLeft",
      "lidTightenRight"
    ],
    hasHumanoid: true,
    hasHead: true,
    gazeDrivePath: "bones",
    arkitPresentChannels: arkit,
    filenameHint: "external-arkit-only-name.glb"
  };
}
function listPerfectFidelityV2AvatarProfiles() {
  return [
    {
      id: "canonical-face3",
      label: "Canonical Human face3 (Standard; Premium morphs blocker)",
      inventory: buildCanonicalFace3Inventory(),
      premiumBlockerAllowed: true
    },
    {
      id: "external-premium-fixture",
      label: "External Premium fixture inventory",
      inventory: buildExternalPremiumInventory(),
      premiumBlockerAllowed: false
    }
  ];
}
function evaluatePerfectFidelityV2Avatar(profile) {
  const report = validatePerformanceFaceV2(profile.inventory);
  const premiumBlockerDocumented = profile.premiumBlockerAllowed && report.standardEligible && !report.premiumEligible && report.missingRequired.length > 0;
  return {
    profileId: profile.id,
    report,
    standardOk: report.standardEligible,
    premiumOk: report.premiumEligible,
    premiumBlockerDocumented,
    filenameHackBlocked: report.warnings.some((w) => /ignoriert/i.test(w))
  };
}
function runPerfectFidelityV2E2e() {
  const profiles = listPerfectFidelityV2AvatarProfiles();
  const avatars = profiles.map(evaluatePerfectFidelityV2Avatar);
  const canonical = avatars.find((a) => a.profileId === "canonical-face3");
  const external = avatars.find((a) => a.profileId === "external-premium-fixture");
  const face = mergeLiveActFaceChannels({
    noseSneerLeft: 0.55,
    noseSneerRight: 0.5,
    cheekPuff: 0.4,
    cheekSquintLeft: 0.35,
    cheekSquintRight: 0.32,
    mouthUpperUpLeft: 0.45,
    mouthUpperUpRight: 0.42,
    mouthLowerDownLeft: 0.38,
    mouthLowerDownRight: 0.36,
    eyeSquintLeft: 0.2,
    eyeSquintRight: 0.18
  });
  const hybrid = solveHybridFace({
    semanticFace: face,
    dense: null,
    sequence: 1,
    timestampMs: 0,
    denseSequence: null
  });
  const weights = drivePerformanceFaceWeights({ hybrid, face });
  const written = {};
  const externalReport = external?.report;
  if (externalReport?.premiumEligible) {
    applyPerformanceFaceWeights({
      writeWeight: (name, w) => {
        if (isPerformanceFaceControlId(name)) written[name] = w;
      },
      resolvedNames: externalReport.resolvedTargetNames,
      weights
    });
  }
  const contour = measurePerformanceFaceContourProxy(written);
  return {
    contractVersion: LIVEACT_PERFECT_FIDELITY_V2_E2E_CONTRACT,
    avatars,
    standardFallbackGreen: Boolean(canonical?.standardOk && !canonical.premiumOk),
    externalPremiumPass: Boolean(external?.premiumOk),
    canonicalPremiumBlockerOk: Boolean(canonical?.premiumBlockerDocumented),
    applyPath: {
      appliedControls: Object.keys(written).length,
      contour
    },
    privacy: { biometricsCommitted: false }
  };
}
export {
  LIVEACT_PERFECT_FIDELITY_V2_E2E_CONTRACT,
  buildCanonicalFace3Inventory,
  buildCoreArkitChannels,
  buildExternalPremiumInventory,
  evaluatePerfectFidelityV2Avatar,
  listPerfectFidelityV2AvatarProfiles,
  runPerfectFidelityV2E2e
};

// src/domains/character/liveact/liveact-face-contract.ts
var LIVEACT_FACE_CONTRACT_VERSION = "SagaTreeLiveActFaceV1";
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
function assertLiveActFaceChannelsLocalOnly(channels) {
  const record = channels;
  if (record.landmarks !== void 0 || record.video !== void 0 || record.imageData !== void 0) {
    throw new Error("LiveAct-Face-Channels d\xFCrfen keine Rohvideo-/Landmark-Daten tragen.");
  }
}

// src/domains/character/liveact/liveact-contract.ts
var LIVEACT_CONTRACT_VERSION = "SagaTreeLiveActFrameV1";
var LIVEACT_STATUSES = [
  "idle",
  "starting",
  "active",
  "paused",
  "lost",
  "denied",
  "unsupported",
  "stopped",
  "error"
];
var DEFAULT_LIVEACT_LIMITS = {
  maxYaw: 0.55,
  maxPitch: 0.4,
  maxRoll: 0.35,
  presenceThreshold: 0.45,
  desktopFps: 30,
  mobileFps: 15,
  smooth: 0.35
};
var LIVEACT_QUALITY_PROFILES = {
  desktop: {
    id: "desktop",
    labelDe: "Desktop",
    fpsCap: DEFAULT_LIVEACT_LIMITS.desktopFps,
    enableHeadPose: true,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true
  },
  mobile: {
    id: "mobile",
    labelDe: "Mobile",
    fpsCap: DEFAULT_LIVEACT_LIMITS.mobileFps,
    enableHeadPose: false,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false
  }
};
function isLiveActStatus(value) {
  return typeof value === "string" && LIVEACT_STATUSES.includes(value);
}
function resolveLiveActQualityProfile(input) {
  const limits = input.limits ?? DEFAULT_LIVEACT_LIMITS;
  const useMobile = input.isMobile === true || typeof input.maxTouchPoints === "number" && input.maxTouchPoints > 1;
  if (useMobile) {
    return {
      ...LIVEACT_QUALITY_PROFILES.mobile,
      fpsCap: limits.mobileFps
    };
  }
  return {
    ...LIVEACT_QUALITY_PROFILES.desktop,
    fpsCap: limits.desktopFps
  };
}
function clampLiveActAngle(value, maxAbs) {
  if (!Number.isFinite(value)) return 0;
  if (value > maxAbs) return maxAbs;
  if (value < -maxAbs) return -maxAbs;
  return value;
}
function clampLiveActGaze(value) {
  if (!Number.isFinite(value)) return 0;
  if (value > 1) return 1;
  if (value < -1) return -1;
  return value;
}
function selectPrimaryLiveActFaceIndex(faces) {
  if (faces.length === 0) return -1;
  let best = 0;
  let bestScore = faces[0]?.presence ?? 0;
  for (let i = 1; i < faces.length; i += 1) {
    const score = faces[i]?.presence ?? 0;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}
function createEmptyLiveActSourceSample() {
  return {
    presence: 0,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
    eyeLeftX: 0,
    eyeLeftY: 0,
    eyeRightX: 0,
    eyeRightY: 0,
    face: {},
    faceIndex: -1,
    faceCount: 0
  };
}
function createNeutralLiveActFrame(input) {
  return {
    contractVersion: LIVEACT_CONTRACT_VERSION,
    faceContractVersion: LIVEACT_FACE_CONTRACT_VERSION,
    timestampMs: input.timestampMs,
    sequence: input.sequence,
    confidence: 0,
    trackingLost: input.trackingLost ?? true,
    head: { yaw: 0, pitch: 0, roll: 0 },
    eyeLeft: { x: 0, y: 0 },
    eyeRight: { x: 0, y: 0 },
    face: createNeutralLiveActFaceChannels()
  };
}
function mapLiveActSourceSample(sample, input) {
  const limits = input.limits ?? DEFAULT_LIVEACT_LIMITS;
  const lost = sample.presence < limits.presenceThreshold || sample.faceIndex < 0;
  if (lost) {
    return createNeutralLiveActFrame({
      timestampMs: input.timestampMs,
      sequence: input.sequence,
      trackingLost: true
    });
  }
  const face = mergeLiveActFaceChannels(sample.face);
  assertLiveActFaceChannelsLocalOnly(face);
  return {
    contractVersion: LIVEACT_CONTRACT_VERSION,
    faceContractVersion: LIVEACT_FACE_CONTRACT_VERSION,
    timestampMs: input.timestampMs,
    sequence: input.sequence,
    confidence: clampLiveActChannel(sample.presence),
    trackingLost: false,
    head: {
      yaw: clampLiveActAngle(sample.headYaw, limits.maxYaw),
      pitch: clampLiveActAngle(sample.headPitch, limits.maxPitch),
      roll: clampLiveActAngle(sample.headRoll, limits.maxRoll)
    },
    eyeLeft: {
      x: clampLiveActGaze(sample.eyeLeftX),
      y: clampLiveActGaze(sample.eyeLeftY)
    },
    eyeRight: {
      x: clampLiveActGaze(sample.eyeRightX),
      y: clampLiveActGaze(sample.eyeRightY)
    },
    face
  };
}
function smoothLiveActFrame(previous, next, alpha = DEFAULT_LIVEACT_LIMITS.smooth) {
  const t = clampLiveActChannel(alpha);
  if (!previous || next.trackingLost) {
    if (!previous) return next;
    const ease = clampLiveActChannel(t * 0.65);
    return {
      ...createNeutralLiveActFrame({
        timestampMs: next.timestampMs,
        sequence: next.sequence,
        trackingLost: true
      }),
      head: {
        yaw: previous.head.yaw * (1 - ease),
        pitch: previous.head.pitch * (1 - ease),
        roll: previous.head.roll * (1 - ease)
      },
      eyeLeft: {
        x: previous.eyeLeft.x * (1 - ease),
        y: previous.eyeLeft.y * (1 - ease)
      },
      eyeRight: {
        x: previous.eyeRight.x * (1 - ease),
        y: previous.eyeRight.y * (1 - ease)
      }
    };
  }
  const lerp = (a, b) => a + (b - a) * t;
  const face = createNeutralLiveActFaceChannels();
  for (const key of Object.keys(face)) {
    face[key] = lerp(previous.face[key] ?? 0, next.face[key] ?? 0);
  }
  return {
    contractVersion: LIVEACT_CONTRACT_VERSION,
    faceContractVersion: LIVEACT_FACE_CONTRACT_VERSION,
    timestampMs: next.timestampMs,
    sequence: next.sequence,
    confidence: lerp(previous.confidence, next.confidence),
    trackingLost: false,
    head: {
      yaw: lerp(previous.head.yaw, next.head.yaw),
      pitch: lerp(previous.head.pitch, next.head.pitch),
      roll: lerp(previous.head.roll, next.head.roll)
    },
    eyeLeft: {
      x: lerp(previous.eyeLeft.x, next.eyeLeft.x),
      y: lerp(previous.eyeLeft.y, next.eyeLeft.y)
    },
    eyeRight: {
      x: lerp(previous.eyeRight.x, next.eyeRight.x),
      y: lerp(previous.eyeRight.y, next.eyeRight.y)
    },
    face
  };
}
function liveActStatusLabelDe(status) {
  switch (status) {
    case "idle":
      return "LiveAct aus";
    case "starting":
      return "Kamera wird vorbereitet \u2026";
    case "active":
      return "LiveAct aktiv";
    case "paused":
      return "LiveAct pausiert (Tab im Hintergrund)";
    case "lost":
      return "Gesicht verloren \u2014 weiche R\xFCckkehr zu Neutral";
    case "denied":
      return "Kamerazugriff verweigert \u2014 bitte Browser-Berechtigung pr\xFCfen";
    case "unsupported":
      return "LiveAct wird in diesem Browser nicht unterst\xFCtzt";
    case "stopped":
      return "LiveAct gestoppt";
    case "error":
      return "LiveAct Fehler \u2014 bitte erneut starten";
    default:
      return "LiveAct";
  }
}
function assertLiveActFrameLocalOnly(frame) {
  const record = frame;
  if (record.landmarks !== void 0 || record.video !== void 0 || record.imageData !== void 0 || record.serialize !== void 0) {
    throw new Error("LiveActFrame darf keine Rohvideo-/Landmark-/Serialize-Daten tragen.");
  }
  assertLiveActFaceChannelsLocalOnly(frame.face);
}
export {
  DEFAULT_LIVEACT_LIMITS,
  LIVEACT_CONTRACT_VERSION,
  LIVEACT_QUALITY_PROFILES,
  LIVEACT_STATUSES,
  assertLiveActFrameLocalOnly,
  clampLiveActAngle,
  clampLiveActGaze,
  createEmptyLiveActSourceSample,
  createNeutralLiveActFrame,
  isLiveActStatus,
  liveActStatusLabelDe,
  mapLiveActSourceSample,
  resolveLiveActQualityProfile,
  selectPrimaryLiveActFaceIndex,
  smoothLiveActFrame
};

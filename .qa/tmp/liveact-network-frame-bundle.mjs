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
function isLiveActFaceChannelId(value) {
  return typeof value === "string" && LIVEACT_FACE_CHANNELS.includes(value);
}
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
function assertLiveActFaceChannelsLocalOnly(channels) {
  const record = channels;
  if (record.landmarks !== void 0 || record.video !== void 0 || record.imageData !== void 0) {
    throw new Error("LiveAct-Face-Channels d\xFCrfen keine Rohvideo-/Landmark-Daten tragen.");
  }
}

// src/domains/character/liveact/liveact-contract.ts
var LIVEACT_CONTRACT_VERSION = "SagaTreeLiveActFrameV1";
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

// src/domains/character/liveact/liveact-network-frame.ts
var LIVEACT_NETWORK_FRAME_CONTRACT = "SagaTreeLiveActNetworkFrameV1";
var LIVEACT_NETWORK_TOPIC = "liveact-data";
var LIVEACT_NETWORK_MAX_SEND_HZ = 30;
var LIVEACT_NETWORK_STALE_MS = 500;
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function encodeSparseFace(face) {
  const out = {};
  for (const id of LIVEACT_FACE_CHANNELS) {
    const v = face[id];
    const neutral = id === "_neutral" ? 1 : 0;
    if (Math.abs(v - neutral) < 1e-4) continue;
    out[id] = clampLiveActChannel(v);
  }
  return out;
}
function encodeLiveActNetworkFrame(frame, options) {
  assertLiveActFaceChannelsLocalOnly(frame.face);
  return {
    contractVersion: LIVEACT_NETWORK_FRAME_CONTRACT,
    sequence: frame.sequence,
    timestampMs: frame.timestampMs,
    confidence: frame.confidence,
    trackingLost: frame.trackingLost === true,
    head: {
      yaw: frame.head.yaw,
      pitch: frame.head.pitch,
      roll: frame.head.roll
    },
    eyeLeft: { x: frame.eyeLeft.x, y: frame.eyeLeft.y },
    eyeRight: { x: frame.eyeRight.x, y: frame.eyeRight.y },
    face: encodeSparseFace(frame.face),
    faceCapabilityLevel: options?.faceCapabilityLevel
  };
}
function decodeLiveActNetworkFrame(raw) {
  if (!isPlainObject(raw)) {
    return { ok: false, reason: "invalid_shape", detail: "Payload ist kein Objekt." };
  }
  if (raw.contractVersion !== LIVEACT_NETWORK_FRAME_CONTRACT) {
    return {
      ok: false,
      reason: "unsupported_contract",
      detail: `Unbekannter Network-Contract: ${String(raw.contractVersion)}`
    };
  }
  for (const banned of ["landmarks", "video", "imageData", "iris", "webcam", "calibrationProfile"]) {
    if (raw[banned] !== void 0) {
      return {
        ok: false,
        reason: "biometric_forbidden",
        detail: `Verbotenes Feld: ${banned}`
      };
    }
  }
  if (typeof raw.sequence !== "number" || !Number.isFinite(raw.sequence) || raw.sequence < 1) {
    return { ok: false, reason: "invalid_shape", detail: "sequence ung\xFCltig." };
  }
  if (typeof raw.timestampMs !== "number" || !Number.isFinite(raw.timestampMs)) {
    return { ok: false, reason: "invalid_shape", detail: "timestampMs ung\xFCltig." };
  }
  if (typeof raw.confidence !== "number" || !Number.isFinite(raw.confidence)) {
    return { ok: false, reason: "invalid_shape", detail: "confidence ung\xFCltig." };
  }
  if (typeof raw.trackingLost !== "boolean") {
    return { ok: false, reason: "invalid_shape", detail: "trackingLost ung\xFCltig." };
  }
  if (!isPlainObject(raw.head) || !isPlainObject(raw.eyeLeft) || !isPlainObject(raw.eyeRight)) {
    return { ok: false, reason: "invalid_shape", detail: "head/eyes ung\xFCltig." };
  }
  const head = {
    yaw: Number(raw.head.yaw) || 0,
    pitch: Number(raw.head.pitch) || 0,
    roll: Number(raw.head.roll) || 0
  };
  const eyeLeft = {
    x: Number(raw.eyeLeft.x) || 0,
    y: Number(raw.eyeLeft.y) || 0
  };
  const eyeRight = {
    x: Number(raw.eyeRight.x) || 0,
    y: Number(raw.eyeRight.y) || 0
  };
  const facePartial = {};
  if (raw.face !== void 0) {
    if (!isPlainObject(raw.face)) {
      return { ok: false, reason: "invalid_shape", detail: "face ung\xFCltig." };
    }
    for (const [key, value] of Object.entries(raw.face)) {
      if (!isLiveActFaceChannelId(key)) continue;
      if (typeof value !== "number") continue;
      facePartial[key] = clampLiveActChannel(value);
    }
  }
  let faceCapabilityLevel;
  if (raw.faceCapabilityLevel !== void 0) {
    if (raw.faceCapabilityLevel !== 0 && raw.faceCapabilityLevel !== 1 && raw.faceCapabilityLevel !== 2 && raw.faceCapabilityLevel !== 3) {
      return { ok: false, reason: "invalid_shape", detail: "faceCapabilityLevel ung\xFCltig." };
    }
    faceCapabilityLevel = raw.faceCapabilityLevel;
  }
  const network = {
    contractVersion: LIVEACT_NETWORK_FRAME_CONTRACT,
    sequence: raw.sequence,
    timestampMs: raw.timestampMs,
    confidence: Math.min(1, Math.max(0, raw.confidence)),
    trackingLost: raw.trackingLost,
    head,
    eyeLeft,
    eyeRight,
    face: facePartial,
    faceCapabilityLevel
  };
  const faceBase = createNeutralLiveActFaceChannels();
  for (const id of LIVEACT_FACE_CHANNELS) {
    const v = facePartial[id];
    if (typeof v === "number") faceBase[id] = v;
  }
  assertLiveActFaceChannelsLocalOnly(faceBase);
  const liveAct = {
    contractVersion: LIVEACT_CONTRACT_VERSION,
    faceContractVersion: LIVEACT_FACE_CONTRACT_VERSION,
    sequence: network.sequence,
    timestampMs: network.timestampMs,
    confidence: network.confidence,
    trackingLost: network.trackingLost,
    head: network.head,
    eyeLeft: network.eyeLeft,
    eyeRight: network.eyeRight,
    face: faceBase
  };
  return { ok: true, frame: network, liveAct };
}
function serializeLiveActNetworkFrame(frame) {
  return JSON.stringify(frame);
}
function parseLiveActNetworkFrameJson(text) {
  try {
    return decodeLiveActNetworkFrame(JSON.parse(text));
  } catch {
    return { ok: false, reason: "invalid_shape", detail: "JSON parse fehlgeschlagen." };
  }
}
export {
  LIVEACT_NETWORK_FRAME_CONTRACT,
  LIVEACT_NETWORK_MAX_SEND_HZ,
  LIVEACT_NETWORK_STALE_MS,
  LIVEACT_NETWORK_TOPIC,
  decodeLiveActNetworkFrame,
  encodeLiveActNetworkFrame,
  parseLiveActNetworkFrameJson,
  serializeLiveActNetworkFrame
};

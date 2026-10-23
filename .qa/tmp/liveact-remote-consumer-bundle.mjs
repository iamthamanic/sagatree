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
function createNeutralLiveActFaceChannels() {
  const out = {};
  for (const id of LIVEACT_FACE_CHANNELS) {
    out[id] = id === "_neutral" ? 1 : 0;
  }
  return out;
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

// src/domains/character/liveact/liveact-network-frame.ts
var LIVEACT_NETWORK_STALE_MS = 500;

// src/domains/character/liveact/liveact-remote-consumer.ts
function createLiveActRemoteConsumerState() {
  return { lastSequence: 0, lastAcceptWallMs: 0, active: false };
}
function acceptLiveActRemoteFrame(input) {
  const staleMs = input.staleMs ?? LIVEACT_NETWORK_STALE_MS;
  const { network, liveAct, nowWallMs } = input;
  let state = { ...input.state };
  if (network.sequence <= state.lastSequence) {
    return {
      state,
      result: {
        action: "drop",
        reason: network.sequence === state.lastSequence ? "duplicate" : "out_of_order"
      }
    };
  }
  if (state.lastAcceptWallMs > 0 && nowWallMs - state.lastAcceptWallMs > staleMs * 4) {
  } else if (state.active && state.lastAcceptWallMs > 0 && nowWallMs - state.lastAcceptWallMs > staleMs && network.sequence > state.lastSequence + 1) {
  }
  if (state.active && state.lastAcceptWallMs > 0 && network.timestampMs + staleMs < (input.liveAct.timestampMs || network.timestampMs)) {
  }
  void staleMs;
  state = {
    lastSequence: network.sequence,
    lastAcceptWallMs: nowWallMs,
    active: true
  };
  if (network.trackingLost) {
    const neutral = createNeutralLiveActFrame({
      timestampMs: network.timestampMs,
      sequence: network.sequence,
      trackingLost: true
    });
    return { state, result: { action: "neutral", frame: neutral } };
  }
  return { state, result: { action: "apply", frame: liveAct } };
}
function clearLiveActRemoteConsumer(state) {
  return {
    state: createLiveActRemoteConsumerState(),
    result: {
      action: "neutral",
      frame: createNeutralLiveActFrame({
        timestampMs: state.lastAcceptWallMs || 0,
        sequence: Math.max(1, state.lastSequence),
        trackingLost: true
      })
    }
  };
}
function userIdFromMediaIdentity(identity) {
  const trimmed = identity.trim();
  if (trimmed.startsWith("user:")) {
    const id = trimmed.slice("user:".length).trim();
    return id.length > 0 ? id : null;
  }
  return null;
}
function resolveRemoteLiveActCharacterId(input) {
  const userId = userIdFromMediaIdentity(input.publisherIdentity);
  if (!userId) return null;
  const characterId = input.rosterByUserId[userId];
  if (typeof characterId !== "string" || characterId.trim().length === 0) return null;
  return characterId.trim();
}
export {
  acceptLiveActRemoteFrame,
  clearLiveActRemoteConsumer,
  createLiveActRemoteConsumerState,
  resolveRemoteLiveActCharacterId,
  userIdFromMediaIdentity
};

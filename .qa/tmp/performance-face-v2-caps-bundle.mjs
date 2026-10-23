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
function createEmptyLiveActAvatarFaceSupport() {
  const out = {};
  for (const id of LIVEACT_FACE_CHANNELS) {
    out[id] = false;
  }
  return out;
}
function createLiveActInputCapabilities(input) {
  return {
    face: input.face === true,
    headPose: input.headPose === true,
    eyeGaze: input.eyeGaze === true
  };
}
function createLiveActAvatarCapabilities(input) {
  const avatarFace = createEmptyLiveActAvatarFaceSupport();
  let active = 0;
  for (const id of LIVEACT_FACE_CHANNELS) {
    const supported = input.avatarFace?.[id] === true;
    avatarFace[id] = supported;
    if (supported) active += 1;
  }
  return {
    avatarBones: {
      head: input.headBone === true,
      leftEye: input.leftEyeBone === true,
      rightEye: input.rightEyeBone === true
    },
    avatarFace,
    activeFaceChannelCount: active,
    totalFaceChannelCount: LIVEACT_FACE_CHANNELS.length,
    gazeDrivePath: input.gazeDrivePath ?? "none",
    runtimeKind: input.runtimeKind ?? "gltf"
  };
}
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
function createLiveActCapabilities(input) {
  return composeLiveActCapabilities(
    createLiveActInputCapabilities({
      face: input.face,
      headPose: input.headPose,
      eyeGaze: input.eyeGaze
    }),
    createLiveActAvatarCapabilities({
      headBone: input.headBone,
      leftEyeBone: input.leftEyeBone,
      rightEyeBone: input.rightEyeBone,
      avatarFace: input.avatarFace
    })
  );
}
export {
  LIVEACT_CAPABILITIES_VERSION,
  composeLiveActCapabilities,
  createEmptyLiveActAvatarFaceSupport,
  createLiveActAvatarCapabilities,
  createLiveActCapabilities,
  createLiveActInputCapabilities
};

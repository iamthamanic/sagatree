/**
 * scene-live-runtime-v2 — Reference-based Live Scene container (#366).
 * Location: src/domains/session/presentation/scene-live-runtime-v2.ts
 *
 * Semantic scene config via refs only. Normalizes #301 SharedScenePresentation V1
 * without duplicating Look/Character/NPC definitions. Never imports React/backend clients.
 */

import {
  readSharedScenePresentation,
  type SceneRef,
  type SharedScenePresentation,
  type SceneVisibleActor,
} from '../contracts/shared-scene-presentation';
import {
  canReadVisibilityAudience,
  type LiveSessionAccess,
} from '../contracts/live-session-access';

export const SCENE_PRESENTATION_CONFIG_V2_SCHEMA_VERSION = 2 as const;

export type OpaqueRef = {
  readonly id: string;
};

export type SceneLookRef = {
  /** LookProfile.id — resolve via Look domain; never embed Look blobs. */
  readonly lookId: string | null;
};

export type SceneVisibleActorRef = {
  readonly kind: SceneVisibleActor['kind'];
  readonly id: string | null;
  readonly publicId: string | null;
  readonly role: SceneVisibleActor['role'];
  /** Display-safe projection fields from V1; not a definition copy. */
  readonly displayName: string;
  readonly portraitUrl: string | null;
};

/**
 * Authoritative reference-based scene live config.
 * Optional fields start null until later GM/Director slices publish them.
 */
export type ScenePresentationConfigV2 = {
  readonly schemaVersion: typeof SCENE_PRESENTATION_CONFIG_V2_SCHEMA_VERSION;
  readonly authoritative: true;
  readonly title: string;
  readonly locationLabel: string | null;
  readonly description: string | null;
  readonly backdropUrl: string | null;
  readonly sceneRef: SceneRef | null;
  readonly locationRef: OpaqueRef | null;
  readonly environmentRef: OpaqueRef | null;
  readonly stageRef: OpaqueRef | null;
  readonly lookRef: SceneLookRef;
  readonly visibleActorRefs: readonly SceneVisibleActorRef[];
  readonly mapRef: OpaqueRef | null;
  readonly audioCueRefs: readonly OpaqueRef[];
  readonly revealRefs: readonly OpaqueRef[];
  /** GM-only ref ids — never include note bodies in shared public projection. */
  readonly gmNoteRefs: readonly OpaqueRef[];
  readonly directorPresetRef: OpaqueRef | null;
  readonly liveActPolicyRef: OpaqueRef | null;
  readonly updatedAt: string | null;
  /** True when config was synthesized from V1 without a stored V2 blob. */
  readonly normalizedFromV1: boolean;
};

export type ScenePresentationPublicProjection = {
  readonly schemaVersion: typeof SCENE_PRESENTATION_CONFIG_V2_SCHEMA_VERSION;
  readonly title: string;
  readonly locationLabel: string | null;
  readonly description: string | null;
  readonly backdropUrl: string | null;
  readonly sceneRef: SceneRef | null;
  readonly lookRef: SceneLookRef;
  readonly visibleActorRefs: readonly SceneVisibleActorRef[];
  readonly mapRef: OpaqueRef | null;
  readonly audioCueRefs: readonly OpaqueRef[];
  readonly revealRefs: readonly OpaqueRef[];
  readonly environmentRef: OpaqueRef | null;
  readonly stageRef: OpaqueRef | null;
  readonly locationRef: OpaqueRef | null;
  readonly directorPresetRef: OpaqueRef | null;
  readonly liveActPolicyRef: OpaqueRef | null;
  readonly lookAvailable: boolean;
  readonly environmentMode: 'backdrop' | 'neutral' | 'look-pending';
  readonly updatedAt: string | null;
};

export type ScenePresentationGmProjection = ScenePresentationPublicProjection & {
  readonly gmNoteRefs: readonly OpaqueRef[];
};

export type SceneLiveRef = {
  readonly kind: 'session-scene';
  readonly sceneRef: SceneRef | null;
  readonly config: ScenePresentationConfigV2;
};

function opaqueRef(id: unknown): OpaqueRef | null {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  return { id: trimmed.slice(0, 128) };
}

function parseOpaqueRefList(raw: unknown): OpaqueRef[] {
  if (!Array.isArray(raw)) return [];
  const out: OpaqueRef[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const ref = opaqueRef(item);
      if (ref) out.push(ref);
      continue;
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const ref = opaqueRef((item as Record<string, unknown>).id);
      if (ref) out.push(ref);
    }
  }
  return out.slice(0, 48);
}

function actorToRef(actor: SceneVisibleActor): SceneVisibleActorRef {
  return {
    kind: actor.kind,
    id: actor.id,
    publicId: actor.publicId,
    role: actor.role,
    displayName: actor.displayName,
    portraitUrl: actor.portraitUrl,
  };
}

/**
 * Normalize #301 V1 presentation into V2 reference container.
 */
export function normalizeScenePresentationV1(
  v1: SharedScenePresentation | null,
): ScenePresentationConfigV2 | null {
  if (!v1) return null;
  return {
    schemaVersion: SCENE_PRESENTATION_CONFIG_V2_SCHEMA_VERSION,
    authoritative: true,
    title: v1.title,
    locationLabel: v1.locationLabel,
    description: v1.description,
    backdropUrl: v1.backdropUrl,
    sceneRef: v1.sceneRef,
    locationRef: v1.sceneRef?.id ? { id: v1.sceneRef.id } : null,
    environmentRef: null,
    stageRef: null,
    lookRef: { lookId: null },
    visibleActorRefs: v1.visibleActors.map(actorToRef),
    mapRef: null,
    audioCueRefs: [],
    revealRefs: [],
    gmNoteRefs: [],
    directorPresetRef: null,
    liveActPolicyRef: null,
    updatedAt: v1.updatedAt,
    normalizedFromV1: true,
  };
}

function parseStoredV2(raw: unknown): ScenePresentationConfigV2 | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.authoritative !== true) return null;
  if (obj.schemaVersion !== SCENE_PRESENTATION_CONFIG_V2_SCHEMA_VERSION) return null;
  if (typeof obj.title !== 'string' || !obj.title.trim()) return null;

  const lookRaw = obj.lookRef;
  let lookId: string | null = null;
  if (lookRaw && typeof lookRaw === 'object' && !Array.isArray(lookRaw)) {
    const id = (lookRaw as Record<string, unknown>).lookId;
    lookId = typeof id === 'string' && id.trim() ? id.trim().slice(0, 128) : null;
  }

  const actorsRaw = Array.isArray(obj.visibleActorRefs) ? obj.visibleActorRefs : [];
  const visibleActorRefs: SceneVisibleActorRef[] = [];
  for (const item of actorsRaw.slice(0, 24)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const a = item as Record<string, unknown>;
    const displayName = typeof a.displayName === 'string' ? a.displayName.trim() : '';
    if (!displayName) continue;
    visibleActorRefs.push({
      kind:
        a.kind === 'character' || a.kind === 'npc' || a.kind === 'creature' || a.kind === 'other'
          ? a.kind
          : 'other',
      id: typeof a.id === 'string' ? a.id : null,
      publicId: typeof a.publicId === 'string' ? a.publicId : null,
      role:
        a.role === 'pc' || a.role === 'npc' || a.role === 'creature' || a.role === 'other'
          ? a.role
          : 'other',
      displayName: displayName.slice(0, 80),
      portraitUrl: typeof a.portraitUrl === 'string' ? a.portraitUrl : null,
    });
  }

  const sceneRef =
    obj.sceneRef && typeof obj.sceneRef === 'object' && !Array.isArray(obj.sceneRef)
      ? (obj.sceneRef as SceneRef)
      : null;

  return {
    schemaVersion: SCENE_PRESENTATION_CONFIG_V2_SCHEMA_VERSION,
    authoritative: true,
    title: obj.title.trim().slice(0, 120),
    locationLabel: typeof obj.locationLabel === 'string' ? obj.locationLabel : null,
    description: typeof obj.description === 'string' ? obj.description : null,
    backdropUrl: typeof obj.backdropUrl === 'string' ? obj.backdropUrl : null,
    sceneRef,
    locationRef: opaqueRef(
      obj.locationRef && typeof obj.locationRef === 'object'
        ? (obj.locationRef as Record<string, unknown>).id
        : null,
    ),
    environmentRef: opaqueRef(
      obj.environmentRef && typeof obj.environmentRef === 'object'
        ? (obj.environmentRef as Record<string, unknown>).id
        : null,
    ),
    stageRef: opaqueRef(
      obj.stageRef && typeof obj.stageRef === 'object'
        ? (obj.stageRef as Record<string, unknown>).id
        : null,
    ),
    lookRef: { lookId },
    visibleActorRefs,
    mapRef: opaqueRef(
      obj.mapRef && typeof obj.mapRef === 'object'
        ? (obj.mapRef as Record<string, unknown>).id
        : null,
    ),
    audioCueRefs: parseOpaqueRefList(obj.audioCueRefs),
    revealRefs: parseOpaqueRefList(obj.revealRefs),
    gmNoteRefs: parseOpaqueRefList(obj.gmNoteRefs),
    directorPresetRef: opaqueRef(
      obj.directorPresetRef && typeof obj.directorPresetRef === 'object'
        ? (obj.directorPresetRef as Record<string, unknown>).id
        : null,
    ),
    liveActPolicyRef: opaqueRef(
      obj.liveActPolicyRef && typeof obj.liveActPolicyRef === 'object'
        ? (obj.liveActPolicyRef as Record<string, unknown>).id
        : null,
    ),
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : null,
    normalizedFromV1: false,
  };
}

/**
 * Read V2 config: prefer stored scenePresentationV2, else normalize V1.
 */
export function readScenePresentationConfigV2(
  shared: Record<string, unknown>,
): ScenePresentationConfigV2 | null {
  const stored = parseStoredV2(shared.scenePresentationV2);
  if (stored) return stored;
  return normalizeScenePresentationV1(readSharedScenePresentation(shared));
}

export function resolveEnvironmentMode(
  config: ScenePresentationConfigV2,
): ScenePresentationPublicProjection['environmentMode'] {
  if (config.lookRef.lookId) return 'look-pending';
  if (config.backdropUrl) return 'backdrop';
  return 'neutral';
}

export function buildScenePresentationPublicProjection(
  config: ScenePresentationConfigV2,
): ScenePresentationPublicProjection {
  return {
    schemaVersion: SCENE_PRESENTATION_CONFIG_V2_SCHEMA_VERSION,
    title: config.title,
    locationLabel: config.locationLabel,
    description: config.description,
    backdropUrl: config.backdropUrl,
    sceneRef: config.sceneRef,
    lookRef: config.lookRef,
    visibleActorRefs: config.visibleActorRefs,
    mapRef: config.mapRef,
    audioCueRefs: config.audioCueRefs,
    revealRefs: config.revealRefs,
    environmentRef: config.environmentRef,
    stageRef: config.stageRef,
    locationRef: config.locationRef,
    directorPresetRef: config.directorPresetRef,
    liveActPolicyRef: config.liveActPolicyRef,
    lookAvailable: config.lookRef.lookId !== null,
    environmentMode: resolveEnvironmentMode(config),
    updatedAt: config.updatedAt,
  };
}

export function buildScenePresentationGmProjection(
  config: ScenePresentationConfigV2,
  access: LiveSessionAccess | null,
): ScenePresentationGmProjection | null {
  if (!access || !canReadVisibilityAudience(access, 'gm_only')) {
    return null;
  }
  return {
    ...buildScenePresentationPublicProjection(config),
    gmNoteRefs: config.gmNoteRefs,
  };
}

export function assertPublicProjectionHasNoGmSecrets(
  projection: ScenePresentationPublicProjection,
): void {
  const record = projection as unknown as Record<string, unknown>;
  if ('gmNoteRefs' in record) {
    throw new Error('Public scene projection must not include gmNoteRefs');
  }
  if ('gm_only' in record || 'character_specific' in record) {
    throw new Error('Public scene projection must not include secret keys');
  }
}

export function toSceneLiveRef(
  config: ScenePresentationConfigV2,
): SceneLiveRef {
  return {
    kind: 'session-scene',
    sceneRef: config.sceneRef,
    config,
  };
}

/**
 * Compatibility: project V2 public fields back into V1 shape for existing views.
 */
export function projectSceneV2ToSharedSceneV1(
  config: ScenePresentationConfigV2,
): SharedScenePresentation {
  return {
    schemaVersion: 1,
    title: config.title,
    locationLabel: config.locationLabel,
    description: config.description,
    backdropUrl: config.backdropUrl,
    sceneRef: config.sceneRef,
    visibleActors: config.visibleActorRefs.map((a) => ({
      kind: a.kind,
      id: a.id,
      publicId: a.publicId,
      displayName: a.displayName,
      portraitUrl: a.portraitUrl,
      role: a.role,
    })),
    updatedAt: config.updatedAt,
    authoritative: true,
  };
}

/**
 * look infrastructure barrel (#340 / #342 runtime).
 * Location: src/infrastructure/look/index.ts
 */

export {
  analyzeLookReferencesForDraft,
  archiveLookProfile,
  appendLookProfileVersion,
  createLookProfile,
  createLookProfileFromReferenceAnalysis,
  duplicateLookProfile,
  getLookProfile,
  listLookProfileVersions,
  listLookProfiles,
} from './look-service';

export {
  analyzeLookReferences,
  createEdgeLookReferenceAnalyzer,
  type LookReferenceAnalysisRequest,
  type LookReferenceAnalysisRequestImage,
} from './look-reference-analysis-service';

export {
  LOOK_PROFILE_COLUMNS,
  LOOK_PROFILE_VERSION_COLUMNS,
  mapLookProfileRecord,
  mapLookProfileVersionRow,
  toPersistedVersionInsert,
} from './look.persistence';

export { supabaseLookProfileRepository } from './supabase-look.repository';

export {
  createHostLookAdapter,
  type HostLookAdapter,
} from './host-look-adapter';
export {
  HOST_LOOK_PROFILE_OPS,
  type HostLookProfileOp,
  type HostLookProfilePorts,
  type HostLookProfileRecord,
  type HostLookProfileResult,
  type HostLookProfileVersion,
} from './host-look-ports.contract';

export { createLookRuntime, LookRuntime, type LookRuntimeOptions } from './look-runtime';
export { classifyLookMaterialRole, isTintableLookMaterialRole } from './look-material-roles';
export type {
  LookMaterialRole,
  LookRuntimeApplyResult,
  LookRuntimeTarget,
  LookStyleAdapter,
  LookStyleProviderId,
} from './look-runtime-types';
export { createHostMtoonLookAdapter } from './adapters/host-mtoon-look-adapter';
export { createToonLabLookAdapter } from './adapters/toonlab-look-adapter';

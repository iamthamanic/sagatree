/**
 * look domain barrel — LookProfile contracts & resolution (#339).
 * Location: src/domains/look/index.ts
 *
 * Pure domain: no React, no backend clients, no provider adapter types.
 */

export {
  LOOK_CAPABILITIES,
  LOOK_EXECUTION_MODES,
  LOOK_FUNCTIONAL_CAPABILITIES,
  LOOK_REFERENCE_KINDS,
  LOOK_RESERVED_CAPABILITIES,
  LOOK_SCOPES,
  LOOK_SOURCES,
  type LookCapability,
  type LookExecutionMode,
  type LookFunctionalCapability,
  LOOK_PROFILE_STATUSES,
  type LookProfile,
  type LookProfileRecord,
  type LookProfileStatus,
  type LookProfileVersion,
  type LookProfileWriteDraft,
  type LookReference,
  type LookReferenceKind,
  type LookReservedCapability,
  type LookResolutionContext,
  type LookResolutionResult,
  type LookResolutionTarget,
  type LookScope,
  type LookSource,
} from './types';

export type {
  AppendLookProfileVersionInput,
  CreateLookProfileInput,
  DuplicateLookProfileInput,
  LookProfileRepository,
} from './persistence-contracts';

export { normalizeLookProfileWriteDraft, type LookDraftValidationError } from './write-draft';

export {
  EMPTY_LOOK_LIBRARY_FILTERS,
  LOOK_SOURCE_STYLE_FAMILY_LABELS,
  LOOK_STATUS_LABELS,
  filterLookLibraryCatalog,
  hasActiveLookLibraryFilters,
  lookPreviewUri,
  lookStatusLabel,
  lookStyleFamilyLabel,
  type LookLibraryFilters,
} from './library-query';

export {
  isLookCapability,
  isLookExecutionMode,
  isLookFunctionalCapability,
  isLookReferenceKind,
  isLookReservedCapability,
  isLookScope,
  isLookSource,
  parseLookCapabilities,
  parseLookCapability,
  parseLookExecutionMode,
  parseLookExecutionModes,
  parseLookProfile,
  parseLookProfileVersion,
  parseLookReference,
  parseLookReferences,
  parseLookScope,
  parseLookSource,
} from './parse';

export { resolveLookProfileId } from './resolve';

export {
  SYSTEM_DEFAULT_LOOK_PROFILE_ID,
  buildLookResolutionContextFromSaga,
  resolveWorldLookForSession,
} from './system-default';

export {
  assertPersonalLookOverrideWrite,
  type PersonalLookOverrideWriteInput,
  type PersonalLookOverrideWriteResult,
} from './personal-look-override';

export {
  LOOK_REFERENCE_ANALYSIS_MAX_IMAGES,
  LOOK_REFERENCE_ANALYSIS_MIME_TYPES,
  LOOK_REFERENCE_ANALYSIS_MIN_IMAGES,
  LOOK_REFERENCE_ANALYSIS_VERSION,
  assertLookReferenceAnalysisInput,
  buildLookProfileWriteDraftFromAnalysis,
  isLookReferenceAnalysisMime,
  normalizeLookReferenceAnalysisPayload,
  type LookAnalysisKnobs,
  type LookAnalysisPalette,
  type LookReferenceAnalysisDraft,
  type LookReferenceAnalysisFailure,
  type LookReferenceAnalysisImageInput,
  type LookReferenceAnalysisMime,
  type LookReferenceAnalysisOutcome,
  type LookReferenceAnalysisProvenance,
  type LookReferenceAnalysisSuccess,
  type LookReferenceAnalyzer,
} from './reference-analysis';

export {
  assertLookCapabilitiesSupported,
  assertLookProfileVersionInvariants,
  assertLookReferenceKindSemantics,
  type LookInvariantResult,
} from './invariants';

export {
  LOOK_CAPABILITY_METADATA,
  LOOK_CAPABILITY_UNAVAILABLE_LABEL_DE,
  LOOK_WORLD_RESERVED_CAPABILITY_IDS,
  classifyLookCapabilityToken,
  getLookCapabilityMeta,
  isLookCapabilityReserved,
  isLookCapabilitySupported,
  listLookCapabilityMetadata,
  listReservedLookCapabilityMetadata,
  lookCapabilityUnavailableLabel,
  type LookCapabilityAvailability,
  type LookCapabilityMeta,
} from './capability-metadata';

export {
  ADVANCED_LOOK_GUIDE_INPUT_DESCRIPTORS,
  ADVANCED_LOOK_GUIDE_INPUT_KINDS,
  ADVANCED_LOOK_REQUIRED_GUIDE_KIND_IDS,
  buildAdvancedLookAdaptionRequest,
  getAdvancedLookGuideInputDescriptor,
  isAdvancedLookGuideInputKind,
  listAdvancedLookGuideInputDescriptors,
  negotiateAdvancedLookProvider,
  providerSupportsExecutionMode,
  type AdvancedLookAdaptionRequest,
  type AdvancedLookDegradeReason,
  type AdvancedLookGuideInputDescriptor,
  type AdvancedLookGuideInputKind,
  type AdvancedLookNegotiationFail,
  type AdvancedLookNegotiationOk,
  type AdvancedLookNegotiationResult,
  type AdvancedLookProviderCapabilities,
} from './advanced-adaption';

export {
  buildAdvancedLookCapabilityStatusView,
  type AdvancedLookCapabilityStatusView,
  type AdvancedLookModeStatusId,
  type AdvancedLookModeStatusRow,
} from './advanced-look-capability-status';

export {
  getAdvancedLookProvider,
  listAdvancedLookProviders,
  registerAdvancedLookProvider,
  resolveAdvancedLookProviderForMode,
  unregisterAdvancedLookProvider,
} from './advanced-look-provider-registry';

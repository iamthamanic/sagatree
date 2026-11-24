/**
 * advanced-adaption — Provider-neutral Advanced Look Adaption contract (#355).
 * Location: src/domains/look/advanced-adaption.ts
 *
 * Future AI/neural rendering capabilities for `rendered` and `realtime`.
 * Reuses LookProfile + LookReference — no parallel style object.
 * Pure domain: no React, backend clients, or concrete neural engines.
 */

import type {
  LookExecutionMode,
  LookProfile,
  LookProfileVersion,
  LookReference,
} from './types';
import { isLookExecutionMode } from './parse';

/** Reserved guide / truth passes for Advanced Adaption (Scriptoni-style). */
export const ADVANCED_LOOK_GUIDE_INPUT_KINDS = [
  'beauty',
  'clay',
  'depth',
  'normals',
  'edges',
  'segmentation',
  'camera',
  'temporal',
  'motion',
] as const;

export type AdvancedLookGuideInputKind =
  (typeof ADVANCED_LOOK_GUIDE_INPUT_KINDS)[number];

export type AdvancedLookGuideInputDescriptor = {
  readonly kind: AdvancedLookGuideInputKind;
  /** Optional when a pass is not available for a frame/session. */
  readonly required: boolean;
  readonly labelDe: string;
  readonly descriptionDe: string;
};

const GUIDE_META: Record<
  AdvancedLookGuideInputKind,
  Omit<AdvancedLookGuideInputDescriptor, 'kind' | 'required'>
> = {
  beauty: {
    labelDe: 'Beauty',
    descriptionDe: 'Farb-/Shade-Guide (beauty pass) als 3D-Wahrheit.',
  },
  clay: {
    labelDe: 'Clay',
    descriptionDe: 'Neutrale Clay-/Material-Guide-Pass.',
  },
  depth: {
    labelDe: 'Depth',
    descriptionDe: 'Tiefenpass für räumliche Konsistenz.',
  },
  normals: {
    labelDe: 'Normals',
    descriptionDe: 'Normalenpass für Beleuchtungs- und Oberflächenführung.',
  },
  edges: {
    labelDe: 'Edges',
    descriptionDe: 'Kanten-/Outline-Guide.',
  },
  segmentation: {
    labelDe: 'Segmentation',
    descriptionDe: 'Segmentierungsmasken (z. B. Figur vs. Hintergrund).',
  },
  camera: {
    labelDe: 'Camera',
    descriptionDe: 'Kameraparameter und Projektion.',
  },
  temporal: {
    labelDe: 'Temporal',
    descriptionDe: 'Temporaler Kontext über Frames (ohne Engine-Zwang).',
  },
  motion: {
    labelDe: 'Motion',
    descriptionDe: 'Bewegungs-/Motion-Kontext für zukünftige Live-Pfade.',
  },
};

/** Canonical descriptors — all kinds reserved; none force a concrete engine. */
export const ADVANCED_LOOK_GUIDE_INPUT_DESCRIPTORS: readonly AdvancedLookGuideInputDescriptor[] =
  ADVANCED_LOOK_GUIDE_INPUT_KINDS.map((kind) => ({
    kind,
    required: false,
    ...GUIDE_META[kind],
  }));

export type AdvancedLookProviderCapabilities = {
  readonly providerId: string;
  readonly supportsRendered: boolean;
  readonly supportsRealtime: boolean;
  /** Subset of guide kinds this provider can consume when present. */
  readonly supportedGuideInputs: readonly AdvancedLookGuideInputKind[];
};

export type AdvancedLookDegradeReason =
  | 'provider_missing'
  | 'execution_mode_unsupported'
  | 'guide_input_unsupported'
  | 'advanced_capability_absent';

export type AdvancedLookNegotiationOk = {
  readonly ok: true;
  readonly providerId: string;
  readonly executionMode: LookExecutionMode;
  readonly acceptedGuideInputs: readonly AdvancedLookGuideInputKind[];
  readonly omittedGuideInputs: readonly AdvancedLookGuideInputKind[];
};

export type AdvancedLookNegotiationFail = {
  readonly ok: false;
  readonly reason: AdvancedLookDegradeReason;
  readonly messageDe: string;
  readonly executionMode: LookExecutionMode | null;
  readonly providerId: string | null;
};

export type AdvancedLookNegotiationResult =
  | AdvancedLookNegotiationOk
  | AdvancedLookNegotiationFail;

/**
 * Request shape for a future Advanced Adaption job.
 * Intentionally references the same LookProfile / LookReference contracts as Basic.
 */
export type AdvancedLookAdaptionRequest = {
  readonly profile: LookProfile;
  readonly references: readonly LookReference[];
  readonly executionMode: LookExecutionMode;
  readonly guideInputs: readonly AdvancedLookGuideInputKind[];
};

export function isAdvancedLookGuideInputKind(
  value: string,
): value is AdvancedLookGuideInputKind {
  return (ADVANCED_LOOK_GUIDE_INPUT_KINDS as readonly string[]).includes(value);
}

export function listAdvancedLookGuideInputDescriptors(): readonly AdvancedLookGuideInputDescriptor[] {
  return ADVANCED_LOOK_GUIDE_INPUT_DESCRIPTORS;
}

export function getAdvancedLookGuideInputDescriptor(
  kind: AdvancedLookGuideInputKind,
): AdvancedLookGuideInputDescriptor {
  const found = ADVANCED_LOOK_GUIDE_INPUT_DESCRIPTORS.find((d) => d.kind === kind);
  if (!found) {
    throw new Error(`Missing Advanced guide descriptor for: ${kind}`);
  }
  return found;
}

/**
 * Whether a provider declares support for a LookExecutionMode.
 * `supportsRendered` and `supportsRealtime` are independent.
 */
export function providerSupportsExecutionMode(
  capabilities: AdvancedLookProviderCapabilities,
  mode: LookExecutionMode,
): boolean {
  if (mode === 'rendered') return capabilities.supportsRendered === true;
  if (mode === 'realtime') return capabilities.supportsRealtime === true;
  return false;
}

export function negotiateAdvancedLookProvider(input: {
  readonly provider: AdvancedLookProviderCapabilities | null;
  readonly executionMode: LookExecutionMode;
  readonly requestedGuideInputs?: readonly AdvancedLookGuideInputKind[];
  /** When true, unsupported guides fail instead of soft-omitting. */
  readonly strictGuideInputs?: boolean;
}): AdvancedLookNegotiationResult {
  const mode = input.executionMode;
  if (!isLookExecutionMode(mode)) {
    return {
      ok: false,
      reason: 'execution_mode_unsupported',
      messageDe: 'Unbekannter Execution-Mode für Advanced Look Adaption.',
      executionMode: null,
      providerId: input.provider?.providerId ?? null,
    };
  }

  if (!input.provider) {
    return {
      ok: false,
      reason: 'provider_missing',
      messageDe: 'Kein Advanced-Look-Provider konfiguriert — Capability fehlt vollständig.',
      executionMode: mode,
      providerId: null,
    };
  }

  if (!input.provider.supportsRendered && !input.provider.supportsRealtime) {
    return {
      ok: false,
      reason: 'advanced_capability_absent',
      messageDe: `Provider „${input.provider.providerId}“ meldet keinen Advanced-Ausführungspfad.`,
      executionMode: mode,
      providerId: input.provider.providerId,
    };
  }

  if (!providerSupportsExecutionMode(input.provider, mode)) {
    const label = mode === 'realtime' ? 'Live/Realtime' : 'Rendered/Offline';
    return {
      ok: false,
      reason: 'execution_mode_unsupported',
      messageDe: `Provider „${input.provider.providerId}“ unterstützt ${label} nicht — explizite Degradation.`,
      executionMode: mode,
      providerId: input.provider.providerId,
    };
  }

  const requested = input.requestedGuideInputs ?? [];
  const supported = new Set(input.provider.supportedGuideInputs);
  const accepted: AdvancedLookGuideInputKind[] = [];
  const omitted: AdvancedLookGuideInputKind[] = [];
  for (const kind of requested) {
    if (supported.has(kind)) accepted.push(kind);
    else omitted.push(kind);
  }

  if (input.strictGuideInputs === true && omitted.length > 0) {
    return {
      ok: false,
      reason: 'guide_input_unsupported',
      messageDe: `Provider „${input.provider.providerId}“ unterstützt Guide-Inputs nicht: ${omitted.join(', ')}.`,
      executionMode: mode,
      providerId: input.provider.providerId,
    };
  }

  return {
    ok: true,
    providerId: input.provider.providerId,
    executionMode: mode,
    acceptedGuideInputs: accepted,
    omittedGuideInputs: omitted,
  };
}

/**
 * Build a typed Advanced request from LookProfile + LookProfileVersion.
 * Does not invent a second style object — profile/version references stay the source of truth.
 */
export function buildAdvancedLookAdaptionRequest(input: {
  readonly profile: LookProfile;
  readonly version: LookProfileVersion;
  readonly executionMode: LookExecutionMode;
  readonly guideInputs?: readonly AdvancedLookGuideInputKind[];
  /** Override references; default = version.references. */
  readonly references?: readonly LookReference[];
}): AdvancedLookAdaptionRequest {
  if (input.version.profileId !== input.profile.id) {
    throw new Error('Advanced Look request: version.profileId must match profile.id');
  }
  return {
    profile: input.profile,
    references: input.references ?? input.version.references,
    executionMode: input.executionMode,
    guideInputs: input.guideInputs ?? [],
  };
}

/** Machine-readable list for docs/gates — must stay in sync with descriptors. */
export const ADVANCED_LOOK_REQUIRED_GUIDE_KIND_IDS: readonly AdvancedLookGuideInputKind[] =
  ADVANCED_LOOK_GUIDE_INPUT_KINDS;

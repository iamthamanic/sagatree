/**
 * Host-side LookProfile write-draft validation (MIG-304 / #803).
 * Location: server/src/modules/look/internal/look-draft.ts
 *
 * Mirrors src/domains/look/write-draft rules without importing FE domains.
 */
export const LOOK_SOURCES = ['manual', 'preset', 'reference-analysis', 'imported'] as const;
export type LookSource = (typeof LOOK_SOURCES)[number];

export const LOOK_EXECUTION_MODES = ['realtime', 'rendered'] as const;
export type LookExecutionMode = (typeof LOOK_EXECUTION_MODES)[number];

export const LOOK_CAPABILITIES = [
  'character',
  'lighting',
  'postFx',
  'environment',
  'sky',
  'water',
  'vegetation',
  'terrain',
  'props',
  'vfx',
] as const;
export type LookCapability = (typeof LOOK_CAPABILITIES)[number];

export const LOOK_SCOPES = ['system', 'saga', 'session', 'player-character'] as const;
export type LookScope = (typeof LOOK_SCOPES)[number];

export const LOOK_REFERENCE_KINDS = ['style', 'content'] as const;
export type LookReferenceKind = (typeof LOOK_REFERENCE_KINDS)[number];

export type LookReference = {
  readonly id: string;
  readonly kind: LookReferenceKind;
  readonly uri: string;
  readonly label?: string;
  readonly weight?: number;
};

export type LookProfileWriteDraft = {
  readonly displayName: string;
  readonly source: LookSource;
  readonly references: readonly LookReference[];
  readonly capabilities: readonly LookCapability[];
  readonly executionModes: readonly LookExecutionMode[];
  readonly ownerScope: LookScope;
};

const FORBIDDEN_PROVIDER_KEYS = new Set([
  'toonlab',
  'toonLab',
  'ToonLab',
  'providerRaw',
  'providerBlob',
  'rawProvider',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectProviderKeys(value: unknown, path: string): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const nested = rejectProviderKeys(value[i], `${path}[${i}]`);
      if (nested) return nested;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_PROVIDER_KEYS.has(key)) {
      return `Forbidden provider key "${key}" at ${path}`;
    }
    const nested = rejectProviderKeys(value[key], `${path}.${key}`);
    if (nested) return nested;
  }
  return null;
}

function parseReference(value: unknown): LookReference | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  if (typeof value.uri !== 'string' || value.uri.length === 0) return null;
  if (typeof value.kind !== 'string' || !(LOOK_REFERENCE_KINDS as readonly string[]).includes(value.kind)) {
    return null;
  }
  const label =
    typeof value.label === 'string' && value.label.length > 0 ? value.label : undefined;
  let weight: number | undefined;
  if (value.weight !== undefined) {
    if (typeof value.weight !== 'number' || Number.isNaN(value.weight)) return null;
    if (value.weight < 0 || value.weight > 1) return null;
    weight = value.weight;
  }
  return {
    id: value.id,
    kind: value.kind as LookReferenceKind,
    uri: value.uri,
    ...(label !== undefined ? { label } : {}),
    ...(weight !== undefined ? { weight } : {}),
  };
}

export type LookDraftValidation =
  | { readonly ok: true; readonly draft: LookProfileWriteDraft }
  | { readonly ok: false; readonly error: string };

/**
 * Normalize and validate a write draft. Rejects provider blobs and unknown enums.
 */
export function normalizeLookProfileWriteDraft(raw: unknown): LookDraftValidation {
  const blob = rejectProviderKeys(raw, 'draft');
  if (blob) return { ok: false, error: blob };
  if (!isRecord(raw)) return { ok: false, error: 'Look write draft must be an object' };

  if (typeof raw.displayName !== 'string' || raw.displayName.trim().length === 0) {
    return { ok: false, error: 'displayName is required' };
  }
  const displayName = raw.displayName.trim();
  if (displayName.length > 200) {
    return { ok: false, error: 'displayName exceeds 200 characters' };
  }

  if (typeof raw.source !== 'string' || !(LOOK_SOURCES as readonly string[]).includes(raw.source)) {
    return { ok: false, error: 'invalid source' };
  }

  if (!Array.isArray(raw.executionModes) || raw.executionModes.length < 1) {
    return { ok: false, error: 'executionModes required' };
  }
  const executionModes: LookExecutionMode[] = [];
  for (const mode of raw.executionModes) {
    if (typeof mode !== 'string' || !(LOOK_EXECUTION_MODES as readonly string[]).includes(mode)) {
      return { ok: false, error: 'invalid executionMode' };
    }
    executionModes.push(mode as LookExecutionMode);
  }

  const capabilities: LookCapability[] = [];
  if (raw.capabilities !== undefined) {
    if (!Array.isArray(raw.capabilities)) return { ok: false, error: 'capabilities must be array' };
    for (const cap of raw.capabilities) {
      if (typeof cap !== 'string' || !(LOOK_CAPABILITIES as readonly string[]).includes(cap)) {
        return { ok: false, error: 'invalid capability' };
      }
      capabilities.push(cap as LookCapability);
    }
  }

  const references: LookReference[] = [];
  if (raw.references !== undefined) {
    if (!Array.isArray(raw.references)) return { ok: false, error: 'references must be array' };
    const byId = new Map<string, LookReferenceKind>();
    for (const ref of raw.references) {
      const parsed = parseReference(ref);
      if (!parsed) return { ok: false, error: 'invalid reference' };
      const existingKind = byId.get(parsed.id);
      if (existingKind && existingKind !== parsed.kind) {
        return {
          ok: false,
          error: `LookReference id "${parsed.id}" cannot be both style and content`,
        };
      }
      byId.set(parsed.id, parsed.kind);
      references.push(parsed);
    }
  }

  let ownerScope: LookScope = 'player-character';
  if (raw.ownerScope !== undefined) {
    if (typeof raw.ownerScope !== 'string' || !(LOOK_SCOPES as readonly string[]).includes(raw.ownerScope)) {
      return { ok: false, error: 'invalid ownerScope' };
    }
    ownerScope = raw.ownerScope as LookScope;
  }

  return {
    ok: true,
    draft: {
      displayName,
      source: raw.source as LookSource,
      references,
      capabilities,
      executionModes,
      ownerScope,
    },
  };
}

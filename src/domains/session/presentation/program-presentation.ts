/**
 * program-presentation — Program Output presentation state (#365).
 * Location: src/domains/session/presentation/program-presentation.ts
 *
 * Public-only shared program surface. SharedScenePresentation is a source input,
 * not duplicated scene truth. Never imports React or backend clients.
 */

import {
  readSharedScenePresentation,
  type SharedScenePresentation,
} from '../contracts/shared-scene-presentation';
import {
  canExecuteLiveSessionCommand,
  filterPayloadForAccess,
  type LiveSessionAccess,
} from '../contracts/live-session-access';
import {
  projectSceneV2ToSharedSceneV1,
  readScenePresentationConfigV2,
} from './scene-live-runtime-v2';

export const PROGRAM_PRESENTATION_SCHEMA_VERSION = 1 as const;

export const FORGED_PROGRAM_PRESENTATION_KEYS = [
  'authoritative',
  'updatedAt',
  'updated_at',
  'schemaVersion',
  'programRevision',
  'gm_only',
  'character_specific',
] as const;

export type ProgramSourceKind = 'neutral' | 'shared-scene' | 'look';

export type ProgramLayoutKind = 'fullscreen-16x9' | 'letterbox';

export type ProgramOutputStatus = 'live' | 'degraded' | 'reconnect' | 'error' | 'empty';

export type ProgramSourceRef =
  | { readonly kind: 'neutral' }
  | { readonly kind: 'shared-scene' }
  | { readonly kind: 'look'; readonly lookId: string | null };

export type ProgramLayoutRef = {
  readonly kind: ProgramLayoutKind;
};

export type ProgramOverlayRef = {
  readonly kind: 'title';
  readonly text: string;
} | null;

/**
 * Authoritative program metadata under world_state.shared.programPresentation.
 */
export type ProgramPresentationState = {
  readonly schemaVersion: typeof PROGRAM_PRESENTATION_SCHEMA_VERSION;
  readonly programRevision: number;
  readonly source: ProgramSourceRef;
  readonly layout: ProgramLayoutRef;
  readonly overlay: ProgramOverlayRef;
  readonly updatedAt: string | null;
  readonly authoritative: true;
};

export type ProgramPresentationCommandInput = {
  readonly source: ProgramSourceRef;
  readonly layout: ProgramLayoutRef;
  readonly overlay: ProgramOverlayRef;
};

/** Audience-safe read model for display / viewer / embed. */
export type ProgramPresentationReadModel = {
  readonly program: ProgramPresentationState;
  readonly scene: SharedScenePresentation | null;
  readonly status: ProgramOutputStatus;
  readonly audience: 'program';
};

const SOURCE_KINDS: readonly ProgramSourceKind[] = ['neutral', 'shared-scene', 'look'] as const;
const LAYOUT_KINDS: readonly ProgramLayoutKind[] = ['fullscreen-16x9', 'letterbox'] as const;
const MAX_OVERLAY = 120;
const MAX_LOOK_ID = 128;

export function isProgramSourceKind(value: string): value is ProgramSourceKind {
  return (SOURCE_KINDS as readonly string[]).includes(value);
}

export function isProgramLayoutKind(value: string): value is ProgramLayoutKind {
  return (LAYOUT_KINDS as readonly string[]).includes(value);
}

export function stripForgedProgramPresentationKeys(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...payload };
  for (const key of FORGED_PROGRAM_PRESENTATION_KEYS) {
    delete next[key];
  }
  return next;
}

export function assertNoSecretProgramFields(payload: Record<string, unknown>): void {
  for (const key of Object.keys(payload)) {
    if (key === 'gm_only' || key.startsWith('gm_only.') || key === 'character_specific') {
      throw new Error(`Program payload darf kein Secret-Feld enthalten: ${key}`);
    }
  }
}

function parseSource(raw: unknown): ProgramSourceRef {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { kind: 'neutral' };
  }
  const obj = raw as Record<string, unknown>;
  const kind = typeof obj.kind === 'string' ? obj.kind : 'neutral';
  if (kind === 'shared-scene') return { kind: 'shared-scene' };
  if (kind === 'look') {
    const lookId =
      typeof obj.lookId === 'string' && obj.lookId.trim()
        ? obj.lookId.trim().slice(0, MAX_LOOK_ID)
        : null;
    return { kind: 'look', lookId };
  }
  return { kind: 'neutral' };
}

function parseLayout(raw: unknown): ProgramLayoutRef {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { kind: 'fullscreen-16x9' };
  }
  const kind = (raw as Record<string, unknown>).kind;
  if (typeof kind === 'string' && isProgramLayoutKind(kind)) {
    return { kind };
  }
  return { kind: 'fullscreen-16x9' };
}

function parseOverlay(raw: unknown): ProgramOverlayRef {
  if (raw === null || raw === undefined) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.kind !== 'title') return null;
  const text = typeof obj.text === 'string' ? obj.text.trim().slice(0, MAX_OVERLAY) : '';
  if (!text) return null;
  return { kind: 'title', text };
}

export function parseProgramPresentationCommandInput(
  input: Record<string, unknown>,
): ProgramPresentationCommandInput {
  assertNoSecretProgramFields(input);
  const stripped = stripForgedProgramPresentationKeys(input);
  assertNoSecretProgramFields(stripped);
  return {
    source: parseSource(stripped.source),
    layout: parseLayout(stripped.layout),
    overlay: parseOverlay(stripped.overlay),
  };
}

export function buildProgramPresentationState(input: {
  command: ProgramPresentationCommandInput;
  programRevision: number;
  updatedAt: string | null;
}): ProgramPresentationState {
  return {
    schemaVersion: PROGRAM_PRESENTATION_SCHEMA_VERSION,
    programRevision: Math.max(0, Math.floor(input.programRevision)),
    source: input.command.source,
    layout: input.command.layout,
    overlay: input.command.overlay,
    updatedAt: input.updatedAt,
    authoritative: true,
  };
}

export function readProgramPresentationState(
  shared: Record<string, unknown>,
): ProgramPresentationState | null {
  const raw = shared.programPresentation;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.authoritative !== true) return null;
  if (obj.schemaVersion !== PROGRAM_PRESENTATION_SCHEMA_VERSION) return null;
  const programRevision =
    typeof obj.programRevision === 'number' && Number.isFinite(obj.programRevision)
      ? Math.max(0, Math.floor(obj.programRevision))
      : 0;
  return {
    schemaVersion: PROGRAM_PRESENTATION_SCHEMA_VERSION,
    programRevision,
    source: parseSource(obj.source),
    layout: parseLayout(obj.layout),
    overlay: parseOverlay(obj.overlay),
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : null,
    authoritative: true,
  };
}

/**
 * Default program when none published: shared-scene if scene exists, else neutral.
 */
export function defaultProgramPresentationState(
  shared: Record<string, unknown>,
): ProgramPresentationState {
  const scene = readSharedScenePresentation(shared);
  return {
    schemaVersion: PROGRAM_PRESENTATION_SCHEMA_VERSION,
    programRevision: 0,
    source: scene ? { kind: 'shared-scene' } : { kind: 'neutral' },
    layout: { kind: 'fullscreen-16x9' },
    overlay: null,
    updatedAt: null,
    authoritative: true,
  };
}

export function resolveProgramScene(
  program: ProgramPresentationState,
  shared: Record<string, unknown>,
): SharedScenePresentation | null {
  if (program.source.kind !== 'shared-scene') return null;
  // Prefer Scene Runtime V2 normalize path (#366); falls back to V1 reader.
  const v2 = readScenePresentationConfigV2(shared);
  if (v2) return projectSceneV2ToSharedSceneV1(v2);
  return readSharedScenePresentation(shared);
}

export function resolveProgramStatus(
  program: ProgramPresentationState,
  scene: SharedScenePresentation | null,
): ProgramOutputStatus {
  if (program.source.kind === 'neutral') return 'empty';
  if (program.source.kind === 'look') {
    // Look track may be incomplete — neutral fallback is not an error.
    return 'degraded';
  }
  if (program.source.kind === 'shared-scene' && !scene) return 'empty';
  return 'live';
}

/**
 * Build audience-safe program read model. Strips secrets by construction.
 */
export function buildProgramPresentationReadModel(
  shared: Record<string, unknown>,
  access?: LiveSessionAccess | null,
): ProgramPresentationReadModel {
  const program = readProgramPresentationState(shared) ?? defaultProgramPresentationState(shared);
  const scene = resolveProgramScene(program, shared);
  const status = resolveProgramStatus(program, scene);

  const payload: Record<string, unknown> = {
    program,
    scene,
    status,
    audience: 'program',
  };
  assertNoSecretProgramFields(payload);
  if (access) {
    const filtered = filterPayloadForAccess(access, payload);
    if (!('program' in filtered)) {
      throw new Error('Program read model stripped unexpectedly');
    }
  }

  return {
    program,
    scene,
    status,
    audience: 'program',
  };
}

export function canSwitchProgram(access: LiveSessionAccess): boolean {
  return canExecuteLiveSessionCommand(access, 'program_switch');
}

export function emptyProgramPresentationDraft(): ProgramPresentationCommandInput {
  return {
    source: { kind: 'shared-scene' },
    layout: { kind: 'fullscreen-16x9' },
    overlay: null,
  };
}

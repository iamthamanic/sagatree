/**
 * saga-overview — Typed view-model for the saga hub overview RPC (#570).
 * Location: src/domains/project/contracts/saga-overview.ts
 *
 * Pure domain: parse/assert only. No React, no backend clients.
 * Audience projection of world clocks/consequences is done server-side;
 * client re-validates shape and may re-resolve primaryAction.
 */

export type SagaOverviewRole = 'gamemaster' | 'player' | 'viewer';

export type SagaPrimaryActionKind =
  | 'continue-session'
  | 'host-session'
  | 'join-session'
  | 'wait';

export type SagaPrimaryAction = {
  readonly kind: SagaPrimaryActionKind;
  readonly labelDe: string;
  readonly sessionPublicId: string | null;
};

export type SagaEpisodeVm = {
  readonly sessionId: string;
  readonly sessionPublicId: string;
  readonly sessionNumber: number;
  readonly name: string | null;
  readonly status: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly recapSnippet: string | null;
};

export type SagaEnsembleMemberVm = {
  readonly userId: string;
  readonly role: SagaOverviewRole | string;
  readonly characterId: string | null;
  readonly characterName: string | null;
  readonly isSelf: boolean;
};

export type SagaOverviewClockVm = {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly max: number;
  readonly visibility: string;
};

export type SagaOverviewConsequenceVm = {
  readonly id: string;
  readonly kind: string;
  readonly summary: string;
  readonly visibility: string;
  readonly createdAt: string | null;
};

/** Open (unfired) deadline for hub Zeigarnik (#578). */
export type SagaOverviewDeadlineVm = {
  readonly id: string;
  readonly label: string;
  readonly dueDay: number;
  readonly visibility: string;
};

export type SagaWorldStateSummaryVm = {
  readonly clocks: readonly SagaOverviewClockVm[];
  readonly consequences: readonly SagaOverviewConsequenceVm[];
  readonly openDeadlines: readonly SagaOverviewDeadlineVm[];
  /** #581 party position (locationRef or map:x,y) */
  readonly partyLocationRef: string | null;
  readonly flagCount: number;
  readonly updatedAt: string | null;
};

export type SagaOverviewVm = {
  readonly projectId: string;
  readonly sagaPublicId: string;
  readonly title: string;
  readonly blurb: string;
  readonly status: string;
  readonly selfRole: SagaOverviewRole;
  readonly isGm: boolean;
  /** Linked world profile for hub map (#581) */
  readonly worldProfileId: string | null;
  readonly definitionRef: string | null;
  /** #574 story definition pin */
  readonly sagaDefinitionId: string | null;
  readonly sagaVersionId: string | null;
  readonly versionLabel: string | null;
  readonly newerVersionAvailable: boolean;
  readonly primaryAction: SagaPrimaryAction;
  readonly episodes: readonly SagaEpisodeVm[];
  readonly ensemble: readonly SagaEnsembleMemberVm[];
  readonly worldStateSummary: SagaWorldStateSummaryVm;
};

const ROLES: readonly SagaOverviewRole[] = ['gamemaster', 'player', 'viewer'];
const PRIMARY_KINDS: readonly SagaPrimaryActionKind[] = [
  'continue-session',
  'host-session',
  'join-session',
  'wait',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function parseRole(value: unknown): SagaOverviewRole {
  if (typeof value === 'string' && (ROLES as readonly string[]).includes(value)) {
    return value as SagaOverviewRole;
  }
  if (value === 'gm') return 'gamemaster';
  if (value === 'observer') return 'viewer';
  return 'player';
}

function parsePrimaryAction(raw: unknown): SagaPrimaryAction {
  if (!isRecord(raw)) {
    return { kind: 'wait', labelDe: 'Warten auf Einladung', sessionPublicId: null };
  }
  const kindRaw = asString(raw.kind, 'wait');
  const kind = (PRIMARY_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as SagaPrimaryActionKind)
    : 'wait';
  return {
    kind,
    labelDe: asString(raw.labelDe, 'Aktion'),
    sessionPublicId: asNullableString(raw.sessionPublicId),
  };
}

function parseEpisode(raw: unknown): SagaEpisodeVm | null {
  if (!isRecord(raw)) return null;
  const sessionId = asString(raw.sessionId);
  const sessionPublicId = asString(raw.sessionPublicId);
  if (!sessionId || !sessionPublicId) return null;
  return {
    sessionId,
    sessionPublicId,
    sessionNumber: asNumber(raw.sessionNumber, 0),
    name: asNullableString(raw.name),
    status: asString(raw.status, 'scheduled'),
    startedAt: asNullableString(raw.startedAt),
    endedAt: asNullableString(raw.endedAt),
    recapSnippet: asNullableString(raw.recapSnippet),
  };
}

function parseEnsembleMember(raw: unknown): SagaEnsembleMemberVm | null {
  if (!isRecord(raw)) return null;
  const userId = asString(raw.userId);
  if (!userId) return null;
  return {
    userId,
    role: parseRole(raw.role),
    characterId: asNullableString(raw.characterId),
    characterName: asNullableString(raw.characterName),
    isSelf: raw.isSelf === true,
  };
}

function parseClock(raw: unknown): SagaOverviewClockVm | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    label: asString(raw.label, id),
    value: asNumber(raw.value, 0),
    max: Math.max(1, asNumber(raw.max, 1)),
    visibility: asString(raw.visibility, 'shared'),
  };
}

function parseConsequence(raw: unknown): SagaOverviewConsequenceVm | null {
  if (!isRecord(raw)) return null;
  const summary = asString(raw.summary);
  if (!summary) return null;
  return {
    id: asString(raw.id, summary.slice(0, 32)),
    kind: asString(raw.kind, 'note'),
    summary,
    visibility: asString(raw.visibility, 'shared'),
    createdAt: asNullableString(raw.createdAt),
  };
}

function parseDeadline(raw: unknown): SagaOverviewDeadlineVm | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    label: asString(raw.label, id),
    dueDay: Math.max(0, Math.floor(asNumber(raw.dueDay, 0))),
    visibility: asString(raw.visibility, 'shared'),
  };
}

function parseWorldStateSummary(raw: unknown): SagaWorldStateSummaryVm {
  if (!isRecord(raw)) {
    return {
      clocks: [],
      consequences: [],
      openDeadlines: [],
      partyLocationRef: null,
      flagCount: 0,
      updatedAt: null,
    };
  }
  const clocks: SagaOverviewClockVm[] = [];
  if (Array.isArray(raw.clocks)) {
    for (const item of raw.clocks) {
      const clock = parseClock(item);
      if (clock) clocks.push(clock);
    }
  }
  const consequences: SagaOverviewConsequenceVm[] = [];
  if (Array.isArray(raw.consequences)) {
    for (const item of raw.consequences) {
      const cons = parseConsequence(item);
      if (cons) consequences.push(cons);
    }
  }
  const openDeadlines: SagaOverviewDeadlineVm[] = [];
  if (Array.isArray(raw.openDeadlines)) {
    for (const item of raw.openDeadlines) {
      const dl = parseDeadline(item);
      if (dl) openDeadlines.push(dl);
    }
  }
  const partyRaw = asNullableString(raw.partyLocationRef);
  return {
    clocks,
    consequences,
    openDeadlines,
    partyLocationRef: partyRaw ? partyRaw.trim().slice(0, 80) || null : null,
    flagCount: Math.max(0, Math.floor(asNumber(raw.flagCount, 0))),
    updatedAt: asNullableString(raw.updatedAt),
  };
}

/** Parse unknown RPC JSON into SagaOverviewVm. Throws on missing identity fields. */
export function parseSagaOverview(raw: unknown): SagaOverviewVm {
  if (!isRecord(raw)) {
    throw new Error('Ungültige Saga-Übersicht');
  }
  const projectId = asString(raw.projectId);
  const sagaPublicId = asString(raw.sagaPublicId);
  const title = asString(raw.title);
  if (!projectId || !sagaPublicId || !title) {
    throw new Error('Saga-Übersicht unvollständig');
  }

  const episodes: SagaEpisodeVm[] = [];
  if (Array.isArray(raw.episodes)) {
    for (const item of raw.episodes) {
      const ep = parseEpisode(item);
      if (ep) episodes.push(ep);
    }
  }

  const ensemble: SagaEnsembleMemberVm[] = [];
  if (Array.isArray(raw.ensemble)) {
    for (const item of raw.ensemble) {
      const member = parseEnsembleMember(item);
      if (member) ensemble.push(member);
    }
  }

  return {
    projectId,
    sagaPublicId,
    title,
    blurb: asString(raw.blurb, ''),
    status: asString(raw.status, 'active'),
    selfRole: parseRole(raw.selfRole),
    isGm: raw.isGm === true,
    worldProfileId: asNullableString(raw.worldProfileId),
    definitionRef: asNullableString(raw.definitionRef),
    sagaDefinitionId: asNullableString(raw.sagaDefinitionId),
    sagaVersionId: asNullableString(raw.sagaVersionId),
    versionLabel: asNullableString(raw.versionLabel),
    newerVersionAvailable: raw.newerVersionAvailable === true,
    primaryAction: parsePrimaryAction(raw.primaryAction),
    episodes,
    ensemble,
    worldStateSummary: parseWorldStateSummary(raw.worldStateSummary),
  };
}

/** Assert parsed overview has no gm_only world fields for non-GM audiences. */
export function assertSagaOverviewAudienceSafe(vm: SagaOverviewVm): void {
  if (vm.isGm || vm.selfRole === 'gamemaster') return;
  for (const clock of vm.worldStateSummary.clocks) {
    if (clock.visibility === 'gm_only') {
      throw new Error('Player-Übersicht enthält gm_only Uhr');
    }
  }
  for (const cons of vm.worldStateSummary.consequences) {
    if (cons.visibility === 'gm_only') {
      throw new Error('Player-Übersicht enthält gm_only Consequence');
    }
  }
  for (const dl of vm.worldStateSummary.openDeadlines) {
    if (dl.visibility === 'gm_only') {
      throw new Error('Player-Übersicht enthält gm_only Frist');
    }
  }
}

/** True when overview world summary contains any gm_only entry (GM-only expectation). */
export function sagaOverviewHasGmOnlyWorldFields(vm: SagaOverviewVm): boolean {
  return (
    vm.worldStateSummary.clocks.some((c) => c.visibility === 'gm_only')
    || vm.worldStateSummary.consequences.some((c) => c.visibility === 'gm_only')
    || vm.worldStateSummary.openDeadlines.some((d) => d.visibility === 'gm_only')
  );
}

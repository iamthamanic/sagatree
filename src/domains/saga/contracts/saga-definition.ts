/**
 * saga-definition — Story definition + version contracts (#574 / #575).
 * Location: src/domains/saga/contracts/saga-definition.ts
 *
 * Pure domain: parse + audience project + draft validation. No React / backend clients.
 */

export type SagaDefinitionOrigin = 'native' | 'user' | 'private_backfill';

/** Visibility for knowledge facts — aligned with adventure / Dornhain contracts. */
export type SagaKnowledgeVisibility =
  | 'public'
  | 'gm_only'
  | 'discovered'
  | 'shared'
  | 'character_specific';

export type SagaKnowledgeFact = {
  readonly id: string;
  readonly visibility: string;
  readonly summary: string;
};

export type SagaLocationRef = {
  readonly id: string;
  readonly label: string;
};

export type SagaPregenRef = {
  readonly id: string;
  readonly displayName: string;
};

/** Faction template: seeds a clock + relationship track (#579). */
export type SagaDefinitionFactionTemplate = {
  readonly id: string;
  readonly label: string;
  readonly clockLabel: string;
  readonly clockMax: number;
  readonly relationshipLabel: string;
  readonly visibility: string;
};

/** Minimal simulation templates on a story definition (#576 / #579). */
export type SagaDefinitionSimulationSlice = {
  readonly startDay: number;
  readonly deadlines: readonly {
    readonly id: string;
    readonly label: string;
    readonly dueDay: number;
    readonly visibility: string;
    readonly summaryPlayer: string;
    readonly summaryGm: string;
  }[];
  readonly threats: readonly {
    readonly id: string;
    readonly label: string;
    readonly max: number;
    readonly tickPerDay: number;
    readonly visibility: string;
    readonly doomSummaryPlayer: string;
    readonly doomSummaryGm: string;
  }[];
  readonly rules: readonly {
    readonly id: string;
    readonly label: string;
    readonly whenKind: string;
    /** Optional threat id when whenKind is threat-at-least. */
    readonly whenThreatId: string;
    readonly thenKinds: readonly string[];
  }[];
  readonly factions: readonly SagaDefinitionFactionTemplate[];
};

export function emptySagaDefinitionSimulation(): SagaDefinitionSimulationSlice {
  return {
    startDay: 0,
    deadlines: [],
    threats: [],
    rules: [],
    factions: [],
  };
}

/** Dornhain defaults when seed payload has no simulation slice yet (#579). */
export function dornhainSimulationDefaults(): SagaDefinitionSimulationSlice {
  return {
    startDay: 0,
    deadlines: [],
    threats: [
      {
        id: 'danger',
        label: 'Reliktgefahr',
        max: 6,
        tickPerDay: 1,
        visibility: 'shared',
        doomSummaryPlayer: 'Die Gefahr ist greifbar nah.',
        doomSummaryGm: 'Threat danger at max.',
      },
      {
        id: 'suspicion',
        label: 'Dorfverdacht',
        max: 4,
        tickPerDay: 0,
        visibility: 'shared',
        doomSummaryPlayer: 'Das Dorf misstraut euch.',
        doomSummaryGm: 'Threat suspicion at max.',
      },
    ],
    rules: [],
    factions: [
      {
        id: 'faction.village',
        label: 'Dorf',
        clockLabel: 'Dorfspannung',
        clockMax: 4,
        relationshipLabel: 'Dorfvertrauen',
        visibility: 'shared',
      },
    ],
  };
}

export type SagaDefinitionPayload = {
  readonly packageId: string | null;
  readonly title: string;
  /** Player-safe blurb (Klappentext). Falls back to synopsis when absent. */
  readonly blurb: string;
  readonly synopsis: string;
  readonly knowledgeFacts: readonly SagaKnowledgeFact[];
  readonly locations: readonly SagaLocationRef[];
  readonly pregens: readonly SagaPregenRef[];
  readonly simulation: SagaDefinitionSimulationSlice | null;
};

export type SagaDefinitionVersionVm = {
  readonly sagaId: string;
  readonly sagaSlug: string;
  readonly title: string;
  readonly synopsis: string;
  readonly origin: SagaDefinitionOrigin;
  readonly versionId: string;
  readonly versionLabel: string;
  readonly status: string;
  readonly payload: SagaDefinitionPayload;
  readonly isGmProjection: boolean;
};

/** Mutable draft document for the Saga Editor (#575 / #579). */
export type SagaDefinitionDraft = {
  readonly sagaId: string;
  readonly sagaSlug: string;
  readonly origin: SagaDefinitionOrigin;
  readonly canEdit: boolean;
  readonly title: string;
  readonly blurb: string;
  readonly locations: SagaLocationRef[];
  readonly knowledgeFacts: SagaKnowledgeFact[];
  readonly pregens: SagaPregenRef[];
  readonly packageId: string | null;
  readonly simulation: SagaDefinitionSimulationSlice;
};

export type SagaDefinitionEditorVm = {
  readonly sagaId: string;
  readonly sagaSlug: string;
  readonly title: string;
  readonly synopsis: string;
  readonly origin: SagaDefinitionOrigin;
  readonly versionId: string;
  readonly versionLabel: string;
  readonly status: string;
  readonly payload: SagaDefinitionPayload;
  readonly revision: number;
  readonly canEdit: boolean;
};

export type SagaDefinitionFieldErrors = {
  readonly title?: string;
  readonly blurb?: string;
  readonly simulation?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function parseOrigin(raw: string): SagaDefinitionOrigin {
  if (raw === 'native' || raw === 'private_backfill' || raw === 'user') return raw;
  return 'user';
}

/** Strip gm_only knowledge facts for non-GM audiences. */
export function projectSagaDefinitionPayload(
  payload: SagaDefinitionPayload,
  isGm: boolean,
): SagaDefinitionPayload {
  if (isGm) return payload;
  return {
    ...payload,
    knowledgeFacts: payload.knowledgeFacts.filter((f) => {
      const vis = f.visibility.trim().toLowerCase();
      return vis === 'public' || vis === 'discovered' || vis === 'shared';
    }),
  };
}

export function parseSagaDefinitionPayload(raw: unknown): SagaDefinitionPayload {
  const rec = isRecord(raw) ? raw : {};
  const facts: SagaKnowledgeFact[] = [];
  if (Array.isArray(rec.knowledgeFacts)) {
    for (const item of rec.knowledgeFacts) {
      if (!isRecord(item)) continue;
      const id = asString(item.id);
      const summary = asString(item.summary);
      if (!id) continue;
      facts.push({
        id,
        visibility: asString(item.visibility, 'gm_only'),
        summary,
      });
    }
  }
  const locations: SagaLocationRef[] = [];
  if (Array.isArray(rec.locations)) {
    for (const item of rec.locations) {
      if (!isRecord(item)) continue;
      const id = asString(item.id);
      if (!id) continue;
      locations.push({ id, label: asString(item.label, id) });
    }
  }
  const pregens: SagaPregenRef[] = [];
  if (Array.isArray(rec.pregens)) {
    for (const item of rec.pregens) {
      if (!isRecord(item)) continue;
      const id = asString(item.id);
      if (!id) continue;
      pregens.push({
        id,
        displayName: asString(item.displayName, id),
      });
    }
  }
  const synopsis = asString(rec.synopsis, '');
  const blurb = asString(rec.blurb, synopsis);
  let simulation: SagaDefinitionSimulationSlice | null = null;
  if (isRecord(rec.simulation)) {
    const sim = rec.simulation;
    simulation = {
      startDay:
        typeof sim.startDay === 'number' && Number.isFinite(sim.startDay)
          ? Math.max(0, Math.floor(sim.startDay))
          : 0,
      deadlines: Array.isArray(sim.deadlines)
        ? sim.deadlines
            .filter(isRecord)
            .map((d) => ({
              id: asString(d.id),
              label: asString(d.label),
              dueDay:
                typeof d.dueDay === 'number' && Number.isFinite(d.dueDay)
                  ? Math.floor(d.dueDay)
                  : 0,
              visibility: asString(d.visibility, 'public'),
              summaryPlayer: asString(d.summaryPlayer),
              summaryGm: asString(d.summaryGm),
            }))
            .filter((d) => d.id)
        : [],
      threats: Array.isArray(sim.threats)
        ? sim.threats
            .filter(isRecord)
            .map((t) => ({
              id: asString(t.id),
              label: asString(t.label),
              max:
                typeof t.max === 'number' && Number.isFinite(t.max)
                  ? Math.max(1, Math.floor(t.max))
                  : 4,
              tickPerDay:
                typeof t.tickPerDay === 'number' && Number.isFinite(t.tickPerDay)
                  ? Math.floor(t.tickPerDay)
                  : 0,
              visibility: asString(t.visibility, 'shared'),
              doomSummaryPlayer: asString(t.doomSummaryPlayer),
              doomSummaryGm: asString(t.doomSummaryGm),
            }))
            .filter((t) => t.id)
        : [],
      rules: Array.isArray(sim.rules)
        ? sim.rules
            .filter(isRecord)
            .map((r) => {
              const whenKind = isRecord(r.when) ? asString(r.when.kind) : asString(r.whenKind);
              const whenThreatId = isRecord(r.when)
                ? asString(r.when.threatId)
                : asString(r.whenThreatId);
              const thenKinds = Array.isArray(r.then)
                ? r.then
                    .filter(isRecord)
                    .map((e) => asString(e.kind))
                    .filter(Boolean)
                : Array.isArray(r.thenKinds)
                  ? r.thenKinds.filter((k): k is string => typeof k === 'string')
                  : [];
              return {
                id: asString(r.id),
                label: asString(r.label),
                whenKind,
                whenThreatId,
                thenKinds,
              };
            })
            .filter((r) => r.id)
        : [],
      factions: Array.isArray(sim.factions)
        ? sim.factions
            .filter(isRecord)
            .map((f) => ({
              id: asString(f.id),
              label: asString(f.label),
              clockLabel: asString(f.clockLabel, asString(f.label)),
              clockMax:
                typeof f.clockMax === 'number' && Number.isFinite(f.clockMax)
                  ? Math.max(1, Math.floor(f.clockMax))
                  : 4,
              relationshipLabel: asString(f.relationshipLabel, asString(f.label)),
              visibility: asString(f.visibility, 'shared'),
            }))
            .filter((f) => f.id)
        : [],
    };
  }

  return {
    packageId: typeof rec.packageId === 'string' ? rec.packageId : null,
    title: asString(rec.title, ''),
    blurb,
    synopsis,
    knowledgeFacts: facts,
    locations,
    pregens,
    simulation,
  };
}

export function parseSagaDefinitionVersion(raw: unknown): SagaDefinitionVersionVm {
  if (!isRecord(raw)) throw new Error('Ungültige Saga-Definition');
  const sagaId = asString(raw.sagaId);
  const versionId = asString(raw.versionId);
  if (!sagaId || !versionId) throw new Error('Saga-Definition unvollständig');
  return {
    sagaId,
    sagaSlug: asString(raw.sagaSlug),
    title: asString(raw.title),
    synopsis: asString(raw.synopsis),
    origin: parseOrigin(asString(raw.origin, 'user')),
    versionId,
    versionLabel: asString(raw.versionLabel, 'v1'),
    status: asString(raw.status, 'published'),
    payload: parseSagaDefinitionPayload(raw.payload),
    isGmProjection: raw.isGmProjection === true,
  };
}

export function parseSagaDefinitionEditor(raw: unknown): SagaDefinitionEditorVm {
  if (!isRecord(raw)) throw new Error('Ungültige Saga-Definition');
  const sagaId = asString(raw.sagaId);
  const versionId = asString(raw.versionId);
  if (!sagaId || !versionId) throw new Error('Saga-Definition unvollständig');
  const revision =
    typeof raw.revision === 'number' && Number.isFinite(raw.revision)
      ? Math.max(0, Math.floor(raw.revision))
      : 0;
  return {
    sagaId,
    sagaSlug: asString(raw.sagaSlug),
    title: asString(raw.title),
    synopsis: asString(raw.synopsis),
    origin: parseOrigin(asString(raw.origin, 'user')),
    versionId,
    versionLabel: asString(raw.versionLabel, 'draft'),
    status: asString(raw.status, 'draft'),
    payload: parseSagaDefinitionPayload(raw.payload),
    revision,
    canEdit: raw.canEdit === true,
  };
}

function cloneSimulationSlice(
  sim: SagaDefinitionSimulationSlice,
): SagaDefinitionSimulationSlice {
  return {
    startDay: sim.startDay,
    deadlines: sim.deadlines.map((d) => ({ ...d })),
    threats: sim.threats.map((t) => ({ ...t })),
    rules: sim.rules.map((r) => ({ ...r, thenKinds: [...r.thenKinds] })),
    factions: sim.factions.map((f) => ({ ...f })),
  };
}

export function editorVmToDraft(vm: SagaDefinitionEditorVm): SagaDefinitionDraft {
  const payload = vm.payload;
  let simulation = payload.simulation
    ? cloneSimulationSlice(payload.simulation)
    : emptySagaDefinitionSimulation();
  const packageId = payload.packageId ?? '';
  if (
    simulation.threats.length === 0
    && (packageId.includes('dornhain') || vm.sagaSlug.includes('dornhain'))
  ) {
    simulation = dornhainSimulationDefaults();
  }
  return {
    sagaId: vm.sagaId,
    sagaSlug: vm.sagaSlug,
    origin: vm.origin,
    canEdit: vm.canEdit,
    title: payload.title || vm.title,
    blurb: payload.blurb || payload.synopsis || vm.synopsis,
    locations: payload.locations.map((l) => ({ ...l })),
    knowledgeFacts: payload.knowledgeFacts.map((f) => ({ ...f })),
    pregens: payload.pregens.map((p) => ({ ...p })),
    packageId: payload.packageId,
    simulation,
  };
}

export function draftToPayload(draft: SagaDefinitionDraft): SagaDefinitionPayload {
  const blurb = draft.blurb.trim();
  const sim = draft.simulation;
  return {
    packageId: draft.packageId,
    title: draft.title.trim(),
    blurb,
    synopsis: blurb,
    knowledgeFacts: draft.knowledgeFacts,
    locations: draft.locations,
    pregens: draft.pregens,
    simulation: {
      startDay: Math.max(0, Math.floor(sim.startDay)),
      deadlines: sim.deadlines,
      threats: sim.threats,
      rules: sim.rules.map((r) => ({
        id: r.id,
        label: r.label,
        whenKind: r.whenKind,
        whenThreatId: r.whenThreatId,
        thenKinds: r.thenKinds,
      })),
      factions: sim.factions,
    },
  };
}

export function validateSagaDefinitionDraft(
  draft: SagaDefinitionDraft,
): SagaDefinitionFieldErrors {
  const errors: { title?: string; blurb?: string; simulation?: string } = {};
  if (!draft.title.trim()) {
    errors.title = 'Titel darf nicht leer sein.';
  }
  const threatIds = new Set(draft.simulation.threats.map((t) => t.id));
  for (const rule of draft.simulation.rules) {
    if (rule.whenKind === 'threat-at-least' && rule.whenThreatId && !threatIds.has(rule.whenThreatId)) {
      return {
        ...errors,
        simulation: `Regel „${rule.label || rule.id}“ verweist auf unbekannte Bedrohung.`,
      };
    }
    if (rule.whenKind === 'threat-at-least' && !rule.whenThreatId.trim()) {
      return {
        ...errors,
        simulation: `Regel „${rule.label || rule.id}“ braucht eine Bedrohungs-ID.`,
      };
    }
  }
  for (const threat of draft.simulation.threats) {
    if (threat.doomSummaryGm.length > 500 || threat.doomSummaryPlayer.length > 500) {
      return {
        ...errors,
        simulation: 'Doom-Text darf höchstens 500 Zeichen haben.',
      };
    }
  }
  return errors;
}

export function isSagaDefinitionDraftValid(draft: SagaDefinitionDraft): boolean {
  return Object.keys(validateSagaDefinitionDraft(draft)).length === 0;
}

/** Group playthroughs (projects) by story definition id. */
export function groupProjectsBySagaDefinition<T extends { sagaId: string | null; id: string }>(
  projects: readonly T[],
): readonly { sagaId: string | null; runs: readonly T[] }[] {
  const map = new Map<string, T[]>();
  const orphans: T[] = [];
  for (const p of projects) {
    if (!p.sagaId) {
      orphans.push(p);
      continue;
    }
    const list = map.get(p.sagaId) ?? [];
    list.push(p);
    map.set(p.sagaId, list);
  }
  const groups: { sagaId: string | null; runs: readonly T[] }[] = [];
  for (const [sagaId, runs] of map) {
    groups.push({ sagaId, runs });
  }
  for (const o of orphans) {
    groups.push({ sagaId: null, runs: [o] });
  }
  return groups;
}

/**
 * combat-encounter — Authoritative live encounter contract for Player Test (#300).
 * Location: src/domains/session/contracts/combat-encounter.ts
 * Hides: initiative order, turn/round, HP/conditions, action economy slots.
 * Never imports React or backend clients.
 */

export const ENCOUNTER_SCHEMA_VERSION = 1 as const;

export type EncounterStatus = 'inactive' | 'active' | 'ended';

export type EncounterParticipantKind = 'pc' | 'npc';

export type EncounterActionSlot = 'main' | 'move' | 'free' | 'reaction';

export type CombatCommandAction = 'start' | 'end' | 'nextTurn' | 'spendAction';

export type DamageMode = 'damage' | 'heal';

export type ConditionOp = 'add' | 'remove';

/** Client-forged keys — server must strip before resolve. */
export const FORGED_ENCOUNTER_KEYS = [
  'initiative',
  'hpCurrent',
  'hpMax',
  'round',
  'currentTurnIndex',
  'authoritative',
  'natural',
  'actions',
  'status',
  'schemaVersion',
] as const;

export interface EncounterActionEconomy {
  main: number;
  move: number;
  free: number;
  reaction: number;
}

export interface EncounterParticipant {
  id: string;
  kind: EncounterParticipantKind;
  refId: string;
  name: string;
  initiative: number;
  initiativeBonus: number;
  hpCurrent: number;
  hpMax: number;
  conditions: readonly string[];
  actions: EncounterActionEconomy;
}

export interface EncounterState {
  schemaVersion: typeof ENCOUNTER_SCHEMA_VERSION;
  status: EncounterStatus;
  round: number;
  currentTurnIndex: number;
  participants: readonly EncounterParticipant[];
  authoritative: true;
}

export interface EncounterParticipantSeed {
  kind: EncounterParticipantKind;
  refId: string;
  name?: string | null;
}

export interface CombatStartCommandInput {
  action: 'start';
  participants: readonly EncounterParticipantSeed[];
}

export interface CombatEndCommandInput {
  action: 'end';
}

export interface CombatNextTurnCommandInput {
  action: 'nextTurn';
}

export interface CombatSpendActionCommandInput {
  action: 'spendAction';
  participantId: string;
  slot: EncounterActionSlot;
}

export type CombatCommandInput =
  | CombatStartCommandInput
  | CombatEndCommandInput
  | CombatNextTurnCommandInput
  | CombatSpendActionCommandInput;

export interface DamageCommandInput {
  participantId: string;
  amount: number;
  mode: DamageMode;
}

export interface ConditionCommandInput {
  participantId: string;
  op: ConditionOp;
  condition: string;
}

export function freshActionEconomy(): EncounterActionEconomy {
  return { main: 1, move: 1, free: 1, reaction: 1 };
}

export function emptyEncounterState(): EncounterState {
  return {
    schemaVersion: ENCOUNTER_SCHEMA_VERSION,
    status: 'inactive',
    round: 0,
    currentTurnIndex: 0,
    participants: [],
    authoritative: true,
  };
}

export function stripForgedEncounterKeys(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...payload };
  for (const key of FORGED_ENCOUNTER_KEYS) {
    delete next[key];
  }
  return next;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readNonNegInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === 'string' && /^-?[0-9]+$/.test(value)) {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return fallback;
}

function readConditions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim().slice(0, 80);
    if (trimmed.length === 0) continue;
    out.push(trimmed);
    if (out.length >= 24) break;
  }
  return out;
}

function readActions(raw: unknown): EncounterActionEconomy {
  const row = asRecord(raw);
  if (!row) return freshActionEconomy();
  return {
    main: Math.max(0, Math.min(2, readNonNegInt(row.main, 1))),
    move: Math.max(0, Math.min(2, readNonNegInt(row.move, 1))),
    free: Math.max(0, Math.min(2, readNonNegInt(row.free, 1))),
    reaction: Math.max(0, Math.min(2, readNonNegInt(row.reaction, 1))),
  };
}

function parseParticipant(raw: unknown): EncounterParticipant | null {
  const row = asRecord(raw);
  if (!row) return null;
  const kind = row.kind === 'pc' || row.kind === 'npc' ? row.kind : null;
  const refId = typeof row.refId === 'string' ? row.refId.trim() : '';
  const id =
    typeof row.id === 'string' && row.id.trim() !== ''
      ? row.id.trim()
      : kind && refId
        ? `${kind}:${refId}`
        : '';
  const name = typeof row.name === 'string' && row.name.trim() !== '' ? row.name.trim().slice(0, 120) : 'Figur';
  if (!kind || !refId || !id) return null;
  const hpMax = Math.max(1, Math.min(9999, readNonNegInt(row.hpMax, 1)));
  const hpCurrent = Math.max(0, Math.min(hpMax, readNonNegInt(row.hpCurrent, hpMax)));
  return {
    id,
    kind,
    refId,
    name,
    initiative: readNonNegInt(row.initiative, 0),
    initiativeBonus: Math.max(0, Math.min(40, readNonNegInt(row.initiativeBonus, 0))),
    hpCurrent,
    hpMax,
    conditions: readConditions(row.conditions),
    actions: readActions(row.actions),
  };
}

/**
 * Read authoritative encounter from gameplay.shared (reload-safe).
 */
export function readEncounterState(shared: Record<string, unknown>): EncounterState | null {
  const raw = shared.encounter;
  const row = asRecord(raw);
  if (!row) return null;
  const statusRaw = row.status;
  const status: EncounterStatus =
    statusRaw === 'active' || statusRaw === 'ended' || statusRaw === 'inactive'
      ? statusRaw
      : 'inactive';
  const participantsRaw = Array.isArray(row.participants) ? row.participants : [];
  const participants: EncounterParticipant[] = [];
  for (const entry of participantsRaw) {
    const p = parseParticipant(entry);
    if (p) participants.push(p);
    if (participants.length >= 24) break;
  }
  const round = Math.max(0, Math.min(999, readNonNegInt(row.round, 0)));
  let currentTurnIndex = readNonNegInt(row.currentTurnIndex, 0);
  if (participants.length === 0) {
    currentTurnIndex = 0;
  } else if (currentTurnIndex >= participants.length) {
    currentTurnIndex = 0;
  }
  return {
    schemaVersion: ENCOUNTER_SCHEMA_VERSION,
    status,
    round,
    currentTurnIndex,
    participants,
    authoritative: true,
  };
}

export function currentEncounterActor(state: EncounterState): EncounterParticipant | null {
  if (state.status !== 'active' || state.participants.length === 0) return null;
  return state.participants[state.currentTurnIndex] ?? null;
}

export function findEncounterParticipant(
  state: EncounterState,
  participantId: string,
): EncounterParticipant | null {
  const id = participantId.trim();
  if (!id) return null;
  return state.participants.find((p) => p.id === id) ?? null;
}

/** Find PC participant matching character uuid. */
export function findPcParticipantByCharacterId(
  state: EncounterState,
  characterId: string,
): EncounterParticipant | null {
  const ref = characterId.trim();
  if (!ref) return null;
  return (
    state.participants.find((p) => p.kind === 'pc' && (p.refId === ref || p.id === `pc:${ref}`))
    ?? null
  );
}

export function sortParticipantsByInitiative(
  participants: readonly EncounterParticipant[],
): EncounterParticipant[] {
  return [...participants].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    if (b.initiativeBonus !== a.initiativeBonus) return b.initiativeBonus - a.initiativeBonus;
    if (a.kind !== b.kind) return a.kind === 'pc' ? -1 : 1;
    return a.name.localeCompare(b.name, 'de');
  });
}

export function applyDamageToParticipant(
  participant: EncounterParticipant,
  amount: number,
  mode: DamageMode,
): EncounterParticipant {
  const delta = Math.max(0, Math.floor(amount));
  let hpCurrent = participant.hpCurrent;
  let conditions = [...participant.conditions];
  if (mode === 'damage') {
    const prev = hpCurrent;
    hpCurrent = Math.max(0, hpCurrent - delta);
    if (prev > 0 && hpCurrent === 0 && !conditions.includes('bewusstlos')) {
      conditions = [...conditions, 'bewusstlos'];
    }
  } else {
    const prev = hpCurrent;
    hpCurrent = Math.min(participant.hpMax, hpCurrent + delta);
    if (prev === 0 && hpCurrent > 0) {
      conditions = conditions.filter((c) => c !== 'bewusstlos' && c !== 'unconscious');
    }
  }
  return { ...participant, hpCurrent, conditions };
}

export function applyConditionToParticipant(
  participant: EncounterParticipant,
  op: ConditionOp,
  condition: string,
): EncounterParticipant {
  const normalized = condition.trim().slice(0, 80);
  if (!normalized) return participant;
  let conditions = [...participant.conditions];
  if (op === 'add') {
    if (!conditions.includes(normalized) && conditions.length < 24) {
      conditions = [...conditions, normalized];
    }
  } else {
    conditions = conditions.filter((c) => c !== normalized);
  }
  return { ...participant, conditions };
}

export function spendActionSlot(
  participant: EncounterParticipant,
  slot: EncounterActionSlot,
): { ok: true; participant: EncounterParticipant } | { ok: false; reason: string } {
  const actions = { ...participant.actions };
  if (actions[slot] < 1) {
    return { ok: false, reason: `Keine ${slot}-Aktion mehr verfügbar.` };
  }
  actions[slot] -= 1;
  return { ok: true, participant: { ...participant, actions } };
}

export function advanceEncounterTurn(state: EncounterState): EncounterState {
  if (state.status !== 'active' || state.participants.length === 0) return state;
  const nextIndex = (state.currentTurnIndex + 1) % state.participants.length;
  const newRound = nextIndex === 0 ? state.round + 1 : state.round;
  const participants = state.participants.map((p, i) =>
    i === nextIndex ? { ...p, actions: freshActionEconomy() } : p,
  );
  return {
    ...state,
    round: newRound,
    currentTurnIndex: nextIndex,
    participants,
  };
}

export function isEncounterActionSlot(value: string): value is EncounterActionSlot {
  return value === 'main' || value === 'move' || value === 'free' || value === 'reaction';
}

export function parseCombatCommandInput(
  payload: Record<string, unknown>,
): CombatCommandInput {
  const cleaned = stripForgedEncounterKeys(payload);
  const action = cleaned.action;
  if (action === 'end') return { action: 'end' };
  if (action === 'nextTurn') return { action: 'nextTurn' };
  if (action === 'spendAction') {
    const participantId =
      typeof cleaned.participantId === 'string' ? cleaned.participantId.trim() : '';
    const slotRaw = typeof cleaned.slot === 'string' ? cleaned.slot.trim() : '';
    if (!participantId || !isEncounterActionSlot(slotRaw)) {
      throw new Error('spendAction benötigt participantId und gültigen Slot.');
    }
    return { action: 'spendAction', participantId, slot: slotRaw };
  }
  if (action !== 'start') {
    throw new Error('Unbekannte Combat-Aktion.');
  }
  const rawList = Array.isArray(cleaned.participants) ? cleaned.participants : [];
  const participants: EncounterParticipantSeed[] = [];
  for (const entry of rawList) {
    const row = asRecord(entry);
    if (!row) continue;
    const kind = row.kind === 'pc' || row.kind === 'npc' ? row.kind : null;
    const refId =
      typeof row.refId === 'string'
        ? row.refId.trim()
        : typeof row.characterId === 'string'
          ? row.characterId.trim()
          : typeof row.instanceId === 'string'
            ? row.instanceId.trim()
            : '';
    if (!kind || !refId) continue;
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 120) : null;
    participants.push({ kind, refId, name });
    if (participants.length >= 24) break;
  }
  if (participants.length < 1) {
    throw new Error('Encounter-Start benötigt mindestens einen Teilnehmer.');
  }
  return { action: 'start', participants };
}

export function parseDamageCommandInput(payload: Record<string, unknown>): DamageCommandInput {
  const cleaned = stripForgedEncounterKeys(payload);
  const participantId =
    typeof cleaned.participantId === 'string' ? cleaned.participantId.trim() : '';
  const mode: DamageMode = cleaned.mode === 'heal' ? 'heal' : 'damage';
  const amount = readNonNegInt(cleaned.amount, -1);
  if (!participantId || amount < 0 || amount > 9999) {
    throw new Error('Schaden/Heilung benötigt participantId und gültigen Betrag.');
  }
  return { participantId, amount, mode };
}

export function parseConditionCommandInput(
  payload: Record<string, unknown>,
): ConditionCommandInput {
  const cleaned = stripForgedEncounterKeys(payload);
  const participantId =
    typeof cleaned.participantId === 'string' ? cleaned.participantId.trim() : '';
  const op: ConditionOp = cleaned.op === 'remove' ? 'remove' : 'add';
  const condition = typeof cleaned.condition === 'string' ? cleaned.condition.trim().slice(0, 80) : '';
  if (!participantId || !condition) {
    throw new Error('Zustand benötigt participantId und condition.');
  }
  return { participantId, op, condition };
}

/**
 * Pure initiative total from natural d20 + bonus (domain mirror of SQL).
 */
export function resolveInitiativeTotal(natural: number, bonus: number): number {
  const n = Math.max(1, Math.min(20, Math.floor(natural)));
  const b = Math.max(0, Math.min(40, Math.floor(bonus)));
  return n + b;
}

/**
 * PC initiative bonus: perception + awareness rank + applied EB (rules §6.3).
 */
export function resolvePcInitiativeBonus(input: {
  perception: number;
  awarenessRank: number;
  level: number;
  appliedExperienceBonus: (skillRank: number, level: number) => number;
}): number {
  const perception = Math.max(0, Math.min(5, Math.floor(input.perception)));
  const awarenessRank = Math.max(0, Math.min(5, Math.floor(input.awarenessRank)));
  const eb = input.appliedExperienceBonus(awarenessRank, input.level);
  return perception + awarenessRank + eb;
}

export function buildParticipantId(kind: EncounterParticipantKind, refId: string): string {
  return `${kind}:${refId.trim()}`;
}

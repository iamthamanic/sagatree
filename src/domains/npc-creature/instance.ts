/**
 * NpcCreatureInstance — adventure/session occurrence of a library definition (#201).
 * Location: src/domains/npc-creature/instance.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 * Instance owns runtime HP/conditions/temp controller; definition updates must not
 * silently rewrite the frozen snapshot.
 */

import {
  resolveNpcCreatureEffectiveStats,
} from './derived';
import type { NpcCreatureDefinition } from './definition';
import type {
  NpcCreatureCategory,
  NpcCreatureKind,
  NpcCreatureSheetMode,
} from './taxonomy';
import type {
  SagaTreeCombatProfile,
  SagaTreeCombatRole,
  SagaTreeNpcLevel,
} from '../rules/sagatree/npc-creature-power';

/** Generic encounter fodder vs unique campaign figure. */
export type NpcCreatureInstanceKind = 'generic' | 'persistent';

/**
 * Frozen play snapshot taken at spawn (or last explicit refresh).
 * Live definition changes never mutate this object in place.
 */
export interface NpcCreatureDefinitionSnapshot {
  name: string;
  kind: NpcCreatureKind;
  category: NpcCreatureCategory;
  sheetMode: NpcCreatureSheetMode;
  level: SagaTreeNpcLevel;
  combatProfile: SagaTreeCombatProfile;
  combatRole: SagaTreeCombatRole;
  tags: readonly string[];
  iconKey?: string;
  portraitAssetKey?: string;
  notes?: string;
  /** Max HP frozen at snapshot time from effective definition stats. */
  maxHealth: number;
  /** ISO timestamp when the snapshot was captured. */
  capturedAt: string;
}

/** Mutable encounter / campaign runtime for one instance. */
export interface NpcCreatureInstanceRuntime {
  currentHp: number;
  conditions: readonly string[];
  /** Session-local override; null = no temp override (GM or campaign controller). */
  temporaryControllerUserId: string | null;
  encounterNotes: string;
}

/**
 * Concrete adventure/session figure.
 * `definitionId` is a soft reference; play data comes from `snapshot` + `runtime`.
 */
export interface NpcCreatureInstance {
  id: string;
  projectId: string;
  /** null = campaign-scoped (typical for persistent uniques). */
  sessionId: string | null;
  definitionId: string;
  displayName: string;
  instanceKind: NpcCreatureInstanceKind;
  sequenceNumber: number;
  snapshot: NpcCreatureDefinitionSnapshot;
  runtime: NpcCreatureInstanceRuntime;
}

export interface NpcCreatureInstanceSpawnRequest {
  projectId: string;
  sessionId?: string | null;
  definitionId: string;
  instanceKind: NpcCreatureInstanceKind;
  /** Optional explicit display name; otherwise derived as `Name #N`. */
  displayName?: string | null;
}

export interface NpcCreatureInstanceSpawnContext {
  actorUserId: string;
  actorRole: 'gm' | 'player';
  activeMemberUserIds: readonly string[];
  /** Existing instances in the same project (for sequence numbering). */
  existingInstances: readonly NpcCreatureInstance[];
  /**
   * True when the actor may read the definition in this adventure context
   * (personal owner, world-readable, or trusted builtin/core catalog).
   */
  definitionReadable: boolean;
  /** Clock for snapshot.capturedAt — injectable for tests. */
  nowIso?: string;
}

export type NpcCreatureInstanceSpawnErrorCode =
  | 'not_gm'
  | 'not_member'
  | 'missing_project'
  | 'missing_definition'
  | 'definition_not_readable'
  | 'invalid_kind';

export interface NpcCreatureInstanceSpawnOk {
  ok: true;
  instance: Omit<NpcCreatureInstance, 'id'>;
  /** Snapshot is independent of later definition edits. */
  snapshotIsolated: true;
}

export interface NpcCreatureInstanceSpawnErr {
  ok: false;
  code: NpcCreatureInstanceSpawnErrorCode;
  message: string;
}

export type NpcCreatureInstanceRuntimeErrorCode =
  | 'not_gm'
  | 'not_member'
  | 'missing_instance'
  | 'invalid_hp'
  | 'invalid_controller'
  | 'invalid_conditions';

export interface NpcCreatureInstanceRuntimeUpdate {
  currentHp?: number;
  conditions?: readonly string[];
  temporaryControllerUserId?: string | null;
  encounterNotes?: string;
}

export interface NpcCreatureInstanceRuntimeOk {
  ok: true;
  instance: NpcCreatureInstance;
}

export interface NpcCreatureInstanceRuntimeErr {
  ok: false;
  code: NpcCreatureInstanceRuntimeErrorCode;
  message: string;
}

function normalizeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCondition(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return null;
  return trimmed;
}

/**
 * Capture a play snapshot from a live definition.
 * Does not retain a live reference — callers must treat the result as immutable.
 */
export function captureNpcCreatureDefinitionSnapshot(
  definition: NpcCreatureDefinition,
  nowIso: string = new Date().toISOString(),
): NpcCreatureDefinitionSnapshot {
  const effective = resolveNpcCreatureEffectiveStats(definition);
  return {
    name: definition.name,
    kind: definition.kind,
    category: definition.category,
    sheetMode: definition.sheetMode,
    level: definition.level,
    combatProfile: definition.combatProfile,
    combatRole: definition.combatRole,
    tags: [...definition.tags],
    iconKey: definition.iconKey,
    portraitAssetKey: definition.portraitAssetKey,
    notes: definition.notes,
    maxHealth: effective.health,
    capturedAt: nowIso,
  };
}

/**
 * Next sequence number for a definition within a project
 * (counts both generic and persistent instances of that definitionId).
 */
export function nextInstanceSequenceNumber(
  definitionId: string,
  existing: readonly NpcCreatureInstance[],
): number {
  let max = 0;
  for (const row of existing) {
    if (row.definitionId === definitionId && row.sequenceNumber > max) {
      max = row.sequenceNumber;
    }
  }
  return max + 1;
}

/** Build display label `Wolf #2` from base name + sequence. */
export function formatNpcCreatureInstanceDisplayName(
  baseName: string,
  sequenceNumber: number,
): string {
  const name = baseName.trim() || 'Figur';
  return `${name} #${sequenceNumber}`;
}

/**
 * Plan a new instance from a readable definition.
 * Snapshot is frozen; later definition edits must not rewrite it.
 */
export function planNpcCreatureInstanceSpawn(
  definition: NpcCreatureDefinition,
  request: NpcCreatureInstanceSpawnRequest,
  context: NpcCreatureInstanceSpawnContext,
): NpcCreatureInstanceSpawnOk | NpcCreatureInstanceSpawnErr {
  const projectId = normalizeId(request.projectId);
  if (!projectId) {
    return { ok: false, code: 'missing_project', message: 'Abenteuer fehlt.' };
  }

  const definitionId = normalizeId(request.definitionId) ?? normalizeId(definition.id);
  if (!definitionId || definitionId !== definition.id) {
    return {
      ok: false,
      code: 'missing_definition',
      message: 'Figuren-Vorlage fehlt oder stimmt nicht überein.',
    };
  }

  if (request.instanceKind !== 'generic' && request.instanceKind !== 'persistent') {
    return {
      ok: false,
      code: 'invalid_kind',
      message: 'Ungültiger Instanztyp.',
    };
  }

  const actorUserId = normalizeId(context.actorUserId);
  if (!actorUserId || context.actorRole !== 'gm') {
    return {
      ok: false,
      code: 'not_gm',
      message: 'Nur der Gamemaster darf Instanzen erzeugen.',
    };
  }

  const activeIds = new Set(
    context.activeMemberUserIds
      .map((id) => normalizeId(id))
      .filter((id): id is string => Boolean(id)),
  );
  if (!activeIds.has(actorUserId)) {
    return {
      ok: false,
      code: 'not_member',
      message: 'Akteur ist kein aktives Abenteuer-Mitglied.',
    };
  }

  if (!context.definitionReadable) {
    return {
      ok: false,
      code: 'definition_not_readable',
      message: 'Figuren-Vorlage ist in diesem Abenteuer nicht verfügbar.',
    };
  }

  const sequenceNumber = nextInstanceSequenceNumber(
    definitionId,
    context.existingInstances,
  );
  const snapshot = captureNpcCreatureDefinitionSnapshot(
    definition,
    context.nowIso ?? new Date().toISOString(),
  );
  const explicitName = normalizeId(request.displayName ?? null);
  const displayName =
    explicitName
    ?? formatNpcCreatureInstanceDisplayName(snapshot.name, sequenceNumber);

  const sessionId =
    request.instanceKind === 'persistent'
      ? null
      : (normalizeId(request.sessionId ?? null));

  return {
    ok: true,
    snapshotIsolated: true,
    instance: {
      projectId,
      sessionId,
      definitionId,
      displayName,
      instanceKind: request.instanceKind,
      sequenceNumber,
      snapshot,
      runtime: {
        currentHp: snapshot.maxHealth,
        conditions: [],
        temporaryControllerUserId: null,
        encounterNotes: '',
      },
    },
  };
}

/**
 * Apply runtime updates without touching the definition snapshot.
 */
export function planNpcCreatureInstanceRuntimeUpdate(
  instance: NpcCreatureInstance,
  patch: NpcCreatureInstanceRuntimeUpdate,
  context: Pick<
    NpcCreatureInstanceSpawnContext,
    'actorUserId' | 'actorRole' | 'activeMemberUserIds'
  >,
): NpcCreatureInstanceRuntimeOk | NpcCreatureInstanceRuntimeErr {
  if (!instance || !normalizeId(instance.id)) {
    return {
      ok: false,
      code: 'missing_instance',
      message: 'Instanz fehlt.',
    };
  }

  const actorUserId = normalizeId(context.actorUserId);
  if (!actorUserId || context.actorRole !== 'gm') {
    return {
      ok: false,
      code: 'not_gm',
      message: 'Nur der Gamemaster darf Instanz-Status ändern.',
    };
  }

  const activeIds = new Set(
    context.activeMemberUserIds
      .map((id) => normalizeId(id))
      .filter((id): id is string => Boolean(id)),
  );
  if (!activeIds.has(actorUserId)) {
    return {
      ok: false,
      code: 'not_member',
      message: 'Akteur ist kein aktives Abenteuer-Mitglied.',
    };
  }

  let currentHp = instance.runtime.currentHp;
  if (patch.currentHp !== undefined) {
    if (
      typeof patch.currentHp !== 'number'
      || !Number.isFinite(patch.currentHp)
      || patch.currentHp < 0
      || patch.currentHp > 9999
    ) {
      return {
        ok: false,
        code: 'invalid_hp',
        message: 'Aktuelle TP müssen zwischen 0 und 9999 liegen.',
      };
    }
    currentHp = Math.floor(patch.currentHp);
  }

  let conditions = instance.runtime.conditions;
  if (patch.conditions !== undefined) {
    if (!Array.isArray(patch.conditions) || patch.conditions.length > 24) {
      return {
        ok: false,
        code: 'invalid_conditions',
        message: 'Zustände sind ungültig oder zu viele.',
      };
    }
    const normalized: string[] = [];
    for (const entry of patch.conditions) {
      if (typeof entry !== 'string') {
        return {
          ok: false,
          code: 'invalid_conditions',
          message: 'Zustände müssen Text sein.',
        };
      }
      const c = normalizeCondition(entry);
      if (!c) {
        return {
          ok: false,
          code: 'invalid_conditions',
          message: 'Leerer oder zu langer Zustand.',
        };
      }
      normalized.push(c);
    }
    conditions = normalized;
  }

  let temporaryControllerUserId = instance.runtime.temporaryControllerUserId;
  if (patch.temporaryControllerUserId !== undefined) {
    const controller = normalizeId(patch.temporaryControllerUserId);
    if (controller !== null && !activeIds.has(controller)) {
      return {
        ok: false,
        code: 'invalid_controller',
        message: 'Temporärer Controller ist kein aktives Mitglied.',
      };
    }
    temporaryControllerUserId = controller;
  }

  let encounterNotes = instance.runtime.encounterNotes;
  if (patch.encounterNotes !== undefined) {
    encounterNotes =
      typeof patch.encounterNotes === 'string'
        ? patch.encounterNotes.slice(0, 2000)
        : '';
  }

  return {
    ok: true,
    instance: {
      ...instance,
      snapshot: instance.snapshot,
      runtime: {
        currentHp,
        conditions,
        temporaryControllerUserId,
        encounterNotes,
      },
    },
  };
}

/**
 * Definition live-update must not rewrite instance snapshot/runtime.
 * Returns the same instance reference fields (structural copy) unchanged.
 */
export function resolveInstanceAfterDefinitionChange(
  instance: NpcCreatureInstance,
  _updatedDefinition: NpcCreatureDefinition,
): NpcCreatureInstance {
  return {
    ...instance,
    snapshot: { ...instance.snapshot, tags: [...instance.snapshot.tags] },
    runtime: {
      ...instance.runtime,
      conditions: [...instance.runtime.conditions],
    },
  };
}

/**
 * When a session ends: clear only temporary controller overrides for that session.
 * Does not touch campaign (#200) controller assignments.
 */
export function clearTemporaryControllersForSession(
  instances: readonly NpcCreatureInstance[],
  sessionId: string,
): NpcCreatureInstance[] {
  const sid = normalizeId(sessionId);
  if (!sid) return instances.map((row) => ({ ...row }));
  return instances.map((row) => {
    if (row.sessionId !== sid) return { ...row };
    if (row.runtime.temporaryControllerUserId === null) return { ...row };
    return {
      ...row,
      runtime: {
        ...row.runtime,
        temporaryControllerUserId: null,
        conditions: [...row.runtime.conditions],
      },
    };
  });
}

/**
 * Resolve play view: always prefer snapshot. Flag when live definition is gone.
 */
export function resolveInstancePlayView(
  instance: NpcCreatureInstance,
  liveDefinition: NpcCreatureDefinition | null,
): {
  snapshot: NpcCreatureDefinitionSnapshot;
  runtime: NpcCreatureInstanceRuntime;
  definitionMissing: boolean;
  definitionDiverged: boolean;
} {
  const definitionMissing = liveDefinition === null;
  let definitionDiverged = false;
  if (liveDefinition) {
    const live = captureNpcCreatureDefinitionSnapshot(liveDefinition, instance.snapshot.capturedAt);
    definitionDiverged =
      live.name !== instance.snapshot.name
      || live.maxHealth !== instance.snapshot.maxHealth
      || live.level !== instance.snapshot.level
      || live.combatProfile !== instance.snapshot.combatProfile
      || live.combatRole !== instance.snapshot.combatRole;
  }
  return {
    snapshot: instance.snapshot,
    runtime: instance.runtime,
    definitionMissing,
    definitionDiverged,
  };
}

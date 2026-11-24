/**
 * NPC/creature controller assignment (#200) — orthogonal to sheet mode / identity.
 * Location: src/domains/npc-creature/controller-assignment.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 * Campaign membership must be supplied from trusted infrastructure context.
 */

import type { NpcCreatureDefinition } from './definition';

export interface NpcControllerAssignment {
  projectId: string;
  definitionId: string;
  /** null / omitted = unassigned (GM control). */
  controllerUserId: string | null;
}

export interface NpcControllerAssignmentContext {
  actorUserId: string;
  /** Trusted role of the actor in the project. */
  actorRole: 'gm' | 'player';
  /** Active member user ids (trusted, from project_members). */
  activeMemberUserIds: readonly string[];
}

export type NpcControllerAssignmentErrorCode =
  | 'not_gm'
  | 'not_member'
  | 'missing_project'
  | 'missing_definition'
  | 'sheet_not_full'
  | 'invalid_controller';

export interface NpcControllerAssignmentOk {
  ok: true;
  assignment: NpcControllerAssignment;
  /** sheetMode / identity must remain unchanged by this use case. */
  preservesSheetMode: true;
  preservesIdentity: true;
}

export interface NpcControllerAssignmentErr {
  ok: false;
  code: NpcControllerAssignmentErrorCode;
  message: string;
}

function normalizeId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validate a controller assignment without mutating sheet mode or identity.
 * Fail closed: only GM actors; controller must be null or an active member.
 */
export function planNpcControllerAssignment(
  definition: NpcCreatureDefinition,
  requested: NpcControllerAssignment,
  context: NpcControllerAssignmentContext,
): NpcControllerAssignmentOk | NpcControllerAssignmentErr {
  const projectId = normalizeId(requested.projectId);
  if (!projectId) {
    return { ok: false, code: 'missing_project', message: 'Kampagne fehlt.' };
  }

  const definitionId = normalizeId(requested.definitionId) ?? normalizeId(definition.id);
  if (!definitionId || definitionId !== definition.id) {
    return {
      ok: false,
      code: 'missing_definition',
      message: 'Figuren-ID fehlt oder stimmt nicht überein.',
    };
  }

  if (definition.sheetMode !== 'full') {
    return {
      ok: false,
      code: 'sheet_not_full',
      message: 'Spielerzuweisung ist nur für vollständige Charakterbögen verfügbar.',
    };
  }

  const actorUserId = normalizeId(context.actorUserId);
  if (!actorUserId || context.actorRole !== 'gm') {
    return {
      ok: false,
      code: 'not_gm',
      message: 'Nur der Gamemaster darf die Kontrolle zuweisen.',
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
      message: 'Zuweisende Person ist kein aktives Kampagnenmitglied.',
    };
  }

  const controllerUserId = normalizeId(requested.controllerUserId);
  if (controllerUserId !== null && !activeIds.has(controllerUserId)) {
    return {
      ok: false,
      code: 'invalid_controller',
      message: 'Zielperson ist kein aktives Kampagnenmitglied.',
    };
  }

  return {
    ok: true,
    assignment: {
      projectId,
      definitionId,
      controllerUserId,
    },
    preservesSheetMode: true,
    preservesIdentity: true,
  };
}

/**
 * When a member leaves: if they were the controller, fall back to unassigned.
 * Does not change sheet mode or definition identity.
 */
export function resolveControllerAfterMemberLeave(
  assignment: NpcControllerAssignment,
  leavingUserId: string,
): NpcControllerAssignment {
  const leaving = normalizeId(leavingUserId);
  const current = normalizeId(assignment.controllerUserId);
  if (leaving && current && leaving === current) {
    return { ...assignment, controllerUserId: null };
  }
  return assignment;
}

/**
 * create-plan — Pure preview plan for transactional world-node create (#715).
 * Location: src/domains/world/hierarchy/create-plan.ts
 */
import { assertHierarchyEdge, missingAncestorKinds, placeholderNameStem } from './world-hierarchy';
import {
  isSubtypeForKind,
  isWorldNodeKind,
  type WorldNodeKind,
  type WorldNodeSubtype,
} from './world-node.types';

export type WorldNodeCreatePlanInput = {
  readonly childKind: WorldNodeKind;
  readonly childName: string;
  readonly subtype?: WorldNodeSubtype | null;
  /** Existing immediate ancestor tip kind when lineage already selected; else null. */
  readonly existingTipKind?: WorldNodeKind | null;
};

export type WorldNodeCreatePlanStep = {
  readonly kind: WorldNodeKind;
  readonly role: 'ancestor_placeholder' | 'target';
  readonly name: string;
  readonly needsPrimaryMap: true;
};

export type WorldNodeCreatePlan = {
  readonly ok: true;
  readonly steps: readonly WorldNodeCreatePlanStep[];
  readonly previewLinesDe: readonly string[];
} | {
  readonly ok: false;
  readonly reason: string;
};

/**
 * Build the ordered create steps (ancestors then target). No I/O.
 * Ancestor names are stems; RPC assigns unique sibling numbers.
 */
export function planWorldNodeCreate(input: WorldNodeCreatePlanInput): WorldNodeCreatePlan {
  if (!isWorldNodeKind(input.childKind)) {
    return { ok: false, reason: 'unknown_child_kind' };
  }
  const name = input.childName.trim();
  if (!name) return { ok: false, reason: 'empty_name' };
  if (input.subtype != null && !isSubtypeForKind(input.childKind, input.subtype)) {
    return { ok: false, reason: 'subtype_mismatch' };
  }

  const tip = input.existingTipKind ?? null;
  if (tip !== null && !isWorldNodeKind(tip)) {
    return { ok: false, reason: 'unknown_tip_kind' };
  }

  const ancestors = missingAncestorKinds(input.childKind, tip);

  // If no ancestors will be created, the tip must already be a valid immediate parent.
  if (ancestors.length === 0) {
    const edge = assertHierarchyEdge(input.childKind, tip);
    if (edge.ok === false) {
      return { ok: false, reason: edge.reason };
    }
  }

  const steps: WorldNodeCreatePlanStep[] = [
    ...ancestors.map((kind) => ({
      kind,
      role: 'ancestor_placeholder' as const,
      name: placeholderNameStem(kind),
      needsPrimaryMap: true as const,
    })),
    {
      kind: input.childKind,
      role: 'target',
      name,
      needsPrimaryMap: true,
    },
  ];

  const previewLinesDe = steps
    .filter((s) => s.role === 'ancestor_placeholder')
    .map((s) => s.name);

  return {
    ok: true,
    steps,
    previewLinesDe:
      previewLinesDe.length > 0
        ? [`Wird zusätzlich angelegt: ${previewLinesDe.join(', ')}`]
        : [],
  };
}

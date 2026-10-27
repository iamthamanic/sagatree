/**
 * Canonical WorldNodeKind hierarchy helpers (parity with atlas_wb_* SQL).
 * Location: server/src/modules/world/internal/world-create-helpers.ts
 * Private — import only from world-places-store / world public API consumers inside module.
 */

export const CANONICAL_KINDS = [
  'continent',
  'country',
  'place',
  'building',
  'room',
] as const;

export type CanonicalWorldNodeKind = (typeof CANONICAL_KINDS)[number];

export function isCanonicalKind(v: string): v is CanonicalWorldNodeKind {
  return (CANONICAL_KINDS as readonly string[]).includes(v);
}

export function requiredParentKind(kind: string): string | null {
  switch (kind) {
    case 'continent':
      return null;
    case 'country':
      return 'continent';
    case 'place':
      return 'country';
    case 'building':
      return 'place';
    case 'room':
      return 'building';
    default:
      return null;
  }
}

export function kindRank(kind: string): number | null {
  switch (kind) {
    case 'continent':
      return 0;
    case 'country':
    case 'realm':
      return 1;
    case 'place':
    case 'settlement':
    case 'area':
    case 'region':
      return 2;
    case 'building':
    case 'dungeon':
    case 'site':
      return 3;
    case 'room':
    case 'interior':
      return 4;
    default:
      return null;
  }
}

export function tipSatisfies(need: string | null, tip: string | null): boolean {
  if (need === null) return tip === null;
  if (tip === null) return false;
  switch (need) {
    case 'continent':
      return tip === 'continent';
    case 'country':
      return tip === 'country' || tip === 'realm';
    case 'place':
      return tip === 'place' || tip === 'settlement' || tip === 'area' || tip === 'region';
    case 'building':
      return tip === 'building' || tip === 'dungeon' || tip === 'site';
    case 'room':
      return tip === 'room' || tip === 'interior';
    default:
      return false;
  }
}

export function placeholderStem(kind: string): string {
  switch (kind) {
    case 'continent':
      return 'Unbenannter Kontinent';
    case 'country':
      return 'Unbenanntes Land';
    case 'place':
      return 'Unbenannter Ort';
    case 'building':
      return 'Unbenanntes Gebäude';
    case 'room':
      return 'Unbenannter Raum';
    default:
      return 'Unbenannt';
  }
}

export function mapKindForNode(kind: string): 'region' | 'settlement' | 'scene' {
  switch (kind) {
    case 'continent':
    case 'country':
      return 'region';
    case 'place':
      return 'settlement';
    default:
      return 'scene';
  }
}

/**
 * Missing ancestor kinds between optional tip and target (SQL WHILE loop parity).
 * Returns kinds from highest missing ancestor to lowest (prepend order).
 */
export function missingAncestorChain(
  targetKind: string,
  parentKind: string | null,
  hasParent: boolean,
): string[] {
  const chain: string[] = [];
  let need = requiredParentKind(targetKind);
  while (need !== null) {
    if (
      hasParent &&
      parentKind !== null &&
      kindRank(parentKind) !== null &&
      kindRank(need) !== null &&
      (kindRank(need) as number) <= (kindRank(parentKind) as number)
    ) {
      break;
    }
    chain.unshift(need);
    need = requiredParentKind(need);
  }
  return chain;
}

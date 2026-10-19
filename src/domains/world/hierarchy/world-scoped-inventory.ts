/**
 * world-scoped-inventory — Per-world read-only migration inventory (#753).
 * Location: src/domains/world/hierarchy/world-scoped-inventory.ts
 *
 * Filters places/maps/links/sagas to one world. Never invents sample:* IDs.
 * Never treats WO-* world public ids as place UUIDs.
 */
import { mappingForPlaceKind, tryNodeKindFromPlaceKind } from './legacy-kind-map';
import {
  DONALU_WORLD_PUBLIC_ID,
  buildMigrationDryRun,
  type MigrationDryRunReport,
  type MigrationMapRow,
  type MigrationPlaceRow,
} from './migration-plan';
import { missingAncestorKinds } from './world-hierarchy';
import type { WorldNodeKind } from './world-node.types';

export { DONALU_WORLD_PUBLIC_ID };

/** Prefix banned in Donalu / world-scoped reports (#753). */
export const SYNTHETIC_SAMPLE_ID_PREFIX = 'sample:' as const;

export const AMBIGUOUS_PLACE_KINDS = [
  'site',
  'dungeon',
  'interior',
  'region',
  'district',
] as const;

export type AmbiguousPlaceKind = (typeof AMBIGUOUS_PLACE_KINDS)[number];

export type WorldScope = {
  readonly worldPublicId?: string;
  readonly worldProfileId?: string;
};

export type InventoryPlaceRow = {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly parentPlaceId: string | null;
  readonly worldProfileId?: string | null;
  readonly worldPublicId?: string | null;
  readonly seedKey?: string | null;
  readonly status?: string | null;
};

export type InventoryMapRow = {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly parentMapId: string | null;
  readonly worldProfileId?: string | null;
  readonly worldPublicId?: string | null;
};

export type InventoryLinkRow = {
  readonly placeId: string;
  readonly mapId: string;
  readonly usage: string;
  readonly worldProfileId?: string | null;
  readonly worldPublicId?: string | null;
};

export type InventorySagaRow = {
  readonly sagaPublicId: string;
  readonly sagaName: string;
  readonly worldPublicId: string;
  readonly bindingCount?: number;
  readonly locationBindings?: readonly InventorySagaLocationBinding[];
};

export type InventorySagaLocationBinding = {
  readonly assetId: string;
  readonly label: string;
  readonly reveal: string;
  readonly placeSeed: string | null;
  readonly placeId: string | null;
};

/** Multi-world orphan snapshot row (evidence orphan_places.csv shape). */
export type OrphanWorldSettlementRow = {
  readonly worldPublicId: string;
  readonly seedKey: string;
  readonly kind: string;
  readonly name: string;
};

export type AmbiguousReviewEntry = {
  readonly placeId: string;
  readonly name: string;
  readonly originalKind: string;
  readonly proposedKind: WorldNodeKind | null;
  readonly proposedSubtype: null;
  readonly proposedParentId: string | null;
  readonly notes: string;
  readonly mappingStatus: 'needs-review';
};

export type WorldScopedPlaceRecord = {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly seedKey: string | null;
  readonly parentPlaceId: string | null;
  readonly parentChain: readonly string[];
  readonly primaryMapId: string | null;
  readonly mapLinks: readonly { readonly mapId: string; readonly usage: string }[];
  readonly missingAncestors: readonly WorldNodeKind[];
};

export type WorldScopedInventoryReport = {
  readonly worldPublicId: string | null;
  readonly worldProfileId: string | null;
  readonly generatedAt: string;
  readonly places: readonly WorldScopedPlaceRecord[];
  readonly maps: readonly InventoryMapRow[];
  readonly links: readonly InventoryLinkRow[];
  readonly sagas: readonly InventorySagaRow[];
  readonly reviewQueue: readonly AmbiguousReviewEntry[];
  readonly summary: {
    readonly placeCount: number;
    readonly mapCount: number;
    readonly linkCount: number;
    readonly sagaCount: number;
    readonly orphanSettlementCount: number;
    readonly ambiguousReviewCount: number;
    readonly placesMissingPrimaryMap: number;
  };
  readonly readOnly: true;
};

const PRIMARY_USAGE_RANK: Readonly<Record<string, number>> = {
  footprint: 1,
  interior: 2,
  dungeon: 3,
  overview: 4,
  entrance: 5,
};

export function isAmbiguousPlaceKind(kind: string): kind is AmbiguousPlaceKind {
  return (AMBIGUOUS_PLACE_KINDS as readonly string[]).includes(kind);
}

export function assertWorldScope(scope: WorldScope): WorldScope {
  const publicId = scope.worldPublicId?.trim() || undefined;
  const profileId = scope.worldProfileId?.trim() || undefined;
  if (!publicId && !profileId) {
    throw new Error('world scope requires --world=WO-* public id or world_profile UUID');
  }
  return { worldPublicId: publicId, worldProfileId: profileId };
}

export function matchesWorldScope(
  row: {
    readonly worldPublicId?: string | null;
    readonly worldProfileId?: string | null;
  },
  scope: WorldScope,
): boolean {
  if (scope.worldProfileId && row.worldProfileId === scope.worldProfileId) {
    return true;
  }
  if (scope.worldPublicId && row.worldPublicId === scope.worldPublicId) {
    return true;
  }
  return false;
}

export function isSyntheticSampleId(id: string): boolean {
  return id.startsWith(SYNTHETIC_SAMPLE_ID_PREFIX);
}

export function assertNoSyntheticSampleIds(ids: readonly string[]): void {
  const bad = ids.filter(isSyntheticSampleId);
  if (bad.length > 0) {
    throw new Error(`synthetic sample ids forbidden in world-scoped inventory: ${bad.join(',')}`);
  }
}

/**
 * Count orphan settlements in a multi-world evidence snapshot scoped to one world.
 * Regression for #753: 38-world aggregate must not inflate Donalu when scoped.
 */
export function countOrphanSettlementsForWorld(
  orphans: readonly OrphanWorldSettlementRow[],
  scope: WorldScope,
): number {
  const resolved = assertWorldScope(scope);
  return orphans.filter((row) => {
    if (row.kind !== 'settlement') return false;
    return matchesWorldScope({ worldPublicId: row.worldPublicId }, resolved);
  }).length;
}

export function pickPrimaryMapId(
  links: readonly { readonly mapId: string; readonly usage: string }[],
): string | null {
  if (links.length === 0) return null;
  const ranked = [...links].sort((a, b) => {
    const ra = PRIMARY_USAGE_RANK[a.usage] ?? 99;
    const rb = PRIMARY_USAGE_RANK[b.usage] ?? 99;
    return ra - rb;
  });
  return ranked[0]?.mapId ?? null;
}

export function buildParentChain(
  placeId: string,
  byId: ReadonlyMap<string, { readonly parentPlaceId: string | null }>,
): readonly string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(placeId)?.parentPlaceId ?? null;
  while (current) {
    if (seen.has(current)) break;
    seen.add(current);
    chain.unshift(current);
    current = byId.get(current)?.parentPlaceId ?? null;
  }
  return chain;
}

export function filterInventoryByWorld(input: {
  readonly scope: WorldScope;
  readonly places: readonly InventoryPlaceRow[];
  readonly maps: readonly InventoryMapRow[];
  readonly links: readonly InventoryLinkRow[];
  readonly sagas: readonly InventorySagaRow[];
}): {
  readonly scope: WorldScope;
  readonly places: readonly InventoryPlaceRow[];
  readonly maps: readonly InventoryMapRow[];
  readonly links: readonly InventoryLinkRow[];
  readonly sagas: readonly InventorySagaRow[];
} {
  const scope = assertWorldScope(input.scope);
  return {
    scope,
    places: input.places.filter((p) => matchesWorldScope(p, scope)),
    maps: input.maps.filter((m) => matchesWorldScope(m, scope)),
    links: input.links.filter((l) => matchesWorldScope(l, scope)),
    sagas: input.sagas.filter((s) =>
      matchesWorldScope({ worldPublicId: s.worldPublicId }, scope),
    ),
  };
}

function classifyAmbiguousReview(place: InventoryPlaceRow): AmbiguousReviewEntry | null {
  if (!isAmbiguousPlaceKind(place.kind)) return null;
  const mapping = mappingForPlaceKind(place.kind);
  return {
    placeId: place.id,
    name: place.name,
    originalKind: place.kind,
    proposedKind: null,
    proposedSubtype: null,
    proposedParentId: place.parentPlaceId,
    notes: mapping.notes,
    mappingStatus: 'needs-review',
  };
}

export function buildWorldScopedInventory(input: {
  readonly scope: WorldScope;
  readonly places: readonly InventoryPlaceRow[];
  readonly maps: readonly InventoryMapRow[];
  readonly links?: readonly InventoryLinkRow[];
  readonly sagas?: readonly InventorySagaRow[];
  readonly generatedAt?: string;
}): WorldScopedInventoryReport {
  // Reject synthetics on the full input bag (before scope filter) so sample:* cannot hide.
  assertNoSyntheticSampleIds([
    ...input.places.map((p) => p.id),
    ...input.maps.map((m) => m.id),
  ]);

  const filtered = filterInventoryByWorld({
    scope: input.scope,
    places: input.places,
    maps: input.maps,
    links: input.links ?? [],
    sagas: input.sagas ?? [],
  });

  const byId = new Map(filtered.places.map((p) => [p.id, p] as const));
  const linksByPlace = new Map<string, { mapId: string; usage: string }[]>();
  for (const link of filtered.links) {
    if (!byId.has(link.placeId)) continue;
    const list = linksByPlace.get(link.placeId) ?? [];
    list.push({ mapId: link.mapId, usage: link.usage });
    linksByPlace.set(link.placeId, list);
  }

  const places: WorldScopedPlaceRecord[] = filtered.places.map((place) => {
    const mapLinks = linksByPlace.get(place.id) ?? [];
    const nodeKind = tryNodeKindFromPlaceKind(place.kind);
    const missingAncestors: readonly WorldNodeKind[] =
      place.parentPlaceId == null && nodeKind
        ? missingAncestorKinds(nodeKind, null)
        : [];
    return {
      id: place.id,
      kind: place.kind,
      name: place.name,
      seedKey: place.seedKey ?? null,
      parentPlaceId: place.parentPlaceId,
      parentChain: buildParentChain(place.id, byId),
      primaryMapId: pickPrimaryMapId(mapLinks),
      mapLinks,
      missingAncestors,
    };
  });

  const reviewQueue = filtered.places
    .map(classifyAmbiguousReview)
    .filter((entry): entry is AmbiguousReviewEntry => entry !== null);

  const orphanSettlementCount = places.filter(
    (p) => p.kind === 'settlement' && p.parentPlaceId == null,
  ).length;

  return {
    worldPublicId: filtered.scope.worldPublicId ?? null,
    worldProfileId: filtered.scope.worldProfileId ?? null,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    places,
    maps: filtered.maps,
    links: filtered.links,
    sagas: filtered.sagas,
    reviewQueue,
    summary: {
      placeCount: places.length,
      mapCount: filtered.maps.length,
      linkCount: filtered.links.length,
      sagaCount: filtered.sagas.length,
      orphanSettlementCount,
      ambiguousReviewCount: reviewQueue.length,
      placesMissingPrimaryMap: places.filter((p) => p.primaryMapId == null).length,
    },
    readOnly: true,
  };
}

/** Adapt scoped inventory into #723 dry-run classifier input. */
export function migrationRowsFromInventory(inventory: WorldScopedInventoryReport): {
  readonly places: readonly MigrationPlaceRow[];
  readonly maps: readonly MigrationMapRow[];
} {
  return {
    places: inventory.places.map((p) => ({
      id: p.id,
      publicId: null,
      kind: p.kind,
      name: p.name,
      parentPlaceId: p.parentPlaceId,
      worldProfileId: inventory.worldProfileId,
    })),
    maps: inventory.maps.map((m) => ({
      id: m.id,
      kind: m.kind,
      parentMapId: m.parentMapId,
      title: m.title,
    })),
  };
}

export function buildScopedMigrationDryRun(input: {
  readonly scope: WorldScope;
  readonly places: readonly InventoryPlaceRow[];
  readonly maps: readonly InventoryMapRow[];
  readonly links?: readonly InventoryLinkRow[];
  readonly sagas?: readonly InventorySagaRow[];
  readonly generatedAt?: string;
}): {
  readonly inventory: WorldScopedInventoryReport;
  readonly migration: MigrationDryRunReport;
} {
  const inventory = buildWorldScopedInventory(input);
  const rows = migrationRowsFromInventory(inventory);
  const worldPublicId =
    inventory.worldPublicId ?? inventory.worldProfileId ?? DONALU_WORLD_PUBLIC_ID;
  const migration = buildMigrationDryRun({
    worldPublicId,
    places: rows.places,
    maps: rows.maps,
    generatedAt: inventory.generatedAt,
  });
  return { inventory, migration };
}

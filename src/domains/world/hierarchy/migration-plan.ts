/**
 * migration-plan — Dry-run classification for legacy → WorldNode migration (#723).
 * Location: src/domains/world/hierarchy/migration-plan.ts
 *
 * Never auto-promotes needs-review kinds. Never invents political parents as fact.
 */
import {
  mappingForMapKind,
  mappingForPlaceKind,
  tryNodeKindFromPlaceKind,
} from './legacy-kind-map';
import { missingAncestorKinds } from './world-hierarchy';
import type { WorldNodeKind } from './world-node.types';

export const DONALU_WORLD_PUBLIC_ID = 'WO-9FFK6' as const;

export type MigrationAction =
  | 'keep'
  | 'compat-read'
  | 'add-placeholder-ancestors'
  | 'ensure-primary-map'
  | 'review-queue'
  | 'skip';

export type MigrationPlaceRow = {
  readonly id: string;
  readonly publicId?: string | null;
  readonly kind: string;
  readonly name: string;
  readonly parentPlaceId: string | null;
  readonly worldProfileId?: string | null;
};

export type MigrationMapRow = {
  readonly id: string;
  readonly kind: string;
  readonly parentMapId: string | null;
  readonly title: string;
};

export type MigrationPlanItem = {
  readonly subject: 'place' | 'map';
  readonly id: string;
  readonly legacyKind: string;
  readonly mappingStatus: string;
  readonly nodeKind: WorldNodeKind | null;
  readonly action: MigrationAction;
  readonly notes: string;
  readonly missingAncestors: readonly WorldNodeKind[];
};

export type MigrationDryRunReport = {
  readonly worldPublicId: string;
  readonly generatedAt: string;
  readonly items: readonly MigrationPlanItem[];
  readonly reviewQueue: readonly MigrationPlanItem[];
  readonly summary: {
    readonly keep: number;
    readonly compatRead: number;
    readonly addPlaceholders: number;
    readonly ensurePrimaryMap: number;
    readonly reviewQueue: number;
    readonly skip: number;
  };
  readonly restorePlan: readonly string[];
};

function classifyPlace(row: MigrationPlaceRow): MigrationPlanItem {
  const mapping = mappingForPlaceKind(row.kind);
  const nodeKind = tryNodeKindFromPlaceKind(row.kind);
  if (mapping.status === 'needs-review') {
    return {
      subject: 'place',
      id: row.id,
      legacyKind: row.kind,
      mappingStatus: mapping.status,
      nodeKind: null,
      action: 'review-queue',
      notes: mapping.notes,
      missingAncestors: [],
    };
  }
  if (!nodeKind) {
    return {
      subject: 'place',
      id: row.id,
      legacyKind: row.kind,
      mappingStatus: mapping.status,
      nodeKind: null,
      action: 'skip',
      notes: 'No safe node kind',
      missingAncestors: [],
    };
  }
  const missing =
    row.parentPlaceId == null ? missingAncestorKinds(nodeKind, null) : ([] as WorldNodeKind[]);
  if (missing.length > 0) {
    return {
      subject: 'place',
      id: row.id,
      legacyKind: row.kind,
      mappingStatus: mapping.status,
      nodeKind,
      action: 'add-placeholder-ancestors',
      notes: `Orphan ${nodeKind}; placeholders: ${missing.join('→')}`,
      missingAncestors: missing,
    };
  }
  if (mapping.status === 'compat-alias') {
    return {
      subject: 'place',
      id: row.id,
      legacyKind: row.kind,
      mappingStatus: mapping.status,
      nodeKind,
      action: 'compat-read',
      notes: mapping.notes,
      missingAncestors: [],
    };
  }
  return {
    subject: 'place',
    id: row.id,
    legacyKind: row.kind,
    mappingStatus: mapping.status,
    nodeKind,
    action: 'keep',
    notes: mapping.notes,
    missingAncestors: [],
  };
}

function classifyMap(row: MigrationMapRow): MigrationPlanItem {
  const mapping = mappingForMapKind(row.kind);
  if (mapping.status === 'needs-review') {
    return {
      subject: 'map',
      id: row.id,
      legacyKind: row.kind,
      mappingStatus: mapping.status,
      nodeKind: mapping.nodeKind,
      action: 'review-queue',
      notes: mapping.notes,
      missingAncestors: [],
    };
  }
  if (row.parentMapId == null && row.kind !== 'world' && row.kind !== 'legacy_tiles') {
    return {
      subject: 'map',
      id: row.id,
      legacyKind: row.kind,
      mappingStatus: mapping.status,
      nodeKind: mapping.nodeKind,
      action: 'ensure-primary-map',
      notes: 'Non-root map missing parent_map_id — link to parent primary in apply phase',
      missingAncestors: [],
    };
  }
  return {
    subject: 'map',
    id: row.id,
    legacyKind: row.kind,
    mappingStatus: mapping.status,
    nodeKind: mapping.nodeKind,
    action: mapping.status === 'compat-alias' ? 'compat-read' : 'keep',
    notes: mapping.notes,
    missingAncestors: [],
  };
}

export function buildMigrationDryRun(input: {
  readonly worldPublicId: string;
  readonly places: readonly MigrationPlaceRow[];
  readonly maps: readonly MigrationMapRow[];
  readonly generatedAt?: string;
}): MigrationDryRunReport {
  const items = [
    ...input.places.map(classifyPlace),
    ...input.maps.map(classifyMap),
  ];
  const reviewQueue = items.filter((i) => i.action === 'review-queue');
  const count = (action: MigrationAction) => items.filter((i) => i.action === action).length;
  return {
    worldPublicId: input.worldPublicId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    items,
    reviewQueue,
    summary: {
      keep: count('keep'),
      compatRead: count('compat-read'),
      addPlaceholders: count('add-placeholder-ancestors'),
      ensurePrimaryMap: count('ensure-primary-map'),
      reviewQueue: reviewQueue.length,
      skip: count('skip'),
    },
    restorePlan: [
      '1. Stop writers / disable atlas_wb_migration_gates.enabled for the world.',
      '2. Restore Postgres from `.qa/evidence/atlas-worldbuilder-evidence/backups/` dump (see #713 restore log).',
      '3. Re-run dry-run; compare place/map UUIDs, saga bindings, and storage paths.',
      '4. Do not delete world_places / world_atlas_maps / public_ids during rollback.',
    ],
  };
}

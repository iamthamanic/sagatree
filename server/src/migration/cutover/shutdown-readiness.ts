/**
 * MIG-702 Dornhain-scoped Supabase shutdown readiness (isolated-contract).
 * Location: server/src/migration/cutover/shutdown-readiness.ts
 *
 * Predecessors + call-path matrix + restore/permission negatives must pass.
 * Productive shutdown additionally requires a linked human Freigabe — never
 * implied by agent labels alone.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  assertDornhainCatalogPresent,
  dornhainFixtureCatalog,
} from './dornhain-catalog.ts';

function assertOk(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const REQUIRED_PREDECESSORS = [
  'MIG-700',
  'MIG-701',
  'ATLAS-LIVE-E2E',
  'MIG-603',
] as const;

export type ShutdownPredecessorId = (typeof REQUIRED_PREDECESSORS)[number];

const predecessorEvidenceSchema = z.object({
  localId: z.enum(REQUIRED_PREDECESSORS),
  /** Hashed completionEvidence path — labels alone never unlock. */
  completionEvidencePath: z.string().min(1),
  result: z.literal('PASS'),
  /** Optional on-disk existence check (fixture / CI workspace). */
  evidenceExists: z.boolean(),
});

export type PredecessorEvidence = z.infer<typeof predecessorEvidenceSchema>;

const callMatrixEntrySchema = z.object({
  operationId: z.string().min(1),
  /** Remaining live Supabase network call (blocker unless retired). */
  supabaseNetworkCall: z.boolean(),
  successorVerified: z.boolean(),
  humanApprovedRetirement: z.boolean().default(false),
});

export type CallMatrixEntry = z.infer<typeof callMatrixEntrySchema>;

const restoreProofSchema = z.object({
  catalogIntact: z.boolean(),
  restoreDrillPass: z.boolean(),
  archivePath: z.string().min(1),
});

export type RestoreProof = z.infer<typeof restoreProofSchema>;

const permissionNegativeSchema = z.object({
  strangerUserId: z.string().min(1),
  strangerCanAuthorizeShutdown: z.boolean(),
  ownerUserId: z.string().min(1),
  ownerCanAuthorizeShutdown: z.boolean(),
});

export type PermissionNegative = z.infer<typeof permissionNegativeSchema>;

const humanApprovalSchema = z.object({
  linkedPath: z.string().min(1),
  status: z.literal('APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF'),
  actor: z.string().min(1),
});

export type HumanApproval = z.infer<typeof humanApprovalSchema>;

export type ShutdownBlocker = {
  readonly code:
    | 'missing-predecessor-evidence'
    | 'predecessor-evidence-missing-on-disk'
    | 'predecessor-not-pass'
    | 'supabase-network-blocker'
    | 'operation-without-successor'
    | 'restore-not-proven'
    | 'catalog-not-intact'
    | 'permission-negative-failed'
    | 'human-approval-missing';
  readonly detail: string;
};

export type ShutdownReadinessReport = {
  readonly shutdownReady: boolean;
  /** True only with linked Freigabe + shutdownReady; never from agent labels. */
  readonly productiveShutdownAuthorized: boolean;
  readonly blockers: readonly ShutdownBlocker[];
  readonly predecessorIdsChecked: readonly ShutdownPredecessorId[];
  readonly supabaseBlockerCount: number;
  readonly catalogIntact: boolean;
};

export type ShutdownReadinessInput = {
  readonly predecessors: readonly PredecessorEvidence[];
  readonly callMatrix: readonly CallMatrixEntry[];
  readonly restore: RestoreProof;
  readonly permission: PermissionNegative;
  readonly humanApproval: HumanApproval | null;
  /** Agent/intake labels must not bypass missing evidence. */
  readonly claimedAgentDoneLabels?: Readonly<Partial<Record<ShutdownPredecessorId, boolean>>>;
};

/**
 * Fail-closed readiness evaluation. Relabeled agent-done without evidence paths
 * still blocks (acceptance: umetikettiertes Vorgängerticket umgeht Sperre nicht).
 */
export function evaluateShutdownReadiness(raw: ShutdownReadinessInput): ShutdownReadinessReport {
  const predecessors = raw.predecessors.map((p) => predecessorEvidenceSchema.parse(p));
  const callMatrix = raw.callMatrix.map((e) => callMatrixEntrySchema.parse(e));
  const restore = restoreProofSchema.parse(raw.restore);
  const permission = permissionNegativeSchema.parse(raw.permission);
  const humanApproval = raw.humanApproval
    ? humanApprovalSchema.parse(raw.humanApproval)
    : null;

  const blockers: ShutdownBlocker[] = [];
  const byId = new Map(predecessors.map((p) => [p.localId, p]));

  for (const id of REQUIRED_PREDECESSORS) {
    const claimed = raw.claimedAgentDoneLabels?.[id] === true;
    const evidence = byId.get(id);
    if (!evidence) {
      blockers.push({
        code: 'missing-predecessor-evidence',
        detail: claimed
          ? `${id}: agent-done label without completionEvidence path`
          : `${id}: completionEvidence required`,
      });
      continue;
    }
    if (evidence.result !== 'PASS') {
      blockers.push({
        code: 'predecessor-not-pass',
        detail: `${id}: result=${evidence.result}`,
      });
    }
    if (!evidence.evidenceExists) {
      blockers.push({
        code: 'predecessor-evidence-missing-on-disk',
        detail: `${id}: missing file ${evidence.completionEvidencePath}`,
      });
    }
  }

  let supabaseBlockerCount = 0;
  for (const entry of callMatrix) {
    if (entry.supabaseNetworkCall) {
      if (!entry.humanApprovedRetirement) {
        supabaseBlockerCount += 1;
        blockers.push({
          code: 'supabase-network-blocker',
          detail: `${entry.operationId}: remaining Supabase network call`,
        });
      }
      continue;
    }
    if (!entry.successorVerified && !entry.humanApprovedRetirement) {
      blockers.push({
        code: 'operation-without-successor',
        detail: `${entry.operationId}: no verified successor or approved retirement`,
      });
    }
  }

  if (!restore.restoreDrillPass) {
    blockers.push({
      code: 'restore-not-proven',
      detail: `restore drill not PASS (archive=${restore.archivePath})`,
    });
  }
  if (!restore.catalogIntact) {
    blockers.push({
      code: 'catalog-not-intact',
      detail: 'Dornhain catalog not intact on authority after restore',
    });
  }

  if (permission.strangerCanAuthorizeShutdown) {
    blockers.push({
      code: 'permission-negative-failed',
      detail: `stranger ${permission.strangerUserId} must not authorize shutdown`,
    });
  }
  if (!permission.ownerCanAuthorizeShutdown) {
    blockers.push({
      code: 'permission-negative-failed',
      detail: `owner ${permission.ownerUserId} must be able to authorize after proof`,
    });
  }

  const shutdownReady = blockers.length === 0;

  const productiveShutdownAuthorized =
    shutdownReady &&
    humanApproval !== null &&
    humanApproval.status === 'APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF' &&
    humanApproval.linkedPath.length > 0;

  return {
    shutdownReady,
    productiveShutdownAuthorized,
    blockers,
    predecessorIdsChecked: [...REQUIRED_PREDECESSORS],
    supabaseBlockerCount,
    catalogIntact: restore.catalogIntact,
  };
}

export type ShutdownDecisionArchive = {
  readonly decisionId: string;
  readonly recordedAt: string;
  readonly shutdownReady: boolean;
  readonly productiveShutdownAuthorized: boolean;
  readonly blockerCount: number;
  readonly responsibleDecision: string;
  readonly sha256: string;
};

export function archiveShutdownDecision(args: {
  readonly archiveDir: string;
  readonly report: ShutdownReadinessReport;
  readonly responsibleDecision: string;
}): ShutdownDecisionArchive {
  mkdirSync(args.archiveDir, { recursive: true });
  const decisionId = randomUUID();
  const recordedAt = new Date().toISOString();
  const payload = {
    decisionId,
    recordedAt,
    shutdownReady: args.report.shutdownReady,
    productiveShutdownAuthorized: args.report.productiveShutdownAuthorized,
    blockerCount: args.report.blockers.length,
    blockers: args.report.blockers,
    responsibleDecision: args.responsibleDecision,
  };
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  const sha256 = createHash('sha256').update(body).digest('hex');
  const file = join(args.archiveDir, `shutdown-decision-${decisionId}.json`);
  writeFileSync(file, body);
  return {
    decisionId,
    recordedAt,
    shutdownReady: args.report.shutdownReady,
    productiveShutdownAuthorized: args.report.productiveShutdownAuthorized,
    blockerCount: args.report.blockers.length,
    responsibleDecision: args.responsibleDecision,
    sha256,
  };
}

/** Load predecessor evidence from repo completion JSON (fixture helper). */
export function loadPredecessorEvidenceFromDisk(
  rootDir: string,
  localId: ShutdownPredecessorId,
  relativePath: string,
): PredecessorEvidence {
  const abs = join(rootDir, relativePath);
  const evidenceExists = existsSync(abs);
  let result: 'PASS' | 'FAIL' = 'FAIL';
  if (evidenceExists) {
    try {
      const parsed = JSON.parse(readFileSync(abs, 'utf8')) as { result?: string; localId?: string };
      if (parsed.localId === localId && parsed.result === 'PASS') result = 'PASS';
    } catch {
      result = 'FAIL';
    }
  }
  return {
    localId,
    completionEvidencePath: relativePath,
    result,
    evidenceExists,
  };
}

/**
 * Full MIG-702 fixture drill: blocked without evidence → blocked with supabase
 * leftover → ready with matrix+restore+Freigabe → productive only with approval.
 */
export function runDornhainShutdownReadinessDrill(args: {
  readonly repoRoot: string;
  readonly archiveDir: string;
  readonly ownerUserId?: string;
  readonly strangerUserId?: string;
}): {
  readonly blockedWithoutEvidence: ShutdownReadinessReport;
  readonly blockedWithSupabaseLeftover: ShutdownReadinessReport;
  readonly readyWithFreigabe: ShutdownReadinessReport;
  readonly archive: ShutdownDecisionArchive;
} {
  const catalog = dornhainFixtureCatalog();
  const presence = assertDornhainCatalogPresent({
    worldTitles: [catalog.worldTitle],
    sagaSlugs: [catalog.sagaSlug],
    characterIds: catalog.characters.map((c) => c.id),
    monsterIds: catalog.monsters.map((m) => m.id),
    itemDefinitionIds: catalog.itemDefinitionIds,
    npcPublicIds: catalog.npcPublicIds,
    catalog,
  });
  assertOk(presence.ok, 'fixture catalog must be self-complete');

  const ownerUserId = args.ownerUserId ?? 'owner-dornhain';
  const strangerUserId = args.strangerUserId ?? 'stranger-tenant';

  const blockedWithoutEvidence = evaluateShutdownReadiness({
    predecessors: [],
    claimedAgentDoneLabels: {
      'MIG-700': true,
      'MIG-701': true,
      'ATLAS-LIVE-E2E': true,
      'MIG-603': true,
    },
    callMatrix: [
      {
        operationId: 'host.world.read',
        supabaseNetworkCall: false,
        successorVerified: true,
        humanApprovedRetirement: false,
      },
    ],
    restore: {
      catalogIntact: true,
      restoreDrillPass: true,
      archivePath: 'fixture://missing-preds',
    },
    permission: {
      strangerUserId,
      strangerCanAuthorizeShutdown: false,
      ownerUserId,
      ownerCanAuthorizeShutdown: true,
    },
    humanApproval: null,
  });
  assertOk(!blockedWithoutEvidence.shutdownReady, 'relabeled preds without evidence must block');
  assertOk(
    blockedWithoutEvidence.blockers.some((b) => b.code === 'missing-predecessor-evidence'),
    'missing-predecessor-evidence expected',
  );
  assertOk(
    !blockedWithoutEvidence.productiveShutdownAuthorized,
    'productive must stay false without Freigabe',
  );

  const preds = (['MIG-700', 'MIG-701', 'ATLAS-LIVE-E2E', 'MIG-603'] as const).map((id) => {
    const pathById: Record<ShutdownPredecessorId, string> = {
      'MIG-700': '.qa/evidence/stack-migration-prep/completion/mig-700.json',
      'MIG-701': '.qa/evidence/stack-migration-prep/completion/mig-701.json',
      'ATLAS-LIVE-E2E': '.qa/evidence/stack-migration-prep/completion/atlas-live-e2e.json',
      'MIG-603': '.qa/evidence/stack-migration-prep/completion/mig-603.json',
    };
    return loadPredecessorEvidenceFromDisk(args.repoRoot, id, pathById[id]);
  });

  const blockedWithSupabaseLeftover = evaluateShutdownReadiness({
    predecessors: preds,
    callMatrix: [
      {
        operationId: 'edge.characters.list',
        supabaseNetworkCall: true,
        successorVerified: false,
        humanApprovedRetirement: false,
      },
      {
        operationId: 'host.character.read',
        supabaseNetworkCall: false,
        successorVerified: true,
        humanApprovedRetirement: false,
      },
    ],
    restore: {
      catalogIntact: true,
      restoreDrillPass: true,
      archivePath: 'fixture://supabase-leftover',
    },
    permission: {
      strangerUserId,
      strangerCanAuthorizeShutdown: false,
      ownerUserId,
      ownerCanAuthorizeShutdown: true,
    },
    humanApproval: {
      linkedPath: 'docs/architecture/migration-owner-release-2026-11-01-dornhain.md',
      status: 'APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF',
      actor: 'iamthamanic',
    },
  });
  assertOk(!blockedWithSupabaseLeftover.shutdownReady, 'leftover supabase call must block');
  assertOk(blockedWithSupabaseLeftover.supabaseBlockerCount >= 1, 'supabase blocker counted');
  assertOk(
    !blockedWithSupabaseLeftover.productiveShutdownAuthorized,
    'productive blocked while supabase leftover',
  );

  const readyWithFreigabe = evaluateShutdownReadiness({
    predecessors: preds,
    callMatrix: [
      {
        operationId: 'edge.characters.list',
        supabaseNetworkCall: true,
        successorVerified: false,
        humanApprovedRetirement: true,
      },
      {
        operationId: 'host.character.read',
        supabaseNetworkCall: false,
        successorVerified: true,
        humanApprovedRetirement: false,
      },
      {
        operationId: 'host.world.read',
        supabaseNetworkCall: false,
        successorVerified: true,
        humanApprovedRetirement: false,
      },
      {
        operationId: 'host.catalog.dornhain',
        supabaseNetworkCall: false,
        successorVerified: true,
        humanApprovedRetirement: false,
      },
    ],
    restore: {
      catalogIntact: presence.missing.length === 0,
      restoreDrillPass: true,
      archivePath: 'fixture://mig-700-rollback + mig-701-parity-archive',
    },
    permission: {
      strangerUserId,
      strangerCanAuthorizeShutdown: false,
      ownerUserId,
      ownerCanAuthorizeShutdown: true,
    },
    humanApproval: {
      linkedPath: 'docs/architecture/migration-owner-release-2026-11-01-dornhain.md',
      status: 'APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF',
      actor: 'iamthamanic',
    },
  });
  assertOk(readyWithFreigabe.shutdownReady, 'full proof must set shutdownReady');
  assertOk(
    readyWithFreigabe.productiveShutdownAuthorized,
    'linked Freigabe authorizes productive Dornhain-scoped shutdown',
  );
  assertOk(readyWithFreigabe.catalogIntact, 'Dornhain catalog intact');
  assertOk(readyWithFreigabe.supabaseBlockerCount === 0, 'no open supabase blockers');

  const withoutApproval = evaluateShutdownReadiness({
    predecessors: preds,
    callMatrix: [
      {
        operationId: 'host.character.read',
        supabaseNetworkCall: false,
        successorVerified: true,
        humanApprovedRetirement: false,
      },
      {
        operationId: 'host.world.read',
        supabaseNetworkCall: false,
        successorVerified: true,
        humanApprovedRetirement: false,
      },
    ],
    restore: {
      catalogIntact: true,
      restoreDrillPass: true,
      archivePath: 'fixture://no-approval',
    },
    permission: {
      strangerUserId,
      strangerCanAuthorizeShutdown: false,
      ownerUserId,
      ownerCanAuthorizeShutdown: true,
    },
    humanApproval: null,
  });
  assertOk(withoutApproval.shutdownReady, 'drill gate can be ready without productive auth');
  assertOk(
    !withoutApproval.productiveShutdownAuthorized,
    'productive requires linked human Freigabe',
  );

  const archive = archiveShutdownDecision({
    archiveDir: args.archiveDir,
    report: readyWithFreigabe,
    responsibleDecision:
      'MIG-702 Dornhain Freigabe A: Supabase exit allowed after parity+restore proof',
  });

  return {
    blockedWithoutEvidence,
    blockedWithSupabaseLeftover,
    readyWithFreigabe,
    archive,
  };
}

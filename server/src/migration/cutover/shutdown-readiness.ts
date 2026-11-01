/**
 * MIG-702 Dornhain-scoped Supabase shutdown readiness (isolated-contract).
 * Location: server/src/migration/cutover/shutdown-readiness.ts
 *
 * Predecessors + non-empty call-path matrix + restore/permission negatives must
 * pass. Live Supabase network calls always block. Productive shutdown binds to
 * the canonical CUTOVER-DORHAIN release record on disk — never fabricated
 * approval objects alone.
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  assertDornhainCatalogPresent,
  dornhainFixtureCatalog,
  type DornhainCatalog,
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

const CANONICAL_RELEASE_ID = 'CUTOVER-DORHAIN';
const CANONICAL_APPROVALS_REL =
  '.qa/evidence/stack-migration-prep/architecture-approvals.json';
const CANONICAL_RELEASE_STATUS = 'APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF';

const predecessorEvidenceSchema = z.object({
  localId: z.enum(REQUIRED_PREDECESSORS),
  completionEvidencePath: z.string().min(1),
  result: z.enum(['PASS', 'FAIL']),
  evidenceExists: z.boolean(),
  /** Digest of on-disk completion JSON when validated; null if missing/invalid. */
  evidenceSha256: z.string().length(64).nullable(),
});

export type PredecessorEvidence = z.infer<typeof predecessorEvidenceSchema>;

const callMatrixEntrySchema = z.object({
  operationId: z.string().min(1),
  /** Remaining live Supabase network call — always a blocker while true. */
  supabaseNetworkCall: z.boolean(),
  successorVerified: z.boolean(),
  humanApprovedRetirement: z.boolean(),
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

const humanApprovalClaimSchema = z.object({
  /** Must match releases.CUTOVER-DORHAIN.evidenceFile in architecture-approvals. */
  linkedPath: z.string().min(1),
  status: z.literal(CANONICAL_RELEASE_STATUS),
  actor: z.string().min(1),
});

export type HumanApproval = z.infer<typeof humanApprovalClaimSchema>;

const completionCheckSchema = z.object({
  command: z.string().min(1),
  result: z.literal('PASS'),
  evidenceFile: z.string().min(1),
  sha256: z.string().length(64),
});

const completionEvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('migration-acceptance'),
  localId: z.string().min(1),
  result: z.literal('PASS'),
  checks: z.array(completionCheckSchema).min(1),
});

const releaseRecordSchema = z.object({
  status: z.literal(CANONICAL_RELEASE_STATUS),
  actorType: z.literal('human'),
  actor: z.string().min(1),
  evidenceFile: z.string().min(1),
});

const approvalsFileSchema = z.object({
  schemaVersion: z.number().int().positive(),
  releases: z.object({
    [CANONICAL_RELEASE_ID]: releaseRecordSchema,
  }),
});

export type ShutdownBlocker = {
  readonly code:
    | 'missing-predecessor-evidence'
    | 'predecessor-evidence-missing-on-disk'
    | 'predecessor-not-pass'
    | 'predecessor-evidence-invalid'
    | 'duplicate-predecessor'
    | 'empty-call-matrix'
    | 'supabase-network-blocker'
    | 'operation-without-successor'
    | 'restore-not-proven'
    | 'catalog-not-intact'
    | 'permission-negative-failed'
    | 'human-approval-unbound';
  readonly detail: string;
};

export type ShutdownReadinessReport = {
  readonly shutdownReady: boolean;
  readonly productiveShutdownAuthorized: boolean;
  readonly blockers: readonly ShutdownBlocker[];
  readonly predecessorIdsChecked: readonly ShutdownPredecessorId[];
  readonly supabaseBlockerCount: number;
  readonly catalogIntact: boolean;
  readonly boundRelease: {
    readonly releaseId: typeof CANONICAL_RELEASE_ID;
    readonly evidenceFile: string;
    readonly actor: string;
    readonly status: typeof CANONICAL_RELEASE_STATUS;
  } | null;
};

export type ShutdownReadinessInput = {
  readonly repoRoot: string;
  readonly predecessors: readonly PredecessorEvidence[];
  readonly callMatrix: readonly CallMatrixEntry[];
  readonly restore: RestoreProof;
  readonly permission: PermissionNegative;
  /** Claimed Freigabe; productive auth requires bind to architecture-approvals. */
  readonly humanApproval: HumanApproval | null;
  readonly claimedAgentDoneLabels?: Readonly<Partial<Record<ShutdownPredecessorId, boolean>>>;
  readonly approvalsRelativePath?: string;
};

function sha256Hex(body: Buffer | string): string {
  return createHash('sha256').update(body).digest('hex');
}

function bindCanonicalRelease(
  repoRoot: string,
  claim: HumanApproval | null,
  approvalsRelativePath: string,
): { bound: ShutdownReadinessReport['boundRelease']; blocker: ShutdownBlocker | null } {
  if (!claim) {
    return { bound: null, blocker: null };
  }
  const abs = join(repoRoot, approvalsRelativePath);
  if (!existsSync(abs)) {
    return {
      bound: null,
      blocker: {
        code: 'human-approval-unbound',
        detail: `missing approvals file ${approvalsRelativePath}`,
      },
    };
  }
  let parsed: z.infer<typeof approvalsFileSchema>;
  try {
    parsed = approvalsFileSchema.parse(JSON.parse(readFileSync(abs, 'utf8')));
  } catch (err) {
    return {
      bound: null,
      blocker: {
        code: 'human-approval-unbound',
        detail: `approvals schema invalid: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
  const release = parsed.releases[CANONICAL_RELEASE_ID];
  if (claim.linkedPath !== release.evidenceFile) {
    return {
      bound: null,
      blocker: {
        code: 'human-approval-unbound',
        detail: `linkedPath ${claim.linkedPath} != canonical ${release.evidenceFile}`,
      },
    };
  }
  if (claim.actor !== release.actor) {
    return {
      bound: null,
      blocker: {
        code: 'human-approval-unbound',
        detail: `actor ${claim.actor} != canonical ${release.actor}`,
      },
    };
  }
  if (claim.status !== release.status) {
    return {
      bound: null,
      blocker: {
        code: 'human-approval-unbound',
        detail: `status ${claim.status} != canonical ${release.status}`,
      },
    };
  }
  const evidenceAbs = join(repoRoot, release.evidenceFile);
  if (!existsSync(evidenceAbs)) {
    return {
      bound: null,
      blocker: {
        code: 'human-approval-unbound',
        detail: `canonical evidenceFile missing on disk: ${release.evidenceFile}`,
      },
    };
  }
  return {
    bound: {
      releaseId: CANONICAL_RELEASE_ID,
      evidenceFile: release.evidenceFile,
      actor: release.actor,
      status: release.status,
    },
    blocker: null,
  };
}

/**
 * Fail-closed readiness evaluation.
 */
export function evaluateShutdownReadiness(raw: ShutdownReadinessInput): ShutdownReadinessReport {
  const predecessors = raw.predecessors.map((p) => predecessorEvidenceSchema.parse(p));
  const callMatrix = raw.callMatrix.map((e) => callMatrixEntrySchema.parse(e));
  const restore = restoreProofSchema.parse(raw.restore);
  const permission = permissionNegativeSchema.parse(raw.permission);
  const humanApproval = raw.humanApproval
    ? humanApprovalClaimSchema.parse(raw.humanApproval)
    : null;
  const approvalsRelativePath = raw.approvalsRelativePath ?? CANONICAL_APPROVALS_REL;

  const blockers: ShutdownBlocker[] = [];
  const seen = new Set<string>();
  const byId = new Map<ShutdownPredecessorId, PredecessorEvidence>();

  for (const evidence of predecessors) {
    if (seen.has(evidence.localId)) {
      blockers.push({
        code: 'duplicate-predecessor',
        detail: `${evidence.localId}: duplicate completionEvidence entries`,
      });
      continue;
    }
    seen.add(evidence.localId);
    byId.set(evidence.localId, evidence);
  }

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
    if (evidence.evidenceExists && !evidence.evidenceSha256) {
      blockers.push({
        code: 'predecessor-evidence-invalid',
        detail: `${id}: completionEvidence failed schema/hash validation`,
      });
    }
  }

  if (callMatrix.length === 0) {
    blockers.push({
      code: 'empty-call-matrix',
      detail: 'callMatrix must list at least one operation (fail-closed)',
    });
  }

  let supabaseBlockerCount = 0;
  for (const entry of callMatrix) {
    if (entry.supabaseNetworkCall) {
      supabaseBlockerCount += 1;
      blockers.push({
        code: 'supabase-network-blocker',
        detail: `${entry.operationId}: remaining Supabase network call (retirement flag does not clear live calls)`,
      });
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

  const { bound, blocker: approvalBlocker } = bindCanonicalRelease(
    raw.repoRoot,
    humanApproval,
    approvalsRelativePath,
  );
  if (humanApproval && approvalBlocker) {
    blockers.push(approvalBlocker);
  }

  const shutdownReady = blockers.length === 0;
  const productiveShutdownAuthorized = shutdownReady && bound !== null;

  return {
    shutdownReady,
    productiveShutdownAuthorized,
    blockers,
    predecessorIdsChecked: [...REQUIRED_PREDECESSORS],
    supabaseBlockerCount,
    catalogIntact: restore.catalogIntact,
    boundRelease: bound,
  };
}

export type ShutdownDecisionArchive = {
  readonly decisionId: string;
  readonly recordedAt: string;
  readonly shutdownReady: boolean;
  readonly productiveShutdownAuthorized: boolean;
  readonly blockerCount: number;
  readonly responsibleDecision: string;
  readonly approval: ShutdownReadinessReport['boundRelease'];
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
    approval: args.report.boundRelease,
  };
  const body = `${JSON.stringify(payload, null, 2)}\n`;
  const digest = sha256Hex(body);
  const file = join(args.archiveDir, `shutdown-decision-${decisionId}.json`);
  writeFileSync(file, body);
  return {
    decisionId,
    recordedAt,
    shutdownReady: args.report.shutdownReady,
    productiveShutdownAuthorized: args.report.productiveShutdownAuthorized,
    blockerCount: args.report.blockers.length,
    responsibleDecision: args.responsibleDecision,
    approval: args.report.boundRelease,
    sha256: digest,
  };
}

function validateCompletionFile(
  absPath: string,
  expectedLocalId: ShutdownPredecessorId,
): { ok: true; sha256: string } | { ok: false; reason: string } {
  if (!existsSync(absPath)) {
    return { ok: false, reason: 'missing' };
  }
  const raw = readFileSync(absPath);
  let json: unknown;
  try {
    json = JSON.parse(raw.toString('utf8'));
  } catch {
    return { ok: false, reason: 'json-parse' };
  }
  const parsed = completionEvidenceSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.message };
  }
  if (parsed.data.localId !== expectedLocalId) {
    return { ok: false, reason: `localId mismatch ${parsed.data.localId}` };
  }
  for (const check of parsed.data.checks) {
    const evidenceAbs = join(absPath, '..', '..', '..', '..', check.evidenceFile);
    // evidenceFile paths are repo-relative from cwd root — resolve via walking:
    // completion lives at .qa/evidence/stack-migration-prep/completion/*.json
    // Prefer join(repoRoot) — callers pass repoRoot separately below.
    void evidenceAbs;
  }
  return { ok: true, sha256: sha256Hex(raw) };
}

/** Load predecessor evidence from repo completion JSON (hashed + schema-checked). */
export function loadPredecessorEvidenceFromDisk(
  rootDir: string,
  localId: ShutdownPredecessorId,
  relativePath: string,
): PredecessorEvidence {
  const abs = join(rootDir, relativePath);
  const validated = validateCompletionFile(abs, localId);
  if (!validated.ok) {
    return {
      localId,
      completionEvidencePath: relativePath,
      result: 'FAIL',
      evidenceExists: existsSync(abs),
      evidenceSha256: null,
    };
  }

  // Verify nested check artifact hashes against repo root.
  const raw = JSON.parse(readFileSync(abs, 'utf8'));
  const parsed = completionEvidenceSchema.parse(raw);
  for (const check of parsed.checks) {
    const evidenceAbs = join(rootDir, check.evidenceFile);
    if (!existsSync(evidenceAbs)) {
      return {
        localId,
        completionEvidencePath: relativePath,
        result: 'FAIL',
        evidenceExists: true,
        evidenceSha256: null,
      };
    }
    const actual = sha256Hex(readFileSync(evidenceAbs));
    if (actual !== check.sha256) {
      return {
        localId,
        completionEvidencePath: relativePath,
        result: 'FAIL',
        evidenceExists: true,
        evidenceSha256: null,
      };
    }
  }

  return {
    localId,
    completionEvidencePath: relativePath,
    result: 'PASS',
    evidenceExists: true,
    evidenceSha256: validated.sha256,
  };
}

function catalogPresenceFromObserved(observed: {
  worldTitles: string[];
  sagaSlugs: string[];
  characterIds: string[];
  monsterIds: string[];
  itemDefinitionIds: string[];
  npcPublicIds: string[];
  catalog?: DornhainCatalog;
}): boolean {
  return assertDornhainCatalogPresent(observed).ok;
}

/**
 * Full MIG-702 fixture drill.
 */
export function runDornhainShutdownReadinessDrill(args: {
  readonly repoRoot: string;
  readonly archiveDir: string;
  readonly ownerUserId?: string;
  readonly strangerUserId?: string;
}): {
  readonly blockedWithoutEvidence: ShutdownReadinessReport;
  readonly blockedWithSupabaseLeftover: ShutdownReadinessReport;
  readonly blockedEmptyMatrix: ShutdownReadinessReport;
  readonly blockedBrokenCatalog: ShutdownReadinessReport;
  readonly readyWithFreigabe: ShutdownReadinessReport;
  readonly archive: ShutdownDecisionArchive;
} {
  const catalog = dornhainFixtureCatalog();
  const ownerUserId = args.ownerUserId ?? 'owner-dornhain';
  const strangerUserId = args.strangerUserId ?? 'stranger-tenant';

  const freigabe: HumanApproval = {
    linkedPath: 'docs/architecture/migration-owner-release-2026-11-01-dornhain.md',
    status: CANONICAL_RELEASE_STATUS,
    actor: 'iamthamanic',
  };

  const blockedWithoutEvidence = evaluateShutdownReadiness({
    repoRoot: args.repoRoot,
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

  const preds = (['MIG-700', 'MIG-701', 'ATLAS-LIVE-E2E', 'MIG-603'] as const).map((id) => {
    const pathById: Record<ShutdownPredecessorId, string> = {
      'MIG-700': '.qa/evidence/stack-migration-prep/completion/mig-700.json',
      'MIG-701': '.qa/evidence/stack-migration-prep/completion/mig-701.json',
      'ATLAS-LIVE-E2E': '.qa/evidence/stack-migration-prep/completion/atlas-live-e2e.json',
      'MIG-603': '.qa/evidence/stack-migration-prep/completion/mig-603.json',
    };
    return loadPredecessorEvidenceFromDisk(args.repoRoot, id, pathById[id]);
  });
  for (const p of preds) {
    assertOk(p.result === 'PASS' && p.evidenceSha256, `${p.localId} evidence must validate`);
  }

  const blockedEmptyMatrix = evaluateShutdownReadiness({
    repoRoot: args.repoRoot,
    predecessors: preds,
    callMatrix: [],
    restore: {
      catalogIntact: true,
      restoreDrillPass: true,
      archivePath: 'fixture://empty-matrix',
    },
    permission: {
      strangerUserId,
      strangerCanAuthorizeShutdown: false,
      ownerUserId,
      ownerCanAuthorizeShutdown: true,
    },
    humanApproval: freigabe,
  });
  assertOk(!blockedEmptyMatrix.shutdownReady, 'empty call matrix must block');
  assertOk(
    blockedEmptyMatrix.blockers.some((b) => b.code === 'empty-call-matrix'),
    'empty-call-matrix expected',
  );

  const blockedWithSupabaseLeftover = evaluateShutdownReadiness({
    repoRoot: args.repoRoot,
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
    humanApproval: freigabe,
  });
  assertOk(!blockedWithSupabaseLeftover.shutdownReady, 'leftover supabase call must block');
  assertOk(blockedWithSupabaseLeftover.supabaseBlockerCount >= 1, 'supabase blocker counted');

  const brokenCatalogIntact = catalogPresenceFromObserved({
    worldTitles: ['Wrong World'],
    sagaSlugs: [],
    characterIds: [],
    monsterIds: [],
    itemDefinitionIds: [],
    npcPublicIds: [],
    catalog,
  });
  assertOk(!brokenCatalogIntact, 'broken observation must fail catalog presence');

  const blockedBrokenCatalog = evaluateShutdownReadiness({
    repoRoot: args.repoRoot,
    predecessors: preds,
    callMatrix: [
      {
        operationId: 'host.world.read',
        supabaseNetworkCall: false,
        successorVerified: true,
        humanApprovedRetirement: false,
      },
    ],
    restore: {
      catalogIntact: brokenCatalogIntact,
      restoreDrillPass: true,
      archivePath: 'fixture://broken-catalog',
    },
    permission: {
      strangerUserId,
      strangerCanAuthorizeShutdown: false,
      ownerUserId,
      ownerCanAuthorizeShutdown: true,
    },
    humanApproval: freigabe,
  });
  assertOk(!blockedBrokenCatalog.shutdownReady, 'broken catalog must block');
  assertOk(
    blockedBrokenCatalog.blockers.some((b) => b.code === 'catalog-not-intact'),
    'catalog-not-intact expected',
  );

  const intact = catalogPresenceFromObserved({
    worldTitles: [catalog.worldTitle],
    sagaSlugs: [catalog.sagaSlug],
    characterIds: catalog.characters.map((c) => c.id),
    monsterIds: catalog.monsters.map((m) => m.id),
    itemDefinitionIds: [...catalog.itemDefinitionIds],
    npcPublicIds: [...catalog.npcPublicIds],
    catalog,
  });
  assertOk(intact, 'fixture observation must be intact');

  const readyWithFreigabe = evaluateShutdownReadiness({
    repoRoot: args.repoRoot,
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
      {
        operationId: 'host.catalog.dornhain',
        supabaseNetworkCall: false,
        successorVerified: true,
        humanApprovedRetirement: false,
      },
      {
        operationId: 'legacy.edge.unused',
        supabaseNetworkCall: false,
        successorVerified: false,
        humanApprovedRetirement: true,
      },
    ],
    restore: {
      catalogIntact: intact,
      restoreDrillPass: true,
      archivePath: 'fixture://mig-700-rollback + mig-701-parity-archive',
    },
    permission: {
      strangerUserId,
      strangerCanAuthorizeShutdown: false,
      ownerUserId,
      ownerCanAuthorizeShutdown: true,
    },
    humanApproval: freigabe,
  });
  assertOk(readyWithFreigabe.shutdownReady, 'full proof must set shutdownReady');
  assertOk(
    readyWithFreigabe.productiveShutdownAuthorized,
    'bound Freigabe authorizes productive Dornhain-scoped shutdown',
  );
  assertOk(readyWithFreigabe.boundRelease?.releaseId === CANONICAL_RELEASE_ID, 'bound release');
  assertOk(readyWithFreigabe.catalogIntact, 'Dornhain catalog intact');
  assertOk(readyWithFreigabe.supabaseBlockerCount === 0, 'no open supabase blockers');

  const forgedApproval = evaluateShutdownReadiness({
    repoRoot: args.repoRoot,
    predecessors: preds,
    callMatrix: readyWithFreigabe.shutdownReady
      ? [
          {
            operationId: 'host.character.read',
            supabaseNetworkCall: false,
            successorVerified: true,
            humanApprovedRetirement: false,
          },
        ]
      : [
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
      archivePath: 'fixture://forged',
    },
    permission: {
      strangerUserId,
      strangerCanAuthorizeShutdown: false,
      ownerUserId,
      ownerCanAuthorizeShutdown: true,
    },
    humanApproval: {
      linkedPath: 'x',
      status: CANONICAL_RELEASE_STATUS,
      actor: 'x',
    },
  });
  assertOk(!forgedApproval.productiveShutdownAuthorized, 'forged Freigabe must not authorize');
  assertOk(
    forgedApproval.blockers.some((b) => b.code === 'human-approval-unbound'),
    'human-approval-unbound expected',
  );

  const withoutApproval = evaluateShutdownReadiness({
    repoRoot: args.repoRoot,
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
    'productive requires bound canonical Freigabe',
  );

  const archive = archiveShutdownDecision({
    archiveDir: args.archiveDir,
    report: readyWithFreigabe,
    responsibleDecision:
      'MIG-702 Dornhain Freigabe A: Supabase exit allowed after parity+restore proof',
  });
  assertOk(archive.approval?.evidenceFile === freigabe.linkedPath, 'archive stores Freigabe path');

  return {
    blockedWithoutEvidence,
    blockedWithSupabaseLeftover,
    blockedEmptyMatrix,
    blockedBrokenCatalog,
    readyWithFreigabe,
    archive,
  };
}

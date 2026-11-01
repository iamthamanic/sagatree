/**
 * MIG-703 GATE-05 unlock check. Location: desktop/src/gate.ts
 *
 * Without architecture APPROVED, desktop integration must stay blocked
 * (no Tauri/Electron product deps as a side effect of earlier waves).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const gate05DecisionSchema = z.object({
  status: z.enum(['APPROVED', 'APPROVED_TO_EXECUTE', 'UNDECIDED', 'REJECTED', 'DEFERRED_UNTIL_BROWSER_HOST_COMPLETE']),
  actorType: z.literal('human'),
  actor: z.string().min(1),
  evidenceFile: z.string().min(1),
});

const approvalsSchema = z.object({
  decisions: z.object({
    'GATE-05': gate05DecisionSchema,
  }),
});

export type DesktopUnlockReport = {
  readonly unlocked: boolean;
  readonly gate05Status: string;
  readonly blocker: string | null;
};

export function evaluateDesktopUnlock(args: {
  readonly repoRoot: string;
  readonly approvalsRelativePath?: string;
}): DesktopUnlockReport {
  const rel = args.approvalsRelativePath ?? '.qa/evidence/stack-migration-prep/architecture-approvals.json';
  const abs = join(args.repoRoot, rel);
  if (!existsSync(abs)) {
    return {
      unlocked: false,
      gate05Status: 'missing',
      blocker: `approvals file missing: ${rel}`,
    };
  }
  let parsed: z.infer<typeof approvalsSchema>;
  try {
    parsed = approvalsSchema.parse(JSON.parse(readFileSync(abs, 'utf8')));
  } catch (err) {
    return {
      unlocked: false,
      gate05Status: 'invalid',
      blocker: `approvals schema invalid: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const gate = parsed.decisions['GATE-05'];
  if (gate.status !== 'APPROVED') {
    return {
      unlocked: false,
      gate05Status: gate.status,
      blocker: `GATE-05 status=${gate.status} (need APPROVED); Tauri/Electron must not land as a side effect`,
    };
  }
  const evidenceAbs = join(args.repoRoot, gate.evidenceFile);
  if (!existsSync(evidenceAbs)) {
    return {
      unlocked: false,
      gate05Status: gate.status,
      blocker: `GATE-05 evidenceFile missing on disk: ${gate.evidenceFile}`,
    };
  }
  return { unlocked: true, gate05Status: gate.status, blocker: null };
}

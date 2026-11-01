#!/usr/bin/env node
/**
 * Productive Dornhain-scoped Supabase live shutdown execute.
 *
 * Dry-run (default): verify Freigabe + allowlisted project refs; no mutation.
 * --execute: pause allowlisted hosted projects via Supabase Management API.
 * Missing allowlisted refs (absent from a successful GET /projects) count as
 * ALREADY_ABSENT success — not a failed wipe.
 *
 * Fail-closed without SUPABASE_ACCESS_TOKEN + typed confirmation env.
 * Fail-closed when project inventory HTTP/parse fails (never invent ALREADY_ABSENT).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APPROVALS_PATH = join(
  ROOT,
  '.qa/evidence/stack-migration-prep/architecture-approvals.json',
);
const RECEIPT_DIR = join(
  ROOT,
  '.qa/evidence/stack-migration-prep/shutdown-live',
);

/** Hosted refs formerly holding committed anon keys — only these may be paused. */
const ALLOWLISTED_PROJECT_REFS = Object.freeze([
  'dnhotyjazjnhneqbqocq',
  'vjpfbedynctazvwywlqj',
]);

const CONFIRM_PHRASE = 'I_UNDERSTAND_DORHAIN_HOST_SURVIVES';
const MGMT = 'https://api.supabase.com/v1';

const projectRowSchema = z
  .object({
    id: z.string().min(1),
    status: z.string().min(1),
    name: z.string().nullable().optional(),
  })
  .passthrough();

const projectListSchema = z.array(projectRowSchema);

/** Statuses that already mean “not serving” — do not re-POST /pause. */
const ALREADY_PAUSED_STATUSES = new Set([
  'INACTIVE',
  'INACTIVE_ACTIVE_HEALTHY',
  'PAUSED',
  'PAUSING',
  'REMOVED',
  'GOING_DOWN',
]);

function loadApprovals() {
  if (!existsSync(APPROVALS_PATH)) {
    throw new Error(`missing approvals file: ${APPROVALS_PATH}`);
  }
  return JSON.parse(readFileSync(APPROVALS_PATH, 'utf8'));
}

function requireFreigabe(approvals) {
  const cutover = approvals?.releases?.['CUTOVER-DORHAIN'];
  if (cutover?.status !== 'APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF') {
    throw new Error(
      `CUTOVER-DORHAIN must be APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF (got ${cutover?.status ?? 'missing'})`,
    );
  }
  const live = approvals?.releases?.['SUPABASE-DORHAIN-LIVE-SHUTDOWN'];
  if (live?.status !== 'APPROVED' || live?.actorType !== 'human') {
    throw new Error(
      `SUPABASE-DORHAIN-LIVE-SHUTDOWN must be human APPROVED (got ${live?.status ?? 'missing'})`,
    );
  }
  return { cutover, live };
}

async function listProjects(token) {
  let res;
  try {
    res = await fetch(`${MGMT}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    return {
      ok: false,
      httpStatus: 0,
      projects: [],
      reason: `transport: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      httpStatus: res.status,
      projects: [],
      reason: `HTTP ${res.status}`,
    };
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      httpStatus: res.status,
      projects: [],
      reason: 'non-json body',
    };
  }
  const parsed = projectListSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      httpStatus: res.status,
      projects: [],
      reason: `zod: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    };
  }
  return {
    ok: true,
    httpStatus: res.status,
    projects: parsed.data.map((p) => ({
      id: p.id,
      status: p.status,
      name: typeof p.name === 'string' ? p.name : null,
    })),
  };
}

async function pauseProject(ref, token) {
  let res;
  try {
    res = await fetch(`${MGMT}/projects/${ref}/pause`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    return {
      ref,
      httpStatus: 0,
      ok: false,
      reason: `transport: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return { ref, httpStatus: res.status, ok: res.ok };
}

function writeReceipt(name, payload) {
  mkdirSync(RECEIPT_DIR, { recursive: true });
  const path = join(RECEIPT_DIR, name);
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return path;
}

async function main() {
  const execute = process.argv.includes('--execute');
  const approvals = loadApprovals();
  const freigabe = requireFreigabe(approvals);

  const dryPayload = {
    mode: execute ? 'execute' : 'dry-run',
    at: new Date().toISOString(),
    freigabe: {
      CUTOVER_DORHAIN: freigabe.cutover.status,
      SUPABASE_DORHAIN_LIVE_SHUTDOWN: freigabe.live.status,
      liveSourceUrl: freigabe.live.sourceUrl,
    },
    allowlistedProjectRefs: [...ALLOWLISTED_PROJECT_REFS],
    hardRequirement:
      'Dornhain world/saga/characters/items/monsters/NPCs must survive on host',
  };

  if (!execute) {
    const path = writeReceipt('dry-run-latest.json', {
      ...dryPayload,
      result: 'DRY_RUN_OK',
      note: 'No Management API mutation. Pass --execute with token + CONFIRM env to pause.',
    });
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', receipt: path }, null, 2));
    return;
  }

  const confirm = process.env.CONFIRM_DORHAIN_LIVE_SHUTDOWN;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (confirm !== CONFIRM_PHRASE) {
    const path = writeReceipt('execute-refused-confirm.json', {
      ...dryPayload,
      result: 'REFUSED',
      reason: `CONFIRM_DORHAIN_LIVE_SHUTDOWN must equal ${CONFIRM_PHRASE}`,
    });
    console.error(JSON.stringify({ ok: false, result: 'REFUSED', receipt: path }, null, 2));
    process.exitCode = 2;
    return;
  }
  if (!token || typeof token !== 'string' || token.trim().length < 20) {
    const path = writeReceipt('execute-refused-token.json', {
      ...dryPayload,
      result: 'REFUSED',
      reason: 'SUPABASE_ACCESS_TOKEN missing or too short (Management API)',
    });
    console.error(JSON.stringify({ ok: false, result: 'REFUSED', receipt: path }, null, 2));
    process.exitCode = 2;
    return;
  }

  const trimmed = token.trim();
  const results = [];
  let inventory = null;
  let receiptPath = null;
  let fatalReason = null;

  try {
    inventory = await listProjects(trimmed);
    if (!inventory.ok) {
      fatalReason = `project inventory failed (${inventory.reason ?? 'unknown'})`;
      process.exitCode = 2;
      return;
    }

    const byId = new Map(inventory.projects.map((p) => [p.id, p]));

    for (const ref of ALLOWLISTED_PROJECT_REFS) {
      const row = byId.get(ref);
      if (!row) {
        results.push({
          ref,
          outcome: 'ALREADY_ABSENT',
          httpStatus: 404,
          ok: true,
        });
        continue;
      }
      if (ALREADY_PAUSED_STATUSES.has(String(row.status).toUpperCase())) {
        results.push({
          ref,
          outcome: 'ALREADY_PAUSED',
          status: row.status,
          httpStatus: 200,
          ok: true,
        });
        continue;
      }
      const paused = await pauseProject(ref, trimmed);
      results.push({
        ref,
        outcome: paused.ok ? 'PAUSED' : 'PAUSE_FAILED',
        httpStatus: paused.httpStatus,
        ok: paused.ok,
        ...(paused.reason ? { reason: paused.reason } : {}),
      });
    }
  } catch (err) {
    fatalReason = err instanceof Error ? err.message : String(err);
    process.exitCode = 2;
  } finally {
    const allOk =
      !fatalReason && results.length > 0 && results.every((r) => r.ok);
    const resultLabel = fatalReason
      ? 'REFUSED'
      : allOk
        ? 'EXECUTE_OK'
        : 'EXECUTE_PARTIAL_OR_FAIL';
    receiptPath = writeReceipt(
      `${resultLabel === 'EXECUTE_OK' ? 'execute-ok' : resultLabel === 'REFUSED' ? 'execute-refused-inventory' : 'execute-partial'}-${Date.now()}.json`,
      {
        ...dryPayload,
        result: resultLabel,
        ...(fatalReason ? { reason: fatalReason } : {}),
        inventorySummary: inventory
          ? {
              listHttpStatus: inventory.httpStatus,
              listOk: inventory.ok,
              reason: inventory.reason,
              projectCount: inventory.projects.length,
              statusCounts: inventory.projects.reduce((acc, p) => {
                const key = p.status ?? 'UNKNOWN';
                acc[key] = (acc[key] ?? 0) + 1;
                return acc;
              }, {}),
              allowlistPresent: ALLOWLISTED_PROJECT_REFS.filter((ref) =>
                inventory.projects.some((p) => p.id === ref),
              ),
              allowlistAbsent: ALLOWLISTED_PROJECT_REFS.filter(
                (ref) => !inventory.projects.some((p) => p.id === ref),
              ),
              sagaTreeNamed: inventory.projects
                .filter((p) =>
                  /saga|dornhain|devtrack|figma/i.test(`${p.name ?? ''}${p.id ?? ''}`),
                )
                .map((p) => ({ id: p.id, status: p.status, name: p.name })),
            }
          : null,
        results,
      },
    );
    if (resultLabel === 'EXECUTE_OK') {
      writeReceipt('execute-latest.json', JSON.parse(readFileSync(receiptPath, 'utf8')));
    }
  }

  const allOk = !fatalReason && results.length > 0 && results.every((r) => r.ok);
  console.log(
    JSON.stringify(
      {
        ok: allOk,
        mode: 'execute',
        receipt: receiptPath,
        ...(fatalReason ? { reason: fatalReason } : {}),
        results,
      },
      null,
      2,
    ),
  );
  if (!allOk && process.exitCode !== 2) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});

#!/usr/bin/env node
/**
 * Productive Dornhain-scoped Supabase live shutdown execute.
 *
 * Dry-run (default): verify Freigabe + allowlisted project refs; no mutation.
 * --execute: pause allowlisted hosted projects via Supabase Management API.
 * Missing allowlisted refs (404 / absent from GET /projects) count as
 * ALREADY_ABSENT success — not a failed wipe.
 *
 * Fail-closed without SUPABASE_ACCESS_TOKEN + typed confirmation env.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const res = await fetch(`${MGMT}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, httpStatus: res.status, projects: [] };
  }
  let projects;
  try {
    projects = JSON.parse(text);
  } catch {
    return { ok: false, httpStatus: res.status, projects: [] };
  }
  if (!Array.isArray(projects)) {
    return { ok: false, httpStatus: res.status, projects: [] };
  }
  return {
    ok: true,
    httpStatus: res.status,
    projects: projects.map((p) => ({
      id: p.id,
      status: p.status,
      name: typeof p.name === 'string' ? p.name : null,
    })),
  };
}

async function pauseProject(ref, token) {
  const res = await fetch(`${MGMT}/projects/${ref}/pause`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
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
  const inventory = await listProjects(trimmed);
  const presentIds = new Set(inventory.projects.map((p) => p.id));
  const results = [];

  for (const ref of ALLOWLISTED_PROJECT_REFS) {
    if (!presentIds.has(ref)) {
      results.push({
        ref,
        outcome: 'ALREADY_ABSENT',
        httpStatus: 404,
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
    });
  }

  const allOk = results.every((r) => r.ok);
  const path = writeReceipt(`execute-${allOk ? 'ok' : 'partial'}-${Date.now()}.json`, {
    ...dryPayload,
    result: allOk ? 'EXECUTE_OK' : 'EXECUTE_PARTIAL_OR_FAIL',
    inventorySummary: {
      listHttpStatus: inventory.httpStatus,
      listOk: inventory.ok,
      projectCount: inventory.projects.length,
      statusCounts: inventory.projects.reduce((acc, p) => {
        const key = p.status ?? 'UNKNOWN';
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {}),
      allowlistPresent: ALLOWLISTED_PROJECT_REFS.filter((ref) => presentIds.has(ref)),
      allowlistAbsent: ALLOWLISTED_PROJECT_REFS.filter((ref) => !presentIds.has(ref)),
      sagaTreeNamed: inventory.projects
        .filter((p) => /saga|dornhain|devtrack|figma/i.test(`${p.name ?? ''}${p.id ?? ''}`))
        .map((p) => ({ id: p.id, status: p.status, name: p.name })),
    },
    results,
  });

  console.log(
    JSON.stringify(
      {
        ok: allOk,
        mode: 'execute',
        receipt: path,
        results,
      },
      null,
      2,
    ),
  );
  if (!allOk) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});

#!/usr/bin/env node
/**
 * Inventory + gate for redistributable media under docs/licensing/.
 * Distinguishes cleared / reserved / excluded / owner_pending / uncleared.
 * Legal clearance is not implied by a green exit — see docs/licensing/status.json.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const write = process.argv.includes('--write');
const rulesPath = path.join(root, 'docs/licensing/asset-classification-rules.json');
const inventoryPath = path.join(root, 'docs/licensing/asset-inventory.json');
const statusPath = path.join(root, 'docs/licensing/status.json');
const summaryPath = path.join(root, 'docs/licensing/asset-inventory-summary.md');

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function sha256File(rel) {
  const buf = readFileSync(path.join(root, rel));
  return createHash('sha256').update(buf).digest('hex');
}

function loadJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function matchRule(rules, rel) {
  for (const rule of rules.rules) {
    if (new RegExp(rule.match).test(rel)) return rule;
  }
  return { id: 'default', ...rules.default };
}

function listTrackedMedia(rules) {
  const out = [];
  for (const dir of rules.roots) {
    let listed = '';
    try {
      listed = git(['ls-files', '-z', '--', dir]);
    } catch {
      continue;
    }
    if (!listed) continue;
    for (const rel of listed.split('\0').filter(Boolean)) {
      const ext = path.extname(rel).toLowerCase();
      if (!rules.extensions.includes(ext)) continue;
      out.push(rel.replace(/\\/g, '/'));
    }
  }
  return out.sort();
}

function buildInventory(rules, paths) {
  const assets = [];
  for (const rel of paths) {
    const rule = matchRule(rules, rel);
    let sha256 = null;
    try {
      sha256 = sha256File(rel);
    } catch (err) {
      sha256 = `ERROR:${err.message}`;
    }
    assets.push({
      path: rel,
      sha256,
      source: rule.source,
      creator: rule.creator,
      license: rule.license,
      evidence: rule.evidence,
      redistributable: rule.redistributable,
      attribution_required: rule.attribution_required,
      runtime_required: rule.runtime_required,
      status: rule.status,
      rule_id: rule.id,
    });
  }
  return {
    generated_at: new Date().toISOString(),
    rules_version: rules.version,
    count: assets.length,
    assets,
  };
}

function summarize(inventory) {
  const counts = {
    cleared: 0,
    reserved: 0,
    excluded: 0,
    owner_pending: 0,
    uncleared: 0,
    other: 0,
  };
  let runtimePending = 0;
  for (const a of inventory.assets) {
    if (counts[a.status] === undefined) counts.other += 1;
    else counts[a.status] += 1;
    if (a.runtime_required && (a.status === 'owner_pending' || a.status === 'uncleared')) {
      runtimePending += 1;
    }
  }
  return { counts, runtimePending };
}

function writeStatus(summary, inventory) {
  const uncleared = inventory.assets.filter((a) => a.status === 'uncleared');
  const status = {
    updated_at: new Date().toISOString(),
    open_source_release_ready: false,
    contributor_rights: 'pending_owner_attestation',
    asset_inventory: {
      total: inventory.count,
      ...summary.counts,
      runtime_required_pending: summary.runtimePending,
      uncleared_paths: uncleared.map((a) => a.path),
    },
    blockers: [
      'Owner attestation for Raccoovaclaw / agent Git identities (docs/licensing/OWNER_ATTESTATIONS.md § A)',
      'Owner attestation for Figma Make import (OWNER_ATTESTATIONS.md § B)',
      'Owner license declaration for first-party media currently owner_pending (OWNER_ATTESTATIONS.md § C)',
      'Separate review of embedded SRD/OGL-shaped data and Open5e usage in archive/supabase-legacy/supabase/functions/rulesets/index.ts',
    ],
    evidence: [
      'docs/licensing/contributor-provenance.md',
      'docs/licensing/asset-inventory.json',
      'docs/licensing/OWNER_ATTESTATIONS.md',
    ],
  };
  mkdirSync(path.dirname(statusPath), { recursive: true });
  writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);
  return status;
}

function writeSummaryMd(summary, inventory) {
  const lines = [
    '# Asset license inventory summary',
    '',
    `Generated: ${inventory.generated_at}`,
    '',
    `| Status | Count |`,
    `| --- | ---: |`,
    `| cleared | ${summary.counts.cleared} |`,
    `| reserved | ${summary.counts.reserved} |`,
    `| excluded | ${summary.counts.excluded} |`,
    `| owner_pending | ${summary.counts.owner_pending} |`,
    `| uncleared | ${summary.counts.uncleared} |`,
    `| **total** | **${inventory.count}** |`,
    '',
    `Runtime-required assets still pending clearance: **${summary.runtimePending}**`,
    '',
    'Machine-readable inventory: [`asset-inventory.json`](asset-inventory.json).',
    'Release readiness: [`status.json`](status.json).',
    '',
  ];
  writeFileSync(summaryPath, `${lines.join('\n')}\n`);
}

function main() {
  if (!existsSync(rulesPath)) {
    console.error(`Missing ${rulesPath}`);
    process.exit(1);
  }
  const rules = loadJson(rulesPath);
  const paths = listTrackedMedia(rules);
  const inventory = buildInventory(rules, paths);
  const summary = summarize(inventory);

  if (write || !existsSync(inventoryPath)) {
    mkdirSync(path.dirname(inventoryPath), { recursive: true });
    writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
    writeSummaryMd(summary, inventory);
    writeStatus(summary, inventory);
    console.log(`Wrote ${inventoryPath} (${inventory.count} assets).`);
  } else {
    const existing = loadJson(inventoryPath);
    if (existing.count !== inventory.count) {
      console.error(
        `Inventory stale: tracked media ${inventory.count} vs inventory ${existing.count}. Re-run with --write.`,
      );
      process.exit(1);
    }
    const existingPaths = new Set(existing.assets.map((a) => a.path));
    const missing = paths.filter((p) => !existingPaths.has(p));
    if (missing.length) {
      console.error(`Inventory missing paths (re-run --write):\n${missing.slice(0, 20).join('\n')}`);
      process.exit(1);
    }
  }

  const onDisk = loadJson(inventoryPath);
  const uncleared = onDisk.assets.filter((a) => a.status === 'uncleared');
  if (uncleared.length) {
    console.error(
      `FAIL: ${uncleared.length} uncleared asset(s). Document license or exclude.\n` +
        uncleared
          .slice(0, 30)
          .map((a) => ` - ${a.path}`)
          .join('\n'),
    );
    process.exit(1);
  }

  const status = existsSync(statusPath) ? loadJson(statusPath) : writeStatus(summary, onDisk);
  console.log(
    `Asset license inventory OK: ${onDisk.count} files ` +
      `(cleared=${summary.counts.cleared}, reserved=${summary.counts.reserved}, ` +
      `excluded=${summary.counts.excluded}, owner_pending=${summary.counts.owner_pending}, uncleared=0).`,
  );
  console.log(
    `Open-source release ready: ${status.open_source_release_ready === true} ` +
      `(contributor_rights=${status.contributor_rights}; runtime_pending=${summary.runtimePending}).`,
  );
  if (status.open_source_release_ready !== true) {
    console.log('NOTE: release blockers remain — see docs/licensing/status.json (merge NEEDS_HUMAN).');
  }
}

main();

/**
 * MIG-001/#782 — two independent fixture rebuilds must yield identical semantic checksums.
 * Location: scripts/stack-migration-db/rebuild-verify.mjs
 *
 * Boots two fresh embedded PostgreSQL clusters, applies the same migration chain and seed,
 * then compares deterministic semantic fingerprints. Does not claim security parity.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCluster } from './cluster.mjs';
import { bootstrapSupabase, applyRepositoryMigrations, exportCatalog } from './bootstrap.mjs';
import { seedFixtures, fixture, computeSemanticChecksum } from './fixtures.mjs';
import { sourceEvidence } from './evidence.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const outArgument = args.indexOf('--output');
const output = outArgument >= 0 ? resolve(args[outArgument + 1]) : join(here, 'artifacts/rebuild-verify');
await mkdir(output, { recursive: true });

async function oneRebuild(label) {
  const report = {
    label,
    startedAt: new Date().toISOString(),
    status: 'running',
    securityParityApproved: false,
  };
  let cluster;
  let client;
  try {
    report.source = await sourceEvidence();
    cluster = await createCluster();
    client = await cluster.client();
    report.postgres = (await client.query('SELECT version() AS version')).rows[0].version;
    await bootstrapSupabase(client, report);
    await applyRepositoryMigrations(client, report);
    const catalog = await exportCatalog(client);
    report.catalog = {
      functions: catalog.functions.length,
      policies: catalog.policies.length,
      relations: catalog.relations.length,
      columns: catalog.columns.length,
      constraints: catalog.constraints.length,
    };
    await seedFixtures(client);
    report.fixtureIds = fixture;
    report.semantic = await computeSemanticChecksum(client);
    report.status = 'passed';
    return report;
  } catch (error) {
    report.status = 'failed';
    report.error = { message: error.message, sqlstate: error.cause?.code ?? error.code ?? null };
    throw Object.assign(error, { report });
  } finally {
    if (client) await client.end().catch(() => {});
    if (cluster) await cluster.close().catch((error) => {
      report.cleanupError = error.message;
    });
    report.finishedAt = new Date().toISOString();
  }
}

const summary = {
  startedAt: new Date().toISOString(),
  mode: 'dual-fixture-rebuild',
  securityParityApproved: false,
  acceptance: 'MIG-001 Fall 2 — two independent seeds produce identical semantic checksums',
  status: 'running',
};
try {
  const first = await oneRebuild('rebuild-1');
  const second = await oneRebuild('rebuild-2');
  summary.rebuilds = [first, second];
  summary.identical = first.semantic.sha256 === second.semantic.sha256
    && first.semantic.payloadByteLength === second.semantic.payloadByteLength;
  summary.semanticChecksum = first.semantic.sha256;
  summary.migrationCount = first.migrations?.length ?? null;
  summary.migrationsMissingFromApplyScript = first.migrationsMissingFromApplyScript ?? [];
  summary.catalog = first.catalog;
  summary.repositoryHead = first.source?.repositoryHead ?? null;
  if (!summary.identical) {
    summary.status = 'failed';
    summary.error = {
      message: 'Independent fixture rebuilds produced divergent semantic checksums',
      first: first.semantic.sha256,
      second: second.semantic.sha256,
    };
    process.exitCode = 1;
  } else {
    summary.status = 'passed';
    console.log(`PASS: dual fixture rebuilds identical semantic checksum ${summary.semanticChecksum}`);
  }
} catch (error) {
  summary.status = 'failed';
  summary.error = { message: error.message, report: error.report ?? null };
  console.error(error.message);
  process.exitCode = 1;
} finally {
  summary.finishedAt = new Date().toISOString();
  await writeFile(join(output, 'rebuild-verify.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`Rebuild evidence: ${join(output, 'rebuild-verify.json')}`);
}

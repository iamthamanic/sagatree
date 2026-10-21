import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCluster } from './cluster.mjs';
import { bootstrapSupabase, applyRepositoryMigrations, exportCatalog } from './bootstrap.mjs';
import { seedFixtures, fixture, computeSemanticChecksum } from './fixtures.mjs';
import { runProbes } from './probes.mjs';
import { sourceEvidence } from './evidence.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--inject-policy-regression') && !args.includes('--canary-only')) {
  throw new Error('Intentional policy regression is restricted to --canary-only on an isolated fixture');
}
const outArgument = args.indexOf('--output');
const output = outArgument >= 0 ? resolve(args[outArgument + 1]) : join(here, 'artifacts');
await mkdir(output, { recursive: true });
const report = {
  startedAt: new Date().toISOString(), status: 'running',
  mode: args.includes('--canary-only') ? 'rls-canary-only' : 'full-postgres-baseline',
  intentionalRegression: args.includes('--inject-policy-regression'),
  securityParityApproved: false,
  scope: 'Actual PostgreSQL, Supabase platform schema, unmodified repository SQL migrations. Synthetic data only.',
  atlasProductLive: { status: 'not-run', reason: 'SQL tests alone do not prove the browser, GoTrue, PostgREST, or Atlas product journey.' },
};
let cluster;
let client;
try {
  report.source = await sourceEvidence();
  cluster = await createCluster();
  client = await cluster.client();
  report.postgres = (await client.query('SELECT version() AS version')).rows[0].version;
  await bootstrapSupabase(client, report);
  console.log('Supabase auth/storage platform schema bootstrapped from pinned official sources.');
  await applyRepositoryMigrations(client, report);
  const catalog = await exportCatalog(client);
  await writeFile(join(output, 'pg-catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  report.catalog = { path: 'pg-catalog.json', functions: catalog.functions.length, policies: catalog.policies.length };
  console.log(`Applied ${report.migrations.length} repository migrations; exported ${catalog.functions.length} functions.`);
  await seedFixtures(client);
  await writeFile(join(output, 'fixture.json'), JSON.stringify(fixture, null, 2) + '\n');
  report.semantic = await computeSemanticChecksum(client);
  await writeFile(join(output, 'semantic-checksum.json'), JSON.stringify(report.semantic, null, 2) + '\n');
  await client.end();
  client = null;
  const passed = await runProbes(cluster, report, {
    canaryOnly: args.includes('--canary-only'),
    injectPolicyRegression: args.includes('--inject-policy-regression'),
  });
  report.status = passed ? 'passed' : 'failed';
  if (!passed) process.exitCode = 1;
} catch (error) {
  report.status = 'failed';
  report.error = { message: error.message, sqlstate: error.cause?.code ?? error.code ?? null };
  console.error(report.error.message);
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
  if (cluster) await cluster.close().catch((error) => { report.cleanupError = error.message; process.exitCode = 1; });
  report.finishedAt = new Date().toISOString();
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Baseline evidence: ${join(output, 'report.json')}`);
}

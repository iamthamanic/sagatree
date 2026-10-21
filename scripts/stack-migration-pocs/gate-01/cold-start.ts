import { performance } from 'node:perf_hooks';
import type { AdapterHandle } from './domain/contracts.js';

const variant = process.argv[2];
const file = process.argv[3];
if (!file || (variant !== 'drizzle' && variant !== 'zenstack')) throw new Error('Expected variant and SQLite file');
const started = performance.now();
const module: { createAdapter(file: string): AdapterHandle } = variant === 'drizzle'
  ? await import('./drizzle/adapter.js') : await import('./zenstack/adapter.js');
const imported = performance.now();
const handle = module.createAdapter(file);
const rows = await handle.app.listMaps({ actor: { userId: 'P1' }, sagaId: 'A' });
const completed = performance.now();
await handle.close();
process.stdout.write(JSON.stringify({
  variant, importMs: imported - started, openAndFirstAuthorizedReadMs: completed - imported,
  totalInsideProcessMs: completed - started, ids: rows.map((row) => row.id),
}) + '\n');

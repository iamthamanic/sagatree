import assert from 'node:assert/strict';
import SQLite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { openPolicyClient } from './zenstack/engine.js';
import { freshFixture, inspectFixture } from './fixture.js';

function reason(error: unknown): unknown {
  return error !== null && typeof error === 'object' && 'reason' in error ? error.reason : undefined;
}
async function rejected(action: () => PromiseLike<unknown>) {
  try { await action(); } catch (error) {
    assert.ok(['not-found', 'rejected-by-policy'].includes(String(reason(error))), String(error));
    return { reason: reason(error), message: error instanceof Error ? error.message : String(error) };
  }
  throw new Error('Expected the real policy engine to reject this operation');
}

export async function zenstackEngineProbes(file: string) {
  freshFixture(file);
  const before = inspectFixture(file);
  const engine = openPolicyClient(file);
  try {
    const p1 = engine.forContext({ actor: { userId: 'P1' }, sagaId: 'A' });
    const gm = engine.forContext({ actor: { userId: 'G' }, sagaId: 'A' });
    const outsider = engine.forContext({ actor: { userId: 'X' }, sagaId: 'A' });
    const anonymous = engine.forContext({ actor: undefined, sagaId: 'A' });
    const owner = engine.forContext({ actor: { userId: 'O' }, sagaId: 'A' });
    const directRows = await p1.map.findMany({ orderBy: { id: 'asc' } });
    assert.deepEqual(directRows.map((row) => row.id), ['p1', 'public']);
    assert.ok(directRows.every((row) => row.gmNotes === null));
    const queryBuilderRows = await p1.$qb.selectFrom('Map').selectAll().orderBy('id').execute();
    assert.deepEqual(queryBuilderRows.map((row) => row.id), ['p1', 'public']);
    assert.ok(queryBuilderRows.every((row) => row.gmNotes === null));
    const gmWrite = await rejected(() => gm.map.update({ where: { id: 'public' }, data: { title: 'GM_BYPASS' } }));
    const forgedWorldWrite = await rejected(() => owner.map.update({ where: { id: 'public' }, data: { worldId: 'W2' } }));
    const rawRead = await rejected(() => outsider.$queryRawUnsafe('SELECT * FROM maps'));
    const rawWrite = await rejected(() => outsider.$executeRawUnsafe("UPDATE maps SET title='RAW_BYPASS' WHERE id='hidden'"));
    const anonymousRows = await anonymous.map.findMany();
    assert.deepEqual(anonymousRows, []);
    assert.deepEqual(inspectFixture(file), before);
    return { directRows, queryBuilderRows, gmWrite, forgedWorldWrite, rawRead, rawWrite, anonymousRows,
      source: 'Actual @zenstackhq/plugin-policy 3.9.8, generated schema, no application PolicyService involved' };
  } finally { await engine.close(); }
}

export function drizzleRawCapabilityProbe(file: string) {
  freshFixture(file);
  const sqlite = new SQLite(file);
  const db = drizzle(sqlite);
  const before = inspectFixture(file);
  try {
    const rows = db.all(sql`SELECT id, title FROM maps ORDER BY id`);
    assert.equal(rows.length, 6);
    const rollback = new Error('ROLLBACK_CAPABILITY_PROBE');
    let rowsChanged = 0;
    try {
      db.transaction((tx) => {
        rowsChanged = tx.run(sql`UPDATE maps SET title='RAW_BYPASS' WHERE id='hidden'`).changes;
        throw rollback;
      });
    } catch (error) { assert.equal(error, rollback); }
    assert.equal(rowsChanged, 1);
    assert.deepEqual(inspectFixture(file), before);
    return {
      observedRawRows: rows, rawWriteRowsInsideRolledBackTransaction: rowsChanged,
      enforcement: 'The real raw Drizzle client has no access policy; application facade/import boundary must prevent this capability from entering app code.',
      applicationAccess: 'Test-only composition-root probe; not exported by ApplicationPort',
    };
  } finally { sqlite.close(); }
}

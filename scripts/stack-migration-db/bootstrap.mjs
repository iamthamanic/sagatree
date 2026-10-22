import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const repository = join(here, '../..');
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export async function bootstrapSupabase(client, report) {
  report.platformSources = [];
  for (const bundle of ['supabase-bootstrap', 'gotrue-migrations', 'storage-migrations']) {
    const source = JSON.parse(await readFile(join(here, 'vendor', `${bundle}.json`), 'utf8'));
    const entry = { bundle, repository: source.repository, ref: source.ref, commit: source.commit, applied: [] };
    report.platformSources.push(entry);
    for (const file of source.files) {
      if (sha256(file.sql) !== file.sha256) throw new Error(`Vendored source checksum mismatch: ${bundle}/${file.path}`);
      const sql = file.sql.replace(/\{\{\s*index\s+\.Options\s+"Namespace"\s*\}\}/g, 'auth');
      if (/\{\{/.test(sql)) throw new Error(`Unresolved upstream migration template: ${file.path}`);
      try {
        await client.query(sql);
        if (bundle === 'gotrue-migrations') {
          const version = file.path.split('/').at(-1).split('_')[0];
          await client.query('INSERT INTO auth.schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING', [version]);
        }
        entry.applied.push({ path: file.path, sha256: file.sha256 });
      } catch (error) {
        error.message = `${bundle}/${file.path}: ${error.message}`;
        throw error;
      }
    }
    // ALTER ROLE SET applies on reconnect; keep this migration connection in
    // the same official extension search path from Supabase's post-setup SQL.
    await client.query('SET search_path TO public, extensions');
  }
}

export async function applyRepositoryMigrations(client, report) {
  const directory = join(repository, 'supabase/migrations');
  const files = (await readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  const applyScript = await readFile(join(repository, 'scripts/apply-migrations.sh'), 'utf8');
  const scripted = [...applyScript.matchAll(/^\s+(\d+[^\s]+\.sql)\s*$/gm)].map((match) => match[1]);
  report.migrationOrder = 'All supabase/migrations/*.sql in lexicographic filename order';
  report.migrationsMissingFromApplyScript = files.filter((name) => !scripted.includes(name));
  report.migrations = [];
  for (const name of files) {
    const sql = await readFile(join(directory, name), 'utf8');
    const row = { path: `supabase/migrations/${name}`, sha256: sha256(sql), status: 'running' };
    report.migrations.push(row);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      row.status = 'passed';
    } catch (error) {
      await client.query('ROLLBACK');
      row.status = 'failed';
      row.sqlstate = error.code;
      row.message = error.message;
      row.detail = error.detail ?? null;
      row.where = error.where ?? null;
      row.position = error.position ?? null;
      throw new Error(`${row.path} failed (${error.code}): ${error.message}`, { cause: error });
    }
  }
}

export async function exportCatalog(client) {
  const functions = await client.query(`
    SELECT p.oid::integer AS oid, n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS identity_arguments,
           pg_get_function_arguments(p.oid) AS arguments,
           pg_get_function_result(p.oid) AS result,
           pg_get_functiondef(p.oid) AS definition,
           p.proargnames, p.pronargdefaults, p.prosecdef AS security_definer,
           p.provolatile AS volatility, p.proconfig AS settings,
           p.proacl::text AS acl, pg_get_userbyid(p.proowner) AS owner,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind IN ('f','p')
    ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
  `);
  const policies = await client.query('SELECT * FROM pg_policies WHERE schemaname IN (\'public\',\'storage\') ORDER BY schemaname, tablename, policyname');
  const relations = await client.query(`SELECT n.nspname AS schema, c.relname AS name, c.relrowsecurity AS rls,
    c.relforcerowsecurity AS force_rls, c.relacl::text AS acl
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p') ORDER BY n.nspname,c.relname`);
  const columns = await client.query(`SELECT n.nspname AS schema, c.relname AS relation,
    a.attnum AS ordinal, a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type,
    a.attnotnull AS not_null, pg_get_expr(d.adbin,d.adrelid) AS default_expression,
    a.attgenerated AS generated, a.attidentity AS identity
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY c.relname,a.attnum`);
  const constraints = await client.query(`SELECT n.nspname AS schema, c.relname AS relation,
    con.conname AS name, con.contype AS type, pg_get_constraintdef(con.oid) AS definition,
    con.conrelid::regclass::text AS relation_id, con.confrelid::regclass::text AS referenced_relation,
    con.condeferrable AS deferrable, con.condeferred AS initially_deferred, con.convalidated AS validated
    FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' ORDER BY c.relname,con.conname`);
  return { functions: functions.rows, policies: policies.rows, relations: relations.rows,
    columns: columns.rows, constraints: constraints.rows };
}

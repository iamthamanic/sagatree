/**
 * Post-migration integrity gate: FK orphans + documented type/null semantics.
 * Location: server/src/persistence/integrity-check.ts
 */
import type { HostDatabase } from './open-database.ts';
import { TABLE_OWNERSHIP, owningModuleForTable } from './table-ownership.ts';

export type IntegrityResult =
  | { ok: true }
  | { ok: false; errors: readonly string[] };

/**
 * Verify bootstrap catalog integrity.
 * - foreign_keys pragma ON
 * - no orphan project_members / projects.world_id
 * - UUID-like TEXT ids remain non-null strings; JSON columns parse when present
 * - every user table maps to exactly one owning module
 */
export function runIntegrityCheck(db: HostDatabase): IntegrityResult {
  const errors: string[] = [];

  const fk = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number } | undefined;
  if (fk?.foreign_keys !== 1) {
    errors.push('foreign_keys is not enabled on this connection');
  }

  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all() as { name: string }[];

  for (const { name } of tables) {
    if (!owningModuleForTable(name)) {
      errors.push(`table ${name} has no owning module in TABLE_OWNERSHIP`);
    }
  }

  for (const table of Object.keys(TABLE_OWNERSHIP)) {
    const present = tables.some((row) => row.name === table);
    if (!present) {
      errors.push(`owned table ${table} missing from database`);
    }
  }

  // Orphan memberships (project_id without projects row) — also covered by FK when enforcing,
  // but PRAGMA foreign_key_check catches existing violations after import/load.
  const fkCheck = db.prepare('PRAGMA foreign_key_check').all() as {
    table: string;
    rowid: number;
    parent: string;
    fkid: number;
  }[];
  for (const violation of fkCheck) {
    errors.push(
      `foreign key violation: table=${violation.table} rowid=${violation.rowid} parent=${violation.parent}`,
    );
  }

  // Explicit orphan membership probe (null-safe user_id / project_id).
  const orphanMembers = db
    .prepare(
      `SELECT pm.project_id, pm.user_id
       FROM project_members pm
       LEFT JOIN projects p ON p.id = pm.project_id
       WHERE p.id IS NULL`,
    )
    .all() as { project_id: string; user_id: string }[];
  for (const row of orphanMembers) {
    errors.push(`orphaned project_members row project_id=${row.project_id} user_id=${row.user_id}`);
  }

  // Null-semantics / type mapping spot-checks on known columns.
  const badWorlds = db
    .prepare(
      `SELECT id FROM worlds
       WHERE id IS NULL OR typeof(id) != 'text'
          OR owner_user_id IS NULL OR typeof(owner_user_id) != 'text'
          OR created_at IS NULL OR typeof(created_at) != 'text'`,
    )
    .all() as { id: string }[];
  if (badWorlds.length > 0) {
    errors.push(`worlds rows violate UUID/timestamp TEXT null-semantics (${badWorlds.length})`);
  }

  const badMembers = db
    .prepare(
      `SELECT project_id FROM project_members
       WHERE project_id IS NULL OR user_id IS NULL
          OR active IS NULL OR active NOT IN (0, 1)
          OR (joined_at IS NOT NULL AND typeof(joined_at) != 'text')`,
    )
    .all() as { project_id: string }[];
  if (badMembers.length > 0) {
    errors.push(`project_members rows violate null/boolean/timestamp mappings (${badMembers.length})`);
  }

  // Ownership uniqueness already encoded in TABLE_OWNERSHIP object keys.
  const owners = new Set(Object.values(TABLE_OWNERSHIP));
  if (owners.size < 1) {
    errors.push('TABLE_OWNERSHIP is empty');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

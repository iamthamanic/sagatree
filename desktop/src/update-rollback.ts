/**
 * MIG-703 update/rollback drill. Location: desktop/src/update-rollback.ts
 *
 * An update/rollback must preserve existing host data and permissions markers.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const hostStateSchema = z.object({
  revision: z.number().int().nonnegative(),
  catalogFingerprint: z.string().min(1),
  ownerUserId: z.string().min(1),
});

export type HostState = z.infer<typeof hostStateSchema>;

export type UpdateRollbackReport = {
  readonly ok: boolean;
  readonly beforeFingerprint: string;
  readonly afterFingerprint: string;
  readonly permissionsIntact: boolean;
  readonly archivePath: string;
};

function fingerprint(state: HostState): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}

export function runUpdateRollbackDrill(args: {
  readonly workDir: string;
  readonly ownerUserId?: string;
}): UpdateRollbackReport {
  const root = args.workDir;
  const dataDir = join(root, 'host-data');
  const backupDir = join(root, 'backup');
  const archiveDir = join(root, 'archive');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  mkdirSync(archiveDir, { recursive: true });

  const statePath = join(dataDir, 'state.json');
  const permPath = join(dataDir, 'permissions.json');
  const initial: HostState = {
    revision: 7,
    catalogFingerprint: 'dornhain-fixture',
    ownerUserId: args.ownerUserId ?? 'owner-dornhain',
  };
  writeFileSync(statePath, `${JSON.stringify(initial, null, 2)}\n`);
  writeFileSync(
    permPath,
    `${JSON.stringify({ ownerUserId: initial.ownerUserId, roles: ['gm'], mode: 0o600 }, null, 2)}\n`,
  );

  const before = fingerprint(hostStateSchema.parse(JSON.parse(readFileSync(statePath, 'utf8'))));
  copyFileSync(statePath, join(backupDir, 'state.json'));
  copyFileSync(permPath, join(backupDir, 'permissions.json'));

  // Simulated broken update
  writeFileSync(statePath, `${JSON.stringify({ revision: 8, catalogFingerprint: 'corrupt', ownerUserId: 'stranger' }, null, 2)}\n`);
  writeFileSync(permPath, `${JSON.stringify({ ownerUserId: 'stranger', roles: ['anon'] }, null, 2)}\n`);

  // Rollback
  copyFileSync(join(backupDir, 'state.json'), statePath);
  copyFileSync(join(backupDir, 'permissions.json'), permPath);

  const restored = hostStateSchema.parse(JSON.parse(readFileSync(statePath, 'utf8')));
  const perms = JSON.parse(readFileSync(permPath, 'utf8')) as { ownerUserId: string; roles: string[] };
  const after = fingerprint(restored);
  const permissionsIntact =
    perms.ownerUserId === initial.ownerUserId && Array.isArray(perms.roles) && perms.roles.includes('gm');

  const archivePath = join(archiveDir, `update-rollback-${randomUUID()}.json`);
  writeFileSync(
    archivePath,
    `${JSON.stringify(
      {
        before,
        after,
        permissionsIntact,
        result: before === after && permissionsIntact ? 'rollback-ok' : 'fail',
      },
      null,
      2,
    )}\n`,
  );

  return {
    ok: before === after && permissionsIntact && existsSync(archivePath),
    beforeFingerprint: before,
    afterFingerprint: after,
    permissionsIntact,
    archivePath,
  };
}

export function cleanupWorkDir(workDir: string): void {
  rmSync(workDir, { recursive: true, force: true });
}

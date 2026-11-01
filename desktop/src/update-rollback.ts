/**
 * MIG-703 update/rollback drill. Location: desktop/src/update-rollback.ts
 *
 * An update/rollback must preserve existing host data and permissions markers
 * (JSON owner/roles and filesystem mode bits).
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  copyFileSync,
  rmSync,
  chmodSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const hostStateSchema = z.object({
  revision: z.number().int().nonnegative(),
  catalogFingerprint: z.string().min(1),
  ownerUserId: z.string().min(1),
});

const permissionsSchema = z.object({
  ownerUserId: z.string().min(1),
  roles: z.array(z.string().min(1)).min(1),
  mode: z.number().int().positive(),
});

const archiveSchema = z.object({
  before: z.string().min(1),
  after: z.string().min(1),
  permissionsIntact: z.boolean(),
  modeIntact: z.boolean(),
  result: z.enum(['rollback-ok', 'fail']),
});

export type HostState = z.infer<typeof hostStateSchema>;

export type UpdateRollbackReport = {
  readonly ok: boolean;
  readonly beforeFingerprint: string;
  readonly afterFingerprint: string;
  readonly permissionsIntact: boolean;
  readonly modeIntact: boolean;
  readonly archivePath: string;
};

function fingerprint(state: HostState): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}

function modeOf(path: string): number {
  return statSync(path).mode & 0o777;
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
  const initialPerms = {
    ownerUserId: initial.ownerUserId,
    roles: ['gm'],
    mode: 0o600,
  };
  writeFileSync(statePath, `${JSON.stringify(initial, null, 2)}\n`);
  writeFileSync(permPath, `${JSON.stringify(initialPerms, null, 2)}\n`);
  chmodSync(statePath, 0o600);
  chmodSync(permPath, 0o600);
  const beforeModeState = modeOf(statePath);
  const beforeModePerm = modeOf(permPath);

  const before = fingerprint(hostStateSchema.parse(JSON.parse(readFileSync(statePath, 'utf8'))));
  copyFileSync(statePath, join(backupDir, 'state.json'));
  copyFileSync(permPath, join(backupDir, 'permissions.json'));

  // Simulated broken update: corrupt JSON + weaken filesystem modes
  writeFileSync(
    statePath,
    `${JSON.stringify({ revision: 8, catalogFingerprint: 'corrupt', ownerUserId: 'stranger' }, null, 2)}\n`,
  );
  writeFileSync(
    permPath,
    `${JSON.stringify({ ownerUserId: 'stranger', roles: ['anon'], mode: 0o666 }, null, 2)}\n`,
  );
  chmodSync(statePath, 0o666);
  chmodSync(permPath, 0o666);

  // Rollback content + modes
  copyFileSync(join(backupDir, 'state.json'), statePath);
  copyFileSync(join(backupDir, 'permissions.json'), permPath);
  chmodSync(statePath, beforeModeState);
  chmodSync(permPath, beforeModePerm);

  const restored = hostStateSchema.parse(JSON.parse(readFileSync(statePath, 'utf8')));
  const perms = permissionsSchema.parse(JSON.parse(readFileSync(permPath, 'utf8')));
  const after = fingerprint(restored);
  const permissionsIntact =
    perms.ownerUserId === initial.ownerUserId && perms.roles.includes('gm') && perms.mode === 0o600;
  const modeIntact = modeOf(statePath) === beforeModeState && modeOf(permPath) === beforeModePerm;

  const archivePath = join(archiveDir, `update-rollback-${randomUUID()}.json`);
  const archive = archiveSchema.parse({
    before,
    after,
    permissionsIntact,
    modeIntact,
    result: before === after && permissionsIntact && modeIntact ? 'rollback-ok' : 'fail',
  });
  writeFileSync(archivePath, `${JSON.stringify(archive, null, 2)}\n`);

  return {
    ok: archive.result === 'rollback-ok' && existsSync(archivePath),
    beforeFingerprint: before,
    afterFingerprint: after,
    permissionsIntact,
    modeIntact,
    archivePath,
  };
}

export function cleanupWorkDir(workDir: string): void {
  rmSync(workDir, { recursive: true, force: true });
}

export { permissionsSchema, archiveSchema };

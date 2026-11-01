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
  modeCheck: z.enum(['PASS', 'FAIL', 'NOT RUN']),
  result: z.enum(['rollback-ok', 'fail']),
});

export type HostState = z.infer<typeof hostStateSchema>;

export type FsModeHooks = {
  readonly chmod: (path: string, mode: number) => void;
  readonly modeOf: (path: string) => number;
  readonly supportsPosixModes: boolean;
};

export type UpdateRollbackReport = {
  readonly ok: boolean;
  readonly beforeFingerprint: string;
  readonly afterFingerprint: string;
  readonly permissionsIntact: boolean;
  /** POSIX mode bits; when supportsPosixModes is false → NOT RUN. */
  readonly modeCheck: 'PASS' | 'FAIL' | 'NOT RUN';
  readonly archivePath: string;
};

function fingerprint(state: HostState): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}

function defaultModeOf(path: string): number {
  return statSync(path).mode & 0o777;
}

/** Default host FS hooks — production path never weakens modes for tests. */
export function createDefaultFsModeHooks(platform: NodeJS.Platform = process.platform): FsModeHooks {
  return {
    chmod: chmodSync,
    modeOf: defaultModeOf,
    supportsPosixModes: platform !== 'win32',
  };
}

export function runUpdateRollbackDrill(args: {
  readonly workDir: string;
  readonly ownerUserId?: string;
  /** Injectable FS mode ops for hermetic FAIL / win32 NOT RUN fixtures. */
  readonly fsHooks?: FsModeHooks;
}): UpdateRollbackReport {
  const hooks = args.fsHooks ?? createDefaultFsModeHooks();
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

  let beforeModeState = 0o600;
  let beforeModePerm = 0o600;
  if (hooks.supportsPosixModes) {
    hooks.chmod(statePath, 0o600);
    hooks.chmod(permPath, 0o600);
    beforeModeState = hooks.modeOf(statePath);
    beforeModePerm = hooks.modeOf(permPath);
  }

  const before = fingerprint(hostStateSchema.parse(JSON.parse(readFileSync(statePath, 'utf8'))));
  copyFileSync(statePath, join(backupDir, 'state.json'));
  copyFileSync(permPath, join(backupDir, 'permissions.json'));

  // Simulated broken update: corrupt JSON (+ weaken filesystem modes on POSIX)
  writeFileSync(
    statePath,
    `${JSON.stringify({ revision: 8, catalogFingerprint: 'corrupt', ownerUserId: 'stranger' }, null, 2)}\n`,
  );
  writeFileSync(
    permPath,
    `${JSON.stringify({ ownerUserId: 'stranger', roles: ['anon'], mode: 0o666 }, null, 2)}\n`,
  );
  if (hooks.supportsPosixModes) {
    hooks.chmod(statePath, 0o666);
    hooks.chmod(permPath, 0o666);
  }

  // Rollback content + modes
  copyFileSync(join(backupDir, 'state.json'), statePath);
  copyFileSync(join(backupDir, 'permissions.json'), permPath);
  if (hooks.supportsPosixModes) {
    hooks.chmod(statePath, beforeModeState);
    hooks.chmod(permPath, beforeModePerm);
  }

  const restored = hostStateSchema.parse(JSON.parse(readFileSync(statePath, 'utf8')));
  const perms = permissionsSchema.parse(JSON.parse(readFileSync(permPath, 'utf8')));
  const after = fingerprint(restored);
  const permissionsIntact =
    perms.ownerUserId === initial.ownerUserId && perms.roles.includes('gm') && perms.mode === 0o600;
  const modeCheck: 'PASS' | 'FAIL' | 'NOT RUN' = !hooks.supportsPosixModes
    ? 'NOT RUN'
    : hooks.modeOf(statePath) === beforeModeState && hooks.modeOf(permPath) === beforeModePerm
      ? 'PASS'
      : 'FAIL';

  const archivePath = join(archiveDir, `update-rollback-${randomUUID()}.json`);
  const archive = archiveSchema.parse({
    before,
    after,
    permissionsIntact,
    modeCheck,
    result:
      before === after && permissionsIntact && modeCheck !== 'FAIL' ? 'rollback-ok' : 'fail',
  });
  writeFileSync(archivePath, `${JSON.stringify(archive, null, 2)}\n`);

  return {
    ok: archive.result === 'rollback-ok' && existsSync(archivePath),
    beforeFingerprint: before,
    afterFingerprint: after,
    permissionsIntact,
    modeCheck,
    archivePath,
  };
}

export function cleanupWorkDir(workDir: string): void {
  rmSync(workDir, { recursive: true, force: true });
}

export { permissionsSchema, archiveSchema };

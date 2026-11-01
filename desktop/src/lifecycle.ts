/**
 * MIG-703 per-platform app/sidecar lifecycle fixture. Location: desktop/src/lifecycle.ts
 *
 * Platforms not executed stay NOT RUN (open acceptance points).
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const platformIdSchema = z.enum(['darwin', 'linux', 'win32']);
export type PlatformId = z.infer<typeof platformIdSchema>;

const platformResultSchema = z.object({
  platform: platformIdSchema,
  status: z.enum(['RUN', 'NOT RUN']),
  startStop: z.enum(['PASS', 'NOT RUN', 'FAIL']),
  restartPersistence: z.enum(['PASS', 'NOT RUN', 'FAIL']),
  sidecarFailure: z.enum(['PASS', 'NOT RUN', 'FAIL']),
  detail: z.string(),
});

export type PlatformLifecycleResult = z.infer<typeof platformResultSchema>;

function assertOk(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const addr = s.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      s.close((err) => (err ? reject(err) : resolve(port)));
    });
    s.on('error', reject);
  });
}

function sidecarPath(repoRoot: string): string {
  return join(repoRoot, 'scripts/stack-migration-pocs/gate-05/sidecar.mjs');
}

async function runSidecarOnce(args: {
  readonly repoRoot: string;
  readonly dataDir: string;
  readonly port: number;
  readonly failBoot?: boolean;
}): Promise<{ code: number | null; listening: boolean }> {
  const bin = process.execPath;
  const script = sidecarPath(args.repoRoot);
  assertOk(existsSync(script), `sidecar missing: ${script}`);
  return await new Promise((resolve) => {
    const child = spawn(bin, [script], {
      env: {
        ...process.env,
        GATE05_SIDECAR_PORT: String(args.port),
        GATE05_DATA_DIR: args.dataDir,
        ...(args.failBoot ? { GATE05_FAIL_BOOT: '1' } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let listening = false;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, 4000);
    child.stdout?.on('data', (buf: Buffer) => {
      const text = buf.toString('utf8');
      if (text.includes('"event":"listening"') || text.includes('"listening"')) {
        listening = true;
        child.kill('SIGTERM');
      }
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, listening });
    });
  });
}

/**
 * Execute lifecycle on the current host platform; mark others NOT RUN.
 */
export async function runPlatformLifecycleMatrix(args: {
  readonly repoRoot: string;
  readonly hostPlatform?: PlatformId;
}): Promise<readonly PlatformLifecycleResult[]> {
  const host = platformIdSchema.parse(args.hostPlatform ?? process.platform);
  const results: PlatformLifecycleResult[] = [];

  for (const platform of platformIdSchema.options) {
    if (platform !== host) {
      results.push(
        platformResultSchema.parse({
          platform,
          status: 'NOT RUN',
          startStop: 'NOT RUN',
          restartPersistence: 'NOT RUN',
          sidecarFailure: 'NOT RUN',
          detail: `not executed on this host (${host})`,
        }),
      );
      continue;
    }

    const work = join(tmpdir(), `mig703-${platform}-${process.pid}`);
    mkdirSync(work, { recursive: true });
    const dataDir = join(work, 'data');
    mkdirSync(dataDir, { recursive: true });

    try {
      const port1 = await freePort();
      const first = await runSidecarOnce({ repoRoot: args.repoRoot, dataDir, port: port1 });
      assertOk(first.listening && first.code === 0, 'start/stop must listen then exit 0');
      const marker = join(dataDir, 'sidecar-alive.json');
      assertOk(existsSync(marker), 'data dir marker after first boot');
      const firstBody = readFileSync(marker, 'utf8');

      const port2 = await freePort();
      const second = await runSidecarOnce({ repoRoot: args.repoRoot, dataDir, port: port2 });
      assertOk(second.listening && second.code === 0, 'restart must listen then exit 0');
      assertOk(existsSync(marker), 'marker persists across restart');
      writeFileSync(join(dataDir, 'host-state.json'), `${JSON.stringify({ v: 1, body: firstBody.slice(0, 80) })}\n`);

      const fail = await runSidecarOnce({
        repoRoot: args.repoRoot,
        dataDir,
        port: await freePort(),
        failBoot: true,
      });
      assertOk(fail.code === 3, `sidecar failure must exit 3, got ${fail.code}`);
      assertOk(existsSync(join(dataDir, 'host-state.json')), 'host state survives sidecar failure');

      results.push(
        platformResultSchema.parse({
          platform,
          status: 'RUN',
          startStop: 'PASS',
          restartPersistence: 'PASS',
          sidecarFailure: 'PASS',
          detail: 'lifecycle fixture against gate-05 sidecar stand-in',
        }),
      );
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }

  return results;
}

/** Self-path helper for tests importing via strip-types. */
export function desktopPackageRoot(): string {
  return fileURLToPath(new URL('..', import.meta.url));
}

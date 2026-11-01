/**
 * MIG-703 per-platform app/sidecar lifecycle fixture. Location: desktop/src/lifecycle.ts
 *
 * Platforms not executed stay NOT RUN (open acceptance points).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const platformIdSchema = z.enum(['darwin', 'linux', 'win32']);
export type PlatformId = z.infer<typeof platformIdSchema>;

const sidecarListeningEventSchema = z.object({
  event: z.literal('listening'),
  port: z.number().int().nonnegative(),
});

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

function sidecarPath(repoRoot: string): string {
  return join(repoRoot, 'scripts/stack-migration-pocs/gate-05/sidecar.mjs');
}

async function runSidecarOnce(args: {
  readonly repoRoot: string;
  readonly dataDir: string;
  readonly failBoot?: boolean;
}): Promise<{ code: number | null; listening: boolean; port: number | null; spawnError: string | null }> {
  const bin = process.execPath;
  const script = sidecarPath(args.repoRoot);
  assertOk(existsSync(script), `sidecar missing: ${script}`);
  return await new Promise((resolve) => {
    let settled = false;
    const finish = (result: {
      code: number | null;
      listening: boolean;
      port: number | null;
      spawnError: string | null;
    }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const child = spawn(bin, [script], {
      env: {
        ...process.env,
        // Port 0: OS assigns; avoids freePort TOCTOU races with parallel CI jobs.
        GATE05_SIDECAR_PORT: '0',
        GATE05_DATA_DIR: args.dataDir,
        ...(args.failBoot ? { GATE05_FAIL_BOOT: '1' } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let listening = false;
    let boundPort: number | null = null;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, 4000);
    child.stdout?.on('data', (buf: Buffer) => {
      const text = buf.toString('utf8');
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;
        let raw: unknown;
        try {
          raw = JSON.parse(trimmed);
        } catch {
          continue;
        }
        const evt = sidecarListeningEventSchema.safeParse(raw);
        if (evt.success) {
          listening = true;
          boundPort = evt.data.port;
          child.kill('SIGTERM');
        }
      }
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      finish({ code: null, listening: false, port: null, spawnError: err.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish({ code, listening, port: boundPort, spawnError: null });
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
      const first = await runSidecarOnce({ repoRoot: args.repoRoot, dataDir });
      assertOk(
        first.listening && first.code === 0 && first.spawnError === null,
        `start/stop must listen then exit 0 (code=${first.code} spawn=${first.spawnError})`,
      );
      const marker = join(dataDir, 'sidecar-alive.json');
      assertOk(existsSync(marker), 'data dir marker after first boot');

      // Seed host state BEFORE second start so persistence is real (sidecar overwrites its own marker).
      const persistPath = join(dataDir, 'host-state.json');
      const persistBody = JSON.stringify({ v: 1, seededBeforeRestart: true, firstPort: first.port });
      writeFileSync(persistPath, `${persistBody}\n`);

      const second = await runSidecarOnce({ repoRoot: args.repoRoot, dataDir });
      assertOk(
        second.listening && second.code === 0 && second.spawnError === null,
        `restart must listen then exit 0 (code=${second.code} spawn=${second.spawnError})`,
      );
      assertOk(existsSync(persistPath), 'host-state persists across restart');
      assertOk(
        readFileSync(persistPath, 'utf8').trim() === persistBody,
        'host-state contents unchanged across restart',
      );

      const fail = await runSidecarOnce({
        repoRoot: args.repoRoot,
        dataDir,
        failBoot: true,
      });
      assertOk(fail.code === 3, `sidecar failure must exit 3, got ${fail.code}`);
      assertOk(existsSync(persistPath), 'host state survives sidecar failure');
      assertOk(
        readFileSync(persistPath, 'utf8').trim() === persistBody,
        'host-state intact after sidecar failure',
      );

      results.push(
        platformResultSchema.parse({
          platform,
          status: 'RUN',
          startStop: 'PASS',
          restartPersistence: 'PASS',
          sidecarFailure: 'PASS',
          detail: 'lifecycle fixture against gate-05 sidecar stand-in (port 0)',
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

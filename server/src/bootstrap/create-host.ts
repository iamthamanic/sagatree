/**
 * Composition root — wires modules, use-cases, and HTTP once at start.
 * Location: server/src/bootstrap/create-host.ts
 */
import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, type HostConfig } from '../config/load-config.ts';
import { createIdentityPorts } from '../modules/identity/index.ts';
import { createPermissionsPorts } from '../modules/permissions/index.ts';
import { createOpsPorts } from '../modules/ops/index.ts';
import { createHealthUseCase } from '../application/health/index.ts';
import { createRouteHandler } from '../http/route-registry.ts';

export type HostInstance = {
  readonly config: HostConfig;
  readonly dataDirFingerprint: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isReady: () => boolean;
  acceptMutations: () => boolean;
};

function fingerprintDataDir(dataDir: string): string {
  return createHash('sha256').update(dataDir).digest('hex').slice(0, 16);
}

function ensureIdentityFile(dataDir: string): string {
  const path = join(dataDir, 'host-identity.json');
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { actorId?: string };
    if (typeof raw.actorId === 'string' && raw.actorId.length > 0) return raw.actorId;
  }
  const actorId = `solo-${randomUUID()}`;
  writeFileSync(path, `${JSON.stringify({ actorId }, null, 2)}\n`, 'utf8');
  return actorId;
}

export function createHost(env: NodeJS.ProcessEnv = process.env): HostInstance | { error: string; code: number } {
  const loaded = loadConfig(env);
  if ('code' in loaded) {
    return { error: loaded.message, code: 1 };
  }
  const config = loaded;
  const dataDirFingerprint = fingerprintDataDir(config.dataDir);
  const actorId = ensureIdentityFile(config.dataDir);

  let ready = false;
  let acceptingMutations = true;
  let server: Server | null = null;
  const pingLogPath = join(config.dataDir, 'ping-log.jsonl');

  const identity = createIdentityPorts(actorId);
  const permissions = createPermissionsPorts();
  const ops = createOpsPorts({
    isReady: () => ready,
    acceptMutations: () => acceptingMutations,
    dataDirFingerprint,
  });
  const health = createHealthUseCase(ops);

  const recordPing = () => {
    if (!acceptingMutations) return { ok: false as const, status: 503, error: 'host-shutting-down' };
    writeFileSync(pingLogPath, `${JSON.stringify({ at: new Date().toISOString() })}\n`, {
      flag: 'a',
      encoding: 'utf8',
    });
    return { ok: true as const };
  };

  const handler = createRouteHandler({ health, ops, permissions, identity, recordPing });

  return {
    config,
    dataDirFingerprint,
    isReady: () => ready,
    acceptMutations: () => acceptingMutations,
    async start() {
      if (server) return;
      server = createServer((req, res) => {
        void handler(req, res);
      });
      await new Promise<void>((resolve, reject) => {
        server!.once('error', (err: NodeJS.ErrnoException) => {
          ready = false;
          reject(err);
        });
        server!.listen(config.port, config.host, () => {
          ready = true;
          resolve();
        });
      });
    },
    async stop() {
      acceptingMutations = false;
      ready = false;
      const current = server;
      server = null;
      if (!current) return;
      await new Promise<void>((resolve, reject) => {
        current.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

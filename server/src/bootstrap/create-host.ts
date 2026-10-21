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
import { createWorldPorts } from '../modules/world/index.ts';
import { createProjectPorts } from '../modules/project/index.ts';
import { createHealthUseCase } from '../application/health/index.ts';
import { createRouteHandler, sendJson } from '../http/route-registry.ts';
import {
  bootstrapHostPersistence,
  type HostDatabase,
} from '../persistence/index.ts';

export type HostInstance = {
  readonly config: HostConfig;
  readonly dataDirFingerprint: string;
  readonly schemaVersion: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isReady: () => boolean;
  acceptMutations: () => boolean;
};

function fingerprintDataDir(dataDir: string): string {
  return createHash('sha256').update(dataDir).digest('hex').slice(0, 16);
}

/**
 * Load or create solo identity. Never throws; never echoes file contents.
 */
function ensureIdentityFile(dataDir: string): { ok: true; actorId: string } | { ok: false; error: string } {
  const path = join(dataDir, 'host-identity.json');
  try {
    if (existsSync(path)) {
      let raw: unknown;
      try {
        raw = JSON.parse(readFileSync(path, 'utf8'));
      } catch {
        return { ok: false, error: 'Host identity file is unreadable or invalid' };
      }
      const actorId =
        raw && typeof raw === 'object' && 'actorId' in raw && typeof (raw as { actorId: unknown }).actorId === 'string'
          ? (raw as { actorId: string }).actorId
          : '';
      if (actorId.length > 0) return { ok: true, actorId };
      return { ok: false, error: 'Host identity file is unreadable or invalid' };
    }
    const actorId = `solo-${randomUUID()}`;
    writeFileSync(path, `${JSON.stringify({ actorId }, null, 2)}\n`, 'utf8');
    return { ok: true, actorId };
  } catch {
    return { ok: false, error: 'Host identity file is unreadable or invalid' };
  }
}

export function createHost(env: NodeJS.ProcessEnv = process.env): HostInstance | { error: string; code: number } {
  try {
    const loaded = loadConfig(env);
    if ('code' in loaded) {
      return { error: loaded.message, code: 1 };
    }
    const config = loaded;
    const dataDirFingerprint = fingerprintDataDir(config.dataDir);
    const identityResult = ensureIdentityFile(config.dataDir);
    if (!identityResult.ok) {
      return { error: identityResult.error, code: 1 };
    }
    const actorId = identityResult.actorId;

    const persistence = bootstrapHostPersistence({ dataDir: config.dataDir });
    if (!persistence.ok) {
      const step = persistence.failedStepId ? ` (failed step: ${persistence.failedStepId})` : '';
      return { error: `${persistence.error}${step}`, code: 1 };
    }
    let db: HostDatabase | null = persistence.db;
    const schemaVersion = persistence.schemaVersion;

    let ready = false;
    let acceptingMutations = true;
    let server: Server | null = null;
    const pingLogPath = join(config.dataDir, 'ping-log.jsonl');

    const identity = createIdentityPorts(actorId);
    const permissions = createPermissionsPorts(db);
    createWorldPorts();
    createProjectPorts();
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
      schemaVersion,
      isReady: () => ready,
      acceptMutations: () => acceptingMutations,
      async start() {
        if (server) return;
        server = createServer((req, res) => {
          // Belt-and-suspenders: handler is designed not to reject, but never leave an unhandled rejection.
          void Promise.resolve(handler(req, res)).catch(() => {
            sendJson(res, 500, { error: 'internal-error' });
          });
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
        if (db) {
          try {
            db.close();
          } catch {
            /* ignore */
          }
          db = null;
        }
        if (!current) return;
        await new Promise<void>((resolve, reject) => {
          current.close((err) => (err ? reject(err) : resolve()));
        });
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const redacted = message.replace(/(?:token|key|secret|password)=[^\s]+/gi, '$1=[redacted]');
    return { error: redacted, code: 1 };
  }
}

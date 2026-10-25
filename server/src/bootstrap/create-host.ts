/**
 * Composition root — wires modules, use-cases, auth, and HTTP once at start.
 * Location: server/src/bootstrap/create-host.ts
 */
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { toNodeHandler } from 'better-auth/node';
import { loadConfig, type HostConfig } from '../config/load-config.ts';
import {
  createIdentityPorts,
  type AuthRuntimeHolder,
} from '../modules/identity/index.ts';
import { createPermissionsPorts } from '../modules/permissions/index.ts';
import { createOpsPorts } from '../modules/ops/index.ts';
import {
  createWorldPorts,
  createWorldPortsStub,
  createSqliteWorldWriteStore,
  type WorldPorts,
} from '../modules/world/index.ts';
import { createProjectPorts } from '../modules/project/index.ts';
import {
  createAssetPorts,
  createAssetPortsStub,
  type AssetPorts,
} from '../assets/index.ts';
import {
  createResumableUploadPorts,
  createResumableUploadPortsStub,
  type ResumableUploadPorts,
} from '../assets/uploads/index.ts';
import { createMediaPorts, type MediaPorts } from '../modules/media/index.ts';
import { createAiPorts, createAiPortsStub, type AiPorts } from '../modules/ai/index.ts';
import {
  createRulesetPorts,
  createRulesetPortsStub,
  type RulesetPorts,
} from '../modules/rulesets/index.ts';
import {
  createSagaPorts,
  createSagaPortsStub,
  type SagaPorts,
} from '../modules/saga/index.ts';
import { createSqliteWorldReadStore } from '../repositories/world/sqlite-world-read-store.ts';
import { createHealthUseCase } from '../application/health/index.ts';
import { createTransportUseCase } from '../application/transport/index.ts';
import { createSessionPorts } from '../modules/session/index.ts';
import { createRealtimeSessionRooms, type RealtimeFanoutMessage } from '../realtime/index.ts';
import { createRouteHandler, sendJson } from '../http/route-registry.ts';
import {
  bootstrapHostPersistence,
  type HostDatabase,
} from '../persistence/index.ts';
import {
  createCookieAuthProfile,
  wrapCookieAuthHandler,
  attachSessionWebSocket,
  ensureSoloIdentityFile,
  type HostBetterAuth,
} from '../auth/index.ts';

export type HostInstance = {
  readonly config: HostConfig;
  readonly dataDirFingerprint: string;
  readonly schemaVersion: number;
  readonly world: WorldPorts;
  readonly assets: AssetPorts;
  /** MIG-501 optional resumable large uploads (capability-gated). */
  readonly uploads: ResumableUploadPorts;
  /** MIG-306 media policy ports (browser engines stay client-side). */
  readonly media: MediaPorts;
  /** MIG-402 AI provider credentials + Ollama prefs. */
  readonly ai: AiPorts;
  /** MIG-309 ruleset catalog ports. */
  readonly rulesets: RulesetPorts;
  /** RPC-SAGA-AUTHORING saga definition ports (#871). */
  readonly saga: SagaPorts;
  /** Better Auth instance when cookie profile is enabled (tests only). */
  readonly getAuth: () => HostBetterAuth | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isReady: () => boolean;
  acceptMutations: () => boolean;
};

function fingerprintDataDir(dataDir: string): string {
  return createHash('sha256').update(dataDir).digest('hex').slice(0, 16);
}

function redactLogMessage(message: string): string {
  return message.replace(/(?:token|key|secret|password)=[^\s]+/gi, '$1=[redacted]');
}

export function createHost(env: NodeJS.ProcessEnv = process.env): HostInstance | { error: string; code: number } {
  try {
    const loaded = loadConfig(env);
    if ('code' in loaded) {
      return { error: loaded.message, code: 1 };
    }
    const config = loaded;
    const dataDirFingerprint = fingerprintDataDir(config.dataDir);
    const identityResult = ensureSoloIdentityFile(config.dataDir);
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
    let authDbClose: (() => void) | null = null;
    let betterAuth: HostBetterAuth | null = null;
    const authRuntime: AuthRuntimeHolder = {
      auth: null,
      origin: null,
      trustedOrigins: config.auth?.trustedOrigins ?? [],
    };
    const pingLogPath = join(config.dataDir, 'ping-log.jsonl');
    const projectTouchPath = join(config.dataDir, 'project-touch.jsonl');
    const worldTouchPath = join(config.dataDir, 'world-touch.jsonl');

    const identity = createIdentityPorts(actorId, authRuntime, config.dataDir);
    const project = createProjectPorts(db ?? undefined);
    const permissions = createPermissionsPorts(db, {
      actorHasAccessToSaga: project.actorHasAccessToSaga,
    });
    const world: WorldPorts = db
      ? createWorldPorts({
          authorize: permissions.authorize,
          store: createSqliteWorldReadStore(db),
          writeStore: createSqliteWorldWriteStore(db),
          db,
          actorCanAccessWorld: project.actorCanAccessWorld,
        })
      : createWorldPortsStub();
    const largeUploadsEnabled = env.SAGATREE_LARGE_UPLOADS === '1';
    const assets: AssetPorts = db
      ? createAssetPorts({
          dataDir: config.dataDir,
          db,
          authorize: permissions.authorize,
          // Elevated finalize only when large-upload capability is on (#939).
          allowElevatedPublish: largeUploadsEnabled,
        })
      : createAssetPortsStub();
    const uploads: ResumableUploadPorts = db
      ? createResumableUploadPorts({
          dataDir: config.dataDir,
          db,
          authorize: permissions.authorize,
          assets,
          enabled: largeUploadsEnabled,
        })
      : createResumableUploadPortsStub(false);
    // Media owns asset-table policy surface; codecs remain in browser optimizer (infra-media).
    const media = createMediaPorts();
    const ai: AiPorts = db ? createAiPorts({ db, env }) : createAiPortsStub();
    const rulesets: RulesetPorts = db
      ? createRulesetPorts({ db, authorize: permissions.authorize })
      : createRulesetPortsStub();
    const saga: SagaPorts = db
      ? createSagaPorts({ db, authorize: permissions.authorize, project })
      : createSagaPortsStub();
    const ops = createOpsPorts({
      isReady: () => ready,
      acceptMutations: () => acceptingMutations,
      dataDirFingerprint,
    });
    const health = createHealthUseCase(ops);
    const transport = createTransportUseCase({
      permissions,
      acceptMutations: () => acceptingMutations,
    });

    const fanoutLogPath = join(config.dataDir, 'realtime-fanout.jsonl');
    const onFanout = (message: RealtimeFanoutMessage) => {
      writeFileSync(
        fanoutLogPath,
        `${JSON.stringify({
          at: new Date().toISOString(),
          sessionId: message.sessionId,
          roomId: message.roomId,
          actorId: message.actorId,
          revision: message.revision,
          kind: message.kind,
        })}\n`,
        { flag: 'a', encoding: 'utf8' },
      );
    };

    // Session runtime + realtime rooms share one onCommitted publisher (ADR-ST-08).
    let realtimeRooms: ReturnType<typeof createRealtimeSessionRooms> | undefined;
    const sessionPorts = db
      ? createSessionPorts({
          db,
          onCommitted: (event) => {
            realtimeRooms?.onCommitted(event);
          },
        })
      : null;
    realtimeRooms = sessionPorts
      ? createRealtimeSessionRooms({ session: sessionPorts, onFanout })
      : undefined;

    const recordPing = () => {
      if (!acceptingMutations) return { ok: false as const, status: 503, error: 'host-shutting-down' };
      writeFileSync(pingLogPath, `${JSON.stringify({ at: new Date().toISOString() })}\n`, {
        flag: 'a',
        encoding: 'utf8',
      });
      return { ok: true as const };
    };

    const tryAuthorizedProjectTouch = (input: {
      actorId: string;
      projectId: string;
      claimedRole?: unknown;
      claimedOwnerUserId?: unknown;
    }) => {
      if (!acceptingMutations) return { ok: false as const, status: 503, error: 'host-shutting-down' };
      // Membership already authorized via Policy Service; claims are never persisted as authority.
      writeFileSync(
        projectTouchPath,
        `${JSON.stringify({
          at: new Date().toISOString(),
          actorId: input.actorId,
          projectId: input.projectId,
        })}\n`,
        { flag: 'a', encoding: 'utf8' },
      );
      return { ok: true as const, mutated: true };
    };

    const tryAuthorizedWorldTouch = (input: { actorId: string; worldId: string }) => {
      if (!acceptingMutations) return { ok: false as const, status: 503, error: 'host-shutting-down' };
      writeFileSync(
        worldTouchPath,
        `${JSON.stringify({
          at: new Date().toISOString(),
          actorId: input.actorId,
          worldId: input.worldId,
        })}\n`,
        { flag: 'a', encoding: 'utf8' },
      );
      return { ok: true as const, mutated: true };
    };

    // Handler is created once; authHandlerRef filled after cookie profile init in start().
    const authHandlerRef: { current: ReturnType<typeof wrapCookieAuthHandler> | null } = {
      current: null,
    };
    const handler = createRouteHandler({
      health,
      ops,
      permissions,
      identity,
      transport,
      realtime: realtimeRooms,
      hostMode: config.mode,
      trustedOrigins: config.auth?.trustedOrigins ?? [],
      recordPing,
      authHandlerRef,
      tryAuthorizedProjectTouch,
      tryAuthorizedWorldTouch,
    });

    return {
      config,
      dataDirFingerprint,
      schemaVersion,
      world,
      assets,
      uploads,
      media,
      ai,
      rulesets,
      saga,
      getAuth: () => betterAuth,
      isReady: () => ready,
      acceptMutations: () => acceptingMutations,
      async start() {
        if (server) return;

        if (config.auth) {
          const authDbPath = join(config.dataDir, 'auth.sqlite');
          const created = await createCookieAuthProfile({
            databasePath: authDbPath,
            baseURL: config.auth.baseURL,
            secret: config.auth.secret,
            trustedOrigins: config.auth.trustedOrigins,
            cookieSecure: config.auth.cookieSecure,
          });
          if (!created.ok) {
            throw new Error(created.error);
          }
          betterAuth = created.auth;
          authRuntime.auth = created.auth;
          authRuntime.origin = config.auth.baseURL;
          authRuntime.trustedOrigins = config.auth.trustedOrigins;
          authDbClose = () => {
            try {
              created.db.close();
            } catch {
              /* ignore */
            }
          };
          authHandlerRef.current = wrapCookieAuthHandler(
            toNodeHandler(created.auth),
            config.auth.baseURL,
          );
        }

        server = createServer((req, res) => {
          void Promise.resolve(handler(req, res)).catch(() => {
            sendJson(res, 500, { error: 'internal-error' });
          });
        });

        if (betterAuth && config.auth) {
          attachSessionWebSocket(server, {
            auth: betterAuth,
            origin: config.auth.baseURL,
            trustedOrigins: config.auth.trustedOrigins,
          });
        }

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
        betterAuth = null;
        authRuntime.auth = null;
        authRuntime.origin = null;
        authHandlerRef.current = null;
        if (authDbClose) {
          authDbClose();
          authDbClose = null;
        }
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
    return { error: redactLogMessage(message), code: 1 };
  }
}

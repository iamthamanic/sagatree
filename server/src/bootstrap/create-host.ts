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
  createProjectInfraPorts,
  createProjectInfraPortsStub,
  type ProjectInfraPorts,
} from '../application/project-infra/index.ts';
import {
  createSagaInfraPorts,
  createSagaInfraPortsStub,
  type SagaInfraPorts,
} from '../application/saga-infra/index.ts';
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
  createLookPorts,
  createLookPortsStub,
  type LookProfilePorts,
} from '../modules/look/index.ts';
import {
  createNpcCreaturePorts,
  createNpcCreaturePortsStub,
  type NpcCreaturePorts,
} from '../modules/npc-creature/index.ts';
import {
  createUserProfilePorts,
  createUserProfilePortsStub,
  type UserProfilePorts,
} from '../modules/user-profile/index.ts';
import {
  createSagaPorts,
  createSagaPortsStub,
  type SagaPorts,
} from '../modules/saga/index.ts';
import { createCharacterPorts, type CharacterPorts } from '../modules/character/index.ts';
import { createInventoryPorts, type InventoryPorts } from '../modules/inventory/index.ts';
import {
  createMarketplacePorts,
  createMarketplacePortsStub,
  type MarketplacePorts,
} from '../modules/marketplace/index.ts';
import {
  createSessionInfraPorts,
  type SessionInfraPorts,
} from '../modules/session/session-infra-ports.ts';
import { createSqliteWorldReadStore } from '../repositories/world/sqlite-world-read-store.ts';
import { createHealthUseCase } from '../application/health/index.ts';
import { createTransportUseCase } from '../application/transport/index.ts';
import { createAiProviderCredentialsUseCases } from '../application/ai-provider-credentials/index.ts';
import { createOllamaSettingsUseCases } from '../application/ollama-settings/index.ts';
import {
  createCharacterLoreUseCases,
  generateCharacterLoreStory,
  resolveCharacterLoreProviderConfig,
  type CharacterLoreUseCases,
} from '../application/character-lore/index.ts';
import {
  createSessionRecapGenerateUseCases,
  createSqliteSessionRecapGenerateStore,
  generateSessionRecapStory,
  hydrateSessionRecapGenerateStoreFromDb,
  persistSessionRecapGenerateDraft,
  resolveSessionRecapProviderConfig,
  resolveSessionRecapRateLimit,
  type SessionRecapGenerateUseCases,
} from '../application/session-recap/index.ts';
import {
  createSqliteCharacterLoreStore,
  resolveCharacterLoreRateLimit,
  type CharacterLoreProjectRow,
  type CharacterLoreReferencePorts,
  type CharacterLoreWorldRow,
} from '../modules/character/character-lore.ts';
import {
  decryptProviderSecret,
  parseCredentialsEncryptionKey,
} from '../modules/ai/internal/crypto.ts';
import {
  OLLAMA_NONE_SECRET,
  OLLAMA_PROVIDER_ID,
} from '../modules/ai/internal/registry.ts';
import { assertSafeOllamaBaseUrl } from '../modules/ai/internal/ollama-url-policy.ts';
import {
  createSessionPorts,
  createSessionProjectLookup,
} from '../modules/session/index.ts';
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
import { ensureDornhainDefaultCatalog } from './ensure-dornhain-default.ts';

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
  /** MIG-304 LookProfile repository ports (HTTP cutover → MIG-600). */
  readonly look: LookProfilePorts;
  /** MIG-302 character sheet / membership ports (HTTP cutover → MIG-602). */
  readonly character: CharacterPorts;
  /** MIG-303 inventory + catalog ports (HTTP cutover → MIG-602). */
  readonly inventory: InventoryPorts;
  /** MIG-305 marketplace catalog + download counter ports (HTTP cutover → MIG-600). */
  readonly marketplace: MarketplacePorts;
  /** MIG-311 flat session infra ports for dual-path FE adapter (HTTP cutover → MIG-602). */
  readonly sessionInfra: SessionInfraPorts | null;
  /** MIG-307 NPC/creature definition + instance ports (HTTP cutover → MIG-600). */
  readonly npcCreature: NpcCreaturePorts;
  /** MIG-312 user_profiles + user-avatars ports (HTTP cutover → MIG-600). */
  readonly userProfile: UserProfilePorts;
  /** MIG-308 composed project infra ports — 11 RPCs (HTTP cutover → MIG-600). */
  readonly projectInfra: ProjectInfraPorts;
  /** MIG-310 composed saga infra ports — 11 RPCs (HTTP cutover → MIG-600). */
  readonly sagaInfra: SagaInfraPorts;
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

    // Solo product default: Dornhain must exist without Supabase seed migrations.
    if (db) {
      try {
        ensureDornhainDefaultCatalog(db, actorId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          error: `dornhain-default-seed-failed: ${redactLogMessage(message)}`,
          code: 1,
        };
      }
    }

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
    const permissions = createPermissionsPorts(
      db,
      { actorHasAccessToSaga: project.actorHasAccessToSaga },
      project,
    );
    const world: WorldPorts = db
      ? createWorldPorts({
          authorize: permissions.authorize,
          store: createSqliteWorldReadStore(db),
          writeStore: createSqliteWorldWriteStore(db),
          db,
          actorCanAccessWorld: project.actorCanAccessWorld,
          resolveSagaProjectForWorld: project.resolveProjectIdForWorldAndPublicId,
          isActiveProjectMember: (projectId, actorIds) =>
            project.isActiveMember(projectId, actorIds) ||
            project.isProjectGm(projectId, actorIds),
          worldHasProjects: project.worldHasProjects,
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
    const aiCredentials = createAiProviderCredentialsUseCases(ai);
    const aiOllama = createOllamaSettingsUseCases(ai);

    const characterLoreReferences: CharacterLoreReferencePorts = {
      getProject: async (projectId) => {
        const result = project.getProject(projectId);
        if (!result.ok) return null;
        const value = result.value;
        return {
          id: value.id,
          name: value.title,
          description: value.description,
          worldId: value.worldId,
          gmUserId: value.gmUserId,
        } satisfies CharacterLoreProjectRow;
      },
      isActiveMember: async (projectId, actorIds) =>
        project.isActiveMember(projectId, actorIds) || project.isProjectGm(projectId, actorIds),
      getWorld: async (worldId) => {
        if (!db) return null;
        const row = db
          .prepare(
            `SELECT id, owner_user_id AS ownerUserId, title, payload
             FROM worlds WHERE id = ? LIMIT 1`,
          )
          .get(worldId) as
          | { id: string; ownerUserId: string; title: string; payload: string }
          | undefined;
        if (!row) return null;
        let lore: string | null = null;
        try {
          const payload = JSON.parse(row.payload || '{}') as Record<string, unknown>;
          if (typeof payload.lore === 'string' && payload.lore.trim()) {
            lore = payload.lore.trim();
          } else if (typeof payload.description === 'string' && payload.description.trim()) {
            lore = payload.description.trim();
          } else {
            const modules =
              payload.modules && typeof payload.modules === 'object' && !Array.isArray(payload.modules)
                ? (payload.modules as Record<string, unknown>)
                : null;
            const promoted =
              modules?.promotedLore &&
              typeof modules.promotedLore === 'object' &&
              !Array.isArray(modules.promotedLore)
                ? (modules.promotedLore as Record<string, unknown>)
                : null;
            const facts = Array.isArray(promoted?.facts) ? promoted.facts : [];
            const joined = facts
              .map((f) => {
                if (typeof f === 'string') return f.trim();
                if (f && typeof f === 'object' && typeof (f as { text?: unknown }).text === 'string') {
                  return ((f as { text: string }).text).trim();
                }
                return '';
              })
              .filter(Boolean)
              .join('\n');
            lore = joined || null;
          }
        } catch {
          lore = null;
        }
        return {
          id: row.id,
          creatorUserId: row.ownerUserId,
          name: row.title,
          lore,
          settingType: null,
          // Host worlds have no public flag — fail closed (GM/owner path only).
          isPublic: false,
        } satisfies CharacterLoreWorldRow;
      },
    };

    async function resolveCharacterLoreProviderForUser(userId: string) {
      const store = ai.store;
      const row =
        store && typeof store.loadWithSecret === 'function'
          ? store.loadWithSecret(userId, OLLAMA_PROVIDER_ID)
          : null;
      if (row && row.status === 'active') {
        const meta = row.meta;
        const model = typeof meta.model === 'string' ? meta.model.trim() : '';
        if (model) {
          const useCloud = meta.useCloud === true;
          const baseRaw =
            typeof meta.baseUrl === 'string' && meta.baseUrl.trim()
              ? meta.baseUrl.trim()
              : useCloud
                ? 'https://ollama.com/v1'
                : 'http://127.0.0.1:11434';
          const safe = assertSafeOllamaBaseUrl(baseRaw);
          if (safe.ok) {
            let apiKey = '';
            if (row.secretCiphertext && row.secretCiphertext !== OLLAMA_NONE_SECRET) {
              const enc = parseCredentialsEncryptionKey(env.CREDENTIALS_ENCRYPTION_KEY);
              if (enc) {
                try {
                  apiKey = await decryptProviderSecret(row.secretCiphertext, enc);
                } catch {
                  apiKey = '';
                }
              }
            }
            if (useCloud) {
              if (apiKey) {
                return {
                  provider: 'openai-compatible' as const,
                  baseUrl: safe.url,
                  model,
                  apiKey,
                };
              }
            } else {
              const native = safe.url.replace(/\/v1\/?$/i, '');
              return {
                provider: 'ollama' as const,
                baseUrl: native,
                model,
                ...(apiKey ? { apiKey } : {}),
              };
            }
          }
        }
      }
      return resolveCharacterLoreProviderConfig((key) => env[key]);
    }

    const characterLore: CharacterLoreUseCases = createCharacterLoreUseCases({
      store: db ? createSqliteCharacterLoreStore(db) : undefined,
      references: characterLoreReferences,
      resolveProvider: resolveCharacterLoreProviderForUser,
      generateStory: generateCharacterLoreStory,
      rateLimitPerMinute: resolveCharacterLoreRateLimit(
        env.CHARACTER_AI_RATE_LIMIT_PER_MINUTE,
      ),
    });

    async function resolveSessionRecapProviderForUser(userId: string) {
      // Codex P2: honor per-user AI → Organize prefs before server env fallback.
      // Character-lore resolver checks user prefs first, then CHARACTER_AI_*.
      const fromUserOrCharacter = await resolveCharacterLoreProviderForUser(userId);
      if (fromUserOrCharacter) return fromUserOrCharacter;
      // SESSION_RECAP_* env when CHARACTER_* unset.
      return resolveSessionRecapProviderConfig((key) => env[key]);
    }

    const sessionRecapGenerate: SessionRecapGenerateUseCases =
      createSessionRecapGenerateUseCases({
        store: db ? createSqliteSessionRecapGenerateStore(db) : undefined,
        resolveProvider: resolveSessionRecapProviderForUser,
        generateSummary: generateSessionRecapStory,
        rateLimitPerMinute: resolveSessionRecapRateLimit(
          env.SESSION_RECAP_AI_RATE_LIMIT_PER_MINUTE ||
            env.CHARACTER_AI_RATE_LIMIT_PER_MINUTE,
        ),
        hydrateSession: db
          ? (sessionId, store) =>
              hydrateSessionRecapGenerateStoreFromDb(db, store, sessionId)
          : undefined,
        afterDraftPersist: db
          ? (row) => persistSessionRecapGenerateDraft(db, row)
          : undefined, // returns ok/approved-locked for race safety
      });
    const rulesets: RulesetPorts = db
      ? createRulesetPorts({ db, authorize: permissions.authorize })
      : createRulesetPortsStub();
    const look: LookProfilePorts = db ? createLookPorts({ db }) : createLookPortsStub();
    const character = db ? createCharacterPorts(db) : createCharacterPorts();
    const inventory = db
      ? createInventoryPorts({
          db,
          world: {
            canReadWorldProfile: (actorIds, worldProfileId) => {
              if (project.actorCanAccessWorld(actorIds, worldProfileId)) return true;
              return world.canEditWorld(actorIds, worldProfileId);
            },
            canEditWorldProfile: (actorIds, worldProfileId) =>
              world.canEditWorld(actorIds, worldProfileId),
          },
          character: {
            getOwned: (actorId, characterId) =>
              character.getOwnedInventoryColumns(actorId, characterId),
            putOwned: (
              actorId,
              characterId,
              inventoryJson,
              schemaVersion,
              updatedAt,
              revalidateUnderLock,
            ) =>
              character.putOwnedInventoryColumns(
                actorId,
                characterId,
                inventoryJson,
                schemaVersion,
                updatedAt,
                revalidateUnderLock,
              ),
          },
        })
      : createInventoryPorts();
    const marketplace: MarketplacePorts = db
      ? createMarketplacePorts({ db })
      : createMarketplacePortsStub();
    const saga: SagaPorts = db
      ? createSagaPorts({
          db,
          authorize: permissions.authorize,
          project,
          loreAcl: permissions.sagaGovernance,
          world: {
            canEditWorld: (ids, worldId) => world.canEditWorld(ids, worldId),
            appendPromotedLoreFact: (worldId, fact) =>
              world.appendPromotedLoreFact(worldId, fact),
          },
          characterNames: { getDisplayName: (id) => character.getDisplayName(id) },
        })
      : createSagaPortsStub();
    const sessionProjectLookup = db ? createSessionProjectLookup(db) : null;
    const npcCreature: NpcCreaturePorts = db && sessionProjectLookup
      ? createNpcCreaturePorts({
          db,
          project,
          session: {
            sessionProjectId: (sessionId) =>
              sessionProjectLookup.projectIdForSession(sessionId),
            sessionBelongsToProject: (sessionId, projectId) =>
              sessionProjectLookup.projectIdForSession(sessionId) === projectId,
          },
          world: {
            canReadWorldProfile: (actorIds, worldProfileId) => {
              if (project.actorCanAccessWorld(actorIds, worldProfileId)) return true;
              return world.canEditWorld(actorIds, worldProfileId);
            },
            canEditWorldProfile: (actorIds, worldProfileId) =>
              world.canEditWorld(actorIds, worldProfileId),
          },
        })
      : createNpcCreaturePortsStub();
    const userProfile: UserProfilePorts = db
      ? createUserProfilePorts({
          db,
          dataDir: config.dataDir,
          // FE-HOST-08: authenticated display URL for AccountAvatarSection <img>.
          signAvatarUrl: (path) => {
            if (!path) return null;
            const base = config.auth?.baseURL?.replace(/\/$/, '') ?? '';
            if (!base) return null;
            return `${base}/api/v1/user-profile/me/avatar`;
          },
        })
      : createUserProfilePortsStub();
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
    // Project ports required for lifecycle/access/recap ACL (create_project_session etc.).
    let realtimeRooms: ReturnType<typeof createRealtimeSessionRooms> | undefined;
    const sessionPorts = db
      ? createSessionPorts({
          db,
          project,
          onCommitted: (event) => {
            realtimeRooms?.onCommitted(event);
          },
        })
      : null;
    realtimeRooms = sessionPorts
      ? createRealtimeSessionRooms({ session: sessionPorts, onFanout })
      : undefined;
    const sessionInfraPorts = sessionPorts ? createSessionInfraPorts(sessionPorts) : null;

    const projectInfra: ProjectInfraPorts =
      db && sessionPorts
        ? createProjectInfraPorts({
            project,
            character,
            saga,
            world,
            permissions,
            session: sessionPorts,
            // FE-HOST-10: each remote demo user gets an owned Dornhain copy
            // (solo-link alone cannot cover admin + player).
            ensureOwnedDornhainStarter: (ownerUserId) => {
              const before = ensureDornhainDefaultCatalog(db, ownerUserId);
              return { projectId: before.projectId, created: before.seeded };
            },
          })
        : createProjectInfraPortsStub();

    const sagaInfra: SagaInfraPorts = db
      ? createSagaInfraPorts({ saga, project, world })
      : createSagaInfraPortsStub();

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
      aiCredentials,
      aiOllama,
      characterLore,
      sessionRecapGenerate,
      character,
      world,
      npcCreature,
      look,
      inventory,
      project,
      sessionLookup: sessionProjectLookup,
      sessionInfra: sessionInfraPorts,
      projectInfra,
      sagaInfra,
      assets,
      marketplace,
      rulesets,
      userProfile,
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
      look,
      character,
      inventory,
      marketplace,
      sessionInfra: sessionInfraPorts,
      npcCreature,
      userProfile,
      projectInfra,
      sagaInfra,
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

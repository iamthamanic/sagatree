/**
 * aiberto-tools — Host Read/Nav tool registry + dispatcher (AIB-06 / #1129).
 * Location: server/src/application/aiberto-tools/index.ts
 *
 * Reuses existing ports (character owned, inventory, world, session, rulebook).
 * No write tools. No second AI provider stack. Flag AIBERTO_TOOLS_READ_ENABLED default off.
 */
import type { Actor } from '../../modules/identity/index.ts';
import {
  actorIdsForGovernance,
  type PolicyDecision,
} from '../../modules/permissions/index.ts';
import type { CharacterPorts } from '../../modules/character/index.ts';
import type { InventoryPorts } from '../../modules/inventory/index.ts';
import type { WorldPorts } from '../../modules/world/index.ts';
import type { SessionPorts } from '../../modules/session/index.ts';
import {
  consumeAibertoAskRateLimit,
  createAibertoRateLimitStore,
  loadRulebookHostApi,
  type AibertoRateLimitStore,
  type RulebookHostApi,
} from '../../modules/ai/index.ts';
import {
  getAibertoToolDef,
  isAibertoToolId,
  listAibertoToolCapabilities,
  type AibertoToolId,
} from './registry.ts';
import {
  resolveNavigateAllowlist,
  type AibertoClientNavigateAction,
} from './navigate-allowlist.ts';

export {
  AIBERTO_TOOL_IDS,
  AIBERTO_TOOL_REGISTRY,
  getAibertoToolDef,
  isAibertoToolId,
  listAibertoToolCapabilities,
  type AibertoToolDef,
  type AibertoToolId,
} from './registry.ts';
export {
  resolveNavigateAllowlist,
  type AibertoClientNavigateAction,
} from './navigate-allowlist.ts';

export const AIBERTO_TOOLS_MAX_ARGS_BYTES = 8_000;
/** Whole invoke JSON body (toolId + args + wrapper) — enforced at HTTP boundary. */
export const AIBERTO_TOOLS_MAX_REQUEST_BYTES = 16_000;
export const AIBERTO_TOOLS_DEFAULT_BUDGET_PER_MINUTE = 30;
export const AIBERTO_TOOLS_RATE_WINDOW_SECONDS = 60;
/** Align with aiberto-ask rate-limit ceiling (modules/ai). */
export const AIBERTO_TOOLS_MAX_BUDGET_PER_MINUTE = 60;

export function checkAibertoToolsBodySize(
  contentLengthHeader: string | null,
  decodedBytes?: number,
): { ok: true } | { ok: false; status: 413; message: string } {
  const message =
    'Request-Body ist zu groß. Bitte kürze die Tool-Argumente und versuche es erneut.';
  if (contentLengthHeader != null && contentLengthHeader !== '') {
    const n = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(n) && n > AIBERTO_TOOLS_MAX_REQUEST_BYTES) {
      return { ok: false, status: 413, message };
    }
  }
  if (typeof decodedBytes === 'number' && decodedBytes > AIBERTO_TOOLS_MAX_REQUEST_BYTES) {
    return { ok: false, status: 413, message };
  }
  return { ok: true };
}

export type AibertoToolsAuthorize = (actor: Actor) => PolicyDecision;
export type AibertoWorldAuthorize = (
  actor: Actor,
  resource: { readonly worldId?: string },
) => PolicyDecision;

export function isAibertoToolsReadEnabled(
  envGet: (key: string) => string | undefined,
): boolean {
  const raw = (envGet('AIBERTO_TOOLS_READ_ENABLED') || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function resolveAibertoToolsBudget(
  raw: string | undefined,
): number {
  const n = Number.parseInt(raw || '', 10);
  if (Number.isFinite(n) && n > 0 && n <= AIBERTO_TOOLS_MAX_BUDGET_PER_MINUTE) {
    return Math.floor(n);
  }
  return AIBERTO_TOOLS_DEFAULT_BUDGET_PER_MINUTE;
}

function actorUserId(actor: Actor): string | null {
  const id = typeof actor?.actorId === 'string' ? actor.actorId.trim() : '';
  return id || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stripElevatedArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    const lower = key.toLowerCase();
    // Client must never supply elevated identity / role claims for auth.
    if (
      lower === 'owneruserid' ||
      lower === 'owner_user_id' ||
      lower === 'role' ||
      lower === 'actorid' ||
      lower === 'actor_id' ||
      lower === 'canwrite' ||
      lower === 'isgm' ||
      lower === 'gm'
    ) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

export type CharacterPublicDto = {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly characterType: string;
  readonly sheetStatus: string;
  readonly level: number;
  readonly description: string;
  readonly updatedAt: string;
};

function toCharacterDto(row: {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly characterType: string;
  readonly sheetStatus: string;
  readonly level: number;
  readonly description: string;
  readonly updatedAt: string;
  readonly ownerUserId?: string;
  readonly sheet?: unknown;
  readonly portraitStoragePath?: string | null;
}): CharacterPublicDto {
  return {
    id: row.id,
    publicId: row.publicId,
    name: row.name,
    characterType: row.characterType,
    sheetStatus: row.sheetStatus,
    level: row.level,
    description: row.description,
    updatedAt: row.updatedAt,
  };
}

export type AibertoToolErrorCode =
  | 'FLAG_DISABLED'
  | 'AUTH_DENIED'
  | 'TOOL_UNKNOWN'
  | 'INVALID_ARGS'
  | 'BUDGET_EXCEEDED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INTERNAL';

export type AibertoToolInvokeResult =
  | {
      readonly status: 'ok';
      readonly toolId: AibertoToolId;
      readonly data: unknown;
      readonly clientAction?: AibertoClientNavigateAction;
    }
  | {
      readonly status: 'disabled';
      readonly code: 'FLAG_DISABLED';
      readonly message: string;
    }
  | {
      readonly status: 'error';
      readonly code: AibertoToolErrorCode;
      readonly message: string;
      readonly httpStatus: number;
      readonly toolId?: string;
    };

export type AibertoToolsCapabilitiesResult =
  | {
      readonly status: 'ok';
      readonly enabled: true;
      readonly note: string;
      readonly tools: ReturnType<typeof listAibertoToolCapabilities>;
    }
  | {
      readonly status: 'disabled';
      readonly code: 'FLAG_DISABLED';
      readonly message: string;
      readonly enabled: false;
      readonly tools: readonly [];
    }
  | {
      readonly status: 'error';
      readonly code: 'AUTH_DENIED';
      readonly message: string;
      readonly httpStatus: number;
    };

export type AibertoToolsDeps = {
  readonly envGet: (key: string) => string | undefined;
  readonly authorize: AibertoToolsAuthorize;
  readonly authorizeWorldRead: AibertoWorldAuthorize;
  readonly character: CharacterPorts;
  readonly inventory: InventoryPorts;
  readonly world: WorldPorts;
  readonly session: SessionPorts | null;
  readonly rateLimitStore?: AibertoRateLimitStore;
  readonly budgetPerMinute?: number;
  readonly loadRulebook?: () => Promise<RulebookHostApi>;
};

export type AibertoToolsUseCases = {
  readonly capabilities: (actor: Actor) => AibertoToolsCapabilitiesResult;
  readonly invoke: (
    actor: Actor,
    input: { readonly toolId: unknown; readonly args?: unknown },
  ) => Promise<AibertoToolInvokeResult>;
};

export function createAibertoToolsUseCases(deps: AibertoToolsDeps): AibertoToolsUseCases {
  const store = deps.rateLimitStore ?? createAibertoRateLimitStore();
  const budget = deps.budgetPerMinute ?? resolveAibertoToolsBudget(
    deps.envGet('AIBERTO_TOOLS_RATE_LIMIT_PER_MINUTE'),
  );
  const loadRulebook = deps.loadRulebook ?? loadRulebookHostApi;

  function capabilities(actor: Actor): AibertoToolsCapabilitiesResult {
    if (!isAibertoToolsReadEnabled(deps.envGet)) {
      return {
        status: 'disabled',
        code: 'FLAG_DISABLED',
        enabled: false,
        tools: [],
        message:
          'Aiberto-Tools sind deaktiviert (AIBERTO_TOOLS_READ_ENABLED). Das Regelbuch bleibt nutzbar.',
      };
    }
    const userId = actorUserId(actor);
    if (!userId) {
      return {
        status: 'error',
        code: 'AUTH_DENIED',
        message: 'Nicht angemeldet.',
        httpStatus: 401,
      };
    }
    const decision = deps.authorize(actor);
    if (!decision.allow) {
      return {
        status: 'error',
        code: 'AUTH_DENIED',
        message: 'Keine Berechtigung für Aiberto-Tools.',
        httpStatus: 403,
      };
    }
    return {
      status: 'ok',
      enabled: true,
      note: 'capabilities ≠ Rechte — jeder Aufruf wird erneut autorisiert.',
      tools: listAibertoToolCapabilities(),
    };
  }

  async function invoke(
    actor: Actor,
    input: { readonly toolId: unknown; readonly args?: unknown },
  ): Promise<AibertoToolInvokeResult> {
    if (!isAibertoToolsReadEnabled(deps.envGet)) {
      return {
        status: 'disabled',
        code: 'FLAG_DISABLED',
        message:
          'Aiberto-Tools sind deaktiviert (AIBERTO_TOOLS_READ_ENABLED). Das Regelbuch bleibt nutzbar.',
      };
    }
    const userId = actorUserId(actor);
    if (!userId) {
      return {
        status: 'error',
        code: 'AUTH_DENIED',
        message: 'Nicht angemeldet.',
        httpStatus: 401,
      };
    }
    const decision = deps.authorize(actor);
    if (!decision.allow) {
      return {
        status: 'error',
        code: 'AUTH_DENIED',
        message: 'Keine Berechtigung für Aiberto-Tools.',
        httpStatus: 403,
      };
    }

    if (typeof input.toolId !== 'string' || !input.toolId.trim()) {
      return {
        status: 'error',
        code: 'INVALID_ARGS',
        message: 'toolId fehlt oder ist ungültig.',
        httpStatus: 400,
      };
    }
    const toolIdRaw = input.toolId.trim();
    if (!isAibertoToolId(toolIdRaw) || !getAibertoToolDef(toolIdRaw)) {
      return {
        status: 'error',
        code: 'TOOL_UNKNOWN',
        message: `Unbekanntes Tool: ${toolIdRaw}`,
        httpStatus: 400,
        toolId: toolIdRaw,
      };
    }
    const toolId = toolIdRaw;

    let args: Record<string, unknown> = {};
    if (input.args !== undefined && input.args !== null) {
      if (!isRecord(input.args)) {
        return {
          status: 'error',
          code: 'INVALID_ARGS',
          message: 'args muss ein Objekt sein.',
          httpStatus: 400,
          toolId,
        };
      }
      const encoded = JSON.stringify(input.args);
      if (Buffer.byteLength(encoded, 'utf8') > AIBERTO_TOOLS_MAX_ARGS_BYTES) {
        return {
          status: 'error',
          code: 'INVALID_ARGS',
          message: 'args überschreiten die Größengrenze.',
          httpStatus: 413,
          toolId,
        };
      }
      args = stripElevatedArgs(input.args);
    }

    const budgetKey = `aiberto-tools:${userId}`;
    const limited = consumeAibertoAskRateLimit(
      store,
      budgetKey,
      budget,
      AIBERTO_TOOLS_RATE_WINDOW_SECONDS,
    );
    if (!limited.ok) {
      return {
        status: 'error',
        code: 'BUDGET_EXCEEDED',
        message: 'Tool-Budget erschöpft. Bitte kurz warten.',
        httpStatus: 429,
        toolId,
      };
    }

    try {
      return await dispatchTool(toolId, actor, userId, args);
    } catch {
      return {
        status: 'error',
        code: 'INTERNAL',
        message: 'Tool-Ausführung fehlgeschlagen.',
        httpStatus: 500,
        toolId,
      };
    }
  }

  async function dispatchTool(
    toolId: AibertoToolId,
    actor: Actor,
    userId: string,
    args: Record<string, unknown>,
  ): Promise<AibertoToolInvokeResult> {
    switch (toolId) {
      case 'rulebook.search': {
        if (typeof args.query !== 'string' || !args.query.trim()) {
          return {
            status: 'error',
            code: 'INVALID_ARGS',
            message: 'rulebook.search erfordert query.',
            httpStatus: 400,
            toolId,
          };
        }
        const limit =
          typeof args.limit === 'number' && Number.isFinite(args.limit)
            ? Math.min(Math.max(1, Math.floor(args.limit)), 20)
            : 8;
        const api = await loadRulebook();
        const index = api.getSagaTreeCoreRulebookIndex();
        const hits = api.searchRulebook(index, args.query.trim(), { limit });
        return {
          status: 'ok',
          toolId,
          data: {
            indexRevision: index.manifest.revisionHash,
            hits: hits.map((h) => ({
              sectionId: h.sectionId,
              title: h.title,
              number: h.number,
              normativity: h.normativity,
              score: h.score,
              snippet: h.snippet,
            })),
          },
        };
      }
      case 'rulebook.get_section': {
        if (typeof args.sectionId !== 'string' || !args.sectionId.trim()) {
          return {
            status: 'error',
            code: 'INVALID_ARGS',
            message: 'rulebook.get_section erfordert sectionId.',
            httpStatus: 400,
            toolId,
          };
        }
        const api = await loadRulebook();
        const index = api.getSagaTreeCoreRulebookIndex();
        const section =
          typeof api.getRulebookSection === 'function'
            ? api.getRulebookSection(index, args.sectionId.trim())
            : null;
        if (!section) {
          return {
            status: 'error',
            code: 'NOT_FOUND',
            message: 'Abschnitt nicht gefunden.',
            httpStatus: 404,
            toolId,
          };
        }
        return {
          status: 'ok',
          toolId,
          data: {
            indexRevision: index.manifest.revisionHash,
            section: {
              id: section.id,
              title: section.title,
              number: section.number,
              normativity: section.normativity,
              body: section.body,
            },
          },
        };
      }
      case 'character.list': {
        // Include linked solo owner IDs (Library parity) — never client-supplied.
        const ownerIds = actorIdsForGovernance(actor);
        const merged = new Map<string, ReturnType<typeof toCharacterDto>>();
        for (const ownerId of ownerIds) {
          const result = deps.character.listOwnedCharacters(ownerId);
          if (!result.ok) {
            return {
              status: 'error',
              code: 'INTERNAL',
              message: 'Charakterliste nicht verfügbar.',
              httpStatus: 503,
              toolId,
            };
          }
          for (const row of result.value) {
            if (!merged.has(row.id)) merged.set(row.id, toCharacterDto(row));
          }
        }
        return {
          status: 'ok',
          toolId,
          data: { characters: [...merged.values()] },
        };
      }
      case 'character.get': {
        if (typeof args.characterId !== 'string' || !args.characterId.trim()) {
          return {
            status: 'error',
            code: 'INVALID_ARGS',
            message: 'character.get erfordert characterId.',
            httpStatus: 400,
            toolId,
          };
        }
        const characterId = args.characterId.trim();
        const ownerIds = actorIdsForGovernance(actor);
        let found: ReturnType<typeof toCharacterDto> | null = null;
        for (const ownerId of ownerIds) {
          const result = deps.character.getOwnedCharacter(ownerId, characterId);
          if (!result.ok) {
            return {
              status: 'error',
              code: 'INTERNAL',
              message: 'Charakter nicht verfügbar.',
              httpStatus: 503,
              toolId,
            };
          }
          if (result.value != null) {
            found = toCharacterDto(result.value);
            break;
          }
        }
        if (found == null) {
          // Owned miss covers cross-owner + missing — never leak existence via owner fields.
          return {
            status: 'error',
            code: 'FORBIDDEN',
            message: 'Charakter nicht gefunden oder kein Zugriff.',
            httpStatus: 403,
            toolId,
          };
        }
        return { status: 'ok', toolId, data: { character: found } };
      }
      case 'inventory.list': {
        if (typeof args.characterId !== 'string' || !args.characterId.trim()) {
          return {
            status: 'error',
            code: 'INVALID_ARGS',
            message: 'inventory.list erfordert characterId.',
            httpStatus: 400,
            toolId,
          };
        }
        const characterId = args.characterId.trim();
        const ownerIds = actorIdsForGovernance(actor);
        let owningId: string | null = null;
        for (const ownerId of ownerIds) {
          const owned = deps.character.getOwnedCharacter(ownerId, characterId);
          if (!owned.ok) {
            return {
              status: 'error',
              code: 'INTERNAL',
              message: 'Inventar nicht verfügbar.',
              httpStatus: 503,
              toolId,
            };
          }
          if (owned.value != null) {
            owningId = ownerId;
            break;
          }
        }
        if (owningId == null) {
          return {
            status: 'error',
            code: 'FORBIDDEN',
            message: 'Inventar nicht gefunden oder kein Zugriff.',
            httpStatus: 403,
            toolId,
          };
        }
        const inv = deps.inventory.getOwnedInventory(owningId, characterId);
        if (!inv.ok) {
          return {
            status: 'error',
            code: 'INTERNAL',
            message: 'Inventar nicht verfügbar.',
            httpStatus: 503,
            toolId,
          };
        }
        return {
          status: 'ok',
          toolId,
          data: {
            characterId,
            inventory: inv.value
              ? {
                  characterId: inv.value.characterId,
                  schemaVersion: inv.value.schemaVersion,
                  updatedAt: inv.value.updatedAt,
                  items: inv.value.inventory,
                }
              : null,
          },
        };
      }
      case 'world.get': {
        const worldId =
          typeof args.worldId === 'string' && args.worldId.trim()
            ? args.worldId.trim()
            : null;
        const publicId =
          typeof args.publicId === 'string' && args.publicId.trim()
            ? args.publicId.trim()
            : null;
        if (!worldId && !publicId) {
          return {
            status: 'error',
            code: 'INVALID_ARGS',
            message: 'world.get erfordert worldId oder publicId.',
            httpStatus: 400,
            toolId,
          };
        }
        const result = worldId
          ? deps.world.read.getWorld(actor, worldId)
          : deps.world.read.getWorldByPublicId(actor, publicId!);
        if (!result.ok) {
          const forbidden =
            result.error.includes('not-authorized') ||
            result.error.includes('FORBIDDEN') ||
            result.error.includes('42501') ||
            result.error.includes('not-world');
          return {
            status: 'error',
            code: forbidden ? 'FORBIDDEN' : 'NOT_FOUND',
            message: 'Welt nicht gefunden oder kein Zugriff.',
            httpStatus: forbidden ? 403 : 404,
            toolId,
          };
        }
        // Defense-in-depth: explicit world.read when we have an id.
        const policy = deps.authorizeWorldRead(actor, { worldId: result.value.id });
        if (!policy.allow) {
          return {
            status: 'error',
            code: 'FORBIDDEN',
            message: 'Welt nicht gefunden oder kein Zugriff.',
            httpStatus: 403,
            toolId,
          };
        }
        return {
          status: 'ok',
          toolId,
          data: {
            world: {
              id: result.value.id,
              title: result.value.title,
              createdAt: result.value.createdAt,
              publicId: result.value.publicId,
            },
          },
        };
      }
      case 'session.get_state': {
        if (typeof args.sessionId !== 'string' || !args.sessionId.trim()) {
          return {
            status: 'error',
            code: 'INVALID_ARGS',
            message: 'session.get_state erfordert sessionId.',
            httpStatus: 400,
            toolId,
          };
        }
        if (!deps.session) {
          return {
            status: 'error',
            code: 'INTERNAL',
            message: 'Session-Modul nicht verfügbar.',
            httpStatus: 503,
            toolId,
          };
        }
        const sessionId = args.sessionId.trim();
        const snap = deps.session.queries.getSnapshot(actor, sessionId);
        if (!snap.ok) {
          const forbidden =
            snap.error === 'FORBIDDEN' || snap.error === 'UNAUTHENTICATED';
          return {
            status: 'error',
            code: forbidden ? 'FORBIDDEN' : 'NOT_FOUND',
            message: 'Session nicht gefunden oder kein Zugriff.',
            httpStatus: forbidden ? 403 : 404,
            toolId,
          };
        }
        const membership = deps.session.store.resolveMembership(userId, sessionId);
        if (!membership.ok) {
          return {
            status: 'error',
            code: 'FORBIDDEN',
            message: 'Session nicht gefunden oder kein Zugriff.',
            httpStatus: 403,
            toolId,
          };
        }
        // Server-derived role only — ignore any client-supplied role (stripped above).
        const role: 'gm' | 'player' = membership.canWrite ? 'gm' : 'player';
        const snapshot = snap.snapshot;
        const projected =
          role === 'gm'
            ? {
                sessionId: snapshot.sessionId,
                revision: snapshot.revision,
                status: snapshot.status,
                role,
                roster: snapshot.roster,
                gameplay: snapshot.gameplay,
                updatedAt: snapshot.updatedAt,
                projectId: snap.projectId,
              }
            : {
                sessionId: snapshot.sessionId,
                revision: snapshot.revision,
                status: snapshot.status,
                role,
                roster: snapshot.roster.filter((e) => e.userId === userId),
                gameplay: {
                  sceneId: snapshot.gameplay.sceneId,
                  combatActive: snapshot.gameplay.combatActive,
                  // Players do not receive opaque shared bag (may hold GM secrets).
                  shared: {},
                },
                updatedAt: snapshot.updatedAt,
                projectId: snap.projectId,
              };
        return { status: 'ok', toolId, data: { state: projected } };
      }
      case 'app.navigate': {
        const resolved = resolveNavigateAllowlist(args.route);
        if (!resolved.ok) {
          return {
            status: 'error',
            code: 'INVALID_ARGS',
            message: resolved.message,
            httpStatus: 400,
            toolId,
          };
        }
        return {
          status: 'ok',
          toolId,
          data: { path: resolved.action.path },
          clientAction: resolved.action,
        };
      }
      default: {
        const _exhaustive: never = toolId;
        return {
          status: 'error',
          code: 'TOOL_UNKNOWN',
          message: `Unbekanntes Tool: ${String(_exhaustive)}`,
          httpStatus: 400,
        };
      }
    }
  }

  return { capabilities, invoke };
}

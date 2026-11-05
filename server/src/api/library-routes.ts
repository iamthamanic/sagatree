/**
 * Library HTTP adapters — browser cutover for owned list/create (post-MIG dual-path flip).
 * Location: server/src/api/library-routes.ts
 *
 * Solo loopback may fall back to the host solo actor only when auth is not
 * configured (Local Admin). Plain UNAUTHENTICATED remote sessions stay 401.
 * CSRF stay fail-closed for ORIGIN_DENIED / HOST_DENIED / forged identity.
 */
import type { Hono } from 'hono';
import type { Actor, IdentityPorts } from '../modules/identity/index.ts';
import type { CharacterPorts } from '../modules/character/index.ts';
import type { WorldPorts } from '../modules/world/index.ts';
import type { NpcCreaturePorts } from '../modules/npc-creature/index.ts';
import type { LookProfilePorts } from '../modules/look/index.ts';
import type { InventoryPorts } from '../modules/inventory/index.ts';
import type { ProjectPorts } from '../modules/project/index.ts';
import type { AssetPorts } from '../assets/index.ts';
import { authDenyStatus } from './errors.ts';
import {
  expandPortraitDisplayUrl,
  normalizePortraitStoragePath,
} from './asset-routes.ts';

export type LibraryHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly character?: CharacterPorts | null;
  readonly world?: WorldPorts | null;
  readonly npcCreature?: NpcCreaturePorts | null;
  readonly look?: LookProfilePorts | null;
  readonly inventory?: InventoryPorts | null;
  readonly project?: ProjectPorts | null;
  /** FE-HOST-06 — used to verify portrait display URLs before character save. */
  readonly assets?: AssetPorts | null;
  /** CUT-09 — session count projection (keeps play_sessions SQL in session module). */
  readonly sessionLookup?: {
    readonly countSessionsForProject: (projectId: string) => number;
  } | null;
};

function npcControllerErrorStatus(error: string): 400 | 401 | 403 | 404 | 422 {
  if (error === 'P0001:not authenticated' || error === 'missing-actor') return 401;
  if (
    error === 'P0001:only gm may assign controller' ||
    error === 'P0001:only gm may spawn' ||
    error === 'P0001:only gm may update runtime' ||
    error === 'P0001:only gm may remove' ||
    error === 'P0001:only gm may clear temp controllers' ||
    error === 'P0001:actor is not an active project member' ||
    error === 'P0001:definition not readable' ||
    error === 'not-authorized'
  ) {
    return 403;
  }
  if (error === 'not-found' || error === 'P0001:instance not found' || error === 'P0001:session not found') {
    return 404;
  }
  if (
    error === 'P0001:missing project' ||
    error === 'P0001:invalid definition id' ||
    error === 'P0001:invalid controller id' ||
    error === 'P0001:controller is not an active project member' ||
    error === 'P0001:definition is not a full character sheet' ||
    error === 'P0001:invalid instance kind' ||
    error === 'P0001:invalid display name' ||
    error === 'P0001:invalid sequence number' ||
    error === 'P0001:invalid snapshot' ||
    error === 'P0001:invalid runtime' ||
    error === 'P0001:persistent instances must not bind a session' ||
    error === 'P0001:session does not belong to project' ||
    error === 'P0001:temporary controller is not an active project member' ||
    error === 'P0001:invalid temporary controller'
  ) {
    return 422;
  }
  return 400;
}

function normalizeHostname(hostname: string): string {
  const raw = hostname.trim().toLowerCase();
  if (raw.startsWith('[') && raw.endsWith(']')) return raw.slice(1, -1);
  return raw;
}

function isLoopbackHost(hostname: string | null): boolean {
  if (!hostname) return false;
  const host = normalizeHostname(hostname);
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function requestHostName(headers: Headers): string | null {
  const host = headers.get('host');
  if (!host) return null;
  try {
    return normalizeHostname(new URL(`http://${host}`).hostname);
  } catch {
    return null;
  }
}

function soloLoopbackAllowed(headers: Headers): boolean {
  if (!isLoopbackHost(requestHostName(headers))) return false;
  const origin = headers.get('origin');
  if (!origin) return true;
  try {
    return isLoopbackHost(normalizeHostname(new URL(origin).hostname));
  } catch {
    return false;
  }
}

/** Remote actors may own personal rows under linked solo ids (MIG-015). */
function libraryActorIds(actor: Actor): readonly string[] {
  const ids = [actor.actorId];
  if (
    actor.kind === 'remote-account' &&
    Array.isArray(actor.linkedSoloActorIds)
  ) {
    for (const id of actor.linkedSoloActorIds) {
      if (typeof id === 'string' && id.length > 0 && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

async function resolveLibraryActor(
  deps: LibraryHttpDeps,
  headers: Headers,
): Promise<{ ok: true; actor: Actor } | { ok: false; status: number; error: string }> {
  const remote = await deps.identity.resolveRemoteSession(headers, {
    allowSameOriginRead: true,
  });
  if (remote.ok) return { ok: true, actor: remote.actor };
  // Match AI routes: solo loopback only when auth is not configured — never
  // mint a solo actor for plain UNAUTHENTICATED remote sessions.
  if (
    deps.hostMode === 'solo' &&
    remote.code === 'AUTH_NOT_CONFIGURED' &&
    soloLoopbackAllowed(headers)
  ) {
    return { ok: true, actor: deps.identity.resolveSoloActor() };
  }
  return { ok: false, status: authDenyStatus(remote.code), error: remote.code };
}

function sheetClassRace(sheet: Readonly<Record<string, unknown>>): {
  classLabel: string;
  raceLabel: string;
} {
  const classLabel =
    (typeof sheet.class === 'string' && sheet.class) ||
    (typeof sheet.classLabel === 'string' && sheet.classLabel) ||
    (typeof sheet.archetype === 'string' && sheet.archetype) ||
    (typeof sheet.archetypeKey === 'string' && sheet.archetypeKey) ||
    '';
  const raceLabel =
    (typeof sheet.race === 'string' && sheet.race) ||
    (typeof sheet.raceLabel === 'string' && sheet.raceLabel) ||
    (typeof sheet.species === 'string' && sheet.species) ||
    (typeof sheet.raceKey === 'string' && sheet.raceKey) ||
    '';
  return { classLabel, raceLabel };
}

function mapCharacterRow(
  row: {
    readonly id: string;
    readonly publicId: string;
    readonly name: string;
    readonly description: string;
    readonly level: number;
    readonly sheetStatus: string;
    readonly portraitStoragePath: string | null;
    readonly sheet: Readonly<Record<string, unknown>>;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly characterType: string;
  },
  origin: string,
) {
  const { classLabel, raceLabel } = sheetClassRace(row.sheet);
  return {
    id: row.id,
    publicId: row.publicId,
    name: row.name,
    description: row.description,
    class: classLabel,
    race: raceLabel,
    level: row.level,
    sheetStatus: row.sheetStatus === 'draft' ? 'incomplete' : row.sheetStatus,
    portraitUrl: expandPortraitDisplayUrl(row.portraitStoragePath, origin),
    sheet: row.sheet,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** CUT-08 — FE CharacterPresetDto / Vm wire shape. */
function mapPresetProduct(row: {
  readonly id: string;
  readonly ownerUserId: string;
  readonly displayName: string;
  readonly rulesetKey: string;
  readonly origin: 'user' | 'system';
  readonly sourceCharacterId: string | null;
  readonly sourceCharacterMissing: boolean;
  readonly published: boolean;
  readonly versions: readonly {
    readonly level: number;
    readonly snapshot: Readonly<Record<string, unknown>>;
    readonly created_at: string;
  }[];
  readonly createdAt: string;
  readonly updatedAt: string;
}) {
  return {
    id: row.id,
    owner_user_id: row.ownerUserId,
    display_name: row.displayName,
    ruleset_key: row.rulesetKey,
    origin: row.origin,
    source_character_id: row.sourceCharacterId,
    source_character_missing: row.sourceCharacterMissing,
    published: row.published,
    versions: row.versions,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function presetProductErrorStatus(error: string): 400 | 403 | 404 | 409 | 422 | 503 {
  if (error === 'store-unavailable') return 503;
  if (error === 'not-authorized') return 403;
  if (error === 'not-found') return 404;
  if (error === 'invalid-character-id' || error === 'invalid-preset-id') return 422;
  if (/bereits eine Preset-Version|bereits ein Preset/i.test(error)) return 409;
  return 400;
}

/** CUT-11 — FE AvatarArtifactV2 wire shape. */
function mapAvatarArtifact(row: {
  readonly artifactId: string;
  readonly ownerUserId: string;
  readonly characterId: string | null;
  readonly origin: string;
  readonly assetKey: string;
  readonly storagePath: string;
  readonly format: string;
  readonly analysisStatus: string;
  readonly materializationStatus: string;
  readonly isActive: boolean;
  readonly schemaVersion: 2;
  readonly importAssetId: string | null;
  readonly generateJobId: string | null;
  readonly templateId: string | null;
  readonly providerId: string | null;
  readonly idempotencyKey: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}) {
  return {
    contractVersion: 'SagaTreeAvatarArtifactV2',
    artifactId: row.artifactId,
    ownerUserId: row.ownerUserId,
    characterId: row.characterId,
    source: {
      origin: row.origin,
      importAssetId: row.importAssetId ?? undefined,
      generateJobId: row.generateJobId ?? undefined,
      templateId: row.templateId ?? undefined,
      providerId: row.providerId ?? undefined,
    },
    asset: {
      assetKey: row.assetKey,
      storagePath: row.storagePath,
      format: row.format,
    },
    analysisStatus: row.analysisStatus,
    materializationStatus: row.materializationStatus,
    isActive: row.isActive,
    schemaVersion: 2 as const,
    idempotencyKey: row.idempotencyKey ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function avatarArtifactErrorStatus(error: string): 400 | 403 | 404 | 422 | 503 {
  if (error === 'store-unavailable') return 503;
  if (error === 'not-authorized' || error === 'foreign-character-owner') return 403;
  if (error === 'not-found') return 404;
  if (
    error === 'invalid-artifact-id' ||
    error === 'invalid-asset-key' ||
    error === 'invalid-storage-path' ||
    error === 'invalid-origin' ||
    error === 'invalid-format' ||
    error === 'asset-key-owner-mismatch' ||
    error === 'analysis-escalation-forbidden' ||
    error === 'analysis-not-authoritative'
  ) {
    return 422;
  }
  return 400;
}

/**
 * Mount library list/create endpoints used by the Vite Library screen.
 */
export function mountLibraryHttpRoutes(app: Hono, deps: LibraryHttpDeps): void {
  app.get('/api/v1/library/characters', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character) {
      return c.json({ characters: [] }, 200);
    }
    // MIG-015: Dornhain pregens are seeded under the host solo actor; honor links.
    const byId = new Map<string, ReturnType<typeof mapCharacterRow>>();
    const origin = new URL(c.req.url).origin;
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const listed = deps.character.listOwnedCharacters(ownerId);
      if (!listed.ok) {
        return c.json({ error: listed.error }, listed.error === 'store-unavailable' ? 503 : 400);
      }
      for (const row of listed.value) {
        if (row.characterType !== 'pc') continue;
        byId.set(row.id, mapCharacterRow(row, origin));
      }
    }
    return c.json({ characters: [...byId.values()] }, 200);
  });

  app.post('/api/v1/library/characters', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
    const name = typeof record.name === 'string' ? record.name : '';
    const description = typeof record.description === 'string' ? record.description : '';
    const classLabel = typeof record.class === 'string' ? record.class : '';
    const raceLabel = typeof record.race === 'string' ? record.race : '';
    const level = typeof record.level === 'number' ? record.level : 1;
    const sheet =
      record.sheet && typeof record.sheet === 'object' && !Array.isArray(record.sheet)
        ? (record.sheet as Record<string, unknown>)
        : {
            class: classLabel,
            race: raceLabel,
            classLabel,
            raceLabel,
            attributes: record.attributes,
            skills: record.skills,
            sagatreeProfile: record.sagatree_profile,
            notes: record.notes,
            appearance: record.appearance,
            inventory: record.inventory,
          };
    // Host sheet completeness gate is stricter than FE create — default draft unless
    // the client explicitly marks complete (editor save with full sheet).
    const sheetStatus =
      record.sheet_status === 'complete'
        ? 'complete'
        : record.sheet_status === 'incomplete'
          ? 'incomplete'
          : 'draft';
    const created = deps.character.createOwnedCharacter(actorResult.actor.actorId, {
      name,
      description,
      level,
      sheetStatus,
      sheet,
      characterType: 'pc',
    });
    if (!created.ok) {
      return c.json(
        { error: created.error },
        created.error === 'store-unavailable' ? 503 : 400,
      );
    }
    return c.json({ character: mapCharacterRow(created.value, new URL(c.req.url).origin) }, 201);
  });

  app.get('/api/v1/library/characters/:id', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const id = c.req.param('id');
    let found: ReturnType<typeof mapCharacterRow> | null = null;
    let lastError: string | null = null;
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const got = deps.character.getOwnedCharacter(ownerId, id);
      if (!got.ok) {
        lastError = got.error;
        continue;
      }
      if (got.value) {
        found = mapCharacterRow(got.value, new URL(c.req.url).origin);
        break;
      }
    }
    if (!found) {
      if (lastError === 'not-authorized') {
        return c.json({ error: 'not-authorized' }, 403);
      }
      return c.json({ error: 'not-found' }, 404);
    }
    return c.json({ character: found }, 200);
  });

  app.patch('/api/v1/library/characters/:id', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
    const id = c.req.param('id');
    const portraitRaw =
      'portrait_url' in record
        ? record.portrait_url
        : 'portraitStoragePath' in record
          ? record.portraitStoragePath
          : undefined;
    const portraitNorm = normalizePortraitStoragePath(
      actorResult.actor,
      portraitRaw,
      deps.assets,
    );
    if (!portraitNorm.ok) {
      return c.json({ error: portraitNorm.error }, 400);
    }
    let updated: ReturnType<NonNullable<LibraryHttpDeps['character']>['updateOwnedCharacter']> | null =
      null;
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const attempt = deps.character.updateOwnedCharacter(ownerId, id, {
        name: record.name,
        description: record.description,
        level: record.level,
        sheetStatus: record.sheet_status ?? record.sheetStatus,
        sheet: record.sheet,
        portraitStoragePath: portraitNorm.value,
        characterType: 'pc',
      });
      if (attempt.ok) {
        updated = attempt;
        break;
      }
      // Try linked solo owner when remote id is not the row owner.
      if (attempt.error !== 'not-authorized' && attempt.error !== 'not-found') {
        updated = attempt;
        break;
      }
      updated = attempt;
    }
    if (!updated || !updated.ok) {
      const err = updated && !updated.ok ? updated.error : 'not-found';
      return c.json(
        { error: err },
        err === 'not-authorized'
          ? 403
          : err === 'not-found'
            ? 404
            : err === 'store-unavailable'
              ? 503
              : 400,
      );
    }
    return c.json({ character: mapCharacterRow(updated.value, new URL(c.req.url).origin) }, 200);
  });

  app.delete('/api/v1/library/characters/:id', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const id = c.req.param('id');
    // MIG-015: solo-seeded rows (e.g. Test Held) delete under linked solo owner id.
    let deleted: ReturnType<
      NonNullable<LibraryHttpDeps['character']>['deleteOwnedCharacter']
    > | null = null;
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const attempt = deps.character.deleteOwnedCharacter(ownerId, id);
      if (attempt.ok) {
        deleted = attempt;
        break;
      }
      if (attempt.error !== 'not-authorized' && attempt.error !== 'not-found') {
        deleted = attempt;
        break;
      }
      deleted = attempt;
    }
    if (!deleted || !deleted.ok) {
      const err = deleted && !deleted.ok ? deleted.error : 'not-found';
      return c.json(
        { error: err },
        err === 'not-authorized' ? 403 : err === 'not-found' ? 404 : 400,
      );
    }
    return c.json({ ok: true, id: deleted.value.id }, 200);
  });

  /** CUT-08 — list owner user character presets. */
  app.get('/api/v1/library/character-presets', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.listUserPresets) {
      return c.json({ presets: [] }, 200);
    }
    const byId = new Map<string, ReturnType<typeof mapPresetProduct>>();
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const listed = deps.character.listUserPresets(ownerId);
      if (!listed.ok) {
        return c.json(
          { error: listed.error },
          listed.error === 'store-unavailable' ? 503 : 400,
        );
      }
      for (const row of listed.value) {
        byId.set(row.id, mapPresetProduct(row));
      }
    }
    return c.json({ presets: [...byId.values()] }, 200);
  });

  /** CUT-08 — preset linked to a source character (or null). */
  app.get('/api/v1/library/character-presets/by-character/:characterId', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.getPresetForCharacter) {
      return c.json({ preset: null }, 200);
    }
    const characterId = c.req.param('characterId');
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const got = deps.character.getPresetForCharacter(ownerId, characterId);
      if (!got.ok) {
        return c.json({ error: got.error }, presetProductErrorStatus(got.error));
      }
      if (got.value) {
        return c.json({ preset: mapPresetProduct(got.value) }, 200);
      }
    }
    return c.json({ preset: null }, 200);
  });

  /** CUT-08 — create preset from owned character snapshot. */
  app.post('/api/v1/library/character-presets', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.createPresetFromCharacter) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const displayName = typeof record.displayName === 'string' ? record.displayName : '';
    const rulesetKey = typeof record.rulesetKey === 'string' ? record.rulesetKey : '';
    const sourceCharacterId =
      typeof record.sourceCharacterId === 'string' ? record.sourceCharacterId : '';
    const snapshot =
      record.snapshot && typeof record.snapshot === 'object' && !Array.isArray(record.snapshot)
        ? (record.snapshot as Record<string, unknown>)
        : null;
    if (!snapshot) {
      return c.json({ error: 'invalid-snapshot' }, 400);
    }
    // MIG-015: linked solo-owned characters are listed under libraryActorIds — create
    // under the same owner that actually owns the source character.
    let created: ReturnType<
      NonNullable<LibraryHttpDeps['character']>['createPresetFromCharacter']
    > | null = null;
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const attempt = deps.character.createPresetFromCharacter(ownerId, {
        displayName,
        rulesetKey,
        sourceCharacterId,
        snapshot,
      });
      if (attempt.ok) {
        created = attempt;
        break;
      }
      if (
        attempt.error !== 'not-found' &&
        attempt.error !== 'not-authorized' &&
        !/bereits ein Preset/i.test(attempt.error)
      ) {
        created = attempt;
        break;
      }
      created = attempt;
    }
    if (!created || !created.ok) {
      const err = created && !created.ok ? created.error : 'not-found';
      return c.json({ error: err }, presetProductErrorStatus(err));
    }
    return c.json({ preset: mapPresetProduct(created.value) }, 201);
  });

  /** CUT-08 — append level version (publish revision). */
  app.post('/api/v1/library/character-presets/:id/versions', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.releasePresetVersion) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const snapshot =
      record.snapshot && typeof record.snapshot === 'object' && !Array.isArray(record.snapshot)
        ? (record.snapshot as Record<string, unknown>)
        : null;
    if (!snapshot) {
      return c.json({ error: 'invalid-snapshot' }, 400);
    }
    const presetId = c.req.param('id');
    let released: ReturnType<
      NonNullable<LibraryHttpDeps['character']>['releasePresetVersion']
    > | null = null;
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const attempt = deps.character.releasePresetVersion(ownerId, presetId, snapshot);
      if (attempt.ok) {
        released = attempt;
        break;
      }
      if (attempt.error !== 'not-found' && attempt.error !== 'not-authorized') {
        released = attempt;
        break;
      }
      released = attempt;
    }
    if (!released || !released.ok) {
      const err = released && !released.ok ? released.error : 'not-found';
      return c.json({ error: err }, presetProductErrorStatus(err));
    }
    return c.json({ preset: mapPresetProduct(released.value) }, 201);
  });

  /** CUT-08 — rename display name. */
  app.patch('/api/v1/library/character-presets/:id', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.renamePreset) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const displayName = typeof record.displayName === 'string' ? record.displayName : '';
    const presetId = c.req.param('id');
    let renamed: ReturnType<
      NonNullable<LibraryHttpDeps['character']>['renamePreset']
    > | null = null;
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const attempt = deps.character.renamePreset(ownerId, presetId, displayName);
      if (attempt.ok) {
        renamed = attempt;
        break;
      }
      if (attempt.error !== 'not-found' && attempt.error !== 'not-authorized') {
        renamed = attempt;
        break;
      }
      renamed = attempt;
    }
    if (!renamed || !renamed.ok) {
      const err = renamed && !renamed.ok ? renamed.error : 'not-found';
      return c.json({ error: err }, presetProductErrorStatus(err));
    }
    return c.json({ preset: mapPresetProduct(renamed.value) }, 200);
  });

  /** CUT-08 — duplicate (clears source character link). */
  app.post('/api/v1/library/character-presets/:id/duplicate', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.duplicatePreset) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const presetId = c.req.param('id');
    let duplicated: ReturnType<
      NonNullable<LibraryHttpDeps['character']>['duplicatePreset']
    > | null = null;
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const attempt = deps.character.duplicatePreset(ownerId, presetId);
      if (attempt.ok) {
        duplicated = attempt;
        break;
      }
      if (attempt.error !== 'not-found' && attempt.error !== 'not-authorized') {
        duplicated = attempt;
        break;
      }
      duplicated = attempt;
    }
    if (!duplicated || !duplicated.ok) {
      const err = duplicated && !duplicated.ok ? duplicated.error : 'not-found';
      return c.json({ error: err }, presetProductErrorStatus(err));
    }
    return c.json({ preset: mapPresetProduct(duplicated.value) }, 201);
  });

  /** CUT-09 — list/sync adventure arcs for an owned character. */
  app.get('/api/v1/library/characters/:id/adventure-arcs', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.syncAndListAdventureArcs || !deps.project?.listMembershipsByCharacter) {
      return c.json({ arcs: [] }, 200);
    }
    const characterId = c.req.param('id');
    const memberships = deps.project.listMembershipsByCharacter(characterId);
    let listed: ReturnType<
      NonNullable<LibraryHttpDeps['character']>['syncAndListAdventureArcs']
    > | null = null;
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const attempt = deps.character.syncAndListAdventureArcs(
        ownerId,
        characterId,
        memberships,
      );
      if (attempt.ok) {
        listed = attempt;
        break;
      }
      if (attempt.error !== 'not-found' && attempt.error !== 'not-authorized') {
        listed = attempt;
        break;
      }
      listed = attempt;
    }
    if (!listed || !listed.ok) {
      const err = listed && !listed.ok ? listed.error : 'not-found';
      return c.json(
        { error: err },
        err === 'not-authorized' ? 403 : err === 'not-found' ? 404 : 400,
      );
    }
    const arcs = listed.value.map((arc) => {
      const project = deps.project?.getProject(arc.projectId);
      const projectName =
        project?.ok === true ? project.value.title : 'Unbekanntes Abenteuer';
      const projectStatus =
        project?.ok === true ? project.value.status : null;
      const sessionCount =
        deps.sessionLookup?.countSessionsForProject(arc.projectId) ?? 0;
      return {
        id: arc.id,
        character_id: arc.characterId,
        project_id: arc.projectId,
        project_name: projectName,
        project_status: projectStatus,
        session_count: sessionCount,
        status: arc.status,
        started_at: arc.startedAt,
        ended_at: arc.endedAt,
        summary: arc.summary,
        developments: arc.developments,
        created_at: arc.createdAt,
        updated_at: arc.updatedAt,
      };
    });
    return c.json({ arcs }, 200);
  });

  /** CUT-09 — append development entry to owned arc. */
  app.post('/api/v1/library/adventure-arcs/:id/developments', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.appendAdventureDevelopment) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const kind = typeof record.kind === 'string' ? record.kind : '';
    const title = typeof record.title === 'string' ? record.title : '';
    const detail = typeof record.detail === 'string' ? record.detail : undefined;
    const meta =
      record.meta && typeof record.meta === 'object' && !Array.isArray(record.meta)
        ? (record.meta as Record<string, unknown>)
        : undefined;
    if (
      kind !== 'level' &&
      kind !== 'species-trait' &&
      kind !== 'skill' &&
      kind !== 'note'
    ) {
      return c.json({ error: 'Ungültige Entwicklungsart.' }, 400);
    }
    const arcId = c.req.param('id');
    let appended: ReturnType<
      NonNullable<LibraryHttpDeps['character']>['appendAdventureDevelopment']
    > | null = null;
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const attempt = deps.character.appendAdventureDevelopment(ownerId, arcId, {
        kind,
        title,
        detail,
        meta,
      });
      if (attempt.ok) {
        appended = attempt;
        break;
      }
      if (attempt.error !== 'not-found' && attempt.error !== 'not-authorized') {
        appended = attempt;
        break;
      }
      appended = attempt;
    }
    if (!appended || !appended.ok) {
      const err = appended && !appended.ok ? appended.error : 'not-found';
      return c.json(
        { error: err },
        err === 'not-authorized' ? 403 : err === 'not-found' ? 404 : 400,
      );
    }
    const arc = appended.value;
    const project = deps.project?.getProject(arc.projectId);
    return c.json(
      {
        arc: {
          id: arc.id,
          character_id: arc.characterId,
          project_id: arc.projectId,
          project_name: project?.ok === true ? project.value.title : 'Unbenanntes Abenteuer',
          project_status: project?.ok === true ? project.value.status : null,
          session_count:
            deps.sessionLookup?.countSessionsForProject(arc.projectId) ?? 0,
          status: arc.status,
          started_at: arc.startedAt,
          ended_at: arc.endedAt,
          summary: arc.summary,
          developments: arc.developments,
          created_at: arc.createdAt,
          updated_at: arc.updatedAt,
        },
      },
      201,
    );
  });

  /** CUT-11 — list owner avatar artifacts. */
  app.get('/api/v1/library/avatar-artifacts', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.listAvatarArtifacts) {
      return c.json({ artifacts: [] }, 200);
    }
    const characterIdRaw = c.req.query('characterId');
    const options =
      characterIdRaw === undefined
        ? {}
        : characterIdRaw === '' || characterIdRaw === 'null'
          ? { characterId: null as string | null }
          : { characterId: characterIdRaw };
    const byId = new Map<string, ReturnType<typeof mapAvatarArtifact>>();
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const listed = deps.character.listAvatarArtifacts(ownerId, options);
      if (!listed.ok) continue;
      for (const row of listed.value) {
        byId.set(row.artifactId, mapAvatarArtifact(row));
      }
    }
    return c.json({ artifacts: [...byId.values()] }, 200);
  });

  /** CUT-11 — get one owned avatar artifact. */
  app.get('/api/v1/library/avatar-artifacts/:id', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.getAvatarArtifactById) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const artifactId = c.req.param('id');
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const got = deps.character.getAvatarArtifactById(ownerId, artifactId);
      if (got.ok && got.value) {
        return c.json({ artifact: mapAvatarArtifact(got.value) }, 200);
      }
    }
    return c.json({ error: 'not-found' }, 404);
  });

  /** CUT-11 — create inactive avatar artifact (idempotent). */
  app.post('/api/v1/library/avatar-artifacts', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.createAvatarArtifact) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const source =
      record.source && typeof record.source === 'object' && !Array.isArray(record.source)
        ? (record.source as Record<string, unknown>)
        : {};
    const asset =
      record.asset && typeof record.asset === 'object' && !Array.isArray(record.asset)
        ? (record.asset as Record<string, unknown>)
        : {};
    const origin = typeof source.origin === 'string' ? source.origin : typeof record.origin === 'string' ? record.origin : '';
    const assetKey =
      typeof asset.assetKey === 'string'
        ? asset.assetKey
        : typeof record.assetKey === 'string'
          ? record.assetKey
          : '';
    const storagePath =
      typeof asset.storagePath === 'string'
        ? asset.storagePath
        : typeof record.storagePath === 'string'
          ? record.storagePath
          : '';
    const format =
      typeof asset.format === 'string'
        ? asset.format
        : typeof record.format === 'string'
          ? record.format
          : '';
    const artifactId =
      typeof record.artifactId === 'string'
        ? record.artifactId
        : typeof record.id === 'string'
          ? record.id
          : undefined;
    const characterId =
      record.characterId === null
        ? null
        : typeof record.characterId === 'string'
          ? record.characterId
          : undefined;
    const materializationStatus =
      typeof record.materializationStatus === 'string'
        ? record.materializationStatus
        : 'materialized';

    let created: ReturnType<
      NonNullable<LibraryHttpDeps['character']>['createAvatarArtifact']
    > | null = null;
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const attempt = deps.character.createAvatarArtifact(ownerId, {
        artifactId,
        characterId,
        origin: origin as 'sagadrive' | 'import' | 'generate',
        assetKey,
        storagePath,
        format: format as 'vrm' | 'glb' | 'template',
        materializationStatus: materializationStatus as
          | 'draft'
          | 'materialized'
          | 'failed'
          | 'superseded',
        importAssetId:
          typeof source.importAssetId === 'string' ? source.importAssetId : null,
        generateJobId:
          typeof source.generateJobId === 'string' ? source.generateJobId : null,
        templateId: typeof source.templateId === 'string' ? source.templateId : null,
        providerId: typeof source.providerId === 'string' ? source.providerId : null,
        idempotencyKey:
          typeof record.idempotencyKey === 'string' ? record.idempotencyKey : null,
      });
      if (attempt.ok) {
        created = attempt;
        break;
      }
      if (attempt.error !== 'not-found' && attempt.error !== 'not-authorized') {
        created = attempt;
        break;
      }
      created = attempt;
    }
    if (!created || !created.ok) {
      const err = created && !created.ok ? created.error : 'create-failed';
      return c.json({ error: err }, avatarArtifactErrorStatus(err));
    }
    return c.json({ artifact: mapAvatarArtifact(created.value) }, 201);
  });

  /** CUT-11 — activate one owned artifact. */
  app.post('/api/v1/library/avatar-artifacts/:id/activate', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.activateAvatarArtifact) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const artifactId = c.req.param('id');
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const result = deps.character.activateAvatarArtifact(ownerId, artifactId);
      if (result.ok) {
        return c.json({ ok: true, artifact: mapAvatarArtifact(result.artifact) }, 200);
      }
      if (!/nicht gefunden|fremder Owner/i.test(result.reasonDe)) {
        return c.json({ ok: false, reasonDe: result.reasonDe }, 400);
      }
    }
    return c.json(
      { ok: false, reasonDe: 'Artefakt nicht gefunden oder fremder Owner.' },
      404,
    );
  });

  /** CUT-11 — persist authoritative analysis (host-trusted). */
  app.post('/api/v1/library/avatar-artifacts/:id/analysis', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.persistAuthoritativeArtifactAnalysis) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const result =
      record.result && typeof record.result === 'object' && !Array.isArray(record.result)
        ? (record.result as Record<string, unknown>)
        : record;
    const authoritative = result.authoritative === true;
    const status = typeof result.status === 'string' ? result.status : '';
    const artifactId = c.req.param('id');
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const attempt = deps.character.persistAuthoritativeArtifactAnalysis(ownerId, artifactId, {
        authoritative,
        status,
      });
      if (attempt.ok) {
        return c.json({ ok: true }, 200);
      }
      if (attempt.error !== 'not-found') {
        return c.json({ error: attempt.error }, avatarArtifactErrorStatus(attempt.error));
      }
    }
    return c.json({ error: 'not-found' }, 404);
  });

  /** CUT-08 — delete owner user preset. */
  app.delete('/api/v1/library/character-presets/:id', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.character?.deletePreset) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const presetId = c.req.param('id');
    let deleted: ReturnType<
      NonNullable<LibraryHttpDeps['character']>['deletePreset']
    > | null = null;
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const attempt = deps.character.deletePreset(ownerId, presetId);
      if (attempt.ok) {
        deleted = attempt;
        break;
      }
      if (attempt.error !== 'not-found' && attempt.error !== 'not-authorized') {
        deleted = attempt;
        break;
      }
      deleted = attempt;
    }
    if (!deleted || !deleted.ok) {
      const err = deleted && !deleted.ok ? deleted.error : 'not-found';
      return c.json({ error: err }, presetProductErrorStatus(err));
    }
    return c.json({ ok: true, id: deleted.value.id }, 200);
  });

  app.get('/api/v1/library/worlds', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.world?.read?.listOwnedWorlds) {
      return c.json({ worlds: [] }, 200);
    }
    const listed = deps.world.read.listOwnedWorlds(actorResult.actor);
    if (!listed.ok) {
      return c.json({ error: listed.error }, 503);
    }
    return c.json({ worlds: listed.value }, 200);
  });

  /** CUT-10 — authorized world profile by WO- public id. */
  app.get('/api/v1/library/worlds/by-public-id/:publicId', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.world?.read?.getWorldByPublicId) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const lookedUp = deps.world.read.getWorldByPublicId(
      actorResult.actor,
      c.req.param('publicId'),
    );
    if (!lookedUp.ok) {
      return c.json(
        { error: lookedUp.error },
        lookedUp.error === 'world-not-found' || lookedUp.error === 'missing-world'
          ? 404
          : lookedUp.error === 'not-authorized'
            ? 404
            : 400,
      );
    }
    return c.json({ world: lookedUp.value }, 200);
  });

  app.post('/api/v1/library/worlds', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.world?.createOwnedWorld) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
    const title = typeof record.name === 'string' ? record.name : typeof record.title === 'string' ? record.title : '';
    const created = deps.world.createOwnedWorld(actorResult.actor, title);
    if (!created.ok) {
      return c.json({ error: created.error }, 400);
    }
    return c.json({ world: created.value }, 201);
  });

  app.patch('/api/v1/library/worlds/:id', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.world?.updateOwnedWorld) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
    const title = typeof record.name === 'string' ? record.name : typeof record.title === 'string' ? record.title : '';
    const updated = deps.world.updateOwnedWorld(actorResult.actor, c.req.param('id'), title);
    if (!updated.ok) {
      return c.json(
        { error: updated.error },
        updated.error === 'not-authorized' ? 403 : updated.error === 'world-not-found' ? 404 : 400,
      );
    }
    return c.json({ world: updated.value }, 200);
  });

  app.delete('/api/v1/library/worlds/:id', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.world?.deleteOwnedWorld) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const deleted = deps.world.deleteOwnedWorld(actorResult.actor, c.req.param('id'));
    if (!deleted.ok) {
      return c.json(
        { error: deleted.error },
        deleted.error === 'not-authorized' ? 403 : deleted.error === 'world-not-found' ? 404 : 400,
      );
    }
    return c.json({ ok: true }, 200);
  });

  app.get('/api/v1/library/npc-creatures', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.npcCreature?.listDefinitions) {
      return c.json({ definitions: [] }, 200);
    }
    const listed = deps.npcCreature.listDefinitions(actorResult.actor, {});
    if (!listed.ok) {
      return c.json({ error: listed.error }, 503);
    }
    return c.json({ definitions: listed.value }, 200);
  });

  /** CUT-03 — list adventure/session instances for a project. */
  app.get('/api/v1/library/npc-instances', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.npcCreature?.listInstances) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const projectId = c.req.query('projectId')?.trim() ?? '';
    if (!projectId) return c.json({ error: 'P0001:missing project' }, 422);
    const listed = deps.npcCreature.listInstances(actorResult.actor, projectId);
    if (!listed.ok) {
      return c.json({ error: listed.error }, npcControllerErrorStatus(listed.error));
    }
    return c.json({ instances: listed.value }, 200);
  });

  /**
   * CUT-03 — spawn instance. Body mirrors planned domain spawn payload
   * (snapshot/runtime/displayName/sequenceNumber); actor is session-only.
   */
  app.post('/api/v1/library/npc-instances', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.npcCreature?.spawnInstance) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const projectId = typeof record.projectId === 'string' ? record.projectId.trim() : '';
    const definitionId =
      typeof record.definitionId === 'string' ? record.definitionId.trim() : '';
    const instanceKind =
      typeof record.instanceKind === 'string' ? record.instanceKind.trim() : '';
    const displayName =
      typeof record.displayName === 'string' ? record.displayName : '';
    const sequenceNumber =
      typeof record.sequenceNumber === 'number' ? record.sequenceNumber : NaN;
    let sessionId: string | null = null;
    if (Object.prototype.hasOwnProperty.call(record, 'sessionId')) {
      if (record.sessionId === null) {
        sessionId = null;
      } else if (typeof record.sessionId === 'string') {
        sessionId = record.sessionId;
      } else {
        return c.json({ error: 'P0001:session does not belong to project' }, 422);
      }
    }
    if (!projectId || !definitionId) {
      return c.json({ error: 'P0001:missing project' }, 422);
    }
    const spawned = deps.npcCreature.spawnInstance(actorResult.actor, {
      projectId,
      definitionId,
      instanceKind,
      snapshot: record.snapshot,
      runtime: record.runtime,
      displayName,
      sequenceNumber,
      sessionId,
    });
    if (!spawned.ok) {
      return c.json({ error: spawned.error }, npcControllerErrorStatus(spawned.error));
    }
    return c.json({ instance: spawned.value }, 201);
  });

  /** CUT-03 — update instance runtime only (snapshot frozen). */
  app.patch('/api/v1/library/npc-instances/:instanceId/runtime', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.npcCreature?.updateRuntime) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const updated = deps.npcCreature.updateRuntime(
      actorResult.actor,
      c.req.param('instanceId'),
      record.runtime,
    );
    if (!updated.ok) {
      return c.json({ error: updated.error }, npcControllerErrorStatus(updated.error));
    }
    return c.json({ instance: updated.value }, 200);
  });

  /** CUT-03 — remove instance (definition untouched). */
  app.delete('/api/v1/library/npc-instances/:instanceId', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.npcCreature?.removeInstance) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const removed = deps.npcCreature.removeInstance(
      actorResult.actor,
      c.req.param('instanceId'),
    );
    if (!removed.ok) {
      return c.json({ error: removed.error }, npcControllerErrorStatus(removed.error));
    }
    return c.json({ ok: true, id: removed.value.id }, 200);
  });

  /** Single definition by id (includes archived when readable) — CUT-03 spawn resolve. */
  app.get('/api/v1/library/npc-creatures/:id', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.npcCreature?.getDefinition) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const loaded = deps.npcCreature.getDefinition(actorResult.actor, c.req.param('id'));
    if (!loaded.ok) {
      return c.json(
        { error: loaded.error },
        loaded.error === 'not-authorized' ? 403 : npcControllerErrorStatus(loaded.error),
      );
    }
    if (!loaded.value) {
      return c.json({ error: 'not-found' }, 404);
    }
    return c.json({ definition: loaded.value }, 200);
  });

  app.post('/api/v1/library/npc-creatures', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.npcCreature?.createDefinition) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const scope = record.scope === 'world' ? 'world' : record.scope === 'personal' ? 'personal' : null;
    if (!scope) return c.json({ error: '22023' }, 422);
    const worldProfileId =
      typeof record.worldProfileId === 'string' ? record.worldProfileId : null;
    const draft = 'draft' in record ? record.draft : record;
    const created = deps.npcCreature.createDefinition(actorResult.actor, {
      scope,
      worldProfileId,
      draft,
    });
    if (!created.ok) {
      const status =
        created.error === 'not-authorized'
          ? 403
          : created.error === 'missing-world-profile' || created.error === '22023'
            ? 422
            : 400;
      return c.json({ error: created.error }, status);
    }
    return c.json({ definition: created.value }, 201);
  });

  app.patch('/api/v1/library/npc-creatures/:id', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.npcCreature?.updateDefinition) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const draft = 'draft' in record ? record.draft : record;
    const updated = deps.npcCreature.updateDefinition(
      actorResult.actor,
      c.req.param('id'),
      draft,
    );
    if (!updated.ok) {
      return c.json(
        { error: updated.error },
        updated.error === 'not-authorized'
          ? 403
          : updated.error === 'not-found'
            ? 404
            : 400,
      );
    }
    return c.json({ definition: updated.value }, 200);
  });

  app.post('/api/v1/library/npc-creatures/:id/archive', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.npcCreature?.archiveDefinition) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const archived = deps.npcCreature.archiveDefinition(
      actorResult.actor,
      c.req.param('id'),
    );
    if (!archived.ok) {
      return c.json(
        { error: archived.error },
        archived.error === 'not-authorized'
          ? 403
          : archived.error === 'not-found'
            ? 404
            : 400,
      );
    }
    return c.json({ definition: archived.value }, 200);
  });

  /** CUT-02 — load controller assignment for a campaign + definition. */
  app.get('/api/v1/library/npc-creatures/:id/controller', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.npcCreature?.getControllerAssignment) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const projectId = c.req.query('projectId')?.trim() ?? '';
    if (!projectId) return c.json({ error: 'P0001:missing project' }, 422);
    const loaded = deps.npcCreature.getControllerAssignment(
      actorResult.actor,
      projectId,
      c.req.param('id'),
    );
    if (!loaded.ok) {
      return c.json({ error: loaded.error }, npcControllerErrorStatus(loaded.error));
    }
    return c.json({ assignment: loaded.value }, 200);
  });

  /**
   * CUT-02 — assign or clear controller (nullable controllerUserId = clear).
   * Body: { projectId, controllerUserId: string | null }. Actor is session-only.
   */
  app.post('/api/v1/library/npc-creatures/:id/controller', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.npcCreature?.assignController) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const projectId = typeof record.projectId === 'string' ? record.projectId.trim() : '';
    if (!projectId) return c.json({ error: 'P0001:missing project' }, 422);
    const hasControllerKey = Object.prototype.hasOwnProperty.call(record, 'controllerUserId');
    if (!hasControllerKey) {
      return c.json({ error: 'P0001:invalid controller id' }, 422);
    }
    const rawController = record.controllerUserId;
    let controllerUserId: string | null;
    if (rawController === null) {
      controllerUserId = null;
    } else if (typeof rawController === 'string') {
      controllerUserId = rawController;
    } else {
      return c.json({ error: 'P0001:invalid controller id' }, 422);
    }
    const assigned = deps.npcCreature.assignController(
      actorResult.actor,
      projectId,
      c.req.param('id'),
      controllerUserId,
    );
    if (!assigned.ok) {
      return c.json({ error: assigned.error }, npcControllerErrorStatus(assigned.error));
    }
    return c.json({ assignment: assigned.value }, 200);
  });

  app.get('/api/v1/library/looks', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.look) {
      return c.json({ looks: [] }, 200);
    }
    const includeArchived = c.req.query('includeArchived') === '1';
    const listed = deps.look.listProfiles(actorResult.actor, { includeArchived });
    if (!listed.ok) {
      return c.json({ error: listed.error }, 503);
    }
    return c.json({ looks: listed.value }, 200);
  });

  app.post('/api/v1/library/looks', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.look) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
    const draft = 'draft' in record ? record.draft : record;
    const created = deps.look.createProfile(actorResult.actor, draft);
    if (!created.ok) {
      return c.json({ error: created.error }, 400);
    }
    return c.json({ look: created.value }, 201);
  });

  app.post('/api/v1/library/looks/:id/archive', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.look) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const archived = deps.look.archiveProfile(actorResult.actor, c.req.param('id'));
    if (!archived.ok) {
      return c.json(
        { error: archived.error },
        archived.error === 'not-authorized' ? 403 : archived.error === 'not-found' ? 404 : 400,
      );
    }
    return c.json({ look: archived.value }, 200);
  });

  app.post('/api/v1/library/looks/:id/duplicate', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.look) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown = {};
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }
    const record = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
    const displayName = typeof record.displayName === 'string' ? record.displayName : undefined;
    const duplicated = deps.look.duplicateProfile(
      actorResult.actor,
      c.req.param('id'),
      displayName,
    );
    if (!duplicated.ok) {
      return c.json(
        { error: duplicated.error },
        duplicated.error === 'not-authorized' ? 403 : duplicated.error === 'not-found' ? 404 : 400,
      );
    }
    return c.json({ look: duplicated.value }, 201);
  });

  /** CUT-07 — append-only LookProfile version. */
  app.post('/api/v1/library/looks/:id/versions', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.look?.appendVersion) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const draft = 'draft' in record ? record.draft : record;
    const appended = deps.look.appendVersion(
      actorResult.actor,
      c.req.param('id'),
      draft,
    );
    if (!appended.ok) {
      const status =
        appended.error === 'not-authorized'
          ? 403
          : appended.error === 'not-found'
            ? 404
            : appended.error === 'invalid-profile-id'
              ? 422
              : /Konflikt|parallel/i.test(appended.error)
                ? 409
                : 400;
      return c.json({ error: appended.error }, status);
    }
    return c.json({ look: appended.value }, 201);
  });

  /** CUT-07 — full immutable version history for a LookProfile. */
  app.get('/api/v1/library/looks/:id/versions', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.look?.listVersions) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const listed = deps.look.listVersions(actorResult.actor, c.req.param('id'));
    if (!listed.ok) {
      return c.json(
        { error: listed.error },
        listed.error === 'not-authorized'
          ? 403
          : listed.error === 'not-found'
            ? 404
            : listed.error === 'invalid-profile-id'
              ? 422
              : 400,
      );
    }
    return c.json({ versions: listed.value }, 200);
  });

  app.get('/api/v1/library/items', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.inventory?.listCatalog) {
      return c.json({ items: [] }, 200);
    }
    const listed = deps.inventory.listCatalog(libraryActorIds(actorResult.actor), {});
    if (!listed.ok) {
      return c.json({ error: listed.error }, 503);
    }
    return c.json({ items: listed.value }, 200);
  });

  app.post('/api/v1/library/items', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.inventory?.createDefinition) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const draft = 'draft' in record && record.draft && typeof record.draft === 'object'
      ? (record.draft as Record<string, unknown>)
      : record;
    // Owner column is the session actor; linked solo ids are honored on list/read.
    const created = deps.inventory.createDefinition(actorResult.actor.actorId, {
      name: draft.name,
      origin: draft.origin,
      worldProfileId: draft.worldProfileId,
      payload: draft.payload,
    });
    if (!created.ok) {
      const status =
        created.error === 'not-authorized'
          ? 403
          : created.error === 'name-required' ||
              created.error === 'world-profile-required' ||
              created.error === 'origin-not-allowed'
            ? 422
            : 400;
      return c.json({ error: created.error }, status);
    }
    return c.json({ item: created.value }, 201);
  });

  /** CUT-06 — single item including archived (restore/workbench). */
  app.get('/api/v1/library/items/:id', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.inventory?.getDefinition) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const loaded = deps.inventory.getDefinition(
      libraryActorIds(actorResult.actor),
      c.req.param('id'),
    );
    if (!loaded.ok) {
      return c.json(
        { error: loaded.error },
        loaded.error === 'not-authorized' ? 403 : 400,
      );
    }
    if (!loaded.value) return c.json({ error: 'not-found' }, 404);
    return c.json({ item: loaded.value }, 200);
  });

  /** CUT-06 — update personal/world item definition (name/payload only). */
  app.patch('/api/v1/library/items/:id', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.inventory?.updateDefinition) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const draft =
      'draft' in record && record.draft && typeof record.draft === 'object'
        ? (record.draft as Record<string, unknown>)
        : record;
    const updated = deps.inventory.updateDefinition(
      libraryActorIds(actorResult.actor),
      c.req.param('id'),
      {
        name: draft.name,
        payload: draft.payload,
      },
    );
    if (!updated.ok) {
      const status =
        updated.error === 'not-authorized'
          ? 403
          : updated.error === 'not-found'
            ? 404
            : updated.error === 'name-required' || updated.error === 'invalid-payload'
              ? 422
              : 400;
      return c.json({ error: updated.error }, status);
    }
    return c.json({ item: updated.value }, 200);
  });

  app.post('/api/v1/library/items/:id/archive', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.inventory?.setDefinitionStatus) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const archived = deps.inventory.setDefinitionStatus(
      libraryActorIds(actorResult.actor),
      c.req.param('id'),
      'archived',
    );
    if (!archived.ok) {
      return c.json(
        { error: archived.error },
        archived.error === 'not-authorized'
          ? 403
          : archived.error === 'not-found'
            ? 404
            : 400,
      );
    }
    return c.json({ item: archived.value }, 200);
  });

  app.post('/api/v1/library/items/:id/restore', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.inventory?.setDefinitionStatus) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    const restored = deps.inventory.setDefinitionStatus(
      libraryActorIds(actorResult.actor),
      c.req.param('id'),
      'active',
    );
    if (!restored.ok) {
      return c.json(
        { error: restored.error },
        restored.error === 'not-authorized'
          ? 403
          : restored.error === 'not-found'
            ? 404
            : 400,
      );
    }
    return c.json({ item: restored.value }, 200);
  });

  app.post('/api/v1/library/items/:id/fork', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.inventory?.forkDefinition) {
      return c.json({ error: 'store-unavailable' }, 503);
    }
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid-json' }, 400);
    }
    const record =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const origin =
      record.origin === 'world' || record.scope === 'world'
        ? 'world'
        : record.origin === 'personal' || record.scope === 'personal'
          ? 'personal'
          : null;
    if (!origin) {
      return c.json({ error: 'origin-not-allowed' }, 422);
    }
    const worldProfileId =
      typeof record.worldProfileId === 'string' ? record.worldProfileId : null;
    const forked = deps.inventory.forkDefinition(
      libraryActorIds(actorResult.actor),
      c.req.param('id'),
      { origin, worldProfileId },
    );
    if (!forked.ok) {
      const status =
        forked.error === 'not-authorized'
          ? 403
          : forked.error === 'not-found'
            ? 404
            : forked.error === 'world-profile-required' ||
                forked.error === 'origin-not-allowed'
              ? 422
              : 400;
      return c.json({ error: forked.error }, status);
    }
    return c.json({ item: forked.value }, 201);
  });

  app.get('/api/v1/library/projects', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.project?.listOwnedProjects) {
      return c.json({ projects: [] }, 200);
    }
    const byId = new Map<
      string,
      {
        id: string;
        publicId: string | null;
        code: string;
        name: string;
        description: string | null;
        worldId: string;
        worldProfileId: string;
        defaultLookProfileId: string | null;
        allowPlayerCharacterLookOverride: boolean;
        sagaId: string | null;
        sagaVersionId: string | null;
        sagaTitle: string;
        sagaSlug: null;
        sagaOrigin: null;
        gmUserId: string;
        status: string;
        memberCount: number;
        sessionCount: number;
        createdAt: string;
        updatedAt: string;
      }
    >();
    for (const ownerId of libraryActorIds(actorResult.actor)) {
      const listed = deps.project.listOwnedProjects(ownerId);
      if (!listed.ok) {
        return c.json({ error: listed.error }, 503);
      }
      for (const row of listed.value) {
        byId.set(row.id, {
          id: row.id,
          publicId: row.publicId,
          code: row.code || '',
          name: row.title,
          description: row.description,
          worldId: row.worldId,
          worldProfileId: row.worldId,
          defaultLookProfileId: row.defaultLookProfileId,
          allowPlayerCharacterLookOverride: row.allowPlayerCharacterLookOverride,
          sagaId: row.sagaId || null,
          sagaVersionId: row.sagaVersionId || null,
          sagaTitle: row.title,
          sagaSlug: null,
          sagaOrigin: null,
          gmUserId: row.gmUserId,
          status:
            row.status === 'paused' || row.status === 'completed' || row.status === 'archived'
              ? row.status
              : 'active',
          memberCount: 1,
          sessionCount: 0,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        });
      }
    }
    return c.json({ projects: [...byId.values()] }, 200);
  });
}

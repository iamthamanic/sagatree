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
import { authDenyStatus } from './errors.ts';

export type LibraryHttpDeps = {
  readonly identity: IdentityPorts;
  readonly hostMode?: 'solo' | 'remote';
  readonly character?: CharacterPorts | null;
  readonly world?: WorldPorts | null;
  readonly npcCreature?: NpcCreaturePorts | null;
  readonly look?: LookProfilePorts | null;
  readonly inventory?: InventoryPorts | null;
  readonly project?: ProjectPorts | null;
};

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

function mapCharacterRow(row: {
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
}) {
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
    portraitUrl: row.portraitStoragePath,
    sheet: row.sheet,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
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
    const listed = deps.character.listOwnedCharacters(actorResult.actor.actorId);
    if (!listed.ok) {
      return c.json({ error: listed.error }, listed.error === 'store-unavailable' ? 503 : 400);
    }
    const characters = listed.value
      .filter((row) => row.characterType === 'pc')
      .map(mapCharacterRow);
    return c.json({ characters }, 200);
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
    return c.json({ character: mapCharacterRow(created.value) }, 201);
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
    const got = deps.character.getOwnedCharacter(actorResult.actor.actorId, id);
    if (!got.ok) {
      return c.json({ error: got.error }, got.error === 'not-authorized' ? 403 : 400);
    }
    if (!got.value) {
      return c.json({ error: 'not-found' }, 404);
    }
    return c.json({ character: mapCharacterRow(got.value) }, 200);
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
    const updated = deps.character.updateOwnedCharacter(actorResult.actor.actorId, id, {
      name: record.name,
      description: record.description,
      level: record.level,
      sheetStatus: record.sheet_status ?? record.sheetStatus,
      sheet: record.sheet,
      portraitStoragePath: record.portrait_url ?? record.portraitStoragePath,
      characterType: 'pc',
    });
    if (!updated.ok) {
      return c.json(
        { error: updated.error },
        updated.error === 'not-authorized'
          ? 403
          : updated.error === 'not-found'
            ? 404
            : updated.error === 'store-unavailable'
              ? 503
              : 400,
      );
    }
    return c.json({ character: mapCharacterRow(updated.value) }, 200);
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
    const deleted = deps.character.deleteOwnedCharacter(actorResult.actor.actorId, id);
    if (!deleted.ok) {
      return c.json(
        { error: deleted.error },
        deleted.error === 'not-authorized' ? 403 : deleted.error === 'not-found' ? 404 : 400,
      );
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

  app.get('/api/v1/library/items', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.inventory?.listCatalog) {
      return c.json({ items: [] }, 200);
    }
    const listed = deps.inventory.listCatalog(actorResult.actor.actorId, {});
    if (!listed.ok) {
      return c.json({ error: listed.error }, 503);
    }
    return c.json({ items: listed.value }, 200);
  });

  app.get('/api/v1/library/projects', async (c) => {
    const actorResult = await resolveLibraryActor(deps, c.req.raw.headers);
    if (!actorResult.ok) {
      return c.json({ error: actorResult.error }, actorResult.status);
    }
    if (!deps.project?.listOwnedProjects) {
      return c.json({ projects: [] }, 200);
    }
    const listed = deps.project.listOwnedProjects(actorResult.actor.actorId);
    if (!listed.ok) {
      return c.json({ error: listed.error }, 503);
    }
    const projects = listed.value.map((row) => ({
      id: row.id,
      publicId: row.publicId,
      code: '',
      name: row.title,
      description: row.description,
      worldId: row.worldId,
      worldProfileId: row.worldId,
      sagaId: row.sagaId || null,
      sagaVersionId: row.sagaVersionId || null,
      sagaTitle: row.title,
      sagaSlug: null,
      sagaOrigin: null,
      gmUserId: row.gmUserId,
      status: row.status === 'paused' || row.status === 'completed' || row.status === 'archived'
        ? row.status
        : 'active',
      memberCount: 1,
      sessionCount: 0,
    }));
    return c.json({ projects }, 200);
  });
}

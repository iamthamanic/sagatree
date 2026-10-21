import { and, eq, exists, or, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { CommandError, type Actor, type ViewContext } from '../domain/contracts.js';
import * as tables from './schema.js';

type ReadStore = Pick<BetterSQLite3Database<typeof tables>, 'select'>;

/** Every application operation obtains its authorization here, inside its transaction when mutating. */
export class PolicyService {
  constructor(private readonly db: ReadStore) {}

  actorId(actor: Actor): string {
    if (!actor?.userId) throw new CommandError('DENIED');
    return actor.userId;
  }

  projectScope(context: ViewContext) {
    const userId = this.actorId(context.actor);
    if (!context.sagaId) throw new CommandError('DENIED');
    const project = this.db.select({
      id: tables.projects.id, worldId: tables.projects.worldId,
      gmUserId: tables.projects.gmUserId, ownerUserId: tables.worlds.ownerUserId,
    }).from(tables.projects).innerJoin(tables.worlds, eq(tables.projects.worldId, tables.worlds.id))
      .where(eq(tables.projects.id, context.sagaId)).get();
    if (!project) throw new CommandError('DENIED');
    const membership = this.db.select().from(tables.members).where(and(
      eq(tables.members.projectId, project.id), eq(tables.members.userId, userId), eq(tables.members.active, true),
    )).get();
    const owner = project.ownerUserId === userId;
    if (!owner && !membership) throw new CommandError('DENIED');
    return { ...project, userId, owner, gm: project.gmUserId === userId && membership?.role === 'gm' };
  }

  mapProjection(context: ViewContext) {
    const scope = this.projectScope(context);
    const full = scope.owner || scope.gm;
    const visible = full ? sql`1 = 1` : or(
      eq(tables.maps.gmOnly, false),
      exists(this.db.select({ value: sql`1` }).from(tables.reveals).where(and(
        eq(tables.reveals.mapId, tables.maps.id), eq(tables.reveals.projectId, scope.id),
        eq(tables.reveals.playerUserId, scope.userId),
      ))),
    );
    return {
      where: and(eq(tables.maps.worldId, scope.worldId), visible),
      fields: {
        id: tables.maps.id, worldId: tables.maps.worldId, title: tables.maps.title,
        revision: tables.maps.revision, gmOnly: tables.maps.gmOnly,
        body: tables.maps.body, layers: tables.maps.layers,
        gmNotes: full ? tables.maps.gmNotes : sql<string | null>`NULL`,
      },
    };
  }

  assertMapEditor(mapId: string, actor: Actor): string {
    const userId = this.actorId(actor);
    const row = this.db.select({ id: tables.maps.id }).from(tables.maps)
      .innerJoin(tables.worlds, eq(tables.maps.worldId, tables.worlds.id))
      .where(and(eq(tables.maps.id, mapId), eq(tables.worlds.ownerUserId, userId))).get();
    if (!row) throw new CommandError('DENIED');
    return userId;
  }

  assertSessionGm(sessionId: string, context: ViewContext): void {
    const scope = this.projectScope(context);
    if (!scope.gm) throw new CommandError('DENIED');
    const row = this.db.select({ id: tables.sessions.id }).from(tables.sessions)
      .where(and(eq(tables.sessions.id, sessionId), eq(tables.sessions.projectId, scope.id))).get();
    if (!row) throw new CommandError('DENIED');
  }
}

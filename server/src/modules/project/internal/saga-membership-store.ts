/**
 * Project-owned saga membership reads (RPC-SAGA-VERSION-READ / #872).
 * Private — import only from project public API.
 * Location: server/src/modules/project/internal/saga-membership-store.ts
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';

export class SagaMembershipStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  /** Active player member or project GM on any project bound to this saga. */
  actorHasAccessToSaga(actorId: string, sagaId: string): boolean {
    const row = this.#db
      .prepare(
        `SELECT 1 AS ok
         FROM projects p
         WHERE p.saga_id = ?
           AND (
             p.gm_user_id = ?
             OR EXISTS (
               SELECT 1 FROM project_members pm
               WHERE pm.project_id = p.id AND pm.user_id = ? AND pm.active = 1
             )
           )
         LIMIT 1`,
      )
      .get(sagaId, actorId, actorId) as { ok: number } | undefined;
    return Boolean(row);
  }

  /** True when actor is `projects.gm_user_id` for a project bound to this saga. */
  actorIsGmOnSaga(actorId: string, sagaId: string): boolean {
    const row = this.#db
      .prepare(
        `SELECT 1 AS ok FROM projects p WHERE p.saga_id = ? AND p.gm_user_id = ? LIMIT 1`,
      )
      .get(sagaId, actorId) as { ok: number } | undefined;
    return Boolean(row);
  }

  /**
   * Actor (or linked solo ids) is GM or active member on any project bound to this world.
   * Used by world-map ACL without foreign SQL from the world module (#861).
   */
  actorCanAccessWorld(actorIds: readonly string[], worldId: string): boolean {
    const ids = actorIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (ids.length === 0) return false;
    const placeholders = ids.map(() => '?').join(',');
    const row = this.#db
      .prepare(
        `SELECT 1 AS ok
         FROM projects p
         WHERE p.world_id = ?
           AND (
             p.gm_user_id IN (${placeholders})
             OR EXISTS (
               SELECT 1 FROM project_members pm
               WHERE pm.project_id = p.id
                 AND pm.user_id IN (${placeholders})
                 AND pm.active = 1
             )
           )
         LIMIT 1`,
      )
      .get(worldId, ...ids, ...ids) as { ok: number } | undefined;
    return Boolean(row);
  }
}

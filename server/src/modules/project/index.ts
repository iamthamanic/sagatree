/**
 * project module public API — membership/project ports.
 * Location: server/src/modules/project/index.ts
 *
 * Owns `projects` + `project_members`. Cross-module saga ACL reads go through
 * these ports (never foreign table SQL from saga persistence).
 */
import type { HostDatabase } from '../../persistence/open-database.ts';
import { SagaMembershipStore } from './internal/saga-membership-store.ts';

export type ProjectPorts = {
  readonly moduleId: 'project';
  /** Active member or GM on a project linked via `projects.saga_id`. */
  readonly actorHasAccessToSaga: (actorId: string, sagaId: string) => boolean;
  /** Project GM (`gm_user_id`) for a saga-linked project. */
  readonly actorIsGmOnSaga: (actorId: string, sagaId: string) => boolean;
};

export function createProjectPorts(db?: HostDatabase): ProjectPorts {
  if (!db) {
    return {
      moduleId: 'project',
      actorHasAccessToSaga: () => false,
      actorIsGmOnSaga: () => false,
    };
  }
  const store = new SagaMembershipStore(db);
  return {
    moduleId: 'project',
    actorHasAccessToSaga: (actorId, sagaId) => store.actorHasAccessToSaga(actorId, sagaId),
    actorIsGmOnSaga: (actorId, sagaId) => store.actorIsGmOnSaga(actorId, sagaId),
  };
}

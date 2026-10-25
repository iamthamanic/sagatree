/**
 * project module public API — membership/project ports + saga provision writes.
 * Location: server/src/modules/project/index.ts
 *
 * Owns `projects` + `project_members` (+ worlds allocated for new play groups).
 * Cross-module saga ACL reads go through these ports (never foreign table SQL from saga).
 */
import type { Actor } from '../identity/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import { SagaMembershipStore } from './internal/saga-membership-store.ts';
import {
  ProjectProvisionStore,
  type ProvisionedProject,
} from './internal/project-provision-store.ts';

export type ProjectResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type { ProvisionedProject };

export type ProjectPorts = {
  readonly moduleId: 'project';
  /** Active member or GM on a project linked via `projects.saga_id`. */
  readonly actorHasAccessToSaga: (actorId: string, sagaId: string) => boolean;
  /** Project GM (`gm_user_id`) for a saga-linked project. */
  readonly actorIsGmOnSaga: (actorId: string, sagaId: string) => boolean;
  readonly createFromSagaVersion: (
    actor: Actor,
    input: {
      readonly sagaId: string;
      readonly sagaVersionId: string;
      readonly title: string;
      readonly description: string | null;
      readonly adventureRuntime: Record<string, unknown>;
    },
  ) => ProjectResult<ProvisionedProject>;
  readonly getProject: (projectId: string) => ProjectResult<ProvisionedProject>;
  readonly findActiveGmProjectForSaga: (
    actorId: string,
    sagaId: string,
  ) => ProjectResult<ProvisionedProject> | { ok: false; error: 'P0002' };
};

export function createProjectPorts(db?: HostDatabase): ProjectPorts {
  if (!db) {
    return {
      moduleId: 'project',
      actorHasAccessToSaga: () => false,
      actorIsGmOnSaga: () => false,
      createFromSagaVersion: () => ({ ok: false, error: 'store-unavailable' }),
      getProject: () => ({ ok: false, error: 'store-unavailable' }),
      findActiveGmProjectForSaga: () => ({ ok: false, error: 'P0002' }),
    };
  }
  const membership = new SagaMembershipStore(db);
  const provision = new ProjectProvisionStore(db);
  return {
    moduleId: 'project',
    actorHasAccessToSaga: (actorId, sagaId) => membership.actorHasAccessToSaga(actorId, sagaId),
    actorIsGmOnSaga: (actorId, sagaId) => membership.actorIsGmOnSaga(actorId, sagaId),
    createFromSagaVersion(actor, input) {
      if (!actor?.actorId) return { ok: false, error: '42501' };
      return provision.createFromSagaVersion({ ...input, actorId: actor.actorId });
    },
    getProject(projectId) {
      const row = provision.getProject(projectId);
      if (!row) return { ok: false, error: 'P0002' };
      return { ok: true, value: provision.toVm(row) };
    },
    findActiveGmProjectForSaga(actorId, sagaId) {
      const row = provision.findActiveGmProjectForSaga(actorId, sagaId);
      if (!row) return { ok: false, error: 'P0002' };
      return { ok: true, value: provision.toVm(row) };
    },
  };
}

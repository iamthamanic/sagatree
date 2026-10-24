/**
 * Rulesets module public API — host catalog ports (MIG-309 / #808).
 * Location: server/src/modules/rulesets/index.ts
 *
 * Official/public rows stay readable; custom mutations require creator ownership.
 * Client-claimed roles never elevate write. Official rows are immutable via ports.
 */
import type { Actor } from '../identity/index.ts';
import type { PolicyDecision, PolicyOp, PolicyResource } from '../permissions/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import {
  createRulesetStore,
  type CreateRulesetInput,
  type RulesetRecord,
  type UpdateRulesetInput,
} from './internal/ruleset-store.ts';

export type { CreateRulesetInput, RulesetRecord, UpdateRulesetInput };

export type RulesetResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

type AuthorizeFn = (op: PolicyOp, actor: Actor, resource?: PolicyResource) => PolicyDecision;

export type RulesetPorts = {
  readonly moduleId: 'rulesets';
  readonly listAll: (actor: Actor) => RulesetResult<readonly RulesetRecord[]>;
  readonly listOfficial: (actor: Actor) => RulesetResult<readonly RulesetRecord[]>;
  readonly getById: (actor: Actor, id: string) => RulesetResult<RulesetRecord>;
  readonly create: (actor: Actor, input: CreateRulesetInput) => RulesetResult<RulesetRecord>;
  readonly update: (actor: Actor, input: UpdateRulesetInput) => RulesetResult<RulesetRecord>;
  readonly remove: (actor: Actor, id: string) => RulesetResult<{ readonly id: string }>;
  /** Test/seed helper — inserts an official public ruleset without actor elevation. */
  readonly seedOfficialForTests: (input: {
    readonly id?: string;
    readonly name: string;
    readonly attributesConfig: RulesetRecord['attributesConfig'];
  }) => RulesetRecord;
};

function requireActor(actor: Actor | null | undefined): actor is Actor {
  return Boolean(actor?.actorId);
}

export function createRulesetPorts(deps: {
  readonly db: HostDatabase;
  readonly authorize: AuthorizeFn;
}): RulesetPorts {
  const store = createRulesetStore(deps.db);
  const { authorize } = deps;

  return {
    moduleId: 'rulesets',

    listAll(actor) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const decision = authorize('ruleset.read', actor, {});
      if (!decision.allow) return { ok: false, error: 'not-authorized' };
      // Catalog list: official/public for everyone; private customs only for owner.
      const visible = store.listAll().filter(
        (row) =>
          row.isOfficial ||
          row.isPublic ||
          (row.creatorUserId != null && row.creatorUserId === actor.actorId),
      );
      return { ok: true, value: visible };
    },

    listOfficial(actor) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const decision = authorize('ruleset.read', actor, {});
      if (!decision.allow) return { ok: false, error: 'not-authorized' };
      return { ok: true, value: store.listOfficial() };
    },

    getById(actor, id) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const trimmed = typeof id === 'string' ? id.trim() : '';
      if (!trimmed) return { ok: false, error: 'missing-ruleset' };
      const decision = authorize('ruleset.read', actor, { rulesetId: trimmed });
      if (!decision.allow) {
        return {
          ok: false,
          error: decision.reason === 'ruleset-not-found' ? 'not-found' : 'not-authorized',
        };
      }
      const row = store.getById(trimmed);
      if (!row) return { ok: false, error: 'not-found' };
      return { ok: true, value: row };
    },

    create(actor, input) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const decision = authorize('ruleset.write', actor, {});
      if (!decision.allow) return { ok: false, error: 'not-authorized' };
      if (!input?.name?.trim() || !input.attributesConfig) {
        return { ok: false, error: 'invalid-payload' };
      }
      const created = store.insertCustom(actor.actorId, {
        ...input,
        name: input.name.trim(),
      });
      return { ok: true, value: created };
    },

    update(actor, input) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const id = typeof input?.id === 'string' ? input.id.trim() : '';
      if (!id) return { ok: false, error: 'missing-ruleset' };
      const decision = authorize('ruleset.write', actor, { rulesetId: id });
      if (!decision.allow) {
        return {
          ok: false,
          error:
            decision.reason === 'official-immutable'
              ? 'official-immutable'
              : decision.reason === 'ruleset-not-found'
                ? 'not-found'
                : 'not-authorized',
        };
      }
      const updated = store.updateCustom({ ...input, id });
      if (!updated) return { ok: false, error: 'not-found' };
      return { ok: true, value: updated };
    },

    remove(actor, id) {
      if (!requireActor(actor)) return { ok: false, error: 'missing-actor' };
      const trimmed = typeof id === 'string' ? id.trim() : '';
      if (!trimmed) return { ok: false, error: 'missing-ruleset' };
      const decision = authorize('ruleset.write', actor, { rulesetId: trimmed });
      if (!decision.allow) {
        return {
          ok: false,
          error:
            decision.reason === 'official-immutable'
              ? 'official-immutable'
              : decision.reason === 'ruleset-not-found'
                ? 'not-found'
                : 'not-authorized',
        };
      }
      if (!store.deleteCustom(trimmed)) return { ok: false, error: 'not-found' };
      return { ok: true, value: { id: trimmed } };
    },

    seedOfficialForTests(input) {
      return store.seedOfficial(input);
    },
  };
}

export function createRulesetPortsStub(): RulesetPorts {
  const unavailable = { ok: false as const, error: 'store-unavailable' };
  return {
    moduleId: 'rulesets',
    listAll: () => unavailable,
    listOfficial: () => unavailable,
    getById: () => unavailable,
    create: () => unavailable,
    update: () => unavailable,
    remove: () => unavailable,
    seedOfficialForTests: () => {
      throw new Error('store-unavailable');
    },
  };
}

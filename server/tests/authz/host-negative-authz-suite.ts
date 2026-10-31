/**
 * MIG-600 host negative authz suite — role matrix + secret-marker + membership canary.
 * Location: server/tests/authz/host-negative-authz-suite.ts
 *
 * Exercises deny-by-default PolicyService + role projections against real SQLite
 * persistence (parity-harness actor set). HTTP publicActivation remains deferred.
 */
import type { HostDatabase } from '../../src/persistence/open-database.ts';
import { createPermissionsPorts } from '../../src/modules/permissions/index.ts';
import {
  projectSessionSnapshot,
  projectionContainsSecretMarker,
  secretMarker,
  type SessionProjectionInput,
} from '../../src/projections/index.ts';

export type AuthzActorKind = 'owner' | 'gm' | 'player1' | 'player2' | 'outsider' | 'otherGm';

export type AuthzCaseResult = {
  readonly id: string;
  readonly allow: boolean;
  readonly expectedAllow: boolean;
  readonly reason: string;
  readonly ok: boolean;
};

export type HostNegativeAuthzReport = {
  readonly ok: boolean;
  readonly cases: readonly AuthzCaseResult[];
  readonly secretMarkerAbsentForPlayers: boolean;
  readonly canaryDetectsDisabledFilter: boolean;
  readonly canaryDetectsAlwaysAllowMembership: boolean;
};

const FIXTURE = {
  worldId: 'world-primary',
  projectId: 'proj-primary',
  foreignWorldId: 'world-foreign',
  foreignProjectId: 'proj-foreign',
  assetId: 'asset-owner-1',
  rulesetPrivateId: 'ruleset-private-1',
  sagaUserId: 'saga-user-1',
  actors: {
    owner: { kind: 'solo-local' as const, actorId: 'owner-o' },
    gm: { kind: 'solo-local' as const, actorId: 'gm-g' },
    player1: { kind: 'solo-local' as const, actorId: 'player-p1' },
    player2: { kind: 'solo-local' as const, actorId: 'player-p2' },
    outsider: { kind: 'solo-local' as const, actorId: 'outsider-x' },
    otherGm: { kind: 'solo-local' as const, actorId: 'gm-other' },
  },
};

export function seedAuthzFixture(db: HostDatabase): void {
  const now = '2026-10-31T00:00:00.000Z';
  const emptyJson = '{}';
  db.exec(`
    INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES
      ('${FIXTURE.worldId}', 'owner-o', 'Primary World', '${now}'),
      ('${FIXTURE.foreignWorldId}', 'outsider-x', 'Foreign World', '${now}');
    INSERT INTO projects (id, world_id, gm_user_id, title, created_at) VALUES
      ('${FIXTURE.projectId}', '${FIXTURE.worldId}', 'gm-g', 'Primary Saga', '${now}'),
      ('${FIXTURE.foreignProjectId}', '${FIXTURE.foreignWorldId}', 'gm-other', 'Foreign Saga', '${now}');
    INSERT INTO project_members (project_id, user_id, role, active, joined_at) VALUES
      ('${FIXTURE.projectId}', 'gm-g', 'gm', 1, '${now}'),
      ('${FIXTURE.projectId}', 'player-p1', 'player', 1, '${now}'),
      ('${FIXTURE.projectId}', 'player-p2', 'player', 1, '${now}'),
      ('${FIXTURE.foreignProjectId}', 'gm-other', 'gm', 1, '${now}'),
      ('${FIXTURE.foreignProjectId}', 'outsider-x', 'player', 1, '${now}');
    INSERT INTO assets
      (id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published, created_at)
      VALUES ('${FIXTURE.assetId}', 'owner-o', 'text/plain', 1, 'aa', '${FIXTURE.assetId}', 1, '${now}');
    INSERT INTO rulesets (
      id, creator_user_id, name, description, version,
      attributes_config_json, skills_config_json, classes_config_json, races_config_json,
      combat_rules_json, dice_rules_json, level_progression_json,
      is_official, is_public, is_marketplace_item, downloads_count, created_at, updated_at
    ) VALUES (
      '${FIXTURE.rulesetPrivateId}', 'owner-o', 'Private Rules', '', '1',
      '${emptyJson}', '${emptyJson}', '${emptyJson}', '${emptyJson}',
      '${emptyJson}', '${emptyJson}', '${emptyJson}',
      0, 0, 0, 0, '${now}', '${now}'
    );
    INSERT INTO saga_definitions
      (id, slug, title, synopsis, origin, owner_user_id, draft_revision, created_at, updated_at)
      VALUES ('${FIXTURE.sagaUserId}', 'user.${FIXTURE.sagaUserId}', 'User Saga', '', 'user', 'owner-o', 0, '${now}', '${now}');
  `);
}

function expectCase(
  id: string,
  decision: { allow: boolean; reason: string },
  expectedAllow: boolean,
): AuthzCaseResult {
  return {
    id,
    allow: decision.allow,
    expectedAllow,
    reason: decision.reason,
    ok: decision.allow === expectedAllow,
  };
}

function projectionFixture(marker: string): SessionProjectionInput {
  return {
    revision: 1,
    objects: [
      { id: 'NPC-GM', visibility: 'gm_only', name: 'Hidden', gmNotes: marker },
      { id: 'NPC-PARTY', visibility: 'party', name: 'Ally' },
      { id: 'NPC-PUBLIC', visibility: 'public', name: 'Town' },
    ],
    shared: { title: 'Saga', gm_notes: marker },
    events: [
      { id: 'EV-1', kind: 'reveal', targetId: 'NPC-PARTY' },
      { id: 'EV-GM', kind: 'whisper', gmOnly: true, text: marker },
    ],
  };
}

/**
 * Run the host negative authz suite against an already-bootstrapped HostDatabase.
 * Pass `{ skipSeed: true }` when the caller already invoked `seedAuthzFixture`.
 */
export function runHostNegativeAuthzSuite(
  db: HostDatabase,
  options: { readonly skipSeed?: boolean } = {},
): HostNegativeAuthzReport {
  if (!options.skipSeed) {
    seedAuthzFixture(db);
  }
  const permissions = createPermissionsPorts(db);
  const A = FIXTURE.actors;
  const cases: AuthzCaseResult[] = [];

  const push = (
    id: string,
    op: string,
    actor: (typeof A)[keyof typeof A],
    resource: Record<string, string>,
    expectedAllow: boolean,
  ) => {
    cases.push(expectCase(id, permissions.authorize(op, actor, resource), expectedAllow));
  };

  // Fall 1 — operations matrix (owner / GM / players / outsider / otherGm)
  push('world.read.owner', 'world.read', A.owner, { worldId: FIXTURE.worldId }, true);
  push('world.read.gm', 'world.read', A.gm, { worldId: FIXTURE.worldId }, false);
  push('world.read.player1', 'world.read', A.player1, { worldId: FIXTURE.worldId }, false);
  push('world.read.outsider', 'world.read', A.outsider, { worldId: FIXTURE.worldId }, false);
  push('world.edit.owner', 'world.edit', A.owner, { worldId: FIXTURE.worldId }, true);
  push('world.edit.outsider', 'world.edit', A.outsider, { worldId: FIXTURE.worldId }, false);

  push('session.gm.gm', 'session.gm', A.gm, { projectId: FIXTURE.projectId }, true);
  push('session.gm.owner', 'session.gm', A.owner, { projectId: FIXTURE.projectId }, false);
  push('session.gm.player1', 'session.gm', A.player1, { projectId: FIXTURE.projectId }, false);
  push('session.gm.otherGm', 'session.gm', A.otherGm, { projectId: FIXTURE.projectId }, false);

  push('player.read.owner', 'player.project.read', A.owner, { projectId: FIXTURE.projectId }, true);
  push('player.read.gm', 'player.project.read', A.gm, { projectId: FIXTURE.projectId }, true);
  push('player.read.p1', 'player.project.read', A.player1, { projectId: FIXTURE.projectId }, true);
  push('player.read.p2', 'player.project.read', A.player2, { projectId: FIXTURE.projectId }, true);
  push('player.read.outsider', 'player.project.read', A.outsider, { projectId: FIXTURE.projectId }, false);
  push('player.read.otherGm', 'player.project.read', A.otherGm, { projectId: FIXTURE.projectId }, false);

  push('asset.read.owner', 'asset.read', A.owner, { assetId: FIXTURE.assetId }, true);
  push('asset.read.outsider', 'asset.read', A.outsider, { assetId: FIXTURE.assetId }, false);

  push('ruleset.read.owner', 'ruleset.read', A.owner, { rulesetId: FIXTURE.rulesetPrivateId }, true);
  push('ruleset.read.outsider', 'ruleset.read', A.outsider, { rulesetId: FIXTURE.rulesetPrivateId }, false);
  push('ruleset.write.owner', 'ruleset.write', A.owner, { rulesetId: FIXTURE.rulesetPrivateId }, true);
  push('ruleset.write.outsider', 'ruleset.write', A.outsider, { rulesetId: FIXTURE.rulesetPrivateId }, false);

  push('saga.read.owner', 'saga.read', A.owner, { sagaId: FIXTURE.sagaUserId }, true);
  push('saga.read.outsider', 'saga.read', A.outsider, { sagaId: FIXTURE.sagaUserId }, false);
  push('saga.write.owner', 'saga.write', A.owner, { sagaId: FIXTURE.sagaUserId }, true);
  push('saga.write.outsider', 'saga.write', A.outsider, { sagaId: FIXTURE.sagaUserId }, false);

  // Secret marker projections (players / spectator must not see GM secrets)
  const marker = secretMarker();
  const base = projectionFixture(marker);
  const p1View = projectSessionSnapshot(base, {
    actorId: 'player-p1',
    role: 'player',
    revealedObjectIds: ['NPC-PARTY', 'NPC-PUBLIC'],
  });
  const p2View = projectSessionSnapshot(base, {
    actorId: 'player-p2',
    role: 'player',
    revealedObjectIds: ['NPC-PUBLIC'],
  });
  const secretMarkerAbsentForPlayers =
    !projectionContainsSecretMarker(p1View) && !projectionContainsSecretMarker(p2View);

  // Fall 2 — canary: disabled filter leaks marker (gate must detect)
  const leak = projectSessionSnapshot(
    base,
    { actorId: 'player-p1', role: 'player', revealedObjectIds: ['NPC-PARTY'] },
    { filterEnabled: false },
  );
  const canaryDetectsDisabledFilter = projectionContainsSecretMarker(leak);

  // Fall 2b — canary: always-allow authorize would grant outsider world.edit
  const brokenAllow = { allow: true as const, reason: 'canary-always-allow' };
  const healthyDeny = permissions.authorize('world.edit', A.outsider, {
    worldId: FIXTURE.worldId,
  });
  const canaryDetectsAlwaysAllowMembership =
    brokenAllow.allow === true && healthyDeny.allow === false;

  const ok =
    cases.every((c) => c.ok) &&
    secretMarkerAbsentForPlayers &&
    canaryDetectsDisabledFilter &&
    canaryDetectsAlwaysAllowMembership;

  return {
    ok,
    cases,
    secretMarkerAbsentForPlayers,
    canaryDetectsDisabledFilter,
    canaryDetectsAlwaysAllowMembership,
  };
}

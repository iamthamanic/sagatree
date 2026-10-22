/**
 * Synthetic Postgres-like fixture for MIG-503 dry-run (no production data).
 * Location: server/src/migration/postgres/synthetic-fixture.ts
 */
import type { MappedTableName } from './table-map.ts';

/** Fixture row values use Postgres-like shapes before mapping. */
export type PgFixtureRow = Record<string, unknown>;

export type PgFixtureSnapshot = {
  readonly snapshotId: string;
  readonly tables: Readonly<Partial<Record<MappedTableName, readonly PgFixtureRow[]>>> &
    Readonly<Record<string, readonly PgFixtureRow[]>>;
  /**
   * Synthetic visibility expectations after transfer (secure contract).
   * Not persisted columns — used for post-transfer projection checks only.
   */
  readonly visibilityContract: {
    readonly worldId: string;
    readonly projectId: string;
    readonly ownerUserId: string;
    readonly gmUserId: string;
    readonly playerUserId: string;
    readonly inactiveUserId: string;
    readonly strangerUserId: string;
    /** Synthetic "secret" label that must remain owner/GM scoped in projections. */
    readonly secretLabel: string;
  };
};

export const SYNTHETIC_SNAPSHOT_ID = 'mig-503-synthetic-fixture-v1';

const WORLD_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PLAYER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const INACTIVE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const STRANGER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CREATED = '2026-10-21T12:00:00.000Z';
const JOINED = '2026-10-21T12:30:00.000Z';

/**
 * Frozen synthetic snapshot: one world, one project, GM + player + inactive membership.
 * Includes owner/GM/player relationships required by host bootstrap FK graph.
 */
export function createSyntheticPostgresFixture(): PgFixtureSnapshot {
  return {
    snapshotId: SYNTHETIC_SNAPSHOT_ID,
    tables: {
      worlds: [
        {
          id: WORLD_ID,
          owner_user_id: OWNER,
          title: 'Synthetic Dry-Run World',
          created_at: CREATED,
        },
      ],
      projects: [
        {
          id: PROJECT_ID,
          world_id: WORLD_ID,
          gm_user_id: GM,
          title: 'Synthetic Dry-Run Saga',
          created_at: CREATED,
        },
      ],
      project_members: [
        {
          project_id: PROJECT_ID,
          user_id: GM,
          role: 'gm',
          active: true,
          joined_at: JOINED,
        },
        {
          project_id: PROJECT_ID,
          user_id: PLAYER,
          role: 'player',
          active: true,
          joined_at: JOINED,
        },
        {
          project_id: PROJECT_ID,
          user_id: INACTIVE,
          role: 'player',
          active: false,
          joined_at: JOINED,
        },
      ],
    },
    visibilityContract: {
      worldId: WORLD_ID,
      projectId: PROJECT_ID,
      ownerUserId: OWNER,
      gmUserId: GM,
      playerUserId: PLAYER,
      inactiveUserId: INACTIVE,
      strangerUserId: STRANGER,
      secretLabel: 'synthetic-secret-label-do-not-import-from-prod',
    },
  };
}

/**
 * Same snapshot plus an unmapped table — must fail closed.
 */
export function createFixtureWithUnmappedTable(): PgFixtureSnapshot {
  const base = createSyntheticPostgresFixture();
  return {
    ...base,
    snapshotId: `${SYNTHETIC_SNAPSHOT_ID}-unmapped`,
    tables: {
      ...base.tables,
      legacy_secret_notes: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          body: 'must-not-import',
          owner_user_id: base.visibilityContract.ownerUserId,
        },
      ],
    },
  };
}

/**
 * Saga permission grants/bundles/bindings (#875). Private — permissions public API only.
 * Location: server/src/modules/permissions/internal/saga-governance-store.ts
 *
 * Project membership / public-id resolution MUST come from project ports (no cross-module SQL).
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { ProjectPorts } from '../../project/index.ts';

export type GovernanceError = { readonly ok: false; readonly error: string };
export type Ok<T> = { readonly ok: true; readonly value: T };

export type ActorIds = readonly string[];

function nowIso(): string {
  return new Date().toISOString();
}

const ASSET_READ_KEYS: Record<string, { party: string; hidden: string }> = {
  npc: { party: 'saga.npc.read', hidden: 'saga.npc.read_hidden' },
  item: { party: 'saga.items.read', hidden: 'saga.items.read_hidden' },
  quest: { party: 'saga.quests.read', hidden: 'saga.quests.read_hidden' },
  lore: { party: 'saga.lore.read', hidden: 'saga.lore.read_hidden' },
  secret: { party: 'saga.secrets.read', hidden: 'saga.secrets.read' },
};

export class SagaGovernanceStore {
  readonly #db: HostDatabase;
  readonly #project: ProjectPorts;

  constructor(db: HostDatabase, project: ProjectPorts) {
    this.#db = db;
    this.#project = project;
  }

  #withImmediateTx<T>(fn: () => T): T {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      this.#db.exec('COMMIT');
      return value;
    } catch (err) {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  hasSagaPermission(projectId: string, actorIds: ActorIds, key: string): boolean {
    if (this.#project.isProjectGm(projectId, actorIds)) return true;
    // Grants only apply while the actor still has an active project membership (via project port).
    if (!this.#project.isActiveMember(projectId, actorIds)) return false;
    const ids = actorIds.filter((id) => typeof id === 'string' && id.length > 0);
    if (ids.length === 0) return false;
    const placeholders = ids.map(() => '?').join(',');
    const row = this.#db
      .prepare(
        `SELECT 1 AS ok
         FROM project_member_saga_grants g
         WHERE g.project_id = ?
           AND g.user_id IN (${placeholders})
           AND g.permission_key = ?
         LIMIT 1`,
      )
      .get(projectId, ...ids, key) as { ok: number } | undefined;
    return Boolean(row);
  }

  getMyPermissions(
    actorIds: ActorIds,
    publicId: string,
  ): Ok<{
    projectId: string;
    bundleId: string | null;
    isGm: boolean;
    keys: string[];
  }> | GovernanceError {
    if (actorIds.length === 0 || !actorIds[0]) return { ok: false, error: 'not authenticated' };
    const project = this.#project.resolveByPublicId(publicId);
    if (!project) return { ok: false, error: 'saga not found' };
    const isGm = this.#project.isProjectGm(project.id, actorIds);
    if (!isGm && !this.#project.isActiveMember(project.id, actorIds)) {
      return { ok: false, error: 'not a member' };
    }
    const placeholders = actorIds.map(() => '?').join(',');
    const bundleRow = this.#db
      .prepare(
        `SELECT bundle_id AS bundleId FROM project_member_saga_bundles
         WHERE project_id = ? AND user_id IN (${placeholders})
         LIMIT 1`,
      )
      .get(project.id, ...actorIds) as { bundleId: string } | undefined;
    let keys: string[];
    let bundleId = bundleRow?.bundleId ?? null;
    if (isGm) {
      keys = (
        this.#db.prepare(`SELECT key FROM saga_permission_keys ORDER BY key`).all() as {
          key: string;
        }[]
      ).map((r) => r.key);
      bundleId = bundleId ?? 'bundle.saga.gm';
    } else {
      keys = (
        this.#db
          .prepare(
            `SELECT DISTINCT g.permission_key AS key
             FROM project_member_saga_grants g
             WHERE g.project_id = ?
               AND g.user_id IN (${placeholders})
             ORDER BY g.permission_key`,
          )
          .all(project.id, ...actorIds) as { key: string }[]
      ).map((r) => r.key);
    }
    return {
      ok: true,
      value: { projectId: project.id, bundleId, isGm, keys },
    };
  }

  listMemberPermissionState(
    actorIds: ActorIds,
    publicId: string,
  ): Ok<
    readonly {
      memberId: string;
      userId: string;
      role: string;
      status: string;
      bundleId: string | null;
      canSetBundle: boolean;
    }[]
  > | GovernanceError {
    if (actorIds.length === 0 || !actorIds[0]) return { ok: false, error: 'not authenticated' };
    const project = this.#project.resolveByPublicId(publicId);
    if (!project) return { ok: false, error: 'saga not found' };
    if (
      !this.hasSagaPermission(project.id, actorIds, 'saga.members.read') &&
      !this.#project.isProjectGm(project.id, actorIds)
    ) {
      return { ok: false, error: 'missing saga.members.read' };
    }
    const canSetBundle =
      this.hasSagaPermission(project.id, actorIds, 'saga.members.set_bundle') ||
      this.#project.isProjectGm(project.id, actorIds);
    const members = this.#project.listActiveMembers(project.id);
    return {
      ok: true,
      value: members.map((m) => {
        const bundle = this.#db
          .prepare(
            `SELECT bundle_id AS bundleId FROM project_member_saga_bundles WHERE member_id = ?`,
          )
          .get(m.memberId) as { bundleId: string } | undefined;
        return {
          memberId: m.memberId,
          userId: m.userId,
          role: m.role,
          status: m.status,
          bundleId: bundle?.bundleId ?? null,
          canSetBundle,
        };
      }),
    };
  }

  setMemberBundle(
    actorIds: ActorIds,
    projectId: string,
    memberId: string,
    bundleId: string,
  ): Ok<{ memberId: string; bundleId: string; grantCount: number }> | GovernanceError {
    if (actorIds.length === 0 || !actorIds[0]) return { ok: false, error: 'not authenticated' };
    if (
      !this.hasSagaPermission(projectId, actorIds, 'saga.members.set_bundle') &&
      !this.#project.isProjectGm(projectId, actorIds)
    ) {
      return { ok: false, error: 'missing saga.members.set_bundle' };
    }
    const bundle = this.#db
      .prepare(`SELECT id FROM saga_permission_bundles WHERE id = ?`)
      .get(bundleId) as { id: string } | undefined;
    if (!bundle) return { ok: false, error: `unknown bundle ${bundleId}` };

    try {
      return this.#withImmediateTx(() => {
        const member = this.#project.getActiveMemberById(projectId, memberId);
        if (!member) return { ok: false, error: 'member not found' };

        if (bundleId !== 'bundle.saga.gm') {
          const activeMembers = this.#project.listActiveMembers(projectId);
          const activeMemberIds = new Set(activeMembers.map((m) => m.memberId));
          const governanceHolders = this.#db
            .prepare(
              `SELECT member_id AS memberId, user_id AS userId
               FROM project_member_saga_grants
               WHERE project_id = ?
                 AND permission_key = 'saga.members.set_bundle'`,
            )
            .all(projectId) as { memberId: string; userId: string }[];
          const otherActive = new Set(
            governanceHolders
              .filter((g) => g.memberId !== memberId && activeMemberIds.has(g.memberId))
              .map((g) => g.userId),
          );
          const targetHas = governanceHolders.some((g) => g.memberId === memberId);
          if (otherActive.size < 1 && targetHas) {
            return { ok: false, error: 'cannot revoke last saga.members.set_bundle grant' };
          }
        }

        this.#db.prepare(`DELETE FROM project_member_saga_grants WHERE member_id = ?`).run(memberId);
        const keys = this.#db
          .prepare(
            `SELECT permission_key AS key FROM saga_permission_bundle_keys WHERE bundle_id = ?`,
          )
          .all(bundleId) as { key: string }[];
        const insertGrant = this.#db.prepare(
          `INSERT INTO project_member_saga_grants
             (project_id, member_id, user_id, permission_key, source_bundle_id, granted_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
        );
        for (const { key } of keys) {
          insertGrant.run(projectId, memberId, member.userId, key, bundleId, actorIds[0]);
        }
        this.#db
          .prepare(
            `INSERT INTO project_member_saga_bundles
               (member_id, project_id, user_id, bundle_id, assigned_by, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(member_id) DO UPDATE SET
               bundle_id = excluded.bundle_id,
               assigned_by = excluded.assigned_by,
               updated_at = excluded.updated_at`,
          )
          .run(memberId, projectId, member.userId, bundleId, actorIds[0], nowIso());

        const count = this.#db
          .prepare(`SELECT COUNT(*) AS c FROM project_member_saga_grants WHERE member_id = ?`)
          .get(memberId) as { c: number };
        return {
          ok: true,
          value: { memberId, bundleId, grantCount: count.c },
        };
      });
    } catch {
      return { ok: false, error: 'P0001' };
    }
  }

  #canViewBinding(
    projectId: string,
    actorIds: ActorIds,
    assetKind: string,
    reveal: string,
  ): boolean {
    if (reveal === 'unlisted') return false;
    const map = ASSET_READ_KEYS[assetKind] ?? ASSET_READ_KEYS.secret;
    if (reveal === 'party') {
      return (
        this.#project.isProjectGm(projectId, actorIds) ||
        this.hasSagaPermission(projectId, actorIds, map.party)
      );
    }
    if (reveal === 'gm_only') {
      return (
        this.#project.isProjectGm(projectId, actorIds) ||
        this.hasSagaPermission(projectId, actorIds, map.hidden)
      );
    }
    return false;
  }

  listBindings(
    actorIds: ActorIds,
    publicId: string,
    assetKind: string | null,
  ): Ok<
    readonly {
      id: string;
      assetKind: string;
      assetId: string;
      reveal: string;
      label: string | null;
      metadata: unknown;
      worldPlaceId: string | null;
      updatedAt: string | null;
    }[]
  > | GovernanceError {
    if (actorIds.length === 0 || !actorIds[0]) return { ok: false, error: 'not authenticated' };
    const project = this.#project.resolveByPublicId(publicId);
    if (!project) return { ok: false, error: 'saga not found' };
    if (
      !this.#project.isActiveMember(project.id, actorIds) &&
      !this.#project.isProjectGm(project.id, actorIds)
    ) {
      return { ok: false, error: 'not a member' };
    }
    const rows = this.#db
      .prepare(
        `SELECT id, asset_kind AS assetKind, asset_id AS assetId, reveal, label, metadata,
                world_place_id AS worldPlaceId, updated_at AS updatedAt
         FROM saga_asset_bindings
         WHERE project_id = ?
           AND (? IS NULL OR asset_kind = ?)
           AND reveal <> 'unlisted'
         ORDER BY asset_kind, label, asset_id`,
      )
      .all(project.id, assetKind, assetKind) as {
      id: string;
      assetKind: string;
      assetId: string;
      reveal: string;
      label: string | null;
      metadata: string;
      worldPlaceId: string | null;
      updatedAt: string | null;
    }[];
    const filtered = rows.filter((r) =>
      this.#canViewBinding(project.id, actorIds, r.assetKind, r.reveal),
    );
    return {
      ok: true,
      value: filtered.map((r) => {
        let metadata: unknown = {};
        try {
          metadata = JSON.parse(r.metadata || '{}');
        } catch {
          metadata = {};
        }
        return {
          id: r.id,
          assetKind: r.assetKind,
          assetId: r.assetId,
          reveal: r.reveal,
          label: r.label,
          metadata,
          updatedAt: r.updatedAt,
          worldPlaceId: r.worldPlaceId,
        };
      }),
    };
  }

  setBindingReveal(
    actorIds: ActorIds,
    projectId: string,
    bindingId: string,
    reveal: string,
  ): Ok<{
    id: string;
    assetKind: string;
    assetId: string;
    reveal: string;
    label: string | null;
  }> | GovernanceError {
    if (actorIds.length === 0 || !actorIds[0]) return { ok: false, error: 'not authenticated' };
    if (!['gm_only', 'party', 'unlisted'].includes(reveal)) {
      return { ok: false, error: `invalid reveal ${reveal}` };
    }
    if (
      !this.hasSagaPermission(projectId, actorIds, 'saga.secrets.reveal') &&
      !this.#project.isProjectGm(projectId, actorIds)
    ) {
      return { ok: false, error: 'missing saga.secrets.reveal' };
    }
    const updated = this.#db
      .prepare(
        `UPDATE saga_asset_bindings
         SET reveal = ?, updated_at = ?
         WHERE id = ? AND project_id = ?
         RETURNING id, asset_kind AS assetKind, asset_id AS assetId, reveal, label`,
      )
      .get(reveal, nowIso(), bindingId, projectId) as
      | { id: string; assetKind: string; assetId: string; reveal: string; label: string | null }
      | undefined;
    if (!updated) return { ok: false, error: 'binding not found' };
    return { ok: true, value: updated };
  }

  seedBindingForTests(input: {
    readonly projectId: string;
    readonly assetKind: string;
    readonly assetId: string;
    readonly reveal: 'gm_only' | 'party' | 'unlisted';
    readonly label?: string;
  }): string {
    const id = randomUUID();
    this.#db
      .prepare(
        `INSERT INTO saga_asset_bindings
           (id, project_id, asset_kind, asset_id, reveal, label, metadata, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, '{}', ?)`,
      )
      .run(
        id,
        input.projectId,
        input.assetKind,
        input.assetId,
        input.reveal,
        input.label ?? null,
        nowIso(),
      );
    return id;
  }
}

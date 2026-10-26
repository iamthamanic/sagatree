/**
 * Saga permission grants/bundles/bindings (#875). Private — permissions public API only.
 * Location: server/src/modules/permissions/internal/saga-governance-store.ts
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type GovernanceError = { readonly ok: false; readonly error: string };
export type Ok<T> = { readonly ok: true; readonly value: T };

function nowIso(): string {
  return new Date().toISOString();
}

function normalizePublicId(raw: string): string {
  return raw.trim().toUpperCase();
}

export class SagaGovernanceStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
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

  resolveProjectByPublicId(publicId: string): { id: string; gmUserId: string } | null {
    const normalized = normalizePublicId(publicId);
    if (!normalized) return null;
    return (
      (this.#db
        .prepare(
          `SELECT id, gm_user_id AS gmUserId FROM projects WHERE public_id IS NOT NULL AND UPPER(TRIM(public_id)) = ?`,
        )
        .get(normalized) as { id: string; gmUserId: string } | undefined) ?? null
    );
  }

  isProjectGm(projectId: string, actorId: string): boolean {
    const row = this.#db
      .prepare(`SELECT 1 AS ok FROM projects WHERE id = ? AND gm_user_id = ?`)
      .get(projectId, actorId) as { ok: number } | undefined;
    return Boolean(row);
  }

  isActiveMember(projectId: string, actorId: string): boolean {
    const row = this.#db
      .prepare(
        `SELECT 1 AS ok FROM project_members WHERE project_id = ? AND user_id = ? AND active = 1`,
      )
      .get(projectId, actorId) as { ok: number } | undefined;
    return Boolean(row);
  }

  hasSagaPermission(projectId: string, actorId: string, key: string): boolean {
    if (this.isProjectGm(projectId, actorId)) return true;
    const row = this.#db
      .prepare(
        `SELECT 1 AS ok FROM project_member_saga_grants
         WHERE project_id = ? AND user_id = ? AND permission_key = ?`,
      )
      .get(projectId, actorId, key) as { ok: number } | undefined;
    return Boolean(row);
  }

  getMyPermissions(
    actorId: string,
    publicId: string,
  ): Ok<{
    projectId: string;
    bundleId: string | null;
    isGm: boolean;
    keys: string[];
  }> | GovernanceError {
    if (!actorId) return { ok: false, error: 'not authenticated' };
    const project = this.resolveProjectByPublicId(publicId);
    if (!project) return { ok: false, error: 'saga not found' };
    const isGm = project.gmUserId === actorId;
    if (!isGm && !this.isActiveMember(project.id, actorId)) {
      return { ok: false, error: 'not a member' };
    }
    const bundleRow = this.#db
      .prepare(
        `SELECT bundle_id AS bundleId FROM project_member_saga_bundles
         WHERE project_id = ? AND user_id = ?`,
      )
      .get(project.id, actorId) as { bundleId: string } | undefined;
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
            `SELECT permission_key AS key FROM project_member_saga_grants
             WHERE project_id = ? AND user_id = ?
             ORDER BY permission_key`,
          )
          .all(project.id, actorId) as { key: string }[]
      ).map((r) => r.key);
    }
    return {
      ok: true,
      value: { projectId: project.id, bundleId, isGm, keys },
    };
  }

  listMemberPermissionState(
    actorId: string,
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
    if (!actorId) return { ok: false, error: 'not authenticated' };
    const project = this.resolveProjectByPublicId(publicId);
    if (!project) return { ok: false, error: 'saga not found' };
    if (
      !this.hasSagaPermission(project.id, actorId, 'saga.members.read') &&
      !this.isProjectGm(project.id, actorId)
    ) {
      return { ok: false, error: 'missing saga.members.read' };
    }
    const canSetBundle =
      this.hasSagaPermission(project.id, actorId, 'saga.members.set_bundle') ||
      this.isProjectGm(project.id, actorId);
    const rows = this.#db
      .prepare(
        `SELECT m.id AS memberId, m.user_id AS userId, m.role AS role,
                CASE WHEN m.active = 1 THEN 'active' ELSE 'inactive' END AS status,
                b.bundle_id AS bundleId, m.joined_at AS joinedAt
         FROM project_members m
         LEFT JOIN project_member_saga_bundles b ON b.member_id = m.id
         WHERE m.project_id = ? AND m.active = 1
         ORDER BY m.joined_at`,
      )
      .all(project.id) as {
      memberId: string;
      userId: string;
      role: string;
      status: string;
      bundleId: string | null;
      joinedAt: string | null;
    }[];
    return {
      ok: true,
      value: rows.map((r) => ({
        memberId: r.memberId,
        userId: r.userId,
        role: r.role,
        status: r.status,
        bundleId: r.bundleId,
        canSetBundle,
      })),
    };
  }

  setMemberBundle(
    actorId: string,
    projectId: string,
    memberId: string,
    bundleId: string,
  ): Ok<{ memberId: string; bundleId: string; grantCount: number }> | GovernanceError {
    if (!actorId) return { ok: false, error: 'not authenticated' };
    if (
      !this.hasSagaPermission(projectId, actorId, 'saga.members.set_bundle') &&
      !this.isProjectGm(projectId, actorId)
    ) {
      return { ok: false, error: 'missing saga.members.set_bundle' };
    }
    const bundle = this.#db
      .prepare(`SELECT id FROM saga_permission_bundles WHERE id = ?`)
      .get(bundleId) as { id: string } | undefined;
    if (!bundle) return { ok: false, error: `unknown bundle ${bundleId}` };

    try {
      return this.#withImmediateTx(() => {
        const member = this.#db
          .prepare(
            `SELECT id, user_id AS userId FROM project_members
             WHERE id = ? AND project_id = ? AND active = 1`,
          )
          .get(memberId, projectId) as { id: string; userId: string } | undefined;
        if (!member) return { ok: false, error: 'member not found' };

        if (bundleId !== 'bundle.saga.gm') {
          const governanceLeft = this.#db
            .prepare(
              `SELECT COUNT(DISTINCT g.user_id) AS c
               FROM project_member_saga_grants g
               JOIN project_members m ON m.id = g.member_id
               WHERE g.project_id = ?
                 AND g.permission_key = 'saga.members.set_bundle'
                 AND m.active = 1
                 AND g.member_id <> ?`,
            )
            .get(projectId, memberId) as { c: number };
          const targetHas = this.#db
            .prepare(
              `SELECT 1 AS ok FROM project_member_saga_grants
               WHERE member_id = ? AND permission_key = 'saga.members.set_bundle'`,
            )
            .get(memberId) as { ok: number } | undefined;
          if ((governanceLeft?.c ?? 0) < 1 && targetHas) {
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
          insertGrant.run(projectId, memberId, member.userId, key, bundleId, actorId);
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
          .run(memberId, projectId, member.userId, bundleId, actorId, nowIso());

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

  listBindings(
    actorId: string,
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
    }[]
  > | GovernanceError {
    if (!actorId) return { ok: false, error: 'not authenticated' };
    const project = this.resolveProjectByPublicId(publicId);
    if (!project) return { ok: false, error: 'saga not found' };
    if (!this.isActiveMember(project.id, actorId) && !this.isProjectGm(project.id, actorId)) {
      return { ok: false, error: 'not a member' };
    }
    const isGm = this.isProjectGm(project.id, actorId);
    const rows = this.#db
      .prepare(
        `SELECT id, asset_kind AS assetKind, asset_id AS assetId, reveal, label, metadata,
                world_place_id AS worldPlaceId
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
    }[];
    const filtered = rows.filter((r) => {
      if (r.reveal === 'party') return true;
      if (r.reveal === 'gm_only') return isGm || this.hasSagaPermission(project.id, actorId, 'saga.secrets.read');
      return false;
    });
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
          worldPlaceId: r.worldPlaceId,
        };
      }),
    };
  }

  setBindingReveal(
    actorId: string,
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
    if (!actorId) return { ok: false, error: 'not authenticated' };
    if (!['gm_only', 'party', 'unlisted'].includes(reveal)) {
      return { ok: false, error: `invalid reveal ${reveal}` };
    }
    if (
      !this.hasSagaPermission(projectId, actorId, 'saga.secrets.reveal') &&
      !this.isProjectGm(projectId, actorId)
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

  /** Test helper: seed a binding row. */
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
      .run(id, input.projectId, input.assetKind, input.assetId, input.reveal, input.label ?? null, nowIso());
    return id;
  }
}

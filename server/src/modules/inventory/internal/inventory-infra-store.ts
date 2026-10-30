/**
 * Owner-scoped inventory + catalog ports for MIG-303 / #802.
 * Private — import only from inventory public API.
 * Location: server/src/modules/inventory/internal/inventory-infra-store.ts
 *
 * Supabase remains live FE default. Creator thumbnail/model Edge shapes stay in
 * item-thumbnail / item-model3d modules (not moved here).
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';

export const INVENTORY_INFRA_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export type InventoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type InventoryStateRecord = {
  readonly characterId: string;
  readonly schemaVersion: number;
  readonly inventory: Readonly<Record<string, unknown>>;
  readonly updatedAt: string;
};

export type InventoryDefinitionRecord = {
  readonly id: string;
  readonly publicId: string;
  readonly origin: 'standard' | 'personal' | 'world';
  readonly ownerUserId: string | null;
  readonly worldProfileId: string | null;
  readonly status: 'active' | 'archived';
  readonly name: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type InventoryDefinitionDraft = {
  readonly name?: unknown;
  readonly origin?: unknown;
  readonly worldProfileId?: unknown;
  readonly payload?: unknown;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function parseJson(raw: string | null | undefined): Record<string, unknown> {
  try {
    return asObject(JSON.parse(raw || '{}'));
  } catch {
    return {};
  }
}

function parseOrigin(value: unknown): 'standard' | 'personal' | 'world' | null {
  return value === 'standard' || value === 'personal' || value === 'world' ? value : null;
}

type CharacterInvRow = {
  id: string;
  owner_user_id: string;
  character_type: string;
  deleted_at: string | null;
  inventory_schema_version: number;
  inventory_json: string;
  updated_at: string | null;
  created_at: string;
};

type DefinitionRow = {
  id: string;
  public_id: string;
  origin: string;
  owner_user_id: string | null;
  world_profile_id: string | null;
  status: string;
  name: string;
  payload_json: string;
};

function mapDefinition(row: DefinitionRow): InventoryDefinitionRecord {
  const origin = parseOrigin(row.origin) ?? 'personal';
  return {
    id: row.id,
    publicId: row.public_id,
    origin,
    ownerUserId: row.owner_user_id,
    worldProfileId: row.world_profile_id,
    status: row.status === 'archived' ? 'archived' : 'active',
    name: row.name,
    payload: parseJson(row.payload_json),
  };
}

export class InventoryInfraStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  getOwnedInventory(
    actorId: string,
    characterId: string,
  ): InventoryResult<InventoryStateRecord | null> {
    const row = this.#loadOwnedPc(actorId, characterId);
    if (!row.ok) return row;
    if (!row.value) return { ok: true, value: null };
    return {
      ok: true,
      value: {
        characterId: row.value.id,
        schemaVersion: Number(row.value.inventory_schema_version) || 0,
        inventory: parseJson(row.value.inventory_json),
        updatedAt: row.value.updated_at ?? row.value.created_at,
      },
    };
  }

  /**
   * Replace inventory payload for an owned PC (add/equip/consume land as full state writes).
   * Cross-owner DENY; never trusts client-supplied owner fields.
   */
  putOwnedInventory(
    actorId: string,
    characterId: string,
    inventory: unknown,
  ): InventoryResult<InventoryStateRecord> {
    if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) {
      return { ok: false, error: 'invalid-inventory' };
    }
    const body = asObject(inventory);
    const updatedAt = nowIso();
    let inTx = false;
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      inTx = true;
      const locked = this.#db
        .prepare(
          `SELECT * FROM characters
           WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL AND character_type = 'pc'`,
        )
        .get(characterId, actorId) as CharacterInvRow | undefined;
      if (!locked) {
        this.#db.exec('ROLLBACK');
        inTx = false;
        const any = this.#db
          .prepare(
            `SELECT owner_user_id AS ownerUserId FROM characters
             WHERE id = ? AND deleted_at IS NULL AND character_type = 'pc'`,
          )
          .get(characterId) as { ownerUserId: string } | undefined;
        if (any && any.ownerUserId !== actorId) {
          return { ok: false, error: 'not-authorized' };
        }
        return { ok: false, error: 'not-found' };
      }
      const changed = this.#db
        .prepare(
          `UPDATE characters SET
             inventory_json = ?, inventory_schema_version = 2, updated_at = ?
           WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL AND character_type = 'pc'`,
        )
        .run(JSON.stringify(body), updatedAt, characterId, actorId);
      if (changed.changes !== 1) {
        this.#db.exec('ROLLBACK');
        inTx = false;
        return { ok: false, error: 'not-found' };
      }
      this.#db.exec('COMMIT');
      inTx = false;
    } catch {
      if (inTx) {
        try {
          this.#db.exec('ROLLBACK');
        } catch {
          /* ignore */
        }
      }
      return { ok: false, error: 'update-failed' };
    }
    const next = this.getOwnedInventory(actorId, characterId);
    if (!next.ok || !next.value) return { ok: false, error: 'not-found' };
    return { ok: true, value: next.value };
  }

  listCatalog(
    actorId: string,
    options?: { readonly worldProfileId?: string | null; readonly query?: string },
  ): InventoryResult<readonly InventoryDefinitionRecord[]> {
    const worldProfileId =
      typeof options?.worldProfileId === 'string' && options.worldProfileId.trim()
        ? options.worldProfileId.trim()
        : null;
    const q =
      typeof options?.query === 'string' && options.query.trim()
        ? `%${options.query.trim().toLowerCase()}%`
        : null;
    const rows = this.#db
      .prepare(
        `SELECT * FROM inventory_item_definitions
         WHERE status = 'active'
           AND (
             origin = 'standard'
             OR (origin = 'personal' AND owner_user_id = ?)
             OR (origin = 'world' AND world_profile_id IS NOT NULL AND world_profile_id = ?)
           )
           AND (? IS NULL OR lower(name) LIKE ?)
         ORDER BY name ASC`,
      )
      .all(actorId, worldProfileId, q, q) as DefinitionRow[];
    return { ok: true, value: rows.map(mapDefinition) };
  }

  createDefinition(
    actorId: string,
    draft: InventoryDefinitionDraft,
  ): InventoryResult<InventoryDefinitionRecord> {
    const name = typeof draft.name === 'string' ? draft.name.trim() : '';
    if (!name) return { ok: false, error: 'name-required' };
    // Server assigns origin — never promote client-supplied elevated origins.
    const requested = parseOrigin(draft.origin);
    if (requested === 'standard') {
      return { ok: false, error: 'origin-not-allowed' };
    }
    const origin: 'personal' | 'world' = requested === 'world' ? 'world' : 'personal';
    const worldProfileId =
      origin === 'world' && typeof draft.worldProfileId === 'string'
        ? draft.worldProfileId.trim()
        : null;
    if (origin === 'world' && !worldProfileId) {
      return { ok: false, error: 'world-profile-required' };
    }
    const payload = asObject(draft.payload);
    const id = randomUUID();
    const publicId = `IT-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const createdAt = nowIso();
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      this.#db
        .prepare(
          `INSERT INTO inventory_item_definitions
             (id, public_id, origin, owner_user_id, world_profile_id, status, name, payload_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
        )
        .run(
          id,
          publicId,
          origin,
          origin === 'personal' ? actorId : null,
          worldProfileId,
          name,
          JSON.stringify(payload),
          createdAt,
          createdAt,
        );
      this.#db.exec('COMMIT');
    } catch {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: 'create-failed' };
    }
    return {
      ok: true,
      value: {
        id,
        publicId,
        origin,
        ownerUserId: origin === 'personal' ? actorId : null,
        worldProfileId,
        status: 'active',
        name,
        payload,
      },
    };
  }

  seedStandardDefinition(input: {
    readonly name: string;
    readonly payload?: Readonly<Record<string, unknown>>;
  }): InventoryDefinitionRecord {
    const id = randomUUID();
    const publicId = `IT-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const createdAt = nowIso();
    this.#db
      .prepare(
        `INSERT INTO inventory_item_definitions
           (id, public_id, origin, owner_user_id, world_profile_id, status, name, payload_json, created_at, updated_at)
         VALUES (?, ?, 'standard', NULL, NULL, 'active', ?, ?, ?, ?)`,
      )
      .run(id, publicId, input.name, JSON.stringify(input.payload ?? {}), createdAt, createdAt);
    return {
      id,
      publicId,
      origin: 'standard',
      ownerUserId: null,
      worldProfileId: null,
      status: 'active',
      name: input.name,
      payload: input.payload ?? {},
    };
  }

  #loadOwnedPc(
    actorId: string,
    characterId: string,
  ): InventoryResult<CharacterInvRow | null> {
    const any = this.#db
      .prepare(
        `SELECT id, owner_user_id, character_type, deleted_at, inventory_schema_version,
                inventory_json, updated_at, created_at
         FROM characters
         WHERE id = ? AND deleted_at IS NULL AND character_type = 'pc'`,
      )
      .get(characterId) as CharacterInvRow | undefined;
    if (!any) return { ok: true, value: null };
    if (any.owner_user_id !== actorId) return { ok: false, error: 'not-authorized' };
    return { ok: true, value: any };
  }
}

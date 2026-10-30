/**
 * Owner-scoped inventory + catalog ports for MIG-303 / #802.
 * Private — import only from inventory public API.
 * Location: server/src/modules/inventory/internal/inventory-infra-store.ts
 *
 * Supabase remains live FE default. Creator thumbnail/model Edge shapes stay in
 * item-thumbnail / item-model3d modules (not moved here).
 *
 * characters.inventory_* writes go through injected CharacterInventoryColumnsStore
 * (character module owns the characters table). World ACL via injected lookup.
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import {
  collectDefinitionIds,
  isHostInventoryV2State,
} from './inventory-v2-shape.ts';
import { generateItemPublicId } from './public-item-id.ts';

export const INVENTORY_INFRA_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

/** Cap catalog responses — unbounded LIKE+sort without LIMIT is unsafe. */
export const INVENTORY_CATALOG_LIST_LIMIT = 500 as const;

/**
 * characters.inventory_schema_version marker for authoritative v2 payloads.
 * Distinct from JSON `schemaVersion` (always 1 inside InventoryState).
 */
export const INVENTORY_COLUMN_SCHEMA_VERSION = 2 as const;

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

/** World ACL via owning module / composition — no worlds SQL inside inventory. */
export type InventoryWorldLookup = {
  readonly canReadWorldProfile: (
    actorIds: readonly string[],
    worldProfileId: string,
  ) => boolean;
  readonly canEditWorldProfile: (
    actorIds: readonly string[],
    worldProfileId: string,
  ) => boolean;
};

type CharacterColumnsResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

type CharacterColumnsRecord = {
  readonly characterId: string;
  readonly schemaVersion: number;
  readonly inventoryJson: string;
  readonly updatedAt: string;
};

/** Character-table inventory column port (owned by character module; wired at composition). */
export type InventoryCharacterColumns = {
  readonly getOwned: (
    actorId: string,
    characterId: string,
  ) => CharacterColumnsResult<CharacterColumnsRecord | null>;
  readonly putOwned: (
    actorId: string,
    characterId: string,
    inventoryJson: string,
    schemaVersion: number,
    updatedAt: string,
    revalidateUnderLock?: () => CharacterColumnsResult<true>,
  ) => CharacterColumnsResult<CharacterColumnsRecord>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

/**
 * Parse payload JSON; invalid blobs surface as empty only for read projection.
 * Write path never uses this for inventory_v2 acceptance.
 */
function parseJson(raw: string | null | undefined): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw || '{}');
    return asObject(parsed);
  } catch {
    return {};
  }
}

function parseOrigin(value: unknown): 'standard' | 'personal' | 'world' | null {
  return value === 'standard' || value === 'personal' || value === 'world' ? value : null;
}

/** Escape LIKE wildcards so user query cannot match everything via % / _. */
function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

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

function mapDefinition(row: DefinitionRow): InventoryDefinitionRecord | null {
  const origin = parseOrigin(row.origin);
  if (!origin) return null;
  // Unknown / corrupt status → treat as archived (hidden), never promote to active.
  if (row.status !== 'active' && row.status !== 'archived') return null;
  return {
    id: row.id,
    publicId: row.public_id,
    origin,
    ownerUserId: row.owner_user_id,
    worldProfileId: row.world_profile_id,
    status: row.status,
    name: row.name,
    payload: parseJson(row.payload_json),
  };
}

export class InventoryInfraStore {
  readonly #db: HostDatabase;
  readonly #world: InventoryWorldLookup;
  readonly #character: InventoryCharacterColumns;

  constructor(
    db: HostDatabase,
    world: InventoryWorldLookup,
    character: InventoryCharacterColumns,
  ) {
    this.#db = db;
    this.#world = world;
    this.#character = character;
  }

  getOwnedInventory(
    actorId: string,
    characterId: string,
  ): InventoryResult<InventoryStateRecord | null> {
    const row = this.#character.getOwned(actorId, characterId);
    if (!row.ok) return row;
    if (!row.value) return { ok: true, value: null };
    return {
      ok: true,
      value: {
        characterId: row.value.characterId,
        schemaVersion: row.value.schemaVersion,
        inventory: parseJson(row.value.inventoryJson),
        updatedAt: row.value.updatedAt,
      },
    };
  }

  /**
   * Replace inventory payload for an owned PC (add/equip/consume land as full state writes).
   * Cross-owner DENY; never trusts client-supplied owner fields.
   * Requires valid Inventory v2 shape + visible definition ids.
   */
  putOwnedInventory(
    actorId: string,
    characterId: string,
    inventory: unknown,
  ): InventoryResult<InventoryStateRecord> {
    if (!isHostInventoryV2State(inventory)) {
      return { ok: false, error: 'invalid-inventory' };
    }
    const body = inventory;
    const definitionIds = collectDefinitionIds(body);
    const definitionsVisible = (): boolean => {
      if (definitionIds.length === 0) return true;
      const visible = this.#visibleDefinitionIds(actorId, definitionIds);
      if (visible === null) return false;
      return definitionIds.every((id) => visible.has(id));
    };
    if (!definitionsVisible()) {
      return { ok: false, error: 'definition-not-visible' };
    }
    const updatedAt = nowIso();
    const written = this.#character.putOwned(
      actorId,
      characterId,
      JSON.stringify(body),
      INVENTORY_COLUMN_SCHEMA_VERSION,
      updatedAt,
      () => {
        // Re-check under characters write lock (TOCTOU vs archive / ACL revoke).
        if (!definitionsVisible()) {
          return { ok: false, error: 'definition-not-visible' };
        }
        return { ok: true, value: true as const };
      },
    );
    if (!written.ok) return written;
    return {
      ok: true,
      value: {
        characterId: written.value.characterId,
        schemaVersion: written.value.schemaVersion,
        inventory: body,
        updatedAt: written.value.updatedAt,
      },
    };
  }

  listCatalog(
    actorId: string,
    options?: { readonly worldProfileId?: string | null; readonly query?: string },
  ): InventoryResult<readonly InventoryDefinitionRecord[]> {
    const worldProfileId =
      typeof options?.worldProfileId === 'string' && options.worldProfileId.trim()
        ? options.worldProfileId.trim()
        : null;
    if (worldProfileId && !this.#world.canReadWorldProfile([actorId], worldProfileId)) {
      return { ok: false, error: 'not-authorized' };
    }
    const qRaw =
      typeof options?.query === 'string' && options.query.trim()
        ? options.query.trim().toLowerCase()
        : null;
    const q = qRaw ? `%${escapeLikePattern(qRaw)}%` : null;
    const rows = this.#db
      .prepare(
        `SELECT * FROM inventory_item_definitions
         WHERE status = 'active'
           AND (
             origin = 'standard'
             OR (origin = 'personal' AND owner_user_id = ?)
             OR (origin = 'world' AND world_profile_id IS NOT NULL AND world_profile_id = ?)
           )
           AND (? IS NULL OR lower(name) LIKE ? ESCAPE '\\')
         ORDER BY name ASC
         LIMIT ?`,
      )
      .all(actorId, worldProfileId, q, q, INVENTORY_CATALOG_LIST_LIMIT) as DefinitionRow[];
    const mapped: InventoryDefinitionRecord[] = [];
    for (const row of rows) {
      const def = mapDefinition(row);
      if (def && def.status === 'active') mapped.push(def);
    }
    return { ok: true, value: mapped };
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
    if (
      origin === 'world' &&
      worldProfileId &&
      !this.#world.canEditWorldProfile([actorId], worldProfileId)
    ) {
      return { ok: false, error: 'not-authorized' };
    }
    const payload = asObject(draft.payload);
    const id = randomUUID();
    const publicId = this.#allocatePublicId();
    const createdAt = nowIso();
    let inTx = false;
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      inTx = true;
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
      inTx = false;
    } catch {
      if (inTx) {
        try {
          this.#db.exec('ROLLBACK');
        } catch {
          /* ignore */
        }
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
    const publicId = this.#allocatePublicId();
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

  #allocatePublicId(): string {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const candidate = generateItemPublicId();
      const hit = this.#db
        .prepare(`SELECT 1 AS ok FROM inventory_item_definitions WHERE public_id = ? LIMIT 1`)
        .get(candidate) as { ok: number } | undefined;
      if (!hit) return candidate;
    }
    return generateItemPublicId();
  }

  /**
   * Definition ids visible to actor (standard + own personal; world only when ACL allows).
   * Returns null when the lookup fails (e.g. SQLite variable limit) so callers DENY.
   */
  #visibleDefinitionIds(actorId: string, ids: readonly string[]): Set<string> | null {
    const visible = new Set<string>();
    if (ids.length === 0) return visible;
    const placeholders = ids.map(() => '?').join(',');
    let rows: Array<{
      id: string;
      origin: string;
      owner_user_id: string | null;
      world_profile_id: string | null;
      status: string;
    }>;
    try {
      rows = this.#db
        .prepare(
          `SELECT id, origin, owner_user_id, world_profile_id, status
           FROM inventory_item_definitions
           WHERE id IN (${placeholders}) AND status = 'active'`,
        )
        .all(...ids) as typeof rows;
    } catch {
      return null;
    }
    for (const row of rows) {
      if (row.origin === 'standard') {
        visible.add(row.id);
        continue;
      }
      if (row.origin === 'personal' && row.owner_user_id === actorId) {
        visible.add(row.id);
        continue;
      }
      if (
        row.origin === 'world' &&
        row.world_profile_id &&
        this.#world.canReadWorldProfile([actorId], row.world_profile_id)
      ) {
        visible.add(row.id);
      }
    }
    return visible;
  }
}

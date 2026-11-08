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

/** FE-HOST-05/#1097 — catalog list/create via `/api/v1/library/items`. */
export const INVENTORY_INFRA_PUBLIC_ACTIVATION_AUTHORIZED = true as const;

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
    revalidateUnderLock: () => CharacterColumnsResult<true>,
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

function normalizeActorIds(
  actorIdOrIds: string | readonly string[],
): readonly string[] {
  return (typeof actorIdOrIds === 'string' ? [actorIdOrIds] : [...actorIdOrIds]).filter(
    (id) => typeof id === 'string' && id.length > 0,
  );
}

const CATALOG_ORIGINS = ['standard', 'personal', 'world'] as const;
type CatalogOrigin = (typeof CATALOG_ORIGINS)[number];

/** CUT-06b — default all origins; ignore unknown tokens. */
function normalizeCatalogOrigins(
  raw: readonly ('standard' | 'personal' | 'world')[] | undefined,
): ReadonlySet<CatalogOrigin> {
  if (!raw || raw.length === 0) return new Set(CATALOG_ORIGINS);
  const next = new Set<CatalogOrigin>();
  for (const token of raw) {
    if (token === 'standard' || token === 'personal' || token === 'world') next.add(token);
  }
  return next;
}

/** Host mirror of FE InventoryItemType — keep aligned with domains/character/inventory-v2. */
const HOST_ITEM_TYPES = new Set([
  'weapon',
  'armor',
  'shield',
  'tool',
  'consumable',
  'container',
  'misc',
]);

function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

/**
 * Fail-closed writable payload check (mirror of parseItemDefinition core gates).
 * Rejects empty/corrupt replacements that would drop owned-instance resolution.
 */
function assertWritableItemPayload(
  payload: Record<string, unknown>,
  fallbackName: string,
): { ok: true; payload: Record<string, unknown>; name: string } | { ok: false; error: string } {
  const nameRaw = typeof payload.name === 'string' ? payload.name.trim() : fallbackName.trim();
  if (!nameRaw) return { ok: false, error: 'invalid-payload' };
  const type = payload.type;
  if (typeof type !== 'string' || !HOST_ITEM_TYPES.has(type)) {
    return { ok: false, error: 'invalid-payload' };
  }
  if (!isIntegerInRange(payload.load, 0, 3) || !isIntegerInRange(payload.cost, 0, 5)) {
    return { ok: false, error: 'invalid-payload' };
  }
  return { ok: true, payload: { ...payload, name: nameRaw }, name: nameRaw };
}

/**
 * Canonical fork transformation (mirror of domains/items/fork buildForkedItemDefinitionDraft).
 * Sets basedOnDefinitionId + target origin; strips source-owned assetKey/model3d.
 */
function buildForkedHostPayload(
  source: InventoryDefinitionRecord,
  targetOrigin: 'personal' | 'world',
): Record<string, unknown> {
  const {
    assetKey: _assetKey,
    model3d: _model3d,
    basedOnDefinitionId: _basedOn,
    origin: _origin,
    forkedFromId: _forkedFromId,
    forkedFromOrigin: _forkedFromOrigin,
    ...rest
  } = source.payload;
  return {
    ...rest,
    name: typeof rest.name === 'string' && rest.name.trim() ? rest.name : source.name,
    basedOnDefinitionId: source.id,
    origin: targetOrigin,
  };
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
    actorIdOrIds: string | readonly string[],
    options?: {
      readonly worldProfileId?: string | null;
      readonly query?: string;
      /** CUT-06b — include archived rows (world authoring). */
      readonly includeArchived?: boolean;
      /** CUT-06b — restrict origins; default all three. */
      readonly origins?: readonly ('standard' | 'personal' | 'world')[];
    },
  ): InventoryResult<readonly InventoryDefinitionRecord[]> {
    const actorIds = normalizeActorIds(actorIdOrIds);
    if (actorIds.length === 0) return { ok: false, error: 'missing-actor' };
    const worldProfileId =
      typeof options?.worldProfileId === 'string' && options.worldProfileId.trim()
        ? options.worldProfileId.trim()
        : null;
    if (worldProfileId && !this.#world.canReadWorldProfile(actorIds, worldProfileId)) {
      return { ok: false, error: 'not-authorized' };
    }
    const includeArchived = options?.includeArchived === true;
    const origins = normalizeCatalogOrigins(options?.origins);
    if (origins.size === 0) return { ok: true, value: [] };

    const qRaw =
      typeof options?.query === 'string' && options.query.trim()
        ? options.query.trim().toLowerCase()
        : null;
    const q = qRaw ? `%${escapeLikePattern(qRaw)}%` : null;
    const ownerPlaceholders = actorIds.map(() => '?').join(', ');
    const statusSql = includeArchived
      ? `status IN ('active', 'archived')`
      : `status = 'active'`;

    const originSqlParts: string[] = [];
    const originParams: unknown[] = [];
    if (origins.has('standard')) {
      originSqlParts.push(`origin = 'standard'`);
    }
    if (origins.has('personal')) {
      originSqlParts.push(`(origin = 'personal' AND owner_user_id IN (${ownerPlaceholders}))`);
      originParams.push(...actorIds);
    }
    if (origins.has('world')) {
      if (worldProfileId) {
        originSqlParts.push(
          `(origin = 'world' AND world_profile_id IS NOT NULL AND world_profile_id = ?)`,
        );
        originParams.push(worldProfileId);
      } else {
        originSqlParts.push(`(origin = 'world' AND world_profile_id IS NOT NULL)`);
      }
    }
    if (originSqlParts.length === 0) return { ok: true, value: [] };

    const rows = this.#db
      .prepare(
        `SELECT * FROM inventory_item_definitions
         WHERE ${statusSql}
           AND (${originSqlParts.join(' OR ')})
           AND (? IS NULL OR lower(name) LIKE ? ESCAPE '\\')
         ORDER BY name ASC
         LIMIT ?`,
      )
      .all(...originParams, q, q, INVENTORY_CATALOG_LIST_LIMIT) as DefinitionRow[];
    const mapped: InventoryDefinitionRecord[] = [];
    for (const row of rows) {
      const def = mapDefinition(row);
      if (!def) continue;
      if (!includeArchived && def.status !== 'active') continue;
      if (includeArchived && def.status !== 'active' && def.status !== 'archived') continue;
      if (
        def.origin === 'world' &&
        def.worldProfileId &&
        !worldProfileId &&
        !this.#world.canReadWorldProfile(actorIds, def.worldProfileId)
      ) {
        continue;
      }
      mapped.push(def);
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

  /**
   * CUT-06 — update mutable name/payload only. Origin, owner, world and id stay fixed.
   * Standard/core rows are immutable.
   */
  updateDefinition(
    actorIdOrIds: string | readonly string[],
    definitionId: string,
    draft: InventoryDefinitionDraft,
  ): InventoryResult<InventoryDefinitionRecord> {
    const actorIds = normalizeActorIds(actorIdOrIds);
    if (actorIds.length === 0) return { ok: false, error: 'missing-actor' };
    const id = typeof definitionId === 'string' ? definitionId.trim() : '';
    if (!id) return { ok: false, error: 'not-found' };
    const existing = this.#loadDefinition(id);
    if (!existing) return { ok: false, error: 'not-found' };
    if (!this.#canMutateDefinition(actorIds, existing)) {
      return { ok: false, error: 'not-authorized' };
    }
    const draftName =
      typeof draft.name === 'string' && draft.name.trim() ? draft.name.trim() : existing.name;
    const rawPayload =
      draft.payload === undefined
        ? { ...existing.payload, name: draftName }
        : { ...asObject(draft.payload), name: draftName };
    const validated = assertWritableItemPayload(rawPayload, draftName);
    if (!validated.ok) return { ok: false, error: validated.error };
    const { name, payload } = validated;
    const updatedAt = nowIso();
    let inTx = false;
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      inTx = true;
      const result = this.#db
        .prepare(
          `UPDATE inventory_item_definitions
              SET name = ?, payload_json = ?, updated_at = ?
            WHERE id = ?
              AND origin = ?
              AND status IN ('active', 'archived')`,
        )
        .run(name, JSON.stringify(payload), updatedAt, id, existing.origin);
      if (result.changes !== 1) {
        this.#db.exec('ROLLBACK');
        inTx = false;
        return { ok: false, error: 'update-failed' };
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
    return {
      ok: true,
      value: {
        ...existing,
        name,
        payload,
      },
    };
  }

  /** CUT-06 — archive or restore. Archived definitions remain resolvable for owned instances. */
  setDefinitionStatus(
    actorIdOrIds: string | readonly string[],
    definitionId: string,
    status: 'active' | 'archived',
  ): InventoryResult<InventoryDefinitionRecord> {
    const actorIds = normalizeActorIds(actorIdOrIds);
    if (actorIds.length === 0) return { ok: false, error: 'missing-actor' };
    if (status !== 'active' && status !== 'archived') {
      return { ok: false, error: 'invalid-status' };
    }
    const id = typeof definitionId === 'string' ? definitionId.trim() : '';
    if (!id) return { ok: false, error: 'not-found' };
    const existing = this.#loadDefinition(id);
    if (!existing) return { ok: false, error: 'not-found' };
    if (!this.#canMutateDefinition(actorIds, existing)) {
      return { ok: false, error: 'not-authorized' };
    }
    if (existing.status === status) {
      return { ok: true, value: existing };
    }
    const updatedAt = nowIso();
    let inTx = false;
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      inTx = true;
      const result = this.#db
        .prepare(
          `UPDATE inventory_item_definitions
              SET status = ?, updated_at = ?
            WHERE id = ? AND origin = ?`,
        )
        .run(status, updatedAt, id, existing.origin);
      if (result.changes !== 1) {
        this.#db.exec('ROLLBACK');
        inTx = false;
        return { ok: false, error: 'status-failed' };
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
      return { ok: false, error: 'status-failed' };
    }
    return { ok: true, value: { ...existing, status } };
  }

  /**
   * CUT-06 — fork readable source into a new personal/world definition.
   * Never mutates the source; standard/builtin sources are allowed as fork inputs.
   */
  forkDefinition(
    actorIdOrIds: string | readonly string[],
    sourceDefinitionId: string,
    target: {
      readonly origin: 'personal' | 'world';
      readonly worldProfileId?: string | null;
    },
  ): InventoryResult<InventoryDefinitionRecord> {
    const actorIds = normalizeActorIds(actorIdOrIds);
    if (actorIds.length === 0) return { ok: false, error: 'missing-actor' };
    const sourceId =
      typeof sourceDefinitionId === 'string' ? sourceDefinitionId.trim() : '';
    if (!sourceId) return { ok: false, error: 'not-found' };
    const source = this.#loadDefinition(sourceId);
    if (!source || !this.#canReadDefinition(actorIds, source)) {
      return { ok: false, error: 'not-found' };
    }
    if (target.origin !== 'personal' && target.origin !== 'world') {
      return { ok: false, error: 'origin-not-allowed' };
    }
    const ownerActorId = actorIds[0]!;
    const forkedPayload = buildForkedHostPayload(source, target.origin);
    return this.createDefinition(ownerActorId, {
      name: typeof forkedPayload.name === 'string' ? forkedPayload.name : source.name,
      origin: target.origin,
      worldProfileId: target.worldProfileId ?? null,
      payload: forkedPayload,
    });
  }

  /**
   * CUT-06 — single definition by id including archived (owner/world-readable).
   * Required so restore/workbench can reload after archive.
   */
  getDefinition(
    actorIdOrIds: string | readonly string[],
    definitionId: string,
  ): InventoryResult<InventoryDefinitionRecord | null> {
    const actorIds = normalizeActorIds(actorIdOrIds);
    if (actorIds.length === 0) return { ok: false, error: 'missing-actor' };
    const id = typeof definitionId === 'string' ? definitionId.trim() : '';
    if (!id) return { ok: true, value: null };
    const existing = this.#loadDefinition(id);
    if (!existing) return { ok: true, value: null };
    if (!this.#canReadDefinition(actorIds, existing) && !this.#canMutateDefinition(actorIds, existing)) {
      return { ok: false, error: 'not-authorized' };
    }
    return { ok: true, value: existing };
  }

  #loadDefinition(definitionId: string): InventoryDefinitionRecord | null {
    const row = this.#db
      .prepare(`SELECT * FROM inventory_item_definitions WHERE id = ? LIMIT 1`)
      .get(definitionId) as DefinitionRow | undefined;
    if (!row) return null;
    return mapDefinition(row);
  }

  #canMutateDefinition(
    actorIds: readonly string[],
    def: InventoryDefinitionRecord,
  ): boolean {
    if (def.origin === 'standard') return false;
    if (def.origin === 'personal') {
      return (
        typeof def.ownerUserId === 'string' && actorIds.includes(def.ownerUserId)
      );
    }
    if (def.origin === 'world' && def.worldProfileId) {
      return this.#world.canEditWorldProfile(actorIds, def.worldProfileId);
    }
    return false;
  }

  #canReadDefinition(
    actorIds: readonly string[],
    def: InventoryDefinitionRecord,
  ): boolean {
    if (def.origin === 'standard') return true;
    if (def.origin === 'personal') {
      return (
        typeof def.ownerUserId === 'string' && actorIds.includes(def.ownerUserId)
      );
    }
    if (def.origin === 'world' && def.worldProfileId) {
      return this.#world.canReadWorldProfile(actorIds, def.worldProfileId);
    }
    return false;
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
   * Returns null when the lookup fails so callers DENY.
   * Uses json_each(?) so the bind count stays O(1) under the write lock.
   */
  #visibleDefinitionIds(actorId: string, ids: readonly string[]): Set<string> | null {
    const visible = new Set<string>();
    if (ids.length === 0) return visible;
    try {
      const rows = this.#db
        .prepare(
          `SELECT d.id AS id, d.origin AS origin, d.owner_user_id AS owner_user_id,
                  d.world_profile_id AS world_profile_id, d.status AS status
           FROM inventory_item_definitions d
           JOIN json_each(?) AS wanted ON wanted.value = d.id
           WHERE d.status = 'active'`,
        )
        .all(JSON.stringify(ids)) as Array<{
        id: unknown;
        origin: unknown;
        owner_user_id: unknown;
        world_profile_id: unknown;
        status: unknown;
      }>;
      for (const row of rows) {
        if (typeof row.id !== 'string' || typeof row.origin !== 'string') continue;
        if (row.status !== 'active') continue;
        if (row.origin === 'standard') {
          visible.add(row.id);
          continue;
        }
        if (
          row.origin === 'personal' &&
          typeof row.owner_user_id === 'string' &&
          row.owner_user_id === actorId
        ) {
          visible.add(row.id);
          continue;
        }
        if (
          row.origin === 'world' &&
          typeof row.world_profile_id === 'string' &&
          this.#world.canReadWorldProfile([actorId], row.world_profile_id)
        ) {
          visible.add(row.id);
        }
      }
    } catch {
      return null;
    }
    return visible;
  }
}

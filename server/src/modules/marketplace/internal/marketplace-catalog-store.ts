/**
 * Durable marketplace_items catalog store (MIG-305 / #804).
 * Location: server/src/modules/marketplace/internal/marketplace-catalog-store.ts
 *
 * Host successor for FE marketplace-service table ops. Search uses parameterized
 * LIKE with escaped %/_ (no PostgREST string interpolation). Create author_id is
 * actor-only; update/delete enforce author ownership on the host.
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';

export const MARKETPLACE_INFRA_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export type MarketplaceItemType = 'world' | 'adventure' | 'character' | 'item' | 'ruleset';

export type MarketplaceItemRecord = {
  readonly id: string;
  readonly type: MarketplaceItemType;
  readonly title: string;
  readonly description: string | null;
  readonly authorId: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly rating: number;
  readonly downloads: number;
  readonly price: number;
  readonly imageUrl: string | null;
  readonly tags: readonly string[];
  readonly isFeatured: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type MarketplaceListFilters = {
  readonly type?: MarketplaceItemType | 'all';
  readonly searchQuery?: string;
  readonly minRating?: number;
  readonly maxPrice?: number;
  readonly sortBy?: 'downloads' | 'rating' | 'created_at' | 'price';
  readonly sortOrder?: 'asc' | 'desc';
};

export type MarketplaceCreateDraft = {
  readonly type: MarketplaceItemType;
  readonly title: string;
  readonly description?: string | null;
  readonly data: Readonly<Record<string, unknown>>;
  readonly price?: number;
  readonly imageUrl?: string | null;
  readonly tags?: readonly string[];
};

export type MarketplaceUpdatePatch = {
  readonly title?: string;
  readonly description?: string | null;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly price?: number;
  readonly imageUrl?: string | null;
  readonly tags?: readonly string[];
};

export type MarketplaceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

type Row = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  author_id: string;
  data_json: string;
  rating: number;
  downloads: number;
  price: number;
  image_url: string | null;
  tags_json: string;
  is_featured: number;
  created_at: string;
  updated_at: string;
};

const ITEM_TYPES = new Set<MarketplaceItemType>([
  'world',
  'adventure',
  'character',
  'item',
  'ruleset',
]);

const SORT_COLUMNS: Record<NonNullable<MarketplaceListFilters['sortBy']>, string> = {
  downloads: 'downloads',
  rating: 'rating',
  created_at: 'created_at',
  price: 'price',
};

const PRIVILEGED_DRAFT_KEYS = new Set([
  'author_id',
  'authorId',
  'rating',
  'downloads',
  'id',
  'created_at',
  'createdAt',
  'updated_at',
  'updatedAt',
  'is_featured',
  'isFeatured',
]);

function nowIso(): string {
  return new Date().toISOString();
}

function isItemType(value: unknown): value is MarketplaceItemType {
  return typeof value === 'string' && ITEM_TYPES.has(value as MarketplaceItemType);
}

function hasPrivilegedKeys(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (PRIVILEGED_DRAFT_KEYS.has(key)) return true;
  }
  return false;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

function parseJsonStringArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((e) => typeof e === 'string')) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return [];
}

function mapRow(row: Row): MarketplaceItemRecord {
  const type = isItemType(row.type) ? row.type : 'item';
  return {
    id: row.id,
    type,
    title: row.title,
    description: row.description,
    authorId: row.author_id,
    data: parseJsonObject(row.data_json),
    rating: Number(row.rating),
    downloads: Number(row.downloads),
    price: Number(row.price),
    imageUrl: row.image_url,
    tags: parseJsonStringArray(row.tags_json),
    isFeatured: Number(row.is_featured) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Escape LIKE wildcards so client `%`/`_` are literals. */
export function escapeMarketplaceSearchLiteral(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export const escapeMarketplaceLikePattern = escapeMarketplaceSearchLiteral;

export class MarketplaceCatalogStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  list(filters?: MarketplaceListFilters): MarketplaceItemRecord[] {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters?.type && filters.type !== 'all') {
      where.push('type = ?');
      params.push(filters.type);
    }
    if (typeof filters?.minRating === 'number' && Number.isFinite(filters.minRating)) {
      where.push('rating >= ?');
      params.push(filters.minRating);
    }
    if (typeof filters?.maxPrice === 'number' && Number.isFinite(filters.maxPrice)) {
      where.push('price <= ?');
      params.push(filters.maxPrice);
    }
    if (typeof filters?.searchQuery === 'string' && filters.searchQuery.trim()) {
      const pattern = `%${escapeMarketplaceLikePattern(filters.searchQuery.trim())}%`;
      where.push(
        `(title LIKE ? ESCAPE '\\' OR IFNULL(description, '') LIKE ? ESCAPE '\\')`,
      );
      params.push(pattern, pattern);
    }

    const sortBy = filters?.sortBy && SORT_COLUMNS[filters.sortBy] ? filters.sortBy : 'downloads';
    const sortCol = SORT_COLUMNS[sortBy];
    const ascending = filters?.sortOrder === 'asc';
    const order = ascending ? 'ASC' : 'DESC';
    const sql = `SELECT * FROM marketplace_items${
      where.length ? ` WHERE ${where.join(' AND ')}` : ''
    } ORDER BY ${sortCol} ${order}`;

    const rows = this.#db.prepare(sql).all(...params) as Row[];
    return rows.map(mapRow);
  }

  getById(id: string): MarketplaceItemRecord | null {
    const row = this.#db
      .prepare(`SELECT * FROM marketplace_items WHERE id = ?`)
      .get(id) as Row | undefined;
    return row ? mapRow(row) : null;
  }

  listFeatured(): MarketplaceItemRecord[] {
    const rated = this.#db
      .prepare(
        `SELECT * FROM marketplace_items
         WHERE rating >= 3.5
         ORDER BY downloads DESC
         LIMIT 6`,
      )
      .all() as Row[];
    if (rated.length > 0) return rated.map(mapRow);
    const fallback = this.#db
      .prepare(
        `SELECT * FROM marketplace_items
         ORDER BY downloads DESC
         LIMIT 6`,
      )
      .all() as Row[];
    return fallback.map(mapRow);
  }

  listByAuthor(authorId: string): MarketplaceItemRecord[] {
    const rows = this.#db
      .prepare(
        `SELECT * FROM marketplace_items
         WHERE author_id = ?
         ORDER BY created_at DESC`,
      )
      .all(authorId) as Row[];
    return rows.map(mapRow);
  }

  create(actorId: string, draft: MarketplaceCreateDraft): MarketplaceResult<MarketplaceItemRecord> {
    if (!actorId.trim()) return { ok: false, error: 'missing-actor' };
    if (hasPrivilegedKeys(draft)) return { ok: false, error: 'invalid-draft' };
    if (!isItemType(draft.type)) return { ok: false, error: 'invalid-type' };
    const title = typeof draft.title === 'string' ? draft.title.trim() : '';
    if (!title) return { ok: false, error: 'invalid-title' };
    if (!draft.data || typeof draft.data !== 'object' || Array.isArray(draft.data)) {
      return { ok: false, error: 'invalid-data' };
    }
    const price =
      typeof draft.price === 'number' && Number.isFinite(draft.price) && draft.price >= 0
        ? draft.price
        : 0;
    const tags = Array.isArray(draft.tags)
      ? draft.tags.filter((t): t is string => typeof t === 'string')
      : [];
    const now = nowIso();
    const id = randomUUID();
    try {
      this.#db
        .prepare(
          `INSERT INTO marketplace_items (
             id, type, title, description, author_id, data_json, rating, downloads,
             price, image_url, tags_json, is_featured, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 0, ?, ?)`,
        )
        .run(
          id,
          draft.type,
          title,
          draft.description ?? null,
          actorId,
          JSON.stringify(draft.data),
          price,
          draft.imageUrl ?? null,
          JSON.stringify(tags),
          now,
          now,
        );
    } catch {
      return { ok: false, error: 'persist-failed' };
    }
    const created = this.getById(id);
    if (!created) return { ok: false, error: 'persist-failed' };
    return { ok: true, value: created };
  }

  update(
    actorId: string,
    id: string,
    patch: MarketplaceUpdatePatch,
  ): MarketplaceResult<MarketplaceItemRecord> {
    if (!actorId.trim()) return { ok: false, error: 'missing-actor' };
    if (hasPrivilegedKeys(patch)) return { ok: false, error: 'invalid-draft' };
    const trimmed = typeof id === 'string' ? id.trim() : '';
    if (!trimmed) return { ok: false, error: 'missing-id' };
    const existing = this.getById(trimmed);
    if (!existing) return { ok: false, error: 'not-found' };
    if (existing.authorId !== actorId) return { ok: false, error: 'not-authorized' };

    const nextTitle = typeof patch.title === 'string' ? patch.title.trim() : existing.title;
    if (!nextTitle) return { ok: false, error: 'invalid-title' };
    const nextDescription =
      patch.description !== undefined ? patch.description : existing.description;
    const nextData = patch.data !== undefined ? patch.data : existing.data;
    if (!nextData || typeof nextData !== 'object' || Array.isArray(nextData)) {
      return { ok: false, error: 'invalid-data' };
    }
    const nextPrice =
      typeof patch.price === 'number' && Number.isFinite(patch.price) && patch.price >= 0
        ? patch.price
        : existing.price;
    const nextImage = patch.imageUrl !== undefined ? patch.imageUrl : existing.imageUrl;
    const nextTags =
      patch.tags !== undefined
        ? patch.tags.filter((t): t is string => typeof t === 'string')
        : [...existing.tags];
    const now = nowIso();
    const result = this.#db
      .prepare(
        `UPDATE marketplace_items
         SET title = ?, description = ?, data_json = ?, price = ?, image_url = ?,
             tags_json = ?, updated_at = ?
         WHERE id = ? AND author_id = ?`,
      )
      .run(
        nextTitle,
        nextDescription,
        JSON.stringify(nextData),
        nextPrice,
        nextImage,
        JSON.stringify(nextTags),
        now,
        trimmed,
        actorId,
      );
    if (Number(result.changes ?? 0) === 0) return { ok: false, error: 'not-authorized' };
    const updated = this.getById(trimmed);
    if (!updated) return { ok: false, error: 'not-found' };
    return { ok: true, value: updated };
  }

  delete(actorId: string, id: string): MarketplaceResult<boolean> {
    if (!actorId.trim()) return { ok: false, error: 'missing-actor' };
    const trimmed = typeof id === 'string' ? id.trim() : '';
    if (!trimmed) return { ok: false, error: 'missing-id' };
    const existing = this.getById(trimmed);
    if (!existing) return { ok: true, value: false };
    if (existing.authorId !== actorId) return { ok: false, error: 'not-authorized' };
    const result = this.#db
      .prepare(`DELETE FROM marketplace_items WHERE id = ? AND author_id = ?`)
      .run(trimmed, actorId);
    if (Number(result.changes ?? 0) === 0) return { ok: true, value: false };
    return { ok: true, value: true };
  }
}
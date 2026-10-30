/**
 * Durable marketplace download counter (#878 / RPC-MARKETPLACE-COUNT).
 * Location: server/src/modules/marketplace/internal/marketplace-count-store.ts
 *
 * Host successor for optional increment_marketplace_downloads SQL. Authenticated
 * actors may increment without author binding (legacy ACL). Unknown id = no-op.
 * Quarantine Map templates remain separate (MARKETPLACE_MAP_IS_DURABLE=false).
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type CountError = { readonly ok: false; readonly error: string };
export type CountOk = {
  readonly ok: true;
  readonly itemId: string;
  readonly downloads: number | null;
  readonly mutated: boolean;
};

function nowIso(): string {
  return new Date().toISOString();
}

export class MarketplaceCountStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  /**
   * Seed helper for isolated-contract tests — not a public marketplace publish API.
   */
  insertItemForTests(input: {
    readonly id: string;
    readonly authorId: string;
    readonly title?: string;
    readonly type?: string;
    readonly downloads?: number;
  }): void {
    const now = nowIso();
    this.#db
      .prepare(
        `INSERT INTO marketplace_items (
           id, type, title, description, author_id, data_json, rating, downloads,
           price, image_url, tags_json, is_featured, created_at, updated_at
         ) VALUES (?, ?, ?, NULL, ?, '{}', 0, ?, 0, NULL, '[]', 0, ?, ?)`,
      )
      .run(
        input.id,
        input.type ?? 'item',
        input.title ?? 'Test item',
        input.authorId,
        input.downloads ?? 0,
        now,
        now,
      );
  }

  readDownloadsForTests(itemId: string): number | null {
    const row = this.#db
      .prepare(`SELECT downloads AS downloads FROM marketplace_items WHERE id = ?`)
      .get(itemId) as { downloads: number } | undefined;
    return row ? Number(row.downloads) : null;
  }

  /**
   * Atomic +1 when row exists. Missing id is a no-op (legacy void RPC).
   * Caller must supply a non-empty verified actor id (authenticated).
   */
  incrementDownloads(actorId: string, itemIdRaw: string): CountOk | CountError {
    if (!actorId || typeof actorId !== 'string') {
      return { ok: false, error: '42501' };
    }
    const itemId = (itemIdRaw ?? '').trim();
    if (!itemId) {
      return { ok: false, error: '22023' };
    }

    try {
      const result = this.#db
        .prepare(
          `UPDATE marketplace_items
           SET downloads = downloads + 1, updated_at = ?
           WHERE id = ?`,
        )
        .run(nowIso(), itemId);
      const changes = Number(result.changes ?? 0);
      if (changes === 0) {
        return { ok: true, itemId, downloads: null, mutated: false };
      }
      const downloads = this.readDownloadsForTests(itemId);
      return { ok: true, itemId, downloads, mutated: true };
    } catch {
      return { ok: false, error: 'P0001' };
    }
  }
}

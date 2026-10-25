/**
 * SQLite persistence for user_ai_provider_credentials + rate limits (#818).
 * Location: server/src/modules/ai/internal/credential-store.ts
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type CredentialRow = {
  readonly providerId: string;
  readonly keyHint: string;
  readonly status: string;
  readonly addedAt: string;
  readonly lastValidatedAt: string | null;
  readonly meta: Record<string, unknown>;
  readonly secretCiphertext?: string;
};

export class CredentialStore {
  readonly #db: HostDatabase;
  /** Test hook: force list to throw / return error path. */
  listShouldFail = false;
  /** Test hook: force upsert/refresh write failure. */
  writeShouldFail = false;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  listPublic(userId: string): CredentialRow[] | { error: 'db' } {
    if (this.listShouldFail) return { error: 'db' };
    try {
      const rows = this.#db
        .prepare(
          `SELECT provider_id, key_hint, status, added_at, last_validated_at, meta
           FROM user_ai_provider_credentials WHERE user_id = ?`,
        )
        .all(userId) as Array<{
        provider_id: string;
        key_hint: string;
        status: string;
        added_at: string;
        last_validated_at: string | null;
        meta: string;
      }>;
      return rows.map((r) => this.#mapPublic(r));
    } catch {
      return { error: 'db' };
    }
  }

  loadWithSecret(userId: string, providerId: string): CredentialRow | null {
    const row = this.#db
      .prepare(
        `SELECT provider_id, key_hint, status, added_at, last_validated_at, meta, secret_ciphertext
         FROM user_ai_provider_credentials WHERE user_id = ? AND provider_id = ? LIMIT 1`,
      )
      .get(userId, providerId) as
      | {
          provider_id: string;
          key_hint: string;
          status: string;
          added_at: string;
          last_validated_at: string | null;
          meta: string;
          secret_ciphertext: string;
        }
      | undefined;
    if (!row) return null;
    return { ...this.#mapPublic(row), secretCiphertext: row.secret_ciphertext };
  }

  upsert(input: {
    readonly userId: string;
    readonly providerId: string;
    readonly secretCiphertext: string;
    readonly keyHint: string;
    readonly status: string;
    readonly meta: Record<string, unknown>;
    readonly preserveAddedAt?: string;
  }): { ok: true; addedAt: string } | { ok: false; error: 'write' } {
    if (this.writeShouldFail) return { ok: false, error: 'write' };
    const now = new Date().toISOString();
    const existing = this.loadWithSecret(input.userId, input.providerId);
    const addedAt = existing?.addedAt ?? input.preserveAddedAt ?? now;
    const metaJson = JSON.stringify(input.meta);
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      if (existing) {
        this.#db
          .prepare(
            `UPDATE user_ai_provider_credentials
             SET secret_ciphertext = ?, key_hint = ?, status = ?, last_validated_at = ?,
                 meta = ?, updated_at = ?
             WHERE user_id = ? AND provider_id = ?`,
          )
          .run(
            input.secretCiphertext,
            input.keyHint,
            input.status,
            now,
            metaJson,
            now,
            input.userId,
            input.providerId,
          );
      } else {
        this.#db
          .prepare(
            `INSERT INTO user_ai_provider_credentials
             (id, user_id, provider_id, secret_ciphertext, key_hint, status, added_at,
              last_validated_at, meta, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            randomUUID(),
            input.userId,
            input.providerId,
            input.secretCiphertext,
            input.keyHint,
            input.status,
            addedAt,
            now,
            metaJson,
            now,
          );
      }
      this.#db.exec('COMMIT');
      return { ok: true, addedAt };
    } catch {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return { ok: false, error: 'write' };
    }
  }

  patchMeta(input: {
    readonly userId: string;
    readonly providerId: string;
    readonly status: string;
    readonly meta: Record<string, unknown>;
  }): { ok: true } | { ok: false; error: 'write' } {
    if (this.writeShouldFail) return { ok: false, error: 'write' };
    const now = new Date().toISOString();
    try {
      this.#db
        .prepare(
          `UPDATE user_ai_provider_credentials
           SET status = ?, last_validated_at = ?, meta = ?, updated_at = ?
           WHERE user_id = ? AND provider_id = ?`,
        )
        .run(input.status, now, JSON.stringify(input.meta), now, input.userId, input.providerId);
      return { ok: true };
    } catch {
      return { ok: false, error: 'write' };
    }
  }

  delete(userId: string, providerId: string): void {
    this.#db
      .prepare(`DELETE FROM user_ai_provider_credentials WHERE user_id = ? AND provider_id = ?`)
      .run(userId, providerId);
  }

  /** Returns true when under limit (allowed). */
  consumeRateLimit(userId: string, limit: number, windowSeconds: number): boolean {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.#db
        .prepare(
          `SELECT window_started_at, request_count FROM ai_provider_credential_rate_limits WHERE user_id = ?`,
        )
        .get(userId) as { window_started_at: string; request_count: number } | undefined;
      let count = 1;
      let windowStart = nowIso;
      if (row) {
        const started = Date.parse(row.window_started_at);
        if (Number.isFinite(started) && now - started < windowSeconds * 1000) {
          windowStart = row.window_started_at;
          count = row.request_count + 1;
        }
        this.#db
          .prepare(
            `UPDATE ai_provider_credential_rate_limits
             SET window_started_at = ?, request_count = ?, updated_at = ? WHERE user_id = ?`,
          )
          .run(windowStart, count, nowIso, userId);
      } else {
        this.#db
          .prepare(
            `INSERT INTO ai_provider_credential_rate_limits
             (user_id, window_started_at, request_count, updated_at) VALUES (?, ?, 1, ?)`,
          )
          .run(userId, nowIso, nowIso);
      }
      this.#db.exec('COMMIT');
      return count <= limit;
    } catch {
      try {
        this.#db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      return false;
    }
  }

  #mapPublic(row: {
    provider_id: string;
    key_hint: string;
    status: string;
    added_at: string;
    last_validated_at: string | null;
    meta: string;
  }): CredentialRow {
    let meta: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(row.meta) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        meta = parsed as Record<string, unknown>;
      }
    } catch {
      meta = {};
    }
    return {
      providerId: row.provider_id,
      keyHint: row.key_hint,
      status: row.status,
      addedAt: row.added_at,
      lastValidatedAt: row.last_validated_at,
      meta,
    };
  }
}

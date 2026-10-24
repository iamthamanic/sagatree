/**
 * SQLite saga definition + version store (RPC-SAGA-AUTHORING / #871).
 * Private — import only from saga public API.
 * Location: server/src/modules/saga/internal/saga-definition-store.ts
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type SagaOrigin = 'native' | 'user' | 'private_backfill';
export type SagaVersionStatus = 'draft' | 'published';

export type SagaDefinitionRow = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly synopsis: string;
  readonly origin: SagaOrigin;
  readonly owner_user_id: string | null;
  readonly draft_revision: number;
  readonly created_at: string;
  readonly updated_at: string;
};

export type SagaVersionRow = {
  readonly id: string;
  readonly saga_id: string;
  readonly version_label: string;
  readonly status: SagaVersionStatus;
  readonly payload: string;
  readonly published_at: string | null;
  readonly created_at: string;
};

export type SagaPayload = {
  readonly packageId: null;
  readonly title: string;
  readonly blurb: string;
  readonly synopsis: string;
  readonly knowledgeFacts: readonly unknown[];
  readonly locations: readonly unknown[];
  readonly pregens: readonly unknown[];
  readonly [key: string]: unknown;
};

function newId(): string {
  return randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

function emptyPayload(title: string, blurb: string): SagaPayload {
  return {
    packageId: null,
    title,
    blurb,
    synopsis: blurb,
    knowledgeFacts: [],
    locations: [],
    pregens: [],
  };
}

export class SagaDefinitionStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  getDefinition(sagaId: string): SagaDefinitionRow | null {
    const row = this.#db
      .prepare(
        `SELECT id, slug, title, synopsis, origin, owner_user_id, draft_revision, created_at, updated_at
         FROM saga_definitions WHERE id = ?`,
      )
      .get(sagaId) as SagaDefinitionRow | undefined;
    return row ?? null;
  }

  getVersion(versionId: string): SagaVersionRow | null {
    const row = this.#db
      .prepare(
        `SELECT id, saga_id, version_label, status, payload, published_at, created_at
         FROM saga_definition_versions WHERE id = ?`,
      )
      .get(versionId) as SagaVersionRow | undefined;
    return row ?? null;
  }

  latestPublished(sagaId: string): SagaVersionRow | null {
    const row = this.#db
      .prepare(
        `SELECT id, saga_id, version_label, status, payload, published_at, created_at
         FROM saga_definition_versions
         WHERE saga_id = ? AND status = 'published'
         ORDER BY published_at DESC NULLS LAST, created_at DESC
         LIMIT 1`,
      )
      .get(sagaId) as SagaVersionRow | undefined;
    return row ?? null;
  }

  ensureDraft(sagaId: string): SagaVersionRow {
    const existing = this.#db
      .prepare(
        `SELECT id, saga_id, version_label, status, payload, published_at, created_at
         FROM saga_definition_versions
         WHERE saga_id = ? AND status = 'draft' AND version_label = 'draft'
         LIMIT 1`,
      )
      .get(sagaId) as SagaVersionRow | undefined;
    if (existing) return existing;

    const def = this.getDefinition(sagaId);
    if (!def) throw new Error('saga-not-found');
    const published = this.latestPublished(sagaId);
    const payload = published?.payload ?? JSON.stringify(emptyPayload(def.title, def.synopsis));
    const id = newId();
    const createdAt = nowIso();
    this.#db
      .prepare(
        `INSERT INTO saga_definition_versions
         (id, saga_id, version_label, status, payload, published_at, created_at)
         VALUES (?, ?, 'draft', 'draft', ?, NULL, ?)`,
      )
      .run(id, sagaId, payload, createdAt);
    const created = this.getVersion(id);
    if (!created) throw new Error('draft-create-failed');
    return created;
  }

  seedNative(input: {
    readonly id?: string;
    readonly title: string;
    readonly synopsis?: string;
    readonly payload?: Record<string, unknown>;
  }): { readonly sagaId: string; readonly versionId: string } {
    const sagaId = input.id ?? newId();
    const versionId = newId();
    const createdAt = nowIso();
    const synopsis = input.synopsis ?? '';
    const payload = JSON.stringify(
      input.payload ?? emptyPayload(input.title, synopsis),
    );
    this.#db
      .prepare(
        `INSERT INTO saga_definitions
         (id, slug, title, synopsis, origin, owner_user_id, draft_revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'native', NULL, 0, ?, ?)`,
      )
      .run(sagaId, `native.${sagaId.replace(/-/g, '')}`, input.title, synopsis, createdAt, createdAt);
    this.#db
      .prepare(
        `INSERT INTO saga_definition_versions
         (id, saga_id, version_label, status, payload, published_at, created_at)
         VALUES (?, ?, 'v1', 'published', ?, ?, ?)`,
      )
      .run(versionId, sagaId, payload, createdAt, createdAt);
    return { sagaId, versionId };
  }

  createUserSaga(
    ownerUserId: string,
    titleRaw: string,
    blurbRaw: string,
  ):
    | { ok: true; value: { sagaId: string; versionId: string; revision: number } }
    | { ok: false; error: string } {
    const title = titleRaw.trim();
    if (!title) return { ok: false, error: '22023' };
    const blurb = blurbRaw ?? '';
    const sagaId = newId();
    const draftId = newId();
    const createdAt = nowIso();
    const payload = JSON.stringify(emptyPayload(title, blurb));
    try {
      this.#db
        .prepare(
          `INSERT INTO saga_definitions
           (id, slug, title, synopsis, origin, owner_user_id, draft_revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'user', ?, 0, ?, ?)`,
        )
        .run(sagaId, `user.${sagaId.replace(/-/g, '')}`, title, blurb, ownerUserId, createdAt, createdAt);
      this.#db
        .prepare(
          `INSERT INTO saga_definition_versions
           (id, saga_id, version_label, status, payload, published_at, created_at)
           VALUES (?, ?, 'draft', 'draft', ?, NULL, ?)`,
        )
        .run(draftId, sagaId, payload, createdAt);
    } catch {
      return { ok: false, error: 'create-failed' };
    }
    return { ok: true, value: { sagaId, versionId: draftId, revision: 0 } };
  }

  copyNative(
    ownerUserId: string,
    sourceSagaId: string,
  ):
    | { ok: true; value: { sagaId: string; versionId: string } }
    | { ok: false; error: string } {
    const src = this.getDefinition(sourceSagaId);
    if (!src || src.origin !== 'native') return { ok: false, error: '22023' };
    const published = this.latestPublished(sourceSagaId);
    if (!published) return { ok: false, error: 'P0002' };

    const sagaId = newId();
    const publishedId = newId();
    const draftId = newId();
    const createdAt = nowIso();
    try {
      this.#db
        .prepare(
          `INSERT INTO saga_definitions
           (id, slug, title, synopsis, origin, owner_user_id, draft_revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'user', ?, 0, ?, ?)`,
        )
        .run(
          sagaId,
          `user.${sagaId.replace(/-/g, '')}`,
          `${src.title} (Kopie)`,
          src.synopsis,
          ownerUserId,
          createdAt,
          createdAt,
        );
      this.#db
        .prepare(
          `INSERT INTO saga_definition_versions
           (id, saga_id, version_label, status, payload, published_at, created_at)
           VALUES (?, ?, 'v1', 'published', ?, ?, ?)`,
        )
        .run(publishedId, sagaId, published.payload, createdAt, createdAt);
      this.#db
        .prepare(
          `INSERT INTO saga_definition_versions
           (id, saga_id, version_label, status, payload, published_at, created_at)
           VALUES (?, ?, 'draft', 'draft', ?, NULL, ?)`,
        )
        .run(draftId, sagaId, published.payload, createdAt);
    } catch {
      return { ok: false, error: 'copy-failed' };
    }
    return { ok: true, value: { sagaId, versionId: publishedId } };
  }

  getEditor(
    actorId: string,
    sagaId: string,
  ):
    | {
        ok: true;
        value: {
          sagaId: string;
          sagaSlug: string;
          title: string;
          synopsis: string;
          origin: SagaOrigin;
          versionId: string;
          versionLabel: string;
          status: SagaVersionStatus;
          payload: Record<string, unknown>;
          revision: number;
          canEdit: boolean;
          isGmProjection: true;
        };
      }
    | { ok: false; error: string } {
    const def = this.getDefinition(sagaId);
    if (!def) return { ok: false, error: 'P0002' };

    let ver: SagaVersionRow;
    let canEdit = false;
    if (def.origin === 'native') {
      const published = this.latestPublished(sagaId);
      if (!published) return { ok: false, error: 'P0002' };
      ver = published;
      canEdit = false;
    } else if (def.owner_user_id === actorId) {
      ver = this.ensureDraft(sagaId);
      canEdit = true;
    } else {
      return { ok: false, error: '42501' };
    }

    return {
      ok: true,
      value: {
        sagaId: def.id,
        sagaSlug: def.slug,
        title: def.title,
        synopsis: def.synopsis,
        origin: def.origin,
        versionId: ver.id,
        versionLabel: ver.version_label,
        status: ver.status,
        payload: parsePayload(ver.payload),
        revision: def.draft_revision,
        canEdit,
        isGmProjection: true,
      },
    };
  }

  saveDraft(
    actorId: string,
    sagaId: string,
    payload: Record<string, unknown>,
    expectedRevision: number,
  ):
    | {
        ok: true;
        value: { sagaId: string; versionId: string; revision: number; payload: Record<string, unknown> };
      }
    | { ok: false; error: string } {
    const def = this.getDefinition(sagaId);
    if (!def) return { ok: false, error: 'P0002' };
    if (def.origin === 'native') return { ok: false, error: '42501' };
    if (def.owner_user_id !== actorId) return { ok: false, error: '42501' };
    if (def.draft_revision !== expectedRevision) return { ok: false, error: '40001' };

    const titleRaw = typeof payload.title === 'string' ? payload.title : '';
    const title = titleRaw.trim();
    if (!title) return { ok: false, error: '22023' };
    const blurb =
      (typeof payload.blurb === 'string' ? payload.blurb : null) ??
      (typeof payload.synopsis === 'string' ? payload.synopsis : '') ??
      '';

    const draft = this.ensureDraft(sagaId);
    const updatedAt = nowIso();
    const payloadJson = JSON.stringify(payload);
    this.#db
      .prepare(`UPDATE saga_definition_versions SET payload = ? WHERE id = ?`)
      .run(payloadJson, draft.id);
    this.#db
      .prepare(
        `UPDATE saga_definitions
         SET title = ?, synopsis = ?, draft_revision = draft_revision + 1, updated_at = ?
         WHERE id = ?`,
      )
      .run(title, blurb, updatedAt, sagaId);
    const next = this.getDefinition(sagaId);
    const ver = this.getVersion(draft.id);
    if (!next || !ver) return { ok: false, error: 'save-failed' };
    return {
      ok: true,
      value: {
        sagaId: next.id,
        versionId: ver.id,
        revision: next.draft_revision,
        payload: parsePayload(ver.payload),
      },
    };
  }

  publish(
    actorId: string,
    sagaId: string,
    expectedRevision: number,
  ):
    | {
        ok: true;
        value: { sagaId: string; versionId: string; versionLabel: string; revision: number };
      }
    | { ok: false; error: string } {
    const def = this.getDefinition(sagaId);
    if (!def) return { ok: false, error: 'P0002' };
    if (def.origin === 'native') return { ok: false, error: '42501' };
    if (def.owner_user_id !== actorId) return { ok: false, error: '42501' };
    if (def.draft_revision !== expectedRevision) return { ok: false, error: '40001' };

    const draft = this.ensureDraft(sagaId);
    const payload = parsePayload(draft.payload);
    const titleRaw = typeof payload.title === 'string' ? payload.title : def.title;
    if (!titleRaw.trim()) return { ok: false, error: '22023' };

    const rows = this.#db
      .prepare(
        `SELECT version_label FROM saga_definition_versions WHERE saga_id = ? AND status = 'published'`,
      )
      .all(sagaId) as { version_label: string }[];
    let max = 0;
    for (const row of rows) {
      const m = /^v(\d+)$/.exec(row.version_label);
      if (m) max = Math.max(max, Number(m[1]));
    }
    const label = `v${max + 1}`;
    const versionId = newId();
    const createdAt = nowIso();
    const publishedCountBefore = rows.length;
    try {
      this.#db
        .prepare(
          `INSERT INTO saga_definition_versions
           (id, saga_id, version_label, status, payload, published_at, created_at)
           VALUES (?, ?, ?, 'published', ?, ?, ?)`,
        )
        .run(versionId, sagaId, label, draft.payload, createdAt, createdAt);
    } catch {
      return { ok: false, error: 'publish-failed' };
    }
    const publishedCountAfter = (
      this.#db
        .prepare(
          `SELECT COUNT(*) AS c FROM saga_definition_versions WHERE saga_id = ? AND status = 'published'`,
        )
        .get(sagaId) as { c: number }
    ).c;
    if (publishedCountAfter !== publishedCountBefore + 1) {
      return { ok: false, error: 'publish-failed' };
    }
    return {
      ok: true,
      value: {
        sagaId,
        versionId,
        versionLabel: label,
        revision: def.draft_revision,
      },
    };
  }

  countDrafts(sagaId: string): number {
    const row = this.#db
      .prepare(
        `SELECT COUNT(*) AS c FROM saga_definition_versions WHERE saga_id = ? AND status = 'draft'`,
      )
      .get(sagaId) as { c: number };
    return row.c;
  }

  countPublished(sagaId: string): number {
    const row = this.#db
      .prepare(
        `SELECT COUNT(*) AS c FROM saga_definition_versions WHERE saga_id = ? AND status = 'published'`,
      )
      .get(sagaId) as { c: number };
    return row.c;
  }
}

/**
 * Session outcome promotion ledger + promote audit events (#876).
 * Location: server/src/modules/session/internal/session-outcome-store.ts
 * Private — session public API only.
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type SessionPromoteLookup = {
  readonly appendPromoteAuditEvent: (
    sessionId: string,
    actorId: string,
    payload: Record<string, unknown>,
  ) => void;
  readonly recordOutcomePromotion: (input: {
    readonly projectId: string;
    readonly sessionId: string;
    readonly sourceId: string;
    readonly targetKind: 'saga_fact' | 'world_fact';
    readonly targetRef: string;
    readonly createdBy: string;
  }) => void;
};

export class SessionOutcomeStore implements SessionPromoteLookup {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  appendPromoteAuditEvent(
    sessionId: string,
    actorId: string,
    payload: Record<string, unknown>,
  ): void {
    const rt = this.#db
      .prepare(`SELECT revision FROM session_runtime WHERE session_id = ?`)
      .get(sessionId) as { revision: number } | undefined;
    const revision = Number(rt?.revision ?? 0);
    const seqRow = this.#db
      .prepare(
        `SELECT COALESCE(MAX(event_sequence), 0) AS m FROM session_events WHERE session_id = ?`,
      )
      .get(sessionId) as { m: number };
    const nextSeq = Number(seqRow.m) + 1;
    this.#db
      .prepare(
        `INSERT INTO session_events
           (session_id, event_sequence, revision, actor_user_id, idempotency_key, payload_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        sessionId,
        nextSeq,
        revision,
        actorId,
        `promote:${actorId}:${revision}:${nextSeq}`,
        JSON.stringify({ kind: 'adventure', payload }),
      );
  }

  recordOutcomePromotion(input: {
    readonly projectId: string;
    readonly sessionId: string;
    readonly sourceId: string;
    readonly targetKind: 'saga_fact' | 'world_fact';
    readonly targetRef: string;
    readonly createdBy: string;
  }): void {
    this.#db
      .prepare(
        `INSERT INTO session_outcome_promotions
           (id, project_id, session_id, source_kind, source_id, target_kind, target_ref, created_by, created_at)
         VALUES (?, ?, ?, 'consequence', ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        input.projectId,
        input.sessionId,
        input.sourceId,
        input.targetKind,
        input.targetRef,
        input.createdBy,
        new Date().toISOString(),
      );
  }
}

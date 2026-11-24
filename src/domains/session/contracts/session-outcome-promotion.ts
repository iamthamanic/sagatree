/**
 * session-outcome-promotion — Plan promote of recap consequences (#582).
 * Location: src/domains/session/contracts/session-outcome-promotion.ts
 *
 * Pure domain: eligibility + confirm copy. No React / backend clients.
 */

export type PromoteTarget = 'saga' | 'world';

export type PromotePlan =
  | {
      readonly ok: true;
      readonly target: PromoteTarget;
      readonly consequenceId: string;
      readonly summary: string;
      readonly confirmDe: string;
    }
  | { readonly ok: false; readonly reasonDe: string };

export function planPromoteConsequence(input: {
  readonly target: PromoteTarget;
  readonly consequenceId: string | null | undefined;
  readonly summary: string | null | undefined;
  readonly kind: string | null | undefined;
}): PromotePlan {
  const id = typeof input.consequenceId === 'string' ? input.consequenceId.trim() : '';
  const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
  const kind = typeof input.kind === 'string' ? input.kind.trim() : '';
  if (!id || id === 'pending') {
    return { ok: false, reasonDe: 'Kein Ereignis ausgewählt' };
  }
  if (kind === 'empty') {
    return { ok: false, reasonDe: 'Leere Platzhalter können nicht übernommen werden' };
  }
  if (!summary) {
    return { ok: false, reasonDe: 'Ereignis ohne Text' };
  }
  if (input.target === 'saga') {
    return {
      ok: true,
      target: 'saga',
      consequenceId: id.slice(0, 80),
      summary: summary.slice(0, 200),
      confirmDe: `„${summary.slice(0, 80)}“ als Wissensfakt in den Saga-Entwurf übernehmen?`,
    };
  }
  return {
    ok: true,
    target: 'world',
    consequenceId: id.slice(0, 80),
    summary: summary.slice(0, 200),
    confirmDe: `„${summary.slice(0, 80)}“ dauerhaft in die Welt-Lore übernehmen?`,
  };
}

export type PromoteRpcResult = {
  readonly ok: boolean;
  readonly idempotent?: boolean;
  readonly targetKind?: string;
  readonly targetRef?: string;
  readonly messageDe?: string;
};

export function parsePromoteRpcResult(raw: unknown): PromoteRpcResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, messageDe: 'Ungültige Server-Antwort' };
  }
  const row = raw as Record<string, unknown>;
  return {
    ok: row.ok === true,
    idempotent: row.idempotent === true,
    targetKind: typeof row.targetKind === 'string' ? row.targetKind : undefined,
    targetRef: typeof row.targetRef === 'string' ? row.targetRef : undefined,
    messageDe: typeof row.messageDe === 'string' ? row.messageDe : undefined,
  };
}

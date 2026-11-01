# Acceptance — stack-migration-atlas-live-e2e (#770 / ATLAS-LIVE-E2E)

## Intent

Den echten GM→Player-Atlas-Pfad über Browser und isolierte Datenbank als
verpflichtenden Nachweis ausführen (kein hosted Supabase, keine
`E2E_ATLAS_SUPABASE_*` Secrets).

## Acceptance tier

`feature-e2e` — SLICE DONE only. RELEASE APPROVED (production cutover /
Supabase shutdown) bleibt menschlich (MIG-700+). Dual-path intentional.

## Preconditions

- MIG-001/#782 DONE with completionEvidence.
- Ephemeral harness: `scripts/stack-migration-db` + job `atlas-isolated-product`
  in `.github/workflows/stack-migration-baseline.yml`.
- Owner-lock: isolated PG + GoTrue + PostgREST; no production credentials.

## Happy path

- Owner: real product WebGL atlas + DB nav; rename persists across reload.
- Outsider: PostgREST DENY + product alert; no native atlas / secret title.
- Players: secrets hidden until GM reveal; positive browser projection after
  `set_saga_binding_reveal`.

## Edge / security

- Missing fixture / tools / browser / auth → job FAIL (no `test.skip`).
- Synthetic fixtures only; owner-scoped RLS/RPC remain fail-closed.
- Hosted-secret checklist superseded by owner-lock + harness.

## Required Tests

- [x] Berechtigte Weltänderungen sind nach Browser-Reload und DB-Neustart persistent; Spieler sehen genau die für ihr Projekt/ihren Reveal-Stand erlaubten Karten.
- [x] Geheime Marker fehlen in Spielerantworten und ein Cross-owner-Write verändert nachweislich keine DB-Zeile.
- [x] Die reale Produktprobe wird rot und nach Rücknahme grün; fehlende isolierte Testinfrastruktur schlägt fehl und führt nicht zu test.skip. (Rot-Phase: `scripts/atlas-product-fail-closed.test.mjs` + `product-fail-closed.mjs`; Grün: Actions run `41201202311` 3/3)
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `npm run product --prefix scripts/stack-migration-db` (CI `atlas-isolated-product`) → 3/3 PASS, exit 0, no skip/flaky.
- [x] Evidence: Actions run `41201202311` on main (head `cda4939f`); local artifact `report.json` status=passed, browser expected=3.

## Security Coverage

| ID | How |
| --- | --- |
| Authz | Real GoTrue password grant + PostgREST RPC under fixture actors |
| Projection | Player `p_player_view` + reveal gate; secret map denied (P0002→500) |
| Fail-closed | product-run.mjs fails if expected<3 / skipped / flaky / nonzero exit |
| Secrets | No hosted ATLAS-CI / `E2E_ATLAS_SUPABASE_*`; loopback-only harness |

### Launch Checklist (SC)

N/A — not a launch / cutover ticket (RELEASE APPROVED remains human).

## Implementation Notes

- Suite: `scripts/stack-migration-db/atlas-product.spec.ts` via `product-run.mjs`
  (plan path `e2e/atlas-isolated-product.spec.ts` is historical alias wording).
- Workflow job: `atlas-isolated-product` (required, fail-closed).
- Product UI/projection journey already green on main; this ticket records
  SLICE DONE evidence (no fake cutover).

## Composition Gate

Proof: `.qa/runs/composition-gate-stack-migration-atlas-live-e2e.md`

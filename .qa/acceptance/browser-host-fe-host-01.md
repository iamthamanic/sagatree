# Acceptance — browser-host-fe-host-01

## Meta

- Issue: #1093
- localId: FE-HOST-01
- Slug: `browser-host-fe-host-01`
- Tier: feature-integration

## Intent

Produkt-HTTP und FE-Facades für Bibliothek Charaktere/Welten/Looks inkl. Solo-Dornhain-Seed verdrahten.

## Acceptance

- [x] Covered happy-path ops succeed against host SQLite without Supabase.
- [x] Unauthorized / forged identity is DENY.
- [x] Empty/missing resource produces stable empty/not-found UX.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `npm run test-gate` green for touched architecture boundaries.

## Composition Gate

Producer→consumer: Vite Library facades → `host-library-http` → Host `/api/v1/library/*` → module ports → SQLite.

## Evidence

- Curl smoke: characters/worlds/looks list+mutate on :8787 with Origin localhost:3004
- Dornhain seed on host boot (`ensureDornhainDefaultCatalog`)

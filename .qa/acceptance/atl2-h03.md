# Feature: ATL2-H03 — Golden-E2E: Dornhain journey (#1236)

<!-- atlas-v2-epic: #1196; slice: H03; slug: atl2-h03 -->

## Intent

One realistic, repeatable Browser E2E journey through the frozen Dornhain Golden world on the
productive Custom-WebGL atlas (ADR-ST-10), against the real HOST (Better Auth + SQLite) —
not a collection of isolated smoke checks.

## Preconditions

- H01 #1234 (#1304) merged; H02 #1235 (#1305) docs sync
- Owner name freeze 2026-11-15: **Welt → Kontinent Westmark → Nordreich → Dornhain →
  Taverne Zum Flüstern (→ Schankraum) / Krypta unter dem Hügel (→ Gruftkammer)**

## Happy Path

- [x] Golden names frozen consistently in FE domain, host seed and G04 fixtures; seed keys / stable ids unchanged (`country.westmark`, `dh-place-country-westmark`, `dornhain.map.country.westmark`)
- [x] Forward and back on both branches (Taverne, Krypta) via the DB nav; map scale changes per level
- [x] Room scale: Schankraum (tavern map) and Gruftkammer (crypt map) reached by camera zoom (room span ≤ 120)
- [x] 2D edit (stamp) → autosave PUT → revision +1 → page reload → 3D shows the same object count; API object ids identical
- [x] Undo / redo persisted; redo restores the same object id (no new id minted)
- [x] Dungeon "Generieren" preview stays on WebGL
- [x] 2D breadcrumb shows Nordreich; "Zurück zur Elternkarte" goes up one level
- [x] Golden restored through the product "Golden" reset after every writing test

## Negative / Permissions

- [x] Stale `expectedRevision` → 409, map unchanged
- [x] Offline edit is not persisted; server keeps the revision; editor stays usable
- [x] Unauthenticated read / write → 401/403
- [x] player1 (seeded demo player, no membership): write 403/404, read refused, GM tools (Golden, Speichern, 3D editor) never mount

## Edge Cases

- [x] Existing worlds: place name refreshes on bootstrap; map titled exactly `Land Westmark` becomes `Nordreich` (title only — canvas and user-renamed maps untouched)
- [x] Phone (390×844) and tablet (820×1180): Golden chain to tavern and crypt, no horizontal overflow
- [x] Screenshots from the running app: `h03__<world>__map-<mapId>__<camera>__<sha>__<preset>-software-webgl__<viewport>.png` (software rendering — no hardware perf claims)

## Gates

- `node scripts/atl2-h03-golden-e2e.self-test.mjs` (wired in `npm run test-gate`)
- Golden regressions: `atl2-a03/a04/c06/d07/e05/g04/g05` self-tests
- Browser E2E (host): `e2e/atl2-h03-golden-journey.spec.ts`; regression `e2e/atl2-g04-golden-visual.spec.ts`

## Composition Gate

- Verdict: CLEAR — proof `.qa/runs/composition-gate-atl2-h03.md` (title-only legacy rename on host bootstrap; ids unchanged)

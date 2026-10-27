# Acceptance — stack-migration-rpc-world-destructive (#866)

## Result

PASS (isolated-contract)

## Checks

- [x] Die Vorschau zählt Nachfahren und Saga-Bindings exakt und gibt requiresConfirm für die betroffene Struktur zurück.
- [x] Archivierung umfasst Wurzel und Nachfahren und erhöht deren Revision; Wiederholung bleibt definiert.
- [x] Löschung entfernt nur den bestätigten Teilbaum mit zugehörigen Links/Karten und löst Saga-Ortsreferenzen in derselben Transaktion.
- [x] Fehlende Bestätigung oder fehlende Editor-Rechte verändert weder Orte, Bindings noch Karten.
- [x] Verpflichtende Legacy-Regression RPC-DATA-SHARED-MAP-DELETE: gemeinsam genutzte Karten bleiben erhalten; nur exklusive Nicht-world-Karten werden gelöscht (`preservedSharedMapIds`).
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Command

`node --experimental-strip-types scripts/rpc-world-destructive.self-test.mjs` → PASS.

## Composition

See `.qa/runs/composition-gate-stack-migration-rpc-world-destructive.md`.

# Acceptance — stack-migration-rpc-world-restructure (#865)

## Result

PASS (isolated-contract)

## Checks

- [x] Reparent verlangt Bestätigung, verbietet Selbst-/Nachfahrenzyklen und aktualisiert Ort und Primärkarten-Parent atomar.
- [x] Ungültige Hierarchiekante oder fremder Parent liefert 23514 ohne Teilverschiebung.
- [x] Duplizieren erzeugt neue IDs und Karten; shallow kopiert nur die Wurzel, deep die vollständige Unterstruktur.
- [x] Die Transaktion verwendet eine lokale Duplikat-Zuordnung; parallele Kopien teilen weder temporäre Datensätze noch neue IDs.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Command

`node --experimental-strip-types scripts/rpc-world-restructure.self-test.mjs` → PASS.

## Composition

See `.qa/runs/composition-gate-stack-migration-rpc-world-restructure.md`.

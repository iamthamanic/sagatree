# Acceptance — RPC-WORLD-CREATE (#864)

## Intent
Port `create_world_node_with_maps` and `rename_world_node` to the modular host with unchanged secure semantics (owner-only edit, canonical hierarchy, idempotency cache).

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
HTTP → MIG-311; FEATURE VERIFIED → MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] Jeder kanonische Ortstyp erzeugt die erforderliche Vorfahrenkette, Primärkarte und Verknüpfung in einer Transaktion.
- [x] Der weltbezogene Idempotency-Key liefert bei Wiederholung dieselben IDs ohne zusätzliche Orte oder Karten.
- [x] Fremde/inkompatible Parents und leere Namen werden vor Seiteneffekten abgewiesen.
- [x] Umbenennung erhöht die Ortsrevision; Placeholder wechseln zu draft, bestehende andere Status bleiben erhalten.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `node --experimental-strip-types scripts/rpc-world-create.self-test.mjs` → PASS

## Evidence
`node --experimental-strip-types scripts/rpc-world-create.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-rpc-world-create.md`.

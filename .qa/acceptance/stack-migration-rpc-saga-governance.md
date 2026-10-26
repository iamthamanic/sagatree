# Acceptance — RPC-SAGA-GOVERNANCE (#875)

## Intent
Port get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal.

## Acceptance tier
`isolated-contract` — SLICE DONE. FEATURE VERIFIED → HTTP adapters. RELEASE APPROVED → human only.

## Required Tests
- [x] GM, explizite Grants und aktive Mitgliedschaft bestimmen die dokumentierten Permission-Keys und sichtbaren Bindings.
- [x] Bundle-Wechsel ersetzt Grants und Assignment atomar; der letzte Governance-Berechtigte kann nicht ausgesperrt werden.
- [x] Binding-Reveal akzeptiert nur gm_only/party/unlisted und bleibt auf das konkrete Projekt beschränkt.
- [x] Unlisted wird auch für GM nicht in der Standardliste ausgegeben; Mitglieder-/Binding-Decoder und Reihenfolge, canSetBundle-Viewer, Cross-Project-Isolation, Grant/Bundle-Atomizitaet und Rollback belegt.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] scripts/rpc-saga-governance.self-test.mjs → PASS

## Evidence
`scripts/rpc-saga-governance.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-rpc-saga-governance.md`.

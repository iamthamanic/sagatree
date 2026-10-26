# Acceptance — RPC-PROJECT-MEMBERSHIP (#874)

## Intent
Port join_project_by_code + set_my_project_character with secure membership/character binding semantics.

## Acceptance tier
`isolated-contract` — SLICE DONE. FEATURE VERIFIED → MIG-311/#810 + related HTTP adapters. RELEASE APPROVED → human only.

## Required Tests
- [x] Projektbeitritt normalisiert Join-Code und erzeugt genau eine aktive Player-Mitgliedschaft.
- [x] Vorhandene Mitgliedschaft und unbekannter Code folgen den belegten Fehlerfällen ohne doppelte Zeile.
- [x] Nur vollständiger eigener Charakter darf zugeordnet werden; NULL entfernt die Zuordnung.
- [x] Änderung der Figur erfordert die eigene aktive Projektmitgliedschaft und verändert keine fremde Mitgliedschaft.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] scripts/rpc-project-membership.self-test.mjs → PASS

## Evidence
`scripts/rpc-project-membership.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-rpc-project-membership.md`.

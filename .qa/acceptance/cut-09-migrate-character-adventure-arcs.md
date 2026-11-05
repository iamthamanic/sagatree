# Acceptance — CUT-09 (#1144)

- HEAD_SHA: 0a7bd66366764403f3e127e1195240f0e76f42cb
- Issue: #1144
- Slug: cut-09-migrate-character-adventure-arcs

## Summary
Character-owned adventure arcs + developments on host SQLite.
Hono `/api/v1/library/characters/:id/adventure-arcs` and
`/api/v1/library/adventure-arcs/:id/developments` via CharacterPorts;
membership projection via ProjectPorts; session counts via SessionLookup;
FE dual-path; Soft-DENY removed; migration `0032_character_adventure_arcs.sql`.

## Composition Gate

- HEAD_SHA: 0a7bd66366764403f3e127e1195240f0e76f42cb
- Verdict: CLEAR

## Required Tests

- [x] scripts/cut-09-character-arcs.self-test.mjs
- [x] scripts/cutover-parity-inventory-check.mjs

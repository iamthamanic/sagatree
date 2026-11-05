# Acceptance — CUT-09 (#1144)

- HEAD_SHA: 60e6125d7ebc73d3b2cd8decf9e3d18f9390e792
- Issue: #1144
- Slug: cut-09-migrate-character-adventure-arcs

## Summary
Character-owned adventure arcs + developments on host SQLite.
Hono `/api/v1/library/characters/:id/adventure-arcs` and
`/api/v1/library/adventure-arcs/:id/developments` via CharacterPorts;
membership projection via ProjectPorts; session counts via SessionLookup;
FE dual-path; Soft-DENY removed; migration `0032_character_adventure_arcs.sql`.

## Composition Gate

- HEAD_SHA: 60e6125d7ebc73d3b2cd8decf9e3d18f9390e792
- Verdict: CLEAR

## Required Tests

- [x] scripts/cut-09-character-arcs.self-test.mjs
- [x] scripts/cutover-parity-inventory-check.mjs

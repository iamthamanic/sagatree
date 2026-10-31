# Acceptance — RPC-MARKETPLACE-COUNT (#878)

## Intent
Port `increment_marketplace_downloads` as a host use-case with unchanged safe semantics: atomic +1 on known items, no-op on unknown, authenticated callers without author binding, no client write fallback.

## Acceptance tier
`isolated-contract` — SLICE DONE. FEATURE VERIFIED → MIG-602/#847.

## Required Tests
- [x] Authenticated actor increments an existing marketplace item → downloads +1 (mutated=true).
- [x] Unknown item id → ok no-op (mutated=false); empty item id → `22023`.
- [x] Empty actor id → `42501` DENY (host does not expose PUBLIC/anon EXECUTE).
- [x] FE `incrementDownloads` stays RPC-only (no client counter write, #675).
- [x] Host migration `0029_marketplace_items.sql` is the install successor for optional `src/supabase/*marketplace*` RPC scripts.
- [x] Touched files: zero type escape hatches.
- [x] scripts/rpc-marketplace-count.self-test.mjs → PASS

## Evidence
`scripts/rpc-marketplace-count.self-test.mjs` → PASS (wired into `npm run test-gate`).

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-rpc-marketplace-count.md`.

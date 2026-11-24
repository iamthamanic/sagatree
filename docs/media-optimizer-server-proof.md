# Media Optimizer — Server-side proof (#645)

Feature slug: `media-opt-server-proof`

## Goal

Prove whether SagaTree’s Deno Edge runtime can run WASM decode/encode (`@jsquash/*`) under tight CPU/RAM budgets **before** wiring provider-output optimize into productive Storage uploads (slice 12 / #647).

## Method

- Isolated Deno module (former Edge tree, retired with CUT-21): `_shared/media-server-optimize-proof.ts`
- Deno proof suite (same tree): `_shared/media-server-optimize-proof.proof.ts` (synthetic PNG/JPEG/WebP via same WASM codecs; not `*_test.ts` so blanket Edge `deno test` skips WASM permissions)
- Node runner: `scripts/media-optimizer-server-proof-check.mjs` (`deno test --node-modules-dir=auto …`)
- Decision record: `docs/media-optimizer-server-decision.md`

Metrics per sample: decodeMs, encodeMs, totalMs, rssDeltaBytes, quality, psnrDb, explicit status (`optimized` | `unchanged` | `unsupported` | `over-budget` | `failed`).

## Decision

See **Decision** line in `docs/media-optimizer-server-decision.md` (`deno-adapter` | `dedicated-worker` | `not-viable`).

## Non-goals

- No productive upload path switch in this slice
- No AuthZ/RLS/Storage ACL changes

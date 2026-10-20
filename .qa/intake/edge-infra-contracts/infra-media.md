# Infrastructure `media`

## VORHER
- Area root: `src/infrastructure/media/`
  - `src/infrastructure/media/optimizer/engines/audio/index.ts`
  - `src/infrastructure/media/optimizer/engines/image/image.worker.ts`
  - `src/infrastructure/media/optimizer/engines/image/index.ts`
  - `src/infrastructure/media/optimizer/engines/image/optimize-image.ts`
  - `src/infrastructure/media/optimizer/engines/image/raster-decode.ts`
  - `src/infrastructure/media/optimizer/engines/image/resource-limits.ts`
  - `src/infrastructure/media/optimizer/engines/image/types.ts`
  - `src/infrastructure/media/optimizer/engines/image/webp-budget.ts`
  - `src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts`
  - `src/infrastructure/media/optimizer/engines/model3d/index.ts`
  - `src/infrastructure/media/optimizer/engines/video/index.ts`
  - `src/infrastructure/media/optimizer/index.ts`
  - `src/infrastructure/media/optimizer/media-optimizer.ts`
- RPCs: n/a
- Tables `.from`: n/a
- Edge invokes: n/a

## NACHHER
- src/infrastructure/media/** → HTTP/client to server/src/application/media/
- Depends: GATE-01
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports

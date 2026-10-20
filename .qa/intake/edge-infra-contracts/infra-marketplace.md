# Infrastructure `marketplace`

## VORHER
- Area root: `src/infrastructure/marketplace/`
  - `src/infrastructure/marketplace/marketplace-service.ts`
- RPCs: `increment_marketplace_downloads`
- Tables `.from`: `marketplace_items`
- Edge invokes: n/a

## NACHHER
- src/infrastructure/marketplace/** → HTTP/client to server/src/application/marketplace/
- Depends: GATE-01, RPC:increment_marketplace_downloads
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover
- RPC parity for: increment_marketplace_downloads

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports

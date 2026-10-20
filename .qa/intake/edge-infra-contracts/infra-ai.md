# Infrastructure `ai`

## VORHER
- Area root: `src/infrastructure/ai/`
  - `src/infrastructure/ai/ai-provider-credentials-service.ts`
- RPCs: n/a
- Tables `.from`: n/a
- Edge invokes: `ai-provider-credentials`

## NACHHER
- src/infrastructure/ai/** → HTTP/client to server/src/application/ai/
- Depends: GATE-01, EDGE:ai-provider-credentials
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover
- Edge invoke parity for: ai-provider-credentials

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports

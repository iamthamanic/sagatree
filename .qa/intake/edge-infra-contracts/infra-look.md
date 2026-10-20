# Infrastructure `look`

## VORHER
- Area root: `src/infrastructure/look/`
  - `src/infrastructure/look/adapters/host-mtoon-look-adapter.ts`
  - `src/infrastructure/look/adapters/toonlab-look-adapter.ts`
  - `src/infrastructure/look/index.ts`
  - `src/infrastructure/look/look-material-roles.ts`
  - `src/infrastructure/look/look-reference-analysis-service.ts`
  - `src/infrastructure/look/look-runtime-types.ts`
  - `src/infrastructure/look/look-runtime.ts`
  - `src/infrastructure/look/look-service.ts`
  - `src/infrastructure/look/look.persistence.ts`
  - `src/infrastructure/look/supabase-look.repository.ts`
- RPCs: n/a
- Tables `.from`: n/a
- Edge invokes: `look-reference-analysis`

## NACHHER
- src/infrastructure/look/** → HTTP/client to server/src/application/look/
- Depends: GATE-01, EDGE:look-reference-analysis
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover
- Edge invoke parity for: look-reference-analysis

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports

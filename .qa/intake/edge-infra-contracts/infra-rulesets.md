# Infrastructure `rulesets`

## VORHER
- Area root: `src/infrastructure/rulesets/`
  - `src/infrastructure/rulesets/ruleset-service.ts`
- RPCs: n/a
- Tables `.from`: `rulesets`
- Edge invokes: n/a

## NACHHER
- src/infrastructure/rulesets/** → HTTP/client to server/src/application/rulesets/
- Depends: GATE-01
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports

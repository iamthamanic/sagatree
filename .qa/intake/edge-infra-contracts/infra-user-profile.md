# Infrastructure `user-profile`

## VORHER
- Area root: `src/infrastructure/user-profile/`
  - `src/infrastructure/user-profile/account-avatar-changed.ts`
  - `src/infrastructure/user-profile/account-avatar-store.ts`
  - `src/infrastructure/user-profile/supabase-user-profile.repository.ts`
  - `src/infrastructure/user-profile/user-profile-service.ts`
- RPCs: n/a
- Tables `.from`: `user_profiles`
- Edge invokes: n/a

## NACHHER
- src/infrastructure/user-profile/** → HTTP/client to server/src/application/user-profile/
- Depends: GATE-01
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports

# Infrastructure `saga`

## VORHER
- Area root: `src/infrastructure/saga/`
  - `src/infrastructure/saga/saga-definition-service.ts`
  - `src/infrastructure/saga/session-outcome-promotion-service.ts`
- RPCs: `copy_native_saga_definition`, `create_project_from_saga_version`, `create_user_saga_definition`, `duplicate_saga_playthrough`, `get_native_saga_definition_by_slug`, `get_saga_definition_editor`, `get_saga_definition_version`, `publish_saga_definition_version`, `save_saga_definition_draft`
- Tables `.from`: n/a
- Edge invokes: n/a

## NACHHER
- src/infrastructure/saga/** → HTTP/client to server/src/application/saga/
- Depends: GATE-01, RPC:copy_native_saga_definition, RPC:create_project_from_saga_version, RPC:create_user_saga_definition, RPC:duplicate_saga_playthrough, RPC:get_native_saga_definition_by_slug
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover
- RPC parity for: copy_native_saga_definition, create_project_from_saga_version, create_user_saga_definition, duplicate_saga_playthrough, get_native_saga_definition_by_slug, get_saga_definition_editor, get_saga_definition_version, publish_saga_definition_version…

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports

# Infrastructure `project`

## VORHER
- Area root: `src/infrastructure/project/`
  - `src/infrastructure/project/project-member-service.ts`
  - `src/infrastructure/project/project-service.ts`
  - `src/infrastructure/project/saga-overview-service.ts`
  - `src/infrastructure/project/saga-permission-service.ts`
- RPCs: `create_project_session`, `ensure_native_starter_project`, `get_my_saga_permissions`, `get_saga_lore_timeline`, `get_saga_overview`, `join_project_by_code`, `list_saga_bindings`, `list_saga_member_permission_state`, `set_my_project_character`, `set_saga_binding_reveal`, `set_saga_member_bundle`
- Tables `.from`: `project_members`
- Edge invokes: n/a

## NACHHER
- src/infrastructure/project/** → HTTP/client to server/src/application/project/
- Depends: GATE-01, RPC:create_project_session, RPC:ensure_native_starter_project, RPC:get_my_saga_permissions, RPC:get_saga_lore_timeline, RPC:get_saga_overview
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover
- RPC parity for: create_project_session, ensure_native_starter_project, get_my_saga_permissions, get_saga_lore_timeline, get_saga_overview, join_project_by_code, list_saga_bindings, list_saga_member_permission_state…

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports

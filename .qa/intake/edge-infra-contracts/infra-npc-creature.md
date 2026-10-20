# Infrastructure `npc-creature`

## VORHER
- Area root: `src/infrastructure/npc-creature/`
  - `src/infrastructure/npc-creature/npc-creature-controller.persistence.ts`
  - `src/infrastructure/npc-creature/npc-creature-instance.persistence.ts`
  - `src/infrastructure/npc-creature/npc-creature-service.ts`
  - `src/infrastructure/npc-creature/npc-creature.persistence.ts`
  - `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts`
- RPCs: `assign_npc_creature_controller`, `clear_npc_creature_instance_temp_controllers_for_session`, `remove_npc_creature_instance`, `spawn_npc_creature_instance`, `update_npc_creature_instance_runtime`
- Tables `.from`: `world_profiles`
- Edge invokes: n/a

## NACHHER
- src/infrastructure/npc-creature/** → HTTP/client to server/src/application/npc-creature/
- Depends: GATE-01, RPC:assign_npc_creature_controller, RPC:clear_npc_creature_instance_temp_controllers_for_session, RPC:remove_npc_creature_instance, RPC:spawn_npc_creature_instance, RPC:update_npc_creature_instance_runtime
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover
- RPC parity for: assign_npc_creature_controller, clear_npc_creature_instance_temp_controllers_for_session, remove_npc_creature_instance, spawn_npc_creature_instance, update_npc_creature_instance_runtime

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports

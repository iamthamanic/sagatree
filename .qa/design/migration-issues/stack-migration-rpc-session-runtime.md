<!-- migration-contract:v2 localId=RPC-SESSION-RUNTIME -->
# RPC-SESSION-RUNTIME: Session-Runtime, Snapshot und Presence

## Type

feature

## Intent

Session-Runtime, Snapshot und Presence: apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Session-Runtime, Snapshot und Presence: apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/session-runtime/apply_session_runtime_command/index.ts, server/src/application/session-runtime/get_session_runtime_snapshot/index.ts, server/src/application/session-runtime/set_session_player_presence/index.ts, server/src/modules/session/index.ts, server/src/application/commands/apply_session_runtime_command.ts, server/src/application/commands/get_session_runtime_snapshot.ts, server/src/application/commands/set_session_player_presence.ts, server/src/application/session-runtime/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/042_session_shared_rolls.sql`, `supabase/migrations/043_session_shared_scene_presentation.sql`, `supabase/migrations/044_session_combat_encounter.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/049_session_death_lifecycle.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/065_saga_simulation_ops.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/apply_session_runtime_command.md`, `.qa/intake/rpc-contracts/get_session_runtime_snapshot.md`, `.qa/intake/rpc-contracts/set_session_player_presence.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #814.

## Scope

In:
- `server/src/application/session-runtime/apply_session_runtime_command/index.ts`
- `server/src/application/session-runtime/get_session_runtime_snapshot/index.ts`
- `server/src/application/session-runtime/set_session_player_presence/index.ts`
- `server/src/modules/session/index.ts`
- `server/src/application/commands/apply_session_runtime_command.ts`
- `server/src/application/commands/get_session_runtime_snapshot.ts`
- `server/src/application/commands/set_session_player_presence.ts`
- `server/src/application/session-runtime/__tests__`

Out:
- production data
- unrelated product flows
- Unaufgeforderte Re-Designs, nicht eingebundene Legacy-Worker oder alternative Architektur-Stacks.

## User Journey

1. Der berechtigte Nutzer startet den bereits vorhandenen SagaTree-Vorgang (keine neuen UX-Flows oder UI-Varianten erfinden).
2. Der bestehende UI-/Service-Adapter erreicht den benannten Host-Use-Case unter unveränderten DTO-/Fehler- und Rollenverträgen.
3. Die UI zeigt denselben fachlichen Zustand und die erlaubte Projektion; Lade-, Fehler-, Reload- und Reconnect-Verhalten bleibt äquivalent.
4. Bei einem Fremdbesitzer, fehlender Membership oder nicht veröffentlichter GM-Information liefert der Host einen nachgewiesenen DENY statt nur versteckter UI.

UI-Parität, soweit betroffen: `src/THEME_GUIDE.md`, `docs/ui-styleguide.md`, `docs/concepts/adaptive-ui-experience-contract.md`, `docs/concepts/conductor-experience-contract.md` und `docs/concepts/imagination-first-visualization-contract.md`.

## Runtime

| Axis | This slice |
| --- | --- |
| Local / Solo | ein Node-Host mit SQLite, keine obligatorische Cloud |
| VPS / Remote Browser | derselbe Node-Host, sichere Cookie-Sitzungen + Hono/Colyseus wenn Auth/Transport betroffen |
| Desktop (später) | derselbe Host als Tauri-Sidecar; kein Desktop-Release-Beleg aus diesem Issue |

## Security & Data

- Die pro RPC belegten Actor-/Owner-/GM-/Membership-Regeln, effektiven Rechte und SQLSTATE-Fehler sind verbindlich. Bekannte Legacy-Berechtigungsdefekte verlangen einen expliziten DENY-Nachweis; eine Paritätsprobe darf sie nicht legitimieren.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

### Bekannte Legacy-Defekte / negative Regressionen

- {"id":"RPC-RUNTIME-ROLL-OWNER-COLUMN","severity":"High","status":"blocked-successor-acceptance","summary":"Nicht-GM-Roll-Aufruf greift auf v_character.user_id zu, obwohl characters.owner_user_id die wirksame Spalte ist; Baseline scheitert statt zu würfeln.","sourceEvidence":"supabase/migrations/042_session_shared_rolls.sql:212; spätere073/079/085 benennen den Helper um, korrigieren aber nicht den Feldzugriff. Isolierter PostgreSQL15-Player-Roll reproduziert record has no field user_id.","requiredSuccessorAcceptance":"Owner-Prüfung gegen owner_user_id; positiver eigenerPlayer-Roll und negativerFremdcharakter-Roll müssen vor Runtime-Abnahme bestehen. Fehler darf keine Revision/Event erzeugen.","deployedExploitVerified":false,"isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"PAR-08"}}
- {"id":"RPC-SEC-ANON-EVENT-HELPER","severity":"Critical","status":"blocked-successor-acceptance","summary":"Auch anon kann append_session_event direkt ausführen und ein Event mit frei gewähltem Actor in einer fremden Session anlegen.","sourceEvidence":"supabase/migrations/041_session_runtime_state.sql; Supabase-Defaultprivilegien bleiben trotz REVOKE PUBLIC bestehen. Der Helper hat keinen eigenen Auth-/Teilnahme-Guard.","requiredSuccessorAcceptance":"Direkten Zugriff auf internen Event-Writer entziehen oder eigenständig autorisieren; anon und authentifizierter Fremdnutzer dürfen weder Event erzeugen noch Actor vortäuschen.","isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-EVENT-HELPER-ANON"},"deployedExploitVerified":false}
- {"id":"RPC-SEC-ANON-ADVENTURE-HELPER","severity":"Critical","status":"blocked-successor-acceptance","summary":"Auch anon kann im öffentlichen Adventure-Helper p_is_gm=true behaupten und fremde Projekt-Adventure-Daten schreiben.","sourceEvidence":"supabase/migrations/065_saga_simulation_ops.sql plus 073/079/085-Transformationen; Helper vertraut übergebenem GM-Boolean bei erhaltenen anon-Defaultprivilegien.","requiredSuccessorAcceptance":"Helper nicht öffentlich exponieren oder Actor/Projekt-GM selbst prüfen; frei gelieferte Booleans dürfen kein Recht verleihen. Anon/Fremdnutzer-Flags müssen unverändert bleiben.","isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-ADVENTURE-HELPER-ANON"},"deployedExploitVerified":false}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence ausführt
- Dann: Alle 15 Runtime-Kinds haben getrennte Request-, Rollen-, Helper-, Event- und Snapshot-Fixtures; status/join/leave werden nicht mit separaten Lifecycle-RPCs verwechselt.
- Quelle: `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/042_session_shared_rolls.sql`, `supabase/migrations/043_session_shared_scene_presentation.sql`, `supabase/migrations/044_session_combat_encounter.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/049_session_death_lifecycle.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/065_saga_simulation_ops.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence ausführt
- Dann: Session-Lock, erwartete Revision, Event und Helper-Effekte committen atomar; konkurrierende veraltete Revisionen liefern 40001.
- Quelle: `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/042_session_shared_rolls.sql`, `supabase/migrations/043_session_shared_scene_presentation.sql`, `supabase/migrations/044_session_combat_encounter.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/049_session_death_lifecycle.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/065_saga_simulation_ops.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence ausführt
- Dann: Idempotenz ist sessionbezogen; Replay liefert die aktuelle erlaubte Projektion und erzeugt kein zweites Event.
- Quelle: `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/042_session_shared_rolls.sql`, `supabase/migrations/043_session_shared_scene_presentation.sql`, `supabase/migrations/044_session_combat_encounter.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/049_session_death_lifecycle.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/065_saga_simulation_ops.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence ausführt
- Dann: GM/Director/Player-Projektionen und Presence erlauben weder fremde Figurensteuerung noch verborgene Scene-/Adventure-Daten.
- Quelle: `src/domains/session/contracts/session-lifecycle.ts`, `src/domains/session/contracts/session-runtime.ts`, `src/infrastructure/session/session-runtime-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/002_character_trait_arrays.sql`, `supabase/migrations/005_character_ruleset_metadata.sql`, `supabase/migrations/007_sagadrive_character_profile.sql`, `supabase/migrations/010_characters_v3_columns.sql`, `supabase/migrations/014_character_abilities_emotion_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/016_character_inventory_v2.sql`, `supabase/migrations/023_npc_creature_instances.sql`, `supabase/migrations/029_character_sheet_status.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/041_session_runtime_state.sql`, `supabase/migrations/042_session_shared_rolls.sql`, `supabase/migrations/043_session_shared_scene_presentation.sql`, `supabase/migrations/044_session_combat_encounter.sql`, `supabase/migrations/047_session_program_presentation.sql`, `supabase/migrations/048_session_knowledge_reveals.sql`, `supabase/migrations/049_session_death_lifecycle.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/051_session_director_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/053_sessions_look_override.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/061_session_recaps_and_handover.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/065_saga_simulation_ops.sql`, `supabase/migrations/066_saga_between_sessions_bote.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/079_drop_sagadrive_aliases.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/089_gm_presence_character_type.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Alle 15 Runtime-Kinds haben getrennte Request-, Rollen-, Helper-, Event- und Snapshot-Fixtures; status/join/leave werden nicht mit separaten Lifecycle-RPCs verwechselt.
2. Session-Lock, erwartete Revision, Event und Helper-Effekte committen atomar; konkurrierende veraltete Revisionen liefern 40001.
3. Idempotenz ist sessionbezogen; Replay liefert die aktuelle erlaubte Projektion und erzeugt kein zweites Event.
4. GM/Director/Player-Projektionen und Presence erlauben weder fremde Figurensteuerung noch verborgene Scene-/Adventure-Daten.
5. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 15 Runtime-Kinds haben getrennte Request-, Rollen-, Helper-, Event- und Snapshot-Fixtures; status/join/leave werden nicht mit separaten Lifecycle-RPCs verwechselt.
- [ ] Session-Lock, erwartete Revision, Event und Helper-Effekte committen atomar; konkurrierende veraltete Revisionen liefern 40001.
- [ ] Idempotenz ist sessionbezogen; Replay liefert die aktuelle erlaubte Projektion und erzeugt kein zweites Event.
- [ ] GM/Director/Player-Projektionen und Presence erlauben weder fremde Figurensteuerung noch verborgene Scene-/Adventure-Daten.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/session-runtime/apply_session_runtime_command/index.ts`, `server/src/application/session-runtime/get_session_runtime_snapshot/index.ts`, `server/src/application/session-runtime/set_session_player_presence/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | none — later consumers must not silently assume host activation beyond this slice without their own evidence. |
| **FEATURE VERIFIED** | MIG-600/#845 (security parity) and MIG-602/#847 (host/DB/transport/browser integration); release cutover remains MIG-700/#849 + human approval. |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)

Status: **blocked**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-session-runtime`
- Design: `.qa/design/migration-issues/stack-migration-rpc-session-runtime.md`
- Status: blocked
- Reihenfolge: 27; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-027`, `agent-blocked`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-session-runtime.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).


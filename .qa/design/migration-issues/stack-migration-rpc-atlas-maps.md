<!-- migration-contract:v2 localId=RPC-ATLAS-MAPS -->
# RPC-ATLAS-MAPS: Atlas-Kartenprojektion und Revision

## Type

feature

## Intent

Atlas-Kartenprojektion und Revision: ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Atlas-Kartenprojektion und Revision: ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/world-atlas/ensure_world_atlas_root/index.ts, server/src/application/world-atlas/list_world_atlas_maps/index.ts, server/src/application/world-atlas/get_world_atlas_map/index.ts, server/src/application/world-atlas/upsert_world_atlas_map/index.ts, server/src/modules/world/index.ts, server/src/application/commands/ensure_world_atlas_root.ts, server/src/application/commands/list_world_atlas_maps.ts, server/src/application/commands/get_world_atlas_map.ts, server/src/application/commands/upsert_world_atlas_map.ts, server/src/application/world-atlas/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/world/world-atlas-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `supabase/migrations/106_atlas_get_map_overload_fix.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/ensure_world_atlas_root.md`, `.qa/intake/rpc-contracts/list_world_atlas_maps.md`, `.qa/intake/rpc-contracts/get_world_atlas_map.md`, `.qa/intake/rpc-contracts/upsert_world_atlas_map.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #813.

## Scope

In:
- `server/src/application/world-atlas/ensure_world_atlas_root/index.ts`
- `server/src/application/world-atlas/list_world_atlas_maps/index.ts`
- `server/src/application/world-atlas/get_world_atlas_map/index.ts`
- `server/src/application/world-atlas/upsert_world_atlas_map/index.ts`
- `server/src/modules/world/index.ts`
- `server/src/application/commands/ensure_world_atlas_root.ts`
- `server/src/application/commands/list_world_atlas_maps.ts`
- `server/src/application/commands/get_world_atlas_map.ts`
- `server/src/application/commands/upsert_world_atlas_map.ts`
- `server/src/application/world-atlas/__tests__`

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

- (Acceptance/Regression, sperrt READY nicht) {"id":"RPC-SEC-CROSS-SAGA-REVEAL","severity":"High","status":"blocked-successor-acceptance","summary":"Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.","sourceEvidence":"supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.","requiredSuccessorAcceptance":"Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.","deployedExploitVerified":false,"isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-CROSS-SAGA"}}
- (Acceptance/Regression, sperrt READY nicht) {"id":"RPC-SEC-CROSS-SAGA-REVEAL","severity":"High","status":"blocked-successor-acceptance","summary":"Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.","sourceEvidence":"supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.","requiredSuccessorAcceptance":"Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.","deployedExploitVerified":false,"isolatedPostgresReproduced":false,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-CROSS-SAGA"},"reproductionScope":"The linked isolated reproduction exercises list_world_atlas_maps; this RPC shares the source-verified missing saga-membership check and still needs its own negative runtime fixture."}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map ausführt
- Dann: Migration 106 wird berücksichtigt: get_world_atlas_map hat ausschließlich die dreiargumentige Signatur mit optionalem p_saga_public_id.
- Quelle: `src/infrastructure/world/world-atlas-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `supabase/migrations/106_atlas_get_map_overload_fix.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map ausführt
- Dann: Player-Liste und Detail liefern nur im konkreten Saga-Kontext freigegebene kanonische Orte; GM-Daten, Parent-IDs und Azgaar-Pfade bleiben geschützt.
- Quelle: `src/infrastructure/world/world-atlas-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `supabase/migrations/106_atlas_get_map_overload_fix.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map ausführt
- Dann: Root-Erzeugung ist bei Wiederholung stabil; Parent-Karte muss dieselbe Welt besitzen.
- Quelle: `src/infrastructure/world/world-atlas-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `supabase/migrations/106_atlas_get_map_overload_fix.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map ausführt
- Dann: GeoJSON-FeatureCollection, 1.500.000-Byte-Limit und Revision-Konflikt sind mit echten SQL- und Decoder-Fixtures abgenommen.
- Quelle: `src/infrastructure/world/world-atlas-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `supabase/migrations/106_atlas_get_map_overload_fix.sql`

### Fall 5

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: {"id":"RPC-SEC-CROSS-SAGA-REVEAL","severity":"High","status":"blocked-successor-acceptance","summary":"Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.","sourceEvidence":"supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.","requiredSuccessorAcceptance":"Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.","deployedExploitVerified":false,"isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-CROSS-SAGA"}}
- Quelle: `.qa/intake/rpc-contracts/ensure_world_atlas_root.md`, `.qa/intake/rpc-contracts/list_world_atlas_maps.md`, `.qa/intake/rpc-contracts/get_world_atlas_map.md`, `.qa/intake/rpc-contracts/upsert_world_atlas_map.md`

### Fall 6

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: {"id":"RPC-SEC-CROSS-SAGA-REVEAL","severity":"High","status":"blocked-successor-acceptance","summary":"Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.","sourceEvidence":"supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.","requiredSuccessorAcceptance":"Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.","deployedExploitVerified":false,"isolatedPostgresReproduced":false,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-CROSS-SAGA"},"reproductionScope":"The linked isolated reproduction exercises list_world_atlas_maps; this RPC shares the source-verified missing saga-membership check and still needs its own negative runtime fixture."}
- Quelle: `.qa/intake/rpc-contracts/ensure_world_atlas_root.md`, `.qa/intake/rpc-contracts/list_world_atlas_maps.md`, `.qa/intake/rpc-contracts/get_world_atlas_map.md`, `.qa/intake/rpc-contracts/upsert_world_atlas_map.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Migration 106 wird berücksichtigt: get_world_atlas_map hat ausschließlich die dreiargumentige Signatur mit optionalem p_saga_public_id.
2. Player-Liste und Detail liefern nur im konkreten Saga-Kontext freigegebene kanonische Orte; GM-Daten, Parent-IDs und Azgaar-Pfade bleiben geschützt.
3. Root-Erzeugung ist bei Wiederholung stabil; Parent-Karte muss dieselbe Welt besitzen.
4. GeoJSON-FeatureCollection, 1.500.000-Byte-Limit und Revision-Konflikt sind mit echten SQL- und Decoder-Fixtures abgenommen.
5. Verpflichtende Legacy-Regression: {"id":"RPC-SEC-CROSS-SAGA-REVEAL","severity":"High","status":"blocked-successor-acceptance","summary":"Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.","sourceEvidence":"supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.","requiredSuccessorAcceptance":"Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.","deployedExploitVerified":false,"isolatedPostgresReproduced":true,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-CROSS-SAGA"}}
6. Verpflichtende Legacy-Regression: {"id":"RPC-SEC-CROSS-SAGA-REVEAL","severity":"High","status":"blocked-successor-acceptance","summary":"Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.","sourceEvidence":"supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.","requiredSuccessorAcceptance":"Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.","deployedExploitVerified":false,"isolatedPostgresReproduced":false,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-CROSS-SAGA"},"reproductionScope":"The linked isolated reproduction exercises list_world_atlas_maps; this RPC shares the source-verified missing saga-membership check and still needs its own negative runtime fixture."}
7. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 6 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/world-atlas/ensure_world_atlas_root/index.ts`, `server/src/application/world-atlas/list_world_atlas_maps/index.ts`, `server/src/application/world-atlas/get_world_atlas_map/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-301..313 / MIG-311 session adapters as applicable |
| **FEATURE VERIFIED** | MIG-311/#810 / MIG-301..313 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #861 (RPC-WORLD-MAP)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-atlas-maps`
- Design: `.qa/design/migration-issues/stack-migration-rpc-atlas-maps.md`
- Status: done
- Reihenfolge: 37; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-037`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-atlas-maps.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).


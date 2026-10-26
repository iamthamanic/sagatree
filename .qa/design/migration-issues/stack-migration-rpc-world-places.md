<!-- migration-contract:v2 localId=RPC-WORLD-PLACES -->
# RPC-WORLD-PLACES: Orte und Kartenverknüpfungen

## Type

feature

## Intent

Orte und Kartenverknüpfungen: list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Orte und Kartenverknüpfungen: list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/world-places/list_world_places/index.ts, server/src/application/world-places/list_world_place_map_links/index.ts, server/src/application/world-places/upsert_world_place/index.ts, server/src/application/world-places/upsert_world_place_map_link/index.ts, server/src/modules/world/index.ts, server/src/application/commands/list_world_places.ts, server/src/application/commands/list_world_place_map_links.ts, server/src/application/commands/upsert_world_place.ts, server/src/application/commands/upsert_world_place_map_link.ts, server/src/application/world-places/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`, `supabase/migrations/097_donalu_player_place_projection.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/list_world_places.md`, `.qa/intake/rpc-contracts/list_world_place_map_links.md`, `.qa/intake/rpc-contracts/upsert_world_place.md`, `.qa/intake/rpc-contracts/upsert_world_place_map_link.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #813.

## Scope

In:
- `server/src/application/world-places/list_world_places/index.ts`
- `server/src/application/world-places/list_world_place_map_links/index.ts`
- `server/src/application/world-places/upsert_world_place/index.ts`
- `server/src/application/world-places/upsert_world_place_map_link/index.ts`
- `server/src/modules/world/index.ts`
- `server/src/application/commands/list_world_places.ts`
- `server/src/application/commands/list_world_place_map_links.ts`
- `server/src/application/commands/upsert_world_place.ts`
- `server/src/application/commands/upsert_world_place_map_link.ts`
- `server/src/application/world-places/__tests__`

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

- (Acceptance/Regression, sperrt READY nicht) {"id":"RPC-SEC-CROSS-SAGA-REVEAL","severity":"High","status":"blocked-successor-acceptance","summary":"Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.","sourceEvidence":"supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.","requiredSuccessorAcceptance":"Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.","deployedExploitVerified":false,"isolatedPostgresReproduced":false,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-CROSS-SAGA"},"reproductionScope":"The linked isolated reproduction exercises list_world_atlas_maps; this RPC shares the source-verified missing saga-membership check and still needs its own negative runtime fixture."}

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link ausführt
- Dann: Editor- und Party-Projektionen werden getrennt durch vorhandene Rechte erzwungen; fehlender Saga-Kontext liefert leere Party-Listen.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`, `supabase/migrations/097_donalu_player_place_projection.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link ausführt
- Dann: Orte, Parent und Karte gehören derselben Welt; fremde IDs scheitern ohne verwaiste Verknüpfung.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`, `supabase/migrations/097_donalu_player_place_projection.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link ausführt
- Dann: UPSERT über place/map/usage aktualisiert genau eine Verknüpfung und liefert die belegten JSON-Felder.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`, `supabase/migrations/097_donalu_player_place_projection.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link ausführt
- Dann: Trigger für kanonische Hierarchie, Primary-Link und Kartenabgleich sind Teil der Transaktion und der Nachfolger-Tests.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`, `supabase/migrations/097_donalu_player_place_projection.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`

### Fall 5

- Gegeben: Der eingefrorene Legacy-Defekt aus dem Quellinventar
- Wenn: Der Host-Nachfolger die entsprechende negative / korrigierende Regression ausführt
- Dann: Verpflichtende Legacy-Regression: {"id":"RPC-SEC-CROSS-SAGA-REVEAL","severity":"High","status":"blocked-successor-acceptance","summary":"Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.","sourceEvidence":"supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.","requiredSuccessorAcceptance":"Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.","deployedExploitVerified":false,"isolatedPostgresReproduced":false,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-CROSS-SAGA"},"reproductionScope":"The linked isolated reproduction exercises list_world_atlas_maps; this RPC shares the source-verified missing saga-membership check and still needs its own negative runtime fixture."}
- Quelle: `.qa/intake/rpc-contracts/list_world_places.md`, `.qa/intake/rpc-contracts/list_world_place_map_links.md`, `.qa/intake/rpc-contracts/upsert_world_place.md`, `.qa/intake/rpc-contracts/upsert_world_place_map_link.md`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Editor- und Party-Projektionen werden getrennt durch vorhandene Rechte erzwungen; fehlender Saga-Kontext liefert leere Party-Listen.
2. Orte, Parent und Karte gehören derselben Welt; fremde IDs scheitern ohne verwaiste Verknüpfung.
3. UPSERT über place/map/usage aktualisiert genau eine Verknüpfung und liefert die belegten JSON-Felder.
4. Trigger für kanonische Hierarchie, Primary-Link und Kartenabgleich sind Teil der Transaktion und der Nachfolger-Tests.
5. Verpflichtende Legacy-Regression: {"id":"RPC-SEC-CROSS-SAGA-REVEAL","severity":"High","status":"blocked-successor-acceptance","summary":"Welt-Leser können einen fremden Saga-Public-ID derselben Welt angeben und dessen Party-Reveals auslesen.","sourceEvidence":"supabase/migrations/097_donalu_player_place_projection.sql und 105_atlas_worldbuilder_player_projection.sql: Projekt wird nach public_id+world_profile_id aufgelöst, aber Mitgliedschaft im gewählten Projekt wird nicht geprüft.","requiredSuccessorAcceptance":"Vor Party-Projektion die Mitgliedschaft/GM-Berechtigung genau im angeforderten Saga-Projekt nachweisen; A-Mitglied darf keine nur in B freigegebenen Orte/Karten/Links sehen.","deployedExploitVerified":false,"isolatedPostgresReproduced":false,"observation":{"path":".qa/intake/rpc-contracts/legacy-observations.json","testId":"BASELINE-SEC-CROSS-SAGA"},"reproductionScope":"The linked isolated reproduction exercises list_world_atlas_maps; this RPC shares the source-verified missing saga-membership check and still needs its own negative runtime fixture."}
6. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 5 quellenabgeleiteten Given/When/Then-Fälle unter Edge Cases und Required Tests müssen im echten zuständigen Test-Stack nachweislich PASS sein; keine RequiredTests aus dem Inventar verlieren.
- [ ] Jeder negative Berechtigungs-, Schema-, State- und Retry-Test ist einzeln ausgeführt und mit Commit/Fixture und Logs belegbar; ein Legacy-Defekt wird nicht als sichere Parität akzeptiert.
- [ ] Alle Signaturen, Owner-/GM-/Membership- und Persistenz-Nebenwirkungen werden mit dem bestehenden Quellvertrag verglichen; ungetestete Pfade bleiben NOT RUN.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/world-places/list_world_places/index.ts`, `server/src/application/world-places/list_world_place_map_links/index.ts`, `server/src/application/world-places/upsert_world_place/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | MIG-301..313 / MIG-311 session adapters as applicable |
| **FEATURE VERIFIED** | ATLAS-LIVE-E2E/#770 + MIG-602/#847 |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #795 (MIG-020)
- Depends on #792 (MIG-013)
- Depends on #797 (MIG-022)
- Depends on #799 (MIG-024)
- Depends on #784 (GATE-01)
- Depends on #785 (GATE-02)
- Depends on #787 (GATE-04)
- Depends on #862 (RPC-ATLAS-MAPS)

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-world-places`
- Design: `.qa/design/migration-issues/stack-migration-rpc-world-places.md`
- Status: ready
- Reihenfolge: 38; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-038`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-world-places.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).


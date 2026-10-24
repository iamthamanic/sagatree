<!-- migration-contract:v2 localId=RPC-SAGA-GOVERNANCE -->
# RPC-SAGA-GOVERNANCE: Saga-Berechtigungen, Bindings und Bundles

## Type

feature

## Intent

Saga-Berechtigungen, Bindings und Bundles: get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Saga-Berechtigungen, Bindings und Bundles: get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/saga-governance/get_my_saga_permissions/index.ts, server/src/application/saga-governance/list_saga_bindings/index.ts, server/src/application/saga-governance/list_saga_member_permission_state/index.ts, server/src/application/saga-governance/set_saga_member_bundle/index.ts, server/src/application/saga-governance/set_saga_binding_reveal/index.ts, server/src/modules/saga/index.ts, server/src/modules/permissions/index.ts, server/src/application/commands/get_my_saga_permissions.ts, server/src/application/commands/list_saga_bindings.ts, server/src/application/commands/list_saga_member_permission_state.ts, server/src/application/commands/set_saga_member_bundle.ts, server/src/application/commands/set_saga_binding_reveal.ts, server/src/application/saga-governance/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/project/saga-permission-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/get_my_saga_permissions.md`, `.qa/intake/rpc-contracts/list_saga_bindings.md`, `.qa/intake/rpc-contracts/list_saga_member_permission_state.md`, `.qa/intake/rpc-contracts/set_saga_member_bundle.md`, `.qa/intake/rpc-contracts/set_saga_binding_reveal.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #815.

## Scope

In:
- `server/src/application/saga-governance/get_my_saga_permissions/index.ts`
- `server/src/application/saga-governance/list_saga_bindings/index.ts`
- `server/src/application/saga-governance/list_saga_member_permission_state/index.ts`
- `server/src/application/saga-governance/set_saga_member_bundle/index.ts`
- `server/src/application/saga-governance/set_saga_binding_reveal/index.ts`
- `server/src/modules/saga/index.ts`
- `server/src/modules/permissions/index.ts`
- `server/src/application/commands/get_my_saga_permissions.ts`
- `server/src/application/commands/list_saga_bindings.ts`
- `server/src/application/commands/list_saga_member_permission_state.ts`
- `server/src/application/commands/set_saga_member_bundle.ts`
- `server/src/application/commands/set_saga_binding_reveal.ts`
- `server/src/application/saga-governance/__tests__`

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

## Edge Cases

### Fall 1

- Gegeben: Der eingefrorene Quellvertrag für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal ausführt
- Dann: GM, explizite Grants und aktive Mitgliedschaft bestimmen die dokumentierten Permission-Keys und sichtbaren Bindings.
- Quelle: `src/infrastructure/project/saga-permission-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal ausführt
- Dann: Bundle-Wechsel ersetzt Grants und Assignment atomar; der letzte Governance-Berechtigte kann nicht ausgesperrt werden.
- Quelle: `src/infrastructure/project/saga-permission-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal ausführt
- Dann: Binding-Reveal akzeptiert nur gm_only/party/unlisted und bleibt auf das konkrete Projekt beschränkt.
- Quelle: `src/infrastructure/project/saga-permission-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_my_saga_permissions, list_saga_bindings, list_saga_member_permission_state, set_saga_member_bundle, set_saga_binding_reveal ausführt
- Dann: Unlisted wird auch für GM nicht in der Standardliste ausgegeben; Mitglieder-/Binding-Decoder und Reihenfolge bleiben belegt.
- Quelle: `src/infrastructure/project/saga-permission-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/040_session_join_code_security.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. GM, explizite Grants und aktive Mitgliedschaft bestimmen die dokumentierten Permission-Keys und sichtbaren Bindings.
2. Bundle-Wechsel ersetzt Grants und Assignment atomar; der letzte Governance-Berechtigte kann nicht ausgesperrt werden.
3. Binding-Reveal akzeptiert nur gm_only/party/unlisted und bleibt auf das konkrete Projekt beschränkt.
4. Unlisted wird auch für GM nicht in der Standardliste ausgegeben; Mitglieder-/Binding-Decoder und Reihenfolge bleiben belegt.
5. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] GM, explizite Grants und aktive Mitgliedschaft bestimmen die dokumentierten Permission-Keys und sichtbaren Bindings.
- [ ] Bundle-Wechsel ersetzt Grants und Assignment atomar; der letzte Governance-Berechtigte kann nicht ausgesperrt werden.
- [ ] Binding-Reveal akzeptiert nur gm_only/party/unlisted und bleibt auf das konkrete Projekt beschränkt.
- [ ] Unlisted wird auch für GM nicht in der Standardliste ausgegeben; Mitglieder-/Binding-Decoder und Reihenfolge bleiben belegt.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/saga-governance/get_my_saga_permissions/index.ts`, `server/src/application/saga-governance/list_saga_bindings/index.ts`, `server/src/application/saga-governance/list_saga_member_permission_state/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
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
- Depends on #874 (RPC-PROJECT-MEMBERSHIP)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-saga-governance`
- Design: `.qa/design/migration-issues/stack-migration-rpc-saga-governance.md`
- Status: waiting
- Reihenfolge: 26; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-026`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-saga-governance.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).


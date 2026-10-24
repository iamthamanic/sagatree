<!-- migration-contract:v2 localId=RPC-SAGA-VERSION-READ -->
# RPC-SAGA-VERSION-READ: Saga-Versionen und native Katalogprojektion

## Type

feature

## Intent

Saga-Versionen und native Katalogprojektion: get_native_saga_definition_by_slug, get_saga_definition_version als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Saga-Versionen und native Katalogprojektion: get_native_saga_definition_by_slug, get_saga_definition_version als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/saga-version-read/get_native_saga_definition_by_slug/index.ts, server/src/application/saga-version-read/get_saga_definition_version/index.ts, server/src/modules/saga/index.ts, server/src/application/commands/get_native_saga_definition_by_slug.ts, server/src/application/commands/get_saga_definition_version.ts, server/src/application/saga-version-read/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/get_native_saga_definition_by_slug.md`, `.qa/intake/rpc-contracts/get_saga_definition_version.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #815.

## Scope

In:
- `server/src/application/saga-version-read/get_native_saga_definition_by_slug/index.ts`
- `server/src/application/saga-version-read/get_saga_definition_version/index.ts`
- `server/src/modules/saga/index.ts`
- `server/src/application/commands/get_native_saga_definition_by_slug.ts`
- `server/src/application/commands/get_saga_definition_version.ts`
- `server/src/application/saga-version-read/__tests__`

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

- Gegeben: Der eingefrorene Quellvertrag für get_native_saga_definition_by_slug, get_saga_definition_version und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_native_saga_definition_by_slug, get_saga_definition_version ausführt
- Dann: Native Slug-Auflösung wählt die neueste veröffentlichte Version; unbekannter Slug liefert P0002.
- Quelle: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für get_native_saga_definition_by_slug, get_saga_definition_version und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_native_saga_definition_by_slug, get_saga_definition_version ausführt
- Dann: Versionszugriff unterscheidet native Veröffentlichung, eigenen Inhalt und aktive Projektmitgliedschaft.
- Quelle: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für get_native_saga_definition_by_slug, get_saga_definition_version und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_native_saga_definition_by_slug, get_saga_definition_version ausführt
- Dann: Die GM-Projektion folgt nachgewiesenen Rollen; Player-Payload entfernt GM-Bereiche über den referenzierten Helper.
- Quelle: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für get_native_saga_definition_by_slug, get_saga_definition_version und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für get_native_saga_definition_by_slug, get_saga_definition_version ausführt
- Dann: Infrastruktur-Decoder verarbeitet alle Pflichtfelder und verwirft ungültige Payload-Formen.
- Quelle: `src/domains/saga/contracts/saga-definition.ts`, `src/infrastructure/saga/saga-definition-service.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/064_saga_editor_v1.sql`, `supabase/migrations/072_dornhain_seed_and_character_rls.sql`, `supabase/migrations/073_sagatree_schema_rename_compat.sql`, `supabase/migrations/085_fix_function_bodies_sagatree.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Native Slug-Auflösung wählt die neueste veröffentlichte Version; unbekannter Slug liefert P0002.
2. Versionszugriff unterscheidet native Veröffentlichung, eigenen Inhalt und aktive Projektmitgliedschaft.
3. Die GM-Projektion folgt nachgewiesenen Rollen; Player-Payload entfernt GM-Bereiche über den referenzierten Helper.
4. Infrastruktur-Decoder verarbeitet alle Pflichtfelder und verwirft ungültige Payload-Formen.
5. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Native Slug-Auflösung wählt die neueste veröffentlichte Version; unbekannter Slug liefert P0002.
- [ ] Versionszugriff unterscheidet native Veröffentlichung, eigenen Inhalt und aktive Projektmitgliedschaft.
- [ ] Die GM-Projektion folgt nachgewiesenen Rollen; Player-Payload entfernt GM-Bereiche über den referenzierten Helper.
- [ ] Infrastruktur-Decoder verarbeitet alle Pflichtfelder und verwirft ungültige Payload-Formen.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/saga-version-read/get_native_saga_definition_by_slug/index.ts`, `server/src/application/saga-version-read/get_saga_definition_version/index.ts`, `server/src/modules/saga/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
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
- Depends on #871 (RPC-SAGA-AUTHORING)

Status: **ready**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-saga-version-read`
- Design: `.qa/design/migration-issues/stack-migration-rpc-saga-version-read.md`
- Status: ready
- Reihenfolge: 23; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-023`, `agent-ready`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-saga-version-read.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).


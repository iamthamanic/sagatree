<!-- migration-contract:v2 localId=RPC-WORLD-CREATE -->
# RPC-WORLD-CREATE: Kanonischen Weltknoten erstellen und benennen

## Type

feature

## Intent

Kanonischen Weltknoten erstellen und benennen: create_world_node_with_maps, rename_world_node als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren.

## Goal

Kanonischen Weltknoten erstellen und benennen: create_world_node_with_maps, rename_world_node als zusammengehörigen Anwendungsfall mit unveränderter sicherer Fachsemantik portieren. Zielpfade: server/src/application/world-create/create_world_node_with_maps/index.ts, server/src/application/world-create/rename_world_node/index.ts, server/src/modules/world/index.ts, server/src/application/commands/create_world_node_with_maps.ts, server/src/application/commands/rename_world_node.ts, server/src/application/world-create/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/create_world_node_with_maps.md`, `.qa/intake/rpc-contracts/rename_world_node.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..
- RPC-Koordinator: #813.

## Scope

In:
- `server/src/application/world-create/create_world_node_with_maps/index.ts`
- `server/src/application/world-create/rename_world_node/index.ts`
- `server/src/modules/world/index.ts`
- `server/src/application/commands/create_world_node_with_maps.ts`
- `server/src/application/commands/rename_world_node.ts`
- `server/src/application/world-create/__tests__`

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

- Gegeben: Der eingefrorene Quellvertrag für create_world_node_with_maps, rename_world_node und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_world_node_with_maps, rename_world_node ausführt
- Dann: Jeder kanonische Ortstyp erzeugt die erforderliche Vorfahrenkette, Primärkarte und Verknüpfung in einer Transaktion.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`

### Fall 2

- Gegeben: Der eingefrorene Quellvertrag für create_world_node_with_maps, rename_world_node und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_world_node_with_maps, rename_world_node ausführt
- Dann: Der weltbezogene Idempotency-Key liefert bei Wiederholung dieselben IDs ohne zusätzliche Orte oder Karten.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`

### Fall 3

- Gegeben: Der eingefrorene Quellvertrag für create_world_node_with_maps, rename_world_node und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_world_node_with_maps, rename_world_node ausführt
- Dann: Fremde/inkompatible Parents und leere Namen werden vor Seiteneffekten abgewiesen.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`

### Fall 4

- Gegeben: Der eingefrorene Quellvertrag für create_world_node_with_maps, rename_world_node und isolierte positive/negative Fixtures
- Wenn: Der Nachfolger den dokumentierten Fall für create_world_node_with_maps, rename_world_node ausführt
- Dann: Umbenennung erhöht die Ortsrevision; Placeholder wechseln zu draft, bestehende andere Status bleiben erhalten.
- Quelle: `src/infrastructure/world/world-place-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `src/lib/supabase.ts`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Jeder kanonische Ortstyp erzeugt die erforderliche Vorfahrenkette, Primärkarte und Verknüpfung in einer Transaktion.
2. Der weltbezogene Idempotency-Key liefert bei Wiederholung dieselben IDs ohne zusätzliche Orte oder Karten.
3. Fremde/inkompatible Parents und leere Namen werden vor Seiteneffekten abgewiesen.
4. Umbenennung erhöht die Ortsrevision; Placeholder wechseln zu draft, bestehende andere Status bleiben erhalten.
5. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Jeder kanonische Ortstyp erzeugt die erforderliche Vorfahrenkette, Primärkarte und Verknüpfung in einer Transaktion.
- [ ] Der weltbezogene Idempotency-Key liefert bei Wiederholung dieselben IDs ohne zusätzliche Orte oder Karten.
- [ ] Fremde/inkompatible Parents und leere Namen werden vor Seiteneffekten abgewiesen.
- [ ] Umbenennung erhöht die Ortsrevision; Placeholder wechseln zu draft, bestehende andere Status bleiben erhalten.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/world-create/create_world_node_with_maps/index.ts`, `server/src/application/world-create/rename_world_node/index.ts`, `server/src/modules/world/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
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
- Depends on #863 (RPC-WORLD-PLACES)

Status: **done**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-rpc-world-create`
- Design: `.qa/design/migration-issues/stack-migration-rpc-world-create.md`
- Status: done
- Reihenfolge: 39; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-039`, `agent-done`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-rpc-world-create.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).


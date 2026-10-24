<!-- migration-contract:v2 localId=MIG-350 -->
# MIG-350: Replace Postgres RPC cluster: world/atlas RPCs

## Type

chore

## Intent

Die 17 RPCs dieses Bereichs über 6 einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets.

## Goal

Die 17 RPCs dieses Bereichs über 6 einzeln abnehmbare Untertickets koordinieren; die Implementierung gehört ausschließlich in diese Untertickets. Zielpfade: server/src/application/world-map/get_world_map/index.ts, server/src/application/world-map/save_world_map/index.ts, server/src/modules/world/index.ts, server/src/application/commands/get_world_map.ts, server/src/application/commands/save_world_map.ts, server/src/application/world-map/__tests__, server/src/application/world-atlas/ensure_world_atlas_root/index.ts, server/src/application/world-atlas/list_world_atlas_maps/index.ts, server/src/application/world-atlas/get_world_atlas_map/index.ts, server/src/application/world-atlas/upsert_world_atlas_map/index.ts, server/src/application/commands/ensure_world_atlas_root.ts, server/src/application/commands/list_world_atlas_maps.ts, server/src/application/commands/get_world_atlas_map.ts, server/src/application/commands/upsert_world_atlas_map.ts, server/src/application/world-atlas/__tests__, server/src/application/world-places/list_world_places/index.ts, server/src/application/world-places/list_world_place_map_links/index.ts, server/src/application/world-places/upsert_world_place/index.ts, server/src/application/world-places/upsert_world_place_map_link/index.ts, server/src/application/commands/list_world_places.ts, server/src/application/commands/list_world_place_map_links.ts, server/src/application/commands/upsert_world_place.ts, server/src/application/commands/upsert_world_place_map_link.ts, server/src/application/world-places/__tests__, server/src/application/world-create/create_world_node_with_maps/index.ts, server/src/application/world-create/rename_world_node/index.ts, server/src/application/commands/create_world_node_with_maps.ts, server/src/application/commands/rename_world_node.ts, server/src/application/world-create/__tests__, server/src/application/world-restructure/reparent_world_node/index.ts, server/src/application/world-restructure/duplicate_world_node/index.ts, server/src/application/commands/reparent_world_node.ts, server/src/application/commands/duplicate_world_node.ts, server/src/application/world-restructure/__tests__, server/src/application/world-destructive/preview_world_node_consequences/index.ts, server/src/application/world-destructive/archive_world_node_subtree/index.ts, server/src/application/world-destructive/delete_world_node/index.ts, server/src/application/commands/preview_world_node_consequences.ts, server/src/application/commands/archive_world_node_subtree.ts, server/src/application/commands/delete_world_node.ts, server/src/application/world-destructive/__tests__.

## Non-Goals

- Unapproved framework substitution
- Production cutover or Supabase shutdown
- Retirement of any reachable legacy behavior without owner sign-off

## Context

- Epic: #773; historische Baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`; keine Produktionszustandsbehauptung.
- Verbindliche Architektur: `docs/architecture/migration-owner-decisions-2026-10-23.md`.
- Quellpfade und bestehende Adapter: `src/infrastructure/world/world-map-service.ts`, `src/lib/supabase.ts`, `supabase/migrations/001_initial.sql`, `supabase/migrations/004_project_membership_security.sql`, `supabase/migrations/008_world_profiles.sql`, `supabase/migrations/015_inventory_item_definitions.sql`, `supabase/migrations/019_world_profiles_read_for_adventure.sql`, `supabase/migrations/039_public_resource_ids_and_session_numbers.sql`, `supabase/migrations/050_session_adventure_runtime.sql`, `supabase/migrations/052_projects_look_settings.sql`, `supabase/migrations/059_saga_state_column_privileges.sql`, `supabase/migrations/063_saga_definitions.sql`, `supabase/migrations/068_world_maps.sql`, `supabase/migrations/083_world_profiles_public_id.sql`, `supabase/migrations/092_fix_projects_rls_recursion.sql`, `src/infrastructure/world/world-atlas-service.ts`, `src/lib/authenticatedUser.ts`, `src/lib/networkTimeout.ts`, `supabase/migrations/075_saga_permission_grants.sql`, `supabase/migrations/094_world_atlas.sql`, `supabase/migrations/095_donalu_world_places.sql`, `supabase/migrations/101_world_places_select_editor_only.sql`, `supabase/migrations/102_world_atlas_player_redaction_force.sql`, `supabase/migrations/103_atlas_worldbuilder_create_with_maps.sql`, `supabase/migrations/105_atlas_worldbuilder_player_projection.sql`, `supabase/migrations/106_atlas_get_map_overload_fix.sql`, `src/infrastructure/world/world-place-service.ts`, `supabase/migrations/096_donalu_place_map_link_rpc.sql`, `supabase/migrations/097_donalu_player_place_projection.sql`, `supabase/migrations/104_atlas_worldbuilder_mutations.sql`.
- Source Contracts: `.qa/intake/rpc-contracts/get_world_map.md`, `.qa/intake/rpc-contracts/save_world_map.md`, `.qa/intake/rpc-contracts/ensure_world_atlas_root.md`, `.qa/intake/rpc-contracts/list_world_atlas_maps.md`, `.qa/intake/rpc-contracts/get_world_atlas_map.md`, `.qa/intake/rpc-contracts/upsert_world_atlas_map.md`, `.qa/intake/rpc-contracts/list_world_places.md`, `.qa/intake/rpc-contracts/list_world_place_map_links.md`, `.qa/intake/rpc-contracts/upsert_world_place.md`, `.qa/intake/rpc-contracts/upsert_world_place_map_link.md`, `.qa/intake/rpc-contracts/create_world_node_with_maps.md`, `.qa/intake/rpc-contracts/rename_world_node.md`, `.qa/intake/rpc-contracts/reparent_world_node.md`, `.qa/intake/rpc-contracts/duplicate_world_node.md`, `.qa/intake/rpc-contracts/preview_world_node_consequences.md`, `.qa/intake/rpc-contracts/archive_world_node_subtree.md`, `.qa/intake/rpc-contracts/delete_world_node.md`.
- Zielverhalten: Binding product decisions: docs/architecture/migration-owner-decisions-2026-10-23.md; GATE-01 Drizzle+Policy, GATE-02 Cookie-A, GATE-03 Hono+Colyseus, GATE-04 SQLite single-writer. GATE-05 Tauri+sidecar selected; platform release pending..

## Scope

In:
- `server/src/application/world-map/get_world_map/index.ts`
- `server/src/application/world-map/save_world_map/index.ts`
- `server/src/modules/world/index.ts`
- `server/src/application/commands/get_world_map.ts`
- `server/src/application/commands/save_world_map.ts`
- `server/src/application/world-map/__tests__`
- `server/src/application/world-atlas/ensure_world_atlas_root/index.ts`
- `server/src/application/world-atlas/list_world_atlas_maps/index.ts`
- `server/src/application/world-atlas/get_world_atlas_map/index.ts`
- `server/src/application/world-atlas/upsert_world_atlas_map/index.ts`
- `server/src/application/commands/ensure_world_atlas_root.ts`
- `server/src/application/commands/list_world_atlas_maps.ts`
- `server/src/application/commands/get_world_atlas_map.ts`
- `server/src/application/commands/upsert_world_atlas_map.ts`
- `server/src/application/world-atlas/__tests__`
- `server/src/application/world-places/list_world_places/index.ts`
- `server/src/application/world-places/list_world_place_map_links/index.ts`
- `server/src/application/world-places/upsert_world_place/index.ts`
- `server/src/application/world-places/upsert_world_place_map_link/index.ts`
- `server/src/application/commands/list_world_places.ts`
- `server/src/application/commands/list_world_place_map_links.ts`
- `server/src/application/commands/upsert_world_place.ts`
- `server/src/application/commands/upsert_world_place_map_link.ts`
- `server/src/application/world-places/__tests__`
- `server/src/application/world-create/create_world_node_with_maps/index.ts`
- `server/src/application/world-create/rename_world_node/index.ts`
- `server/src/application/commands/create_world_node_with_maps.ts`
- `server/src/application/commands/rename_world_node.ts`
- `server/src/application/world-create/__tests__`
- `server/src/application/world-restructure/reparent_world_node/index.ts`
- `server/src/application/world-restructure/duplicate_world_node/index.ts`
- `server/src/application/commands/reparent_world_node.ts`
- `server/src/application/commands/duplicate_world_node.ts`
- `server/src/application/world-restructure/__tests__`
- `server/src/application/world-destructive/preview_world_node_consequences/index.ts`
- `server/src/application/world-destructive/archive_world_node_subtree/index.ts`
- `server/src/application/world-destructive/delete_world_node/index.ts`
- `server/src/application/commands/preview_world_node_consequences.ts`
- `server/src/application/commands/archive_world_node_subtree.ts`
- `server/src/application/commands/delete_world_node.ts`
- `server/src/application/world-destructive/__tests__`

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

- Die zentrale Policy bleibt obligatorisch. Jeder Teilvertrag trennt sichere Parität von explizit zu korrigierenden Legacy-Defekten. Der Koordinator erteilt keine Architekturfreigabe.
- Der Host erzwingt Policies vor Projektionen, HTTP-/WS-Responses, Jobs, Assets oder KI-Kontext; keine Client-Rollen hochstufen.
- Alle Security Findings einschließlich Low/Info dokumentieren; keine NOT RUN-Prüfung als PASS verbuchen.

## Edge Cases

### Fall 1

- Gegeben: Die RPC-Liste get_world_map, save_world_map, ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map, list_world_places, list_world_place_map_links, upsert_world_place, upsert_world_place_map_link, create_world_node_with_maps, rename_world_node, reparent_world_node, duplicate_world_node, preview_world_node_consequences, archive_world_node_subtree, delete_world_node
- Wenn: Die implementierten Untertickets werden gegen das AST-Inventar abgeglichen
- Dann: Alle 17 RPCs sind genau einem dieser Untertickets zugeordnet: RPC-WORLD-MAP, RPC-ATLAS-MAPS, RPC-WORLD-PLACES, RPC-WORLD-CREATE, RPC-WORLD-RESTRUCTURE, RPC-WORLD-DESTRUCTIVE; kein RPC wird doppelt implementiert oder ausgelassen.
- Quelle: `.qa/intake/rpc-contracts/split-groups.json`

### Fall 2

- Gegeben: Abgeschlossene einzelne RPC-Ports
- Wenn: Die bereichsübergreifende Alt/Neu-Suite mit echter Persistenz läuft
- Dann: Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.
- Quelle: `.qa/intake/rpc-contracts/get_world_map.md`, `.qa/intake/rpc-contracts/save_world_map.md`, `.qa/intake/rpc-contracts/ensure_world_atlas_root.md`, `.qa/intake/rpc-contracts/list_world_atlas_maps.md`, `.qa/intake/rpc-contracts/get_world_atlas_map.md`, `.qa/intake/rpc-contracts/upsert_world_atlas_map.md`, `.qa/intake/rpc-contracts/list_world_places.md`, `.qa/intake/rpc-contracts/list_world_place_map_links.md`, `.qa/intake/rpc-contracts/upsert_world_place.md`, `.qa/intake/rpc-contracts/upsert_world_place_map_link.md`, `.qa/intake/rpc-contracts/create_world_node_with_maps.md`, `.qa/intake/rpc-contracts/rename_world_node.md`, `.qa/intake/rpc-contracts/reparent_world_node.md`, `.qa/intake/rpc-contracts/duplicate_world_node.md`, `.qa/intake/rpc-contracts/preview_world_node_consequences.md`, `.qa/intake/rpc-contracts/archive_world_node_subtree.md`, `.qa/intake/rpc-contracts/delete_world_node.md`

### Fall 3

- Gegeben: Ein offenes Unterticket oder fehlender DB-/Transportnachweis
- Wenn: Der Koordinator geschlossen werden soll
- Dann: Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.
- Quelle: `.qa/intake/rpc-contracts/split-groups.json`

## Required Tests

Individuell referenzierbare Binding-Tests (1:1 mit Intake `acceptance` / `assertions`). Öffentliche Acceptance-Checkboxen dürfen zusammenfassen; kein Pflichttest darf hier fehlen.

1. Alle 17 RPCs sind genau einem dieser Untertickets zugeordnet: RPC-WORLD-MAP, RPC-ATLAS-MAPS, RPC-WORLD-PLACES, RPC-WORLD-CREATE, RPC-WORLD-RESTRUCTURE, RPC-WORLD-DESTRUCTIVE; kein RPC wird doppelt implementiert oder ausgelassen.
2. Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.
3. Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.
4. Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance

- [ ] Alle 17 RPCs sind genau einem dieser Untertickets zugeordnet: RPC-WORLD-MAP, RPC-ATLAS-MAPS, RPC-WORLD-PLACES, RPC-WORLD-CREATE, RPC-WORLD-RESTRUCTURE, RPC-WORLD-DESTRUCTIVE; kein RPC wird doppelt implementiert oder ausgelassen.
- [ ] Signaturen, Rückgabeformen, Fehlertypen und Seiteneffekte stimmen pro sicherem Vertrag überein; alle ausgewiesenen Legacy-Sicherheitsdefekte besitzen einen separaten Denial-Regressionstest.
- [ ] Der Koordinator bleibt offen und sperrt Cutover; Dateiexistenz oder ein Quelltext-Fingerprint zählt nicht als implementierter Nachfolger.
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Acceptance tiers

| Tier | Owner / meaning |
| --- | --- |
| **SLICE DONE** | Isolated deliverable under `server/src/application/world-map/get_world_map/index.ts`, `server/src/application/world-map/save_world_map/index.ts`, `server/src/modules/world/index.ts` with Required Tests / Edge Cases PASS at this issue's acceptance tier. |
| **Acceptance tier** | `isolated-contract` — do not claim a higher tier from lower-tier evidence. |
| **Deferred integration** | none — later consumers must not silently assume host activation beyond this slice without their own evidence. |
| **FEATURE VERIFIED** | MIG-600/#845 (security parity) and MIG-602/#847 (host/DB/transport/browser integration); release cutover remains MIG-700/#849 + human approval. |
| **RELEASE APPROVED** | Explicit human approval only (production cutover / Supabase shutdown). Never implied by slice DONE. |

## Blockers

- Depends on #861 (RPC-WORLD-MAP)
- Depends on #862 (RPC-ATLAS-MAPS)
- Depends on #863 (RPC-WORLD-PLACES)
- Depends on #864 (RPC-WORLD-CREATE)
- Depends on #865 (RPC-WORLD-RESTRUCTURE)
- Depends on #866 (RPC-WORLD-DESTRUCTIVE)

Status: **waiting**. Ein CLOSED-Issue oder Source-Fingerprint ersetzt keine geprüfte Implementation-Acceptance.

## Runner

- Feature slug: `stack-migration-mig-350`
- Design: `.qa/design/migration-issues/stack-migration-mig-350.md`
- Status: waiting
- Reihenfolge: 42; Welle: 2
- Labels: `P1`, `migration-wave-2-api-realtime`, `migration-order-042`, `agent-blocked`, `waiting-dependency`
- Checks: `npm run test-gate`; dokumentierte Integration, Security, negative Canary-Tests und ECC vollständig.

## Design

`.qa/design/migration-issues/stack-migration-mig-350.md`

Source-Verifikation ist keine Implementierungsabnahme; der Owner hat die Produktarchitektur am 2026-10-23 verbindlich gewählt. Ausstehende technische Tests, echte Vorgängerbelege und Release-Gates bleiben separat verpflichtend. Keine produktive Migration oder Supabase-Abschaltung ohne eigene menschliche Freigabe.

## Verification state

- Source: source-verified
- Implementation acceptance: not-accepted
- Human architecture decision: GATE-01/02/03/04 für Implementierung vom Owner gewählt; GATE-05 Tauri-Ziel gewählt, Plattform- und Release-Abnahme offen.
- Current release approval: **NOT APPROVED** (production cutover and Supabase shutdown independently gated).


# Host modular monolith — binding architecture contract

> **Status:** Binding migration architecture for Epic #773 (NOT an ORM freigabe, NOT GATE-01 APPROVED).  
> **Anchors:** MIG-010/#789 (first technical enforcement), successors MIG-011/#790–MIG-013/#792 and functional ports that depend on them.  
> **Companion:** `docs/architektur-sqlite-based.md` (product invariants). This file binds the **host module shape**.  
> **Inventory sources:** `.qa/intake/edge-infra-contracts/inventory.json`, `src/domains/**`, `src/infrastructure/**`.

## 1. Target shape

SagaTree’s Node host is a **modular monolith**:

1. **Vertical use-cases** under `server/src/application/<use-case>/` (one migrated Edge/RPC operation family each).
2. **Domain modules** that own tables/repositories for one aggregate family.
3. **Shared domain/rules kernel** in existing `src/domains/**` and `src/domains/rules/**` (UI-/ORM-/HTTP-free) — reused, not duplicated.
4. **Central host wiring** at process start (`server/src/bootstrap`) that composes modules; modules do not self-boot via ambient globals.

ORM choice (GATE-01) selects the persistence adapter **inside** repositories. It does **not** replace this module contract. Import-boundary CI that bans direct Drizzle/client use from product layers is an **additional** requirement beside domain module-boundary checks.

## 2. Domain modules and responsibilities

| Module id | Owns (aggregates / tables family) | Public surface | Private |
| --- | --- | --- | --- |
| `identity` | Host accounts, sessions (Better Auth integration surface) | Actor resolution ports | Token stores, cookie crypto |
| `permissions` | Policy decisions (RLS successor) | `authorize(op, actor, resource)` | Policy tables, deny matrices |
| `world` | WorldProfile, atlas nodes/maps | World read/write use-case ports | Drizzle schema for world tables |
| `project` | Project/Saga membership, invites | Membership/project ports | Membership rows |
| `saga` | Saga definition/version | Saga ports | Saga persistence |
| `session` | Session, runtime state, events, recap | Session command/query ports | Runtime CAS, event log |
| `character` | Personal characters + session bindings | Character ports | Character rows |
| `inventory` | Item definitions/instances | Inventory ports | Inventory rows |
| `look` | Look references / analysis inputs | Look ports | Look rows |
| `media` | Asset metadata + storage keys | Media ports | Bytes via asset store adapter |
| `npc-creature` | NPCs / bestiary-facing entities | NPC ports | NPC rows |
| `marketplace` | Templates/listings | Marketplace ports | Marketplace rows |
| `rulesets` | Ruleset config projections | Ruleset ports | Ruleset rows |
| `ai` | Provider credentials, ollama prefs, AI context entries | AI credential/settings ports | Ciphertext, quota windows |
| `user-profile` | Profile fields | Profile ports | Profile rows |
| `ops` | Health, migrations journal, backup hooks | Host lifecycle ports | Process internals |

Frontend remains `#94`: `src/domains`, `src/infrastructure`, `src/app`, `src/shared`, `src/lib`. Host modules **consume** domain types/rules from `src/domains/**` via public barrels only.

## 3. Public module APIs vs private implementations

**Public (importable across modules):**

- `server/src/modules/<module>/index.ts` — ports, DTOs, error unions, factory types.
- `server/src/application/<use-case>/index.ts` — use-case entry (`execute` / `handle`) only.
- Shared kernel: `src/domains/<area>/index.ts` and `src/domains/rules/**` public barrels.

**Private (must not be imported across module boundaries):**

- `server/src/modules/<module>/internal/**`
- `server/src/modules/<module>/persistence/**` (Drizzle tables, raw SQL, mappers)
- Sibling files under `application/<use-case>/` other than `index.ts`
- Another module’s `repositories/` concrete classes

Composition root (`server/src/bootstrap/**`, `server/src/http/route-registry.ts`) may wire private constructors once at start.

## 4. Data / repository ownership

- Exactly **one** module owns each persisted aggregate family (see table above).
- Cross-module **writes** go through the owning module’s public use-case/port — never by importing foreign persistence.
- Cross-module **reads** of foreign data use the owning module’s **read port** (projection DTO). No shared mutable row objects across modules.
- Frontend `src/infrastructure/<area>` adapters talk to host HTTP/WS or, during migration, to Supabase; they do not import `server/**`.

## 5. Allowed module dependencies and cycle rules

**Allowed:**

- `application/*` → owning `modules/*` public API + `permissions` + `identity` (actor) + shared `src/domains/**`
- `modules/A` → `modules/permissions`, `modules/identity` (for actor/policy only)
- `modules/A` → read ports of `modules/B` when the inventory already couples those areas (recorded in the use-case)
- `http` / `bootstrap` → any public module/use-case factory
- All host code → `src/domains/**` / `src/domains/rules/**` (not React, not Supabase client)

**Forbidden:**

- Cycles among `server/src/modules/*` (DAG only; enforce in CI once `server/` lands)
- `src/domains/**` → `server/**`, React, Supabase, Drizzle
- `src/app/**` / `src/infrastructure/**` → `server/**` internals
- Product code → raw ORM/client (`drizzle-orm`, `better-sqlite3`, ZenStack client) outside owning `modules/*/persistence` (additional GATE-01 boundary; does not replace module checks)

## 6. Cross-module transactions and read paths

- **Single-module mutation:** one DB transaction inside the owning module.
- **Multi-module mutation:** started only from a named application use-case that lists participants; uses one host Unit-of-Work passed into each participating port; commit/rollback is atomic at the use-case boundary.
- **Read paths:** prefer owning read ports; join projections are assembled in the use-case, not via cross-module SQL joins in foreign persistence.
- **Idempotency / revision:** session/runtime CAS stays in `session`; callers pass `expectedRevision` / `idempotencyKey` through the use-case contract.

## 7. Central wiring at host start

`server/src/bootstrap` MUST:

1. Load config + data directory.
2. Open DB + run migration journal (`persistence`).
3. Construct persistence adapters for each module (ORM chosen by GATE-01).
4. Construct `permissions` + `identity` services.
5. Construct repositories → application use-cases → HTTP/WS adapters.
6. Register routes via `server/src/http/route-registry.ts` (successor of Edge `main` dispatcher).
7. Mark ready only after steps 1–6 succeed; shutdown rejects new mutations first.

No ambient service locator after ready. Tests may supply a test composition root with the same graph shape.

## 8. Migrated operations → use-cases (inventory map)

### Edge → `server/src/application/...`

| Edge function | Issue | Use-case / target |
| --- | --- | --- |
| `main` | #830 | `server/src/http/route-registry.ts` (dispatcher) |
| `ai-provider-credentials` | #818 | `application/ai-provider-credentials` (module `ai`) |
| `ollama-settings` | #818 | `application/ollama-settings` (module `ai`, co-owned) |
| `character-avatar-meshy` | #820 | `application/character-avatar-meshy` |
| `character-lore` | #821 | `application/character-lore` |
| `item-model3d` | #825 | `application/item-model3d` |
| `item-thumbnail` | #826 | `application/item-thumbnail` |
| `look-reference-analysis` | #828 | `application/look-reference-analysis` |
| `session-media-token` | #836 | `application/session-media-token` |
| `session-recap` | #837 | `application/session-recap` |
| Other Edge dirs | per ticket | Named `application/<function>` under owning module when activated; unmounted workers stay 404 until explicit freigabe |

### Infrastructure adapters → host modules

| Infra area | Issue | Host module / facade |
| --- | --- | --- |
| `world` | #812 | module `world` + MIG-012 repository port |
| `character` | #801 | module `character` |
| `inventory` | #802 | module `inventory` |
| `look` | #803 | module `look` |
| `session` | #810 | module `session` |
| `project` | #807 | module `project` |
| `saga` | #809 | module `saga` |
| `media` | #805 | module `media` |
| `ai` | #800 | module `ai` |
| `npc-creature` | #806 | module `npc-creature` |
| `marketplace` | #804 | module `marketplace` |
| `rulesets` | #808 | module `rulesets` |
| `user-profile` | #811 | module `user-profile` |

RPC child tickets map to use-cases under the same owning modules as their parent coordinator (world/session/character/inventory splits).

## 9. First technical enforcement (MIG-010 / #789)

MIG-010 acceptance includes:

1. `server/` package root registered in repository architecture rules.
2. Bootstrap composition root exists with explicit module wiring hooks (even if stubs).
3. Documented module DAG + ownership table above is the contract reviewers check.
4. **Effective module-boundary acceptance** (not a placeholder): `scripts/architecture-boundary-check.mjs` → `checkRegisteredHostPackages()` resolves imports relative to the importing file (and supported aliases), classifies module membership on the resolved target, rejects private cross-module `internal`/`persistence` access, rejects cycles among `server/src/modules/*`, and limits private wiring to documented composition entries (`server/src/bootstrap/**`, `server/src/http/route-registry.ts` only — not all of `server/src/http/**`). Executable regressions live in `scripts/architecture-boundary-check.self-test.mjs` and run via `npm run test-gate`. This is **in addition to** future Drizzle/client import bans from GATE-01 follow-ons.

GATE-01 APPROVED remains a separate human decision. Choosing Drizzle or ZenStack does not waive §§2–8.

### RPC path convention (binding for child tickets)

| Role | Path |
| --- | --- |
| Use-case entry (source of truth) | `server/src/application/<family>/<rpc_name>/index.ts` |
| Owning module public API | `server/src/modules/<module>/index.ts` |
| Transitional adapter (optional) | `server/src/application/commands/<rpc_name>.ts` — thin re-export of the use-case only; no new business logic |

Canonical split inventory: `.qa/intake/rpc-contracts/split-groups.json`.

## 10. Non-claims

- This contract does **not** approve GATE-01/02/03/04/05.
- This contract does **not** authorize runner activation or merge of PR #860.
- This contract does **not** claim production cutover or Supabase shutdown.

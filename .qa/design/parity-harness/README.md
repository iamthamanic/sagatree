# Executable baseline and parity boundaries (PREP-08 / #781)

**Status: executable PostgreSQL baseline and isolated real-service product runner.**
The baseline currently fails security/functional expectations. No GATE-01,
architecture, production migration or successor parity approval is implied.

## What executes

`scripts/stack-migration-db/run.mjs` provisions a real PostgreSQL 15.18 server,
loads pinned official Supabase role/auth/storage setup, then executes all 106
repository migration files unchanged. It seeds actual tables and tests actual
SQL functions, triggers, constraints, policies and role ACLs. A failed migration,
fixture or assertion exits nonzero and produces a structured report.

`scripts/stack-migration-db/product-run.mjs` additionally starts the official
GoTrue v2.143.0 and PostgREST v12.0.1 binaries, the product Vite app, and Chromium.
Its separate Playwright config runs three mandatory tests with real logins and
RPCs, including positive player rendering after a GM reveal. There are no route
mocks and no optional live skip. Read-only RPC success by itself is not marked as
a passing browser journey.

Setup, exact source pins, reproduction commands, exported catalog fields and
platform limitations are documented in `scripts/stack-migration-db/README.md`.
The dedicated workflow is `.github/workflows/stack-migration-baseline.yml`.

## Role fixture

| Actor | Authority in primary world/saga | Negative distinction |
| --- | --- | --- |
| `owner@migration.fixture.invalid` | World owner; world/node/map editor | No primary saga membership or GM authority |
| `gm@migration.fixture.invalid` | Primary project GM; session commands and saga reveal | Does not own or edit the bound world |
| `player1@migration.fixture.invalid` | Active primary player; own character/inventory | No GM secrets, no second-saga membership |
| `player2@migration.fixture.invalid` | Second active player; separate character/inventory | Independent concurrency and reveal witness |
| `outsider@migration.fixture.invalid` | Owner/GM of another world and saga | No primary world/project/session authority |
| `otherGm@migration.fixture.invalid` | GM of another saga bound to the primary world | Its party reveal must not grant primary players access |

The database still requires the primary owner for the project/world binding
trigger. The fixture supplies the owner's real claim while inserting that
binding; it never disables the trigger. Player grants are assigned through the
real `set_saga_member_bundle` RPC. Draft characters use the supported
`sheet_status='incomplete'` value, not a disabled completeness guard.

The canonical seed is `scripts/stack-migration-db/fixtures.mjs`. Stable IDs use an
`a7700000-...` namespace. All passwords are newly randomized and confined to the
local fixture. This synthetic pack covers the roles and data relationships needed
for the tests; it is not a complete export of production Dornhain/Donalu.

## Executed scenario mapping

| Contract | Executable assertion | Required outcome |
| --- | --- | --- |
| AUTH-01 | Real authenticated role/auth.uid; owner rename; distinct GM deny; owner session-command deny | Owner and GM remain separate |
| PAR-01 | Owner atlas catalog and GM NPC bindings | Owner private maps; GM hidden saga NPCs |
| PAR-02 | Two players call actual list/detail and NPC binding RPCs before reveal | No hidden map/title/NPC binding |
| PAR-03 | Foreign owner and missing-auth context call atlas RPC | SQLSTATE 42501 |
| ATLAS-REVEAL | GM calls `set_saga_binding_reveal`; both players list/fetch revealed map | Positive map result, secret layer absent, hidden child absent |
| PAR-04 | GM + two players concurrently submit the same expected revision | Exactly one commit; two 40001 conflicts; one event/revision increment |
| PAR-05 | Stale revision command | No state/event change |
| PAR-06 | Immediate retry and retry after a later command | Single application; late replay returns the current snapshot under existing SQL behavior |
| IDEMPOTENCY-SESSION | Same key in two real sessions | Independent application per session |
| ATOMIC-ROLLBACK | Actual event-insert trigger raises an exception | No partial state/revision/event write |
| CRASH-ATOMIC | Execute command inside an open transaction, SIGKILL PostgreSQL before COMMIT, recover | Uncommitted event and state absent |
| PAR-07 | Capture state and RPC snapshot, stop/start PostgreSQL, reconnect | Exact durable snapshot/revision |
| PAR-08-DICE | Actual player roll with forged result fields | Server-owned roll and restart durability; currently blocked by source defect |
| PAR-08-COMBAT | Real GM start and nextTurn commands, then process restart | Participants/turn and projected snapshot durable |
| PAR-09 | Authenticated UPDATE of own and second player's inventory | One own row; zero foreign rows |
| PAR-10 | Actual foreign-owner `world_profiles` RLS read | Zero rows; deliberately opened policy must make assertion fail |

Additional strict negative tests cover direct raw atlas table access, cross-saga
projection, legacy pin redaction, ambiguous recap overload, foreign leave, and
public definer-helper writes under both `anon` and `authenticated` roles. They
assert the secure result and remain red when the source is insecure. They do not
encode unsafe behavior as acceptable successor parity.

## Confirmed baseline defects

Reproduce with `npm test --prefix scripts/stack-migration-db`. The suite continues
after an assertion failure to collect independent failures, then exits nonzero.

| Severity | Probe | Actual baseline failure and source evidence |
| --- | --- | --- |
| Critical | BASELINE-SEC-EVENT-HELPER-ANON | `anon` invokes `append_session_event` for a foreign session and forged actor; inserted row is read back before test rollback. Effective default ACL grants `anon` even after REVOKE PUBLIC. Helper body: migration 041. |
| Critical | BASELINE-SEC-ADVENTURE-HELPER-ANON | `anon` invokes `sagatree_resolve_adventure_command` with caller-supplied `p_is_gm=true` and persists a project flag; readback proves the write before rollback. Effective body originates in 050 and rename/body rewrite 073/079/085. |
| High | BASELINE-SEC-EVENT-HELPER-AUTHENTICATED | Foreign authenticated owner can forge events through the same definer helper. |
| High | BASELINE-SEC-ADVENTURE-HELPER-AUTHENTICATED | Foreign authenticated owner can write GM project state through the same helper. |
| High | BASELINE-SEC-CROSS-SAGA | Player in saga A obtains map/title revealed only in saga B by supplying B's public ID. `atlas_wb_resolve_saga_project` in migration 105 checks world+public ID but no B membership. |
| High | BASELINE-SEC-LEGACY-MAP | `get_world_map(world,false)` returns undiscovered pins to a player while true redacts them; migration 068 trusts the presentation flag. |
| High | BASELINE-SEC-FOREIGN-LEAVE | `leave_play_session` increments another session's revision and appends a leave event without membership; migration 041. |
| Medium | PAR-08-DICE | Player roll raises `record "v_character" has no field "user_id"`; resolver in migration 042 references a field absent from `characters` (the actual column is `owner_user_id`). |
| Medium | BASELINE-RPC-RECAP-OVERLOAD | Two-argument recap call raises SQLSTATE 42725: migration 062 retains a two-argument wrapper and a defaulted three-argument overload. |
| Info | Source-chain provenance | `scripts/apply-migrations.sh` omits 080 item thumbnails, 082 full pregen sheets, and 108 Atlas migration apply; this harness explicitly runs all 106 source files. |

These are reproduced against an isolated full source chain, not proof of an
exposed production installation. The actual catalog records role ACLs so a
specific deployed baseline can later be compared without guessing its grants.
Security corrections require an explicit product change, regression tests and
review. This preparation does not silently modify any product SQL.

### Actual Atlas product blockers

The real-service browser run executes three tests: one passes (foreign-owner
REST/UI deny), two fail. The owner does load actual map data, mount WebGL, open
the real navigation, rename a canonical place through the UI/RPC, and verify the
saved name after reload. Its final tools assertion remains red. Both players
authenticate separately, both receive hidden-map denial before reveal, and both
fetch the revealed map successfully through real PostgREST; the subsequent
positive product rendering assertion remains red.

| Severity | Product blocker | Source and observed evidence |
| --- | --- | --- |
| High | Revealed map never renders for a player | `WorldAtlasWorkbench.tsx` passes `sagaPublicId` to place navigation but omits it from `useWorldAtlasEditor`. That hook calls `listMaps(id)` without options and fetches details without saga context. The real RPC with explicit saga context returns the map; the product request with null saga context returns an empty list. |
| Medium | Pointer access to Tools is obstructed | The default desktop click on the `Werkzeuge` fold button is intercepted by the `Zur Draufsicht wechseln` overlay in `UnifiedAtlasEditor.tsx`; the trace records repeated pointer interception. The harness keeps the assertion red and does not use forced clicks or DOM mutation. |
| Info | Trace renderer warnings | Pinned Playwright 1.55.1 reports `Internal error: step id not found` for some manually created browser contexts. Structured test results, failure screenshots and actual REST network bodies are still recorded. This is a tooling limitation, not a passed product gate. |

The captured PostgREST 12.0.1 mapping is also explicit: missing hidden map raises
SQLSTATE `P0002` as **HTTP 500**; foreign-world `42501` returns **HTTP 403**. No
fictional `P0002` to 404 mapping is used. Sanitized transport observations contain
the actual request, authenticated synthetic actor, HTTP status and response body.

## Canary and CI semantics

`npm run canary --prefix scripts/stack-migration-db` runs clean and mutated fresh
clusters. It requires exactly one `PAR-10` assertion in each run: clean exit 0,
mutant exit 1 caused by the opened policy, no setup/cleanup failure. The controlled
mutation is a real extra policy:

```sql
CREATE POLICY baseline_intentional_allow
  ON public.world_profiles FOR SELECT TO authenticated USING (true);
```

A green canary means the test can detect this permission regression. It does not
mean the baseline security suite or Atlas product suite passes. The dedicated
workflow runs those jobs separately and does not hide their failures with
`continue-on-error`. Its existence does not configure repository branch
protection; a reviewed required-check setting remains a separate governance fact.

## Remaining evidence boundaries

- SQL role simulation uses the official `auth.uid()` functions but does not alone
  prove GoTrue, JWT validation, PostgREST, browser transport or UI rendering.
- The isolated product suite provides that additional path for its three defined
  scenarios. All other Atlas #770 CRUD/import/export/editor/reveal operations
  still need their own product assertions; these three do not close all of #770.
- The browser stack does not include Realtime, Edge services or Storage HTTP.
  Storage schema is loaded because repository migrations depend on it.
- PostgreSQL 15.18 is not a byte-identical Supabase operating-system image.
- Future SQLite host policy, atomic events, reconnect transport and migrations
  need a real successor implementation before cross-stack parity can be proved.
- GATE-01 is still a design decision boundary. Running the existing SQL baseline
  does not depend on authorizing a different ORM or host architecture.

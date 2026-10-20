# Atlas Live E2E — Migration Cutover Gate (#770 / PREP-02 #775)

> **Status:** SPEC / CI NOT YET ENABLED  
> **GitHub:** [#770](https://github.com/iamthamanic/sagatree/issues/770) (do not duplicate)  
> **Parent Epic:** [#773](https://github.com/iamthamanic/sagatree/issues/773)  
> **Baseline:** `0b82bb23` (post PR #771)

## 1. Binding rule

**MIG-700 (cutover) and MIG-702 (Supabase shutdown) MUST NOT become agent-ready or merge-eligible while #770 is OPEN or while its required CI job has not proven a green live run against an isolated test database.**

Contract mocks (`E2E_ATLAS_PRODUCT` unset / Playwright route stubs), `test.skip` on the live journey, and DOM-only assertions are **not** release proof for migration cutover. Optional live mode is forbidden as cutover evidence.

Local draft id: `ATLAS-LIVE-E2E` in `.qa/intake/local-first-stack-migration-issues.json`.

## 2. What “mandatory live” means

| Requirement | Contract |
| --- | --- |
| Path | Authenticated GM → product default-3D (`AtlasNative3dEditor`, `demoSeed=false`) → player-visible outcomes |
| Nav | DB-backed tree (`data-atlas-nav-source=db`); no demo SoT |
| Tools | Registry chrome (`#tools[data-atlas-tool-source=registry]`) |
| Persist | Create/edit map or place via real RPCs; reload proves DB state |
| Player view | Second identity cannot see GM-only / unrevealed maps/titles |
| Cross-owner | Third identity denied at API/DB (401/empty), not only UI hide |
| Regression | Temporary intentional fail makes the **required** job red; then revert |
| Production | No production Donalu writes; `PRODUCTION_GATE.md` remains NOT migrated |

## 3. Isolated test database (required)

| Decision | Spec |
| --- | --- |
| Kind | Ephemeral Postgres compatible with current Supabase schema **or** dedicated CI Supabase project used **only** for E2E |
| Seed | Synthetic WO-/fixture world (may mirror Donalu shape; must not be prod clone credentials) |
| Identities | Owner/GM, Player A, Player B, Cross-owner C (distinct JWT subjects) |
| Secrets | Repo secrets named for **test** stack only, e.g. `E2E_ATLAS_SUPABASE_URL`, `E2E_ATLAS_SUPABASE_ANON_KEY`, service role **only if** seed job is server-side and never exposed to browser |
| Forbidden | Production URL/keys; writing to owner prod Donalu; deleting legacy worlds as cleanup |

## 4. CI job shape (to implement under #770)

Proposed job name: `Atlas Live Product E2E` in `.github/workflows/verify.yml` (or sibling workflow).

```text
needs: test-gate
if: secrets present OR explicit workflow_dispatch with test stack
env:
  E2E_ATLAS_PRODUCT=1
  VITE_SUPABASE_URL=<test>
  VITE_SUPABASE_ANON_KEY=<test>
steps:
  - provision/seed isolated DB (or assume always-on test project + reset seed)
  - playwright: e2e/atlas-followup-product-e2e-gate.spec.ts (live tests NOT skipped)
  - assert DB rows via service seed script or REST with auth (not only DOM)
  - upload evidence under .qa/evidence/atlas-followup-real-product-e2e/live/
```

**Required for cutover:** job is **required** on `main` / release PRs once secrets freigabe lands. Until then, cutover issues stay blocked.

## 5. BLOCKED / NEEDS DECISION (do not invent)

| ID | Decision needed | Recommendation (non-binding) |
| --- | --- | --- |
| ATLAS-CI-01 | Isolated CI DB: ephemeral docker-supabase in Actions vs always-on test project | Prefer always-on **test** project with reset seed for speed; document restore |
| ATLAS-CI-02 | Which secrets names + who rotates them | Separate from prod; never reuse `VITE_SUPABASE_*` prod values |
| ATLAS-CI-03 | Make job required in branch protection before/after first green | After one proven green live run on `main` |
| ATLAS-CI-04 | Seed ownership of WO-9FFK6-like fixture vs new synthetic WO- | New synthetic public id avoids prod collision |

Until ATLAS-CI-01..03 are human-approved, **#770 remains OPEN** and migration cutover remains blocked. Prep issue #775 can still merge as **specification + dependency wiring**.

## 6. Evidence of wiring (this PREP)

- Intake: `ATLAS-LIVE-E2E.githubIssue = 770`
- Cutover: `MIG-700` / `MIG-702` `dependsOn` includes `ATLAS-LIVE-E2E`
- Check: `scripts/stack-migration-prep-check.mjs` fails if those deps are removed
- Design lock §5 points here
- No second GitHub issue created for the same gap

## 7. Explicit non-acceptance

- Closing #770 by setting `E2E_ATLAS_PRODUCT=1` only on a laptop  
- Green Browser E2E that skips the live test  
- Contract-mode `data-atlas-nav-source=db` alone  
- Marker files / screenshots without DB assertions  

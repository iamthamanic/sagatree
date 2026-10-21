# ECC Check — ai-organize / AI tabs UX

- Date: 2026-10-12
- Scope: Settings → AI (Organize Ollama + shared list UX for Bild/3D/Video/Audio)
- Base HEAD: d70318c35564c71a9a9be088f9a7453db08beee0
- Worktree: uncommitted AI-tab files (+ gate script fix)

## Verdict: READY (with ops note)

Edge Function `ollama-settings` must be deployed for Organize happy-path against live API (local POST via app proxy returned 404 in this session). Code + unit/SSRF gates are green.

## Phase A (@test-gate)

- Depth: standard
- Result: **PASS** (`npm run test-gate`, exit 0)
- Fixes applied in loop:
  1. Removed `eslint-disable` in `OllamaOrganizeEditDialog` (open-edge ref)
  2. Updated `scripts/ai-provider-credentials-check.mjs` for list+edit-dialog UX (`Seit` / dialog)
  3. Fixed Organize infinite loading when `get()` fails (`!settings` error state)

| Check | Result |
|-------|--------|
| lint / typed-strict (changed TS) | PASS |
| typecheck | PASS |
| build | PASS |
| ai-provider-credentials-check | PASS |
| secrets diff | PASS |
| deno `ollama-url-policy_test.ts` | PASS (9/9) |
| secureByDefault B-10 RG (scoped) | PASS |

## Phase B (@verify-ticket)

- Acceptance: `.qa/acceptance/ai-organize-ollama-settings.md`
- Result: **PASS** (code matches Intent; UI evidence prior session + static structure)
- Gaps: browser happy-path blocked this session by login/edge 404 — see Phase E

## Phase B2 (composition-gate)

- Verdict: **CLEAR**
- Proof: `.qa/runs/composition-gate-ai-organize-ollama-settings.md` (WORKTREE)
- Cardinality: one `(user_id, provider_id=ollama)` row; Lore/Recap/ai-gm share resolve

## Phase C (@review-ticket)

- Verdict: **ACCEPT**
- Critical/Important: none open after loading-state fix
- Minor: Edit dialog URL input still uses `font-mono` (list meta already sans like Bild)

## Phase D (AgentShield)

- Findings: 0 critical, 0 high (1 medium prompt-defense in `.claude/CLAUDE.md` — out of ticket scope)
- Result: **PASS** for ship gate

## Phase E (guidelines + verify-ui)

### Web Interface Guidelines + AU

```text
## AiProviderListUx.tsx / panels
✓ pass — search labeled; Edit aria-label; min-h-11; truncate + min-w-0; empty/error states
AU: AU-02 touch OK; AU-CONTENT-WIDTH min-w-0 OK; AU-09 loading/empty/error OK
```

### verify-ui

- Verdict: **PARTIAL**
- Observed: AI subtabs Organize/Bild/3D/Video/Audio present after auth
- Blockers this run: session expired → re-login failed against local auth; `POST /functions/v1/ollama-settings` → 404 (function not on gateway)
- Prior user screenshots confirm list+meta UX (sans fonts aligned) when edge was reachable
- Evidence dir: screenshots not re-captured this run (auth/edge)

## Phase E2 (memory-live-doc)

- skipped (no checkpoint apply requested; material but docs already in `.qa/acceptance` + composition proof)

## Ship

Ready for: `@commit-pr-safe` / `@commit-push-safe` on **AI-tab files only** (exclude liveact evidence noise / `.env.minimal-proof`).

Ops before prod Organize: deploy `supabase/functions/ollama-settings` + ensure `CREDENTIALS_ENCRYPTION_KEY`.

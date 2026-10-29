# Acceptance — MIG-405 Character-Lore Host Port (#821)

## Intent
Port allowlisted Edge `character-lore` contracts onto the host as an isolated use-case surface under `server/src/application/character-lore/`. Edge remains the live mount; no public activation or production cutover.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host HTTP adapters + MIG-600/#845 + MIG-602/#847. `CHARACTER_LORE_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Preconditions
- Actor authenticated (host Actor / userId).
- Optional projectId / worldId fixtures injected via ports (no live Supabase required for isolated tests).
- Provider config injectable; persistent rate-limit store available or explicitly unavailable.

## Happy Path
1. Owner direct-world request and active member request to GM-owned project world generate a draft story (status ok, story 1..12000).
2. No `characters` row is mutated (draft-only side effect).
3. Provider absence → HTTP-equivalent 200 `not-configured` before lore lookup / provider call.

## Edge Cases / Required Tests
- [x] Owner direct-world + active member → GM project world generate; unrelated private-world and mismatched project/world fail before provider context inclusion.
- [x] 128001-byte body rejected; parser truncates/clamps documented fields; rejects ruleset/UUID enum violations.
- [x] Provider absence → not-configured; draft output only; no characters mutation.
- [x] Seventh request in default window → 429; missing persistent store → 503 before provider use.
- [x] Generated story nonempty and ≤12000; errors never return provider/API secrets.
- [x] Legacy: reference-authorization denials use generic 500, not 403 (preserve documented defect).
- [x] Touched files: zero type escape hatches.
- [x] `scripts/mig-405-character-lore.self-test.mjs` → PASS

## Security Coverage
- B-01 / SC-01: project GM or active membership; world lore only if public or creator matches reference owner (project GM / caller).
- B-04 / SC-02: body size + field clamps + UUID/ruleset whitelist server-side.
- SC-03: rate limit (default 6/min, env capped 60) before provider.
- SC-06: provider keys stay server-side; error payloads strip secrets.
- Out of scope: production cutover, host HTTP mount (MIG-600).

## Launch Checklist (SC)
N/A — not a launch ticket; inline SC-01/02/03/06 only.

## Evidence
`node --experimental-strip-types scripts/mig-405-character-lore.self-test.mjs` → PASS.
`node scripts/architecture-boundary-check.mjs` → PASS.

## Implementation Notes
Isolated host ports under `server/src/modules/character/internal/character-lore.ts` + application use-cases; Edge allowlist unchanged; no `create-app` mount.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-405.md` (CLEAR).

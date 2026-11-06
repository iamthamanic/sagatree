# Acceptance — CUT-18 Activate existing Meshy avatar generation (#1153)

## Intent
Avatar Meshy prompt/job poll/retry works via Host Character/AI ports. Soft-DENY removed when host library is on. Without Meshy: typed `not-configured` for start; config still works. Mock Meshy advances create→poll→durable AssetPorts GLB.

## Preconditions
- Better Auth session (or solo loopback).
- Optional: Meshy credentials / `MESHY_*` / `CHARACTER_AVATAR_MESHY_MOCK` for generate.

## Happy Path
1. `config` → meshyConfigured + prompt/image limits.
2. `start` (mock on) → jobId generating.
3. `poll` → succeeded + `modelUrl` under `/api/v1/assets/…`.
4. Idempotent `start` replay; foreign poll/sign denied.

## Edge Cases
- No Meshy → start `not-configured`
- Short/invalid prompt / nonce → 400
- Foreign job → 404
- Rate limit → 429
- Stranger storage path → 403

## Security Coverage
- Actor from Better Auth; jobs owner-scoped.
- Secrets server-only; durable AssetPorts URLs.
- SC-01/02/03/06 inline; not a launch ticket.

## UI/UX
Existing AvatarMeshyPanel and loading overlay unchanged.

## Evidence
- `scripts/cut-18-meshy-avatar.self-test.mjs`
- `scripts/mig-404-character-avatar-meshy.self-test.mjs` — activation true
- Matrix avatar-meshy.* → HOST_VERIFIED

## Composition Gate
CLEAR — see `.qa/runs/composition-gate-cut-18-activate-existing-meshy-avatar.md`.

## Implementation Notes
- Action POST `/api/v1/ai/character-avatar-meshy`.
- Soft-DENY removed; Edge retained until CUT-20.
- Mock-only fixture generate; live Meshy adapter gated.
- BYOK via `ai.listCredentials` meshy configured.

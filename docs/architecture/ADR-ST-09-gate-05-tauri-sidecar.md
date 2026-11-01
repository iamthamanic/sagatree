# ADR-ST-09 — GATE-05: Tauri + Node sidecar desktop packaging

- **Status:** Accepted
- **Date:** 2026-11-01
- **Issue:** [#788](https://github.com/iamthamanic/sagatree/issues/788)
- **Human source:** https://github.com/iamthamanic/sagatree/issues/788#issuecomment-6560366900
- **Decision text:** `GATE-05: APPROVED — PoC accepted, Variant A Tauri+sidecar; MIG-703 unlocked; no product ship without further RELEASE`
- **Release note:** [migration-owner-release-2026-11-01-gate-05-approved.md](./migration-owner-release-2026-11-01-gate-05-approved.md)

## Context

Epic #773 requires a desktop packaging path after browser-host waves. GATE-05 compared:

| ID | Approach |
| --- | --- |
| A | **Tauri** shell + Node/sidecar host (same `server/` binary contract as Docker/VPS) |
| B | **Electron** with embedded or sibling host |

Owner selected Variant A as target on 2026-10-23. Freigabe A (2026-11-01 morning) set `APPROVED_TO_EXECUTE` for the PoC. PoC fixture PASS is under `.qa/evidence/stack-migration-prep/pocs/gate-05` (`scripts/stack-migration-pocs/gate-05/check.mjs`). Afternoon owner chat accepted the PoC as technology **APPROVED**.

## Decision

**Adopt Variant A:** Tauri shell + Node sidecar hosting the same host binary profile as the browser/VPS Node host. Electron remains fallback only on documented mandatory-criterion failure.

## Consequences

### Unblocked

- **MIG-703 / #852** — Tauri integration on the finished browser host (`desktop/`, `docs/ops/desktop/`) may proceed under this APPROVED.

### Binding

1. Sidecar/host remains the policy-enforcing Node process; renderer must not hold service-role secrets or raw DB paths.
2. Loopback / local-instance scoping for desktop bridge privileges.
3. Unexecuted platforms from the PoC host (linux/win32 NOT RUN) stay open qualification points before any product ship.

### Not approved by this ADR

- Desktop **product ship**, store release, or end-user binary distribution
- Claiming NOT RUN OS packaging as shipped
- Electron as default
- Production cutover / Supabase shutdown (already covered by Dornhain Freigabe A / MIG-700..702)

## Evidence

- Gate design: `.qa/design/gates/GATE-05-tauri-packaging.md`
- PoC: `.qa/evidence/stack-migration-prep/pocs/gate-05`
- Approvals register: `.qa/evidence/stack-migration-prep/architecture-approvals.json` → `decisions.GATE-05.status = APPROVED`

# Owner RELEASE — Desktop Product/Store (2026-11-01)

**Actor:** Repository owner (`iamthamanic`), explicit chat decision 2026-11-01 evening.  
**Transcribed by:** agent under owner instruction (not agent-selected scope).  
**GitHub anchor:** [#852](https://github.com/iamthamanic/sagatree/issues/852#issuecomment-6565086038).

## Decision

**`releases.DESKTOP-PRODUCT-STORE.status = APPROVED`**

Authorizes product/store distribution of the GATE-05 Variant A path
(**Tauri + Node sidecar**) after MIG-703 isolated-contract completion.

This RELEASE is **explicitly separate** from:

- GATE-05 PoC / technology APPROVED
- MIG-703 integration scaffold

Owner instruction: *Product/Store RELEASE (Desktop) — explizit nicht mit
MIG-703/GATE-05 mitgemeint.*

## What this does approve

1. Proceed with desktop packaging, signing, and store/channel upload ops
   under `desktop/` + `docs/ops/desktop/`.
2. Treat store distribution as an authorized product act (not blocked by
   GATE-05 `doesNotApprove` for ship — those remain “not approved by GATE-05”).

## What this does **not** invent by silence

- Apple / Microsoft / other store listings already published
- Certificates, notarization, or CI binary artifacts already present
- Claiming linux/win32 as shipped when lifecycle evidence is NOT RUN

Packaging/signing/upload remain ops follow-through under this RELEASE.

## Binding paths

- Approvals: `.qa/evidence/stack-migration-prep/architecture-approvals.json`
- ADR: `docs/architecture/ADR-ST-09-gate-05-tauri-sidecar.md`
- Ops: `docs/ops/desktop/README.md`
- Preconditions: GATE-05 APPROVED, MIG-703 DONE

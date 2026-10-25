# Feature: P2: MIG-501 Completion-Evidence gegen tatsächliche Testabnahme validieren

## Intent
Evidence-Validator weist widersprüchliche oder nur gehashte, ungeprüfte Acceptance-Nachweise zurück.

## Acceptance
- [x] #935-Repro: PASS mit unchecked Required Tests → Validator FAIL
- [x] Evidence bindet command/result/artifact/hash; NOT RUN ≠ PASS
- [x] MIG-501 Acceptance + completion evidence nach Re-Test #938/#939 konsistent
- [x] `npm run check:stack-migration-prep` + Negativtests
- [x] Touched files: zero type escape hatches

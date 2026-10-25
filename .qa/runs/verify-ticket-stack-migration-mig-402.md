# Verify — stack-migration-mig-402
Issue: #818
Command: node --experimental-strip-types scripts/mig-402-ai-provider-credentials.self-test.mjs → PASS
Notes: Required Tests 1–12; list DB errors → 500; refresh persist failure → 500 persist_failed (not silent legacy ignore).

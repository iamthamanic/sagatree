# Dual fixture rebuild — MIG-001 Fall 2

Executed: 2026-10-21.

Two independent embedded PostgreSQL clusters applied the same 106 repository migrations and `fixtures.mjs` seed. Semantic fingerprints matched:

- SHA-256: `0a4295dbd16f61977ddb0eb282c5630d36df99de9371bfdc28fd3c2b5b99141d`
- Report: `rebuild-verify.json`
- Command: `npm run rebuild-verify --prefix scripts/stack-migration-db`

`securityParityApproved` remains false. This proves fixture reproducibility for Alt/Neu comparison, not secure successor parity.

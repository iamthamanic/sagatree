# Cutover ops (MIG-700+)

Owner RELEASE (2026-11-01): Dornhain pilot — see
`docs/architecture/migration-owner-release-2026-11-01-dornhain.md`.

## Order

1. **MIG-700 drill** — Freeze → single writer → import → Rollback (`server/src/migration/cutover`)
2. **MIG-701** — reading parity window (fixture/staging) — [`parity-window/`](./parity-window/)
3. **MIG-702** — Supabase shutdown readiness after Dornhain host proof — [`shutdown/`](./shutdown/)

## Hard requirement

Dornhain world, adventure/saga, characters, default items, monsters, and NPCs must be
present after import. Other user data may be omitted.

## Local proof

```bash
node --experimental-strip-types scripts/mig-700-dornhain-cutover-drill.self-test.mjs
node --experimental-strip-types scripts/mig-701-parity-window.self-test.mjs
node --experimental-strip-types scripts/mig-702-shutdown-readiness.self-test.mjs
```

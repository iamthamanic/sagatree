# Production gate — Donalu backfill (#754)

- Staging apply on local clone: **done** (2026-10-20T08:19:27.708Z).
- World: `WO-9FFK6` / `8f52b273-60fe-4823-ae7d-d9e70469b730`.
- Production: **NOT migrated**.
- To migrate production later: written operator approval +
  `node scripts/atlas-worldbuilder-migration-apply.mjs --target=production --allow-production --world=WO-9FFK6`
  against the production DB only after backup verification.
- Gate table defaults remain `enabled=false` for worlds not explicitly enabled.

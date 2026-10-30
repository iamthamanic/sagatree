# Acceptance — MIG-302 Character Host Adapters (#801)

## Intent
Port `src/infrastructure/character` persistence callers onto approved host repository ports while Supabase remains the live default (no production cutover). Creator/VRM/LiveAct rendering utilities stay browser-side.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
MIG-602/#847 feature E2E cutover; FEATURE VERIFIED → MIG-311/#810 + MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] Create/read/edit/delete own complete/draft character and reload; foreign owner and cross-owner FK writes denied.
- [x] Portrait/avatar upload, generation,poll/export and lore draft retain full shapes; creator rendering utilities are not moved to server merely because under infrastructure.
- [x] Presets/public catalog reads are preserved with current RLS; generated artifacts cannot resolve a foreign owner path.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `scripts/mig-302-character-adapter.self-test.mjs` → PASS

## Security Coverage
- Owner-scoped characters: host ports DENY foreign actor get/update/delete (B-01 / SC-01).
- No client-claimed owner elevation; actor id is verified host actor only (B-07/B-08).
- Portrait/artifact storage paths must be `{ownerUserId}/…` — foreign paths DENY (SC-02).
- Soft-delete hides rows from owner list/get; strangers never see foreign sheets.
- Launch SC-01…SC-07: N/A — not a launch ticket; inline SC-01/SC-02/SC-03 covered above.

## Evidence
`node --experimental-strip-types scripts/mig-302-character-adapter.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-302.md`.

## Implementation Notes
- Host migration `0026_character_sheet_infra.sql` + TABLE_OWNERSHIP `character_presets` / `character_avatar_artifacts` → character module.
- `createCharacterPorts` extended with sheet CRUD / presets / artifact resolve; wired in `create-host`.
- FE dual-path seam: `host-character-ports.contract.ts` + `createHostCharacterAdapter` (Supabase character-service default unchanged).
- No HTTP mount (`CHARACTER_INFRA_PUBLIC_ACTIVATION_AUTHORIZED = false`); meshy/lore Edge remain allowlisted/quarantined as before.

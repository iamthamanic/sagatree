# Verify — stack-migration-mig-406
Issue: #822
Command: node --experimental-strip-types scripts/mig-406-characters-quarantine.self-test.mjs → PASS
Notes: Required Tests 1–6; dispatcher/host unmounted; PUT ownerId overwrite; body.characterId level-up; non-advancing XP loop source+guarded fixture; client ownerId without auth.

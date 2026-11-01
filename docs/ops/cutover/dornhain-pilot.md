# Dornhain pilot cutover

## Scope

| In | Out |
| --- | --- |
| Dornhain world + saga `dornhain.whisper` | Unrelated tenant/user worlds |
| Pregen characters | Disposable accounts |
| Default items / monsters / NPCs | Production wipe without restore proof |

## Drill phases

1. **Freeze** — export signed host bundle + Dornhain catalog sidecar (single writer = source owner)
2. **Authority switch** — import onto empty host as restore owner
3. **Verify** — catalog presence (world title, saga slug, character/monster/item/npc ids)
4. **Rollback** — re-import freeze onto clean poison host after deliberate corruption

## Shutdown gate

Supabase may be shut down only when this drill (or successor staging evidence) is green
and linked from MIG-702 completionEvidence.

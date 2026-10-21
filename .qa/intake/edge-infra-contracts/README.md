# Edge and infrastructure contracts (PREP-05 #778)

**24 Edge entries = 8 allowlisted workers + 15 unmounted workers + 1 dispatcher. 13 infrastructure areas. 57 distinct called RPC names.**

Status is **SPEC with current-branch source verification**. This is neither live-backend evidence nor a passed successor parity suite. GATE-01/02/03/04/05 statuses are unchanged.

## Reproduce and review

Run `node scripts/stack-migration-edge-source-contracts.mjs` and `node scripts/stack-migration-edge-contracts.mjs` to check snapshots/rendering. A deliberate reviewed update uses `--write` on the source extractor, edits `semantics.json`, then uses `--write` on the renderer. Both default commands fail on drift. Source code is parsed, never executed.

`inventory.json` is schema v2. Each contract contains source SHA-256 paths, exact AST snapshot reference/hash, its own acceptance/negative tests and implementation issue. RPC primary binding comes from `../rpc-contracts/split-groups.json`, which is an exclusive 57-name partition.

Every source snapshot includes complete operation branches/types/helper bodies; infrastructure snapshots include full query chains, caller argument objects, decoders/error handling and imported type declarations. Dynamic finite RPC unions and class-field table constants are resolved. Auth, storage and realtime are separate from table counts.

## Edge entries

| Contract | Exposure | Implementation | Client caller files | Quota |
|---|---|---|---|---|
| [ai-gm](edge-ai-gm.md) | legacy-unmounted | #817 | 0 | persistent-rpc 12/60s |
| [ai-provider-credentials](edge-ai-provider-credentials.md) | allowlisted-worker | #818 | 1 | persistent-rpc 8/60s |
| [bestiary](edge-bestiary.md) | legacy-unmounted | #819 | 0 | none |
| [character-avatar-meshy](edge-character-avatar-meshy.md) | allowlisted-worker | #820 | 1 | process-memory 2/60s |
| [character-lore](edge-character-lore.md) | allowlisted-worker | #821 | 1 | persistent-rpc 6/60s |
| [characters](edge-characters.md) | legacy-unmounted | #822 | 0 | none |
| [dm-tools](edge-dm-tools.md) | legacy-unmounted | #823 | 0 | none |
| [export](edge-export.md) | legacy-unmounted | #824 | 0 | none |
| [item-model3d](edge-item-model3d.md) | allowlisted-worker | #825 | 1 | persistent-rpc 2/60s |
| [item-thumbnail](edge-item-thumbnail.md) | allowlisted-worker | #826 | 1 | persistent-rpc 4/60s |
| [items](edge-items.md) | legacy-unmounted | #827 | 0 | none |
| [look-reference-analysis](edge-look-reference-analysis.md) | allowlisted-worker | #828 | 1 | process-memory 4/60s |
| [lorekeeper](edge-lorekeeper.md) | legacy-unmounted | #829 | 0 | none |
| [main](edge-main.md) | dispatcher | #830 | 0 | none |
| [marketplace](edge-marketplace.md) | legacy-unmounted | #831 | 0 | none |
| [media](edge-media.md) | legacy-unmounted | #832 | 0 | none |
| [npcs](edge-npcs.md) | legacy-unmounted | #833 | 0 | none |
| [quests](edge-quests.md) | legacy-unmounted | #834 | 0 | none |
| [rulesets](edge-rulesets.md) | legacy-unmounted | #835 | 0 | none |
| [session-media-token](edge-session-media-token.md) | allowlisted-worker | #836 | 1 | none |
| [session-recap](edge-session-recap.md) | allowlisted-worker | #837 | 1 | persistent-rpc 6/60s |
| [sessions](edge-sessions.md) | legacy-unmounted | #838 | 0 | none |
| [spellbook](edge-spellbook.md) | legacy-unmounted | #839 | 0 | none |
| [world](edge-world.md) | legacy-unmounted | #840 | 0 | none |

## Infrastructure areas

| Contract | RPCs | Tables | Storage buckets | Edge names | Implementation |
|---|---|---|---|---|---|
| [ai](infra-ai.md) | 0 | 0 | 0 | 1 | #800 |
| [character](infra-character.md) | 0 | 9 | 2 | 2 | #801 |
| [inventory](infra-inventory.md) | 0 | 5 | 0 | 2 | #802 |
| [look](infra-look.md) | 0 | 2 | 0 | 1 | #803 |
| [marketplace](infra-marketplace.md) | 1 | 1 | 0 | 0 | #804 |
| [media](infra-media.md) | 0 | 0 | 0 | 0 | #805 |
| [npc-creature](infra-npc-creature.md) | 5 | 4 | 0 | 0 | #806 |
| [project](infra-project.md) | 11 | 3 | 0 | 0 | #807 |
| [rulesets](infra-rulesets.md) | 0 | 1 | 0 | 0 | #808 |
| [saga](infra-saga.md) | 11 | 0 | 0 | 0 | #809 |
| [session](infra-session.md) | 12 | 3 | 0 | 2 | #810 |
| [user-profile](infra-user-profile.md) | 0 | 1 | 1 | 0 | #811 |
| [world](infra-world.md) | 17 | 3 | 2 | 0 | #812 |

## Decisions already fixed by source evidence

- AI credentials remain owner-only BYOK; project membership or GM status does not authorize another account key.
- main is a dispatcher, never one of the 15 unmounted workers. ai-gm is unmounted even though its isolated implementation has a membership gate and persistent quota.
- session-media-token reads active project_members only; its session_players fallback comment does not describe executable behavior.
- Avatar and look analysis rate limits are process-memory counters. Credentials, thumbnail, model3d, character lore and recap use persistent RPC quotas.
- Legacy Maps are historical source behavior, not DB/RLS guarantees. Their external routes remain404 and no successor public activation is approved.
- Provider/storage/DB multi-request sequences and ignored persistence responses are called out explicitly. Current source defects are required successor decisions, not validated safe parity.


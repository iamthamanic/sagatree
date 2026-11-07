# Edge / infrastructure implementation mapping

One exact parent ticket exists for every Edge entry and every infrastructure area. This table supersedes the earlier broad suggested clusters. It is a contract map, not approval to implement or expose a route.

## Edge mapping

| Contract | Parent | Disposition |
|---|---|---|
| [ai-gm](edge-ai-gm.md) | #817 | Preserve external 404; no automatic host route or public activation. |
| [ai-provider-credentials](edge-ai-provider-credentials.md) | #818 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [bestiary](edge-bestiary.md) | #819 | Preserve external 404; no automatic host route or public activation. |
| [character-avatar-meshy](edge-character-avatar-meshy.md) | #820 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [character-lore](edge-character-lore.md) | #821 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [characters](edge-characters.md) | #822 | Preserve external 404; no automatic host route or public activation. |
| [dm-tools](edge-dm-tools.md) | #823 | Preserve external 404; no automatic host route or public activation. |
| [export](edge-export.md) | #824 | Preserve external 404; no automatic host route or public activation. |
| [item-model3d](edge-item-model3d.md) | #825 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [item-thumbnail](edge-item-thumbnail.md) | #826 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [items](edge-items.md) | #827 | Preserve external 404; no automatic host route or public activation. |
| [look-reference-analysis](edge-look-reference-analysis.md) | #828 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [lorekeeper](edge-lorekeeper.md) | #829 | Preserve external 404; no automatic host route or public activation. |
| [main](edge-main.md) | #830 | Preserve exact dispatch boundary until host cutover. |
| [marketplace](edge-marketplace.md) | #831 | Preserve external 404; no automatic host route or public activation. |
| [media](edge-media.md) | #832 | Preserve external 404; no automatic host route or public activation. |
| [npcs](edge-npcs.md) | #833 | Preserve external 404; no automatic host route or public activation. |
| [ollama-settings](edge-ollama-settings.md) | #818 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [quests](edge-quests.md) | #834 | Preserve external 404; no automatic host route or public activation. |
| [rulesets](edge-rulesets.md) | #835 | Preserve external 404; no automatic host route or public activation. |
| [session-media-token](edge-session-media-token.md) | #836 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [session-recap](edge-session-recap.md) | #837 | Current branch mount; a successor cutover still requires gates and contract tests. |
| [sessions](edge-sessions.md) | #838 | Preserve external 404; no automatic host route or public activation. |
| [spellbook](edge-spellbook.md) | #839 | Preserve external 404; no automatic host route or public activation. |
| [world](edge-world.md) | #840 | Preserve external 404; no automatic host route or public activation. |

## Infrastructure mapping and complete dependency list

### ai — #800

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|


### character — #801

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| infra | `inventory` | #802 |  |
| infra | `look` | #803 |  |
| infra | `media` | #805 |  |
| infra | `project` | #807 |  |
| infra | `session` | #810 |  |

### inventory — #802

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| auth | `authenticated account/session transport` | #793 |  |
| infra | `character` | #801 |  |
| infra | `media` | #805 |  |
| infra | `project` | #807 |  |

### look — #803

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| infra | `character` | #801 |  |

### marketplace — #804

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|


### media — #805

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|


### npc-creature — #806

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| auth | `authenticated account/session transport` | #793 |  |

### project — #807

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| auth | `authenticated account/session transport` | #793 |  |

### rulesets — #808

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|


### saga — #809

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|


### session — #810

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| auth | `authenticated account/session transport` | #793 |  |

### user-profile — #811

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| infra | `media` | #805 |  |

### world — #812

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| infra | `media` | #805 |  |


## RPC binding rule

Use the exclusive groups in `../rpc-contracts/split-groups.json`: world/atlas #813; session lifecycle/runtime/invites/recap #814; saga/project including both outcome promotions #815; NPC/controller plus marketplace #816. No name-prefix heuristic and no duplicate primary parent.

Internal quota RPCs remain explicit prerequisites of their owning Edge issue; they are not silently dropped because they are outside the 57 browser-call RPC names.

## Implementation exit conditions

- Architecture decisions and host dependencies must be accepted before successor implementation.
- Every exact request/result/error and side-effect fixture must pass against the source-backed contract; live and successor parity evidence are recorded separately.
- Unmounted workers keep404. Removing a legacy file or adding an internal replacement requires the corresponding ticket decision; this contract does not create a new public API.
- No owner key access broadening, speculative RLS, silent provider retries, untested partial persistence guarantees or changed secret exposure.


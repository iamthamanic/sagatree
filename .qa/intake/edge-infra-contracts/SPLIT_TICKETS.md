# Edge/Infra split tickets (PREP-05 #778)

Replace oversized “port all edge functions” MIG clusters with PR-sized tickets:

| Ticket suggestion | Scope |
|---|---|
| EDGE-HOST-01 | Shared CORS + auth middleware host equivalent of `_shared/cors.ts` + membership gate |
| EDGE-MEDIA-01 | `session-media-token` only (LiveKit) |
| EDGE-AI-01 | `ai-gm` + rate-limit store |
| EDGE-AI-02 | `ai-provider-credentials`, `character-lore`, `session-recap` |
| EDGE-AI-03 | `character-avatar-meshy`, `item-model3d`, `item-thumbnail`, `look-reference-analysis` |
| EDGE-SESSION-01 | `sessions`, `dm-tools` |
| EDGE-CONTENT-01 | `world`, `npcs`, `bestiary`, `quests`, `spellbook`, `items`, `characters` |
| EDGE-CONTENT-02 | `marketplace`, `media`, `export`, `rulesets` |
| EDGE-DISPATCH-01 | `main` dispatcher retirement / routing table |
| INFRA-01..13 | One PR per `src/infrastructure/<area>` facade cutover after linked RPC/Edge ready |

Do not implement until GATE-02/03 APPROVED and host skeleton exists.

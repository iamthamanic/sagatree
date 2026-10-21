# Source baseline and observed behavior

| Item | Evidence |
| --- | --- |
| Source baseline | `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248` |
| Original PR #860 head | `839a8c256f53fc7f3be3375efd127ae07524458f` |
| Effective SQL source chain | 106 migrations, applied unchanged in isolation |
| PostgreSQL | 15.18; official pinned Supabase/GoTrue/Storage bootstrap |
| Catalog | 177 functions, 144 policies, 59 relations, 541 columns, 287 constraints |
| RPC source parity | 177/177 observed function definitions match source extraction |
| Product backend | Actual GoTrue password grants and PostgREST v12.0.1 |
| SQL secure behavior suite | 25 tests: 16 passed, 9 failed |
| Atlas product browser | 3 tests: 1 passed, 2 failed; no skipped or flaky tests |
| Actual RLS canary | Clean policy passes; deliberately widened policy fails the expected case |
| Product deployment state | Not inspected or certified by the isolated source baseline |

## Evidence location

The complete reports, source fingerprints, sanitized browser observations and artifact manifest are under `parity-fixtures/execution-2026-10-21/`. Its README maps successful and failed scenarios precisely. The RPC inventory separately records source semantics, effective isolated ACLs and explicit source/implementation blockers.

The initial historical baseline `4bc40a31` and its old test result do not prove execution of these new tests. Repository HEAD identifies the checkout; per-file hashes identify the actually executed working-tree harness. No new PASS is attributed to an unexecuted immutable commit.

## Reproduced blockers

Two helper functions are callable as anon in the isolated Supabase default-ACL fixture and can mutate foreign data: `append_session_event` and `sagatree_resolve_adventure_command`. Both also permit foreign authenticated callers. Further failing security probes cover foreign leave, client-controlled legacy-pin redaction, and cross-saga Atlas reveals.

The two functional SQL failures are a roll resolver still reading `v_character.user_id` after the ownership-column rename, and ambiguous resolution of `save_session_recap_summary(uuid,text)`.

The actual browser reveals two Atlas blockers: missing saga context in the player workbench request and an overlay intercepting the normal tools-button click. An owner rename already persists across reload, and real reveal APIs work for both players; these partial successes do not close Atlas #770.

All failures require explicit correction and regression evidence before safe parity or cutover can be claimed. No test is weakened to accept insecure legacy behavior.

# Review — stack-migration-rpc-world-map
Verdict: APPROVE
Findings (addressed on branch):
- P1 CAS: revision read moved inside `BEGIN IMMEDIATE`.
- P1 linked solo: ownership/read uses `actorId` + `linkedSoloActorIds`.
- P1 foreign SQL: membership via `project.actorCanAccessWorld` port.
- P2 existence leak: missing/unauthorized → `42501`.
- P2 discovered coercion: `"false"` / `0` hidden for players.
No open Critical/Important blockers. RPC-SEC-LEGACY-MAP-FLAG fixed.

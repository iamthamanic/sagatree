# Acceptance — MIG-022 SessionRuntimeState

Domain contract: status / roster / gameplay (src/domains/session/contracts/session-runtime.ts)

- [x] Fall 1 PASS: concurrent writers — exactly one commit
- [x] Fall 2 PASS: replay / mismatch / domain status+roster+gameplay
- [x] Fall 3 PASS: SIGKILL mid-tx leaves all four parts absent
- [x] Fall 4 PASS: post-commit publisher fires only after successful COMMIT
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

# Architecture GATE PoC contracts (PREP-03 #776)

| Gate | File | PoC issue | Blocks (examples) | ADR |
| --- | --- | --- | --- | --- |
| GATE-01 | [GATE-01-drizzle-vs-zenstack.md](GATE-01-drizzle-vs-zenstack.md) | #784 | MIG-011..013 | ADR-ST-05 |
| GATE-02 | [GATE-02-better-auth-colyseus.md](GATE-02-better-auth-colyseus.md) | #785 | MIG-014/015/021/023 | ADR-ST-06 |
| GATE-03 | [GATE-03-colyseus-http-vs-hono.md](GATE-03-colyseus-http-vs-hono.md) | #786 | MIG-020/021 | ADR-ST-07 |
| GATE-04 | [GATE-04-sqlite-revision-idempotency.md](GATE-04-sqlite-revision-idempotency.md) | #787 | MIG-022 | ADR-ST-08 |
| GATE-05 | [GATE-05-tauri-packaging.md](GATE-05-tauri-packaging.md) | #788 / #852 | MIG-703 only | ADR-ST-09 |

## Rules

1. These files define **measurable PASS/FAIL** for PoCs — they do **not** approve a technology.  
2. Human must set ADR status to **APPROVED** after PoC evidence.  
3. Agents must not remove `needs-design` / runner blockers from dependent issues until ADR APPROVED.  
4. GATE-05 is deferred; do not execute during browser host waves.  

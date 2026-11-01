# Acceptance — stack-migration-mig-602 (#847 / MIG-602)

## Intent

Host-Unit-, echte DB-/Transport-Integration und Browser-Produktpfade als
verlässliche CI-Gates anschließen (kein silent skip, kein continue-on-error).

## Acceptance tier

`feature-e2e` — SLICE DONE / FEATURE VERIFIED for covered host/DB/transport/browser
journeys when suite PASS. RELEASE APPROVED (cutover / Supabase shutdown) bleibt
menschlich (MIG-700+).

## Preconditions

- MIG-600/#845, MIG-601/#846, ATLAS-LIVE-E2E/#770 DONE with completionEvidence.
- Port/RPC predecessors DONE (intake READY for MIG-602).
- Owner-lock: isolated harnesses only; no production credentials.

## Happy path

- PR CI starts isolated PG/GoTrue/PostgREST (or SQLite GATE-01) without external DB secrets.
- Atlas isolated product journey + RLS canary + Postgres baseline + GATE-01/02/03 +
  Test Gate + Browser E2E remain distinct required (or ECC-enforced) checks.
- Missing service / empty artifact → job red (`if-no-files-found: error`).

## Edge / security

- Permission regression canary must go red; `test.skip` / `continue-on-error` /
  mocked substitutes do not satisfy the canary.
- Host Drizzle persistence boundaries fail closed (architecture-boundary-check +
  gate-01-drizzle-host-persistence.self-test inside Test Gate).
- Logs/artifacts keyed by Actions run id + commit SHA.

## Required Tests

- [x] Die Jobs starten ihre isolierte Datenbank selbst und führen den GM→Player-Atlas-Pfad samt DB-Assertions aus; fehlender Dienst lässt den Job rot werden.
- [x] Mindestens ein erforderlicher Check wird rot; test.skip, continue-on-error und rein gemockte Ersatzantworten erfüllen dieses Kriterium nicht.
- [x] Logs, Testanzahlen und Revision sind diesem Commit zugeordnet; Browser-, DB- und Vertragsprüfung bleiben als unterschiedliche Nachweise erkennbar.
- [x] checkHostDrizzlePersistenceBoundaries und die HostDatabase/Drizzle-Runtime-Proofs bleiben grün; fehlende Policy, omit=dev ORM oder forbidden zone imports machen den Job rot.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `node --test scripts/mig-602-ci-quality-gates.self-test.mjs` → PASS.

## Security Coverage

| ID | How |
| --- | --- |
| Authz / RLS | Actual RLS regression canary + atlas outsider DENY |
| Isolation | Ephemeral harness jobs; no hosted secrets |
| Fail-closed | No `continue-on-error` on migration CI; artifact upload `if-no-files-found: error` |
| Host policy | GATE-01 + Test Gate Drizzle/boundary self-tests |

### Launch Checklist (SC)

N/A — not a launch / cutover ticket (RELEASE APPROVED remains human).

## Implementation Notes

- `.qa/merge-gate.yaml` requiredChecks += Atlas isolated product, Postgres baseline,
  GATE-01, GATE-02/03 (alongside existing Test Gate / Browser E2E / RLS canary / RPC / ECC).
- `scripts/mig-602-ci-quality-gates.self-test.mjs` + Test Gate hook prove no
  `continue-on-error`, distinct jobs/artifacts, Drizzle proofs still wired.
- Suites already green on main via baseline/pocs/verify; this slice makes them
  merge-blocking for ECC.

## Composition Gate

Proof: `.qa/runs/composition-gate-stack-migration-mig-602.md`

## Post-merge

- Merged CLEAN via PR #1066 → `14a3585c8` (2026-11-01). CompletionEvidence `githubClosed: true`; `testedCommit` remains gate PR HEAD `24527377e` matching composition-gate proof.

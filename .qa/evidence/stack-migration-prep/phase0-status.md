# Preparation status — 2026-10-21

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`.
Remediation branch: `docs/mig-773-contract-remediation-20261021`; PR #860.

## Published work

The 71 migration issues #782–#852 and Atlas #770 already existed. Eighteen RPC child issues #861–#878 now partition all 57 frontend RPC names exactly once. The canonical graph therefore contains 90 issues. Historical preparation issues are separately retained in `published-issue-registry.json.preparationIssues`.

All 90 issues remain blocked or needs-design for automatic execution. The earlier rejection of applying `agent-ready` to #782 remains a valid execution boundary; the explicit publication authorization does not activate the runner. No issue has been marked done or architecture-approved by this preparation publication.

The canonical body/title/blocked-label synchronization is **complete: 90/90 verified, 0 pending**. Automatic approval review previously rejected the next update (#813) for insufficient explicit visible public-destination/content authorization. The user subsequently explicitly authorized this preparation package including documented security findings in public `iamthamanic/sagatree`, Draft PR #860, Epic #773 and the remaining 49 contracts. That publication blocker is resolved. `github-contract-sync.json` retains the rejection history, separately accepted #866 retry, explicit authorization and exact verified payload hashes.

The reviewed source package is published at [fee2545806a152bd3c7160e8ee8f47cd8c89c8a1](https://github.com/iamthamanic/sagatree/commit/fee2545806a152bd3c7160e8ee8f47cd8c89c8a1), tree `132f7333e905ad9a9d544f3c55821de7c7c98056`. The final remote PR/Epic metadata result is recorded separately in `closeout/publication-final.json`; the existence of a prepared metadata body is not proof that its update has completed.

The immutable review ZIP remains the historical preauthorization snapshot with 41/90 synchronized at its creation. Its SHA-256 is `d2c78139c88faed528543ee40fc6d052ae13d6b8518074f589f35bbc6b5bc110`. Current publication receipts supersede its historical status, without altering its reviewed source bytes or old snapshots.

## Evidence and limits

The final ordinary full `npm run test-gate` completed successfully in this working tree, including source-contract validation, all 28 deliberate negative validator cases and a dependency audit with zero reported vulnerabilities. The actual output is preserved in `closeout/test-gate.txt`. These are distinct scopes: the new isolated baseline is deliberately stricter, with 16/25 SQL probes and 1/3 actual Atlas browser journeys passing; reproduced security and product defects keep the new integration suites red. The actual RLS regression canary passes by detecting the injected policy regression.

The full source SQL chain applies 106/106 migrations. This does not certify a running deployment: the repository apply script omits three source migrations. See `parity-fixtures/execution-2026-10-21/postgres-report.json` for the exact chain and omissions.

GATE-01 was rerun after three independent evidence-verifier findings were fixed. Each ORM candidate passes all 42 required cases on both Node 22 and Node 24; 13 targeted evidence regressions pass in each runtime. Exact case identities, complete source coverage, mandatory components and sample-derived metrics are enforced. See `pocs/GATE01_REVIEW.md` and both freshly executed reports.

A separate audit of the new nested lockfiles is not uniformly green: GATE-01 includes four High package entries in one vulnerable generator dependency chain and one Low tool advisory. All are dev dependencies; its `--omit=dev` audit and both other new harness audits report zero advisories. These remain explicit open toolchain findings, and the GATE-01 CI job also enforces the full audit. See `closeout/dependency-audit.md`; functional PoC PASS is not full dependency approval.

The actual Chromium probe for GATE-02 confirms that Cookie A's HttpOnly cookie is hidden from `document.cookie`, but the combined candidate profile exposes authenticating session tokens in JavaScript-readable sign-in responses. Cookie A therefore fails its mandatory credential-isolation criterion; a successful reproduction is not a successful architecture gate. Browser JWT storage and Tauri remain unexecuted.

The frozen GATE-02/03 execution records 18 successful GATE-02 observations and one unexecuted browser-JWT case, but mandatory criteria remain 12 PASS / 1 FAIL / 1 NOT RUN. The strict CLI returns exit 1 for that real failure. GATE-03 passes all ten mandatory criteria, including actual 200 reconnects overlapping 200 HTTP commands for each transport variant. Stored observations are checked against the report/source association and measurement invariants; a replay prints separate fresh measurements.

GATE-04 has repeated successful real SQLite executions, including an independent run and a separate Node-22 compatibility run: 1000 committed logical commands and five SIGKILL positions. It tests a stronger target idempotency contract than current SQL. Architecture decisions remain human decisions; desktop GATE-05 waits for browser-host CI and operations.

The next implementation sequence is concrete in `START_SEQUENCE.md`: baseline #782, inventory #783 and human GATE-01 decision #784 precede the first new Node host #789. The open Auth gate does not itself block this initial host foundation. No ticket was marked done or ready based on these isolated results.

The unrestricted migration runner, product cutover and production data migration remain unapproved. No existing live database was used for these proofs.

# Preparation status — 2026-10-21

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`.
Remediation branch: `docs/mig-773-contract-remediation-20261021`; PR #860.

## Published work

The 71 migration issues #782–#852 and Atlas #770 already existed. Eighteen RPC child issues #861–#878 now partition all 57 frontend RPC names exactly once. The canonical graph therefore contains 90 issues. Historical preparation issues are separately retained in `published-issue-registry.json.preparationIssues`.

All 90 issues remain blocked or needs-design for automatic execution. Automatic approval review rejected applying `agent-ready` to #782 because that persistent label could activate the runner. The authorized source repair, isolated tests and PoC evidence continue without activating it.

The canonical body/title/blocked-label synchronization is **partial: 41/90 verified, 49 pending**. Automatic approval review rejected the next update (#813), requiring explicit visible authorization to publish the remaining contracts, code and evidence including security findings to public `iamthamanic/sagatree`, PR #860 and Epic #773. No further GitHub writes were attempted after that rejection; the new local code/evidence has not been pushed. See `github-contract-sync.json` for both rejection events, the separately accepted #866 retry and exact verified payload hashes.

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

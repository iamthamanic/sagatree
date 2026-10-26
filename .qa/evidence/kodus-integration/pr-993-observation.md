# Kodus observation — PR #993 (RPC-ATLAS-MAPS)

Observed 2026-10-26 against HEAD `80e3ccc2a6a952fa5493f4e5f70c1a8b9d50120a`.

## Check run

| Field | Value |
|-------|-------|
| name | `Kody Code Review` |
| app.slug | `kody-ai` |
| status | `completed` |
| conclusion | `success` |
| output.title | `Code Review Complete` |
| output.summary | Review finished successfully. Suggestions (if any) were posted as PR/file comments. |
| details_url | https://kodus.io |

## Issue comments (`kody-ai[bot]`)

1. `@kody start-review` — trigger only (not completion).
2. `## Code Review Completed!` + `<!-- kody-codereview-completed-… -->` + `<!-- kody-codereview -->`
   (edited in place as review progressed).
3. Finding cards with shields.io `severity_level-{critical\|high\|medium}` badges.

## Review threads

Inline threads authored by `kody-ai` with the same severity badges. GraphQL
`reviewThreads.isResolved` is authoritative for resolution.

## Gate implications

- Completion authority: check-run on HEAD (not the Started comment, not an older SHA).
- Findings: threads + issue-comment cards; dismiss via markers / resolve thread.
- Spoofed logins / non-`kody-ai` check apps must FAIL.

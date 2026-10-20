# Phase 2 — Dependency PR Triage

**Baseline main:** `4bc40a31`  
**Triage comments posted:** 2026-10-20 on #739–#743

| PR | Change | Error cause | Affected | Required fix | Recommendation | Status after triage |
| --- | --- | --- | --- | --- | --- | --- |
| #739 | three 0.183.2→0.186.1 | `avatar-runtime-regression-check` pins 0.183.2 | Avatar/Three | Coordinated Three upgrade + update pin after compatibility proof | **DEFER** | Open, red, commented |
| #740 | react-leaflet 4→5 | `ERESOLVE` peer react@^19 | Atlas 2D leaflet | React 19 + leaflet 5 coordinated wave | **BLOCK** | Open, red, commented |
| #741 | mediapipe 0.10.14→1.1.1 | `avatar-face-tracking-check` pins 0.10.14 | LiveAct face | Upgrade + tracking regression update | **DEFER** | Open, red, commented |
| #742 | lucide-react 0.487→1.58 | Was green; branch behind main | Icons | Rebase onto main, re-run CI, then merge | **UPDATE→MERGE if green** | `gh pr update-branch` executed; awaiting CI |
| #743 | react-dom/@types/react-dom 19 | `@types/react-dom@19` peers `@types/react@^19` | TS types | React 19 types wave with #740 | **BLOCK** | Open, red, commented |
| #769 | Atlas E2E gate | Merged; live path optional | Atlas | See #770 for mandatory live gap | **MERGED** (acceptance incomplete) | Closed |

## Rules applied

- No red PRs merged.  
- No pin removals without replacement tests.  
- No peer-force installs.  
- React 19 + Leaflet 5 treated as one upgrade dependency.  

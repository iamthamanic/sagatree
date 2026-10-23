# GATE-02 / #785 — Human auth variant decision package

**Status:** **EXECUTED** · **NOT APPROVED** · **UNDECIDED** (no human A/B choice recorded)  
**Issue:** [#785](https://github.com/iamthamanic/sagatree/issues/785)  
**Spec:** [`.qa/design/gates/GATE-02-better-auth-colyseus.md`](../../design/gates/GATE-02-better-auth-colyseus.md)  
**Evidence:** [`pocs/gate-02/`](pocs/gate-02/) (`report.json`, `observations.json`, `README.md`) · review [`pocs/GATE0203_REVIEW.md`](pocs/GATE0203_REVIEW.md)  
**Fixture:** `scripts/stack-migration-pocs/gate-02-03/`  
**ADR draft:** [`docs/architecture/ADR-ST-06-gate-02-auth-handshake.md`](../../../docs/architecture/ADR-ST-06-gate-02-auth-handshake.md) (**PROPOSAL / DECISION PENDING** — not APPROVED)  
**Blocks when approved:** MIG-014, MIG-015, MIG-021, MIG-023 (ADR-ST-06)

**This document does not grant architecture freigabe.** PoC execution, CI, or this package cannot set `GATE-02: APPROVED`. Only a human comment on #785 plus updated `architecture-approvals.json` and ADR-ST-06 after explicit acceptance criteria are met.

---

## Execution summary

| Field | Value |
| --- | --- |
| PoC run | 2026-10-23 (Node 22.22.3, darwin arm64, SQLite 3.51.0; Chromium 140.0.7339.186) |
| Probe execution | **PASS** (17 executed assertions PASS, 0 FAIL; opaque bearer + B-1-browser NOT RUN) |
| Gate objective (cookie-preferred A) | **PASS** (all A rows PASS; B row 1 NOT RUN allowed) |
| Browser | Chromium 140.0.7339.186 / Playwright 1.55.1, real Better Auth + Colyseus SDK |
| Report hash | `cb6179fd1d9c82e9f4b277fcc9d0bba557bc1fd635754b7691c469248ff28c77` |

Reproduce: see [`pocs/gate-02/README.md`](pocs/gate-02/README.md).

---

## Mandatory criteria matrix

Rows match [GATE-02 spec](../../design/gates/GATE-02-better-auth-colyseus.md). Status from [`pocs/gate-02/report.json`](pocs/gate-02/report.json).

| Row | Criterion (short) | **A — session cookie** | **B — bearer JWT** |
| --- | --- | --- | --- |
| 1 | Credential not readable by JS (A) / stored securely (B) | **PASS** (cookie profile; `/api/auth/token` hard-denied; JWT host separate) | **NOT RUN** |
| 2 | WS join without auth rejected | PASS | PASS |
| 3 | Revoke/logout rejects within ≤2s | PASS | PASS |
| 4 | Valid reconnect restores seat; no privilege escalation | PASS | PASS |
| 5 | Player cannot join as GM / other character | PASS | PASS |
| 6 | Cross-host / wrong origin denied | PASS | PASS |
| 7 | Solo public bind + forged local identity fail closed | PASS | PASS |

**Architecture status remains NOT APPROVED / UNDECIDED.** Cookie-A R01 is proven PASS in the PoC; human freigabe on #785 is still required. B row 1 (browser/Tauri secure JWT store) stays NOT RUN.

---

## Cookie-A row 1 (R01) — JS-readable session tokens

**Required outcome:** credentials must not be usable by page JavaScript under the chosen auth profile (threat model documented).

### External abnahme finding (PR #900 discussion `PRRT_kwDOStABwc6vY3oO`)

After PR #900, Cookie-A still loaded the Better Auth JWT plugin and left `/api/auth/token` reachable. Same-origin page JS could call `fetch('/api/auth/token')` with the ambient HttpOnly cookie and receive a **JS-readable JWT** usable as Bearer without the cookie. R01 was therefore **FAIL** until the follow-up remediaiton (profile split).

### Observed after remediaiton (real Chromium, `authProfile: 'cookie'`):

- HttpOnly `SameSite=Lax` session cookie is set; `document.cookie` **cannot** read it.
- Sign-in JSON does **not** expose a page-readable session token; `set-auth-token` is **absent**.
- JWT plugin is **not** loaded on cookie hosts; `/api/auth/token` hard-returns **404** `JWT_ISSUANCE_DISABLED` (not UA/Origin/Fetch-Metadata).
- Page JS cannot obtain a reusable JWT; scanned `/api/auth/*` paths expose no readable credential fields.
- Cookie hosts reject `Authorization` Bearer; JWT issuance lives only on a separate `authProfile: 'jwt'` Node host (Variant B).
- Page JS replay against `/api/auth/get-session` with `credentials: omit` does **not** authenticate.
- Real Colyseus browser WS join works on the cookie path; foreign-origin CSRF probe returned **403** with no unauthorized revision changes (cookie CSRF negatives **PASS**).

**Interpretation:** Cookie-A R01 **PASS** after remediaiton for the PoC cookie-only profile. Overall architecture freigabe remains **NOT APPROVED** until human decision on #785. Product migration is separate from this PoC wrapper.

No token values are stored in evidence artifacts.

---

## Revocation timings (local fixture; not production SLO)

See latest [`pocs/gate-02/observations.json`](pocs/gate-02/observations.json) `metrics.cookieRevocation` / `metrics.jwtRevocation`. Every run asserts ≤2000 ms end-to-end.

JWT path: signature-only verification still accepts a cryptographically valid but **revoked** JWT; fixture rejects via **current session store** lookup (tested canary).

---

## NOT RUN (explicit gaps)

| Scope | Affects |
| --- | --- |
| HTTPS `Secure` cookie, other browser engines | A production cookie story |
| Tauri cookie persistence / bootstrap | A desktop |
| Browser/Tauri **secure JWT store** and browser WS bearer transport | B row 1 |
| Opaque bearer plugin distinction | Retired in cookie-preferred A profile; JWT path remains |
| Production GATE-01 owner/GM/invitation product policy | Both |
| Public TLS, trusted proxies, distributed seat persistence | Both |

---

## Human options

Reply on **#785** with one of (exact prefix helps automation):

- **`GATE-02: APPROVED — Variant A (session cookies)`**
- **`GATE-02: APPROVED — Variant B (bearer JWT)`**
- **`GATE-02: REJECTED — <reason / request more evidence>`**
- **`GATE-02: UNDECIDED — defer until <condition>`**

### Option A — Better Auth session cookies + Colyseus `onAuth` via shared session store

**PoC today:** rows 1–7 **PASS** under `authProfile: 'cookie'` (R01 closed after JWT-escape remediaiton; Chromium proves `/api/auth/token` denied).

**Must be true before human APPROVED:**

1. **Cookie-A R01 resolved** — done in PoC (no JWT plugin on cookie hosts; hard-deny `/api/auth/token`; Chromium PASS). Human confirms the product will adopt the same constraints (no JS-readable session bearers **and** no browser-reachable JWT mint on the cookie path).
2. **CSRF story** for cookie variant documented (foreign-origin negatives executed in PoC; extend to product routes).
3. Human accepts **NOT RUN** items relevant to SagaTree shipping surface (HTTPS Secure cookies, Tauri, other engines) or scopes follow-up tickets.

### Option B — Better Auth JWT + Colyseus `onAuth` signature + session store

**PoC today:** rows 2–7 **PASS** on Node/ws `Authorization`; row 1 **NOT RUN** for browser/Tauri.

**Must be true before human APPROVED:**

1. **B row 1 executed PASS:** secure storage and transport for JWT in **browser** and planned **Tauri** clients (browser WebSocket cannot set `Authorization`; Colyseus SDK URL token patterns were rejected in fixture — product pattern must be proven, not assumed).
2. **Revocation policy explicit:** immediate deny requires session store check (not signature-only); human accepts operational cost.
3. Human accepts **NOT RUN** production/policy/TLS gaps or scopes follow-up tickets.

### Choosing neither

Requires new evidence ticket; do not invent a third variant in implementation without a new gate amendment.

---

## Open findings (carry into either choice)

| Severity | Topic | Note |
| --- | --- | --- |
| **High** | Cookie-A R01 JS-readable tokens / JWT escape via `/api/auth/token` | **Closed in PoC follow-up** (authProfile split + Chromium token-endpoint negative); still needs human APPROVED on #785 for product freigabe |
| Medium | GET without Origin / Fetch-Metadata fix in fixture | Addressed in PoC; verify in product |
| Medium | Observation integrity checks | Regression-guarded in harness |
| Low | Typed decoder / null / async-handler edges | Documented in GATE0203 review |
| Info | Colyseus reconnect reservation is ticket-based; `onAuth` not re-run on HTTP reserve | WS upgrade + room recheck enforced in PoC |
| Info | Opaque bearer plugin disabled for cookie-preferred A | `B-bearer-distinction` NOT RUN; JWT remains for Node B |

---

## Related (not decided here)

- **GATE-01** APPROVED (Drizzle + Policy Service) does **not** approve GATE-02.
- **GATE-04** APPROVED (SQLite single writer) does **not** approve GATE-02.
- **MIG-010 / #789** host foundation may proceed; auth migration tickets remain blocked until GATE-02 APPROVED + ADR-ST-06.

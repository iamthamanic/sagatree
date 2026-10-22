# GATE-02 / #785 — Human auth variant decision package

**Status:** **EXECUTED** · **NOT APPROVED** · **UNDECIDED** (no human A/B choice recorded)  
**Issue:** [#785](https://github.com/iamthamanic/sagatree/issues/785)  
**Spec:** [`.qa/design/gates/GATE-02-better-auth-colyseus.md`](../../design/gates/GATE-02-better-auth-colyseus.md)  
**Evidence:** [`pocs/gate-02/`](pocs/gate-02/) (`report.json`, `observations.json`, `README.md`) · review [`pocs/GATE0203_REVIEW.md`](pocs/GATE0203_REVIEW.md)  
**Fixture:** `scripts/stack-migration-pocs/gate-02-03/`  
**Blocks when approved:** MIG-014, MIG-015, MIG-021, MIG-023 (ADR-ST-06)

**This document does not grant architecture freigabe.** PoC execution, CI, or this package cannot set `GATE-02: APPROVED`. Only a human comment on #785 plus updated `architecture-approvals.json` and ADR-ST-06 after explicit acceptance criteria are met.

---

## Execution summary

| Field | Value |
| --- | --- |
| PoC run | 2026-10-21 (Node 24.19.0, Linux, SQLite 3.53.3) |
| Probe execution | **PASS** (18 assertions/canaries, 0 unexpected failures) |
| Gate objective | **FAIL** (required Cookie-A row 1 not satisfied) |
| Browser | Chromium 140.0.7339.186 / Playwright 1.55.1, real Better Auth + Colyseus SDK |
| Report hash | `8a6e1a8cd6f4db8e89d16a374112e86772fa7e9e1fe080141d85a18cb87c14eb` |

Reproduce: see [`pocs/gate-02/README.md`](pocs/gate-02/README.md). `--check` exits nonzero for the known required failure; that is expected.

---

## Mandatory criteria matrix

Rows match [GATE-02 spec](../../design/gates/GATE-02-better-auth-colyseus.md). Status from [`pocs/gate-02/report.json`](pocs/gate-02/report.json).

| Row | Criterion (short) | **A — session cookie** | **B — bearer JWT** |
| --- | --- | --- | --- |
| 1 | Credential not readable by JS (A) / stored securely (B) | **FAIL** | **NOT RUN** |
| 2 | WS join without auth rejected | PASS | PASS |
| 3 | Revoke/logout rejects within ≤2s | PASS | PASS |
| 4 | Valid reconnect restores seat; no privilege escalation | PASS | PASS |
| 5 | Player cannot join as GM / other character | PASS | PASS |
| 6 | Cross-host / wrong origin denied | PASS | PASS |
| 7 | Solo public bind + forged local identity fail closed | PASS | PASS |

**Neither variant is APPROVED-ready today:** A fails row 1; B row 1 was not executed for browser/Tauri secure transport.

---

## Cookie-A row 1 (R01) — JS-readable session tokens

**Required outcome:** credentials must not be usable by page JavaScript under the chosen auth profile (threat model documented).

**Observed (real Chromium, combined Better Auth cookie + bearer + JWT fixture profile):**

- HttpOnly `SameSite=Lax` session cookie is set; `document.cookie` **cannot** read it.
- Sign-in JSON exposes a **page-readable** session token; Better Auth **bearer** plugin emits a page-readable `set-auth-token`.
- Page JS replays those tokens against `/api/auth/get-session` with `credentials: omit`; requests succeed with `Authorization` and **no Cookie** — authenticated session established without cookies.
- Real Colyseus browser WS join works on the cookie path; foreign-origin CSRF probe returned **403** with no unauthorized revision changes (cookie CSRF negatives **PASS** as separate cases).

**Interpretation:** HttpOnly cookie isolation alone does **not** satisfy full credential isolation while JS-readable bearer/session tokens remain in the same auth profile. Overall GATE-02 status **FAIL**; `approval: NOT APPROVED`.

No token values are stored in evidence artifacts.

---

## Revocation timings (local fixture; not production SLO)

| Credential | Operation | End-to-end (ms) |
| --- | --- | ---: |
| Cookie | sign-out | 203.4 |
| Cookie | revoke-session | 129.4 |
| JWT | sign-out | 80.1 |
| JWT | revoke-session | 148.5 |

JWT path: signature-only verification still accepts a cryptographically valid but **revoked** JWT; fixture rejects via **current session store** lookup (tested canary).

---

## NOT RUN (explicit gaps)

| Scope | Affects |
| --- | --- |
| HTTPS `Secure` cookie, other browser engines | A production cookie story |
| Tauri cookie persistence / bootstrap | A desktop |
| Browser/Tauri **secure JWT store** and browser WS bearer transport | B row 1 |
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

**PoC today:** rows 2–7 **PASS**; row 1 **FAIL** (R01 above).

**Must be true before human APPROVED:**

1. **Cookie-A R01 resolved or explicitly accepted:** either (a) a **cookie-only** production profile with **no** JS-readable sign-in/bearer tokens in the browser path, re-run Chromium row-1 probe **PASS**, or (b) documented **residual risk** with named mitigations (e.g. disable bearer plugin in browser clients, strip tokens from sign-in responses, CSP) and human sign-off that the threat model is acceptable.
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
| **High** | Cookie-A R01 JS-readable tokens | Blocks A APPROVED until fixed or accepted with residual risk |
| Medium | GET without Origin / Fetch-Metadata fix in fixture | Addressed in PoC; verify in product |
| Medium | Observation integrity checks | Regression-guarded in harness |
| Low | Typed decoder / null / async-handler edges | Documented in GATE0203 review |
| Info | Colyseus reconnect reservation is ticket-based; `onAuth` not re-run on HTTP reserve | WS upgrade + room recheck enforced in PoC |

---

## Related (not decided here)

- **GATE-01** APPROVED (Drizzle + Policy Service) does **not** approve GATE-02.
- **GATE-04** APPROVED (SQLite single writer) does **not** approve GATE-02.
- **MIG-010 / #789** host foundation may proceed; auth migration tickets remain blocked until GATE-02 APPROVED + ADR-ST-06.

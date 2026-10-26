# Acceptance — RPC-SESSION-LIFECYCLE (#868)

## Intent
Port create_play_session, create_project_session, set_session_status with GM/member guards, unique numbers/codes, status transitions, completion recap, and no public append_session_event.

## Acceptance tier
`isolated-contract` — SLICE DONE. FEATURE VERIFIED → MIG-311/#810 + MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] create_play_session verlangt GM; create_project_session erlaubt aktiven GM-/Player-Mitgliedschaftspfad.
- [x] Parallele Erzeugung vergibt eindeutige Session-Nummern und Join-Codes; scheduled/waiting und Kopie des letzten Abschlusswissens bleiben korrekt.
- [x] Nur erlaubte waiting/active/paused/completed-Übergänge verändern Status und Revision; completed ist terminal.
- [x] Abschluss erzeugt Recap/Handover und Status-Event atomar; ungültige Übergänge ändern keine Revision.
- [x] Verpflichtende Legacy-Regression RPC-SEC-ANON-EVENT-HELPER: kein öffentlicher append_session_event Export.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] scripts/rpc-session-lifecycle.self-test.mjs → PASS

## Evidence
`scripts/rpc-session-lifecycle.self-test.mjs` → PASS (schemaVersion >= 15).

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-rpc-session-lifecycle.md`.

## Deferred
HTTP adapters → MIG-311; FEATURE VERIFIED → MIG-600/#845 + MIG-602/#847.

# Composition Gate — stack-migration-mig-021 (#796)

- HEAD_SHA: 0752dad3b77ebe338b44c246890ca503cef48785
- BASE_SHA: 9ddd487824429516f7b1271c91e6d4841f273d91
- HOP_DIGEST: 7390931094516d1b15ca2830ef948cad5edc42856cbbb23ca9f848cc26f46860
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Clients join/resync session rooms. Host authorizes membership, loads durable snapshot + events since clientRevision, projects via MIG-024, then delivers sync payload. Room ids are not authorization.

## Hop chain

1. Producer: Session runtime commit (`session_events` / `onCommitted`)
2. Authorize: Current session membership (re-checked on join/resync)
3. Project: `server/src/projections`
4. Consumer: Realtime room occupants / Colyseus adapters

## Simulations

### N-actors
GM/P1/P2 reconnect at different revisions; each gets tip snapshot + only missing follow-on events.

### Invalid/missing
Stranger, revoked member, and mismatched room id are FORBIDDEN.

### Two consumers / crash
After host restart, resync reconstructs confirmed revisions from SQLite; no rolled-back mutations.

## Flags

None.

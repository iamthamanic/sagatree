# Composition Gate — stack-migration-mig-023 (#798)

- HEAD_SHA: 1f79721ce0ee61693254fdd400cf44baea131292
- BASE_SHA: 14c52e090bcf7d6ff7e0e8b281cc03758e05df78
- HOP_DIGEST: 7465a9e3ea84c47a97980825c01bf89bae37cfc4ab0620ad9e3b006ce86c3930
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Authenticated actor redeems invite token or join code → host invite store claims redeem slot → ensure project_members role=player → session_players upsert. Tokens never assert GM/owner.

## Hop chain

1. Producer: `application/session/invites` use-case
2. Authenticate: Actor required
3. Authorize: create/revoke require project GM; join uses opaque credential + session lock
4. Persist: SQLite BEGIN IMMEDIATE (invite redeem_count CAS, membership, roster)
5. Consumer: project_members / session_players / optional session_members reader link

## Simulations

### N-actors
Two concurrent redeems of max_redemptions=1: exactly one membership; loser REDEEM_LIMIT/BUSY.

### Invalid/missing
Expired, revoked, unknown code → deny with no membership mutation. claimedRole=gm ignored.

### Two consumers / crash
Abort before COMMIT leaves redeem_count and membership absent.

## Flags

None.

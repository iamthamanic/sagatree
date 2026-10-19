# Composition Gate — atlas-worldbuilder-player-projection

- HEAD_SHA: ea012d245c5238642b953efe4f6cd29ae6092eed
- BASE_SHA: 0416600a9f3d60f495c5cc693012fba34e10e3ea
- Date: 2026-10-18
- Verdict: CLEAR

## Event

Player/editor atlas list or map fetch → SECURITY DEFINER RPC applies party allow-list / redaction; Storage SELECT consults path authz helper.

## Hop chain

1. Client `worldAtlasService.listMaps/getMap/createSignedUrl` (JWT)
2. RPC resolves edit vs party-only; without saga party list is empty / get returns not found
3. Storage policy → `current_user_can_read_world_atlas_object`
4. Editor path unchanged full catalog

## Simulations

| Case | Intended | Result |
|------|----------|--------|
| N-actors | Two sagas same world | reveal bindings scoped per project |
| Invalid/missing | No saga / guessed UUID / anon | empty or not found / denied |
| Two consumers / crash | Retry list | idempotent read projection |

## Flags

(none)

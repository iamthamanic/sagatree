# Composition Gate — atlas-followup-webgl-tool-registry (#750)

- HEAD_SHA: b9f134858904a6b6f7fa23001cad28ed8a30bdae
- BASE_SHA: 03f91cde9abd8d6faff9a3ef33350393f2fba165
- Date: 2026-10-20
- Verdict: CLEAR

## Event

GM selects a WorldNode tip; WebGL toolbar rebuilds from `ATLAS_TOOL_REGISTRY` via `webglToolChromeForKind`; illegal tools reset to hand; unauthorized map commits are rejected client-side while RPC/RLS remain authority.

## Hop chain

1. Producer: active hierarchy tip (`activeNodeKind`) from WorldAtlasWorkbench / UnifiedAtlasEditor
2. Domain: `webglToolChromeForKind` / `assertWebglToolCommit` (registry SoT; stamps `createsCanonicalNode:false`)
3. Host: `AtlasNative3dEditor` passes chrome + `canEdit` into prototype runtime
4. Consumer A: WebGL `#tools` (`data-atlas-tool-source=registry`) — disabled unsupported tools
5. Consumer B: pointer/material/prop mutations gated by `allowMutation`
6. Persist: existing controlled `onPersist` / map upsert path unchanged

## Simulations

- N-actors: chrome updates on tip change without remounting WebGL; concurrent 2D palette still uses `atlasToolsForKind`.
- Invalid/missing: wall on country / paint when `canEdit=false` → rejected; tool resets to hand.
- Two consumers / crash: chrome is ephemeral UI state; map document remains shared CAS document.

## Flags

(none)

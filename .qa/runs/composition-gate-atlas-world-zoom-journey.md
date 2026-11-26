# Composition Gate — atlas-world-zoom-journey

- Feature slug: atlas-world-zoom-journey
- HEAD_SHA: c83c3416d52cb0d0acf9a4e71ee6bc55b61d5168
- BASE_SHA: 1490c7854b7d6ee45fdb3cccdaefe73f7d27574c
- WORKTREE: Atlas world focus + scene plan/scatter crossfade + explicit document edit separation; existing pre-task backend changes excluded
- Date: 2026-11-26
- Verdict: SKIPPED
- Acceptance tier: browser-host checkpoint, not final visual acceptance

## Skip reason

Frontend domain, renderer and UI composition only. The existing host-owned map
persistence path is unchanged: no new backend, service, database or migration
hop belongs to this checkpoint. Pre-existing unrelated working-tree edits under
`server/src/bootstrap/ensure-dornhain-default.ts` are deliberately excluded.

## Event

A user selects an already located WorldNode or explicitly opens its map for
editing. Focus flies inside the existing multi-map scene; editing uses the same
existing host map document and returns to the saved world camera without saving.

## Hop chain

1. **Producer:** existing Host atlas map read (`useWorldAtlasEditor`) — unchanged.
2. **Domain:** ParentSpatialAnchor chain → world focus target + scene plan — pure TypeScript.
3. **UI/renderer:** Workbench → AtlasThreeWorkstation → multi-map renderer; one scene, no additional product renderer.
4. **Consumer:** same owner-operated editor; no second actor or external side effect.
5. **Explicit edit:** existing host map document upsert only on actual user edits; navigation and return do not write.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| In-world focus | click Dornhain → same shared terrain + canvas | anchor-derived focus, no scene clear, no per-map terrain | pass |
| Detail reveal | zoom → foveated focus path + detail crossfade | domain and browser checks | pass |
| Missing location | unlocated city → honest notice | no invented camera coordinates; explicit edit remains possible | pass |
| Edit / return | explicit document edit → return | saved camera and focus restored without navigation writes | pass |
| Rapid target change | new focus cancels old flight | sequence token / cancellation | pass |
| Active document label | Dornhain stays Dornhain in edit UI | observed header drift in independent preview | **open, Medium** |
| Visual camera journey | Google-Maps-like anchor and scale continuity | end-state tests do not prove intermediate frames | **open, Medium** |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| Edit label drift | Medium | UI state | prior probe focused on end-state IDs and one return | reproduce and fix before final acceptance |
| Camera/scale/visual continuity | Medium | camera → renderer | end-state assertions cannot evaluate visible journey quality | dedicated Atlas camera + Visumaxx visual pass |

This SKIPPED verdict only records the absence of a new composition/persistence
hop. It does not waive or downgrade the two open Medium findings above.

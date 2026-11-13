# ATL2-E01 — Primary maps & six-level WorldNode links

- Issue: #1219
- HEAD: `0f5875fe7da45f06c6d013ab71d90b68e33d4782`
- Verdict: **CLEAR**
- Date: 2026-11-13

## Soll / Ist

| Category | Soll | Ist |
|----------|------|-----|
| Domain six-level plan | room plan = 5 steps w/ primary | **pass-domain** |
| Domain edge matrix | legal edges ok; skip/self rejected | **pass-domain** |
| Host create chain | room → 5 places + 5 primaries + world root | **pass-host** |
| Immutable IDs | rename keeps placeId + mapId | **pass-host** |
| Negatives | skip/cross-world/stranger fail-closed | **pass-host** |

## Host evidence

- Chain kinds: **continent → country → place → building → room**
- Places / primary links / world root maps: **5 / 5 / 1**
- Immutable IDs on rename: **yes**
- Skip rejected: **yes**
- Cross-world rejected: **yes**
- Stranger denied: **yes**

## Residuals

- **Low**: Golden seed room WorldNodes deferred — create path covers room+ancestors.

## Decision

ATL2-E01 primary-map / hierarchy links are **CLEAR**. E02 may open.

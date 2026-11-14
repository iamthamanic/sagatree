# Composition Gate — atl2-g03

- Issue: #1231
- Feature slug: atl2-g03
- HEAD_SHA: 8e60084017694a453eaa4a1941047c50aaf07c17
- BASE_SHA: 60749aeab7811adda0918602635bedb34fc336fe
- Date: 2026-11-14
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none

## Event

Atlas workstation chrome adapts across device bands with documented gesture,
keyboard, and surface-state rules so critical controls stay reachable without a
second mobile map product.

## Hop chain

1. Content band → `resolveAtlasWorkstationComposition`
2. Editor signals → `resolveAtlasWorkstationSurfaceState` → aria-live / data attrs
3. Tool + pointer → `resolveAtlasGestureDisambiguation` (pan vs draw)
4. Band → critical controls + keyboard shortcut allowlist
5. Width floor → `atlasChromeOverflowSafe`

Cardinality: one composition + one surface state per workbench mount.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | GM + player preview | same chrome rules | pass |
| Invalid/missing | empty / error maps | surface state | pass |
| Two consumers | domain + workbench markers | agree | pass |
| Narrow pane | 320px floor | overflow-safe | pass |

## Flags

| Tag | Severity | Hops | Why | Fix |
|-----|----------|------|-----|-----|
| (none) | — | — | — | — |

# Issue #749 — atlas-followup-canonical-2d3d-edits

## Phases
- setup: acceptance present; branch feat/issue-749-atlas-followup-canonical-2d3d-edits
- implement: bidirectional webgl-runtime-bridge + UnifiedAtlasEditor seed/persist wiring
- verify: canonical-2d3d-check + shared-editor-check + typecheck
- composition-gate: CLEAR WORKTREE
- review: ACCEPT
- ecc-check: pending parent

## Notes
Critical fix: empty WebGL props now clear canvas objects (no ghost merge). 2D edits keep webglRuntime derived; 3D remount always seeds from current doc.

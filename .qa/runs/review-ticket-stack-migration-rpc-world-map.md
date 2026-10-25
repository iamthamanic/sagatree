# Review — stack-migration-rpc-world-map
Verdict: APPROVE
Findings:
- Info: world-map-store reads `projects`/`project_members` for membership (same pattern as session-invite). Prefer project read-port in a follow-up if boundary tightening lands.
- Low: empty-map response returns a shallow copy of EMPTY_MAP constants; pins arrays are new via filter path only when forcePlayerView — OK for isolated-contract.
No Critical/Important blockers. RPC-SEC-LEGACY-MAP-FLAG fixed (non-editors always filtered).

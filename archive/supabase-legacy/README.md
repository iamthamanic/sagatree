# Archive — Supabase / Deno Edge (CUT-21 / #1156)

Inert historical evidence only. **Not** product runtime.

- `supabase/` — former Edge Functions, migrations, Kong/config
- `src-supabase/` — former Figma/Make Edge SQL + Deno stubs under `src/supabase`

Do not import these paths from `src/**`, `server/**` product boot, or Vite.
CI / `npm run test-gate` must pass with this tree present but unused (or moved aside).
Docker/docs convergence of compose services is CUT-22 (#1157).
- `src-utils-supabase/` — former `src/utils/supabase` env helpers

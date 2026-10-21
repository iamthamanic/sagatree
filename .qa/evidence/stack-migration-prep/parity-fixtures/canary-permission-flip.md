# PAR-10: actual RLS permission regression canary

Run `npm run canary --prefix scripts/stack-migration-db`.

The clean fixture denies an authenticated foreign owner when selecting the primary
world under actual PostgreSQL RLS. A second fresh fixture adds this real permissive
policy:

```sql
CREATE POLICY baseline_intentional_allow
  ON public.world_profiles FOR SELECT TO authenticated USING (true);
```

The same foreign-owner query must now cause `PAR-10` to fail because it returned a
row. The orchestrator checks the test ID, assertion text, test count, exit status,
and absence of setup/cleanup failures. Unexpected green, missing test, failed
bootstrap and unrelated exceptions all make the canary runner fail.

The intentional mutation is restricted to `--canary-only` and lives only in the
disposable cluster. Canary success is regression-detection evidence, not baseline
security or successor-parity approval. The complete baseline retains its separate
red security probes until the actual product defects are corrected.

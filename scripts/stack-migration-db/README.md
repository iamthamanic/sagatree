# Executable PostgreSQL baseline and isolated Atlas product harness

This harness runs the existing Supabase/PostgreSQL implementation with synthetic
fixtures. It is technical evidence for PREP-08 and Atlas #770. It does not approve
GATE-01, a successor architecture, SQLite parity, or a production migration.

## Run

From the repository root:

```sh
npm ci --prefix scripts/stack-migration-db
npm test --prefix scripts/stack-migration-db
npm run canary --prefix scripts/stack-migration-db
```

`npm test` exits nonzero for any failed assertion or setup failure. The baseline
currently contains reproducible security and functional defects; they are not
whitelisted. A red result is evidence to repair the source implementation before
claiming secure successor parity.

The canary starts two fresh databases. The clean real RLS assertion must pass;
adding one permissive real PostgreSQL policy must make precisely `PAR-10` fail.
Bootstrap failures, missing tests, and an unexpectedly green mutant fail the
canary runner. Canary success proves regression detection, not overall security.

Artifacts default to the ignored `scripts/stack-migration-db/artifacts/`. Both
commands accept `--output /absolute/path` when their `.mjs` runner is invoked
directly. No external database URL, hosted credentials, or service key is read.

### Actual product browser run

```sh
npm ci
python3 scripts/stack-migration-db/provision-tools.py
python3 scripts/stack-migration-db/provision-browser.py
ATLAS_ISOLATED_CHROMIUM="$PWD/scripts/stack-migration-db/artifacts/chromium/chrome-headless-shell-linux64/chrome-headless-shell" \
  npm run product --prefix scripts/stack-migration-db
```

The pinned Linux x86_64 Chrome-for-Testing fallback is used because the session's
Playwright CDN returned a 195-byte “Site Unavailable” HTML response for its ZIP.
On hosts where the CDN is available, installing the harness's own Playwright
Chromium build is also supported; omit `ATLAS_ISOLATED_CHROMIUM` in that case.
Linux browser dependencies must exist; the dedicated CI job installs them with
the pinned Playwright CLI.

`product-run.mjs` also accepts `--tools /absolute/path --output /absolute/path`.
It starts a new database, actual GoTrue and PostgREST binaries, a transparent
loopback proxy, Vite, and Chromium. All password grants and RPC responses come
from those real services. It does not use `page.route`, local-admin fallback,
generated user JWTs, fake REST responses, optional live skips, or external
credentials. The proxy only routes `/auth/v1/` and `/rest/v1/` to the real
processes. The browser suite must execute all three tests without skip/retry.

The proxy does not run Kong's rate-limiting or key-auth plugins. GoTrue uses its
official `GOTRUE_CORS_ALLOWED_HEADERS` setting for `apikey` and
`x-supabase-api-version`, which the Compose gateway's CORS plugin normally
handles. A real CORS preflight is checked before browser execution. This setup
proves the defined Auth/REST/RLS journey, not Kong configuration or abuse limits.

The dedicated config discovers `atlas-product.spec.ts` in this directory. The
ordinary repository `e2e/` suite therefore keeps its existing scope; the isolated
product job is an independent, non-optional CI job. Missing binaries, fixture,
database, authentication, or browser fail that job rather than making it skip.

## Actual database and source provenance

| Component | Pinned source |
| --- | --- |
| PostgreSQL executable | `embedded-postgres@15.18.0-beta.17`, PostgreSQL 15.18; locked npm integrity |
| Supabase platform bootstrap | `supabase/postgres` tag `15.1.0.147`, commit `a3938dc906010ce197c240d0052b3eda9ecac339` |
| GoTrue schema and process | `supabase/auth` tag `v2.143.0`, commit `269895f3257b5d95fda992f48ab6569d87f01a82`; official `supabase/gotrue` image |
| Storage schema | `supabase/storage` tag `v0.40.4`, commit `7ae3410509f168cd15de5a31e9526a95750011e8` |
| SQL-only pgjwt extension | `michelp/pgjwt`, commit `f3d82fd30151e754e19ce5d6a06c71c20689ce3d`, extension 0.2.0 |
| PostgREST process | official `postgrest/postgrest:v12.0.1` image |
| Browser runner | `@playwright/test@1.55.1`, separate lockfile |
| Browser fallback | Google Chrome-for-Testing `140.0.7339.186`, SHA-256 pinned in `provision-browser.py` |

GoTrue/PostgREST image manifests and every downloaded OCI layer are verified
against pinned SHA-256 digests. Only the regular executable files are copied
from the images. No container daemon, image startup script, system package, or
system account is installed by the provisioner. `sources.json` records the
exact binary hashes. Upstream schema bundles retain their exact SQL and license
files, with one checksum per source file. The only GoTrue schema substitution is
its official namespace template set to `auth`.

The PostgreSQL bootstrap is the actual upstream role/schema/default-ACL setup,
not a simplified auth function or test policy. The same `auth.uid()` and actual
`SET LOCAL ROLE authenticated`/`anon` execution rights apply to probes. Public
repository SQL runs unmodified, transactionally, in lexicographic filename order.
The tested checkout has 106 SQL migration files and produces 177 public
functions. No invented legacy “before schema” was needed.

`pg-catalog.json` exports `pg_get_functiondef`, identity and default arguments,
returns, security-definer/search-path/ACL/role execution rights, actual RLS
policies, table ACLs, final column types/defaults/not-null/generated/identity, and
all public constraints. Reports identify the checkout SHA, working harness hashes,
every executed migration hash, platform sources, test results, and timings.

The repository apply script currently omits three files that this complete source
baseline applies: `080_item_thumbnail_webp.sql`,
`082_dornhain_pregen_full_sheets.sql`, and
`108_atlas_worldbuilder_migration_apply.sql`. This is recorded in each report.
The exported schema is evidence about this complete source baseline, not an
assertion that an existing installation used that chain.

## Fixtures and assertions

Owner, GM, two players, foreign owner, and an additional GM of another saga are
separate synthetic accounts. The primary world owner is deliberately not a GM or
member of the primary saga. The second saga shares its world but no player
membership, enabling real cross-saga authorization probes. Player permissions
are assigned through the existing `set_saga_member_bundle` RPC. All production
triggers and policies remain enabled.

The suite covers owner-only world mutation, GM-only session authority, private
maps/NPC bindings, positive party reveal, inventory owner isolation, stale
revision rollback, scoped idempotency, a GM/two-player concurrency race, atomic
event failure, crash before commit, clean restart, authoritative combat, real
dice, and actual anonymous/helper ACL abuse. See
`.qa/design/parity-harness/README.md` for the scenario mapping and current defects.

The event-failure probe installs a test trigger in its disposable database and
removes it in `finally`. The crash probe actually sends SIGKILL to PostgreSQL
before committing and verifies recovery on disk. WAL, fsync, full-page writes,
and synchronous commit remain enabled. Mutation abuse probes read back their
actual database effect and then roll the transaction back.

## Scope limits and cleanup

- PostgreSQL 15.18 is the same major version as the Compose baseline, not an
  exact replica of the Supabase 15.1.0.147 operating-system image.
- The browser test exercises actual Auth, REST, RLS and product rendering.
  Realtime, Edge Functions, Storage HTTP uploads and production deployment are
  not started. Storage schema is present for the unmodified migration chain.
- The synthetic map pack isolates policy behavior; it is not a claim to cover
  every Dornhain/Donalu asset or every #770 editor operation.
- PostgreSQL assertions are not SQLite-host policy/recovery evidence. Those
  require a later executable successor with the approved contract.
- Every database uses a new `/tmp/sagatree-migration-db-*` directory, random
  password, loopback-only ports, and fresh fixture passwords. Credentials stay
  in memory or mode-0600 temporary files and are removed on normal completion.
- Ordinary non-root Linux/macOS users run PostgreSQL under themselves. Root
  execution uses only the pre-existing `nobody` UID/GID 65534. No user is created.
  A UID namespace that maps only root cannot run that child; execute in an
  authorized host context or run the harness as an unprivileged mapped user.

Service and browser provisioning currently supports Linux x86_64. The database
runner supports the Linux/macOS platforms supplied by embedded-postgres. A
forced termination of the entire harness may leave its temporary cluster; remove
only the reported harness-owned temporary directory after stopping its processes.

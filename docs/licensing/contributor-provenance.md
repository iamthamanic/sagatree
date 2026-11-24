# Contributor provenance (PR #684 / 2026-10-14)

Factual investigation only. Git authorship alone does not prove copyright ownership.
No rights, consents, or assignments are invented here.

## Author census (all refs)

| Commits | Author | Email |
| ---: | --- | --- |
| ~1385 | iamthamanic | iamthamanic@gmail.com |
| 4 | Raccoovaclaw | raccoovaclaw@gmx.de |
| 3 | figma[bot] | 198110074+figma[bot]@users.noreply.github.com |
| 1 | Halteverbot Social Mac Pro | halteverbotsocialmacpro@mac.speedport.ip |
| 1 | OpenClaw | openclaw@localhost |
| 1 | OpenClaw Slay | noreply@openclaw.internal |
| 1 | github-actions[bot] | 41898282+github-actions[bot]@users.noreply.github.com |

## Raccoovaclaw commits (named in Codex P1)

| SHA | Subject | Date |
| --- | --- | --- |
| `f297e5836adc` | feat: Add self-hosted setup with Supabase + Edge Functions | 2026-04-05 |
| `798a1508e538` | docs: Add feature comparison with original repos | 2026-04-05 |
| `f726e3207c3f` | docs: Add AGENTS.md with UI/UX rules and integrate Open5e | 2026-04-05 |
| `619c7f7ac462` | feat: Add frontend-backend integration layer | 2026-04-05 |

### Identity evidence (circumstantial, not a rights grant)

- No GitHub user `Raccoovaclaw` exists (API 404). Commit `author` / `committer` on GitHub are `null` (no linked account).
- Name pattern matches owner-side OpenClaw / “Raccoova” branding present on the same workstation (`2-DEV-PROJEKTE/Raccoova`, OpenClaw install under `~/.openclaw`).
- Commits were introduced into a repository owned by `iamthamanic` immediately after Figma Make imports.
- **Filed 2026-10-14:** owner attestation linking these agent identities (incl. `raccoovaclaw@gmx.de`) to GitHub user `iamthamanic` with AGPL-3.0-only grant — [attestations/2026-10-14-agent-identities.md](attestations/2026-10-14-agent-identities.md). Optional civil/legal name line left blank for the owner to type if required.

### Surviving material (HEAD blame, `raccoovaclaw@gmx.de`)

Approximately **8765** blame lines still attributed to that email, including:

- `docker-compose.yml`, `README_SELFHOST.md`, `.env.example` (`setup.sh` and `TEST_RESULTS.md` were deleted in #1328)
- `AGENTS.md`, `FEATURE_COMPARISON.md` (`INTEGRATION.md` deleted in #1328)
- The former FE client stub (`src/lib/*-client.ts`, deleted in #1328)
- Most original Edge Function bodies (`functions/*/index.ts` of the retired backend tree: ai-gm, characters, sessions, dm-tools, lorekeeper, world, npcs, bestiary, rulesets, …)
- The retired backend's `migrations/001_initial.sql` and early gateway `config/*`

These paths remain in the redistributable tree. An exclusion note in `LICENSES.md` alone does **not** authorize redistribution if a third party owns copyright.

### External OSS inspiration vs copy

`FEATURE_COMPARISON.md` compares GameMasterAI, AI-Game-Master-Autonomous, Lorekeeper-MCP, and AI-Dungeon-Master. The Raccoovaclaw commits describe a **new** Deno/hosted-BaaS/Ollama stack rather than a verbatim import of those repos. No LICENSE files from those upstreams were added with the commits. This does **not** prove originality of every line; it only shows no upstream LICENSE was recorded.

The former Edge function `rulesets/index.ts` (retired backend tree) embeds D&D 5e / Pathfinder-shaped catalog data and calls the Open5e HTTP API at runtime. Open5e responses are not vendored as files; embedded SRD-shaped structures still need separate compliance review (OGL / ORC / third-party game content) before claiming clean redistribution.

## Other non-owner authors

### figma[bot] (Figma Make)

- Initial application tree imported via Figma Make (`70d4a232`, `cbab7df2`).
- `src/Attributions.md` records shadcn/ui (MIT) and Unsplash photos.
- Substantial UI has since been rewritten under `iamthamanic`, but residual Make-exported lines remain (e.g. portions of `src/App.tsx`, legacy assets such as `src/assets/5cdcbab5ea0860d6cbb920fecd888377cdc015a0.png`).
- **Filed 2026-10-14:** owner attestation that the Make project was controlled by `iamthamanic` and surviving original Make expression is relicensed AGPL-3.0-only (third-party terms preserved) — [attestations/2026-10-14-figma-make.md](attestations/2026-10-14-figma-make.md).

### OpenClaw / OpenClaw Slay / Halteverbot Social Mac Pro / github-actions[bot]

- Single commits each; later OpenClaw commits are merge/refactor under agent emails.
- Treated as **agent/machine commit identities** on the owner’s workstation unless proven otherwise.
- Covered by the same § A attestation as Raccoovaclaw ([2026-10-14-agent-identities.md](attestations/2026-10-14-agent-identities.md)).

## Existing grants

| Instrument | Present? |
| --- | --- |
| CLA / DCO | No |
| Contributor assignment | No |
| Written Raccoovaclaw / agent AGPL assent | Yes — [2026-10-14-agent-identities.md](attestations/2026-10-14-agent-identities.md) |
| Figma Make AGPL relicense assent | Yes — [2026-10-14-figma-make.md](attestations/2026-10-14-figma-make.md) |
| Retroactive `CONTRIBUTING.md` effect | No (forward-looking only) |

## Minimal remedies (human)

1. **Done (2026-10-14):** Owner executed [OWNER_ATTESTATIONS.md](OWNER_ATTESTATIONS.md) § A and § B under `docs/licensing/attestations/`.
2. **Still open:** § C first-party media; SRD/OGL/Open5e review (see `status.json`).
3. **Alternative (not taken):** Replace or rewrite every surviving Raccoovaclaw-attributed and uncleared Make-attributed expression.
4. **Not sufficient:** Documentation-only exclusion while the code remains published.

Until (1) or (2) is done, `docs/licensing/status.json` → `open_source_release_ready` stays `false` and PR merge must remain **NEEDS_HUMAN**.

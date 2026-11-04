<!-- aiberto-contract:v1 localId=AIBERTO-EPIC -->
# Aiberto — Companion + Core Rulebook (+ controlled tools)

## Type

epic

## Intent

Shell-globaler SagaTree-Companion **Aiberto** (`src/app/ai-assistant`): zuerst versioniertes Core-Rulebook ohne KI, dann quellengebundener Chat, später typisierte Read/Nav- und bestätigte Write-Tools über bestehende Host-Ports — kein zweiter Rules-/AI-Stack, kein AI-GM.

## Goal

1. Release **A**: Core-Regeln finden/lesen ohne Editorverlust (TOC, Suche, dockbares Panel / Phone-Sheet).
2. Release **B**: Chat nur mit Evidence-Gate + serverseitiger Citation-Validation.
3. Release **C1/C2**: kleine Tool-Registry; Character-Reads nur über Owned-Ports; Writes nur Confirm.
4. Optional **E**: MCP-Fassade auf derselben Registry.

## Non-Goals

- Embedding-DB / Elasticsearch / Agenten-Framework
- MCP im MVP
- Session/Combat/Live-Writes in A–C2
- Parallele Regellogik neben `src/domains/rules/sagatree/**`
- FE-Roots `src/modules/**` / `src/components/**`
- Character-Lore public activation als Chat-Backend missbrauchen

## Locked decisions (PO/Tech/Security — 2026-11-04)

| ID | Decision |
| --- | --- |
| Slice path | `ai-assistant` (EN) |
| Start order | After browser-host cutover gate; **do not** parallelize with residual FE-HOST product PRs that touch `App.tsx`/`Layout.tsx` |
| Q-001 | Core index in app bundle + short ORC/license notice in Rulebook UI |
| Q-002 | Host use-case name: `aiberto-ask` |
| Q-003 | Proposals TTL 15 min; audit retention 90 days (configurable); no chat text in audit |
| Q-004 | First C2 write pilot: `inventory.add` (or next reversible inventory command); never delete/publish/live |
| Q-005 | C1 tools only if model supports structured tool calling; else chat without tools |
| Q-006 | Icon: book+spark / Phosphor-first |
| Q-007 | Confirm **per mutation** |
| Character read (C1) | `listOwnedCharacters` / `getOwnedCharacter` (+ linked solo IDs like Library). Optional `character.read` PolicyOp only if implemented in PolicyService (unknown op = DENY). |

## Architecture

```text
docs/sagatree core rules.md
  → scripts/build-rulebook-index.mjs
  → src/domains/rulebook/ (contracts, search, generated JSON)
       ├─ src/app/ai-assistant/     [A UI]
       └─ application/aiberto-ask   [B]
            └─ aiberto-tools        [C1+]
                 └─ public ports + permissions
Optional E: MCP → same registry
```

- Text SoT: Core MD. Compute SoT: `domains/rules/sagatree`.
- AI: extend `server/src/modules/ai` with explicit **text inference** port (media modalities unchanged).
- Auth B+: Better Auth / host session — not GoTrue JWT.

## Issue cut

| ID | GitHub | Release | Title |
| --- | --- | --- | --- |
| Epic | #1123 | — | Aiberto companion |
| AIB-01 | #1124 | A | Rulebook indexer + shared search |
| AIB-02 | #1125 | A | Shell companion + Rulebook browser |
| AIB-03 | #1126 | A | Phase-A QA gate |
| AIB-04 | #1127 | B | Host `aiberto-ask` + text inference + citations |
| AIB-05 | #1128 | B | Chat UI + streaming + degradation |
| AIB-06 | #1129 | C1 | Tool registry Read/Nav (+ owned character ports) |
| AIB-07 | #1130 | C2 | Confirmed write pilot |
| AIB-08 | #1131 | E | MCP facade (follow-up) |
| Docs PR | #1132 | — | Design + acceptance landing |

## UX (summary)

- Surface: Overlay/Companion (AU); Live: CE — default collapsed.
- Desktop: right dock, width resize 320–520px — **not** free-float v1.
- Phone: Sheet (background may block). No 5th bottom-nav item.
- Phase A: Regeln only (no disabled Chat tab).
- Tokens: THEME_GUIDE Cyan/Gold/Slate; Phosphor; `shared/ui`.

## Security

- Least privilege; LLM never supplies roles/ownerIds.
- Citations validated server-side against retrieved set + pinned index revision.
- C2: confirm bind actor/args/TTL/revision; idempotency; audit without secrets.
- List all findings including Low/Info.

## Blockers / sequencing (repo HEAD note)

- Original FE-HOST-07/08/09 (#1099/#1100/#1101): closed.
- Residual FE-HOST product slices (e.g. #1117–#1119): finish or isolate before marking AIB-01 `agent-ready` to avoid shell conflicts.
- AIB-04+ requires text-inference port + stable host auth after cutover.

## Runner

- Feature slug: `aiberto-companion`
- Design: `.qa/design/aiberto-companion.md`
- Acceptance: `.qa/acceptance/aiberto-companion.md`
- Labels (epic): `P1`, `feature`, `Architecture`, `needs-human`
- Checks: `npm run test-gate`, composition-gate per child slug

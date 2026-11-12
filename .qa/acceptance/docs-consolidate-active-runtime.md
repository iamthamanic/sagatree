# Acceptance — docs-consolidate-active-runtime

## Intent

Active SagaTree entry docs describe one code-backed product runtime (React/Vite → Node/Hono → Better Auth / Policy Service / SQLite → local assets). Stale Supabase-as-default claims are corrected or marked historical. No product/runtime code changes.

## Scope

- In: README.md, AGENTS.md, README_SELFHOST.md (link consistency), src/ARCHITECTURE.md, docs/architecture/host-modular-monolith.md (status), docs/architektur-sqlite-based.md (status banner), INTEGRATION.md / AUTH_SETUP / SUPABASE_SETUP banners, .cursor/rules/sagatree.mdc, optional docs drift check
- Out: Product code, schema, Compose behavior, archive contents rewrite

## Happy Path

Given main HEAD after CUT-21/22/23, when a new agent reads README → AGENTS → ARCHITECTURE → README_SELFHOST, they see one consistent host-only stack with archive links for Supabase.

## Skip reason (implement §0)

Docs-only / typo-class work relative to product code; acceptance recorded for PR evidence.

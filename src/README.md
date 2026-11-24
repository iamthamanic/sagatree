# SagaTree — Frontend (`src/`)

React + Vite + TypeScript frontend of SagaTree. It talks only to the SagaTree Node/Hono host
(`server/`) over HTTP/WS with Better Auth cookie sessions; persistence (SQLite/Drizzle), the
Policy Service and the local asset store live in the host.

- Layering, import rules and allowed roots: [`ARCHITECTURE.md`](ARCHITECTURE.md) (#94)
- Design system: [`THEME_GUIDE.md`](THEME_GUIDE.md) · [`guidelines/Guidelines.md`](guidelines/Guidelines.md)
- Host modules and contracts: [`../docs/architecture/host-modular-monolith.md`](../docs/architecture/host-modular-monolith.md)
- Running locally / self-host: [`../README.md`](../README.md) · [`../README_SELFHOST.md`](../README_SELFHOST.md)
- Agent rules: [`../AGENTS.md`](../AGENTS.md)

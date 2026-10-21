# SagaTree host (`server/`)

Registered top-level host package for the Epic #773 modular monolith.

- Binding contract: [`docs/architecture/host-modular-monolith.md`](../docs/architecture/host-modular-monolith.md)
- First enforcement ticket: MIG-010 / #789
- GATE-01: APPROVED — Drizzle + SagaTree Policy Service ([ADR-ST-05](../docs/architecture/ADR-ST-05-gate-01-drizzle-policy.md)); ORM choice does not replace module boundaries

## Layout (MIG-010)

| Path | Role |
| --- | --- |
| `src/bootstrap/` | Composition root (`create-host.ts`, `main.ts`) |
| `src/config/` | Loopback-first config + writable `SAGATREE_DATA_DIR` |
| `src/modules/<id>/` | Public module APIs (`identity`, `permissions`, `ops`) |
| `src/application/<use-case>/` | Vertical use-cases (`health`) |
| `src/http/route-registry.ts` | Sole HTTP composition entry (not a free-for-all under `http/**`) |

## Run

```bash
cd server
SAGATREE_DATA_DIR=/tmp/sagatree-data npm start
# health: GET http://127.0.0.1:8787/health
npm run self-test
```

Default bind is loopback only. Remote bind requires `SAGATREE_ALLOW_REMOTE_BIND=1`.

## Non-claims

This package is the host skeleton only. GATE-02..05 and production cutover are separate human decisions. Persistence/ORM wiring lands in follow-on tickets under the approved Drizzle + Policy Service decision.

# SagaTree host (`server/`)

Registered top-level host package for the Epic #773 modular monolith.

- Binding contract: [`docs/architecture/host-modular-monolith.md`](../docs/architecture/host-modular-monolith.md)
- First enforcement ticket: MIG-010 / #789
- Layout (as implemented in later tickets): `src/bootstrap`, `src/config`, `src/modules/<domain>`, `src/application/<use-case>`, `src/http`, `src/persistence`, `migrations`

This directory is intentionally thin until GATE-01 is human-APPROVED and MIG-010 lands real bootstrap code. Do not treat its presence as ORM or cutover freigabe.

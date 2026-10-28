/**
 * Host-aligned world read contract (MIG-012).
 * Location: src/infrastructure/world/host-world-read.contract.ts
 *
 * Transport-free DTO mirror of `server/src/modules/world` public read port.
 * Full RPC/profile/storage ports live in `host-world-ports.contract.ts` (MIG-313).
 * Frontend adapters stay on Supabase until cutover; this file documents the
 * host shape for parity checks without importing the Node host package.
 */

/** Matches host `WorldReadDto` — no owner id / ORM / HTTP client types. */
export type HostWorldReadDto = {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
};

export type HostWorldReadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

/**
 * Consumer-facing port shape for session/character use-cases once the host
 * is the source of truth. Joins must use these DTOs — never host private paths.
 */
export type HostWorldReadPort = {
  readonly listOwnedWorlds: (actorId: string) => Promise<HostWorldReadResult<readonly HostWorldReadDto[]>>;
  readonly getWorld: (actorId: string, worldId: string) => Promise<HostWorldReadResult<HostWorldReadDto>>;
};

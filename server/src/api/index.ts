/**
 * Host HTTP API public barrel (Hono transport — MIG-020 / GATE-03).
 * Location: server/src/api/index.ts
 */
export { createHostApi, type HostApiDeps } from './create-app.ts';
export { authDenyStatus, transportStatus } from './errors.ts';

/**
 * Host Drizzle schema barrel — composition/persistence only (ADR-ST-05).
 * Location: server/src/persistence/schema/index.ts
 *
 * Product modules must not import this barrel across ownership boundaries;
 * owning modules may mirror tables under modules/<id>/persistence/.
 *
 * Only tables with typed query-builder adapters (or ops journal mirror) are
 * registered here. Other product tables keep using the prepare bridge until
 * their full catalog mirrors land with their adapters (#1043 follow-ons).
 */
export * from './ops.ts';
export * from './world.ts';

import * as ops from './ops.ts';
import * as world from './world.ts';

export const hostSchema = {
  ...ops,
  ...world,
} as const;

export type HostSchema = typeof hostSchema;

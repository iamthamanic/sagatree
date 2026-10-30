/**
 * Host Drizzle schema barrel — composition/persistence only (ADR-ST-05).
 * Location: server/src/persistence/schema/index.ts
 *
 * Product modules must not import this barrel across ownership boundaries;
 * owning modules may mirror tables under modules/<id>/persistence/.
 */
export * from './ops.ts';
export * from './world.ts';
export * from './project.ts';

import * as ops from './ops.ts';
import * as world from './world.ts';
import * as project from './project.ts';

export const hostSchema = {
  ...ops,
  ...world,
  ...project,
} as const;

export type HostSchema = typeof hostSchema;

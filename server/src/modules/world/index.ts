/**
 * world module public API (ports stub — adapters in MIG-012+).
 * Location: server/src/modules/world/index.ts
 */
export type WorldPorts = {
  readonly moduleId: 'world';
};

export function createWorldPorts(): WorldPorts {
  return { moduleId: 'world' };
}

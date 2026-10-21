/**
 * project module public API (ports stub — adapters in MIG-012+).
 * Location: server/src/modules/project/index.ts
 */
export type ProjectPorts = {
  readonly moduleId: 'project';
};

export function createProjectPorts(): ProjectPorts {
  return { moduleId: 'project' };
}

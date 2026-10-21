/**
 * Host permissions facade — re-exports the permissions module public API.
 * Location: server/src/permissions/index.ts (MIG-013 target path)
 */
export {
  createPermissionsPorts,
  type PermissionsPorts,
  type PolicyDecision,
  type PolicyOp,
  type PolicyResource,
} from '../modules/permissions/index.ts';

/**
 * MIG-703 desktop integration public surface. Location: desktop/src/index.ts
 */
export { evaluateDesktopUnlock, type DesktopUnlockReport } from './gate.ts';
export { handleBridgeMessage, type BridgeRequest, type BridgeResult } from './bridge.ts';
export {
  runPlatformLifecycleMatrix,
  desktopPackageRoot,
  type PlatformId,
  type PlatformLifecycleResult,
} from './lifecycle.ts';
export {
  runUpdateRollbackDrill,
  cleanupWorkDir,
  type HostState,
  type UpdateRollbackReport,
} from './update-rollback.ts';

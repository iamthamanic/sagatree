/**
 * MIG-703 desktop integration public surface. Location: desktop/src/index.ts
 */
export {
  evaluateDesktopUnlock,
  type DesktopUnlockReport,
} from './gate.ts';
export {
  handleBridgeMessage,
  type BridgePayload,
  type BridgeTrustedContext,
  type BridgeResult,
} from './bridge.ts';
export {
  runPlatformLifecycleMatrix,
  desktopPackageRoot,
  type PlatformId,
  type PlatformLifecycleResult,
} from './lifecycle.ts';
export {
  runUpdateRollbackDrill,
  cleanupWorkDir,
  createDefaultFsModeHooks,
  permissionsSchema,
  archiveSchema,
  type HostState,
  type FsModeHooks,
  type UpdateRollbackReport,
} from './update-rollback.ts';

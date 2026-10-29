/**
 * Slim public entry for item-model3d ports (MIG-409 / #825).
 * Location: server/src/modules/inventory/item-model3d.ts
 */
export {
  ITEM_MODEL3D_HEADER_MAX_BYTES,
  ITEM_MODEL3D_MAX_BYTES,
  ITEM_MODEL3D_MIME,
  ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED,
  ITEM_MODEL3D_RATE_LIMIT,
  ITEM_MODEL3D_RATE_WINDOW_SECONDS,
  ITEM_MODEL3D_SIGNED_URL_TTL_SECONDS,
  assertDefinitionAuthorized,
  buildItemModel3dAssetKey,
  buildItemModel3dStoragePath,
  checkItemModel3dContentLengthHeader,
  createItemModel3dStore,
  describeItemModel3dLegacyDefects,
  isAllowedItemModel3dMeshyHost,
  itemModel3dConfig,
  itemModel3dGenerate,
  itemModel3dLatestJob,
  itemModel3dRemove,
  itemModel3dResolve,
  itemModel3dStatus,
  itemModel3dUpload,
  seedItemModel3dDefinition,
  sniffItemModel3dGlb,
  stripItemModel3dSecrets,
  validateItemModel3dGlbBytes,
  type ItemModel3dDefinition,
  type ItemModel3dResult,
  type ItemModel3dStore,
} from './internal/item-model3d.ts';

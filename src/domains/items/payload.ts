/**
 * ItemDefinition payload versioning — taxonomy / asset-key contract (#136).
 * Location: src/domains/items/payload.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

/**
 * Version stamped into persisted definition payloads.
 * - Missing / older: legacy mechanical payload (pre-taxonomy); still readable.
 * - 2: taxonomy, provenance, iconKey/assetKey are part of the roundtrip contract.
 */
export const ITEM_DEFINITION_PAYLOAD_VERSION = 2 as const;

export type ItemDefinitionPayloadVersion = typeof ITEM_DEFINITION_PAYLOAD_VERSION;

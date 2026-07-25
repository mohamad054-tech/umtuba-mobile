export {
  isPlatformAdapterBound,
  type PlatformCapabilityAdapter,
  type PlatformEntityAdapter,
  type PlatformNavigationAdapter,
  type PlatformPermissionAdapter,
} from "@/src/lib/platform/adapters";
export {
  listPlatformCapabilities,
  listPlatformModules,
} from "@/src/lib/platform/catalog";
export {
  canOpenPlatformDestination,
  createPlatformDestination,
  mapPlatformDestination,
} from "@/src/lib/platform/destination";
export {
  parsePlatformActionId,
  parsePlatformCapabilityId,
  parsePlatformEntityType,
  parsePlatformModuleId,
  parsePlatformOwnership,
  parsePlatformPermissionId,
  parsePlatformVisibility,
} from "@/src/lib/platform/enums";
export {
  getPlatformFoundationSnapshot,
  isPlatformFoundationConfigured,
} from "@/src/lib/platform/foundation";
export {
  emptyPlatformContext,
  hasPlatformPermission,
  parsePlatformAction,
  parsePlatformCapability,
  parsePlatformContext,
  parsePlatformEntities,
  parsePlatformEntity,
  parsePlatformMetadata,
  parsePlatformModule,
  parsePlatformPermission,
} from "@/src/lib/platform/parse";
export type {
  PlatformAction,
  PlatformActionId,
  PlatformCapability,
  PlatformCapabilityId,
  PlatformContext,
  PlatformDestination,
  PlatformEntity,
  PlatformEntityType,
  PlatformFoundationSnapshot,
  PlatformFoundationStatus,
  PlatformMetadata,
  PlatformMetadataValue,
  PlatformModule,
  PlatformModuleId,
  PlatformOwnership,
  PlatformPermission,
  PlatformPermissionId,
  PlatformVisibility,
} from "@/src/lib/platform/types";

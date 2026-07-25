/**
 * UMTUBA Platform Integration contracts — cross-module, renderer/SDK free.
 * Features bind to these types; this package never invents entities or backends.
 */

export type PlatformEntityType =
  | "user"
  | "video"
  | "course"
  | "lesson"
  | "game"
  | "live"
  | "message"
  | "conversation"
  | "notification"
  | "event"
  | "city"
  | "business"
  | "world"
  | "reward"
  | "future";

export type PlatformActionId =
  | "open"
  | "share"
  | "save"
  | "follow"
  | "join"
  | "start"
  | "resume"
  | "report"
  | "delete"
  | "edit"
  | "mute"
  | "archive"
  | "future";

export type PlatformPermissionId =
  | "view"
  | "edit"
  | "delete"
  | "share"
  | "join"
  | "host"
  | "moderate"
  | "admin"
  | "future";

export type PlatformVisibility =
  | "public"
  | "private"
  | "followers"
  | "organization"
  | "system"
  | "future";

export type PlatformOwnership =
  | "self"
  | "organization"
  | "system"
  | "external"
  | "future";

export type PlatformModuleId =
  | "watch"
  | "discover"
  | "messages"
  | "live"
  | "world"
  | "learning"
  | "games"
  | "notifications"
  | "rewards"
  | "profile"
  | "settings"
  | "future";

/** Bounded primitive metadata only — no nested arbitrary objects. */
export type PlatformMetadataValue = string | number | boolean | null;

export type PlatformMetadata = Record<string, PlatformMetadataValue>;

export type PlatformDestination = {
  /** Raw destination string from a trusted source. */
  raw: string;
  /** Safe mapped in-app href, or null when rejected. */
  href: string | null;
};

export type PlatformPermission = {
  id: PlatformPermissionId;
  granted: boolean;
};

export type PlatformAction = {
  id: PlatformActionId;
  label: string | null;
  enabled: boolean;
  destination: PlatformDestination | null;
};

export type PlatformEntity = {
  id: string;
  type: PlatformEntityType;
  title: string;
  subtitle: string | null;
  module: PlatformModuleId | null;
  visibility: PlatformVisibility;
  ownership: PlatformOwnership;
  destination: PlatformDestination | null;
  metadata: PlatformMetadata;
};

export type PlatformContext = {
  userId: string | null;
  module: PlatformModuleId | null;
  locale: string | null;
  permissions: PlatformPermission[];
};

export type PlatformModule = {
  id: PlatformModuleId;
  label: string;
  /** True only when the mobile app already exposes a real surface. */
  available: boolean;
};

export type PlatformCapabilityId =
  | "navigate"
  | "share"
  | "persist"
  | "realtime"
  | "media_playback"
  | "live_join"
  | "world_render"
  | "future";

export type PlatformCapability = {
  id: PlatformCapabilityId;
  enabled: boolean;
};

export type PlatformFoundationStatus =
  | "unavailable"
  | "ready"
  | "empty"
  | "error";

export type PlatformFoundationSnapshot = {
  status: PlatformFoundationStatus;
  message: string;
  modules: PlatformModule[];
  capabilities: PlatformCapability[];
  context: PlatformContext;
};

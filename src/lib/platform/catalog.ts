import type {
  PlatformCapability,
  PlatformModule,
  PlatformModuleId,
} from "@/src/lib/platform/types";

type ModuleDef = {
  id: PlatformModuleId;
  label: string;
  available: boolean;
};

/**
 * Catalog of platform modules. `available` reflects existing mobile surfaces
 * without inventing Learning/Games/World product readiness.
 */
const MODULE_CATALOG: ModuleDef[] = [
  { id: "watch", label: "Watch", available: true },
  { id: "discover", label: "Discover", available: true },
  { id: "messages", label: "Messages", available: true },
  { id: "live", label: "Live", available: true },
  { id: "notifications", label: "Notifications", available: true },
  { id: "rewards", label: "Rewards", available: true },
  { id: "profile", label: "Profile", available: true },
  { id: "settings", label: "Settings", available: true },
  { id: "world", label: "World", available: false },
  { id: "learning", label: "Learning", available: false },
  { id: "games", label: "Games", available: false },
  { id: "future", label: "Future", available: false },
];

export function listPlatformModules(options?: {
  availableOnly?: boolean;
}): PlatformModule[] {
  const list = MODULE_CATALOG.map((m) => ({ ...m }));
  if (options?.availableOnly) {
    return list.filter((m) => m.available);
  }
  return list;
}

/**
 * Capability flags for the integration layer.
 * Foundation: no invented runtime features — only declare known gaps as false.
 */
export function listPlatformCapabilities(): PlatformCapability[] {
  return [
    { id: "navigate", enabled: true },
    { id: "share", enabled: false },
    { id: "persist", enabled: false },
    { id: "realtime", enabled: false },
    { id: "media_playback", enabled: false },
    { id: "live_join", enabled: false },
    { id: "world_render", enabled: false },
    { id: "future", enabled: false },
  ];
}

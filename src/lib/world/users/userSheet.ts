/**
 * Users bottom-sheet view model — Runtime builds; UI renders only.
 * Only real public identity fields (no placeholder social actions).
 */

import {
  formatWorldUserPresenceLabel,
  userDisplayInitial,
  type WorldUserRecord,
} from "@/src/lib/world/users/types";

export type WorldUserSheetActionId = "view_profile" | "follow" | "message";

export type WorldUserSheetAction = {
  id: WorldUserSheetActionId;
  label: string;
  enabled: boolean;
  placeholder: string;
};

export type WorldUserSheetState = {
  userId: string;
  displayName: string;
  handle: string;
  cityName: string;
  initial: string;
  presenceLabel: string | null;
  open: boolean;
  actions: WorldUserSheetAction[];
};

export function buildWorldUserSheetState(
  record: WorldUserRecord | null,
  open: boolean
): WorldUserSheetState | null {
  if (!record || !open || record.mapVisible !== true) return null;
  return {
    userId: record.id,
    displayName: record.displayName,
    handle: record.handle,
    cityName: record.cityName,
    initial: userDisplayInitial(record.displayName),
    presenceLabel: formatWorldUserPresenceLabel(record.presence),
    open: true,
    actions: [],
  };
}

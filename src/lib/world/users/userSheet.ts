/**
 * Users bottom-sheet view model — Runtime builds; UI renders only.
 * Social actions are placeholders (no real profile/follow/message yet).
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
  /** Always false in V1 — placeholders only. */
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

const PLACEHOLDER_ACTIONS: WorldUserSheetAction[] = [
  {
    id: "view_profile",
    label: "View Profile",
    enabled: false,
    placeholder: "Coming soon",
  },
  {
    id: "follow",
    label: "Follow",
    enabled: false,
    placeholder: "Coming soon",
  },
  {
    id: "message",
    label: "Message",
    enabled: false,
    placeholder: "Coming soon",
  },
];

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
    actions: PLACEHOLDER_ACTIONS.map((a) => ({ ...a })),
  };
}

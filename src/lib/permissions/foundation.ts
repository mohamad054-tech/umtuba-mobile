import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";

export type PermissionKind = "mediaLibrary" | "notifications";

export type MediaLibraryAccessPrivileges = "all" | "limited" | "none";

export type PermissionOutcome = {
  kind: PermissionKind;
  granted: boolean;
  canAskAgain: boolean;
  explanation: string;
  accessPrivileges?: MediaLibraryAccessPrivileges;
};

const EXPLANATIONS: Record<PermissionKind, string> = {
  mediaLibrary:
    "UMTUBA needs media library access so you can choose a video to publish.",
  notifications:
    "UMTUBA can notify you about likes, rewards, and account activity you care about.",
};

function toOutcome(
  result: Awaited<ReturnType<typeof ImagePicker.getMediaLibraryPermissionsAsync>>
): PermissionOutcome {
  return {
    kind: "mediaLibrary",
    granted: result.granted,
    canAskAgain: result.canAskAgain,
    explanation: EXPLANATIONS.mediaLibrary,
    accessPrivileges: result.accessPrivileges,
  };
}

/**
 * Inspect-only. Does not prompt. Create's system photo picker does not need a
 * prior grant; requesting one on iOS can create LIMITED/SELECTED access and
 * restrict expo-image-picker's PHPicker (bound to PHPhotoLibrary.shared()).
 */
export async function inspectMediaLibraryPermission(): Promise<PermissionOutcome> {
  return toOutcome(await ImagePicker.getMediaLibraryPermissionsAsync());
}

/**
 * Prompts for a media-library grant. Do not call this to open the Create
 * gallery picker — use inspect + the system photo picker instead.
 */
export async function requestMediaLibraryPermission(): Promise<PermissionOutcome> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) {
    return toOutcome(current);
  }
  return toOutcome(await ImagePicker.requestMediaLibraryPermissionsAsync());
}

export async function requestNotificationsPermission(): Promise<PermissionOutcome> {
  const current = await Notifications.getPermissionsAsync();
  if (
    current.granted ||
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return {
      kind: "notifications",
      granted: true,
      canAskAgain: current.canAskAgain,
      explanation: EXPLANATIONS.notifications,
    };
  }
  const result = await Notifications.requestPermissionsAsync();
  return {
    kind: "notifications",
    granted: result.granted,
    canAskAgain: result.canAskAgain,
    explanation: EXPLANATIONS.notifications,
  };
}

export function getPermissionExplanation(kind: PermissionKind): string {
  return EXPLANATIONS[kind];
}

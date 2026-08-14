import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";

export type PermissionKind = "mediaLibrary" | "notifications";

export type PermissionOutcome = {
  kind: PermissionKind;
  granted: boolean;
  canAskAgain: boolean;
  explanation: string;
};

const EXPLANATIONS: Record<PermissionKind, string> = {
  mediaLibrary:
    "UMTUBA needs media library access so you can choose a video to publish.",
  notifications:
    "UMTUBA can notify you about likes, rewards, and account activity you care about.",
};

/**
 * Aligns with expo-image-picker (Create gallery flow).
 * On Android 13+, the system photo picker often works without a broad media grant;
 * callers may still open the picker when granted is false on Android.
 */
export async function requestMediaLibraryPermission(): Promise<PermissionOutcome> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) {
    return {
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: current.canAskAgain,
      explanation: EXPLANATIONS.mediaLibrary,
    };
  }
  const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return {
    kind: "mediaLibrary",
    granted: result.granted,
    canAskAgain: result.canAskAgain,
    explanation: EXPLANATIONS.mediaLibrary,
  };
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

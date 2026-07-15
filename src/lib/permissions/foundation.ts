import { Camera } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Notifications from "expo-notifications";

export type PermissionKind =
  | "camera"
  | "microphone"
  | "mediaLibrary"
  | "notifications";

export type PermissionOutcome = {
  kind: PermissionKind;
  granted: boolean;
  canAskAgain: boolean;
  explanation: string;
};

const EXPLANATIONS: Record<PermissionKind, string> = {
  camera:
    "UMTUBA uses the camera so you can capture photos and join video sessions.",
  microphone:
    "UMTUBA uses the microphone so you can record audio and join live sessions.",
  mediaLibrary:
    "UMTUBA needs media library access so you can choose clips and photos to share.",
  notifications:
    "UMTUBA can notify you about likes, rewards, and live activity you care about.",
};

/** Foundation-only wrappers — Phase 2 wires these into Create / Live flows. */
export async function requestCameraPermission(): Promise<PermissionOutcome> {
  const current = await Camera.getCameraPermissionsAsync();
  if (current.granted) {
    return {
      kind: "camera",
      granted: true,
      canAskAgain: current.canAskAgain,
      explanation: EXPLANATIONS.camera,
    };
  }
  const result = await Camera.requestCameraPermissionsAsync();
  return {
    kind: "camera",
    granted: result.granted,
    canAskAgain: result.canAskAgain,
    explanation: EXPLANATIONS.camera,
  };
}

export async function requestMicrophonePermission(): Promise<PermissionOutcome> {
  const current = await Camera.getMicrophonePermissionsAsync();
  if (current.granted) {
    return {
      kind: "microphone",
      granted: true,
      canAskAgain: current.canAskAgain,
      explanation: EXPLANATIONS.microphone,
    };
  }
  const result = await Camera.requestMicrophonePermissionsAsync();
  return {
    kind: "microphone",
    granted: result.granted,
    canAskAgain: result.canAskAgain,
    explanation: EXPLANATIONS.microphone,
  };
}

export async function requestMediaLibraryPermission(): Promise<PermissionOutcome> {
  const current = await MediaLibrary.getPermissionsAsync();
  if (current.granted) {
    return {
      kind: "mediaLibrary",
      granted: true,
      canAskAgain: current.canAskAgain,
      explanation: EXPLANATIONS.mediaLibrary,
    };
  }
  const result = await MediaLibrary.requestPermissionsAsync();
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

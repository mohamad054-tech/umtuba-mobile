import * as ImagePicker from "expo-image-picker";

import { umStreakText } from "./copy";

export type CameraPermissionOutcome = {
  granted: boolean;
  canAskAgain: boolean;
  explanation: string;
};

export async function requestCameraPermission(): Promise<CameraPermissionOutcome> {
  const explanation = umStreakText("cameraPermission");
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) {
    return {
      granted: true,
      canAskAgain: current.canAskAgain,
      explanation,
    };
  }
  const result = await ImagePicker.requestCameraPermissionsAsync();
  return {
    granted: result.granted,
    canAskAgain: result.canAskAgain,
    explanation,
  };
}

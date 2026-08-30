import { AccessibilityInfo } from "react-native";

let reduced = false;
let subscribed = false;

export function watchPrefersReducedMotion(): boolean {
  if (!subscribed) {
    subscribed = true;
    try {
      void AccessibilityInfo.isReduceMotionEnabled?.().then((value) => {
        reduced = value === true;
      });
      AccessibilityInfo.addEventListener?.("reduceMotionChanged", (value) => {
        reduced = value === true;
      });
    } catch {
      reduced = false;
    }
  }
  return reduced;
}

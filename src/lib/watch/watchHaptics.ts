/**
 * Subtle Watch haptics. Missing native module is a no-op (tests / web).
 */
export function watchLightHaptic(): void {
  void import("expo-haptics")
    .then((Haptics) =>
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    )
    .catch(() => undefined);
}

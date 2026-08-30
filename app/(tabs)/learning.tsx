import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";

import {
  OFFICIAL_WEB_DESTINATIONS,
  umLifeNavCopy,
} from "@/src/lib/nav/umLifeHomeEntry";
import { colors } from "@/src/theme/colors";

export default function LearningTabScreen() {
  const copy = umLifeNavCopy(I18nManager.isRTL ? "ar" : "en");
  const [error, setError] = useState<string | null>(null);

  const openLearning = useCallback(async () => {
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(OFFICIAL_WEB_DESTINATIONS.learning);
    } catch {
      setError("Unable to open Learning.");
    }
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">
        {copy.learning}
      </Text>
      <Text style={styles.body}>
        Learning opens the official UMTUBA Learning surface. Native Learning is
        not shipped on this mobile base.
      </Text>
      <Pressable
        onPress={() => void openLearning()}
        accessibilityRole="button"
        accessibilityLabel={copy.openLearning}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonLabel}>{copy.openLearning}</Text>
      </Pressable>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
    gap: 16,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  pressed: { opacity: 0.85 },
  buttonLabel: {
    color: colors.accentCyan,
    fontSize: 15,
    fontWeight: "700",
  },
  error: { color: colors.danger, fontSize: 13 },
});

import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { I18nManager, Pressable, StyleSheet, Text, View } from "react-native";

import {
  OFFICIAL_WEB_DESTINATIONS,
  umLifeNavCopy,
} from "@/src/lib/nav/umLifeHomeEntry";
import { colors } from "@/src/theme/colors";

export default function StoreTabScreen() {
  const copy = umLifeNavCopy(I18nManager.isRTL ? "ar" : "en");
  const [error, setError] = useState<string | null>(null);

  const openStore = useCallback(async () => {
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(OFFICIAL_WEB_DESTINATIONS.store);
    } catch {
      setError("Unable to open Store.");
    }
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title} accessibilityRole="header">
        {copy.store}
      </Text>
      <Text style={styles.body}>
        Store opens the official UMTUBA Store surface. Native Store is not
        shipped on this mobile base.
      </Text>
      <Pressable
        onPress={() => void openStore()}
        accessibilityRole="button"
        accessibilityLabel={copy.openStore}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonLabel}>{copy.openStore}</Text>
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

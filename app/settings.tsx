import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme/colors";

export default function SettingsScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.body}>
        Account preferences, notification controls, and privacy options arrive
        in Phase 2.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  body: {
    color: colors.textMuted,
    lineHeight: 22,
  },
});

import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme/colors";

export default function NotificationsScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.body}>
        Inbox sync and push delivery land in Phase 2. Permission helper is
        already available under Create.
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

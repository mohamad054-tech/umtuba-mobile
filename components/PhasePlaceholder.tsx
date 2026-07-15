import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme/colors";

type PhasePlaceholderProps = {
  title: string;
  body: string;
  /** When true, do not expand to fill the screen (e.g. Create tab with controls below). */
  compact?: boolean;
};

export function PhasePlaceholder({
  title,
  body,
  compact = false,
}: PhasePlaceholderProps) {
  return (
    <View style={[styles.wrap, compact ? styles.compact : styles.fill]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Text style={styles.badge}>Phase 2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg,
    padding: 24,
  },
  fill: {
    flex: 1,
    justifyContent: "center",
  },
  compact: {
    paddingBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  badge: {
    alignSelf: "flex-start",
    color: colors.accentCyan,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "600",
  },
});

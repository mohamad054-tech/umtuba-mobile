import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/theme/colors";

type WorldHeaderProps = {
  title?: string;
  subtitle: string;
  statusLabel: string;
};

export function WorldHeader({
  title = "World",
  subtitle,
  statusLabel,
}: WorldHeaderProps) {
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <View style={styles.row}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <View
          style={styles.badge}
          accessibilityRole="text"
          accessibilityLabel={`World status: ${statusLabel}`}
        >
          <Text style={styles.badgeText}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  badge: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: "center",
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});

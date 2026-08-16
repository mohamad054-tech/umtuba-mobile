import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

type WorldHeaderProps = {
  title?: string;
  subtitle?: string;
  statusLabel: string;
  compact?: boolean;
};

export function WorldHeader({
  title,
  subtitle,
  statusLabel,
  compact = false,
}: WorldHeaderProps) {
  const { t } = useTranslation();
  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact]}
      accessibilityRole="header"
    >
      <View style={styles.row}>
        <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
          {title ?? t("world.title")}
        </Text>
        <View
          style={styles.badge}
          accessibilityRole="text"
          accessibilityLabel={t("world.statusA11y", {
            values: { status: statusLabel },
          })}
        >
          <Text style={styles.badgeText}>{statusLabel}</Text>
        </View>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 6,
  },
  wrapCompact: {
    paddingBottom: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  titleCompact: {
    fontSize: 18,
  },
  badge: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 28,
    justifyContent: "center",
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});

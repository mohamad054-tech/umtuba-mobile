import { StyleSheet, Text, View } from "react-native";

import { liveStatusLabel } from "@/src/lib/live";
import type { LiveSessionStatus } from "@/src/lib/live";
import { colors } from "@/src/theme/colors";

type LiveStatusBadgeProps = {
  status: LiveSessionStatus;
};

export function LiveStatusBadge({ status }: LiveStatusBadgeProps) {
  const label = liveStatusLabel(status);
  const isLive = status === "live";

  return (
    <View
      style={[
        styles.badge,
        isLive && styles.badgeLive,
        status === "scheduled" && styles.badgeScheduled,
        (status === "ended" || status === "cancelled") && styles.badgeEnded,
        status === "unavailable" && styles.badgeUnavailable,
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Status ${label}`}
    >
      <Text
        style={[styles.text, isLive && styles.textLive]}
        accessible={false}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    minHeight: 24,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  badgeLive: {
    borderColor: colors.danger,
    backgroundColor: "rgba(248,113,113,0.12)",
  },
  badgeScheduled: {
    borderColor: colors.accentCyan,
    backgroundColor: "rgba(34,211,238,0.10)",
  },
  badgeEnded: {
    opacity: 0.85,
  },
  badgeUnavailable: {
    opacity: 0.7,
  },
  text: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  textLive: {
    color: colors.danger,
  },
});

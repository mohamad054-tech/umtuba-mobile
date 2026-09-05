import { StyleSheet, Text, View } from "react-native";

import { umStreakStateLabel, umStreakText } from "@/src/lib/umStreak/copy";
import {
  detectUmStreakLocale,
  umStreakDirection,
  umStreakFlexDirection,
} from "@/src/lib/umStreak/locale";
import type { UmStreakViewerStatus } from "@/src/lib/umStreak/types";
import { colors } from "@/src/theme/colors";

type UmStreakStatusProps = {
  streak: UmStreakViewerStatus;
  compact?: boolean;
};

export function UmStreakStatus({
  streak,
  compact = false,
}: UmStreakStatusProps) {
  const locale = detectUmStreakLocale();
  const label = umStreakStateLabel(streak.state, locale);

  if (streak.currentStreak <= 0 && streak.state === "none") {
    return null;
  }

  return (
    <View
      style={[
        styles.chip,
        { flexDirection: umStreakFlexDirection(locale) },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${umStreakText("title", locale)} ${streak.currentStreak}. ${label}`}
    >
      <Text style={styles.fire} accessibilityElementsHidden>
        🔥
      </Text>
      <Text style={styles.count}>{streak.currentStreak}</Text>
      {!compact ? (
        <Text
          style={[styles.label, { writingDirection: umStreakDirection(locale) }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  fire: { fontSize: 12 },
  count: {
    color: colors.accentAmber,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  label: {
    color: "rgba(254,243,199,0.85)",
    fontWeight: "600",
    fontSize: 12,
    maxWidth: 180,
  },
});

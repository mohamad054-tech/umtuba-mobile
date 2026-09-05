import { StyleSheet, Text, View } from "react-native";

import { umStreakBadgeLabel, umStreakText } from "@/src/lib/umStreak/copy";
import {
  detectUmStreakLocale,
  umStreakDirection,
} from "@/src/lib/umStreak/locale";
import type { UmStreakViewerStatus } from "@/src/lib/umStreak/types";
import { colors } from "@/src/theme/colors";

export function UmStreakBadges({
  streak,
}: {
  streak: UmStreakViewerStatus;
}) {
  const locale = detectUmStreakLocale();

  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={umStreakText("badges", locale)}
    >
      {streak.badges.map((badge) => (
        <View
          key={badge.days}
          style={[styles.chip, badge.earned ? styles.earned : styles.locked]}
        >
          <Text
            style={[
              styles.label,
              badge.earned ? styles.earnedText : styles.lockedText,
              { writingDirection: umStreakDirection(locale) },
            ]}
          >
            {umStreakBadgeLabel(badge.days, locale)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  earned: {
    borderColor: "rgba(251,191,36,0.5)",
    backgroundColor: "rgba(251,191,36,0.15)",
  },
  locked: {
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  label: { fontSize: 11, fontWeight: "700" },
  earnedText: { color: "#fef3c7" },
  lockedText: { color: "rgba(255,255,255,0.4)" },
});

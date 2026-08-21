import { StyleSheet, Text, View } from "react-native";

import type { ProfileTranslate } from "@/components/profile/profileUi";
import type { AppLocale } from "@/src/lib/i18n/locales";
import { localeWritingDirection } from "@/src/lib/i18n/rtl";
import { colors } from "@/src/theme/colors";

type ProfileStatsRowProps = {
  locale: AppLocale;
  t: ProfileTranslate;
  followersCount: number | null;
  followingCount: number | null;
  postsCount: number;
};

export default function ProfileStatsRow({
  locale,
  t,
  followersCount,
  followingCount,
  postsCount,
}: ProfileStatsRowProps) {
  if (followersCount == null && followingCount == null && postsCount === 0) {
    return null;
  }

  return (
    <View
      style={[styles.statsRow, { direction: localeWritingDirection(locale) }]}
    >
      <View style={styles.stat}>
        <Text style={styles.statValue}>{followersCount ?? 0}</Text>
        <Text style={styles.statLabel}>{t("profile.followers")}</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.statValue}>{followingCount ?? 0}</Text>
        <Text style={styles.statLabel}>{t("profile.following")}</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.statValue}>{postsCount}</Text>
        <Text style={styles.statLabel}>{t("profile.posts")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    marginTop: 18,
    marginHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
});

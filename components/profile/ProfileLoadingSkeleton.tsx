import { StyleSheet, View } from "react-native";

import type { ProfileTranslate } from "@/components/profile/profileUi";
import { colors } from "@/src/theme/colors";

type ProfileLoadingSkeletonProps = {
  t: ProfileTranslate;
};

export default function ProfileLoadingSkeleton({
  t,
}: ProfileLoadingSkeletonProps) {
  return (
    <View
      style={styles.block}
      accessibilityRole="progressbar"
      accessibilityLabel={t("profile.loading")}
    >
      <View style={styles.lineWide} />
      <View style={styles.lineMid} />
      <View style={styles.card} />
      <View style={styles.card} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: 20,
    gap: 10,
  },
  lineWide: {
    height: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    width: "70%",
  },
  lineMid: {
    height: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    width: "44%",
  },
  card: {
    height: 88,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

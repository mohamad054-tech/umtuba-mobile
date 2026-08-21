import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import type { ProfileTranslate } from "@/components/profile/profileUi";
import { colors } from "@/src/theme/colors";

type ProfileActionsRowProps = {
  t: ProfileTranslate;
  isOwn: boolean;
  following: boolean;
  followBusy: boolean;
  followError: string | null;
  canShare: boolean;
  shareBusy?: boolean;
  onEdit: () => void;
  onFollow: () => void;
  onShare: () => void;
};

export default function ProfileActionsRow({
  t,
  isOwn,
  following,
  followBusy,
  followError,
  canShare,
  shareBusy = false,
  onEdit,
  onFollow,
  onShare,
}: ProfileActionsRowProps) {
  return (
    <View style={styles.block}>
      {isOwn ? (
        <Pressable
          style={styles.primaryBtn}
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={t("profile.editProfile")}
        >
          <Text style={styles.primaryBtnText}>{t("profile.editProfile")}</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[
            styles.primaryBtn,
            following && styles.followBtnOn,
            followBusy && styles.buttonDisabled,
          ]}
          onPress={onFollow}
          disabled={followBusy}
          accessibilityRole="button"
          accessibilityLabel={
            following ? t("follow.following") : t("follow.follow")
          }
          accessibilityState={{ selected: following, busy: followBusy }}
        >
          {followBusy ? (
            <ActivityIndicator
              color={following ? colors.accentCyan : colors.bg}
            />
          ) : (
            <Text
              style={[styles.primaryBtnText, following && styles.followBtnTextOn]}
            >
              {following ? t("follow.following") : t("follow.follow")}
            </Text>
          )}
        </Pressable>
      )}
      {canShare ? (
        <Pressable
          style={[styles.secondaryBtn, shareBusy && styles.buttonDisabled]}
          onPress={onShare}
          disabled={shareBusy}
          accessibilityRole="button"
          accessibilityLabel={t("profile.share")}
        >
          {shareBusy ? (
            <ActivityIndicator color={colors.accentCyan} />
          ) : (
            <Text style={styles.secondaryBtnText}>{t("profile.share")}</Text>
          )}
        </Pressable>
      ) : null}
      {followError ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {followError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 16,
    marginHorizontal: 20,
    gap: 8,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  followBtnOn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryBtnText: {
    color: colors.bg,
    fontWeight: "700",
    fontSize: 16,
  },
  followBtnTextOn: {
    color: colors.text,
  },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  secondaryBtnText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
  },
  buttonDisabled: { opacity: 0.7 },
  errorText: {
    color: colors.danger,
  },
});

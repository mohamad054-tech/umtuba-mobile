import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import { chevronGlyph } from "@/src/lib/i18n/rtl";
import { getProfileById, getProfileByUsername } from "@/src/lib/auth/profile";
import type { UserProfile } from "@/src/lib/auth/types";
import { buildProfilePresentation } from "@/src/lib/profile";
import {
  planOtherProfileLookup,
  resolveProfileTarget,
} from "@/src/lib/profile/resolveTarget";
import {
  getProfileFollowSnapshot,
  toggleProfileFollow,
} from "@/src/lib/social/follows";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

export default function ProfileScreen() {
  const { profile, user, loading, error, restore, clearError } = useAuth();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ u?: string; id?: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);
  const [otherStatus, setOtherStatus] = useState<
    "idle" | "loading" | "missing" | "error"
  >("idle");
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  const target = useMemo(
    () =>
      resolveProfileTarget({
        queryUsername: params.u,
        queryUserId: params.id,
        signedInUsername: profile?.username ?? null,
        signedInUserId: user?.id ?? profile?.id ?? null,
      }),
    [params.id, params.u, profile?.id, profile?.username, user?.id]
  );
  const isOwn = target.kind === "own";

  useEffect(() => {
    if (target.kind !== "other") {
      setOtherProfile(null);
      setOtherStatus("idle");
      setFollowing(false);
      setFollowError(null);
      return;
    }

    const plan = planOtherProfileLookup(target);
    let cancelled = false;
    setOtherStatus("loading");
    setFollowError(null);

    void (async () => {
      try {
        const primary =
          plan.primary.field === "id"
            ? await getProfileById(plan.primary.value)
            : await getProfileByUsername(plan.primary.value);
        const row =
          primary ??
          (plan.fallback
            ? await getProfileByUsername(plan.fallback.value)
            : null);
        if (cancelled) return;
        if (!row) {
          setOtherProfile(null);
          setOtherStatus("missing");
          return;
        }
        setOtherProfile(row);
        setOtherStatus("idle");
        const snap = await getProfileFollowSnapshot(getSupabase(), row.id);
        if (cancelled) return;
        if (snap.ok) {
          setFollowing(snap.following);
        }
      } catch {
        if (!cancelled) {
          setOtherProfile(null);
          setOtherStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [target]);

  const view = buildProfilePresentation(
    isOwn ? profile : otherProfile,
    isOwn ? user : null
  );

  const onRetry = useCallback(async () => {
    clearError();
    setRefreshing(true);
    try {
      await restore();
    } finally {
      setRefreshing(false);
    }
  }, [clearError, restore]);

  const onToggleFollow = useCallback(async () => {
    if (!otherProfile?.id) return;
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }
    setFollowBusy(true);
    setFollowError(null);
    const previous = following;
    setFollowing(!previous);
    try {
      const result = await toggleProfileFollow(getSupabase(), otherProfile.id);
      if (!result.ok) {
        setFollowing(previous);
        setFollowError(result.message);
        if (result.requiresAuth) {
          router.replace("/(auth)/login");
        }
        return;
      }
      setFollowing(result.following);
    } finally {
      setFollowBusy(false);
    }
  }, [following, otherProfile?.id, router, user]);

  if (loading && !user && isOwn) {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        <View
          style={styles.center}
          accessibilityLabel={t("profile.loading")}
          accessibilityRole="progressbar"
        >
          <ActivityIndicator color={colors.accentCyan} size="large" />
          <Text style={styles.muted}>{t("profile.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isOwn && !user) {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle} accessibilityRole="header">
            {t("auth.required.title")}
          </Text>
          <Text style={styles.muted}>
            {t("auth.required.profile")}
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
            accessibilityLabel={t("actions.signIn")}
          >
            <Text style={styles.primaryBtnText}>{t("actions.signIn")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!isOwn && otherStatus === "loading") {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        <View
          style={styles.center}
          accessibilityLabel={t("profile.loading")}
          accessibilityRole="progressbar"
        >
          <ActivityIndicator color={colors.accentCyan} size="large" />
          <Text style={styles.muted}>{t("profile.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isOwn && (otherStatus === "missing" || otherStatus === "error")) {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle} accessibilityRole="header">
            {t("profile.notFound")}
          </Text>
          <Text style={styles.muted}>
            {otherStatus === "error"
              ? t("profile.loadFailed")
              : t("profile.unavailableAccount")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={styles.avatar}
          accessibilityLabel={
            view.hasReliableIdentity
              ? t("profile.avatarFor", {
                  values: {
                    name: view.displayName || view.username || t("profile.you"),
                  },
                })
              : t("profile.avatarPlaceholder")
          }
        >
          {view.avatarUrl ? (
            <Image
              source={{ uri: view.avatarUrl }}
              style={styles.avatarImage}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Text style={styles.avatarText} accessible={false}>
              {view.avatarInitial}
            </Text>
          )}
        </View>

        {view.hasReliableIdentity ? (
          <>
            <Text style={styles.name} accessibilityRole="header">
              {view.displayName || view.username || t("profile.account")}
            </Text>
            {view.username ? (
              <Text style={styles.username}>@{view.username}</Text>
            ) : null}
            {view.bio ? <Text style={styles.bio}>{view.bio}</Text> : null}
            {view.locationLine ? (
              <Text style={styles.meta}>{view.locationLine}</Text>
            ) : null}
            {isOwn && view.email ? (
              <Text
                style={styles.meta}
                accessibilityLabel={`Email ${view.email}`}
              >
                {view.email}
              </Text>
            ) : null}
          </>
        ) : (
          <View style={styles.banner} accessibilityRole="alert">
            <Text style={styles.emptyTitle}>{t("profile.detailsUnavailable")}</Text>
            <Text style={styles.muted}>
              {t("profile.detailsUnavailableBody")}
            </Text>
            {isOwn ? (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => void onRetry()}
                disabled={refreshing}
                accessibilityRole="button"
                accessibilityLabel={t("actions.retry")}
              >
                {refreshing ? (
                  <ActivityIndicator color={colors.accentCyan} />
                ) : (
                  <Text style={styles.secondaryBtnText}>{t("actions.retry")}</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        )}

        {isOwn && error ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={() => void onRetry()}
              accessibilityRole="button"
              accessibilityLabel={t("actions.retry")}
            >
              <Text style={styles.retryLink}>{t("actions.retry")}</Text>
            </Pressable>
          </View>
        ) : null}

        {!isOwn && otherProfile ? (
          <View style={styles.followBlock}>
            <Pressable
              style={[
                styles.followBtn,
                following && styles.followBtnOn,
                followBusy && styles.buttonDisabled,
              ]}
              onPress={() => void onToggleFollow()}
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
                  style={[
                    styles.followBtnText,
                    following && styles.followBtnTextOn,
                  ]}
                >
                  {following ? t("follow.following") : t("follow.follow")}
                </Text>
              )}
            </Pressable>
            {followError ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {followError}
              </Text>
            ) : null}
          </View>
        ) : null}

        {isOwn ? (
          <>
            <Text style={styles.sectionLabel}>{t("profile.shortcuts")}</Text>
            <View style={styles.links}>
              <Link href="/rewards" asChild>
                <Pressable
                  style={styles.linkRow}
                  accessibilityRole="link"
                  accessibilityLabel={t("profile.openRewards")}
                >
                  <Text style={styles.linkText}>{t("rewards.title")}</Text>
                  <Text style={styles.chevron} accessible={false}>
                    {chevronGlyph(locale)}
                  </Text>
                </Pressable>
              </Link>
              <Link href="/notifications" asChild>
                <Pressable
                  style={styles.linkRow}
                  accessibilityRole="link"
                  accessibilityLabel={t("profile.openNotifications")}
                >
                  <Text style={styles.linkText}>{t("settings.notifications")}</Text>
                  <Text style={styles.chevron} accessible={false}>
                    {chevronGlyph(locale)}
                  </Text>
                </Pressable>
              </Link>
              <Link href="/settings" asChild>
                <Pressable
                  style={styles.linkRow}
                  accessibilityRole="link"
                  accessibilityLabel={t("profile.openSettings")}
                >
                  <Text style={styles.linkText}>{t("settings.title")}</Text>
                  <Text style={styles.chevron} accessible={false}>
                    {chevronGlyph(locale)}
                  </Text>
                </Pressable>
              </Link>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  username: {
    color: colors.accentCyan,
    marginTop: 4,
    marginBottom: 10,
  },
  bio: {
    color: colors.textMuted,
    marginBottom: 8,
    lineHeight: 20,
  },
  meta: {
    color: colors.textSubtle,
    fontSize: 13,
    marginBottom: 4,
  },
  muted: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  banner: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  errorBox: {
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  errorText: {
    color: colors.danger,
    marginBottom: 8,
  },
  retryLink: {
    color: colors.accentCyan,
    fontWeight: "600",
  },
  followBlock: {
    marginTop: 16,
    gap: 8,
  },
  followBtn: {
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
  followBtnText: {
    color: colors.bg,
    fontWeight: "700",
    fontSize: 16,
  },
  followBtnTextOn: {
    color: colors.text,
  },
  buttonDisabled: { opacity: 0.7 },
  sectionLabel: {
    marginTop: 24,
    marginBottom: 10,
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  links: {
    gap: 10,
  },
  linkRow: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
  },
  chevron: {
    color: colors.textSubtle,
    fontSize: 22,
    lineHeight: 22,
  },
  primaryBtn: {
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.accentViolet,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: colors.text,
    fontWeight: "700",
  },
  secondaryBtn: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryBtnText: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
});

import { useStackedOriginBackEffects } from "@/components/GlobalBackButton";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ProfileAboutBlock from "@/components/profile/ProfileAboutBlock";
import ProfileActionsRow from "@/components/profile/ProfileActionsRow";
import ProfileHero from "@/components/profile/ProfileHero";
import ProfileLoadingSkeleton from "@/components/profile/ProfileLoadingSkeleton";
import ProfileStatsRow from "@/components/profile/ProfileStatsRow";
import ProfileTabStrip from "@/components/profile/ProfileTabStrip";
import ProfileTimeline from "@/components/profile/ProfileTimeline";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import { chevronGlyph, localeRootStyle, localeTextAlign } from "@/src/lib/i18n/rtl";
import { getProfileById, getProfileByUsername } from "@/src/lib/auth/profile";
import type { UserProfile } from "@/src/lib/auth/types";
import { buildProfilePresentation } from "@/src/lib/profile";
import {
  buildProfileTimeline,
  type ProfileTimelineItem,
} from "@/src/lib/profile/buildProfileTimeline";
import {
  listProfilePosts,
  type ProfilePostItem,
} from "@/src/lib/profile/listProfilePosts";
import {
  listProfileVideos,
  type ProfileVideoItem,
} from "@/src/lib/profile/listProfileVideos";
import { emptyProfileAboutExtras } from "@/src/lib/profile/profileAbout";
import {
  resolveProfileContentWidth,
  resolveProfileMediaBox,
} from "@/src/lib/profile/profileLayout";
import { buildProfileShareUrl } from "@/src/lib/profile/profileShareUrl";
import {
  getVisibleMobileProfileTabs,
  resolveActiveMobileProfileTab,
  type MobileProfileTabId,
} from "@/src/lib/profile/profileTabs";
import { rememberProfileBackContext } from "@/src/lib/nav/profileBackContext";
import { buildFollowListHref } from "@/src/lib/profile/followListNav";
import { parseProfileNavOrigin } from "@/src/lib/profile/profileNav";
import {
  planOtherProfileLookup,
  resolveProfileTarget,
} from "@/src/lib/profile/resolveTarget";
import {
  resolveFollowListOpenTarget,
  type FollowListKind,
} from "@/src/lib/social/followLists";
import {
  getProfileFollowSnapshot,
  toggleProfileFollow,
} from "@/src/lib/social/follows";
import { defaultShareLinkPort } from "@/src/lib/social/sharePost";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

export default function ProfileScreen() {
  useStackedOriginBackEffects();
  const { profile, user, loading, error, restore, clearError } = useAuth();
  const { t, locale } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const columnWidth = resolveProfileContentWidth(windowWidth);
  const mediaBox = resolveProfileMediaBox(windowWidth, columnWidth);
  const router = useRouter();
  const params = useLocalSearchParams<{
    u?: string;
    id?: string;
    tab?: string;
    from?: string;
  }>();
  const [refreshing, setRefreshing] = useState(false);
  const [otherProfile, setOtherProfile] = useState<UserProfile | null>(null);
  const [otherStatus, setOtherStatus] = useState<
    "idle" | "loading" | "missing" | "error"
  >("idle");
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [videos, setVideos] = useState<ProfileVideoItem[]>([]);
  const [videosFailed, setVideosFailed] = useState(false);
  const [posts, setPosts] = useState<ProfilePostItem[]>([]);
  const [postsFailed, setPostsFailed] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [requestedTab, setRequestedTab] = useState<string | null>(
    typeof params.tab === "string" ? params.tab : null
  );

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
  const aboutExtras = useMemo(() => emptyProfileAboutExtras(), []);

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
          setFollowersCount(snap.followersCount);
          setFollowingCount(snap.followingCount);
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

  const contentUserId = isOwn
    ? user?.id ?? profile?.id ?? null
    : otherProfile?.id ?? null;

  useEffect(() => {
    if (!contentUserId) {
      setVideos([]);
      setPosts([]);
      setVideosFailed(false);
      setPostsFailed(false);
      setContentLoading(false);
      if (isOwn) {
        setFollowersCount(null);
        setFollowingCount(null);
      }
      return;
    }

    let cancelled = false;
    setContentLoading(true);
    setVideosFailed(false);
    setPostsFailed(false);

    void (async () => {
      const supabase = getSupabase();
      const [videoPage, postPage, snap] = await Promise.all([
        listProfileVideos(supabase, contentUserId),
        listProfilePosts(supabase, contentUserId),
        getProfileFollowSnapshot(supabase, contentUserId),
      ]);
      if (cancelled) return;
      setVideos(videoPage.videos);
      setVideosFailed(Boolean(videoPage.failed));
      setPosts(postPage.posts);
      setPostsFailed(Boolean(postPage.failed));
      setContentLoading(false);
      if (snap.ok) {
        if (isOwn) setFollowing(false);
        setFollowersCount(snap.followersCount);
        setFollowingCount(snap.followingCount);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contentUserId, isOwn]);

  const view = buildProfilePresentation(
    isOwn ? profile : otherProfile,
    isOwn ? user : null
  );
  const timeline = useMemo(
    () => buildProfileTimeline(posts, videos),
    [posts, videos]
  );
  const postOnlyTimeline = useMemo(
    () => timeline.filter((item) => item.kind !== "video"),
    [timeline]
  );
  const videoOnlyTimeline = useMemo(
    () => timeline.filter((item) => item.kind === "video"),
    [timeline]
  );
  const visibleTabs = useMemo(
    () =>
      getVisibleMobileProfileTabs({
        isOwner: isOwn,
        postCount: posts.length,
        videoCount: videos.length,
      }),
    [isOwn, posts.length, videos.length]
  );
  const activeTab = resolveActiveMobileProfileTab(requestedTab, visibleTabs);

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
      setFollowersCount(result.followersCount);
      setFollowingCount(result.followingCount);
    } finally {
      setFollowBusy(false);
    }
  }, [following, otherProfile?.id, router, user]);

  const openFollowList = useCallback(
    (kind: FollowListKind) => {
      const targetUserId = resolveFollowListOpenTarget({
        isOwn,
        ownUserId: user?.id ?? profile?.id ?? null,
        otherUserId: otherProfile?.id ?? null,
      });
      if (!targetUserId) return;
      const origin =
        parseProfileNavOrigin(params.from) ?? (isOwn ? "profile" : null);
      const href = buildFollowListHref({
        kind,
        targetUserId,
        username: view.username,
        origin,
      });
      if (href) {
        rememberProfileBackContext({
          origin,
          via: null,
          listId: null,
          listUsername: null,
          ownerId: targetUserId,
          ownerUsername: view.username ?? null,
        });
        router.push(href as never);
      }
    },
    [
      isOwn,
      otherProfile?.id,
      params.from,
      profile?.id,
      router,
      user?.id,
      view.username,
    ]
  );

  const onShare = useCallback(async () => {
    const url = buildProfileShareUrl(view.username);
    if (!url) return;
    setShareBusy(true);
    setShareError(null);
    try {
      await defaultShareLinkPort.share({
        title: t("profile.share"),
        message: `${view.displayName || view.username || t("profile.account")}\n${url}`,
        url,
      });
    } catch {
      setShareError(t("profile.shareFailed"));
    } finally {
      setShareBusy(false);
    }
  }, [t, view.displayName, view.username]);

  function openTimelineItem(item: ProfileTimelineItem) {
    if (item.kind === "video") {
      router.push({
        pathname: "/(tabs)/watch",
        params: { post: String(item.postId) },
      });
    }
  }

  const textAlign = localeTextAlign(locale);
  const rootDirection = localeRootStyle(locale);

  if (loading && !user && isOwn) {
    return (
      <SafeAreaView style={[styles.root, rootDirection]} edges={["bottom"]}>
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
      <SafeAreaView style={[styles.root, rootDirection]} edges={["bottom"]}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle} accessibilityRole="header">
            {t("auth.required.title")}
          </Text>
          <Text style={styles.muted}>{t("auth.required.profile")}</Text>
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
      <SafeAreaView style={[styles.root, rootDirection]} edges={["bottom"]}>
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
      <SafeAreaView style={[styles.root, rootDirection]} edges={["bottom"]}>
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
    <SafeAreaView style={[styles.root, rootDirection]} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <ProfileHero
          view={view}
          locale={locale}
          t={t}
          about={aboutExtras}
          windowWidth={windowWidth}
          isOwn={isOwn}
          onOpenAbout={() => setRequestedTab("about")}
        />

        <View style={[styles.columnHost, { width: windowWidth }]}>
          <View style={[styles.column, { width: columnWidth }]}>
            {view.hasReliableIdentity ? null : (
              <View style={styles.identityPad}>
                <View style={styles.banner} accessibilityRole="alert">
                  <Text style={[styles.emptyTitle, { textAlign }]}>
                    {t("profile.detailsUnavailable")}
                  </Text>
                  <Text style={[styles.bannerBody, { textAlign }]}>
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
                        <Text style={styles.secondaryBtnText}>
                          {t("actions.retry")}
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
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

            {view.hasReliableIdentity || isOwn || otherProfile ? (
              <ProfileActionsRow
                t={t}
                isOwn={isOwn}
                following={following}
                followBusy={followBusy}
                followError={followError ?? shareError}
                canShare={Boolean(view.username)}
                shareBusy={shareBusy}
                onEdit={() => router.push("/settings")}
                onFollow={() => void onToggleFollow()}
                onShare={() => void onShare()}
              />
            ) : null}

            <ProfileStatsRow
              locale={locale}
              t={t}
              followersCount={followersCount}
              followingCount={followingCount}
              postsCount={timeline.length}
              onOpenFollowers={() => openFollowList("followers")}
              onOpenFollowing={() => openFollowList("following")}
            />

            <ProfileTabStrip
              locale={locale}
              t={t}
              tabs={visibleTabs}
              active={activeTab}
              onChange={(tab: MobileProfileTabId) => setRequestedTab(tab)}
            />

            <Text style={[styles.sectionLabel, { textAlign }]}>
              {activeTab === "about"
                ? t("profile.about")
                : activeTab === "videos"
                  ? t("profile.videos")
                  : t("profile.posts")}
            </Text>

            {activeTab === "about" ? (
              <ProfileAboutBlock
                view={view}
                locale={locale}
                t={t}
                about={aboutExtras}
                isOwn={isOwn}
              />
            ) : contentLoading ? (
              <ProfileLoadingSkeleton t={t} />
            ) : postsFailed && videosFailed && activeTab === "all" ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {t("profile.postsFailed")}
              </Text>
            ) : (
              <ProfileTimeline
                locale={locale}
                t={t}
                items={
                  activeTab === "posts"
                    ? postOnlyTimeline
                    : activeTab === "videos"
                      ? videoOnlyTimeline
                      : timeline
                }
                mediaBox={mediaBox}
                emptyLabel={
                  activeTab === "videos"
                    ? t("profile.videosEmpty")
                    : t("profile.postsEmpty")
                }
                postsFailed={activeTab !== "videos" ? postsFailed : false}
                videosFailed={activeTab !== "posts" ? videosFailed : false}
                onOpenVideo={openTimelineItem}
              />
            )}

            {isOwn ? (
              <>
                <Text style={[styles.sectionLabel, { textAlign }]}>
                  {t("profile.shortcuts")}
                </Text>
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
                      <Text style={styles.linkText}>
                        {t("settings.notifications")}
                      </Text>
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
          </View>
        </View>
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
    paddingBottom: 32,
  },
  columnHost: {
    alignItems: "center",
  },
  column: {
    maxWidth: "100%",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  identityPad: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  muted: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  bannerBody: {
    color: colors.textMuted,
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
    marginHorizontal: 20,
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
    paddingHorizontal: 20,
  },
  retryLink: {
    color: colors.accentCyan,
    fontWeight: "600",
  },
  sectionLabel: {
    marginTop: 24,
    marginBottom: 10,
    marginHorizontal: 20,
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  links: {
    gap: 10,
    paddingHorizontal: 20,
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

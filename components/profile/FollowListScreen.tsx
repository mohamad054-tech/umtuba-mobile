import { useStackedOriginBackEffects } from "@/components/GlobalBackButton";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslation } from "@/src/lib/i18n";
import { localeRootStyle, localeTextAlign } from "@/src/lib/i18n/rtl";
import { rememberProfileBackContext } from "@/src/lib/nav/profileBackContext";
import { buildFollowListMemberProfileHref } from "@/src/lib/profile/followListNav";
import { parseProfileNavOrigin } from "@/src/lib/profile/profileNav";
import {
  FOLLOW_LIST_PAGE_SIZE,
  listFollowRelations,
  resolveFollowListTargetUserId,
  type FollowListKind,
  type FollowListMember,
} from "@/src/lib/social/followLists";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

type FollowListScreenProps = {
  kind: FollowListKind;
};

export default function FollowListScreen({ kind }: FollowListScreenProps) {
  useStackedOriginBackEffects();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    u?: string;
    from?: string;
  }>();
  const targetUserId = useMemo(
    () => resolveFollowListTargetUserId({ queryUserId: params.id }),
    [params.id]
  );
  const origin = parseProfileNavOrigin(params.from);
  const [members, setMembers] = useState<FollowListMember[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!targetUserId) {
        setMembers([]);
        setNextOffset(null);
        setFailed(true);
        setLoading(false);
        return;
      }
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const page = await listFollowRelations(getSupabase(), {
          targetUserId,
          kind,
          cursor: { offset, limit: FOLLOW_LIST_PAGE_SIZE },
        });
        setFailed(Boolean(page.failed));
        setNextOffset(page.nextOffset);
        setMembers((current) => {
          if (!append) return page.members;
          const seen = new Set(current.map((row) => row.userId.toLowerCase()));
          const extra = page.members.filter(
            (row) => !seen.has(row.userId.toLowerCase())
          );
          return [...current, ...extra];
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [kind, targetUserId]
  );

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  const onOpenMember = useCallback(
    (member: FollowListMember) => {
      if (!targetUserId) return;
      const href = buildFollowListMemberProfileHref({
        userId: member.userId,
        username: member.username,
        listKind: kind,
        listOwnerId: targetUserId,
        listOwnerUsername: typeof params.u === "string" ? params.u : null,
        origin,
      });
      if (href) {
        rememberProfileBackContext({
          origin,
          via: kind,
          listId: targetUserId,
          listUsername: typeof params.u === "string" ? params.u : null,
          ownerId: targetUserId,
          ownerUsername: typeof params.u === "string" ? params.u : null,
        });
        router.push(href as never);
      }
    },
    [kind, origin, params.u, router, targetUserId]
  );

  const textAlign = localeTextAlign(locale);
  const rootDirection = localeRootStyle(locale);
  const emptyLabel =
    kind === "followers"
      ? t("profile.followersEmpty")
      : t("profile.followingEmpty");
  const failedLabel =
    kind === "followers"
      ? t("profile.followersFailed")
      : t("profile.followingFailed");

  return (
    <SafeAreaView style={[styles.root, rootDirection]} edges={["bottom"]}>
      {!targetUserId ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { textAlign }]}>
            {t("profile.notFound")}
          </Text>
          <Text style={[styles.muted, { textAlign }]}>
            {t("profile.unavailableAccount")}
          </Text>
        </View>
      ) : loading ? (
        <View
          style={styles.center}
          accessibilityLabel={t("profile.followListLoading")}
          accessibilityRole="progressbar"
        >
          <ActivityIndicator color={colors.accentCyan} size="large" />
          <Text style={styles.muted}>{t("profile.followListLoading")}</Text>
        </View>
      ) : failed ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { textAlign }]}>{failedLabel}</Text>
          <Pressable
            onPress={() => void loadPage(0, false)}
            accessibilityRole="button"
            accessibilityLabel={t("actions.retry")}
          >
            <Text style={styles.retry}>{t("actions.retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={
            members.length === 0 ? styles.emptyList : styles.list
          }
          ListEmptyComponent={
            <Text style={[styles.muted, { textAlign }]}>{emptyLabel}</Text>
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (nextOffset == null || loadingMore) return;
            void loadPage(nextOffset, true);
          }}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                color={colors.accentCyan}
                style={styles.footer}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => onOpenMember(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.displayName} @${item.username}`}
            >
              <View style={styles.avatar} accessibilityElementsHidden>
                {item.avatarUrl ? (
                  <Image
                    source={{ uri: item.avatarUrl }}
                    style={styles.avatarImage}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Text style={styles.avatarText}>{item.avatarInitial}</Text>
                )}
              </View>
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={styles.handle} numberOfLines={1}>
                  @{item.username}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  list: {
    paddingVertical: 8,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  row: {
    minHeight: 64,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 44,
    height: 44,
  },
  avatarText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  handle: {
    color: colors.textSubtle,
    fontSize: 13,
    marginTop: 2,
  },
  muted: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  retry: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
  footer: {
    paddingVertical: 16,
  },
});

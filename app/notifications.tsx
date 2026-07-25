import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/lib/auth/AuthContext";
import {
  formatNotificationTime,
  listMyNotifications,
  mapNotificationHrefToMobile,
  notificationCategoryLabel,
  resolveMarkNotificationRead,
  type AppNotification,
} from "@/src/lib/notifications";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

type InboxPhase = "loading" | "ready" | "unavailable" | "error";

function NotificationRow({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: (item: AppNotification) => void;
}) {
  const destination = mapNotificationHrefToMobile(item.href);
  const timeLabel = formatNotificationTime(item.createdAt);
  const category = notificationCategoryLabel(item.uiCategory);

  return (
    <Pressable
      style={[styles.row, item.unread && styles.rowUnread]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.unread ? "Unread. " : ""}${item.title}. ${category}${timeLabel ? `. ${timeLabel}` : ""}`}
      accessibilityHint={
        destination
          ? "Opens related content when available"
          : "Marks as read when possible. No destination linked."
      }
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText} accessible={false}>
          {item.actor?.avatarInitial || category.slice(0, 1)}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.category} numberOfLines={1}>
            {category}
          </Text>
          {timeLabel ? (
            <Text style={styles.time} numberOfLines={1}>
              {timeLabel}
            </Text>
          ) : null}
        </View>
        <Text
          style={[styles.title, item.unread && styles.titleUnread]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        {item.body ? (
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
      </View>
      {item.unread ? <View style={styles.unreadDot} /> : null}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [phase, setPhase] = useState<InboxPhase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [readPersistence, setReadPersistence] = useState<
    "server" | "local" | null
  >(null);
  const localReadIds = useRef<Set<string>>(new Set());
  const inFlight = useRef(false);

  const applyLocalReadOverlay = useCallback((list: AppNotification[]) => {
    if (localReadIds.current.size === 0) return list;
    return list.map((n) =>
      localReadIds.current.has(n.id)
        ? { ...n, unread: false, readAt: n.readAt ?? new Date().toISOString() }
        : n
    );
  }, []);

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!user || inFlight.current) return;
      inFlight.current = true;
      if (opts?.soft) setRefreshing(true);
      else setPhase("loading");
      setError(null);
      try {
        const result = await listMyNotifications(getSupabase(), { limit: 40 });
        if (!result.ok) {
          if (result.unavailable) {
            setItems([]);
            setPhase("unavailable");
            setError(null);
            return;
          }
          setError(result.message);
          setPhase("error");
          return;
        }
        setItems(applyLocalReadOverlay(result.notifications));
        setPhase("ready");
      } finally {
        setRefreshing(false);
        inFlight.current = false;
      }
    },
    [applyLocalReadOverlay, user]
  );

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setItems([]);
        setPhase("ready");
        return;
      }
      void load();
    }, [load, user])
  );

  const onOpenItem = useCallback(
    async (item: AppNotification) => {
      if (item.unread) {
        const mark = await resolveMarkNotificationRead(getSupabase(), item.id);
        if (mark.ok) {
          setReadPersistence(mark.persistence);
          if (mark.persistence === "local") {
            localReadIds.current.add(item.id);
          }
          setItems((prev) =>
            prev.map((n) =>
              n.id === item.id
                ? {
                    ...n,
                    unread: false,
                    readAt: n.readAt ?? new Date().toISOString(),
                  }
                : n
            )
          );
        }
      }

      const href = mapNotificationHrefToMobile(item.href);
      if (href) {
        router.push(href as never);
      }
    },
    [router]
  );

  const empty = useMemo(() => items.length === 0, [items.length]);

  if (authLoading || (phase === "loading" && !refreshing)) {
    return (
      <View style={styles.center} accessibilityLabel="Loading notifications">
        <ActivityIndicator color={colors.accentCyan} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.center, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.emptyTitle}>Sign in required</Text>
        <Text style={styles.emptyBody}>
          Sign in to see your notifications inbox.
        </Text>
      </View>
    );
  }

  if (phase === "unavailable") {
    return (
      <View style={[styles.center, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.emptyTitle}>Notifications unavailable</Text>
        <Text style={styles.emptyBody}>
          The in-app inbox source is not provisioned on this environment yet.
          Push delivery can still work separately. Pull to retry after the
          notifications backend is enabled.
        </Text>
        <Pressable
          style={styles.retry}
          onPress={() => void load()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading notifications"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "error" && empty) {
    return (
      <View style={[styles.center, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.emptyTitle}>Couldn’t load notifications</Text>
        <Text style={styles.emptyBody}>{error}</Text>
        <Pressable
          style={styles.retry}
          onPress={() => void load()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading notifications"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {readPersistence === "local" ? (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          Read state is temporary for this session until server sync is
          available.
        </Text>
      ) : null}
      {phase === "error" && error ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow item={item} onPress={(n) => void onOpenItem(n)} />
        )}
        contentContainerStyle={[
          styles.listContent,
          empty && styles.listEmptyContent,
          { paddingBottom: Math.max(24, insets.bottom + 16) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load({ soft: true })}
            tintColor={colors.accentCyan}
            colors={[colors.accentCyan]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyBody}>
              Likes, follows, messages, and system updates will show up here.
            </Text>
          </View>
        }
        initialNumToRender={12}
        windowSize={9}
        accessibilityLabel="Notifications list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  hint: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bannerText: {
    color: colors.danger,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyBlock: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  retry: {
    marginTop: 8,
    minHeight: 48,
    minWidth: 120,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    color: colors.bg,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 72,
  },
  rowUnread: {
    borderColor: colors.accentCyan,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: colors.text,
    fontWeight: "700",
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  category: {
    color: colors.accentCyan,
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  time: {
    color: colors.textSubtle,
    fontSize: 12,
  },
  title: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 20,
  },
  titleUnread: {
    color: colors.text,
    fontWeight: "700",
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
    backgroundColor: colors.accentCyan,
  },
});

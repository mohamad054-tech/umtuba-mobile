import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
  getOrCreateDirectConversation,
  listConversationsForUser,
  subscribeMessengerRealtime,
} from "@/src/lib/messenger/api";
import {
  dedupeConversations,
  preserveDeepLinkMessageId,
} from "@/src/lib/messenger/threadState";
import {
  formatMessageTime,
  type Conversation,
} from "@/src/lib/messenger/types";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

export default function MessagesInboxScreen() {
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    conversation?: string;
    message?: string;
    creatorId?: string;
  }>();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const openedDeepLink = useRef<string | null>(null);

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!user || inFlight.current) return;
      inFlight.current = true;
      if (opts?.soft) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await listConversationsForUser(getSupabase(), user.id);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setConversations(dedupeConversations(result.conversations));
      } finally {
        setLoading(false);
        setRefreshing(false);
        inFlight.current = false;
      }
    },
    [user]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!user) return;
    const cleanup = subscribeMessengerRealtime(getSupabase(), {
      conversationId: null,
      currentUserId: user.id,
      handlers: {
        onMessageInsert: () => {
          void load({ soft: true });
        },
        onMessageUpdate: () => {
          void load({ soft: true });
        },
        onInboxParticipantChange: () => {
          void load({ soft: true });
        },
      },
    });
    return cleanup;
  }, [load, user]);

  useEffect(() => {
    if (!user || authLoading) return;

    const creatorId =
      typeof params.creatorId === "string" ? params.creatorId : null;
    if (creatorId && openedDeepLink.current !== `creator:${creatorId}`) {
      openedDeepLink.current = `creator:${creatorId}`;
      void (async () => {
        const result = await getOrCreateDirectConversation(
          getSupabase(),
          creatorId
        );
        if (!result.ok) {
          setError(result.message);
          return;
        }
        router.replace(
          `/messages/${result.conversationId}` as never
        );
      })();
      return;
    }

    const preserved = preserveDeepLinkMessageId(
      typeof params.conversation === "string" ? params.conversation : null,
      typeof params.message === "string" ? params.message : null
    );
    if (
      preserved &&
      openedDeepLink.current !== `c:${preserved.conversationId}`
    ) {
      openedDeepLink.current = `c:${preserved.conversationId}`;
      const href = preserved.messageId
        ? `/messages/${preserved.conversationId}?message=${preserved.messageId}`
        : `/messages/${preserved.conversationId}`;
      router.replace(href as never);
    }
  }, [
    authLoading,
    params.conversation,
    params.creatorId,
    params.message,
    router,
    user,
  ]);

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accentCyan} />
      </View>
    );
  }

  if (!session || !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Sign in to message</Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push("/(auth)/login")}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
        >
          <Text style={styles.buttonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          color={colors.accentCyan}
          accessibilityLabel="Loading conversations"
        />
      </View>
    );
  }

  if (error && conversations.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => void load()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading conversations"
        >
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {error ? (
        <Text style={styles.banner} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load({ soft: true })}
            tintColor={colors.accentCyan}
            colors={[colors.accentCyan]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyBody}>
              Direct messages with people you follow will show up here. Groups,
              attachments, and calls are not available yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/messages/${item.id}` as never)}
            accessibilityRole="button"
            accessibilityLabel={`Conversation with ${item.peerName}${
              item.unreadCount > 0 ? `, ${item.unreadCount} unread` : ""
            }`}
            accessibilityHint="Opens the message thread"
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.peerInitials}</Text>
            </View>
            <View style={styles.meta}>
              <View style={styles.topLine}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.peerName}
                </Text>
                <Text style={styles.time}>
                  {formatMessageTime(item.lastMessageAt)}
                </Text>
              </View>
              <Text style={styles.preview} numberOfLines={1}>
                {item.isTyping
                  ? "Typing…"
                  : item.lastMessagePreview || "No messages yet"}
              </Text>
            </View>
            {item.unreadCount > 0 ? (
              <View
                style={styles.badge}
                accessibilityLabel={`${item.unreadCount} unread`}
              >
                <Text style={styles.badgeText}>
                  {item.unreadCount > 99 ? "99+" : item.unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  error: { color: colors.danger, textAlign: "center" },
  banner: {
    color: colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  button: {
    backgroundColor: colors.text,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: colors.bg, fontWeight: "700" },
  empty: { padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { color: colors.text, fontWeight: "700", fontSize: 16 },
  emptyBody: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.text, fontWeight: "700" },
  meta: { flex: 1, gap: 4 },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  name: { color: colors.text, fontWeight: "700", flex: 1 },
  time: { color: colors.textSubtle, fontSize: 12 },
  preview: { color: colors.textMuted, fontSize: 14 },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentViolet,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: "700" },
});

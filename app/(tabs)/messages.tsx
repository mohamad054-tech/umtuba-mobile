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

import { ConversationListItem } from "@/components/messenger/ConversationListItem";
import { MessengerStatePanel } from "@/components/messenger/MessengerStatePanel";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import {
  getOrCreateDirectConversation,
  listConversationsForUser,
  subscribeMessengerRealtime,
} from "@/src/lib/messenger/api";
import { conversationThreadHref } from "@/src/lib/messenger/mapDestination";
import {
  dedupeConversations,
  preserveDeepLinkMessageId,
} from "@/src/lib/messenger/threadState";
import type { Conversation } from "@/src/lib/messenger/types";
import { loadBlockedUsers } from "@/src/lib/social/ugcModeration";
import { filterConversationsByBlockedPeers } from "@/src/lib/social/ugcModerationShared";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

type InboxPhase =
  | "loading"
  | "ready"
  | "empty"
  | "unavailable"
  | "error";

export default function MessagesInboxScreen() {
  const { user, session, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    conversation?: string;
    message?: string;
    creatorId?: string;
  }>();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [phase, setPhase] = useState<InboxPhase>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const openedDeepLink = useRef<string | null>(null);

  const load = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!user || inFlight.current) return;
      inFlight.current = true;
      if (opts?.soft) setRefreshing(true);
      else setPhase("loading");
      setError(null);
      try {
        const result = await listConversationsForUser(getSupabase(), user.id);
        if (!result.ok) {
          setConversations([]);
          setError(result.message);
          setPhase(result.unavailable ? "unavailable" : "error");
          return;
        }
        const blocked = await loadBlockedUsers();
        const blockedIds = new Set(blocked.map((row) => row.userId));
        const next = filterConversationsByBlockedPeers(
          dedupeConversations(result.conversations),
          blockedIds
        );
        setConversations(next);
        setPhase(next.length === 0 ? "empty" : "ready");
      } finally {
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
          setPhase(result.unavailable ? "unavailable" : "error");
          return;
        }
        const href = conversationThreadHref(result.conversationId);
        if (!href) {
          setError(t("messages.openFailed"));
          setPhase("error");
          return;
        }
        router.replace(href as never);
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
      const href = conversationThreadHref(
        preserved.conversationId,
        preserved.messageId
      );
      if (href) {
        router.replace(href as never);
      }
    }
  }, [
    authLoading,
    params.conversation,
    params.creatorId,
    params.message,
    router,
    t,
    user,
  ]);

  const onOpenConversation = useCallback(
    (conversation: Conversation) => {
      const href = conversationThreadHref(conversation.id);
      if (!href) return;
      router.push(href as never);
    },
    [router]
  );

  if (authLoading) {
    return (
      <View style={styles.center} accessibilityRole="progressbar">
        <ActivityIndicator color={colors.accentCyan} />
      </View>
    );
  }

  if (!session || !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.title} accessibilityRole="header">
          {t("messages.signInTitle")}
        </Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push("/(auth)/login")}
          accessibilityRole="button"
          accessibilityLabel={t("actions.signIn")}
        >
          <Text style={styles.buttonText}>{t("actions.signIn")}</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "loading" && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          color={colors.accentCyan}
          accessibilityLabel={t("messages.loading")}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      {error && phase === "ready" ? (
        <Text style={styles.banner} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <FlatList
        data={phase === "ready" ? conversations : []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load({ soft: true })}
            tintColor={colors.accentCyan}
            colors={[colors.accentCyan]}
          />
        }
        contentContainerStyle={
          phase !== "ready" ? styles.listFill : undefined
        }
        ListEmptyComponent={
          phase === "unavailable" ? (
            <MessengerStatePanel
              variant="unavailable"
              title={t("messages.unavailable")}
              body={error ?? t("messages.unavailableBody")}
              onRetry={() => void load()}
              busy={refreshing}
            />
          ) : phase === "error" ? (
            <MessengerStatePanel
              variant="error"
              title={t("messages.loadFailed")}
              body={error ?? t("messages.loadFailedBody")}
              onRetry={() => void load()}
              busy={refreshing}
            />
          ) : phase === "empty" ? (
            <MessengerStatePanel
              variant="empty"
              title={t("messages.empty")}
              body={t("messages.emptyBody")}
              onRetry={() => void load()}
              busy={refreshing}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ConversationListItem
            conversation={item}
            onPress={onOpenConversation}
          />
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
  listFill: { flexGrow: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
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
});

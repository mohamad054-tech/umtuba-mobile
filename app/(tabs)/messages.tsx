import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  I18nManager,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConversationListItem } from "@/components/messenger/ConversationListItem";
import { MessengerStatePanel } from "@/components/messenger/MessengerStatePanel";
import { StartConversationSheet } from "@/components/messenger/StartConversationSheet";
import { useAuth } from "@/src/lib/auth/AuthContext";
import { commsCopy } from "@/src/lib/comms/copy";
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
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

type InboxPhase =
  | "loading"
  | "ready"
  | "empty"
  | "unavailable"
  | "error";

export default function MessagesInboxScreen() {
  const { user, session, loading: authLoading, profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const copy = commsCopy(I18nManager.isRTL);
  const params = useLocalSearchParams<{
    conversation?: string;
    message?: string;
    creatorId?: string;
    username?: string;
    start?: string;
  }>();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [phase, setPhase] = useState<InboxPhase>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const inFlight = useRef(false);
  const openedDeepLink = useRef<string | null>(null);
  const startUsername =
    typeof params.username === "string" ? params.username : "";

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
        const next = dedupeConversations(result.conversations);
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
          setError("Unable to open that conversation.");
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

    if (
      (startUsername || params.start === "1") &&
      openedDeepLink.current !== `start:${startUsername || "1"}`
    ) {
      openedDeepLink.current = `start:${startUsername || "1"}`;
      setStartOpen(true);
    }
  }, [
    authLoading,
    params.conversation,
    params.creatorId,
    params.message,
    params.start,
    startUsername,
    router,
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
          Sign in to message
        </Text>
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

  if (phase === "loading" && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          color={colors.accentCyan}
          accessibilityLabel="Loading conversations"
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.toolbar}>
        <Pressable
          style={styles.startBtn}
          onPress={() => setStartOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={copy.startConversation}
        >
          <Text style={styles.startBtnText}>{copy.startConversation}</Text>
        </Pressable>
      </View>
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
              title="Messages unavailable"
              body={
                error ??
                "The messenger backend is not available in this environment yet."
              }
              onRetry={() => void load()}
              busy={refreshing}
            />
          ) : phase === "error" ? (
            <MessengerStatePanel
              variant="error"
              title="Couldn’t load messages"
              body={error ?? "Unable to load conversations."}
              onRetry={() => void load()}
              busy={refreshing}
            />
          ) : phase === "empty" ? (
            <MessengerStatePanel
              variant="empty"
              title="No conversations yet"
              body="Start a conversation by username, email, phone, or personal link. Groups, attachments, and calls are not available yet."
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
      <StartConversationSheet
        visible={startOpen}
        currentUserId={user.id}
        ownUsername={profile?.username ?? null}
        initialQuery={startUsername}
        onClose={() => setStartOpen(false)}
        onOpenConversation={(href) => router.push(href as never)}
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
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  startBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  startBtnText: { color: colors.bg, fontWeight: "800" },
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

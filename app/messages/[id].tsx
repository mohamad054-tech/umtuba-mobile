import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type AppStateStatus,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/lib/auth/AuthContext";
import {
  assertConversationMembership,
  getConversationPeerState,
  listMessagesForConversation,
  markConversationRead,
  newClientId,
  sendTextMessage,
  setConversationTyping,
  subscribeMessengerRealtime,
} from "@/src/lib/messenger/api";
import { clearDraft, loadDraft, saveDraft } from "@/src/lib/messenger/drafts";
import { mapMessengerMessageRow } from "@/src/lib/messenger/mapMessage";
import {
  applyPeerReadToMessages,
  canSendWithClientId,
  createOptimisticMessage,
  markOptimisticFailed,
  mergeMessages,
  replaceOptimisticWithServer,
  resolveAndroidBack,
  shouldMarkReadAfterLoad,
} from "@/src/lib/messenger/threadState";
import {
  formatBubbleTime,
  MESSAGE_MAX_LENGTH,
  PEER_POLL_MS,
  TYPING_IDLE_CLEAR_MS,
  receiptLabel,
  type Message,
} from "@/src/lib/messenger/types";
import { getSupabase } from "@/src/lib/supabase/client";
import { colors } from "@/src/theme/colors";

export default function ConversationThreadScreen() {
  const params = useLocalSearchParams<{ id: string; message?: string }>();
  const conversationId = typeof params.id === "string" ? params.id : "";
  const highlightId =
    typeof params.message === "string" ? params.message : null;

  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Message>>(null);
  const inFlightClients = useRef(new Set<string>());
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markedRead = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [appActive, setAppActive] = useState(true);

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const loadThread = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!user || !conversationId) return;
      if (!opts?.soft) setLoading(true);
      setError(null);

      const membership = await assertConversationMembership(
        getSupabase(),
        conversationId,
        user.id
      );
      if (!membership.ok) {
        setError(membership.message);
        setLoading(false);
        return;
      }

      const peer = await getConversationPeerState(
        getSupabase(),
        conversationId
      );
      const peerRead = peer.ok ? peer.peerLastReadAt : null;
      if (peer.ok) {
        setPeerTyping(peer.isTyping);
        setPeerLastReadAt(peer.peerLastReadAt);
      }

      const page = await listMessagesForConversation(
        getSupabase(),
        user.id,
        conversationId,
        null,
        peerRead
      );

      if (!page.ok) {
        setError(page.message);
        setLoading(false);
        return;
      }

      setMessages(page.messages);
      setHasMore(page.hasMore);
      setCursor(page.nextCursor);
      setLoading(false);

      if (
        shouldMarkReadAfterLoad({
          loadedOk: true,
          conversationId,
          messageCount: page.messages.length,
        }) &&
        !markedRead.current
      ) {
        markedRead.current = true;
        void markConversationRead(getSupabase(), conversationId);
      }

      scrollToEnd(false);
      if (highlightId) {
        const index = page.messages.findIndex((m) => m.id === highlightId);
        if (index >= 0) {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index,
              animated: true,
              viewPosition: 0.5,
            });
          }, 250);
        }
      }
    },
    [conversationId, highlightId, scrollToEnd, user]
  );

  useEffect(() => {
    markedRead.current = false;
    void loadThread();
    if (conversationId) {
      void loadDraft(conversationId).then(setDraft);
    }
  }, [conversationId, loadThread]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      const active = next === "active";
      setAppActive(active);
      if (
        (prev === "background" || prev === "inactive") &&
        next === "active"
      ) {
        void loadThread({ soft: true });
      }
    });
    return () => sub.remove();
  }, [loadThread]);

  useEffect(() => {
    if (!user || !conversationId) return;

    const cleanup = subscribeMessengerRealtime(getSupabase(), {
      conversationId,
      currentUserId: user.id,
      handlers: {
        onMessageInsert: (row) => {
          const mapped = mapMessengerMessageRow(row, user.id, {
            peerLastReadAt,
          });
          setMessages((prev) => mergeMessages(prev, [mapped]));
          if (row.sender_id !== user.id) {
            void markConversationRead(getSupabase(), conversationId, row.id);
          }
          scrollToEnd(true);
        },
        onMessageUpdate: (row) => {
          const mapped = mapMessengerMessageRow(row, user.id, {
            peerLastReadAt,
          });
          setMessages((prev) => mergeMessages(prev, [mapped]));
        },
        onResync: () => {
          void loadThread({ soft: true });
        },
      },
    });

    return cleanup;
  }, [conversationId, loadThread, peerLastReadAt, scrollToEnd, user]);

  useEffect(() => {
    if (!conversationId || !appActive) return;
    const timer = setInterval(() => {
      void (async () => {
        const peer = await getConversationPeerState(
          getSupabase(),
          conversationId
        );
        if (!peer.ok) return;
        setPeerTyping(peer.isTyping);
        setPeerLastReadAt(peer.peerLastReadAt);
        setMessages((prev) =>
          applyPeerReadToMessages(prev, peer.peerLastReadAt)
        );
      })();
    }, PEER_POLL_MS);
    return () => clearInterval(timer);
  }, [appActive, conversationId]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBack = () => {
      const action = resolveAndroidBack(Boolean(conversationId));
      if (action === "close-thread") {
        router.replace("/(tabs)/messages");
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [conversationId, router]);

  const loadOlder = useCallback(async () => {
    if (!user || !conversationId || !cursor || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await listMessagesForConversation(
        getSupabase(),
        user.id,
        conversationId,
        cursor,
        peerLastReadAt
      );
      if (!page.ok) return;
      setMessages((prev) => mergeMessages(page.messages, prev));
      setHasMore(page.hasMore);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, cursor, hasMore, loadingMore, peerLastReadAt, user]);

  const onChangeDraft = (text: string) => {
    setDraft(text);
    if (!conversationId) return;
    void saveDraft(conversationId, text);

    void setConversationTyping(getSupabase(), conversationId, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      void setConversationTyping(getSupabase(), conversationId, false);
    }, TYPING_IDLE_CLEAR_MS);
  };

  const send = useCallback(
    async (retryClientId?: string, retryText?: string) => {
      if (!user || !conversationId || sending) return;
      const text = (retryText ?? draft).trim();
      if (!text) return;

      const clientId = retryClientId ?? newClientId();
      if (!canSendWithClientId(inFlightClients.current, clientId)) return;
      inFlightClients.current.add(clientId);
      setSending(true);

      if (!retryClientId) {
        const optimistic = createOptimisticMessage({
          conversationId,
          senderId: user.id,
          text,
          clientId,
        });
        setMessages((prev) => mergeMessages(prev, [optimistic]));
        setDraft("");
        void clearDraft(conversationId);
        void setConversationTyping(getSupabase(), conversationId, false);
        scrollToEnd(true);
      }

      try {
        const result = await sendTextMessage(
          getSupabase(),
          user.id,
          conversationId,
          text,
          clientId
        );
        if (!result.ok) {
          setMessages((prev) => markOptimisticFailed(prev, clientId));
          setError(result.message);
          return;
        }
        setMessages((prev) =>
          replaceOptimisticWithServer(prev, clientId, result.message)
        );
        setError(null);
      } finally {
        inFlightClients.current.delete(clientId);
        setSending(false);
      }
    },
    [conversationId, draft, scrollToEnd, sending, user]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          color={colors.accentCyan}
          accessibilityLabel="Loading conversation"
        />
      </View>
    );
  }

  if (error && messages.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
        <Pressable
          style={styles.retry}
          onPress={() => void loadThread()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading conversation"
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace("/(tabs)/messages")}
          accessibilityRole="button"
          accessibilityLabel="Back to conversations"
        >
          <Text style={styles.link}>Back to Messages</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? 24 : 0}
    >
      <View style={styles.root}>
        {peerTyping ? (
          <Text
            style={styles.typing}
            accessibilityLiveRegion="polite"
            accessibilityLabel="Peer is typing"
          >
            Typing…
          </Text>
        ) : null}
        {error ? (
          <Text style={styles.banner} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.clientId ?? item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 12 + insets.bottom },
          ]}
          ListHeaderComponent={
            loadingMore ? (
              <ActivityIndicator
                color={colors.accentCyan}
                style={{ marginVertical: 12 }}
              />
            ) : hasMore ? (
              <Pressable
                onPress={() => void loadOlder()}
                accessibilityRole="button"
                accessibilityLabel="Load earlier messages"
              >
                <Text style={styles.loadEarlier}>Load earlier</Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubbleWrap,
                item.isMine ? styles.mineWrap : styles.theirsWrap,
                highlightId === item.id && styles.highlight,
              ]}
              accessibilityLabel={`${item.isMine ? "You" : "Them"}: ${item.text}`}
            >
              <View
                style={[
                  styles.bubble,
                  item.isMine ? styles.mine : styles.theirs,
                  item.status === "failed" && styles.failedBubble,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    item.isMine ? styles.mineText : styles.theirsText,
                  ]}
                >
                  {item.text}
                </Text>
                <Text style={styles.meta}>
                  {formatBubbleTime(item.sentAt)}
                  {item.status === "sending"
                    ? " · Sending"
                    : item.status === "failed"
                      ? " · Failed"
                      : item.isMine && item.receiptStatus
                        ? ` · ${receiptLabel(item.receiptStatus)}`
                        : ""}
                </Text>
              </View>
              {item.status === "failed" && item.clientId ? (
                <Pressable
                  onPress={() => void send(item.clientId, item.text)}
                  accessibilityRole="button"
                  accessibilityLabel="Retry sending message"
                  style={styles.retryChip}
                >
                  <Text style={styles.link}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          onScrollToIndexFailed={() => {
            scrollToEnd(false);
          }}
        />

        <View
          style={[
            styles.composer,
            { paddingBottom: Math.max(10, insets.bottom) },
          ]}
        >
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Message"
            placeholderTextColor={colors.textSubtle}
            multiline
            maxLength={MESSAGE_MAX_LENGTH}
            accessibilityLabel="Message composer"
            accessibilityHint="Type a text message. Attachments are not available yet."
          />
          <Pressable
            style={[
              styles.send,
              (!draft.trim() || sending) && styles.sendDisabled,
            ]}
            onPress={() => void send()}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !draft.trim() || sending, busy: sending }}
          >
            {sending ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.gateHint}>
          Text only — attachments, voice notes, stickers, groups, and calls are
          not available yet.
        </Text>
      </View>
    </KeyboardAvoidingView>
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
  error: { color: colors.danger, textAlign: "center" },
  banner: {
    color: colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typing: {
    color: colors.accentCyan,
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontSize: 13,
  },
  list: { paddingHorizontal: 12, paddingTop: 12, flexGrow: 1 },
  loadEarlier: {
    textAlign: "center",
    color: colors.accentCyan,
    paddingVertical: 10,
    fontWeight: "600",
  },
  bubbleWrap: { marginBottom: 10, maxWidth: "84%" },
  mineWrap: { alignSelf: "flex-end" },
  theirsWrap: { alignSelf: "flex-start" },
  highlight: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accentCyan,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mine: { backgroundColor: colors.accentViolet },
  theirs: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  failedBubble: { opacity: 0.85 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  mineText: { color: colors.text },
  theirsText: { color: colors.text },
  meta: {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
  },
  retryChip: { alignSelf: "flex-end", marginTop: 4, minHeight: 44, justifyContent: "center" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  send: {
    minWidth: 72,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: colors.bg, fontWeight: "700" },
  retry: {
    backgroundColor: colors.text,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { color: colors.bg, fontWeight: "700" },
  link: { color: colors.accentCyan, fontWeight: "600" },
  gateHint: {
    color: colors.textSubtle,
    fontSize: 11,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});

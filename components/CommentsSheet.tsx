import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/lib/auth/AuthContext";
import { useTranslation } from "@/src/lib/i18n";
import {
  createPostComment,
  listPostComments,
  type PostCommentDTO,
} from "@/src/lib/social/comments";
import { getSupabase } from "@/src/lib/supabase/client";
import { formatPublishedAt } from "@/src/lib/time/publishedAt";
import { colors } from "@/src/theme/colors";

type CommentsSheetProps = {
  visible: boolean;
  postId: number | null;
  publishedAt?: string | null;
  onClose: () => void;
  onCountChange?: (count: number) => void;
};

export function CommentsSheet({
  visible,
  postId,
  publishedAt,
  onClose,
  onCountChange,
}: CommentsSheetProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const publishedLabel = formatPublishedAt(publishedAt, locale);
  const [comments, setComments] = useState<PostCommentDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    const result = await listPostComments(getSupabase(), id, user?.id ?? null);
    if (!result.ok) {
      setComments([]);
      setError(result.message);
      setLoading(false);
      return;
    }
    setComments(result.comments);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!visible || postId == null) {
      setComments([]);
      setDraft("");
      setError(null);
      return;
    }
    void load(postId);
  }, [load, postId, visible]);

  const onSend = useCallback(async () => {
    if (postId == null) return;
    if (!user) {
      setError(t("comments.signIn"));
      return;
    }
    setSending(true);
    setError(null);
    const result = await createPostComment(
      getSupabase(),
      postId,
      user.id,
      draft
    );
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDraft("");
    setComments((prev) => [result.comment, ...prev]);
    onCountChange?.(result.comments);
  }, [draft, onCountChange, postId, t, user]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("actions.close")}
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom) }]}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{t("comments.title")}</Text>
              {publishedLabel ? (
                <Text style={styles.publishedAt}>{publishedLabel}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("actions.close")}
              hitSlop={8}
            >
              <Text style={styles.close}>{t("actions.close")}</Text>
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator
              color={colors.accentCyan}
              style={styles.loader}
              accessibilityLabel={t("status.loading")}
            />
          ) : error && comments.length === 0 ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : comments.length === 0 ? (
            <Text style={styles.empty}>{t("comments.empty")}</Text>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Text style={styles.author} numberOfLines={1}>
                    {item.author.displayName}
                  </Text>
                  <Text style={styles.body}>{item.body}</Text>
                </View>
              )}
            />
          )}
          {error && comments.length > 0 ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={t("comments.placeholder")}
              placeholderTextColor={colors.textSubtle}
              editable={Boolean(user)}
              accessibilityLabel={t("comments.placeholder")}
            />
            <Pressable
              style={[styles.send, sending && styles.sendDisabled]}
              onPress={() => void onSend()}
              disabled={sending}
              accessibilityRole="button"
              accessibilityLabel={t("actions.send")}
            >
              {sending ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.sendText}>{t("actions.send")}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "72%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  publishedAt: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  close: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
  loader: { marginVertical: 24 },
  empty: {
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 24,
  },
  error: {
    color: colors.danger,
    textAlign: "center",
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 4,
  },
  author: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
  body: {
    color: colors.text,
    lineHeight: 20,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.text,
    paddingHorizontal: 12,
  },
  send: {
    minHeight: 44,
    minWidth: 72,
    borderRadius: 10,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  sendDisabled: { opacity: 0.7 },
  sendText: {
    color: colors.bg,
    fontWeight: "700",
  },
});

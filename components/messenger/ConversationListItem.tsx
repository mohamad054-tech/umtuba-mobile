import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { trustedUnreadCount } from "@/src/lib/messenger/conversationParse";
import {
  formatMessageTime,
  type Conversation,
} from "@/src/lib/messenger/types";
import { useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

type ConversationListItemProps = {
  conversation: Conversation;
  onPress: (conversation: Conversation) => void;
};

export function ConversationListItem({
  conversation,
  onPress,
}: ConversationListItemProps) {
  const { t } = useTranslation();
  const unread = trustedUnreadCount(conversation);
  const preview = conversation.isTyping
    ? t("messages.typing")
    : conversation.lastMessagePreview.trim() || t("messages.threadEmpty");
  const timeLabel = formatMessageTime(conversation.lastMessageAt);
  const muted = conversation.muted === true;

  return (
    <Pressable
      style={styles.row}
      onPress={() => onPress(conversation)}
      accessibilityRole="button"
      accessibilityLabel={`${t("messages.withPeer", {
        values: { name: conversation.peerName },
      })}${
        unread
          ? `, ${t("messages.unreadCount", { values: { count: unread } })}`
          : ""
      }${muted ? `, ${t("messages.muted")}` : ""}`}
      accessibilityHint={t("messages.openThread")}
    >
      <View style={styles.avatar} accessibilityElementsHidden>
        {conversation.peerAvatarUrl ? (
          <Image
            source={{ uri: conversation.peerAvatarUrl }}
            style={styles.avatarImage}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={styles.avatarText}>{conversation.peerInitials}</Text>
        )}
      </View>
      <View style={styles.meta}>
        <View style={styles.topLine}>
          <Text style={styles.name} numberOfLines={1}>
            {conversation.peerName}
          </Text>
          {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
        </View>
        <Text
          style={[styles.preview, conversation.isTyping && styles.typing]}
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>
      {unread != null ? (
        <View
          style={styles.badge}
          accessibilityLabel={t("messages.unreadCount", {
            values: { count: unread },
          })}
        >
          <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: { color: colors.text, fontWeight: "700" },
  meta: { flex: 1, gap: 4 },
  topLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  name: { color: colors.text, fontWeight: "700", flex: 1, fontSize: 16 },
  time: { color: colors.textSubtle, fontSize: 12 },
  preview: { color: colors.textMuted, fontSize: 14 },
  typing: { color: colors.accentCyan, fontWeight: "600" },
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

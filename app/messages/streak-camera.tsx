import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/lib/auth/AuthContext";
import {
  listConversationsForUser,
  newClientId,
} from "@/src/lib/messenger/api";
import { conversationThreadHref } from "@/src/lib/messenger/mapDestination";
import type { Conversation } from "@/src/lib/messenger/types";
import { getSupabase } from "@/src/lib/supabase/client";
import { sendVisualMessage } from "@/src/lib/umStreak/api";
import {
  captureVisualFromCamera,
  pickVisualFromLibrary,
  type CapturedVisualAsset,
  type VisualCameraFacing,
  type VisualCaptureMode,
} from "@/src/lib/umStreak/capture";
import { umStreakText } from "@/src/lib/umStreak/copy";
import {
  detectUmStreakLocale,
  umStreakFlexDirection,
  umStreakTextAlign,
  umStreakWritingStyle,
} from "@/src/lib/umStreak/locale";
import { UM_STREAK_CAPTION_MAX } from "@/src/lib/umStreak/media";
import { uploadPrivateVisualMedia } from "@/src/lib/umStreak/upload";
import { colors } from "@/src/theme/colors";

export default function UmStreakCameraScreen() {
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const lockedConversationId =
    typeof params.conversationId === "string" ? params.conversationId : null;
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const locale = detectUmStreakLocale();
  const align = umStreakTextAlign(locale);
  const row = umStreakFlexDirection(locale);

  const [mode, setMode] = useState<VisualCaptureMode>("photo");
  const [facing, setFacing] = useState<VisualCameraFacing>("environment");
  const [asset, setAsset] = useState<CapturedVisualAsset | null>(null);
  const [caption, setCaption] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    lockedConversationId ? [lockedConversationId] : []
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void listConversationsForUser(getSupabase(), user.id).then((result) => {
      if (result.ok) setConversations(result.conversations);
    });
  }, [user]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.back();
      return true;
    });
    return () => sub.remove();
  }, [router]);

  const recipients = useMemo(() => {
    if (lockedConversationId) {
      return conversations.filter((item) => item.id === lockedConversationId);
    }
    return conversations;
  }, [conversations, lockedConversationId]);

  const onCapture = useCallback(async () => {
    setError(null);
    const result = await captureVisualFromCamera({ mode, facing });
    if (!result.ok) {
      if (!result.cancelled) setError(result.message);
      return;
    }
    setAsset(result.asset);
  }, [facing, mode]);

  const onLibrary = useCallback(async () => {
    setError(null);
    const result = await pickVisualFromLibrary();
    if (!result.ok) {
      if (!result.cancelled) setError(result.message);
      return;
    }
    setAsset(result.asset);
    setMode(result.asset.mediaType === "video" ? "video" : "photo");
  }, []);

  const toggleRecipient = useCallback((id: string) => {
    if (lockedConversationId) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  }, [lockedConversationId]);

  const onSend = useCallback(async () => {
    if (!user || !asset || pending) return;
    const targets = selectedIds.filter(Boolean);
    if (targets.length === 0) {
      setError(umStreakText("pickRecipient", locale));
      return;
    }
    setPending(true);
    setError(null);
    try {
      let lastConversationId: string | null = null;
      for (const conversationId of targets) {
        const peer = conversations.find((item) => item.id === conversationId);
        const uploaded = await uploadPrivateVisualMedia({
          supabase: getSupabase(),
          userId: user.id,
          conversationId,
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileName: asset.fileName,
          byteSize: asset.byteSize,
          mediaType: asset.mediaType,
        });
        if (!uploaded.ok) {
          setError(uploaded.message);
          return;
        }
        const sent = await sendVisualMessage(getSupabase(), user.id, {
          conversationId,
          storagePath: uploaded.path,
          mimeType: uploaded.mimeType,
          mediaType: uploaded.mediaType,
          caption: caption.trim() || null,
          clientId: newClientId(),
          byteSize: uploaded.byteSize,
          width: asset.width,
          height: asset.height,
          durationMs: asset.durationMs,
          peerId: peer?.peerId ?? null,
        });
        if (!sent.ok) {
          setError(sent.message);
          return;
        }
        lastConversationId = conversationId;
      }

      if (lockedConversationId) {
        router.back();
        return;
      }
      const href = lastConversationId
        ? conversationThreadHref(lastConversationId)
        : "/(tabs)/messages";
      if (href) {
        router.replace(href as never);
      } else {
        router.replace("/(tabs)/messages" as never);
      }
    } finally {
      setPending(false);
    }
  }, [
    asset,
    caption,
    conversations,
    locale,
    lockedConversationId,
    pending,
    router,
    selectedIds,
    user,
  ]);

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={[styles.error, umStreakWritingStyle(locale)]} >
          {umStreakText("signIn", locale)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { flexDirection: row }]}>
        <Text style={[styles.title, umStreakWritingStyle(locale)]} >
          {umStreakText("camera", locale)}
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={umStreakText("closeCamera", locale)}
          style={styles.headerBtn}
        >
          <Text style={[styles.headerBtnText, umStreakWritingStyle(locale)]} >
            {umStreakText("closeCamera", locale)}
          </Text>
        </Pressable>
      </View>

      <View style={styles.preview}>
        {asset ? (
          <Image
            source={{ uri: asset.uri }}
            style={styles.previewMedia}
            resizeMode="contain"
            accessibilityLabel={
              caption.trim() ||
              (asset.mediaType === "video"
                ? umStreakText("capturedVideo", locale)
                : umStreakText("capturedPhoto", locale))
            }
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={[styles.previewHint, umStreakWritingStyle(locale)]} >
            {umStreakText("livePreview", locale)}
          </Text>
        )}
      </View>

      {error ? (
        <Text style={[styles.error, umStreakWritingStyle(locale)]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Text style={[styles.privacy, { textAlign: align }]} >
        {umStreakText("notPublic", locale)}
      </Text>

      <View style={[styles.modes, { flexDirection: row }]}>
        <Pressable
          style={[styles.modeBtn, mode === "photo" && styles.modeOn]}
          onPress={() => {
            setAsset(null);
            setMode("photo");
          }}
          accessibilityRole="button"
          accessibilityLabel={umStreakText("photo", locale)}
        >
          <Text style={[styles.modeText, umStreakWritingStyle(locale)]} >
            {umStreakText("photo", locale)}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === "video" && styles.modeOn]}
          onPress={() => {
            setAsset(null);
            setMode("video");
          }}
          accessibilityRole="button"
          accessibilityLabel={umStreakText("video", locale)}
        >
          <Text style={[styles.modeText, umStreakWritingStyle(locale)]} >
            {umStreakText("video", locale)}
          </Text>
        </Pressable>
        <Pressable
          style={styles.modeBtn}
          onPress={() =>
            setFacing((value) =>
              value === "user" ? "environment" : "user"
            )
          }
          accessibilityRole="button"
          accessibilityLabel={umStreakText("flipCamera", locale)}
        >
          <Text style={styles.modeText}>↻</Text>
        </Pressable>
        <Pressable
          style={styles.modeBtn}
          onPress={() => void onLibrary()}
          accessibilityRole="button"
          accessibilityLabel={umStreakText("library", locale)}
        >
          <Text style={[styles.modeText, umStreakWritingStyle(locale)]} >
            {umStreakText("library", locale)}
          </Text>
        </Pressable>
      </View>

      {!asset ? (
        <Pressable
          style={styles.shutter}
          onPress={() => void onCapture()}
          accessibilityRole="button"
          accessibilityLabel={umStreakText("capture", locale)}
        />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sendBlock}
        >
          <TextInput
            value={caption}
            onChangeText={(value) => setCaption(value.slice(0, UM_STREAK_CAPTION_MAX))}
            placeholder={umStreakText("captionPlaceholder", locale)}
            placeholderTextColor={colors.textSubtle}
            style={[styles.caption, { textAlign: align }]}
            accessibilityLabel={umStreakText("captionPlaceholder", locale)}
            maxLength={UM_STREAK_CAPTION_MAX}
          />
          {!lockedConversationId ? (
            <View>
              <Text style={[styles.legend, { textAlign: align }]} >
                {umStreakText("selectFriends", locale)}
              </Text>
              {recipients.map((conversation) => {
                const selected = selectedIds.includes(conversation.id);
                return (
                  <Pressable
                    key={conversation.id}
                    style={[styles.friend, { flexDirection: row }]}
                    onPress={() => toggleRecipient(conversation.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={conversation.peerName}
                  >
                    <View style={[styles.check, selected && styles.checkOn]} />
                    <Text style={[styles.friendName, umStreakWritingStyle(locale)]} >
                      {conversation.peerName}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Pressable
            style={[
              styles.send,
              (pending || selectedIds.length === 0) && styles.sendDisabled,
            ]}
            onPress={() => void onSend()}
            disabled={pending || selectedIds.length === 0}
            accessibilityRole="button"
            accessibilityLabel={umStreakText("send", locale)}
            accessibilityState={{
              disabled: pending || selectedIds.length === 0,
              busy: pending,
            }}
          >
            {pending ? (
              <ActivityIndicator color="#050510" />
            ) : (
              <Text style={[styles.sendText, umStreakWritingStyle(locale)]} >
                {umStreakText("send", locale)}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050510" },
  center: {
    flex: 1,
    backgroundColor: "#050510",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { color: "#fde68a", fontWeight: "800", fontSize: 16 },
  headerBtn: { minHeight: 44, justifyContent: "center" },
  headerBtnText: { color: colors.text, fontWeight: "700" },
  preview: {
    flex: 1,
    minHeight: 220,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  previewMedia: { width: "100%", height: "100%" },
  previewHint: { color: colors.textSubtle, paddingHorizontal: 24 },
  error: {
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  privacy: {
    color: colors.textSubtle,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  modes: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modeBtn: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  modeOn: {
    borderColor: "rgba(251,191,36,0.4)",
    backgroundColor: "rgba(251,191,36,0.15)",
  },
  modeText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  shutter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: colors.accentAmber,
    alignSelf: "center",
    marginBottom: 16,
  },
  sendBlock: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  caption: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: colors.text,
    paddingHorizontal: 12,
  },
  legend: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
  },
  friend: {
    minHeight: 44,
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.accentAmber,
  },
  checkOn: { backgroundColor: colors.accentAmber },
  friendName: { color: colors.text, fontWeight: "600" },
  send: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: colors.accentAmber,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: "#050510", fontWeight: "800" },
});

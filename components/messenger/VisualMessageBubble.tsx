import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { umStreakText } from "@/src/lib/umStreak/copy";
import {
  detectUmStreakLocale,
  umStreakDirection,
} from "@/src/lib/umStreak/locale";
import {
  isKeepInConversationPolicy,
  isPlayableVisualPreviewUrl,
} from "@/src/lib/umStreak/retention";
import { visualReplayBlocked } from "@/src/lib/umStreak/visualMessage";
import type { Message } from "@/src/lib/messenger/types";
import { colors } from "@/src/theme/colors";

function OpenVisualVideo({
  uri,
  accessibilityLabel,
}: {
  uri: string;
  accessibilityLabel: string;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.muted = false;
  });

  return (
    <VideoView
      player={player}
      style={styles.media}
      nativeControls
      contentFit="contain"
      accessibilityLabel={accessibilityLabel}
    />
  );
}

type VisualMessageBubbleProps = {
  message: Message;
  onOpen: (message: Message) => void;
  busy?: boolean;
};

export function VisualMessageBubble({
  message,
  onOpen,
  busy = false,
}: VisualMessageBubbleProps) {
  const locale = detectUmStreakLocale();
  const visual = message.visual;
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [visual?.previewUrl]);

  if (!visual || message.isDeleted) {
    return null;
  }

  const keep = isKeepInConversationPolicy(visual.expirationPolicy);
  const replayBlocked = visualReplayBlocked({
    viewed: visual.viewed,
    isMine: message.isMine,
    expirationPolicy: visual.expirationPolicy,
  });
  const caption = visual.caption?.trim() || "";
  const mediaLabel =
    caption ||
    (visual.mediaType === "video"
      ? umStreakText("capturedVideo", locale)
      : umStreakText("capturedPhoto", locale));
  const playable = isPlayableVisualPreviewUrl(visual.previewUrl);
  const chipLabel = replayBlocked
    ? umStreakText("opened", locale)
    : keep
      ? umStreakText("keepInChat", locale)
      : umStreakText("viewOnce", locale);

  return (
    <View style={styles.wrap}>
      {playable && visual.previewUrl && !loadFailed ? (
        visual.mediaType === "video" ? (
          <OpenVisualVideo
            uri={visual.previewUrl}
            accessibilityLabel={mediaLabel}
          />
        ) : (
          <Image
            source={{ uri: visual.previewUrl }}
            style={styles.media}
            resizeMode="contain"
            accessibilityLabel={mediaLabel}
            accessibilityIgnoresInvertColors
            onError={() => setLoadFailed(true)}
          />
        )
      ) : (
        <Pressable
          style={[styles.chip, replayBlocked && styles.openedChip]}
          onPress={() => {
            setLoadFailed(false);
            onOpen(message);
          }}
          disabled={busy || replayBlocked}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || replayBlocked, busy }}
          accessibilityLabel={
            loadFailed ? umStreakText("mediaLoadFailed", locale) : chipLabel
          }
        >
          <Text
            style={[styles.chipText, { writingDirection: umStreakDirection(locale) }]}
          >
            {loadFailed
              ? umStreakText("mediaLoadFailed", locale)
              : chipLabel}
          </Text>
        </Pressable>
      )}
      {caption ? (
        <Text
          style={[styles.caption, { writingDirection: umStreakDirection(locale) }]}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, minWidth: 168 },
  media: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    backgroundColor: "#111118",
  },
  chip: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.3)",
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  openedChip: {
    opacity: 0.7,
    borderColor: colors.border,
  },
  chipText: {
    color: "#fef3c7",
    fontWeight: "800",
    fontSize: 14,
  },
  caption: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
});

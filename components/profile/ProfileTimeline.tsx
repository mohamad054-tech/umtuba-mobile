import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import type { ProfileTranslate } from "@/components/profile/profileUi";
import type { AppLocale } from "@/src/lib/i18n/locales";
import { localeTextAlign } from "@/src/lib/i18n/rtl";
import type { ProfileTimelineItem } from "@/src/lib/profile/buildProfileTimeline";
import {
  PROFILE_MEDIA_RESIZE_MODE,
  PROFILE_POST_CARD_PADDING_DP,
  PROFILE_TIMELINE_GUTTER_DP,
  type ProfileMediaBox,
} from "@/src/lib/profile/profileLayout";
import { formatPublishedAt } from "@/src/lib/time/publishedAt";
import { colors } from "@/src/theme/colors";

type ProfileTimelineProps = {
  locale: AppLocale;
  t: ProfileTranslate;
  items: readonly ProfileTimelineItem[];
  mediaBox: ProfileMediaBox;
  emptyLabel: string;
  postsFailed?: boolean;
  videosFailed?: boolean;
  onOpenVideo: (item: ProfileTimelineItem) => void;
};

export default function ProfileTimeline({
  locale,
  t,
  items,
  mediaBox,
  emptyLabel,
  postsFailed,
  videosFailed,
  onOpenVideo,
}: ProfileTimelineProps) {
  const textAlign = localeTextAlign(locale);
  const postMediaStyle = [styles.postMedia, { aspectRatio: mediaBox.aspectRatio }];

  if (items.length === 0) {
    return (
      <Text style={[styles.muted, { textAlign }]}>{emptyLabel}</Text>
    );
  }

  return (
    <View style={styles.timeline}>
      {postsFailed ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {t("profile.postsFailed")}
        </Text>
      ) : null}
      {videosFailed ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {t("profile.videosFailed")}
        </Text>
      ) : null}
      {items.map((item) => {
        const published = formatPublishedAt(item.createdAt, locale);
        const kindLabel =
          item.kind === "video"
            ? t("profile.videoPost")
            : item.kind === "image"
              ? t("profile.imagePost")
              : t("profile.textPost");
        const title =
          item.kind === "video" ? item.title : item.content || kindLabel;
        const canOpen = item.kind === "video";
        return (
          <Pressable
            key={`${item.kind}-${item.postId}`}
            style={styles.postCard}
            onPress={canOpen ? () => onOpenVideo(item) : undefined}
            disabled={!canOpen}
            accessibilityRole={canOpen ? "button" : "text"}
            accessibilityLabel={
              canOpen
                ? `${t("profile.openVideo")}: ${title}${published ? ` · ${published}` : ""}`
                : `${kindLabel}: ${title}${published ? ` · ${published}` : ""}`
            }
          >
            <Text style={styles.postKind}>{kindLabel}</Text>
            {item.kind === "video" ? (
              item.posterUrl ? (
                <Image
                  source={{ uri: item.posterUrl }}
                  style={postMediaStyle}
                  resizeMode={PROFILE_MEDIA_RESIZE_MODE}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={[
                    styles.postMediaFallback,
                    { aspectRatio: mediaBox.aspectRatio },
                  ]}
                >
                  <Text style={styles.postMediaText} numberOfLines={2}>
                    {item.title}
                  </Text>
                </View>
              )
            ) : item.kind === "image" && item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={postMediaStyle}
                resizeMode={PROFILE_MEDIA_RESIZE_MODE}
                accessibilityIgnoresInvertColors
              />
            ) : null}
            {item.kind !== "video" && item.content ? (
              <Text style={[styles.postBody, { textAlign }]}>{item.content}</Text>
            ) : item.kind === "video" ? (
              <Text style={[styles.postBody, { textAlign }]} numberOfLines={2}>
                {item.title}
              </Text>
            ) : null}
            {published ? (
              <Text style={styles.postPublished}>{published}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: {
    paddingHorizontal: PROFILE_TIMELINE_GUTTER_DP,
    gap: 12,
  },
  postCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: PROFILE_POST_CARD_PADDING_DP,
    gap: 8,
  },
  postKind: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  postBody: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  postPublished: {
    color: colors.textSubtle,
    fontSize: 12,
  },
  postMedia: {
    width: "100%",
    maxWidth: "100%",
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
  },
  postMediaFallback: {
    width: "100%",
    maxWidth: "100%",
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    overflow: "hidden",
  },
  postMediaText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  muted: {
    color: colors.textMuted,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  errorText: {
    color: colors.danger,
    marginBottom: 8,
  },
});

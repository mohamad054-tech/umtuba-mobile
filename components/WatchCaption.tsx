import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  localeTextAlign,
  localeWritingDirection,
  useTranslation,
} from "@/src/lib/i18n";
import {
  WATCH_CAPTION_TOGGLE_MIN_HEIGHT,
  parseWatchCaptionTokens,
  shouldOfferWatchCaptionToggle,
  watchCaptionLineLimit,
  watchCaptionText,
} from "@/src/lib/watch/watchCaption";
import { colors } from "@/src/theme/colors";

type Props = {
  caption?: string | null;
  title?: string | null;
  resetKey: string;
  onHashtagPress?: (tag: string) => void;
  onMentionPress?: (username: string) => void;
};

export function WatchCaption({
  caption,
  title,
  resetKey,
  onHashtagPress,
  onMentionPress,
}: Props) {
  const { t, locale } = useTranslation();
  const text = watchCaptionText(caption, title);
  const [expanded, setExpanded] = useState(false);
  const offerToggle = shouldOfferWatchCaptionToggle(text);
  const tokens = useMemo(() => parseWatchCaptionTokens(text), [text]);
  const align = localeTextAlign(locale);
  const writingDirection = localeWritingDirection(locale);

  useEffect(() => {
    setExpanded(false);
  }, [resetKey]);

  if (!text) return null;

  return (
    <View>
      <Text
        style={[styles.caption, { textAlign: align, writingDirection }]}
        numberOfLines={watchCaptionLineLimit(expanded)}
        accessibilityRole="text"
      >
        {tokens.map((token, index) => {
          if (token.type === "hashtag") {
            return (
              <Text
                key={`${token.tag}-${index}`}
                style={styles.link}
                onPress={() => onHashtagPress?.(token.tag)}
                accessibilityRole="link"
                accessibilityLabel={t("watch.openHashtag", {
                  values: { tag: token.tag },
                })}
              >
                {token.value}
              </Text>
            );
          }
          if (token.type === "mention") {
            return (
              <Text
                key={`${token.username}-${index}`}
                style={styles.link}
                onPress={() => onMentionPress?.(token.username)}
                accessibilityRole="link"
                accessibilityLabel={t("watch.openMention", {
                  values: { name: token.username },
                })}
              >
                {token.value}
              </Text>
            );
          }
          return <Text key={`t-${index}`}>{token.value}</Text>;
        })}
      </Text>
      {offerToggle ? (
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          style={styles.toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={
            expanded ? t("watch.collapseCaption") : t("watch.expandCaption")
          }
        >
          <Text style={[styles.toggleText, { textAlign: align, writingDirection }]}>
            {expanded ? t("watch.collapseCaption") : t("watch.expandCaption")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    color: colors.accentCyan,
    fontWeight: "700",
  },
  toggle: {
    minHeight: WATCH_CAPTION_TOGGLE_MIN_HEIGHT,
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  toggleText: {
    color: colors.accentCyan,
    fontSize: 13,
    fontWeight: "700",
  },
});

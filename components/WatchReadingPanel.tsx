import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { localeTextAlign, localeWritingDirection, useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

type Props = {
  title: string;
  body: string;
  paused: boolean;
  onTogglePause: () => void;
  onClose: () => void;
};

export function WatchReadingPanel({
  title,
  body,
  paused,
  onTogglePause,
  onClose,
}: Props) {
  const { t, locale } = useTranslation();
  const insets = useSafeAreaInsets();
  const textAlign = localeTextAlign(locale);
  const writingDirection = localeWritingDirection(locale);

  return (
    <View style={styles.sheet} pointerEvents="box-none">
      <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.toolbar}>
          <Pressable
            onPress={onTogglePause}
            style={styles.tool}
            accessibilityRole="button"
            accessibilityLabel={paused ? t("watch.play") : t("watch.pause")}
          >
            <Text style={styles.toolText}>
              {paused ? t("watch.play") : t("watch.pause")}
            </Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={styles.tool}
            accessibilityRole="button"
            accessibilityLabel={t("actions.close")}
          >
            <Text style={styles.toolText}>{t("actions.close")}</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator
        >
          {title ? (
            <Text
              style={[styles.title, { textAlign, writingDirection }]}
              accessibilityRole="header"
            >
              {title}
            </Text>
          ) : null}
          <Text style={[styles.body, { textAlign, writingDirection }]}>
            {body}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: "34%",
  },
  panel: {
    flex: 1,
    backgroundColor: "#070712",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    gap: 8,
  },
  tool: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  toolText: {
    color: colors.accentAmber,
    fontSize: 16,
    fontWeight: "800",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 36,
    fontWeight: "800",
    marginBottom: 14,
  },
  body: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 34,
  },
});

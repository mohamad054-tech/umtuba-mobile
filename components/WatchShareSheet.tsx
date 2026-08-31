import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@/src/lib/i18n";
import type { WatchShareChoice } from "@/src/lib/social/shareEntry";
import type { WatchShareMode } from "@/src/lib/social/sharePost";
import { colors } from "@/src/theme/colors";

type WatchShareSheetProps = {
  visible: boolean;
  choices: readonly WatchShareChoice[];
  onChoose: (mode: WatchShareMode) => void;
  onClose: () => void;
};

/**
 * Host-window overlay only. Do not wrap this in RN Modal — a Dialog
 * next to Android TextureView blacks the next item while audio plays.
 */
export function WatchShareSheet({
  visible,
  choices,
  onChoose,
  onClose,
}: WatchShareSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <View
      style={styles.host}
      pointerEvents="box-none"
      testID="watch-share-sheet"
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("actions.cancel")}
        testID="watch-share-backdrop"
      />
      <View
        style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom) }]}
      >
        <Text style={styles.title}>{t("watch.share")}</Text>
        {choices.map((choice) => (
          <Pressable
            key={choice.mode}
            style={styles.row}
            onPress={() => onChoose(choice.mode)}
            accessibilityRole="button"
            accessibilityLabel={t(choice.key)}
            testID={`watch-share-choice-${choice.mode}`}
          >
            <Text style={styles.rowText}>{t(choice.key)}</Text>
          </Pressable>
        ))}
        <Pressable
          style={styles.cancel}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("actions.cancel")}
          testID="watch-share-cancel"
        >
          <Text style={styles.cancelText}>{t("actions.cancel")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "flex-end",
    zIndex: 30,
    elevation: 30,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  row: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  rowText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  cancel: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  cancelText: {
    color: colors.accentCyan,
    fontWeight: "700",
    fontSize: 16,
  },
});

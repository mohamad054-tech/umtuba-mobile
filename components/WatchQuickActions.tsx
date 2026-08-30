import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import {
  isRtlLocale,
  localeTextAlign,
  localeWritingDirection,
  useTranslation,
} from "@/src/lib/i18n";
import { watchLightHaptic } from "@/src/lib/watch/watchHaptics";
import {
  WATCH_PLAYBACK_SPEEDS,
  type WatchPlaybackSpeed,
  type WatchQuickActionId,
} from "@/src/lib/watch/watchQuickActions";
import { colors } from "@/src/theme/colors";

type Props = {
  visible: boolean;
  actions: WatchQuickActionId[];
  saved: boolean;
  following: boolean;
  canFollow: boolean;
  speed: WatchPlaybackSpeed;
  captionsOn: boolean;
  onClose: () => void;
  onSave: () => void;
  onNotInterested: () => void;
  onSpeed: (speed: WatchPlaybackSpeed) => void;
  onCaptions: () => void;
  onReport?: () => void;
  onShare?: () => void;
  onFollow?: () => void;
};

export function WatchQuickActions({
  visible,
  actions,
  saved,
  following,
  canFollow,
  speed,
  captionsOn,
  onClose,
  onSave,
  onNotInterested,
  onSpeed,
  onCaptions,
  onReport,
  onShare,
  onFollow,
}: Props) {
  const { t, locale } = useTranslation();
  const align = localeTextAlign(locale);
  const writingDirection = localeWritingDirection(locale);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("actions.close")}
        testID="watch-quick-actions"
      >
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={[styles.title, { textAlign: align, writingDirection }]}>
            {t("watch.quickActions")}
          </Text>
          <Text style={[styles.hint, { textAlign: align, writingDirection }]}>
            {t("watch.quickActionsHint")}
          </Text>
          {actions.includes("speed") ? (
            <View style={styles.speedRow}>
              <Text
                style={[styles.speedLabel, { textAlign: align, writingDirection }]}
              >
                {t("watch.playbackSpeed")}
              </Text>
              <View
                style={[
                  styles.speedChips,
                  {
                    flexDirection: isRtlLocale(locale) ? "row-reverse" : "row",
                  },
                ]}
              >
                {WATCH_PLAYBACK_SPEEDS.map((value) => {
                  const selected = value === speed;
                  return (
                    <Pressable
                      key={value}
                      style={[styles.speedChip, selected && styles.speedChipOn]}
                      onPress={() => {
                        watchLightHaptic();
                        onSpeed(value);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={t("watch.speedValue", {
                        values: { speed: String(value) },
                      })}
                    >
                      <Text
                        style={[
                          styles.speedChipText,
                          selected && styles.speedChipTextOn,
                        ]}
                      >
                        {value}x
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          <View style={styles.grid}>
            {actions.includes("save") ? (
              <ActionRow
                label={saved ? t("watch.unsave") : t("watch.save")}
                onPress={onSave}
                selected={saved}
              />
            ) : null}
            {actions.includes("not-interested") ? (
              <ActionRow
                label={t("watch.notInterested")}
                onPress={() => {
                  watchLightHaptic();
                  onNotInterested();
                }}
              />
            ) : null}
            {actions.includes("captions") ? (
              <ActionRow
                label={
                  captionsOn ? t("watch.captionsOn") : t("watch.captionsOff")
                }
                onPress={() => {
                  watchLightHaptic();
                  onCaptions();
                }}
              />
            ) : null}
            {actions.includes("share") && onShare ? (
              <ActionRow
                label={t("watch.share")}
                onPress={() => {
                  watchLightHaptic();
                  onShare();
                }}
              />
            ) : null}
            {actions.includes("report") && onReport ? (
              <ActionRow
                label={t("actions.report")}
                onPress={() => {
                  watchLightHaptic();
                  onReport();
                }}
              />
            ) : null}
            {actions.includes("follow") && canFollow && onFollow ? (
              <ActionRow
                label={
                  following ? t("follow.following") : t("follow.follow")
                }
                onPress={following ? undefined : onFollow}
                disabled={following}
                selected={following}
              />
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({
  label,
  onPress,
  disabled,
  selected,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{
        disabled: disabled === true,
        selected: selected === true,
      }}
    >
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  speedRow: {
    marginBottom: 12,
  },
  speedLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  speedChips: {
    flexDirection: "row",
    gap: 8,
  },
  speedChip: {
    minWidth: 56,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  speedChipOn: {
    borderColor: colors.accentCyan,
    backgroundColor: "rgba(34,211,238,0.12)",
  },
  speedChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  speedChipTextOn: {
    color: colors.accentCyan,
  },
  grid: {
    gap: 8,
  },
  row: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
});

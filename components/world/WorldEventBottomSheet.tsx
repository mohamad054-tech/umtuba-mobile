import { Pressable, StyleSheet, Text, View } from "react-native";

import type { WorldEventSheetState } from "@/src/lib/world/events";
import { colors } from "@/src/theme/colors";

type WorldEventBottomSheetProps = {
  sheet: WorldEventSheetState | null;
  bottomInset?: number;
  onClose?: () => void;
};

export function WorldEventBottomSheet({
  sheet,
  bottomInset = 0,
  onClose,
}: WorldEventBottomSheetProps) {
  if (!sheet?.open) return null;

  const realMeta = sheet.meta.filter((m) => m.value != null && m.value !== "");
  const enabledActions = sheet.actions.filter((a) => a.enabled);

  return (
    <View
      style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 12) }]}
      accessibilityRole="summary"
      accessibilityLabel={`Event details for ${sheet.eventName}`}
    >
      <View style={styles.handle} accessibilityElementsHidden />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{sheet.eventName}</Text>
          <Text style={styles.subtitle}>
            {sheet.eventTypeLabel} · {sheet.cityName}
          </Text>
        </View>
        {onClose ? (
          <Pressable
            onPress={onClose}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close event details"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        ) : null}
      </View>

      {realMeta.length > 0 ? (
        <View style={styles.meta}>
          {realMeta.map((entry) => (
            <View key={entry.id} style={styles.metaRow}>
              <Text style={styles.metaLabel}>{entry.label}</Text>
              <Text style={styles.metaValue}>{entry.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {enabledActions.map((action) => (
        <Pressable
          key={action.id}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerText: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  close: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  meta: { gap: 8 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  metaLabel: { color: colors.textMuted, fontSize: 13 },
  metaValue: { color: colors.text, fontSize: 13, fontWeight: "600" },
  action: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
});

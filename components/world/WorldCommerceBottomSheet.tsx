import { Pressable, StyleSheet, Text, View } from "react-native";

import type { WorldCommerceSheetState } from "@/src/lib/world/commerce";
import { colors } from "@/src/theme/colors";

type WorldCommerceBottomSheetProps = {
  sheet: WorldCommerceSheetState | null;
  bottomInset?: number;
  onClose?: () => void;
};

export function WorldCommerceBottomSheet({
  sheet,
  bottomInset = 0,
  onClose,
}: WorldCommerceBottomSheetProps) {
  if (!sheet?.open) return null;

  const subtitle = sheet.brandName
    ? `${sheet.commerceTypeLabel} · ${sheet.cityName} · ${sheet.brandName}`
    : `${sheet.commerceTypeLabel} · ${sheet.cityName}`;

  return (
    <View
      style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 12) }]}
      accessibilityRole="summary"
      accessibilityLabel={`Business details for ${sheet.name}`}
    >
      <View style={styles.handle} accessibilityElementsHidden />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{sheet.name}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {onClose ? (
          <Pressable
            onPress={onClose}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close business details"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.meta}>
        {sheet.meta.map((entry) => (
          <View key={entry.id} style={styles.metaRow}>
            <Text style={styles.metaLabel}>{entry.label}</Text>
            <Text style={styles.metaValue}>{entry.value ?? entry.placeholder}</Text>
          </View>
        ))}
      </View>

      {sheet.actions.map((action) => (
        <Pressable
          key={action.id}
          style={[styles.action, !action.enabled && styles.actionDisabled]}
          disabled
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={`${action.label}, ${action.placeholder}`}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
          <Text style={styles.actionHint}>{action.placeholder}</Text>
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
  metaValue: { color: colors.textSubtle, fontSize: 13, fontWeight: "600" },
  action: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionDisabled: { opacity: 0.55 },
  actionLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  actionHint: { color: colors.textSubtle, fontSize: 12 },
});

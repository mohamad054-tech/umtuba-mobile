import { Pressable, StyleSheet, Text, View } from "react-native";

import type { WorldUserSheetState } from "@/src/lib/world/users";
import { colors } from "@/src/theme/colors";

type WorldUserBottomSheetProps = {
  sheet: WorldUserSheetState | null;
  bottomInset?: number;
  onClose?: () => void;
};

/**
 * User details sheet — view-state only (no providers / MapLibre).
 * Social buttons are disabled placeholders in V1.
 */
export function WorldUserBottomSheet({
  sheet,
  bottomInset = 0,
  onClose,
}: WorldUserBottomSheetProps) {
  if (!sheet?.open) return null;

  return (
    <View
      style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 12) }]}
      accessibilityRole="summary"
      accessibilityLabel={`User details for ${sheet.displayName}`}
    >
      <View style={styles.handle} accessibilityElementsHidden />
      <View style={styles.header}>
        <View style={styles.avatar} accessibilityElementsHidden>
          <Text style={styles.avatarText}>{sheet.initial}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{sheet.displayName}</Text>
          <Text style={styles.subtitle}>
            @{sheet.handle} · {sheet.cityName}
            {sheet.presenceLabel ? ` · ${sheet.presenceLabel}` : ""}
          </Text>
        </View>
        {onClose ? (
          <Pressable
            onPress={onClose}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close user details"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.actions}>
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.bg,
    fontSize: 18,
    fontWeight: "800",
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  close: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  actions: {
    gap: 8,
  },
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
  actionDisabled: {
    opacity: 0.55,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  actionHint: {
    color: colors.textSubtle,
    fontSize: 12,
  },
});

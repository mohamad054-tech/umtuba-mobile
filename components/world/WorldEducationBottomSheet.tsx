import { Pressable, StyleSheet, Text, View } from "react-native";

import type { WorldEducationSheetState } from "@/src/lib/world/education";
import { colors } from "@/src/theme/colors";

type WorldEducationBottomSheetProps = {
  sheet: WorldEducationSheetState | null;
  bottomInset?: number;
  onClose?: () => void;
};

/**
 * Education details sheet — view-state only (no pipeline / MapLibre imports).
 */
export function WorldEducationBottomSheet({
  sheet,
  bottomInset = 0,
  onClose,
}: WorldEducationBottomSheetProps) {
  if (!sheet?.open) return null;

  return (
    <View
      style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 12) }]}
      accessibilityRole="summary"
      accessibilityLabel={`Education details for ${sheet.name}`}
    >
      <View style={styles.handle} accessibilityElementsHidden />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{sheet.name}</Text>
          <Text style={styles.subtitle}>
            {sheet.typeLabel} · {sheet.cityName}
          </Text>
        </View>
        {onClose ? (
          <Pressable
            onPress={onClose}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close education details"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.metrics}>
        {sheet.metrics.map((metric) => (
          <View key={metric.id} style={styles.metric}>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricValue}>
              {metric.value ?? metric.placeholder}
            </Text>
          </View>
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
  metrics: {
    gap: 8,
  },
  metric: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  metricValue: {
    color: colors.textSubtle,
    fontSize: 13,
    fontWeight: "600",
  },
});

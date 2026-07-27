import { Pressable, StyleSheet, Text, View } from "react-native";

import type { WorldPlaceSheetState } from "@/src/lib/world/places";
import { colors } from "@/src/theme/colors";

type WorldPlaceBottomSheetProps = {
  sheet: WorldPlaceSheetState | null;
  bottomInset?: number;
  onClose?: () => void;
};

/**
 * Place details sheet — real fields only (no placeholder metrics).
 */
export function WorldPlaceBottomSheet({
  sheet,
  bottomInset = 0,
  onClose,
}: WorldPlaceBottomSheetProps) {
  if (!sheet?.open) return null;

  const realMetrics = sheet.metrics.filter((m) => m.value != null && m.value !== "");

  return (
    <View
      style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 12) }]}
      accessibilityRole="summary"
      accessibilityLabel={`Place details for ${sheet.name}`}
    >
      <View style={styles.handle} accessibilityElementsHidden />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{sheet.name}</Text>
          <Text style={styles.subtitle}>
            {sheet.countryName} · {sheet.kindLabel}
          </Text>
        </View>
        {onClose ? (
          <Pressable
            onPress={onClose}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close place details"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        ) : null}
      </View>

      {realMetrics.length > 0 ? (
        <View style={styles.metrics}>
          {realMetrics.map((metric) => (
            <View key={metric.id} style={styles.metric}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
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
    width: 42,
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
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  close: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: colors.accentCyan,
    fontSize: 12,
    fontWeight: "700",
  },
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 4,
  },
  metric: {
    width: "30%",
    flexGrow: 1,
    minWidth: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  metricLabel: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
});

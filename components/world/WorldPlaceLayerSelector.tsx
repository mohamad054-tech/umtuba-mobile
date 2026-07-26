import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { WorldPlaceLayerControlState } from "@/src/lib/world/experience";
import type { WorldPlaceLayerId } from "@/src/lib/world/places";
import { colors } from "@/src/theme/colors";

type WorldPlaceLayerSelectorProps = {
  layers: WorldPlaceLayerControlState[];
  onToggle?: (layerId: WorldPlaceLayerId) => void;
};

/**
 * Capitals / Major Cities / Minor Cities toggles — view-state only.
 */
export function WorldPlaceLayerSelector({
  layers,
  onToggle,
}: WorldPlaceLayerSelectorProps) {
  if (layers.length === 0) return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.heading} accessibilityRole="header">
        Places
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityLabel="World place layers"
      >
        {layers.map((layer) => {
          const disabled = !layer.enabled;
          return (
            <Pressable
              key={layer.layerId}
              style={[
                styles.chip,
                layer.active && styles.chipActive,
                disabled && styles.chipDisabled,
              ]}
              disabled={disabled}
              onPress={() => {
                if (disabled) return;
                onToggle?.(layer.layerId);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${layer.label} place layer`}
              accessibilityState={{ disabled, selected: layer.active }}
            >
              <Text
                style={[
                  styles.chipText,
                  layer.active && styles.chipTextActive,
                  disabled && styles.chipTextDisabled,
                ]}
                accessible={false}
              >
                {layer.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  heading: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  row: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    borderColor: colors.accentCyan,
    backgroundColor: "rgba(34,211,238,0.12)",
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextActive: {
    color: colors.accentCyan,
  },
  chipTextDisabled: {
    color: colors.textSubtle,
  },
});

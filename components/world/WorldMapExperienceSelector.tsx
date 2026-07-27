import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type {
  WorldBuildingsControlState,
  WorldBuildingsMode,
  WorldRoadDetail,
  WorldRoadDetailControlState,
} from "@/src/lib/world/experience";
import { colors } from "@/src/theme/colors";

type WorldMapExperienceSelectorProps = {
  roadControls: WorldRoadDetailControlState[];
  buildingsControls: WorldBuildingsControlState[];
  onSelectRoadDetail?: (id: WorldRoadDetail) => void;
  onSelectBuildings?: (id: WorldBuildingsMode) => void;
};

/**
 * Compact Roads / Buildings controls — view-state only, no MapLibre imports.
 */
export function WorldMapExperienceSelector({
  roadControls,
  buildingsControls,
  onSelectRoadDetail,
  onSelectBuildings,
}: WorldMapExperienceSelectorProps) {
  if (roadControls.length === 0 && buildingsControls.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {roadControls.length > 0 ? (
        <>
          <Text style={styles.heading} accessibilityRole="header">
            Roads
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
            accessibilityLabel="Road detail"
          >
            {roadControls.map((control) => {
              const disabled = !control.enabled;
              return (
                <Pressable
                  key={control.id}
                  style={[
                    styles.chip,
                    control.active && styles.chipActive,
                    disabled && styles.chipDisabled,
                  ]}
                  disabled={disabled}
                  onPress={() => {
                    if (disabled) return;
                    onSelectRoadDetail?.(control.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={control.label}
                  accessibilityState={{ disabled, selected: control.active }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      control.active && styles.chipTextActive,
                      disabled && styles.chipTextDisabled,
                    ]}
                    accessible={false}
                  >
                    {control.label.replace(/^Roads\s+/, "")}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {buildingsControls.length > 0 ? (
        <>
          <Text style={styles.heading} accessibilityRole="header">
            Buildings
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
            accessibilityLabel="Buildings mode"
          >
            {buildingsControls.map((control) => {
              const disabled = !control.enabled;
              return (
                <Pressable
                  key={control.id}
                  style={[
                    styles.chip,
                    control.active && styles.chipActive,
                    disabled && styles.chipDisabled,
                  ]}
                  disabled={disabled}
                  onPress={() => {
                    if (disabled) return;
                    onSelectBuildings?.(control.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={control.label}
                  accessibilityState={{ disabled, selected: control.active }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      control.active && styles.chipTextActive,
                      disabled && styles.chipTextDisabled,
                    ]}
                    accessible={false}
                  >
                    {control.label.replace(/^Buildings\s+/, "")}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}
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

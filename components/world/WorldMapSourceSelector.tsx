import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { WorldMapSourceControlState } from "@/src/lib/world/experience";
import { colors } from "@/src/theme/colors";

type WorldMapSourceSelectorProps = {
  sources: WorldMapSourceControlState[];
  onSelect?: (sourceId: string) => void;
};

/**
 * Streets / Satellite / Terrain map source switcher — view-state only, no tile URLs.
 */
export function WorldMapSourceSelector({
  sources,
  onSelect,
}: WorldMapSourceSelectorProps) {
  if (sources.length === 0) return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.heading} accessibilityRole="header">
        Map
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityLabel="World map sources"
      >
        {sources.map((source) => {
          const disabled = !source.enabled;
          return (
            <Pressable
              key={source.id}
              style={[
                styles.chip,
                source.active && styles.chipActive,
                disabled && styles.chipDisabled,
              ]}
              disabled={disabled}
              onPress={() => {
                if (disabled) return;
                onSelect?.(source.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${source.label} map source`}
              accessibilityState={{ disabled, selected: source.active }}
            >
              <Text
                style={[
                  styles.chipText,
                  source.active && styles.chipTextActive,
                  disabled && styles.chipTextDisabled,
                ]}
                accessible={false}
              >
                {source.label}
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

import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { WorldProjectionControlState } from "@/src/lib/world/experience";
import { useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

type WorldProjectionSelectorProps = {
  controls: WorldProjectionControlState[];
  onSelect?: (id: "globe" | "map") => void;
};

/**
 * Globe / Map projection switcher — view-state only, no MapLibre imports.
 */
export function WorldProjectionSelector({
  controls,
  onSelect,
}: WorldProjectionSelectorProps) {
  const { t } = useTranslation();
  if (controls.length === 0) return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.heading} accessibilityRole="header">
        {t("world.projection")}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityLabel={t("world.projection")}
      >
        {controls.map((control) => {
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
                onSelect?.(control.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${control.label} projection`}
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
                {control.label}
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

import { Pressable, StyleSheet, Text, View } from "react-native";

import type {
  WorldCameraControlId,
  WorldCameraControlState,
} from "@/src/lib/world/experience";
import { useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

type WorldCameraControlsProps = {
  controls: WorldCameraControlState[];
  onPress?: (id: WorldCameraControlId) => void;
  compact?: boolean;
};

export function WorldCameraControls({
  controls,
  onPress,
  compact = false,
}: WorldCameraControlsProps) {
  const { t } = useTranslation();
  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact]}
      accessibilityRole="summary"
      accessibilityLabel={t("world.camera")}
    >
      {controls.map((control) => {
        const disabled = !control.enabled;
        return (
          <Pressable
            key={control.id}
            style={[
              styles.button,
              compact && styles.buttonCompact,
              disabled && styles.buttonDisabled,
            ]}
            disabled={disabled}
            onPress={() => {
              if (disabled) return;
              onPress?.(control.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={control.label}
            accessibilityState={{ disabled }}
          >
            <Text
              style={[styles.label, disabled && styles.labelDisabled]}
              accessible={false}
            >
              {shortLabel(control.id)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function shortLabel(id: WorldCameraControlId): string {
  switch (id) {
    case "zoom_in":
      return "+";
    case "zoom_out":
      return "−";
    case "recenter":
      return "⌖";
    case "reset_orientation":
      return "⟲";
    default:
      return "?";
  }
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  wrapCompact: {
    flexDirection: "column",
    paddingHorizontal: 0,
    paddingVertical: 0,
    gap: 6,
  },
  button: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonCompact: {
    minWidth: 40,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
  },
  buttonDisabled: {
    opacity: 0.38,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  labelDisabled: {
    color: colors.textSubtle,
  },
});

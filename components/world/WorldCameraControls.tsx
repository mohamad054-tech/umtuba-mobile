import { Pressable, StyleSheet, Text, View } from "react-native";

import type {
  WorldCameraControlId,
  WorldCameraControlState,
} from "@/src/lib/world/experience";
import { colors } from "@/src/theme/colors";

type WorldCameraControlsProps = {
  controls: WorldCameraControlState[];
  onPress?: (id: WorldCameraControlId) => void;
};

export function WorldCameraControls({
  controls,
  onPress,
}: WorldCameraControlsProps) {
  return (
    <View
      style={styles.wrap}
      accessibilityRole="summary"
      accessibilityLabel="World camera controls"
    >
      {controls.map((control) => {
        const disabled = !control.enabled;
        return (
          <Pressable
            key={control.id}
            style={[styles.button, disabled && styles.buttonDisabled]}
            disabled={disabled}
            onPress={() => {
              if (disabled) return;
              onPress?.(control.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={control.label}
            accessibilityState={{ disabled }}
            accessibilityHint={
              disabled
                ? "Unavailable until the World renderer is connected"
                : undefined
            }
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
  buttonDisabled: {
    opacity: 0.38,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  labelDisabled: {
    color: colors.textSubtle,
  },
});

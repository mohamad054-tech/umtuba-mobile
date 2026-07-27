import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { WorldLayerControlState } from "@/src/lib/world/experience";
import type { WorldCategoryId } from "@/src/lib/world";
import { colors } from "@/src/theme/colors";

type WorldLayerSelectorProps = {
  layers: WorldLayerControlState[];
  onToggle?: (categoryId: WorldCategoryId, enabled: boolean) => void;
};

export function WorldLayerSelector({
  layers,
  onToggle,
}: WorldLayerSelectorProps) {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.heading} accessibilityRole="header">
        Layers
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityLabel="World layer categories"
      >
        {layers.map((layer) => {
          const disabled = !layer.enabled;
          const stateLabel = disabled ? "Unavailable" : layer.active ? "On" : "Off";
          return (
            <Pressable
              key={layer.categoryId}
              style={[
                styles.chip,
                layer.active && styles.chipActive,
                disabled && styles.chipDisabled,
              ]}
              disabled={disabled}
              onPress={() => onToggle?.(layer.categoryId, layer.enabled)}
              accessibilityRole="button"
              accessibilityLabel={`${layer.label} layer, ${stateLabel}`}
              accessibilityState={{
                disabled,
                selected: layer.active,
              }}
              accessibilityHint={
                disabled
                  ? layer.reason ?? "Layer unavailable"
                  : layer.active
                    ? "Hide this layer"
                    : "Show this layer"
              }
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
              <Text
                style={[
                  styles.chipState,
                  layer.active && styles.chipStateActive,
                  disabled && styles.chipTextDisabled,
                ]}
                accessible={false}
              >
                {stateLabel}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

type WorldFilterPanelProps = {
  open: boolean;
  selectedCount: number;
  layers: WorldLayerControlState[];
  onClose?: () => void;
  onClear?: () => void;
};

export function WorldFilterPanel({
  open,
  selectedCount,
  layers,
  onClose,
  onClear,
}: WorldFilterPanelProps) {
  if (!open) return null;

  const enabledCount = layers.filter((l) => l.enabled).length;

  return (
    <View
      style={styles.panel}
      accessibilityRole="summary"
      accessibilityLabel="World filters"
    >
      <View style={styles.panelHeader}>
        <Text style={styles.heading} accessibilityRole="header">
          Filters
        </Text>
        {onClose ? (
          <Pressable
            onPress={onClose}
            style={styles.panelAction}
            accessibilityRole="button"
            accessibilityLabel="Close filters"
          >
            <Text style={styles.panelActionText}>Close</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.panelBody}>
        {enabledCount === 0
          ? "Category filters stay inactive until trusted World data is connected. No fake counts or entities are shown."
          : `${selectedCount} categor${selectedCount === 1 ? "y" : "ies"} selected.`}
      </Text>
      {selectedCount > 0 && onClear ? (
        <Pressable
          style={styles.clear}
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear category filters"
        >
          <Text style={styles.clearText}>Clear filters</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type WorldDetailsPanelProps = {
  open: boolean;
  entityTitle: string | null;
  entitySubtitle: string | null;
  onClose?: () => void;
};

export function WorldDetailsPanel({
  open,
  entityTitle,
  entitySubtitle,
  onClose,
}: WorldDetailsPanelProps) {
  if (!open) return null;

  return (
    <View
      style={styles.panel}
      accessibilityRole="summary"
      accessibilityLabel="World entity details"
    >
      <View style={styles.panelHeader}>
        <Text style={styles.heading} accessibilityRole="header">
          Details
        </Text>
        {onClose ? (
          <Pressable
            onPress={onClose}
            style={styles.panelAction}
            accessibilityRole="button"
            accessibilityLabel="Close details"
          >
            <Text style={styles.panelActionText}>Close</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.panelTitle}>
        {entityTitle ?? "No entity selected"}
      </Text>
      <Text style={styles.panelBody}>
        {entitySubtitle ??
          "Entity details appear here when a trusted World source provides them."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 2,
  },
  heading: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  row: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: 8,
  },
  chip: {
    minHeight: 48,
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  chipActive: {
    borderColor: colors.accentCyan,
  },
  chipDisabled: {
    opacity: 0.4,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextActive: {
    color: colors.accentCyan,
  },
  chipTextDisabled: {
    color: colors.textSubtle,
  },
  chipState: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  chipStateActive: {
    color: colors.accentCyan,
  },
  panel: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: 8,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  panelAction: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  panelActionText: {
    color: colors.accentCyan,
    fontWeight: "700",
    fontSize: 13,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  panelBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  clear: {
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  clearText: {
    color: colors.accentCyan,
    fontWeight: "700",
    fontSize: 13,
  },
});

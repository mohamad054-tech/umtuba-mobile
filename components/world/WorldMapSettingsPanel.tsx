import { Pressable, StyleSheet, Text, View } from "react-native";

import { WorldMapExperienceSelector } from "@/components/world/WorldMapExperienceSelector";
import { WorldMapSourceSelector } from "@/components/world/WorldMapSourceSelector";
import type {
  WorldBuildingsControlState,
  WorldBuildingsMode,
  WorldMapSourceControlState,
  WorldRoadDetail,
  WorldRoadDetailControlState,
} from "@/src/lib/world/experience";
import { useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

type WorldMapSettingsPanelProps = {
  open: boolean;
  onToggle: () => void;
  sources: WorldMapSourceControlState[];
  roadControls: WorldRoadDetailControlState[];
  buildingsControls: WorldBuildingsControlState[];
  onSelectMapSource?: (sourceId: string) => void;
  onSelectRoadDetail?: (id: WorldRoadDetail) => void;
  onSelectBuildings?: (id: WorldBuildingsMode) => void;
};

/**
 * Collapsible secondary map settings (Sources / Roads / Buildings).
 * Product chrome — keeps primary UI focused on Search + Layers.
 */
export function WorldMapSettingsPanel({
  open,
  onToggle,
  sources,
  roadControls,
  buildingsControls,
  onSelectMapSource,
  onSelectRoadDetail,
  onSelectBuildings,
}: WorldMapSettingsPanelProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap} accessibilityLabel={t("world.mapSettings")}>
      <Pressable
        style={[styles.toggle, open && styles.toggleOpen]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={
          open ? t("world.hideSettings") : t("world.showSettings")
        }
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.toggleText} numberOfLines={1}>
          {t("world.mapSettings")}
        </Text>
        <Text style={styles.toggleChevron}>{open ? "▾" : "▸"}</Text>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <WorldMapSourceSelector
            sources={sources}
            onSelect={onSelectMapSource}
          />
          <WorldMapExperienceSelector
            roadControls={roadControls}
            buildingsControls={buildingsControls}
            onSelectRoadDetail={onSelectRoadDetail}
            onSelectBuildings={onSelectBuildings}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 4,
  },
  toggle: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleOpen: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
  },
  toggleText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  toggleChevron: {
    color: colors.textSubtle,
    fontSize: 14,
    fontWeight: "700",
  },
  body: {
    gap: 2,
  },
});

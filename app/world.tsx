import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WorldExperienceShell } from "@/components/world/WorldExperienceShell";
import { useWorldRuntime } from "@/src/lib/world/runtime";
import type { WorldSearchResult } from "@/src/lib/world/search";
import { colors } from "@/src/theme/colors";

/**
 * World screen — UI only.
 * Runtime owns state + renderer adapter; no direct renderer/SDK access here.
 */
export default function WorldScreen() {
  const insets = useSafeAreaInsets();
  const { controller } = useWorldRuntime();
  const view = controller.getViewState();
  const renderer = controller.getRendererAdapter();
  const [searchQuery, setSearchQuery] = useState("");

  const searchResults = useMemo(
    () => controller.searchWorld(searchQuery),
    [controller, searchQuery, view.entities]
  );

  if (view.phase === "preparing" || view.phase === "loading") {
    return (
      <View
        style={styles.center}
        accessibilityLabel={
          view.phase === "preparing" ? "Preparing World" : "Loading World"
        }
        accessibilityRole="progressbar"
      >
        <ActivityIndicator color={colors.accentCyan} size="large" />
        <Text style={styles.muted}>{view.message}</Text>
      </View>
    );
  }

  return (
    <WorldExperienceShell
      view={view}
      renderer={renderer}
      bottomInset={insets.bottom}
      searchQuery={searchQuery}
      searchResults={searchResults}
      onSearchQueryChange={setSearchQuery}
      onSelectSearchResult={(result: WorldSearchResult) => {
        const ok = controller.selectSearchResult(result);
        if (ok) setSearchQuery("");
      }}
      onRetry={() => {
        void controller.retry();
      }}
      onCameraControl={(id) => {
        controller.applyCameraControl(id);
      }}
      onToggleLayer={(categoryId, enabled) => {
        controller.toggleLayer(categoryId, enabled);
      }}
      onTogglePlaceLayer={(layerId) => {
        controller.togglePlaceLayer(layerId);
      }}
      onToggleFilters={() => {
        controller.toggleFiltersPanel();
      }}
      onToggleLayersPanel={() => {
        controller.toggleLayersPanel();
      }}
      onClearFilters={() => {
        controller.clearFilters();
      }}
      onCloseFilters={() => {
        controller.closeFilters();
      }}
      onCloseDetails={() => {
        controller.closeDetails();
      }}
      onSelectMapSource={(sourceId) => {
        controller.setMapSourceId(sourceId);
      }}
      onSelectProjection={(id) => {
        controller.setProjectionPreference(id === "globe" ? "globe" : "map");
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
});

import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { WorldCameraControls } from "@/components/world/WorldCameraControls";
import { WorldLayerSelector } from "@/components/world/WorldControls";
import { WorldHeader } from "@/components/world/WorldHeader";
import { WorldCommerceBottomSheet } from "@/components/world/WorldCommerceBottomSheet";
import { WorldEventBottomSheet } from "@/components/world/WorldEventBottomSheet";
import { WorldEducationBottomSheet } from "@/components/world/WorldEducationBottomSheet";
import { WorldGameBottomSheet } from "@/components/world/WorldGameBottomSheet";
import { WorldPlaceBottomSheet } from "@/components/world/WorldPlaceBottomSheet";
import { WorldUserBottomSheet } from "@/components/world/WorldUserBottomSheet";
import { WorldPlaceLayerSelector } from "@/components/world/WorldPlaceLayerSelector";
import { WorldMapSettingsPanel } from "@/components/world/WorldMapSettingsPanel";
import { WorldProjectionSelector } from "@/components/world/WorldProjectionSelector";
import {
  WorldAttribution,
  WorldRendererHost,
} from "@/components/world/WorldRendererHost";
import { WorldSearchBar } from "@/components/world/WorldSearchBar";
import { WorldStatePanel } from "@/components/world/WorldStatePanel";
import type {
  WorldBuildingsMode,
  WorldCameraControlId,
  WorldExperienceViewState,
  WorldRoadDetail,
} from "@/src/lib/world/experience";
import type { WorldCategoryId } from "@/src/lib/world";
import type { WorldPlaceLayerId } from "@/src/lib/world/places";
import type { WorldSearchResult } from "@/src/lib/world/search";
import type { WorldRendererAdapter } from "@/src/lib/world/renderer";
import { useTranslation } from "@/src/lib/i18n";
import { colors } from "@/src/theme/colors";

type WorldExperienceShellProps = {
  view: WorldExperienceViewState;
  renderer: WorldRendererAdapter;
  bottomInset?: number;
  searchQuery?: string;
  searchResults?: WorldSearchResult[];
  onSearchQueryChange?: (query: string) => void;
  onSelectSearchResult?: (result: WorldSearchResult) => void;
  onRetry?: () => void;
  onCameraControl?: (id: WorldCameraControlId) => void;
  onToggleLayer?: (categoryId: WorldCategoryId, enabled: boolean) => void;
  onTogglePlaceLayer?: (layerId: WorldPlaceLayerId) => void;
  onSelectMapSource?: (sourceId: string) => void;
  onSelectProjection?: (id: "globe" | "map") => void;
  onSelectRoadDetail?: (id: WorldRoadDetail) => void;
  onSelectBuildings?: (id: WorldBuildingsMode) => void;
  onCloseDetails?: () => void;
};

function statusKey(view: WorldExperienceViewState) {
  if (view.phase === "error") return "world.error" as const;
  if (view.phase === "preparing") return "world.status.preparing" as const;
  if (view.phase === "loading") return "world.status.loading" as const;
  if (!view.rendererBound) return "world.status.preparing" as const;
  if (view.phase === "unavailable") return "world.unavailable" as const;
  return "world.ready" as const;
}

export function WorldExperienceShell({
  view,
  renderer,
  bottomInset = 0,
  searchQuery = "",
  searchResults = [],
  onSearchQueryChange,
  onSelectSearchResult,
  onRetry,
  onCameraControl,
  onToggleLayer,
  onTogglePlaceLayer,
  onSelectMapSource,
  onSelectProjection,
  onSelectRoadDetail,
  onSelectBuildings,
  onCloseDetails,
}: WorldExperienceShellProps) {
  const { t } = useTranslation();
  const [mapSettingsOpen, setMapSettingsOpen] = useState(false);
  const citiesActive = view.layers.some(
    (layer) => layer.categoryId === "cities" && layer.active
  );
  const showCompactHeader =
    view.phase === "ready" && view.rendererBound === true;

  if (view.phase === "error") {
    return (
      <View style={[styles.root, { paddingBottom: bottomInset }]}>
        <WorldHeader
          title={t("world.title")}
          subtitle={t("world.loadFailedBody")}
          statusLabel={t("world.error")}
        />
        <WorldStatePanel
          title={t("world.loadFailed")}
          body={view.errorMessage ?? t("world.loadFailedBody")}
          variant="error"
          onRetry={onRetry}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.root, { paddingBottom: Math.max(bottomInset, 8) }]}
      accessibilityLabel={t("world.experience")}
    >
      <WorldHeader
        title={t("world.title")}
        subtitle={
          showCompactHeader
            ? undefined
            : view.phase === "preparing"
              ? t("world.preparing")
              : view.phase === "loading"
                ? t("world.loading")
                : view.phase === "unavailable"
                  ? t("world.unavailable")
                  : t("world.ready")
        }
        statusLabel={t(statusKey(view))}
        compact={showCompactHeader}
      />

      {onSearchQueryChange && onSelectSearchResult ? (
        <WorldSearchBar
          query={searchQuery}
          results={searchResults}
          onChangeQuery={onSearchQueryChange}
          onSelectResult={onSelectSearchResult}
          onClear={() => onSearchQueryChange("")}
        />
      ) : null}

      <View style={styles.canvasWrap}>
        <WorldRendererHost adapter={renderer} />
        <View style={styles.cameraOverlay} pointerEvents="box-none">
          <WorldCameraControls
            controls={view.cameraControls}
            onPress={onCameraControl}
            compact
          />
        </View>
        <WorldPlaceBottomSheet
          sheet={view.placeSheet}
          bottomInset={bottomInset}
          onClose={onCloseDetails}
        />
        <WorldEducationBottomSheet
          sheet={view.educationSheet}
          bottomInset={bottomInset}
          onClose={onCloseDetails}
        />
        <WorldUserBottomSheet
          sheet={view.userSheet}
          bottomInset={bottomInset}
          onClose={onCloseDetails}
        />
        <WorldGameBottomSheet
          sheet={view.gameSheet}
          bottomInset={bottomInset}
          onClose={onCloseDetails}
        />
        <WorldCommerceBottomSheet
          sheet={view.commerceSheet}
          bottomInset={bottomInset}
          onClose={onCloseDetails}
        />
        <WorldEventBottomSheet
          sheet={view.eventSheet}
          bottomInset={bottomInset}
          onClose={onCloseDetails}
        />
      </View>

      <WorldLayerSelector layers={view.layers} onToggle={onToggleLayer} />
      {citiesActive ? (
        <WorldPlaceLayerSelector
          layers={view.placeLayers}
          onToggle={onTogglePlaceLayer}
        />
      ) : null}

      <WorldMapSettingsPanel
        open={mapSettingsOpen}
        onToggle={() => setMapSettingsOpen((v) => !v)}
        sources={view.mapSources}
        roadControls={view.roadDetailControls}
        buildingsControls={view.buildingsControls}
        onSelectMapSource={onSelectMapSource}
        onSelectRoadDetail={onSelectRoadDetail}
        onSelectBuildings={onSelectBuildings}
      />

      <WorldProjectionSelector
        controls={view.projectionControls}
        onSelect={onSelectProjection}
      />

      <WorldAttribution text={view.attribution} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  canvasWrap: {
    flex: 1,
    minHeight: 320,
    position: "relative",
  },
  cameraOverlay: {
    position: "absolute",
    right: 10,
    top: 10,
    zIndex: 5,
  },
});

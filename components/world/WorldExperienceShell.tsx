import { Pressable, StyleSheet, Text, View } from "react-native";

import { WorldCameraControls } from "@/components/world/WorldCameraControls";
import {
  WorldDetailsPanel,
  WorldFilterPanel,
  WorldLayerSelector,
} from "@/components/world/WorldControls";
import { WorldHeader } from "@/components/world/WorldHeader";
import {
  WorldAttribution,
  WorldRendererHost,
} from "@/components/world/WorldRendererHost";
import { WorldStatePanel } from "@/components/world/WorldStatePanel";
import type {
  WorldCameraControlId,
  WorldExperienceViewState,
} from "@/src/lib/world/experience";
import type { WorldCategoryId } from "@/src/lib/world";
import type { WorldRendererAdapter } from "@/src/lib/world/renderer";
import { colors } from "@/src/theme/colors";

type WorldExperienceShellProps = {
  view: WorldExperienceViewState;
  renderer: WorldRendererAdapter;
  bottomInset?: number;
  onRetry?: () => void;
  onCameraControl?: (id: WorldCameraControlId) => void;
  onToggleLayer?: (categoryId: WorldCategoryId, enabled: boolean) => void;
  onToggleFilters?: () => void;
  onToggleLayersPanel?: () => void;
  onClearFilters?: () => void;
  onCloseFilters?: () => void;
  onCloseDetails?: () => void;
};

function statusLabel(view: WorldExperienceViewState): string {
  if (view.phase === "error") return "Error";
  if (view.phase === "preparing") return "Preparing";
  if (view.phase === "loading") return "Loading";
  if (!view.rendererBound) return "Preparing";
  if (view.phase === "unavailable") return "Unavailable";
  return "Ready";
}

export function WorldExperienceShell({
  view,
  renderer,
  bottomInset = 0,
  onRetry,
  onCameraControl,
  onToggleLayer,
  onToggleFilters,
  onToggleLayersPanel,
  onClearFilters,
  onCloseFilters,
  onCloseDetails,
}: WorldExperienceShellProps) {
  if (view.phase === "error") {
    return (
      <View style={[styles.root, { paddingBottom: bottomInset }]}>
        <WorldHeader
          subtitle="World could not be loaded."
          statusLabel="Error"
        />
        <WorldStatePanel
          title="Unable to load World"
          body={view.errorMessage ?? view.message}
          variant="error"
          onRetry={onRetry}
        />
      </View>
    );
  }

  const selectedEntity = view.entities.find(
    (entity) => entity.id === view.selectedEntityId
  );

  return (
    <View
      style={[styles.root, { paddingBottom: Math.max(bottomInset, 8) }]}
      accessibilityLabel="World experience"
    >
      <WorldHeader subtitle={view.message} statusLabel={statusLabel(view)} />

      <View style={styles.canvasWrap}>
        <WorldRendererHost adapter={renderer} />
      </View>

      <WorldCameraControls
        controls={view.cameraControls}
        onPress={onCameraControl}
      />

      <View style={styles.toolbar}>
        <Pressable
          style={styles.toolButton}
          onPress={onToggleLayersPanel}
          accessibilityRole="button"
          accessibilityLabel={
            view.layersPanelOpen ? "Hide layer selector" : "Show layer selector"
          }
          accessibilityState={{ selected: view.layersPanelOpen }}
        >
          <Text style={styles.toolButtonText}>Layers</Text>
        </Pressable>
        <Pressable
          style={styles.toolButton}
          onPress={onToggleFilters}
          accessibilityRole="button"
          accessibilityLabel={
            view.filterPanelOpen ? "Hide filters" : "Show filters"
          }
          accessibilityState={{ selected: view.filterPanelOpen }}
        >
          <Text style={styles.toolButtonText}>Filters</Text>
        </Pressable>
        {onRetry ? (
          <Pressable
            style={styles.toolButton}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry World"
          >
            <Text style={styles.toolButtonText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>

      {view.layersPanelOpen ? (
        <WorldLayerSelector layers={view.layers} onToggle={onToggleLayer} />
      ) : null}

      <WorldFilterPanel
        open={view.filterPanelOpen}
        selectedCount={view.filter.categories.length}
        layers={view.layers}
        onClose={onCloseFilters}
        onClear={onClearFilters}
      />

      <WorldDetailsPanel
        open={view.detailsOpen}
        entityTitle={selectedEntity?.title ?? null}
        entitySubtitle={selectedEntity?.subtitle ?? null}
        onClose={onCloseDetails}
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
    paddingHorizontal: 16,
    minHeight: 240,
  },
  toolbar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  toolButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  toolButtonText: {
    color: colors.accentCyan,
    fontWeight: "700",
    fontSize: 13,
  },
});

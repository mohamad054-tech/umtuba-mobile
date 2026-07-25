import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WorldExperienceShell } from "@/components/world/WorldExperienceShell";
import {
  buildWorldExperienceViewState,
  createDefaultWorldUiSelection,
  toggleWorldCategorySelection,
  type WorldUiSelectionState,
} from "@/src/lib/world/experience";
import {
  getWorldFoundationSnapshot,
  type WorldCategoryId,
  type WorldFoundationSnapshot,
} from "@/src/lib/world";
import { colors } from "@/src/theme/colors";

export default function WorldScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<WorldFoundationSnapshot | null>(
    null
  );
  const [selection, setSelection] = useState<WorldUiSelectionState>(
    createDefaultWorldUiSelection
  );

  const load = useCallback(() => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const next = getWorldFoundationSnapshot();
      setSnapshot(next);
      setSelection((prev) => ({
        ...prev,
        selectedEntityId: null,
        detailsOpen: false,
      }));
    } catch (err) {
      setSnapshot(null);
      setErrorMessage(
        err instanceof Error ? err.message : "Unable to load World."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const view = useMemo(
    () =>
      buildWorldExperienceViewState({
        snapshot: snapshot ?? undefined,
        selection,
        loading,
        errorMessage,
      }),
    [snapshot, selection, loading, errorMessage]
  );

  const onToggleLayer = useCallback(
    (categoryId: WorldCategoryId, enabled: boolean) => {
      setSelection((prev) => ({
        ...prev,
        selectedCategories: toggleWorldCategorySelection(
          prev.selectedCategories,
          categoryId,
          enabled
        ),
      }));
    },
    []
  );

  if (view.phase === "loading") {
    return (
      <View
        style={styles.center}
        accessibilityLabel="Loading World"
        accessibilityRole="progressbar"
      >
        <ActivityIndicator color={colors.accentCyan} size="large" />
        <Text style={styles.muted}>Loading World…</Text>
      </View>
    );
  }

  return (
    <WorldExperienceShell
      view={view}
      bottomInset={insets.bottom}
      onRetry={load}
      onToggleLayer={onToggleLayer}
      onToggleFilters={() =>
        setSelection((prev) => ({
          ...prev,
          filterPanelOpen: !prev.filterPanelOpen,
        }))
      }
      onToggleLayersPanel={() =>
        setSelection((prev) => ({
          ...prev,
          layersPanelOpen: !prev.layersPanelOpen,
        }))
      }
      onClearFilters={() =>
        setSelection((prev) => ({
          ...prev,
          selectedCategories: [],
        }))
      }
      onCloseFilters={() =>
        setSelection((prev) => ({
          ...prev,
          filterPanelOpen: false,
        }))
      }
      onCloseDetails={() =>
        setSelection((prev) => ({
          ...prev,
          selectedEntityId: null,
          detailsOpen: false,
        }))
      }
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

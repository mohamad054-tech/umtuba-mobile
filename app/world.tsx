import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WorldExperienceShell } from "@/components/world/WorldExperienceShell";
import {
  buildWorldExperienceViewState,
  createDefaultWorldUiSelection,
  runWorldInitialization,
  toggleWorldCategorySelection,
  type WorldUiSelectionState,
} from "@/src/lib/world/experience";
import {
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
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setAttempt((n) => n + 1);
    const result = await runWorldInitialization();
    if (!result.ok) {
      setSnapshot(null);
      setErrorMessage(result.message);
    } else {
      setSnapshot(result.snapshot);
      setSelection((prev) => ({
        ...prev,
        selectedEntityId: null,
        detailsOpen: false,
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const view = useMemo(
    () =>
      buildWorldExperienceViewState({
        snapshot: snapshot ?? undefined,
        selection,
        loading,
        errorMessage,
      }),
    [snapshot, selection, loading, errorMessage, attempt]
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

  const onRetry = useCallback(() => {
    void load();
  }, [load]);

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
      onRetry={onRetry}
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

import { useEffect, useReducer, type ReactElement } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import {
  WORLD_ATTRIBUTION_FALLBACK,
  WORLD_RENDERER_PREPARING_MESSAGE,
} from "@/src/lib/world/experience";
import { WorldRendererSurface } from "@/src/lib/world/renderer/WorldRendererSurface";
import {
  isMapLibreRendererAdapter,
  type WorldRendererAdapter,
} from "@/src/lib/world/renderer";
import { colors } from "@/src/theme/colors";

type WorldRendererHostProps = {
  /** Must come from WorldRuntimeController — never a direct SDK. */
  adapter: WorldRendererAdapter;
  preparingMessage?: string;
};

/**
 * User-facing renderer host.
 * Renders engine surface via renderer facade only — no direct MapLibre imports.
 */
export function WorldRendererHost({
  adapter,
  preparingMessage = WORLD_RENDERER_PREPARING_MESSAGE,
}: WorldRendererHostProps) {
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!isMapLibreRendererAdapter(adapter)) return;
    return adapter.subscribe(() => {
      bump();
    });
  }, [adapter]);

  const bound = adapter.isBound();
  const loadError = isMapLibreRendererAdapter(adapter)
    ? adapter.getLoadError()
    : null;
  const styleReady = isMapLibreRendererAdapter(adapter)
    ? adapter.isStyleReady()
    : false;
  const styleTransitioning = isMapLibreRendererAdapter(adapter)
    ? adapter.isStyleTransitioning()
    : false;
  const showOverlay =
    !bound ||
    Boolean(loadError) ||
    (bound && !styleReady && !styleTransitioning);
  const showSourceSwitchOverlay = bound && !loadError && styleTransitioning;

  return (
    <View
      style={styles.canvas}
      accessibilityRole="image"
      accessibilityLabel={
        loadError
          ? `World map error. ${loadError}`
          : bound && styleReady
            ? "World map"
            : "Loading World map"
      }
      accessibilityState={{ disabled: !bound || Boolean(loadError) }}
    >
      <WorldRendererSurface adapter={adapter} />
      {showSourceSwitchOverlay ? (
        <View style={styles.switchOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.accentCyan} size="small" />
        </View>
      ) : null}
      {showOverlay ? (
        <View style={styles.overlay} accessibilityRole="summary">
          <ActivityIndicator color={colors.accentCyan} size="large" />
          <Text style={styles.title}>
            {loadError ? "Map unavailable" : "Loading map…"}
          </Text>
          <Text style={styles.body}>
            {loadError ?? (bound ? "Preparing map tiles…" : preparingMessage)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function WorldAttribution({
  text = WORLD_ATTRIBUTION_FALLBACK,
}: {
  text?: string;
}): ReactElement {
  return (
    <View
      style={styles.attribution}
      accessibilityRole="text"
      accessibilityLabel={`Attribution. ${text}`}
    >
      <Text style={styles.attributionText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    minHeight: 300,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  switchOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(8,12,20,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  attribution: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  attributionText: {
    color: colors.textSubtle,
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
});

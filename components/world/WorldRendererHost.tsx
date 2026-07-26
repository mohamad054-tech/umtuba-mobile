import { useEffect, useReducer, type ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";

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
  const caps = adapter.getCapabilities();
  const showOverlay = !bound || Boolean(loadError) || (bound && !styleReady);

  return (
    <View
      style={styles.canvas}
      accessibilityRole="image"
      accessibilityLabel={
        loadError
          ? `World map error. ${loadError}`
          : bound && styleReady
            ? "World map renderer"
            : "World map renderer unavailable. Owned World renderer is being prepared."
      }
      accessibilityState={{ disabled: !bound || Boolean(loadError) }}
    >
      <WorldRendererSurface adapter={adapter} />
      {showOverlay ? (
        <View style={styles.overlay} accessibilityRole="summary">
          <Text style={styles.kicker}>Owned World</Text>
          <Text style={styles.title}>
            {loadError
              ? "Renderer unavailable"
              : bound
                ? "Loading map…"
                : "Renderer preparing"}
          </Text>
          <Text style={styles.body}>
            {loadError ??
              (bound
                ? "Connecting to development map tiles…"
                : preparingMessage)}
          </Text>
          <Text style={styles.meta} accessibilityLabel="Renderer family">
            Family: {adapter.family}
          </Text>
          <Text style={styles.meta} accessibilityLabel="Renderer capabilities">
            3D:{caps.supports3D ? "on" : "off"} Terrain:
            {caps.supportsTerrain ? "on" : "off"} Offline:
            {caps.supportsOffline ? "on" : "off"}
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
    minHeight: 220,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  kicker: {
    color: colors.accentCyan,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  meta: {
    marginTop: 4,
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: "600",
  },
  attribution: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  attributionText: {
    color: colors.textSubtle,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
});

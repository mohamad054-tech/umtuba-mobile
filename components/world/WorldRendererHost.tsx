import { StyleSheet, Text, View } from "react-native";

import {
  WORLD_ATTRIBUTION_FALLBACK,
  WORLD_RENDERER_PREPARING_MESSAGE,
} from "@/src/lib/world/experience";
import {
  createDisabledWorldRendererAdapter,
  isWorldRendererBound,
  type WorldRendererAdapter,
} from "@/src/lib/world";
import { colors } from "@/src/theme/colors";

type WorldRendererHostProps = {
  adapter?: WorldRendererAdapter | null;
  preparingMessage?: string;
};

/**
 * User-facing renderer host.
 * Consumes the World renderer adapter contract; shows unavailable when unbound.
 * No map SDK references in UI copy.
 */
export function WorldRendererHost({
  adapter = null,
  preparingMessage = WORLD_RENDERER_PREPARING_MESSAGE,
}: WorldRendererHostProps) {
  const bound = isWorldRendererBound() && adapter != null;
  const capability =
    adapter?.capability ?? createDisabledWorldRendererAdapter().capability;

  return (
    <View
      style={styles.canvas}
      accessibilityRole="image"
      accessibilityLabel={
        bound
          ? "World map renderer"
          : "World map renderer unavailable. Owned World renderer is being prepared."
      }
      accessibilityState={{ disabled: !bound }}
    >
      <View style={styles.plane} accessible={false} />
      <View style={styles.overlay} accessibilityRole="summary">
        <Text style={styles.kicker}>Owned World</Text>
        <Text style={styles.title}>
          {bound ? "Renderer ready" : "Renderer preparing"}
        </Text>
        <Text style={styles.body}>
          {bound
            ? "A trusted World renderer is bound."
            : preparingMessage}
        </Text>
        <Text style={styles.meta} accessibilityLabel="Renderer family">
          Family: {capability.family}
        </Text>
      </View>
    </View>
  );
}

export function WorldAttribution({
  text = WORLD_ATTRIBUTION_FALLBACK,
}: {
  text?: string;
}) {
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
  plane: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#07071A",
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

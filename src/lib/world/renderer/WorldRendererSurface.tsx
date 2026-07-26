import type { ReactElement } from "react";
import { StyleSheet, View } from "react-native";

import {
  isMapLibreRendererAdapter,
  type MapLibreRendererAdapter,
} from "@/src/lib/world/renderer/maplibre/MapLibreRendererAdapter";
import type { WorldRendererAdapter } from "@/src/lib/world/renderer/types";

type WorldRendererSurfaceProps = {
  adapter: WorldRendererAdapter;
};

/**
 * Facade surface — UI imports this, never `@maplibre/*`.
 */
export function WorldRendererSurface({
  adapter,
}: WorldRendererSurfaceProps): ReactElement | null {
  if (!isMapLibreRendererAdapter(adapter)) {
    return null;
  }

  // Lazy require keeps vitest/unit paths from loading native MapLibre unless used.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MapLibreMapSurface } =
      require("@/src/lib/world/renderer/maplibre/MapLibreMapSurface") as {
        MapLibreMapSurface: (props: {
          adapter: MapLibreRendererAdapter;
        }) => ReactElement;
      };
    return <MapLibreMapSurface adapter={adapter} />;
  } catch {
    return <View style={styles.fill} />;
  }
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});

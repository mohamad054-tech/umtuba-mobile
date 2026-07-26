import type { WorldCamera } from "@/src/lib/world/types";
import type {
  CameraAdapter,
  LayerAdapter,
  ProjectionAdapter,
  RendererCapabilities,
  WorldRendererAdapter,
} from "@/src/lib/world/renderer/types";
import {
  defaultNullRendererCapabilities,
  toFoundationRendererCapability,
} from "@/src/lib/world/renderer/types";

function createNullCameraAdapter(): CameraAdapter {
  return {
    id: "world-camera-none",
    getCamera(): WorldCamera | null {
      return null;
    },
    setCamera(): boolean {
      return false;
    },
    zoomIn(): boolean {
      return false;
    },
    zoomOut(): boolean {
      return false;
    },
    recenter(): boolean {
      return false;
    },
    resetOrientation(): boolean {
      return false;
    },
  };
}

function createNullLayerAdapter(): LayerAdapter {
  return {
    id: "world-layer-none",
    listLayerIds(): string[] {
      return [];
    },
    setLayerVisibility(): boolean {
      return false;
    },
    isLayerVisible(): boolean {
      return false;
    },
  };
}

function createNullProjectionAdapter(): ProjectionAdapter {
  return {
    id: "world-projection-none",
    project(): { x: number; y: number } | null {
      return null;
    },
    unproject(): { latitude: number; longitude: number } | null {
      return null;
    },
  };
}

/**
 * Fail-closed null renderer — draws nothing, never crashes, no map SDK.
 */
export function createNullRendererAdapter(): WorldRendererAdapter {
  const caps: RendererCapabilities = defaultNullRendererCapabilities();
  const camera = createNullCameraAdapter();
  const layers = createNullLayerAdapter();
  const projection = createNullProjectionAdapter();

  return {
    id: "world-renderer-none",
    family: "none",
    isBound(): boolean {
      return false;
    },
    getCapabilities(): RendererCapabilities {
      return { ...caps };
    },
    getCameraAdapter(): CameraAdapter {
      return camera;
    },
    getLayerAdapter(): LayerAdapter {
      return layers;
    },
    getProjectionAdapter(): ProjectionAdapter {
      return projection;
    },
    mount(): void {
      // No-op — no canvas engine bound.
    },
    unmount(): void {
      // No-op — nothing to tear down.
    },
    capability: toFoundationRendererCapability("none", caps),
  };
}

export function isRendererAdapterBound(
  adapter: WorldRendererAdapter | null | undefined
): boolean {
  return adapter?.isBound() === true;
}

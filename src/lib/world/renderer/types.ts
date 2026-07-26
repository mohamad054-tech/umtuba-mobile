/**
 * World Renderer Adapter Foundation — no map SDK / tiles / vendor engines.
 */

import type {
  WorldCamera,
  WorldRendererCapability,
  WorldRendererFamily,
} from "@/src/lib/world/types";

export type RendererCapabilities = {
  supports3D: boolean;
  supportsTerrain: boolean;
  supportsOffline: boolean;
  supportsStreetLabels: boolean;
  supportsSatellite: boolean;
  supportsCustomLayers: boolean;
  supportsBuildings: boolean;
};

export type CameraAdapter = {
  readonly id: string;
  getCamera(): WorldCamera | null;
  setCamera(camera: WorldCamera): boolean;
  zoomIn(): boolean;
  zoomOut(): boolean;
  recenter(): boolean;
  resetOrientation(): boolean;
};

export type LayerAdapter = {
  readonly id: string;
  listLayerIds(): string[];
  setLayerVisibility(layerId: string, visible: boolean): boolean;
  isLayerVisible(layerId: string): boolean;
};

export type ProjectionAdapter = {
  readonly id: string;
  project(
    latitude: number,
    longitude: number
  ): { x: number; y: number } | null;
  unproject(
    x: number,
    y: number
  ): { latitude: number; longitude: number } | null;
};

/**
 * Sole renderer contract for Runtime.
 * UI must not reach engines except through Runtime → this adapter.
 */
export type WorldRendererAdapter = {
  readonly id: string;
  readonly family: WorldRendererFamily;
  isBound(): boolean;
  getCapabilities(): RendererCapabilities;
  getCameraAdapter(): CameraAdapter;
  getLayerAdapter(): LayerAdapter;
  getProjectionAdapter(): ProjectionAdapter;
  mount(): void;
  unmount(): void;
  /**
   * Legacy foundation snapshot shape (domain types).
   * Derived from RendererCapabilities — not a second authority.
   */
  readonly capability: WorldRendererCapability;
};

export function defaultNullRendererCapabilities(): RendererCapabilities {
  return {
    supports3D: false,
    supportsTerrain: false,
    supportsOffline: false,
    supportsStreetLabels: false,
    supportsSatellite: false,
    supportsCustomLayers: false,
    supportsBuildings: false,
  };
}

export function toFoundationRendererCapability(
  family: WorldRendererFamily,
  caps: RendererCapabilities
): WorldRendererCapability {
  return {
    family,
    supportsOffline: caps.supportsOffline,
    supportsTerrain: caps.supportsTerrain,
    supportsIndoor: false,
    supportsNavigation: false,
  };
}

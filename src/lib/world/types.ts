/**
 * UMTUBA World domain contracts — renderer-agnostic.
 * This module never imports or references a map SDK.
 */

/** Stable product categories for World overlays/entities. */
export type WorldCategoryId =
  | "users"
  | "cities"
  | "education"
  | "games"
  | "events"
  | "businesses"
  | "ai"
  | "future";

export type WorldCamera = {
  latitude: number;
  longitude: number;
  /** Unitless zoom level in a renderer-agnostic 0–22 style range. */
  zoom: number;
  bearing: number;
  pitch: number;
};

export type WorldViewport = {
  north: number;
  south: number;
  east: number;
  west: number;
};

/** Known layer kinds only — unknown kinds are rejected at parse time. */
export type WorldLayerKind =
  | "basemap"
  | "pins"
  | "overlays"
  | "heatmap"
  | "routes";

export type WorldLayer = {
  id: string;
  kind: WorldLayerKind;
  category: WorldCategoryId | null;
  label: string;
  visible: boolean;
  interactive: boolean;
  zIndex: number;
  /** Opaque source key from a trusted backend — never a fabricated tile URL. */
  sourceRef: string | null;
};

export type WorldPin = {
  id: string;
  entityId: string;
  latitude: number;
  longitude: number;
  title: string | null;
  category: WorldCategoryId;
  destination: string | null;
};

/** Known overlay kinds only — unknown kinds fail closed. */
export type WorldOverlayKind = "geojson" | "polygon" | "polyline" | "label";

export type WorldOverlay = {
  id: string;
  kind: WorldOverlayKind;
  entityId: string | null;
  category: WorldCategoryId | null;
  /** Opaque payload reference — no invented geometry in this foundation. */
  payloadRef: string | null;
};

export type WorldEntityKind =
  | "user"
  | "city"
  | "education"
  | "game"
  | "event"
  | "business"
  | "ai"
  | "other";

export type WorldEntity = {
  id: string;
  kind: WorldEntityKind;
  category: WorldCategoryId;
  title: string;
  subtitle: string | null;
  latitude: number | null;
  longitude: number | null;
  destination: string | null;
};

export type WorldFilter = {
  categories: WorldCategoryId[];
  query: string | null;
  bbox: WorldViewport | null;
};

export type WorldActionKind =
  | "open_entity"
  | "focus_camera"
  | "toggle_layer"
  | "apply_filter"
  | "navigate";

export type WorldAction = {
  kind: WorldActionKind;
  targetId: string | null;
  /** Bounded primitive bag only — never arbitrary nested objects. */
  payload: Record<string, string | number | boolean | null> | null;
};

export type WorldPermissionId =
  | "view_world"
  | "view_users"
  | "view_precise_location"
  | "place_pin"
  | "edit_overlay";

export type WorldPermission = {
  id: WorldPermissionId;
  granted: boolean;
};

/**
 * Abstract renderer family — no vendor coupling.
 * Concrete engines bind later behind adapters.
 */
export type WorldRendererFamily = "none" | "vector_2d" | "globe_3d" | "custom";

export type WorldRendererCapability = {
  family: WorldRendererFamily;
  supportsOffline: boolean;
  supportsTerrain: boolean;
  supportsIndoor: boolean;
  supportsNavigation: boolean;
};

export type WorldFoundationStatus =
  | "unavailable"
  | "empty"
  | "ready"
  | "error";

export type WorldFoundationSnapshot = {
  status: WorldFoundationStatus;
  message: string;
  categories: WorldCategoryId[];
  layers: WorldLayer[];
  permissions: WorldPermission[];
  camera: WorldCamera | null;
  filter: WorldFilter;
  renderer: WorldRendererCapability;
};

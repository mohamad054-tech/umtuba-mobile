export {
  formatWorldEducationKindLabel,
  normalizeWorldEducationRecord,
  WORLD_EDUCATION_LAYER_ID,
  WORLD_EDUCATION_LAYER_REF,
  type WorldEducationKind,
  type WorldEducationRecord,
} from "@/src/lib/world/education/types";
export {
  createEducationRegistry,
  type EducationRegistry,
} from "@/src/lib/world/education/registry";
export {
  createWorldEducationLayerDefinition,
  educationMarkersToGeoJSON,
  worldEducationToEntities,
  worldEducationToEntity,
  worldEducationToMarker,
  worldEducationToMarkers,
  type WorldEducationMarker,
} from "@/src/lib/world/education/educationLayer";
export {
  buildWorldEducationSheetState,
  type WorldEducationSheetMetric,
  type WorldEducationSheetMetricId,
  type WorldEducationSheetState,
} from "@/src/lib/world/education/educationSheet";

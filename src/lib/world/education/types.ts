/**
 * World Education Layer — learning places independent of map SDKs.
 */

import type {
  WorldEducationKind,
  WorldEducationRecord,
} from "@/src/lib/world/dataPipeline/types";

export type { WorldEducationKind, WorldEducationRecord };

export const WORLD_EDUCATION_LAYER_ID = "education" as const;
export const WORLD_EDUCATION_LAYER_REF = "world-education-layer" as const;

export function formatWorldEducationKindLabel(
  kind: WorldEducationKind
): string {
  switch (kind) {
    case "university":
      return "University";
    case "school":
      return "School";
    case "learning_center":
      return "Learning Center";
    default:
      return "Education";
  }
}

export function normalizeWorldEducationRecord(
  raw: WorldEducationRecord
): WorldEducationRecord | null {
  if (!raw || typeof raw.id !== "string" || !raw.id.trim()) return null;
  const name =
    typeof raw.name === "string" && raw.name.trim().length > 0
      ? raw.name.trim()
      : typeof raw.title === "string" && raw.title.trim().length > 0
        ? raw.title.trim()
        : null;
  if (!name) return null;
  const educationType = raw.educationType;
  if (
    educationType !== "university" &&
    educationType !== "school" &&
    educationType !== "learning_center"
  ) {
    return null;
  }
  const cityName =
    typeof raw.cityName === "string" && raw.cityName.trim().length > 0
      ? raw.cityName.trim()
      : null;
  if (!cityName) return null;
  const latitude =
    typeof raw.latitude === "number" && Number.isFinite(raw.latitude)
      ? raw.latitude
      : null;
  const longitude =
    typeof raw.longitude === "number" && Number.isFinite(raw.longitude)
      ? raw.longitude
      : null;
  return {
    id: raw.id.trim(),
    name,
    educationType,
    cityName,
    latitude,
    longitude,
  };
}

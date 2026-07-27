/**
 * Education bottom-sheet view model — Runtime builds; UI renders only.
 * Only real identity fields are exposed (no placeholder metrics).
 */

import {
  formatWorldEducationKindLabel,
  type WorldEducationRecord,
} from "@/src/lib/world/education/types";

export type WorldEducationSheetMetricId =
  | "programs"
  | "students"
  | "courses";

export type WorldEducationSheetMetric = {
  id: WorldEducationSheetMetricId;
  label: string;
  value: string | null;
  placeholder: string;
};

export type WorldEducationSheetState = {
  educationId: string;
  name: string;
  typeLabel: string;
  cityName: string;
  open: boolean;
  metrics: WorldEducationSheetMetric[];
};

export function buildWorldEducationSheetState(
  record: WorldEducationRecord | null,
  open: boolean
): WorldEducationSheetState | null {
  if (!record || !open) return null;
  return {
    educationId: record.id,
    name: record.name,
    typeLabel: formatWorldEducationKindLabel(record.educationType),
    cityName: record.cityName,
    open: true,
    metrics: [],
  };
}

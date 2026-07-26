/**
 * Education bottom-sheet view model — Runtime builds; UI renders only.
 * Programs / Students / Courses stay null placeholders (no invented metrics).
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

const PLACEHOLDER_METRICS: WorldEducationSheetMetric[] = [
  {
    id: "programs",
    label: "Programs",
    value: null,
    placeholder: "Coming soon",
  },
  {
    id: "students",
    label: "Students",
    value: null,
    placeholder: "Coming soon",
  },
  {
    id: "courses",
    label: "Courses",
    value: null,
    placeholder: "Coming soon",
  },
];

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
    metrics: PLACEHOLDER_METRICS.map((m) => ({ ...m })),
  };
}

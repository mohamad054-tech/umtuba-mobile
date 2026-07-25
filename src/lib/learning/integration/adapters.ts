/**
 * Adapter interfaces only — no Learning UI, player, or network implementation.
 */

import type {
  LearningCourseReference,
  LearningEntity,
  LearningLaunchContract,
  LearningIntegrationSnapshot,
} from "@/src/lib/learning/integration/types";

export type LearningCatalogAdapter = {
  readonly id: string;
  parseCourse(raw: unknown): LearningCourseReference | null;
};

export type LearningEntityAdapter = {
  readonly id: string;
  parseLearning(raw: unknown): LearningEntity | null;
};

export type LearningLaunchAdapter = {
  readonly id: string;
  resolveLaunch(raw: unknown): LearningLaunchContract | null;
};

export type LearningIntegrationAdapter = {
  readonly id: string;
  getSnapshot(): LearningIntegrationSnapshot;
};

export function isLearningIntegrationAdapterBound(): boolean {
  return false;
}

export function isLearningLauncherBound(): boolean {
  return false;
}

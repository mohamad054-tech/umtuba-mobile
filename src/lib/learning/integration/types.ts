/**
 * UM Learning ↔ mobile platform integration contracts.
 * Reuses Platform entity/destination/permission types — no duplicate entity model.
 * No courses UI, assessments, or backend calls live here.
 */

import type {
  PlatformDestination,
  PlatformEntity,
  PlatformPermission,
  PlatformPermissionId,
} from "@/src/lib/platform";

export type LearningAvailabilityState =
  | "draft"
  | "published"
  | "enrolled"
  | "in_progress"
  | "completed"
  | "archived"
  | "disabled"
  | "future";

export type LearningCapabilityId =
  | "browse"
  | "enroll"
  | "launch"
  | "progress"
  | "assessment"
  | "certificate"
  | "world"
  | "games"
  | "notifications"
  | "messages"
  | "wallet"
  | "live"
  | "ai"
  | "platform"
  | "future";

export type LearningPresenceStatus =
  | "offline"
  | "studying"
  | "in_live"
  | "away"
  | "future";

export type LearningLaunchMode = "internal" | "external" | "live" | "future";

/**
 * First-class learning entity: PlatformEntity (course|lesson) plus learning fields.
 */
export type LearningEntity = {
  platformEntity: PlatformEntity;
  learningId: string;
  state: LearningAvailabilityState;
  launchMode: LearningLaunchMode | null;
  capabilities: LearningCapabilityId[];
};

export type LearningCourseReference = {
  courseId: string;
  title: string | null;
  state: LearningAvailabilityState | null;
  catalogRef: string | null;
  destination: PlatformDestination | null;
};

export type LearningLessonReference = {
  lessonId: string;
  courseId: string;
  title: string | null;
  state: LearningAvailabilityState | null;
  destination: PlatformDestination | null;
};

export type LearningAssessmentReference = {
  assessmentId: string;
  courseId: string | null;
  lessonId: string | null;
  title: string | null;
  assessmentRef: string | null;
};

export type LearningCertificateReference = {
  certificateId: string;
  courseId: string;
  userId: string;
  issuedAt: string | null;
  certificateRef: string | null;
};

export type LearningProgressReference = {
  progressId: string;
  courseId: string;
  userId: string;
  updatedAt: string | null;
  progressRef: string | null;
};

export type LearningInstructorReference = {
  instructorId: string;
  userId: string | null;
  displayName: string | null;
};

export type LearningStudentReference = {
  studentId: string;
  userId: string;
  displayName: string | null;
};

export type LearningEnrollmentReference = {
  enrollmentId: string;
  courseId: string;
  userId: string;
  state: LearningAvailabilityState | null;
  enrolledAt: string | null;
};

export type LearningCompletionReference = {
  completionId: string;
  courseId: string;
  userId: string;
  completedAt: string | null;
  completionRef: string | null;
};

export type LearningCapability = {
  id: LearningCapabilityId;
  enabled: boolean;
};

export type LearningPermission = {
  id: PlatformPermissionId;
  granted: boolean;
};

/**
 * Launch/open contract only — no Learning UI or course player.
 */
export type LearningLaunchContract = {
  learningId: string;
  mode: LearningLaunchMode;
  destination: PlatformDestination | null;
  canLaunch: boolean;
  reason: string | null;
};

export type LearningPresence = {
  userId: string;
  courseId: string | null;
  lessonId: string | null;
  status: LearningPresenceStatus;
  updatedAt: string | null;
};

export type LearningIntegrationStatus =
  | "unavailable"
  | "empty"
  | "ready"
  | "error";

export type LearningIntegrationSnapshot = {
  status: LearningIntegrationStatus;
  message: string;
  capabilities: LearningCapability[];
  permissions: PlatformPermission[];
  courses: LearningCourseReference[];
};

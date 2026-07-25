import {
  parseLearningAvailabilityState,
  parseLearningCapabilityId,
  parseLearningLaunchMode,
  parseLearningPresenceStatus,
} from "@/src/lib/learning/integration/enums";
import type {
  LearningAssessmentReference,
  LearningCapability,
  LearningCertificateReference,
  LearningCompletionReference,
  LearningCourseReference,
  LearningEnrollmentReference,
  LearningEntity,
  LearningInstructorReference,
  LearningLaunchContract,
  LearningLessonReference,
  LearningPresence,
  LearningProgressReference,
  LearningStudentReference,
} from "@/src/lib/learning/integration/types";
import {
  createPlatformDestination,
  parsePlatformEntity,
  parsePlatformPermission,
  type PlatformEntity,
  type PlatformPermission,
} from "@/src/lib/platform";

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanIso(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  if (Number.isNaN(Date.parse(text))) return null;
  return text;
}

function parseCapabilityList(raw: unknown): LearningCapability["id"][] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  const out: LearningCapability["id"][] = [];
  for (const item of raw) {
    const id =
      typeof item === "string"
        ? parseLearningCapabilityId(item)
        : item && typeof item === "object"
          ? parseLearningCapabilityId(
              cleanText((item as { id?: unknown }).id)
            )
          : null;
    if (!id) return null;
    out.push(id);
  }
  return out;
}

const LEARNING_ENTITY_TYPES = new Set(["course", "lesson"]);

export function toLearningEntity(
  platformEntity: PlatformEntity,
  extras: {
    learningId: string;
    state: string;
    launchMode?: string | null;
    capabilities?: unknown;
  }
): LearningEntity | null {
  if (!LEARNING_ENTITY_TYPES.has(platformEntity.type)) return null;
  const learningId = cleanText(extras.learningId);
  const state = parseLearningAvailabilityState(extras.state);
  if (!learningId || !state) return null;

  const capabilities = parseCapabilityList(extras.capabilities ?? []);
  if (!capabilities) return null;

  const launchModeRaw = extras.launchMode;
  const launchMode =
    launchModeRaw == null || launchModeRaw === ""
      ? null
      : parseLearningLaunchMode(launchModeRaw);
  if (launchModeRaw && !launchMode) return null;

  return {
    platformEntity,
    learningId,
    state,
    launchMode,
    capabilities,
  };
}

export function parseLearningEntity(raw: unknown): LearningEntity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const platformRaw =
    r.platformEntity && typeof r.platformEntity === "object"
      ? r.platformEntity
      : {
          id: r.id,
          type: r.type ?? "course",
          title: r.title ?? r.name,
          subtitle: r.subtitle ?? r.summary,
          module: r.module ?? "learning",
          visibility: r.visibility ?? "public",
          ownership: r.ownership ?? "organization",
          destination: r.destination ?? r.href,
          metadata: r.metadata ?? {},
        };

  const platformEntity = parsePlatformEntity(platformRaw);
  if (!platformEntity) return null;

  return toLearningEntity(platformEntity, {
    learningId:
      cleanText(r.learningId) ??
      cleanText(r.learning_id) ??
      cleanText(r.courseId) ??
      cleanText(r.course_id) ??
      platformEntity.id,
    state: cleanText(r.state) ?? cleanText(r.availability) ?? "",
    launchMode: cleanText(r.launchMode) ?? cleanText(r.launch_mode),
    capabilities: r.capabilities,
  });
}

export function parseLearningCourseReference(
  raw: unknown
): LearningCourseReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const courseId = cleanText(r.courseId) ?? cleanText(r.course_id);
  if (!courseId) return null;

  const stateRaw = cleanText(r.state) ?? cleanText(r.availability);
  const state = stateRaw ? parseLearningAvailabilityState(stateRaw) : null;
  if (stateRaw && !state) return null;

  const destinationRaw = cleanText(r.destination) ?? cleanText(r.href);
  return {
    courseId,
    title: cleanText(r.title) ?? cleanText(r.name),
    state,
    catalogRef: cleanText(r.catalogRef) ?? cleanText(r.catalog_ref),
    destination: destinationRaw
      ? createPlatformDestination(destinationRaw)
      : null,
  };
}

export function parseLearningLessonReference(
  raw: unknown
): LearningLessonReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const lessonId = cleanText(r.lessonId) ?? cleanText(r.lesson_id);
  const courseId = cleanText(r.courseId) ?? cleanText(r.course_id);
  if (!lessonId || !courseId) return null;

  const stateRaw = cleanText(r.state);
  const state = stateRaw ? parseLearningAvailabilityState(stateRaw) : null;
  if (stateRaw && !state) return null;

  const destinationRaw = cleanText(r.destination) ?? cleanText(r.href);
  return {
    lessonId,
    courseId,
    title: cleanText(r.title) ?? cleanText(r.name),
    state,
    destination: destinationRaw
      ? createPlatformDestination(destinationRaw)
      : null,
  };
}

export function parseLearningAssessmentReference(
  raw: unknown
): LearningAssessmentReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const assessmentId =
    cleanText(r.assessmentId) ?? cleanText(r.assessment_id);
  if (!assessmentId) return null;
  return {
    assessmentId,
    courseId: cleanText(r.courseId) ?? cleanText(r.course_id),
    lessonId: cleanText(r.lessonId) ?? cleanText(r.lesson_id),
    title: cleanText(r.title) ?? cleanText(r.name),
    assessmentRef: cleanText(r.assessmentRef) ?? cleanText(r.assessment_ref),
  };
}

export function parseLearningCertificateReference(
  raw: unknown
): LearningCertificateReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const certificateId =
    cleanText(r.certificateId) ?? cleanText(r.certificate_id);
  const courseId = cleanText(r.courseId) ?? cleanText(r.course_id);
  const userId = cleanText(r.userId) ?? cleanText(r.user_id);
  if (!certificateId || !courseId || !userId) return null;
  return {
    certificateId,
    courseId,
    userId,
    issuedAt: cleanIso(r.issuedAt) ?? cleanIso(r.issued_at),
    certificateRef:
      cleanText(r.certificateRef) ?? cleanText(r.certificate_ref),
  };
}

export function parseLearningProgressReference(
  raw: unknown
): LearningProgressReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const progressId = cleanText(r.progressId) ?? cleanText(r.progress_id);
  const courseId = cleanText(r.courseId) ?? cleanText(r.course_id);
  const userId = cleanText(r.userId) ?? cleanText(r.user_id);
  if (!progressId || !courseId || !userId) return null;
  return {
    progressId,
    courseId,
    userId,
    updatedAt: cleanIso(r.updatedAt) ?? cleanIso(r.updated_at),
    progressRef: cleanText(r.progressRef) ?? cleanText(r.progress_ref),
  };
}

export function parseLearningInstructorReference(
  raw: unknown
): LearningInstructorReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const instructorId =
    cleanText(r.instructorId) ?? cleanText(r.instructor_id);
  if (!instructorId) return null;
  return {
    instructorId,
    userId: cleanText(r.userId) ?? cleanText(r.user_id),
    displayName: cleanText(r.displayName) ?? cleanText(r.display_name),
  };
}

export function parseLearningStudentReference(
  raw: unknown
): LearningStudentReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const studentId = cleanText(r.studentId) ?? cleanText(r.student_id);
  const userId = cleanText(r.userId) ?? cleanText(r.user_id);
  if (!studentId || !userId) return null;
  return {
    studentId,
    userId,
    displayName: cleanText(r.displayName) ?? cleanText(r.display_name),
  };
}

export function parseLearningEnrollmentReference(
  raw: unknown
): LearningEnrollmentReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const enrollmentId =
    cleanText(r.enrollmentId) ?? cleanText(r.enrollment_id);
  const courseId = cleanText(r.courseId) ?? cleanText(r.course_id);
  const userId = cleanText(r.userId) ?? cleanText(r.user_id);
  if (!enrollmentId || !courseId || !userId) return null;

  const stateRaw = cleanText(r.state);
  const state = stateRaw ? parseLearningAvailabilityState(stateRaw) : null;
  if (stateRaw && !state) return null;

  return {
    enrollmentId,
    courseId,
    userId,
    state,
    enrolledAt: cleanIso(r.enrolledAt) ?? cleanIso(r.enrolled_at),
  };
}

export function parseLearningCompletionReference(
  raw: unknown
): LearningCompletionReference | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const completionId =
    cleanText(r.completionId) ?? cleanText(r.completion_id);
  const courseId = cleanText(r.courseId) ?? cleanText(r.course_id);
  const userId = cleanText(r.userId) ?? cleanText(r.user_id);
  if (!completionId || !courseId || !userId) return null;
  return {
    completionId,
    courseId,
    userId,
    completedAt: cleanIso(r.completedAt) ?? cleanIso(r.completed_at),
    completionRef: cleanText(r.completionRef) ?? cleanText(r.completion_ref),
  };
}

export function parseLearningCapability(raw: unknown): LearningCapability | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = parseLearningCapabilityId(
    cleanText(r.id) ?? cleanText(r.capability)
  );
  if (!id) return null;
  return { id, enabled: r.enabled === true };
}

export function parseLearningPresence(raw: unknown): LearningPresence | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const userId = cleanText(r.userId) ?? cleanText(r.user_id);
  const status = parseLearningPresenceStatus(cleanText(r.status));
  if (!userId || !status) return null;
  return {
    userId,
    courseId: cleanText(r.courseId) ?? cleanText(r.course_id),
    lessonId: cleanText(r.lessonId) ?? cleanText(r.lesson_id),
    status,
    updatedAt: cleanIso(r.updatedAt) ?? cleanIso(r.updated_at),
  };
}

/**
 * Safe launch/open contract. Never invents destinations or enables launch without allowlist.
 */
export function resolveLearningLaunchContract(input: {
  learningId: string;
  mode: string | null | undefined;
  destinationRaw?: string | null;
  state?: string | null;
}): LearningLaunchContract | null {
  const learningId = cleanText(input.learningId);
  const mode = parseLearningLaunchMode(input.mode);
  if (!learningId || !mode) return null;

  const state = input.state
    ? parseLearningAvailabilityState(input.state)
    : "published";
  if (!state) return null;

  const destination = input.destinationRaw
    ? createPlatformDestination(input.destinationRaw)
    : null;

  const blocked = new Set([
    "draft",
    "archived",
    "disabled",
    "future",
  ]);

  if (blocked.has(state)) {
    return {
      learningId,
      mode,
      destination,
      canLaunch: false,
      reason: `Learning content is ${state.split("_").join(" ")}.`,
    };
  }

  if (!destination || !destination.href) {
    return {
      learningId,
      mode,
      destination,
      canLaunch: false,
      reason: "No safe learning destination is available.",
    };
  }

  return {
    learningId,
    mode,
    destination,
    canLaunch: false,
    reason: "Learning launch is not available yet.",
  };
}

export function parseLearningPermissions(raw: unknown): PlatformPermission[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parsePlatformPermission)
    .filter((p): p is PlatformPermission => Boolean(p));
}

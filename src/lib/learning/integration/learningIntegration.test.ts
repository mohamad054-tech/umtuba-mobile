import { describe, expect, it } from "vitest";

import {
  getLearningIntegrationSnapshot,
  isLearningIntegrationAdapterBound,
  isLearningIntegrationConfigured,
  isLearningLauncherBound,
  parseLearningAvailabilityState,
  parseLearningCertificateReference,
  parseLearningCourseReference,
  parseLearningEnrollmentReference,
  parseLearningEntity,
  parseLearningLessonReference,
  resolveLearningLaunchContract,
} from "@/src/lib/learning/integration";

describe("learning integration enums", () => {
  it("accepts known states and rejects unknown", () => {
    expect(parseLearningAvailabilityState("published")).toBe("published");
    expect(parseLearningAvailabilityState("in_progress")).toBe("in_progress");
    expect(parseLearningAvailabilityState("watching")).toBeNull();
  });
});

describe("learning references / entity", () => {
  it("parses trusted refs without inventing courses", () => {
    expect(
      parseLearningCourseReference({
        course_id: "c1",
        title: "Intro",
        state: "published",
        destination: "/discover",
      })
    ).toMatchObject({
      courseId: "c1",
      title: "Intro",
      state: "published",
    });
    expect(parseLearningCourseReference({ title: "X" })).toBeNull();

    expect(
      parseLearningLessonReference({
        lesson_id: "l1",
        course_id: "c1",
        title: "Lesson 1",
      })
    ).toMatchObject({ lessonId: "l1", courseId: "c1" });

    expect(
      parseLearningEnrollmentReference({
        enrollment_id: "e1",
        course_id: "c1",
        user_id: "u1",
        state: "enrolled",
      })
    ).toMatchObject({ enrollmentId: "e1", state: "enrolled" });

    expect(
      parseLearningCertificateReference({
        certificate_id: "cert1",
        course_id: "c1",
        user_id: "u1",
      })
    ).toMatchObject({ certificateId: "cert1" });
    expect(
      parseLearningCertificateReference({ course_id: "c1", user_id: "u1" })
    ).toBeNull();
  });

  it("requires course|lesson platform entity", () => {
    const entity = parseLearningEntity({
      id: "c1",
      type: "course",
      title: "Course A",
      visibility: "public",
      ownership: "organization",
      module: "learning",
      state: "published",
      capabilities: ["browse", "progress"],
    });
    expect(entity?.learningId).toBe("c1");
    expect(entity?.platformEntity.type).toBe("course");

    expect(
      parseLearningEntity({
        id: "v1",
        type: "video",
        title: "Not learning",
        visibility: "public",
        ownership: "self",
        state: "published",
        learning_id: "x",
      })
    ).toBeNull();
  });
});

describe("learning launch contract", () => {
  it("never enables launch in foundation", () => {
    expect(isLearningLauncherBound()).toBe(false);
    const contract = resolveLearningLaunchContract({
      learningId: "c1",
      mode: "internal",
      state: "published",
      destinationRaw: "/(tabs)/discover",
    });
    expect(contract?.canLaunch).toBe(false);
    expect(contract?.destination?.href).toBe("/(tabs)/discover");

    const draft = resolveLearningLaunchContract({
      learningId: "c1",
      mode: "internal",
      state: "draft",
      destinationRaw: "/(tabs)/discover",
    });
    expect(draft?.canLaunch).toBe(false);

    const unsafe = resolveLearningLaunchContract({
      learningId: "c1",
      mode: "external",
      state: "published",
      destinationRaw: "https://evil.example/learn",
    });
    expect(unsafe?.canLaunch).toBe(false);
    expect(unsafe?.destination?.href).toBeNull();
  });
});

describe("learning foundation snapshot", () => {
  it("stays unavailable with empty courses", () => {
    expect(isLearningIntegrationConfigured()).toBe(false);
    expect(isLearningIntegrationAdapterBound()).toBe(false);
    const snap = getLearningIntegrationSnapshot();
    expect(snap.status).toBe("unavailable");
    expect(snap.courses).toEqual([]);
    expect(snap.capabilities.every((c) => c.enabled === false)).toBe(true);
  });
});

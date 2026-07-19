import { describe, expect, it } from "vitest";
import type {
  PersistedCourseSnapshot,
  PersistedMaterialSnapshot,
  PersistedSectionSnapshot,
} from "../domain/repository";
import { courseView, materialView, sectionView } from "./moodle-presenters";

const oldSync = new Date("2026-07-18T08:00:00.000Z");
const stagingSync = new Date("2026-07-19T12:00:00.000Z");

describe("Moodle stale presenters", () => {
  it("expõe a data da origem preservada e não o timestamp novo de staging", () => {
    const course = {
      publicId: "c",
      name: "Curso",
      shortName: "C",
      category: null,
      descriptionText: null,
      startAt: null,
      endAt: null,
      visible: true,
      hiddenByStudent: false,
      favourite: false,
      progressAvailable: false,
      progressPercent: null,
      stale: true,
      sourceSyncedAt: oldSync,
      syncedAt: stagingSync,
    } as PersistedCourseSnapshot;
    const section = {
      publicId: "s",
      coursePublicId: "c",
      title: "Secção",
      position: 1,
      summaryText: null,
      visible: true,
      available: true,
      stale: true,
      sourceSyncedAt: oldSync,
      syncedAt: stagingSync,
    } as PersistedSectionSnapshot;
    const material = {
      publicId: "m",
      coursePublicId: "c",
      sectionPublicId: "s",
      type: "file",
      title: "Material",
      descriptionText: null,
      available: true,
      openAvailable: false,
      downloadAvailable: false,
      locatorEnvelope: null,
      mimeType: null,
      fileName: null,
      sizeBytes: null,
      stale: true,
      sourceSyncedAt: oldSync,
      syncedAt: stagingSync,
    } as PersistedMaterialSnapshot;

    expect(courseView(course).lastSyncedAt).toBe(oldSync.toISOString());
    expect(sectionView(section).lastSyncedAt).toBe(oldSync.toISOString());
    expect(materialView(material).lastSyncedAt).toBe(oldSync.toISOString());
  });
});

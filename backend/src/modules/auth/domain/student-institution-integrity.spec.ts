import { describe, expect, it } from "vitest";
import {
  auditStudentInstitutionIntegrity,
  buildInstitutionScopedStudentNumber,
  detectStudentInstitutionIssues,
  resolveStudentInstitutionFlag,
} from "./student-institution-integrity";

describe("student institution integrity", () => {
  it("keeps UOR and ISPTEC students with the same numeric identifier as separate identities", () => {
    const audit = auditStudentInstitutionIntegrity([
      {
        id: 1,
        studentNumber: "20200477",
        registrationSource: "SECRETARIA",
        university: "Universidade Oscar Ribas",
        isUorStudent: true,
      },
      {
        id: 2,
        studentNumber: "ISPTEC-20200477",
        registrationSource: "ISPTEC_OFFICIAL",
        university: "ISPTEC",
        isUorStudent: false,
      },
    ]);

    expect(audit.totals.byInstitution).toMatchObject({ UOR: 1, ISPTEC: 1, UNKNOWN: 0 });
    expect(audit.criticalIssues).toHaveLength(0);
    expect(audit.sharedIdentifiers).toEqual([
      expect.objectContaining({
        rawStudentNumber: "20200477",
        institutions: ["ISPTEC", "UOR"],
        status: "SEPARATED",
      }),
    ]);
  });

  it("flags old ISPTEC official accounts that still use a raw numeric student number", () => {
    const issues = detectStudentInstitutionIssues({
      id: 10,
      studentNumber: "20200477",
      registrationSource: "ISPTEC_OFFICIAL",
      university: "ISPTEC",
      isUorStudent: false,
    });

    expect(resolveStudentInstitutionFlag({
      studentNumber: "20200477",
      registrationSource: "ISPTEC_OFFICIAL",
      university: "ISPTEC",
    })).toBe("ISPTEC");
    expect(buildInstitutionScopedStudentNumber("ISPTEC", "20200477")).toBe("ISPTEC-20200477");
    expect(issues).toEqual([
      expect.objectContaining({
        code: "ISPTEC_NUMBER_NOT_SCOPED",
        severity: "CRITICAL",
        expectedStudentNumber: "ISPTEC-20200477",
      }),
    ]);
  });

  it("flags UOR official accounts accidentally stored with the ISPTEC prefix", () => {
    const issues = detectStudentInstitutionIssues({
      id: 11,
      studentNumber: "ISPTEC-20200477",
      registrationSource: "SECRETARIA",
      university: "UOR",
      isUorStudent: true,
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "UOR_NUMBER_SCOPED_AS_ISPTEC",
        severity: "CRITICAL",
        expectedStudentNumber: "20200477",
      }),
    ]);
  });

  it("flags conflicting source, university and boolean flags", () => {
    const issues = detectStudentInstitutionIssues({
      id: 12,
      studentNumber: "ISPTEC-20200477",
      registrationSource: "ISPTEC_OFFICIAL",
      university: "Universidade Oscar Ribas",
      isUorStudent: true,
    });

    expect(issues.map((issue) => issue.code)).toEqual([
      "SOURCE_UNIVERSITY_MISMATCH",
      "SOURCE_BOOLEAN_FLAG_MISMATCH",
    ]);
    expect(issues.every((issue) => issue.severity === "HIGH")).toBe(true);
  });

  it("marks unknown academic records without a source as data that needs manual review", () => {
    const issues = detectStudentInstitutionIssues({
      id: 13,
      studentNumber: "20209999",
      registrationSource: null,
      university: null,
      academicSyncedAt: new Date("2026-05-19T08:00:00.000Z"),
      isUorStudent: null,
    });

    expect(resolveStudentInstitutionFlag({
      studentNumber: "20209999",
      registrationSource: null,
      university: null,
      academicSyncedAt: new Date("2026-05-19T08:00:00.000Z"),
    })).toBe("UNKNOWN");
    expect(issues).toEqual([
      expect.objectContaining({
        code: "ACADEMIC_SYNC_WITHOUT_INSTITUTION_SOURCE",
        severity: "MEDIUM",
      }),
    ]);
  });
});

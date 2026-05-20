import { describe, expect, it } from "vitest";
import {
  buildStudentIdentityWhere,
  hasIsptecInstitutionalEmail,
  hasOfficialStudentNumberShape,
  normalizeStudentNumberForIdentity,
  resolveStudentInstitutionCode,
  type StudentInstitutionCode,
} from "./student-identity";

describe("student identity", () => {
  it("classifies only exact @isptec.co.ao email endings as ISPTEC", () => {
    expect(hasIsptecInstitutionalEmail("20230096@isptec.co.ao")).toBe(true);
    expect(resolveStudentInstitutionCode({ email: "20230096@isptec.co.ao" })).toBe("ISPTEC");
  });

  it("classifies Gmail and non exact ISPTEC domains as UOR even when legacy flags say ISPTEC", () => {
    expect(resolveStudentInstitutionCode({
      studentNumber: "20200477",
      email: "estudante.isptec@gmail.com",
      registrationSource: "ISPTEC_OFFICIAL",
      university: "ISPTEC",
    })).toBe("UOR");
    expect(resolveStudentInstitutionCode({
      studentNumber: "20200478",
      email: "aluno@alunos.isptec.co.ao",
      registrationSource: "ISPTEC_OFFICIAL",
      university: "ISPTEC",
    })).toBe("UOR");
  });

  it("classifies UOR contact profiles without changing the visible student number", () => {
    expect(resolveStudentInstitutionCode({
      studentNumber: "20200477",
      phone: "+244923000111",
      email: "estudante@gmail.com",
    })).toBe("UOR");
  });

  it("normalizes legacy ISPTEC-prefixed numbers back to their real student number", () => {
    expect(normalizeStudentNumberForIdentity("ISPTEC-20230096")).toBe("20230096");
    expect(normalizeStudentNumberForIdentity(" 20242099 ")).toBe("20242099");
    expect(hasOfficialStudentNumberShape("ISPTEC-20230096")).toBe(true);
    expect(hasOfficialStudentNumberShape("876697142783")).toBe(false);
  });

  it("builds a composite identity lookup using institution and student number", () => {
    expect(buildStudentIdentityWhere("ISPTEC-20200477", "ISPTEC")).toEqual({
      institutionCode_studentNumber: {
        institutionCode: "ISPTEC" satisfies StudentInstitutionCode,
        studentNumber: "20200477",
      },
    });
  });
});

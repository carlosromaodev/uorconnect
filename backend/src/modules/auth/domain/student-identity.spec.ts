import { describe, expect, it } from "vitest";
import {
  buildStudentIdentityWhere,
  resolveStudentInstitutionCode,
  type StudentInstitutionCode,
} from "./student-identity";

describe("student identity", () => {
  it("classifies every email with ISPTEC references as ISPTEC", () => {
    const emails = [
      "aluno@isptec.co.ao",
      "aluno@alunos.isptec.co.ao",
      "estudante.isptec@gmail.com",
    ];

    for (const email of emails) {
      expect(resolveStudentInstitutionCode({ email })).toBe("ISPTEC");
    }
  });

  it("keeps ISPTEC email as the strongest signal even when legacy source is mixed", () => {
    expect(resolveStudentInstitutionCode({
      studentNumber: "20200477",
      email: "aluno@isptec.co.ao",
      registrationSource: "SECRETARIA",
      university: "UOR",
    })).toBe("ISPTEC");
  });

  it("classifies legacy ISPTEC references as ISPTEC even when registration source is mixed", () => {
    expect(resolveStudentInstitutionCode({
      studentNumber: "ISPTEC-20240658",
      email: "estudante@gmail.com",
      registrationSource: "SECRETARIA",
      university: "ISPTEC",
    })).toBe("ISPTEC");
  });

  it("classifies UOR contact profiles without changing the visible student number", () => {
    expect(resolveStudentInstitutionCode({
      studentNumber: "20200477",
      phone: "+244923000111",
      email: "estudante@gmail.com",
    })).toBe("UOR");
  });

  it("builds a composite identity lookup using institution and student number", () => {
    expect(buildStudentIdentityWhere("20200477", "ISPTEC")).toEqual({
      institutionCode_studentNumber: {
        institutionCode: "ISPTEC" satisfies StudentInstitutionCode,
        studentNumber: "20200477",
      },
    });
  });
});

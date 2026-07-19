import { describe, expect, it } from "vitest";
import {
  buildStudentIdentityWhere,
  canonicalStudentUniversityName,
  hasIsptecInstitutionalEmail,
  hasOfficialStudentNumberShape,
  hasVerifiedIsptecStudentEmail,
  normalizeStudentNumberForIdentity,
  resolveStudentInstitutionCode,
  type StudentInstitutionCode,
} from "./student-identity";

describe("student identity", () => {
  it("classifies only exact @isptec.co.ao email endings as ISPTEC", () => {
    expect(hasIsptecInstitutionalEmail("20230096@isptec.co.ao")).toBe(true);
    expect(hasVerifiedIsptecStudentEmail("20230096", "20230096@isptec.co.ao")).toBe(true);
    expect(hasVerifiedIsptecStudentEmail("20230096", "outro@isptec.co.ao")).toBe(false);
    expect(resolveStudentInstitutionCode({
      studentNumber: "20230096",
      email: "20230096@isptec.co.ao",
    })).toBe("ISPTEC");
  });

  it("does not classify ISPTEC logins as ISPTEC without the institutional email tied to the student number", () => {
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

  it("keeps official secretaria logins under UOR even when contact email looks external", () => {
    expect(resolveStudentInstitutionCode({
      studentNumber: "20230096",
      email: "20230096@isptec.co.ao",
      registrationSource: "SECRETARIA",
      university: "UOR",
      course: "Engenharia Informática e Comunicações",
    })).toBe("UOR");
  });

  it("classifies UOR contact profiles without changing the visible student number", () => {
    expect(resolveStudentInstitutionCode({
      studentNumber: "20200477",
      phone: "+244923000111",
      email: "estudante@gmail.com",
    })).toBe("UOR");
  });

  it("uses exclusive course names to repair mixed institution data", () => {
    expect(resolveStudentInstitutionCode({
      studentNumber: "20230096",
      email: "estudante@gmail.com",
      course: "Engenharia Química",
    })).toBe("UOR");
    expect(resolveStudentInstitutionCode({
      studentNumber: "20230096",
      email: "20230096@isptec.co.ao",
      course: "Engenharia Informática e Comunicações",
    })).toBe("ISPTEC");
    expect(resolveStudentInstitutionCode({
      email: "estudante@gmail.com",
      course: "Contabilidade e Finanças",
    })).toBe("UOR");
    expect(resolveStudentInstitutionCode({
      email: "estudante@gmail.com",
      course: "Gestão de Administração e Marketing",
    })).toBe("UOR");
    expect(resolveStudentInstitutionCode({
      email: "estudante@gmail.com",
      course: "Gestão Administração e Marketing",
    })).toBe("UOR");
  });

  it("keeps class codes as secondary data and does not override the ISPTEC email rule", () => {
    expect(resolveStudentInstitutionCode({ classCode: "TINFM" })).toBe("UOR");
    expect(resolveStudentInstitutionCode({ classCode: "EPT2_M1" })).toBe("UOR");
    expect(resolveStudentInstitutionCode({ classCode: "EPT2_M1", email: "aluno@gmail.com" })).toBe("UOR");
  });

  it("keeps shared or unknown courses decided by the institutional email fallback", () => {
    expect(resolveStudentInstitutionCode({
      studentNumber: "20230096",
      email: "20230096@isptec.co.ao",
      course: "Engenharia Civil",
    })).toBe("ISPTEC");
    expect(resolveStudentInstitutionCode({
      email: "estudante@gmail.com",
      course: "Engenharia Civil",
    })).toBe("UOR");
    expect(resolveStudentInstitutionCode({
      studentNumber: "20230096",
      email: "20230096@isptec.co.ao",
      course: "UNIMESTRE - Sistema de gestão educacional",
    })).toBe("ISPTEC");
  });

  it("provides a canonical university display value for the resolved institution", () => {
    expect(canonicalStudentUniversityName("UOR")).toBe("UOR");
    expect(canonicalStudentUniversityName("ISPTEC")).toBe("ISPTEC");
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

import { describe, expect, it } from "vitest";
import { normalizeStudentProfile } from "./student-format";

describe("normalizeStudentProfile", () => {
  it("exposes ISPTEC institution for existing rows whose email references ISPTEC", () => {
    const profile = normalizeStudentProfile({
      studentNumber: "20200477",
      institutionCode: "UOR",
      email: "aluno@isptec.co.ao",
      phone: "+244923000111",
      registrationSource: null,
    });

    expect(profile.studentNumber).toBe("20200477");
    expect(profile.institutionCode).toBe("ISPTEC");
  });
});

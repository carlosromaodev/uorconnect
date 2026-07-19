import { describe, expect, it } from "vitest";
import { normalizeCourse, normalizeStudentProfile } from "./student-format";

describe("normalizeStudentProfile", () => {
  it("exposes ISPTEC institution only when the institutional email belongs to the student number", () => {
    const profile = normalizeStudentProfile({
      studentNumber: "20200477",
      institutionCode: "UOR",
      email: "20200477@isptec.co.ao",
      phone: "+244923000111",
      registrationSource: null,
    });

    expect(profile.studentNumber).toBe("20200477");
    expect(profile.institutionCode).toBe("ISPTEC");
  });

  it("removes legacy ISPTEC prefix from numbers exposed to the interface", () => {
    const profile = normalizeStudentProfile({
      studentNumber: "ISPTEC-20230973",
      institutionCode: "ISPTEC",
      email: "20230973@isptec.co.ao",
      registrationSource: "ISPTEC_OFFICIAL",
    });

    expect(profile.studentNumber).toBe("20230973");
    expect(profile.institutionCode).toBe("ISPTEC");
  });

  it("normalizes the UOR secretary course label for Gestão Administração e Marketing", () => {
    expect(normalizeCourse("[2] Licenciatura em Gestão Administração e Marketing"))
      .toBe("Gestão de Administração e Marketing");
  });
});

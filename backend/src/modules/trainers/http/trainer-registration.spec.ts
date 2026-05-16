import { describe, expect, it } from "vitest";
import {
  buildTrainerDashboardPayload,
  canTrainerAccessDashboard,
  trainerApprovalSchema,
  trainerRegistrationSubmitSchema,
} from "./trainer-registration";

describe("trainer registration rules", () => {
  it("requires a verified phone profile with course, specialty and bio before submission", () => {
    const parsed = trainerRegistrationSubmitSchema.safeParse({
      phone: "+244937000000",
      name: "Carlos Romao",
      specialty: "Redes e seguranca",
      bio: "Formador com experiencia em laboratorios praticos.",
      selectedCourseId: 3,
    });

    expect(parsed.success).toBe(true);

    const invalid = trainerRegistrationSubmitSchema.safeParse({
      phone: "+244937000000",
      name: "Carlos Romao",
      specialty: "Redes",
      bio: "",
      selectedCourseId: null,
    });

    expect(invalid.success).toBe(false);
  });

  it("does not approve a trainer without an assigned course", () => {
    expect(
      trainerApprovalSchema.safeParse({
        selectedCourseId: 0,
        note: "Perfil validado.",
      }).success,
    ).toBe(false);

    expect(
      trainerApprovalSchema.safeParse({
        selectedCourseId: 9,
        note: "Perfil validado.",
      }).success,
    ).toBe(true);
  });

  it("only approved trainers can open the trainer dashboard", () => {
    expect(canTrainerAccessDashboard("PENDING")).toBe(false);
    expect(canTrainerAccessDashboard("REJECTED")).toBe(false);
    expect(canTrainerAccessDashboard("APPROVED")).toBe(true);
  });

  it("builds a course dashboard with aggregate numbers only", () => {
    const payload = buildTrainerDashboardPayload({
      request: {
        id: 4,
        name: "Ana Carvalho",
        phone: "+244937000000",
        status: "APPROVED",
        selectedCourseId: 2,
        updatedAt: new Date("2026-05-12T10:00:00.000Z"),
      },
      course: {
        id: 2,
        name: "Marketing Digital",
        description: "Curso pratico para campanhas digitais.",
        companyName: "UOR Connect",
        companyCategory: "Formacao",
        isPublished: true,
      },
      enrollments: [
        { paymentStatus: "CONFIRMED_BY_ADMIN" },
        { paymentStatus: "SUBMITTED_BY_USER" },
        { paymentStatus: "PENDING_REVIEW" },
        { paymentStatus: "REJECTED" },
      ],
    });

    expect(payload.course.name).toBe("Marketing Digital");
    expect(payload.metrics.totalEnrollments).toBe(4);
    expect(payload.metrics.confirmedPayments).toBe(1);
    expect(payload.metrics.pendingPayments).toBe(2);
    expect(payload.metrics.rejectedPayments).toBe(1);
    expect(JSON.stringify(payload)).not.toContain("studentName");
    expect(JSON.stringify(payload)).not.toContain("paymentProof");
    expect(JSON.stringify(payload)).not.toContain("phone");
  });
});

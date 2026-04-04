import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncStudentProfileIfNeeded } from "./student-profile";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: {
    auth: {
      updateMe: vi.fn(),
    },
  },
}));

describe("syncStudentProfileIfNeeded", () => {
  const currentStudent = {
    id: 1,
    studentNumber: "20240099",
    name: "Ana Silva",
    email: "ana@example.com",
    course: "Engenharia Informática",
    birthDate: null,
    nationality: null,
    phone: "+244 923456789",
    lastLoginAt: null,
    createdAt: "2026-03-28T10:00:00.000Z",
    updatedAt: "2026-03-28T10:00:00.000Z",
  };

  beforeEach(() => {
    vi.mocked(api.auth.updateMe).mockReset();
  });

  it("não chama a API quando não existe sessão ativa", async () => {
    await expect(syncStudentProfileIfNeeded(null, { name: "Outro Nome" })).resolves.toBeNull();
    expect(api.auth.updateMe).not.toHaveBeenCalled();
  });

  it("não chama a API quando não há alterações reais", async () => {
    const result = await syncStudentProfileIfNeeded(currentStudent, {
      name: " Ana Silva ",
      email: "ana@example.com",
      course: "Engenharia Informática",
      phone: "+244 923456789",
    });

    expect(result).toEqual(currentStudent);
    expect(api.auth.updateMe).not.toHaveBeenCalled();
  });

  it("envia apenas os campos alterados e já normalizados", async () => {
    vi.mocked(api.auth.updateMe).mockResolvedValue({
      ...currentStudent,
      name: "Ana Paula Silva",
      phone: "+244 912345678",
    });

    const result = await syncStudentProfileIfNeeded(currentStudent, {
      name: "  Ana Paula Silva ",
      email: "ana@example.com",
      course: "Engenharia Informática",
      phone: " +244 912345678 ",
    });

    expect(api.auth.updateMe).toHaveBeenCalledWith({
      name: "Ana Paula Silva",
      phone: "+244 912345678",
    });
    expect(result?.name).toBe("Ana Paula Silva");
  });
});

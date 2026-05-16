import { describe, expect, it, vi } from "vitest";
import {
  AuthorizeAdminStudentUseCase,
  ListAdminSecurityOverviewUseCase,
  RevokeAdminStudentUseCase,
  type AdminSecurityRepository,
} from "./manage-admin-security";
import { type AdminAuthorizedStudent, type Student } from "../domain/student";

function makeAuthorizedStudent(overrides: Partial<AdminAuthorizedStudent> = {}): AdminAuthorizedStudent {
  return {
    id: 1,
    studentNumber: "20242099",
    team: "Geral",
    role: "SUPER_ADMIN",
    permissions: "ALL",
    isActive: true,
    revokedAt: null,
    revokedByStudentNumber: null,
    revocationReason: null,
    createdAt: new Date("2026-03-22T18:00:00.000Z"),
    updatedAt: new Date("2026-03-22T18:00:00.000Z"),
    ...overrides,
  };
}

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 10,
    studentNumber: "20240010",
    name: "Paulo Silva",
    email: "paulo@uor.ao",
    course: "Eng. Informática",
    birthDate: null,
    nationality: null,
    phone: "+244923000000",
    lastLoginAt: new Date("2026-03-22T18:10:00.000Z"),
    createdAt: new Date("2026-03-22T18:00:00.000Z"),
    updatedAt: new Date("2026-03-22T18:10:00.000Z"),
    ...overrides,
  };
}

describe("admin security use cases", () => {
  it("lista os estudantes autorizados e os logins recentes", async () => {
    const repo: AdminSecurityRepository = {
      listAuthorizedAdminStudents: vi.fn().mockResolvedValue([makeAuthorizedStudent()]),
      authorizeAdminStudent: vi.fn(),
      revokeAdminStudent: vi.fn(),
      isAdminAuthorized: vi.fn(),
      listRecentLogins: vi.fn().mockResolvedValue([makeStudent()]),
      listAdminAccessConflicts: vi.fn().mockResolvedValue([]),
    };

    const result = await new ListAdminSecurityOverviewUseCase(repo).execute();

    expect(result.authorizedStudents).toHaveLength(1);
    expect(result.recentLogins).toHaveLength(1);
    expect(result.adminAccessConflicts).toHaveLength(0);
    expect(repo.listAuthorizedAdminStudents).toHaveBeenCalledOnce();
    expect(repo.listRecentLogins).toHaveBeenCalledWith(25);
    expect(repo.listAdminAccessConflicts).toHaveBeenCalledOnce();
  });

  it("autoriza um número de estudante válido", async () => {
    const repo: AdminSecurityRepository = {
      listAuthorizedAdminStudents: vi.fn(),
      authorizeAdminStudent: vi.fn().mockResolvedValue(makeAuthorizedStudent({ studentNumber: "20242111" })),
      revokeAdminStudent: vi.fn(),
      isAdminAuthorized: vi.fn(),
      listRecentLogins: vi.fn(),
      listAdminAccessConflicts: vi.fn(),
    };

    const result = await new AuthorizeAdminStudentUseCase(repo).execute("2024-2111");

    expect(result).toEqual({
      success: true,
      authorizedStudent: expect.objectContaining({ studentNumber: "20242111" }),
    });
    expect(repo.authorizeAdminStudent).toHaveBeenCalledWith("20242111", {
      team: "Geral",
      role: "SUPER_ADMIN",
      permissions: ["ALL"],
    });
  });

  it("autoriza um acesso por equipa com permissões específicas", async () => {
    const repo: AdminSecurityRepository = {
      listAuthorizedAdminStudents: vi.fn(),
      authorizeAdminStudent: vi.fn().mockResolvedValue(makeAuthorizedStudent({
        studentNumber: "20242112",
        team: "Credenciamento",
        role: "TEAM_LEAD",
        permissions: "ATTENDANCE,CERTIFICATES",
      })),
      revokeAdminStudent: vi.fn(),
      isAdminAuthorized: vi.fn(),
      listRecentLogins: vi.fn(),
      listAdminAccessConflicts: vi.fn(),
    };

    const result = await new AuthorizeAdminStudentUseCase(repo).execute("20242112", {
      team: "Credenciamento",
      role: "TEAM_LEAD",
      permissions: ["ATTENDANCE", "CERTIFICATES"],
    });

    expect(result).toEqual({
      success: true,
      authorizedStudent: expect.objectContaining({
        team: "Credenciamento",
        role: "TEAM_LEAD",
        permissions: "ATTENDANCE,CERTIFICATES",
      }),
    });
    expect(repo.authorizeAdminStudent).toHaveBeenCalledWith("20242112", {
      team: "Credenciamento",
      role: "TEAM_LEAD",
      permissions: ["ATTENDANCE", "CERTIFICATES"],
    });
  });

  it("recusa autorização com número inválido", async () => {
    const repo: AdminSecurityRepository = {
      listAuthorizedAdminStudents: vi.fn(),
      authorizeAdminStudent: vi.fn(),
      revokeAdminStudent: vi.fn(),
      isAdminAuthorized: vi.fn(),
      listRecentLogins: vi.fn(),
      listAdminAccessConflicts: vi.fn(),
    };

    const result = await new AuthorizeAdminStudentUseCase(repo).execute("123");

    expect(result).toEqual({ success: false, error: "Student number must have between 8 and 12 digits" });
    expect(repo.authorizeAdminStudent).not.toHaveBeenCalled();
  });

  it("autoriza número administrativo com até 10 dígitos", async () => {
    const repo: AdminSecurityRepository = {
      listAuthorizedAdminStudents: vi.fn(),
      authorizeAdminStudent: vi.fn().mockResolvedValue(makeAuthorizedStudent({ studentNumber: "2024211101" })),
      revokeAdminStudent: vi.fn(),
      isAdminAuthorized: vi.fn(),
      listRecentLogins: vi.fn(),
      listAdminAccessConflicts: vi.fn(),
    };

    const result = await new AuthorizeAdminStudentUseCase(repo).execute("2024211101");

    expect(result).toEqual({
      success: true,
      authorizedStudent: expect.objectContaining({ studentNumber: "2024211101" }),
    });
    expect(repo.authorizeAdminStudent).toHaveBeenCalledWith("2024211101", {
      team: "Geral",
      role: "SUPER_ADMIN",
      permissions: ["ALL"],
    });
  });

  it("remove um estudante autorizado existente", async () => {
    const repo: AdminSecurityRepository = {
      listAuthorizedAdminStudents: vi.fn(),
      authorizeAdminStudent: vi.fn(),
      revokeAdminStudent: vi.fn().mockResolvedValue(undefined),
      isAdminAuthorized: vi.fn().mockResolvedValue(true),
      listRecentLogins: vi.fn(),
      listAdminAccessConflicts: vi.fn(),
    };

    const result = await new RevokeAdminStudentUseCase(repo).execute("20242099", {
      revokedByStudentNumber: "20240001",
    });

    expect(result).toEqual({ success: true });
    expect(repo.revokeAdminStudent).toHaveBeenCalledWith("20242099", {
      revokedByStudentNumber: "20240001",
    });
  });

  it("falha ao remover quando o número não está autorizado", async () => {
    const repo: AdminSecurityRepository = {
      listAuthorizedAdminStudents: vi.fn(),
      authorizeAdminStudent: vi.fn(),
      revokeAdminStudent: vi.fn(),
      isAdminAuthorized: vi.fn().mockResolvedValue(false),
      listRecentLogins: vi.fn(),
      listAdminAccessConflicts: vi.fn(),
    };

    const result = await new RevokeAdminStudentUseCase(repo).execute("20249999");

    expect(result).toEqual({ success: false, error: "Authorized student not found" });
    expect(repo.revokeAdminStudent).not.toHaveBeenCalled();
  });
});

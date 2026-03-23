import { describe, expect, it, vi } from "vitest";
import { DeleteStudentUseCase, ListStudentsWithStatsUseCase, type StudentManagementRepository } from "./manage-students";
import { type StudentWithStats } from "../domain/student";

function makeStudent(overrides: Partial<StudentWithStats> = {}): StudentWithStats {
  return {
    id: 1,
    studentNumber: "20240001",
    name: "Jose Manuel",
    email: "jose@gmail.com",
    course: "Eng. Informática",
    birthDate: null,
    nationality: null,
    phone: null,
    createdAt: new Date("2026-03-21T00:00:00.000Z"),
    updatedAt: new Date("2026-03-21T00:00:00.000Z"),
    _count: {
      likes: 0,
      votes: 0,
      comments: 0
    },
    ...overrides
  };
}

describe("student management use cases", () => {
  it("lista estudantes com estatísticas", async () => {
    const repo: StudentManagementRepository = {
      listAllWithStats: vi.fn().mockResolvedValue([makeStudent()]),
      findByIdWithStats: vi.fn(),
      deleteWithRelations: vi.fn()
    };

    const result = await new ListStudentsWithStatsUseCase(repo).execute();

    expect(result).toHaveLength(1);
    expect(repo.listAllWithStats).toHaveBeenCalledOnce();
  });

  it("remove estudante mesmo sem interações", async () => {
    const repo: StudentManagementRepository = {
      listAllWithStats: vi.fn(),
      findByIdWithStats: vi.fn().mockResolvedValue(makeStudent({
        _count: { likes: 0, votes: 0, comments: 0 }
      })),
      deleteWithRelations: vi.fn().mockResolvedValue(undefined)
    };

    const result = await new DeleteStudentUseCase(repo).execute(1);

    expect(result).toEqual({ success: true });
    expect(repo.deleteWithRelations).toHaveBeenCalledWith(1);
  });

  it("falha quando estudante não existe", async () => {
    const repo: StudentManagementRepository = {
      listAllWithStats: vi.fn(),
      findByIdWithStats: vi.fn().mockResolvedValue(null),
      deleteWithRelations: vi.fn()
    };

    const result = await new DeleteStudentUseCase(repo).execute(99);

    expect(result).toEqual({ success: false, error: "Student not found" });
    expect(repo.deleteWithRelations).not.toHaveBeenCalled();
  });
});

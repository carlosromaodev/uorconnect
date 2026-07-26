import { describe, expect, it, vi } from "vitest";
import {
  DeleteIncompleteStudentUseCase,
  type StudentDeletionRepository
} from "./delete-incomplete-student";
import { type StudentWithStats } from "../domain/student";

function makeStudent(overrides: Partial<StudentWithStats> = {}): StudentWithStats {
  return {
    id: 1,
    studentNumber: "20240001",
    name: null,
    email: null,
    course: null,
    birthDate: null,
    nationality: null,
    phone: null,
    createdAt: new Date("2026-03-21T00:00:00.000Z"),
    updatedAt: new Date("2026-03-21T00:00:00.000Z"),
    _count: {
      likes: 0,
      votes: 0,
      comments: 0,
      courseEnrollments: 0,
      certificates: 0,
      attendanceCheckIns: 0,
      submissions: 0,
      submissionMemberships: 0,
      liveChatMessages: 0,
      passportScans: 0,
      passportPointLedger: 0,
      passportChallengeAnswers: 0,
      passportStudentBadges: 0,
      passportSurpriseEffects: 0,
      exhibitorVoteScoreEvents: 0,
      exhibitorActorScoreEvents: 0,
    },
    ...overrides
  };
}

describe("DeleteIncompleteStudentUseCase", () => {
  it("remove estudante incompleto", async () => {
    const repo: StudentDeletionRepository = {
      findByIdWithStats: vi.fn().mockResolvedValue(makeStudent({ email: null })),
      deleteWithRelations: vi.fn().mockResolvedValue(undefined)
    };

    const useCase = new DeleteIncompleteStudentUseCase(repo);
    const result = await useCase.execute(1);

    expect(result).toEqual({ success: true });
    expect(repo.deleteWithRelations).toHaveBeenCalledWith(1);
  });

  it("remove também estudante completo", async () => {
    const repo: StudentDeletionRepository = {
      findByIdWithStats: vi.fn().mockResolvedValue(
        makeStudent({
          name: "Jose Manuel",
          email: "jose@uor.edu.ao",
          course: "Licenciatura em Engenharia Informática"
        })
      ),
      deleteWithRelations: vi.fn()
    };

    const useCase = new DeleteIncompleteStudentUseCase(repo);
    const result = await useCase.execute(1);

    expect(result).toEqual({ success: true });
    expect(repo.deleteWithRelations).toHaveBeenCalledWith(1);
  });

  it("rejeita id inválido", async () => {
    const repo: StudentDeletionRepository = {
      findByIdWithStats: vi.fn(),
      deleteWithRelations: vi.fn()
    };

    const useCase = new DeleteIncompleteStudentUseCase(repo);
    const result = await useCase.execute(0);

    expect(result).toEqual({ success: false, error: "Invalid student id" });
    expect(repo.findByIdWithStats).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { GetAdminVotesOverview, type AdminVotesRepository } from "./admin-votes";

describe("GetAdminVotesOverview", () => {
  it("agrega projetos e votos para o admin", async () => {
    const repository: AdminVotesRepository = {
      listProjectSummaries: vi.fn().mockResolvedValue([
        { id: 1, name: "Projeto A", type: "PROJECT", votes: 4, comments: 2, averageRating: 4.5 }
      ]),
      listVotes: vi.fn().mockResolvedValue([
        { id: 10, studentId: 2, studentNumber: "20240002", studentName: "Ana", studentEmail: "ana@gmail.com", submissionId: 1, submissionName: "Projeto A", createdAt: new Date().toISOString() }
      ])
    };

    const result = await new GetAdminVotesOverview(repository).execute();

    expect(result.projects).toHaveLength(1);
    expect(result.votes).toHaveLength(1);
  });
});

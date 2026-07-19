import { describe, expect, it, vi } from "vitest";
import {
  GetAdminVotesOverview,
  GetPublicLiveVotesOverview,
  sortProjectVoteSummaries,
  type AdminVotesRepository,
} from "./admin-votes";

const baseProject = {
  detailPath: "/projeto/projeto-a-1",
  pageViews: 10,
  uniqueVisitors: 7,
  authenticatedVisitors: 4,
};

describe("GetAdminVotesOverview", () => {
  it("agrega projetos e votos para o admin", async () => {
    const repository: AdminVotesRepository = {
      listProjectSummaries: vi.fn().mockResolvedValue([
        { id: 1, name: "Projeto A", type: "PROJECT", votes: 4, score: 4, comments: 2, averageRating: 4.5, ...baseProject }
      ]),
      listVotes: vi.fn().mockResolvedValue([
        { id: 10, studentId: 2, studentNumber: "20240002", studentName: "Ana", studentEmail: "ana@gmail.com", studentCourse: "Engenharia Informatica", submissionId: 1, submissionName: "Projeto A", createdAt: new Date().toISOString() }
      ]),
      listCourseSummaries: vi.fn().mockResolvedValue([
        { course: "Engenharia Informatica", votes: 4, students: 4, recentVotes: 1, lastVoteAt: new Date().toISOString() }
      ])
    };

    const result = await new GetAdminVotesOverview(repository).execute();

    expect(result.projects).toHaveLength(1);
    expect(result.votes).toHaveLength(1);
  });
});

describe("sortProjectVoteSummaries", () => {
  it("orders project results by audited points before vote count", () => {
    const result = [
      { id: 1, name: "Mais votos", type: "PROJECT", votes: 30, score: 30, comments: 0, averageRating: 0, ...baseProject },
      { id: 2, name: "Mais pontos", type: "PROJECT", votes: 8, score: 120, comments: 0, averageRating: 0, ...baseProject },
      { id: 3, name: "Empate", type: "PROJECT", votes: 20, score: 30, comments: 0, averageRating: 0, ...baseProject },
    ].sort(sortProjectVoteSummaries);

    expect(result.map((project) => project.name)).toEqual([
      "Mais pontos",
      "Mais votos",
      "Empate",
    ]);
  });
});

describe("GetPublicLiveVotesOverview", () => {
  it("gera painel publico sem expor identidade individual", async () => {
    const repository: AdminVotesRepository = {
      listProjectSummaries: vi.fn().mockResolvedValue([
        { id: 1, name: "Projeto A", type: "PROJECT", votes: 6, score: 8, comments: 2, averageRating: 4.5, ...baseProject },
        { id: 2, name: "Projeto B", type: "PROJECT", votes: 3, score: 20, comments: 1, averageRating: 4.1, detailPath: "/projeto/projeto-b-2", pageViews: 5, uniqueVisitors: 3, authenticatedVisitors: 2 },
      ]),
      listVotes: vi.fn().mockResolvedValue([
        { id: 99, studentId: 9, studentNumber: "20249999", studentName: "Historico", studentEmail: "historico@gmail.com", studentCourse: "Gestao", submissionId: 2, submissionName: "Projeto B", createdAt: new Date().toISOString() },
      ]),
      listRecentVotes: vi.fn().mockResolvedValue([
        { id: 10, studentId: 2, studentNumber: "20240002", studentName: "Ana", studentEmail: "ana@gmail.com", studentCourse: "Engenharia Informatica", submissionId: 1, submissionName: "Projeto A", createdAt: new Date().toISOString() },
      ]),
      listCourseSummaries: vi.fn().mockResolvedValue([
        { course: "Engenharia Informatica", votes: 6, students: 4, recentVotes: 1, lastVoteAt: new Date().toISOString() },
      ])
    };

    const result = await new GetPublicLiveVotesOverview(repository).execute();

    expect(result.totals.votes).toBe(9);
    expect(result.totals.score).toBe(28);
    expect(result.leader?.name).toBe("Projeto B");
    expect(result.leader?.share).toBe(71);
    expect(repository.listRecentVotes).toHaveBeenCalledWith(120);
    expect(result.moments[0]).toEqual(expect.objectContaining({
      course: "Engenharia Informatica",
      project: "Projeto A",
    }));
    expect(JSON.stringify(result)).not.toContain("20240002");
    expect(JSON.stringify(result)).not.toContain("ana@gmail.com");
    expect(JSON.stringify(result)).not.toContain("Ana");
  });
});

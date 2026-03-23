import { describe, expect, it } from "vitest";
import type { CreateSubmissionInput, SubmissionRepository } from "../domain/submission.repository";
import type { Submission, SubmissionStatus, SubmissionSummary, SubmissionType } from "../domain/submission";
import { ClearWinnerSubmission } from "./clear-winner";
import { DEFAULT_SUBMISSION_PRIMARY_COLOR, DEFAULT_SUBMISSION_SECONDARY_COLOR } from "../domain/submission-format";

class InMemorySubmissionRepo implements SubmissionRepository {
  constructor(public items: Submission[]) {}
  async create(_data: CreateSubmissionInput): Promise<Submission> { throw new Error("not implemented"); }
  async findById(id: number): Promise<Submission | null> { return this.items.find((item) => item.id === id) ?? null; }
  async findByReference(_ref: string): Promise<Submission | null> { return null; }
  async list(_status?: SubmissionStatus, _type?: SubmissionType): Promise<Submission[]> { return this.items; }
  async summary(_id: number): Promise<SubmissionSummary | null> { return null; }
  async setStatus(_id: number, _status: SubmissionStatus): Promise<void> { return; }
  async setWinner(_id: number): Promise<void> { return; }
  async clearWinners(): Promise<void> {
    this.items = this.items.map((item) => ({ ...item, isWinner: false, winnerSelectedAt: null }));
  }
  async hasDuplicate(): Promise<boolean> { return false; }
}

describe("ClearWinnerSubmission", () => {
  it("remove a classificação de vencedor", async () => {
    const repo = new InMemorySubmissionRepo([
      {
        id: 1,
        referenceCode: "UOR-2026-0001",
        type: "PROJECT",
        status: "APPROVED",
        name: "Projeto",
        description: "Descricao",
        area: "Tecnologia",
        course: null,
        stage: null,
        category: null,
        productType: null,
        teamSize: 2,
        members: ["A", "B"],
        leaderName: "Ana",
        leaderPhone: "+244 934567890",
        leaderEmail: "submission-244934567890@uor-connect.local",
        needs: [],
        paymentProof: "ok",
        paymentConfirmed: true,
        repoUrl: null,
        websiteUrl: null,
        observations: null,
        agreeRules: true,
        primaryColor: DEFAULT_SUBMISSION_PRIMARY_COLOR,
        secondaryColor: DEFAULT_SUBMISSION_SECONDARY_COLOR,
        bannerUrl: null,
        isWinner: true,
        winnerSelectedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    const useCase = new ClearWinnerSubmission(repo);
    await useCase.execute();

    expect(repo.items[0].isWinner).toBe(false);
    expect(repo.items[0].winnerSelectedAt).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { CreateSubmissionInput, SubmissionRepository } from "../domain/submission.repository";
import type { Submission, SubmissionStatus, SubmissionSummary, SubmissionType } from "../domain/submission";
import { SelectWinnerSubmission } from "./select-winner";
import { DEFAULT_SUBMISSION_PRIMARY_COLOR, DEFAULT_SUBMISSION_SECONDARY_COLOR } from "../domain/submission-format";

class InMemorySubmissionRepo implements SubmissionRepository {
  items: Submission[] = [];

  constructor(items: Submission[]) {
    this.items = items;
  }

  async create(data: CreateSubmissionInput): Promise<Submission> {
    const submission: Submission = {
      id: this.items.length + 1,
      referenceCode: `UOR-2026-${String(this.items.length + 1).padStart(4, "0")}`,
      type: data.type,
      status: "PENDING",
      name: data.name,
      description: data.description,
      area: data.area,
      course: data.course,
      stage: data.stage,
      category: data.category,
      productType: data.productType,
      teamSize: data.members.length,
      members: data.members,
      leaderName: data.leaderName,
      leaderPhone: data.leaderPhone,
      leaderEmail: data.leaderEmail ?? null,
      needs: data.needs,
      paymentProof: data.paymentProof,
      paymentConfirmed: data.paymentConfirmed,
      repoUrl: data.repoUrl,
      websiteUrl: data.websiteUrl,
      observations: data.observations ?? null,
      agreeRules: data.agreeRules,
      primaryColor: data.primaryColor ?? DEFAULT_SUBMISSION_PRIMARY_COLOR,
      secondaryColor: data.secondaryColor ?? DEFAULT_SUBMISSION_SECONDARY_COLOR,
      bannerUrl: data.bannerUrl ?? null,
      isWinner: false,
      winnerSelectedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.items.push(submission);
    return submission;
  }

  async findById(id: number): Promise<Submission | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async findByReference(ref: string): Promise<Submission | null> {
    return this.items.find((item) => item.referenceCode === ref) ?? null;
  }

  async list(status?: SubmissionStatus, type?: SubmissionType): Promise<Submission[]> {
    return this.items.filter((item) => (status ? item.status === status : true) && (type ? item.type === type : true));
  }

  async summary(): Promise<SubmissionSummary | null> {
    return null;
  }

  async setStatus(id: number, status: SubmissionStatus): Promise<void> {
    this.items = this.items.map((item) => item.id === id ? { ...item, status } : item);
  }

  async setWinner(id: number): Promise<void> {
    this.items = this.items.map((item) => ({
      ...item,
      isWinner: item.id === id,
      winnerSelectedAt: item.id === id ? new Date("2026-03-21T00:00:00.000Z") : null
    }));
  }

  async clearWinners(): Promise<void> {
    this.items = this.items.map((item) => ({ ...item, isWinner: false, winnerSelectedAt: null }));
  }

  async hasDuplicate(): Promise<boolean> {
    return false;
  }
}

function makeSubmission(id: number, status: SubmissionStatus = "APPROVED"): Submission {
  return {
    id,
    referenceCode: `UOR-2026-${String(id).padStart(4, "0")}`,
    type: "PROJECT",
    status,
    name: `Project ${id}`,
    description: "Descricao do projeto",
    area: "Tecnologia",
    course: null,
    stage: null,
    category: null,
    productType: null,
    teamSize: 3,
    members: ["A", "B", "C"],
    leaderName: "Teste",
    leaderPhone: "+244 923456789",
    leaderEmail: "submission-244923456789@uor-connect.local",
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
    isWinner: false,
    winnerSelectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe("SelectWinnerSubmission", () => {
  it("marca apenas um projeto aprovado como vencedor", async () => {
    const repo = new InMemorySubmissionRepo([makeSubmission(1), makeSubmission(2)]);
    const useCase = new SelectWinnerSubmission(repo);

    await useCase.execute(2);

    expect(repo.items.find((item) => item.id === 1)?.isWinner).toBe(false);
    expect(repo.items.find((item) => item.id === 2)?.isWinner).toBe(true);
  });

  it("rejeita submissão não aprovada", async () => {
    const repo = new InMemorySubmissionRepo([makeSubmission(1, "PENDING")]);
    const useCase = new SelectWinnerSubmission(repo);

    await expect(useCase.execute(1)).rejects.toThrow("Only approved submissions can be winners");
  });
});

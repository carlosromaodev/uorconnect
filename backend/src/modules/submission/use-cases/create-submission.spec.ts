import { describe, it, expect, beforeEach } from "vitest";
import type { CreateSubmissionInput, SubmissionRepository } from "../domain/submission.repository";
import type { Submission, SubmissionStatus, SubmissionType } from "../domain/submission";
import { CreateSubmission } from "./create-submission";
import { DEFAULT_SUBMISSION_PRIMARY_COLOR, DEFAULT_SUBMISSION_SECONDARY_COLOR } from "../domain/submission-format";

class InMemorySubmissionRepo implements SubmissionRepository {
  items: Submission[] = [];

  async create(data: CreateSubmissionInput & { referenceCode?: string }): Promise<Submission> {
    const submission: Submission = {
      id: this.items.length + 1,
      referenceCode: data.referenceCode ?? `UOR-2026-${(this.items.length + 1).toString().padStart(4, "0")}`,
      status: "PENDING",
      type: data.type,
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

  async findById(id: number) { return this.items.find((i) => i.id === id) ?? null; }
  async findByReference(ref: string) { return this.items.find((i) => i.referenceCode === ref) ?? null; }
  async list(status?: SubmissionStatus, type?: SubmissionType) {
    return this.items.filter((i) => (status ? i.status === status : true) && (type ? i.type === type : true));
  }
  async summary() { return null; }
  async setStatus() { return; }
  async setWinner() { return; }
  async clearWinners() { return; }
  async hasDuplicate(name: string, leaderPhone: string) {
    return this.items.some((i) => i.name === name && i.leaderPhone === leaderPhone);
  }
}

const basePayload: CreateSubmissionInput = {
  type: "PROJECT",
  name: "Sistema IoT",
  description: "Projeto de monitoramento com IoT e dashboards.",
  area: "Tecnologia",
  course: "Eng. Telecomunicações",
  members: ["Ana", "Bruno", "Carla"],
  leaderName: "Ana Silva",
  leaderPhone: "+244 912345678",
  needs: ["Tomada elétrica", "Ligação internet"],
  paymentProof: "comprovativo.pdf",
  paymentConfirmed: true,
  repoUrl: "https://github.com/org/projeto",
  websiteUrl: "https://example.com",
  agreeRules: true
};

describe("CreateSubmission", () => {
  let repo: InMemorySubmissionRepo;
  let useCase: CreateSubmission;

  beforeEach(() => {
    repo = new InMemorySubmissionRepo();
    useCase = new CreateSubmission(repo);
  });

  it("gera referência e cria submissão", async () => {
    const result = await useCase.execute(basePayload);
    expect(result.referenceCode).toMatch(/^UOR-2026-/);
    expect(result.teamSize).toBe(3);
    expect(repo.items).toHaveLength(1);
  });

  it("não permite duplicar nome + telefone líder", async () => {
    await useCase.execute(basePayload);
    await expect(useCase.execute(basePayload)).rejects.toThrow("Submission already exists");
  });
});

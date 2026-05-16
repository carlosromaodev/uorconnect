import { beforeEach, describe, expect, it } from "vitest";
import type { Submission, SubmissionConfig, SubmissionStatus } from "../domain/submission";
import type { SubmissionAdminRepository, SubmissionConfigInput, SubmissionConfigRepository, SubmissionPresentationInput } from "./manage-submissions";
import { DeleteSubmission, GetSubmissionConfig, ListDetailedSubmissions, UpdateSubmissionConfig, UpdateSubmissionPresentation, UpdateSubmissionStatus } from "./manage-submissions";
import { DEFAULT_SUBMISSION_PRIMARY_COLOR, DEFAULT_SUBMISSION_SECONDARY_COLOR } from "../domain/submission-format";

class InMemorySubmissionAdminRepository implements SubmissionAdminRepository {
  items: Submission[] = [];

  async list(status?: SubmissionStatus) {
    return this.items.filter((item) => (status ? item.status === status : true));
  }

  async findById(id: number) {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async setStatus(id: number, status: SubmissionStatus) {
    this.items = this.items.map((item) => item.id === id ? { ...item, status } : item);
  }

  async updatePresentation(id: number, data: SubmissionPresentationInput) {
    const existing = await this.findById(id);
    if (!existing) throw new Error("Submission not found");

    const updated = {
      ...existing,
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.repoUrl !== undefined ? { repoUrl: data.repoUrl } : {}),
      ...(data.websiteUrl !== undefined ? { websiteUrl: data.websiteUrl } : {}),
      ...(data.instagramUrl !== undefined ? { instagramUrl: data.instagramUrl } : {}),
      ...(data.facebookUrl !== undefined ? { facebookUrl: data.facebookUrl } : {}),
      ...(data.linkedinUrl !== undefined ? { linkedinUrl: data.linkedinUrl } : {}),
      ...(data.githubUrl !== undefined ? { githubUrl: data.githubUrl } : {}),
      ...(data.primaryColor ? { primaryColor: data.primaryColor } : {}),
      ...(data.secondaryColor ? { secondaryColor: data.secondaryColor } : {}),
      ...(data.bannerUrl !== undefined ? { bannerUrl: data.bannerUrl } : {})
    };

    this.items = this.items.map((item) => item.id === id ? updated : item);
    return updated;
  }

  async deleteWithRelations(id: number) {
    this.items = this.items.filter((item) => item.id !== id);
  }
}

class InMemorySubmissionConfigRepository implements SubmissionConfigRepository {
  config: SubmissionConfig = {
    key: "default",
    isOpen: true,
    iban: "AO006",
    accountName: "Universidade",
    paymentAmount: "3.500 Kz",
    paymentInstructions: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  async getConfig() {
    return this.config;
  }

  async updateConfig(data: SubmissionConfigInput) {
    this.config = { ...this.config, ...data, updatedAt: new Date() };
    return this.config;
  }
}

function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 1,
    referenceCode: "UOR-2026-ABCD1234",
    type: "PROJECT",
    status: "PENDING",
    name: "Projeto A",
    description: "Descricao valida para o projeto A.",
    area: "Tecnologia",
    course: "Eng. Informática",
    stage: null,
    category: null,
    productType: null,
    teamSize: 2,
    members: ["Ana", "Bruno"],
    leaderName: "Ana Silva",
    leaderPhone: "+244 912345678",
    leaderEmail: "submission-244912345678@uor-connect.local",
    needs: ["Tomada elétrica"],
    paymentProof: "TRANSFERENCIA_CONFIRMADA",
    paymentConfirmed: true,
    repoUrl: null,
    websiteUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    linkedinUrl: null,
    githubUrl: null,
    observations: null,
    agreeRules: true,
    primaryColor: DEFAULT_SUBMISSION_PRIMARY_COLOR,
    secondaryColor: DEFAULT_SUBMISSION_SECONDARY_COLOR,
    bannerUrl: null,
    isWinner: false,
    winnerSelectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe("submission admin use cases", () => {
  let submissionRepository: InMemorySubmissionAdminRepository;
  let configRepository: InMemorySubmissionConfigRepository;

  beforeEach(() => {
    submissionRepository = new InMemorySubmissionAdminRepository();
    submissionRepository.items = [makeSubmission()];
    configRepository = new InMemorySubmissionConfigRepository();
  });

  it("lista candidaturas detalhadas", async () => {
    const result = await new ListDetailedSubmissions(submissionRepository).execute();
    expect(result).toHaveLength(1);
  });

  it("atualiza estado de candidatura existente", async () => {
    await new UpdateSubmissionStatus(submissionRepository).execute(1, "APPROVED");
    expect(submissionRepository.items[0]?.status).toBe("APPROVED");
  });

  it("falha ao atualizar candidatura inexistente", async () => {
    await expect(new UpdateSubmissionStatus(submissionRepository).execute(99, "APPROVED")).rejects.toThrow("Submission not found");
  });

  it("atualiza a apresentação visual da candidatura", async () => {
    const updated = await new UpdateSubmissionPresentation(submissionRepository).execute(1, {
      primaryColor: "#0f766e",
      secondaryColor: "#f59e0b",
      bannerUrl: "https://example.com/banner.jpg"
    });

    expect(updated.primaryColor).toBe("#0f766e");
    expect(updated.bannerUrl).toBe("https://example.com/banner.jpg");
  });

  it("atualiza detalhes públicos sem reabrir a submissão", async () => {
    submissionRepository.items = [makeSubmission({ status: "APPROVED" })];

    const updated = await new UpdateSubmissionPresentation(submissionRepository).execute(1, {
      description: "Descrição pública atualizada para orientar visitantes e jurados.",
      repoUrl: "https://github.com/uor/project",
      websiteUrl: "https://project.uorconnect.space",
      instagramUrl: "https://instagram.com/project",
      facebookUrl: null,
      linkedinUrl: "https://linkedin.com/company/project",
      githubUrl: "https://github.com/uor/project",
    });

    expect(updated.status).toBe("APPROVED");
    expect(updated.description).toContain("Descrição pública atualizada");
    expect(updated.websiteUrl).toBe("https://project.uorconnect.space");
    expect(updated.instagramUrl).toBe("https://instagram.com/project");
    expect(updated.facebookUrl).toBeNull();
  });

  it("remove a candidatura existente", async () => {
    await new DeleteSubmission(submissionRepository).execute(1);
    expect(submissionRepository.items).toHaveLength(0);
  });

  it("lê e atualiza configuração de candidatura", async () => {
    const getUseCase = new GetSubmissionConfig(configRepository);
    const updateUseCase = new UpdateSubmissionConfig(configRepository);

    expect((await getUseCase.execute()).isOpen).toBe(true);
    const updated = await updateUseCase.execute({
      isOpen: false,
      iban: "AO00999",
      accountName: "Conta Nova",
      paymentAmount: "25.000 Kz",
      paymentInstructions: "Nova instrução"
    });

    expect(updated.isOpen).toBe(false);
    expect(updated.iban).toBe("AO00999");
  });
});

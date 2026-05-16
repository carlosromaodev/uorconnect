import type { Submission, SubmissionConfig, SubmissionStatus } from "../domain/submission";

export interface SubmissionAdminRepository {
  list(status?: SubmissionStatus, type?: Submission["type"]): Promise<Submission[]>;
  findById(id: number): Promise<Submission | null>;
  setStatus(id: number, status: SubmissionStatus): Promise<void>;
  updatePresentation(id: number, data: SubmissionPresentationInput): Promise<Submission>;
  deleteWithRelations(id: number): Promise<void>;
}

export interface SubmissionConfigRepository {
  getConfig(): Promise<SubmissionConfig>;
  updateConfig(data: SubmissionConfigInput): Promise<SubmissionConfig>;
}

export type SubmissionConfigInput = {
  isOpen: boolean;
  iban: string;
  accountName: string;
  paymentAmount: string;
  paymentInstructions?: string | null;
  projectCommunityUrl?: string | null;
  businessCommunityUrl?: string | null;
  productCommunityUrl?: string | null;
};

export type SubmissionPresentationInput = {
  description?: string;
  repoUrl?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  bannerUrl?: string | null;
};

export class ListDetailedSubmissions {
  constructor(private readonly submissionRepository: SubmissionAdminRepository) {}

  async execute(status?: SubmissionStatus, type?: Submission["type"]) {
    return this.submissionRepository.list(status, type);
  }
}

export class UpdateSubmissionStatus {
  constructor(private readonly submissionRepository: SubmissionAdminRepository) {}

  async execute(id: number, status: SubmissionStatus) {
    const existing = await this.submissionRepository.findById(id);
    if (!existing) throw new Error("Submission not found");
    await this.submissionRepository.setStatus(id, status);
  }
}

export class UpdateSubmissionPresentation {
  constructor(private readonly submissionRepository: SubmissionAdminRepository) {}

  async execute(id: number, data: SubmissionPresentationInput) {
    const existing = await this.submissionRepository.findById(id);
    if (!existing) throw new Error("Submission not found");
    return this.submissionRepository.updatePresentation(id, data);
  }
}

export class DeleteSubmission {
  constructor(private readonly submissionRepository: SubmissionAdminRepository) {}

  async execute(id: number) {
    const existing = await this.submissionRepository.findById(id);
    if (!existing) throw new Error("Submission not found");
    await this.submissionRepository.deleteWithRelations(id);
  }
}

export class GetSubmissionConfig {
  constructor(private readonly submissionConfigRepository: SubmissionConfigRepository) {}

  async execute() {
    return this.submissionConfigRepository.getConfig();
  }
}

export class UpdateSubmissionConfig {
  constructor(private readonly submissionConfigRepository: SubmissionConfigRepository) {}

  async execute(data: SubmissionConfigInput) {
    return this.submissionConfigRepository.updateConfig(data);
  }
}

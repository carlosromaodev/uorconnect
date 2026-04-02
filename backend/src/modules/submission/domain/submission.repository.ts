import type { Submission, SubmissionConfig, SubmissionSummary, SubmissionStatus, SubmissionType } from "./submission";

export type CreateSubmissionInput = {
  type: SubmissionType;
  studentId?: number | null;
  studentNumberSnapshot?: string | null;
  name: string;
  description: string;
  area: string;
  course?: string | null;
  stage?: string | null;
  category?: string | null;
  productType?: string | null;
  members: string[];
  leaderName: string;
  leaderPhone: string;
  leaderEmail?: string | null;
  needs: string[];
  paymentProof: string;
  paymentConfirmed: boolean;
  repoUrl?: string | null;
  websiteUrl?: string | null;
  observations?: string | null;
  agreeRules: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  bannerUrl?: string | null;
  referenceCode?: string;
};

export interface SubmissionRepository {
  create(data: CreateSubmissionInput): Promise<Submission>;
  findById(id: number): Promise<Submission | null>;
  findOwnedById(id: number, studentId: number): Promise<Submission | null>;
  findByReference(ref: string): Promise<Submission | null>;
  list(status?: SubmissionStatus, type?: SubmissionType): Promise<Submission[]>;
  listByStudent(studentId: number): Promise<Submission[]>;
  summary(id: number): Promise<SubmissionSummary | null>;
  setStatus(id: number, status: SubmissionStatus): Promise<void>;
  setWinner(id: number): Promise<void>;
  clearWinners(): Promise<void>;
  hasDuplicate(name: string, leaderPhone: string): Promise<boolean>;
  updateOwnedSubmission(id: number, studentId: number, data: Omit<CreateSubmissionInput, "referenceCode">): Promise<Submission>;
}

export interface VoteRepository {
  vote(submissionId: number, email: string): Promise<void>;
  count(submissionId: number): Promise<number>;
  hasVoted(submissionId: number, email: string): Promise<boolean>;
}

export interface ReviewRepository {
  upsert(submissionId: number, email: string, rating: number, comment?: string): Promise<void>;
  average(submissionId: number): Promise<number>;
  list(submissionId: number): Promise<{ user: string; rating: number; comment?: string | null; createdAt: Date }[]>;
}

export type { SubmissionStatus, SubmissionType, SubmissionSummary, SubmissionConfig } from "./submission";

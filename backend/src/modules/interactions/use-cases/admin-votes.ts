export type AdminProjectVoteSummary = {
  id: number;
  name: string;
  type: string;
  votes: number;
  comments: number;
  averageRating: number;
};

export type AdminVoteEntry = {
  id: number;
  studentId: number;
  studentNumber: string;
  studentName: string | null;
  studentEmail: string | null;
  submissionId: number;
  submissionName: string;
  createdAt: string;
};

export interface AdminVotesRepository {
  listProjectSummaries(): Promise<AdminProjectVoteSummary[]>;
  listVotes(): Promise<AdminVoteEntry[]>;
}

export class GetAdminVotesOverview {
  constructor(private readonly adminVotesRepository: AdminVotesRepository) {}

  async execute() {
    const [projects, votes] = await Promise.all([
      this.adminVotesRepository.listProjectSummaries(),
      this.adminVotesRepository.listVotes()
    ]);

    return { projects, votes };
  }
}

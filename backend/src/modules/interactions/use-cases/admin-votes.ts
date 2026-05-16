export type AdminProjectVoteSummary = {
  id: number;
  name: string;
  detailPath: string;
  type: string;
  votes: number;
  score: number;
  comments: number;
  averageRating: number;
  pageViews: number;
  uniqueVisitors: number;
  authenticatedVisitors: number;
};

export type AdminVoteEntry = {
  id: number;
  studentId: number;
  studentNumber: string;
  studentName: string | null;
  studentEmail: string | null;
  studentCourse: string | null;
  submissionId: number;
  submissionName: string;
  createdAt: string;
};

export type AdminVoteCourseSummary = {
  course: string;
  votes: number;
  students: number;
  recentVotes: number;
  lastVoteAt: string | null;
};

export type PublicLiveVoteProject = AdminProjectVoteSummary & {
  rank: number;
  share: number;
  recentVotes: number;
};

export type PublicLiveVoteMoment = {
  id: number;
  course: string;
  project: string;
  createdAt: string;
};

export type PublicLiveVotesOverview = {
  generatedAt: string;
  totals: {
    votes: number;
    projects: number;
    activeCourses: number;
    recentVotes: number;
    pageViews: number;
    uniqueVisitors: number;
    authenticatedVisitors: number;
    score: number;
  };
  leader: PublicLiveVoteProject | null;
  projects: PublicLiveVoteProject[];
  courses: AdminVoteCourseSummary[];
  moments: PublicLiveVoteMoment[];
};

export interface AdminVotesRepository {
  listProjectSummaries(): Promise<AdminProjectVoteSummary[]>;
  listVotes(): Promise<AdminVoteEntry[]>;
  listRecentVotes?(limit?: number): Promise<AdminVoteEntry[]>;
  listCourseSummaries(): Promise<AdminVoteCourseSummary[]>;
}

export class GetAdminVotesOverview {
  constructor(private readonly adminVotesRepository: AdminVotesRepository) {}

  async execute() {
    const [projects, votes, courses] = await Promise.all([
      this.adminVotesRepository.listProjectSummaries(),
      this.adminVotesRepository.listVotes(),
      this.adminVotesRepository.listCourseSummaries(),
    ]);

    return { projects, votes, courses };
  }
}

export class GetPublicLiveVotesOverview {
  constructor(private readonly adminVotesRepository: AdminVotesRepository) {}

  async execute(): Promise<PublicLiveVotesOverview> {
    const recentVotesLoader = this.adminVotesRepository.listRecentVotes?.bind(this.adminVotesRepository);
    const [projects, votes, courses] = await Promise.all([
      this.adminVotesRepository.listProjectSummaries(),
      recentVotesLoader ? recentVotesLoader(120) : this.adminVotesRepository.listVotes(),
      this.adminVotesRepository.listCourseSummaries(),
    ]);

    const totalVotes = projects.reduce((sum, project) => sum + project.votes, 0);
    const totalScore = projects.reduce((sum, project) => sum + project.score, 0);
    const recentCutoff = Date.now() - 5 * 60 * 1000;
    const recentVotesByProject = votes.reduce<Map<number, number>>((acc, vote) => {
      const createdAt = new Date(vote.createdAt).getTime();
      if (!Number.isFinite(createdAt) || createdAt < recentCutoff) return acc;
      acc.set(vote.submissionId, (acc.get(vote.submissionId) ?? 0) + 1);
      return acc;
    }, new Map());

    const rankedProjects = projects
      .slice()
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (right.votes !== left.votes) return right.votes - left.votes;
        if (right.authenticatedVisitors !== left.authenticatedVisitors) return right.authenticatedVisitors - left.authenticatedVisitors;
        if (right.uniqueVisitors !== left.uniqueVisitors) return right.uniqueVisitors - left.uniqueVisitors;
        return left.name.localeCompare(right.name);
      })
      .map<PublicLiveVoteProject>((project, index) => ({
        ...project,
        rank: index + 1,
        share: totalScore > 0 ? Math.round((project.score / totalScore) * 100) : 0,
        recentVotes: recentVotesByProject.get(project.id) ?? 0,
      }));

    return {
      generatedAt: new Date().toISOString(),
      totals: {
        votes: totalVotes,
        score: totalScore,
        projects: projects.length,
        activeCourses: courses.length,
        recentVotes: votes.filter((vote) => {
          const createdAt = new Date(vote.createdAt).getTime();
          return Number.isFinite(createdAt) && createdAt >= recentCutoff;
        }).length,
        pageViews: projects.reduce((sum, project) => sum + project.pageViews, 0),
        uniqueVisitors: projects.reduce((sum, project) => sum + project.uniqueVisitors, 0),
        authenticatedVisitors: projects.reduce((sum, project) => sum + project.authenticatedVisitors, 0),
      },
      leader: rankedProjects[0] ?? null,
      projects: rankedProjects,
      courses: courses.slice(0, 8),
      moments: votes.slice(0, 10).map((vote) => ({
        id: vote.id,
        course: vote.studentCourse?.trim() || "Curso por confirmar",
        project: vote.submissionName,
        createdAt: vote.createdAt,
      })),
    };
  }
}

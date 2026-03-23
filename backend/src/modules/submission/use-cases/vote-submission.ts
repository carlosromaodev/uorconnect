import type { SubmissionRepository, VoteRepository } from "../domain/submission.repository";

export class VoteSubmission {
  constructor(private readonly submissions: SubmissionRepository, private readonly votes: VoteRepository) {}

  async execute(submissionId: number, email: string) {
    const submission = await this.submissions.findById(submissionId);
    if (!submission) throw new Error("Submission not found");
    if (submission.status !== "APPROVED") throw new Error("Submission not approved for voting");

    const already = await this.votes.hasVoted(submissionId, email);
    if (already) throw new Error("You have already voted this submission");

    await this.votes.vote(submissionId, email);
  }
}

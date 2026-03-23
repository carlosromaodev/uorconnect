import type { SubmissionRepository } from "../domain/submission.repository";
import { isCompetitionEligible } from "../domain/submission-policy";

export class SelectWinnerSubmission {
  constructor(private readonly submissions: SubmissionRepository) {}

  async execute(submissionId: number) {
    const submission = await this.submissions.findById(submissionId);
    if (!submission) throw new Error("Submission not found");
    if (submission.status !== "APPROVED") throw new Error("Only approved submissions can be winners");
    if (!isCompetitionEligible(submission.type, submission.area)) {
      throw new Error("Only academic projects can compete for the prize");
    }

    await this.submissions.setWinner(submissionId);
  }
}

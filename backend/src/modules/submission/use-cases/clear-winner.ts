import type { SubmissionRepository } from "../domain/submission.repository";

export class ClearWinnerSubmission {
  constructor(private readonly submissions: SubmissionRepository) {}

  async execute() {
    await this.submissions.clearWinners();
  }
}

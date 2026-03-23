import type { ReviewRepository, SubmissionRepository } from "../domain/submission.repository";

export class ReviewSubmission {
  constructor(private readonly submissions: SubmissionRepository, private readonly reviews: ReviewRepository) {}

  async execute(submissionId: number, email: string, rating: number, comment?: string) {
    const submission = await this.submissions.findById(submissionId);
    if (!submission) throw new Error("Submission not found");
    if (submission.status !== "APPROVED") throw new Error("Submission not approved for review");

    await this.reviews.upsert(submissionId, email, rating, comment);
  }
}

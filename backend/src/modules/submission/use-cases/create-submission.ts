import { randomUUID } from "crypto";
import type { CreateSubmissionInput, SubmissionRepository } from "../domain/submission.repository";

export class CreateSubmission {
  constructor(private readonly submissions: SubmissionRepository) {}

  async execute(input: CreateSubmissionInput) {
    const duplicate = await this.submissions.hasDuplicate(input.name, input.leaderPhone);
    if (duplicate) {
      throw new Error("Submission already exists for this contact with the same name");
    }

    const referenceCode = this.buildReference();
    return this.submissions.create({ ...input, referenceCode });
  }

  private buildReference() {
    const numeric = randomUUID().slice(0, 8).toUpperCase();
    return `UOR-2026-${numeric}`;
  }
}

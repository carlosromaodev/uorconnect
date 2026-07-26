import type { SecretariaApplication } from "../../secretaria/application/secretaria.application";
import type { SecretariaContactDetailsPatch, SecretariaGradeReviewSubmission, SecretariaPhotoInput } from "../../secretaria/domain/models";
import type { UorStudentIdentity } from "../application/ports";

export class UorStudentExternalWriteApplication {
  constructor(private readonly secretaria: SecretariaApplication) {}

  #student(student: UorStudentIdentity) {
    return { id: student.id, studentNumber: student.studentNumber };
  }

  capabilities() { return this.secretaria.capabilities(); }
  preparePaymentReference(student: UorStudentIdentity, chargeRefs: string[], idempotencyKey: string) { return this.secretaria.preparePaymentReference(this.#student(student), chargeRefs, idempotencyKey); }
  prepareContactDetails(student: UorStudentIdentity, patch: SecretariaContactDetailsPatch, idempotencyKey: string) { return this.secretaria.prepareContactDetails(this.#student(student), patch, idempotencyKey); }
  prepareContactDetailsCancellation(student: UorStudentIdentity, idempotencyKey: string) { return this.secretaria.prepareContactDetailsCancellation(this.#student(student), idempotencyKey); }
  preparePhoto(student: UorStudentIdentity, photo: SecretariaPhotoInput, idempotencyKey: string) { return this.secretaria.preparePhoto(this.#student(student), photo, idempotencyKey); }
  prepareExamRegistrationCancellation(student: UorStudentIdentity, registrationRef: string, idempotencyKey: string) { return this.secretaria.prepareExamRegistrationCancellation(this.#student(student), registrationRef, idempotencyKey); }
  prepareGradeReview(student: UorStudentIdentity, reviewRef: string, operation: SecretariaGradeReviewSubmission["operation"], justification: string, idempotencyKey: string) { return this.secretaria.prepareGradeReview(this.#student(student), reviewRef, operation, justification, idempotencyKey); }
  getCommand(student: UorStudentIdentity, commandId: string) { return this.secretaria.getCommand(this.#student(student), commandId); }
  getCommandAttempts(student: UorStudentIdentity, commandId: string) { return this.secretaria.getCommandAttempts(this.#student(student), commandId); }
  confirmCommand(student: UorStudentIdentity, commandId: string, confirmation?: Parameters<SecretariaApplication["confirmCommand"]>[2]) { return this.secretaria.confirmCommand(this.#student(student), commandId, confirmation); }
  reconcileCommand(student: UorStudentIdentity, commandId: string) { return this.secretaria.reconcileCommand(this.#student(student), commandId); }
  cancelCommand(student: UorStudentIdentity, commandId: string) { return this.secretaria.cancelCommand(this.#student(student), commandId); }
}

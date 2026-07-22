import type {
  SecretariaContactDetails,
  SecretariaContactDetailsPatch,
  SecretariaDocument,
  SecretariaCommandResult,
  SecretariaDataset,
  SecretariaExamRegistrationCancellation,
  SecretariaGradeReviewSubmission,
  SecretariaPaymentReferenceResult,
  SecretariaPhoto,
  SecretariaProfile,
  SecretariaReceiptDetail,
  SecretariaSession,
} from "./models";

export type SecretariaCredentials = { username: string; password: string };
export type SecretariaAuthenticatedSession = { session: SecretariaSession; profile: SecretariaProfile };

export interface SecretariaGateway {
  authenticate(credentials: SecretariaCredentials): Promise<SecretariaAuthenticatedSession>;
  validateSession(session: SecretariaSession): Promise<boolean>;
  getProfile(session: SecretariaSession): Promise<SecretariaProfile>;
  getContactDetails(session: SecretariaSession): Promise<SecretariaContactDetails>;
  getPhoto(session: SecretariaSession): Promise<SecretariaPhoto>;
  getConsents(session: SecretariaSession): Promise<SecretariaDataset>;
  getDataset(session: SecretariaSession, domain: string): Promise<SecretariaDataset>;
  getPaymentReferenceDocument(session: SecretariaSession, chargeRef: string): Promise<SecretariaDocument>;
  getReceipt(session: SecretariaSession, receiptRef: string): Promise<SecretariaReceiptDetail>;
  prepareContactDetails(session: SecretariaSession, patch: SecretariaContactDetailsPatch): Promise<{ patch: SecretariaContactDetailsPatch; preconditionHash: string }>;
  updateContactDetails(session: SecretariaSession, patch: SecretariaContactDetailsPatch, preconditionHash: string): Promise<SecretariaCommandResult>;
  prepareContactDetailsCancellation(session: SecretariaSession): Promise<{ preconditionHash: string }>;
  cancelContactDetailsChangeRequest(session: SecretariaSession, preconditionHash: string): Promise<SecretariaCommandResult>;
  preparePhoto(session: SecretariaSession): Promise<{ preconditionHash: string }>;
  updatePhoto(session: SecretariaSession, jpeg: Buffer, preconditionHash: string): Promise<SecretariaCommandResult>;
  prepareExamRegistrationCancellation(session: SecretariaSession, registrationRef: string): Promise<SecretariaExamRegistrationCancellation>;
  cancelExamRegistration(session: SecretariaSession, cancellation: SecretariaExamRegistrationCancellation): Promise<SecretariaCommandResult>;
  verifyExamRegistrationCancellation(session: SecretariaSession, registrationRef: string): Promise<SecretariaCommandResult | null>;
  prepareGradeReview(session: SecretariaSession, reviewRef: string, operation: SecretariaGradeReviewSubmission["operation"], justification: string): Promise<SecretariaGradeReviewSubmission>;
  submitGradeReview(session: SecretariaSession, submission: SecretariaGradeReviewSubmission): Promise<SecretariaCommandResult>;
  verifyGradeReview(session: SecretariaSession, reviewRef: string, operation?: SecretariaGradeReviewSubmission["operation"]): Promise<SecretariaCommandResult | null>;
  preparePaymentReference(session: SecretariaSession, chargeRefs: string[]): Promise<{ chargeRefs: string[] }>;
  generatePaymentReference(session: SecretariaSession, chargeRefs: string[]): Promise<SecretariaPaymentReferenceResult>;
  verifyPaymentReference(session: SecretariaSession, chargeRefs: string[]): Promise<SecretariaPaymentReferenceResult | null>;
  logout(session: SecretariaSession): Promise<void>;
}

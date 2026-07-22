import type {
  SecretariaContactDetails,
  SecretariaContactDetailsPatch,
  SecretariaCommandResult,
  SecretariaDataset,
  SecretariaPaymentReferenceResult,
  SecretariaPhoto,
  SecretariaProfile,
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
  prepareContactDetails(session: SecretariaSession, patch: SecretariaContactDetailsPatch): Promise<{ patch: SecretariaContactDetailsPatch; preconditionHash: string }>;
  updateContactDetails(session: SecretariaSession, patch: SecretariaContactDetailsPatch, preconditionHash: string): Promise<SecretariaCommandResult>;
  preparePhoto(session: SecretariaSession): Promise<{ preconditionHash: string }>;
  updatePhoto(session: SecretariaSession, jpeg: Buffer, preconditionHash: string): Promise<SecretariaCommandResult>;
  preparePaymentReference(session: SecretariaSession, chargeRefs: string[]): Promise<{ chargeRefs: string[] }>;
  generatePaymentReference(session: SecretariaSession, chargeRefs: string[]): Promise<SecretariaPaymentReferenceResult>;
  verifyPaymentReference(session: SecretariaSession, chargeRefs: string[]): Promise<SecretariaPaymentReferenceResult | null>;
  logout(session: SecretariaSession): Promise<void>;
}

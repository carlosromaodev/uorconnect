import type { SecretariaDataset, SecretariaPaymentReferenceResult, SecretariaProfile, SecretariaSession } from "./models";

export type SecretariaCredentials = { username: string; password: string };
export type SecretariaAuthenticatedSession = { session: SecretariaSession; profile: SecretariaProfile };

export interface SecretariaGateway {
  authenticate(credentials: SecretariaCredentials): Promise<SecretariaAuthenticatedSession>;
  validateSession(session: SecretariaSession): Promise<boolean>;
  getProfile(session: SecretariaSession): Promise<SecretariaProfile>;
  getDataset(session: SecretariaSession, domain: string): Promise<SecretariaDataset>;
  preparePaymentReference(session: SecretariaSession, chargeRefs: string[]): Promise<{ chargeRefs: string[] }>;
  generatePaymentReference(session: SecretariaSession, chargeRefs: string[]): Promise<SecretariaPaymentReferenceResult>;
  verifyPaymentReference(session: SecretariaSession, chargeRefs: string[]): Promise<SecretariaPaymentReferenceResult | null>;
  logout(session: SecretariaSession): Promise<void>;
}

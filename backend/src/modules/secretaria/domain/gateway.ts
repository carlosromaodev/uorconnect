import type { SecretariaDataset, SecretariaProfile, SecretariaSession } from "./models";

export type SecretariaCredentials = { username: string; password: string };
export type SecretariaAuthenticatedSession = { session: SecretariaSession; profile: SecretariaProfile };

export interface SecretariaGateway {
  authenticate(credentials: SecretariaCredentials): Promise<SecretariaAuthenticatedSession>;
  validateSession(session: SecretariaSession): Promise<boolean>;
  getProfile(session: SecretariaSession): Promise<SecretariaProfile>;
  getDataset(session: SecretariaSession, domain: string): Promise<SecretariaDataset>;
  logout(session: SecretariaSession): Promise<void>;
}

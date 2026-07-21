export type SecretariaConnectionStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "REFRESHING"
  | "REAUTH_REQUIRED"
  | "DEGRADED";

export type SecretariaCoverage = "live" | "fresh" | "stale" | "not_synced" | "unsupported" | "disabled" | "changed";

export type SecretariaStudentIdentity = { id: number; studentNumber: string };

export type SecretariaProfile = {
  studentNumber: string;
  displayName: string | null;
  email: string | null;
  course: string | null;
  birthDate: string | null;
  nationality: string | null;
  phone: string | null;
};

export type SecretariaSession = {
  cookies: Record<string, string>;
  authenticatedAt: string;
};

export type SecretariaConnectionView = {
  status: SecretariaConnectionStatus;
  connected: boolean;
  credentialStored: boolean;
  actionRequired: "none" | "connect" | "reauthenticate" | "contact_support";
  retryable: boolean;
  lastAuthenticatedAt: string | null;
  lastSuccessfulSyncAt: string | null;
};

export type SecretariaDataset = {
  domain: string;
  items: Array<Record<string, unknown>>;
  total: number;
  observedAt: string;
  coverage: SecretariaCoverage;
};

export type SecretariaSyncView = {
  id: string;
  status: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED" | "CANCELLED";
  snapshotVersion: number | null;
  domains: string[];
  completedDomains: string[];
  failedDomains: string[];
  startedAt: string;
  finishedAt: string | null;
};

export type SecretariaCapability = {
  key: string;
  mode: "read" | "write";
  status: "available" | "disabled" | "unsupported";
  description: string;
};

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

export type SecretariaCommandStatus =
  | "AWAITING_CONFIRMATION"
  | "SUBMITTING"
  | "VERIFYING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN"
  | "CANCELLED"
  | "EXPIRED";

export type SecretariaCommandView = {
  id: string;
  type: "GENERATE_PAYMENT_REFERENCE";
  risk: "MEDIUM";
  status: SecretariaCommandStatus;
  requiresConfirmation: boolean;
  confirmationExpiresAt: string | null;
  result: { items: Array<Record<string, unknown>>; observedAt: string } | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type SecretariaCommandAttemptView = {
  id: string;
  attempt: number;
  status: string;
  errorCode: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type SecretariaPaymentSelection = {
  id: string;
  idFinanceira: string;
  inputId: string;
};

export type SecretariaPaymentReferenceResult = {
  items: Array<Record<string, unknown>>;
  observedAt: string;
};

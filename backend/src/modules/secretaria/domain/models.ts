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

export type SecretariaAddress = {
  line1: string | null;
  country: string | null;
  postalCode: string | null;
  postalSuffix: string | null;
  district: string | null;
  municipality: string | null;
  parish: string | null;
  foreignCountry: string | null;
};

export type SecretariaContactDetails = {
  email: string | null;
  phone: string | null;
  mobile: string | null;
  primaryAddress: SecretariaAddress;
  secondaryAddress: SecretariaAddress;
  mailingAddress: "PRIMARY" | "SECONDARY" | null;
  editableFields: Array<"email" | "phone" | "mobile" | "primaryAddressLine" | "secondaryAddressLine" | "mailingAddress">;
  observedAt: string;
};

export type SecretariaContactDetailsPatch = {
  email?: string;
  phone?: string | null;
  mobile?: string | null;
  primaryAddressLine?: string;
  secondaryAddressLine?: string | null;
  mailingAddress?: "PRIMARY" | "SECONDARY";
};

export type SecretariaPhoto = {
  body: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/gif";
  contentLength: number;
  sha256: string;
};

export type SecretariaPhotoInput = {
  body: Buffer;
  sha256: string;
  width: number;
  height: number;
};

export type SecretariaDocument = {
  body: Buffer;
  contentType: "application/pdf";
  contentLength: number;
  sha256: string;
  filename: string;
};

export type SecretariaExamRegistrationCancellation = {
  registrationRef: string;
  preconditionHash: string;
};

export type SecretariaGradeReviewSubmission = {
  reviewRef: string;
  operation: "REVIEW" | "PROOF_COPY" | "RECONSIDERATION";
  justification: string;
  preconditionHash: string;
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
  type: "GENERATE_PAYMENT_REFERENCE" | "UPDATE_CONTACT_DETAILS" | "CANCEL_CONTACT_CHANGE_REQUEST" | "UPDATE_PHOTO" | "CANCEL_EXAM_REGISTRATION" | "SUBMIT_GRADE_REVIEW";
  risk: "LOW" | "MEDIUM" | "HIGH";
  status: SecretariaCommandStatus;
  requiresConfirmation: boolean;
  confirmationExpiresAt: string | null;
  result: SecretariaCommandResult | null;
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

export type SecretariaCommandResult = {
  items: Array<Record<string, unknown>>;
  observedAt: string;
};

export type SecretariaPaymentReferenceResult = SecretariaCommandResult;

export type SecretariaReceiptDetail = {
  receiptRef: string;
  documentKind: "PAYMENT_ITEM_DETAIL";
  officialFiscalReceipt: false;
  fields: Record<string, string | boolean | null>;
  observedAt: string;
};

export type UorStudentCoverage = "exact" | "partial" | "not_synced" | "unsupported" | "stale" | "failed";

export type UorStudentProviderStatus =
  | "connected"
  | "connecting"
  | "credentials_required"
  | "unavailable"
  | "not_connected"
  | "degraded";

export type UorStudentProviderView = {
  provider: "secretaria" | "moodle";
  status: UorStudentProviderStatus;
  connected: boolean;
  credentialStored: boolean;
  actionRequired: "none" | "provide_credentials" | "contact_support";
  retryable: boolean;
  lastAuthenticatedAt: string | null;
  lastSuccessfulSyncAt: string | null;
};

export type UorStudentDataBlock = {
  source: "secretaria_uor" | "moodle" | "uor_student";
  observedAt: string | null;
  coverage: UorStudentCoverage;
  stale: boolean;
};

export type UorStudentTodayView = {
  identity: {
    institutionCode: string;
    studentNumber: string;
    displayName: string | null;
    course: string | null;
    classCode: string | null;
    academicYear: string | null;
    academicPeriod: string | null;
    provenance: UorStudentDataBlock;
  };
  priorities: Array<{
    id: string;
    kind: "provider_action" | "stale_data";
    severity: "info" | "warning";
    title: string;
    reason: string;
    source: "uor_student";
  }>;
  academic: {
    enrollments: number | null;
    grades: number | null;
    exams: number | null;
    attendance: number | null;
    provenance: UorStudentDataBlock;
  };
  learning: {
    courses: number | null;
    materials: number | null;
    provenance: UorStudentDataBlock;
  };
  finance: {
    charges: number | null;
    references: number | null;
    payments: number | null;
    receipts: number | null;
    provenance: UorStudentDataBlock;
  };
  agenda: {
    officialExams: number | null;
    moodleDeadlines: null;
    provenance: UorStudentDataBlock;
  };
  providers: UorStudentProviderView[];
};

export type UorStudentSyncRunView = {
  id: string;
  provider: "secretaria" | "moodle";
  status: "queued" | "running" | "partial" | "completed" | "failed" | "cancelled";
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
};

export type UorStudentSyncOverview = {
  runs: UorStudentSyncRunView[];
  automatic: true;
};

export type UorStudentProfileFieldSource = "secretaria_uor" | "student" | "system" | "unknown";

export type UorStudentProfileField<T> = {
  value: T | null;
  source: UorStudentProfileFieldSource;
  observedAt: string | null;
};

export type UorStudentProfileView = {
  id: string;
  institutionCode: string;
  studentNumber: string;
  fields: {
    displayName: UorStudentProfileField<string>;
    course: UorStudentProfileField<string>;
    classCode: UorStudentProfileField<string>;
    academicYear: UorStudentProfileField<string>;
    academicPeriod: UorStudentProfileField<string>;
    email: UorStudentProfileField<string>;
    phone: UorStudentProfileField<string>;
    alternatePhone: UorStudentProfileField<string>;
    bio: UorStudentProfileField<string>;
    address: UorStudentProfileField<string>;
  };
};

export type UorStudentProfilePatch = Partial<Record<
  "email" | "phone" | "alternatePhone" | "bio" | "address",
  string | null
>>;

export type UorStudentPrivacyPurpose =
  | "public_profile"
  | "learning_recommendations"
  | "ranking_participation"
  | "notifications_sms"
  | "notifications_whatsapp"
  | "finance_reference_sharing"
  | "tutoring_data_access";

export type UorStudentPrivacyPreferenceView = {
  id: string;
  purpose: UorStudentPrivacyPurpose;
  enabled: boolean;
  policyVersion: string;
  fields: string[];
  expiresAt: string | null;
  revokedAt: string | null;
  updatedAt: string;
};

export type UorStudentDataRequestView = {
  id: string;
  type: "export" | "delete";
  status: "pending" | "processing" | "completed" | "partial" | "failed" | "cancelled";
  scope: string[];
  retentions: Array<{ category: string; retained: boolean; reason: string | null }>;
  resultAvailable: boolean;
  errorCode: string | null;
  requestedAt: string;
  completedAt: string | null;
};

export type UorStudentOfficialItem = {
  id: string;
  attributes: Record<string, unknown>;
};

export type UorStudentOfficialDatasetView = {
  domain: string;
  items: UorStudentOfficialItem[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    total: number | null;
  };
  provenance: UorStudentDataBlock;
  snapshotVersion: number | null;
};

export type UorStudentAcademicRuleView = {
  id: string;
  code: string;
  version: number;
  name: string;
  kind: string;
  formula: string;
  parameters: Record<string, unknown>;
  status: "draft" | "approved" | "retired" | "derived_method" | "hypothesis";
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  decisionSource: string | null;
};

export type UorStudentAcademicAveragesView = {
  subjects: Array<{
    subjectKey: string;
    subjectName: string;
    period: string | null;
    average: string | null;
    considered: number;
    missing: number;
  }>;
  overall: {
    average: string | null;
    consideredSubjects: number;
    missingSubjects: number;
  };
  rule: {
    code: string;
    version: number;
    status: "derived_method";
    formula: string;
  };
  inputs: Array<{
    id: string;
    subjectKey: string;
    label: string;
    score: string | null;
    weight: string;
    official: true;
  }>;
  provenance: UorStudentDataBlock;
};

export type UorStudentAcademicSimulationView = {
  id: string;
  subjectKey: string;
  period: string | null;
  status: "active" | "archived";
  rule: { code: string; version: number; status: "hypothesis" };
  scenario: Array<{ key: string; label: string; score: string | null; weight: string }>;
  result: { average: string | null; considered: number; missing: number };
  createdAt: string;
  updatedAt: string;
};

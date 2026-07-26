import type {
  UorStudentAcademicAveragesView,
  UorStudentAcademicRuleView,
  UorStudentAcademicSimulationView,
  UorStudentDataRequestView,
  UorStudentPrivacyPreferenceView,
  UorStudentPrivacyPurpose,
  UorStudentProfilePatch,
  UorStudentProfileView,
  UorStudentOfficialDatasetView,
  UorStudentSyncOverview,
  UorStudentTodayView,
} from "../domain/models";

export type UorStudentIdentity = {
  id: number;
  institutionCode: string;
  studentNumber: string;
};

export interface UorStudentPublicIdentityResolver {
  findByProfileId(input: { profileId: string; institutionCode: string }): Promise<UorStudentIdentity | null>;
}

export type UorStudentLocalState = Omit<UorStudentTodayView, "priorities" | "providers">;

export interface UorStudentReadRepository {
  getLocalState(student: UorStudentIdentity): Promise<UorStudentLocalState | null>;
  getSyncOverview(student: UorStudentIdentity): Promise<UorStudentSyncOverview>;
  getSyncRun(student: UorStudentIdentity, runId: string): Promise<import("../domain/models").UorStudentSyncRunView | null>;
}

export interface UorStudentIdentityRepository {
  getProfile(student: UorStudentIdentity): Promise<UorStudentProfileView | null>;
  updateProfile(input: { student: UorStudentIdentity; patch: UorStudentProfilePatch; traceId?: string }): Promise<UorStudentProfileView>;
  listPrivacy(student: UorStudentIdentity): Promise<UorStudentPrivacyPreferenceView[]>;
  setPrivacy(input: {
    student: UorStudentIdentity;
    purpose: UorStudentPrivacyPurpose;
    enabled: boolean;
    fields: string[];
    expiresAt: Date | null;
    traceId?: string;
  }): Promise<UorStudentPrivacyPreferenceView>;
  createDataRequest(input: {
    student: UorStudentIdentity;
    type: "export" | "delete";
    scope: string[];
    traceId?: string;
  }): Promise<UorStudentDataRequestView>;
  getDataRequest(student: UorStudentIdentity, id: string): Promise<UorStudentDataRequestView | null>;
  getExportPayload(student: UorStudentIdentity, id: string): Promise<Record<string, unknown> | null>;
  processNextDataDeletion(): Promise<boolean>;
}

export interface UorStudentOfficialDataRepository {
  getDataset(input: {
    student: UorStudentIdentity;
    domain: string;
    limit: number;
    cursor?: string;
  }): Promise<UorStudentOfficialDatasetView>;
}

export interface UorStudentApplication {
  readonly workflows?: import("../workflows/workflow-service").UorStudentWorkflowApplication;
  readonly authorizations?: import("../authorizations/authorization-service").LiveUorStudentAuthorizationApplication;
  readonly rankings?: import("../rankings/ranking-service").LiveUorStudentRankingApplication;
  readonly externalWrites?: import("../external-writes/external-write-service").UorStudentExternalWriteApplication;
  readonly insights?: import("../academics/academic-insights").LiveUorStudentAcademicInsights;
  readonly learning?: import("../learning/learning-service").UorStudentLearningApplication;
  readonly admin?: import("../admin/admin-service").UorStudentAdminApplication;
  readonly delegatedFinance?: import("../finance/delegated-finance-service").UorStudentDelegatedFinanceApplication;
  readonly stepUp?: import("../security/step-up-service").UorStudentStepUpApplication;
  readonly changes?: import("../sync/official-change-service").UorStudentOfficialChangeApplication;
  bootstrapInstitutionalLogin(input: {
    student: UorStudentIdentity;
    secretariaPassword: string;
  }): Promise<void>;
  updateMoodleCredentials(student: UorStudentIdentity, password: string): Promise<void>;
  terminateExternalSessions(student: UorStudentIdentity): Promise<import("../domain/models").UorStudentProviderView[]>;
  disconnectProvider(student: UorStudentIdentity, provider: "secretaria" | "moodle"): Promise<import("../domain/models").UorStudentProviderView[]>;
  getProfile(student: UorStudentIdentity): Promise<UorStudentProfileView>;
  updateProfile(student: UorStudentIdentity, patch: UorStudentProfilePatch, traceId?: string): Promise<UorStudentProfileView>;
  listPrivacy(student: UorStudentIdentity): Promise<UorStudentPrivacyPreferenceView[]>;
  setPrivacy(student: UorStudentIdentity, input: { purpose: UorStudentPrivacyPurpose; enabled: boolean; fields: string[]; expiresAt: Date | null }, traceId?: string): Promise<UorStudentPrivacyPreferenceView>;
  createDataRequest(student: UorStudentIdentity, input: { type: "export" | "delete"; scope: string[] }, traceId?: string): Promise<UorStudentDataRequestView>;
  getDataRequest(student: UorStudentIdentity, id: string): Promise<UorStudentDataRequestView>;
  getExportPayload(student: UorStudentIdentity, id: string): Promise<Record<string, unknown>>;
  getOfficialDataset(student: UorStudentIdentity, domain: string, page: { limit: number; cursor?: string }): Promise<UorStudentOfficialDatasetView>;
  getAcademicAverages(student: UorStudentIdentity): Promise<UorStudentAcademicAveragesView>;
  listAcademicRules(student: UorStudentIdentity): Promise<UorStudentAcademicRuleView[]>;
  createAcademicSimulation(student: UorStudentIdentity, input: import("../academics/academic-service").AcademicSimulationInput, traceId?: string): Promise<UorStudentAcademicSimulationView>;
  updateAcademicSimulation(student: UorStudentIdentity, id: string, input: import("../academics/academic-service").AcademicSimulationInput, traceId?: string): Promise<UorStudentAcademicSimulationView>;
  listAcademicSimulations(student: UorStudentIdentity, page: { limit: number; cursor?: string }): Promise<{ items: UorStudentAcademicSimulationView[]; nextCursor: string | null }>;
  calculateRequiredGrade(input: import("../academics/academic-engine").RequiredGradeInput): ReturnType<typeof import("../academics/academic-engine").calculateRequiredGrade>;
  calculateScholarshipScenario(input: Omit<import("../academics/academic-engine").RequiredGradeInput, "target">): ReturnType<import("../academics/academic-service").UorStudentAcademicApplication["scholarshipScenario"]>;
  getFinanceReceipt(student: UorStudentIdentity, receiptRef: string): ReturnType<import("../../secretaria/application/secretaria.application").SecretariaApplication["getReceipt"]>;
  getFinancePaymentReferenceDocument(student: UorStudentIdentity, chargeRef: string): ReturnType<import("../../secretaria/application/secretaria.application").SecretariaApplication["getPaymentReferenceDocument"]>;
  getProviders(student: UorStudentIdentity): Promise<import("../domain/models").UorStudentProviderView[]>;
  getSyncOverview(student: UorStudentIdentity): Promise<UorStudentSyncOverview>;
  getSyncRun(student: UorStudentIdentity, runId: string): Promise<import("../domain/models").UorStudentSyncRunView>;
  getToday(student: UorStudentIdentity): Promise<UorStudentTodayView>;
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
}

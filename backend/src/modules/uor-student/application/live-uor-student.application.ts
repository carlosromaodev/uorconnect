import type { MoodleApplication, MoodleStudentIdentity } from "../../moodle/application/ports";
import type { MoodleConnectionView } from "../../moodle/domain/models";
import type { SecretariaApplication } from "../../secretaria/application/secretaria.application";
import type { SecretariaConnectionView, SecretariaStudentIdentity } from "../../secretaria/domain/models";
import { UorStudentError } from "../domain/errors";
import type { UorStudentProviderView, UorStudentTodayView } from "../domain/models";
import type { UorStudentSyncScheduler } from "../sync/domain";
import type { UorStudentAcademicApplication } from "../academics/academic-service";
import type { UorStudentWorkflowApplication } from "../workflows/workflow-service";
import type { LiveUorStudentAuthorizationApplication } from "../authorizations/authorization-service";
import type { LiveUorStudentRankingApplication } from "../rankings/ranking-service";
import type { UorStudentExternalWriteApplication } from "../external-writes/external-write-service";
import type { LiveUorStudentAcademicInsights } from "../academics/academic-insights";
import type { UorStudentLearningApplication } from "../learning/learning-service";
import type { UorStudentAdminApplication } from "../admin/admin-service";
import type { UorStudentDelegatedFinanceApplication } from "../finance/delegated-finance-service";
import type { UorStudentStepUpApplication } from "../security/step-up-service";
import type { UorStudentOfficialChangeApplication } from "../sync/official-change-service";
import type {
  UorStudentApplication,
  UorStudentIdentity,
  UorStudentIdentityRepository,
  UorStudentOfficialDataRepository,
  UorStudentReadRepository,
} from "./ports";

export { DEFAULT_MOODLE_STUDENT_PASSWORD } from "../domain/constants";

function secretariaProvider(connection: SecretariaConnectionView): UorStudentProviderView {
  const status: UorStudentProviderView["status"] = connection.status === "CONNECTED"
    ? "connected"
    : connection.status === "CONNECTING" || connection.status === "REFRESHING"
      ? "connecting"
      : connection.status === "REAUTH_REQUIRED"
        ? "credentials_required"
        : connection.status === "DEGRADED"
          ? "degraded"
          : "not_connected";
  return {
    provider: "secretaria",
    status,
    connected: connection.connected,
    credentialStored: connection.credentialStored,
    actionRequired: connection.actionRequired === "reauthenticate" || connection.actionRequired === "connect"
      ? "provide_credentials"
      : connection.actionRequired === "contact_support" ? "contact_support" : "none",
    retryable: connection.retryable,
    lastAuthenticatedAt: connection.lastAuthenticatedAt,
    lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
  };
}

function moodleProvider(connection: MoodleConnectionView): UorStudentProviderView {
  const status: UorStudentProviderView["status"] = connection.status === "CONNECTED"
    ? "connected"
    : connection.status === "CONNECTING" || connection.status === "REFRESHING"
      ? "connecting"
      : connection.status === "REAUTH_REQUIRED"
        ? "credentials_required"
        : connection.status === "UNAVAILABLE"
          ? "unavailable"
          : connection.status === "DEGRADED"
            ? "degraded"
            : "not_connected";
  return {
    provider: "moodle",
    status,
    connected: connection.connected,
    credentialStored: connection.credentialsStored,
    actionRequired: connection.actionRequired === "reauthenticate" || connection.actionRequired === "connect"
      ? "provide_credentials"
      : connection.actionRequired === "contact_support" ? "contact_support" : "none",
    retryable: connection.retryable,
    lastAuthenticatedAt: connection.lastAuthenticatedAt,
    lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt,
  };
}

function providerPriorities(providers: UorStudentProviderView[]): UorStudentTodayView["priorities"] {
  return providers.flatMap<UorStudentTodayView["priorities"][number]>((provider) => {
    if (provider.actionRequired === "provide_credentials") {
      return [{
        id: `provider:${provider.provider}:credentials`,
        kind: "provider_action" as const,
        severity: "warning" as const,
        title: provider.provider === "moodle" ? "Atualiza a senha do Moodle" : "Volta a ligar a Secretaria",
        reason: `O provedor ${provider.provider} precisa de credenciais válidas.`,
        source: "uor_student" as const,
      }];
    }
    if (provider.status === "degraded" || provider.status === "unavailable") {
      return [{
        id: `provider:${provider.provider}:degraded`,
        kind: "stale_data" as const,
        severity: "info" as const,
        title: `${provider.provider === "moodle" ? "Moodle" : "Secretaria"} temporariamente indisponível`,
        reason: "O último dado válido permanece disponível e o backend tentará novamente de forma automática.",
        source: "uor_student" as const,
      }];
    }
    return [];
  });
}

export class LiveUorStudentApplication implements UorStudentApplication {
  constructor(
    private readonly repository: UorStudentReadRepository,
    private readonly secretaria: SecretariaApplication,
    private readonly moodle: MoodleApplication,
    private readonly syncScheduler: UorStudentSyncScheduler,
    private readonly identityRepository: UorStudentIdentityRepository,
    private readonly officialDataRepository: UorStudentOfficialDataRepository,
    private readonly academics: UorStudentAcademicApplication,
    readonly workflows?: UorStudentWorkflowApplication,
    readonly authorizations?: LiveUorStudentAuthorizationApplication,
    readonly rankings?: LiveUorStudentRankingApplication,
    readonly externalWrites?: UorStudentExternalWriteApplication,
    readonly insights?: LiveUorStudentAcademicInsights,
    readonly learning?: UorStudentLearningApplication,
    readonly admin?: UorStudentAdminApplication,
    readonly delegatedFinance?: UorStudentDelegatedFinanceApplication,
    readonly stepUp?: UorStudentStepUpApplication,
    readonly changes?: UorStudentOfficialChangeApplication,
  ) {}

  async bootstrapInstitutionalLogin(input: { student: UorStudentIdentity; secretariaPassword: string }) {
    const upstreamStudent: SecretariaStudentIdentity = {
      id: input.student.id,
      studentNumber: input.student.studentNumber,
    };
    await this.secretaria.connect(upstreamStudent, {
      username: input.student.studentNumber,
      password: input.secretariaPassword,
      rememberCredentials: true,
    });

    await this.syncScheduler.enqueueLogin(input.student);
  }

  async updateMoodleCredentials(student: UorStudentIdentity, password: string) {
    await this.moodle.connect(
      { id: student.id, studentNumber: student.studentNumber },
      { username: student.studentNumber, password, rememberCredentials: true },
    );
  }

  async terminateExternalSessions(student: UorStudentIdentity) {
    const identity = { id: student.id, studentNumber: student.studentNumber };
    await Promise.allSettled([
      this.secretaria.terminateSession(identity),
      this.moodle.terminateSession(identity),
    ]);
    return this.getProviders(student);
  }

  async disconnectProvider(student: UorStudentIdentity, provider: "secretaria" | "moodle") {
    const identity = { id: student.id, studentNumber: student.studentNumber };
    if (provider === "secretaria") await this.secretaria.disconnect(identity);
    else await this.moodle.disconnect(identity);
    return this.getProviders(student);
  }

  async getProfile(student: UorStudentIdentity) {
    const profile = await this.identityRepository.getProfile(student);
    if (!profile) throw new UorStudentError("UOR_STUDENT_NOT_FOUND", "O perfil institucional não foi encontrado.", 404);
    return profile;
  }

  updateProfile(student: UorStudentIdentity, patch: Parameters<UorStudentApplication["updateProfile"]>[1], traceId?: string) {
    return this.identityRepository.updateProfile({ student, patch, traceId });
  }

  listPrivacy(student: UorStudentIdentity) {
    return this.identityRepository.listPrivacy(student);
  }

  setPrivacy(student: UorStudentIdentity, input: Parameters<UorStudentApplication["setPrivacy"]>[1], traceId?: string) {
    return this.identityRepository.setPrivacy({ student, ...input, traceId });
  }

  createDataRequest(student: UorStudentIdentity, input: Parameters<UorStudentApplication["createDataRequest"]>[1], traceId?: string) {
    return this.identityRepository.createDataRequest({ student, ...input, traceId });
  }

  async getDataRequest(student: UorStudentIdentity, id: string) {
    const request = await this.identityRepository.getDataRequest(student, id);
    if (!request) throw new UorStudentError("UOR_STUDENT_DATA_REQUEST_NOT_FOUND", "O pedido de dados não foi encontrado.", 404);
    return request;
  }

  async getExportPayload(student: UorStudentIdentity, id: string) {
    const payload = await this.identityRepository.getExportPayload(student, id);
    if (!payload) throw new UorStudentError("UOR_STUDENT_EXPORT_NOT_FOUND", "A exportação não foi encontrada ou ainda não está disponível.", 404);
    return payload;
  }

  getOfficialDataset(student: UorStudentIdentity, domain: string, page: { limit: number; cursor?: string }) {
    return this.officialDataRepository.getDataset({ student, domain, ...page });
  }

  getAcademicAverages(student: UorStudentIdentity) {
    return this.academics.getAverages(student);
  }

  listAcademicRules(student: UorStudentIdentity) {
    return this.academics.listRules(student);
  }

  createAcademicSimulation(student: UorStudentIdentity, input: Parameters<UorStudentApplication["createAcademicSimulation"]>[1], traceId?: string) {
    return this.academics.createSimulation(student, input, traceId);
  }

  updateAcademicSimulation(student: UorStudentIdentity, id: string, input: Parameters<UorStudentApplication["updateAcademicSimulation"]>[2], traceId?: string) {
    return this.academics.updateSimulation(student, id, input, traceId);
  }

  listAcademicSimulations(student: UorStudentIdentity, page: { limit: number; cursor?: string }) {
    return this.academics.listSimulations(student, page);
  }

  calculateRequiredGrade(input: Parameters<UorStudentApplication["calculateRequiredGrade"]>[0]) {
    return this.academics.requiredGrade(input);
  }

  calculateScholarshipScenario(input: Parameters<UorStudentApplication["calculateScholarshipScenario"]>[0]) {
    return this.academics.scholarshipScenario(input);
  }

  getFinanceReceipt(student: UorStudentIdentity, receiptRef: string) {
    return this.secretaria.getReceipt({ id: student.id, studentNumber: student.studentNumber }, receiptRef);
  }

  getFinancePaymentReferenceDocument(student: UorStudentIdentity, chargeRef: string) {
    return this.secretaria.getPaymentReferenceDocument({ id: student.id, studentNumber: student.studentNumber }, chargeRef);
  }

  async getProviders(student: UorStudentIdentity) {
    const identity: MoodleStudentIdentity = { id: student.id, studentNumber: student.studentNumber };
    const [secretaria, moodle] = await Promise.all([
      this.secretaria.getConnection(identity),
      this.moodle.getConnection(identity),
    ]);
    return [secretariaProvider(secretaria), moodleProvider(moodle)];
  }

  getSyncOverview(student: UorStudentIdentity) {
    return this.repository.getSyncOverview(student);
  }

  async getSyncRun(student: UorStudentIdentity, runId: string) {
    const run = await this.repository.getSyncRun(student, runId);
    if (!run) throw new UorStudentError("UOR_STUDENT_SYNC_NOT_FOUND", "A sincronização não foi encontrada.", 404);
    return run;
  }

  async getToday(student: UorStudentIdentity) {
    const [local, providers] = await Promise.all([
      this.repository.getLocalState(student),
      this.getProviders(student),
    ]);
    if (!local) {
      throw new UorStudentError("UOR_STUDENT_NOT_FOUND", "O perfil institucional não foi encontrado.", 404);
    }
    return { ...local, providers, priorities: providerPriorities(providers) };
  }

  async start() {
    await this.syncScheduler.start();
  }

  async stop() {
    await this.syncScheduler.stop();
  }
}

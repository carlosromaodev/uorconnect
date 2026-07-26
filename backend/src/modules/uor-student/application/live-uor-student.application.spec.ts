import { describe, expect, it, vi } from "vitest";
import type { MoodleApplication } from "../../moodle/application/ports";
import type { SecretariaApplication } from "../../secretaria/application/secretaria.application";
import type { UorStudentIdentityRepository, UorStudentLocalState, UorStudentReadRepository } from "./ports";
import { LiveUorStudentApplication } from "./live-uor-student.application";

const student = { id: 42, institutionCode: "UOR", studentNumber: "20240001" };

function localState(): UorStudentLocalState {
  return {
    identity: {
      institutionCode: "UOR",
      studentNumber: "20240001",
      displayName: "Estudante Teste",
      course: "Engenharia",
      classCode: null,
      academicYear: "2025/2026",
      academicPeriod: null,
      provenance: { source: "secretaria_uor", observedAt: "2026-07-22T10:00:00.000Z", coverage: "exact", stale: false },
    },
    academic: { enrollments: null, grades: null, exams: null, attendance: null, provenance: { source: "secretaria_uor", observedAt: null, coverage: "not_synced", stale: false } },
    learning: { courses: null, materials: null, provenance: { source: "moodle", observedAt: null, coverage: "not_synced", stale: false } },
    finance: { charges: null, references: null, payments: null, receipts: null, provenance: { source: "secretaria_uor", observedAt: null, coverage: "not_synced", stale: false } },
    agenda: { officialExams: null, moodleDeadlines: null, provenance: { source: "secretaria_uor", observedAt: null, coverage: "not_synced", stale: false } },
  };
}

function setup(options: { moodleDegraded?: boolean } = {}) {
  const repository: UorStudentReadRepository = {
    getLocalState: vi.fn(async () => localState()),
    getSyncOverview: vi.fn(async () => ({ runs: [], automatic: true as const })),
    getSyncRun: vi.fn(async () => null),
  };
  const secretaria = {
    connect: vi.fn(async () => ({ connection: {}, profile: {} })),
    startSync: vi.fn(async () => ({ id: "sync-secretaria" })),
    getConnection: vi.fn(async () => ({
      status: "CONNECTED", connected: true, credentialStored: true, actionRequired: "none", retryable: false,
      lastAuthenticatedAt: "2026-07-22T10:00:00.000Z", lastSuccessfulSyncAt: null,
    })),
  } as unknown as SecretariaApplication;
  const moodle = {
    connect: vi.fn(async () => ({ connection: {}, initialSyncRunId: "sync-moodle", created: true })),
    getConnection: vi.fn(async () => ({
      status: options.moodleDegraded ? "DEGRADED" : "CONNECTED",
      connected: !options.moodleDegraded,
      credentialsStored: true,
      actionRequired: "none",
      retryable: options.moodleDegraded,
      lastAuthenticatedAt: null,
      lastSuccessfulSyncAt: null,
    })),
  } as unknown as MoodleApplication;
  const syncScheduler = {
    enqueueLogin: vi.fn(async () => []),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
  };
  const identityRepository = {
    getProfile: vi.fn(async () => null),
    updateProfile: vi.fn(),
    listPrivacy: vi.fn(async () => []),
    setPrivacy: vi.fn(),
    createDataRequest: vi.fn(),
    getDataRequest: vi.fn(async () => null),
    getExportPayload: vi.fn(async () => null),
  } as unknown as UorStudentIdentityRepository;
  const officialDataRepository = {
    getDataset: vi.fn(async ({ domain, limit }) => ({
      domain,
      items: [],
      pagination: { limit, hasMore: false, nextCursor: null, total: null },
      provenance: { source: "secretaria_uor", observedAt: null, coverage: "not_synced", stale: false },
      snapshotVersion: null,
    })),
  } as unknown as import("./ports").UorStudentOfficialDataRepository;
  const academics = {
    getAverages: vi.fn(),
    listRules: vi.fn(async () => []),
    createSimulation: vi.fn(),
    updateSimulation: vi.fn(),
    listSimulations: vi.fn(async () => ({ items: [], nextCursor: null })),
    requiredGrade: vi.fn(),
    scholarshipScenario: vi.fn(),
  } as unknown as import("../academics/academic-service").UorStudentAcademicApplication;
  const application = new LiveUorStudentApplication(repository, secretaria, moodle, syncScheduler, identityRepository, officialDataRepository, academics);
  return { application, repository, secretaria, moodle, syncScheduler };
}

describe("LiveUorStudentApplication", () => {
  it("guarda a sessão Secretaria e agenda automaticamente os dois provedores", async () => {
    const { application, secretaria, syncScheduler } = setup();
    await application.bootstrapInstitutionalLogin({ student, secretariaPassword: "secretaria-password" });
    expect(secretaria.connect).toHaveBeenCalledWith(
      { id: 42, studentNumber: "20240001" },
      { username: "20240001", password: "secretaria-password", rememberCredentials: true },
    );
    expect(syncScheduler.enqueueLogin).toHaveBeenCalledWith(student);
  });

  it("persiste os jobs antes de devolver o login sem aguardar o Moodle", async () => {
    const { application, syncScheduler } = setup();
    syncScheduler.enqueueLogin.mockResolvedValueOnce([]);
    await expect(application.bootstrapInstitutionalLogin({ student, secretariaPassword: "ok" })).resolves.toBeUndefined();
    expect(syncScheduler.enqueueLogin).toHaveBeenCalledTimes(1);
  });

  it("mantém ausências como null e cria prioridade apenas a partir de estado explícito", async () => {
    const { application } = setup({ moodleDegraded: true });
    const today = await application.getToday(student);
    expect(today.academic.grades).toBeNull();
    expect(today.finance.charges).toBeNull();
    expect(today.providers).toHaveLength(2);
    expect(today.priorities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "provider:moodle:degraded", kind: "stale_data" }),
    ]));
  });

  it("aceita a senha Moodle atual sem usar o segredo da Secretaria", async () => {
    const { application, moodle } = setup();
    await application.updateMoodleCredentials(student, "nova-senha");
    expect(moodle.connect).toHaveBeenCalledWith(
      { id: 42, studentNumber: "20240001" },
      { username: "20240001", password: "nova-senha", rememberCredentials: true },
    );
  });
});

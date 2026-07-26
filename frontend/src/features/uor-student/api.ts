import { resolveApiRequestUrl } from "@/lib/runtime-config";

export type UorStudentProvider = {
  provider: "secretaria" | "moodle";
  status: "connected" | "connecting" | "credentials_required" | "unavailable" | "not_connected" | "degraded";
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
  coverage: "exact" | "partial" | "not_synced" | "unsupported" | "stale" | "failed";
  stale: boolean;
};

export type UorStudentToday = {
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
  academic: { enrollments: number | null; grades: number | null; exams: number | null; attendance: number | null; provenance: UorStudentDataBlock };
  learning: { courses: number | null; materials: number | null; provenance: UorStudentDataBlock };
  finance: { charges: number | null; references: number | null; payments: number | null; receipts: number | null; provenance: UorStudentDataBlock };
  agenda: { officialExams: number | null; moodleDeadlines: null; provenance: UorStudentDataBlock };
  providers: UorStudentProvider[];
};

export type UorStudentProfileField = {
  value: string | null;
  source: "secretaria_uor" | "student" | "system" | "unknown";
  observedAt: string | null;
};

export type UorStudentProfile = {
  id: string;
  institutionCode: string;
  studentNumber: string;
  fields: Record<
    "displayName" | "course" | "classCode" | "academicYear" | "academicPeriod" | "email" | "phone" | "alternatePhone" | "bio" | "address",
    UorStudentProfileField
  >;
};

export type UorStudentOfficialDataset = {
  domain: string;
  items: Array<{ id: string; attributes: Record<string, unknown> }>;
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null; total: number | null };
  provenance: UorStudentDataBlock;
  snapshotVersion: number | null;
};

export type UorStudentAverages = {
  subjects: Array<{ subjectKey: string; subjectName: string; period: string | null; average: string | null; considered: number; missing: number }>;
  overall: { average: string | null; consideredSubjects: number; missingSubjects: number };
  rule: { code: string; version: number; status: "derived_method"; formula: string };
  provenance: UorStudentDataBlock;
};

export class UorStudentApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "UorStudentApiError";
  }
}

function cookie(name: string) {
  if (typeof document === "undefined") return null;
  const value = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("ngrok-skip-browser-warning", "true");
  const csrf = cookie("uor_csrf");
  if (csrf) headers.set("x-csrf-token", csrf);
  if (options.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const response = await fetch(resolveApiRequestUrl(`/v1/student${path}`), {
    ...options,
    headers,
    credentials: "include",
  });
  const payload = await response.json().catch(() => null) as {
    data?: T;
    error?: { code?: string; message?: string };
    message?: string;
  } | null;
  if (!response.ok) {
    throw new UorStudentApiError(
      response.status,
      payload?.error?.code ?? "UOR_STUDENT_REQUEST_FAILED",
      payload?.error?.message ?? payload?.message ?? "Não foi possível concluir o pedido.",
    );
  }
  if (!payload || !("data" in payload)) throw new UorStudentApiError(502, "UOR_STUDENT_RESPONSE_INVALID", "A resposta do servidor é inválida.");
  return payload.data as T;
}

export const uorStudentApi = {
  session: () => request<{ active: true; profileId: string; institutionCode: string; providers: UorStudentProvider[] }>("/session"),
  today: () => request<UorStudentToday>("/today"),
  profile: () => request<UorStudentProfile>("/me"),
  providers: () => request<UorStudentProvider[]>("/providers"),
  averages: () => request<UorStudentAverages>("/averages"),
  dataset: (path: string, limit = 25) => request<UorStudentOfficialDataset>(`${path}?limit=${limit}`),
  learningItems: (path: "/learning/courses" | "/learning/materials", limit = 25) =>
    request<Array<Record<string, unknown>>>(`${path}?limit=${limit}`).then((items): UorStudentOfficialDataset => ({
      domain: path === "/learning/courses" ? "learning.courses" : "learning.materials",
      items: items.map((attributes, index) => ({ id: String(attributes.id ?? `${path}:${index}`), attributes })),
      pagination: { limit, hasMore: items.length === limit, nextCursor: null, total: null },
      provenance: { source: "moodle", observedAt: null, coverage: items.length ? "exact" : "not_synced", stale: false },
      snapshotVersion: null,
    })),
  learningOverview: () => request<Record<string, unknown>>("/learning/overview"),
  terminateExternalSessions: () => request<{ externalSessionsTerminated: true; providers: UorStudentProvider[] }>("/session", { method: "DELETE" }),
};

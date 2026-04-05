import { resolveApiRequestUrl } from "@/lib/runtime-config";

const TOKEN_KEY = "uor_token";
const CSRF_COOKIE = "uor_csrf";
const STUDENT_SESSION_KEY = "uor_student";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface StudentProfile {
  id: number;
  studentNumber: string;
  name: string | null;
  email: string | null;
  course: string | null;
  birthDate: string | null;
  nationality: string | null;
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  isIncomplete?: boolean;
}

export interface AuthLoginResponse {
  success: boolean;
  studentNumber?: string;
  student?: StudentProfile;
  token?: string;
  error?: string;
}

export interface AdminAuthorizedStudent {
  id: number;
  studentNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSecurityOverview {
  authorizedStudents: AdminAuthorizedStudent[];
  recentLogins: StudentProfile[];
}

function readSessionStudent() {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(STUDENT_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StudentProfile;
  } catch {
    sessionStorage.removeItem(STUDENT_SESSION_KEY);
    return null;
  }
}

function getCookieValue(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setSessionStudent(student: StudentProfile | null) {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  if (!student) {
    sessionStorage.removeItem(STUDENT_SESSION_KEY);
    return;
  }

  sessionStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(student));
}

export function setToken(token: string | null) {
  if (typeof localStorage === "undefined") {
    return;
  }

  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    setSessionStudent(null);
    return;
  }

  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return typeof localStorage === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
}

export function getSessionStudent() {
  if (!getToken()) {
    return null;
  }

  return readSessionStudent();
}

function storeLoginSession(result: AuthLoginResponse) {
  if (result.success && result.student) {
    setSessionStudent(result.student);
  }

  return result;
}

export function isAuthError(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 401;
  }

  return error instanceof Error && /unauthorized|missing or invalid token|invalid token/i.test(error.message);
}

export function isForbiddenError(error: unknown) {
  if (error instanceof ApiError) {
    return error.status === 403;
  }

  return error instanceof Error && /forbidden|access denied|acesso negado/i.test(error.message);
}

async function requestRaw(path: string, options?: RequestInit) {
  const token = getToken();
  const headers = new Headers(options?.headers);

  headers.set("ngrok-skip-browser-warning", "true");

  const csrf = getCookieValue(CSRF_COOKIE);
  if (csrf && !headers.has("x-csrf-token")) {
    headers.set("x-csrf-token", csrf);
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(resolveApiRequestUrl(path), {
    credentials: "include",
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
    }

    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, error.message || error.error || "Request failed");
  }

  return res;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await requestRaw(path, options);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  auth: {
    login: (studentNumber: string, password: string, origin?: "uorconnect" | "laboratorio") =>
      request<AuthLoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ studentNumber, password, origin }),
      }).then(storeLoginSession),
    logout: async () => {
      try {
        await request<{ success: boolean }>("/auth/logout", {
          method: "POST",
        });
      } finally {
        setToken(null);
      }
    },
    me: () =>
      request<StudentProfile>("/auth/me").then((student) => {
        setSessionStudent(student);
        return student;
      }),
  },
  contest: {
    login: (studentNumber: string, password: string) =>
      request<AuthLoginResponse>("/contest/auth/login", {
        method: "POST",
        body: JSON.stringify({ studentNumber, password }),
      }).then(storeLoginSession),
    me: () =>
      request<StudentProfile>("/contest/me").then((student) => {
        setSessionStudent(student);
        return student;
      }),
    securityOverview: () => request<AdminSecurityOverview>("/contest/security"),
    authorizeAdmin: (studentNumber: string) =>
      request<AdminAuthorizedStudent>("/contest/security/authorized-students", {
        method: "POST",
        body: JSON.stringify({ studentNumber }),
      }),
    revokeAdmin: (studentNumber: string) =>
      request<{ success: boolean }>(`/contest/security/authorized-students/${studentNumber}`, {
        method: "DELETE",
      }),
  },
};

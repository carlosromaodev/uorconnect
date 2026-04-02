export interface Student {
  id: number;
  studentNumber: string;
  // Campos abaixo podem ainda não ter sido sincronizados com a secretaria,
  // por isso são opcionais e nulos.
  name?: string | null;
  email?: string | null;
  course?: string | null;
  birthDate?: Date | null;
  nationality?: string | null;
  phone?: string | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type StudentLoginOrigin = "uorconnect" | "laboratorio";

export interface StudentLoginAudit {
  id: number;
  studentId: number;
  studentNumber: string;
  origin: StudentLoginOrigin;
  loggedAt: Date;
  student?: Student | null;
}

export interface LoginCredentials {
  studentNumber: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  studentNumber?: string;
  student?: Student;
  error?: string;
}

export interface StudentProfile {
  name?: string;
  email?: string;
  course?: string;
  birthDate?: Date;
  nationality?: string;
  phone?: string;
}

export interface StudentStats {
  likes: number;
  votes: number;
  comments: number;
}

export interface StudentWithStats extends Student {
  _count: StudentStats;
}

export interface AdminAuthorizedStudent {
  id: number;
  studentNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentDeletionResult {
  success: boolean;
  error?: string;
}

export interface Student {
  id: number;
  studentNumber: string;
  // Campos abaixo podem ainda não ter sido sincronizados com a secretaria,
  // por isso são opcionais e nulos.
  name?: string | null;
  email?: string | null;
  course?: string | null;
  classCode?: string | null;
  academicYear?: string | null;
  academicPeriod?: string | null;
  curricularYear?: string | null;
  academicSyncedAt?: Date | null;
  birthDate?: Date | null;
  nationality?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  avatarUrl?: string | null;
  university?: string | null;
  isUorStudent?: boolean | null;
  registrationSource?: string | null;
  bio?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  profileCompletedAt?: Date | null;
  accessType?: "OFFICIAL" | "TEMPORARY";
  deletedAt?: Date | null;
  deletionReason?: string | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type StudentLoginOrigin = "uorconnect" | "conventional";

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
  provider?: "uor" | "isptec";
  identifierType?: "studentNumber" | "username";
}

export interface LoginResponse {
  success: boolean;
  studentNumber?: string;
  student?: Student;
  error?: string;
}

export interface StudentProfile {
  studentNumber?: string;
  name?: string;
  email?: string;
  course?: string;
  classCode?: string;
  academicYear?: string;
  academicPeriod?: string;
  curricularYear?: string;
  academicSyncedAt?: Date;
  birthDate?: Date;
  nationality?: string;
  phone?: string;
  alternatePhone?: string | null;
  avatarUrl?: string | null;
  university?: string | null;
  isUorStudent?: boolean | null;
  registrationSource?: string | null;
  bio?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  profileCompletedAt?: Date | null;
  accessType?: "OFFICIAL" | "TEMPORARY";
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
  team: string;
  role: string;
  permissions: string;
  isActive: boolean;
  revokedAt?: Date | null;
  revokedByStudentNumber?: string | null;
  revocationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminAccessConflictMembership {
  id: number;
  fullName: string;
  category: string;
  team: string;
  role: string;
  permissions: string;
  status: string;
  updatedAt: Date;
}

export interface AdminAccessConflict {
  studentNumber: string;
  issue: "NO_ACTIVE_MEMBERSHIP" | "BLOCKED_BY_INACTIVE_MEMBERSHIP" | "OFFICIAL_MEMBERSHIP_PRECEDENCE";
  severity: "MEDIUM" | "HIGH";
  accessBlocked: boolean;
  admin: AdminAuthorizedStudent;
  memberships: AdminAccessConflictMembership[];
  effectiveSource: "ADMIN_AUTHORIZED_STUDENT" | "TEAM_MEMBERSHIP" | "BLOCKED";
}

export interface StudentDeletionResult {
  success: boolean;
  error?: string;
}

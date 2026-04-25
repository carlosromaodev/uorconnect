import { type AdminAuthorizedStudent, type Student } from "../domain/student";
import { serializeAdminPermissions, normalizeAdminRole, type AdminAccessInput } from "../domain/admin-authorized-students";

export interface AdminSecurityRepository {
  listAuthorizedAdminStudents(): Promise<AdminAuthorizedStudent[]>;
  authorizeAdminStudent(studentNumber: string, input?: AdminAccessInput): Promise<AdminAuthorizedStudent>;
  revokeAdminStudent(studentNumber: string): Promise<void>;
  isAdminAuthorized(studentNumber: string): Promise<boolean>;
  listRecentLogins(limit?: number): Promise<Student[]>;
}

function normalizeStudentNumber(studentNumber: string) {
  return studentNumber.replace(/\D/g, "").trim();
}

function isValidAdminStudentNumber(studentNumber: string) {
  return studentNumber.length >= 8 && studentNumber.length <= 10;
}

export class ListAdminSecurityOverviewUseCase {
  constructor(private readonly repository: AdminSecurityRepository) {}

  async execute() {
    const [authorizedStudents, recentLogins] = await Promise.all([
      this.repository.listAuthorizedAdminStudents(),
      this.repository.listRecentLogins(25),
    ]);

    return { authorizedStudents, recentLogins };
  }
}

export class AuthorizeAdminStudentUseCase {
  constructor(private readonly repository: AdminSecurityRepository) {}

  async execute(studentNumber: string, input: AdminAccessInput = {}) {
    const normalized = normalizeStudentNumber(studentNumber);

    if (!isValidAdminStudentNumber(normalized)) {
      return { success: false as const, error: "Student number must have between 8 and 10 digits" };
    }

    const role = normalizeAdminRole(input.role);
    const authorizedStudent = await this.repository.authorizeAdminStudent(normalized, {
      team: input.team?.trim() || "Geral",
      role,
      permissions: role === "SUPER_ADMIN" ? ["ALL"] : serializeAdminPermissions(input.permissions).split(","),
    });
    return { success: true as const, authorizedStudent };
  }
}

export class RevokeAdminStudentUseCase {
  constructor(private readonly repository: AdminSecurityRepository) {}

  async execute(studentNumber: string) {
    const normalized = normalizeStudentNumber(studentNumber);

    if (!isValidAdminStudentNumber(normalized)) {
      return { success: false as const, error: "Student number must have between 8 and 10 digits" };
    }

    const exists = await this.repository.isAdminAuthorized(normalized);
    if (!exists) {
      return { success: false as const, error: "Authorized student not found" };
    }

    await this.repository.revokeAdminStudent(normalized);
    return { success: true as const };
  }
}

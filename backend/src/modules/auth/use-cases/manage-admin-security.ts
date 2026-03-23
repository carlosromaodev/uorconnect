import { type AdminAuthorizedStudent, type Student } from "../domain/student";

export interface AdminSecurityRepository {
  listAuthorizedAdminStudents(): Promise<AdminAuthorizedStudent[]>;
  authorizeAdminStudent(studentNumber: string): Promise<AdminAuthorizedStudent>;
  revokeAdminStudent(studentNumber: string): Promise<void>;
  isAdminAuthorized(studentNumber: string): Promise<boolean>;
  listRecentLogins(limit?: number): Promise<Student[]>;
}

function normalizeStudentNumber(studentNumber: string) {
  return studentNumber.replace(/\D/g, "").trim();
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

  async execute(studentNumber: string) {
    const normalized = normalizeStudentNumber(studentNumber);

    if (normalized.length !== 8) {
      return { success: false as const, error: "Student number must have exactly 8 digits" };
    }

    const authorizedStudent = await this.repository.authorizeAdminStudent(normalized);
    return { success: true as const, authorizedStudent };
  }
}

export class RevokeAdminStudentUseCase {
  constructor(private readonly repository: AdminSecurityRepository) {}

  async execute(studentNumber: string) {
    const normalized = normalizeStudentNumber(studentNumber);

    if (normalized.length !== 8) {
      return { success: false as const, error: "Student number must have exactly 8 digits" };
    }

    const exists = await this.repository.isAdminAuthorized(normalized);
    if (!exists) {
      return { success: false as const, error: "Authorized student not found" };
    }

    await this.repository.revokeAdminStudent(normalized);
    return { success: true as const };
  }
}

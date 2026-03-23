import { type LoginCredentials, type LoginResponse } from "../domain/student";
import { StudentRepository } from "../infra/student.repository";
import { loginSecretaria } from "../infra/secretaria-client";

export class LoginUseCase {
  constructor(private studentRepository: StudentRepository) {}

  async execute(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const result = await loginSecretaria(credentials.studentNumber, credentials.password);

      if (result.success && result.profile) {
        // Persist the profile that veio da secretaria e devolve ao frontend
        const student = await this.studentRepository.upsertProfile(credentials.studentNumber, result.profile);
        return { success: true, studentNumber: credentials.studentNumber, student };
      }

      const errorMessage = !result.success && "reason" in result ? result.reason : "Invalid credentials";
      return { success: false, error: errorMessage };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}

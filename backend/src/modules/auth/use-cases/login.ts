import { type LoginCredentials, type LoginResponse } from "../domain/student";
import { StudentRepository } from "../infra/student.repository";
import { loginSecretaria } from "../infra/secretaria-client";

function normalizeSecretariaError(reason?: string) {
  const normalized = reason?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return "Não foi possível validar a tua sessão académica agora. Tenta novamente dentro de instantes.";
  }

  if (
    normalized.includes("invalid credentials")
    || normalized.includes("unauthorized:true")
    || normalized.includes("step:login status 401")
    || normalized.includes("step:follow status 401")
    || normalized.includes("acesso negado")
    || normalized.includes("não tem acesso")
  ) {
    return "Número de estudante ou palavra-passe inválidos.";
  }

  if (
    normalized.includes("fetch failed")
    || normalized.includes("econn")
    || normalized.includes("enotfound")
    || normalized.includes("etimedout")
    || normalized.includes("network")
    || normalized.includes("socket")
  ) {
    return "O serviço académico está indisponível neste momento. Tenta novamente dentro de instantes.";
  }

  if (
    normalized.includes("step:init")
    || normalized.includes("step:login")
    || normalized.includes("step:follow")
    || normalized.includes("missing cookie")
    || normalized.includes("missing target content")
  ) {
    return "Não foi possível validar a tua sessão académica neste momento. Confirma os dados e volta a tentar.";
  }

  return "Não foi possível validar a tua sessão académica agora. Tenta novamente dentro de instantes.";
}

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

      const errorMessage = !result.success && "reason" in result
        ? normalizeSecretariaError(result.reason)
        : "Não foi possível validar a tua sessão académica agora. Tenta novamente dentro de instantes.";
      return { success: false, error: errorMessage };
    } catch (error) {
      return {
        success: false,
        error: normalizeSecretariaError(error instanceof Error ? error.message : undefined)
      };
    }
  }
}

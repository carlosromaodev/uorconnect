import { type LoginCredentials, type LoginResponse } from "../domain/student";
import { StudentRepository } from "../infra/student.repository";
import { loginIsptecPortal } from "../infra/isptec-client";
import { loginSecretaria } from "../infra/secretaria-client";

const INVALID_CREDENTIALS_MESSAGE = "Número de estudante ou palavra-passe inválidos.";
const USERNAME_REQUIRES_OFFICIAL_NUMBER_MESSAGE =
  "A Secretaria validou a sessão, mas não devolveu o número oficial do estudante. Tenta entrar com o número de estudante.";

export function isInvalidCredentialsErrorMessage(message?: string) {
  if (!message) return false;
  return message.trim().toLowerCase() === INVALID_CREDENTIALS_MESSAGE.toLowerCase();
}

function normalizeSecretariaError(reason?: string) {
  const normalized = reason?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return "Não foi possível validar a tua sessão académica agora. Tenta novamente dentro de instantes.";
  }

  if (
    normalized.includes("invalid credentials")
    || normalized.includes("step:login invalid credentials")
    || normalized.includes("step:login status 401")
    || normalized.includes("acesso negado")
    || normalized.includes("não tem acesso")
  ) {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  if (
    normalized.includes("p2021")
    || normalized.includes("table `main.student` does not exist")
    || normalized.includes("tabela `main.student` não existe")
  ) {
    return "A base de dados local não está inicializada. Executa `npm run prisma -- db push` na pasta backend e tenta novamente.";
  }

  if (
    normalized.includes("fetch failed")
    || normalized.includes("econn")
    || normalized.includes("enotfound")
    || normalized.includes("etimedout")
    || normalized.includes("timeout")
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
  constructor(
    private studentRepository: StudentRepository,
    private localPasswordSecret = process.env.JWT_SECRET ?? "development-secret",
  ) {}

  async execute(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const provider = credentials.provider ?? "uor";
      const identifierType = credentials.identifierType ?? "studentNumber";
      const numericStudentNumber = credentials.studentNumber.replace(/\D/g, "").trim();

      if (provider === "uor" && identifierType === "studentNumber" && numericStudentNumber) {
        const localStudent = await this.studentRepository.findByLocalPassword?.(
          numericStudentNumber,
          credentials.password,
          this.localPasswordSecret,
        );

        if (localStudent) {
          return {
            success: true,
            studentNumber: localStudent.studentNumber,
            student: localStudent,
          };
        }
      }

      const result = provider === "isptec"
        ? await loginIsptecPortal(credentials.studentNumber, credentials.password)
        : await loginSecretaria(credentials.studentNumber, credentials.password);

      if (result.success && result.profile) {
        const officialStudentNumber = provider === "isptec"
          ? credentials.studentNumber
          : result.profile.studentNumber?.replace(/\D/g, "").trim()
            || (identifierType === "studentNumber" ? numericStudentNumber : "");

        if (!officialStudentNumber) {
          return { success: false, error: USERNAME_REQUIRES_OFFICIAL_NUMBER_MESSAGE };
        }

        // Persist the profile that veio da secretaria e devolve ao frontend
        const student = await this.studentRepository.upsertProfile(officialStudentNumber, {
          ...result.profile,
          university: provider === "isptec"
            ? result.profile.university ?? "ISPTEC"
            : result.profile.university,
          institutionCode: provider === "isptec" ? "ISPTEC" : "UOR",
          isUorStudent: provider === "isptec" ? false : true,
          registrationSource: provider === "isptec" ? "ISPTEC_OFFICIAL" : "SECRETARIA",
          academicSyncedAt: result.profile.academicSyncedAt ?? new Date(),
        });
        return { success: true, studentNumber: officialStudentNumber, student };
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

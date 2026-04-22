import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { LoginUseCase } from "./login";
import { type StudentRepository } from "../infra/student.repository";
import { loginSecretaria } from "../infra/secretaria-client";

// Evita bater na rede nos testes: mock da secretaria retornando sucesso
vi.mock("../infra/secretaria-client", () => ({
  loginSecretaria: vi.fn((studentNumber: string, password: string) => {
    const ok = password !== "senha_errada_123";
    return Promise.resolve(
      ok
        ? {
            success: true,
            profile: {
              name: "Aluno Teste",
              email: "aluno@teste.com",
              course: "Curso Teste",
              birthDate: new Date("2001-01-05"),
              nationality: "Angolana",
              phone: "937624785"
            }
          }
        : { success: false, reason: "Invalid credentials (mocked)" }
    );
  })
}));

// Credenciais reais (podem ser sobrepostas via env vars).
const STUDENT_NUMBER = process.env.SECRETARIA_STUDENT_NUMBER ?? "20243454";
const STUDENT_PASSWORD = process.env.SECRETARIA_PASSWORD ?? "123456789";

describe("LoginUseCase – integração com secretaria", () => {
  const repo: StudentRepository = {
    // upsertProfile é usado no caminho de sucesso
    upsertProfile: vi.fn().mockResolvedValue({ studentNumber: STUDENT_NUMBER } as any),
    findByStudentNumber: vi.fn()
  } as unknown as StudentRepository;

  beforeAll(() => {
    // No-op; mock already set above
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it(
    "aceita login válido e registra o estudante",
    async () => {
      const useCase = new LoginUseCase(repo);
      const result = await useCase.execute({
        studentNumber: STUDENT_NUMBER,
        password: STUDENT_PASSWORD
      });

      if (!result.success) {
        console.error("Login falhou no ambiente de teste:", result.error);
      }

      expect(result.success).toBe(true);
      expect(result.studentNumber).toBe(STUDENT_NUMBER);
      expect(repo.upsertProfile).toHaveBeenCalledWith(STUDENT_NUMBER, expect.any(Object));
    },
    30_000 // timeout para rede externa
  );

  it(
    "rejeita senha incorreta",
    async () => {
      const useCase = new LoginUseCase(repo);
      const result = await useCase.execute({
        studentNumber: STUDENT_NUMBER,
        password: "senha_errada_123"
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Número de estudante ou palavra-passe inválidos.");
    },
    30_000
  );

  it(
    "orienta inicialização da base local quando a tabela Student não existe",
    async () => {
      vi.mocked(loginSecretaria).mockResolvedValueOnce({
        success: false,
        reason: "P2021: The table `main.Student` does not exist in the current database.",
      } as any);

      const useCase = new LoginUseCase(repo);
      const result = await useCase.execute({
        studentNumber: STUDENT_NUMBER,
        password: STUDENT_PASSWORD,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("base de dados local");
      expect(result.error).toContain("prisma -- db push");
    },
    30_000
  );
});

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { LoginUseCase } from "./login";
import { type StudentRepository } from "../infra/student.repository";
import { loginSecretaria } from "../infra/secretaria-client";
import { loginIsptecPortal } from "../infra/isptec-client";

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

vi.mock("../infra/isptec-client", () => ({
  loginIsptecPortal: vi.fn((studentNumber: string, password: string) => {
    const ok = password !== "senha_errada_123";
    return Promise.resolve(
      ok
        ? {
            success: true,
            profile: {
              name: "Aluno ISPTEC",
              email: "aluno@isptec.example.test",
              course: "Engenharia Informática",
              university: "ISPTEC",
              academicSyncedAt: new Date("2026-05-15T09:00:00.000Z"),
            },
          }
        : { success: false, reason: "step:login invalid credentials status 200" },
    );
  }),
}));

// Identidade inteiramente simulada; a suite não depende de credenciais reais.
const STUDENT_NUMBER = process.env.SECRETARIA_STUDENT_NUMBER ?? "20243454";
const STUDENT_PASSWORD = "test-only-password";

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
      expect(repo.upsertProfile).toHaveBeenCalledWith(
        STUDENT_NUMBER,
        expect.objectContaining({
          institutionCode: "UOR",
          isUorStudent: true,
          registrationSource: "SECRETARIA",
        }),
      );
    },
    30_000 // timeout para rede externa
  );

  it(
    "aceita login ISPTEC e registra o estudante como identidade académica oficial",
    async () => {
      const useCase = new LoginUseCase(repo);
      const result = await useCase.execute({
        studentNumber: "20200227",
        password: "senha_valida",
        provider: "isptec",
      });

      expect(result.success).toBe(true);
      expect(loginIsptecPortal).toHaveBeenCalledWith("20200227", "senha_valida");
      expect(loginSecretaria).not.toHaveBeenLastCalledWith("20200227", "senha_valida");
      expect(repo.upsertProfile).toHaveBeenCalledWith(
        "20200227",
        expect.objectContaining({
          institutionCode: "ISPTEC",
          university: "ISPTEC",
          isUorStudent: false,
          registrationSource: "ISPTEC_OFFICIAL",
          academicSyncedAt: expect.any(Date),
        }),
      );
    },
    30_000,
  );

  it(
    "aceita login UOR por nome de utilizador e persiste o número oficial devolvido pela Secretaria",
    async () => {
      vi.mocked(loginSecretaria).mockResolvedValueOnce({
        success: true,
        profile: {
          studentNumber: "20200477",
          name: "Petrucadas",
          course: "Engenharia Informática",
          academicSyncedAt: new Date("2026-05-15T10:00:00.000Z"),
        },
      } as any);

      vi.mocked(repo.upsertProfile).mockResolvedValueOnce({
        studentNumber: "20200477",
      } as any);

      const useCase = new LoginUseCase(repo);
      const result = await useCase.execute({
        studentNumber: "petrucadas",
        password: "senha_valida",
        provider: "uor",
        identifierType: "username",
      });

      expect(result.success).toBe(true);
      expect(result.studentNumber).toBe("20200477");
      expect(loginSecretaria).toHaveBeenCalledWith("petrucadas", "senha_valida");
      expect(repo.upsertProfile).toHaveBeenCalledWith(
        "20200477",
        expect.objectContaining({
          institutionCode: "UOR",
          isUorStudent: true,
          registrationSource: "SECRETARIA",
        }),
      );
    },
    30_000,
  );

  it(
    "rejeita login UOR por nome quando a Secretaria não devolve número oficial",
    async () => {
      vi.mocked(loginSecretaria).mockResolvedValueOnce({
        success: true,
        profile: {
          name: "Utilizador sem número",
          course: "Engenharia Informática",
        },
      } as any);

      const useCase = new LoginUseCase(repo);
      const result = await useCase.execute({
        studentNumber: "utilizador.sem.numero",
        password: "senha_valida",
        provider: "uor",
        identifierType: "username",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("número oficial");
    },
    30_000,
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
    "mantém 401 apenas para marcador explícito de credenciais inválidas",
    async () => {
      vi.mocked(loginSecretaria).mockResolvedValueOnce({
        success: false,
        reason: "step:login invalid credentials status 200 redirect:none",
      } as any);

      const useCase = new LoginUseCase(repo);
      const result = await useCase.execute({
        studentNumber: STUDENT_NUMBER,
        password: STUDENT_PASSWORD,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Número de estudante ou palavra-passe inválidos.");
    },
    30_000
  );

  it(
    "não classifica follow 401 ambíguo como credenciais inválidas",
    async () => {
      vi.mocked(loginSecretaria).mockResolvedValueOnce({
        success: false,
        reason: "step:follow status 401 unauthorized:true url:http://secretaria.uor.edu.ao/netpa/page?stage=BoletimMatricula",
      } as any);

      const useCase = new LoginUseCase(repo);
      const result = await useCase.execute({
        studentNumber: STUDENT_NUMBER,
        password: STUDENT_PASSWORD,
      });

      expect(result.success).toBe(false);
      expect(result.error).not.toBe("Número de estudante ou palavra-passe inválidos.");
      expect(result.error?.toLowerCase()).toContain("não foi possível validar");
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

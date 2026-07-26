import { describe, expect, it } from "vitest";
import { assertUorStudentSmsMinimized, uorStudentOtpMessage } from "./sms-policy";

describe("política SMS da UOR Estudante", () => {
  it("gera OTP contextual sem dados académicos ou financeiros", () => {
    for (const kind of ["authorization", "step_up", "admin"] as const) {
      const message = uorStudentOtpMessage(kind, "123456");
      expect(message).toContain("código 123456");
      expect(message).not.toMatch(/nota|dívida|saldo|propina|AOA|Kz|usi_|scr_/i);
    }
  });

  it("rejeita notas, dívida, saldo, referências internas e credenciais", () => {
    for (const content of [
      "UOR Estudante: nota 18 publicada.",
      "UOR Estudante: dívida 20000 AOA.",
      "UOR Estudante: referência scr_abc.",
      "UOR Estudante: senha institucional alterada.",
    ]) {
      expect(() => assertUorStudentSmsMinimized(content)).toThrow(expect.objectContaining({ code: "UOR_STUDENT_SMS_CONTENT_FORBIDDEN" }));
    }
  });
});

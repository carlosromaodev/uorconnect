import { UorStudentError } from "../domain/errors";

const forbiddenSensitiveContent = /\b(?:nota(?:s)?|d[ií]vida(?:s)?|saldo|propina(?:s)?|password|senha|cookie|bearer|sessionEnvelope|credentialsEnvelope|AOA|Kz)\b|(?:usi_|scr_)/i;

export function assertUorStudentSmsMinimized(message: string) {
  if (!message.startsWith("UOR Estudante:") || message.length > 320 || forbiddenSensitiveContent.test(message)) {
    throw new UorStudentError("UOR_STUDENT_SMS_CONTENT_FORBIDDEN", "A notificação contém dados incompatíveis com a política de minimização.", 422);
  }
  return message;
}

export function uorStudentOtpMessage(kind: "authorization" | "step_up" | "admin", code: string) {
  if (!/^\d{6}$/.test(code)) throw new UorStudentError("UOR_STUDENT_OTP_CODE_INVALID", "O código OTP é inválido.", 500);
  const context = kind === "authorization"
    ? "confirmar uma autorização"
    : kind === "admin"
      ? "confirmar uma operação administrativa"
      : "confirmar uma operação sensível";
  return assertUorStudentSmsMinimized(`UOR Estudante: código ${code} para ${context}. Válido por 10 minutos. Não partilhes este código.`);
}

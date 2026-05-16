import { createHash, randomInt } from "node:crypto";

export const LOCAL_STUDENT_PASSWORD_PURPOSE = "LOCAL_PASSWORD";
export const EXTERNAL_TEAM_MEMBER_REGISTRATION_SOURCE = "EXTERNAL_TEAM_MEMBER";

const TEMPORARY_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTemporaryStudentPassword(length = 8) {
  return Array.from({ length }, () => (
    TEMPORARY_PASSWORD_ALPHABET[randomInt(0, TEMPORARY_PASSWORD_ALPHABET.length)]
  )).join("");
}

export function hashLocalStudentPassword(studentNumber: string, password: string, secret: string) {
  return createHash("sha256")
    .update(`${secret}:local-student-password:${studentNumber}:${password}`)
    .digest("hex");
}

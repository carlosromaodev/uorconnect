const DEFAULT_ADMIN_STUDENT_NUMBERS = ["20242099"];

export function normalizeAdminStudentNumber(studentNumber: string) {
  return studentNumber.replace(/\D/g, "").trim();
}

export function isDefaultAdminStudentNumber(studentNumber: string) {
  const normalized = normalizeAdminStudentNumber(studentNumber);
  return DEFAULT_ADMIN_STUDENT_NUMBERS.includes(normalized);
}

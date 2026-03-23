type StudentLike = {
  name?: string | null;
  course?: string | null;
};

export function normalizeStudentName(value?: string | null): string | undefined {
  if (!value) return undefined;

  const cleaned = value
    .replace(/^\[\d+\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return undefined;

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length <= 2) return cleaned;

  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function normalizeCourse(value?: string | null): string | undefined {
  if (!value) return undefined;

  const cleaned = value
    .replace(/^\[\d+\]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || undefined;
}

export function normalizeStudentProfile<T extends StudentLike>(student: T): T {
  return {
    ...student,
    name: normalizeStudentName(student.name) ?? null,
    course: normalizeCourse(student.course) ?? null
  };
}

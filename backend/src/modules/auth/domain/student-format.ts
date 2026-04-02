import { normalizeOfficialCourse } from "../../../shared/official-courses";

type StudentLike = {
  name?: string | null;
  course?: string | null;
  phone?: string | null;
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
  return normalizeOfficialCourse(value);
}

export function normalizeAngolaPhone(value?: string | null): string | undefined {
  if (!value) return undefined;

  const digits = value.replace(/\D/g, "");
  if (!digits) return undefined;

  if (digits.startsWith("244") && digits.length >= 12) {
    return `+${digits.slice(0, 12)}`;
  }

  if (digits.length === 9 && digits.startsWith("9")) {
    return `+244${digits}`;
  }

  if (digits.length === 8) {
    return `+2449${digits}`;
  }

  return value.trim() || undefined;
}

export function normalizeStudentProfile<T extends StudentLike>(student: T): T {
  return {
    ...student,
    name: normalizeStudentName(student.name) ?? null,
    course: normalizeCourse(student.course) ?? null,
    phone: normalizeAngolaPhone(student.phone) ?? null
  };
}

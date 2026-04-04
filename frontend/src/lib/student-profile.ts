import { api, type StudentProfile, type StudentProfileUpdateInput } from "@/lib/api";

function normalizeValue(value?: string | null) {
  return value?.trim() || "";
}

export async function syncStudentProfileIfNeeded(
  currentStudent: StudentProfile | null,
  nextProfile: StudentProfileUpdateInput,
) {
  if (!currentStudent) return currentStudent;

  const payload: StudentProfileUpdateInput = {};

  if (nextProfile.name && normalizeValue(nextProfile.name) !== normalizeValue(currentStudent.name)) {
    payload.name = nextProfile.name.trim();
  }

  if (nextProfile.email && normalizeValue(nextProfile.email) !== normalizeValue(currentStudent.email)) {
    payload.email = nextProfile.email.trim();
  }

  if (nextProfile.course && normalizeValue(nextProfile.course) !== normalizeValue(currentStudent.course)) {
    payload.course = nextProfile.course.trim();
  }

  if (nextProfile.phone && normalizeValue(nextProfile.phone) !== normalizeValue(currentStudent.phone)) {
    payload.phone = nextProfile.phone.trim();
  }

  if (Object.keys(payload).length === 0) {
    return currentStudent;
  }

  return api.auth.updateMe(payload);
}

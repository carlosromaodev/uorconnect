export function normalizePhoneForWhatsApp(value?: string | null) {
  if (!value) return null;

  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("244")) return digits;
  if (digits.length === 9) return `244${digits}`;
  return digits.length >= 9 ? digits : null;
}

export function buildEnrollmentReference(courseId: number, enrollmentId: number) {
  return `CUR-${courseId}-${enrollmentId.toString().padStart(4, "0")}`;
}

export function getEnrollmentStatusLabel(paymentStatus: string, paymentProofPath: string | null) {
  if (paymentStatus === "CONFIRMED") return "Confirmado";
  if (paymentStatus === "APPROVED") return "Aprovado";
  if (paymentStatus === "REJECTED") return "Rejeitado";
  if (paymentStatus === "CANCELED") return "Cancelado";
  if (paymentStatus === "PENDING" && paymentProofPath) return "Em análise";
  if (!paymentProofPath) return "Pendente de comprovativo";
  return "Em análise";
}

export function buildWhatsAppUrl(phone: string | null, params: { courseName: string; fullName: string }) {
  const normalizedPhone = normalizePhoneForWhatsApp(phone);
  if (!normalizedPhone) return null;

  const firstName = params.fullName.split(" ").filter(Boolean)[0] ?? "estudante";
  const message = `Olá ${firstName}, aqui é a equipa do UOR Connect. Estamos a entrar em contacto sobre a tua inscrição no curso ${params.courseName}.`;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function buildPaymentShareUrl(params: {
  courseName: string;
  fullName: string;
  studentNumber: string;
  destinationUrl?: string | null;
  paymentProofPath: string | null;
  ticketPath: string | null;
  publicApiBaseUrl?: string | null;
  publicAppUrl?: string | null;
}) {
  const siteUrl = params.publicAppUrl?.replace(/\/$/, "") ?? "https://uorconnect.space";
  const buildAbsoluteUrl = (value?: string | null) => {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    const apiBaseUrl = params.publicApiBaseUrl?.replace(/\/$/, "");
    if (apiBaseUrl) {
      return `${apiBaseUrl}${value.startsWith("/") ? value : `/${value}`}`;
    }
    return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
  };

  const ticketUrl = buildAbsoluteUrl(params.ticketPath);
  const proofUrl = params.paymentProofPath ? buildAbsoluteUrl(params.paymentProofPath) : null;
  const text = [
    "Olá, equipa UOR Connect.",
    `Concluí a inscrição no curso ${params.courseName}.`,
    `Estudante: ${params.fullName}`,
    `Número: ${params.studentNumber}`,
    ticketUrl ? `PDF da inscrição: ${ticketUrl}` : null,
    proofUrl ? `Comprovativo: ${proofUrl}` : null,
    `Portal: ${siteUrl}/#/cursos`.replace("/#/", "/"),
  ].filter(Boolean).join("\n");

  if (params.destinationUrl) {
    try {
      const target = new URL(params.destinationUrl);
      const host = target.hostname.toLowerCase();
      const isWhatsAppTarget = host === "wa.me"
        || host.endsWith(".wa.me")
        || host.includes("whatsapp.com");

      if (!isWhatsAppTarget) {
        return params.destinationUrl;
      }

      target.searchParams.set("text", text);
      return target.toString();
    } catch {
      return params.destinationUrl;
    }
  }

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function toAbsoluteUrl(baseUrl?: string | null, path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!baseUrl) return path;

  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

type StudentEnrollmentPresenterEntry = {
  id: number;
  courseId: number;
  enrolledAt: string;
  paymentStatus: string;
  paymentProofPath: string | null;
  ticketPath: string | null;
  course: {
    name: string;
    companyName: string;
    description?: string;
    companyCategory?: string;
    communityUrl?: string | null;
  };
  studentNumber?: string;
  fullName?: string;
  email?: string | null;
  studentCourse?: string | null;
  phone?: string | null;
  paymentPhone?: string | null;
  paymentSubmittedAt?: string | null;
  whatsAppRedirectUrl?: string | null;
};

export function buildStudentEnrollmentListItem(entry: StudentEnrollmentPresenterEntry) {
  return {
    id: entry.id,
    courseId: entry.courseId,
    courseName: entry.course.name,
    companyName: entry.course.companyName,
    referenceCode: buildEnrollmentReference(entry.courseId, entry.id),
    paymentStatus: entry.paymentStatus,
    statusLabel: getEnrollmentStatusLabel(entry.paymentStatus, entry.paymentProofPath),
    enrolledAt: entry.enrolledAt,
    receiptPath: `/cursos/inscricoes/${entry.id}`,
    ticketPath: entry.ticketPath,
    paymentProofPath: entry.paymentProofPath,
  };
}

export function buildStudentEnrollmentReceipt(entry: Required<Pick<
  StudentEnrollmentPresenterEntry,
  "id" | "courseId" | "studentNumber" | "fullName" | "enrolledAt" | "paymentStatus"
>> & StudentEnrollmentPresenterEntry) {
  return {
    id: entry.id,
    courseId: entry.courseId,
    courseName: entry.course.name,
    courseDescription: entry.course.description ?? "",
    companyName: entry.course.companyName,
    companyCategory: entry.course.companyCategory ?? "",
    communityUrl: entry.course.communityUrl ?? null,
    referenceCode: buildEnrollmentReference(entry.courseId, entry.id),
    studentNumber: entry.studentNumber,
    fullName: entry.fullName,
    email: entry.email ?? null,
    studentCourse: entry.studentCourse ?? null,
    phone: entry.phone ?? null,
    paymentPhone: entry.paymentPhone ?? null,
    paymentStatus: entry.paymentStatus,
    statusLabel: getEnrollmentStatusLabel(entry.paymentStatus, entry.paymentProofPath),
    paymentSubmittedAt: entry.paymentSubmittedAt ?? null,
    paymentProofPath: entry.paymentProofPath,
    ticketPath: entry.ticketPath,
    whatsAppRedirectUrl: entry.whatsAppRedirectUrl ?? null,
    enrolledAt: entry.enrolledAt,
    receiptPath: `/cursos/inscricoes/${entry.id}`,
  };
}

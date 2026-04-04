import type { StudentEnrollmentReceipt, StudentSubmissionReceipt } from "@/lib/api";
import { resolveAbsoluteAssetUrl } from "@/lib/runtime-config";

export function toAbsoluteAssetUrl(path?: string | null) {
  return resolveAbsoluteAssetUrl(path);
}

export function downloadBlobFile(blob: Blob, fileName: string) {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5_000);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Data indisponível";

  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function buildSubmissionLegend(receipt: StudentSubmissionReceipt) {
  return [
    "Olá, equipa UOR Connect.",
    `Referência: ${receipt.referenceCode}`,
    `Candidatura: ${receipt.name}`,
    `Tipo: ${receipt.typeLabel}`,
    `Estado: ${receipt.statusLabel}`,
    receipt.leaderName ? `Responsável: ${receipt.leaderName}` : null,
    receipt.leaderPhone ? `Contacto: ${receipt.leaderPhone}` : null,
    receipt.course ? `Curso: ${receipt.course}` : null,
    receipt.members ? `Membros: ${receipt.members}` : null,
    receipt.description ? `Descrição: ${receipt.description}` : null,
    receipt.boardingPassPath ? `Talão: ${toAbsoluteAssetUrl(receipt.boardingPassPath)}` : null,
    receipt.paymentProofPath ? `Comprovativo: ${toAbsoluteAssetUrl(receipt.paymentProofPath)}` : null,
    receipt.communityUrl ? `Comunidade: ${receipt.communityUrl}` : null,
  ].filter(Boolean).join("\n");
}

export function buildCourseEnrollmentLegend(receipt: StudentEnrollmentReceipt) {
  return [
    "Olá, equipa UOR Connect.",
    `Referência: ${receipt.referenceCode}`,
    `Curso: ${receipt.courseName}`,
    `Estado: ${receipt.statusLabel}`,
    `Estudante: ${receipt.fullName}`,
    `Número de estudante: ${receipt.studentNumber}`,
    receipt.studentCourse ? `Curso académico: ${receipt.studentCourse}` : null,
    receipt.phone ? `Contacto: ${receipt.phone}` : null,
    receipt.ticketPath ? `Talão: ${toAbsoluteAssetUrl(receipt.ticketPath)}` : null,
    receipt.paymentProofPath ? `Comprovativo: ${toAbsoluteAssetUrl(receipt.paymentProofPath)}` : null,
    receipt.communityUrl ? `Comunidade: ${receipt.communityUrl}` : null,
  ].filter(Boolean).join("\n");
}

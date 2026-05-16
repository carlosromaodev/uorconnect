import type { FastifyInstance } from "fastify";
import { prisma } from "../../../shared/prisma";
import { type Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import { formatTeamMembersLabel, normalizeTeamMembersInput } from "../../submission/domain/submission-format";
import { escapeHtml, formatDateLabel, loadLogoDataUri, renderPdfFromHtml } from "./pdf-report.utils";
import { enqueuePdfJob, getPdfJob, getPdfJobResult, pdfJobInputHash, registerPdfJobHandler } from "../../../shared/pdf-job-queue";
import { isPaymentConfirmedByAdmin, paymentStatusLabel as financialPaymentStatusLabel } from "../../payments/payment-status";
import {
  buildBarChartRows,
  calculateOverviewReportMetrics,
  multiplyMoney,
  parseReportMoney,
  sumMoney,
} from "./report-calculations";

type ReportStudent = {
  id: number;
  name: string;
  course: string | null;
  actions: Set<string>;
};

type SubmissionInteractionStudent = {
  id: number;
  studentNumber: string;
  name: string | null;
  course: string | null;
};

type ReportSubmission = {
  referenceCode: string;
  name: string;
  type: string;
  status: string;
  area: string;
  course: string | null;
  members: string;
  leaderPhone: string | null;
  description: string;
  createdAt: Date;
  paymentConfirmed: boolean;
  paymentStatus: string | null;
  studentLikes: Array<{ student: SubmissionInteractionStudent }>;
  studentVotes: Array<{ student: SubmissionInteractionStudent }>;
  studentComments: Array<{ student: SubmissionInteractionStudent }>;
};

type SubmissionInteractionRow = {
  name: string;
  course: string | null;
  actionsLabel: string;
};

type DetailedSubmission = {
  index: number;
  referenceCode: string;
  name: string;
  typeLabel: string;
  statusLabel: string;
  area: string;
  course: string | null;
  members: string;
  leaderPhone: string | null;
  description: string;
  createdAtLabel: string;
  paymentConfirmed: boolean;
  paymentStatusLabel: string;
  unitAmount: number;
  expectedAmount: number;
  collectedAmount: number;
  likesCount: number;
  votesCount: number;
  commentsCount: number;
  interactingStudents: SubmissionInteractionRow[];
};

type ReportCourse = {
  name: string;
  companyName: string;
  companyCategory: string;
  isPaid: boolean;
  priceLabel: string | null;
  enrollments: Array<{
    paymentStatus: string;
  }>;
};

type CategorySummary = {
  label: string;
  totalCount: number;
  paidCount: number;
  unitAmount: number;
  expectedTotal: number;
  totalCollected: number;
};

type CourseSummary = {
  name: string;
  companyName: string;
  companyCategory: string;
  enrolledCount: number;
  confirmedCount: number;
  unitAmount: number;
  expectedTotal: number;
  totalCollected: number;
  priceLabel: string;
};

function escapeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function submissionTypeLabel(type: string) {
  if (type === "BUSINESS") return "Negócio";
  if (type === "PRODUCT") return "Produto";
  return "Projeto";
}

function submissionStatusLabel(status: string) {
  if (status === "APPROVED") return "Aprovado";
  if (status === "REJECTED") return "Recusado";
  return "Pendente";
}

function interactionLabel(actions: Set<string>) {
  return Array.from(actions)
    .map((action) => {
      if (action === "like") return "Like";
      if (action === "vote") return "Voto";
      return "Comentário";
    })
    .join(", ");
}

function collectInteractingStudents(submission: ReportSubmission): SubmissionInteractionRow[] {
  const interactingStudents = new Map<number, ReportStudent>();

  for (const like of submission.studentLikes) {
    const profile = normalizeStudentProfile(like.student);
    const student = interactingStudents.get(like.student.id) ?? {
      id: like.student.id,
      name: profile.name ?? `Estudante ${like.student.studentNumber}`,
      course: profile.course ?? null,
      actions: new Set<string>(),
    };
    student.actions.add("like");
    interactingStudents.set(like.student.id, student);
  }

  for (const vote of submission.studentVotes) {
    const profile = normalizeStudentProfile(vote.student);
    const student = interactingStudents.get(vote.student.id) ?? {
      id: vote.student.id,
      name: profile.name ?? `Estudante ${vote.student.studentNumber}`,
      course: profile.course ?? null,
      actions: new Set<string>(),
    };
    student.actions.add("vote");
    interactingStudents.set(vote.student.id, student);
  }

  for (const comment of submission.studentComments) {
    const profile = normalizeStudentProfile(comment.student);
    const student = interactingStudents.get(comment.student.id) ?? {
      id: comment.student.id,
      name: profile.name ?? `Estudante ${comment.student.studentNumber}`,
      course: profile.course ?? null,
      actions: new Set<string>(),
    };
    student.actions.add("comment");
    interactingStudents.set(comment.student.id, student);
  }

  return Array.from(interactingStudents.values())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((student) => ({
      name: student.name,
      course: student.course ?? null,
      actionsLabel: interactionLabel(student.actions),
    }));
}

function buildDetailedSubmissions(submissions: ReportSubmission[], unitAmount: number): DetailedSubmission[] {
  return submissions.map((submission, index) => ({
    index: index + 1,
    referenceCode: submission.referenceCode,
    name: submission.name,
    typeLabel: submissionTypeLabel(submission.type),
    statusLabel: submissionStatusLabel(submission.status),
    area: submission.area,
    course: submission.course ?? null,
    members: submission.members,
    leaderPhone: submission.leaderPhone ?? null,
    description: escapeText(submission.description),
    createdAtLabel: formatDateLabel(submission.createdAt),
    paymentConfirmed: isPaymentConfirmedByAdmin(submission.paymentStatus),
    paymentStatusLabel: financialPaymentStatusLabel(submission.paymentStatus, true),
    unitAmount,
    expectedAmount: unitAmount,
    collectedAmount: isPaymentConfirmedByAdmin(submission.paymentStatus) ? unitAmount : 0,
    likesCount: submission.studentLikes.length,
    votesCount: submission.studentVotes.length,
    commentsCount: submission.studentComments.length,
    interactingStudents: collectInteractingStudents(submission),
  }));
}

function buildCategorySummaries(submissions: DetailedSubmission[], unitAmount: number): CategorySummary[] {
  const categories = [
    { typeLabel: "Projeto", label: "Projetos" },
    { typeLabel: "Produto", label: "Produtos" },
    { typeLabel: "Negócio", label: "Negócios" },
  ] as const;

  return categories.map((category) => {
    const matching = submissions.filter((submission) => submission.typeLabel === category.typeLabel);
    const paidCount = matching.filter((submission) => submission.paymentConfirmed).length;

    return {
      label: category.label,
      totalCount: matching.length,
      paidCount,
      unitAmount,
      expectedTotal: multiplyMoney(unitAmount, matching.length),
      totalCollected: multiplyMoney(unitAmount, paidCount),
    };
  });
}

function buildCourseSummaries(courses: ReportCourse[]): CourseSummary[] {
  return courses.map((course) => {
    const unitAmount = course.isPaid ? parseReportMoney(course.priceLabel) : 0;
    const enrolledCount = course.enrollments.length;
    const confirmedCount = course.enrollments.filter((enrollment) =>
      isPaymentConfirmedByAdmin(enrollment.paymentStatus),
    ).length;

    return {
      name: course.name,
      companyName: course.companyName,
      companyCategory: course.companyCategory,
      enrolledCount,
      confirmedCount,
      unitAmount,
      expectedTotal: multiplyMoney(unitAmount, enrolledCount),
      totalCollected: multiplyMoney(unitAmount, confirmedCount),
      priceLabel: course.isPaid ? course.priceLabel || formatCurrency(unitAmount) : "Gratuito",
    };
  });
}

function renderCategoryRows(categorySummaries: CategorySummary[]) {
  return categorySummaries.map((summary) => `
    <tr>
      <td>${escapeHtml(summary.label)}</td>
      <td class="number-cell">${summary.totalCount}</td>
      <td class="number-cell">${summary.paidCount}</td>
      <td class="number-cell">${escapeHtml(formatCurrency(summary.unitAmount))}</td>
      <td class="number-cell">${escapeHtml(formatCurrency(summary.expectedTotal))}</td>
      <td class="number-cell highlight-cell">${escapeHtml(formatCurrency(summary.totalCollected))}</td>
    </tr>
  `).join("");
}

function renderCourseRows(courseSummaries: CourseSummary[]) {
  if (courseSummaries.length === 0) {
    return `
      <tr>
        <td colspan="7">Sem cursos registados neste relatório.</td>
      </tr>
    `;
  }

  return courseSummaries.map((summary) => `
    <tr>
      <td>${escapeHtml(summary.name)}</td>
      <td>${escapeHtml(summary.companyName)}</td>
      <td>${escapeHtml(summary.companyCategory)}</td>
      <td class="number-cell">${summary.enrolledCount}</td>
      <td class="number-cell">${summary.confirmedCount}</td>
      <td class="number-cell">${escapeHtml(summary.priceLabel)}</td>
      <td class="number-cell highlight-cell">${escapeHtml(formatCurrency(summary.totalCollected))}</td>
    </tr>
  `).join("");
}

function renderChartRows(rows: Array<{ label: string; value: string; percent: number; color: string }>) {
  return rows.map((row) => `
    <div class="bar-row">
      <div class="bar-row__label"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong></div>
      <div class="bar-track"><span class="bar-fill" style="width:${row.percent <= 0 ? 0 : Math.max(4, Math.min(100, row.percent))}%; background:${escapeHtml(row.color)};"></span></div>
    </div>
  `).join("");
}

function renderReportHeader(logoMarkup: string, title: string) {
  return `
    <header class="header">
      <div>${logoMarkup}</div>
      <div class="doc-kicker">
        <strong>${escapeHtml(title)}</strong>
        UOR Connect · Administração
      </div>
    </header>
  `;
}

function renderReportFooter(reportNumber: string, pageNumber: number, totalPages: number) {
  return `
    <div class="page-footer">
      <span>${escapeHtml(reportNumber)} · Documento administrativo emitido pelo sistema UOR Connect.</span>
      <span>Página <strong>${pageNumber}</strong> de <strong>${totalPages}</strong></span>
    </div>
  `;
}

function renderSubmissionInteractionRows(submission: DetailedSubmission) {
  if (submission.interactingStudents.length === 0) {
    return `
      <tr>
        <td colspan="3">Sem interações registadas para esta submissão.</td>
      </tr>
    `;
  }

  return submission.interactingStudents.map((student) => `
    <tr>
      <td>${escapeHtml(student.name)}</td>
      <td>${escapeHtml(student.course ?? "Curso não informado")}</td>
      <td>${escapeHtml(student.actionsLabel)}</td>
    </tr>
  `).join("");
}

function buildSubmissionDetailPages(params: {
  submissions: DetailedSubmission[];
  logoMarkup: string;
  reportNumber: string;
  firstPageNumber: number;
  totalPages: number;
}) {
  if (params.submissions.length === 0) {
    return `
      <!-- ══════════ PAGE 3 — Submissões Detalhadas ══════════ -->
      <section class="page">
        <div class="page-content">
          ${renderReportHeader(params.logoMarkup, "Submissões Detalhadas")}
          <div class="section-card" style="margin-top: 14mm;">
            <p class="eyebrow">Detalhamento</p>
            <h2>Nenhuma submissão registada</h2>
            <p class="lead-copy">Ainda não existem candidaturas para detalhar neste relatório.</p>
          </div>
          ${renderReportFooter(params.reportNumber, params.firstPageNumber, params.totalPages)}
        </div>
      </section>
    `;
  }

  return params.submissions.map((submission, index) => `
    <!-- ══════════ PAGE ${params.firstPageNumber + index} — Submissão ${submission.index.toString().padStart(2, "0")} ══════════ -->
    <section class="page">
      <div class="page-content">
        ${renderReportHeader(params.logoMarkup, "Submissão Detalhada")}
        <div class="section-card" style="margin-top: 12mm;">
          <p class="eyebrow">Detalhamento</p>
          <div class="submission-heading">
            <div>
              <span class="submission-index">#${submission.index.toString().padStart(2, "0")}</span>
              <h2>${escapeHtml(submission.name)}</h2>
              <p>${escapeHtml(submission.typeLabel)} · ${escapeHtml(submission.referenceCode)}</p>
            </div>
            <span class="status-pill ${submission.paymentConfirmed ? "status-pill--paid" : "status-pill--pending"}">
              ${escapeHtml(submission.paymentStatusLabel)}
            </span>
          </div>
          <div class="info-strip info-strip--three">
            <div class="info-box"><span>Estado</span><strong>${escapeHtml(submission.statusLabel)}</strong></div>
            <div class="info-box"><span>Área</span><strong>${escapeHtml(submission.area || "Não informada")}</strong></div>
            <div class="info-box"><span>Curso</span><strong>${escapeHtml(submission.course ?? "Não informado")}</strong></div>
            <div class="info-box"><span>Criado em</span><strong>${escapeHtml(submission.createdAtLabel)}</strong></div>
            <div class="info-box"><span>Contacto</span><strong>${escapeHtml(submission.leaderPhone || "Sem telefone")}</strong></div>
            <div class="info-box"><span>Grupo</span><strong>${escapeHtml(submission.members || "Sem equipa")}</strong></div>
          </div>
          <div class="description-box">
            <span>Descrição</span>
            <p>${escapeHtml(submission.description || "Sem descrição")}</p>
          </div>
        </div>

        <div class="rules-grid">
          <div class="rule-card"><span class="rule-label">Likes</span><h3>${submission.likesCount}</h3><p>Total de likes registados.</p></div>
          <div class="rule-card"><span class="rule-label">Votos</span><h3>${submission.votesCount}</h3><p>Votos associados à submissão.</p></div>
          <div class="rule-card"><span class="rule-label">Comentários</span><h3>${submission.commentsCount}</h3><p>Comentários recebidos.</p></div>
          <div class="rule-card"><span class="rule-label">Arrecadado</span><h3>${escapeHtml(formatCurrency(submission.collectedAmount))}</h3><p>Valor confirmado para este item.</p></div>
        </div>

        ${renderReportFooter(params.reportNumber, params.firstPageNumber + index, params.totalPages)}
      </div>
    </section>
  `).join("");
}

function buildCourseSummaryPage(params: {
  courseSummaries: CourseSummary[];
  logoMarkup: string;
  reportNumber: string;
  pageNumber: number;
  totalPages: number;
}) {
  const totalEnrollments = params.courseSummaries.reduce((sum, course) => sum + course.enrolledCount, 0);
  const totalConfirmed = params.courseSummaries.reduce((sum, course) => sum + course.confirmedCount, 0);
  const totalExpected = sumMoney(params.courseSummaries.map((course) => course.expectedTotal));
  const totalCollected = sumMoney(params.courseSummaries.map((course) => course.totalCollected));

  return `
    <!-- ══════════ PAGE ${params.pageNumber} — Cursos e Inscrições ══════════ -->
    <section class="page">
      <div class="page-content">
        ${renderReportHeader(params.logoMarkup, "Cursos e Inscrições")}
        <div class="section-card" style="margin-top: 14mm;">
          <p class="eyebrow">Cursos</p>
          <h2>Inscrições e arrecadação por curso</h2>
          <table class="score-table compact-table">
            <thead>
              <tr>
                <th>Curso</th>
                <th>Empresa</th>
                <th>Categoria</th>
                <th>Inscritos</th>
                <th>Confirmados</th>
                <th>Valor</th>
                <th>Arrecadado</th>
              </tr>
            </thead>
            <tbody>${renderCourseRows(params.courseSummaries)}</tbody>
            <tfoot>
              <tr>
                <td colspan="3">Total dos cursos</td>
                <td class="number-cell">${totalEnrollments}</td>
                <td class="number-cell">${totalConfirmed}</td>
                <td class="number-cell">${escapeHtml(formatCurrency(totalExpected))}</td>
                <td class="number-cell highlight-cell">${escapeHtml(formatCurrency(totalCollected))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="rules-grid">
          <div class="rule-card"><span class="rule-label">Inscritos</span><h3>${totalEnrollments}</h3><p>Total de inscrições recebidas nos cursos.</p></div>
          <div class="rule-card"><span class="rule-label">Arrecadação</span><h3>${escapeHtml(formatCurrency(totalCollected))}</h3><p>Valor confirmado nos cursos pagos.</p></div>
        </div>
        ${renderReportFooter(params.reportNumber, params.pageNumber, params.totalPages)}
      </div>
    </section>
  `;
}

function buildRejectedSubmissionSummaryPage(params: {
  rejectedSubmissions: DetailedSubmission[];
  logoMarkup: string;
  reportNumber: string;
  pageNumber: number;
  totalPages: number;
}) {
  const rows = params.rejectedSubmissions.length === 0
    ? `<tr><td colspan="6">Sem projetos recusados neste relatório.</td></tr>`
    : params.rejectedSubmissions.map((submission) => `
      <tr>
        <td>${escapeHtml(submission.referenceCode)}</td>
        <td>${escapeHtml(submission.name)}</td>
        <td>${escapeHtml(submission.typeLabel)}</td>
        <td>${escapeHtml(submission.area || "Não informada")}</td>
        <td>${escapeHtml(submission.createdAtLabel)}</td>
        <td>${escapeHtml(submission.paymentStatusLabel)}</td>
      </tr>
    `).join("");

  return `
    <!-- ══════════ PAGE ${params.pageNumber} — Projetos Recusados ══════════ -->
    <section class="page">
      <div class="page-content">
        ${renderReportHeader(params.logoMarkup, "Projetos Recusados")}
        <div class="section-card" style="margin-top: 14mm;">
          <p class="eyebrow">Resumo compacto</p>
          <h2>Projetos recusados</h2>
          <p class="lead-copy">Estes itens aparecem de forma resumida para não ocupar o mesmo espaço dos aprovados ou pendentes.</p>
          <table class="score-table compact-table">
            <thead>
              <tr><th>Referência</th><th>Projeto</th><th>Tipo</th><th>Área</th><th>Submissão</th><th>Pagamento</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${renderReportFooter(params.reportNumber, params.pageNumber, params.totalPages)}
      </div>
    </section>
  `;
}

function buildSubmissionInteractionPages(params: {
  submissions: DetailedSubmission[];
  logoMarkup: string;
  reportNumber: string;
  firstPageNumber: number;
  totalPages: number;
}) {
  if (params.submissions.length === 0) {
    return `
      <!-- ══════════ PAGE ${params.firstPageNumber} — Interações ══════════ -->
      <section class="page">
        <div class="page-content">
          ${renderReportHeader(params.logoMarkup, "Interações dos Estudantes")}
          <div class="section-card" style="margin-top: 14mm;">
            <p class="eyebrow">Últimas páginas</p>
            <h2>Estudantes que interagiram</h2>
            <p class="lead-copy">Ainda não existem interações para listar.</p>
          </div>
          ${renderReportFooter(params.reportNumber, params.firstPageNumber, params.totalPages)}
        </div>
      </section>
    `;
  }

  return params.submissions.map((submission, index) => `
    <!-- ══════════ PAGE ${params.firstPageNumber + index} — Interações ${submission.index.toString().padStart(2, "0")} ══════════ -->
    <section class="page">
      <div class="page-content">
        ${renderReportHeader(params.logoMarkup, "Interações dos Estudantes")}
        <div class="section-card" style="margin-top: 14mm;">
          <p class="eyebrow">Últimas páginas</p>
          <h2>Estudantes que interagiram · ${escapeHtml(submission.name)}</h2>
          <table class="score-table">
            <thead>
              <tr><th>Estudante</th><th>Curso</th><th>Ações registadas</th></tr>
            </thead>
            <tbody>${renderSubmissionInteractionRows(submission)}</tbody>
          </table>
        </div>
        ${renderReportFooter(params.reportNumber, params.firstPageNumber + index, params.totalPages)}
      </div>
    </section>
  `).join("");
}

export function buildReportHtml(params: {
  logoDataUri: string | null;
  generatedAt: Date;
  reportNumber: string;
  paymentAmountLabel: string;
  unitAmount: number;
  totalSubmissions: number;
  totalPaidSubmissions: number;
  totalExpected: number;
  totalCollected: number;
  categorySummaries: CategorySummary[];
  courseSummaries: CourseSummary[];
  detailedSubmissions: DetailedSubmission[];
}) {
  const {
    logoDataUri,
    generatedAt,
    reportNumber,
    paymentAmountLabel,
    unitAmount,
    totalSubmissions,
    totalPaidSubmissions,
    totalExpected,
    totalCollected,
    categorySummaries,
    courseSummaries,
    detailedSubmissions,
  } = params;

  const logoMarkup = logoDataUri
    ? `<img src="${logoDataUri}" alt="UOR Connect" class="brand-logo" />`
    : `<div class="brand-fallback"><strong>UOR Connect</strong></div>`;
  const activeDetailedSubmissions = detailedSubmissions.filter((submission) => submission.statusLabel !== "Recusado");
  const rejectedSubmissions = detailedSubmissions.filter((submission) => submission.statusLabel === "Recusado");
  const metrics = calculateOverviewReportMetrics({
    submissions: detailedSubmissions.map((submission) => ({
      statusLabel: submission.statusLabel,
      paymentConfirmed: submission.paymentConfirmed,
      expectedAmount: submission.expectedAmount,
      collectedAmount: submission.collectedAmount,
      likesCount: submission.likesCount,
      votesCount: submission.votesCount,
      commentsCount: submission.commentsCount,
    })),
    courses: courseSummaries.map((course) => ({
      enrolledCount: course.enrolledCount,
      confirmedCount: course.confirmedCount,
      expectedTotal: course.expectedTotal,
      totalCollected: course.totalCollected,
    })),
  });
  const detailPageCount = Math.max(1, activeDetailedSubmissions.length);
  const coursePageNumber = 3;
  const detailFirstPageNumber = 4;
  const rejectedPageNumber = detailFirstPageNumber + detailPageCount;
  const interactionFirstPageNumber = rejectedPageNumber + 1;
  const interactionPageCount = Math.max(1, activeDetailedSubmissions.length);
  const totalPages = interactionFirstPageNumber + interactionPageCount - 1;
  const growthRows = renderChartRows(buildBarChartRows([
    { label: "Candidaturas válidas", amount: metrics.activeSubmissions, value: String(metrics.activeSubmissions), color: "#fd8305" },
    { label: "Candidaturas aprovadas", amount: metrics.approvedSubmissions, value: String(metrics.approvedSubmissions), color: "#4aa391" },
    { label: "Inscrições em cursos", amount: metrics.totalCourseEnrollments, value: String(metrics.totalCourseEnrollments), color: "#2563eb" },
    { label: "Interações registadas", amount: metrics.totalInteractions, value: String(metrics.totalInteractions), color: "#7c3aed" },
  ]));
  const financeRows = renderChartRows(buildBarChartRows([
    { label: "Candidaturas previstas", amount: metrics.totalSubmissionExpected, value: formatCurrency(metrics.totalSubmissionExpected), color: "#223d42" },
    { label: "Candidaturas arrecadadas", amount: metrics.totalSubmissionCollected, value: formatCurrency(metrics.totalSubmissionCollected), color: "#fd8305" },
    { label: "Cursos previstos", amount: metrics.totalCourseExpected, value: formatCurrency(metrics.totalCourseExpected), color: "#2563eb" },
    { label: "Cursos arrecadados", amount: metrics.totalCourseCollected, value: formatCurrency(metrics.totalCourseCollected), color: "#4aa391" },
  ]));
  const coursePage = buildCourseSummaryPage({
    courseSummaries,
    logoMarkup,
    reportNumber,
    pageNumber: coursePageNumber,
    totalPages,
  });
  const detailPages = buildSubmissionDetailPages({
    submissions: activeDetailedSubmissions,
    logoMarkup,
    reportNumber,
    firstPageNumber: detailFirstPageNumber,
    totalPages,
  });
  const rejectedPage = buildRejectedSubmissionSummaryPage({
    rejectedSubmissions,
    logoMarkup,
    reportNumber,
    pageNumber: rejectedPageNumber,
    totalPages,
  });
  const interactionPages = buildSubmissionInteractionPages({
    submissions: activeDetailedSubmissions,
    logoMarkup,
    reportNumber,
    firstPageNumber: interactionFirstPageNumber,
    totalPages,
  });

  return `<!doctype html>
<html lang="pt-AO">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(reportNumber)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { color: #152434; font-family: Inter, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; padding: 14mm 15mm 12mm; position: relative; overflow: hidden; background: linear-gradient(180deg, #fffdfa 0%, #fff 44%, #f8fbfa 100%); page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .page::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 5mm; background: linear-gradient(90deg, #fd8305 0%, #223d42 72%, #4aa391 100%); }
  .page::after { content: ""; position: absolute; left: 15mm; right: 15mm; top: 11mm; height: 1px; background: rgba(34,61,66,.08); }
  .page-content { position: relative; z-index: 1; min-height: calc(297mm - 26mm); display: flex; flex-direction: column; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; padding-top: 6mm; }
  .brand-logo { width: 43mm; max-height: 20mm; object-fit: contain; display: block; }
  .brand-fallback { font-size: 18px; font-weight: 900; color: #223d42; }
  .doc-kicker { text-align: right; color: #61707f; font-size: 10px; line-height: 1.45; }
  .doc-kicker strong { display: block; color: #152434; font-size: 12px; font-weight: 750; }
  h1, h2, h3, p { margin: 0; }
  .eyebrow { margin: 0 0 3mm; color: #fd8305; font-size: 10px; font-weight: 800; letter-spacing: 0; text-transform: uppercase; }
  .hero-section { margin-top: 12mm; }
  .hero-section h1 { font-size: 26px; line-height: 1.12; font-weight: 830; color: #152434; }
  .hero-section .lead, .lead-copy { margin-top: 4mm; color: #344958; font-size: 12px; line-height: 1.55; max-width: 155mm; }
  .info-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 8mm; }
  .info-strip--three { grid-template-columns: repeat(3, 1fr); }
  .info-box { border-top: 1.5px solid #dbe5e3; padding-top: 2.5mm; }
  .info-box span { display: block; color: #61707f; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .info-box strong { display: block; margin-top: 1mm; font-size: 11px; line-height: 1.3; font-weight: 730; color: #152434; word-break: break-word; }
  .section-card { margin-top: 6mm; border: 1px solid #dbe5e3; border-radius: 4mm; padding: 4.5mm 5mm; background: #fbfdfc; }
  .section-card h2 { font-size: 14px; font-weight: 800; color: #152434; margin-bottom: 2.5mm; }
  .rules-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3.5mm; margin-top: 6mm; }
  .rule-card { border: .3mm solid rgba(34,61,66,.08); border-radius: 4mm; padding: 4mm; background: #fff; min-height: 26mm; }
  .rule-card .rule-label { display: block; color: #fd8305; font-size: 8px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 1.5mm; }
  .rule-card h3 { margin: 0 0 1.5mm; font-size: 16px; font-weight: 820; color: #152434; }
  .rule-card p { margin: 0; color: #344958; font-size: 10px; line-height: 1.45; }
  .chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4mm; margin-top: 7mm; }
  .chart-card { border: 1px solid #dbe5e3; border-radius: 4mm; padding: 4.5mm; background: #fff; break-inside: avoid; }
  .chart-card h2 { margin: 0; color: #152434; font-size: 13px; font-weight: 850; }
  .chart-card p { margin-top: 1.5mm; color: #61707f; font-size: 9.5px; line-height: 1.45; }
  .bar-row { margin-top: 3mm; }
  .bar-row__label { display: flex; align-items: baseline; justify-content: space-between; gap: 4mm; color: #344958; font-size: 9.2px; }
  .bar-row__label strong { color: #152434; font-size: 9.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bar-track { margin-top: 1.4mm; height: 3mm; border-radius: 999px; background: #edf3f1; overflow: hidden; }
  .bar-fill { display: block; height: 100%; border-radius: inherit; }
  .score-table { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 10px; }
  .score-table th { text-align: left; padding: 2.5mm 3mm; background: #223d42; color: #fff; font-weight: 750; font-size: 9px; letter-spacing: .04em; text-transform: uppercase; }
  .score-table td { padding: 2.5mm 3mm; border-bottom: 1px solid #e2ebe9; color: #344958; font-size: 10px; line-height: 1.45; }
  .compact-table th { padding: 2mm 2.2mm; font-size: 7.8px; }
  .compact-table td { padding: 2mm 2.2mm; font-size: 8.6px; line-height: 1.35; }
  .score-table tfoot td { background: #223d42; color: #fff; font-weight: 800; }
  .number-cell { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .highlight-cell { color: #fd8305 !important; font-weight: 850; }
  .status-pill { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 2mm 3mm; font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
  .status-pill--paid { background: #dcfce7; color: #166534; }
  .status-pill--pending { background: #fff7ed; color: #9a3412; }
  .submission-heading { display: flex; justify-content: space-between; gap: 6mm; align-items: flex-start; }
  .submission-heading p { color: #61707f; font-size: 10px; }
  .submission-index { display: inline-flex; margin-bottom: 2mm; color: #fd8305; font-size: 10px; font-weight: 900; letter-spacing: .08em; }
  .description-box { margin-top: 4mm; border: .3mm solid rgba(34,61,66,.08); border-radius: 3.5mm; padding: 3mm; background: #fff; }
  .description-box span { color: #61707f; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
  .description-box p { margin-top: 1mm; color: #344958; font-size: 10px; line-height: 1.5; }
  .page-footer { margin-top: auto; padding-top: 5mm; border-top: 1px solid #dbe5e3; display: flex; justify-content: space-between; align-items: flex-end; color: #61707f; font-size: 8.5px; }
  .page-footer strong { color: #152434; }
</style>
</head>
<body>
  <!-- ══════════ PAGE 1 — Crescimento e Finanças ══════════ -->
  <section class="page">
    <div class="page-content">
      ${renderReportHeader(logoMarkup, "Relatório Geral da Administração")}
      <div class="hero-section">
        <p class="eyebrow">Crescimento e finanças</p>
        <h1>Relatório Geral da Administração</h1>
        <p class="lead">Resumo visual de operação, candidaturas, cursos, interações e arrecadação. A primeira página prioriza leitura executiva para acompanhar crescimento e saúde financeira sem procurar os dados no fim do documento.</p>
      </div>
      <div class="info-strip">
        <div class="info-box"><span>Relatório</span><strong>${escapeHtml(reportNumber)}</strong></div>
        <div class="info-box"><span>Gerado em</span><strong>${escapeHtml(formatDateLabel(generatedAt))}</strong></div>
        <div class="info-box"><span>Crescimento</span><strong>${metrics.activeSubmissions + metrics.totalCourseEnrollments} registos</strong></div>
        <div class="info-box"><span>Total arrecadado</span><strong>${escapeHtml(formatCurrency(metrics.combinedCollected))}</strong></div>
      </div>
      <div class="chart-grid">
        <div class="chart-card">
          <h2>Gráfico de crescimento</h2>
          <p>Candidaturas, aprovações, cursos e interações em leitura comparativa.</p>
          ${growthRows}
        </div>
        <div class="chart-card">
          <h2>Gráfico financeiro</h2>
          <p>Valores previstos e arrecadados em candidaturas e cursos pagos.</p>
          ${financeRows}
        </div>
      </div>
      <div class="rules-grid">
        <div class="rule-card"><span class="rule-label">Candidaturas válidas</span><h3>${metrics.activeSubmissions}</h3><p>Itens ativos no cálculo financeiro; recusados ficam em resumo próprio.</p></div>
        <div class="rule-card"><span class="rule-label">Cursos</span><h3>${metrics.totalCourseEnrollments}</h3><p>Inscrições recebidas nos cursos.</p></div>
        <div class="rule-card"><span class="rule-label">Aprovação</span><h3>${metrics.approvalRatePercent}%</h3><p>${metrics.approvedSubmissions} candidatura(s) aprovadas.</p></div>
        <div class="rule-card"><span class="rule-label">Cobertura financeira</span><h3>${metrics.financialCoveragePercent}%</h3><p>${escapeHtml(formatCurrency(metrics.combinedCollected))} confirmados sobre ${escapeHtml(formatCurrency(metrics.combinedExpected))} previstos.</p></div>
      </div>
      ${renderReportFooter(reportNumber, 1, totalPages)}
    </div>
  </section>

  <!-- ══════════ PAGE 2 — Financeiro e Categorias ══════════ -->
  <section class="page">
    <div class="page-content">
      ${renderReportHeader(logoMarkup, "Financeiro e Categorias")}
      <div class="section-card" style="margin-top: 14mm;">
        <p class="eyebrow">Financeiro</p>
        <h2>Resumo financeiro por categoria</h2>
        <table class="score-table">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Total</th>
              <th>Confirmados</th>
              <th>Valor unitário</th>
              <th>Total bruto</th>
              <th>Total arrecadado</th>
            </tr>
          </thead>
          <tbody>${renderCategoryRows(categorySummaries)}</tbody>
          <tfoot>
            <tr>
              <td>Total geral</td>
              <td class="number-cell">${metrics.activeSubmissions}</td>
              <td class="number-cell">${metrics.paidSubmissions}</td>
              <td class="number-cell">${escapeHtml(formatCurrency(unitAmount))}</td>
              <td class="number-cell">${escapeHtml(formatCurrency(metrics.totalSubmissionExpected))}</td>
              <td class="number-cell highlight-cell">${escapeHtml(formatCurrency(metrics.totalSubmissionCollected))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="rules-grid">
        <div class="rule-card"><span class="rule-label">Fila financeira</span><h3>${metrics.pendingFinancialCount}</h3><p>Candidatura(s) ativa(s) ainda sem pagamento confirmado pela organização.</p></div>
        <div class="rule-card"><span class="rule-label">Valor unitário</span><h3>${escapeHtml(formatCurrency(unitAmount))}</h3><p>Valor configurado atualmente na plataforma: ${escapeHtml(paymentAmountLabel)}.</p></div>
      </div>
      ${renderReportFooter(reportNumber, 2, totalPages)}
    </div>
  </section>

  ${coursePage}
  ${detailPages}
  ${rejectedPage}
  ${interactionPages}
</body>
</html>`;
}

export async function reportsRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);
    setDefaultAdminPermission(adminApp, ["OVERVIEW"]);

    const generateOverviewPdf = async () => {
      const generatedAt = new Date();

      const [submissions, courses, submissionConfig, logo] = await Promise.all([
        prisma.submission.findMany({
          where: { deletedAt: null },
          include: {
            studentLikes: {
              include: { student: true },
              orderBy: { createdAt: "desc" },
            },
            studentVotes: {
              include: { student: true },
              orderBy: { createdAt: "desc" },
            },
            studentComments: {
              include: { student: true },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: [
            { type: "asc" },
            { createdAt: "desc" },
          ],
        }),
        prisma.course.findMany({
          include: {
            enrollments: {
              select: {
                paymentStatus: true,
              },
            },
          },
          orderBy: [
            { sortOrder: "asc" },
            { createdAt: "desc" },
          ],
        }),
        prisma.submissionConfig.findUnique({
          where: { key: "default" },
        }),
        loadLogoDataUri(),
      ]);

      const paymentAmountLabel = submissionConfig?.paymentAmount ?? "0 Kz";
      const unitAmount = parseReportMoney(paymentAmountLabel);

      const reportSubmissions: ReportSubmission[] = submissions.map((submission) => ({
        referenceCode: submission.referenceCode,
        name: submission.name,
        type: submission.type,
        status: submission.status,
        area: submission.area,
        course: submission.course ?? null,
        members: formatTeamMembersLabel(normalizeTeamMembersInput(submission.members)),
        leaderPhone: submission.leaderPhone ?? null,
        description: submission.description,
        createdAt: submission.createdAt,
        paymentConfirmed: submission.paymentConfirmed,
        paymentStatus: submission.paymentStatus ?? null,
        studentLikes: submission.studentLikes.map((entry) => ({
          student: {
            id: entry.student.id,
            studentNumber: entry.student.studentNumber,
            name: entry.student.name,
            course: entry.student.course,
          },
        })),
        studentVotes: submission.studentVotes.map((entry) => ({
          student: {
            id: entry.student.id,
            studentNumber: entry.student.studentNumber,
            name: entry.student.name,
            course: entry.student.course,
          },
        })),
        studentComments: submission.studentComments.map((entry) => ({
          student: {
            id: entry.student.id,
            studentNumber: entry.student.studentNumber,
            name: entry.student.name,
            course: entry.student.course,
          },
        })),
      }));

      const detailedSubmissions = buildDetailedSubmissions(reportSubmissions, unitAmount);
      const activeDetailedSubmissions = detailedSubmissions.filter((submission) => submission.statusLabel !== "Recusado");
      const categorySummaries = buildCategorySummaries(activeDetailedSubmissions, unitAmount);
      const courseSummaries = buildCourseSummaries(courses.map((course) => ({
        name: course.name,
        companyName: course.companyName,
        companyCategory: course.companyCategory,
        isPaid: course.isPaid,
        priceLabel: course.priceLabel ?? null,
        enrollments: course.enrollments.map((enrollment) => ({
          paymentStatus: enrollment.paymentStatus,
        })),
      })));
      const totalSubmissions = activeDetailedSubmissions.length;
      const totalPaidSubmissions = activeDetailedSubmissions.filter((submission) => submission.paymentConfirmed).length;
      const totalExpected = sumMoney(categorySummaries.map((summary) => summary.expectedTotal));
      const totalCollected = sumMoney(categorySummaries.map((summary) => summary.totalCollected));
      const reportNumber = `REL-${generatedAt.toISOString().slice(0, 10)}`;

      const html = buildReportHtml({
        logoDataUri: logo,
        generatedAt,
        reportNumber,
        paymentAmountLabel,
        unitAmount,
        totalSubmissions,
        totalPaidSubmissions,
        totalExpected,
        totalCollected,
        categorySummaries,
        courseSummaries,
        detailedSubmissions,
      });

      const pdfBuffer = await renderPdfFromHtml(html, {
        preferCssPageSize: true,
        displayHeaderFooter: false,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      const fileName = `uor-connect-relatorio-geral-${generatedAt.toISOString().slice(0, 10)}.pdf`;
      return { pdfBuffer, fileName };
    };
    const buildOverviewPdfSnapshot = async () => {
      const [submissions, likes, votes, comments, courses, courseEnrollments, config] = await Promise.all([
        prisma.submission.aggregate({ where: { deletedAt: null }, _count: { _all: true }, _max: { updatedAt: true } }),
        prisma.studentLike.aggregate({ _count: { _all: true }, _max: { createdAt: true } }),
        prisma.studentVote.aggregate({ _count: { _all: true }, _max: { createdAt: true } }),
        prisma.studentComment.aggregate({ _count: { _all: true }, _max: { createdAt: true } }),
        prisma.course.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
        prisma.courseEnrollment.aggregate({ _count: { _all: true }, _max: { createdAt: true, paymentReviewedAt: true } }),
        prisma.submissionConfig.findUnique({ where: { key: "default" }, select: { paymentAmount: true, updatedAt: true } }),
      ]);

      return {
        report: "overview",
        submissions: {
          count: submissions._count._all,
          maxUpdatedAt: submissions._max.updatedAt?.toISOString() ?? null,
        },
        likes: {
          count: likes._count._all,
          maxCreatedAt: likes._max.createdAt?.toISOString() ?? null,
        },
        votes: {
          count: votes._count._all,
          maxCreatedAt: votes._max.createdAt?.toISOString() ?? null,
        },
        comments: {
          count: comments._count._all,
          maxCreatedAt: comments._max.createdAt?.toISOString() ?? null,
        },
        courses: {
          count: courses._count._all,
          maxUpdatedAt: courses._max.updatedAt?.toISOString() ?? null,
        },
        courseEnrollments: {
          count: courseEnrollments._count._all,
          maxCreatedAt: courseEnrollments._max.createdAt?.toISOString() ?? null,
          maxReviewedAt: courseEnrollments._max.paymentReviewedAt?.toISOString() ?? null,
        },
        config: {
          paymentAmount: config?.paymentAmount ?? null,
          updatedAt: config?.updatedAt.toISOString() ?? null,
        },
      };
    };
    registerPdfJobHandler("reports.overview", async () => {
      const result = await generateOverviewPdf();
      return {
        buffer: result.pdfBuffer,
        fileName: result.fileName,
        contentType: "application/pdf",
      };
    });

    adminApp.post("/overview/pdf-jobs", async (request, reply) => {
      const snapshot = await buildOverviewPdfSnapshot();
      const version = pdfJobInputHash(snapshot);
      const job = await enqueuePdfJob(opts.env, {
        kind: "reports.overview",
        businessKey: `reports.overview:${version}`,
        fileName: `uor-connect-relatorio-geral-${new Date().toISOString().slice(0, 10)}.pdf`,
        snapshot,
        createdByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
        execute: async () => {
          const result = await generateOverviewPdf();
          return {
            buffer: result.pdfBuffer,
            fileName: result.fileName,
            contentType: "application/pdf",
          };
        },
      });

      return reply.code(202).send({
        ...job,
        statusPath: `/reports/overview/pdf-jobs/${job.id}`,
        filePath: `/reports/overview/pdf-jobs/${job.id}/file`,
      });
    });

    adminApp.get("/overview/pdf-jobs/:id", async (request, reply) => {
      const job = await getPdfJob(opts.env, (request.params as { id: string }).id);
      if (!job) {
        return reply.code(404).send({ message: "Job not found" });
      }

      return reply.send({
        ...job,
        statusPath: `/reports/overview/pdf-jobs/${job.id}`,
        filePath: `/reports/overview/pdf-jobs/${job.id}/file`,
      });
    });

    adminApp.get("/overview/pdf-jobs/:id/file", async (request, reply) => {
      const jobId = (request.params as { id: string }).id;
      const job = await getPdfJob(opts.env, jobId);

      if (!job) {
        return reply.code(404).send({ message: "Job not found" });
      }

      if (job.status !== "completed") {
        return reply.code(409).send({ message: "PDF not ready yet" });
      }

      const result = await getPdfJobResult(opts.env, jobId);
      if (!result) {
        return reply.code(404).send({ message: "Job result not found" });
      }

      reply.header("Content-Type", result.contentType ?? "application/pdf");
      reply.header("Content-Disposition", `attachment; filename=\"${result.fileName}\"`);
      return reply.send(result.buffer);
    });

    adminApp.get("/overview/pdf", async (request, reply) => {
      try {
        const { pdfBuffer, fileName } = await generateOverviewPdf();
        reply.header("Content-Type", "application/pdf");
        reply.header("Content-Disposition", `attachment; filename=\"${fileName}\"`);
        return reply.send(pdfBuffer);
      } catch (error) {
        request.log.error({ err: error }, "overview pdf render failed");
        return reply.status(502).send({
          message: "Falha ao gerar o relatório PDF localmente. Verifica se o Chromium do Playwright está instalado neste ambiente.",
        });
      }
    });
  });
}

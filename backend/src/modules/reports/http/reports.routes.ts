import type { FastifyInstance } from "fastify";
import { prisma } from "../../../shared/prisma";
import { type Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard } from "../../auth/http/admin.middleware";
import { normalizeStudentProfile } from "../../auth/domain/student-format";
import { formatTeamMembersLabel, normalizeTeamMembersInput } from "../../submission/domain/submission-format";
import { escapeHtml, formatDateLabel, loadLogoDataUri, renderPdfFromHtml } from "./pdf-report.utils";
import { enqueuePdfJob, getPdfJob, getPdfJobResult } from "../../../shared/pdf-job-queue";

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

type CategorySummary = {
  label: string;
  totalCount: number;
  paidCount: number;
  unitAmount: number;
  expectedTotal: number;
  totalCollected: number;
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

function parseCurrencyAmount(value?: string | null) {
  const cleaned = (value ?? "")
    .replace(/\s+/g, "")
    .replace(/AOA/gi, "")
    .replace(/[Kk][Zz]/g, "");

  if (!cleaned) return 0;

  const decimalMatch = cleaned.match(/[.,](\d{1,2})$/);
  const hasThousandsOnly = /[.,]\d{3}(?:[.,]\d{3})*$/.test(cleaned);

  if (decimalMatch && !hasThousandsOnly) {
    const decimalSeparator = decimalMatch[0][0];
    const normalized = cleaned
      .replace(decimalSeparator === "," ? /\./g : /,/g, "")
      .replace(decimalSeparator, ".")
      .replace(/[^\d.-]/g, "");

    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const digitsOnly = cleaned.replace(/[^\d-]/g, "");
  const parsed = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) ? parsed : 0;
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

function paymentStatusLabel(paymentConfirmed: boolean) {
  return paymentConfirmed ? "Confirmado" : "Pendente";
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
    paymentConfirmed: submission.paymentConfirmed,
    paymentStatusLabel: paymentStatusLabel(submission.paymentConfirmed),
    unitAmount,
    expectedAmount: unitAmount,
    collectedAmount: submission.paymentConfirmed ? unitAmount : 0,
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
      expectedTotal: matching.length * unitAmount,
      totalCollected: paidCount * unitAmount,
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

function renderSubmissionSections(submissions: DetailedSubmission[]) {
  if (submissions.length === 0) {
    return `
      <section class="section">
        <div class="section-title">
          <span class="section-kicker">Detalhamento</span>
          <h2>Submissões detalhadas</h2>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Sem dados</td>
              <td>Nenhuma submissão registada no período.</td>
            </tr>
          </tbody>
        </table>
      </section>
    `;
  }

  return `
    <section class="section">
      <div class="section-title">
        <span class="section-kicker">Detalhamento</span>
        <h2>Submissões detalhadas</h2>
      </div>
      ${submissions.map((submission) => {
        const studentsRows = submission.interactingStudents.length > 0
          ? submission.interactingStudents.map((student) => `
              <tr>
                <td>${escapeHtml(student.name)}</td>
                <td>${escapeHtml(student.course ?? "Curso não informado")}</td>
                <td>${escapeHtml(student.actionsLabel)}</td>
              </tr>
            `).join("")
          : `
              <tr>
                <td colspan="3">Sem interações registadas para esta submissão.</td>
              </tr>
            `;

        return `
          <article class="submission-card">
            <div class="submission-card__header">
              <div>
                <div class="submission-index">#${submission.index.toString().padStart(2, "0")}</div>
                <h3>${escapeHtml(submission.name)}</h3>
                <p>${escapeHtml(submission.typeLabel)} • ${escapeHtml(submission.referenceCode)}</p>
              </div>
              <div class="status-pill ${submission.paymentConfirmed ? "status-pill--paid" : "status-pill--pending"}">
                Pagamento ${escapeHtml(submission.paymentStatusLabel)}
              </div>
            </div>

            <div class="info-grid">
              <div class="info-card"><span>Referência</span><strong>${escapeHtml(submission.referenceCode)}</strong></div>
              <div class="info-card"><span>Tipo</span><strong>${escapeHtml(submission.typeLabel)}</strong></div>
              <div class="info-card"><span>Estado</span><strong>${escapeHtml(submission.statusLabel)}</strong></div>
              <div class="info-card"><span>Criado em</span><strong>${escapeHtml(submission.createdAtLabel)}</strong></div>
              <div class="info-card"><span>Área</span><strong>${escapeHtml(submission.area || "Não informada")}</strong></div>
              <div class="info-card"><span>Curso</span><strong>${escapeHtml(submission.course ?? "Não informado")}</strong></div>
              <div class="info-card info-card--wide"><span>Grupo</span><strong>${escapeHtml(submission.members || "Sem equipa")}</strong></div>
              <div class="info-card"><span>Contacto</span><strong>${escapeHtml(submission.leaderPhone || "Sem telefone")}</strong></div>
              <div class="info-card info-card--full"><span>Descrição</span><strong>${escapeHtml(submission.description || "Sem descrição")}</strong></div>
            </div>

            <div class="metrics-grid">
              <div class="metric-card"><span>Likes</span><strong>${submission.likesCount}</strong></div>
              <div class="metric-card"><span>Votos</span><strong>${submission.votesCount}</strong></div>
              <div class="metric-card"><span>Comentários</span><strong>${submission.commentsCount}</strong></div>
              <div class="metric-card"><span>Interações</span><strong>${submission.interactingStudents.length}</strong></div>
              <div class="metric-card"><span>Valor unitário</span><strong>${escapeHtml(formatCurrency(submission.unitAmount))}</strong></div>
              <div class="metric-card"><span>Total do item</span><strong>${escapeHtml(formatCurrency(submission.expectedAmount))}</strong></div>
              <div class="metric-card metric-card--highlight"><span>Arrecadado</span><strong>${escapeHtml(formatCurrency(submission.collectedAmount))}</strong></div>
            </div>

            <table class="table">
              <thead>
                <tr>
                  <th>Estudante</th>
                  <th>Curso</th>
                  <th>Ações registadas</th>
                </tr>
              </thead>
              <tbody>
                ${studentsRows}
              </tbody>
            </table>
          </article>
        `;
      }).join("")}
    </section>
  `;
}

function buildReportHtml(params: {
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
    detailedSubmissions,
  } = params;

  const summaryRows = renderCategoryRows(categorySummaries);
  const submissionSections = renderSubmissionSections(detailedSubmissions);
  const logoMarkup = logoDataUri
    ? `<img src="${logoDataUri}" alt="UOR Connect" class="brand-logo" />`
    : `<div class="brand-fallback">UOR</div>`;

  return `
    <!DOCTYPE html>
    <html lang="pt">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(reportNumber)}</title>
        <style>
          @page {
            size: A4;
            margin: 16mm 14mm 18mm;
          }

          :root {
            --brand: #FD8305;
            --brand-dark: #1B2B3A;
            --brand-deep: #223D42;
            --brand-soft: #FFF4E8;
            --brand-border: #F3D8BC;
            --surface: #FFFFFF;
            --surface-alt: #F7F8FA;
            --line: #E7E9EB;
            --text: #152434;
            --muted: #61707F;
            --success-bg: #EAF7EF;
            --success-text: #146C43;
            --warning-bg: #FFF3E8;
            --warning-text: #A65300;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
            color: var(--text);
            background: linear-gradient(180deg, rgba(253, 131, 5, 0.04) 0%, rgba(27, 43, 58, 0.01) 100%);
          }

          .report-shell {
            display: flex;
            flex-direction: column;
            gap: 18px;
          }

          .hero {
            display: grid;
            grid-template-columns: 1fr;
            gap: 14px;
            align-items: stretch;
          }

          .hero-panel,
          .meta-panel,
          .summary-card,
          .submission-card {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 18px;
          }

          .hero-panel {
            position: relative;
            overflow: hidden;
            padding: 24px 26px;
            background:
              radial-gradient(circle at top right, rgba(253, 131, 5, 0.18), transparent 34%),
              linear-gradient(135deg, rgba(253, 131, 5, 0.08), rgba(27, 43, 58, 0.02));
          }

          .hero-panel::after {
            content: "";
            position: absolute;
            inset: auto -80px -90px auto;
            width: 260px;
            height: 260px;
            background: radial-gradient(circle, rgba(34, 61, 66, 0.14), transparent 62%);
          }

          .brand-row {
            display: flex;
            gap: 18px;
            align-items: center;
            position: relative;
            z-index: 1;
          }

          .brand-logo {
            width: 164px;
            height: auto;
            object-fit: contain;
          }

          .brand-fallback {
            width: 100px;
            height: 100px;
            border-radius: 26px;
            background: var(--brand-dark);
            color: white;
            display: grid;
            place-items: center;
            font-size: 34px;
            font-weight: 800;
            letter-spacing: 0.08em;
          }

          .eyebrow {
            margin: 0 0 6px;
            color: var(--brand);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            font-size: 11px;
          }

          h1 {
            margin: 0;
            font-size: 30px;
            line-height: 1.1;
            color: var(--brand-dark);
          }

          .hero-copy p {
            margin: 8px 0 0;
            font-size: 13px;
            line-height: 1.6;
            color: var(--muted);
            max-width: 680px;
          }

          .meta-panel {
            padding: 22px;
            display: grid;
            gap: 12px;
            align-content: start;
            background: linear-gradient(180deg, #ffffff 0%, #fbfcfd 100%);
          }

          .meta-card {
            border: 1px solid var(--line);
            border-radius: 14px;
            padding: 14px 16px;
            background: var(--surface-alt);
          }

          .meta-card span {
            display: block;
            margin-bottom: 4px;
            font-size: 11px;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }

          .meta-card strong {
            display: block;
            font-size: 18px;
            color: var(--brand-dark);
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }

          .summary-card {
            padding: 18px;
            background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
          }

          .summary-card__label {
            margin: 0 0 8px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: var(--muted);
          }

          .summary-card__value {
            margin: 0;
            font-size: 28px;
            font-weight: 800;
            color: var(--brand-dark);
          }

          .summary-card__subvalue {
            margin: 8px 0 0;
            font-size: 12px;
            color: var(--muted);
          }

          .section {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .section-title {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .section-kicker {
            color: var(--brand);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            font-size: 11px;
          }

          h2 {
            margin: 0;
            font-size: 21px;
            color: var(--brand-dark);
          }

          .table {
            width: 100%;
            border-collapse: collapse;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 16px;
            overflow: hidden;
          }

          .table thead th {
            background: var(--brand-dark);
            color: #ffffff;
            padding: 11px 12px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            text-align: left;
          }

          .table tbody td,
          .table tbody th,
          .table tfoot td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--line);
            font-size: 12px;
            line-height: 1.5;
            vertical-align: top;
          }

          .table tbody tr:nth-child(even) td,
          .table tbody tr:nth-child(even) th {
            background: rgba(247, 248, 250, 0.72);
          }

          .table tbody th {
            width: 120px;
            font-weight: 700;
            color: var(--brand-dark);
            background: var(--brand-soft);
          }

          .table tfoot td {
            background: rgba(253, 131, 5, 0.08);
            font-weight: 800;
            color: var(--brand-dark);
          }

          .number-cell {
            text-align: right;
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
          }

          .highlight-cell {
            color: var(--brand-dark);
            font-weight: 800;
          }

          .submission-card {
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            page-break-inside: avoid;
          }

          .info-grid,
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .info-card,
          .metric-card {
            border: 1px solid var(--line);
            border-radius: 14px;
            padding: 12px 14px;
            background: var(--surface-alt);
          }

          .info-card span,
          .metric-card span {
            display: block;
            margin-bottom: 4px;
            color: var(--muted);
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
          }

          .info-card strong,
          .metric-card strong {
            display: block;
            font-size: 13px;
            line-height: 1.6;
            color: var(--brand-dark);
          }

          .info-card--wide {
            grid-column: span 2;
          }

          .info-card--full {
            grid-column: 1 / -1;
          }

          .metric-card--highlight {
            background: rgba(253, 131, 5, 0.10);
          }

          .submission-card__header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 18px;
          }

          .submission-card__header h3 {
            margin: 0;
            font-size: 20px;
            color: var(--brand-dark);
          }

          .submission-card__header p {
            margin: 6px 0 0;
            color: var(--muted);
            font-size: 12px;
          }

          .submission-index {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 54px;
            padding: 6px 10px;
            margin-bottom: 8px;
            border-radius: 999px;
            background: var(--brand-soft);
            color: var(--brand-dark);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.08em;
          }

          .status-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 8px 12px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            white-space: nowrap;
          }

          .status-pill--paid {
            background: var(--success-bg);
            color: var(--success-text);
          }

          .status-pill--pending {
            background: var(--warning-bg);
            color: var(--warning-text);
          }

          .footer-note {
            margin-top: 4px;
            font-size: 11px;
            color: var(--muted);
          }
        </style>
      </head>
      <body>
        <main class="report-shell">
          <section class="hero">
            <div class="hero-panel">
              <div class="brand-row">
                ${logoMarkup}
                <div class="hero-copy">
                  <p class="eyebrow">UOR Connect</p>
                  <h1>Relatório geral de interações e arrecadação</h1>
                  <p>
                    Documento administrativo com foco em arrecadação por categoria, desempenho das submissões
                    e organização das interações em tabelas. Toda a estrutura segue a identidade visual do projeto.
                  </p>
                </div>
              </div>
            </div>

            <aside class="meta-panel">
              <div class="meta-card">
                <span>Relatório</span>
                <strong>${escapeHtml(reportNumber)}</strong>
              </div>
              <div class="meta-card">
                <span>Gerado em</span>
                <strong>${escapeHtml(formatDateLabel(generatedAt))}</strong>
              </div>
              <div class="meta-card">
                <span>Valor configurado por item</span>
                <strong>${escapeHtml(paymentAmountLabel)}</strong>
              </div>
              <div class="meta-card">
                <span>Total arrecadado</span>
                <strong>${escapeHtml(formatCurrency(totalCollected))}</strong>
              </div>
            </aside>
          </section>

          <section class="summary-grid">
            <article class="summary-card">
              <p class="summary-card__label">Submissões</p>
              <p class="summary-card__value">${totalSubmissions}</p>
              <p class="summary-card__subvalue">Itens registados no período</p>
            </article>
            <article class="summary-card">
              <p class="summary-card__label">Pagamentos confirmados</p>
              <p class="summary-card__value">${totalPaidSubmissions}</p>
              <p class="summary-card__subvalue">Submissões contabilizadas na arrecadação</p>
            </article>
            <article class="summary-card">
              <p class="summary-card__label">Valor unitário</p>
              <p class="summary-card__value">${escapeHtml(formatCurrency(unitAmount))}</p>
              <p class="summary-card__subvalue">Configurado atualmente na plataforma</p>
            </article>
            <article class="summary-card">
              <p class="summary-card__label">Total bruto</p>
              <p class="summary-card__value">${escapeHtml(formatCurrency(totalExpected))}</p>
              <p class="summary-card__subvalue">Soma de todos os itens pelo valor configurado</p>
            </article>
          </section>

          <section class="section">
            <div class="section-title">
              <span class="section-kicker">Financeiro</span>
              <h2>Resumo financeiro por categoria</h2>
            </div>
            <table class="table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Total de itens</th>
                  <th>Pagamentos confirmados</th>
                  <th>Valor unitário</th>
                  <th>Total bruto</th>
                  <th>Total arrecadado</th>
                </tr>
              </thead>
              <tbody>
                ${summaryRows}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total geral</td>
                  <td class="number-cell">${totalSubmissions}</td>
                  <td class="number-cell">${totalPaidSubmissions}</td>
                  <td class="number-cell">${escapeHtml(formatCurrency(unitAmount))}</td>
                  <td class="number-cell">${escapeHtml(formatCurrency(totalExpected))}</td>
                  <td class="number-cell">${escapeHtml(formatCurrency(totalCollected))}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          ${submissionSections}

          <p class="footer-note">
            Documento administrativo gerado automaticamente pelo UOR Connect.
          </p>
        </main>
      </body>
    </html>
  `;
}

export async function reportsRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);

    const generateOverviewPdf = async () => {
      const generatedAt = new Date();

      const [submissions, submissionConfig, logo] = await Promise.all([
        prisma.submission.findMany({
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
        prisma.submissionConfig.findUnique({
          where: { key: "default" },
        }),
        loadLogoDataUri(),
      ]);

      const paymentAmountLabel = submissionConfig?.paymentAmount ?? "0 Kz";
      const unitAmount = parseCurrencyAmount(paymentAmountLabel);

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
      const categorySummaries = buildCategorySummaries(detailedSubmissions, unitAmount);
      const totalSubmissions = detailedSubmissions.length;
      const totalPaidSubmissions = detailedSubmissions.filter((submission) => submission.paymentConfirmed).length;
      const totalExpected = categorySummaries.reduce((sum, summary) => sum + summary.expectedTotal, 0);
      const totalCollected = categorySummaries.reduce((sum, summary) => sum + summary.totalCollected, 0);
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
        detailedSubmissions,
      });

      const pdfBuffer = await renderPdfFromHtml(html);
      const fileName = `uor-connect-relatorio-geral-${generatedAt.toISOString().slice(0, 10)}.pdf`;
      return { pdfBuffer, fileName };
    };

    adminApp.post("/overview/pdf-jobs", async (_, reply) => {
      const job = enqueuePdfJob({
        kind: "reports.overview",
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
      const job = getPdfJob((request.params as { id: string }).id);
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
      const job = getPdfJob(jobId);

      if (!job) {
        return reply.code(404).send({ message: "Job not found" });
      }

      if (job.status !== "completed") {
        return reply.code(409).send({ message: "PDF not ready yet" });
      }

      const result = getPdfJobResult(jobId);
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

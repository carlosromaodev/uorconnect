import { escapeHtml, formatDateLabel, loadLogoDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";

type CourseEnrollmentReportRow = {
  studentNumber: string;
  fullName: string;
  course: string | null;
  phone: string | null;
  whatsAppUrl: string | null;
  enrolledAt: Date;
};

type RenderCourseEnrollmentsPdfParams = {
  courseName: string;
  description: string;
  companyName: string;
  companyCategory: string;
  communityUrl?: string | null;
  generatedAt: Date;
  reportNumber: string;
  enrollments: CourseEnrollmentReportRow[];
};

function renderEnrollmentRows(enrollments: CourseEnrollmentReportRow[]) {
  if (enrollments.length === 0) {
    return `
      <tr>
        <td colspan="6">Ainda não existem inscritos para este curso.</td>
      </tr>
    `;
  }

  return enrollments.map((enrollment, index) => `
    <tr>
      <td class="number-cell">${index + 1}</td>
      <td>${escapeHtml(enrollment.studentNumber)}</td>
      <td>${escapeHtml(enrollment.fullName)}</td>
      <td>${escapeHtml(enrollment.course ?? "Curso não informado")}</td>
      <td>${escapeHtml(enrollment.phone ?? "Sem telefone")}</td>
      <td>${enrollment.whatsAppUrl ? `<a href="${escapeHtml(enrollment.whatsAppUrl)}">Abrir conversa</a>` : "Indisponível"}</td>
    </tr>
  `).join("");
}

function buildCourseEnrollmentsHtml(params: RenderCourseEnrollmentsPdfParams & { logoDataUri: string | null }) {
  const {
    logoDataUri,
    courseName,
    description,
    companyName,
    companyCategory,
    communityUrl,
    generatedAt,
    reportNumber,
    enrollments,
  } = params;

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
            size: A4 portrait;
            margin: 14mm 12mm 16mm;
          }

          :root {
            --brand: #FD8305;
            --brand-dark: #1B2B3A;
            --brand-deep: #223D42;
            --brand-soft: #FFF4E8;
            --line: #E7E9EB;
            --surface: #FFFFFF;
            --surface-alt: #F7F8FA;
            --text: #152434;
            --muted: #61707F;
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
            gap: 22px;
          }

          .hero {
            display: grid;
            grid-template-columns: 1fr;
            gap: 18px;
          }

          .hero-panel,
          .meta-panel,
          .summary-card,
          .table {
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 18px;
          }

          .hero-panel {
            padding: 24px 26px;
            background:
              radial-gradient(circle at top right, rgba(253, 131, 5, 0.18), transparent 34%),
              linear-gradient(135deg, rgba(253, 131, 5, 0.08), rgba(27, 43, 58, 0.02));
          }

          .brand-row {
            display: flex;
            gap: 18px;
            align-items: center;
          }

          .brand-logo {
            width: 128px;
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
          }

          .meta-panel {
            padding: 22px;
            display: grid;
            gap: 12px;
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
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
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

          .table tbody td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--line);
            font-size: 12px;
            line-height: 1.5;
            vertical-align: top;
          }

          .table tbody tr:nth-child(even) td {
            background: rgba(247, 248, 250, 0.72);
          }

          .number-cell {
            text-align: right;
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
          }

          a {
            color: var(--brand-dark);
            font-weight: 700;
            text-decoration: none;
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
                  <h1>Relatório de inscritos por curso</h1>
                  <p>
                    Documento administrativo com a listagem completa de inscritos no curso
                    <strong>${escapeHtml(courseName)}</strong>, preparado com a mesma identidade visual dos relatórios do projeto.
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
                <span>Empresa parceira</span>
                <strong>${escapeHtml(companyName)}</strong>
              </div>
              <div class="meta-card">
                <span>Categoria</span>
                <strong>${escapeHtml(companyCategory)}</strong>
              </div>
            </aside>
          </section>

          <section class="summary-grid">
            <article class="summary-card">
              <p class="summary-card__label">Curso</p>
              <p class="summary-card__value">${escapeHtml(courseName)}</p>
              <p class="summary-card__subvalue">${escapeHtml(description || "Sem descrição adicional.")}</p>
            </article>
            <article class="summary-card">
              <p class="summary-card__label">Inscritos</p>
              <p class="summary-card__value">${enrollments.length}</p>
              <p class="summary-card__subvalue">Participantes registados neste curso</p>
            </article>
            <article class="summary-card">
              <p class="summary-card__label">Contactos válidos</p>
              <p class="summary-card__value">${enrollments.filter((item) => item.phone).length}</p>
              <p class="summary-card__subvalue">Inscritos com telefone disponível</p>
            </article>
            <article class="summary-card">
              <p class="summary-card__label">Comunidade</p>
              <p class="summary-card__value">${communityUrl ? "Ativa" : "Sem link"}</p>
              <p class="summary-card__subvalue">${escapeHtml(communityUrl ?? "O curso ainda não tem ligação comunitária definida.")}</p>
            </article>
          </section>

          <section>
            <div class="section-title">
              <span class="section-kicker">Inscrições</span>
              <h2>Lista completa por curso</h2>
            </div>

            <table class="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Número de estudante</th>
                  <th>Nome completo</th>
                  <th>Curso</th>
                  <th>Telefone</th>
                  <th>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                ${renderEnrollmentRows(enrollments)}
              </tbody>
            </table>
          </section>

          <p class="footer-note">Documento administrativo gerado automaticamente pelo UOR Connect.</p>
        </main>
      </body>
    </html>
  `;
}

export async function renderCourseEnrollmentsPdf(params: RenderCourseEnrollmentsPdfParams) {
  const logoDataUri = await loadLogoDataUri();
  const html = buildCourseEnrollmentsHtml({
    ...params,
    logoDataUri
  });

  return renderPdfFromHtml(html, {
    landscape: false,
    preferCssPageSize: true,
    footerLabel: `${params.courseName} • UOR Connect`
  });
}

import { escapeHtml, formatDateLabel, loadLogoDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";

type RenderCourseEnrollmentTicketParams = {
  courseName: string;
  courseDescription: string;
  companyName: string;
  companyCategory: string;
  courseAccessUrl: string | null;
  studentName: string;
  studentNumber: string;
  studentCourse: string | null;
  paymentStatus: string;
  paymentPhone: string | null;
  enrolledAt: Date;
  siteUrl: string;
  ticketUrl: string | null;
  proofUrl: string | null;
  communityUrl: string | null;
};

function paymentStatusLabel(status: string) {
  if (status === "CONFIRMED") return "Inscrição confirmada";
  if (status === "PENDING") return "Pendente de validação";
  return "Sem validação";
}

function buildCourseEnrollmentTicketHtml(params: RenderCourseEnrollmentTicketParams & { logoDataUri: string | null }) {
  const {
    courseName,
    courseDescription,
    companyName,
    companyCategory,
    courseAccessUrl,
    studentName,
    studentNumber,
    studentCourse,
    paymentStatus,
    paymentPhone,
    enrolledAt,
    siteUrl,
    ticketUrl,
    proofUrl,
    communityUrl,
    logoDataUri,
  } = params;

  const qrValue = courseAccessUrl ?? `${siteUrl}/cursos`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrValue)}`;
  const barcodeValue = studentNumber.padEnd(12, "0");

  return `<!DOCTYPE html>
  <html lang="pt">
    <head>
      <meta charset="utf-8" />
      <title>UOR Boarding Pass | ${escapeHtml(courseName)}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
        :root {
          color-scheme: light;
          --ink: #112234;
          --muted: #5f7082;
          --line: rgba(148, 163, 184, 0.22);
          --surface: #f6f3eb;
          --card: rgba(255, 253, 248, 0.98);
          --accent: #fd8305;
          --accent-deep: #143844;
          --gold: #c7972d;
          --success: #0f9d58;
        }
        * {
          box-sizing: border-box;
          min-width: 0;
        }
        body {
          margin: 0;
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          color: var(--ink);
          background:
            radial-gradient(circle at top right, rgba(253, 131, 5, 0.16), transparent 34%),
            radial-gradient(circle at bottom left, rgba(20, 56, 68, 0.1), transparent 30%),
            linear-gradient(180deg, #fffaf2, var(--surface));
        }
        .sheet {
          min-height: calc(297mm - 24mm);
          padding: 24px;
        }
        .ticket {
          border-radius: 30px;
          overflow: hidden;
          border: 1px solid var(--line);
          background: var(--card);
          box-shadow: 0 28px 70px rgba(15, 23, 42, 0.12);
        }
        .top {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(240px, 0.85fr);
          gap: 18px;
          align-items: stretch;
          padding: 24px;
          background:
            linear-gradient(140deg, rgba(253, 131, 5, 0.18), rgba(255, 255, 255, 0.94) 52%, rgba(20, 56, 68, 0.1)),
            linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.96));
        }
        .intro {
          border-radius: 26px;
          border: 1px solid rgba(255, 255, 255, 0.72);
          background: rgba(255, 255, 255, 0.74);
          padding: 22px;
        }
        .brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .brand-logo {
          width: 152px;
          min-height: 72px;
          border-radius: 22px;
          border: 1px solid rgba(20, 56, 68, 0.1);
          background: rgba(255, 255, 255, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }
        .brand-logo img {
          width: 132px;
          height: auto;
          max-width: calc(100% - 16px);
          object-fit: contain;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 14px;
          border-radius: 999px;
          border: 1px solid rgba(199, 151, 45, 0.24);
          background: rgba(255, 248, 232, 0.9);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--accent-deep);
        }
        .eyebrow {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--gold);
        }
        h1 {
          margin: 14px 0 0;
          font-size: 31px;
          line-height: 1.08;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .lede {
          margin: 12px 0 0;
          font-size: 14px;
          line-height: 1.8;
          color: rgba(17, 34, 52, 0.76);
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 18px;
        }
        .mini-card,
        .info-card,
        .link-card,
        .share-card {
          border-radius: 20px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.88);
          padding: 15px 16px;
          overflow: hidden;
        }
        .mini-card__label,
        .info-card__label,
        .link-card__label {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .mini-card__value,
        .info-card__value {
          margin: 10px 0 0;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.55;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .mini-card--wide {
          grid-column: span 2;
        }
        .pass-panel {
          position: relative;
          overflow: hidden;
          border-radius: 26px;
          padding: 22px;
          color: #fff;
          background:
            linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(20, 56, 68, 0.95)),
            radial-gradient(circle at top right, rgba(253, 131, 5, 0.24), transparent 34%);
        }
        .pass-panel::before,
        .pass-panel::after {
          content: "";
          position: absolute;
          border-radius: 999px;
          filter: blur(18px);
          opacity: 0.82;
        }
        .pass-panel::before {
          width: 140px;
          height: 140px;
          top: -38px;
          right: -28px;
          background: rgba(253, 131, 5, 0.52);
        }
        .pass-panel::after {
          width: 110px;
          height: 110px;
          left: -24px;
          bottom: -30px;
          background: rgba(56, 189, 248, 0.34);
        }
        .panel-stack {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }
        .panel-row,
        .barcode {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.08);
          padding: 13px 15px;
          backdrop-filter: blur(10px);
        }
        .panel-title {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.72);
        }
        .panel-text {
          margin: 8px 0 0;
          font-size: 14px;
          line-height: 1.7;
          color: rgba(255, 255, 255, 0.92);
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .barcode__value {
          margin-top: 8px;
          font-family: "Courier New", monospace;
          font-size: 21px;
          letter-spacing: 0.34em;
          color: rgba(255, 255, 255, 0.92);
        }
        .body {
          display: grid;
          gap: 18px;
          padding: 0 24px 24px;
        }
        .section-title {
          margin: 0 0 14px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(15, 157, 88, 0.1);
          color: var(--success);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .link-card__url {
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.7;
          color: var(--accent-deep);
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        .footer-note {
          margin-top: 18px;
          border-radius: 20px;
          border: 1px solid rgba(199, 151, 45, 0.2);
          background: linear-gradient(135deg, rgba(253, 131, 5, 0.08), rgba(199, 151, 45, 0.08));
          padding: 16px;
          font-size: 13px;
          line-height: 1.8;
          color: rgba(17, 34, 52, 0.8);
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--muted);
        }
        .divider::before,
        .divider::after {
          content: "";
          flex: 1;
          border-top: 1px dashed rgba(95, 112, 130, 0.5);
        }
        .divider span {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }
        .bottom {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 240px;
          gap: 18px;
        }
        .links {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }
        .share-card img {
          width: 100%;
          max-width: 170px;
          display: block;
          margin: 12px auto 0;
          border-radius: 18px;
          border: 1px solid rgba(20, 56, 68, 0.08);
          background: #fff;
          padding: 10px;
        }
        .caption {
          margin-top: 10px;
          font-size: 11px;
          line-height: 1.7;
          color: var(--muted);
          text-align: center;
        }
      </style>
    </head>
    <body>
      <main class="sheet">
        <section class="ticket">
          <div class="top">
            <div class="intro">
              <div class="brand-row">
                <div class="brand">
                  <div class="brand-logo">${logoDataUri ? `<img src="${logoDataUri}" alt="UOR Connect" />` : ""}</div>
                  <div>
                    <p class="eyebrow" style="margin-bottom:6px;">UOR Boarding Pass</p>
                    <div style="font-size:16px; font-weight:800; color: var(--accent-deep);">Ticket de Embarque para o Conhecimento</div>
                  </div>
                </div>
                <div class="badge">Vaga garantida</div>
              </div>
              <h1>${escapeHtml(courseName)}</h1>
              <p class="lede">
                Um talão premium pensado para stories, WhatsApp e partilha orgânica. Limpo em mobile, elegante em screenshot e alinhado ao ecossistema UOR Connect.
              </p>
              <div class="summary-grid">
                <div class="mini-card">
                  <p class="mini-card__label">Estudante</p>
                  <p class="mini-card__value">${escapeHtml(studentName)}</p>
                </div>
                <div class="mini-card">
                  <p class="mini-card__label">Número</p>
                  <p class="mini-card__value">${escapeHtml(studentNumber)}</p>
                </div>
                <div class="mini-card mini-card--wide">
                  <p class="mini-card__label">Inscrição</p>
                  <p class="mini-card__value">${escapeHtml(paymentStatusLabel(paymentStatus))}</p>
                </div>
              </div>
            </div>

            <div class="pass-panel">
              <div style="position:relative; z-index:1;">
                <div class="eyebrow" style="color: rgba(255,255,255,0.74);">Boarding Pass</div>
                <div style="margin-top:8px; font-size:30px; font-weight:800; line-height:1;">#${escapeHtml(studentNumber)}</div>
                <div style="margin-top:8px; font-size:12px; line-height:1.7; color: rgba(255,255,255,0.74);">
                  Ticket de inscrição confirmada para aluno UOR Connect.
                </div>
              </div>
              <div class="panel-stack">
                <div class="panel-row">
                  <p class="panel-title">Parceiro formador</p>
                  <p class="panel-text">${escapeHtml(companyName)} · ${escapeHtml(companyCategory)}</p>
                </div>
                <div class="panel-row">
                  <p class="panel-title">Curso académico</p>
                  <p class="panel-text">${escapeHtml(studentCourse ?? "Curso não informado")}</p>
                </div>
                <div class="panel-row">
                  <p class="panel-title">Contacto validado</p>
                  <p class="panel-text">${escapeHtml(paymentPhone ?? "Sem contacto associado")}</p>
                </div>
                <div class="barcode">
                  <p class="panel-title">Código de embarque</p>
                  <div class="barcode__value">${escapeHtml(barcodeValue)}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="body">
            <section>
              <p class="section-title">Resumo da inscrição</p>
              <div class="info-grid">
                <div class="info-card">
                  <p class="info-card__label">Check-in registado</p>
                  <p class="info-card__value">${escapeHtml(formatDateLabel(enrolledAt))}</p>
                </div>
                <div class="info-card">
                  <p class="info-card__label">Portal oficial</p>
                  <p class="info-card__value">${escapeHtml(siteUrl)}</p>
                </div>
                <div class="info-card" style="grid-column: span 2;">
                  <p class="info-card__label">Descrição do curso</p>
                  <p class="info-card__value" style="font-size:14px; font-weight:600; color: rgba(17, 34, 52, 0.82);">${escapeHtml(courseDescription)}</p>
                </div>
              </div>
              <div class="footer-note">
                Este ticket foi desenhado para screenshot e partilha. Se alguém o receber e quiser entrar no próximo voo, deve usar o portal oficial em <strong>${escapeHtml(siteUrl)}</strong>.
              </div>
            </section>

            <div class="divider"><span>Para partilhar</span></div>

            <section class="bottom">
              <div>
                <p class="section-title">Ligações úteis</p>
                <div class="status-pill">${escapeHtml(paymentStatusLabel(paymentStatus))}</div>
                <div class="links">
                  <div class="link-card">
                    <p class="link-card__label">Site oficial</p>
                    <p class="link-card__url">${escapeHtml(siteUrl)}</p>
                  </div>
                  ${courseAccessUrl ? `
                  <div class="link-card">
                    <p class="link-card__label">Página do curso</p>
                    <p class="link-card__url">${escapeHtml(courseAccessUrl)}</p>
                  </div>` : ""}
                  ${ticketUrl ? `
                  <div class="link-card">
                    <p class="link-card__label">PDF do ticket</p>
                    <p class="link-card__url">${escapeHtml(ticketUrl)}</p>
                  </div>` : ""}
                  ${proofUrl ? `
                  <div class="link-card">
                    <p class="link-card__label">Comprovativo anexado</p>
                    <p class="link-card__url">${escapeHtml(proofUrl)}</p>
                  </div>` : ""}
                  ${communityUrl ? `
                  <div class="link-card">
                    <p class="link-card__label">WhatsApp / comunidade</p>
                    <p class="link-card__url">${escapeHtml(communityUrl)}</p>
                  </div>` : ""}
                </div>
                <div class="footer-note">
                  Faça parte do UOR Connect. Inscreva-se no próximo curso, partilhe este pass e mostre o seu embarque para um novo ciclo de conhecimento.
                </div>
              </div>

              <aside class="share-card">
                <p class="section-title" style="margin-bottom:0;">QR de partilha</p>
                <img src="${qrUrl}" alt="QR code do curso" />
                <p class="caption">
                  Abre diretamente a página do curso no portal UOR Connect para inscrição ou verificação.
                </p>
              </aside>
            </section>
          </div>
        </section>
      </main>
    </body>
  </html>`;
}

export async function renderCourseEnrollmentTicketPdf(params: RenderCourseEnrollmentTicketParams) {
  const logoDataUri = await loadLogoDataUri();
  const html = buildCourseEnrollmentTicketHtml({
    ...params,
    logoDataUri,
  });

  return renderPdfFromHtml(html, {
    footerLabel: `${params.courseName} · UOR Boarding Pass`,
  });
}

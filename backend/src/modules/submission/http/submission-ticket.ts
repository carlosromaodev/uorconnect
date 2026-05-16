import { escapeHtml, formatDateLabel } from "../../reports/http/pdf-report.utils";
import type { Submission } from "../domain/submission";

function submissionTypeLabel(type: Submission["type"]) {
  if (type === "BUSINESS") return "Negócio";
  if (type === "PRODUCT") return "Produto";
  return "Projeto";
}

function compactText(value?: string | null, fallback = "Não informado") {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function softWrapReference(referenceCode: string) {
  return escapeHtml(referenceCode).replace(/-/g, "-<wbr>");
}

export function buildSubmissionCommunityUrl(type: Submission["type"], config: {
  projectCommunityUrl?: string | null;
  businessCommunityUrl?: string | null;
  productCommunityUrl?: string | null;
}) {
  if (type === "BUSINESS") return config.businessCommunityUrl ?? null;
  if (type === "PRODUCT") return config.productCommunityUrl ?? null;
  return config.projectCommunityUrl ?? null;
}

export function buildBoardingPassHtml(submission: Submission, options: {
  logoDataUri?: string | null;
  generatedAt: Date;
  publicAppUrl?: string | null;
  pdfUrl?: string | null;
}) {
  const primary = submission.primaryColor || "#FD8305";
  const secondary = submission.secondaryColor || "#223D42";
  const members = submission.members.length > 0 ? submission.members.join(" • ") : "Sem equipa";
  const createdAt = formatDateLabel(submission.createdAt);
  const typeLabel = submissionTypeLabel(submission.type);
  const siteUrl = options.publicAppUrl?.replace(/\/$/, "") ?? "http://localhost:5173";
  const pdfUrl = options.pdfUrl ?? `${siteUrl}/api/submissions/${submission.id}/boarding-pass.pdf`;

  return `<!DOCTYPE html>
  <html lang="pt">
    <head>
      <meta charset="UTF-8" />
      <title>Talão de Embarque ${escapeHtml(submission.referenceCode)}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Inter, Arial, sans-serif;
          color: #14212f;
          background: #f3f6f9;
        }
        .sheet {
          min-height: calc(297mm - 24mm);
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #d8e0e8;
          background: #ffffff;
        }
        .header {
          padding: 14mm 16mm 10mm;
          border-bottom: 3px solid ${primary};
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          color: #14212f;
        }
        .header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12mm;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 5mm;
        }
        .brand-mark {
          width: 45mm;
          min-height: 23mm;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2mm 3mm;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #ffffff;
        }
        .brand-mark img {
          width: 39mm;
          height: auto;
          object-fit: contain;
        }
        .brand small, .label {
          font-size: 9px;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: #61707f;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .title {
          margin: 7mm 0 0;
          font-size: 27px;
          line-height: 1.1;
          font-weight: 800;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .subtitle {
          margin: 3mm 0 0;
          font-size: 11px;
          line-height: 1.7;
          color: #4b5b6c;
          max-width: 135mm;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .content {
          padding: 12mm 16mm 16mm;
        }
        .grid {
          display: grid;
          grid-template-columns: 1.3fr 0.7fr;
          gap: 8mm;
        }
        .card {
          border-radius: 12px;
          border: 1px solid #dbe4ee;
          background: #fff;
          padding: 6mm;
        }
        .hero {
          background: linear-gradient(160deg, ${primary}10, ${secondary}12);
        }
        .hero strong {
          display: block;
          margin-top: 2.5mm;
          font-size: 24px;
          line-height: 1.15;
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .meta-grid {
          margin-top: 8mm;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 4mm;
        }
        .meta-item span {
          display: block;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #6c7a89;
        }
        .meta-item strong {
          display: block;
          margin-top: 2mm;
          font-size: 12px;
          line-height: 1.5;
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .reference {
          background: #14212f;
          color: #fff;
          min-height: 100%;
        }
        .reference-code {
          margin-top: 4mm;
          font-size: 28px;
          line-height: 1.08;
          font-weight: 800;
          letter-spacing: 0.08em;
          white-space: normal;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .notes {
          margin-top: 8mm;
          display: grid;
          grid-template-columns: 1fr;
          gap: 4mm;
        }
        .note {
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 4.5mm 5mm;
        }
        .note strong {
          display: block;
          margin-bottom: 1.5mm;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #455468;
        }
        .note p {
          margin: 0;
          font-size: 11px;
          line-height: 1.7;
          color: #243447;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
      </style>
    </head>
    <body>
      <main class="sheet">
        <section class="header">
          <div class="header-top">
            <div class="brand">
              <div class="brand-mark">${options.logoDataUri ? `<img src="${options.logoDataUri}" alt="UOR Connect" />` : ""}</div>
              <div>
                <small>UOR Connect</small>
                <div style="margin-top: 1.5mm; font-size: 15px; font-weight: 700;">Comprovativo oficial de submissão</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div class="label">Registo concluído</div>
              <div style="margin-top: 2mm; font-size: 12px; font-weight: 600;">${escapeHtml(typeLabel)}</div>
            </div>
          </div>
          <h1 class="title">${escapeHtml(submission.name)}</h1>
          <p class="subtitle">Documento de confirmação da candidatura, com referência, dados do responsável, composição da equipa e ligações oficiais para acompanhamento.</p>
        </section>

        <section class="content">
          <div class="grid">
            <div>
              <article class="card hero">
                <div class="label" style="color:#526274;">Responsável principal</div>
                <strong>${escapeHtml(compactText(submission.leaderName))}</strong>
                <div class="meta-grid">
                  <div class="meta-item">
                    <span>Contacto</span>
                    <strong>${escapeHtml(compactText(submission.leaderPhone, "Sem telefone"))}</strong>
                  </div>
                  <div class="meta-item">
                    <span>Curso / Área</span>
                    <strong>${escapeHtml(compactText(submission.course || submission.area))}</strong>
                  </div>
                  <div class="meta-item">
                    <span>Data de registo</span>
                    <strong>${escapeHtml(createdAt)}</strong>
                  </div>
                  <div class="meta-item">
                    <span>Categoria</span>
                    <strong>${escapeHtml(typeLabel)}</strong>
                  </div>
                </div>
              </article>

              <article class="card" style="margin-top: 6mm;">
                <div class="label" style="color:#526274;">Dados da candidatura</div>
                <div class="meta-grid">
                  <div class="meta-item">
                    <span>Área</span>
                    <strong>${escapeHtml(compactText(submission.area))}</strong>
                  </div>
                  <div class="meta-item">
                    <span>Necessidades</span>
                    <strong>${escapeHtml(submission.needs.length > 0 ? submission.needs.join(", ") : "Sem necessidades adicionais")}</strong>
                  </div>
                  <div class="meta-item" style="grid-column: 1 / -1;">
                    <span>Equipa</span>
                    <strong>${escapeHtml(members)}</strong>
                  </div>
                </div>
              </article>

              <article class="card" style="margin-top: 6mm;">
                <div class="label" style="color:#526274;">Partilha e acesso</div>
                <div class="notes" style="margin-top:4mm;">
                  <div class="note">
                    <strong>Site oficial</strong>
                    <p>${escapeHtml(siteUrl)}</p>
                  </div>
                  <div class="note">
                    <strong>PDF online</strong>
                    <p>${escapeHtml(pdfUrl)}</p>
                  </div>
                  <div class="note">
                    <strong>Orientação</strong>
                    <p>Guarda este comprovativo e usa a referência sempre que precisares de acompanhar ou validar a submissão junto da equipa organizadora.</p>
                  </div>
                </div>
              </article>
            </div>

            <article class="card reference">
              <div class="label">Referência oficial</div>
              <div class="reference-code">${softWrapReference(submission.referenceCode)}</div>
              <div class="notes">
                <div class="note">
                  <strong>Validação</strong>
                  <p>Apresenta esta referência quando solicitado pela organização. O estado final depende da validação administrativa.</p>
                </div>
                <div class="note">
                  <strong>Gerado em</strong>
                  <p>${escapeHtml(formatDateLabel(options.generatedAt))}</p>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>
    </body>
  </html>`;
}

export function parseStoredProof(value: string) {
  const trimmed = value.trim();
  const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/);

  if (dataUrlMatch) {
    return {
      kind: "data-url" as const,
      mimeType: dataUrlMatch[1],
      buffer: Buffer.from(dataUrlMatch[2], "base64")
    };
  }

  if (/^https?:\/\//i.test(trimmed) || /^\/(?:api\/)?media\/files\//.test(trimmed)) {
    return {
      kind: "url" as const,
      url: trimmed
    };
  }

  return {
    kind: "text" as const,
    value: trimmed
  };
}

export function proofExtensionFromMime(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "bin";
}

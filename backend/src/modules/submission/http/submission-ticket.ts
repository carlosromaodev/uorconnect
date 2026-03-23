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
}) {
  const primary = submission.primaryColor || "#FD8305";
  const secondary = submission.secondaryColor || "#223D42";
  const members = submission.members.length > 0 ? submission.members.join(" • ") : "Sem equipa";
  const createdAt = formatDateLabel(submission.createdAt);
  const typeLabel = submissionTypeLabel(submission.type);

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
          background:
            radial-gradient(circle at top left, ${primary}22, transparent 26%),
            radial-gradient(circle at bottom right, ${secondary}1f, transparent 32%),
            #f4f7fb;
        }
        .sheet {
          min-height: calc(297mm - 24mm);
          border-radius: 28px;
          overflow: hidden;
          border: 1px solid #d9e2ec;
          background: #ffffff;
          box-shadow: 0 18px 60px rgba(15, 23, 42, 0.10);
        }
        .header {
          padding: 18mm 16mm 10mm;
          background: linear-gradient(135deg, ${primary}, ${secondary});
          color: #fff;
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
        .brand img {
          width: 18mm;
          height: 18mm;
          border-radius: 5mm;
          background: rgba(255,255,255,0.92);
          padding: 2.5mm;
        }
        .brand small, .label {
          font-size: 9px;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          opacity: 0.86;
        }
        .title {
          margin: 7mm 0 0;
          font-size: 27px;
          line-height: 1.1;
          font-weight: 800;
        }
        .subtitle {
          margin: 3mm 0 0;
          font-size: 11px;
          line-height: 1.7;
          color: rgba(255,255,255,0.88);
          max-width: 135mm;
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
          border-radius: 18px;
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
          word-break: break-word;
        }
        .reference {
          background: #0f172a;
          color: #fff;
          min-height: 100%;
        }
        .reference-code {
          margin-top: 4mm;
          font-size: 28px;
          line-height: 1.08;
          font-weight: 800;
          letter-spacing: 0.08em;
          word-break: break-word;
        }
        .notes {
          margin-top: 8mm;
          display: grid;
          grid-template-columns: 1fr;
          gap: 4mm;
        }
        .note {
          border-radius: 14px;
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
        }
      </style>
    </head>
    <body>
      <main class="sheet">
        <section class="header">
          <div class="header-top">
            <div class="brand">
              ${options.logoDataUri ? `<img src="${options.logoDataUri}" alt="UOR Connect" />` : ""}
              <div>
                <small>UOR Connect</small>
                <div style="margin-top: 1.5mm; font-size: 15px; font-weight: 700;">Talão de embarque da candidatura</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div class="label">Check-in concluído</div>
              <div style="margin-top: 2mm; font-size: 12px; font-weight: 600;">${escapeHtml(typeLabel)}</div>
            </div>
          </div>
          <h1 class="title">${escapeHtml(submission.name)}</h1>
          <p class="subtitle">Inscrição registada com sucesso. Guarda este talão para validação, entrada na triagem e partilha com a equipa organizadora.</p>
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
                    <span>Tipo de expositor</span>
                    <strong>${escapeHtml(typeLabel)}</strong>
                  </div>
                </div>
              </article>

              <article class="card" style="margin-top: 6mm;">
                <div class="label" style="color:#526274;">Equipa e operação</div>
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
            </div>

            <article class="card reference">
              <div class="label">Número de inscrição</div>
              <div class="reference-code">${softWrapReference(submission.referenceCode)}</div>
              <div class="notes">
                <div class="note">
                  <strong>Legenda de partilha</strong>
                  <p>Baixa este PDF e envia-o com o comprovativo do pagamento no grupo da comunidade correspondente ao teu tipo de expositor.</p>
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

  if (/^https?:\/\//i.test(trimmed)) {
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

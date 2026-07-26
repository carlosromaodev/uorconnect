import { escapeHtml, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";

export const UOR_ESTUDANTE_PALETTE = Object.freeze({
  ink: "#050505",
  orange: "#FF5A00",
  paper: "#FAF7F3",
  surface: "#FFFFFF",
  stone: "#ECE8E3",
  muted: "#6F6963",
  success: "#177245",
  warning: "#A84B08",
  danger: "#A92B2B",
});

export type PaymentReferenceState = "ACTIVE" | "PAID" | "EXPIRED" | "CANCELLED" | "UNKNOWN";

export type UorEstudantePaymentReference = {
  label: string;
  description?: string | null;
  entity: string;
  reference: string;
  amount: string;
  dueDate?: string | null;
  issuedAt?: string | null;
  state: PaymentReferenceState;
};

export type UorEstudantePaymentReferencesDocument = {
  student: {
    displayName: string;
    studentNumber: string;
    course: string;
    academicYear: string;
  };
  references: UorEstudantePaymentReference[];
  generatedAt: string;
  documentId: string;
  totalLabel?: string | null;
  sourceLabel?: string | null;
};

const statusPresentation: Record<PaymentReferenceState, { label: string; cssClass: string }> = {
  ACTIVE: { label: "Disponível", cssClass: "active" },
  PAID: { label: "Paga", cssClass: "paid" },
  EXPIRED: { label: "Expirada", cssClass: "expired" },
  CANCELLED: { label: "Cancelada", cssClass: "cancelled" },
  UNKNOWN: { label: "Por confirmar", cssClass: "unknown" },
};

export function uorEstudanteMarkSvg(options: { className?: string; decorative?: boolean } = {}) {
  const className = escapeHtml(options.className ?? "brand-mark");
  const accessibility = options.decorative
    ? 'aria-hidden="true"'
    : 'role="img" aria-label="UOR Estudante"';
  return `<svg class="${className}" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" ${accessibility}>
    <path d="M76 22H55C35 22 25 35 25 55v13c0 20 11 31 31 31h27" fill="none" stroke="${UOR_ESTUDANTE_PALETTE.ink}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M54 60h32" fill="none" stroke="${UOR_ESTUDANTE_PALETTE.ink}" stroke-width="11" stroke-linecap="round"/>
    <path d="M54 60h14" fill="none" stroke="${UOR_ESTUDANTE_PALETTE.orange}" stroke-width="11" stroke-linecap="round"/>
    <circle cx="88" cy="29" r="8" fill="${UOR_ESTUDANTE_PALETTE.orange}"/>
  </svg>`;
}

function brandLockup() {
  return `<div class="brand-lockup">
    ${uorEstudanteMarkSvg()}
    <div class="brand-copy">
      <strong>Estudante</strong>
      <span><i></i>by UOR Connect</span>
    </div>
  </div>`;
}

function pageDecorations() {
  return `<div class="brand-atmosphere" aria-hidden="true">
    <svg class="orbit orbit-top" viewBox="0 0 270 180">
      <path d="M-36 153C50 150 124 94 132-21"/>
      <path class="white-orbit" d="M-48 105C64 101 151 49 194-41"/>
      <circle cx="106" cy="103" r="5"/>
    </svg>
    ${uorEstudanteMarkSvg({ className: "ghost-mark", decorative: true })}
    <svg class="orbit orbit-bottom" viewBox="0 0 310 220">
      <path d="M63 240C50 113 137 44 268 74"/>
      <path class="white-orbit" d="M116 239C97 126 174 51 306 42"/>
      <circle cx="137" cy="104" r="6"/>
    </svg>
  </div>`;
}

function baseStyles() {
  return `<style>
    :root{--ink:${UOR_ESTUDANTE_PALETTE.ink};--orange:${UOR_ESTUDANTE_PALETTE.orange};--paper:${UOR_ESTUDANTE_PALETTE.paper};--surface:${UOR_ESTUDANTE_PALETTE.surface};--stone:${UOR_ESTUDANTE_PALETTE.stone};--muted:${UOR_ESTUDANTE_PALETTE.muted}}
    *{box-sizing:border-box}
    @page{size:A4;margin:0}
    html,body{margin:0;padding:0;background:var(--paper);color:var(--ink);font-family:Arial,"Helvetica Neue",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-size:10.5pt}
    .sheet{position:relative;isolation:isolate;width:210mm;height:297mm;overflow:hidden;padding:14mm 16mm 12mm;background:linear-gradient(145deg,#fff 0%,var(--paper) 52%,#f8f2ec 100%);break-after:page;page-break-after:always}
    .sheet:last-child{break-after:auto;page-break-after:auto}
    .content{position:relative;z-index:2;min-height:271mm;display:flex;flex-direction:column}
    .brand-atmosphere{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}
    .orbit{position:absolute;fill:none;stroke:var(--orange);stroke-width:1.2}
    .orbit circle{fill:var(--orange);stroke:none}
    .orbit .white-orbit{stroke:#fff;stroke-width:1}
    .orbit-top{width:84mm;height:56mm;left:-17mm;top:-8mm}
    .orbit-bottom{width:93mm;height:66mm;right:-22mm;bottom:-15mm}
    .ghost-mark{position:absolute;width:73mm;height:73mm;right:-8mm;top:45mm;opacity:.025}
    .brand-lockup{display:flex;align-items:center;gap:3mm}
    .brand-mark{width:15mm;height:15mm;flex:none}
    .brand-copy{display:flex;flex-direction:column;line-height:1}
    .brand-copy strong{font-size:17pt;letter-spacing:-.045em;font-weight:700}
    .brand-copy span{display:flex;align-items:center;gap:2mm;margin-top:1.5mm;font-size:7.5pt;font-weight:700;letter-spacing:.01em}
    .brand-copy i{display:inline-block;width:14mm;height:1.2mm;border-radius:9px;background:var(--orange)}
    .document-kicker{font-size:7.5pt;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--orange)}
    .document-id{font-size:7.5pt;color:var(--muted);font-variant-numeric:tabular-nums}
    .topbar{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:11mm}
    .document-meta{text-align:right;padding-top:1.5mm}
    .document-meta .document-id{display:block;margin-top:1.5mm}
    h1{margin:0;font-size:28pt;line-height:1.03;letter-spacing:-.045em;max-width:135mm}
    .lede{max-width:130mm;margin:3mm 0 0;color:var(--muted);font-size:10pt;line-height:1.5}
    .accent-line{width:24mm;height:1.2mm;margin:5mm 0 7mm;border-radius:10px;background:var(--orange)}
    .identity-panel{display:grid;grid-template-columns:1.35fr .65fr .8fr;gap:5mm;padding:5mm 6mm;border:1px solid rgba(5,5,5,.08);border-radius:5mm;background:rgba(255,255,255,.84);box-shadow:0 2mm 8mm rgba(37,22,10,.035)}
    .identity-panel .wide{grid-row:span 2}
    .eyebrow,.field-label{display:block;margin-bottom:1.2mm;font-size:6.7pt;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}
    .identity-name{font-size:15pt;font-weight:750;line-height:1.15}
    .field-value{font-size:9.6pt;font-weight:700;line-height:1.25}
    .summary{display:flex;align-items:center;justify-content:space-between;margin:6mm 0 4mm;padding:0 1mm}
    .summary h2{margin:0;font-size:13.5pt;letter-spacing:-.02em}
    .summary-metric{display:flex;align-items:baseline;gap:2mm}
    .summary-metric strong{font-size:15pt}
    .summary-metric span{font-size:7.5pt;color:var(--muted);text-transform:uppercase;letter-spacing:.09em;font-weight:700}
    .references{display:grid;gap:3.5mm}
    .reference-card{position:relative;break-inside:avoid;border:1px solid rgba(5,5,5,.1);border-radius:5mm;background:#fff;overflow:hidden;box-shadow:0 2mm 8mm rgba(37,22,10,.035)}
    .reference-card:before{content:"";position:absolute;inset:0 auto 0 0;width:1.4mm;background:var(--orange)}
    .reference-head{display:flex;align-items:flex-start;justify-content:space-between;padding:4.2mm 5.5mm 2.5mm 7mm}
    .reference-head h3{margin:0;font-size:11.5pt;letter-spacing:-.015em}
    .reference-head p{margin:1mm 0 0;font-size:7.8pt;color:var(--muted)}
    .status{display:inline-flex;align-items:center;gap:1.5mm;padding:1.3mm 2.7mm;border-radius:99px;font-size:7pt;font-weight:800;letter-spacing:.055em;text-transform:uppercase;white-space:nowrap}
    .status:before{content:"";width:1.5mm;height:1.5mm;border-radius:50%;background:currentColor}
    .status.active{color:#8A3D00;background:#FFF0E6}.status.paid{color:#13663E;background:#E8F6EF}.status.expired,.status.cancelled{color:#922929;background:#FBECEC}.status.unknown{color:#5F5A56;background:#F0EEEC}
    .reference-grid{display:grid;grid-template-columns:.72fr 1.2fr .76fr .7fr;border-top:1px solid var(--stone);margin-left:1.4mm}
    .reference-field{min-width:0;padding:3.7mm 4mm;border-right:1px solid var(--stone)}
    .reference-field:last-child{border-right:0}
    .reference-field .value{display:block;font-size:10.5pt;font-weight:800;line-height:1.25;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
    .reference-field .field-detail{display:block;margin-top:.8mm;color:var(--muted);font-size:6.7pt;font-weight:500;line-height:1.2}
    .reference-field.reference .value{font-size:12.5pt;letter-spacing:.035em}
    .reference-field.amount .value{color:var(--orange);font-size:13pt}
    .instructions{display:grid;grid-template-columns:1fr 1.08fr;gap:4mm;margin-top:6mm;padding:5mm 5.5mm;border-radius:5mm;background:var(--ink);color:#fff;break-inside:avoid}
    .instructions h2{margin:0 0 2mm;font-size:12pt}
    .instructions p{margin:0;color:#CBC6C1;font-size:7.8pt;line-height:1.45}
    .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:2.3mm}
    .step{font-size:7.2pt;line-height:1.35;color:#D9D5D1}
    .step b{display:flex;align-items:center;justify-content:center;width:5mm;height:5mm;margin-bottom:1.5mm;border-radius:50%;background:var(--orange);color:#fff;font-size:7pt}
    .footer-note{display:flex;align-items:flex-end;justify-content:space-between;gap:8mm;margin-top:auto;padding-top:5mm;color:var(--muted);font-size:7pt;line-height:1.45}
    .footer-note strong{color:var(--ink)}
    .footer-source{max-width:128mm}
    .page-count{white-space:nowrap;font-variant-numeric:tabular-nums}
    .details-table{width:100%;margin-top:7mm;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid var(--stone);border-radius:4mm;background:#fff}
    .details-table th,.details-table td{padding:3.2mm 4mm;border-bottom:1px solid var(--stone);text-align:left;vertical-align:top}
    .details-table tr:last-child th,.details-table tr:last-child td{border-bottom:0}
    .details-table th{width:35%;font-size:7.3pt;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);background:#FCFAF8}
    .details-table td{font-weight:700;overflow-wrap:anywhere}
    .notice{margin-top:6mm;padding:4mm 5mm;border-left:1.4mm solid var(--orange);border-radius:0 3mm 3mm 0;background:#FFF4EC;color:#5B3219;font-size:8pt;line-height:1.45}
  </style>`;
}

function documentShell(pages: string[], title: string, language = "pt") {
  const sheets = pages.map((content) => `<main class="sheet">${pageDecorations()}<div class="content">${content}</div></main>`).join("");
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>${baseStyles()}</head><body>${sheets}</body></html>`;
}

export function buildUorEstudantePaymentReferencesHtml(data: UorEstudantePaymentReferencesDocument) {
  if (data.references.length === 0) throw new Error("O documento exige pelo menos uma referência de pagamento.");

  const cards = data.references.map((item) => {
    const status = statusPresentation[item.state];
    return `<article class="reference-card">
      <header class="reference-head">
        <div><h3>${escapeHtml(item.label)}</h3>${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}</div>
        <span class="status ${status.cssClass}">${status.label}</span>
      </header>
      <div class="reference-grid">
        <div class="reference-field"><span class="field-label">Entidade</span><span class="value">${escapeHtml(item.entity)}</span></div>
        <div class="reference-field reference"><span class="field-label">Referência</span><span class="value">${escapeHtml(item.reference)}</span></div>
        <div class="reference-field amount"><span class="field-label">Montante</span><span class="value">${escapeHtml(item.amount)}</span></div>
        <div class="reference-field"><span class="field-label">Validade</span><span class="value">${escapeHtml(item.dueDate ?? "Sem data")}</span>${item.issuedAt ? `<span class="field-detail">Emitida em ${escapeHtml(item.issuedAt)}</span>` : ""}</div>
      </div>
    </article>`;
  });

  const activeCount = data.references.filter((item) => item.state === "ACTIVE").length;
  const source = data.sourceLabel ?? "Secretaria Académica UOR";
  const cardPages: string[][] = [];
  for (let index = 0; index < cards.length; index += 2) cardPages.push(cards.slice(index, index + 2));

  const pages = cardPages.map((pageCards, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const isLastPage = pageNumber === cardPages.length;
    return `
      <header class="topbar">
        ${brandLockup()}
        <div class="document-meta"><span class="document-kicker">Documento financeiro</span><span class="document-id">ID ${escapeHtml(data.documentId)}</span></div>
      </header>
      <section>
        <h1>Referências de pagamento</h1>
        <p class="lede">Dados organizados pela UOR Estudante para uma consulta clara, segura e imediata das obrigações académicas.</p>
        <div class="accent-line"></div>
      </section>
      <section class="identity-panel" aria-label="Identificação do estudante">
        <div class="wide"><span class="eyebrow">Estudante</span><div class="identity-name">${escapeHtml(data.student.displayName)}</div></div>
        <div><span class="field-label">N.º de estudante</span><span class="field-value">${escapeHtml(data.student.studentNumber)}</span></div>
        <div><span class="field-label">Ano académico</span><span class="field-value">${escapeHtml(data.student.academicYear)}</span></div>
        <div><span class="field-label">Curso</span><span class="field-value">${escapeHtml(data.student.course)}</span></div>
        <div><span class="field-label">Emitido em</span><span class="field-value">${escapeHtml(data.generatedAt)}</span></div>
      </section>
      <div class="summary">
        <h2>Pagamentos associados</h2>
        <div class="summary-metric"><strong>${activeCount}</strong><span>ativas${data.totalLabel ? ` · ${escapeHtml(data.totalLabel)}` : ""}</span></div>
      </div>
      <section class="references" aria-label="Referências">${pageCards.join("")}</section>
      ${isLastPage ? `<section class="instructions">
        <div><h2>Como pagar</h2><p>Use os dados exatamente como apresentados. Confirme sempre a entidade, a referência e o montante antes de autorizar a operação.</p></div>
        <div class="steps"><div class="step"><b>1</b>Abra Pagamentos por Referência no seu banco.</div><div class="step"><b>2</b>Introduza entidade, referência e montante.</div><div class="step"><b>3</b>Guarde o comprovativo emitido pelo banco.</div></div>
      </section>` : ""}
      <footer class="footer-note">
        <div class="footer-source"><strong>Origem:</strong> ${escapeHtml(source)}. A UOR Estudante apresenta os dados fornecidos pela Secretaria e não processa a transação bancária. Este documento não substitui recibo fiscal nem comprovativo bancário.</div>
        <div class="page-count">${pageNumber} / ${cardPages.length}</div>
      </footer>
    `;
  });
  return documentShell(pages, "UOR Estudante · Referências de pagamento");
}

export async function renderUorEstudantePaymentReferencesPdf(data: UorEstudantePaymentReferencesDocument) {
  return renderPdfFromHtml(buildUorEstudantePaymentReferencesHtml(data), {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
}

const receiptLabels: Record<string, string> = {
  description: "Descrição",
  dueDate: "Vencimento",
  invoiced: "Faturado",
  paid: "Pago",
  itemType: "Tipo",
  quantity: "Quantidade",
  amount: "Valor",
  surcharge: "Acréscimo",
  discount: "Desconto",
  vat: "IVA",
  debtAmount: "Dívida",
  modality: "Modalidade",
  voided: "Anulado",
  installment: "Prestação",
  notes: "Observações",
};

export function buildUorEstudanteReceiptHtml(
  fields: Record<string, string | boolean | null>,
  observedAt: string,
  context: { studentNumber?: string; documentId?: string } = {},
) {
  const rows = Object.entries(fields).map(([key, value]) => {
    const normalized = typeof value === "boolean" ? (value ? "Sim" : "Não") : value ?? "—";
    return `<tr><th>${escapeHtml(receiptLabels[key] ?? key)}</th><td>${escapeHtml(normalized)}</td></tr>`;
  }).join("");
  return documentShell([`
    <header class="topbar">${brandLockup()}<div class="document-meta"><span class="document-kicker">Extrato financeiro</span><span class="document-id">${escapeHtml(context.documentId ?? "Consulta Secretaria")}</span></div></header>
    <section><h1>Detalhe de pagamento</h1><p class="lede">Registo financeiro consultado na Secretaria UOR e apresentado na identidade UOR Estudante.</p><div class="accent-line"></div></section>
    ${context.studentNumber ? `<section class="identity-panel"><div class="wide"><span class="eyebrow">N.º de estudante</span><div class="identity-name">${escapeHtml(context.studentNumber)}</div></div><div><span class="field-label">Consultado em</span><span class="field-value">${escapeHtml(observedAt)}</span></div><div><span class="field-label">Origem</span><span class="field-value">Secretaria UOR</span></div></section>` : ""}
    <table class="details-table"><tbody>${rows}</tbody></table>
    <div class="notice"><strong>Documento informativo.</strong> Este extrato facilita a consulta no ecossistema UOR Connect, mas não substitui recibo fiscal nem comprovativo emitido pelo banco.</div>
    <footer class="footer-note"><div class="footer-source"><strong>UOR Estudante</strong> · Informação observada em ${escapeHtml(observedAt)}.</div><div class="page-count">1 / 1</div></footer>
  `], "UOR Estudante · Detalhe de pagamento");
}

export async function renderUorEstudanteReceiptPdf(
  fields: Record<string, string | boolean | null>,
  observedAt: string,
  context: { studentNumber?: string; documentId?: string } = {},
) {
  return renderPdfFromHtml(buildUorEstudanteReceiptHtml(fields, observedAt, context), {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
}

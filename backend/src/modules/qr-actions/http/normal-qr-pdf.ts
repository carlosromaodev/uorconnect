import type { Env } from "../../../config/env";
import { renderQrDataUri } from "../../../shared/qr";
import { escapeHtml, loadLogoDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";
import { buildValidationUrl } from "../../validation/application/validation-links";

export interface NormalQrPdfParams {
  token: string;
  title: string;
  typeLabel: string;
  contextLabel: string;
  resultLabel: string;
  statusLabel: string;
  subtitle?: string | null;
  description?: string | null;
  targetLabel?: string | null;
  scanHint?: string | null;
}

export function safeQrPdfFilePart(value: string | null | undefined, fallback = "qr") {
  const normalized = (value ?? fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

export async function renderNormalQrPdf(env: Env, params: NormalQrPdfParams) {
  const validationUrl = buildValidationUrl(env, params.token);
  const [qrDataUri, logoDataUri] = await Promise.all([
    renderQrDataUri(validationUrl, 1000),
    loadLogoDataUri(),
  ]);
  const scanHint = params.scanHint ?? "Escaneia na Minha Área para validar este QR.";
  const description = params.description?.trim()
    || params.targetLabel?.trim()
    || "QR oficial para validação no ecossistema UOR Connect.";
  const accent = "#38bdf8";
  const glow = "rgba(56,189,248,.24)";

  const html = `<!doctype html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(params.title)} · UOR Connect</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; width: 210mm; min-height: 297mm; font-family: Arial, Helvetica, sans-serif; color: #fff; background: #07090f; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .sheet { position: relative; min-height: 297mm; overflow: hidden; padding: 18mm; background: radial-gradient(circle at 50% 31%, ${glow}, transparent 35%), linear-gradient(145deg, #05070c 0%, #111827 52%, #05070c 100%); }
    .sheet::before { content: ""; position: absolute; inset: 10mm; border: .35mm solid rgba(255,255,255,.08); border-radius: 9mm; }
    .sheet::after { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px); background-size: 9mm 9mm; mask-image: radial-gradient(circle at center, #000 0%, transparent 72%); }
    .poster { position: relative; z-index: 1; min-height: 261mm; display: grid; grid-template-rows: auto 1fr auto; gap: 10mm; }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 8mm; }
    .brand { display: flex; align-items: center; gap: 4mm; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.78); }
    .brand img { max-width: 38mm; max-height: 12mm; object-fit: contain; filter: brightness(0) invert(1); }
    .status { border: .3mm solid rgba(255,255,255,.16); border-radius: 999px; padding: 2.4mm 5mm; color: ${accent}; background: rgba(255,255,255,.06); font-size: 11px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
    .center { display: grid; place-items: center; text-align: center; }
    .badge { width: 26mm; height: 26mm; display: grid; place-items: center; margin: 0 auto 5mm; border: .35mm solid rgba(255,255,255,.15); border-radius: 999px; background: rgba(255,255,255,.08); box-shadow: 0 0 24mm ${glow}; color: ${accent}; font-size: 25px; font-weight: 950; letter-spacing: -.04em; }
    .label { margin: 0; color: ${accent}; font-size: 13px; font-weight: 950; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 4mm auto 0; max-width: 154mm; font-size: 38px; line-height: 1.04; font-weight: 950; }
    .subtitle { margin: 3mm auto 0; max-width: 132mm; color: rgba(255,255,255,.72); font-size: 14px; line-height: 1.45; }
    .desc { margin: 3mm auto 0; max-width: 128mm; color: rgba(255,255,255,.58); font-size: 12px; line-height: 1.45; }
    .qr-wrap { width: 102mm; height: 102mm; margin: 9mm auto 0; display: grid; place-items: center; border-radius: 8mm; background: #fff; border: 1.4mm solid ${accent}; box-shadow: 0 12mm 42mm rgba(0,0,0,.45), 0 0 25mm ${glow}; }
    .qr-wrap img { width: 88mm; height: 88mm; }
    .hint { margin: 6mm auto 0; max-width: 125mm; color: rgba(255,255,255,.76); font-size: 13px; font-weight: 800; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }
    .box { min-height: 24mm; border: .3mm solid rgba(255,255,255,.12); border-radius: 4mm; padding: 4mm; background: rgba(255,255,255,.06); }
    .box span { display: block; color: rgba(255,255,255,.48); font-size: 8px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
    .box strong { display: block; margin-top: 2mm; color: #fff; font-size: 12px; line-height: 1.22; }
    .url { margin-top: 5mm; color: rgba(255,255,255,.38); font-size: 8px; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="poster">
      <header class="top">
        <div class="brand">${logoDataUri ? `<img src="${logoDataUri}" alt="UOR Connect" />` : "UOR Connect"}</div>
        <div class="status">${escapeHtml(params.statusLabel)}</div>
      </header>
      <section class="center">
        <div>
          <div class="badge">QR</div>
          <p class="label">QR Operacional</p>
          <h1>${escapeHtml(params.title)}</h1>
          ${params.subtitle ? `<p class="subtitle">${escapeHtml(params.subtitle)}</p>` : ""}
          <p class="desc">${escapeHtml(description)}</p>
          <div class="qr-wrap"><img src="${qrDataUri}" alt="QR de validação" /></div>
          <p class="hint">${escapeHtml(scanHint)}</p>
        </div>
      </section>
      <footer>
        <div class="meta">
          <div class="box"><span>Tipo</span><strong>${escapeHtml(params.typeLabel)}</strong></div>
          <div class="box"><span>Contexto</span><strong>${escapeHtml(params.contextLabel)}</strong></div>
          <div class="box"><span>Leitura</span><strong>Minha Área</strong></div>
          <div class="box"><span>Resultado</span><strong>${escapeHtml(params.resultLabel)}</strong></div>
        </div>
        <p class="url">${escapeHtml(validationUrl)}</p>
      </footer>
    </section>
  </main>
</body>
</html>`;

  return renderPdfFromHtml(html, {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDateLabel(value: Date) {
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export async function loadLogoDataUri() {
  const candidates = [
    { filePath: path.resolve(process.cwd(), "../frontend/public/logoworconnect.png"), mimeType: "image/png" },
    { filePath: path.resolve(process.cwd(), "public/logoworconnect.png"), mimeType: "image/png" },
  ];

  for (const candidate of candidates) {
    try {
      const logo = await readFile(candidate.filePath);
      return `data:${candidate.mimeType};base64,${logo.toString("base64")}`;
    } catch {
      continue;
    }
  }

  return null;
}

export async function renderPdfFromHtml(html: string, options?: {
  landscape?: boolean;
  footerLabel?: string;
  preferCssPageSize?: boolean;
}) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: options?.landscape ?? false,
      preferCSSPageSize: options?.preferCssPageSize ?? false,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="width: 100%; font-size: 9px; color: #61707F; padding: 0 12mm; font-family: Arial, sans-serif; display: flex; justify-content: space-between;">
          <span>${escapeHtml(options?.footerLabel ?? "UOR Connect")}</span>
          <span><span class="pageNumber"></span>/<span class="totalPages"></span></span>
        </div>
      `,
      margin: {
        top: "12mm",
        right: "10mm",
        bottom: "16mm",
        left: "10mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright";

let browserPromise: Promise<Browser> | null = null;

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
    { filePath: path.resolve(process.cwd(), "frontend/public/uorconnect-logo-navbar.png"), mimeType: "image/png" },
    { filePath: path.resolve(process.cwd(), "../frontend/public/uorconnect-logo-navbar.png"), mimeType: "image/png" },
    { filePath: path.resolve(process.cwd(), "public/uorconnect-logo-navbar.png"), mimeType: "image/png" },
    { filePath: path.resolve(process.cwd(), "backend/public/logoworconnect.png"), mimeType: "image/png" },
    { filePath: path.resolve(process.cwd(), "public/logoworconnect.png"), mimeType: "image/png" },
    { filePath: path.resolve(process.cwd(), "../frontend/public/logoworconnect.png"), mimeType: "image/png" },
    { filePath: path.resolve(process.cwd(), "public/logo.svg"), mimeType: "image/svg+xml" },
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

export async function loadCertificateTemplateDataUri() {
  const candidates = [
    { filePath: path.resolve(process.cwd(), "backend/public/certificate-template-transparent.png"), mimeType: "image/png" },
    { filePath: path.resolve(process.cwd(), "public/certificate-template-transparent.png"), mimeType: "image/png" },
    { filePath: path.resolve(process.cwd(), "../backend/public/certificate-template-transparent.png"), mimeType: "image/png" },
  ];

  for (const candidate of candidates) {
    try {
      const img = await readFile(candidate.filePath);
      return `data:${candidate.mimeType};base64,${img.toString("base64")}`;
    } catch {
      continue;
    }
  }

  return null;
}

async function getPdfBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }

  try {
    const browser = await browserPromise;
    if (browser.isConnected()) return browser;
  } catch {
    // Reset below and open a fresh browser.
  }

  browserPromise = chromium.launch({ headless: true });
  return browserPromise;
}

export async function renderPdfFromHtml(html: string, options?: {
  landscape?: boolean;
  footerLabel?: string;
  preferCssPageSize?: boolean;
  displayHeaderFooter?: boolean;
  margin?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
}) {
  const browser = await getPdfBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: options?.landscape ?? false,
      preferCSSPageSize: options?.preferCssPageSize ?? false,
      printBackground: true,
      displayHeaderFooter: options?.displayHeaderFooter ?? true,
      headerTemplate: "<div></div>",
	      footerTemplate: `
	        <div style="width: 100%; font-size: 9px; color: #5F6F7D; padding: 0 12mm; font-family: 'Segoe UI', Arial, sans-serif; display: flex; align-items: center; justify-content: space-between;">
	          <span style="font-weight: 600; letter-spacing: 0.04em;">${escapeHtml(options?.footerLabel ?? "UOR Connect")}</span>
	          <span style="font-variant-numeric: tabular-nums;"><span class="pageNumber"></span>/<span class="totalPages"></span></span>
	        </div>
	      `,
      margin: options?.margin ?? {
        top: "12mm",
        right: "10mm",
        bottom: "16mm",
        left: "10mm",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

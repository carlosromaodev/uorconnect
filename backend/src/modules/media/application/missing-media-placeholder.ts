const IMAGE_FILE_PATTERN = /\.(?:png|jpe?g|webp)$/i;

export type MissingImagePlaceholder = {
  mimeType: "image/svg+xml; charset=utf-8";
  body: string;
};

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileNameFromPath(value: string) {
  return value.split(/[\\/]/).pop()?.split(/[?#]/)[0] || "imagem";
}

export function getMissingImagePlaceholder(value?: string | null): MissingImagePlaceholder | null {
  const cleaned = value?.trim();
  if (!cleaned) return null;

  const pathOnly = cleaned.split(/[?#]/)[0] ?? cleaned;
  if (!IMAGE_FILE_PATTERN.test(pathOnly)) return null;

  const label = escapeSvgText(fileNameFromPath(pathOnly));
  return {
    mimeType: "image/svg+xml; charset=utf-8",
    body: `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640" role="img" aria-label="Imagem indisponivel">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="55%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="line" x1="0" x2="1">
      <stop offset="0%" stop-color="#f97316"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="960" height="640" rx="42" fill="url(#bg)"/>
  <path d="M120 470 315 282l125 118 85-82 315 152" fill="none" stroke="url(#line)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
  <circle cx="680" cy="202" r="54" fill="#f97316" opacity=".9"/>
  <rect x="110" y="94" width="740" height="452" rx="28" fill="none" stroke="#f8fafc" stroke-width="8" opacity=".38"/>
  <text x="480" y="566" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="#f8fafc">Imagem indisponivel</text>
  <text x="480" y="606" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="20" fill="#cbd5e1">${label}</text>
</svg>`,
  };
}

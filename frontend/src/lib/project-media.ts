import { resolveAbsoluteAssetUrl } from "@/lib/runtime-config";

const DATA_IMAGE_URL_PATTERN = /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i;

type LocationLike = Pick<Location, "hostname" | "origin">;

export function getProjectBannerSource(
  value?: string | null,
  explicitBase?: string,
  currentLocation?: LocationLike,
) {
  const normalized = value?.trim();
  if (!normalized) return null;

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (/^\/(?:api\/)?media\/files\//i.test(normalized)) {
    return resolveAbsoluteAssetUrl(normalized, explicitBase, currentLocation);
  }

  if (DATA_IMAGE_URL_PATTERN.test(normalized)) {
    return normalized;
  }

  return null;
}

export function readImageFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    reader.readAsDataURL(file);
  });
}

type ImageDataUrlOptions = {
  maxLength?: number;
  maxDimension?: number;
  minQuality?: number;
};

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível processar a imagem selecionada."));
    image.src = source;
  });
}

export async function readCompressedImageFileAsDataUrl(file: File, options: ImageDataUrlOptions = {}) {
  const maxLength = options.maxLength ?? 460_000;
  const maxDimension = options.maxDimension ?? 512;
  const minQuality = options.minQuality ?? 0.4;

  // Skip FileReader for small files that are likely already fine
  const image = await loadImage(URL.createObjectURL(file));
  const needsResize = image.naturalWidth > maxDimension || image.naturalHeight > maxDimension;

  // If the file is small enough and no resize needed, read as-is
  if (file.size <= maxLength * 0.65 && !needsResize) {
    URL.revokeObjectURL(image.src);
    return readImageFileAsDataUrl(file);
  }

  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Não foi possível preparar a imagem selecionada.");
  }
  context.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(image.src);

  // Binary search for the best quality that fits under maxLength (2-3 iterations vs 5-7)
  let lo = minQuality;
  let hi = 0.82;
  let best: string | null = null;

  for (let i = 0; i < 4; i++) {
    const mid = (lo + hi) / 2;
    const result = canvas.toDataURL("image/jpeg", mid);
    if (result.length <= maxLength) {
      best = result;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (best) return best;

  // Last attempt at minimum quality
  const last = canvas.toDataURL("image/jpeg", minQuality);
  if (last.length <= maxLength) return last;

  throw new Error("A fotografia é muito pesada. Escolhe uma imagem menor.");
}

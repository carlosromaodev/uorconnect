import QRCode from "qrcode";

type QrSize = 180 | 220 | 280;

export async function renderQrSvg(value: string, size: QrSize = 280) {
  return QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
  });
}

export async function renderQrDataUri(value: string, size: QrSize = 280) {
  const svg = await renderQrSvg(value, size);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

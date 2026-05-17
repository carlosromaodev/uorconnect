import QRCode from "qrcode";

type QrSize = 180 | 220 | 280 | 720 | 1000;

type QrRenderOptions = {
  transparentBackground?: boolean;
};

export async function renderQrSvg(value: string, size: QrSize = 280, options: QrRenderOptions = {}) {
  return QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    ...(options.transparentBackground
      ? { color: { light: "#00000000" } }
      : {}),
  });
}

export async function renderQrDataUri(value: string, size: QrSize = 280, options: QrRenderOptions = {}) {
  const svg = await renderQrSvg(value, size, options);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

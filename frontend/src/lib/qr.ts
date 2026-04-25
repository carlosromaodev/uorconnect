import QRCode from "qrcode";

export async function createQrDataUrl(value: string, size = 220) {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
  });
}

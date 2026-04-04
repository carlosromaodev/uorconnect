export async function downloadRemoteFile(url: string, fileName: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Não foi possível preparar o download agora.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

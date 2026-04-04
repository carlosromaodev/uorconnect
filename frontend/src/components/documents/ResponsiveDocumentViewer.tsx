import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, ExternalLink, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type ResponsiveDocumentViewerProps = {
  source?: string | null;
  fileName?: string | null;
  title: string;
  description?: string;
  openLabel?: string;
  downloadLabel?: string;
  onDownload?: () => void | Promise<void>;
};

function detectPreviewKind(source?: string | null) {
  if (!source) return "none";
  if (/^data:application\/pdf/i.test(source) || /\.pdf($|\?)/i.test(source)) return "pdf";
  if (/^data:image\//i.test(source)) return "image";
  return "external";
}

export function ResponsiveDocumentViewer({
  source,
  fileName,
  title,
  description,
  openLabel = "Abrir ficheiro",
  downloadLabel = "Baixar ficheiro",
  onDownload,
}: ResponsiveDocumentViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const previewKind = useMemo(() => detectPreviewKind(source), [source]);
  const canPreviewInline = previewKind === "pdf" || previewKind === "image";

  return (
    <div className="document-frame">
      <div className="flex flex-col gap-3 border-b border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {previewKind === "image" ? (
              <ImageIcon className="h-4 w-4 text-primary" />
            ) : (
              <FileText className="h-4 w-4 text-primary" />
            )}
            <p className="text-sm font-semibold text-foreground">{title}</p>
          </div>
          {fileName ? (
            <div className="mt-2 max-w-full rounded-2xl border border-border/60 bg-white/70 px-3 py-2 shadow-sm">
              <p className="safe-break text-xs leading-5 text-muted-foreground">{fileName}</p>
            </div>
          ) : null}
          {description ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:max-w-[320px] sm:flex-row sm:flex-wrap sm:justify-end">
          {canPreviewInline ? (
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-10 rounded-2xl border-border/70 bg-white/80 px-3 py-2 text-left text-sm whitespace-normal shadow-sm sm:max-w-full"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? "Ocultar preview" : "Ver preview"}
            </Button>
          ) : null}
          {source ? (
            <Button type="button" variant="outline" className="h-auto min-h-10 rounded-2xl border-border/70 bg-white/80 px-3 py-2 text-left text-sm whitespace-normal shadow-sm sm:max-w-full" asChild>
              <a href={source} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="h-4 w-4" />
                {openLabel}
              </a>
            </Button>
          ) : null}
          {onDownload ? (
            <Button type="button" className="h-auto min-h-10 rounded-2xl px-3 py-2 text-left text-sm whitespace-normal shadow-sm sm:max-w-full" onClick={() => void onDownload()}>
              <Download className="h-4 w-4" />
              {downloadLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {expanded && source ? (
        <div className="document-frame__viewport">
          {previewKind === "pdf" ? (
            <iframe title={title} src={source} className="block h-[min(65dvh,680px)] w-full border-0 bg-white md:h-[min(72dvh,720px)]" />
          ) : previewKind === "image" ? (
            <div className="flex min-h-[220px] items-start justify-center p-2 sm:p-4">
              <img src={source} alt={fileName || title} className="h-auto max-w-full rounded-[20px] object-contain shadow-[0_16px_34px_rgba(15,23,42,0.12)]" />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

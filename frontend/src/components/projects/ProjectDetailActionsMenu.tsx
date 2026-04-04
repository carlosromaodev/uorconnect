import {
  Copy,
  Download,
  ExternalLink,
  Github,
  Globe,
  MoreVertical,
  Share2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectDetailActionsMenu({
  onCopyLink,
  onDownloadQr,
  onShare,
  repoUrl,
  websiteUrl,
}: {
  onCopyLink: () => void | Promise<void>;
  onDownloadQr: () => void | Promise<void>;
  onShare: () => void | Promise<void>;
  repoUrl?: string | null;
  websiteUrl?: string | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full p-2 transition-colors hover:bg-white/60"
          aria-label="Mais ações do expositor"
        >
          <MoreVertical className="h-6 w-6 text-slate-700" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/70 p-2 shadow-lg">
        <DropdownMenuLabel className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Ações
        </DropdownMenuLabel>
        <DropdownMenuItem className="rounded-xl py-2.5" onClick={() => void onShare()}>
          <Share2 className="mr-2 h-4 w-4" />
          Partilhar
        </DropdownMenuItem>
        <DropdownMenuItem className="rounded-xl py-2.5" onClick={() => void onCopyLink()}>
          <Copy className="mr-2 h-4 w-4" />
          Copiar link
        </DropdownMenuItem>
        <DropdownMenuItem className="rounded-xl py-2.5" onClick={() => void onDownloadQr()}>
          <Download className="mr-2 h-4 w-4" />
          Baixar QR PNG
        </DropdownMenuItem>

        {(websiteUrl || repoUrl) ? <DropdownMenuSeparator /> : null}

        {websiteUrl ? (
          <DropdownMenuItem
            className="rounded-xl py-2.5"
            onClick={() => window.open(websiteUrl, "_blank", "noopener,noreferrer")}
          >
            <Globe className="mr-2 h-4 w-4" />
            Visitar Website
            <ExternalLink className="ml-auto h-4 w-4" />
          </DropdownMenuItem>
        ) : null}

        {repoUrl ? (
          <DropdownMenuItem
            className="rounded-xl py-2.5"
            onClick={() => window.open(repoUrl, "_blank", "noopener,noreferrer")}
          >
            <Github className="mr-2 h-4 w-4" />
            Abrir repositório
            <ExternalLink className="ml-auto h-4 w-4" />
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

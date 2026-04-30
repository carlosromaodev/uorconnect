import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

type LookupMode = "colega" | "certificado" | "pdf_url" | "validacao_url";

interface LookupResult {
  value: string;
  label: string;
  detail?: string;
}

interface PlaceholderLookupModalProps {
  mode: LookupMode;
  open: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
}

const modeMeta: Record<LookupMode, { title: string; searchPlaceholder: string }> = {
  colega: { title: "Selecionar colega", searchPlaceholder: "Pesquisar por nome, número ou curso..." },
  certificado: { title: "Selecionar certificado", searchPlaceholder: "Pesquisar por título, código ou destinatário..." },
  pdf_url: { title: "Selecionar PDF de certificado", searchPlaceholder: "Pesquisar certificado para obter o PDF..." },
  validacao_url: { title: "Selecionar link de validação", searchPlaceholder: "Pesquisar certificado para obter o link..." },
};

export function PlaceholderLookupModal({ mode, open, onClose, onSelect }: PlaceholderLookupModalProps) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LookupResult[]>([]);

  const meta = modeMeta[mode];

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      if (mode === "colega") {
        const payload = await api.students.listPaged({ search: query, limit: 20 });
        setResults(payload.items.map((s) => ({
          value: s.name ?? s.studentNumber,
          label: s.name ?? s.studentNumber,
          detail: `${s.studentNumber}${s.course ? ` · ${s.course}` : ""}`,
        })));
      } else {
        const payload = await api.certificates.list({ search: query, limit: 20, status: "ISSUED" });
        setResults(payload.items.map((c) => {
          if (mode === "pdf_url") {
            const baseUrl = window.location.origin;
            return {
              value: `${baseUrl}/api/certificates/${c.id}/pdf`,
              label: c.title,
              detail: `${c.recipientName}${c.recipientNumber ? ` · ${c.recipientNumber}` : ""} · ${c.code}`,
            };
          }
          if (mode === "validacao_url") {
            return {
              value: c.validationUrl,
              label: c.title,
              detail: `${c.recipientName}${c.recipientNumber ? ` · ${c.recipientNumber}` : ""} · ${c.code}`,
            };
          }
          return {
            value: c.title,
            label: c.title,
            detail: `${c.recipientName}${c.recipientNumber ? ` · ${c.recipientNumber}` : ""} · ${c.code}`,
          };
        }));
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      void doSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, open, doSearch]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg overflow-hidden rounded-2xl p-0">
        <DialogHeader className="border-b border-border/60 px-5 pt-5 pb-4">
          <DialogTitle className="text-base">{meta.title}</DialogTitle>
        </DialogHeader>

        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={meta.searchPlaceholder}
              className="pl-9"
              autoFocus
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="max-h-[320px] min-h-[120px] overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              A pesquisar...
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {search.trim() ? "Nenhum resultado encontrado." : "Escreve para pesquisar..."}
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((result, idx) => (
                <button
                  key={`${result.value}-${idx}`}
                  type="button"
                  onClick={() => {
                    onSelect(result.value);
                    onClose();
                  }}
                  className="flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="text-sm font-medium text-foreground">{result.label}</span>
                  {result.detail ? (
                    <span className="mt-0.5 text-xs text-muted-foreground">{result.detail}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border/60 px-5 py-3">
          <Button variant="outline" size="sm" className="w-full" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

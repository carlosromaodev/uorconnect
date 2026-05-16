import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Copy, Download, ExternalLink, Loader2, MessageSquareMore, Pencil, QrCode, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { ResponsiveDocumentViewer } from "@/components/documents/ResponsiveDocumentViewer";
import { api, type StudentSubmissionReceipt, isAuthError, setToken } from "@/lib/api";
import { buildSubmissionLegend, downloadBlobFile, formatDateTime, toAbsoluteAssetUrl } from "@/lib/student-documents";

function statusTone(status: string) {
  if (status === "APPROVED") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (status === "REJECTED") return "bg-rose-500/10 text-rose-700 border-rose-500/20";
  return "bg-amber-500/10 text-amber-700 border-amber-500/20";
}

const celebrationParticles = [
  { size: "h-3 w-3", color: "bg-primary/30", top: "top-8", left: "left-[8%]", delay: 0 },
  { size: "h-2.5 w-2.5", color: "bg-emerald-400/40", top: "top-20", left: "left-[28%]", delay: 0.08 },
  { size: "h-4 w-4", color: "bg-sky-400/30", top: "top-10", left: "right-[16%]", delay: 0.14 },
  { size: "h-2.5 w-2.5", color: "bg-primary/40", top: "top-28", left: "right-[30%]", delay: 0.22 },
];

function PaymentTimeline({ items }: { items?: StudentSubmissionReceipt["paymentTimeline"] }) {
  const visibleItems = (items ?? []).filter((item) => item.label);
  if (visibleItems.length === 0) return null;

  return (
    <section className="surface-card min-w-0 p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Linha do tempo do pagamento</p>
        <h2 className="mt-2 text-xl font-semibold">Revisão financeira</h2>
      </div>
      <div className="mt-5 grid gap-3">
        {visibleItems.map((item, index) => (
          <div key={`${item.key}-${index}`} className="grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-[auto_1fr]">
            <div className={`mt-1 h-3 w-3 rounded-full ${item.status === "done" ? "bg-emerald-500" : item.status === "current" ? "bg-amber-500" : "bg-slate-300"}`} />
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold">{item.label}</p>
              <p className="mt-1 break-words text-xs text-muted-foreground">
                {item.at ? formatDateTime(item.at) : "Sem data registada"}
                {item.by ? ` · Por ${item.by}` : ""}
              </p>
              {item.note ? <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{item.note}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function SubmissionReceipt() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const submissionId = Number(id);

  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<StudentSubmissionReceipt | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "UOR Connect | Recibo da Submissão";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    if (!Number.isFinite(submissionId) || submissionId <= 0) {
      setLoading(false);
      return;
    }

    let active = true;

    api.submissions.receipt(submissionId)
      .then((data) => {
        if (!active) return;
        setReceipt(data);
      })
      .catch((error) => {
        if (!active) return;

        if (isAuthError(error)) {
          setToken(null);
          navigate("/login", { replace: true });
          return;
        }

        toast.error(error instanceof Error ? error.message : "Não foi possível abrir o recibo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate, submissionId]);

  const shareLegend = useMemo(() => (receipt ? buildSubmissionLegend(receipt) : ""), [receipt]);
  const paymentProofSource = toAbsoluteAssetUrl(receipt?.paymentProofPath);

  const handleCopyLegend = async () => {
    if (!shareLegend) return;

    try {
      await navigator.clipboard.writeText(shareLegend);
      toast.success("Legenda copiada.");
    } catch {
      toast.error("Não foi possível copiar a legenda.");
    }
  };

  const handleDownload = async () => {
    if (!receipt) return;

    try {
      setDownloading(true);
      const pdf = await api.submissions.boardingPassPdf(receipt.id);
      downloadBlobFile(pdf, `${receipt.referenceCode.toLowerCase()}-talao.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar o talão.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-section">
        <div className="page-shell flex min-h-[60vh] items-center justify-center">
          <div className="surface-card flex items-center gap-3 px-6 py-5">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm font-medium text-muted-foreground">A carregar recibo da submissão...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="page-section">
        <div className="page-shell">
          <div className="surface-card p-6 sm:p-8">
            <h1 className="text-2xl font-bold">Recibo indisponível</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">Esta submissão não foi encontrada ou já não está acessível na tua sessão.</p>
            <Button asChild className="mt-6 rounded-xl">
              <Link to="/minha-area">Ir para Minha Área</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-section uor-page-bg">
      <div className="page-shell-narrow space-y-6 sm:space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="surface-card relative overflow-hidden border-border/70 bg-[linear-gradient(145deg,rgba(253,131,5,0.14),rgba(255,255,255,0.98),rgba(34,61,66,0.10))] p-0"
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#FD8305,#223D42)]" />
          <div className="absolute -right-10 top-10 h-32 w-32 rounded-full bg-primary/12 blur-3xl" />
          <div className="absolute left-8 top-12 h-24 w-24 rounded-full bg-emerald-500/10 blur-3xl" />
          {receipt.status === "APPROVED"
            ? celebrationParticles.map((particle, index) => (
              <motion.span
                key={`${particle.top}-${particle.left}-${index}`}
                className={`pointer-events-none absolute ${particle.top} ${particle.left} ${particle.size} rounded-full ${particle.color}`}
                initial={{ opacity: 0, scale: 0.4, y: 8 }}
                animate={{ opacity: [0.15, 0.8, 0.2], scale: [0.8, 1.2, 0.9], y: [0, -10, 0] }}
                transition={{ duration: 2.8, delay: particle.delay, repeat: Infinity, repeatType: "mirror" }}
              />
            ))
            : null}

          <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,360px)]">
            <div className="min-w-0 p-4 sm:p-6 lg:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(receipt.status)}`}>
                  {receipt.statusLabel}
                </span>
                <span className="rounded-full border border-primary/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {receipt.typeLabel}
                </span>
              </div>

              <div className="mt-6 space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  Talão de embarque
                </div>
                <h1 className="safe-break font-heading text-3xl font-bold leading-tight sm:text-4xl">{receipt.name}</h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Este é o teu recibo canónico. Podes voltar aqui mais tarde pela tua área do estudante sem depender do ecrã de sucesso inicial.
                </p>
              </div>

              <div className="mt-8 responsive-two-col items-start">
                <div className="min-w-0 rounded-[18px] border border-white/70 bg-white/92 p-4 shadow-sm sm:p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <QrCode className="h-4 w-4" />
                    Referência
                  </div>
                  <p className="mt-3 break-all font-mono text-2xl font-bold text-slate-900 shadow-[0_0_24px_rgba(253,131,5,0.10)]">{receipt.referenceCode}</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Submetido em</p>
                      <p className="mt-2 break-words text-sm font-semibold">{formatDateTime(receipt.createdAt)}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Atualizado em</p>
                      <p className="mt-2 break-words text-sm font-semibold">{formatDateTime(receipt.updatedAt)}</p>
                    </div>
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.24, delay: 0.08, ease: "easeOut" }}
                  className="min-w-0 rounded-[18px] border border-slate-900/10 bg-slate-950 p-4 text-white shadow-lg sm:p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 shadow-[0_0_22px_rgba(34,211,238,0.18)]">
                      <CheckCircle2 className="h-6 w-6 text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Estado atual</p>
                      <p className="text-lg font-semibold">{receipt.statusLabel}</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Responsável</p>
                      <p className="mt-2 break-words text-sm font-semibold">{receipt.leaderName || "Não informado"}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Contacto</p>
                      <p className="mt-2 break-words text-sm font-semibold">{receipt.leaderPhone || "Não informado"}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Curso</p>
                      <p className="mt-2 break-words text-sm font-semibold">{receipt.course || "Curso não informado"}</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="min-w-0 border-t border-border/70 bg-slate-950 p-4 text-white sm:p-6 xl:border-l xl:border-t-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Ações do recibo</p>
              <div className="mt-5 grid gap-3">
                <Button className="h-auto min-h-11 justify-start rounded-xl px-4 py-3 text-left whitespace-normal bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => void handleDownload()} disabled={downloading}>
                  {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Baixar talão em PDF
                </Button>
                <Button variant="outline" className="h-auto min-h-11 justify-start rounded-xl border-white/10 bg-transparent px-4 py-3 text-left whitespace-normal text-white hover:bg-white/10" onClick={() => void handleCopyLegend()}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar legenda
                </Button>
                <Button asChild variant="outline" className="h-auto min-h-11 justify-start rounded-xl border-white/10 bg-transparent px-4 py-3 text-left whitespace-normal text-white hover:bg-white/10">
                  <a href={`https://wa.me/?text=${encodeURIComponent(shareLegend)}`} target="_blank" rel="noreferrer">
                    <MessageSquareMore className="mr-2 h-4 w-4" />
                    Partilhar no WhatsApp
                  </a>
                </Button>
                {receipt.communityUrl ? (
                  <Button asChild variant="outline" className="h-auto min-h-11 justify-start rounded-xl border-white/10 bg-transparent px-4 py-3 text-left whitespace-normal text-white hover:bg-white/10">
                    <a href={receipt.communityUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir comunidade
                    </a>
                  </Button>
                ) : null}
                {receipt.canEdit ? (
                  <Button asChild variant="outline" className="h-auto min-h-11 justify-start rounded-xl border-white/10 bg-transparent px-4 py-3 text-left whitespace-normal text-white hover:bg-white/10">
                    <Link to={`/submeter?editar=${receipt.id}`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar submissão
                    </Link>
                  </Button>
                ) : null}
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">Legenda pronta</p>
                <div className="surface-scroll-y mt-3 max-h-[22dvh] rounded-2xl border border-white/10 bg-black/20 p-4 md:max-h-[28dvh]">
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-white/80">{shareLegend}</pre>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <PaymentTimeline items={receipt.paymentTimeline} />

        <div className="responsive-two-col items-start">
          <section className="surface-card min-w-0 space-y-5 p-4 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Detalhes da candidatura</p>
              <p className="mt-2 break-words text-sm leading-7 text-muted-foreground">{receipt.description}</p>
            </div>
            <div className="responsive-grid">
              <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Área</p>
                <p className="mt-2 break-words text-sm font-semibold">{receipt.area}</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Membros</p>
                <p className="mt-2 text-sm font-semibold">{receipt.teamSize} pessoa(s)</p>
              </div>
              {receipt.stage ? (
                <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Estágio</p>
                  <p className="mt-2 break-words text-sm font-semibold">{receipt.stage}</p>
                </div>
              ) : null}
              {receipt.category ? (
                <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Categoria</p>
                  <p className="mt-2 break-words text-sm font-semibold">{receipt.category}</p>
                </div>
              ) : null}
            </div>

            <div className="min-w-0 rounded-3xl border border-border/60 bg-background/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Equipa</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {receipt.membersList.map((member, index) => (
                  <div key={`${member}-${index}`} className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm font-medium break-words">
                    {member}
                  </div>
                ))}
              </div>
            </div>

            {receipt.observations ? (
              <div className="min-w-0 rounded-3xl border border-border/60 bg-background/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Observações</p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{receipt.observations}</p>
              </div>
            ) : null}
          </section>

          <section className="min-w-0 space-y-5">
            <ResponsiveDocumentViewer
              title="Comprovativo submetido"
              description="O preview fica sempre dentro de um container controlado para não rebentar a responsividade."
              source={paymentProofSource}
              fileName={paymentProofSource ? "Comprovativo da submissão" : null}
            />

            <div className="surface-card min-w-0 p-4 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Links úteis</p>
              <div className="mt-4 grid gap-3">
                {receipt.detailPath ? (
                  <Button asChild variant="outline" className="h-auto min-h-11 justify-start rounded-xl px-4 py-3 text-left whitespace-normal">
                    <Link to={receipt.detailPath}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Ver página pública
                    </Link>
                  </Button>
                ) : null}
                {receipt.websiteUrl ? (
                  <Button asChild variant="outline" className="h-auto min-h-11 justify-start rounded-xl px-4 py-3 text-left whitespace-normal">
                    <a href={receipt.websiteUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Visitar Website
                    </a>
                  </Button>
                ) : null}
                {receipt.repoUrl ? (
                  <Button asChild variant="outline" className="h-auto min-h-11 justify-start rounded-xl px-4 py-3 text-left whitespace-normal">
                    <a href={receipt.repoUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir repositório
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

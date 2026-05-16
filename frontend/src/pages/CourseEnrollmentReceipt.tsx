import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Copy, Download, ExternalLink, GraduationCap, Loader2, MessageSquareMore, Sparkles } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { ResponsiveDocumentViewer } from "@/components/documents/ResponsiveDocumentViewer";
import { api, type StudentEnrollmentReceipt, isAuthError, setToken } from "@/lib/api";
import { buildCourseEnrollmentLegend, downloadBlobFile, formatDateTime, toAbsoluteAssetUrl } from "@/lib/student-documents";

function statusTone(status: string) {
  if (["CONFIRMED_BY_ADMIN", "CONFIRMED", "APPROVED"].includes(status)) return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (["PENDING_REVIEW", "PENDING", "SUBMITTED_BY_USER"].includes(status)) return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  return "bg-slate-500/10 text-slate-700 border-slate-500/20";
}

const celebrationParticles = [
  { size: "h-3 w-3", color: "bg-primary/30", top: "top-8", left: "left-[8%]", delay: 0 },
  { size: "h-2.5 w-2.5", color: "bg-emerald-400/40", top: "top-20", left: "left-[28%]", delay: 0.08 },
  { size: "h-4 w-4", color: "bg-sky-400/30", top: "top-10", left: "right-[16%]", delay: 0.14 },
  { size: "h-2.5 w-2.5", color: "bg-primary/40", top: "top-28", left: "right-[30%]", delay: 0.22 },
];

function PaymentTimeline({ items }: { items?: StudentEnrollmentReceipt["paymentTimeline"] }) {
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

export default function CourseEnrollmentReceipt() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const enrollmentId = Number(id);

  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<StudentEnrollmentReceipt | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "UOR Connect | Recibo da Inscrição";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    if (!Number.isFinite(enrollmentId) || enrollmentId <= 0) {
      setLoading(false);
      return;
    }

    let active = true;

    api.courses.enrollmentReceipt(enrollmentId)
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

        toast.error(error instanceof Error ? error.message : "Não foi possível abrir a inscrição.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enrollmentId, navigate]);

  const shareLegend = useMemo(() => (receipt ? buildCourseEnrollmentLegend(receipt) : ""), [receipt]);
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
      const blob = await api.courses.enrollmentTicketPdf(receipt.id);
      downloadBlobFile(blob, `${receipt.referenceCode.toLowerCase()}-curso.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar o PDF.");
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
            <span className="text-sm font-medium text-muted-foreground">A carregar recibo da inscrição...</span>
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
            <h1 className="text-2xl font-bold">Inscrição indisponível</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">Não foi possível localizar esta inscrição dentro da tua conta.</p>
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
          className="surface-card overflow-hidden border-border/70 bg-[linear-gradient(145deg,rgba(253,131,5,0.12),rgba(255,255,255,0.98),rgba(34,61,66,0.08))] p-0"
        >
          {["CONFIRMED_BY_ADMIN", "CONFIRMED", "APPROVED"].includes(receipt.paymentStatus)
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
          <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,360px)]">
            <div className="min-w-0 p-4 sm:p-6 lg:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(receipt.paymentStatus)}`}>
                  {receipt.statusLabel}
                </span>
                <span className="rounded-full border border-primary/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Inscrição em curso
                </span>
              </div>

              <div className="mt-6 space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  Recibo canónico
                </div>
                <h1 className="safe-break font-heading text-3xl font-bold leading-tight sm:text-4xl">{receipt.courseName}</h1>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                  A tua inscrição fica acessível aqui com o estado atual, PDF, comprovativo e link oficial da comunidade quando existir.
                </p>
              </div>

              <div className="mt-8 responsive-two-col items-start">
                <div className="min-w-0 rounded-[18px] border border-white/70 bg-white/92 p-4 shadow-sm sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Referência</p>
                  <p className="mt-3 break-all font-mono text-2xl font-bold">{receipt.referenceCode}</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Inscrito em</p>
                      <p className="mt-2 break-words text-sm font-semibold">{formatDateTime(receipt.enrolledAt)}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Comprovativo enviado</p>
                      <p className="mt-2 break-words text-sm font-semibold">{receipt.paymentSubmittedAt ? formatDateTime(receipt.paymentSubmittedAt) : "Ainda não submetido"}</p>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 rounded-[18px] border border-slate-900/10 bg-slate-950 p-4 text-white shadow-lg sm:p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                      <GraduationCap className="h-6 w-6 text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">Estado atual</p>
                      <p className="text-lg font-semibold">{receipt.statusLabel}</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Estudante</p>
                      <p className="mt-2 break-words text-sm font-semibold">{receipt.fullName}</p>
                      <p className="mt-1 break-words text-xs text-white/60">{receipt.studentNumber}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Curso académico</p>
                      <p className="mt-2 break-words text-sm font-semibold">{receipt.studentCourse || "Não informado"}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Contacto</p>
                      <p className="mt-2 break-words text-sm font-semibold">{receipt.phone || "Não informado"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-0 border-t border-border/70 bg-slate-950 p-4 text-white sm:p-6 xl:border-l xl:border-t-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/55">Ações</p>
              <div className="mt-5 grid gap-3">
                <Button className="h-auto min-h-11 justify-start rounded-xl bg-primary px-4 py-3 text-left whitespace-normal text-primary-foreground hover:bg-primary/90" onClick={() => void handleDownload()} disabled={downloading}>
                  {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Baixar PDF da inscrição
                </Button>
                <Button variant="outline" className="h-auto min-h-11 justify-start rounded-xl border-white/10 bg-transparent px-4 py-3 text-left whitespace-normal text-white hover:bg-white/10" onClick={() => void handleCopyLegend()}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar legenda
                </Button>
                {receipt.whatsAppRedirectUrl ? (
                  <Button asChild variant="outline" className="h-auto min-h-11 justify-start rounded-xl border-white/10 bg-transparent px-4 py-3 text-left whitespace-normal text-white hover:bg-white/10">
                    <a href={receipt.whatsAppRedirectUrl} target="_blank" rel="noreferrer">
                      <MessageSquareMore className="mr-2 h-4 w-4" />
                      Enviar no WhatsApp
                    </a>
                  </Button>
                ) : null}
                {receipt.communityUrl ? (
                  <Button asChild variant="outline" className="h-auto min-h-11 justify-start rounded-xl border-white/10 bg-transparent px-4 py-3 text-left whitespace-normal text-white hover:bg-white/10">
                    <a href={receipt.communityUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir comunidade
                    </a>
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Curso e parceiro</p>
              <h2 className="mt-2 break-words text-xl font-semibold">{receipt.companyName}</h2>
              <p className="mt-1 break-words text-sm text-muted-foreground">{receipt.companyCategory}</p>
              <p className="mt-4 break-words text-sm leading-7 text-muted-foreground">{receipt.courseDescription}</p>
            </div>
            <div className="responsive-grid">
              <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Email</p>
                <p className="mt-2 break-words text-sm font-semibold">{receipt.email || "Não informado"}</p>
              </div>
              <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Telefone de pagamento</p>
                <p className="mt-2 break-words text-sm font-semibold">{receipt.paymentPhone || "Não informado"}</p>
              </div>
            </div>
          </section>

          <section className="min-w-0 space-y-5">
            <ResponsiveDocumentViewer
              title="Comprovativo do pagamento"
              description="O preview do PDF ou imagem fica sempre encaixado dentro de um viewport controlado."
              source={paymentProofSource}
              fileName={paymentProofSource ? "Comprovativo da inscrição" : null}
            />

            <div className="surface-card min-w-0 p-4 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Atalhos</p>
              <div className="mt-4 grid gap-3">
                <Button asChild variant="outline" className="h-auto min-h-11 justify-start rounded-xl px-4 py-3 text-left whitespace-normal">
                  <Link to="/minha-area">
                    <Building2 className="mr-2 h-4 w-4" />
                    Voltar à Minha Área
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-auto min-h-11 justify-start rounded-xl px-4 py-3 text-left whitespace-normal">
                  <Link to={`/cursos/${receipt.courseId}/inscricao`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Atualizar dados da inscrição
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

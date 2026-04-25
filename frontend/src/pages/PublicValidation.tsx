import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, BadgeCheck, CalendarDays, FileCheck2, Loader2, QrCode, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type PublicValidationPayload } from "@/lib/api";

function formatDate(value?: string | null) {
  if (!value) return "Não registado";
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function PublicValidation() {
  const { token = "" } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicValidationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    api.validation.get(token)
      .then((payload) => {
        if (!active) return;
        setData(payload);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Não foi possível validar este registo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const statusLabel = data?.kind === "certificate"
    ? data.valid ? "Certificado válido" : "Certificado revogado"
    : data?.attendance?.checkedIn ? "Presença confirmada" : "Credencial válida";

  return (
    <div className="page-section uor-page-bg">
      <div className="page-shell max-w-4xl">
        <section className="surface-card overflow-hidden border-border/70 bg-white">
          <div className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(253,131,5,0.12),rgba(255,255,255,0.96))] p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <Badge variant="outline" className="w-fit border-primary/25 bg-primary/5 text-primary">
                  Validação pública
                </Badge>
                <div>
                  <h1 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
                    Verificação UOR Connect
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                    Confirma a autenticidade de certificados e credenciais emitidas pelo sistema.
                  </p>
                </div>
              </div>
              <img src="/logoworconnect.png" alt="UOR Connect" className="h-12 w-auto object-contain" />
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error || !data ? (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-semibold text-destructive">Registo não encontrado</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {error ?? "O token informado não corresponde a nenhum registo público."}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${
                      data.valid ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : "border-rose-500/20 bg-rose-500/10 text-rose-700"
                    }`}>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      {statusLabel}
                    </span>
                    <span className="rounded-full border border-border bg-muted/30 px-3 py-1 text-sm font-semibold text-muted-foreground">
                      {data.kind === "certificate" ? "Certificado" : "Credencial"}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      {data.title}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold leading-tight text-foreground">
                      {data.certificate?.recipientName ?? data.attendance?.studentName ?? "Estudante UOR"}
                    </h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <UserRound className="h-5 w-5 text-primary" />
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Número</p>
                      <p className="mt-1 text-sm font-semibold">{data.certificate?.recipientNumber ?? data.attendance?.studentNumber ?? "Não informado"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <FileCheck2 className="h-5 w-5 text-primary" />
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Curso</p>
                      <p className="mt-1 text-sm font-semibold">{data.certificate?.recipientCourse ?? data.attendance?.studentCourse ?? "Não informado"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {data.kind === "certificate" ? "Emitido em" : "Presença"}
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {data.kind === "certificate" ? formatDate(data.certificate?.issuedAt) : formatDate(data.attendance?.lastCheckInAt)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <BadgeCheck className="h-5 w-5 text-primary" />
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Estado</p>
                      <p className="mt-1 text-sm font-semibold">{data.status}</p>
                    </div>
                  </div>

                  {data.certificate ? (
                    <div className="rounded-2xl border border-border/70 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Código</p>
                      <p className="mt-2 break-words font-mono text-sm font-semibold">{data.certificate.code}</p>
                    </div>
                  ) : null}
                </div>

                <aside className="rounded-2xl border border-border/70 bg-muted/20 p-5 text-center">
                  <QrCode className="mx-auto h-5 w-5 text-primary" />
                  <img src={data.qrImageUrl} alt="QR de validação" className="mx-auto mt-4 h-40 w-40 rounded-xl border border-border bg-white p-2" />
                  <p className="mt-4 break-words text-xs leading-5 text-muted-foreground">{data.validationUrl}</p>
                </aside>
              </div>
            )}
          </div>
        </section>

        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/">Voltar ao portal</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

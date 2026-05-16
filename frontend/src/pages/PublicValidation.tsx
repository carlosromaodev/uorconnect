import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, BadgeCheck, CalendarDays, CheckCircle2, FileCheck2, Loader2, QrCode, ScanLine, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, getToken, type PublicValidationPayload, type QrScanResult } from "@/lib/api";

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
  const [qrActionScan, setQrActionScan] = useState<QrScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setData(null);
    setQrActionScan(null);

    if (token.startsWith("qra_")) {
      if (!getToken()) {
        setError("Inicia sessão para validar este QR e associar a ação ao teu número de estudante.");
        setLoading(false);
        return () => {
          active = false;
        };
      }

      api.attendance.scan({ token })
        .then((payload) => {
          if (!active) return;
          setQrActionScan(payload);
        })
        .catch((err) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : "Não foi possível processar este QR.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }

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
    : data?.kind === "team_credential"
      ? data.valid
        ? "Credencial válida"
        : data.status === "INVITED"
          ? "Credencial ainda não emitida"
          : data.status === "EXPIRED"
            ? "Credencial expirada"
            : data.status === "DISABLED"
              ? "Credencial desativada"
              : "Credencial revogada"
      : data?.valid
        ? data.attendance?.checkedIn ? "Presença confirmada" : "Credencial válida"
              : data?.status === "EXPIRED"
                ? "Credencial expirada"
                : "Credencial inválida";
  const qrActionTargetPath =
    qrActionScan?.requiresAnswer && qrActionScan.challenge
      ? `/minha-area?tab=desafio&scan=${encodeURIComponent(token)}`
      : "/minha-area?tab=desafio";
  const qrActionButtonLabel =
    qrActionScan?.requiresAnswer && qrActionScan.challenge
      ? "Responder desafio"
      : "Abrir Minha Área";

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
              <img src="/uorconnect-logo-navbar.png" alt="UOR Connect" className="h-12 w-auto object-contain" />
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {loading ? (
              <div className="flex min-h-[260px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : qrActionScan ? (
              <div className={`rounded-2xl border p-5 ${
                qrActionScan.success
                  ? "border-emerald-200 bg-emerald-50"
                  : qrActionScan.result === "ALREADY_DONE"
                    ? "border-amber-200 bg-amber-50"
                    : "border-rose-200 bg-rose-50"
              }`}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                      qrActionScan.success ? "bg-emerald-500/10 text-emerald-700" : "bg-rose-500/10 text-rose-700"
                    }`}>
                      {qrActionScan.success ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-950">
                        {qrActionScan.result === "CHALLENGE_READY" ? "Desafio liberado" : qrActionScan.success ? "QR validado" : "QR não validado"}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{qrActionScan.message}</p>
                      {qrActionScan.pointsAwarded ? (
                        <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                          +{qrActionScan.pointsAwarded} pontos
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button asChild className="rounded-xl">
                    <Link to={qrActionTargetPath}>
                      <ScanLine className="mr-2 h-4 w-4" />
                      {qrActionButtonLabel}
                    </Link>
                  </Button>
                </div>
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
                    {token.startsWith("qra_") ? (
                      <Button asChild className="mt-4 rounded-xl">
                        <Link to={`/login?redirect=${encodeURIComponent(`/validar/${token}`)}`}>Entrar e validar QR</Link>
                      </Button>
                    ) : null}
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
                      {data.kind === "certificate" ? "Certificado" : data.kind === "team_credential" ? "Passe de equipa" : "Credencial"}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      {data.title}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold leading-tight text-foreground">
                      {data.certificate?.recipientName ?? data.attendance?.studentName ?? data.teamCredential?.holderName ?? "Titular protegido"}
                    </h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <UserRound className="h-5 w-5 text-primary" />
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {data.kind === "team_credential" ? "Versão" : "Número"}
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {data.kind === "team_credential"
                          ? `v${data.teamCredential?.version ?? 1}`
                          : data.certificate?.recipientNumber ?? data.attendance?.studentNumber ?? "Dado protegido"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <FileCheck2 className="h-5 w-5 text-primary" />
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {data.kind === "team_credential" ? "Área" : "Curso"}
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {data.kind === "team_credential"
                          ? `${data.teamCredential?.team ?? "Equipa"} · ${data.teamCredential?.role ?? "Membro"}`
                          : data.certificate?.recipientCourse ?? data.attendance?.studentCourse ?? "Dado protegido"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {data.kind === "certificate" || data.kind === "team_credential" ? "Emitido em" : "Presença"}
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {data.kind === "certificate"
                          ? formatDate(data.certificate?.issuedAt)
                          : data.kind === "team_credential"
                            ? formatDate(data.teamCredential?.issuedAt)
                            : formatDate(data.attendance?.lastCheckInAt)}
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
                  {data.teamCredential?.revokedReason ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em]">Motivo</p>
                      <p className="mt-2 text-sm font-semibold">{data.teamCredential.revokedReason}</p>
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

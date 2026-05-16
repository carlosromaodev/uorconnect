import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  api,
  type TrainerCourseOption,
  type TrainerRegistrationRequest,
} from "@/lib/api";

const TRAINER_REGISTRATION_PATH = "/formadores/cadastro";

const statusMeta = {
  PENDING: {
    label: "Pendente",
    icon: Clock3,
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  APPROVED: {
    label: "Aprovado",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  REJECTED: {
    label: "Recusado",
    icon: XCircle,
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
} as const;

function getStatusMeta(status: string) {
  if (status === "APPROVED") return statusMeta.APPROVED;
  if (status === "REJECTED") return statusMeta.REJECTED;
  return statusMeta.PENDING;
}

function getTrainerRegistrationUrl() {
  if (typeof window === "undefined") return TRAINER_REGISTRATION_PATH;
  return new URL(TRAINER_REGISTRATION_PATH, window.location.origin).toString();
}

export default function AdminTrainersTab() {
  const [requests, setRequests] = useState<TrainerRegistrationRequest[]>([]);
  const [courses, setCourses] = useState<TrainerCourseOption[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [requestPayload, contextPayload] = await Promise.all([
        api.trainers.adminRequests(),
        api.trainers.context(),
      ]);
      setRequests(requestPayload.requests);
      setCourses(contextPayload.courses);
      setSelectedCourses(
        Object.fromEntries(
          requestPayload.requests.map((request) => [
            request.id,
            String(request.selectedCourseId),
          ]),
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar formadores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return requests;
    return requests.filter((request) => {
      const haystack = [
        request.name,
        request.phone,
        request.specialty,
        request.selectedCourse.name,
        request.organization ?? "",
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [requests, search]);

  const totals = useMemo(() => ({
    pending: requests.filter((request) => request.status === "PENDING").length,
    approved: requests.filter((request) => request.status === "APPROVED").length,
    rejected: requests.filter((request) => request.status === "REJECTED").length,
  }), [requests]);

  const handleCopyRegistrationLink = async () => {
    const url = getTrainerRegistrationUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link de cadastro do formador copiado.");
    } catch {
      toast.info(url);
    }
  };

  const approve = async (request: TrainerRegistrationRequest) => {
    const selectedCourseId = Number(selectedCourses[request.id] || request.selectedCourseId);
    if (!selectedCourseId) {
      toast.error("Escolhe um curso antes de aprovar.");
      return;
    }
    const key = `approve-${request.id}`;
    setBusyKey(key);
    try {
      const payload = await api.trainers.approve(request.id, selectedCourseId, notes[request.id] || null);
      setRequests((current) => current.map((item) => item.id === request.id ? payload.request : item));
      toast.success("Formador aprovado com acesso limitado ao curso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao aprovar formador.");
    } finally {
      setBusyKey(null);
    }
  };

  const reject = async (request: TrainerRegistrationRequest) => {
    const note = notes[request.id]?.trim();
    if (!note) {
      toast.error("Escreve um motivo curto antes de recusar.");
      return;
    }
    const key = `reject-${request.id}`;
    setBusyKey(key);
    try {
      const payload = await api.trainers.reject(request.id, note);
      setRequests((current) => current.map((item) => item.id === request.id ? payload.request : item));
      toast.success("Pedido recusado com motivo registado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao recusar formador.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-amber-200/70 bg-amber-50/70">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Pendentes</p>
            <p className="mt-2 text-3xl font-black text-amber-900">{totals.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/70 bg-emerald-50/70">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Aprovados</p>
            <p className="mt-2 text-3xl font-black text-emerald-900">{totals.approved}</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200/70 bg-rose-50/70">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-700">Recusados</p>
            <p className="mt-2 text-3xl font-black text-rose-900">{totals.rejected}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRoundCheck className="h-5 w-5 text-emerald-600" />
              Pedidos de formadores
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Aprova apenas depois de confirmar perfil, telefone e curso.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCopyRegistrationLink()}
            >
              <Copy className="h-4 w-4" />
              Adicionar formador via link
            </Button>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar formador ou curso"
              className="sm:w-72"
            />
            <Button type="button" variant="outline" onClick={() => void load()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                A carregar pedidos...
              </div>
            </div>
          ) : null}

          {!loading && filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <MessageSquareWarning className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-semibold">Nenhum pedido encontrado.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Partilha o link público `{TRAINER_REGISTRATION_PATH}` com os formadores.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4">
            {filteredRequests.map((request) => {
              const meta = getStatusMeta(request.status);
              const Icon = meta.icon;
              const isApproving = busyKey === `approve-${request.id}`;
              const isRejecting = busyKey === `reject-${request.id}`;

              return (
                <div key={request.id} className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-foreground">{request.name}</h3>
                        <Badge variant="outline" className={meta.className}>
                          <Icon className="mr-1 h-3.5 w-3.5" />
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">{request.specialty}</p>
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{request.bio}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{request.phone}</span>
                        {request.email ? <span>{request.email}</span> : null}
                        {request.organization ? <span>{request.organization}</span> : null}
                        {request.linkedinUrl ? (
                          <a className="inline-flex items-center gap-1 font-semibold text-emerald-700" href={request.linkedinUrl} target="_blank" rel="noreferrer">
                            LinkedIn
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="w-full space-y-3 lg:w-80">
                      <select
                        value={selectedCourses[request.id] ?? String(request.selectedCourseId)}
                        onChange={(event) => setSelectedCourses((current) => ({ ...current, [request.id]: event.target.value }))}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold"
                      >
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>{course.name}</option>
                        ))}
                      </select>
                      <Textarea
                        value={notes[request.id] ?? ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                        placeholder="Nota de validação ou motivo de recusa"
                        className="min-h-20"
                      />
                      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                        <Button
                          type="button"
                          className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                          disabled={isApproving || isRejecting}
                          onClick={() => void approve(request)}
                        >
                          {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Aprovar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                          disabled={isApproving || isRejecting}
                          onClick={() => void reject(request)}
                        >
                          {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                          Recusar
                        </Button>
                      </div>
                    </div>
                  </div>
                  {request.reviewNote ? (
                    <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                      Última nota: {request.reviewNote}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

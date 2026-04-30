import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Filter,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  api,
  type Course,
  type SmsCampaignFailuresPayload,
  type SmsAudienceInput,
  type SmsAudienceType,
  type SmsCampaignSummary,
  type SmsFilterOptionsPayload,
  type SmsOverviewPayload,
  type SmsRecipientPreviewPayload,
  type SmsSendResult,
} from "@/lib/api";

type Props = {
  courses: Course[];
};

const defaultAudienceButtons: SmsFilterOptionsPayload["audienceButtons"] = [
  { type: "ALL_STUDENTS", label: "Todos os estudantes", total: 0, sendable: 0 },
  { type: "STUDENT_CLASS", label: "Turmas dos estudantes", total: 0, sendable: 0 },
  { type: "STUDENT_COURSE", label: "Cursos dos estudantes", total: 0, sendable: 0 },
  { type: "STUDENT_CLASS_OR_COURSE", label: "Turmas + cursos dos estudantes", total: 0, sendable: 0 },
  { type: "COURSE_ENROLLED", label: "Inscritos em cursos", total: 0, sendable: 0 },
  { type: "EXHIBITORS", label: "Expositores", total: 0, sendable: 0 },
  { type: "COURSE_OR_EXHIBITORS", label: "Cursos + expositores", total: 0, sendable: 0 },
  { type: "WINNERS", label: "Vencedores", total: 0, sendable: 0 },
  { type: "SELECTED_STUDENTS", label: "Selecionados manualmente", total: 0, sendable: 0 },
];

const audienceHelpers: Record<SmsAudienceType, string> = {
  ALL_STUDENTS: "Envio para toda a base de estudantes com número válido.",
  STUDENT_CLASS: "Envio por turma académica usando o campo classCode.",
  STUDENT_COURSE: "Envio por curso académico dos estudantes.",
  STUDENT_CLASS_OR_COURSE: "Combina turma e curso, removendo duplicados automaticamente.",
  COURSE_ENROLLED: "Somente estudantes com inscrição em cursos.",
  SUBMISSION_ENROLLED: "Somente estudantes com candidatura submetida.",
  COURSE_OR_SUBMISSION_ENROLLED: "União entre inscritos e candidatos.",
  EXHIBITORS: "Somente estudantes ligados a submissões.",
  COURSE_OR_EXHIBITORS: "Inscritos em cursos e expositores.",
  WINNERS: "Somente candidaturas vencedoras.",
  SELECTED_STUDENTS: "Seleção manual por número de estudante ou telefone.",
};

function parseDelimitedList(input: string) {
  return Array.from(new Set(input.split(/[\n,; ]+/).map((item) => item.trim()).filter(Boolean)));
}

function isCourseAudience(type: SmsAudienceType) {
  return type === "COURSE_ENROLLED" || type === "COURSE_OR_EXHIBITORS";
}

function isStudentClassAudience(type: SmsAudienceType) {
  return type === "STUDENT_CLASS" || type === "STUDENT_CLASS_OR_COURSE";
}

function isStudentCourseAudience(type: SmsAudienceType) {
  return type === "STUDENT_COURSE" || type === "STUDENT_CLASS_OR_COURSE";
}

function isSubmissionAudience(type: SmsAudienceType) {
  return type === "EXHIBITORS" || type === "COURSE_OR_EXHIBITORS";
}

function personalizeForPreview(message: string) {
  return message
    .replace(/{{\s*nome\s*}}/gi, "Carlos Romão")
    .replace(/{{\s*numero\s*}}/gi, "20242099")
    .replace(/{{\s*curso\s*}}/gi, "Engenharia Informática")
    .replace(/{{\s*turma\s*}}/gi, "TINFM")
    .replace(/{{\s*colega\s*}}/gi, "Ana Mateus");
}

function formatDateLabel(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-PT");
}

function statusTone(status: string) {
  const normalized = status.toUpperCase();
  if (["SENT", "SCHEDULED"].includes(normalized)) return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  if (["PARTIAL", "PROCESSING"].includes(normalized)) return "border-amber-500/25 bg-amber-500/10 text-amber-700";
  if (["FAILED", "ERROR"].includes(normalized)) return "border-rose-500/25 bg-rose-500/10 text-rose-700";
  return "border-border bg-muted/30 text-muted-foreground";
}

function formatCreditsLabel(credits?: number | null) {
  return typeof credits === "number"
    ? new Intl.NumberFormat("pt-PT").format(credits)
    : "...";
}

export function AdminSmsTab({ courses }: Props) {
  const campaignPageSize = 20;

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<SmsOverviewPayload | null>(null);
  const [filterOptions, setFilterOptions] = useState<SmsFilterOptionsPayload | null>(null);
  const [campaigns, setCampaigns] = useState<SmsCampaignSummary[]>([]);
  const [campaignPage, setCampaignPage] = useState(0);
  const [campaignTotal, setCampaignTotal] = useState(0);

  const [title, setTitle] = useState("");
  const [sender, setSender] = useState("UOR CONNECT");
  const [message, setMessage] = useState("Olá {{nome}}, temos uma atualização importante para ti.");
  const [schedule, setSchedule] = useState("");
  const [audienceType, setAudienceType] = useState<SmsAudienceType>("ALL_STUDENTS");
  const [selectedStudentClassCodes, setSelectedStudentClassCodes] = useState<string[]>([]);
  const [selectedStudentCourses, setSelectedStudentCourses] = useState<string[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<Array<"PENDING" | "APPROVED" | "REJECTED">>(["APPROVED"]);
  const [selectedStudentNumbersText, setSelectedStudentNumbersText] = useState("");
  const [selectedPhonesText, setSelectedPhonesText] = useState("");
  const [cookieMarketingOptIn, setCookieMarketingOptIn] = useState(false);
  const [requireRecentActivity, setRequireRecentActivity] = useState(false);
  const [activeWithinDays, setActiveWithinDays] = useState(30);

  const [previewSearch, setPreviewSearch] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<SmsRecipientPreviewPayload | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SmsSendResult | null>(null);

  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<string | null>(null);
  const [loadingCampaignFailures, setLoadingCampaignFailures] = useState<number | null>(null);
  const [expandedCampaignId, setExpandedCampaignId] = useState<number | null>(null);
  const [campaignFailuresCache, setCampaignFailuresCache] = useState<Record<number, SmsCampaignFailuresPayload>>({});

  const audienceButtons = filterOptions?.audienceButtons ?? defaultAudienceButtons;
  const studentClassButtons = filterOptions?.studentClassButtons ?? [];
  const studentCourseButtons = filterOptions?.studentCourseButtons ?? [];
  const previewMessage = useMemo(() => personalizeForPreview(message), [message]);
  const totalCampaignPages = Math.max(1, Math.ceil(campaignTotal / campaignPageSize));
  const visibleCampaignStart = campaignTotal === 0 ? 0 : campaignPage * campaignPageSize + 1;
  const visibleCampaignEnd = campaignTotal === 0 ? 0 : Math.min(campaignTotal, campaignPage * campaignPageSize + campaigns.length);

  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (campaignSearch.trim()) {
      const query = campaignSearch.trim().toLowerCase();
      result = result.filter((c) =>
        (c.title ?? "").toLowerCase().includes(query) ||
        c.sender.toLowerCase().includes(query) ||
        c.audienceType.toLowerCase().includes(query),
      );
    }
    if (campaignStatusFilter) {
      result = result.filter((c) => c.status.toUpperCase() === campaignStatusFilter);
    }
    return result;
  }, [campaigns, campaignSearch, campaignStatusFilter]);

  const campaignStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    campaigns.forEach((c) => {
      const key = c.status.toUpperCase();
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [campaigns]);

  const buildAudiencePayload = (): SmsAudienceInput => {
    const payload: SmsAudienceInput = { type: audienceType };

    if (isStudentClassAudience(audienceType)) payload.studentClassCodes = selectedStudentClassCodes;
    if (isStudentCourseAudience(audienceType)) payload.studentCourses = selectedStudentCourses;
    if (isCourseAudience(audienceType)) payload.courseIds = selectedCourseIds;
    if (isSubmissionAudience(audienceType)) payload.submissionStatuses = selectedStatuses;
    if (audienceType === "SELECTED_STUDENTS") {
      payload.selectedStudentNumbers = parseDelimitedList(selectedStudentNumbersText);
      payload.selectedPhones = parseDelimitedList(selectedPhonesText);
    }
    if (cookieMarketingOptIn) payload.cookieMarketingOptIn = true;
    if (requireRecentActivity && activeWithinDays > 0) payload.activeWithinDays = activeWithinDays;

    return payload;
  };

  const fetchOverview = useCallback(async () => {
    const payload = await api.sms.overview();
    setOverview(payload);
    setSender((current) => current || payload.integration.defaultSender || payload.integration.approvedSenders[0] || "UOR CONNECT");
  }, []);

  const fetchFilterOptions = useCallback(async () => {
    setFilterOptions(await api.sms.filters());
  }, []);

  const fetchCampaignPage = useCallback(async (page: number) => {
    const payload = await api.sms.campaigns(page, campaignPageSize);
    setCampaignPage(payload.page);
    setCampaigns(payload.campaigns);
    setCampaignTotal(payload.total);
  }, [campaignPageSize]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchOverview(), fetchFilterOptions(), fetchCampaignPage(0)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar a central SMS.");
    } finally {
      setLoading(false);
    }
  }, [fetchCampaignPage, fetchFilterOptions, fetchOverview]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const handlePreview = async () => {
    const audience = buildAudiencePayload();
    if (isStudentClassAudience(audience.type) && !(audience.studentClassCodes?.length)) {
      toast.error("Seleciona pelo menos uma turma.");
      return;
    }
    if (isStudentCourseAudience(audience.type) && !(audience.studentCourses?.length)) {
      toast.error("Seleciona pelo menos um curso académico.");
      return;
    }

    setPreviewLoading(true);
    setPreviewPayload(null);
    try {
      const payload = await api.sms.previewRecipients({
        audience,
        search: previewSearch || undefined,
        limit: 200,
      });
      setPreviewPayload(payload);
      toast.success("Pré-visualização atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao validar os contactos.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Escreve a mensagem antes de enviar.");
      return;
    }

    if (!sender.trim()) {
      toast.error("Define o remetente SMS.");
      return;
    }

    if (!window.confirm("Confirmas o envio SMS para a audiência selecionada?")) return;

    setSending(true);
    setSendResult(null);
    try {
      const payload = await api.sms.sendCampaign({
        title: title.trim() || undefined,
        sender: sender.trim(),
        message,
        schedule: schedule.trim() || undefined,
        audience: buildAudiencePayload(),
      });

      setSendResult(payload);
      await Promise.all([fetchOverview(), fetchCampaignPage(0)]);

      if (payload.failedCount === 0) {
        toast.success(`Envio SMS concluído com ${payload.successCount} mensagem(ns).`);
      } else if (payload.successCount === 0) {
        toast.error(payload.failures[0]?.reason
          ? `Nenhum SMS foi enviado. ${payload.failures[0].reason}`
          : "Nenhum SMS foi enviado.");
      } else {
        toast.warning(`Envio parcial: ${payload.successCount} enviado(s), ${payload.failedCount} falhado(s).`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar a campanha SMS.");
    } finally {
      setSending(false);
    }
  };

  const handleRetryFailed = () => {
    if (!sendResult?.failures.length) return;
    const failedPhones = sendResult.failures.map((f) => f.phone).filter(Boolean);
    if (!failedPhones.length) {
      toast.error("Não foi possível extrair os telefones falhados.");
      return;
    }
    setAudienceType("SELECTED_STUDENTS");
    setSelectedPhonesText(failedPhones.join("\n"));
    setSelectedStudentNumbersText("");
    setSendResult(null);
    setPreviewPayload(null);
    toast.success(`${failedPhones.length} telefone(s) falhado(s) copiados para reenvio.`);
  };

  const handleToggleCampaignFailures = async (campaignId: number) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null);
      return;
    }
    setExpandedCampaignId(campaignId);
    if (campaignFailuresCache[campaignId]) return;
    setLoadingCampaignFailures(campaignId);
    try {
      const payload = await api.sms.campaignFailures(campaignId);
      setCampaignFailuresCache((prev) => ({ ...prev, [campaignId]: payload }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar os destinatários falhados.");
      setExpandedCampaignId(null);
    } finally {
      setLoadingCampaignFailures(null);
    }
  };

  const handleRetryCampaignFailed = (campaignId: number) => {
    const cached = campaignFailuresCache[campaignId];
    if (!cached?.failures.length) return;
    const failedPhones = cached.failures.map((f) => f.phone).filter(Boolean);
    if (!failedPhones.length) {
      toast.error("Não foi possível extrair os telefones falhados.");
      return;
    }
    setMessage(cached.message);
    setSender(cached.sender);
    setTitle(cached.title ? `Reenvio: ${cached.title}` : "Reenvio de falhados");
    setAudienceType("SELECTED_STUDENTS");
    setSelectedPhonesText(failedPhones.join("\n"));
    setSelectedStudentNumbersText("");
    setPreviewPayload(null);
    setExpandedCampaignId(null);
    toast.success(`${failedPhones.length} telefone(s) preparados para reenvio com a mesma mensagem.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#0A3D62]/15 bg-[linear-gradient(135deg,rgba(10,61,98,0.08),rgba(255,255,255,0.98))] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0A3D62]/20 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase text-[#0A3D62]">
              <Smartphone className="h-3.5 w-3.5" />
              SMS operacional
            </div>
            <h2 className="mt-3 text-xl font-bold text-[#0A3D62] sm:text-2xl">Envio simples e focado</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              A área de SMS ficou reduzida ao essencial: remetente, audiência, agendamento, pré-visualização e histórico.
            </p>
          </div>

          <Button variant="outline" className="rounded-xl" onClick={() => void loadInitialData()} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-[#0A3D62]/10 p-2 text-[#0A3D62]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Provedor</p>
              <p className="text-sm font-semibold">{overview?.integration.configured ? "Configurado" : "Pendente"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-sky-500/10 p-2 text-sky-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Contactos válidos</p>
              <p className="text-sm font-semibold">{overview?.audiences.allStudents.sendable ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-700">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Remetentes</p>
              <p className="text-sm font-semibold">{overview?.integration.approvedSenders.length ?? 0} aprovados</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-700">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Créditos</p>
              <p className="text-sm font-semibold">{formatCreditsLabel(overview?.integration.credits)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-[#0A3D62]" />
              Campanha manual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">Base do provedor:</span> {overview?.integration.baseUrl ?? "—"}</p>
              {overview?.integration.providerMessage ? (
                <p className="mt-2 text-amber-700">{overview.integration.providerMessage}</p>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Título interno</span>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Lembrete final" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Remetente</span>
                <Input value={sender} onChange={(event) => setSender(event.target.value)} placeholder="UOR CONNECT" />
              </label>
            </div>

            {overview?.integration.approvedSenders.length ? (
              <div className="flex flex-wrap gap-2">
                {overview.integration.approvedSenders.map((item) => (
                  <Button key={item} type="button" variant={sender === item ? "default" : "outline"} size="sm" onClick={() => setSender(item)}>
                    {item}
                  </Button>
                ))}
              </div>
            ) : null}

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Agendamento</span>
              <Input value={schedule} onChange={(event) => setSchedule(event.target.value)} placeholder="YYYYMMDDHHmmss ou data/hora válida" />
            </label>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Audiência</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {audienceButtons.map((button) => (
                  <Button
                    key={button.type}
                    type="button"
                    variant={audienceType === button.type ? "default" : "outline"}
                    className="h-auto min-h-[56px] justify-between gap-2 whitespace-normal rounded-xl px-3 py-2 text-left"
                    onClick={() => setAudienceType(button.type)}
                  >
                    <span className="flex min-w-0 flex-1 flex-col items-start">
                      <span className="text-sm leading-5">{button.label}</span>
                      <span className="text-[11px] leading-5 opacity-80">{button.sendable} válidos</span>
                    </span>
                    <Badge variant="secondary" className="shrink-0">{button.total}</Badge>
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{audienceHelpers[audienceType]}</p>

              {isStudentClassAudience(audienceType) ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {studentClassButtons.map((button) => (
                    <Button
                      key={button.classCode}
                      type="button"
                      variant={selectedStudentClassCodes.includes(button.classCode) ? "default" : "outline"}
                      className="h-auto min-h-[48px] justify-between gap-2 whitespace-normal rounded-lg px-3 py-2 text-left"
                      onClick={() => setSelectedStudentClassCodes((current) => current.includes(button.classCode)
                        ? current.filter((classCode) => classCode !== button.classCode)
                        : [...current, button.classCode])}
                    >
                      <span className="min-w-0 flex-1 break-words">{button.classCode}</span>
                      <span className="text-xs opacity-80">{button.sendable}</span>
                    </Button>
                  ))}
                </div>
              ) : null}

              {isStudentCourseAudience(audienceType) ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {studentCourseButtons.map((button) => (
                    <Button
                      key={button.course}
                      type="button"
                      variant={selectedStudentCourses.includes(button.course) ? "default" : "outline"}
                      className="h-auto min-h-[48px] justify-between gap-2 whitespace-normal rounded-lg px-3 py-2 text-left"
                      onClick={() => setSelectedStudentCourses((current) => current.includes(button.course)
                        ? current.filter((course) => course !== button.course)
                        : [...current, button.course])}
                    >
                      <span className="min-w-0 flex-1 break-words">{button.course}</span>
                      <span className="text-xs opacity-80">{button.sendable}</span>
                    </Button>
                  ))}
                </div>
              ) : null}

              {isCourseAudience(audienceType) ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {courses.map((course) => (
                    <label key={course.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.includes(course.id)}
                        onChange={(event) => setSelectedCourseIds((current) => event.target.checked
                          ? [...current, course.id]
                          : current.filter((id) => id !== course.id))}
                      />
                      <span className="min-w-0 truncate">{course.name}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              {isSubmissionAudience(audienceType) ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={selectedStatuses.includes(status) ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedStatuses((current) => current.includes(status)
                        ? current.filter((item) => item !== status)
                        : [...current, status])}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              ) : null}

              {audienceType === "SELECTED_STUDENTS" ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Números de estudante</span>
                    <Textarea
                      value={selectedStudentNumbersText}
                      onChange={(event) => setSelectedStudentNumbersText(event.target.value)}
                      rows={4}
                      placeholder="20242099, 20242100"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Telefones</span>
                    <Textarea
                      value={selectedPhonesText}
                      onChange={(event) => setSelectedPhonesText(event.target.value)}
                      rows={4}
                      placeholder="951203163"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Mensagem</span>
                <span className={`text-xs tabular-nums ${message.length > 160 ? "font-semibold text-amber-600" : "text-muted-foreground"}`}>
                  {message.length} / {Math.ceil(message.length / 160)} SMS
                </span>
              </div>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={7}
                className="resize-none rounded-xl border-[#0A3D62]/15 bg-white text-[14px] leading-relaxed shadow-sm transition-colors focus:border-[#0A3D62]/40 focus:ring-[#0A3D62]/20"
                placeholder="Escreve aqui a mensagem SMS..."
              />
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Inserir placeholder</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { token: "{{nome}}", label: "Nome" },
                  { token: "{{numero}}", label: "Número" },
                  { token: "{{curso}}", label: "Curso" },
                  { token: "{{turma}}", label: "Turma" },
                ].map((item) => (
                  <button
                    key={item.token}
                    type="button"
                    onClick={() => setMessage((current) => {
                      if (!current.trim()) return item.token;
                      if (current.endsWith(" ") || current.endsWith("\n")) return `${current}${item.token}`;
                      return `${current} ${item.token}`;
                    })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#0A3D62]/20 bg-[#0A3D62]/[0.06] px-3 py-1.5 text-xs font-medium text-[#0A3D62] transition-all hover:border-[#0A3D62]/40 hover:bg-[#0A3D62]/[0.12] hover:shadow-sm active:scale-[0.97]"
                  >
                    <span className="font-mono text-[10px] opacity-70">{item.token}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-[52px] items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm">
                <Switch checked={cookieMarketingOptIn} onCheckedChange={setCookieMarketingOptIn} />
                <span className="leading-5">Exigir consentimento de marketing</span>
              </label>
              <label className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm">
                <Switch checked={requireRecentActivity} onCheckedChange={setRequireRecentActivity} />
                <span>Ativos nos últimos</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={activeWithinDays}
                  disabled={!requireRecentActivity}
                  onChange={(event) => setActiveWithinDays(Number(event.target.value) || 30)}
                  className="h-8 w-20"
                />
                <span>dias</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-[#0A3D62]" />
              Pré-visualização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Pesquisar na audiência</span>
              <Input value={previewSearch} onChange={(event) => setPreviewSearch(event.target.value)} placeholder="Nome, número ou curso" />
            </label>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Prévia da mensagem</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{previewMessage}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void handlePreview()} disabled={previewLoading}>
                {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                Validar audiência
              </Button>
              <Button onClick={() => void handleSend()} disabled={sending}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar
              </Button>
            </div>

            {previewPayload ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs uppercase text-muted-foreground">Filtrados</p>
                    <p className="mt-1 text-lg font-semibold">{previewPayload.filteredCandidates}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs uppercase text-muted-foreground">Válidos</p>
                    <p className="mt-1 text-lg font-semibold">{previewPayload.totalRecipients}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs uppercase text-muted-foreground">Ignorados</p>
                    <p className="mt-1 text-lg font-semibold">{previewPayload.skippedCount}</p>
                  </div>
                </div>

                <div className="max-h-[260px] space-y-2 overflow-y-auto rounded-xl border border-border/60 p-3">
                  {previewPayload.recipients.slice(0, 12).map((recipient) => (
                    <div key={`${recipient.providerTo}-${recipient.studentNumber ?? "manual"}`} className="rounded-lg border border-border/50 px-3 py-2">
                      <p className="text-sm font-medium">{recipient.name || recipient.studentNumber || recipient.providerTo}</p>
                      <p className="text-xs text-muted-foreground">{recipient.phone} · {recipient.course || "Sem curso"}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                Faz uma validação para conferir os contactos antes de enviar.
              </div>
            )}

            {sendResult ? (
              <div className={`rounded-xl border p-4 ${sendResult.failedCount > 0 ? "border-amber-500/25 bg-amber-500/[0.04]" : "border-emerald-500/25 bg-emerald-500/[0.04]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {sendResult.failedCount > 0 ? (
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold">Último envio</p>
                      <p className="text-xs text-muted-foreground">{sendResult.sender}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={statusTone(sendResult.status)}>{sendResult.status}</Badge>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-emerald-700">{sendResult.successCount}</p>
                    <p className="text-[10px] uppercase text-emerald-600/80">Enviados</p>
                  </div>
                  <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-rose-700">{sendResult.failedCount}</p>
                    <p className="text-[10px] uppercase text-rose-600/80">Falhados</p>
                  </div>
                  <div className="rounded-lg bg-slate-500/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-slate-700">{sendResult.skippedCount}</p>
                    <p className="text-[10px] uppercase text-slate-600/80">Ignorados</p>
                  </div>
                </div>

                {sendResult.failedCount > 0 && sendResult.failures.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <div className="max-h-[120px] overflow-y-auto rounded-lg border border-rose-500/15 bg-white p-2">
                      {sendResult.failures.slice(0, 10).map((f, idx) => (
                        <p key={`${f.phone}-${idx}`} className="truncate text-xs text-muted-foreground">
                          <span className="font-mono text-rose-600">{f.phone}</span>
                          {f.reason ? <span className="ml-1.5 text-slate-500">— {f.reason}</span> : null}
                        </p>
                      ))}
                      {sendResult.failures.length > 10 ? (
                        <p className="mt-1 text-xs text-muted-foreground">… e mais {sendResult.failures.length - 10} falhado(s)</p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full rounded-xl border-amber-500/30 text-amber-800 hover:bg-amber-500/10"
                      onClick={handleRetryFailed}
                    >
                      <RotateCcw className="mr-2 h-3.5 w-3.5" />
                      Reenviar para {sendResult.failures.length} falhado(s)
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4 text-[#0A3D62]" />
                Campanhas recentes
              </CardTitle>
            </div>
            {campaigns.length > 0 ? (
              <Badge variant="outline" className="w-fit tabular-nums">
                {campaignTotal} campanha{campaignTotal !== 1 ? "s" : ""}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaigns.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={campaignSearch}
                    onChange={(event) => setCampaignSearch(event.target.value)}
                    placeholder="Pesquisar campanhas por título ou remetente..."
                    className="pl-9"
                  />
                  {campaignSearch ? (
                    <button
                      type="button"
                      onClick={() => setCampaignSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setCampaignStatusFilter(null)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    !campaignStatusFilter
                      ? "bg-[#0A3D62] text-white shadow-sm"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Todas
                </button>
                {Object.entries(campaignStatusCounts).map(([status, count]) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setCampaignStatusFilter(campaignStatusFilter === status ? null : status)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      campaignStatusFilter === status
                        ? "bg-[#0A3D62] text-white shadow-sm"
                        : `${statusTone(status)} hover:opacity-80`
                    }`}
                  >
                    {status}
                    <span className={`tabular-nums ${campaignStatusFilter === status ? "text-white/80" : "opacity-60"}`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {campaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
              Ainda não há campanhas registadas.
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              <Search className="mx-auto mb-2 h-5 w-5 opacity-40" />
              Nenhuma campanha encontrada com os filtros atuais.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCampaigns.map((campaign) => {
                const hasFailures = campaign.failedCount > 0;
                const successRate = campaign.totalRecipients > 0
                  ? Math.round((campaign.successCount / campaign.totalRecipients) * 100)
                  : 0;
                const isExpanded = expandedCampaignId === campaign.id;
                const cachedFailures = campaignFailuresCache[campaign.id];
                const isLoadingThis = loadingCampaignFailures === campaign.id;

                return (
                  <div key={campaign.id} className={`rounded-xl border bg-white transition-all ${isExpanded ? "border-[#0A3D62]/30 shadow-sm" : "border-border/60 hover:border-border"}`}>
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{campaign.title || "Envio sem título"}</p>
                          <Badge variant="outline" className={statusTone(campaign.status)}>{campaign.status}</Badge>
                          {campaign.scheduleAt ? (
                            <Badge variant="outline" className="border-sky-500/25 bg-sky-500/10 text-sky-700">
                              <Clock3 className="mr-1 h-3 w-3" />
                              Agendada
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatDateLabel(campaign.createdAt)}</span>
                          <span className="hidden sm:inline">·</span>
                          <span>{campaign.sender}</span>
                          {campaign.scheduleAt ? (
                            <>
                              <span className="hidden sm:inline">·</span>
                              <span>Para {formatDateLabel(campaign.scheduleAt)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <div className="text-right">
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold tabular-nums text-foreground">{campaign.successCount}</span>
                            <span className="text-xs text-muted-foreground">/ {campaign.totalRecipients}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full rounded-full transition-all ${hasFailures ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${successRate}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-medium tabular-nums ${hasFailures ? "text-amber-600" : "text-emerald-600"}`}>
                              {successRate}%
                            </span>
                          </div>
                        </div>
                        {hasFailures ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 rounded-lg border-rose-500/25 text-xs text-rose-700 hover:bg-rose-500/10 ${isExpanded ? "bg-rose-500/10" : ""}`}
                            onClick={() => void handleToggleCampaignFailures(campaign.id)}
                            disabled={isLoadingThis}
                          >
                            {isLoadingThis ? (
                              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            ) : (
                              <AlertTriangle className="mr-1.5 h-3 w-3" />
                            )}
                            {campaign.failedCount} falha(s)
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {isExpanded && hasFailures ? (
                      <div className="border-t border-border/60 bg-rose-500/[0.02] px-4 py-3">
                        {isLoadingThis ? (
                          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            A carregar destinatários falhados...
                          </div>
                        ) : cachedFailures ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase text-rose-700">
                                {cachedFailures.failures.length} destinatário(s) falhado(s)
                              </p>
                              <Button
                                size="sm"
                                className="h-8 rounded-lg bg-amber-600 text-xs text-white hover:bg-amber-700"
                                onClick={() => handleRetryCampaignFailed(campaign.id)}
                              >
                                <RotateCcw className="mr-1.5 h-3 w-3" />
                                Reenviar falhados
                              </Button>
                            </div>
                            <div className="max-h-[180px] space-y-1 overflow-y-auto rounded-lg border border-rose-500/15 bg-white p-2">
                              {cachedFailures.failures.map((f, idx) => (
                                <div key={`${f.phone}-${idx}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs odd:bg-rose-500/[0.03]">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono font-medium text-rose-700">{f.phone}</span>
                                    {f.studentNumber ? <span className="text-muted-foreground">({f.studentNumber})</span> : null}
                                  </div>
                                  {f.errorMessage ? (
                                    <span className="shrink-0 truncate text-muted-foreground max-w-[200px]" title={f.errorMessage}>{f.errorMessage}</span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {campaignTotal > 0 ? (
            <div className="flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                A mostrar {visibleCampaignStart}–{visibleCampaignEnd} de {campaignTotal}
              </p>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className="text-xs text-muted-foreground">Página {campaignPage + 1} de {totalCampaignPages}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={campaignPage <= 0} onClick={() => void fetchCampaignPage(Math.max(0, campaignPage - 1))}>
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={campaignPage + 1 >= totalCampaignPages}
                    onClick={() => void fetchCampaignPage(Math.min(totalCampaignPages - 1, campaignPage + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

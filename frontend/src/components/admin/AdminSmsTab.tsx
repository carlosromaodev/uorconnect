import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Clock3,
  Loader2,
  RefreshCcw,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  type Course,
  type SmsFilterOptionsPayload,
  type SmsAudienceInput,
  type SmsAudienceType,
  type SmsCampaignSummary,
  type SmsOverviewPayload,
  type SmsRecipientPreviewPayload,
  type SmsSendResult,
} from "@/lib/api";
import { toast } from "@/components/ui/sonner";

type Props = {
  courses: Course[];
};

type SmsTemplate = {
  id: string;
  title: string;
  description: string;
  message: string;
  audienceType?: SmsAudienceType;
};

const audienceHelpers: Record<SmsAudienceType, string> = {
  ALL_STUDENTS: "Envio em massa para toda a base de estudantes.",
  STUDENT_COURSE: "Envio por curso acadêmico dos estudantes cadastrados (com contactos validados).",
  COURSE_ENROLLED: "Somente estudantes com inscrição em cursos.",
  SUBMISSION_ENROLLED: "Somente estudantes com candidatura submetida.",
  COURSE_OR_SUBMISSION_ENROLLED: "União entre inscritos em cursos e candidatos.",
  EXHIBITORS: "Somente estudantes com candidaturas submetidas.",
  COURSE_OR_EXHIBITORS: "União entre inscritos em cursos e expositores.",
  WINNERS: "Somente estudantes vencedores.",
  SELECTED_STUDENTS: "Enviar para números específicos.",
};

const defaultAudienceButtons: SmsFilterOptionsPayload["audienceButtons"] = [
  { type: "ALL_STUDENTS", label: "Todos os estudantes", total: 0, sendable: 0 },
  { type: "STUDENT_COURSE", label: "Cursos dos estudantes", total: 0, sendable: 0 },
  { type: "COURSE_ENROLLED", label: "Inscritos em cursos", total: 0, sendable: 0 },
  { type: "EXHIBITORS", label: "Expositores", total: 0, sendable: 0 },
  { type: "COURSE_OR_EXHIBITORS", label: "Cursos + expositores", total: 0, sendable: 0 },
  { type: "WINNERS", label: "Vencedores", total: 0, sendable: 0 },
  { type: "SELECTED_STUDENTS", label: "Selecionados manualmente", total: 0, sendable: 0 },
];

const smsTemplates: SmsTemplate[] = [
  {
    id: "boas-vindas",
    title: "Boas-vindas",
    description: "Mensagem de entrada para novos inscritos.",
    message: "Olá {{nome}}, bem-vindo(a) à plataforma UOR Connect. A tua participação no curso {{curso}} está confirmada.",
    audienceType: "COURSE_ENROLLED",
  },
  {
    id: "lembrete-evento",
    title: "Lembrete de evento",
    description: "Lembrete para presença em atividade acadêmica.",
    message: "Olá {{nome}}, lembramos que tens atividade importante do UOR Connect em breve. Confirma tua presença e acompanha os detalhes no teu painel.",
    audienceType: "ALL_STUDENTS",
  },
  {
    id: "aviso-expositores",
    title: "Aviso para expositores",
    description: "Comunicado rápido para expositores/candidatos.",
    message: "Olá {{nome}}, atualizamos as orientações para expositores. Consulta o teu painel para os próximos passos da tua candidatura.",
    audienceType: "EXHIBITORS",
  },
  {
    id: "vencedores",
    title: "Comunicado aos vencedores",
    description: "Mensagem personalizada para vencedores.",
    message: "Parabéns {{nome}}! A tua candidatura foi destacada entre os vencedores. Em breve enviaremos as instruções oficiais.",
    audienceType: "WINNERS",
  },
];

function parseDelimitedList(input: string) {
  return Array.from(new Set(input.split(/[\n,; ]+/).map((item) => item.trim()).filter(Boolean)));
}

function formatDateLabel(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-PT");
}

function isCourseAudience(type: SmsAudienceType) {
  return type === "COURSE_ENROLLED" || type === "COURSE_OR_EXHIBITORS";
}

function isSubmissionAudience(type: SmsAudienceType) {
  return type === "EXHIBITORS" || type === "COURSE_OR_EXHIBITORS";
}

function personalizeForPreview(message: string) {
  return message
    .replace(/{{\s*nome\s*}}/gi, "Carlos Romão")
    .replace(/{{\s*numero\s*}}/gi, "20242099")
    .replace(/{{\s*curso\s*}}/gi, "Engenharia Informática");
}

export function AdminSmsTab({ courses }: Props) {
  const campaignPageSize = 20;

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<SmsOverviewPayload | null>(null);
  const [filterOptions, setFilterOptions] = useState<SmsFilterOptionsPayload | null>(null);
  const [campaignPage, setCampaignPage] = useState(0);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [campaigns, setCampaigns] = useState<SmsCampaignSummary[]>([]);

  const [title, setTitle] = useState("");
  const [sender, setSender] = useState("UOR CONNECT");
  const [message, setMessage] = useState("Olá {{nome}}, temos uma atualização importante para ti.");
  const [schedule, setSchedule] = useState("");
  const [audienceType, setAudienceType] = useState<SmsAudienceType>("ALL_STUDENTS");
  const [selectedStudentCourses, setSelectedStudentCourses] = useState<string[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<Array<"PENDING" | "APPROVED" | "REJECTED">>(["APPROVED"]);
  const [selectedStudentNumbersText, setSelectedStudentNumbersText] = useState("");
  const [selectedPhonesText, setSelectedPhonesText] = useState("");
  const [cookieMarketingOptIn, setCookieMarketingOptIn] = useState(false);
  const [cookieAnalyticsOptIn, setCookieAnalyticsOptIn] = useState(false);
  const [activeWithinDays, setActiveWithinDays] = useState(30);

  const [previewSearch, setPreviewSearch] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<SmsRecipientPreviewPayload | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SmsSendResult | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const audienceButtons = filterOptions?.audienceButtons ?? defaultAudienceButtons;
  const studentCourseButtons = filterOptions?.studentCourseButtons ?? [];

  const previewMessage = useMemo(() => personalizeForPreview(message), [message]);
  const totalCampaignPages = Math.max(1, Math.ceil(campaignTotal / campaignPageSize));

  const buildAudiencePayload = (): SmsAudienceInput => {
    const payload: SmsAudienceInput = {
      type: audienceType,
    };

    if (audienceType === "STUDENT_COURSE") {
      payload.studentCourses = selectedStudentCourses;
    }

    if (isCourseAudience(audienceType)) {
      payload.courseIds = selectedCourseIds;
    }

    if (isSubmissionAudience(audienceType)) {
      payload.submissionStatuses = selectedStatuses;
    }

    if (audienceType === "SELECTED_STUDENTS") {
      payload.selectedStudentNumbers = parseDelimitedList(selectedStudentNumbersText);
      payload.selectedPhones = parseDelimitedList(selectedPhonesText);
    }

    if (cookieMarketingOptIn) payload.cookieMarketingOptIn = true;
    if (cookieAnalyticsOptIn) payload.cookieAnalyticsOptIn = true;
    if (activeWithinDays > 0) payload.activeWithinDays = activeWithinDays;

    return payload;
  };

  const fetchOverview = useCallback(async () => {
    const payload = await api.sms.overview();
    setOverview(payload);
    setSender((current) => current || payload.integration.defaultSender || payload.integration.approvedSenders[0] || "UOR CONNECT");
  }, []);

  const fetchFilterOptions = useCallback(async () => {
    const payload = await api.sms.filters();
    setFilterOptions(payload);
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
      await Promise.all([fetchOverview(), fetchCampaignPage(0), fetchFilterOptions()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar a central de SMS.");
    } finally {
      setLoading(false);
    }
  }, [fetchOverview, fetchCampaignPage, fetchFilterOptions]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const previewAudience = useCallback(async (
    audience: SmsAudienceInput,
    searchText?: string,
    silent = false,
  ) => {
    setPreviewLoading(true);
    setPreviewPayload(null);
    try {
      const payload = await api.sms.previewRecipients({
        audience,
        search: searchText || undefined,
        limit: 250,
      });
      setPreviewPayload(payload);
      if (!silent) {
        toast.success("Lista de contactos atualizada.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar pré-visualização.");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (audienceType !== "STUDENT_COURSE") return;
    if (selectedStudentCourses.length === 0) {
      setPreviewPayload(null);
      return;
    }

    const audience: SmsAudienceInput = {
      type: "STUDENT_COURSE",
      studentCourses: selectedStudentCourses,
    };
    if (cookieMarketingOptIn) audience.cookieMarketingOptIn = true;
    if (cookieAnalyticsOptIn) audience.cookieAnalyticsOptIn = true;
    if (activeWithinDays > 0) audience.activeWithinDays = activeWithinDays;

    void previewAudience(
      audience,
      previewSearch,
      true,
    );
  }, [
    audienceType,
    selectedStudentCourses,
    previewSearch,
    previewAudience,
    cookieMarketingOptIn,
    cookieAnalyticsOptIn,
    activeWithinDays,
  ]);

  const handlePreview = async () => {
    const audience = buildAudiencePayload();
    if (audience.type === "STUDENT_COURSE" && !(audience.studentCourses?.length)) {
      toast.error("Seleciona pelo menos um curso para carregar a lista de contactos.");
      return;
    }

    await previewAudience(audience, previewSearch);
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Escreve o texto da mensagem antes de enviar.");
      return;
    }

    if (!sender.trim()) {
      toast.error("Define o remetente SMS antes de enviar.");
      return;
    }

    if (audienceType === "STUDENT_COURSE" && selectedStudentCourses.length === 0) {
      toast.error("Seleciona pelo menos um curso antes do envio em massa.");
      return;
    }

    if (!window.confirm("Confirmas o envio em massa para a audiência selecionada?")) {
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const payload = await api.sms.sendCampaign({
        title: title || undefined,
        sender: sender.trim(),
        message,
        schedule: schedule || undefined,
        audience: buildAudiencePayload(),
      });

      setSendResult(payload);
      toast.success(`Envio concluído com estado: ${payload.status}.`);
      await Promise.all([fetchOverview(), fetchCampaignPage(0), fetchFilterOptions()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar campanha SMS.");
    } finally {
      setSending(false);
    }
  };

  const insertPlaceholder = (token: "{{nome}}" | "{{numero}}" | "{{curso}}") => {
    setMessage((current) => {
      const trimmed = current.trim();
      if (!trimmed) return token;
      return `${trimmed} ${token}`;
    });
  };

  const handleSelectAudience = (type: SmsAudienceType) => {
    setAudienceType(type);
    setPreviewPayload(null);
    if (type !== "STUDENT_COURSE") {
      setSelectedStudentCourses([]);
    }
  };

  const handleToggleStudentCourse = (course: string) => {
    setSelectedStudentCourses((current) => (
      current.includes(course)
        ? current.filter((item) => item !== course)
        : [...current, course]
    ));
  };

  const applyTemplate = (template: SmsTemplate) => {
    setActiveTemplateId(template.id);
    setMessage(template.message);
    setTitle((current) => current || template.title);
    if (template.audienceType) {
      handleSelectAudience(template.audienceType);
    }
    toast.success(`Template "${template.title}" aplicado.`);
  };

  const resetSendOptions = () => {
    setTitle("");
    setSchedule("");
    setAudienceType("ALL_STUDENTS");
    setSelectedStudentCourses([]);
    setSelectedCourseIds([]);
    setSelectedStatuses(["APPROVED"]);
    setSelectedStudentNumbersText("");
    setSelectedPhonesText("");
    setCookieMarketingOptIn(false);
    setCookieAnalyticsOptIn(false);
    setActiveWithinDays(30);
    setPreviewSearch("");
    setPreviewPayload(null);
    setSendResult(null);
    toast.success("Opções de envio repostas.");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="overflow-hidden rounded-[24px] border border-[#0A3D62]/15 bg-[linear-gradient(130deg,rgba(10,61,98,0.10),rgba(0,184,148,0.10),rgba(255,255,255,0.98))] p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0A3D62]/20 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0A3D62]">
              <Smartphone className="h-3.5 w-3.5" />
              Central de Envio SMS
            </div>
            <h2 className="mt-3 text-xl font-bold text-[#0A3D62] sm:text-2xl">Envio em massa por módulos</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Fluxo claro: escolher opções de envio, preparar texto, aplicar template e executar envio em massa.
            </p>
          </div>

          <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={() => void loadInitialData()} disabled={loading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar dados
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-[#0A3D62]/10 p-2 text-[#0A3D62]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Estado provedor</p>
              <p className="text-sm font-semibold">{overview?.integration.configured ? "Configurado" : "Não configurado"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-[#00B894]/10 p-2 text-[#00B894]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Base disponível</p>
              <p className="text-sm font-semibold">{overview?.audiences.allStudents.sendable ?? 0} contactos aptos</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-sky-500/10 p-2 text-sky-600">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Ativos (7 dias)</p>
              <p className="text-sm font-semibold">{overview?.audiences.activeLast7Days.sendable ?? 0} contactos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <Badge className="bg-[#0A3D62] text-white hover:bg-[#0A3D62]">Módulo 1</Badge>
              Opções de envio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Título interno</span>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Convite Feira UOR 2026" />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Remetente</span>
                <Input value={sender} onChange={(event) => setSender(event.target.value.toUpperCase())} placeholder="UOR CONNECT" />
              </label>
            </div>

            <label className="space-y-2 block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Agendamento (opcional)</span>
              <Input
                value={schedule}
                onChange={(event) => setSchedule(event.target.value)}
                placeholder="YYYYMMDDHHmmss ou 2026-05-01T10:30:00"
              />
            </label>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Destino do envio em massa</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {audienceButtons.map((button) => (
                  <Button
                    key={button.type}
                    type="button"
                    variant={audienceType === button.type ? "default" : "outline"}
                    className="h-auto min-h-[56px] justify-between gap-2 whitespace-normal rounded-xl px-3 py-2 text-left"
                    onClick={() => handleSelectAudience(button.type)}
                  >
                    <span className="flex min-w-0 flex-1 flex-col items-start">
                      <span className="text-sm leading-5">{button.label}</span>
                      <span className="text-[11px] leading-5 opacity-80">{button.sendable} contactos válidos</span>
                    </span>
                    <Badge variant="secondary" className="shrink-0">{button.total}</Badge>
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{audienceHelpers[audienceType]}</p>

              {audienceType === "STUDENT_COURSE" && (
                <div className="mt-4 rounded-xl border border-[#0A3D62]/20 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A3D62]">Cursos dos estudantes cadastrados (backend validado)</p>
                  {studentCourseButtons.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">Nenhum curso encontrado com contactos válidos no backend.</p>
                  ) : (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {studentCourseButtons.map((button) => (
                        <Button
                          key={button.course}
                          type="button"
                          variant={selectedStudentCourses.includes(button.course) ? "default" : "outline"}
                          className="h-auto min-h-[52px] justify-between gap-2 whitespace-normal rounded-lg px-3 py-2 text-left"
                          onClick={() => handleToggleStudentCourse(button.course)}
                        >
                          <span className="min-w-0 flex-1 break-words leading-5">{button.course}</span>
                          <span className="shrink-0 text-xs opacity-90">{button.sendable} válidos</span>
                        </Button>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Selecionados: <span className="font-semibold text-foreground">{selectedStudentCourses.length}</span> curso(s)
                  </p>
                </div>
              )}

              {isCourseAudience(audienceType) && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {courses.map((course) => (
                    <label key={course.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedCourseIds.includes(course.id)}
                        onChange={(event) => {
                          setSelectedCourseIds((current) => event.target.checked
                            ? [...current, course.id]
                            : current.filter((id) => id !== course.id));
                        }}
                      />
                      <span className="min-w-0 truncate">{course.name}</span>
                    </label>
                  ))}
                </div>
              )}

              {isSubmissionAudience(audienceType) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["APPROVED", "PENDING", "REJECTED"] as const).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={selectedStatuses.includes(status) ? "default" : "outline"}
                      onClick={() => {
                        setSelectedStatuses((current) => current.includes(status)
                          ? current.filter((item) => item !== status)
                          : [...current, status]);
                      }}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              )}

              {audienceType === "SELECTED_STUDENTS" && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Números de estudante</span>
                    <Textarea
                      value={selectedStudentNumbersText}
                      onChange={(event) => setSelectedStudentNumbersText(event.target.value)}
                      placeholder="20242099\n20240660"
                      className="min-h-[110px]"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Telefones manuais</span>
                    <Textarea
                      value={selectedPhonesText}
                      onChange={(event) => setSelectedPhonesText(event.target.value)}
                      placeholder="+244937624785\n921939411"
                      className="min-h-[110px]"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#0A3D62]/15 bg-[#0A3D62]/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A3D62]">Filtros opcionais</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded-xl border border-[#0A3D62]/15 bg-white px-3 py-2">
                  <span className="text-sm leading-5">Exigir consentimento marketing</span>
                  <Switch checked={cookieMarketingOptIn} onCheckedChange={setCookieMarketingOptIn} />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-[#0A3D62]/15 bg-white px-3 py-2">
                  <span className="text-sm leading-5">Exigir consentimento analytics</span>
                  <Switch checked={cookieAnalyticsOptIn} onCheckedChange={setCookieAnalyticsOptIn} />
                </label>
              </div>
              <label className="mt-3 block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A3D62]">Atividade recente (dias)</span>
                <Input type="number" min={1} max={365} value={activeWithinDays} onChange={(event) => setActiveWithinDays(Number(event.target.value || 0))} />
              </label>
            </div>

            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <Button variant="outline" className="w-full sm:w-auto" onClick={resetSendOptions}>Repor opções</Button>
              <Button className="w-full sm:w-auto" onClick={handlePreview} disabled={previewLoading}>
                {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Validar opções de envio
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <Badge className="bg-[#00B894] text-white hover:bg-[#00B894]">Módulo 2</Badge>
              Texto e personalização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            <label className="space-y-2 block">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Texto principal da SMS</span>
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-[180px]" />
            </label>

            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => insertPlaceholder("{{nome}}")}>Inserir {"{{nome}}"}</Button>
              <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => insertPlaceholder("{{numero}}")}>Inserir {"{{numero}}"}</Button>
              <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => insertPlaceholder("{{curso}}")}>Inserir {"{{curso}}"}</Button>
              <Button type="button" size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setMessage("")}>Limpar texto</Button>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Pré-visualização personalizada</p>
              <p className="mt-2 leading-7">{previewMessage || "Sem texto."}</p>
            </div>

            <p className="text-xs text-muted-foreground">Comprimento atual: <span className="font-semibold text-foreground">{message.length}</span> caracteres.</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <Badge className="bg-amber-500 text-white hover:bg-amber-500">Módulo 3</Badge>
              Textos prontos
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 px-4 pb-4 sm:px-6 sm:pb-6 md:grid-cols-2">
            {smsTemplates.map((template) => (
              <div key={template.id} className="rounded-xl border border-border/70 bg-background p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{template.title}</p>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </div>
                  {activeTemplateId === template.id ? <Badge>Ativo</Badge> : null}
                </div>
                <p className="mt-3 line-clamp-3 text-xs leading-6 text-slate-600">{template.message}</p>
                <div className="mt-3 grid gap-2">
                  <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => applyTemplate(template)}>Usar este texto</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <Badge className="bg-rose-500 text-white hover:bg-rose-500">Módulo 4</Badge>
              Envio em massa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
              <label className="space-y-2 min-w-0">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pesquisa opcional na audiência</span>
                <Input value={previewSearch} onChange={(event) => setPreviewSearch(event.target.value)} placeholder="Filtrar por nome, número ou curso..." />
              </label>
              <Button className="w-full rounded-xl md:w-auto" variant="outline" onClick={handlePreview} disabled={previewLoading}>
                {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Pré-visualizar envio
              </Button>
              <Button className="w-full rounded-xl bg-[#0A3D62] text-white hover:bg-[#082f4b] md:w-auto" onClick={handleSend} disabled={sending}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar em massa
              </Button>
            </div>

            {previewPayload ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">Destinatários válidos</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">{previewPayload.totalRecipients}</p>
                </div>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-amber-700">Ignorados</p>
                  <p className="mt-1 text-2xl font-bold text-amber-700">{previewPayload.skippedCount}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                Usa o botão <strong>Pré-visualizar envio</strong> para validar o público antes de disparar.
              </div>
            )}

            {previewPayload?.recipients?.length ? (
              <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {previewPayload.recipients.slice(0, 12).map((recipient) => (
                  <div key={`${recipient.phone}-${recipient.studentNumber ?? "manual"}`} className="rounded-xl border border-border/60 bg-background px-3 py-2">
                    <p className="break-words text-sm font-semibold">{recipient.name || recipient.studentNumber || recipient.phone}</p>
                    <p className="break-words text-xs text-muted-foreground">{recipient.course || "Curso não informado"} · {recipient.phone}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {recipient.sources.map((source) => (
                        <Badge key={source} variant="outline" className="text-[10px]">{source}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {sendResult ? (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm font-semibold">Resultado do envio #{sendResult.campaignId}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                  <p>Status: <span className="font-semibold text-foreground">{sendResult.status}</span></p>
                  <p>Agendada para: <span className="font-semibold text-foreground">{formatDateLabel(sendResult.scheduleAt)}</span></p>
                  <p>Sucesso: <span className="font-semibold text-emerald-700">{sendResult.successCount}</span></p>
                  <p>Falhas: <span className="font-semibold text-destructive">{sendResult.failedCount}</span></p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-[#0A3D62]" />
              Histórico de envios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
            {campaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                Ainda não há campanhas enviadas.
              </div>
            ) : (
              campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-xl border border-border/60 bg-background p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{campaign.title || `Campanha #${campaign.id}`}</p>
                      <p className="break-words text-xs text-muted-foreground">{campaign.audienceType} · {campaign.sender}</p>
                    </div>
                    <Badge variant="outline" className="w-fit">{campaign.status}</Badge>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>Total: {campaign.totalRecipients}</p>
                    <p>Sucesso: {campaign.successCount}</p>
                    <p>Falhas: {campaign.failedCount}</p>
                    <p>Enviado: {formatDateLabel(campaign.sentAt || campaign.createdAt)}</p>
                  </div>
                </div>
              ))
            )}

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Página {campaignPage + 1} de {totalCampaignPages}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={campaignPage <= 0}
                  onClick={() => void fetchCampaignPage(Math.max(0, campaignPage - 1))}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={campaignPage + 1 >= totalCampaignPages}
                  onClick={() => void fetchCampaignPage(Math.min(totalCampaignPages - 1, campaignPage + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-xs leading-6 text-muted-foreground">
        <p className="font-semibold text-foreground">Observações</p>
        <p>1. Usa <code>{"{{nome}}"}</code>, <code>{"{{numero}}"}</code> e <code>{"{{curso}}"}</code> para personalizar a mensagem automaticamente.</p>
        <p>2. O envio em massa deve sempre passar pela pré-visualização para confirmar quantos destinatários vão receber.</p>
      </div>
    </div>
  );
}

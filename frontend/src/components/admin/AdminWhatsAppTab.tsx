import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Filter,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  api,
  type Course,
  type SmsAudienceInput,
  type SmsAudienceType,
  type SmsFilterOptionsPayload,
  type WhatsAppAutomationSetting,
  type WhatsAppCampaignSummary,
  type WhatsAppInstanceSummary,
  type WhatsAppCampaignFailuresPayload,
  type WhatsAppOverviewPayload,
  type WhatsAppRecipientPreviewPayload,
  type WhatsAppSendResult,
} from "@/lib/api";
import { PlaceholderLookupModal } from "@/components/admin/PlaceholderLookupModal";

type Props = {
  courses: Course[];
};

type AutomationDraft = {
  enabled: boolean;
  title: string;
  message: string;
};

type PlaceholderSuggestion = {
  token: string;
  label: string;
  hint: string;
};

type AutomationEventKey = WhatsAppAutomationSetting["eventKey"];
type AutomationZoneKey = "projects" | "courses" | "announcements";

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

const emptyWhatsAppAutomations: WhatsAppAutomationSetting[] = [];

const audienceHelpers: Record<SmsAudienceType, string> = {
  ALL_STUDENTS: "Toda a base com telefone válido para WhatsApp.",
  STUDENT_CLASS: "Segmenta por turma académica usando o campo classCode.",
  STUDENT_COURSE: "Segmenta por curso académico dos estudantes.",
  STUDENT_CLASS_OR_COURSE: "Combina turma e curso, removendo duplicados automaticamente.",
  COURSE_ENROLLED: "Estudantes inscritos nos cursos do portal.",
  SUBMISSION_ENROLLED: "Estudantes com candidaturas submetidas.",
  COURSE_OR_SUBMISSION_ENROLLED: "Inscritos em cursos e candidatos numa só audiência.",
  EXHIBITORS: "Candidatos e expositores com submissões registadas.",
  COURSE_OR_EXHIBITORS: "Inscritos em cursos e expositores.",
  WINNERS: "Candidaturas marcadas como vencedoras.",
  SELECTED_STUDENTS: "Seleção manual por número de estudante ou telefone.",
};

const placeholderSuggestions: PlaceholderSuggestion[] = [
  { token: "{{nome}}", label: "Nome", hint: "Nome do destinatário" },
  { token: "{{numero}}", label: "Número", hint: "Número do estudante" },
  { token: "{{curso}}", label: "Curso", hint: "Curso associado" },
  { token: "{{turma}}", label: "Turma", hint: "Turma classCode do estudante" },
  { token: "{{colega}}", label: "Colega", hint: "Nome de quem gerou o gatilho" },
  { token: "{{titulo}}", label: "Título", hint: "Título da candidatura ou item" },
  { token: "{{referencia}}", label: "Referência", hint: "Código de referência" },
  { token: "{{estado}}", label: "Estado", hint: "Estado atual do processo" },
  { token: "{{detalhe}}", label: "Detalhe", hint: "Nota curta da operação" },
  { token: "{{link}}", label: "Link", hint: "Ligação útil para continuar" },
  { token: "{{evento}}", label: "Evento", hint: "Nome do evento ou sessão" },
  { token: "{{certificado}}", label: "Certificado", hint: "Nome do certificado" },
  { token: "{{validacao_url}}", label: "Validação", hint: "Link de validação" },
  { token: "{{pdf_url}}", label: "PDF", hint: "Ligação direta do PDF" },
];

const automationZoneOrder: AutomationZoneKey[] = ["projects", "courses", "announcements"];

const automationZoneMeta: Record<AutomationZoneKey, {
  label: string;
  description: string;
  icon: typeof FileText;
  tone: string;
}> = {
  projects: {
    label: "Projetos",
    description: "Confirma submissões, mudanças de estado e marcos de engajamento.",
    icon: FileText,
    tone: "bg-orange-500/10 text-orange-700",
  },
  courses: {
    label: "Cursos",
    description: "Acompanha inscrições recebidas, aprovadas, rejeitadas ou canceladas.",
    icon: Users,
    tone: "bg-sky-500/10 text-sky-700",
  },
  announcements: {
    label: "Avisos",
    description: "Comunica vencedores, certificados emitidos e presenças registadas.",
    icon: MessageCircle,
    tone: "bg-violet-500/10 text-violet-700",
  },
};

function getAutomationZoneKey(eventKey: AutomationEventKey): AutomationZoneKey {
  if (eventKey.startsWith("COURSE_")) return "courses";
  if (eventKey.startsWith("SUBMISSION_") && eventKey !== "SUBMISSION_MARKED_WINNER") return "projects";
  return "announcements";
}

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

function formatDateLabel(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-PT");
}

function statusTone(status: string) {
  const normalized = status.toUpperCase();
  if (["OPEN", "CONNECTED", "ONLINE", "CREATED", "SENT"].includes(normalized)) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  }
  if (["PARTIAL", "PAIRING", "CONNECTING", "PROCESSING"].includes(normalized)) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-700";
  }
  if (["FAILED", "ERROR", "DISABLED", "CLOSE"].includes(normalized)) {
    return "border-rose-500/25 bg-rose-500/10 text-rose-700";
  }
  return "border-border bg-muted/30 text-muted-foreground";
}

function isConnectedInstance(status: string) {
  return ["OPEN", "CONNECTED", "ONLINE"].includes(status.toUpperCase());
}

function isPendingConnectionStatus(status: string) {
  return ["CREATED", "CONNECTING", "PAIRING"].includes(status.toUpperCase());
}

function getConnectionWaitingMessage(instance: WhatsAppInstanceSummary) {
  const normalizedStatus = instance.status.toUpperCase();

  if (normalizedStatus === "CREATED") {
    return "A instância já foi criada. Usa Conectar para pedir um novo QR Code ou PIN da Evolution.";
  }

  if (instance.phoneNumber) {
    return "A Evolution já está a tentar ligar esta linha, mas ainda não devolveu o QR Code nem o PIN. Aguarda alguns segundos e usa Estado para recolher o código assim que ele for emitido.";
  }

  return "A Evolution recebeu o pedido de ligação, mas ainda não devolveu um QR Code. Aguarda alguns segundos e usa Estado para atualizar o painel.";
}

function normalizeInstanceName(value: string) {
  return value.trim().replace(/\s+/g, "-");
}

function personalizeForPreview(message: string) {
  return message
    .replace(/{{\s*nome\s*}}/gi, "Carlos Romão")
    .replace(/{{\s*numero\s*}}/gi, "20242099")
    .replace(/{{\s*curso\s*}}/gi, "Engenharia Informática")
    .replace(/{{\s*turma\s*}}/gi, "TINFM")
    .replace(/{{\s*colega\s*}}/gi, "Ana Mateus");
}

function ensureArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function appendPlaceholderToken(currentValue: string, token: string) {
  if (!currentValue.trim()) return token;
  if (currentValue.endsWith("\n") || currentValue.endsWith(" ")) return `${currentValue}${token}`;
  if (/[.:]$/.test(currentValue.trimEnd())) return `${currentValue} ${token}`;
  return `${currentValue}\n${token}`;
}

function buildAutomationDraftMap(automations?: WhatsAppAutomationSetting[] | null) {
  return ensureArray(automations).reduce<Record<string, AutomationDraft>>((acc, item) => {
    acc[item.eventKey] = {
      enabled: item.enabled,
      title: item.title,
      message: item.message,
    };
    return acc;
  }, {});
}

const lookupTokenMap: Record<string, "colega" | "certificado" | "pdf_url" | "validacao_url"> = {
  "{{colega}}": "colega",
  "{{certificado}}": "certificado",
  "{{pdf_url}}": "pdf_url",
  "{{validacao_url}}": "validacao_url",
};

function PlaceholderSuggestionGrid({
  onSelect,
}: {
  onSelect: (token: string) => void;
}) {
  const [lookupMode, setLookupMode] = useState<"colega" | "certificado" | "pdf_url" | "validacao_url" | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {placeholderSuggestions.map((item) => {
          const hasLookup = item.token in lookupTokenMap;

          return (
            <button
              key={item.token}
              type="button"
              onClick={() => {
                if (hasLookup) {
                  setLookupMode(lookupTokenMap[item.token]);
                } else {
                  onSelect(item.token);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-sm active:scale-[0.97] ${
                hasLookup
                  ? "border-violet-500/25 bg-violet-500/[0.06] text-violet-800 hover:border-violet-500/40 hover:bg-violet-500/[0.12]"
                  : "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-800 hover:border-emerald-500/40 hover:bg-emerald-500/[0.12]"
              }`}
              title={hasLookup ? `${item.hint} — clica para pesquisar` : item.hint}
            >
              <span className={`font-mono text-[10px] ${hasLookup ? "text-violet-600/70" : "text-emerald-600/70"}`}>{item.token}</span>
              <span>{item.label}</span>
              {hasLookup ? <Search className="h-3 w-3 opacity-50" /> : null}
            </button>
          );
        })}
      </div>

      {lookupMode ? (
        <PlaceholderLookupModal
          mode={lookupMode}
          open
          onClose={() => setLookupMode(null)}
          onSelect={(value) => onSelect(value)}
        />
      ) : null}
    </>
  );
}

export function AdminWhatsAppTab({ courses }: Props) {
  const campaignPageSize = 20;

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WhatsAppOverviewPayload | null>(null);
  const [filterOptions, setFilterOptions] = useState<SmsFilterOptionsPayload | null>(null);
  const [campaigns, setCampaigns] = useState<WhatsAppCampaignSummary[]>([]);
  const [campaignPage, setCampaignPage] = useState(0);
  const [campaignTotal, setCampaignTotal] = useState(0);

  const [instanceName, setInstanceName] = useState("uor-connect-oficial");
  const [instanceLabel, setInstanceLabel] = useState("Linha oficial UOR Connect");
  const [instancePhone, setInstancePhone] = useState("");
  const [instanceAsDefault, setInstanceAsDefault] = useState(true);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [busyInstanceId, setBusyInstanceId] = useState<number | null>(null);

  const [automationDrafts, setAutomationDrafts] = useState<Record<string, AutomationDraft>>({});
  const [savingAutomationKey, setSavingAutomationKey] = useState<string | null>(null);
  const [savingAutomationZone, setSavingAutomationZone] = useState<AutomationZoneKey | null>(null);
  const [activeAutomationKey, setActiveAutomationKey] = useState<AutomationEventKey | null>(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("Olá {{nome}}, temos uma atualização importante no UOR Connect.");
  const [audienceType, setAudienceType] = useState<SmsAudienceType>("ALL_STUDENTS");
  const [instanceId, setInstanceId] = useState<number | "">("");
  const [selectedStudentClassCodes, setSelectedStudentClassCodes] = useState<string[]>([]);
  const [selectedStudentCourses, setSelectedStudentCourses] = useState<string[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<Array<"PENDING" | "APPROVED" | "REJECTED">>(["APPROVED"]);
  const [selectedStudentNumbersText, setSelectedStudentNumbersText] = useState("");
  const [selectedPhonesText, setSelectedPhonesText] = useState("");
  const [cookieMarketingOptIn, setCookieMarketingOptIn] = useState(false);
  const [requireRecentActivity, setRequireRecentActivity] = useState(false);
  const [activeWithinDays, setActiveWithinDays] = useState(30);
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentName, setDocumentName] = useState("documento-uor-connect.pdf");
  const [delay, setDelay] = useState(0);

  const [previewSearch, setPreviewSearch] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPayload, setPreviewPayload] = useState<WhatsAppRecipientPreviewPayload | null>(null);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<WhatsAppSendResult | null>(null);

  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<string | null>(null);
  const [loadingCampaignFailures, setLoadingCampaignFailures] = useState<number | null>(null);
  const [expandedCampaignId, setExpandedCampaignId] = useState<number | null>(null);
  const [campaignFailuresCache, setCampaignFailuresCache] = useState<Record<number, WhatsAppCampaignFailuresPayload>>({});

  const instances = overview?.instances ?? [];
  const automations = overview?.automations ?? emptyWhatsAppAutomations;
  const audienceButtons = filterOptions?.audienceButtons ?? defaultAudienceButtons;
  const studentClassButtons = filterOptions?.studentClassButtons ?? [];
  const studentCourseButtons = filterOptions?.studentCourseButtons ?? [];
  const selectedAudienceButton = audienceButtons.find((item) => item.type === audienceType) ?? null;
  const selectedInstance = typeof instanceId === "number"
    ? instances.find((item) => item.id === instanceId) ?? null
    : null;
  const previewMessage = useMemo(() => personalizeForPreview(message), [message]);
  const integrationReady = Boolean(overview?.integration.configured);
  const connectedCount = instances.filter((item) => isConnectedInstance(item.status)).length;
  const enabledAutomationCount = automations.filter((item) => automationDrafts[item.eventKey]?.enabled ?? item.enabled).length;
  const contextualAutomationCount = automations.filter((item) => item.eventKey.includes("CONTEXT_AUDIENCE") && (automationDrafts[item.eventKey]?.enabled ?? item.enabled)).length;
  const recentSuccessCount = campaigns.filter((item) => item.status === "SENT").length;
  const hasDefaultConnectedInstance = instances.some((item) => item.isDefault && isConnectedInstance(item.status));
  const setupScore = [
    integrationReady,
    connectedCount > 0,
    hasDefaultConnectedInstance,
    contextualAutomationCount > 0,
  ].filter(Boolean).length;
  const totalCampaignPages = Math.max(1, Math.ceil(campaignTotal / campaignPageSize));
  const visibleCampaignStart = campaignTotal === 0 ? 0 : campaignPage * campaignPageSize + 1;
  const visibleCampaignEnd = campaignTotal === 0 ? 0 : Math.min(campaignTotal, campaignPage * campaignPageSize + campaigns.length);
  const canConfirmManualSend = !selectedInstance || isConnectedInstance(selectedInstance.status);
  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (campaignSearch.trim()) {
      const query = campaignSearch.trim().toLowerCase();
      result = result.filter((c) =>
        (c.title ?? "").toLowerCase().includes(query) ||
        c.instanceName.toLowerCase().includes(query) ||
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

  const automationZones = useMemo(() => automationZoneOrder
    .map((zoneKey) => {
      const zoneAutomations = automations.filter((automation) => getAutomationZoneKey(automation.eventKey) === zoneKey);
      const enabledCount = zoneAutomations.filter((automation) => (
        automationDrafts[automation.eventKey]?.enabled ?? automation.enabled
      )).length;

      return {
        key: zoneKey,
        ...automationZoneMeta[zoneKey],
        automations: zoneAutomations,
        enabledCount,
      };
    })
    .filter((zone) => zone.automations.length > 0), [automationDrafts, automations]);
  const activeAutomation = automations.find((automation) => automation.eventKey === activeAutomationKey)
    ?? automations[0]
    ?? null;
  const activeAutomationDraft = activeAutomation
    ? automationDrafts[activeAutomation.eventKey] ?? {
      enabled: activeAutomation.enabled,
      title: activeAutomation.title,
      message: activeAutomation.message,
    }
    : null;
  const activeAutomationZoneKey = activeAutomation ? getAutomationZoneKey(activeAutomation.eventKey) : null;
  const activeAutomationZone = activeAutomationZoneKey ? automationZoneMeta[activeAutomationZoneKey] : null;
  const ActiveAutomationIcon = activeAutomationZone?.icon ?? MessageCircle;

  useEffect(() => {
    if (!automations.length) {
      if (activeAutomationKey) setActiveAutomationKey(null);
      return;
    }

    if (!activeAutomationKey || !automations.some((automation) => automation.eventKey === activeAutomationKey)) {
      setActiveAutomationKey(automations[0].eventKey);
    }
  }, [activeAutomationKey, automations]);

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
    const payload = await api.whatsapp.overview();
    const normalizedPayload: WhatsAppOverviewPayload = {
      ...payload,
      automations: ensureArray(payload.automations),
      instances: ensureArray(payload.instances),
      campaigns: ensureArray(payload.campaigns),
    };
    setOverview(normalizedPayload);
    setAutomationDrafts(buildAutomationDraftMap(normalizedPayload.automations));

    const preferredInstance = normalizedPayload.instances.find((item) => item.isDefault && isConnectedInstance(item.status))
      ?? normalizedPayload.instances.find((item) => isConnectedInstance(item.status))
      ?? normalizedPayload.instances.find((item) => item.isDefault)
      ?? normalizedPayload.instances[0];
    const selectedInstanceExists = typeof instanceId === "number"
      ? normalizedPayload.instances.some((item) => item.id === instanceId)
      : false;

    if ((!instanceId || !selectedInstanceExists) && preferredInstance) {
      setInstanceId(preferredInstance.id);
    }
  }, [instanceId]);

  const fetchFilterOptions = useCallback(async () => {
    setFilterOptions(await api.whatsapp.filters());
  }, []);

  const fetchCampaignPage = useCallback(async (page: number) => {
    const payload = await api.whatsapp.campaigns(page, campaignPageSize);
    setCampaignPage(payload.page);
    setCampaigns(ensureArray(payload.campaigns));
    setCampaignTotal(payload.total);
  }, [campaignPageSize]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchOverview(), fetchFilterOptions(), fetchCampaignPage(0)]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar a central WhatsApp.");
    } finally {
      setLoading(false);
    }
  }, [fetchCampaignPage, fetchFilterOptions, fetchOverview]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const refreshAll = async () => {
    await Promise.all([fetchOverview(), fetchFilterOptions(), fetchCampaignPage(0)]);
  };

  const handleCreateInstance = async () => {
    const normalizedName = normalizeInstanceName(instanceName);

    if (!normalizedName) {
      toast.error("Define um nome para a instância.");
      return;
    }

    setCreatingInstance(true);
    try {
      const response = await api.whatsapp.createInstance({
        name: normalizedName,
        label: instanceLabel.trim() || undefined,
        phoneNumber: instancePhone.trim() || undefined,
        isDefault: instanceAsDefault,
      });
      setInstanceId(response.instance.id);
      await refreshAll();
      toast.success(response.instance.qrCode || response.instance.pairingCode
        ? "Instância criada com código de conexão disponível."
        : "Instância criada. Usa Conectar para solicitar o QR Code ou PIN.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar a instância.");
    } finally {
      setCreatingInstance(false);
    }
  };

  const handleConnect = async (item: WhatsAppInstanceSummary) => {
    setBusyInstanceId(item.id);
    try {
      const response = await api.whatsapp.connectInstance(item.id);
      await refreshAll();
      toast.success(response.instance.qrCode || response.instance.pairingCode
        ? "QR Code atualizado para a instância."
        : "Pedido enviado. Se o QR ou PIN não aparecer já, atualiza o estado dentro de alguns segundos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao conectar a instância.");
    } finally {
      setBusyInstanceId(null);
    }
  };

  const handleRefreshStatus = async (item: WhatsAppInstanceSummary) => {
    setBusyInstanceId(item.id);
    try {
      await api.whatsapp.refreshInstanceStatus(item.id);
      await refreshAll();
      toast.success("Estado da instância atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao consultar a instância.");
    } finally {
      setBusyInstanceId(null);
    }
  };

  const handleSetDefault = async (item: WhatsAppInstanceSummary) => {
    setBusyInstanceId(item.id);
    try {
      await api.whatsapp.setDefaultInstance(item.id);
      await refreshAll();
      toast.success("Instância padrão atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao definir instância padrão.");
    } finally {
      setBusyInstanceId(null);
    }
  };

  const handleDisable = async (item: WhatsAppInstanceSummary) => {
    if (!window.confirm(`Remover a instância ${item.name} da administração?`)) return;

    setBusyInstanceId(item.id);
    try {
      await api.whatsapp.disableInstance(item.id);
      await refreshAll();
      toast.success("Instância removida da administração.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover a instância.");
    } finally {
      setBusyInstanceId(null);
    }
  };

  const handleAutomationDraftChange = (
    eventKey: AutomationEventKey,
    patch: Partial<AutomationDraft>,
  ) => {
    setAutomationDrafts((current) => ({
      ...current,
      [eventKey]: {
        enabled: current[eventKey]?.enabled ?? true,
        title: current[eventKey]?.title ?? "",
        message: current[eventKey]?.message ?? "",
        ...patch,
      },
    }));
  };

  const handleAutomationZoneDraftChange = (zoneKey: AutomationZoneKey, enabled: boolean) => {
    const zoneAutomations = automations.filter((automation) => getAutomationZoneKey(automation.eventKey) === zoneKey);

    setAutomationDrafts((current) => {
      const next = { ...current };
      zoneAutomations.forEach((automation) => {
        next[automation.eventKey] = {
          enabled,
          title: current[automation.eventKey]?.title ?? automation.title,
          message: current[automation.eventKey]?.message ?? automation.message,
        };
      });
      return next;
    });
  };

  const handleSaveAutomationZone = async (zoneKey: AutomationZoneKey) => {
    const zoneAutomations = automations.filter((automation) => getAutomationZoneKey(automation.eventKey) === zoneKey);
    if (!zoneAutomations.length) return;

    setSavingAutomationZone(zoneKey);
    try {
      const updatedItems = await Promise.all(zoneAutomations.map((automation) => {
        const draft = automationDrafts[automation.eventKey] ?? {
          enabled: automation.enabled,
          title: automation.title,
          message: automation.message,
        };

        return api.whatsapp.updateAutomation(automation.eventKey, draft);
      }));
      const updatedByKey = new Map(updatedItems.map((item) => [item.eventKey, item]));

      setAutomationDrafts((current) => {
        const next = { ...current };
        updatedItems.forEach((updated) => {
          next[updated.eventKey] = {
            enabled: updated.enabled,
            title: updated.title,
            message: updated.message,
          };
        });
        return next;
      });
      setOverview((current) => current
        ? {
          ...current,
          automations: current.automations.map((item) => updatedByKey.get(item.eventKey) ?? item),
        }
        : current);
      toast.success(`Zona ${automationZoneMeta[zoneKey].label} atualizada.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar a zona.");
    } finally {
      setSavingAutomationZone(null);
    }
  };

  const handleSaveAutomation = async (eventKey: AutomationEventKey) => {
    const draft = automationDrafts[eventKey];
    if (!draft) return;

    setSavingAutomationKey(eventKey);
    try {
      const updated = await api.whatsapp.updateAutomation(eventKey, draft);
      setAutomationDrafts((current) => ({
        ...current,
        [eventKey]: {
          enabled: updated.enabled,
          title: updated.title,
          message: updated.message,
        },
      }));
      setOverview((current) => current
        ? {
          ...current,
          automations: current.automations.map((item) => item.eventKey === eventKey ? updated : item),
        }
        : current);
      toast.success("Automação atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar a automação.");
    } finally {
      setSavingAutomationKey(null);
    }
  };

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
      const payload = await api.whatsapp.previewRecipients({
        audience,
        search: previewSearch || undefined,
        limit: 200,
      });
      setPreviewPayload(payload);
      toast.success("Pré-visualização atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar a pré-visualização.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSendIntent = () => {
    if (!message.trim()) {
      toast.error("Escreve a mensagem antes de enviar.");
      return;
    }

    setConfirmSendOpen(true);
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
      const payload = await api.whatsapp.campaignFailures(campaignId);
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
    setTitle(cached.title ? `Reenvio: ${cached.title}` : "Reenvio de falhados");
    setAudienceType("SELECTED_STUDENTS");
    setSelectedPhonesText(failedPhones.join("\n"));
    setSelectedStudentNumbersText("");
    setPreviewPayload(null);
    setExpandedCampaignId(null);
    toast.success(`${failedPhones.length} telefone(s) preparados para reenvio com a mesma mensagem.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSend = async () => {
    if (!canConfirmManualSend) {
      toast.error("A instância escolhida precisa de estar conectada antes do envio.");
      return;
    }

    setSending(true);
    setSendResult(null);
    try {
      setConfirmSendOpen(false);
      const payload = await api.whatsapp.sendCampaign({
        title: title.trim() || undefined,
        message,
        audience: buildAudiencePayload(),
        instanceId: typeof instanceId === "number" ? instanceId : undefined,
        delay: delay > 0 ? delay : undefined,
        media: documentUrl.trim()
          ? {
            url: documentUrl.trim(),
            fileName: documentName.trim() || "documento-uor-connect.pdf",
            mimeType: "application/pdf",
            type: "document",
          }
          : undefined,
      });

      setSendResult(payload);
      await Promise.all([fetchOverview(), fetchCampaignPage(0)]);

      if (payload.failedCount === 0) {
        toast.success(`Envio concluído com ${payload.successCount} mensagem(ns).`);
      } else if (payload.successCount === 0) {
        toast.error(payload.failures[0]?.reason
          ? `Nenhuma mensagem foi enviada. ${payload.failures[0].reason}`
          : "Nenhuma mensagem foi enviada.");
      } else {
        toast.warning(`Envio parcial: ${payload.successCount} enviada(s), ${payload.failedCount} falhada(s).`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio manual.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-white shadow-sm">
        <div className="border-b border-emerald-500/10 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(14,165,233,0.08),rgba(255,255,255,0.98))] p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase text-emerald-700">
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp operacional
              </div>
              <h2 className="mt-3 text-xl font-bold text-slate-950 sm:text-2xl">Linhas, automações e disparos</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Gere a ligação com a Evolution API, aprova gatilhos por turma/curso e acompanha cada envio sem sair da central.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Badge variant="outline" className={integrationReady ? "w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "w-fit border-amber-500/30 bg-amber-500/10 text-amber-700"}>
                {integrationReady ? "API pronta" : "API pendente"}
              </Badge>
              <Button variant="outline" className="w-full rounded-xl bg-white/85 sm:w-fit" onClick={() => void loadInitialData()} disabled={loading}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Chave Evolution", value: integrationReady ? "Configurada" : "Pendente", ok: integrationReady },
            { label: "Linha conectada", value: `${connectedCount}/${instances.length || 0}`, ok: connectedCount > 0 },
            { label: "Padrão pronta", value: hasDefaultConnectedInstance ? "Sim" : "Não", ok: hasDefaultConnectedInstance },
            { label: "Gatilhos turma", value: `${contextualAutomationCount}/2`, ok: contextualAutomationCount > 0 },
          ].map((item) => (
            <div key={item.label} className="flex min-h-[68px] items-center justify-between rounded-xl border border-border/60 bg-slate-50/80 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
              </div>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>
                {item.ok ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 px-4 py-3">
          <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Preparação para produção</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-36 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(setupScore / 4) * 100}%` }} />
              </div>
              <span className="font-medium text-foreground">{setupScore}/4</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-emerald-500/15 bg-emerald-500/[0.03]">
          <CardContent className="flex min-h-[92px] items-center gap-3 p-4">
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase text-muted-foreground">Integração</p>
              <p className="text-sm font-semibold">{overview?.integration.configured ? "Configurada" : "Pendente"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-500/15 bg-sky-500/[0.03]">
          <CardContent className="flex min-h-[92px] items-center gap-3 p-4">
            <div className="rounded-xl bg-sky-500/10 p-2 text-sky-700">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase text-muted-foreground">Linhas</p>
              <p className="text-sm font-semibold">{connectedCount}/{instances.length} conectadas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-violet-500/15 bg-violet-500/[0.03]">
          <CardContent className="flex min-h-[92px] items-center gap-3 p-4">
            <div className="rounded-xl bg-violet-500/10 p-2 text-violet-700">
              <Wifi className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase text-muted-foreground">Automações</p>
              <p className="text-sm font-semibold">{enabledAutomationCount}/{automations.length} ativas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/15 bg-amber-500/[0.03]">
          <CardContent className="flex min-h-[92px] items-center gap-3 p-4">
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-700">
              <Send className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase text-muted-foreground">Recentes</p>
              <p className="text-sm font-semibold">{recentSuccessCount}/{campaigns.length} concluídas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:items-start">
        <Card className="min-w-0 border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4 text-emerald-700" />
              Instâncias de envio
            </CardTitle>
            <CardDescription>Cria, liga e acompanha as linhas que fazem os disparos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Nome</span>
                  <Input value={instanceName} onChange={(event) => setInstanceName(event.target.value)} placeholder="uor-connect-oficial" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Etiqueta</span>
                  <Input value={instanceLabel} onChange={(event) => setInstanceLabel(event.target.value)} placeholder="Linha oficial" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Telefone</span>
                  <Input value={instancePhone} onChange={(event) => setInstancePhone(event.target.value)} placeholder="244951203163" />
                </label>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-3 text-sm">
                  <Switch checked={instanceAsDefault} onCheckedChange={setInstanceAsDefault} />
                  Tornar padrão
                </label>
                <Button onClick={() => void handleCreateInstance()} disabled={creatingInstance} className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">
                  {creatingInstance ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wifi className="mr-2 h-4 w-4" />}
                  Criar instância
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">Evolution:</span> {overview?.integration.baseUrl ?? "—"}</p>
              <p><span className="font-medium text-foreground">Portal público:</span> {overview?.integration.publicAppUrl ?? "não definido"}</p>
              {overview?.integration.providerMessage ? (
                <p className="mt-2 text-amber-700">{overview.integration.providerMessage}</p>
              ) : null}
            </div>

            {instances.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                Nenhuma linha configurada ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {instances.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border/70 bg-background p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{item.label || item.name}</p>
                          {item.isDefault ? <Badge className="bg-emerald-700 text-white hover:bg-emerald-700">Padrão</Badge> : null}
                          <Badge variant="outline" className={statusTone(item.status)}>{item.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{item.name} · {item.phoneNumber || "telefone não informado"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Última consulta: {formatDateLabel(item.lastCheckedAt)}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => void handleConnect(item)} disabled={busyInstanceId === item.id}>
                          {busyInstanceId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                          Conectar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleRefreshStatus(item)} disabled={busyInstanceId === item.id}>
                          <RefreshCcw className="mr-2 h-4 w-4" />
                          Estado
                        </Button>
                        {!item.isDefault ? (
                          <Button size="sm" variant="outline" onClick={() => void handleSetDefault(item)} disabled={busyInstanceId === item.id}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Padrão
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => void handleDisable(item)} disabled={busyInstanceId === item.id}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover
                        </Button>
                      </div>
                    </div>

                    {item.qrCode || item.pairingCode ? (
                      <div className="mt-4 grid gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:grid-cols-[180px_1fr] sm:items-start">
                        {item.qrCode ? (
                          <img src={item.qrCode} alt={`QR Code da instância ${item.name}`} className="h-44 w-44 rounded-xl border border-white bg-white p-2" />
                        ) : null}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">Ligação do telefone</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            Abre o WhatsApp no telemóvel, entra em dispositivos conectados e lê o QR Code.
                          </p>
                          {item.pairingCode ? (
                            <p className="mt-3 rounded-lg border border-border/70 bg-white px-3 py-2 font-mono text-sm">{item.pairingCode}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : isPendingConnectionStatus(item.status) ? (
                      <div className="mt-4 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.05] p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
                            <QrCode className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">QR Code ou PIN ainda não disponível</p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                              {getConnectionWaitingMessage(item)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wifi className="h-4 w-4 text-emerald-700" />
                  Automações
                </CardTitle>
                <CardDescription>Mensagens disparadas automaticamente por eventos da plataforma.</CardDescription>
              </div>
              <Badge variant="outline" className="w-fit">
                {enabledAutomationCount}/{automations.length} ativas
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {automations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                Ainda não há automações configuradas.
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(255,255,255,0.96))] p-4 sm:p-5">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Zonas com disparo automático</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Liga ou remove os envios automáticos por área. Para editar uma mensagem, escolhe a opção no painel abaixo.
                      </p>
                    </div>
                    <span className="w-fit rounded-full border border-emerald-500/20 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                      Clique para detalhar
                    </span>
                  </div>

                  <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-stretch gap-3">
                    {automationZones.map((zone) => {
                      const Icon = zone.icon;
                      const allEnabled = zone.enabledCount === zone.automations.length;
                      const partiallyEnabled = zone.enabledCount > 0 && !allEnabled;
                      const zoneBusy = savingAutomationZone === zone.key;

                      return (
                        <div key={zone.key} className="flex h-full flex-col rounded-2xl border border-border/70 bg-white/95 p-4 shadow-sm">
                          <div className="flex flex-1 items-start gap-3">
                            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset ring-black/5 ${zone.tone}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="leading-none font-semibold">{zone.label}</p>
                                <Badge variant="outline" className="bg-background">
                                  {zone.enabledCount}/{zone.automations.length}
                                </Badge>
                                {partiallyEnabled ? (
                                  <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">
                                    Parcial
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm leading-6 text-muted-foreground">{zone.description}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted/25 p-2 text-xs">
                            <div className="rounded-lg bg-white px-3 py-2">
                              <span className="block text-muted-foreground">Ativas</span>
                              <strong className="mt-0.5 block text-base leading-none text-foreground">{zone.enabledCount}</strong>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-2">
                              <span className="block text-muted-foreground">Opções</span>
                              <strong className="mt-0.5 block text-base leading-none text-foreground">{zone.automations.length}</strong>
                            </div>
                          </div>

                          <div className="mt-auto rounded-2xl border border-border/60 bg-muted/20 p-2">
                            <label className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
                              <span className="flex min-w-0 flex-col">
                                <span className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                  Estado da zona
                                </span>
                                <span className="mt-0.5 truncate font-medium text-foreground">
                                  {allEnabled ? "Permitida" : partiallyEnabled ? "Parcial" : "Removida"}
                                </span>
                              </span>
                              <Switch
                                className="shrink-0"
                                checked={allEnabled}
                                onCheckedChange={(checked) => handleAutomationZoneDraftChange(zone.key, checked)}
                              />
                            </label>
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 h-11 w-full min-w-0 justify-center rounded-xl px-3 text-center leading-tight whitespace-normal"
                              onClick={() => void handleSaveAutomationZone(zone.key)}
                              disabled={zoneBusy}
                            >
                              {zoneBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              <span className="min-w-0 truncate">Guardar zona</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 2xl:grid-cols-[minmax(240px,0.85fr)_minmax(0,1.15fr)]">
                  <div className="rounded-2xl border border-border/70 bg-background p-2">
                    <div className="px-2 pb-2 pt-1">
                      <p className="text-sm font-semibold text-foreground">Opções de automação</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">Escolhe uma opção para ver e editar a mensagem.</p>
                    </div>

                    <div className="space-y-3">
                      {automationZones.map((zone) => {
                        const Icon = zone.icon;

                        return (
                          <div key={`${zone.key}-selector`} className="space-y-1.5">
                            <div className="flex items-center gap-2 px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${zone.tone}`}>
                                <Icon className="h-3.5 w-3.5" />
                              </span>
                              {zone.label}
                            </div>

                            {zone.automations.map((automation) => {
                              const draft = automationDrafts[automation.eventKey] ?? {
                                enabled: automation.enabled,
                                title: automation.title,
                                message: automation.message,
                              };
                              const selected = activeAutomation?.eventKey === automation.eventKey;

                              return (
                                <button
                                  key={automation.eventKey}
                                  type="button"
                                  onClick={() => setActiveAutomationKey(automation.eventKey)}
                                  aria-expanded={selected}
                                  className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                                    selected
                                      ? "border-emerald-500/35 bg-emerald-500/[0.07] shadow-sm"
                                      : "border-transparent bg-muted/25 hover:border-border/70 hover:bg-white"
                                  }`}
                                >
                                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${zone.tone} ${selected ? "ring-2 ring-emerald-500/20" : ""}`}>
                                    <Icon className="h-4 w-4" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-foreground">{automation.label}</span>
                                    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                      <span className={`h-1.5 w-1.5 rounded-full ${draft.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                                      {draft.enabled ? "Ativa" : "Pausada"}
                                    </span>
                                  </span>
                                  <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${selected ? "translate-x-0.5 text-emerald-700" : "group-hover:translate-x-0.5"}`} />
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {activeAutomation && activeAutomationDraft ? (
                    <div className="rounded-2xl border border-border/70 bg-white shadow-sm">
                      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ring-black/5 ${activeAutomationZone?.tone ?? "bg-emerald-500/10 text-emerald-700"}`}>
                            <ActiveAutomationIcon className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            {activeAutomationZone ? (
                              <Badge variant="outline" className="bg-background">{activeAutomationZone.label}</Badge>
                            ) : null}
                            <Badge
                              variant="outline"
                              className={activeAutomationDraft.enabled
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                                : "border-border bg-muted/40 text-muted-foreground"}
                            >
                              {activeAutomationDraft.enabled ? "Ativa" : "Pausada"}
                            </Badge>
                          </div>
                        </div>
                        <label className="flex shrink-0 items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                          <span className="hidden sm:inline">{activeAutomationDraft.enabled ? "Ligada" : "Desligada"}</span>
                          <Switch
                            checked={activeAutomationDraft.enabled}
                            onCheckedChange={(checked) => handleAutomationDraftChange(activeAutomation.eventKey, { enabled: checked })}
                          />
                        </label>
                      </div>

                      <div className="space-y-4 p-4 sm:p-5">
                        <div>
                          <h4 className="text-base font-semibold text-foreground">{activeAutomation.label}</h4>
                          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{activeAutomation.description}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Atualizado em {formatDateLabel(activeAutomation.updatedAt)}</p>
                        </div>

                        <label className="block space-y-2">
                          <span className="text-xs font-semibold uppercase text-muted-foreground">Título interno</span>
                          <Input
                            value={activeAutomationDraft.title}
                            onChange={(event) => handleAutomationDraftChange(activeAutomation.eventKey, { title: event.target.value })}
                            placeholder="Título interno"
                          />
                        </label>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase text-muted-foreground">Mensagem</span>
                            <span className={`text-xs tabular-nums ${(activeAutomationDraft.message?.length ?? 0) > 1000 ? "font-semibold text-amber-600" : "text-muted-foreground"}`}>
                              {activeAutomationDraft.message?.length ?? 0} caracteres
                            </span>
                          </div>
                          <Textarea
                            value={activeAutomationDraft.message}
                            onChange={(event) => handleAutomationDraftChange(activeAutomation.eventKey, { message: event.target.value })}
                            rows={7}
                            className="resize-none rounded-xl border-emerald-500/15 bg-white text-[14px] leading-relaxed shadow-sm transition-colors focus:border-emerald-500/40 focus:ring-emerald-500/20"
                          />
                        </div>

                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Inserir placeholder</p>
                          <PlaceholderSuggestionGrid onSelect={(token) => handleAutomationDraftChange(activeAutomation.eventKey, {
                            message: appendPlaceholderToken(activeAutomationDraft.message, token),
                          })} />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 border-t border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <p className="text-xs leading-5 text-muted-foreground">
                          As alterações só entram em produção depois de guardar.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => void handleSaveAutomation(activeAutomation.eventKey)}
                          disabled={savingAutomationKey === activeAutomation.eventKey}
                        >
                          {savingAutomationKey === activeAutomation.eventKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          Guardar automação
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-start">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-emerald-700" />
              Envio manual
            </CardTitle>
            <CardDescription>Define a campanha em blocos: detalhes, audiência e conteúdo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Detalhes da campanha</p>
                <p className="mt-1 text-sm text-muted-foreground">Identifica o envio, escolhe a linha e junta um PDF quando for necessário.</p>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Título interno</span>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Atualização dos expositores" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Instância</span>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={instanceId}
                    onChange={(event) => setInstanceId(event.target.value ? Number(event.target.value) : "")}
                  >
                    <option value="">Usar padrão</option>
                    {instances.map((item) => (
                      <option key={item.id} value={item.id}>
                        {(item.label || item.name)}{item.isDefault ? " · padrão" : ""} · {item.status}
                      </option>
                    ))}
                  </select>
                  {selectedInstance && !isConnectedInstance(selectedInstance.status) ? (
                    <p className="text-xs text-amber-700">A instância escolhida não está conectada.</p>
                  ) : null}
                </label>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.45fr)_160px]">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Documento URL</span>
                  <Input value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} placeholder="https://..." />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Nome do ficheiro</span>
                  <Input value={documentName} onChange={(event) => setDocumentName(event.target.value)} placeholder="documento-uor-connect.pdf" />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Atraso (ms)</span>
                  <Input type="number" value={delay} onChange={(event) => setDelay(Number(event.target.value) || 0)} min={0} max={20000} />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Audiência</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
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
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{audienceHelpers[audienceType]}</p>

              {isStudentClassAudience(audienceType) ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
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
                <div className="mt-4 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
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
                      placeholder="244951203163"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Mensagem</span>
                  <span className={`text-xs tabular-nums ${message.length > 1000 ? "font-semibold text-amber-600" : "text-muted-foreground"}`}>
                    {message.length} caracteres
                  </span>
                </div>
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={8}
                  className="resize-none rounded-xl border-emerald-500/15 bg-white font-[system-ui] text-[14px] leading-relaxed shadow-sm transition-colors focus:border-emerald-500/40 focus:ring-emerald-500/20"
                  placeholder="Escreve aqui a mensagem que será enviada por WhatsApp..."
                />
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Inserir placeholder</p>
                <PlaceholderSuggestionGrid onSelect={(token) => setMessage((current) => appendPlaceholderToken(current, token))} />
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
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-emerald-700" />
              Pré-visualização
            </CardTitle>
            <CardDescription>Valida destinatários e confere a mensagem antes do disparo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Pesquisar na audiência</span>
              <Input value={previewSearch} onChange={(event) => setPreviewSearch(event.target.value)} placeholder="Nome, número ou curso" />
            </label>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Prévia da mensagem</p>
              <p className="mt-2 min-h-[96px] whitespace-pre-wrap text-sm leading-6 text-foreground">{previewMessage}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Button className="w-full" variant="outline" onClick={() => void handlePreview()} disabled={previewLoading}>
                {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                Validar audiência
              </Button>
              <Button className="w-full" onClick={handleSendIntent} disabled={sending}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar agora
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
                Faz uma validação para ver os destinatários antes do envio.
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
                      <p className="text-xs text-muted-foreground">{sendResult.instanceName}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={statusTone(sendResult.status)}>{sendResult.status}</Badge>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-emerald-700">{sendResult.successCount}</p>
                    <p className="text-[10px] uppercase text-emerald-600/80">Enviadas</p>
                  </div>
                  <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-rose-700">{sendResult.failedCount}</p>
                    <p className="text-[10px] uppercase text-rose-600/80">Falhadas</p>
                  </div>
                  <div className="rounded-lg bg-slate-500/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold text-slate-700">{sendResult.skippedCount}</p>
                    <p className="text-[10px] uppercase text-slate-600/80">Ignoradas</p>
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

      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent className="max-w-2xl overflow-hidden rounded-2xl border border-emerald-500/20 p-0">
          <div className="border-b border-emerald-500/15 bg-[linear-gradient(135deg,rgba(16,185,129,0.10),rgba(255,255,255,0.98))] p-6">
            <DialogHeader className="text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase text-emerald-700">
                <Send className="h-3.5 w-3.5" />
                Confirmação de envio
              </div>
              <DialogTitle className="mt-3 text-xl text-emerald-950">
                Confirmas o envio manual pelo WhatsApp?
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-6 text-slate-600">
                Revê a linha, a audiência e a mensagem antes de disparar a campanha.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Audiência</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{selectedAudienceButton?.label ?? audienceType}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {previewPayload
                    ? `${previewPayload.totalRecipients} contactos válidos após a validação`
                    : `${selectedAudienceButton?.sendable ?? 0} contactos válidos na contagem base`}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Linha de envio</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {selectedInstance ? (selectedInstance.label || selectedInstance.name) : "Instância padrão"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedInstance ? `Estado atual: ${selectedInstance.status}` : "O sistema vai escolher a linha padrão disponível."}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Anexo</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {documentUrl.trim() ? (documentName.trim() || "documento-uor-connect.pdf") : "Sem documento"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {documentUrl.trim() ? "O PDF segue junto com a mensagem." : "Esta campanha vai sair apenas com texto."}
                </p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Cadência</p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {delay > 0 ? `${delay} ms entre envios` : "Sem atraso adicional"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {title.trim() ? `Título interno: ${title.trim()}` : "Sem título interno definido."}
                </p>
              </div>
            </div>

            {!canConfirmManualSend ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                A instância selecionada não está conectada. Liga a linha primeiro para concluir o envio.
              </div>
            ) : null}

            <div className="rounded-xl border border-border/60 bg-background p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Prévia da mensagem</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{previewMessage}</p>
            </div>
          </div>

          <DialogFooter className="border-t border-border/60 bg-background px-6 py-4 sm:justify-between">
            <Button variant="outline" onClick={() => setConfirmSendOpen(false)}>
              Rever campanha
            </Button>
            <Button
              onClick={() => void handleSend()}
              disabled={sending || !canConfirmManualSend}
              className="bg-emerald-700 text-white hover:bg-emerald-800"
            >
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-4 w-4 text-emerald-700" />
                Campanhas recentes
              </CardTitle>
              <CardDescription>Histórico dos últimos disparos feitos pela central WhatsApp.</CardDescription>
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
                    placeholder="Pesquisar campanhas por título ou instância..."
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
                      ? "bg-emerald-600 text-white shadow-sm"
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
                        ? "bg-emerald-600 text-white shadow-sm"
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
                  <div key={campaign.id} className={`rounded-xl border bg-white transition-all ${isExpanded ? "border-emerald-500/30 shadow-sm" : "border-border/60 hover:border-border"}`}>
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{campaign.title || "Envio sem título"}</p>
                          <Badge variant="outline" className={statusTone(campaign.status)}>{campaign.status}</Badge>
                          {campaign.mediaUrl ? (
                            <Badge variant="outline" className="border-sky-500/25 bg-sky-500/10 text-sky-700">
                              <FileText className="mr-1 h-3 w-3" />
                              PDF
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-border bg-muted/30 text-muted-foreground">
                              Só texto
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatDateLabel(campaign.createdAt)}</span>
                          <span className="hidden sm:inline">·</span>
                          <span className="truncate">{campaign.instanceName}</span>
                          <span className="hidden sm:inline">·</span>
                          <span>{campaign.audienceType.replace(/_/g, " ").toLowerCase()}</span>
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
                  <Button className="w-full sm:w-auto" variant="outline" size="sm" disabled={campaignPage <= 0} onClick={() => void fetchCampaignPage(Math.max(0, campaignPage - 1))}>
                    Anterior
                  </Button>
                  <Button
                    className="w-full sm:w-auto"
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

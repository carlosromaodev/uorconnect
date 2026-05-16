import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Filter,
  Loader2,
  MessageCircle,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  UserCheck,
  UserMinus,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  type SmsAutomationSetting,
  type SmsCampaignFailuresPayload,
  type SmsAudienceInput,
  type SmsAudienceType,
  type SmsCampaignSummary,
  type SmsFilterOptionsPayload,
  type SmsOverviewPayload,
  type SmsRecipientPreviewPayload,
  type SmsSendResult,
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

type SmsPreviewRecipient = SmsRecipientPreviewPayload["recipients"][number];
type SmsProjectContext = Awaited<ReturnType<typeof api.submissions.listDetailedPaged>>["items"][number];
type AutomationEventKey = SmsAutomationSetting["eventKey"];
type AutomationZoneKey = "projects" | "announcements";

const defaultAudienceButtons: SmsFilterOptionsPayload["audienceButtons"] = [
  { type: "ALL_STUDENTS", label: "Todos os estudantes", total: 0, sendable: 0 },
  { type: "STUDENT_CLASS", label: "Turmas dos estudantes", total: 0, sendable: 0 },
  { type: "STUDENT_COURSE", label: "Cursos dos estudantes", total: 0, sendable: 0 },
  { type: "STUDENT_CLASS_OR_COURSE", label: "Turmas + cursos dos estudantes", total: 0, sendable: 0 },
  { type: "COURSE_ENROLLED", label: "Inscritos em cursos", total: 0, sendable: 0 },
  { type: "SUBMISSION_ENROLLED", label: "Candidatos com submissões", total: 0, sendable: 0 },
  { type: "COURSE_OR_SUBMISSION_ENROLLED", label: "Cursos + candidaturas", total: 0, sendable: 0 },
  { type: "EXHIBITORS", label: "Expositores", total: 0, sendable: 0 },
  { type: "GROUP_REPRESENTATIVES", label: "Representantes de grupo", total: 0, sendable: 0 },
  { type: "COURSE_OR_EXHIBITORS", label: "Cursos + expositores", total: 0, sendable: 0 },
  { type: "WINNERS", label: "Vencedores", total: 0, sendable: 0 },
  { type: "SELECTED_STUDENTS", label: "Selecionados manualmente", total: 0, sendable: 0 },
];

const emptySmsAutomations: SmsAutomationSetting[] = [];

const audienceHelpers: Record<SmsAudienceType, string> = {
  ALL_STUDENTS: "Envio para toda a base de estudantes com número válido.",
  STUDENT_CLASS: "Envio por turma académica usando o campo classCode.",
  STUDENT_COURSE: "Envio por curso académico dos estudantes.",
  STUDENT_CLASS_OR_COURSE: "Combina turma e curso, removendo duplicados automaticamente.",
  COURSE_ENROLLED: "Somente estudantes com inscrição em cursos.",
  SUBMISSION_ENROLLED: "Somente estudantes com candidatura submetida.",
  COURSE_OR_SUBMISSION_ENROLLED: "União entre inscritos e candidatos.",
  EXHIBITORS: "Somente estudantes ligados a submissões.",
  GROUP_REPRESENTATIVES: "Somente responsáveis/representantes principais de cada grupo ou projeto.",
  COURSE_OR_EXHIBITORS: "Inscritos em cursos e expositores.",
  WINNERS: "Somente candidaturas vencedoras.",
  SELECTED_STUDENTS: "Seleção manual por número de estudante ou telefone.",
};

const automationZoneOrder: AutomationZoneKey[] = ["projects", "announcements"];

const automationZoneMeta: Record<AutomationZoneKey, {
  label: string;
  description: string;
  icon: typeof FileText;
  tone: string;
}> = {
  projects: {
    label: "Projetos",
    description: "SMS automáticos para turma/curso quando uma candidatura gera audiência contextual.",
    icon: FileText,
    tone: "bg-orange-500/10 text-orange-700",
  },
  announcements: {
    label: "Avisos",
    description: "SMS automáticos para interações relevantes no Ao Vivo.",
    icon: MessageCircle,
    tone: "bg-violet-500/10 text-violet-700",
  },
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

const projectPlaceholderTokens = new Set(["{{titulo}}", "{{referencia}}", "{{link}}"]);
const projectPlaceholderPattern = /{{\s*(titulo|referencia|link)\s*}}/i;

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
  return type === "SUBMISSION_ENROLLED"
    || type === "COURSE_OR_SUBMISSION_ENROLLED"
    || type === "EXHIBITORS"
    || type === "GROUP_REPRESENTATIVES"
    || type === "COURSE_OR_EXHIBITORS";
}

function getAutomationZoneKey(eventKey: AutomationEventKey): AutomationZoneKey {
  return eventKey.startsWith("SUBMISSION_") ? "projects" : "announcements";
}

function ensureArray<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function buildAutomationDraftMap(automations?: SmsAutomationSetting[] | null) {
  return ensureArray(automations).reduce<Record<string, AutomationDraft>>((acc, item) => {
    acc[item.eventKey] = {
      enabled: item.enabled,
      title: item.title,
      message: item.message,
    };
    return acc;
  }, {});
}

function getRecipientDisplayName(recipient: SmsPreviewRecipient) {
  return recipient.name?.trim() || recipient.studentNumber || recipient.providerTo;
}

function buildRecipientSearchText(recipient: SmsPreviewRecipient) {
  return [
    recipient.name,
    recipient.studentNumber,
    recipient.course,
    recipient.classCode,
    recipient.phone,
    recipient.providerTo,
    ...recipient.sources,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getProjectOwnerLabel(project: SmsProjectContext) {
  const names = [
    project.leaderName,
    ...(project.membersList ?? []),
    ...(project.members ? project.members.split(/[\n,;]+/) : []),
  ]
    .map((name) => name?.trim())
    .filter((name): name is string => Boolean(name));
  const uniqueNames = Array.from(new Set(names));

  if (!uniqueNames.length) return "Responsável não informado";
  if (uniqueNames.length <= 2) return uniqueNames.join(" e ");
  return `${uniqueNames.slice(0, 2).join(", ")} +${uniqueNames.length - 2}`;
}

function buildProjectPublicUrl(project: SmsProjectContext) {
  if (project.detailPath?.startsWith("http")) return project.detailPath;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const path = project.detailPath || `/projetos/${project.slug || project.id}`;
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function applyProjectContextToText(text: string, project?: SmsProjectContext | null) {
  if (!project) return text;

  return text
    .replace(/{{\s*titulo\s*}}/gi, project.name)
    .replace(/{{\s*referencia\s*}}/gi, project.referenceCode)
    .replace(/{{\s*link\s*}}/gi, buildProjectPublicUrl(project));
}

function hasProjectPlaceholder(text: string) {
  return projectPlaceholderPattern.test(text);
}

function buildProjectCampaignTitle(project: SmsProjectContext) {
  return `${project.name} · ${getProjectOwnerLabel(project)}`;
}

function personalizeForPreview(
  message: string,
  recipient?: SmsPreviewRecipient | null,
  project?: SmsProjectContext | null,
) {
  const nome = recipient ? getRecipientDisplayName(recipient) : "Estudante";
  const numero = recipient?.studentNumber || (recipient ? recipient.providerTo : "00000000");
  const curso = recipient?.course || (recipient ? "Sem curso" : "Curso");
  const turma = recipient?.classCode || (recipient ? "Sem turma" : "Turma");
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

  return applyProjectContextToText(message, project)
    .replace(/{{\s*nome\s*}}/gi, nome)
    .replace(/{{\s*numero\s*}}/gi, numero)
    .replace(/{{\s*curso\s*}}/gi, curso)
    .replace(/{{\s*turma\s*}}/gi, turma)
    .replace(/{{\s*colega\s*}}/gi, "Colega")
    .replace(/{{\s*estado\s*}}/gi, "Aprovado")
    .replace(/{{\s*detalhe\s*}}/gi, "A equipa confirmou a tua atualização.")
    .replace(/{{\s*evento\s*}}/gi, "UOR Connect")
    .replace(/{{\s*certificado\s*}}/gi, "Certificado de Participação")
    .replace(/{{\s*validacao_url\s*}}/gi, `${origin}/validar/certificado`)
    .replace(/{{\s*pdf_url\s*}}/gi, `${origin}/certificates/pdf`);
}

function appendPlaceholderToken(currentValue: string, token: string) {
  if (!currentValue.trim()) return token;
  if (currentValue.endsWith("\n") || currentValue.endsWith(" ")) return `${currentValue}${token}`;
  if (/[.:]$/.test(currentValue.trimEnd())) return `${currentValue} ${token}`;
  return `${currentValue}\n${token}`;
}

const lookupTokenMap: Record<string, "colega" | "certificado" | "pdf_url" | "validacao_url"> = {
  "{{colega}}": "colega",
  "{{certificado}}": "certificado",
  "{{pdf_url}}": "pdf_url",
  "{{validacao_url}}": "validacao_url",
};

function PlaceholderSuggestionGrid({
  onSelect,
  onProjectLookup,
}: {
  onSelect: (token: string) => void;
  onProjectLookup?: (token: string) => void;
}) {
  const [lookupMode, setLookupMode] = useState<"colega" | "certificado" | "pdf_url" | "validacao_url" | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {placeholderSuggestions.map((item) => {
          const hasLookup = item.token in lookupTokenMap;
          const hasProjectLookup = projectPlaceholderTokens.has(item.token) && Boolean(onProjectLookup);

          return (
            <button
              key={item.token}
              type="button"
              onClick={() => {
                if (hasLookup) {
                  setLookupMode(lookupTokenMap[item.token]);
                } else if (hasProjectLookup) {
                  onProjectLookup?.(item.token);
                } else {
                  onSelect(item.token);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all hover:shadow-sm active:scale-[0.97] ${
                hasLookup
                  ? "border-violet-500/25 bg-violet-500/[0.06] text-violet-800 hover:border-violet-500/40 hover:bg-violet-500/[0.12]"
                  : hasProjectLookup
                    ? "border-amber-500/25 bg-amber-500/[0.08] text-amber-800 hover:border-amber-500/40 hover:bg-amber-500/[0.14]"
                  : "border-[#0A3D62]/20 bg-[#0A3D62]/[0.06] text-[#0A3D62] hover:border-[#0A3D62]/40 hover:bg-[#0A3D62]/[0.12]"
              }`}
              title={hasProjectLookup ? `${item.hint} — clica para escolher o projecto` : hasLookup ? `${item.hint} — clica para pesquisar` : item.hint}
            >
              <span className={`font-mono text-[10px] ${hasLookup ? "text-violet-600/70" : hasProjectLookup ? "text-amber-700/75" : "text-[#0A3D62]/70"}`}>{item.token}</span>
              <span>{item.label}</span>
              {hasLookup || hasProjectLookup ? <Search className="h-3 w-3 opacity-50" /> : null}
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

function ProjectLookupModal({
  open,
  selectedProjectId,
  onClose,
  onSelect,
}: {
  open: boolean;
  selectedProjectId?: number | null;
  onClose: () => void;
  onSelect: (project: SmsProjectContext) => void;
}) {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<SmsProjectContext[]>([]);

  const loadProjects = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const payload = await api.submissions.listDetailedPaged({
        page: 1,
        limit: 80,
        search: query.trim() || undefined,
        sort: "created_desc",
      });
      setProjects(payload.items);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setProjects([]);
      return;
    }

    const timer = setTimeout(() => {
      void loadProjects(search);
    }, 250);

    return () => clearTimeout(timer);
  }, [loadProjects, open, search]);

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 px-5 pb-4 pt-5">
          <DialogTitle className="text-base">Escolher projecto</DialogTitle>
          <DialogDescription>
            O título, a referência e o link do SMS passam a usar o projecto escolhido aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar por título, responsável, referência ou curso"
              className="pl-9"
              autoFocus
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="max-h-[420px] min-h-[180px] overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              A carregar projectos...
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum projecto encontrado.
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => {
                const selected = project.id === selectedProjectId;

                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      onSelect(project);
                      onClose();
                    }}
                    className={`flex w-full flex-col items-start rounded-xl border px-3 py-3 text-left transition-colors ${
                      selected
                        ? "border-[#0A3D62]/40 bg-[#0A3D62]/[0.07]"
                        : "border-border/70 bg-background hover:bg-muted/50"
                    }`}
                  >
                    <span className="flex w-full min-w-0 items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#0A3D62]" />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-semibold text-foreground">{project.name}</span>
                        <span className="mt-1 block break-words text-xs text-muted-foreground">
                          Responsável: {getProjectOwnerLabel(project)}
                        </span>
                      </span>
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5 pl-6">
                      <Badge variant="secondary" className="rounded-md px-1.5 text-[10px]">{project.referenceCode}</Badge>
                      <Badge variant="outline" className="rounded-md px-1.5 text-[10px]">{project.status}</Badge>
                      {project.course ? (
                        <Badge variant="outline" className="max-w-full rounded-md px-1.5 text-[10px]">
                          <span className="truncate">{project.course}</span>
                        </Badge>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border/60 px-5 py-3">
          <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
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

  const [automationDrafts, setAutomationDrafts] = useState<Record<string, AutomationDraft>>({});
  const [savingAutomationKey, setSavingAutomationKey] = useState<string | null>(null);
  const [savingAutomationZone, setSavingAutomationZone] = useState<AutomationZoneKey | null>(null);
  const [activeAutomationKey, setActiveAutomationKey] = useState<AutomationEventKey | null>(null);

  const [title, setTitle] = useState("");
  const [sender, setSender] = useState("UOR CONNECT");
  const [message, setMessage] = useState("Olá {{nome}}, temos uma atualização importante para ti.");
  const [selectedProjectContext, setSelectedProjectContext] = useState<SmsProjectContext | null>(null);
  const [projectLookupOpen, setProjectLookupOpen] = useState(false);
  const [pendingProjectToken, setPendingProjectToken] = useState<string | null>(null);
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
  const [recipientListSearch, setRecipientListSearch] = useState("");
  const [includeProviderTos, setIncludeProviderTos] = useState<string[]>([]);
  const [excludeProviderTos, setExcludeProviderTos] = useState<string[]>([]);
  const [focusedProviderTo, setFocusedProviderTo] = useState<string | null>(null);
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
  const automations = overview?.automations ?? emptySmsAutomations;
  const enabledAutomationCount = automations.filter((item) => automationDrafts[item.eventKey]?.enabled ?? item.enabled).length;
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
  const previewRecipients = previewPayload?.recipients ?? [];
  const includeProviderToSet = useMemo(() => new Set(includeProviderTos), [includeProviderTos]);
  const excludeProviderToSet = useMemo(() => new Set(excludeProviderTos), [excludeProviderTos]);
  const selectedPreviewRecipients = useMemo(() => previewRecipients.filter((recipient) => (
    (includeProviderToSet.size === 0 || includeProviderToSet.has(recipient.providerTo)) &&
    !excludeProviderToSet.has(recipient.providerTo)
  )), [excludeProviderToSet, includeProviderToSet, previewRecipients]);
  const activeRecipientTotal = previewPayload
    ? includeProviderToSet.size > 0
      ? selectedPreviewRecipients.length
      : Math.max(previewPayload.totalRecipients - excludeProviderToSet.size, 0)
    : includeProviderToSet.size > 0
      ? includeProviderToSet.size
      : null;
  const visiblePreviewRecipients = useMemo(() => {
    const query = recipientListSearch.trim().toLowerCase();
    if (!query) return previewRecipients;
    return previewRecipients.filter((recipient) => buildRecipientSearchText(recipient).includes(query));
  }, [previewRecipients, recipientListSearch]);
  const selectedContextRecipient = useMemo(() => {
    if (!previewRecipients.length) return null;

    if (focusedProviderTo) {
      const focused = selectedPreviewRecipients.find((recipient) => recipient.providerTo === focusedProviderTo);
      if (focused) return focused;
    }

    if (includeProviderToSet.size === 1) {
      const providerTo = Array.from(includeProviderToSet)[0];
      const selected = selectedPreviewRecipients.find((recipient) => recipient.providerTo === providerTo);
      if (selected) return selected;
    }

    if (activeRecipientTotal === 1 && selectedPreviewRecipients.length === 1) {
      return selectedPreviewRecipients[0];
    }

    return null;
  }, [activeRecipientTotal, focusedProviderTo, includeProviderToSet, previewRecipients, selectedPreviewRecipients]);
  const usesProjectPlaceholders = useMemo(() => hasProjectPlaceholder(`${title}\n${message}`), [message, title]);
  const resolvedCampaignTitle = useMemo(
    () => applyProjectContextToText(title.trim(), selectedProjectContext),
    [selectedProjectContext, title],
  );
  const resolvedCampaignMessage = useMemo(
    () => applyProjectContextToText(message, selectedProjectContext),
    [message, selectedProjectContext],
  );
  const previewMessage = useMemo(
    () => personalizeForPreview(message, selectedContextRecipient, selectedProjectContext),
    [message, selectedContextRecipient, selectedProjectContext],
  );
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

  const resetRecipientSelection = useCallback(() => {
    setRecipientListSearch("");
    setIncludeProviderTos([]);
    setExcludeProviderTos([]);
    setFocusedProviderTo(null);
  }, []);

  const resetAudienceValidation = useCallback(() => {
    setPreviewPayload(null);
    setSendResult(null);
    resetRecipientSelection();
  }, [resetRecipientSelection]);

  const buildAudiencePayload = (options: { withRecipientSelection?: boolean } = {}): SmsAudienceInput => {
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
    if (options.withRecipientSelection !== false) {
      if (includeProviderTos.length) payload.includeProviderTos = includeProviderTos;
      if (excludeProviderTos.length) payload.excludeProviderTos = excludeProviderTos;
    }

    return payload;
  };

  const fetchOverview = useCallback(async () => {
    const payload = await api.sms.overview();
    const normalizedPayload: SmsOverviewPayload = {
      ...payload,
      automations: ensureArray(payload.automations),
    };
    setOverview(normalizedPayload);
    setAutomationDrafts(buildAutomationDraftMap(normalizedPayload.automations));
    setSender((current) => current || normalizedPayload.integration.defaultSender || normalizedPayload.integration.approvedSenders[0] || "UOR CONNECT");
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

  useEffect(() => {
    if (!automations.length) {
      if (activeAutomationKey) setActiveAutomationKey(null);
      return;
    }

    if (!activeAutomationKey || !automations.some((automation) => automation.eventKey === activeAutomationKey)) {
      setActiveAutomationKey(automations[0].eventKey);
    }
  }, [activeAutomationKey, automations]);

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

        return api.sms.updateAutomation(automation.eventKey, draft);
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
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar a zona de SMS.");
    } finally {
      setSavingAutomationZone(null);
    }
  };

  const handleSaveAutomation = async (eventKey: AutomationEventKey) => {
    const draft = automationDrafts[eventKey];
    if (!draft) return;

    setSavingAutomationKey(eventKey);
    try {
      const updated = await api.sms.updateAutomation(eventKey, draft);
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
      toast.success("Automação SMS atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar a automação SMS.");
    } finally {
      setSavingAutomationKey(null);
    }
  };

  const handleToggleRecipientSelection = (recipient: SmsPreviewRecipient) => {
    setFocusedProviderTo(recipient.providerTo);

    if (includeProviderTos.length > 0) {
      setIncludeProviderTos((current) => {
        if (current.includes(recipient.providerTo)) {
          if (current.length === 1) {
            toast.warning("Mantém pelo menos um destinatário ou usa 'Usar todos'.");
            return current;
          }
          return current.filter((providerTo) => providerTo !== recipient.providerTo);
        }

        return Array.from(new Set([...current, recipient.providerTo]));
      });
      setExcludeProviderTos((current) => current.filter((providerTo) => providerTo !== recipient.providerTo));
      return;
    }

    setExcludeProviderTos((current) => current.includes(recipient.providerTo)
      ? current.filter((providerTo) => providerTo !== recipient.providerTo)
      : Array.from(new Set([...current, recipient.providerTo])));
  };

  const handleOnlyRecipient = (recipient: SmsPreviewRecipient) => {
    setIncludeProviderTos([recipient.providerTo]);
    setExcludeProviderTos([]);
    setFocusedProviderTo(recipient.providerTo);
  };

  const handleSelectVisibleRecipients = () => {
    const providerTos = visiblePreviewRecipients.map((recipient) => recipient.providerTo);
    if (!providerTos.length) {
      toast.error("Não há destinatários visíveis para selecionar.");
      return;
    }

    setIncludeProviderTos(Array.from(new Set(providerTos)));
    setExcludeProviderTos([]);
    setFocusedProviderTo(providerTos.length === 1 ? providerTos[0] : null);
    toast.success(`${providerTos.length} destinatário(s) visível(is) selecionado(s).`);
  };

  const handleRemoveVisibleRecipients = () => {
    const providerTos = visiblePreviewRecipients.map((recipient) => recipient.providerTo);
    if (!providerTos.length) {
      toast.error("Não há destinatários visíveis para remover.");
      return;
    }

    if (includeProviderTos.length > 0) {
      setIncludeProviderTos((current) => {
        const next = current.filter((providerTo) => !providerTos.includes(providerTo));
        if (!next.length) {
          toast.warning("A seleção ficaria vazia. Mantém pelo menos um destinatário.");
          return current;
        }
        return next;
      });
    } else {
      setExcludeProviderTos((current) => Array.from(new Set([...current, ...providerTos])));
    }

    if (focusedProviderTo && providerTos.includes(focusedProviderTo)) setFocusedProviderTo(null);
  };

  const openProjectLookup = (token?: string | null) => {
    setPendingProjectToken(token ?? null);
    setProjectLookupOpen(true);
  };

  const closeProjectLookup = () => {
    setProjectLookupOpen(false);
    setPendingProjectToken(null);
  };

  const handleSelectProjectContext = (project: SmsProjectContext) => {
    setSelectedProjectContext(project);
    setTitle((current) => current.trim() ? current : buildProjectCampaignTitle(project));

    if (pendingProjectToken) {
      setMessage((current) => appendPlaceholderToken(current, pendingProjectToken));
      setPendingProjectToken(null);
    }

    toast.success(`Projecto selecionado: ${project.name}`);
  };

  const handlePreview = async () => {
    const audience = buildAudiencePayload({ withRecipientSelection: false });
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
        limit: 300,
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

    if (usesProjectPlaceholders && !selectedProjectContext) {
      toast.error("Escolhe primeiro o projecto para resolver título, referência e link.");
      openProjectLookup();
      return;
    }

    const recipientCountLabel = typeof activeRecipientTotal === "number"
      ? ` para ${activeRecipientTotal} destinatário(s)`
      : " para a audiência selecionada";
    if (!window.confirm(`Confirmas o envio SMS${recipientCountLabel}?`)) return;

    setSending(true);
    setSendResult(null);
    try {
      const payload = await api.sms.sendCampaign({
        title: resolvedCampaignTitle || undefined,
        sender: sender.trim(),
        message: resolvedCampaignMessage,
        schedule: schedule.trim() || undefined,
        audience: buildAudiencePayload(),
        approvalToken: previewPayload?.approvalToken,
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
    resetRecipientSelection();
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
    resetRecipientSelection();
    setExpandedCampaignId(null);
    toast.success(`${failedPhones.length} telefone(s) preparados para reenvio com a mesma mensagem.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      <ProjectLookupModal
        open={projectLookupOpen}
        selectedProjectId={selectedProjectContext?.id}
        onClose={closeProjectLookup}
        onSelect={handleSelectProjectContext}
      />

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

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wifi className="h-4 w-4 text-[#0A3D62]" />
                Automações SMS
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Mensagens SMS disparadas automaticamente por eventos da plataforma.</p>
            </div>
            <Badge variant="outline" className="w-fit">
              {enabledAutomationCount}/{automations.length} ativas
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {automations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
              Ainda não há automações SMS configuradas.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-[#0A3D62]/20 bg-[linear-gradient(135deg,rgba(10,61,98,0.08),rgba(255,255,255,0.96))] p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Zonas com disparo automático</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Liga ou remove os envios automáticos por área. Para editar o texto, escolhe a opção no painel abaixo.
                    </p>
                  </div>
                  <span className="w-fit rounded-full border border-[#0A3D62]/20 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A3D62]">
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
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Escolhe uma opção para ver e editar a mensagem SMS.</p>
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
                                    ? "border-[#0A3D62]/35 bg-[#0A3D62]/[0.07] shadow-sm"
                                    : "border-transparent bg-muted/25 hover:border-border/70 hover:bg-white"
                                }`}
                              >
                                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${zone.tone} ${selected ? "ring-2 ring-[#0A3D62]/20" : ""}`}>
                                  <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-foreground">{automation.label}</span>
                                  <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className={`h-1.5 w-1.5 rounded-full ${draft.enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                                    {draft.enabled ? "Ativa" : "Pausada"}
                                  </span>
                                </span>
                                <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${selected ? "translate-x-0.5 text-[#0A3D62]" : "group-hover:translate-x-0.5"}`} />
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
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ring-black/5 ${activeAutomationZone?.tone ?? "bg-[#0A3D62]/10 text-[#0A3D62]"}`}>
                          <ActiveAutomationIcon className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                          <span className={`text-xs tabular-nums ${(activeAutomationDraft.message?.length ?? 0) > 160 ? "font-semibold text-amber-600" : "text-muted-foreground"}`}>
                            {activeAutomationDraft.message?.length ?? 0} / {Math.max(1, Math.ceil((activeAutomationDraft.message?.length ?? 0) / 160))} SMS
                          </span>
                        </div>
                        <Textarea
                          value={activeAutomationDraft.message}
                          onChange={(event) => handleAutomationDraftChange(activeAutomation.eventKey, { message: event.target.value })}
                          rows={7}
                          className="resize-none rounded-xl border-[#0A3D62]/15 bg-white text-[14px] leading-relaxed shadow-sm transition-colors focus:border-[#0A3D62]/40 focus:ring-[#0A3D62]/20"
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
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Título interno</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-lg px-2 text-xs"
                    onClick={() => openProjectLookup()}
                  >
                    <Search className="mr-1.5 h-3.5 w-3.5" />
                    Projecto
                  </Button>
                </div>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: {{titulo}} · responsáveis" />
              </div>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Remetente</span>
                <Input value={sender} onChange={(event) => setSender(event.target.value)} placeholder="UOR CONNECT" />
              </label>
            </div>

            {selectedProjectContext ? (
              <div className="rounded-2xl border border-[#0A3D62]/15 bg-[#0A3D62]/[0.04] p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0A3D62]/75">Projecto selecionado para o SMS</p>
                    <p className="mt-1 break-words text-sm font-semibold text-foreground">{selectedProjectContext.name}</p>
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      Responsável: {getProjectOwnerLabel(selectedProjectContext)} · {selectedProjectContext.referenceCode}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{buildProjectPublicUrl(selectedProjectContext)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => setTitle(buildProjectCampaignTitle(selectedProjectContext))}
                    >
                      Usar no título
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => openProjectLookup()}
                    >
                      Trocar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-muted-foreground"
                      onClick={() => setSelectedProjectContext(null)}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
              </div>
            ) : usesProjectPlaceholders ? (
              <button
                type="button"
                onClick={() => openProjectLookup()}
                className="flex w-full items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-left text-sm text-amber-900 transition-colors hover:bg-amber-500/[0.1]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Esta mensagem usa dados de projecto. Clica aqui para escolher manualmente o projecto certo antes de enviar.
                </span>
              </button>
            ) : null}

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
                    onClick={() => {
                      if (button.type === audienceType) return;
                      setAudienceType(button.type);
                      resetAudienceValidation();
                    }}
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
                      onClick={() => {
                        setSelectedStudentClassCodes((current) => current.includes(button.classCode)
                          ? current.filter((classCode) => classCode !== button.classCode)
                          : [...current, button.classCode]);
                        resetAudienceValidation();
                      }}
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
                      onClick={() => {
                        setSelectedStudentCourses((current) => current.includes(button.course)
                          ? current.filter((course) => course !== button.course)
                          : [...current, button.course]);
                        resetAudienceValidation();
                      }}
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
                        onChange={(event) => {
                          setSelectedCourseIds((current) => event.target.checked
                            ? [...current, course.id]
                            : current.filter((id) => id !== course.id));
                          resetAudienceValidation();
                        }}
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
                      onClick={() => {
                        setSelectedStatuses((current) => current.includes(status)
                          ? current.filter((item) => item !== status)
                          : [...current, status]);
                        resetAudienceValidation();
                      }}
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
                      onChange={(event) => {
                        setSelectedStudentNumbersText(event.target.value);
                        resetAudienceValidation();
                      }}
                      rows={4}
                      placeholder="20242099, 20242100"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Telefones</span>
                    <Textarea
                      value={selectedPhonesText}
                      onChange={(event) => {
                        setSelectedPhonesText(event.target.value);
                        resetAudienceValidation();
                      }}
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
                <span className={`text-xs tabular-nums ${resolvedCampaignMessage.length > 160 ? "font-semibold text-amber-600" : "text-muted-foreground"}`}>
                  {resolvedCampaignMessage.length} / {Math.max(1, Math.ceil(resolvedCampaignMessage.length / 160))} SMS
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
              <PlaceholderSuggestionGrid
                onSelect={(token) => setMessage((current) => appendPlaceholderToken(current, token))}
                onProjectLookup={(token) => openProjectLookup(token)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-[52px] items-center gap-3 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm">
                <Switch
                  checked={cookieMarketingOptIn}
                  onCheckedChange={(checked) => {
                    setCookieMarketingOptIn(checked);
                    resetAudienceValidation();
                  }}
                />
                <span className="leading-5">Exigir consentimento de marketing</span>
              </label>
              <label className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm">
                <Switch
                  checked={requireRecentActivity}
                  onCheckedChange={(checked) => {
                    setRequireRecentActivity(checked);
                    resetAudienceValidation();
                  }}
                />
                <span>Ativos nos últimos</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={activeWithinDays}
                  disabled={!requireRecentActivity}
                  onChange={(event) => {
                    setActiveWithinDays(Number(event.target.value) || 30);
                    resetAudienceValidation();
                  }}
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
              <span className="text-xs font-semibold uppercase text-muted-foreground">Pesquisar na audiência antes de validar</span>
              <Input
                value={previewSearch}
                onChange={(event) => {
                  setPreviewSearch(event.target.value);
                  setPreviewPayload(null);
                  resetRecipientSelection();
                }}
                placeholder="Nome, número ou curso"
              />
            </label>

            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Prévia da mensagem</p>
                {selectedContextRecipient ? (
                  <Badge variant="outline" className="border-[#0A3D62]/25 bg-[#0A3D62]/10 text-[#0A3D62]">
                    Focado em {getRecipientDisplayName(selectedContextRecipient)}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Exemplo geral</Badge>
                )}
              </div>
              {selectedContextRecipient ? (
                <div className="mt-3 rounded-lg border border-[#0A3D62]/15 bg-white px-3 py-2 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{getRecipientDisplayName(selectedContextRecipient)}</p>
                  <p>{selectedContextRecipient.phone} · {selectedContextRecipient.course || "Sem curso"} · {selectedContextRecipient.classCode || "Sem turma"}</p>
                </div>
              ) : null}
              {selectedProjectContext ? (
                <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-900">
                  <p className="font-medium text-foreground">{selectedProjectContext.name}</p>
                  <p>Responsável: {getProjectOwnerLabel(selectedProjectContext)} · {selectedProjectContext.referenceCode}</p>
                </div>
              ) : null}
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs uppercase text-muted-foreground">Filtrados</p>
                    <p className="mt-1 text-lg font-semibold">{previewPayload.filteredCandidates}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs uppercase text-muted-foreground">Válidos</p>
                    <p className="mt-1 text-lg font-semibold">{previewPayload.totalRecipients}</p>
                  </div>
                  <div className="rounded-xl border border-[#0A3D62]/20 bg-[#0A3D62]/[0.04] p-3">
                    <p className="text-xs uppercase text-[#0A3D62]/75">Selecionados</p>
                    <p className="mt-1 text-lg font-semibold text-[#0A3D62]">{activeRecipientTotal ?? previewPayload.totalRecipients}</p>
                  </div>
                  <div className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs uppercase text-muted-foreground">Ignorados</p>
                    <p className="mt-1 text-lg font-semibold">{previewPayload.skippedCount}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Destinatários carregados</p>
                        <p className="text-xs text-muted-foreground">
                          {previewRecipients.length} visível(is)
                          {previewPayload.totalRecipients > previewRecipients.length
                            ? ` de ${previewPayload.totalRecipients} válido(s)`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={resetRecipientSelection}>
                          Usar todos
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={handleSelectVisibleRecipients}>
                          <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                          Só visíveis
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={handleRemoveVisibleRecipients}>
                          <UserMinus className="mr-1.5 h-3.5 w-3.5" />
                          Remover visíveis
                        </Button>
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={recipientListSearch}
                        onChange={(event) => setRecipientListSearch(event.target.value)}
                        placeholder="Filtrar lista validada por nome, número, curso ou telefone"
                        className="pl-9"
                      />
                    </div>

                    {(includeProviderTos.length > 0 || excludeProviderTos.length > 0) ? (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {includeProviderTos.length > 0 ? (
                          <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-700">
                            Seleção fixa: {includeProviderTos.length}
                          </Badge>
                        ) : null}
                        {excludeProviderTos.length > 0 ? (
                          <Badge variant="outline" className="border-rose-500/25 bg-rose-500/10 text-rose-700">
                            Removidos: {excludeProviderTos.length}
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {visiblePreviewRecipients.length ? visiblePreviewRecipients.map((recipient) => {
                        const checked = includeProviderToSet.size > 0
                          ? includeProviderToSet.has(recipient.providerTo)
                          : !excludeProviderToSet.has(recipient.providerTo);
                        const focused = selectedContextRecipient?.providerTo === recipient.providerTo;

                        return (
                          <div
                            key={`${recipient.providerTo}-${recipient.studentNumber ?? "manual"}`}
                            className={`rounded-lg border px-3 py-2 transition-colors ${
                              checked
                                ? focused
                                  ? "border-[#0A3D62]/35 bg-[#0A3D62]/[0.06]"
                                  : "border-border/60 bg-white"
                                : "border-rose-500/20 bg-rose-500/[0.04] opacity-75"
                            }`}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <label className="flex min-w-0 flex-1 items-start gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleRecipientSelection(recipient)}
                                  className="mt-1"
                                  aria-label={`Selecionar ${getRecipientDisplayName(recipient)}`}
                                />
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-foreground">{getRecipientDisplayName(recipient)}</span>
                                  <span className="block text-xs text-muted-foreground">
                                    {recipient.phone} · {recipient.course || "Sem curso"} · {recipient.classCode || "Sem turma"}
                                  </span>
                                  <span className="mt-1 flex flex-wrap gap-1">
                                    {recipient.studentNumber ? (
                                      <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-[10px]">{recipient.studentNumber}</Badge>
                                    ) : null}
                                    {recipient.sources.slice(0, 2).map((source) => (
                                      <Badge key={source} variant="outline" className="h-5 rounded-md px-1.5 text-[10px]">{source}</Badge>
                                    ))}
                                  </span>
                                </span>
                              </label>
                              <div className="flex shrink-0 flex-wrap gap-1.5">
                                <Button
                                  type="button"
                                  variant={focused ? "default" : "outline"}
                                  size="sm"
                                  className="h-8 rounded-lg px-2 text-xs"
                                  onClick={() => setFocusedProviderTo(recipient.providerTo)}
                                >
                                  Focar
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg px-2 text-xs"
                                  onClick={() => handleOnlyRecipient(recipient)}
                                >
                                  Só este
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
                          Nenhum destinatário encontrado nesta lista validada.
                        </div>
                      )}
                    </div>
                  </div>
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

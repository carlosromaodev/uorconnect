import {
  type ReactNode,
  type TouchEvent,
  type WheelEvent,
  Suspense,
  lazy,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  Copy,
  Cookie,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Download,
  Edit,
  Eye,
  ExternalLink,
  FileText,
  FolderOpen,
  GraduationCap,
  History,
  HelpCircle,
  KeyRound,
  IdCard,
  Palette,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquare,
  Mic,
  Package,
  ImagePlus,
  Pin,
  Megaphone,
  EyeOff,
  Power,
  PowerOff,
  QrCode,
  Radio,
  RefreshCw,
  Route,
  Search,
  Send,
  Settings,
  Shield,
  Wallet,
  ThumbsUp,
  Trash2,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
  X,
  Menu,
  Zap,
  LogOut,
} from "lucide-react";
import {
  Heart as PhHeart,
  ChatTeardrop as PhChatTeardrop,
  Trophy as PhTrophy,
  UsersThree as PhUsers,
  Clock as PhClock,
} from "@/icons/phosphor";
import { toast } from "@/components/ui/sonner";
import { Link } from "react-router-dom";
import PhosphorIcon from "@/lib/icons/phosphor-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AdminBulkSmsAction } from "@/components/admin/AdminBulkSmsAction";
import { CourseCertificateAction } from "@/components/admin/CourseCertificateAction";
import { ContextualSmsAction } from "@/components/admin/ContextualSmsAction";
import { defaultHomeSocialConfig } from "@/lib/home-content";
import {
  type AdminAuthorizedStudent,
  type AdminAccessConflict,
  type AdminAccessProfile,
  type AnalyticsDashboard,
  type AnalyticsEventsPayload,
  type AnalyticsFilterInput,
  type AdminModerationLiveChatMessage,
  type AdminModerationProjectComment,
  api,
  type AgendaLiveConfigInput,
  type AgendaInput,
  type AgendaItem,
  type AgendaLiveState,
  type Course,
  type CourseEnrollmentInput,
  type CourseEnrollmentsPagedPayload,
  type CourseInput,
  type DigitalPassportAdminOverview,
  type ExhibitorScoreAdjustmentAction,
  type ExhibitorPdfRecipient,
  type FaqInput,
  type FaqItem,
  type GuideContent,
  type HomeSocialConfig,
  type HomeSocialConfigInput,
  type GuideStepInput,
  type GuideTipInput,
  type PanelTopic,
  type PanelTopicInput,
  type PaymentStatus,
  type PdfJobStatus,
  type Speaker,
  type SpeakerInput,
  type SubmissionConfig,
  type SubmissionTeamMember,
  type StudentWithStats,
  type StudentProfile,
  type StudentPagedFacets,
  type StudentPagedStats,
  type VenueInput,
  getToken,
  isAuthError,
  isForbiddenError,
  setToken,
} from "@/lib/api";
import {
  readCompressedImageFileAsDataUrl,
  readImageFileAsDataUrl,
} from "@/lib/project-media";
import {
  buildProjectObligationMessage,
  getProjectObligationNoticeTargets,
  projectObligationChannelOptions,
  projectObligationChannelUsesSms,
  projectObligationChannelUsesWhatsApp,
  projectObligationNoticeCampaignTitle,
  projectObligationNoticeOptions,
  uniqueProjectObligationPhones,
  type ProjectObligationNoticeChannel,
  type ProjectObligationNoticeType,
} from "./project-obligation-notices";
import { createQrDataUrl } from "@/lib/qr";
import { resolveAbsoluteApiUrl } from "@/lib/runtime-config";
import { downloadBlobFile } from "@/lib/student-documents";

const EventoTab = lazy(() =>
  import("@/components/admin/EventoTab").then((module) => ({
    default: module.EventoTab,
  })),
);
const AdminOverviewTab = lazy(() =>
  import("@/components/admin/AdminOverviewTab").then((module) => ({
    default: module.AdminOverviewTab,
  })),
);
const AdminAnalyticsTab = lazy(() =>
  import("@/components/admin/AdminAnalyticsTab").then((module) => ({
    default: module.AdminAnalyticsTab,
  })),
);
const AdminSmsTab = lazy(() =>
  import("@/components/admin/AdminSmsTab").then((module) => ({
    default: module.AdminSmsTab,
  })),
);
const AdminWhatsAppTab = lazy(() =>
  import("@/components/admin/AdminWhatsAppTab").then((module) => ({
    default: module.AdminWhatsAppTab,
  })),
);
const AdminJuryTab = lazy(() =>
  import("@/components/admin/AdminJuryTab").then((module) => ({
    default: module.AdminJuryTab,
  })),
);
const AdminTasksTab = lazy(() => import("@/components/admin/AdminTasksTab"));
const AdminAttendanceTab = lazy(
  () => import("@/components/admin/AdminAttendanceTab"),
);
const AdminPassportTab = lazy(
  () => import("@/components/admin/AdminPassportTab"),
);
const AdminCertificatesTab = lazy(
  () => import("@/components/admin/AdminCertificatesTab"),
);
const AdminAuditTab = lazy(() => import("@/components/admin/AdminAuditTab"));
const AdminSecurityTab = lazy(
  () => import("@/components/admin/AdminSecurityTab"),
);
const AdminOdinTab = lazy(
  () => import("@/components/admin/AdminOdinTab"),
);
const AdminStudentsTab = lazy(
  () => import("@/components/admin/AdminStudentsTab"),
);
const AdminWinnersTab = lazy(
  () => import("@/components/admin/AdminWinnersTab"),
);
const AdminTrainersTab = lazy(
  () => import("@/components/admin/AdminTrainersTab"),
);

const tabs = [
  {
    id: "overview",
    label: "Visão Geral",
    icon: BarChart3,
    permission: "OVERVIEW",
  },
  {
    id: "analytics",
    label: "Cookies & Analytics",
    icon: Cookie,
    permission: "ANALYTICS",
  },
  { id: "tasks", label: "Tarefas", icon: FileText, permission: "TASKS" },
  { id: "sms", label: "SMS", icon: MessageSquare, permission: "SMS" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, permission: "SMS" },
  { id: "jury", label: "Júri", icon: KeyRound, permission: "JURY" },
  {
    id: "attendance",
    label: "Check-in",
    icon: ClipboardCheck,
    permission: "ATTENDANCE",
  },
  {
    id: "passport",
    label: "Passaporte",
    icon: Route,
    permission: "ATTENDANCE",
  },
  {
    id: "certificates",
    label: "Certificados",
    icon: Award,
    permission: "CERTIFICATES",
  },
  { id: "audit", label: "Auditoria", icon: History, permission: "AUDIT" },
  { id: "nucleus", label: "Núcleo", icon: Users, permission: "NUCLEUS" },
  {
    id: "credentials",
    label: "Credenciais",
    icon: IdCard,
    permission: "CREDENTIALS",
  },
  {
    id: "submissions",
    label: "Candidaturas",
    icon: FolderOpen,
    permission: "SUBMISSIONS",
  },
  { id: "speakers", label: "Palestrantes", icon: Mic, permission: "SPEAKERS" },
  { id: "trainers", label: "Formadores", icon: UserCheck, permission: "SPEAKERS" },
  {
    id: "schedule",
    label: "Agenda",
    icon: CalendarDays,
    permission: "SCHEDULE",
  },
  { id: "guide", label: "Guia", icon: BookOpen, permission: "GUIDE" },
  {
    id: "courses",
    label: "Cursos",
    icon: GraduationCap,
    permission: "COURSES",
  },
  { id: "panels", label: "Painéis", icon: Zap, permission: "PANELS" },
  { id: "evento", label: "Evento", icon: Palette, permission: "EVENTO" },
  { id: "faq", label: "FAQ", icon: HelpCircle, permission: "FAQ" },
  { id: "live", label: "Ao Vivo", icon: Radio, permission: "LIVE" },
  { id: "votes", label: "Votações", icon: ThumbsUp, permission: "VOTES" },
  { id: "security", label: "Segurança", icon: Shield, permission: "SECURITY" },
  { id: "odin", label: "ODIN", icon: Shield, permission: "SECURITY" },
  { id: "students", label: "Estudantes", icon: Users, permission: "STUDENTS" },
  { id: "winners", label: "Vencedores", icon: Trophy, permission: "WINNERS" },
] as const;

type TabId = (typeof tabs)[number]["id"];
type AdminPermission = (typeof tabs)[number]["permission"];
const credentialSubpages = [
  { id: "overview", label: "Painel", icon: BarChart3 },
  { id: "links", label: "Criar links", icon: UserPlus },
  { id: "members", label: "Membros", icon: Users },
  { id: "bulk-issue", label: "Emissão em lote", icon: IdCard },
  { id: "printing", label: "Impressão", icon: Download },
  { id: "templates", label: "Templates", icon: Palette },
  { id: "pending", label: "Pendentes", icon: AlertTriangle },
] as const;
type CredentialAdminSubpage = (typeof credentialSubpages)[number]["id"];
const submissionSubpages = [
  { id: "overview", label: "Gestão", icon: ClipboardCheck },
  { id: "projects", label: "Projetos e obrigações", icon: FolderOpen },
] as const;
type SubmissionAdminSubpage = (typeof submissionSubpages)[number]["id"];
type AdminDataSection =
  | "base"
  | "students"
  | "speakers"
  | "agenda"
  | "liveConfig"
  | "moderation"
  | "faq"
  | "guide"
  | "courses"
  | "homeContent"
  | "security";

const defaultLoadedSections: Record<AdminDataSection, boolean> = {
  base: false,
  students: false,
  speakers: false,
  agenda: false,
  liveConfig: false,
  moderation: false,
  faq: false,
  guide: false,
  courses: false,
  homeContent: false,
  security: false,
};

type AdminAccessForm = {
  team: string;
  role: "SUPER_ADMIN" | "TEAM_LEAD" | "MEMBER";
  permissions: AdminPermission[];
};

const defaultAdminAccessForm: AdminAccessForm = {
  team: "Geral",
  role: "TEAM_LEAD",
  permissions: ["OVERVIEW"],
};

const resetVotesPhrase = "REMOVER VOTOS";

type AdminSubmission = {
  id: number;
  slug: string;
  detailPath: string;
  referenceCode: string;
  nome: string;
  descricao: string;
  tipo: "projeto" | "negocio" | "produto";
  area: string;
  curso: string;
  equipa: string;
  responsavel: string;
  telefone: string;
  necessidades: string[];
  observacoes: string;
  status: "pendente" | "aprovado" | "recusado";
  data: string;
  primaryColor: string;
  secondaryColor: string;
  bannerUrl: string | null;
  projectFrozen: boolean;
  projectFrozenAt: string | null;
  projectFrozenByStudentNumber: string | null;
  projectFreezeReason: string | null;
  isWinner: boolean;
  canVote: boolean;
  paymentStatus: PaymentStatus | string;
  paymentStatusLabel: string;
  paymentSubmittedAt: string | null;
  paymentReviewedAt: string | null;
  paymentReviewedByStudentNumber: string | null;
  paymentReviewNote: string | null;
  teamInviteUrl: string | null;
  teamJourneyLabel: string;
  teamTotalMembers: number;
  teamConfirmedMembers: number;
  teamAllConfirmed: boolean;
  teamMembers: SubmissionTeamMember[];
  exhibitorChallengeStatus:
    | "MISSING"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "PAUSED";
  exhibitorChallengeQuestion: string | null;
  exhibitorChallengeAnswersCount: number;
  exhibitorChallengeUpdatedAt: string | null;
};

type ProjectObligationNoticeResult = {
  processedProjects: number;
  skippedProjects: number;
  totalRecipients: number;
  successCount: number;
  failedCount: number;
  failures: string[];
};

type VoteProjectSummary = {
  id: number;
  nome: string;
  detailPath: string;
  equipa: string;
  tipo: "projeto" | "negocio" | "produto";
  votos: number;
  pontos: number;
  rating: number;
  comentarios: number;
  pageViews: number;
  uniqueVisitors: number;
  authenticatedVisitors: number;
  status: "pendente" | "aprovado" | "recusado";
  isWinner: boolean;
  projectFrozen: boolean;
  projectFrozenAt: string | null;
  projectFreezeReason: string | null;
};

type VoteEntry = {
  id: number;
  studentId: number;
  studentNumber: string;
  estudante: string;
  email: string;
  curso: string;
  submissionId: number;
  projeto: string;
  data: string;
};

type VoteCourseSummary = {
  course: string;
  votes: number;
  students: number;
  recentVotes: number;
  lastVoteAt: string | null;
};

function normalizeStudentNumberInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function whatsappLink(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function submissionPaymentProofUrl(submissionId: number) {
  return resolveAbsoluteApiUrl(`/submissions/${submissionId}/payment-proof`);
}

const EXHIBITOR_QR_SOURCE_QUERY = "source=exhibitor_qr";

function buildAdminExhibitorVoteUrl(detailPath: string) {
  const fallback = `${detailPath}${detailPath.includes("?") ? "&" : "?"}vote=1&${EXHIBITOR_QR_SOURCE_QUERY}`;
  if (typeof window === "undefined") return fallback;
  try {
    const url = new URL(detailPath, window.location.origin);
    url.searchParams.set("vote", "1");
    const [sourceKey, sourceValue] = EXHIBITOR_QR_SOURCE_QUERY.split("=");
    url.searchParams.set(sourceKey, sourceValue);
    return url.toString();
  } catch {
    return fallback;
  }
}

function normalizeTeamMemberDraftKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseTeamMembersDraft(value: string) {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function getAdminSubmissionTeamMemberNames(submission: AdminSubmission) {
  const structuredNames = submission.teamMembers
    .map((member) => member.name.trim())
    .filter(Boolean);

  if (structuredNames.length > 0) return structuredNames;
  return parseTeamMembersDraft(submission.equipa);
}

function SubmissionPdfShareAction({
  submission,
}: {
  submission: AdminSubmission;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"SMS" | "WHATSAPP" | "BOTH">("BOTH");
  const [pdfUrl, setPdfUrl] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState<ExhibitorPdfRecipient[]>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>(
    [],
  );
  const [loadingLink, setLoadingLink] = useState(false);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);

  const canSend =
    submission.status === "aprovado" &&
    isPaymentStatusConfirmed(submission.paymentStatus);
  const selectedRecipients = useMemo(
    () =>
      recipients.filter(
        (recipient) =>
          selectedRecipientIds.includes(recipient.id) && recipient.phone,
      ),
    [recipients, selectedRecipientIds],
  );
  const selectedPhones = useMemo(
    () =>
      Array.from(
        new Set(
          selectedRecipients
            .map((recipient) => recipient.phone)
            .filter(Boolean) as string[],
        ),
      ),
    [selectedRecipients],
  );
  const availableRecipientIds = useMemo(
    () =>
      recipients
        .filter((recipient) => recipient.phone)
        .map((recipient) => recipient.id),
    [recipients],
  );

  const buildMessage = (link: string) =>
    [
      `Olá, a candidatura "${submission.nome}" foi aprovada no UOR Connect.`,
      "O PDF oficial do expositor já está disponível para impressão e uso no evento.",
      `PDF: ${link}`,
    ].join("\n");

  const chooseDefaultRecipients = (items: ExhibitorPdfRecipient[]) => {
    const leader = items.find(
      (item) => item.role === "RESPONSAVEL" && item.phone,
    );
    if (leader) return [leader.id];
    return items.filter((item) => item.phone).map((item) => item.id);
  };

  const loadShareData = async () => {
    if (!canSend) return;
    setLoadingLink(true);
    setLoadingRecipients(true);
    try {
      const [payload, recipientsPayload] = await Promise.all([
        api.submissions.exhibitorPdfLink(submission.id),
        api.submissions.exhibitorPdfRecipients(submission.id),
      ]);
      if (!payload.publicUrl) {
        throw new Error(
          "O PDF foi gerado, mas não há URL pública configurada.",
        );
      }
      setPdfUrl(payload.publicUrl);
      setRecipients(recipientsPayload.recipients);
      setSelectedRecipientIds(
        chooseDefaultRecipients(recipientsPayload.recipients),
      );
      setMessage((current) =>
        current.trim() ? current : buildMessage(payload.publicUrl!),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao preparar o link do PDF.",
      );
      setOpen(false);
    } finally {
      setLoadingLink(false);
      setLoadingRecipients(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !loadingLink && !loadingRecipients) {
      void loadShareData();
    }
  };

  const handleCopy = async () => {
    if (!pdfUrl) return;
    try {
      await navigator.clipboard.writeText(pdfUrl);
      toast.success("Link do PDF copiado.");
    } catch {
      toast.info(pdfUrl);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Escreve a mensagem antes de enviar.");
      return;
    }
    if (selectedPhones.length === 0) {
      toast.error("Seleciona pelo menos um destinatário com telefone.");
      return;
    }

    setSending(true);
    try {
      const audience = {
        type: "SELECTED_STUDENTS" as const,
        selectedPhones,
      };
      const results: string[] = [];

      if (channel === "SMS" || channel === "BOTH") {
        const payload = await api.sms.sendCampaign({
          title: `PDF expositor · ${submission.referenceCode}`,
          sender: "UOR CONNECT",
          message,
          audience,
        });
        results.push(`SMS ${payload.successCount}/${payload.totalRecipients}`);
      }

      if (channel === "WHATSAPP" || channel === "BOTH") {
        const payload = await api.whatsapp.sendCampaign({
          title: `PDF expositor · ${submission.referenceCode}`,
          message,
          audience,
        });
        results.push(
          `WhatsApp ${payload.successCount}/${payload.totalRecipients}`,
        );
      }

      toast.success(`Envio do PDF processado. ${results.join(" · ")}`);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao enviar link do PDF.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight"
          disabled={!canSend}
        >
          <FileText className="mr-1 h-3.5 w-3.5" />
          PDF por SMS/WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 px-5 pb-4 pt-5">
          <DialogTitle>Enviar PDF oficial do expositor</DialogTitle>
          <DialogDescription>
            Escolhe o responsável e/ou membros confirmados da equipa para
            receberem o link seguro do PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(100dvh-13rem)] space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid min-w-0 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Expositor
              </p>
              <p className="mt-1 break-words text-sm font-medium">
                {submission.responsavel}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Telefone
              </p>
              <p className="mt-1 break-words text-sm font-medium">
                {submission.telefone || "Sem número"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Projeto
              </p>
              <p className="mt-1 break-words text-sm font-medium">
                {submission.nome}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary">
                  Link do PDF
                </p>
                <p className="mt-1 break-all text-sm text-muted-foreground sm:truncate">
                  {loadingLink ? "A preparar..." : pdfUrl || "Indisponível"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full shrink-0 rounded-xl sm:w-auto"
                onClick={() => void handleCopy()}
                disabled={!pdfUrl}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copiar
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Destinatários
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {loadingRecipients
                    ? "A carregar equipa confirmada..."
                    : `${selectedPhones.length} selecionado(s) · ${availableRecipientIds.length} com telefone`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs"
                  onClick={() => setSelectedRecipientIds(availableRecipientIds)}
                  disabled={
                    loadingRecipients || availableRecipientIds.length === 0
                  }
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs"
                  onClick={() => setSelectedRecipientIds([])}
                  disabled={
                    loadingRecipients || selectedRecipientIds.length === 0
                  }
                >
                  Limpar
                </Button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {loadingRecipients ? (
                <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />A preparar lista
                  de envio...
                </div>
              ) : recipients.length ? (
                recipients.map((recipient) => {
                  const checked = selectedRecipientIds.includes(recipient.id);
                  const disabled = !recipient.phone;
                  return (
                    <label
                      key={recipient.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${checked ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background"} ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/30"}`}
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={(value) => {
                          setSelectedRecipientIds((current) =>
                            value === true
                              ? Array.from(new Set([...current, recipient.id]))
                              : current.filter((id) => id !== recipient.id),
                          );
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="break-words text-sm font-medium">
                            {recipient.name}
                          </p>
                          <Badge
                            variant={
                              recipient.role === "RESPONSAVEL"
                                ? "default"
                                : "secondary"
                            }
                            className="rounded-full text-[10px]"
                          >
                            {recipient.role === "RESPONSAVEL"
                              ? "Responsável"
                              : "Membro"}
                          </Badge>
                        </div>
                        <p className="mt-1 break-words text-xs text-muted-foreground">
                          {recipient.phone || "Sem telefone registado"}
                          {recipient.studentNumber
                            ? ` · ${recipient.studentNumber}`
                            : ""}
                        </p>
                      </div>
                    </label>
                  );
                })
              ) : (
                <p className="rounded-xl border border-border/60 bg-background px-3 py-3 text-sm text-muted-foreground">
                  Nenhum destinatário com participação confirmada encontrado.
                </p>
              )}
            </div>
          </div>

          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-32 w-full max-w-full resize-none"
          />

          <div className="grid min-w-0 gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-3">
            {(
              [
                { id: "SMS", label: "SMS", icon: MessageSquare },
                { id: "WHATSAPP", label: "WhatsApp", icon: MessageCircle },
                { id: "BOTH", label: "Ambos", icon: Send },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant={channel === item.id ? "default" : "outline"}
                  className="min-w-0 justify-start rounded-xl"
                  onClick={() => setChannel(item.id)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="border-t border-border/60 px-5 py-4 sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSend()}
            disabled={
              sending ||
              loadingLink ||
              loadingRecipients ||
              !pdfUrl ||
              selectedPhones.length === 0
            }
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function liveChatAttachmentSrc(url?: string | null) {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : resolveAbsoluteApiUrl(url);
}

function adminMediaSrc(url?: string | null) {
  if (!url) return "";
  return /^data:|^blob:|^https?:\/\//i.test(url)
    ? url
    : resolveAbsoluteApiUrl(url);
}

function adminDocumentHref(url?: string | null) {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : resolveAbsoluteApiUrl(url);
}

function downloadBlob(blob: Blob, fileName: string) {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
}

async function waitForPdfJobReady(
  fetchStatus: () => Promise<PdfJobStatus>,
  options: { timeoutMs?: number; intervalMs?: number } = {},
) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const intervalMs = options.intervalMs ?? 1_200;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await fetchStatus();

    if (status.status === "completed") {
      return status;
    }

    if (status.status === "failed") {
      throw new Error(status.error || "A geração do PDF falhou.");
    }

    await new Promise((resolve) => globalThis.setTimeout(resolve, intervalMs));
  }

  throw new Error("O servidor demorou demasiado a gerar o PDF.");
}

const defaultSpeakerForm: SpeakerInput = {
  name: "",
  bio: "",
  specialty: "",
  talk: "",
  day: "",
  linkedin: "",
  avatarUrl: "",
};

const defaultScheduleForm: AgendaInput = {
  day: "DAY1",
  date: "",
  startTime: "",
  endTime: "",
  title: "",
  local: "",
  speaker: "",
  description: "",
  type: "PANEL",
  theme: "",
};

const defaultLiveConfigForm: AgendaLiveConfigInput = {
  mode: "AGENDA",
  current: {
    day: "DAY1",
    date: "",
    startTime: "",
    endTime: "",
    title: "",
    local: "",
    speaker: "",
    description: "",
    type: "PANEL",
    theme: "",
  },
};

function isGeneralAgendaTheme(theme: string | null | undefined) {
  return theme?.trim().toLocaleLowerCase("pt-PT") === "geral";
}

const defaultFaqForm: FaqInput = {
  question: "",
  answer: "",
  sortOrder: 0,
  isPublished: true,
};

const defaultGuideStepForm: GuideStepInput = {
  title: "",
  description: "",
  link: "",
  linkText: "",
  icon: "BookOpen",
  sortOrder: 0,
  isPublished: true,
};

const defaultGuideTipForm: GuideTipInput = {
  content: "",
  sortOrder: 0,
  isPublished: true,
};

function AdminPanelFallback({ label }: { label: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex min-h-[220px] items-center justify-center p-8 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            A carregar módulo
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            A preparar a área de {label.toLowerCase()} do painel administrativo.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const defaultVenueForm: VenueInput = {
  name: "",
  description: "",
  capacity: "",
  floor: "",
  sortOrder: 0,
  isPublished: true,
};

const defaultCourseForm: CourseInput = {
  name: "",
  description: "",
  preview: "",
  communityUrl: "",
  companyName: "",
  companyCategory: "",
  companyLogoUrl: "",
  companyWebsite: "",
  companyInstagram: "",
  companyLinkedin: "",
  isPaid: false,
  priceLabel: "Gratuito",
  accentColor: "#f97316",
  accentColorSecondary: "#fb923c",
  courseColor: "#2563eb",
  sortOrder: 0,
  isPublished: true,
};

const defaultCourseEnrollmentForm: CourseEnrollmentInput = {
  studentNumber: "",
  fullName: "",
  studentCourse: "",
  phone: "",
  paymentPhone: "",
  paymentStatus: "CONFIRMED_BY_ADMIN",
  note: "",
};

const defaultPanelTopicForm: PanelTopicInput = {
  title: "",
  description: "",
  speaker: "",
  time: "",
  local: "",
  day: "",
  dateLabel: "",
  icon: "Mic",
  type: "Painel",
  sortOrder: 0,
  isPublished: true,
};

const defaultSocialConfigForm: HomeSocialConfigInput = {
  instagramUrl: defaultHomeSocialConfig.instagramUrl,
  facebookUrl: defaultHomeSocialConfig.facebookUrl,
  linkedinUrl: defaultHomeSocialConfig.linkedinUrl,
  courseEnrollmentEnabled: defaultHomeSocialConfig.courseEnrollmentEnabled,
  firstYearContestEnabled: defaultHomeSocialConfig.firstYearContestEnabled,
  primaryColor: defaultHomeSocialConfig.primaryColor,
  primaryGradient: defaultHomeSocialConfig.primaryGradient,
  titleColor: defaultHomeSocialConfig.titleColor,
  accentColor: defaultHomeSocialConfig.accentColor,
  dashedColor: defaultHomeSocialConfig.dashedColor,
  dashedOpacity: defaultHomeSocialConfig.dashedOpacity,
  heroIconsOpacity: defaultHomeSocialConfig.heroIconsOpacity,
  heroBlobsIntensity: defaultHomeSocialConfig.heroBlobsIntensity,
  heroMeshEnabled: defaultHomeSocialConfig.heroMeshEnabled,
  heroFloatingIcons: defaultHomeSocialConfig.heroFloatingIcons,
  sponsors: defaultHomeSocialConfig.sponsors,
};

function toSocialConfigForm(config: HomeSocialConfig): HomeSocialConfigInput {
  return {
    instagramUrl: config.instagramUrl ?? null,
    facebookUrl: config.facebookUrl ?? null,
    linkedinUrl: config.linkedinUrl ?? null,
    courseEnrollmentEnabled: config.courseEnrollmentEnabled,
    firstYearContestEnabled: config.firstYearContestEnabled,
    primaryColor: config.primaryColor,
    primaryGradient: config.primaryGradient,
    titleColor: config.titleColor,
    accentColor: config.accentColor,
    dashedColor: config.dashedColor,
    dashedOpacity: config.dashedOpacity,
    heroIconsOpacity: config.heroIconsOpacity,
    heroBlobsIntensity: config.heroBlobsIntensity,
    heroMeshEnabled: config.heroMeshEnabled,
    heroFloatingIcons: config.heroFloatingIcons,
    sponsors: config.sponsors,
  };
}

const defaultSubmissionConfigForm: Omit<
  SubmissionConfig,
  "key" | "createdAt" | "updatedAt"
> = {
  isOpen: true,
  iban: "AO006 0055 0000 3295 0561 10379",
  accountName: "Universidade Óscar Ribas",
  paymentAmount: "3.500 Kz",
  paymentInstructions:
    "Confirma a transferência antes de enviar a candidatura.",
  projectCommunityUrl: null,
  businessCommunityUrl: null,
  productCommunityUrl: null,
};

const tipoIcons: Record<AdminSubmission["tipo"], LucideIcon> = {
  projeto: GraduationCap,
  negocio: Briefcase,
  produto: Package,
};

const tipoBadgeColors: Record<AdminSubmission["tipo"], string> = {
  projeto:
    "bg-[hsl(var(--area-iot))]/15 text-[hsl(var(--area-iot))] border-[hsl(var(--area-iot))]/30",
  negocio:
    "bg-[hsl(var(--area-negocio))]/15 text-[hsl(var(--area-negocio))] border-[hsl(var(--area-negocio))]/30",
  produto:
    "bg-[hsl(var(--area-produto))]/15 text-[hsl(var(--area-produto))] border-[hsl(var(--area-produto))]/30",
};

const statusColors: Record<AdminSubmission["status"], string> = {
  pendente:
    "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30",
  aprovado:
    "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30",
  recusado: "bg-destructive/15 text-destructive border-destructive/30",
};

type CourseEnrollmentStatus = PaymentStatus;

const courseEnrollmentStatusBadge: Record<CourseEnrollmentStatus, string> = {
  SUBMITTED_BY_USER: "bg-slate-100 text-slate-700 border-slate-300",
  PENDING_REVIEW:
    "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30",
  CONFIRMED_BY_ADMIN:
    "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/30",
  CANCELED: "bg-slate-200 text-slate-700 border-slate-300",
};

const courseEnrollmentStatusLabel: Record<CourseEnrollmentStatus, string> = {
  SUBMITTED_BY_USER: "Submetido",
  PENDING_REVIEW: "Em análise financeira",
  CONFIRMED_BY_ADMIN: "Confirmado pela equipa",
  REJECTED: "Rejeitado",
  CANCELED: "Cancelado",
};

function normalizeCourseEnrollmentStatus(
  status: string,
): CourseEnrollmentStatus {
  if (
    status === "CONFIRMED" ||
    status === "APPROVED" ||
    status === "CONFIRMED_BY_ADMIN"
  )
    return "CONFIRMED_BY_ADMIN";
  if (status === "REJECTED") return "REJECTED";
  if (status === "CANCELED") return "CANCELED";
  if (status === "SUBMITTED_BY_USER") return "SUBMITTED_BY_USER";
  return "PENDING_REVIEW";
}

function isPaymentStatusConfirmed(status: string) {
  return normalizeCourseEnrollmentStatus(status) === "CONFIRMED_BY_ADMIN";
}

const guideIconOptions = [
  "BookOpen",
  "UserCheck",
  "CalendarDays",
  "Mic",
  "MapPin",
  "Zap",
];

const defaultAnalyticsFilters: AnalyticsFilterInput = {
  audience: "all",
  consent: "all",
  limit: 50,
  page: 1,
};

function mapSubmissionType(type: string): AdminSubmission["tipo"] {
  if (type === "BUSINESS") return "negocio";
  if (type === "PRODUCT") return "produto";
  return "projeto";
}

const submissionTypeOptions: Array<{
  value: AdminSubmission["tipo"];
  label: string;
}> = [
  { value: "projeto", label: "Projeto" },
  { value: "negocio", label: "Negócio" },
  { value: "produto", label: "Produto" },
];

function mapSubmissionStatus(status: string): AdminSubmission["status"] {
  if (status === "APPROVED") return "aprovado";
  if (status === "REJECTED") return "recusado";
  return "pendente";
}

function communityUrlBySubmissionType(
  tipo: AdminSubmission["tipo"],
  config: Pick<
    SubmissionConfig,
    "projectCommunityUrl" | "businessCommunityUrl" | "productCommunityUrl"
  >,
) {
  if (tipo === "negocio") return config.businessCommunityUrl ?? null;
  if (tipo === "produto") return config.productCommunityUrl ?? null;
  return config.projectCommunityUrl ?? null;
}

function toBackendStatus(
  status: AdminSubmission["status"],
): "PENDING" | "APPROVED" | "REJECTED" {
  if (status === "aprovado") return "APPROVED";
  if (status === "recusado") return "REJECTED";
  return "PENDING";
}

function studentInteractions(student: StudentWithStats) {
  return (
    (student._count?.likes ?? 0) +
    (student._count?.votes ?? 0) +
    (student._count?.comments ?? 0)
  );
}

function formatDateLabel(value: string) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function submissionCoverGradient(
  submission: Pick<AdminSubmission, "primaryColor" | "secondaryColor">,
) {
  return `linear-gradient(135deg, ${submission.primaryColor}E8 0%, ${submission.secondaryColor}D9 100%)`;
}

function formatAgendaDay(day: string) {
  return day === "DAY2" ? "Dia 2" : "Dia 1";
}

function formatAgendaType(type: string) {
  return (
    {
      PANEL: "Painel",
      WORKSHOP: "Workshop",
      PRESENTATION: "Apresentação",
      CEREMONY: "Cerimónia",
      BREAK: "Intervalo",
    }[type] ?? type
  );
}

function toDateInputValue(value: string) {
  return value ? value.slice(0, 10) : "";
}

function normalizeOptionalText(value?: string | null) {
  return value ? value : "";
}

function parseCurrencyValue(value: string) {
  const numeric = Number(
    value
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(value);
}

function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    currentPage,
    totalPages,
    items: items.slice(start, start + pageSize),
  };
}

const StatCard = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string;
}) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-heading text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const FormField = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="space-y-2">
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    {children}
  </div>
);

function canAccessAdminPermission(
  adminAccess: AdminAccessProfile | null | undefined,
  permission: AdminPermission,
) {
  return (
    !adminAccess ||
    adminAccess.isSuperAdmin ||
    adminAccess.permissions.includes(permission)
  );
}

/* ── Tab grouping for sidebar navigation ── */
const tabGroups = [
  {
    label: "Gestão",
    ids: [
      "overview",
      "analytics",
      "security",
      "odin",
      "nucleus",
      "credentials",
      "audit",
    ] as TabId[],
  },
  {
    label: "Comunicação",
    ids: ["sms", "whatsapp"] as TabId[],
  },
  {
    label: "Académico",
    ids: ["students", "courses", "certificates", "submissions"] as TabId[],
  },
  {
    label: "Evento",
    ids: [
      "evento",
      "speakers",
      "trainers",
      "schedule",
      "attendance",
      "passport",
      "panels",
    ] as TabId[],
  },
  {
    label: "Conteúdo",
    ids: ["guide", "faq", "live", "jury", "votes", "winners"] as TabId[],
  },
];

const Admin = ({
  adminAccess,
}: {
  adminAccess?: AdminAccessProfile | null;
}) => {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [activeCredentialSubpage, setActiveCredentialSubpage] =
    useState<CredentialAdminSubpage>("overview");
  const [activeSubmissionSubpage, setActiveSubmissionSubpage] =
    useState<SubmissionAdminSubpage>("overview");
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const [showRightGradient, setShowRightGradient] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [accessState, setAccessState] = useState<
    "checking" | "allowed" | "unauthenticated" | "forbidden"
  >("checking");
  const [loadedSections, setLoadedSections] = useState<
    Record<AdminDataSection, boolean>
  >(defaultLoadedSections);
  const [loadingSections, setLoadingSections] = useState<
    Record<AdminDataSection, boolean>
  >(defaultLoadedSections);
  const [sessionStudentNumber, setSessionStudentNumber] = useState<
    string | null
  >(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [exportingReport, setExportingReport] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [submissionSortBy, setSubmissionSortBy] = useState<
    "recentes" | "nome" | "inscricao" | "curso"
  >("recentes");
  const [submissionPageSize, setSubmissionPageSize] = useState(10);
  const [submissionPage, setSubmissionPage] = useState(1);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [submissionsTotalPages, setSubmissionsTotalPages] = useState(1);
  const [loadingSubmissionsList, setLoadingSubmissionsList] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [studentCourseFilter, setStudentCourseFilter] = useState("todos");
  const [studentUniversityFilter, setStudentUniversityFilter] = useState("todos");
  const [studentAccessTypeFilter, setStudentAccessTypeFilter] = useState<"todos" | "OFFICIAL" | "TEMPORARY">("todos");
  const [studentSortBy, setStudentSortBy] = useState<
    "interacoes" | "nome" | "numero" | "curso" | "universidade"
  >("interacoes");
  const [studentPageSize, setStudentPageSize] = useState(10);
  const [studentPage, setStudentPage] = useState(1);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsTotalPages, setStudentsTotalPages] = useState(1);
  const [studentStatsSummary, setStudentStatsSummary] =
    useState<StudentPagedStats | null>(null);
  const [studentFacets, setStudentFacets] = useState<StudentPagedFacets>({
    courses: [],
    universities: [],
  });
  const [loadingStudentsList, setLoadingStudentsList] = useState(false);
  const [groupStudentsByCourse, setGroupStudentsByCourse] = useState(true);
  const [moderationSearchTerm, setModerationSearchTerm] = useState("");
  const [moderationPageSize, setModerationPageSize] = useState(10);
  const [moderationCommentPage, setModerationCommentPage] = useState(1);
  const [moderationChatPage, setModerationChatPage] = useState(1);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsDashboard, setAnalyticsDashboard] =
    useState<AnalyticsDashboard | null>(null);
  const [analyticsEvents, setAnalyticsEvents] =
    useState<AnalyticsEventsPayload | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsFilters, setAnalyticsFilters] =
    useState<AnalyticsFilterInput>(defaultAnalyticsFilters);

  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [submissionListRows, setSubmissionListRows] = useState<
    AdminSubmission[]
  >([]);
  const [projectObligationRows, setProjectObligationRows] = useState<
    AdminSubmission[]
  >([]);
  const [loadingProjectObligations, setLoadingProjectObligations] =
    useState(false);
  const [projectObligationRefreshKey, setProjectObligationRefreshKey] =
    useState(0);
  const [projectObligationNoticeType, setProjectObligationNoticeType] =
    useState<ProjectObligationNoticeType>("member_confirmation");
  const [projectObligationNoticeChannel, setProjectObligationNoticeChannel] =
    useState<ProjectObligationNoticeChannel>("sms");
  const [
    sendingProjectObligationNotices,
    setSendingProjectObligationNotices,
  ] = useState(false);
  const [projectObligationNoticeResult, setProjectObligationNoticeResult] =
    useState<ProjectObligationNoticeResult | null>(null);
  const [submissionBannerDrafts, setSubmissionBannerDrafts] = useState<
    Record<number, string | null | undefined>
  >({});
  const [expandedSubmissionIds, setExpandedSubmissionIds] = useState<
    Set<number>
  >(new Set());
  const [submissionConfig, setSubmissionConfig] = useState<
    Omit<SubmissionConfig, "key" | "createdAt" | "updatedAt">
  >(defaultSubmissionConfigForm);
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [studentListRows, setStudentListRows] = useState<StudentWithStats[]>(
    [],
  );
  const [authorizedAdminStudents, setAuthorizedAdminStudents] = useState<
    AdminAuthorizedStudent[]
  >([]);
  const [adminAccessConflicts, setAdminAccessConflicts] = useState<
    AdminAccessConflict[]
  >([]);
  const [recentLogins, setRecentLogins] = useState<StudentProfile[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [schedule, setSchedule] = useState<AgendaItem[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [guideContent, setGuideContent] = useState<GuideContent>({
    steps: [],
    tips: [],
    venues: [],
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [panelTopics, setPanelTopics] = useState<PanelTopic[]>([]);
  const [liveState, setLiveState] = useState<AgendaLiveState>({
    current: null,
    next: null,
  });
  const [liveConfigForm, setLiveConfigForm] = useState<AgendaLiveConfigInput>(
    defaultLiveConfigForm,
  );
  const [voteProjects, setVoteProjects] = useState<VoteProjectSummary[]>([]);
  const [voteEntries, setVoteEntries] = useState<VoteEntry[]>([]);
  const [voteCourseSummaries, setVoteCourseSummaries] = useState<
    VoteCourseSummary[]
  >([]);
  const [votesProjectsPage, setVotesProjectsPage] = useState(1);
  const [votesProjectsPageSize] = useState(30);
  const [votesProjectsTotal, setVotesProjectsTotal] = useState(0);
  const [votesProjectsTotalPages, setVotesProjectsTotalPages] = useState(1);
  const [votesEntriesPage, setVotesEntriesPage] = useState(1);
  const [votesEntriesPageSize] = useState(80);
  const [votesEntriesTotal, setVotesEntriesTotal] = useState(0);
  const [votesEntriesTotalPages, setVotesEntriesTotalPages] = useState(1);
  const [votesUpdatedAt, setVotesUpdatedAt] = useState<string | null>(null);
  const [votesResetDialogOpen, setVotesResetDialogOpen] = useState(false);
  const [votesResetPhrase, setVotesResetPhrase] = useState("");
  const [votesResetConfirming, setVotesResetConfirming] = useState(false);
  const [projectVotingPaused, setProjectVotingPaused] = useState(false);
  const [exhibitorVoteQrDialog, setExhibitorVoteQrDialog] = useState<{
    project: VoteProjectSummary;
    url: string;
    qrImageUrl: string;
  } | null>(null);
  const [passportGameOverview, setPassportGameOverview] =
    useState<DigitalPassportAdminOverview | null>(null);
  const [projectComments, setProjectComments] = useState<
    AdminModerationProjectComment[]
  >([]);
  const [liveChatMessages, setLiveChatMessages] = useState<
    AdminModerationLiveChatMessage[]
  >([]);
  const [selectedWinners, setSelectedWinners] = useState<{
    projectWinner: number | null;
    studentWinner: number | null;
  }>({
    projectWinner: null,
    studentWinner: null,
  });

  const [studentPendingRemoval, setStudentPendingRemoval] =
    useState<StudentWithStats | null>(null);
  const [isRemovingStudent, setIsRemovingStudent] = useState(false);
  const [submissionPendingRemoval, setSubmissionPendingRemoval] =
    useState<AdminSubmission | null>(null);
  const [isRemovingSubmission, setIsRemovingSubmission] = useState(false);
  const [coursePendingRemoval, setCoursePendingRemoval] =
    useState<Course | null>(null);
  const [courseEnrollmentPendingRemoval, setCourseEnrollmentPendingRemoval] =
    useState<{
      courseId: number;
      enrollmentId: number;
      fullName: string;
    } | null>(null);
  const [courseEnrollments, setCourseEnrollments] = useState<
    Record<number, CourseEnrollmentsPagedPayload>
  >({});
  const [courseEnrollmentForms, setCourseEnrollmentForms] = useState<
    Record<number, CourseEnrollmentInput>
  >({});
  const [editingCourseEnrollmentId, setEditingCourseEnrollmentId] = useState<
    number | null
  >(null);
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const [loadingCourseId, setLoadingCourseId] = useState<number | null>(null);
  const [exportingCourseId, setExportingCourseId] = useState<number | null>(
    null,
  );
  const [updatingEnrollmentStatusId, setUpdatingEnrollmentStatusId] = useState<
    number | null
  >(null);
  const [coursePaymentReviewNotes, setCoursePaymentReviewNotes] = useState<
    Record<number, string>
  >({});
  const [submissionPaymentReviewNotes, setSubmissionPaymentReviewNotes] =
    useState<Record<number, string>>({});
  const [teamMembersDialogSubmission, setTeamMembersDialogSubmission] =
    useState<AdminSubmission | null>(null);
  const [teamMembersDraft, setTeamMembersDraft] = useState("");
  const [savingTeamMembersId, setSavingTeamMembersId] = useState<number | null>(
    null,
  );

  const [editingSpeakerId, setEditingSpeakerId] = useState<number | null>(null);
  const [speakerForm, setSpeakerForm] =
    useState<SpeakerInput>(defaultSpeakerForm);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(
    null,
  );
  const [scheduleForm, setScheduleForm] =
    useState<AgendaInput>(defaultScheduleForm);
  const [editingFaqId, setEditingFaqId] = useState<number | null>(null);
  const [faqForm, setFaqForm] = useState<FaqInput>(defaultFaqForm);
  const [editingGuideStepId, setEditingGuideStepId] = useState<number | null>(
    null,
  );
  const [guideStepForm, setGuideStepForm] =
    useState<GuideStepInput>(defaultGuideStepForm);
  const [editingGuideTipId, setEditingGuideTipId] = useState<number | null>(
    null,
  );
  const [guideTipForm, setGuideTipForm] =
    useState<GuideTipInput>(defaultGuideTipForm);
  const [editingVenueId, setEditingVenueId] = useState<number | null>(null);
  const [venueForm, setVenueForm] = useState<VenueInput>(defaultVenueForm);
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [courseForm, setCourseForm] = useState<CourseInput>(defaultCourseForm);
  const [editingPanelTopicId, setEditingPanelTopicId] = useState<number | null>(
    null,
  );
  const [panelTopicForm, setPanelTopicForm] = useState<PanelTopicInput>(
    defaultPanelTopicForm,
  );
  const [socialConfigForm, setSocialConfigForm] =
    useState<HomeSocialConfigInput>(defaultSocialConfigForm);
  const [authorizedStudentNumber, setAuthorizedStudentNumber] = useState("");
  const [adminAccessForm, setAdminAccessForm] = useState<AdminAccessForm>(
    defaultAdminAccessForm,
  );
  const deferredSubmissionSearch = useDeferredValue(searchTerm);
  const deferredStudentSearch = useDeferredValue(studentSearchTerm);
  const deferredModerationSearch = useDeferredValue(moderationSearchTerm);
  const visibleTabs = useMemo(
    () =>
      tabs.filter((tab) =>
        canAccessAdminPermission(adminAccess, tab.permission),
      ),
    [adminAccess],
  );
  const mapSubmissionToAdmin = (
    submission: Awaited<
      ReturnType<typeof api.submissions.listDetailedPaged>
    >["items"][number],
  ): AdminSubmission => ({
    id: submission.id,
    slug: submission.slug,
    detailPath: submission.detailPath,
    referenceCode: submission.referenceCode,
    nome: submission.name,
    descricao: submission.description,
    tipo: mapSubmissionType(submission.type),
    area: submission.area ?? "Geral",
    curso: submission.course ?? "Sem curso",
    equipa: submission.members ?? "",
    responsavel: submission.leaderName ?? "Responsável não informado",
    telefone: submission.leaderPhone ?? "",
    necessidades: submission.needs ?? [],
    observacoes: submission.observations ?? "",
    status: mapSubmissionStatus(submission.status),
    data: submission.createdAt ?? "",
    primaryColor: submission.primaryColor,
    secondaryColor: submission.secondaryColor,
    bannerUrl: submission.bannerUrl ?? null,
    projectFrozen: submission.projectFrozen,
    projectFrozenAt: submission.projectFrozenAt,
    projectFrozenByStudentNumber: submission.projectFrozenByStudentNumber,
    projectFreezeReason: submission.projectFreezeReason,
    isWinner: submission.isWinner,
    canVote: submission.canVote && !submission.projectFrozen,
    paymentStatus: submission.paymentStatus,
    paymentStatusLabel: submission.paymentStatusLabel,
    paymentSubmittedAt: submission.paymentSubmittedAt,
    paymentReviewedAt: submission.paymentReviewedAt,
    paymentReviewedByStudentNumber: submission.paymentReviewedByStudentNumber,
    paymentReviewNote: submission.paymentReviewNote,
    teamInviteUrl: submission.teamInviteUrl,
    teamJourneyLabel: submission.teamJourneyLabel,
    teamTotalMembers: submission.teamTotalMembers,
    teamConfirmedMembers: submission.teamConfirmedMembers,
    teamAllConfirmed: submission.teamAllConfirmed,
    teamMembers: submission.teamMembers,
    exhibitorChallengeStatus: submission.exhibitorChallengeStatus ?? "MISSING",
    exhibitorChallengeQuestion: submission.exhibitorChallengeQuestion ?? null,
    exhibitorChallengeAnswersCount:
      submission.exhibitorChallengeAnswersCount ?? 0,
    exhibitorChallengeUpdatedAt: submission.exhibitorChallengeUpdatedAt ?? null,
  });

  const submissionStatusToApi = (
    value: string,
  ): "PENDING" | "APPROVED" | "REJECTED" | undefined => {
    if (value === "pendente") return "PENDING";
    if (value === "aprovado") return "APPROVED";
    if (value === "recusado") return "REJECTED";
    return undefined;
  };

  const submissionTypeToApi = (
    value: string,
  ): "PROJECT" | "BUSINESS" | "PRODUCT" | undefined => {
    if (value === "projeto") return "PROJECT";
    if (value === "negocio") return "BUSINESS";
    if (value === "produto") return "PRODUCT";
    return undefined;
  };

  const submissionSortToApi = (
    value: typeof submissionSortBy,
  ): "created_desc" | "name_asc" | "reference_asc" | "course_asc" => {
    if (value === "nome") return "name_asc";
    if (value === "inscricao") return "reference_asc";
    if (value === "curso") return "course_asc";
    return "created_desc";
  };

  const studentSortToApi = (
    value: typeof studentSortBy,
  ): "interactions_desc" | "name_asc" | "number_asc" | "course_asc" | "university_asc" => {
    if (value === "nome") return "name_asc";
    if (value === "numero") return "number_asc";
    if (value === "curso") return "course_asc";
    if (value === "universidade") return "university_asc";
    return "interactions_desc";
  };

  const applyVoteSnapshot = (
    interactionData: {
      projects: Array<{
        id: number;
        name: string;
        detailPath?: string;
        type: string;
        votes: number;
        score?: number;
        comments: number;
        averageRating: number;
        pageViews?: number;
        uniqueVisitors?: number;
        authenticatedVisitors?: number;
      }>;
      votes: Array<{
        id: number;
        studentId: number;
        studentNumber: string;
        studentName: string | null;
        studentEmail: string | null;
        studentCourse: string | null;
        submissionId: number;
        submissionName: string;
        createdAt: string;
      }>;
      courses?: VoteCourseSummary[];
    },
    submissionList: AdminSubmission[],
    pagination?: {
      projects: { page: number; total: number; totalPages: number };
      votes: { page: number; total: number; totalPages: number };
    },
  ) => {
    const submissionStatusMap = new Map(
      submissionList.map((item) => [item.id, item.status]),
    );
    const submissionTeamMap = new Map(
      submissionList.map((item) => [item.id, item.equipa]),
    );
    const submissionWinnerMap = new Map(
      submissionList.map((item) => [item.id, item.isWinner]),
    );

    setVoteProjects(
      interactionData.projects.map((project) => ({
        id: project.id,
        nome: project.name,
        detailPath: project.detailPath ?? `/projeto/${project.id}`,
        equipa: submissionTeamMap.get(project.id) || "Equipa por confirmar",
        tipo: mapSubmissionType(project.type),
        votos: project.votes,
        pontos: project.score ?? project.votes,
        rating: project.averageRating,
        comentarios: project.comments,
        pageViews: project.pageViews ?? 0,
        uniqueVisitors: project.uniqueVisitors ?? 0,
        authenticatedVisitors: project.authenticatedVisitors ?? 0,
        status: submissionStatusMap.get(project.id) ?? "pendente",
        isWinner: submissionWinnerMap.get(project.id) ?? false,
        projectFrozen: project.projectFrozen,
        projectFrozenAt: project.projectFrozenAt,
        projectFreezeReason: project.projectFreezeReason,
      })),
    );
    setVoteEntries(
      interactionData.votes.map((vote) => ({
        id: vote.id,
        studentId: vote.studentId,
        studentNumber: vote.studentNumber,
        estudante: vote.studentName || `Estudante ${vote.studentNumber}`,
        email: vote.studentEmail || "Sem email",
        curso: vote.studentCourse || "Curso por confirmar",
        submissionId: vote.submissionId,
        projeto: vote.submissionName,
        data: vote.createdAt,
      })),
    );
    setVoteCourseSummaries(interactionData.courses ?? []);
    if (pagination) {
      setVotesProjectsPage(pagination.projects.page);
      setVotesProjectsTotal(pagination.projects.total);
      setVotesProjectsTotalPages(pagination.projects.totalPages);
      setVotesEntriesPage(pagination.votes.page);
      setVotesEntriesTotal(pagination.votes.total);
      setVotesEntriesTotalPages(pagination.votes.totalPages);
    }
    setVotesUpdatedAt(new Date().toISOString());
  };

  const markSectionLoaded = (section: AdminDataSection) => {
    setLoadedSections((current) => ({ ...current, [section]: true }));
  };

  const setSectionLoading = (
    section: AdminDataSection,
    loadingState: boolean,
  ) => {
    setLoadingSections((current) => ({ ...current, [section]: loadingState }));
  };

  const resetLoadedSections = () => {
    setLoadedSections(defaultLoadedSections);
    setLoadingSections(defaultLoadedSections);
  };

  const loadSection = async (
    section: AdminDataSection,
    options?: { force?: boolean },
  ) => {
    if (
      !options?.force &&
      (loadedSections[section] || loadingSections[section])
    ) {
      return;
    }

    setSectionLoading(section, true);

    try {
      if (section === "security") {
        const securityOverview = await api.students.securityOverview();
        setAuthorizedAdminStudents(securityOverview.authorizedStudents);
        setAdminAccessConflicts(securityOverview.adminAccessConflicts);
        setRecentLogins(securityOverview.recentLogins);
        markSectionLoaded(section);
        return;
      }

      if (section === "base") {
        const results = await Promise.allSettled([
          api.submissions.listDetailedPaged({
            page: 1,
            limit: 180,
            sort: "created_desc",
          }),
          api.submissions.config(),
          api.interactions.adminVotesPaged({
            projectsPage: 1,
            projectsLimit: votesProjectsPageSize,
            votesPage: 1,
            votesLimit: votesEntriesPageSize,
          }),
        ]);

        const [submissionResult, submissionConfigResult, interactionResult] =
          results;
        const submissionList =
          submissionResult.status === "fulfilled"
            ? submissionResult.value.items
            : [];
        const config =
          submissionConfigResult.status === "fulfilled"
            ? submissionConfigResult.value
            : null;
        const interactionData =
          interactionResult.status === "fulfilled"
            ? interactionResult.value
            : null;
        if (interactionData?.control) {
          setProjectVotingPaused(interactionData.control.votingPaused);
        }

        if (
          submissionResult.status === "fulfilled" &&
          submissionResult.value.total > submissionResult.value.items.length
        ) {
          toast.info(
            `A mostrar ${submissionResult.value.items.length} de ${submissionResult.value.total} candidaturas para manter o painel fluido.`,
          );
        }

        if (
          interactionResult.status === "fulfilled" &&
          interactionResult.value.votes.total >
            interactionResult.value.votes.items.length
        ) {
          toast.info(
            `A mostrar os ${interactionResult.value.votes.items.length} votos mais recentes para reduzir carga em picos.`,
          );
        }

        if (results.some((result) => result.status === "rejected")) {
          toast.warning(
            "Alguns blocos da administração falharam ao carregar. O resto do painel foi mantido.",
          );
        }

        const mappedSubmissions = submissionList.map((submission) =>
          mapSubmissionToAdmin(submission),
        );

        setSubmissions(mappedSubmissions);
        setSubmissionListRows(mappedSubmissions);
        setSubmissionsTotal(
          submissionResult.status === "fulfilled"
            ? submissionResult.value.total
            : mappedSubmissions.length,
        );
        setSubmissionsTotalPages(
          submissionResult.status === "fulfilled"
            ? submissionResult.value.totalPages
            : 1,
        );
        setSubmissionBannerDrafts(
          mappedSubmissions.reduce<Record<number, string | null>>(
            (acc, item) => {
              acc[item.id] = item.bannerUrl ?? null;
              return acc;
            },
            {},
          ),
        );

        if (config) {
          setSubmissionConfig({
            isOpen: config.isOpen,
            iban: config.iban,
            accountName: config.accountName,
            paymentAmount: config.paymentAmount,
            paymentInstructions: config.paymentInstructions,
            projectCommunityUrl: config.projectCommunityUrl,
            businessCommunityUrl: config.businessCommunityUrl,
            productCommunityUrl: config.productCommunityUrl,
          });
        }

        applyVoteSnapshot(
          {
            projects: interactionData?.projects.items ?? [],
            votes: interactionData?.votes.items ?? [],
            courses: interactionData?.courses ?? [],
          },
          mappedSubmissions,
          interactionData
            ? {
                projects: {
                  page: interactionData.projects.page,
                  total: interactionData.projects.total,
                  totalPages: interactionData.projects.totalPages,
                },
                votes: {
                  page: interactionData.votes.page,
                  total: interactionData.votes.total,
                  totalPages: interactionData.votes.totalPages,
                },
              }
            : undefined,
        );
        const winner = submissionList.find((submission) => submission.isWinner);
        setSelectedWinners((current) => ({
          ...current,
          projectWinner: winner?.id ?? null,
        }));
        markSectionLoaded(section);
        return;
      }

      if (section === "students") {
        const payload = await api.students.listPaged({
          page: 1,
          limit: 200,
          sort: "created_desc",
        });
        setStudents(payload.items);
        setStudentListRows(payload.items);
        setStudentsTotal(payload.total);
        setStudentsTotalPages(payload.totalPages);
        setStudentStatsSummary(payload.stats);
        setStudentFacets(payload.facets);
        if (payload.total > payload.items.length) {
          toast.info(
            `A mostrar ${payload.items.length} de ${payload.total} estudantes para garantir rapidez no painel.`,
          );
        }
        markSectionLoaded(section);
        return;
      }

      if (section === "speakers") {
        setSpeakers(await api.speakers.list());
        markSectionLoaded(section);
        return;
      }

      if (section === "agenda") {
        const [agendaList, live] = await Promise.all([
          api.agenda.list(),
          api.agenda.live(),
        ]);
        setSchedule(agendaList);
        setLiveState(live);
        markSectionLoaded(section);
        return;
      }

      if (section === "liveConfig") {
        const liveConfig = await api.agenda.liveConfig();
        setLiveConfigForm({
          mode: liveConfig.mode,
          current: liveConfig.current ?? defaultLiveConfigForm.current,
        });
        markSectionLoaded(section);
        return;
      }

      if (section === "moderation") {
        const moderationData = await api.interactions.adminModeration();
        setProjectComments(moderationData.projectComments);
        setLiveChatMessages(moderationData.liveChatMessages);
        markSectionLoaded(section);
        return;
      }

      if (section === "faq") {
        setFaqItems(await api.faq.list(true));
        markSectionLoaded(section);
        return;
      }

      if (section === "guide") {
        setGuideContent(await api.guide.content(true));
        markSectionLoaded(section);
        return;
      }

      if (section === "courses") {
        const courseData = await api.courses.list(true);
        setCourses(courseData.courses);
        markSectionLoaded(section);
        return;
      }

      if (section === "homeContent") {
        const homepage = await api.homeContent.list(true);
        setPanelTopics(homepage.panelTopics);
        setSocialConfigForm(toSocialConfigForm(homepage.socialConfig));
        markSectionLoaded(section);
      }
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setAccessState("unauthenticated");
        toast.warning(
          "Inicia sessão com a conta autorizada para abrir a área administrativa.",
        );
      } else if (isForbiddenError(error)) {
        setAccessState("forbidden");
        toast.error("Acesso negado à área administrativa.");
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao carregar dados da administração",
        );
      }
    } finally {
      setSectionLoading(section, false);
    }
  };

  const loadAdminData = async () => {
    if (!getToken()) {
      setAccessState("unauthenticated");
      setLoading(false);
      return;
    }

    setAccessState("checking");
    setLoading(true);
    resetLoadedSections();
    try {
      const session = await api.interactions.me();
      const student = session.student;
      const jury = session.jury;

      if (!student && !jury) {
        setToken(null);
        setAccessState("unauthenticated");
        return;
      }

      if (student) {
        setSessionStudentNumber(student.studentNumber);
      } else if (jury) {
        setSessionStudentNumber(`Júri: ${jury.name}`);
      }

      setAccessState("allowed");
      const shouldLoadBaseInitially = (
        ["OVERVIEW", "SUBMISSIONS", "VOTES", "WINNERS"] as AdminPermission[]
      ).some((permission) => canAccessAdminPermission(adminAccess, permission));
      if (shouldLoadBaseInitially) {
        await loadSection("base", { force: true });
      }
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setAccessState("unauthenticated");
        toast.warning(
          "Inicia sessão com a conta autorizada para abrir a área administrativa.",
        );
      } else if (isForbiddenError(error)) {
        setAccessState("forbidden");
        toast.error("Acesso negado à área administrativa.");
      } else {
        toast.error("Falha ao carregar dados da administração");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAnalyticsData = async (
    filters: AnalyticsFilterInput = analyticsFilters,
  ) => {
    try {
      setLoadingAnalytics(true);
      setAnalyticsError(null);
      const [dashboard, events] = await Promise.all([
        api.analytics.dashboard(filters),
        api.analytics.events(filters),
      ]);
      setAnalyticsDashboard(dashboard);
      setAnalyticsEvents(events);
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setAccessState("unauthenticated");
        setAnalyticsError(
          "A sessão expirou. Inicia sessão de novo para abrir a central de cookies.",
        );
        return;
      }

      if (isForbiddenError(error)) {
        setAccessState("forbidden");
        setAnalyticsError(
          "A conta atual não tem acesso à central de cookies e analytics.",
        );
        return;
      }

      setAnalyticsError(
        error instanceof Error
          ? error.message
          : "Falha ao carregar a central de cookies.",
      );
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleAnalyticsFiltersChange = (
    patch: Partial<AnalyticsFilterInput>,
  ) => {
    setAnalyticsFilters((current) => ({
      ...current,
      ...patch,
      page:
        patch.page ??
        (patch.search !== undefined ||
        patch.from !== undefined ||
        patch.to !== undefined ||
        patch.course !== undefined ||
        patch.audience !== undefined ||
        patch.consent !== undefined ||
        patch.source !== undefined
          ? 1
          : current.page),
    }));
  };

  const handleAnalyticsExport = async () => {
    try {
      const csv = await api.analytics.exportCsv(analyticsFilters);
      downloadBlob(
        csv,
        `uor-connect-cookies-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast.success("Exportação de analytics concluída.");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setAccessState("unauthenticated");
        toast.warning(
          "Inicia sessão novamente para exportar o histórico de cookies.",
        );
      } else if (isForbiddenError(error)) {
        setAccessState("forbidden");
        toast.error("A conta atual não pode exportar os dados de cookies.");
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao exportar analytics.",
        );
      }
    }
  };

  // Handler para atualizar visibilidade dos gradients de scroll das abas
  const handleTabsScroll = () => {
    if (!tabsScrollRef.current) return;

    const { scrollLeft, scrollWidth, clientWidth } = tabsScrollRef.current;
    setShowLeftGradient(scrollLeft > 10);
    setShowRightGradient(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    if (!sidebarOpen || typeof document === "undefined") return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousRootOverscroll;
    };
  }, [sidebarOpen]);

  const stopSidebarScrollPropagation = (event: WheelEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const stopSidebarTouchPropagation = (event: TouchEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  // Inicializar estado dos gradients e monitorer resize
  useEffect(() => {
    handleTabsScroll();
    window.addEventListener("resize", handleTabsScroll);
    return () => window.removeEventListener("resize", handleTabsScroll);
  }, []);

  useEffect(() => {
    void loadAdminData();
  }, []);

  useEffect(() => {
    if (
      visibleTabs.length > 0 &&
      !visibleTabs.some((tab) => tab.id === activeTab)
    ) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    if (accessState !== "allowed") return;

    const sectionsByTab: Record<TabId, AdminDataSection[]> = {
      overview: canAccessAdminPermission(adminAccess, "SECURITY")
        ? ["base", "security"]
        : ["base"],
      analytics: [],
      sms: ["courses"],
      whatsapp: ["courses"],
      jury: [],
      passport: [],
      submissions: ["base"],
      speakers: ["speakers"],
      trainers: [],
      schedule: ["agenda"],
      guide: ["guide"],
      courses: ["courses"],
      panels: ["homeContent"],
      evento: ["homeContent"],
      faq: ["faq"],
      live: ["agenda", "liveConfig"],
      votes: ["base", "moderation"],
      security: ["security"],
      odin: [],
      nucleus: ["security"],
      credentials: ["security"],
      students: ["students"],
      winners: ["base"],
    };

    for (const section of sectionsByTab[activeTab] ?? []) {
      void loadSection(section);
    }
  }, [accessState, activeTab, adminAccess, loadedSections, loadingSections]);

  useEffect(() => {
    if (accessState !== "allowed") return;

    const shouldPollLive = activeTab === "schedule" || activeTab === "live";
    const shouldPollVotes =
      activeTab === "overview" ||
      activeTab === "votes" ||
      activeTab === "winners";

    if (!shouldPollLive && !shouldPollVotes) return;

    const refresh = () => {
      const jobs: Promise<unknown>[] = [];

      if (shouldPollLive) {
        jobs.push(
          Promise.allSettled([api.agenda.live(), api.agenda.list()]).then(
            ([liveResult, agendaResult]) => {
              if (liveResult.status === "fulfilled") {
                setLiveState(liveResult.value);
              }

              if (
                agendaResult.status === "fulfilled" &&
                (activeTab === "schedule" || activeTab === "live")
              ) {
                setSchedule(agendaResult.value);
              }
            },
          ),
        );
      }

      if (shouldPollVotes && loadedSections.base) {
        const projectsPage = activeTab === "votes" ? votesProjectsPage : 1;
        const votesPage = activeTab === "votes" ? votesEntriesPage : 1;
        const projectsLimit =
          activeTab === "votes" ? votesProjectsPageSize : 12;
        const votesLimit = activeTab === "votes" ? votesEntriesPageSize : 40;

        jobs.push(
          api.interactions
            .adminVotesPaged({
              projectsPage,
              projectsLimit,
              votesPage,
              votesLimit,
            })
            .then((snapshot) => {
              setProjectVotingPaused(snapshot.control.votingPaused);
              applyVoteSnapshot(
                {
                  projects: snapshot.projects.items,
                  votes: snapshot.votes.items,
                  courses: snapshot.courses,
                },
                submissions,
                activeTab === "votes"
                  ? {
                      projects: {
                        page: snapshot.projects.page,
                        total: snapshot.projects.total,
                        totalPages: snapshot.projects.totalPages,
                      },
                      votes: {
                        page: snapshot.votes.page,
                        total: snapshot.votes.total,
                        totalPages: snapshot.votes.totalPages,
                      },
                    }
                  : undefined,
              );
            })
            .catch(() => undefined),
        );
      }

      if (activeTab === "votes" && loadedSections.moderation) {
        jobs.push(
          api.interactions
            .adminModeration()
            .then((moderationData) => {
              setProjectComments(moderationData.projectComments);
              setLiveChatMessages(moderationData.liveChatMessages);
            })
            .catch(() => undefined),
        );
      }

      if (activeTab === "votes") {
        jobs.push(
          api.passport
            .overview()
            .then((overview) => setPassportGameOverview(overview))
            .catch(() => undefined),
        );
      }

      return Promise.all(jobs);
    };

    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [
    accessState,
    activeTab,
    loadedSections.base,
    loadedSections.moderation,
    submissions,
    votesEntriesPage,
    votesEntriesPageSize,
    votesProjectsPage,
    votesProjectsPageSize,
  ]);

  useEffect(() => {
    if (accessState !== "allowed" || activeTab !== "analytics") return;
    void loadAnalyticsData();
  }, [accessState, activeTab, analyticsFilters]);

  useEffect(() => {
    if (
      accessState !== "allowed" ||
      activeTab !== "submissions" ||
      !loadedSections.base
    )
      return;

    let cancelled = false;

    const loadSubmissionsPage = async () => {
      try {
        setLoadingSubmissionsList(true);
        const payload = await api.submissions.listDetailedPaged({
          page: submissionPage,
          limit: submissionPageSize,
          search: deferredSubmissionSearch.trim() || undefined,
          status: submissionStatusToApi(filterStatus),
          type: submissionTypeToApi(filterTipo),
          sort: submissionSortToApi(submissionSortBy),
        });

        if (cancelled) return;

        const mapped = payload.items.map((item) => mapSubmissionToAdmin(item));
        setSubmissionListRows(mapped);
        setSubmissionsTotal(payload.total);
        setSubmissionsTotalPages(payload.totalPages);
        setSubmissionPage(payload.page);
        setSubmissionBannerDrafts((current) => {
          const next = { ...current };
          for (const item of mapped) {
            if (next[item.id] === undefined) {
              next[item.id] = item.bannerUrl ?? null;
            }
          }
          return next;
        });
      } catch (error) {
        if (cancelled) return;
        if (isAuthError(error)) {
          setToken(null);
          setAccessState("unauthenticated");
          toast.warning(
            "Inicia sessão com a conta autorizada para abrir a área administrativa.",
          );
          return;
        }
        if (isForbiddenError(error)) {
          setAccessState("forbidden");
          toast.error("Acesso negado à área administrativa.");
          return;
        }
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao carregar candidaturas.",
        );
      } finally {
        if (!cancelled) {
          setLoadingSubmissionsList(false);
        }
      }
    };

    void loadSubmissionsPage();
    return () => {
      cancelled = true;
    };
  }, [
    accessState,
    activeTab,
    deferredSubmissionSearch,
    filterStatus,
    filterTipo,
    loadedSections.base,
    submissionPage,
    submissionPageSize,
    submissionSortBy,
  ]);

  useEffect(() => {
    if (
      accessState !== "allowed" ||
      activeTab !== "submissions" ||
      activeSubmissionSubpage !== "projects" ||
      !loadedSections.base
    )
      return;

    let cancelled = false;

    const loadProjectObligations = async () => {
      try {
        setLoadingProjectObligations(true);
        const payload = await api.submissions.listDetailedPaged({
          page: 1,
          limit: 500,
          sort: "name_asc",
        });
        if (cancelled) return;
        const mapped = payload.items.map((item) => mapSubmissionToAdmin(item));
        setProjectObligationRows(mapped);
        setSubmissionBannerDrafts((current) => {
          const next = { ...current };
          for (const item of mapped) {
            if (next[item.id] === undefined) {
              next[item.id] = item.bannerUrl ?? null;
            }
          }
          return next;
        });
      } catch (error) {
        if (cancelled) return;
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao carregar projetos e obrigações.",
        );
      } finally {
        if (!cancelled) {
          setLoadingProjectObligations(false);
        }
      }
    };

    void loadProjectObligations();
    return () => {
      cancelled = true;
    };
  }, [
    accessState,
    activeSubmissionSubpage,
    activeTab,
    loadedSections.base,
    projectObligationRefreshKey,
  ]);

  useEffect(() => {
    if (
      accessState !== "allowed" ||
      activeTab !== "students" ||
      !loadedSections.students
    )
      return;

    let cancelled = false;

    const loadStudentsPage = async () => {
      try {
        setLoadingStudentsList(true);
        const payload = await api.students.listPaged({
          page: studentPage,
          limit: studentPageSize,
          search: deferredStudentSearch.trim() || undefined,
          course:
            studentCourseFilter === "todos" ? undefined : studentCourseFilter,
          university:
            studentUniversityFilter === "todos" ? undefined : studentUniversityFilter,
          accessType:
            studentAccessTypeFilter === "todos" ? undefined : studentAccessTypeFilter,
          sort: studentSortToApi(studentSortBy),
        });

        if (cancelled) return;

        setStudentListRows(payload.items);
        setStudentsTotal(payload.total);
        setStudentsTotalPages(payload.totalPages);
        setStudentPage(payload.page);
        setStudentStatsSummary(payload.stats);
        setStudentFacets(payload.facets);
      } catch (error) {
        if (cancelled) return;
        if (isAuthError(error)) {
          setToken(null);
          setAccessState("unauthenticated");
          toast.warning(
            "Inicia sessão com a conta autorizada para abrir a área administrativa.",
          );
          return;
        }
        if (isForbiddenError(error)) {
          setAccessState("forbidden");
          toast.error("Acesso negado à área administrativa.");
          return;
        }
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao carregar estudantes.",
        );
      } finally {
        if (!cancelled) {
          setLoadingStudentsList(false);
        }
      }
    };

    void loadStudentsPage();
    return () => {
      cancelled = true;
    };
  }, [
    accessState,
    activeTab,
    deferredStudentSearch,
    loadedSections.students,
    studentCourseFilter,
    studentUniversityFilter,
    studentAccessTypeFilter,
    studentPage,
    studentPageSize,
    studentSortBy,
  ]);

  const rankedStudents = useMemo(
    () =>
      [...students].sort(
        (left, right) => studentInteractions(right) - studentInteractions(left),
      ),
    [students],
  );

  const rankedProjects = useMemo(
    () =>
      [...voteProjects].sort((left, right) => {
        if (right.pontos !== left.pontos) return right.pontos - left.pontos;
        if (right.votos !== left.votos) return right.votos - left.votos;
        if (right.rating !== left.rating) return right.rating - left.rating;
        return right.comentarios - left.comentarios;
      }),
    [voteProjects],
  );

  const approvedProjects = useMemo(
    () =>
      rankedProjects.filter(
        (project) =>
          project.status === "aprovado" && project.tipo === "projeto",
      ),
    [rankedProjects],
  );

  const votesPageViews = useMemo(
    () => rankedProjects.reduce((sum, project) => sum + project.pageViews, 0),
    [rankedProjects],
  );
  const votesUniqueVisitors = useMemo(
    () =>
      rankedProjects.reduce((sum, project) => sum + project.uniqueVisitors, 0),
    [rankedProjects],
  );
  const votesAuthenticatedVisitors = useMemo(
    () =>
      rankedProjects.reduce(
        (sum, project) => sum + project.authenticatedVisitors,
        0,
      ),
    [rankedProjects],
  );

  const scoreTotalFromProjects = useMemo(
    () => rankedProjects.reduce((sum, project) => sum + project.pontos, 0),
    [rankedProjects],
  );
  const voteTotalFromProjects = useMemo(
    () => rankedProjects.reduce((sum, project) => sum + project.votos, 0),
    [rankedProjects],
  );
  const voteLeader = rankedProjects[0] ?? null;
  const voteRunnerUp = rankedProjects[1] ?? null;
  const leaderAdvantage = voteLeader
    ? Math.max(voteLeader.pontos - (voteRunnerUp?.pontos ?? 0), 0)
    : 0;
  const voteLeaderShare =
    voteLeader && scoreTotalFromProjects > 0
      ? Math.round((voteLeader.pontos / scoreTotalFromProjects) * 100)
      : 0;

  const votesLastFiveMinutes = useMemo(() => {
    if (voteCourseSummaries.length > 0) {
      return voteCourseSummaries.reduce(
        (sum, course) => sum + course.recentVotes,
        0,
      );
    }

    const cutoff = Date.now() - 5 * 60 * 1000;
    return voteEntries.filter((vote) => {
      const voteTime = new Date(vote.data).getTime();
      return Number.isFinite(voteTime) && voteTime >= cutoff;
    }).length;
  }, [voteCourseSummaries, voteEntries]);

  const recentVotesByProject = useMemo(() => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    return voteEntries.reduce<Map<number, number>>((acc, vote) => {
      const voteTime = new Date(vote.data).getTime();
      if (!Number.isFinite(voteTime) || voteTime < cutoff) return acc;
      acc.set(vote.submissionId, (acc.get(vote.submissionId) ?? 0) + 1);
      return acc;
    }, new Map());
  }, [voteEntries]);

  const voteCourseStats = useMemo(() => {
    if (voteCourseSummaries.length > 0) {
      return voteCourseSummaries
        .map((course) => ({
          course: course.course,
          votes: course.votes,
          recent: course.recentVotes,
          students: course.students,
          latestAt: course.lastVoteAt
            ? new Date(course.lastVoteAt).getTime()
            : 0,
        }))
        .sort(
          (left, right) =>
            right.recent - left.recent ||
            right.votes - left.votes ||
            right.latestAt - left.latestAt,
        );
    }

    const cutoff = Date.now() - 5 * 60 * 1000;
    const stats = voteEntries.reduce<
      Map<
        string,
        {
          course: string;
          votes: number;
          recent: number;
          students: Set<number>;
          latestAt: number;
        }
      >
    >((acc, vote) => {
      const course = vote.curso || "Curso por confirmar";
      const voteTime = new Date(vote.data).getTime();
      const current = acc.get(course) ?? {
        course,
        votes: 0,
        recent: 0,
        students: new Set<number>(),
        latestAt: 0,
      };

      current.votes += 1;
      current.students.add(vote.studentId);
      if (Number.isFinite(voteTime)) {
        current.latestAt = Math.max(current.latestAt, voteTime);
        if (voteTime >= cutoff) current.recent += 1;
      }
      acc.set(course, current);
      return acc;
    }, new Map());

    return Array.from(stats.values())
      .map((item) => ({
        course: item.course,
        votes: item.votes,
        recent: item.recent,
        students: item.students.size,
        latestAt: item.latestAt,
      }))
      .sort(
        (left, right) =>
          right.recent - left.recent ||
          right.votes - left.votes ||
          right.latestAt - left.latestAt,
      );
  }, [voteCourseSummaries, voteEntries]);

  const activeVoteCourses = voteCourseStats.length;
  const hottestCourse = voteCourseStats[0] ?? null;

  const voteMoments = useMemo(() => {
    const latestVotes = voteEntries.slice(0, 4).map((vote) => ({
      id: `vote-${vote.id}`,
      title: vote.curso,
      text: `votou em ${vote.projeto}`,
      time: new Date(vote.data).toLocaleTimeString("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
    const insights = [
      voteLeader
        ? {
            id: "leader",
            title: "Lideranca atual",
            text:
              leaderAdvantage > 0
                ? `${voteLeader.nome} lidera com ${leaderAdvantage} ponto(s) de vantagem.`
                : `${voteLeader.nome} esta empatado na frente.`,
            time: "agora",
          }
        : null,
      hottestCourse
        ? {
            id: "course",
            title: "Curso em destaque",
            text: `${hottestCourse.course} movimentou ${hottestCourse.votes} voto(s) nesta pagina.`,
            time: hottestCourse.recent > 0 ? "5 min" : "hoje",
          }
        : null,
      votesLastFiveMinutes > 0
        ? {
            id: "pulse",
            title: "Pulso recente",
            text: `${votesLastFiveMinutes} voto(s) entraram nos ultimos 5 minutos.`,
            time: "ao vivo",
          }
        : null,
    ].filter(Boolean) as Array<{
      id: string;
      title: string;
      text: string;
      time: string;
    }>;

    return [...latestVotes, ...insights].slice(0, 6);
  }, [
    hottestCourse,
    leaderAdvantage,
    voteEntries,
    voteLeader,
    votesLastFiveMinutes,
  ]);

  const paginatedSubmissions = useMemo(
    () => ({
      currentPage: submissionPage,
      totalPages: submissionsTotalPages,
      items: submissionListRows,
    }),
    [submissionListRows, submissionPage, submissionsTotalPages],
  );

  const projectComplianceRows = useMemo(
    () =>
      (projectObligationRows.length > 0
        ? projectObligationRows
        : submissionListRows
      ).slice().sort((left, right) => left.nome.localeCompare(right.nome, "pt")),
    [projectObligationRows, submissionListRows],
  );

  const projectComplianceSummary = useMemo(() => {
    const total = projectComplianceRows.length;
    const withPhoto = projectComplianceRows.filter((item) => item.bannerUrl).length;
    const withTeamConfirmed = projectComplianceRows.filter((item) => item.teamAllConfirmed).length;
    const withQuestions = projectComplianceRows.filter(
      (item) => item.exhibitorChallengeStatus !== "MISSING",
    ).length;
    const fullyReady = projectComplianceRows.filter(
      (item) =>
        item.bannerUrl &&
        item.teamAllConfirmed &&
        item.exhibitorChallengeStatus !== "MISSING",
    ).length;

    return {
      total,
      withPhoto,
      withTeamConfirmed,
      withQuestions,
      fullyReady,
    };
  }, [projectComplianceRows]);

  const projectObligationNoticeTargets = useMemo(
    () =>
      getProjectObligationNoticeTargets(
        projectComplianceRows,
        projectObligationNoticeType,
      ),
    [projectComplianceRows, projectObligationNoticeType],
  );

  const selectedProjectObligationNoticeOption =
    projectObligationNoticeOptions.find(
      (item) => item.id === projectObligationNoticeType,
    ) ?? projectObligationNoticeOptions[0];
  const selectedProjectObligationChannelOption =
    projectObligationChannelOptions.find(
      (item) => item.id === projectObligationNoticeChannel,
    ) ?? projectObligationChannelOptions[0];

  const toggleSubmissionDetails = (submissionId: number) => {
    setExpandedSubmissionIds((current) => {
      const next = new Set(current);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else {
        next.add(submissionId);
      }
      return next;
    });
  };

  const groupedStudents = useMemo(() => {
    return studentListRows.reduce<Record<string, StudentWithStats[]>>(
      (acc, student) => {
        const key = student.course || "Sem curso";
        acc[key] = acc[key] ? [...acc[key], student] : [student];
        return acc;
      },
      {},
    );
  }, [studentListRows]);

  const availableStudentCourses = useMemo(
    () => {
      if (studentFacets.courses.length) return studentFacets.courses;
      return Array.from(
        new Set(
          [...students, ...studentListRows]
            .map((student) => student.course)
            .filter(Boolean) as string[],
        ),
      ).sort((left, right) => left.localeCompare(right, "pt"));
    },
    [students, studentFacets.courses, studentListRows],
  );

  const availableStudentUniversities = useMemo(
    () => {
      if (studentFacets.universities.length) return studentFacets.universities;
      return Array.from(
        new Set(
          [...students, ...studentListRows]
            .map((student) => student.university?.trim())
            .filter(Boolean) as string[],
        ),
      ).sort((left, right) => left.localeCompare(right, "pt"));
    },
    [students, studentFacets.universities, studentListRows],
  );

  const filteredProjectComments = useMemo(() => {
    const search = deferredModerationSearch.toLowerCase();

    return projectComments.filter(
      (comment) =>
        comment.content.toLowerCase().includes(search) ||
        comment.studentName.toLowerCase().includes(search) ||
        comment.studentNumber.toLowerCase().includes(search) ||
        comment.submissionName.toLowerCase().includes(search) ||
        (comment.course ?? "").toLowerCase().includes(search),
    );
  }, [deferredModerationSearch, projectComments]);

  const filteredLiveChatMessages = useMemo(() => {
    const search = deferredModerationSearch.toLowerCase();

    return liveChatMessages.filter(
      (message) =>
        message.content.toLowerCase().includes(search) ||
        message.studentName.toLowerCase().includes(search) ||
        message.studentNumber.toLowerCase().includes(search) ||
        (message.course ?? "").toLowerCase().includes(search) ||
        (message.replyTo?.content ?? "").toLowerCase().includes(search),
    );
  }, [liveChatMessages, deferredModerationSearch]);

  const paginatedProjectComments = useMemo(
    () =>
      paginateItems(
        filteredProjectComments,
        moderationCommentPage,
        moderationPageSize,
      ),
    [filteredProjectComments, moderationCommentPage, moderationPageSize],
  );

  const paginatedLiveChatMessages = useMemo(
    () =>
      paginateItems(
        filteredLiveChatMessages,
        moderationChatPage,
        moderationPageSize,
      ),
    [filteredLiveChatMessages, moderationChatPage, moderationPageSize],
  );

  useEffect(() => {
    setSubmissionPage(1);
  }, [
    filterStatus,
    filterTipo,
    searchTerm,
    submissionPageSize,
    submissionSortBy,
  ]);

  useEffect(() => {
    setStudentPage(1);
  }, [
    groupStudentsByCourse,
    studentCourseFilter,
    studentUniversityFilter,
    studentAccessTypeFilter,
    studentPageSize,
    studentSearchTerm,
    studentSortBy,
  ]);

  useEffect(() => {
    setModerationCommentPage(1);
    setModerationChatPage(1);
  }, [moderationPageSize, moderationSearchTerm]);

  const stats = {
    total: submissionsTotal || submissions.length,
    pendentes: submissions.filter((item) => item.status === "pendente").length,
    aprovados: submissions.filter((item) => item.status === "aprovado").length,
    recusados: submissions.filter((item) => item.status === "recusado").length,
    totalVotos: votesEntriesTotal || voteEntries.length,
    totalEstudantes: studentsTotal || students.length,
  };

  const economicSummary = useMemo(() => {
    const exhibitorCount = submissions.length;
    const paidValue = parseCurrencyValue(submissionConfig.paymentAmount);
    const approvedCount = submissions.filter(
      (item) => item.status === "aprovado",
    ).length;
    const confirmedPaymentCount = submissions.filter((item) =>
      isPaymentStatusConfirmed(item.paymentStatus),
    ).length;
    const projectCount = submissions.filter(
      (item) => item.tipo === "projeto",
    ).length;
    const businessCount = submissions.filter(
      (item) => item.tipo === "negocio",
    ).length;
    const productCount = submissions.filter(
      (item) => item.tipo === "produto",
    ).length;

    return {
      exhibitorCount,
      approvedCount,
      projectCount,
      businessCount,
      productCount,
      paidValue,
      projectedRevenue: exhibitorCount * paidValue,
      approvedRevenue: confirmedPaymentCount * paidValue,
    };
  }, [submissionConfig.paymentAmount, submissions]);

  const activeTabMeta =
    visibleTabs.find((tab) => tab.id === activeTab) ?? visibleTabs[0];
  const activeCredentialSubpageMeta =
    credentialSubpages.find((item) => item.id === activeCredentialSubpage) ??
    credentialSubpages[0];
  const activeSubmissionSubpageMeta =
    submissionSubpages.find((item) => item.id === activeSubmissionSubpage) ??
    submissionSubpages[0];
  const activeTabGroup = tabGroups.find((group) =>
    group.ids.includes(activeTab),
  );

  const handleExportOverviewReport = async () => {
    try {
      setExportingReport(true);
      const job = await api.reports.createOverviewPdfJob();
      await waitForPdfJobReady(() => api.reports.getOverviewPdfJob(job.id), {
        timeoutMs: 180_000,
        intervalMs: 1_500,
      });
      const pdf = await api.reports.downloadOverviewPdfJobFile(job.id);
      const blobUrl = URL.createObjectURL(pdf);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `uor-connect-relatorio-geral-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success("Relatório exportado com sucesso.");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setAccessState("unauthenticated");
        toast.warning(
          "Inicia sessão com a conta autorizada para exportar o relatório.",
        );
      } else if (isForbiddenError(error)) {
        setAccessState("forbidden");
        toast.error("Acesso negado à exportação administrativa.");
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao exportar relatório.",
        );
      }
    } finally {
      setExportingReport(false);
    }
  };

  if (accessState === "unauthenticated" || accessState === "forbidden") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb] px-4">
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1 bg-gradient-to-r from-red-500 via-red-400 to-red-300" />
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-500">
              {accessState === "forbidden" ? (
                <AlertTriangle className="h-6 w-6" />
              ) : (
                <Shield className="h-6 w-6" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                Acesso restrito
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {accessState === "forbidden"
                  ? "A tua conta não tem permissão para aceder a esta área."
                  : "Inicia sessão com uma conta autorizada."}
              </p>
            </div>
            <Button
              asChild
              className="h-10 rounded-lg bg-slate-900 hover:bg-slate-800"
            >
              <Link to="/admin/login">Entrar com conta autorizada</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const resetSpeakerForm = () => {
    setEditingSpeakerId(null);
    setSpeakerForm(defaultSpeakerForm);
  };

  const handleAuthorizeAdminStudent = async () => {
    const studentNumber = normalizeStudentNumberInput(authorizedStudentNumber);
    if (studentNumber.length < 8 || studentNumber.length > 12) {
      toast.warning("Informa um número de estudante entre 8 e 12 dígitos.");
      return;
    }

    try {
      setBusyKey("security-authorize");
      const authorizedStudent = await api.students.authorizeAdmin(
        studentNumber,
        adminAccessForm,
      );
      setAuthorizedAdminStudents((current) => {
        const next = current.filter(
          (item) => item.studentNumber !== authorizedStudent.studentNumber,
        );
        return [...next, authorizedStudent].sort((left, right) =>
          left.createdAt.localeCompare(right.createdAt),
        );
      });
      const securityOverview = await api.students.securityOverview();
      setAuthorizedAdminStudents(securityOverview.authorizedStudents);
      setAdminAccessConflicts(securityOverview.adminAccessConflicts);
      setRecentLogins(securityOverview.recentLogins);
      setAuthorizedStudentNumber("");
      setAdminAccessForm(defaultAdminAccessForm);
      toast.success("Acesso administrativo autorizado.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao autorizar estudante.",
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleRevokeAdminStudent = async (studentNumber: string) => {
    try {
      setBusyKey(`security-revoke-${studentNumber}`);
      await api.students.revokeAdmin(studentNumber);
      setAuthorizedAdminStudents((current) =>
        current.filter((item) => item.studentNumber !== studentNumber),
      );
      setAdminAccessConflicts((current) =>
        current.filter((item) => item.studentNumber !== studentNumber),
      );
      toast.success("Acesso administrativo removido.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao remover acesso administrativo.",
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleAdminAuthFailure = (error: unknown) => {
    if (isAuthError(error)) {
      setToken(null);
      setAccessState("unauthenticated");
      toast.warning("Inicia sessão com uma conta autorizada.");
      return true;
    }

    if (isForbiddenError(error)) {
      setAccessState("forbidden");
      toast.error("Acesso negado à área administrativa.");
      return true;
    }

    return false;
  };

  const handleProjectCommentDelete = async (commentId: number) => {
    try {
      setBusyKey(`comment-delete-${commentId}`);
      await api.interactions.deleteProjectComment(commentId);
      setProjectComments((current) => {
        const removed = current.find((item) => item.id === commentId);
        if (removed) {
          setVoteProjects((projects) =>
            projects.map((project) =>
              project.id === removed.submissionId
                ? {
                    ...project,
                    comentarios: Math.max(0, project.comentarios - 1),
                  }
                : project,
            ),
          );
        }

        return current.filter((item) => item.id !== commentId);
      });
      toast.success("Comentário removido.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao remover comentário.",
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleProjectCommentFeedbackReview = async (
    comment: AdminModerationProjectComment,
    action: "APPROVE" | "REJECT" | "REVOKE",
  ) => {
    const suggested =
      action === "APPROVE"
        ? "Feedback qualificado aprovado."
        : action === "REJECT"
          ? "Feedback não cumpre os critérios mínimos."
          : "Feedback revogado pela organização.";
    const note = window.prompt("Nota da revisão:", suggested)?.trim();
    if (!note) {
      toast.info("A revisão precisa de uma nota para auditoria.");
      return;
    }

    try {
      setBusyKey(`comment-feedback-${action}-${comment.id}`);
      const result = await api.interactions.reviewQualifiedFeedback(comment.id, {
        action,
        note,
      });
      setProjectComments((current) =>
        current.map((item) =>
          item.id === comment.id
            ? {
                ...item,
                moderationStatus:
                  action === "APPROVE"
                    ? "APPROVED"
                    : action === "REVOKE"
                      ? "REVOKED"
                      : "REJECTED",
                feedbackReviewNote: note,
                feedbackReviewedAt: new Date().toISOString(),
                feedbackScoredAt:
                  action === "APPROVE"
                    ? item.feedbackScoredAt ?? new Date().toISOString()
                    : item.feedbackScoredAt,
              }
            : item,
        ),
      );
      if (result.scoreDelta !== 0) {
        await handleRefreshVotes();
      }
      toast.success(
        action === "APPROVE"
          ? `Feedback aprovado: +${result.scoreDelta} ponto(s).`
          : action === "REVOKE"
            ? "Feedback revogado."
            : "Feedback rejeitado.",
      );
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao rever feedback.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleLiveChatMessageDelete = async (messageId: number) => {
    try {
      setBusyKey(`live-chat-delete-${messageId}`);
      await api.interactions.deleteLiveChatMessage(messageId);
      setLiveChatMessages((current) =>
        current.filter((item) => item.id !== messageId),
      );
      toast.success("Mensagem do mini-chat removida.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao remover mensagem do mini-chat.",
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleLiveChatMessageUpdate = async (
    messageId: number,
    data: { isPinned?: boolean; isHighlighted?: boolean; hidden?: boolean },
  ) => {
    try {
      setBusyKey(`live-chat-update-${messageId}`);
      await api.interactions.updateLiveChatMessage(messageId, data);
      setLiveChatMessages((current) =>
        current.map((item) =>
          item.id === messageId
            ? {
                ...item,
                ...(typeof data.isPinned === "boolean"
                  ? { isPinned: data.isPinned }
                  : {}),
                ...(typeof data.isHighlighted === "boolean"
                  ? { isHighlighted: data.isHighlighted }
                  : {}),
                ...(typeof data.hidden === "boolean"
                  ? { hiddenAt: data.hidden ? new Date().toISOString() : null }
                  : {}),
              }
            : item,
        ),
      );
      toast.success("Mensagem atualizada.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao atualizar mensagem.",
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const resetScheduleForm = () => {
    setEditingScheduleId(null);
    setScheduleForm(defaultScheduleForm);
  };

  const resetFaqForm = () => {
    setEditingFaqId(null);
    setFaqForm(defaultFaqForm);
  };

  const resetGuideStepForm = () => {
    setEditingGuideStepId(null);
    setGuideStepForm(defaultGuideStepForm);
  };

  const resetGuideTipForm = () => {
    setEditingGuideTipId(null);
    setGuideTipForm(defaultGuideTipForm);
  };

  const resetVenueForm = () => {
    setEditingVenueId(null);
    setVenueForm(defaultVenueForm);
  };

  const resetCourseForm = () => {
    setEditingCourseId(null);
    setCourseForm(defaultCourseForm);
  };

  const resetPanelTopicForm = () => {
    setEditingPanelTopicId(null);
    setPanelTopicForm(defaultPanelTopicForm);
  };

  const handleStatusChange = async (
    id: number,
    status: AdminSubmission["status"],
  ) => {
    try {
      await api.submissions.updateStatus(id, toBackendStatus(status));
      setSubmissions((current) =>
        current.map((item) => (item.id === id ? { ...item, status } : item)),
      );
	      setSubmissionListRows((current) =>
	        current.map((item) => (item.id === id ? { ...item, status } : item)),
	      );
	      setProjectObligationRows((current) =>
	        current.map((item) => (item.id === id ? { ...item, status } : item)),
	      );
      setVoteProjects((current) =>
        current.map((item) => (item.id === id ? { ...item, status } : item)),
      );
      toast.success(
        status === "aprovado"
          ? "Candidatura aprovada."
          : "Candidatura recusada.",
      );
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao atualizar o estado da candidatura",
        );
      }
    }
  };

  const handleSubmissionTypeChange = async (
    submission: AdminSubmission,
    tipo: AdminSubmission["tipo"],
  ) => {
    if (submission.tipo === tipo) return;

    const apiType = submissionTypeToApi(tipo);
    if (!apiType) {
      toast.error("Categoria inválida.");
      return;
    }

    const busyId = `submission-type-${submission.id}`;

    try {
      setBusyKey(busyId);
      const updated = await api.submissions.updateType(submission.id, apiType);
      const normalizedTipo = mapSubmissionType(updated.type);
      const patchSubmission = (item: AdminSubmission): AdminSubmission =>
        item.id === submission.id
          ? {
              ...item,
              tipo: normalizedTipo,
              canVote: updated.canVote,
              isWinner: updated.isWinner,
            }
          : item;

      setSubmissions((current) => current.map(patchSubmission));
      setSubmissionListRows((current) => current.map(patchSubmission));
      setProjectObligationRows((current) => current.map(patchSubmission));
      setVoteProjects((current) =>
        current.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                tipo: normalizedTipo,
                isWinner: updated.isWinner,
              }
            : item,
        ),
      );
      toast.success("Categoria da candidatura atualizada.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao atualizar a categoria da candidatura.",
        );
      }
    } finally {
      setBusyKey((current) => (current === busyId ? null : current));
    }
  };

  const handleSubmissionFreezeToggle = async (submission: AdminSubmission) => {
    const shouldFreeze = !submission.projectFrozen;
    const busyId = `submission-freeze-${submission.id}`;
    const reason = shouldFreeze
      ? window.prompt(
          `Motivo para congelar o projeto "${submission.nome}"`,
          "Projeto congelado pela organização UOR Connect. Procura a organização com urgência.",
        )
      : null;

    if (shouldFreeze && reason === null) return;

    const confirmed = window.confirm(
      shouldFreeze
        ? `Congelar o projeto "${submission.nome}" agora? Os membros ficarão bloqueados na Minha Área e ninguém poderá votar neste projeto.`
        : `Descongelar o projeto "${submission.nome}" e retomar o acesso normal?`,
    );
    if (!confirmed) return;

    try {
      setBusyKey(busyId);
      const result = shouldFreeze
        ? await api.submissions.freezeProject(submission.id, { reason })
        : await api.submissions.unfreezeProject(submission.id);
      const patchSubmission = (item: AdminSubmission): AdminSubmission =>
        item.id === submission.id
          ? {
              ...item,
              projectFrozen: result.projectFrozen,
              projectFrozenAt: result.projectFrozenAt,
              projectFrozenByStudentNumber: result.projectFrozenByStudentNumber,
              projectFreezeReason: result.projectFreezeReason,
              canVote: !result.projectFrozen && item.status === "aprovado" && item.tipo === "projeto",
            }
          : item;

      setSubmissions((current) => current.map(patchSubmission));
      setSubmissionListRows((current) => current.map(patchSubmission));
      setProjectObligationRows((current) => current.map(patchSubmission));
      setVoteProjects((current) =>
        current.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                projectFrozen: result.projectFrozen,
                projectFrozenAt: result.projectFrozenAt,
                projectFreezeReason: result.projectFreezeReason,
              }
            : item,
        ),
      );
      toast.success(result.message);
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao atualizar a suspensão do projeto.",
        );
      }
    } finally {
      setBusyKey((current) => (current === busyId ? null : current));
    }
  };

  const resolveSubmissionBannerPreview = (submission: AdminSubmission) => {
    const draftBanner = submissionBannerDrafts[submission.id];
    return draftBanner !== undefined ? draftBanner : submission.bannerUrl;
  };

  const handleSubmissionBannerFile = async (
    submission: AdminSubmission,
    file: File | null,
  ) => {
    if (!file) return;

    if (submission.status !== "aprovado") {
      toast.info(
        "A edição da capa só fica disponível quando a candidatura é aprovada.",
      );
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Seleciona um ficheiro de imagem válido.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB.");
      return;
    }

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setSubmissionBannerDrafts((current) => ({
        ...current,
        [submission.id]: dataUrl,
      }));
      toast.success('Imagem preparada. Clica em "Guardar capa" para aplicar.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao processar imagem.",
      );
    }
  };

  const handleSubmissionBannerSave = async (submission: AdminSubmission) => {
    if (submission.status !== "aprovado") {
      toast.info(
        "A edição da capa só fica disponível quando a candidatura é aprovada.",
      );
      return;
    }

    const nextBannerUrl = resolveSubmissionBannerPreview(submission) ?? null;
    const busyId = `submission-banner-save-${submission.id}`;

    try {
      setBusyKey(busyId);
      const updated = await api.submissions.updatePresentation(submission.id, {
        bannerUrl: nextBannerUrl,
      });
      setSubmissions((current) =>
        current.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                bannerUrl: updated.bannerUrl ?? null,
                primaryColor: updated.primaryColor,
                secondaryColor: updated.secondaryColor,
              }
            : item,
        ),
      );
	      setSubmissionListRows((current) =>
	        current.map((item) =>
	          item.id === submission.id
	            ? {
                ...item,
                bannerUrl: updated.bannerUrl ?? null,
                primaryColor: updated.primaryColor,
                secondaryColor: updated.secondaryColor,
              }
            : item,
	        ),
	      );
	      setProjectObligationRows((current) =>
	        current.map((item) =>
	          item.id === submission.id
	            ? {
	                ...item,
	                bannerUrl: updated.bannerUrl ?? null,
	                primaryColor: updated.primaryColor,
	                secondaryColor: updated.secondaryColor,
	              }
	            : item,
	        ),
	      );
	      setSubmissionBannerDrafts((current) => ({
        ...current,
        [submission.id]: updated.bannerUrl ?? null,
      }));
      toast.success("Capa do expositor atualizada.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao guardar capa do expositor.",
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleSpeakerAvatarFile = async (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Seleciona uma imagem válida para o palestrante.");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 6MB.");
      return;
    }

    try {
      setBusyKey("speaker-avatar");
      const dataUrl = await readCompressedImageFileAsDataUrl(file, {
        maxDimension: 900,
        maxLength: 700_000,
        minQuality: 0.45,
      });
      const stored = await api.media.uploadDataUrl(dataUrl, "avatars", {
        maxImageDimension: 900,
      });
      setSpeakerForm((current) => ({ ...current, avatarUrl: stored.url }));
      toast.success("Fotografia do palestrante guardada no storage.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao guardar fotografia do palestrante.",
      );
    } finally {
      setBusyKey((current) => (current === "speaker-avatar" ? null : current));
    }
  };

  const handleSubmissionBannerRemove = async (submission: AdminSubmission) => {
    if (submission.status !== "aprovado") {
      toast.info(
        "A edição da capa só fica disponível quando a candidatura é aprovada.",
      );
      return;
    }

    const busyId = `submission-banner-remove-${submission.id}`;

    try {
      setBusyKey(busyId);
      const updated = await api.submissions.updatePresentation(submission.id, {
        bannerUrl: null,
      });
      setSubmissions((current) =>
        current.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                bannerUrl: null,
                primaryColor: updated.primaryColor,
                secondaryColor: updated.secondaryColor,
              }
            : item,
        ),
      );
	      setSubmissionListRows((current) =>
	        current.map((item) =>
	          item.id === submission.id
	            ? {
                ...item,
                bannerUrl: null,
                primaryColor: updated.primaryColor,
                secondaryColor: updated.secondaryColor,
              }
            : item,
	        ),
	      );
	      setProjectObligationRows((current) =>
	        current.map((item) =>
	          item.id === submission.id
	            ? {
	                ...item,
	                bannerUrl: null,
	                primaryColor: updated.primaryColor,
	                secondaryColor: updated.secondaryColor,
	              }
	            : item,
	        ),
	      );
	      setSubmissionBannerDrafts((current) => ({
        ...current,
        [submission.id]: null,
      }));
      toast.success("Foto da capa removida.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao remover capa do expositor.",
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const openSubmissionTeamMembersDialog = (submission: AdminSubmission) => {
    setTeamMembersDialogSubmission(submission);
    setTeamMembersDraft(getAdminSubmissionTeamMemberNames(submission).join("\n"));
  };

  const handleSubmissionTeamMembersSave = async () => {
    if (!teamMembersDialogSubmission) return;

    const members = parseTeamMembersDraft(teamMembersDraft);
    if (members.length === 0) {
      toast.error("Indica pelo menos um membro da equipa.");
      return;
    }

    if (members.length > 17) {
      toast.error("A equipa só pode ter até 17 membros.");
      return;
    }

    const memberKeys = new Set(members.map(normalizeTeamMemberDraftKey));
    if (memberKeys.size !== members.length) {
      toast.error("Remove nomes repetidos antes de guardar a equipa.");
      return;
    }

    try {
      setSavingTeamMembersId(teamMembersDialogSubmission.id);
      const payload = await api.submissions.updateTeamMembers(
        teamMembersDialogSubmission.id,
        members,
      );

      const patchSubmission = (item: AdminSubmission): AdminSubmission =>
        item.id === teamMembersDialogSubmission.id
          ? {
              ...item,
              equipa: payload.members ?? "",
              teamInviteUrl: payload.teamInviteUrl,
              teamJourneyLabel: payload.teamJourneyLabel,
              teamTotalMembers: payload.teamTotalMembers,
              teamConfirmedMembers: payload.teamConfirmedMembers,
              teamAllConfirmed: payload.teamAllConfirmed,
              teamMembers: payload.teamMembers,
            }
          : item;

	      setSubmissions((current) => current.map(patchSubmission));
	      setSubmissionListRows((current) => current.map(patchSubmission));
	      setProjectObligationRows((current) => current.map(patchSubmission));
	      setVoteProjects((current) =>
        current.map((item) =>
          item.id === teamMembersDialogSubmission.id
            ? { ...item, equipa: payload.members ?? "Equipa por confirmar" }
            : item,
        ),
      );
      toast.success("Lista de membros atualizada.");
      setTeamMembersDialogSubmission(null);
      setTeamMembersDraft("");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao atualizar a lista de membros.",
        );
      }
    } finally {
      setSavingTeamMembersId(null);
    }
  };

  const handleConfirmSubmissionTeamMemberFromAdmin = async (
    submission: AdminSubmission,
    member: SubmissionTeamMember,
  ) => {
    if (!member.expectedStudentNumber) {
      toast.info("Indica primeiro o número de estudante deste membro.");
      return;
    }

    const busy = `submission-team-confirm-${submission.id}-${member.id}`;
    try {
      setBusyKey(busy);
      const payload = await api.submissions.confirmTeamMemberFromAdmin(
        submission.id,
        member.id,
      );

      const patchSubmission = (item: AdminSubmission): AdminSubmission =>
        item.id === submission.id
          ? {
              ...item,
              teamInviteUrl: payload.inviteUrl,
              teamJourneyLabel: payload.journeyLabel,
              teamTotalMembers: payload.totalMembers,
              teamConfirmedMembers: payload.confirmedMembers,
              teamAllConfirmed: payload.allConfirmed,
              teamMembers: payload.members,
            }
          : item;

	      setSubmissions((current) => current.map(patchSubmission));
	      setSubmissionListRows((current) => current.map(patchSubmission));
	      setProjectObligationRows((current) => current.map(patchSubmission));
	      setTeamMembersDialogSubmission((current) =>
        current && current.id === submission.id ? patchSubmission(current) : current,
      );
      toast.success("Membro confirmado com dados da Secretaria.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível confirmar este membro.",
        );
      }
    } finally {
      setBusyKey((current) => (current === busy ? null : current));
    }
  };

  const handleMarkTeamMemberExternalException = async (
    submission: AdminSubmission,
    member: SubmissionTeamMember,
  ) => {
    const externalOrganization = window.prompt(
      "Universidade/organização do membro:",
      member.externalOrganization ?? "Outra instituição",
    )?.trim();
    const phone = window.prompt(
      "Telefone do membro externo:",
      "",
    )?.trim();
    const externalReason = window.prompt(
      "Motivo da confirmação externa:",
      member.externalReason ?? "Membro externo ou sem acesso ao sistema académico comunicado à organização.",
    )?.trim();

    if (!externalOrganization) {
      toast.info("Indica a universidade ou instituto médio do membro.");
      return;
    }

    if (!phone || phone.replace(/\D/g, "").length < 8) {
      toast.info("Indica um telefone válido para gerar o acesso.");
      return;
    }

    if (!externalReason) {
      toast.info("A confirmação externa precisa de um motivo para auditoria.");
      return;
    }

    const busy = `submission-team-external-${submission.id}-${member.id}`;
    try {
      setBusyKey(busy);
      const payload = await api.submissions.confirmTeamMemberExternalFromAdmin(
        submission.id,
        member.id,
        {
          name: member.name,
          phone,
          externalOrganization,
          externalReason,
        },
      );

      const patchSubmission = (item: AdminSubmission): AdminSubmission =>
        item.id === submission.id
          ? {
              ...item,
              teamInviteUrl: payload.teamInviteUrl,
              teamJourneyLabel: payload.teamJourneyLabel,
              teamTotalMembers: payload.teamTotalMembers,
              teamConfirmedMembers: payload.teamConfirmedMembers,
              teamAllConfirmed: payload.teamAllConfirmed,
              teamMembers: payload.teamMembers,
            }
          : item;

	      setSubmissions((current) => current.map(patchSubmission));
	      setSubmissionListRows((current) => current.map(patchSubmission));
	      setProjectObligationRows((current) => current.map(patchSubmission));
	      setTeamMembersDialogSubmission((current) =>
        current && current.id === submission.id ? patchSubmission(current) : current,
      );
      toast.success(
        `Membro externo confirmado. Nº ${payload.credentials.studentNumber} · senha temporária ${payload.credentials.temporaryPassword}`,
      );
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível confirmar o membro externo.",
        );
      }
    } finally {
      setBusyKey((current) => (current === busy ? null : current));
    }
  };

  const handleDownloadExhibitorManual = async (submission: AdminSubmission) => {
    const busy = `submission-manual-${submission.id}`;
    try {
      setBusyKey(busy);
      const blob = await api.submissions.exhibitorPdf(submission.id);
      const fileBase = submission.referenceCode
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      downloadBlobFile(
        blob,
        `${fileBase || `projeto-${submission.id}`}-manual-expositor.pdf`,
      );
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível baixar o manual do expositor.",
        );
      }
    } finally {
      setBusyKey((current) => (current === busy ? null : current));
    }
  };

  const handleSendProjectObligationNotices = async () => {
    if (projectObligationNoticeTargets.length === 0) {
      toast.info("Não há projetos pendentes para este tipo de aviso.");
      return;
    }

    setSendingProjectObligationNotices(true);
    setProjectObligationNoticeResult(null);

    const result: ProjectObligationNoticeResult = {
      processedProjects: 0,
      skippedProjects: 0,
      totalRecipients: 0,
      successCount: 0,
      failedCount: 0,
      failures: [],
    };

    for (const submission of projectObligationNoticeTargets) {
      try {
        const recipientsPayload =
          await api.submissions.exhibitorPdfRecipients(submission.id);
        const selectedPhones = uniqueProjectObligationPhones(
          recipientsPayload.recipients,
        );

        if (selectedPhones.length === 0) {
          result.skippedProjects += 1;
          result.failures.push(
            `${submission.nome}: nenhum contacto confirmado com telefone.`,
          );
          continue;
        }

        const message = buildProjectObligationMessage(
          submission,
          projectObligationNoticeType,
        );
        result.processedProjects += 1;
        const title = projectObligationNoticeCampaignTitle(
          submission,
          projectObligationNoticeType,
        );
        const audience = {
          type: "SELECTED_STUDENTS" as const,
          selectedPhones,
        };

        if (projectObligationChannelUsesSms(projectObligationNoticeChannel)) {
          try {
            const payload = await api.sms.sendCampaign({
              title,
              sender: "UOR CONNECT",
              message,
              audience,
            });
            result.totalRecipients += payload.totalRecipients;
            result.successCount += payload.successCount;
            result.failedCount += payload.failedCount;
            for (const failure of payload.failures.slice(0, 3)) {
              result.failures.push(`${submission.nome} (SMS): ${failure.reason}`);
            }
          } catch (error) {
            result.totalRecipients += selectedPhones.length;
            result.failedCount += selectedPhones.length;
            result.failures.push(
              `${submission.nome} (SMS): ${
                error instanceof Error
                  ? error.message
                  : "não foi possível enviar o aviso."
              }`,
            );
          }
        }

        if (projectObligationChannelUsesWhatsApp(projectObligationNoticeChannel)) {
          try {
            const payload = await api.whatsapp.sendCampaign({
              title,
              message,
              audience,
            });
            result.totalRecipients += payload.totalRecipients;
            result.successCount += payload.successCount;
            result.failedCount += payload.failedCount;
            for (const failure of payload.failures.slice(0, 3)) {
              result.failures.push(`${submission.nome} (WhatsApp): ${failure.reason}`);
            }
          } catch (error) {
            result.totalRecipients += selectedPhones.length;
            result.failedCount += selectedPhones.length;
            result.failures.push(
              `${submission.nome} (WhatsApp): ${
                error instanceof Error
                  ? error.message
                  : "não foi possível enviar o aviso."
              }`,
            );
          }
        }
      } catch (error) {
        result.skippedProjects += 1;
        result.failures.push(
          `${submission.nome}: ${
            error instanceof Error
              ? error.message
              : "não foi possível enviar o aviso."
          }`,
        );
      }
    }

    setProjectObligationNoticeResult({
      ...result,
      failures: result.failures.slice(0, 8),
    });
    setSendingProjectObligationNotices(false);

    if (result.successCount > 0) {
      toast.success(
        `Avisos enviados: ${result.successCount}/${result.totalRecipients} envio(s) entregues ao provedor.`,
      );
      return;
    }

    toast.warning(
      "Nenhum aviso foi enviado. Verifica contactos confirmados e as centrais SMS/WhatsApp.",
    );
  };

  const hasValidSubmissionConfig = () => {
    if (
      !submissionConfig.iban ||
      !submissionConfig.accountName ||
      !submissionConfig.paymentAmount
    ) {
      toast.error("Preenche IBAN, nome da conta e valor da candidatura.");
      return false;
    }

    return true;
  };

  const buildSubmissionConfigPayload = (isOpen = submissionConfig.isOpen) => ({
    ...submissionConfig,
    isOpen,
    paymentInstructions:
      normalizeOptionalText(submissionConfig.paymentInstructions) || null,
    projectCommunityUrl:
      normalizeOptionalText(submissionConfig.projectCommunityUrl) || null,
    businessCommunityUrl:
      normalizeOptionalText(submissionConfig.businessCommunityUrl) || null,
    productCommunityUrl:
      normalizeOptionalText(submissionConfig.productCommunityUrl) || null,
  });

  const applySubmissionConfig = (saved: SubmissionConfig) => {
    setSubmissionConfig({
      isOpen: saved.isOpen,
      iban: saved.iban,
      accountName: saved.accountName,
      paymentAmount: saved.paymentAmount,
      paymentInstructions: saved.paymentInstructions,
      projectCommunityUrl: saved.projectCommunityUrl,
      businessCommunityUrl: saved.businessCommunityUrl,
      productCommunityUrl: saved.productCommunityUrl,
    });
  };

  const handleSubmissionConfigSave = async () => {
    if (!hasValidSubmissionConfig()) return;

    setBusyKey("submission-config");
    try {
      const saved = await api.submissions.updateConfig(
        buildSubmissionConfigPayload(),
      );
      applySubmissionConfig(saved);
      toast.success("Configuração de candidatura atualizada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao atualizar configuração da candidatura",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleSubmissionOpenStateUpdate = async (isOpen: boolean) => {
    if (!hasValidSubmissionConfig()) return;

    const previousConfig = submissionConfig;
    setSubmissionConfig((current) => ({ ...current, isOpen }));
    setBusyKey("submission-config-open-state");
    try {
      const saved = await api.submissions.updateConfig(
        buildSubmissionConfigPayload(isOpen),
      );
      applySubmissionConfig(saved);
      toast.success(
        isOpen ? "Candidaturas reabertas." : "Candidaturas encerradas.",
      );
    } catch (error) {
      setSubmissionConfig(previousConfig);
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao atualizar o estado das candidaturas",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemoveStudent = async (student: StudentWithStats) => {
    try {
      setIsRemovingStudent(true);
      await api.students.remove(student.id);
      setStudents((current) =>
        current.filter((item) => item.id !== student.id),
      );
      setStudentListRows((current) =>
        current.filter((item) => item.id !== student.id),
      );
      setStudentsTotal((current) => Math.max(0, current - 1));
      setVoteEntries((current) =>
        current.filter((item) => item.studentId !== student.id),
      );
      setStudentPendingRemoval(null);
      toast.success("Estudante removido da base de dados");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao remover estudante",
      );
    } finally {
      setIsRemovingStudent(false);
    }
  };

  const handleRemoveSubmission = async (submission: AdminSubmission) => {
    try {
      setIsRemovingSubmission(true);
      await api.submissions.remove(submission.id);
      setSubmissions((current) =>
        current.filter((item) => item.id !== submission.id),
      );
      setSubmissionListRows((current) =>
        current.filter((item) => item.id !== submission.id),
      );
      setSubmissionsTotal((current) => Math.max(0, current - 1));
      setVoteProjects((current) =>
        current.filter((item) => item.id !== submission.id),
      );
      setSelectedWinners((current) => ({
        ...current,
        projectWinner:
          current.projectWinner === submission.id
            ? null
            : current.projectWinner,
      }));
      setSubmissionPendingRemoval(null);
      toast.success("Expositor removido da base de dados e da área pública.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error ? error.message : "Falha ao remover expositor",
        );
      }
    } finally {
      setIsRemovingSubmission(false);
    }
  };

  const handleSelectWinner = async (projectId: number) => {
    try {
      await api.submissions.selectWinner(projectId);
      setSelectedWinners((current) => ({
        ...current,
        projectWinner: projectId,
      }));
      setSubmissions((current) =>
        current.map((item) => ({ ...item, isWinner: item.id === projectId })),
      );
      setSubmissionListRows((current) =>
        current.map((item) => ({ ...item, isWinner: item.id === projectId })),
      );
      setVoteProjects((current) =>
        current.map((item) => ({ ...item, isWinner: item.id === projectId })),
      );
      toast.success("Projeto académico vencedor atualizado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao definir vencedor",
      );
    }
  };

  const handleClearWinner = async () => {
    try {
      await api.submissions.clearWinner();
      setSelectedWinners((current) => ({ ...current, projectWinner: null }));
      setSubmissions((current) =>
        current.map((item) => ({ ...item, isWinner: false })),
      );
      setSubmissionListRows((current) =>
        current.map((item) => ({ ...item, isWinner: false })),
      );
      setVoteProjects((current) =>
        current.map((item) => ({ ...item, isWinner: false })),
      );
      toast.success("Projeto académico vencedor removido.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao desclassificar vencedor",
      );
    }
  };

  const loadCourseEnrollmentsPage = async (courseId: number, page: number) => {
    try {
      setLoadingCourseId(courseId);
      const payload = await api.courses.enrollmentsPaged(courseId, {
        page,
        limit: 30,
      });
      setCourseEnrollments((current) => ({ ...current, [courseId]: payload }));
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao carregar inscritos do curso",
        );
      }
    } finally {
      setLoadingCourseId(null);
    }
  };

  const handleToggleCourseEnrollments = async (course: Course) => {
    const isOpen = expandedCourseId === course.id;

    if (isOpen) {
      setExpandedCourseId(null);
      return;
    }

    setExpandedCourseId(course.id);

    if (courseEnrollments[course.id]) return;
    await loadCourseEnrollmentsPage(course.id, 1);
  };

  const updateCourseEnrollmentForm = (
    courseId: number,
    patch: Partial<CourseEnrollmentInput>,
  ) => {
    setCourseEnrollmentForms((current) => ({
      ...current,
      [courseId]: {
        ...(current[courseId] ?? defaultCourseEnrollmentForm),
        ...patch,
      },
    }));
  };

  const resetCourseEnrollmentForm = (courseId: number) => {
    setCourseEnrollmentForms((current) => ({
      ...current,
      [courseId]: defaultCourseEnrollmentForm,
    }));
    setEditingCourseEnrollmentId(null);
  };

  const refreshCoursesList = async () => {
    const courseData = await api.courses.list(true);
    setCourses(courseData.courses);
  };

  const handleEditCourseEnrollment = (
    courseId: number,
    entry: CourseEnrollmentsPagedPayload["enrollments"][number],
  ) => {
    setEditingCourseEnrollmentId(entry.id);
    setCourseEnrollmentForms((current) => ({
      ...current,
      [courseId]: {
        studentNumber: entry.studentNumber,
        fullName: entry.fullName,
        studentCourse: entry.course ?? "",
        phone: entry.phone ?? "",
        paymentPhone: entry.paymentPhone ?? "",
        paymentStatus: entry.paymentStatus,
        note: entry.paymentReviewNote ?? "",
      },
    }));
  };

  const handleCourseEnrollmentSubmit = async (courseId: number) => {
    const form = courseEnrollmentForms[courseId] ?? defaultCourseEnrollmentForm;
    const studentNumber = form.studentNumber.replace(/\D/g, "");
    if (!studentNumber) {
      toast.info(
        "Indica o número de estudante para ligar o participante ao curso.",
      );
      return;
    }

    const busy = editingCourseEnrollmentId
      ? `course-enrollment-save-${editingCourseEnrollmentId}`
      : `course-enrollment-create-${courseId}`;
    try {
      setBusyKey(busy);
      if (editingCourseEnrollmentId) {
        await api.courses.updateEnrollment(editingCourseEnrollmentId, {
          ...form,
          studentNumber,
        });
        toast.success("Participante atualizado.");
      } else {
        await api.courses.createEnrollment(courseId, {
          ...form,
          studentNumber,
        });
        toast.success("Participante adicionado ao curso.");
      }

      resetCourseEnrollmentForm(courseId);
      await Promise.all([
        loadCourseEnrollmentsPage(
          courseId,
          courseEnrollments[courseId]?.page ?? 1,
        ),
        refreshCoursesList(),
      ]);
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao guardar participante do curso.",
        );
      }
    } finally {
      setBusyKey((current) => (current === busy ? null : current));
    }
  };

  const handleCourseEnrollmentRemove = async (
    courseId: number,
    enrollmentId: number,
    fullName: string,
  ) => {
    const busy = `course-enrollment-remove-${enrollmentId}`;
    try {
      setBusyKey(busy);
      await api.courses.removeEnrollment(enrollmentId);
      toast.success("Participante removido do curso.");
      setCourseEnrollmentPendingRemoval(null);
      if (editingCourseEnrollmentId === enrollmentId)
        resetCourseEnrollmentForm(courseId);
      await Promise.all([
        loadCourseEnrollmentsPage(
          courseId,
          courseEnrollments[courseId]?.page ?? 1,
        ),
        refreshCoursesList(),
      ]);
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao remover participante.",
        );
      }
    } finally {
      setBusyKey((current) => (current === busy ? null : current));
    }
  };

  const handleExportCourseEnrollments = async (course: Course) => {
    try {
      setExportingCourseId(course.id);
      const job = await api.courses.createEnrollmentsPdfJob(course.id);
      await waitForPdfJobReady(
        () => api.courses.getEnrollmentsPdfJob(course.id, job.id),
        { timeoutMs: 180_000, intervalMs: 1_500 },
      );
      const pdf = await api.courses.downloadEnrollmentsPdfJobFile(
        course.id,
        job.id,
      );
      downloadBlob(
        pdf,
        `uor-connect-${course.name.toLowerCase().replace(/\s+/g, "-")}-inscritos-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
      toast.success("Relatório do curso exportado com sucesso.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao exportar relatório do curso",
        );
      }
    } finally {
      setExportingCourseId(null);
    }
  };

  const handleEnrollmentStatusUpdate = async (
    courseId: number,
    enrollmentId: number,
    status: CourseEnrollmentStatus,
  ) => {
    try {
      setUpdatingEnrollmentStatusId(enrollmentId);
      const note = coursePaymentReviewNotes[enrollmentId]?.trim() || null;
      const payload = await api.courses.updateEnrollmentStatus(
        enrollmentId,
        status,
        note,
      );
      setCourseEnrollments((current) => {
        const currentCourse = current[courseId];
        if (!currentCourse) return current;

        return {
          ...current,
          [courseId]: {
            ...currentCourse,
            enrollments: currentCourse.enrollments.map((entry) =>
              entry.id === enrollmentId ? payload.enrollment : entry,
            ),
          },
        };
      });
      if (["CONFIRMED_BY_ADMIN", "REJECTED", "CANCELED"].includes(status)) {
        setCoursePaymentReviewNotes((current) => ({
          ...current,
          [enrollmentId]: "",
        }));
      }
      toast.success(
        `Estado da inscrição atualizado para ${courseEnrollmentStatusLabel[status].toLowerCase()}.`,
      );
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao atualizar estado da inscrição",
        );
      }
    } finally {
      setUpdatingEnrollmentStatusId(null);
    }
  };

  const handleSubmissionPaymentStatusUpdate = async (
    submissionId: number,
    status: CourseEnrollmentStatus,
  ) => {
    const busy = `submission-payment-${submissionId}`;
    try {
      setBusyKey(busy);
      const note = submissionPaymentReviewNotes[submissionId]?.trim() || null;
      const payload = await api.submissions.updatePaymentStatus(
        submissionId,
        status,
        note,
      );
      const patchSubmission = (item: AdminSubmission): AdminSubmission =>
        item.id === submissionId
          ? {
              ...item,
              paymentStatus: payload.paymentStatus,
              paymentStatusLabel: payload.paymentStatusLabel,
              paymentReviewedAt: payload.paymentReviewedAt,
              paymentReviewedByStudentNumber:
                payload.paymentReviewedByStudentNumber,
              paymentReviewNote: payload.paymentReviewNote,
            }
          : item;

	      setSubmissions((current) => current.map(patchSubmission));
	      setSubmissionListRows((current) => current.map(patchSubmission));
	      setProjectObligationRows((current) => current.map(patchSubmission));
	      if (["CONFIRMED_BY_ADMIN", "REJECTED", "CANCELED"].includes(status)) {
        setSubmissionPaymentReviewNotes((current) => ({
          ...current,
          [submissionId]: "",
        }));
      }
      toast.success(
        `Pagamento atualizado para ${courseEnrollmentStatusLabel[status].toLowerCase()}.`,
      );
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao atualizar estado financeiro da candidatura",
        );
      }
    } finally {
      setBusyKey((current) => (current === busy ? null : current));
    }
  };

  const handleSpeakerSubmit = async () => {
    if (
      !speakerForm.name ||
      !speakerForm.bio ||
      !speakerForm.specialty ||
      !speakerForm.talk ||
      !speakerForm.day ||
      !speakerForm.linkedin
    ) {
      toast.error("Preenche todos os campos obrigatórios do palestrante");
      return;
    }

    setBusyKey("speaker");
    try {
      const payload = {
        ...speakerForm,
        avatarUrl: normalizeOptionalText(speakerForm.avatarUrl) || null,
      };
      const speaker = editingSpeakerId
        ? await api.speakers.update(editingSpeakerId, payload)
        : await api.speakers.create(payload);

      setSpeakers((current) => {
        const next = editingSpeakerId
          ? current.map((item) => (item.id === speaker.id ? speaker : item))
          : [...current, speaker];
        return [...next].sort((left, right) =>
          left.name.localeCompare(right.name),
        );
      });
      toast.success(
        editingSpeakerId ? "Palestrante atualizado." : "Palestrante criado.",
      );
      resetSpeakerForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao guardar palestrante",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleSpeakerDelete = async (id: number) => {
    setBusyKey(`speaker-delete-${id}`);
    try {
      await api.speakers.remove(id);
      setSpeakers((current) => current.filter((item) => item.id !== id));
      if (editingSpeakerId === id) resetSpeakerForm();
      toast.success("Palestrante removido.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao remover palestrante",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleAgendaSubmit = async () => {
    if (
      !scheduleForm.date ||
      !scheduleForm.startTime ||
      !scheduleForm.endTime ||
      !scheduleForm.title ||
      !scheduleForm.local ||
      !scheduleForm.description ||
      !scheduleForm.theme
    ) {
      toast.error("Preenche os campos obrigatórios da agenda");
      return;
    }

    setBusyKey("agenda");
    try {
      const item = editingScheduleId
        ? await api.agenda.update(editingScheduleId, scheduleForm)
        : await api.agenda.create(scheduleForm);

      setSchedule((current) => {
        const next = editingScheduleId
          ? current.map((entry) => (entry.id === item.id ? item : entry))
          : [...current, item];
        return [...next].sort(
          (left, right) =>
            new Date(
              `${left.date.slice(0, 10)}T${left.startTime}:00`,
            ).getTime() -
            new Date(
              `${right.date.slice(0, 10)}T${right.startTime}:00`,
            ).getTime(),
        );
      });
      setLiveState(await api.agenda.live());
      toast.success(
        editingScheduleId ? "Sessão atualizada." : "Sessão criada.",
      );
      resetScheduleForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao guardar agenda",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleAgendaDelete = async (id: number) => {
    setBusyKey(`agenda-delete-${id}`);
    try {
      await api.agenda.remove(id);
      setSchedule((current) => current.filter((item) => item.id !== id));
      setLiveState(await api.agenda.live());
      if (editingScheduleId === id) resetScheduleForm();
      toast.success("Sessão removida.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao remover sessão",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleLiveConfigSave = async () => {
    if (liveConfigForm.mode === "MANUAL") {
      const current = liveConfigForm.current;
      if (
        !current ||
        !current.date ||
        !current.startTime ||
        !current.endTime ||
        !current.title ||
        !current.local ||
        !current.description ||
        !current.theme
      ) {
        toast.error("Preenche os campos obrigatórios do conteúdo ao vivo.");
        return;
      }
      if (!isGeneralAgendaTheme(current.theme)) {
        toast.error('O Ao Vivo só aceita conteúdos com o tema "Geral".');
        return;
      }
    }

    try {
      setBusyKey("live-config");
      const saved = await api.agenda.updateLiveConfig({
        mode: liveConfigForm.mode,
        current:
          liveConfigForm.mode === "MANUAL" ? liveConfigForm.current : null,
      });
      const [nextLiveState, nextSchedule] = await Promise.all([
        api.agenda.live(),
        api.agenda.list(),
      ]);
      setLiveState(nextLiveState);
      setSchedule(nextSchedule);
      setLiveConfigForm({
        mode: saved.mode,
        current: saved.current ?? defaultLiveConfigForm.current,
      });
      toast.success(
        saved.mode === "MANUAL"
          ? "Conteúdo ao vivo atualizado e sincronizado com a agenda atual."
          : "Ao Vivo voltou a seguir a agenda.",
      );
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao guardar conteúdo ao vivo.",
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleFaqSubmit = async () => {
    if (!faqForm.question || !faqForm.answer) {
      toast.error("Preenche pergunta e resposta");
      return;
    }

    setBusyKey("faq");
    try {
      const payload = {
        question: faqForm.question,
        answer: faqForm.answer,
        sortOrder: faqForm.sortOrder ?? 0,
        isPublished: faqForm.isPublished ?? true,
      };
      const item = editingFaqId
        ? await api.faq.update(editingFaqId, payload)
        : await api.faq.create(payload);
      setFaqItems((current) => {
        const next = editingFaqId
          ? current.map((entry) => (entry.id === item.id ? item : entry))
          : [...current, item];
        return [...next].sort(
          (left, right) => left.sortOrder - right.sortOrder,
        );
      });
      toast.success(editingFaqId ? "FAQ atualizada." : "FAQ criada.");
      resetFaqForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao guardar FAQ",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleFaqDelete = async (id: number) => {
    setBusyKey(`faq-delete-${id}`);
    try {
      await api.faq.remove(id);
      setFaqItems((current) => current.filter((item) => item.id !== id));
      if (editingFaqId === id) resetFaqForm();
      toast.success("FAQ removida.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao remover FAQ",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleGuideStepSubmit = async () => {
    if (
      !guideStepForm.title ||
      !guideStepForm.description ||
      !guideStepForm.icon
    ) {
      toast.error("Preenche os campos do passo do guia");
      return;
    }

    setBusyKey("guide-step");
    try {
      const payload = {
        ...guideStepForm,
        link: normalizeOptionalText(guideStepForm.link) || null,
        linkText: normalizeOptionalText(guideStepForm.linkText) || null,
      };
      const step = editingGuideStepId
        ? await api.guide.updateStep(editingGuideStepId, payload)
        : await api.guide.createStep(payload);
      setGuideContent((current) => ({
        ...current,
        steps: [
          ...(editingGuideStepId
            ? current.steps.map((item) => (item.id === step.id ? step : item))
            : [...current.steps, step]),
        ].sort((left, right) => left.sortOrder - right.sortOrder),
      }));
      toast.success(editingGuideStepId ? "Passo atualizado." : "Passo criado.");
      resetGuideStepForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao guardar passo",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleGuideTipSubmit = async () => {
    if (!guideTipForm.content) {
      toast.error("Preenche o conteúdo da dica");
      return;
    }

    setBusyKey("guide-tip");
    try {
      const tip = editingGuideTipId
        ? await api.guide.updateTip(editingGuideTipId, guideTipForm)
        : await api.guide.createTip(guideTipForm);
      setGuideContent((current) => ({
        ...current,
        tips: [
          ...(editingGuideTipId
            ? current.tips.map((item) => (item.id === tip.id ? tip : item))
            : [...current.tips, tip]),
        ].sort((left, right) => left.sortOrder - right.sortOrder),
      }));
      toast.success(editingGuideTipId ? "Dica atualizada." : "Dica criada.");
      resetGuideTipForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao guardar dica",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleVenueSubmit = async () => {
    if (
      !venueForm.name ||
      !venueForm.description ||
      !venueForm.capacity ||
      !venueForm.floor
    ) {
      toast.error("Preenche os campos do local");
      return;
    }

    setBusyKey("venue");
    try {
      const venue = editingVenueId
        ? await api.guide.updateVenue(editingVenueId, venueForm)
        : await api.guide.createVenue(venueForm);
      setGuideContent((current) => ({
        ...current,
        venues: [
          ...(editingVenueId
            ? current.venues.map((item) =>
                item.id === venue.id ? venue : item,
              )
            : [...current.venues, venue]),
        ].sort((left, right) => left.sortOrder - right.sortOrder),
      }));
      toast.success(editingVenueId ? "Local atualizado." : "Local criado.");
      resetVenueForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao guardar local",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleGuideStepDelete = async (id: number) => {
    setBusyKey(`guide-step-delete-${id}`);
    try {
      await api.guide.removeStep(id);
      setGuideContent((current) => ({
        ...current,
        steps: current.steps.filter((item) => item.id !== id),
      }));
      if (editingGuideStepId === id) resetGuideStepForm();
      toast.success("Passo removido.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao remover passo",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleGuideTipDelete = async (id: number) => {
    setBusyKey(`guide-tip-delete-${id}`);
    try {
      await api.guide.removeTip(id);
      setGuideContent((current) => ({
        ...current,
        tips: current.tips.filter((item) => item.id !== id),
      }));
      if (editingGuideTipId === id) resetGuideTipForm();
      toast.success("Dica removida.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao remover dica",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleVenueDelete = async (id: number) => {
    setBusyKey(`venue-delete-${id}`);
    try {
      await api.guide.removeVenue(id);
      setGuideContent((current) => ({
        ...current,
        venues: current.venues.filter((item) => item.id !== id),
      }));
      if (editingVenueId === id) resetVenueForm();
      toast.success("Local removido.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao remover local",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleCourseSubmit = async () => {
    if (
      !courseForm.name ||
      !courseForm.description ||
      !courseForm.companyName ||
      !courseForm.companyCategory ||
      !courseForm.courseColor ||
      !courseForm.accentColor ||
      !courseForm.accentColorSecondary
    ) {
      toast.error("Preenche os campos do curso");
      return;
    }

    setBusyKey("course");
    try {
      const payload = {
        ...courseForm,
        preview: normalizeOptionalText(courseForm.preview) || null,
        communityUrl: normalizeOptionalText(courseForm.communityUrl) || null,
        companyLogoUrl:
          normalizeOptionalText(courseForm.companyLogoUrl) || null,
        companyWebsite:
          normalizeOptionalText(courseForm.companyWebsite) || null,
        companyInstagram:
          normalizeOptionalText(courseForm.companyInstagram) || null,
        companyLinkedin:
          normalizeOptionalText(courseForm.companyLinkedin) || null,
        priceLabel:
          normalizeOptionalText(courseForm.priceLabel) ||
          (courseForm.isPaid ? "Pago" : "Gratuito"),
      };
      const course = editingCourseId
        ? await api.courses.update(editingCourseId, payload)
        : await api.courses.create(payload);
      setCourses((current) =>
        [
          ...(editingCourseId
            ? current.map((item) => (item.id === course.id ? course : item))
            : [...current, course]),
        ].sort((left, right) => left.sortOrder - right.sortOrder),
      );
      toast.success(editingCourseId ? "Curso atualizado." : "Curso criado.");
      resetCourseForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao guardar curso",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleCourseDelete = async (course: Course) => {
    const id = course.id;
    setBusyKey(`course-delete-${id}`);
    try {
      await api.courses.remove(id);
      setCourses((current) => current.filter((item) => item.id !== id));
      setCourseEnrollments((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setExpandedCourseId((current) => (current === id ? null : current));
      if (editingCourseId === id) resetCourseForm();
      setCoursePendingRemoval(null);
      toast.success("Curso removido.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao remover curso",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handlePanelTopicSubmit = async () => {
    if (
      !panelTopicForm.title ||
      !panelTopicForm.description ||
      !panelTopicForm.speaker ||
      !panelTopicForm.time ||
      !panelTopicForm.local ||
      !panelTopicForm.day ||
      !panelTopicForm.dateLabel ||
      !panelTopicForm.icon ||
      !panelTopicForm.type
    ) {
      toast.error("Preenche os campos do painel");
      return;
    }

    setBusyKey("panel-topic");
    try {
      const panel = editingPanelTopicId
        ? await api.homeContent.updatePanel(editingPanelTopicId, panelTopicForm)
        : await api.homeContent.createPanel(panelTopicForm);
      setPanelTopics((current) =>
        [
          ...(editingPanelTopicId
            ? current.map((item) => (item.id === panel.id ? panel : item))
            : [...current, panel]),
        ].sort((left, right) => left.sortOrder - right.sortOrder),
      );
      toast.success(
        editingPanelTopicId ? "Painel atualizado." : "Painel criado.",
      );
      resetPanelTopicForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao guardar painel",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handlePanelTopicDelete = async (id: number) => {
    setBusyKey(`panel-topic-delete-${id}`);
    try {
      await api.homeContent.removePanel(id);
      setPanelTopics((current) => current.filter((item) => item.id !== id));
      if (editingPanelTopicId === id) resetPanelTopicForm();
      toast.success("Painel removido.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao remover painel",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleSocialConfigSave = async () => {
    setBusyKey("social-config");
    try {
      const saved = await api.homeContent.updateSocialConfig({
        instagramUrl:
          normalizeOptionalText(socialConfigForm.instagramUrl) || null,
        facebookUrl:
          normalizeOptionalText(socialConfigForm.facebookUrl) || null,
        linkedinUrl:
          normalizeOptionalText(socialConfigForm.linkedinUrl) || null,
        courseEnrollmentEnabled: socialConfigForm.courseEnrollmentEnabled,
        firstYearContestEnabled: socialConfigForm.firstYearContestEnabled,
        primaryColor: socialConfigForm.primaryColor,
        primaryGradient: socialConfigForm.primaryGradient,
        titleColor: socialConfigForm.titleColor,
        accentColor: socialConfigForm.accentColor,
        dashedColor: socialConfigForm.dashedColor,
        dashedOpacity: socialConfigForm.dashedOpacity,
        heroIconsOpacity: socialConfigForm.heroIconsOpacity,
        heroBlobsIntensity: socialConfigForm.heroBlobsIntensity,
        heroMeshEnabled: socialConfigForm.heroMeshEnabled,
        heroFloatingIcons: socialConfigForm.heroFloatingIcons,
        sponsors: socialConfigForm.sponsors,
      });

      setSocialConfigForm(toSocialConfigForm(saved));
      toast.success("Ícones e patrocinadores atualizados.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao guardar configurações do evento",
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleRefreshVotes = async () => {
    try {
      setBusyKey("votes-refresh");
      const snapshot = await api.interactions.adminVotesPaged({
        projectsPage: votesProjectsPage,
        projectsLimit: votesProjectsPageSize,
        votesPage: votesEntriesPage,
        votesLimit: votesEntriesPageSize,
      });
      setProjectVotingPaused(snapshot.control.votingPaused);
      applyVoteSnapshot(
        {
          projects: snapshot.projects.items,
          votes: snapshot.votes.items,
          courses: snapshot.courses,
        },
        submissions,
        {
          projects: {
            page: snapshot.projects.page,
            total: snapshot.projects.total,
            totalPages: snapshot.projects.totalPages,
          },
          votes: {
            page: snapshot.votes.page,
            total: snapshot.votes.total,
            totalPages: snapshot.votes.totalPages,
          },
        },
      );
      toast.success("Votação sincronizada com o banco de dados.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error ? error.message : "Falha ao atualizar votação",
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleQuickScoreEvent = async (
    project: VoteProjectSummary,
    action: ExhibitorScoreAdjustmentAction,
    points: number,
    suggestedReason: string,
  ) => {
    const reason = window.prompt("Motivo da pontuação:", suggestedReason)?.trim();
    if (!reason) {
      toast.info("A pontuação precisa de um motivo para auditoria.");
      return;
    }

    try {
      setBusyKey(`score-${project.id}-${action}`);
      const result = await api.interactions.createScoreEvent({
        submissionId: project.id,
        action,
        points,
        reason,
        sourceType: "ADMIN_QUICK_ACTION",
        metadata: {
          projectName: project.nome,
          previousScore: project.pontos,
        },
      });
      toast.success(`${result.scoreDelta > 0 ? "+" : ""}${result.scoreDelta} ponto(s) aplicado(s) a ${project.nome}.`);
      await handleRefreshVotes();
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao aplicar pontuação.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleOpenExhibitorVoteQr = async (project: VoteProjectSummary) => {
    try {
      setBusyKey(`vote-qr-${project.id}`);
      const url = buildAdminExhibitorVoteUrl(project.detailPath);
      const qrImageUrl = await createQrDataUrl(url, 320);
      setExhibitorVoteQrDialog({ project, url, qrImageUrl });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar QR de voto.");
    } finally {
      setBusyKey(null);
    }
  };

  const copyExhibitorVoteQrLink = async () => {
    if (!exhibitorVoteQrDialog) return;
    try {
      await navigator.clipboard.writeText(exhibitorVoteQrDialog.url);
      toast.success("Link de voto copiado.");
    } catch {
      toast.error("Falha ao copiar link de voto.");
    }
  };

  const downloadExhibitorVoteQr = () => {
    if (!exhibitorVoteQrDialog) return;
    const link = document.createElement("a");
    link.href = exhibitorVoteQrDialog.qrImageUrl;
    link.download = `qr-voto-${exhibitorVoteQrDialog.project.id}.png`;
    link.click();
  };

  const handleShowScoringConfig = async () => {
    try {
      setBusyKey("score-config");
      const config = await api.interactions.scoringConfig();
      const roundsLabel = config.rounds.length
        ? config.rounds.map((round) => `${round.label} x${round.multiplier}`).join(", ")
        : "sem rondas ativas";
      toast.info(`Pontuação v${config.version}: júri ${config.weights.juryVote ?? 500} pts, bónus curso ${config.weights.firstCourseVoteBonus ?? 3} pts, bónus universidade ${config.weights.otherUniversityVoteBonus ?? 3} pts, ${roundsLabel}.`);
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar configuração de pontuação.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleFreezeScoringRanking = async () => {
    const reason = window.prompt("Motivo do congelamento:", "Encerramento oficial da votação.")?.trim();
    if (!reason) {
      toast.info("O congelamento precisa de um motivo para auditoria.");
      return;
    }

    if (!window.confirm("Congelar agora todos os eventos válidos ainda desbloqueados?")) {
      return;
    }

    try {
      setBusyKey("score-freeze");
      const result = await api.interactions.freezeScoringRanking({ reason });
      toast.success(`${result.lockedEvents} evento(s) congelado(s) às ${new Date(result.frozenAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}.`);
      await handleRefreshVotes();
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao congelar ranking.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleExportScoringRanking = async (frozenOnly: boolean) => {
    try {
      setBusyKey(frozenOnly ? "score-export-frozen" : "score-export-current");
      const result = await api.interactions.exportScoringRanking({ frozenOnly });
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = frozenOnly
        ? "ranking-pontuacao-congelado.json"
        : "ranking-pontuacao-atual.json";
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exportação gerada com ${result.totalProjects} projeto(s).`);
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao exportar ranking.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleRecalculateScoring = async () => {
    const reason = window.prompt("Motivo do recalculo:", "Ajuste oficial dos pesos de pontuação.")?.trim();
    if (!reason) {
      toast.info("O recalculo precisa de um motivo para auditoria.");
      return;
    }

    if (!window.confirm("Recalcular apenas eventos válidos ainda não congelados?")) {
      return;
    }

    try {
      setBusyKey("score-recalculate");
      const result = await api.interactions.recalculateScoring({ reason });
      toast.success(`${result.changedEvents}/${result.scannedEvents} evento(s) recalculado(s). Total: ${result.beforeTotal} → ${result.afterTotal}.`);
      await handleRefreshVotes();
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao recalcular pontuação.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleAwardMemberLevels = async () => {
    if (!window.confirm("Atribuir agora os níveis Bronze, Prata e Ouro dos membros com base no ledger atual?")) {
      return;
    }

    try {
      setBusyKey("score-member-levels");
      const result = await api.interactions.awardMemberLevels();
      const awardedPoints = result.awarded.reduce((sum, item) => sum + item.points, 0);
      toast.success(`${result.awarded.length} nível(is) atribuído(s) em ${result.scannedMembers} membro(s). Total: +${awardedPoints} ponto(s).`);
      await handleRefreshVotes();
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao atribuir níveis dos membros.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleAwardAutomaticMissions = async () => {
    if (!window.confirm("Avaliar agora missões automáticas e bónus de stand ativo com base no ledger atual?")) {
      return;
    }

    try {
      setBusyKey("score-auto-missions");
      const result = await api.interactions.awardAutomaticMissions();
      toast.success(`${result.awardedCount} missão(ões)/bónus automático(s) atribuídos. Total: +${result.awardedPoints} ponto(s).`);
      await handleRefreshVotes();
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao avaliar missões automáticas.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleAwardTeamBonuses = async () => {
    if (!window.confirm("Atribuir agora os bónus MVP da equipa com base no ranking interno de embaixadores?")) {
      return;
    }

    try {
      setBusyKey("score-team-bonuses");
      const result = await api.interactions.awardTeamBonuses();
      toast.success(`${result.awardedCount} bónus MVP/equipa atribuído(s). Total: +${result.awardedPoints} ponto(s).`);
      await handleRefreshVotes();
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao atribuir bónus de equipa.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleShowAmbassadorRanking = async () => {
    try {
      setBusyKey("score-ambassadors");
      const result = await api.interactions.ambassadorRanking();
      const leaders = result.members.slice(0, 3)
        .map((member) => `#${member.rank} ${member.memberName}: ${member.conversions} conv., ${member.coursesReached} curso(s), streak ${member.maxCourseStreak}`)
        .join(" · ");
      toast.info(leaders || "Ainda não há conversões atribuídas a membros.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar ranking de embaixadores.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleShowScoringAlerts = async () => {
    try {
      setBusyKey("score-alerts");
      const result = await api.interactions.scoringAlerts();
      const highAlerts = result.alerts.filter((alert) => alert.severity === "HIGH").length;
      toast.info(result.totalAlerts
        ? `${result.totalAlerts} alerta(s) encontrados, ${highAlerts} de severidade alta.`
        : "Nenhum alerta de pontuação encontrado agora.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao verificar alertas de pontuação.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleExportScoringRankingPdf = async (frozenOnly: boolean) => {
    try {
      setBusyKey(frozenOnly ? "score-export-pdf-frozen" : "score-export-pdf");
      const blob = await api.interactions.exportScoringRankingPdf({ frozenOnly });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = frozenOnly
        ? "ranking-pontuacao-congelado.pdf"
        : "ranking-pontuacao-atual.pdf";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("PDF de pontuação exportado.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao exportar PDF.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleExportScoringRankingCsv = async (frozenOnly: boolean) => {
    try {
      setBusyKey(frozenOnly ? "score-export-csv-frozen" : "score-export-csv");
      const blob = await api.interactions.exportScoringRankingCsv({ frozenOnly });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = frozenOnly
        ? "ranking-pontuacao-congelado.csv"
        : "ranking-pontuacao-atual.csv";
      link.click();
      URL.revokeObjectURL(url);
      toast.success("CSV de pontuação exportado.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao exportar CSV.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleProjectVotingPauseToggle = async () => {
    const nextPausedState = !projectVotingPaused;

    try {
      setBusyKey("votes-control");
      const control = await api.interactions.updateVotesControl({
        votingPaused: nextPausedState,
      });
      setProjectVotingPaused(control.votingPaused);
      toast.success(
        control.votingPaused
          ? "Votação pública pausada."
          : "Votação pública retomada.",
      );
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Falha ao atualizar o estado da votação.",
        );
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleConfirmVotesReset = async () => {
    if (votesResetPhrase.trim() !== resetVotesPhrase) {
      toast.info(`Escreve ${resetVotesPhrase} para confirmar.`);
      return;
    }

    setVotesResetConfirming(true);
    try {
      const result = await api.interactions.confirmVotesReset({
        confirmationText: votesResetPhrase.trim(),
      });
      toast.success(`${result.studentVotesDeleted + result.legacyVotesDeleted} voto(s) e ${result.scoreEventsDeleted} evento(s) de pontuação removido(s).`);
      setVotesResetDialogOpen(false);
      setVotesResetPhrase("");
      setVotesProjectsPage(1);
      setVotesEntriesPage(1);
      void handleRefreshVotes();
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao remover votos.");
      }
    } finally {
      setVotesResetConfirming(false);
    }
  };

  const sortedAgenda = [...schedule].sort(
    (left, right) =>
      new Date(`${left.date.slice(0, 10)}T${left.startTime}:00`).getTime() -
      new Date(`${right.date.slice(0, 10)}T${right.startTime}:00`).getTime(),
  );

  if (visibleTabs.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fb] px-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <Shield className="h-6 w-6 text-slate-400" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            Sem áreas atribuídas
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            A tua conta tem acesso administrativo, mas ainda não recebeu módulos
            para gerir.
          </p>
        </div>
      </div>
    );
  }

  if (!visibleTabs.some((tab) => tab.id === activeTab)) {
    return (
      <div className="min-h-screen bg-background py-12 md:py-16">
        <div className="container mx-auto px-4">
          <Card className="mx-auto max-w-2xl border-border/70">
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />A
              preparar a tua área administrativa...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isRemovingCourse = Boolean(
    coursePendingRemoval &&
      busyKey === `course-delete-${coursePendingRemoval.id}`,
  );
  const isRemovingCourseEnrollment = Boolean(
    courseEnrollmentPendingRemoval &&
      busyKey ===
        `course-enrollment-remove-${courseEnrollmentPendingRemoval.enrollmentId}`,
  );

  return (
    <div className="admin-workspace admin-shell relative h-[100svh] min-h-[100svh] overflow-hidden bg-background text-foreground lg:h-dvh lg:min-h-dvh">
      <AlertDialog
        open={studentPendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open && !isRemovingStudent) setStudentPendingRemoval(null);
        }}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover estudante</AlertDialogTitle>
            <AlertDialogDescription>
              {studentPendingRemoval
                ? `Este registo será apagado da base de dados com interações associadas. Estudante: ${studentPendingRemoval.name || `Estudante ${studentPendingRemoval.studentNumber}`}.`
                : "Este registo será apagado da base de dados com interações associadas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingStudent}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemovingStudent || !studentPendingRemoval}
              onClick={(event) => {
                event.preventDefault();
                if (studentPendingRemoval)
                  void handleRemoveStudent(studentPendingRemoval);
              }}
            >
              {isRemovingStudent ? "A remover..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={submissionPendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open && !isRemovingSubmission) setSubmissionPendingRemoval(null);
        }}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar expositor</AlertDialogTitle>
            <AlertDialogDescription>
              {submissionPendingRemoval
                ? `O expositor ${submissionPendingRemoval.nome} será removido da base de dados e deixará de aparecer no site público.`
                : "Este expositor será removido da base de dados e deixará de aparecer no site público."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingSubmission}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemovingSubmission || !submissionPendingRemoval}
              onClick={(event) => {
                event.preventDefault();
                if (submissionPendingRemoval)
                  void handleRemoveSubmission(submissionPendingRemoval);
              }}
            >
              {isRemovingSubmission ? "A eliminar..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={teamMembersDialogSubmission !== null}
        onOpenChange={(open) => {
          if (!open && !savingTeamMembersId) {
            setTeamMembersDialogSubmission(null);
            setTeamMembersDraft("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border/60 px-5 pb-4 pt-5">
            <DialogTitle>Editar membros</DialogTitle>
            <DialogDescription>
              Corrige os nomes submetidos pelo expositor sem alterar o restante
              da candidatura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Candidatura
              </p>
              <p className="mt-1 text-sm font-semibold">
                {teamMembersDialogSubmission?.nome ?? "Expositor"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {teamMembersDialogSubmission?.referenceCode}
              </p>
            </div>
            <div>
              <label
                htmlFor="admin-submission-team-members"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
              >
                Membros do grupo
              </label>
              <Textarea
                id="admin-submission-team-members"
                value={teamMembersDraft}
                onChange={(event) => setTeamMembersDraft(event.target.value)}
                placeholder="Um nome por linha"
                className="mt-2 min-h-44 text-sm"
                disabled={Boolean(savingTeamMembersId)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Máximo de 17 membros. Confirmações existentes continuam apenas
                para nomes mantidos na lista.
              </p>
            </div>
          </div>
          <DialogFooter className="border-t border-border/60 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(savingTeamMembersId)}
              onClick={() => {
                setTeamMembersDialogSubmission(null);
                setTeamMembersDraft("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={Boolean(savingTeamMembersId)}
              onClick={() => void handleSubmissionTeamMembersSave()}
            >
              {savingTeamMembersId ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Users className="mr-1 h-3.5 w-3.5" />
              )}
              Guardar membros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={coursePendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open && !isRemovingCourse) setCoursePendingRemoval(null);
        }}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar curso</AlertDialogTitle>
            <AlertDialogDescription>
              {coursePendingRemoval
                ? `Esta ação remove o curso ${coursePendingRemoval.name} e a sua lista administrativa de inscritos.`
                : "Esta ação remove o curso e a sua lista administrativa de inscritos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingCourse}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemovingCourse || !coursePendingRemoval}
              onClick={(event) => {
                event.preventDefault();
                if (coursePendingRemoval)
                  void handleCourseDelete(coursePendingRemoval);
              }}
            >
              {isRemovingCourse ? "A eliminar..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={courseEnrollmentPendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open && !isRemovingCourseEnrollment)
            setCourseEnrollmentPendingRemoval(null);
        }}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover inscrito do curso</AlertDialogTitle>
            <AlertDialogDescription>
              {courseEnrollmentPendingRemoval
                ? `Esta ação remove a inscrição de ${courseEnrollmentPendingRemoval.fullName} deste curso.`
                : "Esta ação remove a inscrição deste participante do curso."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingCourseEnrollment}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                isRemovingCourseEnrollment || !courseEnrollmentPendingRemoval
              }
              onClick={(event) => {
                event.preventDefault();
                if (courseEnrollmentPendingRemoval)
                  void handleCourseEnrollmentRemove(
                    courseEnrollmentPendingRemoval.courseId,
                    courseEnrollmentPendingRemoval.enrollmentId,
                    courseEnrollmentPendingRemoval.fullName,
                  );
              }}
            >
              {isRemovingCourseEnrollment ? "A remover..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(exhibitorVoteQrDialog)}
        onOpenChange={(open) => {
          if (!open) setExhibitorVoteQrDialog(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-orange-100 bg-orange-50 px-5 pb-4 pt-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-orange-950">
              <QrCode className="h-5 w-5" />
              QR de voto
            </DialogTitle>
            <DialogDescription className="text-orange-900/80">
              Link direto para o estudante confirmar voto no projeto. A pontuação base entra no voto válido; bónus de curso e universidade aparecem depois da conversão.
            </DialogDescription>
          </DialogHeader>
          {exhibitorVoteQrDialog ? (
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-sm font-black text-slate-950">
                  {exhibitorVoteQrDialog.project.nome}
                </p>
                <p className="mt-1 break-all text-xs leading-5 text-slate-500">
                  {exhibitorVoteQrDialog.url}
                </p>
              </div>
              <div className="flex justify-center rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <img
                  src={exhibitorVoteQrDialog.qrImageUrl}
                  alt={`QR de voto de ${exhibitorVoteQrDialog.project.nome}`}
                  className="h-56 w-56 rounded-xl border border-white bg-white p-2 shadow-sm"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter className="grid gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:grid-cols-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl bg-white"
              onClick={() => setExhibitorVoteQrDialog(null)}
            >
              Fechar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl bg-white"
              onClick={() => void copyExhibitorVoteQrLink()}
              disabled={!exhibitorVoteQrDialog}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar link de voto
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-slate-950 text-white hover:bg-slate-800"
              onClick={() => downloadExhibitorVoteQr()}
              disabled={!exhibitorVoteQrDialog}
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={votesResetDialogOpen} onOpenChange={setVotesResetDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-rose-100 bg-rose-50 px-5 pb-4 pt-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-rose-900">
              <AlertTriangle className="h-5 w-5" />
              Remover todos os votos
            </DialogTitle>
            <DialogDescription className="text-rose-800/80">
              Esta ação é imediata e não envia SMS. Confirma apenas quando tiveres a certeza absoluta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-xl border border-rose-100 bg-white p-3 text-sm text-slate-700">
              <p className="font-bold text-slate-950">Isto zera a votação pública e a pontuação</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Serão removidos os votos dos estudantes e os eventos de pontuação dos projectos. Comentários, likes, visitas e páginas dos projectos ficam intactos.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Escreve {resetVotesPhrase}
              </label>
              <Input
                value={votesResetPhrase}
                onChange={(event) => setVotesResetPhrase(event.target.value.toUpperCase())}
                className="rounded-xl"
                placeholder={resetVotesPhrase}
                disabled={votesResetConfirming}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-slate-100 bg-slate-50 px-5 py-4">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setVotesResetDialogOpen(false)} disabled={votesResetConfirming}>
              Cancelar
            </Button>
            <Button type="button" className="rounded-xl bg-rose-700 text-white hover:bg-rose-800" onClick={() => void handleConfirmVotesReset()} disabled={votesResetConfirming}>
              {votesResetConfirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Confirmar remoção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mobile sidebar overlay ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.button
            type="button"
            aria-label="Fechar fundo do menu administrativo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="admin-mobile-sidebar-scrim fixed inset-0 z-[90] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="admin-shell__layout relative flex h-full min-h-0 overflow-hidden">
        {/* ═══════ Sidebar ═══════ */}
        <aside
          onWheel={stopSidebarScrollPropagation}
          onTouchMove={stopSidebarTouchPropagation}
          className={`admin-shell__sidebar fixed inset-y-0 left-0 z-[100] flex h-[100svh] max-h-[100svh] min-h-0 w-[min(86vw,304px)] max-w-[calc(100vw-0.75rem)] flex-col overflow-hidden overscroll-contain border-r border-border bg-card transition-transform duration-200 will-change-transform lg:static lg:z-auto lg:h-dvh lg:max-h-dvh lg:w-[272px] lg:max-w-none lg:translate-x-0 ${
            sidebarOpen ? "pointer-events-auto translate-x-0 shadow-2xl" : "pointer-events-none -translate-x-full lg:pointer-events-auto"
          }`}
        >
          {/* Brand */}
          <div className="admin-shell__brand flex min-h-20 shrink-0 items-center justify-between border-b border-border px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="admin-brand-mark flex h-12 w-[118px] shrink-0 items-center justify-center rounded-xl">
                <img
                  src="/uorconnect-logo-navbar.png"
                  alt="UOR Connect"
                  className="h-10 w-auto object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black tracking-tight text-foreground">
                  UOR Connect
                </p>
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Centro de comando NEIC
                </p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Fechar menu administrativo"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="admin-shell__nav min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 py-5">
            {tabGroups.map((group) => {
              const groupTabs = visibleTabs.filter((t) =>
                group.ids.includes(t.id),
              );
              if (groupTabs.length === 0) return null;
              return (
                <div key={group.label} className="admin-nav-group mb-5">
                  <p className="admin-nav-group__label mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {groupTabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
	                      return (
	                        <div key={tab.id} className="space-y-1">
	                          <button
	                            onClick={() => {
	                              setActiveTab(tab.id);
		                              if (tab.id === "credentials") {
		                                setActiveCredentialSubpage("overview");
		                              }
		                              if (tab.id === "submissions") {
		                                setActiveSubmissionSubpage("overview");
		                              }
		                              setSidebarOpen(false);
		                            }}
	                            className={`admin-nav-item group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
	                              isActive
	                                ? "admin-nav-item--active bg-muted font-semibold text-foreground"
	                                : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
	                            }`}
	                          >
	                            <span className="admin-nav-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
	                              <Icon className="h-4 w-4" />
	                            </span>
	                            <span className="truncate">{tab.label}</span>
	                          </button>
	                          {tab.id === "credentials" && (
	                            <div className="admin-nav-subitems ml-6 border-l border-border/70 pl-3">
	                              {credentialSubpages.map((subpage) => {
	                                const SubIcon = subpage.icon;
	                                const isSubpageActive =
	                                  activeTab === "credentials" &&
	                                  activeCredentialSubpage === subpage.id;
	                                return (
	                                  <button
	                                    key={subpage.id}
	                                    type="button"
	                                    onClick={() => {
	                                      setActiveTab("credentials");
	                                      setActiveCredentialSubpage(subpage.id);
	                                      setSidebarOpen(false);
	                                    }}
	                                    className={`admin-nav-subitem mt-1 flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
	                                      isSubpageActive
	                                        ? "bg-primary/10 font-semibold text-primary"
	                                        : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
	                                    }`}
	                                  >
	                                    <SubIcon className="h-3.5 w-3.5 shrink-0" />
	                                    <span className="truncate">{subpage.label}</span>
	                                  </button>
	                                );
	                              })}
		                            </div>
		                          )}
		                          {tab.id === "submissions" && (
		                            <div className="admin-nav-subitems ml-6 border-l border-border/70 pl-3">
		                              {submissionSubpages.map((subpage) => {
		                                const SubIcon = subpage.icon;
		                                const isSubpageActive =
		                                  activeTab === "submissions" &&
		                                  activeSubmissionSubpage === subpage.id;
		                                return (
		                                  <button
		                                    key={subpage.id}
		                                    type="button"
		                                    onClick={() => {
		                                      setActiveTab("submissions");
		                                      setActiveSubmissionSubpage(subpage.id);
		                                      setSidebarOpen(false);
		                                    }}
		                                    className={`admin-nav-subitem mt-1 flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
		                                      isSubpageActive
		                                        ? "bg-primary/10 font-semibold text-primary"
		                                        : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
		                                    }`}
		                                  >
		                                    <SubIcon className="h-3.5 w-3.5 shrink-0" />
		                                    <span className="truncate">{subpage.label}</span>
		                                  </button>
		                                );
		                              })}
		                            </div>
		                          )}
		                        </div>
	                      );
	                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="admin-sidebar-footer shrink-0 border-t border-border/70 p-4">
            <div className="admin-user-card flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-black text-primary">
                {(adminAccess?.team ?? "A").charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">
                  {adminAccess?.team ?? "Administração"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {sessionStudentNumber ?? adminAccess?.studentNumber ?? ""}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* ═══════ Main panel ═══════ */}
        <div className="admin-main-panel flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="admin-topbar flex min-h-20 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menu administrativo"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {activeTabGroup?.label ?? "Administração"} ·{" "}
                  {visibleTabs.length} módulo(s) disponíveis
                </p>
                <h2 className="mt-0.5 text-lg font-black tracking-tight text-foreground">
		                  {activeTab === "credentials"
		                    ? `Credenciais · ${activeCredentialSubpageMeta.label}`
		                    : activeTab === "submissions"
		                      ? `Candidaturas · ${activeSubmissionSubpageMeta.label}`
		                    : activeTabMeta?.label ?? "Administração"}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 rounded-lg text-xs"
              >
                <Link to="/">
                  <ExternalLink className="h-3 w-3" />
                  <span className="hidden sm:inline">Portal</span>
                </Link>
              </Button>
              <Button
                size="sm"
                className="admin-export-button h-10 gap-1.5 rounded-lg text-xs"
                onClick={() => void handleExportOverviewReport()}
                disabled={exportingReport}
              >
                {exportingReport ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                <span className="hidden sm:inline">Exportar PDF</span>
              </Button>
            </div>
          </header>

          {/* Scrollable content */}
          <div className="admin-content min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background px-4 py-6 sm:px-6 lg:px-8">
            {loading ? (
              <div className="admin-loading-card flex items-center gap-3 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />A
                carregar dados...
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  {activeTab === "overview" && (
                    <Suspense
                      fallback={<AdminPanelFallback label="Visão Geral" />}
                    >
                      <AdminOverviewTab
                        exportingReport={exportingReport}
                        rankedProjects={rankedProjects}
                        rankedStudents={rankedStudents}
                        stats={stats}
                        economicSummary={economicSummary}
                        speakerCount={speakers.length}
                        courseCount={courses.length}
                        adminCount={authorizedAdminStudents.length}
                        recentLogins={recentLogins}
                        submissionsOpen={submissionConfig.isOpen}
                        onExportOverviewReport={() =>
                          void handleExportOverviewReport()
                        }
                        onNavigateTab={(tab) =>
                          setActiveTab(tab as typeof activeTab)
                        }
                      />
                    </Suspense>
                  )}

                  {activeTab === "analytics" && (
                    <Suspense
                      fallback={<AdminPanelFallback label="Analytics" />}
                    >
                      <AdminAnalyticsTab
                        loading={loadingAnalytics}
                        dashboard={analyticsDashboard}
                        events={analyticsEvents}
                        error={analyticsError}
                        filters={analyticsFilters}
                        onFiltersChange={handleAnalyticsFiltersChange}
                        onRefresh={() => void loadAnalyticsData()}
                        onExport={() => void handleAnalyticsExport()}
                      />
                    </Suspense>
                  )}

                  {activeTab === "tasks" && (
                    <Suspense fallback={<AdminPanelFallback label="Tarefas" />}>
                      <AdminTasksTab />
                    </Suspense>
                  )}

                  {activeTab === "sms" && (
                    <Suspense fallback={<AdminPanelFallback label="SMS" />}>
                      <AdminSmsTab courses={courses} />
                    </Suspense>
                  )}

                  {activeTab === "whatsapp" && (
                    <Suspense
                      fallback={<AdminPanelFallback label="WhatsApp" />}
                    >
                      <AdminWhatsAppTab courses={courses} />
                    </Suspense>
                  )}

                  {activeTab === "jury" && (
                    <Suspense fallback={<AdminPanelFallback label="Júri" />}>
                      <AdminJuryTab />
                    </Suspense>
                  )}

                  {activeTab === "attendance" && (
                    <Suspense
                      fallback={<AdminPanelFallback label="Check-in" />}
                    >
                      <AdminAttendanceTab />
                    </Suspense>
                  )}

                  {activeTab === "passport" && (
                    <Suspense
                      fallback={<AdminPanelFallback label="Passaporte" />}
                    >
                      <AdminPassportTab />
                    </Suspense>
                  )}

                  {activeTab === "certificates" && (
                    <Suspense
                      fallback={<AdminPanelFallback label="Certificados" />}
                    >
                      <AdminCertificatesTab />
                    </Suspense>
                  )}

                  {activeTab === "audit" && (
                    <Suspense
                      fallback={<AdminPanelFallback label="Auditoria" />}
                    >
                      <AdminAuditTab />
                    </Suspense>
                  )}

	                  {activeTab === "submissions" && (
	                    <>
	                      <div className="grid gap-2 sm:grid-cols-2">
	                        {submissionSubpages.map((subpage) => {
	                          const Icon = subpage.icon;
	                          const isActive = activeSubmissionSubpage === subpage.id;
	                          return (
	                            <button
	                              key={subpage.id}
	                              type="button"
	                              onClick={() => setActiveSubmissionSubpage(subpage.id)}
	                              className={`flex min-h-[72px] items-start gap-3 rounded-2xl border p-3 text-left transition ${
	                                isActive
	                                  ? "border-primary/30 bg-primary/5 text-primary shadow-sm"
	                                  : "border-border/70 bg-card text-muted-foreground hover:border-border hover:bg-muted/40"
	                              }`}
	                            >
	                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
	                                <Icon className="h-4 w-4" />
	                              </span>
	                              <span className="min-w-0">
	                                <span className="block truncate text-sm font-bold">{subpage.label}</span>
	                                <span className="mt-1 line-clamp-2 block text-[11px] leading-4">
	                                  {subpage.id === "overview"
	                                    ? "Configuração, filtros e revisão normal das candidaturas."
	                                    : "Mapa de cumprimento por projeto, membros e manual."}
	                                </span>
	                              </span>
	                            </button>
	                          );
	                        })}
	                      </div>

	                      {activeSubmissionSubpage === "overview" ? (
	                        <>
	                      {/* Config: Status + Payment in a cleaner layout */}
	                      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                        <div className="space-y-4">
                          <div
                            className={`rounded-2xl border p-5 ${submissionConfig.isOpen ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-red-500/20 bg-red-500/[0.03]"}`}
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${submissionConfig.isOpen ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                                  {submissionConfig.isOpen ? (
                                    <Power className="h-5 w-5" />
                                  ) : (
                                    <PowerOff className="h-5 w-5" />
                                  )}
                                </div>
                                <div>
                                  <p className="flex items-center gap-2 text-sm font-semibold">
                                    <span
                                      className={`h-2.5 w-2.5 rounded-full ${submissionConfig.isOpen ? "bg-emerald-500" : "bg-red-500"}`}
                                    />
                                    {submissionConfig.isOpen
                                      ? "Candidaturas abertas"
                                      : "Candidaturas fechadas"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Conectado aos botões Submeter expositor.
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={
                                    submissionConfig.isOpen
                                      ? "destructive"
                                      : "default"
                                  }
                                  className="h-9 rounded-xl"
                                  disabled={
                                    busyKey === "submission-config-open-state" ||
                                    busyKey === "submission-config"
                                  }
                                  onClick={() =>
                                    void handleSubmissionOpenStateUpdate(
                                      !submissionConfig.isOpen,
                                    )
                                  }
                                >
                                  {busyKey === "submission-config-open-state" ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : submissionConfig.isOpen ? (
                                    <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                                  ) : (
                                    <Power className="mr-1.5 h-3.5 w-3.5" />
                                  )}
                                  {submissionConfig.isOpen
                                    ? "Encerrar candidaturas"
                                    : "Reabrir candidaturas"}
                                </Button>
                                <Switch
                                  checked={submissionConfig.isOpen}
                                  disabled={
                                    busyKey === "submission-config-open-state" ||
                                    busyKey === "submission-config"
                                  }
                                  onCheckedChange={(checked) =>
                                    void handleSubmissionOpenStateUpdate(
                                      checked,
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          {/* Quick economic stats */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-border/50 bg-white p-4">
                              <p className="text-[11px] font-medium text-muted-foreground">
                                Expositores
                              </p>
                              <p className="mt-1 text-2xl font-bold">
                                {economicSummary.exhibitorCount}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-border/50 bg-white p-4">
                              <p className="text-[11px] font-medium text-muted-foreground">
                                Aprovados
                              </p>
                              <p className="mt-1 text-2xl font-bold text-emerald-600">
                                {economicSummary.approvedCount}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-border/50 bg-white p-4">
                              <p className="text-[11px] font-medium text-muted-foreground">
                                Receita prevista
                              </p>
                              <p className="mt-1 text-lg font-bold">
                                {formatCurrencyValue(
                                  economicSummary.projectedRevenue,
                                )}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-border/50 bg-white p-4">
                              <p className="text-[11px] font-medium text-muted-foreground">
                                Receita aprovada
                              </p>
                              <p className="mt-1 text-lg font-bold text-emerald-600">
                                {formatCurrencyValue(
                                  economicSummary.approvedRevenue,
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Type breakdown inline */}
                          <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-white px-4 py-3">
                            <div className="flex items-center gap-2 text-xs">
                              <GraduationCap className="h-3.5 w-3.5 text-muted-foreground/60" />
                              <span className="font-medium">
                                {economicSummary.projectCount}
                              </span>
                              <span className="text-muted-foreground">
                                proj.
                              </span>
                            </div>
                            <div className="h-3 w-px bg-border/60" />
                            <div className="flex items-center gap-2 text-xs">
                              <Briefcase className="h-3.5 w-3.5 text-muted-foreground/60" />
                              <span className="font-medium">
                                {economicSummary.businessCount}
                              </span>
                              <span className="text-muted-foreground">
                                neg.
                              </span>
                            </div>
                            <div className="h-3 w-px bg-border/60" />
                            <div className="flex items-center gap-2 text-xs">
                              <Package className="h-3.5 w-3.5 text-muted-foreground/60" />
                              <span className="font-medium">
                                {economicSummary.productCount}
                              </span>
                              <span className="text-muted-foreground">
                                prod.
                              </span>
                            </div>
                          </div>
                        </div>

                        <Card className="border-border/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold">
                              Configuração de Pagamento
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="grid gap-3 md:grid-cols-2">
                            <FormField label="IBAN">
                              <Input
                                value={submissionConfig.iban}
                                onChange={(event) =>
                                  setSubmissionConfig((current) => ({
                                    ...current,
                                    iban: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Nome da conta">
                              <Input
                                value={submissionConfig.accountName}
                                onChange={(event) =>
                                  setSubmissionConfig((current) => ({
                                    ...current,
                                    accountName: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Valor">
                              <Input
                                value={submissionConfig.paymentAmount}
                                onChange={(event) =>
                                  setSubmissionConfig((current) => ({
                                    ...current,
                                    paymentAmount: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Instruções">
                              <Textarea
                                value={normalizeOptionalText(
                                  submissionConfig.paymentInstructions,
                                )}
                                onChange={(event) =>
                                  setSubmissionConfig((current) => ({
                                    ...current,
                                    paymentInstructions: event.target.value,
                                  }))
                                }
                                className="min-h-20"
                              />
                            </FormField>
                            <FormField label="Comunidade Projetos">
                              <Input
                                value={normalizeOptionalText(
                                  submissionConfig.projectCommunityUrl,
                                )}
                                onChange={(event) =>
                                  setSubmissionConfig((current) => ({
                                    ...current,
                                    projectCommunityUrl: event.target.value,
                                  }))
                                }
                                placeholder="https://chat.whatsapp.com/..."
                              />
                            </FormField>
                            <FormField label="Comunidade Negócios">
                              <Input
                                value={normalizeOptionalText(
                                  submissionConfig.businessCommunityUrl,
                                )}
                                onChange={(event) =>
                                  setSubmissionConfig((current) => ({
                                    ...current,
                                    businessCommunityUrl: event.target.value,
                                  }))
                                }
                                placeholder="https://chat.whatsapp.com/..."
                              />
                            </FormField>
                            <FormField label="Comunidade Produtos">
                              <Input
                                value={normalizeOptionalText(
                                  submissionConfig.productCommunityUrl,
                                )}
                                onChange={(event) =>
                                  setSubmissionConfig((current) => ({
                                    ...current,
                                    productCommunityUrl: event.target.value,
                                  }))
                                }
                                placeholder="https://chat.whatsapp.com/..."
                              />
                            </FormField>
                            <div className="flex items-end md:col-span-2">
                              <Button
                                onClick={() =>
                                  void handleSubmissionConfigSave()
                                }
                                disabled={
                                  busyKey === "submission-config" ||
                                  busyKey === "submission-config-open-state"
                                }
                                size="sm"
                              >
                                Guardar configuração
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Filters */}
                      <div className="rounded-2xl border border-border/50 bg-white p-4">
                        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_repeat(2,minmax(160px,200px))]">
                          <div className="relative min-w-0">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                            <Input
                              className="h-10 pl-9 text-sm"
                              placeholder="Pesquisar por nome, número, curso ou contacto..."
                              value={searchTerm}
                              onChange={(event) =>
                                setSearchTerm(event.target.value)
                              }
                            />
                          </div>
                          <select
                            className="h-10 rounded-xl border border-input/70 bg-white px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/20"
                            value={submissionSortBy}
                            onChange={(event) =>
                              setSubmissionSortBy(
                                event.target.value as typeof submissionSortBy,
                              )
                            }
                          >
                            <option value="recentes">Mais recentes</option>
                            <option value="nome">Nome A-Z</option>
                            <option value="inscricao">Nº inscrição</option>
                            <option value="curso">Curso</option>
                          </select>
                          <select
                            className="h-10 rounded-xl border border-input/70 bg-white px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/20"
                            value={submissionPageSize}
                            onChange={(event) =>
                              setSubmissionPageSize(Number(event.target.value))
                            }
                          >
                            <option value={10}>10 por página</option>
                            <option value={20}>20 por página</option>
                            <option value={50}>50 por página</option>
                          </select>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Estado:
                          </span>
                          {["todos", "pendente", "aprovado", "recusado"].map(
                            (status) => (
                              <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                                  filterStatus === status
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                {status}
                              </button>
                            ),
                          )}
                          <div className="mx-1 h-4 w-px bg-border/50" />
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Tipo:
                          </span>
                          {["todos", "projeto", "negocio", "produto"].map(
                            (tipo) => (
                              <button
                                key={tipo}
                                onClick={() => setFilterTipo(tipo)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                                  filterTipo === tipo
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                {tipo === "todos" ? "Todos" : tipo}
                              </button>
                            ),
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/10 px-4 py-2.5 text-sm text-muted-foreground">
                        {loadingSubmissionsList ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />A
                            carregar candidaturas...
                          </>
                        ) : submissionsTotal === 0 ? (
                          "Nenhuma candidatura encontrada."
                        ) : (
                          `${submissionsTotal} candidatura(s) encontrada(s).`
                        )}
                      </div>

                      <div className="space-y-3">
                        {paginatedSubmissions.items.map((submission) => {
                          const Icon = tipoIcons[submission.tipo];
                          const whatsappUrl = whatsappLink(submission.telefone);
                          const paymentProofUrl = submissionPaymentProofUrl(
                            submission.id,
                          );
                          const paymentStatus = normalizeCourseEnrollmentStatus(
                            submission.paymentStatus,
                          );
                          const paymentConfirmed = isPaymentStatusConfirmed(
                            submission.paymentStatus,
                          );
                          const pendingTeamMembers = Math.max(
                            0,
                            submission.teamTotalMembers -
                              submission.teamConfirmedMembers,
                          );
                          const communityUrl =
                            submission.status === "aprovado" && paymentConfirmed
                              ? communityUrlBySubmissionType(
                                  submission.tipo,
                                  submissionConfig,
                                )
                              : null;
                          const bannerPreview =
                            resolveSubmissionBannerPreview(submission);
                          const canManageBanner =
                            submission.status === "aprovado";
                          const detailsOpen = expandedSubmissionIds.has(
                            submission.id,
                          );
                          return (
                            <Card
                              key={submission.id}
                              className="min-w-0 border-border/60"
                            >
                              <CardContent className="p-4">
                                <div className="flex flex-col gap-4">
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="flex flex-1 items-start gap-3">
                                      <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-xl border ${tipoBadgeColors[submission.tipo]}`}
                                      >
                                        <Icon className="h-5 w-5" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="safe-break text-base font-semibold">
                                            {submission.nome}
                                          </p>
                                          {submission.isWinner && (
                                            <Crown className="h-4 w-4 text-[hsl(var(--warning))]" />
                                          )}
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                          {submission.referenceCode} ·{" "}
                                          {formatDateLabel(submission.data)}
                                        </p>
                                        <p className="safe-break mt-2 text-xs leading-5 text-muted-foreground">
                                          {submission.area} · {submission.curso}{" "}
                                          · Responsável:{" "}
                                          {submission.responsavel}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <label
                                        className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1 text-xs font-semibold ${tipoBadgeColors[submission.tipo]}`}
                                        htmlFor={`submission-type-${submission.id}`}
                                      >
                                        <span className="text-[10px] uppercase tracking-[0.14em] opacity-70">
                                          Categoria
                                        </span>
                                        <select
                                          id={`submission-type-${submission.id}`}
                                          className="max-w-[110px] bg-transparent font-bold capitalize outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                          value={submission.tipo}
                                          disabled={
                                            busyKey ===
                                            `submission-type-${submission.id}`
                                          }
                                          onChange={(event) =>
                                            void handleSubmissionTypeChange(
                                              submission,
                                              event.target
                                                .value as AdminSubmission["tipo"],
                                            )
                                          }
                                        >
                                          {submissionTypeOptions.map((option) => (
                                            <option
                                              key={option.value}
                                              value={option.value}
                                            >
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <Badge
                                        variant="outline"
                                        className={
                                          statusColors[submission.status]
                                        }
                                      >
                                        {submission.status}
                                      </Badge>
                                      {submission.projectFrozen ? (
                                        <Badge variant="destructive">
                                          Projeto suspenso
                                        </Badge>
                                      ) : null}
                                      <Badge
                                        variant="outline"
                                        className={
                                          courseEnrollmentStatusBadge[
                                            paymentStatus
                                          ]
                                        }
                                      >
                                        {submission.paymentStatusLabel ||
                                          courseEnrollmentStatusLabel[
                                            paymentStatus
                                          ]}
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className={
                                          submission.teamAllConfirmed
                                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                                            : "border-amber-500/25 bg-amber-500/10 text-amber-700"
                                        }
                                      >
                                        {submission.teamJourneyLabel}
                                      </Badge>
                                      <Badge variant="outline">
                                        {submission.canVote
                                          ? "Votação + prémio"
                                          : "Exposição"}
                                      </Badge>
                                    </div>
                                  </div>

                                  {detailsOpen ? (
                                    <>
                                      {submission.projectFrozen ? (
                                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800">
                                          Procura a organização UOR Connect com urgência. Este projeto está suspenso: os membros ficam bloqueados na Minha Área e a votação pública fica indisponível até descongelamento.
                                        </div>
                                      ) : null}
                                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Número de inscrição
                                          </p>
                                          <p className="mt-2 text-sm font-medium">
                                            {submission.referenceCode}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 md:col-span-2 xl:col-span-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Resumo do projeto
                                          </p>
                                          <p className="safe-break mt-2 text-sm leading-6 text-muted-foreground">
                                            {submission.descricao}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Área
                                          </p>
                                          <p className="safe-break mt-2 text-sm font-medium">
                                            {submission.area}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Curso
                                          </p>
                                          <p className="safe-break mt-2 text-sm font-medium">
                                            {submission.curso}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Grupo
                                          </p>
                                          <p className="safe-break mt-2 text-sm font-medium">
                                            {submission.equipa || "Sem equipa"}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Responsável
                                          </p>
                                          <p className="safe-break mt-2 text-sm font-medium">
                                            {submission.responsavel}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            WhatsApp
                                          </p>
                                          <p className="safe-break mt-2 text-sm font-medium">
                                            {submission.telefone ||
                                              "Sem número"}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Valor base
                                          </p>
                                          <p className="mt-2 text-sm font-medium">
                                            {submissionConfig.paymentAmount}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 xl:col-span-2">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Necessidades técnicas
                                          </p>
                                          <p className="safe-break mt-2 text-sm font-medium">
                                            {submission.necessidades.length > 0
                                              ? submission.necessidades.join(
                                                  ", ",
                                                )
                                              : "Sem necessidades adicionais"}
                                          </p>
                                        </div>
                                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 xl:col-span-2">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Observações
                                          </p>
                                          <p className="safe-break mt-2 whitespace-pre-wrap text-sm font-medium">
                                            {submission.observacoes ||
                                              "Sem observações adicionais"}
                                          </p>
                                        </div>
                                      </div>

                                      <div
                                        className={`rounded-2xl border p-3 ${
                                          submission.teamAllConfirmed
                                            ? "border-emerald-500/20 bg-emerald-50/70"
                                            : "border-amber-500/20 bg-amber-50/70"
                                        }`}
                                      >
                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                          <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                              Confirmação da equipa
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                              O responsável entra confirmado por
                                              padrão; os restantes membros
                                              confirmam pelo link coletivo.
                                            </p>
                                          </div>
                                          <Badge
                                            variant="outline"
                                            className={
                                              submission.teamAllConfirmed
                                                ? "border-emerald-500/25 bg-white text-emerald-700"
                                                : "border-amber-500/25 bg-white text-amber-700"
                                            }
                                          >
                                            {submission.teamConfirmedMembers}/
                                            {submission.teamTotalMembers}{" "}
                                            confirmados
                                          </Badge>
                                        </div>
                                        {submission.teamMembers.length === 0 ? (
                                          <div className="rounded-xl border border-dashed border-white/80 bg-white/65 p-4 text-sm text-muted-foreground">
                                            Sem equipa registada nesta
                                            candidatura.
                                          </div>
                                        ) : (
                                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                            {submission.teamMembers.map(
                                              (member) => {
                                                const confirmingMember =
                                                  busyKey ===
                                                  `submission-team-confirm-${submission.id}-${member.id}`;
                                                const canAdminConfirmMember =
                                                  !member.isResponsible &&
                                                  !member.confirmed &&
                                                  Boolean(member.expectedStudentNumber);

                                                return (
                                                <div
                                                  key={`${submission.id}-${member.role}-${member.id}`}
                                                  className="rounded-xl border border-white/80 bg-white/85 px-3 py-2.5 text-xs shadow-sm"
                                                >
                                                  <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                      <p className="truncate font-semibold text-slate-900">
                                                        {member.name}
                                                      </p>
                                                      <p className="mt-0.5 text-[11px] text-slate-500">
                                                        {member.roleLabel}
                                                        {member.studentNumber
                                                          ? ` · ${member.studentNumber}`
                                                          : member.expectedStudentNumber
                                                            ? ` · Nº ${member.expectedStudentNumber}`
                                                          : ""}
                                                      </p>
                                                    </div>
                                                    <span
                                                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                                        member.isExternal
                                                          ? "bg-blue-500/10 text-blue-700"
                                                          : member.confirmed
                                                          ? "bg-emerald-500/10 text-emerald-700"
                                                          : "bg-amber-500/10 text-amber-700"
                                                      }`}
                                                    >
                                                      {member.isExternal
                                                        ? "Externo"
                                                        : member.confirmed
                                                        ? "OK"
                                                        : "Pendente"}
                                                    </span>
                                                  </div>
                                                  {member.confirmedAt ? (
                                                    <p className="mt-2 text-[10px] text-slate-400">
                                                      Confirmado em{" "}
                                                      {formatDateLabel(
                                                        member.confirmedAt,
                                                      )}
                                                    </p>
                                                  ) : null}
                                                  {member.isExternal ? (
                                                    <p className="mt-2 text-[10px] text-blue-700">
                                                      Exceção aprovada
                                                      {member.externalOrganization
                                                        ? ` · ${member.externalOrganization}`
                                                        : ""}
                                                    </p>
                                                  ) : null}
                                                  {!member.isResponsible &&
                                                  !member.confirmed ? (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-auto rounded-lg bg-white px-2 py-1 text-[10px] leading-tight"
                                                        disabled={
                                                          confirmingMember ||
                                                          !canAdminConfirmMember
                                                        }
                                                        onClick={() =>
                                                          void handleConfirmSubmissionTeamMemberFromAdmin(
                                                            submission,
                                                            member,
                                                          )
                                                        }
                                                      >
                                                        {confirmingMember ? (
                                                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                        ) : (
                                                          <UserCheck className="mr-1 h-3 w-3" />
                                                        )}
                                                        Confirmar pela secretaria
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-auto rounded-lg bg-white px-2 py-1 text-[10px] leading-tight"
                                                        disabled={
                                                          busyKey ===
                                                          `submission-team-external-${submission.id}-${member.id}`
                                                        }
                                                        onClick={() =>
                                                          void handleMarkTeamMemberExternalException(
                                                            submission,
                                                            member,
                                                          )
                                                        }
                                                      >
                                                        <Shield className="mr-1 h-3 w-3" />
                                                        Confirmar externo
                                                      </Button>
                                                      {!member.expectedStudentNumber ? (
                                                        <p className="basis-full text-[10px] font-medium text-amber-700">
                                                          Número de estudante obrigatório.
                                                        </p>
                                                      ) : null}
                                                    </div>
                                                  ) : null}
                                                </div>
                                                );
                                              },
                                            )}
                                          </div>
                                        )}
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-auto rounded-xl bg-white px-2.5 py-1.5 text-xs leading-tight"
                                            onClick={() =>
                                              openSubmissionTeamMembersDialog(
                                                submission,
                                              )
                                            }
                                          >
                                            <Users className="mr-1 h-3.5 w-3.5" />
                                            Editar membros
                                          </Button>
                                          {submission.teamInviteUrl ? (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-auto rounded-xl bg-white px-2.5 py-1.5 text-xs leading-tight"
                                              onClick={() =>
                                                void navigator.clipboard.writeText(
                                                  submission.teamInviteUrl ??
                                                    "",
                                                )
                                              }
                                            >
                                              <Copy className="mr-1 h-3.5 w-3.5" />
                                              Copiar link da equipa
                                            </Button>
                                          ) : null}
                                          {!submission.teamAllConfirmed &&
                                          pendingTeamMembers > 0 ? (
                                            <span className="text-xs font-medium text-amber-700">
                                              Falta {pendingTeamMembers}{" "}
                                              membro(s) confirmar(em).
                                            </span>
                                          ) : (
                                            <span className="text-xs font-medium text-emerald-700">
                                              Equipa pronta para passos
                                              documentais.
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Revisão financeira
                                          </p>
                                          <Badge
                                            variant="outline"
                                            className={
                                              courseEnrollmentStatusBadge[
                                                paymentStatus
                                              ]
                                            }
                                          >
                                            {submission.paymentStatusLabel ||
                                              courseEnrollmentStatusLabel[
                                                paymentStatus
                                              ]}
                                          </Badge>
                                        </div>
                                        <Textarea
                                          value={
                                            submissionPaymentReviewNotes[
                                              submission.id
                                            ] ?? ""
                                          }
                                          onChange={(event) =>
                                            setSubmissionPaymentReviewNotes(
                                              (current) => ({
                                                ...current,
                                                [submission.id]:
                                                  event.target.value,
                                              }),
                                            )
                                          }
                                          placeholder={
                                            submission.paymentReviewNote ||
                                            "Observação interna da revisão financeira"
                                          }
                                          className="min-h-16 text-sm"
                                        />
                                        {submission.paymentReviewedAt ? (
                                          <p className="mt-2 text-[11px] text-muted-foreground">
                                            Última revisão em{" "}
                                            {formatDateLabel(
                                              submission.paymentReviewedAt,
                                            )}
                                            {submission.paymentReviewedByStudentNumber
                                              ? ` por ${submission.paymentReviewedByStudentNumber}`
                                              : ""}
                                            {submission.paymentReviewNote
                                              ? ` · ${submission.paymentReviewNote}`
                                              : ""}
                                          </p>
                                        ) : (
                                          <p className="mt-2 text-[11px] text-muted-foreground">
                                            Comprovativo submetido em{" "}
                                            {submission.paymentSubmittedAt
                                              ? formatDateLabel(
                                                  submission.paymentSubmittedAt,
                                                )
                                              : "data não registada"}
                                            .
                                          </p>
                                        )}
                                        <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                          {(
                                            [
                                              "CONFIRMED_BY_ADMIN",
                                              "PENDING_REVIEW",
                                              "REJECTED",
                                              "CANCELED",
                                            ] as CourseEnrollmentStatus[]
                                          ).map((statusOption) => (
                                            <Button
                                              key={statusOption}
                                              size="sm"
                                              variant={
                                                paymentStatus === statusOption
                                                  ? statusOption === "REJECTED"
                                                    ? "destructive"
                                                    : "default"
                                                  : "outline"
                                              }
                                              className="w-full"
                                              disabled={
                                                busyKey ===
                                                `submission-payment-${submission.id}`
                                              }
                                              onClick={() =>
                                                void handleSubmissionPaymentStatusUpdate(
                                                  submission.id,
                                                  statusOption,
                                                )
                                              }
                                            >
                                              {busyKey ===
                                              `submission-payment-${submission.id}` ? (
                                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                              ) : null}
                                              {
                                                courseEnrollmentStatusLabel[
                                                  statusOption
                                                ]
                                              }
                                            </Button>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Capa do card do expositor
                                          </p>
                                          <Badge
                                            variant="outline"
                                            className={
                                              canManageBanner
                                                ? "border-[hsl(var(--success))]/30 text-[hsl(var(--success))]"
                                                : ""
                                            }
                                          >
                                            {canManageBanner
                                              ? "Edição disponível"
                                              : "Disponível após aprovação"}
                                          </Badge>
                                        </div>

                                        <div className="relative h-36 overflow-hidden rounded-xl border border-border/70">
                                          {bannerPreview ? (
                                            <img
                                              src={bannerPreview}
                                              alt={`Capa do expositor ${submission.nome}`}
                                              className="h-full w-full object-cover"
                                            />
                                          ) : (
                                            <div
                                              className="h-full w-full"
                                              style={{
                                                background:
                                                  submissionCoverGradient(
                                                    submission,
                                                  ),
                                              }}
                                            />
                                          )}
                                          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.28)_100%)]" />
                                          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                                            <ImagePlus className="h-3.5 w-3.5" />
                                            Hero do expositor
                                          </div>
                                        </div>

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                          <Input
                                            type="file"
                                            accept="image/*"
                                            className="max-w-[260px] text-sm"
                                            disabled={!canManageBanner}
                                            onChange={(event) => {
                                              void handleSubmissionBannerFile(
                                                submission,
                                                event.target.files?.[0] ?? null,
                                              );
                                              event.currentTarget.value = "";
                                            }}
                                          />
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={
                                              !canManageBanner ||
                                              busyKey ===
                                                `submission-banner-save-${submission.id}`
                                            }
                                            onClick={() =>
                                              void handleSubmissionBannerSave(
                                                submission,
                                              )
                                            }
                                          >
                                            {busyKey ===
                                            `submission-banner-save-${submission.id}` ? (
                                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                            ) : null}
                                            Guardar capa
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={
                                              !canManageBanner ||
                                              !bannerPreview ||
                                              busyKey ===
                                                `submission-banner-remove-${submission.id}`
                                            }
                                            onClick={() =>
                                              void handleSubmissionBannerRemove(
                                                submission,
                                              )
                                            }
                                          >
                                            {busyKey ===
                                            `submission-banner-remove-${submission.id}` ? (
                                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                                            )}
                                            Remover foto
                                          </Button>
                                        </div>
                                      </div>
                                    </>
                                  ) : null}

                                  <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight"
                                      onClick={() =>
                                        toggleSubmissionDetails(submission.id)
                                      }
                                    >
                                      <Eye className="mr-1 h-3.5 w-3.5" />
                                      {detailsOpen
                                        ? "Ocultar detalhes"
                                        : "Ver detalhes"}
                                    </Button>
                                    <Button
                                      asChild
                                      size="sm"
                                      variant="outline"
                                      className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight"
                                    >
                                      <Link to={submission.detailPath}>
                                        <Eye className="mr-1 h-3.5 w-3.5" />
                                        Ver página
                                      </Link>
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      asChild
                                      className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight"
                                    >
                                      <a
                                        href={paymentProofUrl}
                                        target="_blank"
                                        rel="noreferrer noopener"
                                      >
                                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                        Ver comprovativo
                                      </a>
                                    </Button>
                                    {whatsappUrl ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        asChild
                                        className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight"
                                      >
                                        <a
                                          href={whatsappUrl}
                                          target="_blank"
                                          rel="noreferrer noopener"
                                        >
                                          <MessageSquare className="mr-1 h-3.5 w-3.5" />
                                          Contactar no WhatsApp
                                        </a>
                                      </Button>
                                    ) : null}
                                    <ContextualSmsAction
                                      title="Enviar comunicação ao responsável"
                                      recipient={{
                                        name: submission.responsavel,
                                        phone: submission.telefone,
                                        course: submission.nome,
                                      }}
                                      defaultMessage="Olá {{nome}}, temos uma atualização sobre a tua candidatura no UOR Connect. Acompanha as orientações da equipa no painel."
                                    />
                                    {submission.status === "aprovado" &&
                                    paymentConfirmed ? (
                                      <SubmissionPdfShareAction
                                        submission={submission}
                                      />
                                    ) : null}
                                    {communityUrl ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        asChild
                                        className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight"
                                      >
                                        <a
                                          href={communityUrl}
                                          target="_blank"
                                          rel="noreferrer noopener"
                                        >
                                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                          Abrir comunidade
                                        </a>
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant={submission.projectFrozen ? "outline" : "destructive"}
                                      className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight"
                                      disabled={busyKey === `submission-freeze-${submission.id}`}
                                      onClick={() => void handleSubmissionFreezeToggle(submission)}
                                    >
                                      {busyKey === `submission-freeze-${submission.id}` ? (
                                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                      ) : submission.projectFrozen ? (
                                        <Power className="mr-1 h-3.5 w-3.5" />
                                      ) : (
                                        <PowerOff className="mr-1 h-3.5 w-3.5" />
                                      )}
                                      {submission.projectFrozen ? "Descongelar projeto" : "Congelar projeto"}
                                    </Button>
                                    {submission.status === "pendente" && (
                                      <>
                                        <Button
                                          size="sm"
                                          className="h-auto whitespace-normal bg-[hsl(var(--success))] px-2.5 py-1.5 text-xs leading-tight text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/90"
                                          onClick={() =>
                                            void handleStatusChange(
                                              submission.id,
                                              "aprovado",
                                            )
                                          }
                                        >
                                          <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                          Aprovar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight"
                                          onClick={() =>
                                            void handleStatusChange(
                                              submission.id,
                                              "recusado",
                                            )
                                          }
                                        >
                                          <XCircle className="mr-1 h-3.5 w-3.5" />
                                          Recusar
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight"
                                      onClick={() =>
                                        setSubmissionPendingRemoval(submission)
                                      }
                                      disabled={
                                        isRemovingSubmission &&
                                        submissionPendingRemoval?.id ===
                                          submission.id
                                      }
                                    >
                                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                                      Eliminar expositor
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>

                      <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
                        <p className="text-muted-foreground">
                          Página {paginatedSubmissions.currentPage} de{" "}
                          {paginatedSubmissions.totalPages}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setSubmissionPage((current) =>
                                Math.max(1, current - 1),
                              )
                            }
                            disabled={
                              loadingSubmissionsList ||
                              paginatedSubmissions.currentPage <= 1
                            }
                          >
                            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                            Anterior
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setSubmissionPage((current) =>
                                Math.min(
                                  paginatedSubmissions.totalPages,
                                  current + 1,
                                ),
                              )
                            }
                            disabled={
                              loadingSubmissionsList ||
                              paginatedSubmissions.currentPage >=
                                paginatedSubmissions.totalPages
                            }
	                          >
	                            Próximo
	                            <ChevronRight className="ml-1 h-3.5 w-3.5" />
	                          </Button>
	                        </div>
	                      </div>
	                        </>
	                      ) : (
	                        <div className="space-y-4">
	                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
	                            {[
	                              {
	                                label: "Projetos",
	                                value: projectComplianceSummary.total,
	                                icon: FolderOpen,
	                              },
	                              {
	                                label: "Com foto",
	                                value: projectComplianceSummary.withPhoto,
	                                icon: ImagePlus,
	                              },
	                              {
	                                label: "Presença",
	                                value: projectComplianceSummary.withTeamConfirmed,
	                                icon: UserCheck,
	                              },
	                              {
	                                label: "Perguntas",
	                                value: projectComplianceSummary.withQuestions,
	                                icon: HelpCircle,
	                              },
	                              {
	                                label: "Prontos",
	                                value: projectComplianceSummary.fullyReady,
	                                icon: CheckCircle,
	                              },
	                            ].map((item) => {
	                              const Icon = item.icon;
	                              return (
	                                <div key={item.label} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
	                                  <div className="flex items-center justify-between gap-3">
	                                    <div>
	                                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
	                                      <p className="mt-1 text-2xl font-black text-foreground">{item.value}</p>
	                                    </div>
	                                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
	                                      <Icon className="h-4 w-4" />
	                                    </span>
	                                  </div>
	                                </div>
	                              );
	                            })}
	                          </div>

	                          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
	                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
	                              <div>
	                                <h3 className="text-base font-black text-foreground">Projetos e obrigações</h3>
	                                <p className="mt-1 text-sm text-muted-foreground">
	                                  Acompanha foto do projeto, presença dos membros, pergunta do desafio e manual do expositor num único lugar.
	                                </p>
	                              </div>
	                              <Button
	                                type="button"
	                                size="sm"
	                                variant="outline"
	                                className="w-full rounded-xl lg:w-auto"
	                                disabled={loadingProjectObligations}
	                                onClick={() => {
	                                  setProjectObligationRows([]);
	                                  setProjectObligationRefreshKey((current) => current + 1);
	                                }}
	                              >
	                                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingProjectObligations ? "animate-spin" : ""}`} />
	                                Atualizar lista
	                              </Button>
	                            </div>

	                            <div className="mt-4 grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto] lg:items-end">
	                              <div className="min-w-0">
	                                <label className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
	                                  Tipo de aviso
	                                </label>
	                                <select
	                                  className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold"
	                                  value={projectObligationNoticeType}
	                                  onChange={(event) => {
	                                    setProjectObligationNoticeType(
	                                      event.target.value as ProjectObligationNoticeType,
	                                    );
	                                    setProjectObligationNoticeResult(null);
	                                  }}
	                                >
	                                  {projectObligationNoticeOptions.map((option) => (
	                                    <option key={option.id} value={option.id}>
	                                      {option.label}
	                                    </option>
	                                  ))}
	                                </select>
	                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
	                                  {selectedProjectObligationNoticeOption.description}
	                                </p>
	                              </div>

	                              <div className="min-w-0">
	                                <label className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
	                                  Canal de envio
	                                </label>
	                                <select
	                                  className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold"
	                                  value={projectObligationNoticeChannel}
	                                  onChange={(event) => {
	                                    setProjectObligationNoticeChannel(
	                                      event.target.value as ProjectObligationNoticeChannel,
	                                    );
	                                    setProjectObligationNoticeResult(null);
	                                  }}
	                                >
	                                  {projectObligationChannelOptions.map((option) => (
	                                    <option key={option.id} value={option.id}>
	                                      {option.label}
	                                    </option>
	                                  ))}
	                                </select>
	                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
	                                  {selectedProjectObligationChannelOption.description}
	                                </p>
	                              </div>

	                              <div className="min-w-0 rounded-xl border border-border/60 bg-background px-3 py-2">
	                                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
	                                  Projetos afetados
	                                </p>
	                                <p className="mt-1 text-2xl font-black text-foreground">
	                                  {projectObligationNoticeTargets.length}
	                                </p>
	                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
	                                  O envio usa os contactos confirmados do responsável e dos membros disponíveis.
	                                </p>
	                              </div>

	                              <Button
	                                type="button"
	                                className="w-full rounded-xl lg:w-auto"
	                                disabled={
	                                  sendingProjectObligationNotices ||
	                                  loadingProjectObligations ||
	                                  projectObligationNoticeTargets.length === 0
	                                }
	                                onClick={() => void handleSendProjectObligationNotices()}
	                              >
	                                {sendingProjectObligationNotices ? (
	                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
	                                ) : (
	                                  <Send className="mr-2 h-4 w-4" />
	                                )}
	                                Enviar avisos
	                              </Button>
	                            </div>

	                            {projectObligationNoticeResult ? (
	                              <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
	                                <div className="flex flex-wrap items-center gap-2 text-sm">
	                                  <Badge variant="outline">
	                                    {projectObligationNoticeResult.processedProjects} projeto(s) processado(s)
	                                  </Badge>
	                                  <Badge variant="outline">
	                                    {projectObligationNoticeResult.successCount}/{projectObligationNoticeResult.totalRecipients} envio(s)
	                                  </Badge>
	                                  <Badge variant="outline">
	                                    {projectObligationNoticeResult.skippedProjects} ignorado(s)
	                                  </Badge>
	                                  {projectObligationNoticeResult.failedCount > 0 ? (
	                                    <Badge variant="destructive">
	                                      {projectObligationNoticeResult.failedCount} falha(s)
	                                    </Badge>
	                                  ) : null}
	                                </div>
	                                {projectObligationNoticeResult.failures.length > 0 ? (
	                                  <div className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
	                                    {projectObligationNoticeResult.failures.map((failure) => (
	                                      <p key={failure}>{failure}</p>
	                                    ))}
	                                  </div>
	                                ) : null}
	                              </div>
	                            ) : null}
	                          </div>

	                          {loadingProjectObligations && projectComplianceRows.length === 0 ? (
	                            <div className="flex items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 py-12 text-sm text-muted-foreground">
	                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
	                              A carregar projetos e obrigações
	                            </div>
	                          ) : projectComplianceRows.length === 0 ? (
	                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
	                              Nenhum projeto encontrado nesta vista.
	                            </div>
	                          ) : (
	                            <div className="space-y-4">
	                              {projectComplianceRows.map((submission) => {
	                                const teamConfirmed = submission.teamAllConfirmed;
	                                const hasPhoto = Boolean(submission.bannerUrl);
	                                const hasQuestion = submission.exhibitorChallengeStatus !== "MISSING";
	                                const questionLabel =
	                                  submission.exhibitorChallengeStatus === "APPROVED"
	                                    ? "Pergunta aprovada"
	                                    : submission.exhibitorChallengeStatus === "PENDING_APPROVAL"
	                                      ? "Pergunta em análise"
	                                      : submission.exhibitorChallengeStatus === "REJECTED"
	                                        ? "Pergunta recusada"
	                                        : submission.exhibitorChallengeStatus === "PAUSED"
	                                          ? "Pergunta pausada"
	                                          : "Sem pergunta";
	                                const obligations = [
	                                  {
	                                    label: "Foto do projeto",
	                                    done: hasPhoto,
	                                    detail: hasPhoto ? "Capa adicionada" : "Sem foto/capa",
	                                    icon: ImagePlus,
	                                  },
	                                  {
	                                    label: "Confirmar presença",
	                                    done: teamConfirmed,
	                                    detail: `${submission.teamConfirmedMembers}/${submission.teamTotalMembers} membro(s)`,
	                                    icon: UserCheck,
	                                  },
	                                  {
	                                    label: "Submeter perguntas",
	                                    done: hasQuestion,
	                                    detail: questionLabel,
	                                    icon: HelpCircle,
	                                  },
	                                  {
	                                    label: "Baixar manual",
	                                    done: true,
	                                    detail: "Disponível para download",
	                                    icon: FileText,
	                                  },
	                                ];
	                                return (
	                                  <Card key={submission.id} className="overflow-hidden border-border/60">
	                                    <CardContent className="p-0">
	                                      <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
	                                        <div className="min-w-0 border-b border-border/60 p-4 xl:border-b-0 xl:border-r">
	                                          <div className="flex min-w-0 items-start gap-3">
	                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-muted text-sm font-black text-muted-foreground">
	                                              {submission.bannerUrl ? (
	                                                <img src={submission.bannerUrl} alt={`Foto do projeto ${submission.nome}`} className="h-full w-full object-cover" />
	                                              ) : (
	                                                submission.nome.slice(0, 2).toUpperCase()
	                                              )}
	                                            </div>
	                                            <div className="min-w-0 flex-1">
	                                              <div className="flex flex-wrap items-center gap-2">
	                                                <h4 className="min-w-0 truncate text-base font-black text-foreground">{submission.nome}</h4>
	                                                <Badge variant="outline">{submission.referenceCode}</Badge>
	                                                <Badge variant={submission.status === "aprovado" ? "default" : "outline"}>{submission.status}</Badge>
	                                                {submission.projectFrozen ? (
	                                                  <Badge variant="destructive">Projeto suspenso</Badge>
	                                                ) : null}
	                                              </div>
	                                              <p className="mt-1 text-xs font-semibold text-muted-foreground">
	                                                {submission.curso} · {submission.area} · {submission.tipo}
	                                              </p>
	                                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
	                                                {submission.descricao}
	                                              </p>
	                                            </div>
	                                          </div>

	                                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
	                                            <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
	                                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Responsável</p>
	                                              <p className="mt-1 truncate text-sm font-semibold text-foreground">{submission.responsavel}</p>
	                                              <p className="mt-0.5 truncate text-xs text-muted-foreground">{submission.telefone || "Sem telefone"}</p>
	                                            </div>
	                                            <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
	                                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Equipa</p>
	                                              <p className="mt-1 text-sm font-semibold text-foreground">{submission.teamConfirmedMembers}/{submission.teamTotalMembers} confirmados</p>
	                                              <p className="mt-0.5 truncate text-xs text-muted-foreground">{submission.teamJourneyLabel}</p>
	                                            </div>
	                                          </div>

	                                          <div className="mt-4 flex flex-wrap gap-2">
	                                            <label
	                                              className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-2.5 text-xs font-semibold ${tipoBadgeColors[submission.tipo]}`}
	                                              htmlFor={`project-obligation-submission-type-${submission.id}`}
	                                            >
	                                              <span className="text-[10px] uppercase tracking-[0.14em] opacity-70">
	                                                Categoria
	                                              </span>
	                                              <select
	                                                id={`project-obligation-submission-type-${submission.id}`}
	                                                className="max-w-[110px] bg-transparent font-bold outline-none disabled:cursor-not-allowed disabled:opacity-60"
	                                                value={submission.tipo}
	                                                disabled={busyKey === `submission-type-${submission.id}`}
	                                                onChange={(event) =>
	                                                  void handleSubmissionTypeChange(
	                                                    submission,
	                                                    event.target.value as AdminSubmission["tipo"],
	                                                  )
	                                                }
	                                              >
	                                                {submissionTypeOptions.map((option) => (
	                                                  <option key={option.value} value={option.value}>
	                                                    {option.label}
	                                                  </option>
	                                                ))}
	                                              </select>
	                                            </label>
	                                            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openSubmissionTeamMembersDialog(submission)}>
	                                              <Edit className="mr-1 h-3.5 w-3.5" />
	                                              Editar membros
	                                            </Button>
	                                            <Button
	                                              size="sm"
	                                              variant={submission.projectFrozen ? "outline" : "destructive"}
	                                              className="rounded-xl"
	                                              disabled={busyKey === `submission-freeze-${submission.id}`}
	                                              onClick={() => void handleSubmissionFreezeToggle(submission)}
	                                            >
	                                              {busyKey === `submission-freeze-${submission.id}` ? (
	                                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
	                                              ) : submission.projectFrozen ? (
	                                                <Power className="mr-1 h-3.5 w-3.5" />
	                                              ) : (
	                                                <PowerOff className="mr-1 h-3.5 w-3.5" />
	                                              )}
	                                              {submission.projectFrozen ? "Descongelar projeto" : "Congelar projeto"}
	                                            </Button>
	                                            <Button
	                                              size="sm"
	                                              variant="outline"
	                                              className="rounded-xl"
	                                              disabled={busyKey === `submission-manual-${submission.id}`}
	                                              onClick={() => void handleDownloadExhibitorManual(submission)}
	                                            >
	                                              {busyKey === `submission-manual-${submission.id}` ? (
	                                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
	                                              ) : (
	                                                <Download className="mr-1 h-3.5 w-3.5" />
	                                              )}
	                                              Baixar manual
	                                            </Button>
	                                            <Button asChild size="sm" variant="outline" className="rounded-xl">
	                                              <Link to={submission.detailPath}>
	                                                <ExternalLink className="mr-1 h-3.5 w-3.5" />
	                                                Ver página
	                                              </Link>
	                                            </Button>
	                                          </div>
	                                        </div>

	                                        <div className="min-w-0 p-4">
	                                          <div className="grid gap-2 md:grid-cols-4">
	                                            {obligations.map((obligation) => {
	                                              const Icon = obligation.icon;
	                                              return (
	                                                <div key={obligation.label} className={`rounded-2xl border px-3 py-2 ${
	                                                  obligation.done
	                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
	                                                    : "border-amber-200 bg-amber-50 text-amber-900"
	                                                }`}>
	                                                  <div className="flex items-center justify-between gap-2">
	                                                    <Icon className="h-4 w-4" />
	                                                    {obligation.done ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
	                                                  </div>
	                                                  <p className="mt-2 text-xs font-black">{obligation.label}</p>
	                                                  <p className="mt-0.5 text-[11px] leading-4 opacity-80">{obligation.detail}</p>
	                                                </div>
	                                              );
	                                            })}
	                                          </div>

	                                          <div className="mt-4 rounded-2xl border border-border/60">
	                                            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
	                                              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Membros do projeto</p>
	                                              <Badge variant="outline">{submission.teamMembers.length || getAdminSubmissionTeamMemberNames(submission).length}</Badge>
	                                            </div>
	                                            <div className="max-h-72 space-y-2 overflow-y-auto p-3">
	                                              {submission.teamMembers.length > 0 ? (
	                                                submission.teamMembers.map((member) => (
	                                                  <div key={member.id} className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
	                                                    <div className="flex flex-wrap items-center justify-between gap-2">
	                                                      <div className="min-w-0">
	                                                        <p className="truncate text-sm font-bold text-foreground">{member.name}</p>
	                                                        <p className="mt-0.5 text-xs text-muted-foreground">
	                                                          {member.roleLabel}
	                                                          {member.isResponsible ? " · Responsável" : ""}
	                                                        </p>
	                                                      </div>
	                                                      <Badge variant={member.confirmed ? "default" : "outline"}>
	                                                        {member.confirmed ? "Confirmado" : "Pendente"}
	                                                      </Badge>
	                                                    </div>
	                                                    <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
	                                                      <span className="rounded-lg bg-background px-2 py-1 text-muted-foreground">
	                                                        Nº esperado: {member.expectedStudentNumber ?? "não definido"}
	                                                      </span>
	                                                      <span className="rounded-lg bg-background px-2 py-1 text-muted-foreground">
	                                                        Nº confirmado: {member.studentNumber ?? "pendente"}
	                                                      </span>
	                                                      <span className="rounded-lg bg-background px-2 py-1 text-muted-foreground">
	                                                        Nome oficial: {member.studentName ?? member.name}
	                                                      </span>
	                                                      <span className="rounded-lg bg-background px-2 py-1 text-muted-foreground">
	                                                        Curso: {member.studentCourse ?? member.externalOrganization ?? "não informado"}
	                                                      </span>
	                                                    </div>
	                                                  </div>
	                                                ))
	                                              ) : (
	                                                getAdminSubmissionTeamMemberNames(submission).map((name) => (
	                                                  <div key={name} className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
	                                                    {name}
	                                                  </div>
	                                                ))
	                                              )}
	                                            </div>
	                                          </div>

	                                          {submission.exhibitorChallengeQuestion ? (
	                                            <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2">
	                                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sky-700">Pergunta submetida</p>
	                                              <p className="mt-1 text-sm font-semibold text-sky-950">{submission.exhibitorChallengeQuestion}</p>
	                                              <p className="mt-1 text-xs text-sky-700">
	                                                {submission.exhibitorChallengeAnswersCount} resposta(s) no desafio
	                                                {submission.exhibitorChallengeUpdatedAt ? ` · atualizado em ${formatDateTime(submission.exhibitorChallengeUpdatedAt)}` : ""}
	                                              </p>
	                                            </div>
	                                          ) : null}
	                                        </div>
	                                      </div>
	                                    </CardContent>
	                                  </Card>
	                                );
	                              })}
	                            </div>
	                          )}
	                        </div>
	                      )}
	                    </>
	                  )}

                  {activeTab === "speakers" && (
                    <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">
                            {editingSpeakerId
                              ? "Editar palestrante"
                              : "Novo palestrante"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField label="Nome">
                            <Input
                              value={speakerForm.name}
                              onChange={(event) =>
                                setSpeakerForm((current) => ({
                                  ...current,
                                  name: event.target.value,
                                }))
                              }
                            />
                          </FormField>
                          <FormField label="Especialidade">
                            <Input
                              value={speakerForm.specialty}
                              onChange={(event) =>
                                setSpeakerForm((current) => ({
                                  ...current,
                                  specialty: event.target.value,
                                }))
                              }
                            />
                          </FormField>
                          <FormField label="Palestra">
                            <Input
                              value={speakerForm.talk}
                              onChange={(event) =>
                                setSpeakerForm((current) => ({
                                  ...current,
                                  talk: event.target.value,
                                }))
                              }
                            />
                          </FormField>
                          <FormField label="Dia / horário">
                            <Input
                              value={speakerForm.day}
                              onChange={(event) =>
                                setSpeakerForm((current) => ({
                                  ...current,
                                  day: event.target.value,
                                }))
                              }
                              placeholder="Dia 1 — 09:30"
                            />
                          </FormField>
                          <FormField label="LinkedIn">
                            <Input
                              value={speakerForm.linkedin}
                              onChange={(event) =>
                                setSpeakerForm((current) => ({
                                  ...current,
                                  linkedin: event.target.value,
                                }))
                              }
                            />
                          </FormField>
                          <FormField label="Fotografia">
                            <div className="overflow-hidden rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-white to-[hsl(var(--success))]/5">
                              <div className="flex flex-col gap-4 p-3 sm:flex-row sm:items-center">
                                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white bg-slate-100 shadow-sm">
                                  {speakerForm.avatarUrl ? (
                                    <img
                                      src={adminMediaSrc(speakerForm.avatarUrl)}
                                      alt="Prévia do palestrante"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-primary">
                                      <Mic className="h-8 w-8" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 space-y-3">
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">
                                      Upload para o storage do projeto
                                    </p>
                                    <p className="text-xs leading-5 text-muted-foreground">
                                      Usa uma foto de rosto em JPG, PNG ou WebP.
                                      O sistema comprime, guarda e reutiliza a
                                      URL oficial.
                                    </p>
                                  </div>
                                  <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="relative overflow-hidden"
                                    >
                                      {busyKey === "speaker-avatar" ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      ) : (
                                        <ImagePlus className="mr-2 h-4 w-4" />
                                      )}
                                      Escolher imagem
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 cursor-pointer opacity-0"
                                        onChange={(event) =>
                                          void handleSpeakerAvatarFile(
                                            event.target.files?.[0] ?? null,
                                          )
                                        }
                                      />
                                    </Button>
                                    {speakerForm.avatarUrl && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() =>
                                          setSpeakerForm((current) => ({
                                            ...current,
                                            avatarUrl: "",
                                          }))
                                        }
                                      >
                                        Remover foto
                                      </Button>
                                    )}
                                  </div>
                                  <Input
                                    value={normalizeOptionalText(
                                      speakerForm.avatarUrl,
                                    )}
                                    onChange={(event) =>
                                      setSpeakerForm((current) => ({
                                        ...current,
                                        avatarUrl: event.target.value,
                                      }))
                                    }
                                    placeholder="/api/media/files/avatars/..."
                                    className="font-mono text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          </FormField>
                          <FormField label="Bio">
                            <Textarea
                              value={speakerForm.bio}
                              onChange={(event) =>
                                setSpeakerForm((current) => ({
                                  ...current,
                                  bio: event.target.value,
                                }))
                              }
                              className="min-h-28"
                            />
                          </FormField>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={() => void handleSpeakerSubmit()}
                              disabled={busyKey === "speaker"}
                            >
                              {editingSpeakerId ? "Atualizar" : "Criar"}{" "}
                              palestrante
                            </Button>
                            {editingSpeakerId && (
                              <Button
                                variant="outline"
                                onClick={resetSpeakerForm}
                              >
                                Cancelar edição
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid gap-3 md:grid-cols-2">
                        {speakers.map((speaker) => (
                          <Card
                            key={speaker.id}
                            className="overflow-hidden border-border/60 bg-white shadow-sm"
                          >
                            <CardContent className="space-y-3 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-3">
                                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-primary/20 bg-primary/10">
                                    {speaker.avatarUrl ? (
                                      <img
                                        src={adminMediaSrc(speaker.avatarUrl)}
                                        alt={speaker.name}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-primary">
                                        <Mic className="h-5 w-5" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">
                                      {speaker.name}
                                    </p>
                                    <p className="text-xs font-medium text-primary">
                                      {speaker.specialty}
                                    </p>
                                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                      {speaker.talk}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant="outline">{speaker.day}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {speaker.bio}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingSpeakerId(speaker.id);
                                    setSpeakerForm({
                                      name: speaker.name,
                                      bio: speaker.bio,
                                      specialty: speaker.specialty,
                                      talk: speaker.talk,
                                      day: speaker.day,
                                      linkedin: speaker.linkedin,
                                      avatarUrl: speaker.avatarUrl ?? "",
                                    });
                                  }}
                                >
                                  <Edit className="mr-1 h-3.5 w-3.5" />
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    void handleSpeakerDelete(speaker.id)
                                  }
                                  disabled={
                                    busyKey === `speaker-delete-${speaker.id}`
                                  }
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  Remover
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "trainers" && (
                    <Suspense
                      fallback={<AdminPanelFallback label="Formadores" />}
                    >
                      <AdminTrainersTab />
                    </Suspense>
                  )}

                  {activeTab === "schedule" && (
                    <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">
                            {editingScheduleId
                              ? "Editar sessão"
                              : "Nova sessão"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField label="Dia">
                              <select
                                value={scheduleForm.day}
                                onChange={(event) =>
                                  setScheduleForm((current) => ({
                                    ...current,
                                    day: event.target
                                      .value as AgendaInput["day"],
                                  }))
                                }
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              >
                                <option value="DAY1">Dia 1</option>
                                <option value="DAY2">Dia 2</option>
                              </select>
                            </FormField>
                            <FormField label="Data">
                              <Input
                                type="date"
                                value={scheduleForm.date}
                                onChange={(event) =>
                                  setScheduleForm((current) => ({
                                    ...current,
                                    date: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Hora inicial">
                              <Input
                                type="time"
                                value={scheduleForm.startTime}
                                onChange={(event) =>
                                  setScheduleForm((current) => ({
                                    ...current,
                                    startTime: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Hora final">
                              <Input
                                type="time"
                                value={scheduleForm.endTime}
                                onChange={(event) =>
                                  setScheduleForm((current) => ({
                                    ...current,
                                    endTime: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Tipo">
                              <select
                                value={scheduleForm.type}
                                onChange={(event) =>
                                  setScheduleForm((current) => ({
                                    ...current,
                                    type: event.target
                                      .value as AgendaInput["type"],
                                  }))
                                }
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              >
                                <option value="PANEL">Painel</option>
                                <option value="WORKSHOP">Workshop</option>
                                <option value="PRESENTATION">
                                  Apresentação
                                </option>
                                <option value="CEREMONY">Cerimónia</option>
                                <option value="BREAK">Intervalo</option>
                              </select>
                            </FormField>
                            <FormField label="Tema">
                              <Input
                                value={scheduleForm.theme}
                                onChange={(event) =>
                                  setScheduleForm((current) => ({
                                    ...current,
                                    theme: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                          </div>
                          <FormField label="Título">
                            <Input
                              value={scheduleForm.title}
                              onChange={(event) =>
                                setScheduleForm((current) => ({
                                  ...current,
                                  title: event.target.value,
                                }))
                              }
                            />
                          </FormField>
                          <FormField label="Local">
                            <Input
                              value={scheduleForm.local}
                              onChange={(event) =>
                                setScheduleForm((current) => ({
                                  ...current,
                                  local: event.target.value,
                                }))
                              }
                            />
                          </FormField>
                          <FormField label="Orador / responsável">
                            <Input
                              value={scheduleForm.speaker}
                              onChange={(event) =>
                                setScheduleForm((current) => ({
                                  ...current,
                                  speaker: event.target.value,
                                }))
                              }
                            />
                          </FormField>
                          <FormField label="Descrição">
                            <Textarea
                              value={scheduleForm.description}
                              onChange={(event) =>
                                setScheduleForm((current) => ({
                                  ...current,
                                  description: event.target.value,
                                }))
                              }
                              className="min-h-28"
                            />
                          </FormField>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={() => void handleAgendaSubmit()}
                              disabled={busyKey === "agenda"}
                            >
                              {editingScheduleId ? "Atualizar" : "Criar"} sessão
                            </Button>
                            {editingScheduleId && (
                              <Button
                                variant="outline"
                                onClick={resetScheduleForm}
                              >
                                Cancelar edição
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-3">
                        {sortedAgenda.map((item) => (
                          <Card key={item.id} className="border-border/60">
                            <CardContent className="space-y-3 p-4">
                              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                <div className="w-20 text-center">
                                  <p className="text-xs font-bold text-primary">
                                    {item.startTime}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {item.endTime}
                                  </p>
                                </div>
                                <div className="hidden h-10 w-px bg-border md:block" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">
                                    {item.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.local} · {formatAgendaDay(item.day)} ·{" "}
                                    {formatDateLabel(item.date)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.theme}
                                  </p>
                                </div>
                                <Badge variant="outline">
                                  {formatAgendaType(item.type)}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingScheduleId(item.id);
                                    setScheduleForm({
                                      day: item.day as AgendaInput["day"],
                                      date: toDateInputValue(item.date),
                                      startTime: item.startTime,
                                      endTime: item.endTime,
                                      title: item.title,
                                      local: item.local,
                                      speaker: item.speaker,
                                      description: item.description,
                                      type: item.type as AgendaInput["type"],
                                      theme: item.theme,
                                    });
                                  }}
                                >
                                  <Edit className="mr-1 h-3.5 w-3.5" />
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    void handleAgendaDelete(item.id)
                                  }
                                  disabled={
                                    busyKey === `agenda-delete-${item.id}`
                                  }
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  Remover
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "guide" && (
                    <div className="space-y-6">
                      <div className="grid gap-6 xl:grid-cols-3">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              {editingGuideStepId
                                ? "Editar passo"
                                : "Novo passo do guia"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField label="Título">
                              <Input
                                value={guideStepForm.title}
                                onChange={(event) =>
                                  setGuideStepForm((current) => ({
                                    ...current,
                                    title: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Descrição">
                              <Textarea
                                value={guideStepForm.description}
                                onChange={(event) =>
                                  setGuideStepForm((current) => ({
                                    ...current,
                                    description: event.target.value,
                                  }))
                                }
                                className="min-h-24"
                              />
                            </FormField>
                            <FormField label="Ícone">
                              <select
                                value={guideStepForm.icon}
                                onChange={(event) =>
                                  setGuideStepForm((current) => ({
                                    ...current,
                                    icon: event.target.value,
                                  }))
                                }
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              >
                                {guideIconOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </FormField>
                            <FormField label="Link">
                              <Input
                                value={normalizeOptionalText(
                                  guideStepForm.link,
                                )}
                                onChange={(event) =>
                                  setGuideStepForm((current) => ({
                                    ...current,
                                    link: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Texto do link">
                              <Input
                                value={normalizeOptionalText(
                                  guideStepForm.linkText,
                                )}
                                onChange={(event) =>
                                  setGuideStepForm((current) => ({
                                    ...current,
                                    linkText: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Ordem">
                              <Input
                                type="number"
                                value={guideStepForm.sortOrder ?? 0}
                                onChange={(event) =>
                                  setGuideStepForm((current) => ({
                                    ...current,
                                    sortOrder: Number(event.target.value),
                                  }))
                                }
                              />
                            </FormField>
                            <div className="flex items-center justify-between rounded-lg border border-border p-3">
                              <span className="text-sm">Publicado</span>
                              <Switch
                                checked={guideStepForm.isPublished ?? true}
                                onCheckedChange={(checked) =>
                                  setGuideStepForm((current) => ({
                                    ...current,
                                    isPublished: checked,
                                  }))
                                }
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => void handleGuideStepSubmit()}
                                disabled={busyKey === "guide-step"}
                              >
                                {editingGuideStepId ? "Atualizar" : "Criar"}{" "}
                                passo
                              </Button>
                              {editingGuideStepId && (
                                <Button
                                  variant="outline"
                                  onClick={resetGuideStepForm}
                                >
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              {editingGuideTipId ? "Editar dica" : "Nova dica"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField label="Conteúdo">
                              <Textarea
                                value={guideTipForm.content}
                                onChange={(event) =>
                                  setGuideTipForm((current) => ({
                                    ...current,
                                    content: event.target.value,
                                  }))
                                }
                                className="min-h-28"
                              />
                            </FormField>
                            <FormField label="Ordem">
                              <Input
                                type="number"
                                value={guideTipForm.sortOrder ?? 0}
                                onChange={(event) =>
                                  setGuideTipForm((current) => ({
                                    ...current,
                                    sortOrder: Number(event.target.value),
                                  }))
                                }
                              />
                            </FormField>
                            <div className="flex items-center justify-between rounded-lg border border-border p-3">
                              <span className="text-sm">Publicado</span>
                              <Switch
                                checked={guideTipForm.isPublished ?? true}
                                onCheckedChange={(checked) =>
                                  setGuideTipForm((current) => ({
                                    ...current,
                                    isPublished: checked,
                                  }))
                                }
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => void handleGuideTipSubmit()}
                                disabled={busyKey === "guide-tip"}
                              >
                                {editingGuideTipId ? "Atualizar" : "Criar"} dica
                              </Button>
                              {editingGuideTipId && (
                                <Button
                                  variant="outline"
                                  onClick={resetGuideTipForm}
                                >
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              {editingVenueId ? "Editar local" : "Novo local"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField label="Nome">
                              <Input
                                value={venueForm.name}
                                onChange={(event) =>
                                  setVenueForm((current) => ({
                                    ...current,
                                    name: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Descrição">
                              <Textarea
                                value={venueForm.description}
                                onChange={(event) =>
                                  setVenueForm((current) => ({
                                    ...current,
                                    description: event.target.value,
                                  }))
                                }
                                className="min-h-24"
                              />
                            </FormField>
                            <FormField label="Capacidade">
                              <Input
                                value={venueForm.capacity}
                                onChange={(event) =>
                                  setVenueForm((current) => ({
                                    ...current,
                                    capacity: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Piso">
                              <Input
                                value={venueForm.floor}
                                onChange={(event) =>
                                  setVenueForm((current) => ({
                                    ...current,
                                    floor: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Ordem">
                              <Input
                                type="number"
                                value={venueForm.sortOrder ?? 0}
                                onChange={(event) =>
                                  setVenueForm((current) => ({
                                    ...current,
                                    sortOrder: Number(event.target.value),
                                  }))
                                }
                              />
                            </FormField>
                            <div className="flex items-center justify-between rounded-lg border border-border p-3">
                              <span className="text-sm">Publicado</span>
                              <Switch
                                checked={venueForm.isPublished ?? true}
                                onCheckedChange={(checked) =>
                                  setVenueForm((current) => ({
                                    ...current,
                                    isPublished: checked,
                                  }))
                                }
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => void handleVenueSubmit()}
                                disabled={busyKey === "venue"}
                              >
                                {editingVenueId ? "Atualizar" : "Criar"} local
                              </Button>
                              {editingVenueId && (
                                <Button
                                  variant="outline"
                                  onClick={resetVenueForm}
                                >
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid gap-6 lg:grid-cols-3">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Passos do guia
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {guideContent.steps.map((step) => (
                              <div
                                key={step.id}
                                className="rounded-xl border border-border p-3"
                              >
                                <div className="mb-2 flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-medium">
                                      {step.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {step.icon} · ordem {step.sortOrder}
                                    </p>
                                  </div>
                                  <Badge variant="outline">
                                    {step.isPublished
                                      ? "Publicado"
                                      : "Rascunho"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {step.description}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingGuideStepId(step.id);
                                      setGuideStepForm({
                                        title: step.title,
                                        description: step.description,
                                        link: step.link ?? "",
                                        linkText: step.linkText ?? "",
                                        icon: step.icon,
                                        sortOrder: step.sortOrder,
                                        isPublished: step.isPublished,
                                      });
                                    }}
                                  >
                                    <Edit className="mr-1 h-3.5 w-3.5" />
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      void handleGuideStepDelete(step.id)
                                    }
                                    disabled={
                                      busyKey === `guide-step-delete-${step.id}`
                                    }
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    Remover
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Dicas úteis
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {guideContent.tips.map((tip) => (
                              <div
                                key={tip.id}
                                className="rounded-xl border border-border p-3"
                              >
                                <div className="mb-2 flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium">
                                    Ordem {tip.sortOrder}
                                  </p>
                                  <Badge variant="outline">
                                    {tip.isPublished ? "Publicado" : "Rascunho"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {tip.content}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingGuideTipId(tip.id);
                                      setGuideTipForm({
                                        content: tip.content,
                                        sortOrder: tip.sortOrder,
                                        isPublished: tip.isPublished,
                                      });
                                    }}
                                  >
                                    <Edit className="mr-1 h-3.5 w-3.5" />
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      void handleGuideTipDelete(tip.id)
                                    }
                                    disabled={
                                      busyKey === `guide-tip-delete-${tip.id}`
                                    }
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    Remover
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Locais do evento
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {guideContent.venues.map((venue) => (
                              <div
                                key={venue.id}
                                className="rounded-xl border border-border p-3"
                              >
                                <div className="mb-2 flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-medium">
                                      {venue.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {venue.capacity} · {venue.floor}
                                    </p>
                                  </div>
                                  <Badge variant="outline">
                                    {venue.isPublished
                                      ? "Publicado"
                                      : "Rascunho"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {venue.description}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingVenueId(venue.id);
                                      setVenueForm({
                                        name: venue.name,
                                        description: venue.description,
                                        capacity: venue.capacity,
                                        floor: venue.floor,
                                        sortOrder: venue.sortOrder,
                                        isPublished: venue.isPublished,
                                      });
                                    }}
                                  >
                                    <Edit className="mr-1 h-3.5 w-3.5" />
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      void handleVenueDelete(venue.id)
                                    }
                                    disabled={
                                      busyKey === `venue-delete-${venue.id}`
                                    }
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    Remover
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {activeTab === "courses" && (
                    <div className="grid min-w-0 gap-4 lg:gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
                      <Card className="min-w-0 overflow-hidden border-border/50">
                        <CardHeader className="px-4 pb-2 sm:px-5">
                          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            {editingCourseId ? "Editar curso" : "Novo curso"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 px-4 sm:px-5">
                          <FormField label="Nome">
                            <Input
                              value={courseForm.name}
                              onChange={(event) =>
                                setCourseForm((current) => ({
                                  ...current,
                                  name: event.target.value,
                                }))
                              }
                            />
                          </FormField>
                          <FormField label="Descrição">
                            <Textarea
                              value={courseForm.description}
                              onChange={(event) =>
                                setCourseForm((current) => ({
                                  ...current,
                                  description: event.target.value,
                                }))
                              }
                              className="min-h-20"
                            />
                          </FormField>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <FormField label="Empresa gestora">
                              <Input
                                value={courseForm.companyName}
                                onChange={(event) =>
                                  setCourseForm((current) => ({
                                    ...current,
                                    companyName: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Categoria">
                              <Input
                                value={courseForm.companyCategory}
                                onChange={(event) =>
                                  setCourseForm((current) => ({
                                    ...current,
                                    companyCategory: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Logotipo (URL)">
                              <Input
                                value={normalizeOptionalText(
                                  courseForm.companyLogoUrl,
                                )}
                                onChange={(event) =>
                                  setCourseForm((current) => ({
                                    ...current,
                                    companyLogoUrl: event.target.value,
                                  }))
                                }
                                placeholder="https://..."
                              />
                            </FormField>
                            <FormField label="Comunidade WhatsApp">
                              <Input
                                value={normalizeOptionalText(
                                  courseForm.communityUrl,
                                )}
                                onChange={(event) =>
                                  setCourseForm((current) => ({
                                    ...current,
                                    communityUrl: event.target.value,
                                  }))
                                }
                                placeholder="https://chat.whatsapp.com/..."
                              />
                            </FormField>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <FormField label="Prévia curta">
                              <Input
                                value={normalizeOptionalText(
                                  courseForm.preview,
                                )}
                                onChange={(event) =>
                                  setCourseForm((current) => ({
                                    ...current,
                                    preview: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Website">
                              <Input
                                value={normalizeOptionalText(
                                  courseForm.companyWebsite,
                                )}
                                onChange={(event) =>
                                  setCourseForm((current) => ({
                                    ...current,
                                    companyWebsite: event.target.value,
                                  }))
                                }
                                placeholder="https://..."
                              />
                            </FormField>
                            <FormField label="Instagram">
                              <Input
                                value={normalizeOptionalText(
                                  courseForm.companyInstagram,
                                )}
                                onChange={(event) =>
                                  setCourseForm((current) => ({
                                    ...current,
                                    companyInstagram: event.target.value,
                                  }))
                                }
                                placeholder="https://instagram.com/..."
                              />
                            </FormField>
                            <FormField label="LinkedIn">
                              <Input
                                value={normalizeOptionalText(
                                  courseForm.companyLinkedin,
                                )}
                                onChange={(event) =>
                                  setCourseForm((current) => ({
                                    ...current,
                                    companyLinkedin: event.target.value,
                                  }))
                                }
                                placeholder="https://linkedin.com/..."
                              />
                            </FormField>
                            <FormField label="Preço / rótulo">
                              <Input
                                value={normalizeOptionalText(
                                  courseForm.priceLabel,
                                )}
                                onChange={(event) =>
                                  setCourseForm((current) => ({
                                    ...current,
                                    priceLabel: event.target.value,
                                  }))
                                }
                                placeholder="Gratuito ou 3.500 Kz"
                              />
                            </FormField>
                            <FormField label="Ordem">
                              <Input
                                type="number"
                                value={courseForm.sortOrder ?? 0}
                                onChange={(event) =>
                                  setCourseForm((current) => ({
                                    ...current,
                                    sortOrder: Number(event.target.value),
                                  }))
                                }
                              />
                            </FormField>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <FormField label="Cor primária">
                              <div className="flex min-w-0 items-center gap-2">
                                <Input
                                  type="color"
                                  value={courseForm.accentColor}
                                  onChange={(event) =>
                                    setCourseForm((current) => ({
                                      ...current,
                                      accentColor: event.target.value,
                                    }))
                                  }
                                  className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border-0 p-0.5"
                                />
                                <Input
                                  value={courseForm.accentColor}
                                  onChange={(event) =>
                                    setCourseForm((current) => ({
                                      ...current,
                                      accentColor: event.target.value,
                                    }))
                                  }
                                  className="min-w-0 flex-1 font-mono text-xs"
                                />
                              </div>
                            </FormField>
                            <FormField label="Cor secundária">
                              <div className="flex min-w-0 items-center gap-2">
                                <Input
                                  type="color"
                                  value={courseForm.accentColorSecondary}
                                  onChange={(event) =>
                                    setCourseForm((current) => ({
                                      ...current,
                                      accentColorSecondary: event.target.value,
                                    }))
                                  }
                                  className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border-0 p-0.5"
                                />
                                <Input
                                  value={courseForm.accentColorSecondary}
                                  onChange={(event) =>
                                    setCourseForm((current) => ({
                                      ...current,
                                      accentColorSecondary: event.target.value,
                                    }))
                                  }
                                  className="min-w-0 flex-1 font-mono text-xs"
                                />
                              </div>
                            </FormField>
                            <FormField label="Cor do texto">
                              <div className="flex min-w-0 items-center gap-2">
                                <Input
                                  type="color"
                                  value={courseForm.courseColor}
                                  onChange={(event) =>
                                    setCourseForm((current) => ({
                                      ...current,
                                      courseColor: event.target.value,
                                    }))
                                  }
                                  className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border-0 p-0.5"
                                />
                                <Input
                                  value={courseForm.courseColor}
                                  onChange={(event) =>
                                    setCourseForm((current) => ({
                                      ...current,
                                      courseColor: event.target.value,
                                    }))
                                  }
                                  className="min-w-0 flex-1 font-mono text-xs"
                                />
                              </div>
                            </FormField>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-white px-3.5 py-2.5">
                              <span className="text-xs font-medium">
                                Curso pago
                              </span>
                              <Switch
                                checked={courseForm.isPaid ?? false}
                                onCheckedChange={(checked) =>
                                  setCourseForm((current) => ({
                                    ...current,
                                    isPaid: checked,
                                    priceLabel: checked
                                      ? current.priceLabel || "Pago"
                                      : "Gratuito",
                                  }))
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-white px-3.5 py-2.5">
                              <span className="text-xs font-medium">
                                Publicado
                              </span>
                              <Switch
                                checked={courseForm.isPublished ?? true}
                                onCheckedChange={(checked) =>
                                  setCourseForm((current) => ({
                                    ...current,
                                    isPublished: checked,
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div
                            className="overflow-hidden rounded-2xl border border-border/50"
                            style={{
                              background: `linear-gradient(135deg, ${courseForm.accentColor}18, ${courseForm.accentColorSecondary}18)`,
                            }}
                          >
                            <div className="p-3.5">
                              <p
                                className="text-sm font-semibold"
                                style={{ color: courseForm.courseColor }}
                              >
                                {courseForm.name || "Nome do curso"}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {courseForm.companyName || "Empresa"} ·{" "}
                                {courseForm.companyCategory || "Categoria"}
                              </p>
                            </div>
                            <div className="border-t border-border/30 bg-white/50 px-3.5 py-2">
                              <span
                                className="text-[11px] font-medium"
                                style={{ color: courseForm.courseColor }}
                              >
                                {courseForm.isPaid
                                  ? courseForm.priceLabel || "Pago"
                                  : "Gratuito"}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 sm:flex-none"
                              onClick={() => void handleCourseSubmit()}
                              disabled={busyKey === "course"}
                            >
                              {editingCourseId ? "Atualizar" : "Criar"} curso
                            </Button>
                            {editingCourseId && (
                              <Button
                                size="sm"
                                className="flex-1 sm:flex-none"
                                variant="outline"
                                onClick={resetCourseForm}
                              >
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="min-w-0 space-y-3">
                        {courses.map((course) => (
                          <div
                            key={course.id}
                            className="min-w-0 overflow-hidden rounded-2xl border border-border/50 bg-white"
                          >
                            <div
                              className="flex items-center gap-0.5 border-b border-border/30 px-1"
                              style={{
                                background: `linear-gradient(90deg, ${course.accentColor}12, ${course.accentColorSecondary}12)`,
                              }}
                            >
                              <div
                                className="h-1 w-8 rounded-full"
                                style={{ background: course.courseColor }}
                              />
                            </div>
                            <div className="space-y-3 p-3 sm:p-4">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold">
                                      {course.name}
                                    </p>
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${course.isPublished ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "text-muted-foreground"}`}
                                    >
                                      {course.isPublished
                                        ? "Publicado"
                                        : "Rascunho"}
                                    </Badge>
                                    {course.isPaid && (
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-700"
                                      >
                                        {course.priceLabel || "Pago"}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {course.companyName} ·{" "}
                                    {course.companyCategory}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />{" "}
                                    {course.studentCount}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <ThumbsUp className="h-3 w-3" />{" "}
                                    {course.likesCount}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/50">
                                    #{course.sortOrder}
                                  </span>
                                </div>
                              </div>
                              <p className="break-words text-xs leading-relaxed text-muted-foreground">
                                {course.description}
                              </p>
                              {(course.companyWebsite ||
                                course.companyInstagram ||
                                course.companyLinkedin ||
                                course.communityUrl) && (
                                <div className="flex flex-wrap gap-1.5">
                                  {course.companyWebsite && (
                                    <a
                                      href={course.companyWebsite}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded-lg bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/60"
                                    >
                                      Web
                                    </a>
                                  )}
                                  {course.companyInstagram && (
                                    <a
                                      href={course.companyInstagram}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded-lg bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/60"
                                    >
                                      Instagram
                                    </a>
                                  )}
                                  {course.companyLinkedin && (
                                    <a
                                      href={course.companyLinkedin}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded-lg bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/60"
                                    >
                                      LinkedIn
                                    </a>
                                  )}
                                  {course.communityUrl && (
                                    <a
                                      href={course.communityUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 transition-colors hover:bg-emerald-500/15"
                                    >
                                      WhatsApp
                                    </a>
                                  )}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() =>
                                    void handleToggleCourseEnrollments(course)
                                  }
                                  disabled={loadingCourseId === course.id}
                                >
                                  {loadingCourseId === course.id ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Eye className="mr-1 h-3 w-3" />
                                  )}
                                  {expandedCourseId === course.id
                                    ? "Ocultar"
                                    : "Inscritos"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() =>
                                    void handleExportCourseEnrollments(course)
                                  }
                                  disabled={exportingCourseId === course.id}
                                >
                                  {exportingCourseId === course.id ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Download className="mr-1 h-3 w-3" />
                                  )}
                                  PDF
                                </Button>
                                <AdminBulkSmsAction
                                  title={`Enviar aviso: ${course.name}`}
                                  buttonLabel="Enviar aviso"
                                  description={`Envia SMS, WhatsApp ou ambos para os contactos válidos inscritos no curso ${course.name}.`}
                                  disabled={course.studentCount === 0}
                                  audience={{
                                    type: "COURSE_ENROLLED",
                                    courseIds: [course.id],
                                  }}
                                  defaultMessage={`Olá, temos uma atualização importante sobre o curso ${course.name} no UOR Connect. Consulta a plataforma para acompanhar os detalhes.`}
                                />
                                <CourseCertificateAction
                                  courseId={course.id}
                                  courseName={course.name}
                                  studentCount={course.studentCount}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() => {
                                    setEditingCourseId(course.id);
                                    setCourseForm({
                                      name: course.name,
                                      description: course.description,
                                      preview: course.preview ?? "",
                                      communityUrl: course.communityUrl ?? "",
                                      companyName: course.companyName,
                                      companyCategory: course.companyCategory,
                                      companyLogoUrl:
                                        course.companyLogoUrl ?? "",
                                      companyWebsite:
                                        course.companyWebsite ?? "",
                                      companyInstagram:
                                        course.companyInstagram ?? "",
                                      companyLinkedin:
                                        course.companyLinkedin ?? "",
                                      isPaid: course.isPaid,
                                      priceLabel: course.priceLabel ?? "",
                                      accentColor: course.accentColor,
                                      accentColorSecondary:
                                        course.accentColorSecondary,
                                      courseColor: course.courseColor,
                                      sortOrder: course.sortOrder,
                                      isPublished: course.isPublished,
                                    });
                                  }}
                                >
                                  <Edit className="mr-1 h-3.5 w-3.5" />
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() => setCoursePendingRemoval(course)}
                                  disabled={
                                    busyKey === `course-delete-${course.id}`
                                  }
                                >
                                  <Trash2 className="mr-1 h-3 w-3" />
                                  Remover
                                </Button>
                              </div>

                              {expandedCourseId === course.id && (
                                <div className="course-enrollment-expanded-panel overflow-hidden rounded-2xl border border-border/60 bg-muted/10 p-3 sm:p-4">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold">
                                        Inscritos no curso
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Lista administrativa com criação,
                                        atualização e remoção de participantes.
                                      </p>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className="w-fit shrink-0"
                                    >
                                      {courseEnrollments[course.id]?.total ??
                                        course.studentCount}{" "}
                                      inscritos
                                    </Badge>
                                  </div>

                                  {(() => {
                                    const enrollmentForm =
                                      courseEnrollmentForms[course.id] ??
                                      defaultCourseEnrollmentForm;
                                    const isEditingThisCourse =
                                      editingCourseEnrollmentId
                                        ? Boolean(
                                            courseEnrollments[
                                              course.id
                                            ]?.enrollments.some(
                                              (entry) =>
                                                entry.id ===
                                                editingCourseEnrollmentId,
                                            ),
                                          )
                                        : false;
                                    const savingEnrollment =
                                      busyKey ===
                                        `course-enrollment-create-${course.id}` ||
                                      (editingCourseEnrollmentId
                                        ? busyKey ===
                                          `course-enrollment-save-${editingCourseEnrollmentId}`
                                        : false);

                                    return (
                                      <div className="mt-4 overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-sm">
                                        <div className="border-b border-primary/10 bg-gradient-to-r from-primary/10 via-white to-[hsl(var(--success))]/10 px-3 py-2.5">
                                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                                            {isEditingThisCourse
                                              ? "Editar participante"
                                              : "Adicionar participante"}
                                          </p>
                                        </div>
                                        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-6">
                                          <FormField label="Número">
                                            <Input
                                              value={
                                                enrollmentForm.studentNumber
                                              }
                                              onChange={(event) =>
                                                updateCourseEnrollmentForm(
                                                  course.id,
                                                  {
                                                    studentNumber:
                                                      normalizeStudentNumberInput(
                                                        event.target.value,
                                                      ),
                                                  },
                                                )
                                              }
                                              placeholder="2024..."
                                            />
                                          </FormField>
                                          <FormField label="Nome">
                                            <Input
                                              value={
                                                enrollmentForm.fullName ?? ""
                                              }
                                              onChange={(event) =>
                                                updateCourseEnrollmentForm(
                                                  course.id,
                                                  {
                                                    fullName:
                                                      event.target.value,
                                                  },
                                                )
                                              }
                                              placeholder="Nome completo"
                                            />
                                          </FormField>
                                          <FormField label="Curso">
                                            <Input
                                              value={
                                                enrollmentForm.studentCourse ??
                                                ""
                                              }
                                              onChange={(event) =>
                                                updateCourseEnrollmentForm(
                                                  course.id,
                                                  {
                                                    studentCourse:
                                                      event.target.value,
                                                  },
                                                )
                                              }
                                              placeholder="Curso do estudante"
                                            />
                                          </FormField>
                                          <FormField label="Telefone">
                                            <Input
                                              value={enrollmentForm.phone ?? ""}
                                              onChange={(event) =>
                                                updateCourseEnrollmentForm(
                                                  course.id,
                                                  { phone: event.target.value },
                                                )
                                              }
                                              placeholder="9xx xxx xxx"
                                            />
                                          </FormField>
                                          <FormField label="Estado">
                                            <select
                                              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                              value={String(
                                                enrollmentForm.paymentStatus ??
                                                  "CONFIRMED_BY_ADMIN",
                                              )}
                                              onChange={(event) =>
                                                updateCourseEnrollmentForm(
                                                  course.id,
                                                  {
                                                    paymentStatus:
                                                      event.target.value,
                                                  },
                                                )
                                              }
                                            >
                                              {(
                                                [
                                                  "CONFIRMED_BY_ADMIN",
                                                  "PENDING_REVIEW",
                                                  "REJECTED",
                                                  "CANCELED",
                                                ] as CourseEnrollmentStatus[]
                                              ).map((statusOption) => (
                                                <option
                                                  key={statusOption}
                                                  value={statusOption}
                                                >
                                                  {
                                                    courseEnrollmentStatusLabel[
                                                      statusOption
                                                    ]
                                                  }
                                                </option>
                                              ))}
                                            </select>
                                          </FormField>
                                          <div className="flex items-end gap-2">
                                            <Button
                                              size="sm"
                                              className="h-10 flex-1"
                                              disabled={savingEnrollment}
                                              onClick={() =>
                                                void handleCourseEnrollmentSubmit(
                                                  course.id,
                                                )
                                              }
                                            >
                                              {savingEnrollment ? (
                                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                              ) : (
                                                <UserPlus className="mr-1 h-3.5 w-3.5" />
                                              )}
                                              {isEditingThisCourse
                                                ? "Atualizar"
                                                : "Adicionar"}
                                            </Button>
                                            {isEditingThisCourse && (
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-10"
                                                onClick={() =>
                                                  resetCourseEnrollmentForm(
                                                    course.id,
                                                  )
                                                }
                                              >
                                                <X className="h-3.5 w-3.5" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                        <div className="border-t border-border/50 px-3 py-2">
                                          <Input
                                            value={enrollmentForm.note ?? ""}
                                            onChange={(event) =>
                                              updateCourseEnrollmentForm(
                                                course.id,
                                                { note: event.target.value },
                                              )
                                            }
                                            placeholder="Observação administrativa opcional"
                                            className="h-9 text-xs"
                                          />
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  <div className="mt-4 space-y-3">
                                    {loadingCourseId === course.id ? (
                                      <div className="flex items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/80 px-4 py-8 text-sm text-muted-foreground">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        A carregar inscritos...
                                      </div>
                                    ) : (courseEnrollments[course.id]
                                        ?.enrollments.length ?? 0) === 0 ? (
                                      <div className="rounded-2xl border border-dashed border-border/60 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                                        Ainda não há inscritos neste curso.
                                      </div>
                                    ) : (
                                      courseEnrollments[
                                        course.id
                                      ]?.enrollments.map((entry) => {
                                        const enrollmentStatus =
                                          normalizeCourseEnrollmentStatus(
                                            entry.paymentStatus,
                                          );
                                        const isUpdating =
                                          updatingEnrollmentStatusId ===
                                          entry.id;

                                        return (
                                          <div
                                            key={entry.id}
                                            className="overflow-hidden rounded-2xl border border-border/60 bg-background/90 p-3 shadow-sm sm:p-4"
                                          >
                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                              <div className="course-enrollment-row-grid grid min-w-0 flex-1 grid-cols-1 sm:grid-cols-2 2xl:grid-cols-5 gap-3">
                                                <div className="min-w-[min(100%,12rem)]">
                                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    Número
                                                  </p>
                                                  <p className="mt-1 break-words text-sm font-medium">
                                                    {entry.studentNumber}
                                                  </p>
                                                </div>
                                                <div className="min-w-[min(100%,12rem)]">
                                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    Nome
                                                  </p>
                                                  <p className="mt-1 break-words text-sm font-medium">
                                                    {entry.fullName}
                                                  </p>
                                                </div>
                                                <div className="min-w-[min(100%,12rem)]">
                                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    Curso
                                                  </p>
                                                  <p className="mt-1 break-words text-sm font-medium">
                                                    {entry.course ||
                                                      "Curso não informado"}
                                                  </p>
                                                </div>
                                                <div className="min-w-[min(100%,12rem)]">
                                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    Telefone
                                                  </p>
                                                  <p className="mt-1 break-words text-sm font-medium">
                                                    {entry.phone ||
                                                      "Sem telefone"}
                                                  </p>
                                                </div>
                                                <div className="min-w-[min(100%,12rem)]">
                                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    Estado
                                                  </p>
                                                  <Badge
                                                    variant="outline"
                                                    className={`mt-1 ${courseEnrollmentStatusBadge[enrollmentStatus]}`}
                                                  >
                                                    {entry.statusLabel ||
                                                      courseEnrollmentStatusLabel[
                                                        enrollmentStatus
                                                      ]}
                                                  </Badge>
                                                </div>
                                              </div>

                                              <div className="grid gap-2 sm:flex sm:flex-wrap lg:justify-end [&_button]:w-full sm:[&_button]:w-auto">
                                                {entry.whatsAppUrl ||
                                                whatsappLink(entry.phone) ? (
                                                  <Button
                                                    asChild
                                                    size="sm"
                                                    variant="outline"
                                                    className="whitespace-normal"
                                                  >
                                                    <a
                                                      href={
                                                        entry.whatsAppUrl ||
                                                        whatsappLink(
                                                          entry.phone,
                                                        ) ||
                                                        "#"
                                                      }
                                                      target="_blank"
                                                      rel="noreferrer"
                                                    >
                                                      <MessageSquare className="mr-1 h-3.5 w-3.5" />
                                                      Contactar via WhatsApp
                                                    </a>
                                                  </Button>
                                                ) : null}
                                                <ContextualSmsAction
                                                  title="Enviar comunicação ao inscrito"
                                                  recipient={{
                                                    name: entry.fullName,
                                                    studentNumber:
                                                      entry.studentNumber,
                                                    phone: entry.phone,
                                                    course: entry.course,
                                                  }}
                                                  defaultMessage="Olá {{nome}}, temos uma atualização sobre a tua inscrição no curso. Consulta o teu estado no UOR Connect."
                                                />
                                                {entry.paymentProofPath ? (
                                                  <Button
                                                    asChild
                                                    size="sm"
                                                    variant="outline"
                                                    className="whitespace-normal"
                                                  >
                                                    <a
                                                      href={adminDocumentHref(
                                                        entry.paymentProofPath,
                                                      )}
                                                      target="_blank"
                                                      rel="noreferrer noopener"
                                                    >
                                                      <FileText className="mr-1 h-3.5 w-3.5" />
                                                      Ver comprovativo
                                                    </a>
                                                  </Button>
                                                ) : null}
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="whitespace-normal"
                                                  onClick={() =>
                                                    handleEditCourseEnrollment(
                                                      course.id,
                                                      entry,
                                                    )
                                                  }
                                                >
                                                  <Edit className="mr-1 h-3.5 w-3.5" />
                                                  Editar
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="destructive"
                                                  className="whitespace-normal"
                                                  disabled={
                                                    busyKey ===
                                                    `course-enrollment-remove-${entry.id}`
                                                  }
                                                  onClick={() =>
                                                    setCourseEnrollmentPendingRemoval(
                                                      {
                                                        courseId: course.id,
                                                        enrollmentId: entry.id,
                                                        fullName:
                                                          entry.fullName,
                                                      },
                                                    )
                                                  }
                                                >
                                                  {busyKey ===
                                                  `course-enrollment-remove-${entry.id}` ? (
                                                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                                  ) : (
                                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                                  )}
                                                  Remover
                                                </Button>
                                              </div>
                                            </div>
                                            <div className="mt-3 grid gap-2">
                                              <Textarea
                                                value={
                                                  coursePaymentReviewNotes[
                                                    entry.id
                                                  ] ?? ""
                                                }
                                                onChange={(event) =>
                                                  setCoursePaymentReviewNotes(
                                                    (current) => ({
                                                      ...current,
                                                      [entry.id]:
                                                        event.target.value,
                                                    }),
                                                  )
                                                }
                                                placeholder={
                                                  entry.paymentReviewNote ||
                                                  "Observação interna da revisão financeira"
                                                }
                                                className="min-h-16 text-sm"
                                              />
                                              {entry.paymentReviewedAt ? (
                                                <p className="text-[11px] text-muted-foreground">
                                                  Última revisão em{" "}
                                                  {formatDateLabel(
                                                    entry.paymentReviewedAt,
                                                  )}
                                                  {entry.paymentReviewedByStudentNumber
                                                    ? ` por ${entry.paymentReviewedByStudentNumber}`
                                                    : ""}
                                                  {entry.paymentReviewNote
                                                    ? ` · ${entry.paymentReviewNote}`
                                                    : ""}
                                                </p>
                                              ) : null}
                                            </div>
                                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                              <Button
                                                size="sm"
                                                variant={
                                                  enrollmentStatus ===
                                                  "CONFIRMED_BY_ADMIN"
                                                    ? "default"
                                                    : "outline"
                                                }
                                                className="w-full"
                                                disabled={isUpdating}
                                                onClick={() =>
                                                  void handleEnrollmentStatusUpdate(
                                                    course.id,
                                                    entry.id,
                                                    "CONFIRMED_BY_ADMIN",
                                                  )
                                                }
                                              >
                                                {isUpdating ? (
                                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                  <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                                )}
                                                Aprovar
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant={
                                                  enrollmentStatus ===
                                                  "PENDING_REVIEW"
                                                    ? "default"
                                                    : "outline"
                                                }
                                                className="w-full"
                                                disabled={isUpdating}
                                                onClick={() =>
                                                  void handleEnrollmentStatusUpdate(
                                                    course.id,
                                                    entry.id,
                                                    "PENDING_REVIEW",
                                                  )
                                                }
                                              >
                                                {isUpdating ? (
                                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                  <Clock className="mr-1 h-3.5 w-3.5" />
                                                )}
                                                Pendente
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant={
                                                  enrollmentStatus ===
                                                  "REJECTED"
                                                    ? "destructive"
                                                    : "outline"
                                                }
                                                className="w-full"
                                                disabled={isUpdating}
                                                onClick={() =>
                                                  void handleEnrollmentStatusUpdate(
                                                    course.id,
                                                    entry.id,
                                                    "REJECTED",
                                                  )
                                                }
                                              >
                                                {isUpdating ? (
                                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                  <XCircle className="mr-1 h-3.5 w-3.5" />
                                                )}
                                                Rejeitar
                                              </Button>
                                            </div>
                                            <p className="mt-3 text-[11px] text-muted-foreground">
                                              Inscrição registada em{" "}
                                              {formatDateLabel(
                                                entry.enrolledAt,
                                              )}
                                            </p>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                  {courseEnrollments[course.id] ? (
                                    <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
                                      <p className="text-muted-foreground">
                                        Página{" "}
                                        {courseEnrollments[course.id].page} de{" "}
                                        {
                                          courseEnrollments[course.id]
                                            .totalPages
                                        }
                                      </p>
                                      <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="w-full"
                                          onClick={() =>
                                            void loadCourseEnrollmentsPage(
                                              course.id,
                                              Math.max(
                                                1,
                                                courseEnrollments[course.id]
                                                  .page - 1,
                                              ),
                                            )
                                          }
                                          disabled={
                                            loadingCourseId === course.id ||
                                            courseEnrollments[course.id].page <=
                                              1
                                          }
                                        >
                                          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                          Anterior
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="w-full"
                                          onClick={() =>
                                            void loadCourseEnrollmentsPage(
                                              course.id,
                                              Math.min(
                                                courseEnrollments[course.id]
                                                  .totalPages,
                                                courseEnrollments[course.id]
                                                  .page + 1,
                                              ),
                                            )
                                          }
                                          disabled={
                                            loadingCourseId === course.id ||
                                            courseEnrollments[course.id].page >=
                                              courseEnrollments[course.id]
                                                .totalPages
                                          }
                                        >
                                          Próximo
                                          <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "panels" && (
                    <div className="space-y-6">
                      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              {editingPanelTopicId
                                ? "Editar painel"
                                : "Novo painel"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <FormField label="Título">
                              <Input
                                value={panelTopicForm.title}
                                onChange={(event) =>
                                  setPanelTopicForm((current) => ({
                                    ...current,
                                    title: event.target.value,
                                  }))
                                }
                              />
                            </FormField>
                            <FormField label="Descrição">
                              <Textarea
                                value={panelTopicForm.description}
                                onChange={(event) =>
                                  setPanelTopicForm((current) => ({
                                    ...current,
                                    description: event.target.value,
                                  }))
                                }
                                className="min-h-24"
                              />
                            </FormField>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <FormField label="Speaker">
                                <Input
                                  value={panelTopicForm.speaker}
                                  onChange={(event) =>
                                    setPanelTopicForm((current) => ({
                                      ...current,
                                      speaker: event.target.value,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Hora">
                                <Input
                                  value={panelTopicForm.time}
                                  onChange={(event) =>
                                    setPanelTopicForm((current) => ({
                                      ...current,
                                      time: event.target.value,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Local">
                                <Input
                                  value={panelTopicForm.local}
                                  onChange={(event) =>
                                    setPanelTopicForm((current) => ({
                                      ...current,
                                      local: event.target.value,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Dia">
                                <Input
                                  value={panelTopicForm.day}
                                  onChange={(event) =>
                                    setPanelTopicForm((current) => ({
                                      ...current,
                                      day: event.target.value,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Data">
                                <Input
                                  value={panelTopicForm.dateLabel}
                                  onChange={(event) =>
                                    setPanelTopicForm((current) => ({
                                      ...current,
                                      dateLabel: event.target.value,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Tipo">
                                <Input
                                  value={panelTopicForm.type}
                                  onChange={(event) =>
                                    setPanelTopicForm((current) => ({
                                      ...current,
                                      type: event.target.value,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Ícone">
                                <Input
                                  value={panelTopicForm.icon}
                                  onChange={(event) =>
                                    setPanelTopicForm((current) => ({
                                      ...current,
                                      icon: event.target.value,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Ordem">
                                <Input
                                  type="number"
                                  value={panelTopicForm.sortOrder ?? 0}
                                  onChange={(event) =>
                                    setPanelTopicForm((current) => ({
                                      ...current,
                                      sortOrder: Number(event.target.value),
                                    }))
                                  }
                                />
                              </FormField>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-border p-3">
                              <span className="text-sm">Publicado</span>
                              <Switch
                                checked={panelTopicForm.isPublished ?? true}
                                onCheckedChange={(checked) =>
                                  setPanelTopicForm((current) => ({
                                    ...current,
                                    isPublished: checked,
                                  }))
                                }
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => void handlePanelTopicSubmit()}
                                disabled={busyKey === "panel-topic"}
                              >
                                {editingPanelTopicId ? "Atualizar" : "Criar"}{" "}
                                painel
                              </Button>
                              {editingPanelTopicId && (
                                <Button
                                  variant="outline"
                                  onClick={resetPanelTopicForm}
                                >
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">
                              Painéis publicados na home
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {panelTopics.map((panel) => (
                              <div
                                key={panel.id}
                                className="rounded-xl border border-border p-3"
                              >
                                <div className="mb-2 flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-medium">
                                      {panel.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {panel.day} · {panel.dateLabel} ·{" "}
                                      {panel.type}
                                    </p>
                                  </div>
                                  <Badge variant="outline">
                                    {panel.isPublished
                                      ? "Publicado"
                                      : "Rascunho"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {panel.description}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingPanelTopicId(panel.id);
                                      setPanelTopicForm({
                                        title: panel.title,
                                        description: panel.description,
                                        speaker: panel.speaker,
                                        time: panel.time,
                                        local: panel.local,
                                        day: panel.day,
                                        dateLabel: panel.dateLabel,
                                        icon: panel.icon,
                                        type: panel.type,
                                        sortOrder: panel.sortOrder,
                                        isPublished: panel.isPublished,
                                      });
                                    }}
                                  >
                                    <Edit className="mr-1 h-3.5 w-3.5" />
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      void handlePanelTopicDelete(panel.id)
                                    }
                                    disabled={
                                      busyKey ===
                                      `panel-topic-delete-${panel.id}`
                                    }
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    Remover
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </div>

                      <Card className="border-border/60">
                        <CardHeader>
                          <CardTitle className="text-base">
                            Redes sociais do UOR Connect
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                          <FormField label="Instagram">
                            <Input
                              value={normalizeOptionalText(
                                socialConfigForm.instagramUrl,
                              )}
                              onChange={(event) =>
                                setSocialConfigForm((current) => ({
                                  ...current,
                                  instagramUrl: event.target.value,
                                }))
                              }
                              placeholder="https://instagram.com/..."
                            />
                          </FormField>
                          <FormField label="Facebook">
                            <Input
                              value={normalizeOptionalText(
                                socialConfigForm.facebookUrl,
                              )}
                              onChange={(event) =>
                                setSocialConfigForm((current) => ({
                                  ...current,
                                  facebookUrl: event.target.value,
                                }))
                              }
                              placeholder="https://facebook.com/..."
                            />
                          </FormField>
                          <FormField label="LinkedIn">
                            <Input
                              value={normalizeOptionalText(
                                socialConfigForm.linkedinUrl,
                              )}
                              onChange={(event) =>
                                setSocialConfigForm((current) => ({
                                  ...current,
                                  linkedinUrl: event.target.value,
                                }))
                              }
                              placeholder="https://linkedin.com/company/..."
                            />
                          </FormField>
                          <div className="flex items-end">
                            <Button
                              onClick={() => void handleSocialConfigSave()}
                              disabled={busyKey === "social-config"}
                            >
                              Guardar redes sociais
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {activeTab === "evento" && (
                    <Suspense fallback={<AdminPanelFallback label="Evento" />}>
                      <EventoTab
                        value={socialConfigForm}
                        onChange={setSocialConfigForm}
                        onSave={() => void handleSocialConfigSave()}
                        isSaving={busyKey === "social-config"}
                      />
                    </Suspense>
                  )}

                  {activeTab === "faq" && (
                    <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">
                            {editingFaqId ? "Editar FAQ" : "Nova FAQ"}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField label="Pergunta">
                            <Input
                              value={faqForm.question}
                              onChange={(event) =>
                                setFaqForm((current) => ({
                                  ...current,
                                  question: event.target.value,
                                }))
                              }
                            />
                          </FormField>
                          <FormField label="Resposta">
                            <Textarea
                              value={faqForm.answer}
                              onChange={(event) =>
                                setFaqForm((current) => ({
                                  ...current,
                                  answer: event.target.value,
                                }))
                              }
                              className="min-h-28"
                            />
                          </FormField>
                          <FormField label="Ordem">
                            <Input
                              type="number"
                              value={faqForm.sortOrder ?? 0}
                              onChange={(event) =>
                                setFaqForm((current) => ({
                                  ...current,
                                  sortOrder: Number(event.target.value),
                                }))
                              }
                            />
                          </FormField>
                          <div className="flex items-center justify-between rounded-lg border border-border p-3">
                            <span className="text-sm">Publicado</span>
                            <Switch
                              checked={faqForm.isPublished ?? true}
                              onCheckedChange={(checked) =>
                                setFaqForm((current) => ({
                                  ...current,
                                  isPublished: checked,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={() => void handleFaqSubmit()}
                              disabled={busyKey === "faq"}
                            >
                              {editingFaqId ? "Atualizar" : "Criar"} FAQ
                            </Button>
                            {editingFaqId && (
                              <Button variant="outline" onClick={resetFaqForm}>
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-3">
                        {faqItems.map((faq) => (
                          <Card key={faq.id} className="border-border/60">
                            <CardContent className="space-y-3 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium">
                                    {faq.question}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Ordem {faq.sortOrder}
                                  </p>
                                </div>
                                <Badge variant="outline">
                                  {faq.isPublished ? "Publicado" : "Rascunho"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {faq.answer}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingFaqId(faq.id);
                                    setFaqForm({
                                      question: faq.question,
                                      answer: faq.answer,
                                      sortOrder: faq.sortOrder,
                                      isPublished: faq.isPublished,
                                    });
                                  }}
                                >
                                  <Edit className="mr-1 h-3.5 w-3.5" />
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => void handleFaqDelete(faq.id)}
                                  disabled={busyKey === `faq-delete-${faq.id}`}
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  Remover
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "live" && (
                    <div className="space-y-4">
                      <h2 className="flex items-center gap-2 text-lg font-heading font-bold">
                        <Radio className="h-5 w-5 animate-pulse text-destructive" />
                        Estado Ao Vivo
                      </h2>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm">
                            Configuração do Ao Vivo
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            <button
                              type="button"
                              onClick={() =>
                                setLiveConfigForm((current) => ({
                                  ...current,
                                  mode: "AGENDA",
                                }))
                              }
                              className={`rounded-2xl border p-4 text-left transition-colors ${liveConfigForm.mode === "AGENDA" ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                            >
                              <p className="text-sm font-semibold">
                                Seguir agenda
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                O site mostra automaticamente a sessão atual e a
                                próxima.
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setLiveConfigForm((current) => ({
                                  ...current,
                                  mode: "MANUAL",
                                  current: current.current ?? {
                                    day: liveState.current?.day ?? "DAY1",
                                    date: liveState.current?.date
                                      ? toDateInputValue(liveState.current.date)
                                      : "",
                                    startTime:
                                      liveState.current?.startTime ?? "",
                                    endTime: liveState.current?.endTime ?? "",
                                    title: liveState.current?.title ?? "",
                                    local: liveState.current?.local ?? "",
                                    speaker: liveState.current?.speaker ?? "",
                                    description:
                                      liveState.current?.description ?? "",
                                    type: liveState.current?.type ?? "PANEL",
                                    theme: liveState.current?.theme ?? "",
                                  },
                                }))
                              }
                              className={`rounded-2xl border p-4 text-left transition-colors ${liveConfigForm.mode === "MANUAL" ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                            >
                              <p className="text-sm font-semibold">
                                Conteúdo administrativo
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Tu decides o que aparece ao vivo e essa
                                atualização também reescreve a sessão da agenda
                                em curso.
                              </p>
                            </button>
                          </div>

                          {liveConfigForm.mode === "MANUAL" &&
                          liveConfigForm.current ? (
                            <div className="grid gap-4 md:grid-cols-2">
                              <FormField label="Dia">
                                <select
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={liveConfigForm.current.day}
                                  onChange={(event) =>
                                    setLiveConfigForm((current) => ({
                                      ...current,
                                      current: current.current
                                        ? {
                                            ...current.current,
                                            day: event.target.value as
                                              | "DAY1"
                                              | "DAY2",
                                          }
                                        : current.current,
                                    }))
                                  }
                                >
                                  <option value="DAY1">Dia 1</option>
                                  <option value="DAY2">Dia 2</option>
                                </select>
                              </FormField>
                              <FormField label="Data">
                                <Input
                                  type="date"
                                  value={toDateInputValue(
                                    liveConfigForm.current.date,
                                  )}
                                  onChange={(event) =>
                                    setLiveConfigForm((current) => ({
                                      ...current,
                                      current: current.current
                                        ? {
                                            ...current.current,
                                            date: event.target.value,
                                          }
                                        : current.current,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Hora inicial">
                                <Input
                                  type="time"
                                  value={liveConfigForm.current.startTime}
                                  onChange={(event) =>
                                    setLiveConfigForm((current) => ({
                                      ...current,
                                      current: current.current
                                        ? {
                                            ...current.current,
                                            startTime: event.target.value,
                                          }
                                        : current.current,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Hora final">
                                <Input
                                  type="time"
                                  value={liveConfigForm.current.endTime}
                                  onChange={(event) =>
                                    setLiveConfigForm((current) => ({
                                      ...current,
                                      current: current.current
                                        ? {
                                            ...current.current,
                                            endTime: event.target.value,
                                          }
                                        : current.current,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Título">
                                <Input
                                  value={liveConfigForm.current.title}
                                  onChange={(event) =>
                                    setLiveConfigForm((current) => ({
                                      ...current,
                                      current: current.current
                                        ? {
                                            ...current.current,
                                            title: event.target.value,
                                          }
                                        : current.current,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Local">
                                <Input
                                  value={liveConfigForm.current.local}
                                  onChange={(event) =>
                                    setLiveConfigForm((current) => ({
                                      ...current,
                                      current: current.current
                                        ? {
                                            ...current.current,
                                            local: event.target.value,
                                          }
                                        : current.current,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Orador / responsável">
                                <Input
                                  value={liveConfigForm.current.speaker}
                                  onChange={(event) =>
                                    setLiveConfigForm((current) => ({
                                      ...current,
                                      current: current.current
                                        ? {
                                            ...current.current,
                                            speaker: event.target.value,
                                          }
                                        : current.current,
                                    }))
                                  }
                                />
                              </FormField>
                              <FormField label="Tipo">
                                <select
                                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                                  value={liveConfigForm.current.type}
                                  onChange={(event) =>
                                    setLiveConfigForm((current) => ({
                                      ...current,
                                      current: current.current
                                        ? {
                                            ...current.current,
                                            type: event.target
                                              .value as AgendaInput["type"],
                                          }
                                        : current.current,
                                    }))
                                  }
                                >
                                  <option value="PANEL">Painel</option>
                                  <option value="WORKSHOP">Workshop</option>
                                  <option value="PRESENTATION">
                                    Apresentação
                                  </option>
                                  <option value="CEREMONY">Cerimónia</option>
                                  <option value="BREAK">Intervalo</option>
                                </select>
                              </FormField>
                              <div className="md:col-span-2">
                                <FormField label="Tema">
                                  <Input
                                    value={liveConfigForm.current.theme}
                                    onChange={(event) =>
                                      setLiveConfigForm((current) => ({
                                        ...current,
                                        current: current.current
                                          ? {
                                              ...current.current,
                                              theme: event.target.value,
                                            }
                                          : current.current,
                                      }))
                                    }
                                  />
                                </FormField>
                              </div>
                              <div className="md:col-span-2">
                                <FormField label="Descrição">
                                  <Textarea
                                    className="min-h-24"
                                    value={liveConfigForm.current.description}
                                    onChange={(event) =>
                                      setLiveConfigForm((current) => ({
                                        ...current,
                                        current: current.current
                                          ? {
                                              ...current.current,
                                              description: event.target.value,
                                            }
                                          : current.current,
                                      }))
                                    }
                                  />
                                </FormField>
                              </div>
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={() => void handleLiveConfigSave()}
                              disabled={busyKey === "live-config"}
                            >
                              {busyKey === "live-config" ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Radio className="mr-2 h-4 w-4" />
                              )}
                              Guardar Ao Vivo
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() =>
                                setLiveConfigForm({
                                  mode: "MANUAL",
                                  current: liveState.current
                                    ? {
                                        day: liveState.current.day as
                                          | "DAY1"
                                          | "DAY2",
                                        date: toDateInputValue(
                                          liveState.current.date,
                                        ),
                                        startTime: liveState.current.startTime,
                                        endTime: liveState.current.endTime,
                                        title: liveState.current.title,
                                        local: liveState.current.local,
                                        speaker: liveState.current.speaker,
                                        description:
                                          liveState.current.description,
                                        type: liveState.current
                                          .type as AgendaInput["type"],
                                        theme: liveState.current.theme,
                                      }
                                    : defaultLiveConfigForm.current,
                                })
                              }
                            >
                              Usar estado atual como base
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Card className="border-primary/30 bg-primary/5">
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm text-primary">
                              <Radio className="h-4 w-4" />
                              Agora
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <Badge variant="outline" className="w-fit">
                              {liveState.source === "admin"
                                ? "Fonte: conteúdo administrativo"
                                : "Fonte: agenda"}
                            </Badge>
                            <p className="font-medium">
                              {liveState.current?.title ??
                                "Nenhuma sessão em curso"}
                            </p>
                            <p className="text-muted-foreground">
                              {liveState.current
                                ? `${liveState.current.local} · ${liveState.current.startTime} - ${liveState.current.endTime}`
                                : "Sem sessão ativa derivada da agenda"}
                            </p>
                            {liveState.current?.description && (
                              <p className="text-muted-foreground">
                                {liveState.current.description}
                              </p>
                            )}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              Próximo
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <p className="font-medium">
                              {liveState.next?.title ??
                                "Nenhuma sessão planeada"}
                            </p>
                            <p className="text-muted-foreground">
                              {liveState.next
                                ? `${liveState.next.local} · ${formatAgendaDay(liveState.next.day)} · ${liveState.next.startTime}`
                                : "Sem próximos eventos no calendário"}
                            </p>
                            {liveState.next?.description && (
                              <p className="text-muted-foreground">
                                {liveState.next.description}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">
                            Dados derivados
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              toast.info(
                                "O estado ao vivo está a ser calculado a partir da agenda no backend.",
                              )
                            }
                          >
                            <Zap className="mr-1 h-3.5 w-3.5" />
                            Lógica no backend
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              toast.info(
                                `Locais ligados ao banco: ${guideContent.venues.length}`,
                              )
                            }
                          >
                            <MapPin className="mr-1 h-3.5 w-3.5" />
                            Locais do guia
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              toast.info(`FAQ no banco: ${faqItems.length}`)
                            }
                          >
                            <Settings className="mr-1 h-3.5 w-3.5" />
                            Conteúdo administrativo
                          </Button>
                        </CardContent>
                      </Card>

                      <div className="grid gap-3 lg:grid-cols-[1.3fr_0.8fr]">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            placeholder="Buscar comentários e mensagens por conteúdo, estudante, número ou projeto..."
                            value={moderationSearchTerm}
                            onChange={(event) =>
                              setModerationSearchTerm(event.target.value)
                            }
                          />
                        </div>
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={moderationPageSize}
                          onChange={(event) =>
                            setModerationPageSize(Number(event.target.value))
                          }
                        >
                          <option value={10}>10 por página</option>
                          <option value={20}>20 por página</option>
                          <option value={50}>50 por página</option>
                        </select>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center justify-between gap-3 text-sm">
                              <span className="flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                Comentários em Projetos
                              </span>
                              <Badge variant="outline">
                                {projectComments.length}
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                              {filteredProjectComments.length === 0
                                ? "Nenhum comentário encontrado."
                                : `${filteredProjectComments.length} comentário(s) encontrado(s).`}
                            </div>
                            {paginatedProjectComments.items.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                                Sem comentários pendentes para moderação.
                              </div>
                            ) : (
                              paginatedProjectComments.items.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="rounded-xl border border-border/70 p-4"
                                >
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold">
                                        {comment.studentName}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Nº {comment.studentNumber} ·{" "}
                                        {comment.course ||
                                          "Curso não informado"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Projeto: {comment.submissionName} ·{" "}
                                        {formatDateLabel(comment.createdAt)}
                                      </p>
                                      <Badge variant="outline" className="w-fit">
                                        {comment.moderationStatus === "APPROVED"
                                          ? "Feedback aprovado"
                                          : comment.moderationStatus === "REJECTED"
                                            ? "Feedback rejeitado"
                                            : comment.moderationStatus === "REVOKED"
                                              ? "Feedback revogado"
                                              : "Pendente"}
                                      </Badge>
                                      <p className="text-sm text-muted-foreground">
                                        {comment.content}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 lg:justify-end">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                        onClick={() =>
                                          void handleProjectCommentFeedbackReview(
                                            comment,
                                            "APPROVE",
                                          )
                                        }
                                        disabled={
                                          busyKey ===
                                          `comment-feedback-APPROVE-${comment.id}`
                                        }
                                      >
                                        <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                        +2 feedback
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          void handleProjectCommentFeedbackReview(
                                            comment,
                                            comment.moderationStatus === "APPROVED"
                                              ? "REVOKE"
                                              : "REJECT",
                                          )
                                        }
                                        disabled={
                                          busyKey ===
                                          `comment-feedback-REJECT-${comment.id}`
                                          || busyKey ===
                                          `comment-feedback-REVOKE-${comment.id}`
                                        }
                                      >
                                        <XCircle className="mr-1 h-3.5 w-3.5" />
                                        {comment.moderationStatus === "APPROVED"
                                          ? "Revogar"
                                          : "Rejeitar"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() =>
                                          void handleProjectCommentDelete(
                                            comment.id,
                                          )
                                        }
                                        disabled={
                                          busyKey ===
                                          `comment-delete-${comment.id}`
                                        }
                                      >
                                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                                        Eliminar
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                            <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
                              <p className="text-muted-foreground">
                                Página {paginatedProjectComments.currentPage} de{" "}
                                {paginatedProjectComments.totalPages}
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setModerationCommentPage((current) =>
                                      Math.max(1, current - 1),
                                    )
                                  }
                                  disabled={
                                    paginatedProjectComments.currentPage <= 1
                                  }
                                >
                                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                  Anterior
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setModerationCommentPage((current) =>
                                      Math.min(
                                        paginatedProjectComments.totalPages,
                                        current + 1,
                                      ),
                                    )
                                  }
                                  disabled={
                                    paginatedProjectComments.currentPage >=
                                    paginatedProjectComments.totalPages
                                  }
                                >
                                  Próximo
                                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center justify-between gap-3 text-sm">
                              <span className="flex items-center gap-2">
                                <Radio className="h-4 w-4 text-primary" />
                                Mini-chat Ao Vivo
                              </span>
                              <Badge variant="outline">
                                {liveChatMessages.length}
                              </Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                              {filteredLiveChatMessages.length === 0
                                ? "Nenhuma mensagem encontrada."
                                : `${filteredLiveChatMessages.length} mensagem(ns) encontrada(s).`}
                            </div>
                            {paginatedLiveChatMessages.items.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                                Sem mensagens no mini-chat para moderar.
                              </div>
                            ) : (
                              paginatedLiveChatMessages.items.map((message) => (
                                <div
                                  key={message.id}
                                  className={`rounded-xl border p-4 ${message.hiddenAt ? "border-amber-300 bg-amber-50/60" : message.isHighlighted ? "border-primary/30 bg-primary/[0.04]" : "border-border/70"}`}
                                >
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0 space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold">
                                          {message.studentName}
                                        </p>
                                        {message.isPinned ? (
                                          <Badge
                                            variant="outline"
                                            className="gap-1"
                                          >
                                            <Pin className="h-3 w-3" /> Fixada
                                          </Badge>
                                        ) : null}
                                        {message.isHighlighted ? (
                                          <Badge
                                            variant="outline"
                                            className="gap-1 border-amber-300 text-amber-700"
                                          >
                                            <Megaphone className="h-3 w-3" />{" "}
                                            Destaque
                                          </Badge>
                                        ) : null}
                                        {message.hiddenAt ? (
                                          <Badge
                                            variant="outline"
                                            className="gap-1 border-rose-300 text-rose-700"
                                          >
                                            <EyeOff className="h-3 w-3" />{" "}
                                            Oculta
                                          </Badge>
                                        ) : null}
                                        {message.reportCount > 0 ? (
                                          <Badge
                                            variant="outline"
                                            className="border-rose-300 text-rose-700"
                                          >
                                            {message.reportCount} denúncia(s)
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        Nº {message.studentNumber} ·{" "}
                                        {message.course ||
                                          "Curso não informado"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatDateLabel(message.createdAt)}
                                      </p>
                                      {message.replyTo ? (
                                        <div className="rounded-lg border-l-2 border-primary/40 bg-muted/30 px-3 py-2">
                                          <p className="text-[11px] font-semibold text-primary">
                                            Resposta a{" "}
                                            {message.replyTo.studentName}
                                          </p>
                                          <p className="line-clamp-2 text-xs text-muted-foreground">
                                            {message.replyTo.content ||
                                              "Imagem"}
                                          </p>
                                        </div>
                                      ) : null}
                                      {message.content ? (
                                        <p className="text-sm text-muted-foreground">
                                          {message.content}
                                        </p>
                                      ) : null}
                                      {message.attachmentUrl ? (
                                        <a
                                          href={liveChatAttachmentSrc(
                                            message.attachmentUrl,
                                          )}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="block w-40 overflow-hidden rounded-lg border border-border/70 bg-muted/20"
                                        >
                                          <img
                                            src={liveChatAttachmentSrc(
                                              message.attachmentUrl,
                                            )}
                                            alt="Anexo do mini-chat"
                                            className="h-28 w-full object-cover"
                                            loading="lazy"
                                          />
                                        </a>
                                      ) : null}
                                      <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                                        <span>
                                          {message.reactionCounts.like ?? 0}{" "}
                                          like(s)
                                        </span>
                                        <span>
                                          ·{" "}
                                          {message.reactionCounts.applause ?? 0}{" "}
                                          aplauso(s)
                                        </span>
                                        <span>
                                          · {message.reactionCounts.love ?? 0}{" "}
                                          coração
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 lg:justify-end">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          void handleLiveChatMessageUpdate(
                                            message.id,
                                            { isPinned: !message.isPinned },
                                          )
                                        }
                                        disabled={
                                          busyKey ===
                                          `live-chat-update-${message.id}`
                                        }
                                      >
                                        <Pin className="mr-1 h-3.5 w-3.5" />
                                        {message.isPinned
                                          ? "Desafixar"
                                          : "Fixar"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          void handleLiveChatMessageUpdate(
                                            message.id,
                                            {
                                              isHighlighted:
                                                !message.isHighlighted,
                                            },
                                          )
                                        }
                                        disabled={
                                          busyKey ===
                                          `live-chat-update-${message.id}`
                                        }
                                      >
                                        <Megaphone className="mr-1 h-3.5 w-3.5" />
                                        {message.isHighlighted
                                          ? "Remover destaque"
                                          : "Destacar"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          void handleLiveChatMessageUpdate(
                                            message.id,
                                            { hidden: !message.hiddenAt },
                                          )
                                        }
                                        disabled={
                                          busyKey ===
                                          `live-chat-update-${message.id}`
                                        }
                                      >
                                        <EyeOff className="mr-1 h-3.5 w-3.5" />
                                        {message.hiddenAt
                                          ? "Mostrar"
                                          : "Ocultar"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() =>
                                          void handleLiveChatMessageDelete(
                                            message.id,
                                          )
                                        }
                                        disabled={
                                          busyKey ===
                                          `live-chat-delete-${message.id}`
                                        }
                                      >
                                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                                        Eliminar
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                            <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
                              <p className="text-muted-foreground">
                                Página {paginatedLiveChatMessages.currentPage}{" "}
                                de {paginatedLiveChatMessages.totalPages}
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setModerationChatPage((current) =>
                                      Math.max(1, current - 1),
                                    )
                                  }
                                  disabled={
                                    paginatedLiveChatMessages.currentPage <= 1
                                  }
                                >
                                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                  Anterior
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setModerationChatPage((current) =>
                                      Math.min(
                                        paginatedLiveChatMessages.totalPages,
                                        current + 1,
                                      ),
                                    )
                                  }
                                  disabled={
                                    paginatedLiveChatMessages.currentPage >=
                                    paginatedLiveChatMessages.totalPages
                                  }
                                >
                                  Próximo
                                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {activeTab === "votes" && (
                    <div className="admin-votes-studio">
                      <section className="admin-votes-hero">
                        <div className="relative z-10 grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
                          <div className="min-w-0">
                            <p className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-black uppercase text-orange-800">
                              <span className="admin-votes-live-dot" />
                              Central de pulso da feira
                            </p>
                            <h2 className="mt-4 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                              Resultados em tempo real com contexto humano
                            </h2>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                              Acompanha quem esta a votar, quais cursos estao a
                              mover a sala, como os links individuais performam
                              e como o desafio do Passaporte reforca a
                              participacao.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-700">
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                                Total auditavel: {scoreTotalFromProjects} ponto(s)
                              </span>
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
                                {activeVoteCourses} curso(s) no feed recente
                              </span>
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-800">
                                {votesLastFiveMinutes} voto(s) nos ultimos 5 min
                              </span>
                            </div>
                          </div>
                          <div className="admin-votes-leader-card">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-black uppercase text-orange-800">
                                Projeto lider
                              </p>
                              <span className="rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-black text-slate-950">
                                #{voteLeader ? 1 : "-"}
                              </span>
                            </div>
                            <h3 className="mt-3 line-clamp-2 text-xl font-black leading-tight text-slate-950">
                              {voteLeader?.nome ?? "Aguardar primeiros votos"}
                            </h3>
                            <p className="mt-2 text-xs font-semibold text-slate-600">
                              {voteLeader
                                ? `${voteLeader.pontos} ponto(s), ${voteLeaderShare}% da corrida e ${leaderAdvantage} ponto(s) de vantagem.`
                                : "Assim que a pontuacao comecar, o destaque aparece aqui."}
                            </p>
                            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/80">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${voteLeaderShare}%` }}
                                transition={{ duration: 0.7, ease: "easeOut" }}
                                className="h-full rounded-full bg-slate-950"
                              />
                            </div>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              <Button
                                asChild
                                size="sm"
                                className="h-10 flex-1 rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
                              >
                                <a
                                  href="/votacoes/ao-vivo"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Radio className="mr-2 h-4 w-4" />
                                  Modo público
                                </a>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl bg-white/95"
                                onClick={() => void handleRefreshVotes()}
                                disabled={busyKey === "votes-refresh"}
                              >
                                <PhClock className="mr-2 h-4 w-4" />
                                {busyKey === "votes-refresh"
                                  ? "A atualizar..."
                                  : "Atualizar"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl bg-white/95"
                                onClick={() => void handleShowScoringConfig()}
                                disabled={busyKey === "score-config"}
                              >
                                <Settings className="mr-2 h-4 w-4" />
                                Regras
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                onClick={() => void handleFreezeScoringRanking()}
                                disabled={busyKey === "score-freeze"}
                              >
                                <ClipboardCheck className="mr-2 h-4 w-4" />
                                Congelar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl bg-white/95"
                                onClick={() => void handleRecalculateScoring()}
                                disabled={busyKey === "score-recalculate"}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Recalcular
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl bg-white/95"
                                onClick={() => void handleAwardMemberLevels()}
                                disabled={busyKey === "score-member-levels"}
                              >
                                <Award className="mr-2 h-4 w-4" />
                                Níveis
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl bg-white/95"
                                onClick={() => void handleAwardAutomaticMissions()}
                                disabled={busyKey === "score-auto-missions"}
                              >
                                <Zap className="mr-2 h-4 w-4" />
                                Missões
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl bg-white/95"
                                onClick={() => void handleAwardTeamBonuses()}
                                disabled={busyKey === "score-team-bonuses"}
                              >
                                <Trophy className="mr-2 h-4 w-4" />
                                Bónus
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl bg-white/95"
                                onClick={() => void handleShowAmbassadorRanking()}
                                disabled={busyKey === "score-ambassadors"}
                              >
                                <Users className="mr-2 h-4 w-4" />
                                Embaixadores
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl bg-white/95"
                                onClick={() => void handleShowScoringAlerts()}
                                disabled={busyKey === "score-alerts"}
                              >
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                Alertas
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl bg-white/95"
                                onClick={() => void handleExportScoringRanking(false)}
                                disabled={busyKey === "score-export-current"}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Exportar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl bg-white/95"
                                onClick={() => void handleExportScoringRankingCsv(false)}
                                disabled={busyKey === "score-export-csv"}
                              >
                                <Download className="mr-2 h-4 w-4" />
                                CSV
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl bg-white/95"
                                onClick={() => void handleExportScoringRankingPdf(false)}
                                disabled={busyKey === "score-export-pdf"}
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                PDF
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-10 flex-1 rounded-2xl ${
                                  projectVotingPaused
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                    : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                }`}
                                onClick={() => void handleProjectVotingPauseToggle()}
                                disabled={busyKey === "votes-control"}
                              >
                                {busyKey === "votes-control" ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : projectVotingPaused ? (
                                  <Power className="mr-2 h-4 w-4" />
                                ) : (
                                  <PowerOff className="mr-2 h-4 w-4" />
                                )}
                                {projectVotingPaused
                                  ? "Retomar votação"
                                  : "Pausar votação"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-10 flex-1 rounded-2xl border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                onClick={() => setVotesResetDialogOpen(true)}
                                disabled={busyKey === "votes-reset"}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Limpar votos
                              </Button>
                              <span className="inline-flex h-10 items-center justify-center rounded-2xl border border-white/70 bg-white/85 px-3 text-xs font-black text-slate-700">
                                {votesUpdatedAt
                                  ? new Date(votesUpdatedAt).toLocaleTimeString(
                                      "pt-PT",
                                      { hour: "2-digit", minute: "2-digit" },
                                    )
                                  : "agora"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </section>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                        <StatCard
                          icon={PhTrophy}
                          label="Total de pontos"
                          value={scoreTotalFromProjects}
                          color="bg-primary/10 text-primary"
                        />
                        <StatCard
                          icon={PhHeart}
                          label="Total de votos"
                          value={votesEntriesTotal || voteTotalFromProjects}
                          color="bg-slate-950/5 text-slate-950"
                        />
                        <StatCard
                          icon={Crown}
                          label="Lideranca"
                          value={voteLeader ? `${voteLeaderShare}%` : "0%"}
                          color="bg-amber-500/10 text-amber-700"
                        />
                        <StatCard
                          icon={GraduationCap}
                          label="Cursos ativos"
                          value={activeVoteCourses}
                          color="bg-emerald-500/10 text-emerald-700"
                        />
                        <StatCard
                          icon={Radio}
                          label="Ultimos 5 min"
                          value={votesLastFiveMinutes}
                          color="bg-blue-500/10 text-blue-700"
                        />
                        <StatCard
                          icon={Route}
                          label="Jogadores no mapa"
                          value={
                            passportGameOverview?.activePlayers ??
                            passportGameOverview?.participants ??
                            0
                          }
                          color="bg-emerald-500/10 text-emerald-700"
                        />
                      </div>

                      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
                        <CardContent className="p-0">
                          <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[0.9fr_0.9fr_1.2fr] xl:items-stretch">
                            <div>
                              <p className="flex items-center gap-2 text-xs font-black uppercase text-orange-700">
                                <BarChart3 className="h-4 w-4" />
                                Leitura do ambiente
                              </p>
                              <h3 className="mt-2 text-xl font-heading font-bold text-slate-950">
                                Pontuacao publica + presenca real
                              </h3>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                Pontos combinam votos ponderados, bonus e
                                penalizacoes. Visitas por cookie mostram alcance
                                dos links. O Passaporte mostra circulacao real
                                pela feira.
                              </p>
                              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-[10px] font-black uppercase text-slate-400">
                                    Acessos
                                  </p>
                                  <p className="text-lg font-black text-slate-950">
                                    {votesPageViews}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-[10px] font-black uppercase text-slate-400">
                                    Únicos
                                  </p>
                                  <p className="text-lg font-black text-slate-950">
                                    {votesUniqueVisitors}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-[10px] font-black uppercase text-slate-400">
                                    Login
                                  </p>
                                  <p className="text-lg font-black text-slate-950">
                                    {votesAuthenticatedVisitors}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="admin-votes-course-card">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-black uppercase text-slate-500">
                                    Pulso por curso
                                  </p>
                                  <p className="text-sm text-slate-600">
                                    Quem esta a movimentar a votacao agora.
                                  </p>
                                </div>
                                <GraduationCap className="h-5 w-5 text-primary" />
                              </div>
                              <div className="mt-4 space-y-3">
                                {voteCourseStats.slice(0, 5).map((course) => {
                                  const pct = Math.max(
                                    8,
                                    Math.round(
                                      (course.votes /
                                        Math.max(voteEntries.length, 1)) *
                                        100,
                                    ),
                                  );
                                  return (
                                    <div
                                      key={course.course}
                                      className="admin-votes-course-row"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="truncate text-sm font-black text-slate-950">
                                          {course.course}
                                        </span>
                                        <span className="text-xs font-black text-slate-500">
                                          {course.votes}
                                        </span>
                                      </div>
                                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${pct}%` }}
                                          className="h-full rounded-full bg-primary"
                                        />
                                      </div>
                                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                                        {course.students} estudante(s) unico(s)
                                        {course.recent > 0
                                          ? ` · +${course.recent} recente(s)`
                                          : ""}
                                      </p>
                                    </div>
                                  );
                                })}
                                {voteCourseStats.length === 0 && (
                                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                                    Sem cursos no feed atual. Assim que os votos
                                    entrarem, o pulso aparece aqui.
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {(passportGameOverview?.missions ?? [])
                                .slice(0, 4)
                                .map((mission, index) => {
                                  const intensity = Math.min(
                                    100,
                                    Math.round(
                                      ((mission.ledgerCount ||
                                        mission.scansCount ||
                                        0) /
                                        Math.max(
                                          passportGameOverview?.participants ??
                                            1,
                                          1,
                                        )) *
                                        100,
                                    ),
                                  );
                                  return (
                                    <div
                                      key={mission.id}
                                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-black text-white">
                                          {index + 1}
                                        </span>
                                        <span className="text-[11px] font-semibold text-emerald-700">
                                          {mission.scansCount} scans
                                        </span>
                                      </div>
                                      <p className="mt-2 line-clamp-2 min-h-8 text-xs font-semibold text-slate-950">
                                        {mission.title}
                                      </p>
                                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${intensity}%` }}
                                          className="h-full rounded-full bg-primary"
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              {(passportGameOverview?.missions ?? []).length ===
                                0 && (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500 sm:col-span-2">
                                  O mapa do Passaporte ainda nao tem missoes
                                  carregadas para cruzar com a votacao.
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
                        <Card className="border-border/60 bg-card/80 backdrop-blur">
                          <CardHeader className="pb-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <PhTrophy className="h-5 w-5 text-primary" />
                                Corrida dos projetos
                                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold uppercase text-orange-800">
                                  <span className="admin-votes-live-dot" />
                                  Ao vivo
                                </span>
                              </CardTitle>
                              <p className="text-xs font-semibold text-muted-foreground">
                                Participacao por pontos, votos e login
                                verificado.
                              </p>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {rankedProjects
                              .slice()
                              .sort(
                                (a, b) =>
                                  b.pontos - a.pontos ||
                                  b.votos - a.votos ||
                                  b.comentarios - a.comentarios,
                              )
                              .map((project, idx) => {
                                const sharePct =
                                  scoreTotalFromProjects > 0
                                    ? Math.round(
                                        (project.pontos /
                                          scoreTotalFromProjects) *
                                          100,
                                      )
                                    : 0;
                                const recentVotes =
                                  recentVotesByProject.get(project.id) ?? 0;
                                const medalColor =
                                  idx === 0
                                    ? "from-amber-400 to-amber-500"
                                    : idx === 1
                                      ? "from-slate-200 to-slate-400"
                                      : idx === 2
                                        ? "from-orange-300 to-orange-400"
                                        : "from-muted to-muted";
                                return (
                                  <motion.div
                                    key={project.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="admin-votes-project-card group"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="space-y-1">
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                          {project.equipa ?? "Equipa"}
                                        </p>
                                        <p className="text-lg font-heading font-bold leading-tight">
                                          {project.nome}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {idx === 0 && (
                                            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase text-amber-800">
                                              Lider
                                            </span>
                                          )}
                                          {recentVotes > 0 && (
                                            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase text-emerald-800">
                                              +{recentVotes} recente(s)
                                            </span>
                                          )}
                                          {project.authenticatedVisitors >
                                            0 && (
                                            <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black uppercase text-blue-800">
                                              cookie verificado
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${medalColor} text-xs font-bold text-white shadow-lg`}
                                      >
                                        #{idx + 1}
                                      </div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-primary">
                                        <PhHeart className="h-3.5 w-3.5" />
                                        {project.rating} likes
                                      </span>
                                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-primary">
                                        <PhChatTeardrop className="h-3.5 w-3.5" />
                                        {project.comentarios} comentários
                                      </span>
                                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/5 px-2 py-1 text-slate-700">
                                        <Cookie className="h-3.5 w-3.5" />
                                        {project.uniqueVisitors} visitantes
                                      </span>
                                    </div>
                                    <div
                                      className="admin-votes-sparkline"
                                      aria-hidden="true"
                                    >
                                      {[0, 1, 2, 3, 4, 5, 6].map((slot) => (
                                        <span
                                          key={slot}
                                          style={{
                                            height: `${18 + ((project.pontos + project.id * (slot + 1) + recentVotes * 9) % 64)}%`,
                                          }}
                                        />
                                      ))}
                                    </div>
                                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${sharePct}%` }}
                                        transition={{ duration: 0.6 }}
                                        className="h-full rounded-full bg-primary"
                                      />
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-slate-500">
                                      <span>{sharePct}% dos pontos</span>
                                      <span>{project.pontos} ponto(s)</span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                                        <p className="text-[10px] font-bold uppercase text-slate-400">
                                          Pontos
                                        </p>
                                        <p className="text-sm font-black text-slate-950">
                                          {project.pontos}
                                        </p>
                                      </div>
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                                        <p className="text-[10px] font-bold uppercase text-slate-400">
                                          Acessos
                                        </p>
                                        <p className="text-sm font-black text-slate-950">
                                          {project.pageViews}
                                        </p>
                                      </div>
                                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                                        <p className="text-[10px] font-bold uppercase text-slate-400">
                                          Login
                                        </p>
                                        <p className="text-sm font-black text-slate-950">
                                          {project.authenticatedVisitors}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-xl border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
                                        disabled={busyKey === `vote-qr-${project.id}`}
                                        onClick={() => void handleOpenExhibitorVoteQr(project)}
                                      >
                                        {busyKey === `vote-qr-${project.id}` ? (
                                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <QrCode className="mr-1 h-3.5 w-3.5" />
                                        )}
                                        QR de voto
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-xl border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                        disabled={busyKey === `score-${project.id}-QUALIFIED_FEEDBACK`}
                                        onClick={() => void handleQuickScoreEvent(
                                          project,
                                          "QUALIFIED_FEEDBACK",
                                          2,
                                          "Feedback qualificado aprovado.",
                                        )}
                                      >
                                        <MessageCircle className="mr-1 h-3.5 w-3.5" />
                                        +2 feedback
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-xl border-blue-200 bg-blue-50 text-xs font-bold text-blue-700 hover:bg-blue-100"
                                        disabled={busyKey === `score-${project.id}-TEAM_BONUS`}
                                        onClick={() => void handleQuickScoreEvent(
                                          project,
                                          "TEAM_BONUS",
                                          5,
                                          "Bónus manual validado pela organização.",
                                        )}
                                      >
                                        <Award className="mr-1 h-3.5 w-3.5" />
                                        +5 bónus
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-xl border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100"
                                        disabled={busyKey === `score-${project.id}-PENALTY`}
                                        onClick={() => void handleQuickScoreEvent(
                                          project,
                                          "PENALTY",
                                          -10,
                                          "Falha operacional leve.",
                                        )}
                                      >
                                        <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                                        -10 penalizar
                                      </Button>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                                        <Eye className="h-3.5 w-3.5 text-primary" />
                                        {project.pageViews} acessos totais
                                      </span>
                                      <Button
                                        asChild
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-xl text-xs"
                                      >
                                        <Link to={project.detailPath}>
                                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                          Ver página
                                        </Link>
                                      </Button>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            {rankedProjects.length === 0 && (
                              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
                                Nenhum projeto elegivel encontrado para a
                                votacao.
                              </div>
                            )}
                            <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
                              <p className="text-muted-foreground">
                                Página {votesProjectsPage} de{" "}
                                {votesProjectsTotalPages}
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setVotesProjectsPage((current) =>
                                      Math.max(1, current - 1),
                                    )
                                  }
                                  disabled={votesProjectsPage <= 1}
                                >
                                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                  Anterior
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setVotesProjectsPage((current) =>
                                      Math.min(
                                        votesProjectsTotalPages,
                                        current + 1,
                                      ),
                                    )
                                  }
                                  disabled={
                                    votesProjectsPage >= votesProjectsTotalPages
                                  }
                                >
                                  Próximo
                                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <div className="space-y-5">
                          <Card className="border-border/60 bg-card/85 backdrop-blur">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <Radio className="h-5 w-5 text-primary" />
                                Narração ao vivo
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              {voteMoments.map((moment) => (
                                <div
                                  key={moment.id}
                                  className="admin-votes-moment"
                                >
                                  <span className="admin-votes-live-dot" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-black text-slate-950">
                                      {moment.title}
                                    </p>
                                    <p className="text-xs leading-5 text-slate-600">
                                      {moment.text}
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                                    {moment.time}
                                  </span>
                                </div>
                              ))}
                              {voteMoments.length === 0 && (
                                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                                  O feed de momentos fica ativo assim que os
                                  primeiros votos entram.
                                </p>
                              )}
                            </CardContent>
                          </Card>

                          <Card className="border-border/60 bg-card/85 backdrop-blur">
                            <CardHeader className="pb-3">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <PhUsers className="h-5 w-5 text-primary" />
                                Feed de votos verificados
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Estudante, curso e projeto</span>
                                <span>{votesEntriesTotal} registos</span>
                              </div>
                              <div className="space-y-2">
                                {voteEntries.map((vote) => (
                                  <motion.div
                                    key={vote.id}
                                    initial={{ opacity: 0, x: 12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-white/90 p-3 text-sm shadow-sm backdrop-blur hover:border-primary/40"
                                  >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-black ring-4 ring-orange-50">
                                      {vote.estudante?.[0] || "V"}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-semibold text-foreground">
                                        {vote.curso}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {vote.estudante} · {vote.studentNumber}
                                      </p>
                                      <p className="truncate text-xs font-bold text-slate-800">
                                        Votou em {vote.projeto}
                                      </p>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                      {vote.data.slice(11, 16)}
                                    </div>
                                  </motion.div>
                                ))}
                                {voteEntries.length === 0 && (
                                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
                                    Nenhum voto registado nesta pagina ainda.
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
                                <p className="text-muted-foreground">
                                  Página {votesEntriesPage} de{" "}
                                  {votesEntriesTotalPages}
                                </p>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setVotesEntriesPage((current) =>
                                        Math.max(1, current - 1),
                                      )
                                    }
                                    disabled={votesEntriesPage <= 1}
                                  >
                                    <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                    Anterior
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setVotesEntriesPage((current) =>
                                        Math.min(
                                          votesEntriesTotalPages,
                                          current + 1,
                                        ),
                                      )
                                    }
                                    disabled={
                                      votesEntriesPage >= votesEntriesTotalPages
                                    }
                                  >
                                    Próximo
                                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "security" && (
                    <Suspense
                      fallback={<AdminPanelFallback label="Segurança" />}
                    >
                      <AdminSecurityTab
                        scope="security"
                        accessForm={adminAccessForm}
                        adminAccessConflicts={adminAccessConflicts}
                        authorizedAdminStudents={authorizedAdminStudents}
                        authorizedStudentNumber={authorizedStudentNumber}
                        busyKey={busyKey}
                        onAccessFormChange={setAdminAccessForm}
                        onAuthorizeAdminStudent={() =>
                          void handleAuthorizeAdminStudent()
                        }
                        onAuthorizedStudentNumberChange={
                          setAuthorizedStudentNumber
                        }
                        onRevokeAdminStudent={(studentNumber) =>
                          void handleRevokeAdminStudent(studentNumber)
                        }
                      />
                    </Suspense>
                  )}

                  {activeTab === "odin" && (
                    <Suspense fallback={<AdminPanelFallback label="ODIN" />}>
                      <AdminOdinTab />
                    </Suspense>
                  )}

                  {activeTab === "nucleus" && (
                    <Suspense fallback={<AdminPanelFallback label="Núcleo" />}>
                      <AdminSecurityTab
                        scope="nucleus"
                        accessForm={adminAccessForm}
                        adminAccessConflicts={adminAccessConflicts}
                        authorizedAdminStudents={authorizedAdminStudents}
                        authorizedStudentNumber={authorizedStudentNumber}
                        busyKey={busyKey}
                        onAccessFormChange={setAdminAccessForm}
                        onAuthorizeAdminStudent={() =>
                          void handleAuthorizeAdminStudent()
                        }
                        onAuthorizedStudentNumberChange={
                          setAuthorizedStudentNumber
                        }
                        onRevokeAdminStudent={(studentNumber) =>
                          void handleRevokeAdminStudent(studentNumber)
                        }
                      />
                    </Suspense>
                  )}

                  {activeTab === "credentials" && (
                    <Suspense
                      fallback={<AdminPanelFallback label="Credenciais" />}
                    >
	                      <AdminSecurityTab
	                        scope="credentials"
	                        credentialSubpage={activeCredentialSubpage}
	                        onCredentialSubpageChange={setActiveCredentialSubpage}
	                        accessForm={adminAccessForm}
                        adminAccessConflicts={adminAccessConflicts}
                        authorizedAdminStudents={authorizedAdminStudents}
                        authorizedStudentNumber={authorizedStudentNumber}
                        busyKey={busyKey}
                        onAccessFormChange={setAdminAccessForm}
                        onAuthorizeAdminStudent={() =>
                          void handleAuthorizeAdminStudent()
                        }
                        onAuthorizedStudentNumberChange={
                          setAuthorizedStudentNumber
                        }
                        onRevokeAdminStudent={(studentNumber) =>
                          void handleRevokeAdminStudent(studentNumber)
                        }
                      />
                    </Suspense>
                  )}

                  {activeTab === "students" && (
                    <Suspense
                      fallback={<AdminPanelFallback label="Estudantes" />}
                    >
                      <AdminStudentsTab
                        availableStudentCourses={availableStudentCourses}
                        availableStudentUniversities={availableStudentUniversities}
                        groupStudentsByCourse={groupStudentsByCourse}
                        groupedStudents={groupedStudents}
                        loadingStudentsList={loadingStudentsList}
                        studentCourseFilter={studentCourseFilter}
                        studentUniversityFilter={studentUniversityFilter}
                        studentAccessTypeFilter={studentAccessTypeFilter}
                        studentListRows={studentListRows}
                        studentPage={studentPage}
                        studentPageSize={studentPageSize}
                        studentSearchTerm={studentSearchTerm}
                        studentSortBy={studentSortBy}
                        studentStatsSummary={studentStatsSummary}
                        studentsTotal={studentsTotal}
                        studentsTotalPages={studentsTotalPages}
                        onGroupStudentsByCourseChange={setGroupStudentsByCourse}
                        onRemoveStudent={setStudentPendingRemoval}
                        onStudentCourseFilterChange={setStudentCourseFilter}
                        onStudentUniversityFilterChange={setStudentUniversityFilter}
                        onStudentAccessTypeFilterChange={setStudentAccessTypeFilter}
                        onStudentPageChange={setStudentPage}
                        onStudentPageSizeChange={setStudentPageSize}
                        onStudentSearchTermChange={setStudentSearchTerm}
                        onStudentSortByChange={setStudentSortBy}
                      />
                    </Suspense>
                  )}

                  {activeTab === "winners" && (
                    <Suspense
                      fallback={<AdminPanelFallback label="Vencedores" />}
                    >
                      <AdminWinnersTab
                        approvedProjects={approvedProjects}
                        selectedProjectWinnerId={selectedWinners.projectWinner}
                        onClearWinner={() => void handleClearWinner()}
                        onSelectWinner={(projectId) =>
                          void handleSelectWinner(projectId)
                        }
                      />
                    </Suspense>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;

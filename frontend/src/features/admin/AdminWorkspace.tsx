import { type ReactNode, Suspense, lazy, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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
  Cookie,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  Download,
  Edit,
  Eye,
  ExternalLink,
  FolderOpen,
  GraduationCap,
  History,
  HelpCircle,
  KeyRound,
  Palette,
  Loader2,
  MapPin,
  MessageSquare,
  Mic,
  Package,
  ImagePlus,
  Radio,
  Search,
  Settings,
  Shield,
  Wallet,
  Star,
  ThumbsUp,
  Trash2,
  Trophy,
  UserCheck,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Heart as PhHeart,
  ChatTeardrop as PhChatTeardrop,
  Trophy as PhTrophy,
  UsersThree as PhUsers,
  Clock as PhClock,
  TrendUp as PhTrendUp,
  Eye as PhEye,
  FloppyDisk as PhFloppy,
  Lightning as PhLightning,
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { defaultHomeSocialConfig } from "@/lib/home-content";
import {
  type AdminAuthorizedStudent,
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
  type CourseEnrollmentsPagedPayload,
  type CourseInput,
  type FaqInput,
  type FaqItem,
  type GuideContent,
  type HomeSocialConfig,
  type HomeSocialConfigInput,
  type GuideStepInput,
  type GuideTipInput,
  type PanelTopic,
  type PanelTopicInput,
  type PdfJobStatus,
  type Speaker,
  type SpeakerInput,
  type SubmissionConfig,
  type StudentWithStats,
  type StudentProfile,
  type VenueInput,
  getToken,
  isAuthError,
  isForbiddenError,
  setToken,
} from "@/lib/api";
import { readImageFileAsDataUrl } from "@/lib/project-media";

const EventoTab = lazy(() =>
  import("@/components/admin/EventoTab").then((module) => ({ default: module.EventoTab })),
);
const AdminAnalyticsTab = lazy(() =>
  import("@/components/admin/AdminAnalyticsTab").then((module) => ({ default: module.AdminAnalyticsTab })),
);
const AdminSmsTab = lazy(() =>
  import("@/components/admin/AdminSmsTab").then((module) => ({ default: module.AdminSmsTab })),
);
const AdminJuryTab = lazy(() =>
  import("@/components/admin/AdminJuryTab").then((module) => ({ default: module.AdminJuryTab })),
);
const AdminAttendanceTab = lazy(() => import("@/components/admin/AdminAttendanceTab"));
const AdminCertificatesTab = lazy(() => import("@/components/admin/AdminCertificatesTab"));
const AdminAuditTab = lazy(() => import("@/components/admin/AdminAuditTab"));

const tabs = [
  { id: "overview", label: "Visão Geral", icon: BarChart3 },
  { id: "analytics", label: "Cookies & Analytics", icon: Cookie },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "jury", label: "Júri", icon: KeyRound },
  { id: "attendance", label: "Check-in", icon: ClipboardCheck },
  { id: "certificates", label: "Certificados", icon: Award },
  { id: "audit", label: "Auditoria", icon: History },
  { id: "submissions", label: "Candidaturas", icon: FolderOpen },
  { id: "speakers", label: "Palestrantes", icon: Mic },
  { id: "schedule", label: "Agenda", icon: CalendarDays },
  { id: "guide", label: "Guia", icon: BookOpen },
  { id: "courses", label: "Cursos", icon: GraduationCap },
  { id: "panels", label: "Painéis", icon: Zap },
  { id: "evento", label: "Evento", icon: Palette },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "live", label: "Ao Vivo", icon: Radio },
  { id: "votes", label: "Votações", icon: ThumbsUp },
  { id: "security", label: "Segurança", icon: Shield },
  { id: "students", label: "Estudantes", icon: Users },
  { id: "winners", label: "Vencedores", icon: Trophy },
] as const;

type TabId = typeof tabs[number]["id"];
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
  isWinner: boolean;
  canVote: boolean;
};

type VoteProjectSummary = {
  id: number;
  nome: string;
  equipa: string;
  tipo: "projeto" | "negocio" | "produto";
  votos: number;
  rating: number;
  comentarios: number;
  status: "pendente" | "aprovado" | "recusado";
  isWinner: boolean;
};

type VoteEntry = {
  id: number;
  studentId: number;
  estudante: string;
  email: string;
  projeto: string;
  data: string;
};

function normalizeStudentNumberInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

function whatsappLink(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
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
  options: { timeoutMs?: number; intervalMs?: number } = {}
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
  }
};

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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">A carregar módulo</p>
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
  heroBadgeText: defaultHomeSocialConfig.heroBadgeText,
  heroTitlePrefix: defaultHomeSocialConfig.heroTitlePrefix,
  heroTitleHighlight: defaultHomeSocialConfig.heroTitleHighlight,
  heroSubtitleText: defaultHomeSocialConfig.heroSubtitleText,
  heroSubtitleColor: defaultHomeSocialConfig.heroSubtitleColor,
  heroTitleMobileSize: defaultHomeSocialConfig.heroTitleMobileSize,
  heroTitleTabletSize: defaultHomeSocialConfig.heroTitleTabletSize,
  heroTitleDesktopSize: defaultHomeSocialConfig.heroTitleDesktopSize,
  heroSubtitleMobileSize: defaultHomeSocialConfig.heroSubtitleMobileSize,
  heroSubtitleTabletSize: defaultHomeSocialConfig.heroSubtitleTabletSize,
  heroSubtitleDesktopSize: defaultHomeSocialConfig.heroSubtitleDesktopSize,
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
    heroBadgeText: config.heroBadgeText,
    heroTitlePrefix: config.heroTitlePrefix,
    heroTitleHighlight: config.heroTitleHighlight,
    heroSubtitleText: config.heroSubtitleText,
    heroSubtitleColor: config.heroSubtitleColor,
    heroTitleMobileSize: config.heroTitleMobileSize,
    heroTitleTabletSize: config.heroTitleTabletSize,
    heroTitleDesktopSize: config.heroTitleDesktopSize,
    heroSubtitleMobileSize: config.heroSubtitleMobileSize,
    heroSubtitleTabletSize: config.heroSubtitleTabletSize,
    heroSubtitleDesktopSize: config.heroSubtitleDesktopSize,
    heroFloatingIcons: config.heroFloatingIcons,
    sponsors: config.sponsors,
  };
}

const defaultSubmissionConfigForm: Omit<SubmissionConfig, "key" | "createdAt" | "updatedAt"> = {
  isOpen: true,
  iban: "AO006 0055 0000 3295 0561 10379",
  accountName: "Universidade Óscar Ribas",
  paymentAmount: "15.000 Kz",
  paymentInstructions: "Confirma a transferência antes de enviar a candidatura.",
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
  projeto: "bg-[hsl(var(--area-iot))]/15 text-[hsl(var(--area-iot))] border-[hsl(var(--area-iot))]/30",
  negocio: "bg-[hsl(var(--area-negocio))]/15 text-[hsl(var(--area-negocio))] border-[hsl(var(--area-negocio))]/30",
  produto: "bg-[hsl(var(--area-produto))]/15 text-[hsl(var(--area-produto))] border-[hsl(var(--area-produto))]/30",
};

const statusColors: Record<AdminSubmission["status"], string> = {
  pendente: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30",
  aprovado: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30",
  recusado: "bg-destructive/15 text-destructive border-destructive/30",
};

type CourseEnrollmentStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELED";

const courseEnrollmentStatusBadge: Record<CourseEnrollmentStatus, string> = {
  PENDING: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30",
  CONFIRMED: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30",
  REJECTED: "bg-destructive/15 text-destructive border-destructive/30",
  CANCELED: "bg-slate-200 text-slate-700 border-slate-300",
};

const courseEnrollmentStatusLabel: Record<CourseEnrollmentStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  REJECTED: "Rejeitado",
  CANCELED: "Cancelado",
};

function normalizeCourseEnrollmentStatus(status: string): CourseEnrollmentStatus {
  if (status === "CONFIRMED" || status === "REJECTED" || status === "CANCELED") {
    return status;
  }

  return "PENDING";
}

const guideIconOptions = ["BookOpen", "UserCheck", "CalendarDays", "Mic", "MapPin", "Zap"];

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

function mapSubmissionStatus(status: string): AdminSubmission["status"] {
  if (status === "APPROVED") return "aprovado";
  if (status === "REJECTED") return "recusado";
  return "pendente";
}

function communityUrlBySubmissionType(
  tipo: AdminSubmission["tipo"],
  config: Pick<SubmissionConfig, "projectCommunityUrl" | "businessCommunityUrl" | "productCommunityUrl">
) {
  if (tipo === "negocio") return config.businessCommunityUrl ?? null;
  if (tipo === "produto") return config.productCommunityUrl ?? null;
  return config.projectCommunityUrl ?? null;
}

function toBackendStatus(status: AdminSubmission["status"]): "PENDING" | "APPROVED" | "REJECTED" {
  if (status === "aprovado") return "APPROVED";
  if (status === "recusado") return "REJECTED";
  return "PENDING";
}

function studentInteractions(student: StudentWithStats) {
  return (student._count?.likes ?? 0) + (student._count?.votes ?? 0) + (student._count?.comments ?? 0);
}

function formatDateLabel(value: string) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function submissionCoverGradient(submission: Pick<AdminSubmission, "primaryColor" | "secondaryColor">) {
  return `linear-gradient(135deg, ${submission.primaryColor}E8 0%, ${submission.secondaryColor}D9 100%)`;
}

function formatAgendaDay(day: string) {
  return day === "DAY2" ? "Dia 2" : "Dia 1";
}

function formatAgendaType(type: string) {
  return {
    PANEL: "Painel",
    WORKSHOP: "Workshop",
    PRESENTATION: "Apresentação",
    CEREMONY: "Cerimónia",
    BREAK: "Intervalo",
  }[type] ?? type;
}

function toDateInputValue(value: string) {
  return value ? value.slice(0, 10) : "";
}

function normalizeOptionalText(value?: string | null) {
  return value ? value : "";
}

function parseCurrencyValue(value: string) {
  const numeric = Number(value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
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
    items: items.slice(start, start + pageSize)
  };
}

const StatCard = ({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string | number; color: string }) => (
  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
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

const Admin = () => {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const [showRightGradient, setShowRightGradient] = useState(true);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "unauthenticated" | "forbidden">("checking");
  const [loadedSections, setLoadedSections] = useState<Record<AdminDataSection, boolean>>(defaultLoadedSections);
  const [loadingSections, setLoadingSections] = useState<Record<AdminDataSection, boolean>>(defaultLoadedSections);
  const [sessionStudentNumber, setSessionStudentNumber] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [exportingReport, setExportingReport] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [submissionSortBy, setSubmissionSortBy] = useState<"recentes" | "nome" | "inscricao" | "curso">("recentes");
  const [submissionPageSize, setSubmissionPageSize] = useState(10);
  const [submissionPage, setSubmissionPage] = useState(1);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [submissionsTotalPages, setSubmissionsTotalPages] = useState(1);
  const [loadingSubmissionsList, setLoadingSubmissionsList] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");
  const [studentCourseFilter, setStudentCourseFilter] = useState("todos");
  const [studentSortBy, setStudentSortBy] = useState<"interacoes" | "nome" | "numero" | "curso">("interacoes");
  const [studentPageSize, setStudentPageSize] = useState(10);
  const [studentPage, setStudentPage] = useState(1);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsTotalPages, setStudentsTotalPages] = useState(1);
  const [loadingStudentsList, setLoadingStudentsList] = useState(false);
  const [groupStudentsByCourse, setGroupStudentsByCourse] = useState(true);
  const [moderationSearchTerm, setModerationSearchTerm] = useState("");
  const [moderationPageSize, setModerationPageSize] = useState(10);
  const [moderationCommentPage, setModerationCommentPage] = useState(1);
  const [moderationChatPage, setModerationChatPage] = useState(1);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsDashboard, setAnalyticsDashboard] = useState<AnalyticsDashboard | null>(null);
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEventsPayload | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsFilters, setAnalyticsFilters] = useState<AnalyticsFilterInput>(defaultAnalyticsFilters);

  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [submissionListRows, setSubmissionListRows] = useState<AdminSubmission[]>([]);
  const [submissionBannerDrafts, setSubmissionBannerDrafts] = useState<Record<number, string | null | undefined>>({});
  const [submissionConfig, setSubmissionConfig] = useState<Omit<SubmissionConfig, "key" | "createdAt" | "updatedAt">>(defaultSubmissionConfigForm);
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [studentListRows, setStudentListRows] = useState<StudentWithStats[]>([]);
  const [authorizedAdminStudents, setAuthorizedAdminStudents] = useState<AdminAuthorizedStudent[]>([]);
  const [recentLogins, setRecentLogins] = useState<StudentProfile[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [schedule, setSchedule] = useState<AgendaItem[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [guideContent, setGuideContent] = useState<GuideContent>({ steps: [], tips: [], venues: [] });
  const [courses, setCourses] = useState<Course[]>([]);
  const [panelTopics, setPanelTopics] = useState<PanelTopic[]>([]);
  const [liveState, setLiveState] = useState<AgendaLiveState>({ current: null, next: null });
  const [liveConfigForm, setLiveConfigForm] = useState<AgendaLiveConfigInput>(defaultLiveConfigForm);
  const [voteProjects, setVoteProjects] = useState<VoteProjectSummary[]>([]);
  const [voteEntries, setVoteEntries] = useState<VoteEntry[]>([]);
  const [votesProjectsPage, setVotesProjectsPage] = useState(1);
  const [votesProjectsPageSize] = useState(30);
  const [votesProjectsTotal, setVotesProjectsTotal] = useState(0);
  const [votesProjectsTotalPages, setVotesProjectsTotalPages] = useState(1);
  const [votesEntriesPage, setVotesEntriesPage] = useState(1);
  const [votesEntriesPageSize] = useState(80);
  const [votesEntriesTotal, setVotesEntriesTotal] = useState(0);
  const [votesEntriesTotalPages, setVotesEntriesTotalPages] = useState(1);
  const [votesUpdatedAt, setVotesUpdatedAt] = useState<string | null>(null);
  const [projectComments, setProjectComments] = useState<AdminModerationProjectComment[]>([]);
  const [liveChatMessages, setLiveChatMessages] = useState<AdminModerationLiveChatMessage[]>([]);
  const [selectedWinners, setSelectedWinners] = useState<{ projectWinner: number | null; studentWinner: number | null }>({
    projectWinner: null,
    studentWinner: null,
  });

  const [studentPendingRemoval, setStudentPendingRemoval] = useState<StudentWithStats | null>(null);
  const [isRemovingStudent, setIsRemovingStudent] = useState(false);
  const [submissionPendingRemoval, setSubmissionPendingRemoval] = useState<AdminSubmission | null>(null);
  const [isRemovingSubmission, setIsRemovingSubmission] = useState(false);
  const [courseEnrollments, setCourseEnrollments] = useState<Record<number, CourseEnrollmentsPagedPayload>>({});
  const [expandedCourseId, setExpandedCourseId] = useState<number | null>(null);
  const [loadingCourseId, setLoadingCourseId] = useState<number | null>(null);
  const [exportingCourseId, setExportingCourseId] = useState<number | null>(null);
  const [updatingEnrollmentStatusId, setUpdatingEnrollmentStatusId] = useState<number | null>(null);

  const [editingSpeakerId, setEditingSpeakerId] = useState<number | null>(null);
  const [speakerForm, setSpeakerForm] = useState<SpeakerInput>(defaultSpeakerForm);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState<AgendaInput>(defaultScheduleForm);
  const [editingFaqId, setEditingFaqId] = useState<number | null>(null);
  const [faqForm, setFaqForm] = useState<FaqInput>(defaultFaqForm);
  const [editingGuideStepId, setEditingGuideStepId] = useState<number | null>(null);
  const [guideStepForm, setGuideStepForm] = useState<GuideStepInput>(defaultGuideStepForm);
  const [editingGuideTipId, setEditingGuideTipId] = useState<number | null>(null);
  const [guideTipForm, setGuideTipForm] = useState<GuideTipInput>(defaultGuideTipForm);
  const [editingVenueId, setEditingVenueId] = useState<number | null>(null);
  const [venueForm, setVenueForm] = useState<VenueInput>(defaultVenueForm);
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [courseForm, setCourseForm] = useState<CourseInput>(defaultCourseForm);
  const [editingPanelTopicId, setEditingPanelTopicId] = useState<number | null>(null);
  const [panelTopicForm, setPanelTopicForm] = useState<PanelTopicInput>(defaultPanelTopicForm);
  const [socialConfigForm, setSocialConfigForm] = useState<HomeSocialConfigInput>(defaultSocialConfigForm);
  const [authorizedStudentNumber, setAuthorizedStudentNumber] = useState("");
  const deferredSubmissionSearch = useDeferredValue(searchTerm);
  const deferredStudentSearch = useDeferredValue(studentSearchTerm);
  const deferredModerationSearch = useDeferredValue(moderationSearchTerm);

  const mapSubmissionToAdmin = (
    submission: Awaited<ReturnType<typeof api.submissions.listDetailedPaged>>["items"][number]
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
    isWinner: submission.isWinner,
    canVote: submission.canVote,
  });

  const submissionStatusToApi = (value: string): "PENDING" | "APPROVED" | "REJECTED" | undefined => {
    if (value === "pendente") return "PENDING";
    if (value === "aprovado") return "APPROVED";
    if (value === "recusado") return "REJECTED";
    return undefined;
  };

  const submissionTypeToApi = (value: string): "PROJECT" | "BUSINESS" | "PRODUCT" | undefined => {
    if (value === "projeto") return "PROJECT";
    if (value === "negocio") return "BUSINESS";
    if (value === "produto") return "PRODUCT";
    return undefined;
  };

  const submissionSortToApi = (
    value: typeof submissionSortBy
  ): "created_desc" | "name_asc" | "reference_asc" | "course_asc" => {
    if (value === "nome") return "name_asc";
    if (value === "inscricao") return "reference_asc";
    if (value === "curso") return "course_asc";
    return "created_desc";
  };

  const studentSortToApi = (
    value: typeof studentSortBy
  ): "interactions_desc" | "name_asc" | "number_asc" | "course_asc" => {
    if (value === "nome") return "name_asc";
    if (value === "numero") return "number_asc";
    if (value === "curso") return "course_asc";
    return "interactions_desc";
  };

  const applyVoteSnapshot = (
    interactionData: {
      projects: Array<{ id: number; name: string; type: string; votes: number; comments: number; averageRating: number }>;
      votes: Array<{
        id: number;
        studentId: number;
        studentNumber: string;
        studentName: string | null;
        studentEmail: string | null;
        submissionId: number;
        submissionName: string;
        createdAt: string;
      }>;
    },
    submissionList: AdminSubmission[],
    pagination?: {
      projects: { page: number; total: number; totalPages: number };
      votes: { page: number; total: number; totalPages: number };
    }
  ) => {
    const submissionStatusMap = new Map(submissionList.map((item) => [item.id, item.status]));
    const submissionTeamMap = new Map(submissionList.map((item) => [item.id, item.equipa]));
    const submissionWinnerMap = new Map(submissionList.map((item) => [item.id, item.isWinner]));

    setVoteProjects(
      interactionData.projects.map((project) => ({
        id: project.id,
        nome: project.name,
        equipa: submissionTeamMap.get(project.id) || "Equipa por confirmar",
        tipo: mapSubmissionType(project.type),
        votos: project.votes,
        rating: project.averageRating,
        comentarios: project.comments,
        status: submissionStatusMap.get(project.id) ?? "pendente",
        isWinner: submissionWinnerMap.get(project.id) ?? false,
      }))
    );
    setVoteEntries(
      interactionData.votes.map((vote) => ({
        id: vote.id,
        studentId: vote.studentId,
        estudante: vote.studentName || `Estudante ${vote.studentNumber}`,
        email: vote.studentEmail || "Sem email",
        projeto: vote.submissionName,
        data: vote.createdAt,
      }))
    );
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

  const setSectionLoading = (section: AdminDataSection, loadingState: boolean) => {
    setLoadingSections((current) => ({ ...current, [section]: loadingState }));
  };

  const resetLoadedSections = () => {
    setLoadedSections(defaultLoadedSections);
    setLoadingSections(defaultLoadedSections);
  };

  const loadSection = async (section: AdminDataSection, options?: { force?: boolean }) => {
    if (!options?.force && (loadedSections[section] || loadingSections[section])) {
      return;
    }

    setSectionLoading(section, true);

    try {
      if (section === "security") {
        const securityOverview = await api.students.securityOverview();
        setAuthorizedAdminStudents(securityOverview.authorizedStudents);
        setRecentLogins(securityOverview.recentLogins);
        markSectionLoaded(section);
        return;
      }

      if (section === "base") {
        const results = await Promise.allSettled([
          api.submissions.listDetailedPaged({ page: 1, limit: 180, sort: "created_desc" }),
          api.submissions.config(),
          api.interactions.adminVotesPaged({ projectsPage: 1, projectsLimit: votesProjectsPageSize, votesPage: 1, votesLimit: votesEntriesPageSize }),
        ]);

        const [submissionResult, submissionConfigResult, interactionResult] = results;
        const submissionList = submissionResult.status === "fulfilled" ? submissionResult.value.items : [];
        const config = submissionConfigResult.status === "fulfilled" ? submissionConfigResult.value : null;
        const interactionData = interactionResult.status === "fulfilled"
          ? interactionResult.value
          : null;

        if (submissionResult.status === "fulfilled" && submissionResult.value.total > submissionResult.value.items.length) {
          toast.info(`A mostrar ${submissionResult.value.items.length} de ${submissionResult.value.total} candidaturas para manter o painel fluido.`);
        }

        if (interactionResult.status === "fulfilled" && interactionResult.value.votes.total > interactionResult.value.votes.items.length) {
          toast.info(`A mostrar os ${interactionResult.value.votes.items.length} votos mais recentes para reduzir carga em picos.`);
        }

        if (results.some((result) => result.status === "rejected")) {
          toast.warning("Alguns blocos da administração falharam ao carregar. O resto do painel foi mantido.");
        }

        const mappedSubmissions = submissionList.map((submission) => mapSubmissionToAdmin(submission));

        setSubmissions(mappedSubmissions);
        setSubmissionListRows(mappedSubmissions);
        setSubmissionsTotal(
          submissionResult.status === "fulfilled"
            ? submissionResult.value.total
            : mappedSubmissions.length
        );
        setSubmissionsTotalPages(
          submissionResult.status === "fulfilled"
            ? submissionResult.value.totalPages
            : 1
        );
        setSubmissionBannerDrafts(
          mappedSubmissions.reduce<Record<number, string | null>>((acc, item) => {
            acc[item.id] = item.bannerUrl ?? null;
            return acc;
          }, {})
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
            : undefined
        );
        const winner = submissionList.find((submission) => submission.isWinner);
        setSelectedWinners((current) => ({ ...current, projectWinner: winner?.id ?? null }));
        markSectionLoaded(section);
        return;
      }

      if (section === "students") {
        const payload = await api.students.listPaged({ page: 1, limit: 200, sort: "created_desc" });
        setStudents(payload.items);
        setStudentListRows(payload.items);
        setStudentsTotal(payload.total);
        setStudentsTotalPages(payload.totalPages);
        if (payload.total > payload.items.length) {
          toast.info(`A mostrar ${payload.items.length} de ${payload.total} estudantes para garantir rapidez no painel.`);
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
        const [agendaList, live] = await Promise.all([api.agenda.list(), api.agenda.live()]);
        setSchedule(agendaList);
        setLiveState(live);
        markSectionLoaded(section);
        return;
      }

      if (section === "liveConfig") {
        const liveConfig = await api.agenda.liveConfig();
        setLiveConfigForm({
          mode: liveConfig.mode,
          current: liveConfig.current ?? defaultLiveConfigForm.current
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
        toast.warning("Inicia sessão com a conta autorizada para abrir a área administrativa.");
      } else if (isForbiddenError(error)) {
        setAccessState("forbidden");
        toast.error("Acesso negado à área administrativa.");
      } else {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar dados da administração");
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
      const jury = (session as any).jury as { id: number; name: string; phone: string } | null | undefined;

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
      await Promise.all([
        loadSection("security", { force: true }),
        loadSection("base", { force: true }),
      ]);
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setAccessState("unauthenticated");
        toast.warning("Inicia sessão com a conta autorizada para abrir a área administrativa.");
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

  const loadAnalyticsData = async (filters: AnalyticsFilterInput = analyticsFilters) => {
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
        setAnalyticsError("A sessão expirou. Inicia sessão de novo para abrir a central de cookies.");
        return;
      }

      if (isForbiddenError(error)) {
        setAccessState("forbidden");
        setAnalyticsError("A conta atual não tem acesso à central de cookies e analytics.");
        return;
      }

      setAnalyticsError(error instanceof Error ? error.message : "Falha ao carregar a central de cookies.");
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleAnalyticsFiltersChange = (patch: Partial<AnalyticsFilterInput>) => {
    setAnalyticsFilters((current) => ({
      ...current,
      ...patch,
      page: patch.page ?? (patch.search !== undefined || patch.from !== undefined || patch.to !== undefined || patch.course !== undefined || patch.audience !== undefined || patch.consent !== undefined || patch.source !== undefined ? 1 : current.page),
    }));
  };

  const handleAnalyticsExport = async () => {
    try {
      const csv = await api.analytics.exportCsv(analyticsFilters);
      downloadBlob(csv, `uor-connect-cookies-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Exportação de analytics concluída.");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setAccessState("unauthenticated");
        toast.warning("Inicia sessão novamente para exportar o histórico de cookies.");
      } else if (isForbiddenError(error)) {
        setAccessState("forbidden");
        toast.error("A conta atual não pode exportar os dados de cookies.");
      } else {
        toast.error(error instanceof Error ? error.message : "Falha ao exportar analytics.");
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

  // Inicializar estado dos gradients e monitorer resize
  useEffect(() => {
    handleTabsScroll();
    window.addEventListener('resize', handleTabsScroll);
    return () => window.removeEventListener('resize', handleTabsScroll);
  }, []);

  useEffect(() => {
    void loadAdminData();
  }, []);

  useEffect(() => {
    if (accessState !== "allowed") return;

    const sectionsByTab: Record<TabId, AdminDataSection[]> = {
      overview: ["base"],
      analytics: [],
      sms: ["courses"],
      jury: [],
      submissions: ["base"],
      speakers: ["speakers"],
      schedule: ["agenda"],
      guide: ["guide"],
      courses: ["courses"],
      panels: ["homeContent"],
      evento: ["homeContent"],
      faq: ["faq"],
      live: ["agenda", "liveConfig"],
      votes: ["base", "moderation"],
      security: ["security"],
      students: ["students"],
      winners: ["base", "students"],
    };

    for (const section of sectionsByTab[activeTab] ?? []) {
      void loadSection(section);
    }
  }, [accessState, activeTab, loadedSections, loadingSections]);

  useEffect(() => {
    if (accessState !== "allowed") return;

    const shouldPollLive = activeTab === "overview" || activeTab === "schedule" || activeTab === "live";
    const shouldPollVotes = activeTab === "overview" || activeTab === "votes" || activeTab === "winners";

    if (!shouldPollLive && !shouldPollVotes) return;

    const refresh = () => {
      const jobs: Promise<unknown>[] = [];

      if (shouldPollLive) {
        jobs.push(
          Promise.allSettled([api.agenda.live(), api.agenda.list()]).then(([liveResult, agendaResult]) => {
            if (liveResult.status === "fulfilled") {
              setLiveState(liveResult.value);
            }

            if (agendaResult.status === "fulfilled" && (activeTab === "schedule" || activeTab === "live")) {
              setSchedule(agendaResult.value);
            }
          })
        );
      }

      if (shouldPollVotes && loadedSections.base) {
        const projectsPage = activeTab === "votes" ? votesProjectsPage : 1;
        const votesPage = activeTab === "votes" ? votesEntriesPage : 1;
        const projectsLimit = activeTab === "votes" ? votesProjectsPageSize : 12;
        const votesLimit = activeTab === "votes" ? votesEntriesPageSize : 40;

        jobs.push(
          api.interactions.adminVotesPaged({ projectsPage, projectsLimit, votesPage, votesLimit }).then((snapshot) => {
            applyVoteSnapshot(
              {
                projects: snapshot.projects.items,
                votes: snapshot.votes.items,
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
                : undefined
            );
          }).catch(() => undefined)
        );
      }

      if (activeTab === "votes" && loadedSections.moderation) {
        jobs.push(
          api.interactions.adminModeration().then((moderationData) => {
            setProjectComments(moderationData.projectComments);
            setLiveChatMessages(moderationData.liveChatMessages);
          }).catch(() => undefined)
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
    if (accessState !== "allowed" || activeTab !== "submissions" || !loadedSections.base) return;

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
          toast.warning("Inicia sessão com a conta autorizada para abrir a área administrativa.");
          return;
        }
        if (isForbiddenError(error)) {
          setAccessState("forbidden");
          toast.error("Acesso negado à área administrativa.");
          return;
        }
        toast.error(error instanceof Error ? error.message : "Falha ao carregar candidaturas.");
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
    if (accessState !== "allowed" || activeTab !== "students" || !loadedSections.students) return;

    let cancelled = false;

    const loadStudentsPage = async () => {
      try {
        setLoadingStudentsList(true);
        const payload = await api.students.listPaged({
          page: studentPage,
          limit: studentPageSize,
          search: deferredStudentSearch.trim() || undefined,
          course: studentCourseFilter === "todos" ? undefined : studentCourseFilter,
          sort: studentSortToApi(studentSortBy),
        });

        if (cancelled) return;

        setStudentListRows(payload.items);
        setStudentsTotal(payload.total);
        setStudentsTotalPages(payload.totalPages);
        setStudentPage(payload.page);
      } catch (error) {
        if (cancelled) return;
        if (isAuthError(error)) {
          setToken(null);
          setAccessState("unauthenticated");
          toast.warning("Inicia sessão com a conta autorizada para abrir a área administrativa.");
          return;
        }
        if (isForbiddenError(error)) {
          setAccessState("forbidden");
          toast.error("Acesso negado à área administrativa.");
          return;
        }
        toast.error(error instanceof Error ? error.message : "Falha ao carregar estudantes.");
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
    studentPage,
    studentPageSize,
    studentSortBy,
  ]);


  const rankedStudents = useMemo(
    () => [...students].sort((left, right) => studentInteractions(right) - studentInteractions(left)),
    [students]
  );

  const rankedProjects = useMemo(
    () =>
      [...voteProjects].sort((left, right) => {
        if (right.votos !== left.votos) return right.votos - left.votos;
        if (right.rating !== left.rating) return right.rating - left.rating;
        return right.comentarios - left.comentarios;
      }),
    [voteProjects]
  );

  const approvedProjects = useMemo(
    () => rankedProjects.filter((project) => project.status === "aprovado" && project.tipo === "projeto"),
    [rankedProjects]
  );

  const paginatedSubmissions = useMemo(
    () => ({
      currentPage: submissionPage,
      totalPages: submissionsTotalPages,
      items: submissionListRows,
    }),
    [submissionListRows, submissionPage, submissionsTotalPages]
  );

  const groupedStudents = useMemo(() => {
    return studentListRows.reduce<Record<string, StudentWithStats[]>>((acc, student) => {
      const key = student.course || "Sem curso";
      acc[key] = acc[key] ? [...acc[key], student] : [student];
      return acc;
    }, {});
  }, [studentListRows]);

  const availableStudentCourses = useMemo(
    () => Array.from(new Set([...students, ...studentListRows].map((student) => student.course).filter(Boolean) as string[])).sort((left, right) => left.localeCompare(right, "pt")),
    [students, studentListRows]
  );

  const filteredProjectComments = useMemo(() => {
    const search = deferredModerationSearch.toLowerCase();

    return projectComments.filter((comment) => (
      comment.content.toLowerCase().includes(search) ||
      comment.studentName.toLowerCase().includes(search) ||
      comment.studentNumber.toLowerCase().includes(search) ||
      comment.submissionName.toLowerCase().includes(search) ||
      (comment.course ?? "").toLowerCase().includes(search)
    ));
  }, [deferredModerationSearch, projectComments]);

  const filteredLiveChatMessages = useMemo(() => {
    const search = deferredModerationSearch.toLowerCase();

    return liveChatMessages.filter((message) => (
      message.content.toLowerCase().includes(search) ||
      message.studentName.toLowerCase().includes(search) ||
      message.studentNumber.toLowerCase().includes(search) ||
      (message.course ?? "").toLowerCase().includes(search)
    ));
  }, [liveChatMessages, deferredModerationSearch]);

  const paginatedProjectComments = useMemo(
    () => paginateItems(filteredProjectComments, moderationCommentPage, moderationPageSize),
    [filteredProjectComments, moderationCommentPage, moderationPageSize]
  );

  const paginatedLiveChatMessages = useMemo(
    () => paginateItems(filteredLiveChatMessages, moderationChatPage, moderationPageSize),
    [filteredLiveChatMessages, moderationChatPage, moderationPageSize]
  );

  useEffect(() => {
    setSubmissionPage(1);
  }, [filterStatus, filterTipo, searchTerm, submissionPageSize, submissionSortBy]);

  useEffect(() => {
    setStudentPage(1);
  }, [groupStudentsByCourse, studentCourseFilter, studentPageSize, studentSearchTerm, studentSortBy]);

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
    const approvedCount = submissions.filter((item) => item.status === "aprovado").length;
    const projectCount = submissions.filter((item) => item.tipo === "projeto").length;
    const businessCount = submissions.filter((item) => item.tipo === "negocio").length;
    const productCount = submissions.filter((item) => item.tipo === "produto").length;

    return {
      exhibitorCount,
      approvedCount,
      projectCount,
      businessCount,
      productCount,
      paidValue,
      projectedRevenue: exhibitorCount * paidValue,
      approvedRevenue: approvedCount * paidValue,
    };
  }, [submissionConfig.paymentAmount, submissions]);

  const handleExportOverviewReport = async () => {
    try {
      setExportingReport(true);
      const job = await api.reports.createOverviewPdfJob();
      await waitForPdfJobReady(() => api.reports.getOverviewPdfJob(job.id), { timeoutMs: 180_000, intervalMs: 1_500 });
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
        toast.warning("Inicia sessão com a conta autorizada para exportar o relatório.");
      } else if (isForbiddenError(error)) {
        setAccessState("forbidden");
        toast.error("Acesso negado à exportação administrativa.");
      } else {
        toast.error(error instanceof Error ? error.message : "Falha ao exportar relatório.");
      }
    } finally {
      setExportingReport(false);
    }
  };



  if (accessState === "unauthenticated" || accessState === "forbidden") {
    return (
      <div className="min-h-screen py-12 md:py-16">
        <div className="container mx-auto px-4">
          <Card className="mx-auto max-w-2xl border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {accessState === "forbidden" ? <AlertTriangle className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
              </div>
              <div>
                <h1 className="font-heading text-2xl font-bold">Acesso restrito</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {accessState === "forbidden"
                    ? "A tua conta não tem permissão para aceder a esta área."
                    : "Inicia sessão com uma conta autorizada."}
                </p>
              </div>
              <div className="flex justify-center">
                <Button asChild>
                  <Link to="/login?redirect=/admin">Entrar com conta autorizada</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
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
    if (studentNumber.length !== 8) {
      toast.warning("Informa um número de estudante com 8 dígitos.");
      return;
    }

    try {
      setBusyKey("security-authorize");
      const authorizedStudent = await api.students.authorizeAdmin(studentNumber);
      setAuthorizedAdminStudents((current) => {
        const next = current.filter((item) => item.studentNumber !== authorizedStudent.studentNumber);
        return [...next, authorizedStudent].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      });
      setAuthorizedStudentNumber("");
      toast.success("Acesso administrativo autorizado.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao autorizar estudante.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleRevokeAdminStudent = async (studentNumber: string) => {
    try {
      setBusyKey(`security-revoke-${studentNumber}`);
      await api.students.revokeAdmin(studentNumber);
      setAuthorizedAdminStudents((current) => current.filter((item) => item.studentNumber !== studentNumber));
      toast.success("Acesso administrativo removido.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao remover acesso administrativo.");
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
          setVoteProjects((projects) => projects.map((project) => (
            project.id === removed.submissionId
              ? { ...project, comentarios: Math.max(0, project.comentarios - 1) }
              : project
          )));
        }

        return current.filter((item) => item.id !== commentId);
      });
      toast.success("Comentário removido.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao remover comentário.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleLiveChatMessageDelete = async (messageId: number) => {
    try {
      setBusyKey(`live-chat-delete-${messageId}`);
      await api.interactions.deleteLiveChatMessage(messageId);
      setLiveChatMessages((current) => current.filter((item) => item.id !== messageId));
      toast.success("Mensagem do mini-chat removida.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao remover mensagem do mini-chat.");
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

  const handleStatusChange = async (id: number, status: AdminSubmission["status"]) => {
    try {
      await api.submissions.updateStatus(id, toBackendStatus(status));
      setSubmissions((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
      setSubmissionListRows((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
      setVoteProjects((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
      toast.success(status === "aprovado" ? "Candidatura aprovada." : "Candidatura recusada.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao atualizar o estado da candidatura");
      }
    }
  };

  const resolveSubmissionBannerPreview = (submission: AdminSubmission) => {
    const draftBanner = submissionBannerDrafts[submission.id];
    return draftBanner !== undefined ? draftBanner : submission.bannerUrl;
  };

  const handleSubmissionBannerFile = async (submission: AdminSubmission, file: File | null) => {
    if (!file) return;

    if (submission.status !== "aprovado") {
      toast.info("A edição da capa só fica disponível quando a candidatura é aprovada.");
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
      setSubmissionBannerDrafts((current) => ({ ...current, [submission.id]: dataUrl }));
      toast.success("Imagem preparada. Clica em \"Guardar capa\" para aplicar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao processar imagem.");
    }
  };

  const handleSubmissionBannerSave = async (submission: AdminSubmission) => {
    if (submission.status !== "aprovado") {
      toast.info("A edição da capa só fica disponível quando a candidatura é aprovada.");
      return;
    }

    const nextBannerUrl = resolveSubmissionBannerPreview(submission) ?? null;
    const busyId = `submission-banner-save-${submission.id}`;

    try {
      setBusyKey(busyId);
      const updated = await api.submissions.updatePresentation(submission.id, { bannerUrl: nextBannerUrl });
      setSubmissions((current) => current.map((item) => (
        item.id === submission.id
          ? {
            ...item,
            bannerUrl: updated.bannerUrl ?? null,
            primaryColor: updated.primaryColor,
            secondaryColor: updated.secondaryColor,
          }
          : item
      )));
      setSubmissionListRows((current) => current.map((item) => (
        item.id === submission.id
          ? {
            ...item,
            bannerUrl: updated.bannerUrl ?? null,
            primaryColor: updated.primaryColor,
            secondaryColor: updated.secondaryColor,
          }
          : item
      )));
      setSubmissionBannerDrafts((current) => ({ ...current, [submission.id]: updated.bannerUrl ?? null }));
      toast.success("Capa do expositor atualizada.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao guardar capa do expositor.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleSubmissionBannerRemove = async (submission: AdminSubmission) => {
    if (submission.status !== "aprovado") {
      toast.info("A edição da capa só fica disponível quando a candidatura é aprovada.");
      return;
    }

    const busyId = `submission-banner-remove-${submission.id}`;

    try {
      setBusyKey(busyId);
      const updated = await api.submissions.updatePresentation(submission.id, { bannerUrl: null });
      setSubmissions((current) => current.map((item) => (
        item.id === submission.id
          ? {
            ...item,
            bannerUrl: null,
            primaryColor: updated.primaryColor,
            secondaryColor: updated.secondaryColor,
          }
          : item
      )));
      setSubmissionListRows((current) => current.map((item) => (
        item.id === submission.id
          ? {
            ...item,
            bannerUrl: null,
            primaryColor: updated.primaryColor,
            secondaryColor: updated.secondaryColor,
          }
          : item
      )));
      setSubmissionBannerDrafts((current) => ({ ...current, [submission.id]: null }));
      toast.success("Foto da capa removida.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao remover capa do expositor.");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleSubmissionConfigSave = async () => {
    if (!submissionConfig.iban || !submissionConfig.accountName || !submissionConfig.paymentAmount) {
      toast.error("Preenche IBAN, nome da conta e valor da candidatura.");
      return;
    }

    setBusyKey("submission-config");
    try {
      const saved = await api.submissions.updateConfig({
        ...submissionConfig,
        paymentInstructions: normalizeOptionalText(submissionConfig.paymentInstructions) || null,
        projectCommunityUrl: normalizeOptionalText(submissionConfig.projectCommunityUrl) || null,
        businessCommunityUrl: normalizeOptionalText(submissionConfig.businessCommunityUrl) || null,
        productCommunityUrl: normalizeOptionalText(submissionConfig.productCommunityUrl) || null,
      });
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
      toast.success("Configuração de candidatura atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar configuração da candidatura");
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemoveStudent = async (student: StudentWithStats) => {
    try {
      setIsRemovingStudent(true);
      await api.students.remove(student.id);
      setStudents((current) => current.filter((item) => item.id !== student.id));
      setStudentListRows((current) => current.filter((item) => item.id !== student.id));
      setStudentsTotal((current) => Math.max(0, current - 1));
      setVoteEntries((current) => current.filter((item) => item.studentId !== student.id));
      setStudentPendingRemoval(null);
      toast.success("Estudante removido da base de dados");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover estudante");
    } finally {
      setIsRemovingStudent(false);
    }
  };

  const handleRemoveSubmission = async (submission: AdminSubmission) => {
    try {
      setIsRemovingSubmission(true);
      await api.submissions.remove(submission.id);
      setSubmissions((current) => current.filter((item) => item.id !== submission.id));
      setSubmissionListRows((current) => current.filter((item) => item.id !== submission.id));
      setSubmissionsTotal((current) => Math.max(0, current - 1));
      setVoteProjects((current) => current.filter((item) => item.id !== submission.id));
      setSelectedWinners((current) => ({
        ...current,
        projectWinner: current.projectWinner === submission.id ? null : current.projectWinner,
      }));
      setSubmissionPendingRemoval(null);
      toast.success("Expositor removido da base de dados e da área pública.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao remover expositor");
      }
    } finally {
      setIsRemovingSubmission(false);
    }
  };

  const handleSelectWinner = async (projectId: number) => {
    try {
      await api.submissions.selectWinner(projectId);
      setSelectedWinners((current) => ({ ...current, projectWinner: projectId }));
      setSubmissions((current) => current.map((item) => ({ ...item, isWinner: item.id === projectId })));
      setSubmissionListRows((current) => current.map((item) => ({ ...item, isWinner: item.id === projectId })));
      setVoteProjects((current) => current.map((item) => ({ ...item, isWinner: item.id === projectId })));
      toast.success("Projeto académico vencedor atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao definir vencedor");
    }
  };

  const handleClearWinner = async () => {
    try {
      await api.submissions.clearWinner();
      setSelectedWinners((current) => ({ ...current, projectWinner: null }));
      setSubmissions((current) => current.map((item) => ({ ...item, isWinner: false })));
      setSubmissionListRows((current) => current.map((item) => ({ ...item, isWinner: false })));
      setVoteProjects((current) => current.map((item) => ({ ...item, isWinner: false })));
      toast.success("Projeto académico vencedor removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao desclassificar vencedor");
    }
  };

  const loadCourseEnrollmentsPage = async (courseId: number, page: number) => {
    try {
      setLoadingCourseId(courseId);
      const payload = await api.courses.enrollmentsPaged(courseId, { page, limit: 30 });
      setCourseEnrollments((current) => ({ ...current, [courseId]: payload }));
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao carregar inscritos do curso");
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

  const handleExportCourseEnrollments = async (course: Course) => {
    try {
      setExportingCourseId(course.id);
      const job = await api.courses.createEnrollmentsPdfJob(course.id);
      await waitForPdfJobReady(
        () => api.courses.getEnrollmentsPdfJob(course.id, job.id),
        { timeoutMs: 180_000, intervalMs: 1_500 }
      );
      const pdf = await api.courses.downloadEnrollmentsPdfJobFile(course.id, job.id);
      downloadBlob(pdf, `uor-connect-${course.name.toLowerCase().replace(/\s+/g, "-")}-inscritos-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Relatório do curso exportado com sucesso.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao exportar relatório do curso");
      }
    } finally {
      setExportingCourseId(null);
    }
  };

  const handleEnrollmentStatusUpdate = async (
    courseId: number,
    enrollmentId: number,
    status: CourseEnrollmentStatus
  ) => {
    try {
      setUpdatingEnrollmentStatusId(enrollmentId);
      const payload = await api.courses.updateEnrollmentStatus(enrollmentId, status);
      setCourseEnrollments((current) => {
        const currentCourse = current[courseId];
        if (!currentCourse) return current;

        return {
          ...current,
          [courseId]: {
            ...currentCourse,
            enrollments: currentCourse.enrollments.map((entry) => (
              entry.id === enrollmentId ? payload.enrollment : entry
            )),
          },
        };
      });
      toast.success(`Estado da inscrição atualizado para ${courseEnrollmentStatusLabel[status].toLowerCase()}.`);
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao atualizar estado da inscrição");
      }
    } finally {
      setUpdatingEnrollmentStatusId(null);
    }
  };

  const handleSpeakerSubmit = async () => {
    if (!speakerForm.name || !speakerForm.bio || !speakerForm.specialty || !speakerForm.talk || !speakerForm.day || !speakerForm.linkedin) {
      toast.error("Preenche todos os campos obrigatórios do palestrante");
      return;
    }

    setBusyKey("speaker");
    try {
      const payload = { ...speakerForm, avatarUrl: normalizeOptionalText(speakerForm.avatarUrl) || null };
      const speaker = editingSpeakerId
        ? await api.speakers.update(editingSpeakerId, payload)
        : await api.speakers.create(payload);

      setSpeakers((current) => {
        const next = editingSpeakerId
          ? current.map((item) => (item.id === speaker.id ? speaker : item))
          : [...current, speaker];
        return [...next].sort((left, right) => left.name.localeCompare(right.name));
      });
      toast.success(editingSpeakerId ? "Palestrante atualizado." : "Palestrante criado.");
      resetSpeakerForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao guardar palestrante");
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
      toast.error(error instanceof Error ? error.message : "Falha ao remover palestrante");
    } finally {
      setBusyKey(null);
    }
  };

  const handleAgendaSubmit = async () => {
    if (!scheduleForm.date || !scheduleForm.startTime || !scheduleForm.endTime || !scheduleForm.title || !scheduleForm.local || !scheduleForm.description || !scheduleForm.theme) {
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
            new Date(`${left.date.slice(0, 10)}T${left.startTime}:00`).getTime() -
            new Date(`${right.date.slice(0, 10)}T${right.startTime}:00`).getTime()
        );
      });
      setLiveState(await api.agenda.live());
      toast.success(editingScheduleId ? "Sessão atualizada." : "Sessão criada.");
      resetScheduleForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao guardar agenda");
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
      toast.error(error instanceof Error ? error.message : "Falha ao remover sessão");
    } finally {
      setBusyKey(null);
    }
  };

  const handleLiveConfigSave = async () => {
    if (liveConfigForm.mode === "MANUAL") {
      const current = liveConfigForm.current;
      if (!current || !current.date || !current.startTime || !current.endTime || !current.title || !current.local || !current.description || !current.theme) {
        toast.error("Preenche os campos obrigatórios do conteúdo ao vivo.");
        return;
      }
    }

    try {
      setBusyKey("live-config");
      const saved = await api.agenda.updateLiveConfig({
        mode: liveConfigForm.mode,
        current: liveConfigForm.mode === "MANUAL" ? liveConfigForm.current : null
      });
      const [nextLiveState, nextSchedule] = await Promise.all([
        api.agenda.live(),
        api.agenda.list()
      ]);
      setLiveState(nextLiveState);
      setSchedule(nextSchedule);
      setLiveConfigForm({
        mode: saved.mode,
        current: saved.current ?? defaultLiveConfigForm.current
      });
      toast.success(saved.mode === "MANUAL" ? "Conteúdo ao vivo atualizado e sincronizado com a agenda atual." : "Ao Vivo voltou a seguir a agenda.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao guardar conteúdo ao vivo.");
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
      const item = editingFaqId ? await api.faq.update(editingFaqId, payload) : await api.faq.create(payload);
      setFaqItems((current) => {
        const next = editingFaqId ? current.map((entry) => (entry.id === item.id ? item : entry)) : [...current, item];
        return [...next].sort((left, right) => left.sortOrder - right.sortOrder);
      });
      toast.success(editingFaqId ? "FAQ atualizada." : "FAQ criada.");
      resetFaqForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao guardar FAQ");
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
      toast.error(error instanceof Error ? error.message : "Falha ao remover FAQ");
    } finally {
      setBusyKey(null);
    }
  };

  const handleGuideStepSubmit = async () => {
    if (!guideStepForm.title || !guideStepForm.description || !guideStepForm.icon) {
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
        steps: [...(editingGuideStepId ? current.steps.map((item) => (item.id === step.id ? step : item)) : [...current.steps, step])].sort(
          (left, right) => left.sortOrder - right.sortOrder
        ),
      }));
      toast.success(editingGuideStepId ? "Passo atualizado." : "Passo criado.");
      resetGuideStepForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao guardar passo");
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
        tips: [...(editingGuideTipId ? current.tips.map((item) => (item.id === tip.id ? tip : item)) : [...current.tips, tip])].sort(
          (left, right) => left.sortOrder - right.sortOrder
        ),
      }));
      toast.success(editingGuideTipId ? "Dica atualizada." : "Dica criada.");
      resetGuideTipForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao guardar dica");
    } finally {
      setBusyKey(null);
    }
  };

  const handleVenueSubmit = async () => {
    if (!venueForm.name || !venueForm.description || !venueForm.capacity || !venueForm.floor) {
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
        venues: [...(editingVenueId ? current.venues.map((item) => (item.id === venue.id ? venue : item)) : [...current.venues, venue])].sort(
          (left, right) => left.sortOrder - right.sortOrder
        ),
      }));
      toast.success(editingVenueId ? "Local atualizado." : "Local criado.");
      resetVenueForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao guardar local");
    } finally {
      setBusyKey(null);
    }
  };

  const handleGuideStepDelete = async (id: number) => {
    setBusyKey(`guide-step-delete-${id}`);
    try {
      await api.guide.removeStep(id);
      setGuideContent((current) => ({ ...current, steps: current.steps.filter((item) => item.id !== id) }));
      if (editingGuideStepId === id) resetGuideStepForm();
      toast.success("Passo removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover passo");
    } finally {
      setBusyKey(null);
    }
  };

  const handleGuideTipDelete = async (id: number) => {
    setBusyKey(`guide-tip-delete-${id}`);
    try {
      await api.guide.removeTip(id);
      setGuideContent((current) => ({ ...current, tips: current.tips.filter((item) => item.id !== id) }));
      if (editingGuideTipId === id) resetGuideTipForm();
      toast.success("Dica removida.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover dica");
    } finally {
      setBusyKey(null);
    }
  };

  const handleVenueDelete = async (id: number) => {
    setBusyKey(`venue-delete-${id}`);
    try {
      await api.guide.removeVenue(id);
      setGuideContent((current) => ({ ...current, venues: current.venues.filter((item) => item.id !== id) }));
      if (editingVenueId === id) resetVenueForm();
      toast.success("Local removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover local");
    } finally {
      setBusyKey(null);
    }
  };

  const handleCourseSubmit = async () => {
    if (!courseForm.name || !courseForm.description || !courseForm.companyName || !courseForm.companyCategory || !courseForm.courseColor || !courseForm.accentColor || !courseForm.accentColorSecondary) {
      toast.error("Preenche os campos do curso");
      return;
    }

    setBusyKey("course");
    try {
      const payload = {
        ...courseForm,
        preview: normalizeOptionalText(courseForm.preview) || null,
        communityUrl: normalizeOptionalText(courseForm.communityUrl) || null,
        companyLogoUrl: normalizeOptionalText(courseForm.companyLogoUrl) || null,
        companyWebsite: normalizeOptionalText(courseForm.companyWebsite) || null,
        companyInstagram: normalizeOptionalText(courseForm.companyInstagram) || null,
        companyLinkedin: normalizeOptionalText(courseForm.companyLinkedin) || null,
        priceLabel: normalizeOptionalText(courseForm.priceLabel) || (courseForm.isPaid ? "Pago" : "Gratuito"),
      };
      const course = editingCourseId
        ? await api.courses.update(editingCourseId, payload)
        : await api.courses.create(payload);
      setCourses((current) =>
        [...(editingCourseId ? current.map((item) => (item.id === course.id ? course : item)) : [...current, course])].sort(
          (left, right) => left.sortOrder - right.sortOrder
        )
      );
      toast.success(editingCourseId ? "Curso atualizado." : "Curso criado.");
      resetCourseForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao guardar curso");
    } finally {
      setBusyKey(null);
    }
  };

  const handleCourseDelete = async (id: number) => {
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
      toast.success("Curso removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover curso");
    } finally {
      setBusyKey(null);
    }
  };

  const handlePanelTopicSubmit = async () => {
    if (!panelTopicForm.title || !panelTopicForm.description || !panelTopicForm.speaker || !panelTopicForm.time || !panelTopicForm.local || !panelTopicForm.day || !panelTopicForm.dateLabel || !panelTopicForm.icon || !panelTopicForm.type) {
      toast.error("Preenche os campos do painel");
      return;
    }

    setBusyKey("panel-topic");
    try {
      const panel = editingPanelTopicId
        ? await api.homeContent.updatePanel(editingPanelTopicId, panelTopicForm)
        : await api.homeContent.createPanel(panelTopicForm);
      setPanelTopics((current) =>
        [...(editingPanelTopicId ? current.map((item) => (item.id === panel.id ? panel : item)) : [...current, panel])].sort(
          (left, right) => left.sortOrder - right.sortOrder
        )
      );
      toast.success(editingPanelTopicId ? "Painel atualizado." : "Painel criado.");
      resetPanelTopicForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao guardar painel");
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
      toast.error(error instanceof Error ? error.message : "Falha ao remover painel");
    } finally {
      setBusyKey(null);
    }
  };

  const handleSocialConfigSave = async () => {
    setBusyKey("social-config");
    try {
      const saved = await api.homeContent.updateSocialConfig({
        instagramUrl: normalizeOptionalText(socialConfigForm.instagramUrl) || null,
        facebookUrl: normalizeOptionalText(socialConfigForm.facebookUrl) || null,
        linkedinUrl: normalizeOptionalText(socialConfigForm.linkedinUrl) || null,
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
        heroBadgeText: socialConfigForm.heroBadgeText,
        heroTitlePrefix: socialConfigForm.heroTitlePrefix,
        heroTitleHighlight: socialConfigForm.heroTitleHighlight,
        heroSubtitleText: socialConfigForm.heroSubtitleText,
        heroSubtitleColor: socialConfigForm.heroSubtitleColor,
        heroTitleMobileSize: socialConfigForm.heroTitleMobileSize,
        heroTitleTabletSize: socialConfigForm.heroTitleTabletSize,
        heroTitleDesktopSize: socialConfigForm.heroTitleDesktopSize,
        heroSubtitleMobileSize: socialConfigForm.heroSubtitleMobileSize,
        heroSubtitleTabletSize: socialConfigForm.heroSubtitleTabletSize,
        heroSubtitleDesktopSize: socialConfigForm.heroSubtitleDesktopSize,
        heroFloatingIcons: socialConfigForm.heroFloatingIcons,
        sponsors: socialConfigForm.sponsors,
      });

      setSocialConfigForm(toSocialConfigForm(saved));
      toast.success("Hero, patrocinadores e identidade visual atualizados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao guardar configurações do evento");
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
      applyVoteSnapshot(
        {
          projects: snapshot.projects.items,
          votes: snapshot.votes.items,
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
        }
      );
      toast.success("Votação sincronizada com o banco de dados.");
    } catch (error) {
      if (!handleAdminAuthFailure(error)) {
        toast.error(error instanceof Error ? error.message : "Falha ao atualizar votação");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const sortedAgenda = [...schedule].sort(
    (left, right) =>
      new Date(`${left.date.slice(0, 10)}T${left.startTime}:00`).getTime() -
      new Date(`${right.date.slice(0, 10)}T${right.startTime}:00`).getTime()
  );

  return (
    <div className="min-h-screen bg-background">
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
            <AlertDialogCancel disabled={isRemovingStudent}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemovingStudent || !studentPendingRemoval}
              onClick={(event) => {
                event.preventDefault();
                if (studentPendingRemoval) void handleRemoveStudent(studentPendingRemoval);
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
            <AlertDialogCancel disabled={isRemovingSubmission}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRemovingSubmission || !submissionPendingRemoval}
              onClick={(event) => {
                event.preventDefault();
                if (submissionPendingRemoval) void handleRemoveSubmission(submissionPendingRemoval);
              }}
            >
              {isRemovingSubmission ? "A eliminar..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="sticky top-16 z-30 border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <Shield className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-bold">Painel Administrativo</h1>
                <p className="text-xs text-muted-foreground">Gestão e configuração do evento</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="rounded-xl bg-[#0A3D62] text-white hover:bg-[#082f4b]">
                <Link to="/">Ver portal público</Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            {/* Gradient fade left - mostra que há conteúdo à esquerda */}
            {showLeftGradient && (
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-20 bg-gradient-to-r from-card via-card to-transparent" />
            )}

            {/* Tabs scroll container com padding responsivo */}
            <div
              ref={tabsScrollRef}
              onScroll={handleTabsScroll}
              className="flex gap-1 sm:gap-1.5 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
            >
              {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`flex min-w-max flex-shrink-0 items-center gap-1 sm:gap-1.5 whitespace-nowrap rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all snap-start ${
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                  {tab.label}
                </button>
              );
            })}
            </div>

            {/* Gradient fade right - mostra que há conteúdo à direita */}
            {showRightGradient && (
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-20 bg-gradient-to-l from-card via-card to-transparent" />
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {loading ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              A carregar dados do banco de dados...
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {activeTab === "overview" && (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-heading text-xl font-bold">Visão Geral Administrativa</h2>
                      <p className="text-sm text-muted-foreground">Resumo consolidado da plataforma com opção única de exportação.</p>
                    </div>
                    <Button onClick={() => void handleExportOverviewReport()} disabled={exportingReport}>
                      {exportingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      Exportar relatório
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                    <StatCard icon={FolderOpen} label="Candidaturas" value={stats.total} color="bg-primary/10 text-primary" />
                    <StatCard icon={AlertTriangle} label="Pendentes" value={stats.pendentes} color="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]" />
                    <StatCard icon={CheckCircle} label="Aprovados" value={stats.aprovados} color="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" />
                    <StatCard icon={XCircle} label="Recusados" value={stats.recusados} color="bg-destructive/10 text-destructive" />
                    <StatCard icon={ThumbsUp} label="Votos" value={stats.totalVotos} color="bg-[hsl(var(--area-iot))]/10 text-[hsl(var(--area-iot))]" />
                    <StatCard icon={Users} label="Estudantes" value={stats.totalEstudantes} color="bg-[hsl(var(--area-web))]/10 text-[hsl(var(--area-web))]" />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Award className="h-4 w-4 text-primary" />
                          Top Projetos
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {rankedProjects.slice(0, 5).map((project, index) => {
                          const Icon = tipoIcons[project.tipo];
                          return (
                            <div key={project.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
                              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${index < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                {index + 1}
                              </span>
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="flex-1 text-sm font-medium">{project.nome}</span>
                              {project.isWinner && <Crown className="h-4 w-4 text-[hsl(var(--warning))]" />}
                              <span className="text-xs text-muted-foreground">{project.votos} votos</span>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Users className="h-4 w-4 text-primary" />
                          Estudantes Mais Ativos
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {rankedStudents.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                            Dados de estudantes ainda não carregados. Abre a aba "Estudantes" para sincronizar.
                          </div>
                        ) : (
                          rankedStudents.slice(0, 5).map((student, index) => (
                            <div key={student.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
                              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${index < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                {index + 1}
                              </span>
                              <span className="flex-1 text-sm font-medium">{student.name || `Estudante ${student.studentNumber}`}</span>
                              <span className="text-xs text-muted-foreground">{studentInteractions(student)} interações</span>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              {activeTab === "analytics" && (
                <Suspense fallback={<AdminPanelFallback label="Analytics" />}>
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

              {activeTab === "sms" && (
                <Suspense fallback={<AdminPanelFallback label="SMS" />}>
                  <AdminSmsTab courses={courses} />
                </Suspense>
              )}

              {activeTab === "jury" && (
                <Suspense fallback={<AdminPanelFallback label="Júri" />}>
                  <AdminJuryTab />
                </Suspense>
              )}

              {activeTab === "attendance" && (
                <Suspense fallback={<AdminPanelFallback label="Check-in" />}>
                  <AdminAttendanceTab />
                </Suspense>
              )}

              {activeTab === "certificates" && (
                <Suspense fallback={<AdminPanelFallback label="Certificados" />}>
                  <AdminCertificatesTab />
                </Suspense>
              )}

              {activeTab === "audit" && (
                <Suspense fallback={<AdminPanelFallback label="Auditoria" />}>
                  <AdminAuditTab />
                </Suspense>
              )}

              {activeTab === "submissions" && (
                <>
                  <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                    <Card className="border-border/60">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Shield className="h-4 w-4 text-primary" />
                          Estado das Candidaturas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className={`rounded-2xl border p-4 ${submissionConfig.isOpen ? "border-primary/20 bg-primary/5" : "border-destructive/20 bg-destructive/5"}`}>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                          <p className={`mt-2 font-heading text-xl font-bold ${submissionConfig.isOpen ? "text-primary" : "text-destructive"}`}>
                            {submissionConfig.isOpen ? "Candidaturas abertas" : "Candidaturas fechadas"}
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Este cartão controla se os estudantes podem ou não enviar candidaturas no site.
                          </p>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">Permitir novas candidaturas</p>
                            <p className="text-xs text-muted-foreground">Ativa ou desativa o formulário público.</p>
                          </div>
                          <Switch checked={submissionConfig.isOpen} onCheckedChange={(checked) => setSubmissionConfig((current) => ({ ...current, isOpen: checked }))} />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Configuração de Pagamento</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-4 md:grid-cols-2">
                        <FormField label="IBAN">
                          <Input value={submissionConfig.iban} onChange={(event) => setSubmissionConfig((current) => ({ ...current, iban: event.target.value }))} />
                        </FormField>
                        <FormField label="Nome da conta">
                          <Input value={submissionConfig.accountName} onChange={(event) => setSubmissionConfig((current) => ({ ...current, accountName: event.target.value }))} />
                        </FormField>
                        <FormField label="Valor">
                          <Input value={submissionConfig.paymentAmount} onChange={(event) => setSubmissionConfig((current) => ({ ...current, paymentAmount: event.target.value }))} />
                        </FormField>
                        <FormField label="Instruções">
                          <Textarea value={normalizeOptionalText(submissionConfig.paymentInstructions)} onChange={(event) => setSubmissionConfig((current) => ({ ...current, paymentInstructions: event.target.value }))} className="min-h-24" />
                        </FormField>
                        <FormField label="Comunidade de Projetos">
                          <Input value={normalizeOptionalText(submissionConfig.projectCommunityUrl)} onChange={(event) => setSubmissionConfig((current) => ({ ...current, projectCommunityUrl: event.target.value }))} placeholder="https://chat.whatsapp.com/..." />
                        </FormField>
                        <FormField label="Comunidade de Negócios">
                          <Input value={normalizeOptionalText(submissionConfig.businessCommunityUrl)} onChange={(event) => setSubmissionConfig((current) => ({ ...current, businessCommunityUrl: event.target.value }))} placeholder="https://chat.whatsapp.com/..." />
                        </FormField>
                        <FormField label="Comunidade de Produtos">
                          <Input value={normalizeOptionalText(submissionConfig.productCommunityUrl)} onChange={(event) => setSubmissionConfig((current) => ({ ...current, productCommunityUrl: event.target.value }))} placeholder="https://chat.whatsapp.com/..." />
                        </FormField>
                        <div className="md:col-span-2">
                          <Button onClick={() => void handleSubmissionConfigSave()} disabled={busyKey === "submission-config"}>
                            Guardar configuração de candidatura
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="surface-card p-4 sm:p-5">
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_repeat(2,minmax(180px,220px))]">
                      <div className="relative min-w-0">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          placeholder="Pesquisar por nome, número de inscrição, curso ou contacto..."
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                        />
                      </div>
                      <select
                        className="touch-safe h-11 rounded-2xl border border-input/80 bg-white/80 px-4 text-sm shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-primary/25 hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring/25"
                        value={submissionSortBy}
                        onChange={(event) => setSubmissionSortBy(event.target.value as typeof submissionSortBy)}
                      >
                        <option value="recentes">Mais recentes</option>
                        <option value="nome">Nome A-Z</option>
                        <option value="inscricao">Número de inscrição</option>
                        <option value="curso">Curso</option>
                      </select>
                      <select
                        className="touch-safe h-11 rounded-2xl border border-input/80 bg-white/80 px-4 text-sm shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-primary/25 hover:bg-white focus:outline-none focus:ring-2 focus:ring-ring/25"
                        value={submissionPageSize}
                        onChange={(event) => setSubmissionPageSize(Number(event.target.value))}
                      >
                        <option value={10}>10 por página</option>
                        <option value={20}>20 por página</option>
                        <option value={50}>50 por página</option>
                      </select>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                      <div className="min-w-0 rounded-[24px] border border-border/60 bg-muted/15 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Estado</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {["todos", "pendente", "aprovado", "recusado"].map((status) => (
                            <Button key={status} size="sm" variant={filterStatus === status ? "default" : "outline"} onClick={() => setFilterStatus(status)} className="capitalize">
                              {status}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="min-w-0 rounded-[24px] border border-border/60 bg-muted/15 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tipo</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {["todos", "projeto", "negocio", "produto"].map((tipo) => (
                            <Button key={tipo} size="sm" variant={filterTipo === tipo ? "default" : "outline"} onClick={() => setFilterTipo(tipo)} className="capitalize">
                              {tipo === "todos" ? "Todos os tipos" : tipo}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    {loadingSubmissionsList
                      ? "A carregar candidaturas..."
                      : submissionsTotal === 0
                        ? "Nenhuma candidatura encontrada."
                        : `${submissionsTotal} candidatura(s) encontrada(s).`}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card className="border-border/60">
                      <CardContent className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Expositores</p>
                        <p className="mt-3 font-heading text-3xl font-bold">{economicSummary.exhibitorCount}</p>
                        <p className="mt-2 text-sm text-muted-foreground">Projetos, negócios e produtos submetidos.</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/60">
                      <CardContent className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Valor unitário</p>
                        <p className="mt-3 font-heading text-3xl font-bold">{submissionConfig.paymentAmount}</p>
                        <p className="mt-2 text-sm text-muted-foreground">Montante configurado por candidatura.</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/60">
                      <CardContent className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Receita prevista</p>
                        <p className="mt-3 font-heading text-3xl font-bold">{formatCurrencyValue(economicSummary.projectedRevenue)}</p>
                        <p className="mt-2 text-sm text-muted-foreground">Baseado no total de expositores submetidos.</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/60">
                      <CardContent className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Receita aprovada</p>
                        <p className="mt-3 font-heading text-3xl font-bold">{formatCurrencyValue(economicSummary.approvedRevenue)}</p>
                        <p className="mt-2 text-sm text-muted-foreground">Baseado apenas nas candidaturas aprovadas.</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-border/60">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Wallet className="h-4 w-4 text-primary" />
                        Balanço Económico
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Projetos</p>
                        <p className="mt-2 text-2xl font-bold">{economicSummary.projectCount}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Negócios</p>
                        <p className="mt-2 text-2xl font-bold">{economicSummary.businessCount}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Produtos</p>
                        <p className="mt-2 text-2xl font-bold">{economicSummary.productCount}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Aprovadas</p>
                        <p className="mt-2 text-2xl font-bold">{economicSummary.approvedCount}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    {paginatedSubmissions.items.map((submission) => {
                      const Icon = tipoIcons[submission.tipo];
                      const whatsappUrl = whatsappLink(submission.telefone);
                      const communityUrl = communityUrlBySubmissionType(submission.tipo, submissionConfig);
                      const bannerPreview = resolveSubmissionBannerPreview(submission);
                      const canManageBanner = submission.status === "aprovado";
                      return (
                        <Card key={submission.id} className="min-w-0 border-border/60">
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex flex-1 items-start gap-3">
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${tipoBadgeColors[submission.tipo]}`}>
                                    <Icon className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="safe-break text-base font-semibold">{submission.nome}</p>
                                      {submission.isWinner && <Crown className="h-4 w-4 text-[hsl(var(--warning))]" />}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">{submission.referenceCode} · {formatDateLabel(submission.data)}</p>
                                    <p className="safe-break mt-3 text-sm leading-6 text-muted-foreground">{submission.descricao}</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className={tipoBadgeColors[submission.tipo]}>{submission.tipo}</Badge>
                                  <Badge variant="outline" className={statusColors[submission.status]}>{submission.status}</Badge>
                                  <Badge variant="outline">{submission.canVote ? "Votação + prémio" : "Exposição"}</Badge>
                                </div>
                              </div>

                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Número de inscrição</p>
                                  <p className="mt-2 text-sm font-medium">{submission.referenceCode}</p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Área</p>
                                  <p className="safe-break mt-2 text-sm font-medium">{submission.area}</p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Curso</p>
                                  <p className="safe-break mt-2 text-sm font-medium">{submission.curso}</p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Grupo</p>
                                  <p className="safe-break mt-2 text-sm font-medium">{submission.equipa || "Sem equipa"}</p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Responsável</p>
                                  <p className="safe-break mt-2 text-sm font-medium">{submission.responsavel}</p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">WhatsApp</p>
                                  <p className="safe-break mt-2 text-sm font-medium">{submission.telefone || "Sem número"}</p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Valor base</p>
                                  <p className="mt-2 text-sm font-medium">{submissionConfig.paymentAmount}</p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-muted/20 p-3 xl:col-span-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Necessidades técnicas</p>
                                  <p className="safe-break mt-2 text-sm font-medium">
                                    {submission.necessidades.length > 0 ? submission.necessidades.join(", ") : "Sem necessidades adicionais"}
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border/70 bg-muted/20 p-3 xl:col-span-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Observações</p>
                                  <p className="safe-break mt-2 whitespace-pre-wrap text-sm font-medium">
                                    {submission.observacoes || "Sem observações adicionais"}
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-border/70 bg-muted/10 p-3">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Capa do card do expositor
                                  </p>
                                  <Badge variant="outline" className={canManageBanner ? "border-[hsl(var(--success))]/30 text-[hsl(var(--success))]" : ""}>
                                    {canManageBanner ? "Edição disponível" : "Disponível após aprovação"}
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
                                      style={{ background: submissionCoverGradient(submission) }}
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
                                      void handleSubmissionBannerFile(submission, event.target.files?.[0] ?? null);
                                      event.currentTarget.value = "";
                                    }}
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!canManageBanner || busyKey === `submission-banner-save-${submission.id}`}
                                    onClick={() => void handleSubmissionBannerSave(submission)}
                                  >
                                    {busyKey === `submission-banner-save-${submission.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                                    Guardar capa
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={!canManageBanner || !bannerPreview || busyKey === `submission-banner-remove-${submission.id}`}
                                    onClick={() => void handleSubmissionBannerRemove(submission)}
                                  >
                                    {busyKey === `submission-banner-remove-${submission.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                                    Remover foto
                                  </Button>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <Button asChild size="sm" variant="outline" className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight">
                                  <Link to={submission.detailPath}>
                                    <Eye className="mr-1 h-3.5 w-3.5" />
                                    Ver página
                                  </Link>
                                </Button>
                                {whatsappUrl ? (
                                  <Button size="sm" variant="outline" asChild className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight">
                                    <a href={whatsappUrl} target="_blank" rel="noreferrer noopener">
                                      <MessageSquare className="mr-1 h-3.5 w-3.5" />
                                      Contactar no WhatsApp
                                    </a>
                                  </Button>
                                ) : null}
                                {communityUrl ? (
                                  <Button size="sm" variant="outline" asChild className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight">
                                    <a href={communityUrl} target="_blank" rel="noreferrer noopener">
                                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                      Abrir comunidade
                                    </a>
                                  </Button>
                                ) : null}
                                {submission.status === "pendente" && (
                                  <>
                                    <Button size="sm" className="h-auto whitespace-normal bg-[hsl(var(--success))] px-2.5 py-1.5 text-xs leading-tight text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]/90" onClick={() => void handleStatusChange(submission.id, "aprovado")}>
                                      <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                      Aprovar
                                    </Button>
                                    <Button size="sm" variant="destructive" className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight" onClick={() => void handleStatusChange(submission.id, "recusado")}>
                                      <XCircle className="mr-1 h-3.5 w-3.5" />
                                      Recusar
                                    </Button>
                                  </>
                                )}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-auto whitespace-normal px-2.5 py-1.5 text-xs leading-tight"
                                  onClick={() => setSubmissionPendingRemoval(submission)}
                                  disabled={isRemovingSubmission && submissionPendingRemoval?.id === submission.id}
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
                      Página {paginatedSubmissions.currentPage} de {paginatedSubmissions.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSubmissionPage((current) => Math.max(1, current - 1))} disabled={loadingSubmissionsList || paginatedSubmissions.currentPage <= 1}>
                        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                        Anterior
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSubmissionPage((current) => Math.min(paginatedSubmissions.totalPages, current + 1))} disabled={loadingSubmissionsList || paginatedSubmissions.currentPage >= paginatedSubmissions.totalPages}>
                        Próximo
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "speakers" && (
                <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{editingSpeakerId ? "Editar palestrante" : "Novo palestrante"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField label="Nome">
                        <Input value={speakerForm.name} onChange={(event) => setSpeakerForm((current) => ({ ...current, name: event.target.value }))} />
                      </FormField>
                      <FormField label="Especialidade">
                        <Input value={speakerForm.specialty} onChange={(event) => setSpeakerForm((current) => ({ ...current, specialty: event.target.value }))} />
                      </FormField>
                      <FormField label="Palestra">
                        <Input value={speakerForm.talk} onChange={(event) => setSpeakerForm((current) => ({ ...current, talk: event.target.value }))} />
                      </FormField>
                      <FormField label="Dia / horário">
                        <Input value={speakerForm.day} onChange={(event) => setSpeakerForm((current) => ({ ...current, day: event.target.value }))} placeholder="Dia 1 — 09:30" />
                      </FormField>
                      <FormField label="LinkedIn">
                        <Input value={speakerForm.linkedin} onChange={(event) => setSpeakerForm((current) => ({ ...current, linkedin: event.target.value }))} />
                      </FormField>
                      <FormField label="Avatar URL">
                        <Input value={normalizeOptionalText(speakerForm.avatarUrl)} onChange={(event) => setSpeakerForm((current) => ({ ...current, avatarUrl: event.target.value }))} />
                      </FormField>
                      <FormField label="Bio">
                        <Textarea value={speakerForm.bio} onChange={(event) => setSpeakerForm((current) => ({ ...current, bio: event.target.value }))} className="min-h-28" />
                      </FormField>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => void handleSpeakerSubmit()} disabled={busyKey === "speaker"}>
                          {editingSpeakerId ? "Atualizar" : "Criar"} palestrante
                        </Button>
                        {editingSpeakerId && <Button variant="outline" onClick={resetSpeakerForm}>Cancelar edição</Button>}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-3 md:grid-cols-2">
                    {speakers.map((speaker) => (
                      <Card key={speaker.id} className="border-border/60">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{speaker.name}</p>
                              <p className="text-xs font-medium text-primary">{speaker.specialty}</p>
                            </div>
                            <Badge variant="outline">{speaker.day}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{speaker.bio}</p>
                          <p className="text-xs text-muted-foreground">{speaker.talk}</p>
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
                            <Button size="sm" variant="destructive" onClick={() => void handleSpeakerDelete(speaker.id)} disabled={busyKey === `speaker-delete-${speaker.id}`}>
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

              {activeTab === "schedule" && (
                <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{editingScheduleId ? "Editar sessão" : "Nova sessão"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Dia">
                          <select
                            value={scheduleForm.day}
                            onChange={(event) => setScheduleForm((current) => ({ ...current, day: event.target.value as AgendaInput["day"] }))}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="DAY1">Dia 1</option>
                            <option value="DAY2">Dia 2</option>
                          </select>
                        </FormField>
                        <FormField label="Data">
                          <Input type="date" value={scheduleForm.date} onChange={(event) => setScheduleForm((current) => ({ ...current, date: event.target.value }))} />
                        </FormField>
                        <FormField label="Hora inicial">
                          <Input type="time" value={scheduleForm.startTime} onChange={(event) => setScheduleForm((current) => ({ ...current, startTime: event.target.value }))} />
                        </FormField>
                        <FormField label="Hora final">
                          <Input type="time" value={scheduleForm.endTime} onChange={(event) => setScheduleForm((current) => ({ ...current, endTime: event.target.value }))} />
                        </FormField>
                        <FormField label="Tipo">
                          <select
                            value={scheduleForm.type}
                            onChange={(event) => setScheduleForm((current) => ({ ...current, type: event.target.value as AgendaInput["type"] }))}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="PANEL">Painel</option>
                            <option value="WORKSHOP">Workshop</option>
                            <option value="PRESENTATION">Apresentação</option>
                            <option value="CEREMONY">Cerimónia</option>
                            <option value="BREAK">Intervalo</option>
                          </select>
                        </FormField>
                        <FormField label="Tema">
                          <Input value={scheduleForm.theme} onChange={(event) => setScheduleForm((current) => ({ ...current, theme: event.target.value }))} />
                        </FormField>
                      </div>
                      <FormField label="Título">
                        <Input value={scheduleForm.title} onChange={(event) => setScheduleForm((current) => ({ ...current, title: event.target.value }))} />
                      </FormField>
                      <FormField label="Local">
                        <Input value={scheduleForm.local} onChange={(event) => setScheduleForm((current) => ({ ...current, local: event.target.value }))} />
                      </FormField>
                      <FormField label="Orador / responsável">
                        <Input value={scheduleForm.speaker} onChange={(event) => setScheduleForm((current) => ({ ...current, speaker: event.target.value }))} />
                      </FormField>
                      <FormField label="Descrição">
                        <Textarea value={scheduleForm.description} onChange={(event) => setScheduleForm((current) => ({ ...current, description: event.target.value }))} className="min-h-28" />
                      </FormField>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => void handleAgendaSubmit()} disabled={busyKey === "agenda"}>
                          {editingScheduleId ? "Atualizar" : "Criar"} sessão
                        </Button>
                        {editingScheduleId && <Button variant="outline" onClick={resetScheduleForm}>Cancelar edição</Button>}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    {sortedAgenda.map((item) => (
                      <Card key={item.id} className="border-border/60">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center">
                            <div className="w-20 text-center">
                              <p className="text-xs font-bold text-primary">{item.startTime}</p>
                              <p className="text-[11px] text-muted-foreground">{item.endTime}</p>
                            </div>
                            <div className="hidden h-10 w-px bg-border md:block" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.local} · {formatAgendaDay(item.day)} · {formatDateLabel(item.date)}</p>
                              <p className="text-xs text-muted-foreground">{item.theme}</p>
                            </div>
                            <Badge variant="outline">{formatAgendaType(item.type)}</Badge>
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
                            <Button size="sm" variant="destructive" onClick={() => void handleAgendaDelete(item.id)} disabled={busyKey === `agenda-delete-${item.id}`}>
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
                        <CardTitle className="text-base">{editingGuideStepId ? "Editar passo" : "Novo passo do guia"}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField label="Título">
                          <Input value={guideStepForm.title} onChange={(event) => setGuideStepForm((current) => ({ ...current, title: event.target.value }))} />
                        </FormField>
                        <FormField label="Descrição">
                          <Textarea value={guideStepForm.description} onChange={(event) => setGuideStepForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24" />
                        </FormField>
                        <FormField label="Ícone">
                          <select
                            value={guideStepForm.icon}
                            onChange={(event) => setGuideStepForm((current) => ({ ...current, icon: event.target.value }))}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            {guideIconOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </FormField>
                        <FormField label="Link">
                          <Input value={normalizeOptionalText(guideStepForm.link)} onChange={(event) => setGuideStepForm((current) => ({ ...current, link: event.target.value }))} />
                        </FormField>
                        <FormField label="Texto do link">
                          <Input value={normalizeOptionalText(guideStepForm.linkText)} onChange={(event) => setGuideStepForm((current) => ({ ...current, linkText: event.target.value }))} />
                        </FormField>
                        <FormField label="Ordem">
                          <Input type="number" value={guideStepForm.sortOrder ?? 0} onChange={(event) => setGuideStepForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
                        </FormField>
                        <div className="flex items-center justify-between rounded-lg border border-border p-3">
                          <span className="text-sm">Publicado</span>
                          <Switch checked={guideStepForm.isPublished ?? true} onCheckedChange={(checked) => setGuideStepForm((current) => ({ ...current, isPublished: checked }))} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => void handleGuideStepSubmit()} disabled={busyKey === "guide-step"}>{editingGuideStepId ? "Atualizar" : "Criar"} passo</Button>
                          {editingGuideStepId && <Button variant="outline" onClick={resetGuideStepForm}>Cancelar</Button>}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{editingGuideTipId ? "Editar dica" : "Nova dica"}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField label="Conteúdo">
                          <Textarea value={guideTipForm.content} onChange={(event) => setGuideTipForm((current) => ({ ...current, content: event.target.value }))} className="min-h-28" />
                        </FormField>
                        <FormField label="Ordem">
                          <Input type="number" value={guideTipForm.sortOrder ?? 0} onChange={(event) => setGuideTipForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
                        </FormField>
                        <div className="flex items-center justify-between rounded-lg border border-border p-3">
                          <span className="text-sm">Publicado</span>
                          <Switch checked={guideTipForm.isPublished ?? true} onCheckedChange={(checked) => setGuideTipForm((current) => ({ ...current, isPublished: checked }))} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => void handleGuideTipSubmit()} disabled={busyKey === "guide-tip"}>{editingGuideTipId ? "Atualizar" : "Criar"} dica</Button>
                          {editingGuideTipId && <Button variant="outline" onClick={resetGuideTipForm}>Cancelar</Button>}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{editingVenueId ? "Editar local" : "Novo local"}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField label="Nome">
                          <Input value={venueForm.name} onChange={(event) => setVenueForm((current) => ({ ...current, name: event.target.value }))} />
                        </FormField>
                        <FormField label="Descrição">
                          <Textarea value={venueForm.description} onChange={(event) => setVenueForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24" />
                        </FormField>
                        <FormField label="Capacidade">
                          <Input value={venueForm.capacity} onChange={(event) => setVenueForm((current) => ({ ...current, capacity: event.target.value }))} />
                        </FormField>
                        <FormField label="Piso">
                          <Input value={venueForm.floor} onChange={(event) => setVenueForm((current) => ({ ...current, floor: event.target.value }))} />
                        </FormField>
                        <FormField label="Ordem">
                          <Input type="number" value={venueForm.sortOrder ?? 0} onChange={(event) => setVenueForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
                        </FormField>
                        <div className="flex items-center justify-between rounded-lg border border-border p-3">
                          <span className="text-sm">Publicado</span>
                          <Switch checked={venueForm.isPublished ?? true} onCheckedChange={(checked) => setVenueForm((current) => ({ ...current, isPublished: checked }))} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => void handleVenueSubmit()} disabled={busyKey === "venue"}>{editingVenueId ? "Atualizar" : "Criar"} local</Button>
                          {editingVenueId && <Button variant="outline" onClick={resetVenueForm}>Cancelar</Button>}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-3">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Passos do guia</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {guideContent.steps.map((step) => (
                          <div key={step.id} className="rounded-xl border border-border p-3">
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium">{step.title}</p>
                                <p className="text-xs text-muted-foreground">{step.icon} · ordem {step.sortOrder}</p>
                              </div>
                              <Badge variant="outline">{step.isPublished ? "Publicado" : "Rascunho"}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => {
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
                              }}>
                                <Edit className="mr-1 h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => void handleGuideStepDelete(step.id)} disabled={busyKey === `guide-step-delete-${step.id}`}>
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
                        <CardTitle className="text-base">Dicas úteis</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {guideContent.tips.map((tip) => (
                          <div key={tip.id} className="rounded-xl border border-border p-3">
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <p className="text-sm font-medium">Ordem {tip.sortOrder}</p>
                              <Badge variant="outline">{tip.isPublished ? "Publicado" : "Rascunho"}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{tip.content}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => {
                                setEditingGuideTipId(tip.id);
                                setGuideTipForm({ content: tip.content, sortOrder: tip.sortOrder, isPublished: tip.isPublished });
                              }}>
                                <Edit className="mr-1 h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => void handleGuideTipDelete(tip.id)} disabled={busyKey === `guide-tip-delete-${tip.id}`}>
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
                        <CardTitle className="text-base">Locais do evento</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {guideContent.venues.map((venue) => (
                          <div key={venue.id} className="rounded-xl border border-border p-3">
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium">{venue.name}</p>
                                <p className="text-xs text-muted-foreground">{venue.capacity} · {venue.floor}</p>
                              </div>
                              <Badge variant="outline">{venue.isPublished ? "Publicado" : "Rascunho"}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{venue.description}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => {
                                setEditingVenueId(venue.id);
                                setVenueForm({
                                  name: venue.name,
                                  description: venue.description,
                                  capacity: venue.capacity,
                                  floor: venue.floor,
                                  sortOrder: venue.sortOrder,
                                  isPublished: venue.isPublished,
                                });
                              }}>
                                <Edit className="mr-1 h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => void handleVenueDelete(venue.id)} disabled={busyKey === `venue-delete-${venue.id}`}>
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
                <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{editingCourseId ? "Editar curso" : "Novo curso"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField label="Nome">
                        <Input value={courseForm.name} onChange={(event) => setCourseForm((current) => ({ ...current, name: event.target.value }))} />
                      </FormField>
                      <FormField label="Descrição">
                        <Textarea value={courseForm.description} onChange={(event) => setCourseForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24" />
                      </FormField>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Empresa gestora">
                          <Input value={courseForm.companyName} onChange={(event) => setCourseForm((current) => ({ ...current, companyName: event.target.value }))} />
                        </FormField>
                        <FormField label="Categoria da empresa">
                          <Input value={courseForm.companyCategory} onChange={(event) => setCourseForm((current) => ({ ...current, companyCategory: event.target.value }))} />
                        </FormField>
                        <FormField label="Logotipo da empresa">
                          <Input value={normalizeOptionalText(courseForm.companyLogoUrl)} onChange={(event) => setCourseForm((current) => ({ ...current, companyLogoUrl: event.target.value }))} placeholder="https://..." />
                        </FormField>
                        <FormField label="Comunidade WhatsApp">
                          <Input value={normalizeOptionalText(courseForm.communityUrl)} onChange={(event) => setCourseForm((current) => ({ ...current, communityUrl: event.target.value }))} placeholder="https://chat.whatsapp.com/..." />
                        </FormField>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Prévia curta">
                          <Input value={normalizeOptionalText(courseForm.preview)} onChange={(event) => setCourseForm((current) => ({ ...current, preview: event.target.value }))} />
                        </FormField>
                        <FormField label="Website da empresa">
                          <Input value={normalizeOptionalText(courseForm.companyWebsite)} onChange={(event) => setCourseForm((current) => ({ ...current, companyWebsite: event.target.value }))} placeholder="https://..." />
                        </FormField>
                        <FormField label="Instagram">
                          <Input value={normalizeOptionalText(courseForm.companyInstagram)} onChange={(event) => setCourseForm((current) => ({ ...current, companyInstagram: event.target.value }))} placeholder="https://instagram.com/..." />
                        </FormField>
                        <FormField label="LinkedIn">
                          <Input value={normalizeOptionalText(courseForm.companyLinkedin)} onChange={(event) => setCourseForm((current) => ({ ...current, companyLinkedin: event.target.value }))} placeholder="https://linkedin.com/..." />
                        </FormField>
                        <FormField label="Preço / rótulo">
                          <Input value={normalizeOptionalText(courseForm.priceLabel)} onChange={(event) => setCourseForm((current) => ({ ...current, priceLabel: event.target.value }))} placeholder="Gratuito ou 15.000 Kz" />
                        </FormField>
                        <FormField label="Ordem">
                          <Input type="number" value={courseForm.sortOrder ?? 0} onChange={(event) => setCourseForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
                        </FormField>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <FormField label="Gradiente inicial">
                          <div className="flex items-center gap-3">
                            <Input type="color" value={courseForm.accentColor} onChange={(event) => setCourseForm((current) => ({ ...current, accentColor: event.target.value }))} className="h-10 w-16 p-1" />
                            <Input value={courseForm.accentColor} onChange={(event) => setCourseForm((current) => ({ ...current, accentColor: event.target.value }))} />
                          </div>
                        </FormField>
                        <FormField label="Gradiente final">
                          <div className="flex items-center gap-3">
                            <Input type="color" value={courseForm.accentColorSecondary} onChange={(event) => setCourseForm((current) => ({ ...current, accentColorSecondary: event.target.value }))} className="h-10 w-16 p-1" />
                            <Input value={courseForm.accentColorSecondary} onChange={(event) => setCourseForm((current) => ({ ...current, accentColorSecondary: event.target.value }))} />
                          </div>
                        </FormField>
                        <FormField label="Cor do curso">
                          <div className="flex items-center gap-3">
                            <Input type="color" value={courseForm.courseColor} onChange={(event) => setCourseForm((current) => ({ ...current, courseColor: event.target.value }))} className="h-10 w-16 p-1" />
                            <Input value={courseForm.courseColor} onChange={(event) => setCourseForm((current) => ({ ...current, courseColor: event.target.value }))} />
                          </div>
                        </FormField>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border p-3">
                        <span className="text-sm">Curso pago</span>
                        <Switch checked={courseForm.isPaid ?? false} onCheckedChange={(checked) => setCourseForm((current) => ({ ...current, isPaid: checked, priceLabel: checked ? current.priceLabel || "Pago" : "Gratuito" }))} />
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border p-3">
                        <span className="text-sm">Publicado</span>
                        <Switch checked={courseForm.isPublished ?? true} onCheckedChange={(checked) => setCourseForm((current) => ({ ...current, isPublished: checked }))} />
                      </div>
                      <div className="rounded-xl border border-border/70 p-4" style={{ background: `linear-gradient(135deg, ${courseForm.accentColor}22, ${courseForm.accentColorSecondary}22)` }}>
                        <p className="text-sm font-semibold" style={{ color: courseForm.courseColor }}>Prévia da identidade do curso</p>
                        <p className="text-xs text-muted-foreground mt-1">{courseForm.companyName || "Empresa"} · {courseForm.companyCategory || "Categoria"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => void handleCourseSubmit()} disabled={busyKey === "course"}>{editingCourseId ? "Atualizar" : "Criar"} curso</Button>
                        {editingCourseId && <Button variant="outline" onClick={resetCourseForm}>Cancelar</Button>}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    {courses.map((course) => (
                      <Card key={course.id} className="border-border/60">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{course.name}</p>
                              <p className="text-xs text-muted-foreground">{course.companyName} · {course.companyCategory}</p>
                              <p className="text-xs text-muted-foreground">Ordem {course.sortOrder} · {course.studentCount} inscritos · {course.likesCount} curtidas</p>
                            </div>
                            <Badge variant="outline">{course.isPublished ? "Publicado" : "Rascunho"}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{course.description}</p>
                          {course.preview && <p className="text-xs text-muted-foreground">{course.preview}</p>}
                          <div className="rounded-xl border border-border/60 p-3" style={{ background: `linear-gradient(135deg, ${course.accentColor}22, ${course.accentColorSecondary}22)` }}>
                            <p className="text-xs font-semibold" style={{ color: course.courseColor }}>{course.isPaid ? course.priceLabel || "Pago" : "Gratuito"}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">{course.communityUrl || "Comunidade não definida"}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <span>{course.companyWebsite || "Sem website"}</span>
                            <span>{course.companyInstagram || "Sem Instagram"}</span>
                            <span>{course.companyLinkedin || "Sem LinkedIn"}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleToggleCourseEnrollments(course)}
                              disabled={loadingCourseId === course.id}
                            >
                              {loadingCourseId === course.id ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Eye className="mr-1 h-3.5 w-3.5" />
                              )}
                              {expandedCourseId === course.id ? "Ocultar inscritos" : "Ver inscritos"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleExportCourseEnrollments(course)}
                              disabled={exportingCourseId === course.id}
                            >
                              {exportingCourseId === course.id ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="mr-1 h-3.5 w-3.5" />
                              )}
                              Exportar PDF
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setEditingCourseId(course.id);
                              setCourseForm({
                                name: course.name,
                                description: course.description,
                                preview: course.preview ?? "",
                                communityUrl: course.communityUrl ?? "",
                                companyName: course.companyName,
                                companyCategory: course.companyCategory,
                                companyLogoUrl: course.companyLogoUrl ?? "",
                                companyWebsite: course.companyWebsite ?? "",
                                companyInstagram: course.companyInstagram ?? "",
                                companyLinkedin: course.companyLinkedin ?? "",
                                isPaid: course.isPaid,
                                priceLabel: course.priceLabel ?? "",
                                accentColor: course.accentColor,
                                accentColorSecondary: course.accentColorSecondary,
                                courseColor: course.courseColor,
                                sortOrder: course.sortOrder,
                                isPublished: course.isPublished,
                              });
                            }}>
                              <Edit className="mr-1 h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => void handleCourseDelete(course.id)} disabled={busyKey === `course-delete-${course.id}`}>
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Remover
                            </Button>
                          </div>

                          {expandedCourseId === course.id && (
                            <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold">Inscritos no curso</p>
                                  <p className="text-xs text-muted-foreground">
                                    Lista administrativa com número de estudante, nome, curso e telefone.
                                  </p>
                                </div>
                                <Badge variant="outline">
                                  {(courseEnrollments[course.id]?.total ?? course.studentCount)} inscritos
                                </Badge>
                              </div>

                              <div className="mt-4 space-y-3">
                                {loadingCourseId === course.id ? (
                                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/80 px-4 py-8 text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    A carregar inscritos...
                                  </div>
                                ) : (courseEnrollments[course.id]?.enrollments.length ?? 0) === 0 ? (
                                  <div className="rounded-2xl border border-dashed border-border/60 bg-background/80 px-4 py-8 text-center text-sm text-muted-foreground">
                                    Ainda não há inscritos neste curso.
                                  </div>
                                ) : (
                                  courseEnrollments[course.id]?.enrollments.map((entry) => {
                                    const enrollmentStatus = normalizeCourseEnrollmentStatus(entry.paymentStatus);
                                    const isUpdating = updatingEnrollmentStatusId === entry.id;

                                    return (
                                      <div key={entry.id} className="rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                          <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                            <div>
                                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Número</p>
                                              <p className="mt-1 text-sm font-medium">{entry.studentNumber}</p>
                                            </div>
                                            <div>
                                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Nome</p>
                                              <p className="mt-1 text-sm font-medium">{entry.fullName}</p>
                                            </div>
                                            <div>
                                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Curso</p>
                                              <p className="mt-1 text-sm font-medium">{entry.course || "Curso não informado"}</p>
                                            </div>
                                            <div>
                                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Telefone</p>
                                              <p className="mt-1 text-sm font-medium">{entry.phone || "Sem telefone"}</p>
                                            </div>
                                            <div>
                                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Estado</p>
                                              <Badge variant="outline" className={`mt-1 ${courseEnrollmentStatusBadge[enrollmentStatus]}`}>
                                                {entry.statusLabel || courseEnrollmentStatusLabel[enrollmentStatus]}
                                              </Badge>
                                            </div>
                                          </div>

                                          <div className="flex flex-wrap gap-2">
                                            {entry.whatsAppUrl || whatsappLink(entry.phone) ? (
                                              <Button asChild size="sm" variant="outline">
                                                <a href={entry.whatsAppUrl || whatsappLink(entry.phone) || "#"} target="_blank" rel="noreferrer">
                                                  <MessageSquare className="mr-1 h-3.5 w-3.5" />
                                                  Contactar via WhatsApp
                                                </a>
                                              </Button>
                                            ) : null}
                                          </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          <Button
                                            size="sm"
                                            variant={enrollmentStatus === "CONFIRMED" ? "default" : "outline"}
                                            disabled={isUpdating}
                                            onClick={() => void handleEnrollmentStatusUpdate(course.id, entry.id, "CONFIRMED")}
                                          >
                                            {isUpdating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1 h-3.5 w-3.5" />}
                                            Aprovar
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant={enrollmentStatus === "PENDING" ? "default" : "outline"}
                                            disabled={isUpdating}
                                            onClick={() => void handleEnrollmentStatusUpdate(course.id, entry.id, "PENDING")}
                                          >
                                            {isUpdating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Clock className="mr-1 h-3.5 w-3.5" />}
                                            Pendente
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant={enrollmentStatus === "REJECTED" ? "destructive" : "outline"}
                                            disabled={isUpdating}
                                            onClick={() => void handleEnrollmentStatusUpdate(course.id, entry.id, "REJECTED")}
                                          >
                                            {isUpdating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
                                            Rejeitar
                                          </Button>
                                        </div>
                                        <p className="mt-3 text-[11px] text-muted-foreground">
                                          Inscrição registada em {formatDateLabel(entry.enrolledAt)}
                                        </p>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                              {courseEnrollments[course.id] ? (
                                <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
                                  <p className="text-muted-foreground">
                                    Página {courseEnrollments[course.id].page} de {courseEnrollments[course.id].totalPages}
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void loadCourseEnrollmentsPage(course.id, Math.max(1, courseEnrollments[course.id].page - 1))}
                                      disabled={loadingCourseId === course.id || courseEnrollments[course.id].page <= 1}
                                    >
                                      <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                      Anterior
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void loadCourseEnrollmentsPage(course.id, Math.min(courseEnrollments[course.id].totalPages, courseEnrollments[course.id].page + 1))}
                                      disabled={loadingCourseId === course.id || courseEnrollments[course.id].page >= courseEnrollments[course.id].totalPages}
                                    >
                                      Próximo
                                      <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "panels" && (
                <div className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">{editingPanelTopicId ? "Editar painel" : "Novo painel"}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField label="Título">
                          <Input value={panelTopicForm.title} onChange={(event) => setPanelTopicForm((current) => ({ ...current, title: event.target.value }))} />
                        </FormField>
                        <FormField label="Descrição">
                          <Textarea value={panelTopicForm.description} onChange={(event) => setPanelTopicForm((current) => ({ ...current, description: event.target.value }))} className="min-h-24" />
                        </FormField>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField label="Speaker">
                            <Input value={panelTopicForm.speaker} onChange={(event) => setPanelTopicForm((current) => ({ ...current, speaker: event.target.value }))} />
                          </FormField>
                          <FormField label="Hora">
                            <Input value={panelTopicForm.time} onChange={(event) => setPanelTopicForm((current) => ({ ...current, time: event.target.value }))} />
                          </FormField>
                          <FormField label="Local">
                            <Input value={panelTopicForm.local} onChange={(event) => setPanelTopicForm((current) => ({ ...current, local: event.target.value }))} />
                          </FormField>
                          <FormField label="Dia">
                            <Input value={panelTopicForm.day} onChange={(event) => setPanelTopicForm((current) => ({ ...current, day: event.target.value }))} />
                          </FormField>
                          <FormField label="Data">
                            <Input value={panelTopicForm.dateLabel} onChange={(event) => setPanelTopicForm((current) => ({ ...current, dateLabel: event.target.value }))} />
                          </FormField>
                          <FormField label="Tipo">
                            <Input value={panelTopicForm.type} onChange={(event) => setPanelTopicForm((current) => ({ ...current, type: event.target.value }))} />
                          </FormField>
                          <FormField label="Ícone">
                            <Input value={panelTopicForm.icon} onChange={(event) => setPanelTopicForm((current) => ({ ...current, icon: event.target.value }))} />
                          </FormField>
                          <FormField label="Ordem">
                            <Input type="number" value={panelTopicForm.sortOrder ?? 0} onChange={(event) => setPanelTopicForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
                          </FormField>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-border p-3">
                          <span className="text-sm">Publicado</span>
                          <Switch checked={panelTopicForm.isPublished ?? true} onCheckedChange={(checked) => setPanelTopicForm((current) => ({ ...current, isPublished: checked }))} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => void handlePanelTopicSubmit()} disabled={busyKey === "panel-topic"}>{editingPanelTopicId ? "Atualizar" : "Criar"} painel</Button>
                          {editingPanelTopicId && <Button variant="outline" onClick={resetPanelTopicForm}>Cancelar</Button>}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Painéis publicados na home</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {panelTopics.map((panel) => (
                          <div key={panel.id} className="rounded-xl border border-border p-3">
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium">{panel.title}</p>
                                <p className="text-xs text-muted-foreground">{panel.day} · {panel.dateLabel} · {panel.type}</p>
                              </div>
                              <Badge variant="outline">{panel.isPublished ? "Publicado" : "Rascunho"}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{panel.description}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => {
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
                                  isPublished: panel.isPublished
                                });
                              }}>
                                <Edit className="mr-1 h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => void handlePanelTopicDelete(panel.id)} disabled={busyKey === `panel-topic-delete-${panel.id}`}>
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
                      <CardTitle className="text-base">Redes sociais do UOR Connect</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2">
                      <FormField label="Instagram">
                        <Input
                          value={normalizeOptionalText(socialConfigForm.instagramUrl)}
                          onChange={(event) => setSocialConfigForm((current) => ({ ...current, instagramUrl: event.target.value }))}
                          placeholder="https://instagram.com/..."
                        />
                      </FormField>
                      <FormField label="Facebook">
                        <Input
                          value={normalizeOptionalText(socialConfigForm.facebookUrl)}
                          onChange={(event) => setSocialConfigForm((current) => ({ ...current, facebookUrl: event.target.value }))}
                          placeholder="https://facebook.com/..."
                        />
                      </FormField>
                      <FormField label="LinkedIn">
                        <Input
                          value={normalizeOptionalText(socialConfigForm.linkedinUrl)}
                          onChange={(event) => setSocialConfigForm((current) => ({ ...current, linkedinUrl: event.target.value }))}
                          placeholder="https://linkedin.com/company/..."
                        />
                      </FormField>
                      <div className="flex items-end">
                        <Button onClick={() => void handleSocialConfigSave()} disabled={busyKey === "social-config"}>
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
                      <CardTitle className="text-base">{editingFaqId ? "Editar FAQ" : "Nova FAQ"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField label="Pergunta">
                        <Input value={faqForm.question} onChange={(event) => setFaqForm((current) => ({ ...current, question: event.target.value }))} />
                      </FormField>
                      <FormField label="Resposta">
                        <Textarea value={faqForm.answer} onChange={(event) => setFaqForm((current) => ({ ...current, answer: event.target.value }))} className="min-h-28" />
                      </FormField>
                      <FormField label="Ordem">
                        <Input type="number" value={faqForm.sortOrder ?? 0} onChange={(event) => setFaqForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
                      </FormField>
                      <div className="flex items-center justify-between rounded-lg border border-border p-3">
                        <span className="text-sm">Publicado</span>
                        <Switch checked={faqForm.isPublished ?? true} onCheckedChange={(checked) => setFaqForm((current) => ({ ...current, isPublished: checked }))} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => void handleFaqSubmit()} disabled={busyKey === "faq"}>{editingFaqId ? "Atualizar" : "Criar"} FAQ</Button>
                        {editingFaqId && <Button variant="outline" onClick={resetFaqForm}>Cancelar</Button>}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    {faqItems.map((faq) => (
                      <Card key={faq.id} className="border-border/60">
                        <CardContent className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{faq.question}</p>
                              <p className="text-xs text-muted-foreground">Ordem {faq.sortOrder}</p>
                            </div>
                            <Badge variant="outline">{faq.isPublished ? "Publicado" : "Rascunho"}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{faq.answer}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => {
                              setEditingFaqId(faq.id);
                              setFaqForm({
                                question: faq.question,
                                answer: faq.answer,
                                sortOrder: faq.sortOrder,
                                isPublished: faq.isPublished,
                              });
                            }}>
                              <Edit className="mr-1 h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => void handleFaqDelete(faq.id)} disabled={busyKey === `faq-delete-${faq.id}`}>
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
                      <CardTitle className="text-sm">Configuração do Ao Vivo</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setLiveConfigForm((current) => ({ ...current, mode: "AGENDA" }))}
                          className={`rounded-2xl border p-4 text-left transition-colors ${liveConfigForm.mode === "AGENDA" ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                        >
                          <p className="text-sm font-semibold">Seguir agenda</p>
                          <p className="mt-1 text-xs text-muted-foreground">O site mostra automaticamente a sessão atual e a próxima.</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLiveConfigForm((current) => ({
                            ...current,
                            mode: "MANUAL",
                            current: current.current ?? {
                              day: liveState.current?.day ?? "DAY1",
                              date: liveState.current?.date ? toDateInputValue(liveState.current.date) : "",
                              startTime: liveState.current?.startTime ?? "",
                              endTime: liveState.current?.endTime ?? "",
                              title: liveState.current?.title ?? "",
                              local: liveState.current?.local ?? "",
                              speaker: liveState.current?.speaker ?? "",
                              description: liveState.current?.description ?? "",
                              type: liveState.current?.type ?? "PANEL",
                              theme: liveState.current?.theme ?? "",
                            }
                          }))}
                          className={`rounded-2xl border p-4 text-left transition-colors ${liveConfigForm.mode === "MANUAL" ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                        >
                          <p className="text-sm font-semibold">Conteúdo administrativo</p>
                          <p className="mt-1 text-xs text-muted-foreground">Tu decides o que aparece ao vivo e essa atualização também reescreve a sessão da agenda em curso.</p>
                        </button>
                      </div>

                      {liveConfigForm.mode === "MANUAL" && liveConfigForm.current ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <FormField label="Dia">
                            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={liveConfigForm.current.day} onChange={(event) => setLiveConfigForm((current) => ({ ...current, current: current.current ? { ...current.current, day: event.target.value as "DAY1" | "DAY2" } : current.current }))}>
                              <option value="DAY1">Dia 1</option>
                              <option value="DAY2">Dia 2</option>
                            </select>
                          </FormField>
                          <FormField label="Data">
                            <Input type="date" value={toDateInputValue(liveConfigForm.current.date)} onChange={(event) => setLiveConfigForm((current) => ({ ...current, current: current.current ? { ...current.current, date: event.target.value } : current.current }))} />
                          </FormField>
                          <FormField label="Hora inicial">
                            <Input type="time" value={liveConfigForm.current.startTime} onChange={(event) => setLiveConfigForm((current) => ({ ...current, current: current.current ? { ...current.current, startTime: event.target.value } : current.current }))} />
                          </FormField>
                          <FormField label="Hora final">
                            <Input type="time" value={liveConfigForm.current.endTime} onChange={(event) => setLiveConfigForm((current) => ({ ...current, current: current.current ? { ...current.current, endTime: event.target.value } : current.current }))} />
                          </FormField>
                          <FormField label="Título">
                            <Input value={liveConfigForm.current.title} onChange={(event) => setLiveConfigForm((current) => ({ ...current, current: current.current ? { ...current.current, title: event.target.value } : current.current }))} />
                          </FormField>
                          <FormField label="Local">
                            <Input value={liveConfigForm.current.local} onChange={(event) => setLiveConfigForm((current) => ({ ...current, current: current.current ? { ...current.current, local: event.target.value } : current.current }))} />
                          </FormField>
                          <FormField label="Orador / responsável">
                            <Input value={liveConfigForm.current.speaker} onChange={(event) => setLiveConfigForm((current) => ({ ...current, current: current.current ? { ...current.current, speaker: event.target.value } : current.current }))} />
                          </FormField>
                          <FormField label="Tipo">
                            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={liveConfigForm.current.type} onChange={(event) => setLiveConfigForm((current) => ({ ...current, current: current.current ? { ...current.current, type: event.target.value as AgendaInput["type"] } : current.current }))}>
                              <option value="PANEL">Painel</option>
                              <option value="WORKSHOP">Workshop</option>
                              <option value="PRESENTATION">Apresentação</option>
                              <option value="CEREMONY">Cerimónia</option>
                              <option value="BREAK">Intervalo</option>
                            </select>
                          </FormField>
                          <div className="md:col-span-2">
                            <FormField label="Tema">
                              <Input value={liveConfigForm.current.theme} onChange={(event) => setLiveConfigForm((current) => ({ ...current, current: current.current ? { ...current.current, theme: event.target.value } : current.current }))} />
                            </FormField>
                          </div>
                          <div className="md:col-span-2">
                            <FormField label="Descrição">
                              <Textarea className="min-h-24" value={liveConfigForm.current.description} onChange={(event) => setLiveConfigForm((current) => ({ ...current, current: current.current ? { ...current.current, description: event.target.value } : current.current }))} />
                            </FormField>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => void handleLiveConfigSave()} disabled={busyKey === "live-config"}>
                          {busyKey === "live-config" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radio className="mr-2 h-4 w-4" />}
                          Guardar Ao Vivo
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setLiveConfigForm({
                            mode: "MANUAL",
                            current: liveState.current ? {
                              day: liveState.current.day as "DAY1" | "DAY2",
                              date: toDateInputValue(liveState.current.date),
                              startTime: liveState.current.startTime,
                              endTime: liveState.current.endTime,
                              title: liveState.current.title,
                              local: liveState.current.local,
                              speaker: liveState.current.speaker,
                              description: liveState.current.description,
                              type: liveState.current.type as AgendaInput["type"],
                              theme: liveState.current.theme,
                            } : defaultLiveConfigForm.current
                          })}
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
                        <Badge variant="outline" className="w-fit">{liveState.source === "admin" ? "Fonte: conteúdo administrativo" : "Fonte: agenda"}</Badge>
                        <p className="font-medium">{liveState.current?.title ?? "Nenhuma sessão em curso"}</p>
                        <p className="text-muted-foreground">
                          {liveState.current
                            ? `${liveState.current.local} · ${liveState.current.startTime} - ${liveState.current.endTime}`
                            : "Sem sessão ativa derivada da agenda"}
                        </p>
                        {liveState.current?.description && <p className="text-muted-foreground">{liveState.current.description}</p>}
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
                        <p className="font-medium">{liveState.next?.title ?? "Nenhuma sessão planeada"}</p>
                        <p className="text-muted-foreground">
                          {liveState.next
                            ? `${liveState.next.local} · ${formatAgendaDay(liveState.next.day)} · ${liveState.next.startTime}`
                            : "Sem próximos eventos no calendário"}
                        </p>
                        {liveState.next?.description && <p className="text-muted-foreground">{liveState.next.description}</p>}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Dados derivados</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => toast.info("O estado ao vivo está a ser calculado a partir da agenda no backend.")}>
                        <Zap className="mr-1 h-3.5 w-3.5" />
                        Lógica no backend
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info(`Locais ligados ao banco: ${guideContent.venues.length}`)}>
                        <MapPin className="mr-1 h-3.5 w-3.5" />
                        Locais do guia
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info(`FAQ no banco: ${faqItems.length}`)}>
                        <Settings className="mr-1 h-3.5 w-3.5" />
                        Conteúdo administrativo
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="grid gap-3 lg:grid-cols-[1.3fr_0.8fr]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-9" placeholder="Buscar comentários e mensagens por conteúdo, estudante, número ou projeto..." value={moderationSearchTerm} onChange={(event) => setModerationSearchTerm(event.target.value)} />
                    </div>
                    <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={moderationPageSize} onChange={(event) => setModerationPageSize(Number(event.target.value))}>
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
                          <Badge variant="outline">{projectComments.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                          {filteredProjectComments.length === 0 ? "Nenhum comentário encontrado." : `${filteredProjectComments.length} comentário(s) encontrado(s).`}
                        </div>
                        {paginatedProjectComments.items.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                            Sem comentários pendentes para moderação.
                          </div>
                        ) : (
                          paginatedProjectComments.items.map((comment) => (
                            <div key={comment.id} className="rounded-xl border border-border/70 p-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold">{comment.studentName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Nº {comment.studentNumber} · {comment.course || "Curso não informado"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Projeto: {comment.submissionName} · {formatDateLabel(comment.createdAt)}
                                  </p>
                                  <p className="text-sm text-muted-foreground">{comment.content}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => void handleProjectCommentDelete(comment.id)}
                                  disabled={busyKey === `comment-delete-${comment.id}`}
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  Eliminar
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
                          <p className="text-muted-foreground">Página {paginatedProjectComments.currentPage} de {paginatedProjectComments.totalPages}</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setModerationCommentPage((current) => Math.max(1, current - 1))} disabled={paginatedProjectComments.currentPage <= 1}>
                              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                              Anterior
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setModerationCommentPage((current) => Math.min(paginatedProjectComments.totalPages, current + 1))} disabled={paginatedProjectComments.currentPage >= paginatedProjectComments.totalPages}>
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
                          <Badge variant="outline">{liveChatMessages.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                          {filteredLiveChatMessages.length === 0 ? "Nenhuma mensagem encontrada." : `${filteredLiveChatMessages.length} mensagem(ns) encontrada(s).`}
                        </div>
                        {paginatedLiveChatMessages.items.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                            Sem mensagens no mini-chat para moderar.
                          </div>
                        ) : (
                          paginatedLiveChatMessages.items.map((message) => (
                            <div key={message.id} className="rounded-xl border border-border/70 p-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold">{message.studentName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Nº {message.studentNumber} · {message.course || "Curso não informado"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{formatDateLabel(message.createdAt)}</p>
                                  <p className="text-sm text-muted-foreground">{message.content}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => void handleLiveChatMessageDelete(message.id)}
                                  disabled={busyKey === `live-chat-delete-${message.id}`}
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  Eliminar
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
                          <p className="text-muted-foreground">Página {paginatedLiveChatMessages.currentPage} de {paginatedLiveChatMessages.totalPages}</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setModerationChatPage((current) => Math.max(1, current - 1))} disabled={paginatedLiveChatMessages.currentPage <= 1}>
                              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                              Anterior
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setModerationChatPage((current) => Math.min(paginatedLiveChatMessages.totalPages, current + 1))} disabled={paginatedLiveChatMessages.currentPage >= paginatedLiveChatMessages.totalPages}>
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
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        <PhLightning className="h-4 w-4" />
                        Ao vivo
                      </p>
                      <h2 className="text-xl font-heading font-bold">Votação ao Vivo</h2>
                      <p className="text-sm text-muted-foreground">Resultados em tempo real da 3ª Feira das Telecomunicações</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => void handleRefreshVotes()} disabled={busyKey === "votes-refresh"}>
                        <PhClock className="mr-2 h-4 w-4" />
                        {busyKey === "votes-refresh" ? "A atualizar..." : "Atualizar agora"}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Última atualização: {votesUpdatedAt ? new Date(votesUpdatedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "agora"}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard icon={PhTrophy} label="Total de votos" value={votesEntriesTotal} color="bg-primary/10 text-primary" />
                    <StatCard icon={PhTrendUp} label="Projetos ativos" value={votesProjectsTotal} color="bg-[hsl(var(--area-negocio))]/10 text-[hsl(var(--area-negocio))]" />
                    <StatCard icon={PhHeart} label="Likes totais" value={rankedProjects.reduce((s, p) => s + p.rating, 0)} color="bg-[hsl(var(--area-ia))]/10 text-[hsl(var(--area-ia))]" />
                    <StatCard icon={PhChatTeardrop} label="Comentários" value={rankedProjects.reduce((s, p) => s + p.comentarios, 0)} color="bg-[hsl(var(--area-web))]/10 text-[hsl(var(--area-web))]" />
                  </div>

                  <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                    <Card className="border-border/60 bg-card/80 backdrop-blur">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <PhTrophy className="h-5 w-5 text-primary" />
                          Resumo por Projeto
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase text-destructive">
                            <span className="h-2 w-2 rounded-full bg-destructive animate-ping" />
                            Ao vivo
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {rankedProjects
                          .slice()
                          .sort((a, b) => b.votos - a.votos || b.comentarios - a.comentarios)
                          .map((project, idx) => {
                            const maxVotes = Math.max(...rankedProjects.map((item) => item.votos), 1);
                            const pct = (project.votos / maxVotes) * 100;
                            const medalColor = idx === 0 ? "from-amber-400 to-amber-500" : idx === 1 ? "from-slate-200 to-slate-400" : idx === 2 ? "from-orange-300 to-orange-400" : "from-muted to-muted";
                            return (
                              <motion.div
                                key={project.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="group rounded-2xl border border-border/60 bg-white/70 p-4 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lg"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{project.equipa ?? "Equipa"}</p>
                                    <p className="text-lg font-heading font-bold leading-tight">{project.nome}</p>
                                  </div>
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${medalColor} text-xs font-bold text-white shadow-lg`}>
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
                                </div>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.6 }}
                                    className="h-full rounded-full bg-primary"
                                  />
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                                  <span className="font-semibold text-foreground">{project.votos} votos</span>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                                    <PhTrendUp className="h-3.5 w-3.5 text-primary" />
                                    {project.rating} score
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
                          <p className="text-muted-foreground">
                            Página {votesProjectsPage} de {votesProjectsTotalPages}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setVotesProjectsPage((current) => Math.max(1, current - 1))}
                              disabled={votesProjectsPage <= 1}
                            >
                              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                              Anterior
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setVotesProjectsPage((current) => Math.min(votesProjectsTotalPages, current + 1))}
                              disabled={votesProjectsPage >= votesProjectsTotalPages}
                            >
                              Próximo
                              <ChevronRight className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/85 backdrop-blur">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <PhUsers className="h-5 w-5 text-primary" />
                          Votos em Tempo Real
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Feed ao vivo</span>
                          <span>{votesEntriesTotal} registos</span>
                        </div>
                        <div className="space-y-2">
                          {voteEntries.map((vote) => (
                            <motion.div
                              key={vote.id}
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-3 rounded-xl border border-border/60 bg-white/80 p-3 text-sm shadow-sm backdrop-blur hover:border-primary/40"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                                {vote.estudante?.[0] || "V"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-foreground">{vote.estudante}</p>
                                <p className="truncate text-xs text-muted-foreground">Votou em {vote.projeto}</p>
                              </div>
                              <div className="text-[11px] text-muted-foreground">{vote.data.slice(11, 16)}</div>
                            </motion.div>
                          ))}
                        </div>
                        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
                          <p className="text-muted-foreground">
                            Página {votesEntriesPage} de {votesEntriesTotalPages}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setVotesEntriesPage((current) => Math.max(1, current - 1))}
                              disabled={votesEntriesPage <= 1}
                            >
                              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                              Anterior
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setVotesEntriesPage((current) => Math.min(votesEntriesTotalPages, current + 1))}
                              disabled={votesEntriesPage >= votesEntriesTotalPages}
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

              {activeTab === "security" && (
                <div className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Shield className="h-4 w-4 text-primary" />
                          Acessos administrativos
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField label="Número de estudante autorizado">
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <Input
                              value={authorizedStudentNumber}
                              onChange={(event) => setAuthorizedStudentNumber(normalizeStudentNumberInput(event.target.value))}
                              placeholder="20242099"
                              inputMode="numeric"
                            />
                            <Button onClick={() => void handleAuthorizeAdminStudent()} disabled={busyKey === "security-authorize"}>
                              {busyKey === "security-authorize" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                              Autorizar
                            </Button>
                          </div>
                        </FormField>

                        <div className="space-y-3">
                          {authorizedAdminStudents.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                              Ainda não existem estudantes autorizados para a área administrativa.
                            </div>
                          ) : (
                            authorizedAdminStudents.map((student) => (
                              <div key={student.id} className="flex flex-col gap-3 rounded-xl border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold">{student.studentNumber}</p>
                                  <p className="text-xs text-muted-foreground">Autorizado em {formatDateLabel(student.createdAt)}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => void handleRevokeAdminStudent(student.studentNumber)}
                                  disabled={busyKey === `security-revoke-${student.studentNumber}`}
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  Remover acesso
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Users className="h-4 w-4 text-primary" />
                          Logins recentes
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {recentLogins.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                            Ainda não existem logins recentes registados.
                          </div>
                        ) : (
                          recentLogins.map((student) => {
                            const whatsappUrl = whatsappLink(student.phone);
                            return (
                              <div key={student.id} className="rounded-xl border border-border/70 p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold">{student.name || `Estudante ${student.studentNumber}`}</p>
                                    <p className="text-xs text-muted-foreground">Nº {student.studentNumber} · {student.course || "Curso não informado"}</p>
                                    <p className="text-xs text-muted-foreground">{student.email || "Sem email"}</p>
                                    <p className="text-xs text-muted-foreground">{student.phone || "Sem contacto telefónico"}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Último login: {student.lastLoginAt ? formatDateLabel(student.lastLoginAt) : "Sem data registada"}
                                    </p>
                                  </div>
                                  {whatsappUrl && (
                                    <Button size="sm" className="bg-[#25D366] text-white hover:bg-[#1fb85a]" asChild>
                                      <a href={whatsappUrl} target="_blank" rel="noreferrer noopener">
                                        <MessageSquare className="mr-1 h-3.5 w-3.5" />
                                        Puxar no WhatsApp
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {activeTab === "students" && (
                <div className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr_auto]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-9" placeholder="Buscar por nome, número do estudante ou curso..." value={studentSearchTerm} onChange={(event) => setStudentSearchTerm(event.target.value)} />
                    </div>
                    <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={studentCourseFilter} onChange={(event) => setStudentCourseFilter(event.target.value)}>
                      <option value="todos">Todos os cursos</option>
                      {availableStudentCourses.map((course) => (
                        <option key={course} value={course}>{course}</option>
                      ))}
                    </select>
                    <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={studentSortBy} onChange={(event) => setStudentSortBy(event.target.value as typeof studentSortBy)}>
                      <option value="interacoes">Mais interações</option>
                      <option value="nome">Nome A-Z</option>
                      <option value="numero">Número do estudante</option>
                      <option value="curso">Curso</option>
                    </select>
                    <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={studentPageSize} onChange={(event) => setStudentPageSize(Number(event.target.value))}>
                      <option value={10}>10 por página</option>
                      <option value={20}>20 por página</option>
                      <option value={50}>50 por página</option>
                    </select>
                    <Button variant={groupStudentsByCourse ? "default" : "outline"} onClick={() => setGroupStudentsByCourse((current) => !current)}>
                      {groupStudentsByCourse ? "Agrupado" : "Sem grupo"}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                    {loadingStudentsList
                      ? "A carregar estudantes..."
                      : studentsTotal === 0
                        ? "Nenhum estudante encontrado."
                        : `${studentsTotal} estudante(s) encontrado(s).`}
                  </div>

                  {studentListRows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
                      Nenhum estudante encontrado.
                    </div>
                  ) : groupStudentsByCourse ? (
                    Object.entries(groupedStudents).map(([course, courseStudents]) => (
                      <div key={course} className="space-y-3">
                        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                          <p className="text-sm font-semibold">{course}</p>
                          <p className="text-xs text-muted-foreground">{courseStudents.length} estudante(s) nesta página</p>
                        </div>
                        {courseStudents.map((student) => (
                          <Card key={student.id} className="border-border/60">
                            <CardContent className="p-4">
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="min-w-0 flex-1">
                                  <p className="break-words text-sm font-medium">{student.studentNumber}</p>
                                  <p className="break-words text-sm text-muted-foreground">{student.name || `Estudante ${student.studentNumber}`}</p>
                                  <p className="break-words text-[11px] text-muted-foreground">{student.course || "Curso não informado"}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground sm:flex sm:gap-4">
                                  <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {student._count?.likes ?? 0}</span>
                                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {student._count?.comments ?? 0}</span>
                                  <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {student._count?.votes ?? 0}</span>
                                </div>
                                <div className="flex flex-col gap-2 sm:items-end">
                                  <Badge className="w-fit border-primary/20 bg-primary/10 text-[10px] text-primary">{studentInteractions(student)} interações</Badge>
                                  <Button size="sm" variant="destructive" className="w-full sm:w-auto" onClick={() => setStudentPendingRemoval(student)}>
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    Remover
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ))
                  ) : (
                    studentListRows.map((student) => (
                      <Card key={student.id} className="border-border/60">
                        <CardContent className="p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-medium">{student.studentNumber}</p>
                              <p className="break-words text-sm text-muted-foreground">{student.name || `Estudante ${student.studentNumber}`}</p>
                              <p className="break-words text-[11px] text-muted-foreground">{student.course || "Curso não informado"}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground sm:flex sm:gap-4">
                              <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> {student._count?.likes ?? 0}</span>
                              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {student._count?.comments ?? 0}</span>
                              <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {student._count?.votes ?? 0}</span>
                            </div>
                            <div className="flex flex-col gap-2 sm:items-end">
                              <Badge className="w-fit border-primary/20 bg-primary/10 text-[10px] text-primary">{studentInteractions(student)} interações</Badge>
                              <Button size="sm" variant="destructive" className="w-full sm:w-auto" onClick={() => setStudentPendingRemoval(student)}>
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                Remover
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}

                  <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm md:flex-row">
                    <p className="text-muted-foreground">
                      Página {studentPage} de {studentsTotalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setStudentPage((current) => Math.max(1, current - 1))} disabled={loadingStudentsList || studentPage <= 1}>
                        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                        Anterior
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStudentPage((current) => Math.min(studentsTotalPages, current + 1))} disabled={loadingStudentsList || studentPage >= studentsTotalPages}>
                        Próximo
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "winners" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-lg font-heading font-bold">
                      <Trophy className="h-5 w-5 text-[hsl(var(--warning))]" />
                      Selecionar Vencedor
                    </h2>
                    <Button variant="outline" onClick={() => void handleClearWinner()}>
                      Desclassificar Projeto
                    </Button>
                  </div>

                  <Card className="border-primary/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Award className="h-4 w-4 text-primary" />
                        Melhor Projeto Académico
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {approvedProjects.map((project) => {
                        const Icon = tipoIcons[project.tipo];
                        const isSelected = selectedWinners.projectWinner === project.id;
                        return (
                          <motion.div
                            key={project.id}
                            whileHover={{ scale: 1.01 }}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border/40 hover:border-primary/30"}`}
                            onClick={() => void handleSelectWinner(project.id)}
                          >
                            {isSelected && <Crown className="h-5 w-5 text-[hsl(var(--warning))]" />}
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 text-sm font-medium">{project.nome}</span>
                            <Badge variant="outline" className={tipoBadgeColors[project.tipo]}>{project.tipo}</Badge>
                            <span className="text-xs text-muted-foreground">{project.votos} votos · ⭐ {project.rating}</span>
                          </motion.div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default Admin;

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronRight,
  Copy,
  Crown,
  Download,
  ExternalLink,
  FileText,
  Gamepad2,
  Gift,
  GraduationCap,
  History,
  ImagePlus,
  Layers3,
  Loader2,
  Lock,
  Map as MapIcon,
  MapPinCheck,
  Network,
  Puzzle,
  QrCode,
  Rocket,
  Route,
  Save,
  ScanLine,
  Send,
  ShieldCheck,
  Swords,
  TrendingUp,
  Trash2,
  Trophy,
  User,
  UserPlus,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import { UserAvatar } from "@/components/social/UserAvatar";
import { toast } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrCameraScanner } from "@/components/admin/QrCameraScanner";
import {
  ProfileConsentControls,
  type ProfileConsentValues,
} from "@/components/profile/ProfileConsentControls";
import {
  api,
  type AttendanceMePayload,
  type CertificateItem,
  type DigitalPassportConstructiveFeedbackFocus,
  type DigitalPassportReferralInvite,
  type DigitalPassportNetworkingQr,
  type DigitalPassportChallengeAnswerResult,
  type DigitalPassportOwnedProjectChallenge,
  type DigitalPassportRankingRow,
  type DigitalPassportSummary,
  type ExternalTeamMemberCredentials,
  type MyTeamCredentialResponse,
  type ProjectPublicFeedItem,
  type QrScanResult,
  type StudentEnrollmentListItem,
  type StudentExhibitorPassportSummary,
  type StudentOwnedSubmissionListItem,
  type StudentProfileState,
  type StudentProfileUpdateInput,
  type StudentScanHistoryItem,
  type TeamCredentialMember,
  getSessionStudent,
  isAuthError,
  setToken,
} from "@/lib/api";
import { getCookie } from "@/lib/browser-cookies";
import {
  getProjectBannerSource,
  readCompressedImageFileAsDataUrl,
  readImageFileAsDataUrl,
} from "@/lib/project-media";
import {
  normalizeStudentAreaTab,
  type StudentAreaTab,
} from "@/lib/student-area-tabs";
import {
  getProjectTeamCardState,
  getProjectTeamConfirmationOverview,
} from "@/lib/student-area-projects";
import { downloadBlobFile } from "@/lib/student-documents";
import { orderPassportMissionsForMap } from "@/lib/passport-mission-order";
import {
  getPassportDisplayPoints,
  getPassportJoinAwardedPoints,
  shouldShowPassportCelebrationPoints,
} from "@/lib/passport-display";
import {
  buildPassportReferralInvitePath,
  clearPassportReferralAccepted,
  consumePassportReferralAccepted,
  markPassportReferralAccepted,
} from "@/lib/passport-referral-flow";
import { createQrDataUrl } from "@/lib/qr";

type ProfileDraft = {
  name: string;
  phone: string;
  alternatePhone: string;
  avatarUrl: string;
  bio: string;
  address: string;
  instagramUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  websiteUrl: string;
  consentPhotoCredential: boolean;
  consentPublicProfile: boolean;
  consentSocialLinks: boolean;
  consentSms: boolean;
  consentWhatsapp: boolean;
  visibility: ProfileVisibilityDraft;
};

type ProfileVisibilityDraft = {
  photo: boolean;
  bio: boolean;
  socialLinks: boolean;
  course: boolean;
  organization: boolean;
};

type PassportMissionStatus = "done" | "available" | "locked";

type ScanCelebration = {
  title: string;
  message: string;
  points: number;
  tone: "success" | "challenge" | "surprise" | "warning" | "blocked" | "educational";
  actionLabel: string;
  effect?: "victory" | "loss" | "sad" | "ready";
};

type ExhibitorPassportRecentEventItem =
  NonNullable<StudentExhibitorPassportSummary["activeProject"]>["recentEvents"][number];

type ProjectChallengeDraft = {
  question: string;
  options: string;
  correctAnswer: string;
  explanation: string;
  maxAttempts: string;
};

type ProjectPublicDetailsDraft = {
  description: string;
  repoUrl: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
  githubUrl: string;
};

type TeamMemberExternalDraft = {
  organization: string;
  phone: string;
};

type ConstructiveFeedbackProject = Pick<
  ProjectPublicFeedItem,
  "id" | "name" | "slug" | "detailPath"
>;

const EXHIBITOR_VOTE_QR_SOURCE = "exhibitor_qr";
const CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS = 3;
const CONSTRUCTIVE_FEEDBACK_MIN_LENGTH = 60;
const PASSPORT_PROGRESS_SCAN_RESULTS = new Set([
  "SUCCESS",
  "ALREADY_DONE",
  "ALREADY_AWARDED",
  "SURPRISE_APPLIED",
  "CHALLENGE_READY",
  "CHALLENGE_NOT_CONFIGURED",
]);
const constructiveFeedbackFocusOptions: Array<{
  value: DigitalPassportConstructiveFeedbackFocus;
  label: string;
}> = [
  { value: "clareza", label: "Clareza" },
  { value: "impacto", label: "Impacto" },
  { value: "viabilidade", label: "Viabilidade" },
  { value: "apresentacao", label: "Apresentação" },
  { value: "experiencia", label: "Experiência" },
];

function buildOwnedSubmissionVoteQrUrl(
  submission: Pick<StudentOwnedSubmissionListItem, "detailPath">,
) {
  const fallbackPath = `${submission.detailPath}${submission.detailPath.includes("?") ? "&" : "?"}vote=1&source=${EXHIBITOR_VOTE_QR_SOURCE}`;
  if (typeof window === "undefined") return fallbackPath;

  try {
    const url = new URL(submission.detailPath, window.location.origin);
    url.searchParams.set("vote", "1");
    url.searchParams.set("source", "exhibitor_qr");
    return url.toString();
  } catch {
    return fallbackPath;
  }
}

function extractProjectSlugFromQrValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const fallbackOrigin =
    typeof window === "undefined" ? "https://uorconnect.local" : window.location.origin;

  try {
    const url = new URL(trimmed, fallbackOrigin);
    const segments = url.pathname.split("/").filter(Boolean);
    const projectIndex = segments.findIndex((segment) =>
      ["projeto", "projetos"].includes(segment.toLowerCase()),
    );
    const slug = projectIndex >= 0 ? segments[projectIndex + 1] : null;
    return slug ? decodeURIComponent(slug) : null;
  } catch {
    return null;
  }
}

function isTeamBronzePlusCelebrationEvent(
  event: ExhibitorPassportRecentEventItem,
) {
  const signal = `${event.businessKey} ${event.sourceType} ${event.reason ?? ""}`.toUpperCase();
  return event.action === "TEAM_BONUS" && signal.includes("TEAM_BRONZE_PLUS");
}

function buildExhibitorPassportCelebration(
  latestEvent: ExhibitorPassportRecentEventItem,
): ScanCelebration | null {
  if (latestEvent.effect === "NEUTRAL") return null;

  if (isTeamBronzePlusCelebrationEvent(latestEvent)) {
    return {
      title: "Equipa Bronze+ desbloqueada",
      message:
        latestEvent.reason ??
        "Todos os expositores da equipa chegaram ao nível mínimo e desbloquearam o bónus coletivo.",
      points: latestEvent.points,
      tone: "challenge",
      actionLabel: "Passaporte do Expositor",
      effect: "victory",
    };
  }

  const gained = latestEvent.points > 0;
  return {
    title: gained
      ? "Pontos do expositor ganhos"
      : "Pontos do expositor perdidos",
    message:
      latestEvent.reason ??
      `${latestEvent.submissionName} recebeu uma atualização de pontuação.`,
    points: latestEvent.points,
    tone: gained ? "success" : "warning",
    actionLabel: "Passaporte do Expositor",
    effect: gained ? "victory" : "loss",
  };
}

const UORCONNECT_DISMISSED_JOURNEY_ALERTS_KEY =
  "uorconnect:minha-area:dismissed-journey-alerts:v1";

function readDismissedJourneyAlertKeys() {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(
      localStorage.getItem(UORCONNECT_DISMISSED_JOURNEY_ALERTS_KEY) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeDismissedJourneyAlertKeys(keys: string[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    UORCONNECT_DISMISSED_JOURNEY_ALERTS_KEY,
    JSON.stringify(Array.from(new Set(keys))),
  );
}

const scanCelebrationToneClass: Record<ScanCelebration["tone"], string> = {
  success: "scan-celebration-card--success",
  challenge: "scan-celebration-card--challenge",
  surprise: "scan-celebration-card--surprise",
  warning: "scan-celebration-card--warning",
  blocked: "scan-celebration-card--blocked",
  educational: "scan-celebration-card--educational",
};

const readyTeamCredentialStatuses = new Set([
  "PROFILE_READY",
  "ACTIVE",
  "ISSUED",
]);

function isTeamCredentialReadyStatus(status?: string | null) {
  return Boolean(status && readyTeamCredentialStatuses.has(status));
}

type TeamCredentialVisualSource = Pick<
  TeamCredentialMember,
  "category" | "categoryLabel" | "team" | "role" | "accessLevel"
>;

type TeamCredentialVisualTheme = {
  categoryLabel: string;
  primaryColor: string;
  accentColor: string;
  lightColor: string;
  footerLabel: string;
};

const teamCredentialFallbackThemes: Record<
  string,
  Omit<TeamCredentialVisualTheme, "categoryLabel">
> = {
  NUCLEO: {
    primaryColor: "#0f172a",
    lightColor: "#f1f5f9",
    accentColor: "#334155",
    footerLabel: "Membro Oficial do Núcleo",
  },
  EXPOSITOR: {
    primaryColor: "#92400e",
    lightColor: "#fffbeb",
    accentColor: "#d97706",
    footerLabel: "Expositor Certificado",
  },
  JURI: {
    primaryColor: "#581c87",
    lightColor: "#faf5ff",
    accentColor: "#9333ea",
    footerLabel: "Membro do Júri",
  },
  PALESTRANTE: {
    primaryColor: "#1e3a5f",
    lightColor: "#eff6ff",
    accentColor: "#2563eb",
    footerLabel: "Palestrante Convidado",
  },
  MESTRE_CERIMONIA: {
    primaryColor: "#881337",
    lightColor: "#fff1f2",
    accentColor: "#e11d48",
    footerLabel: "Mestre de Cerimónia",
  },
  PROTOCOLO: {
    primaryColor: "#065f46",
    lightColor: "#ecfdf5",
    accentColor: "#059669",
    footerLabel: "Equipa de Protocolo",
  },
  MARKETING: {
    primaryColor: "#9a3412",
    lightColor: "#fff7ed",
    accentColor: "#ea580c",
    footerLabel: "Equipa de Marketing",
  },
  LOGISTICA: {
    primaryColor: "#164e63",
    lightColor: "#ecfeff",
    accentColor: "#0891b2",
    footerLabel: "Equipa de Logística",
  },
  RELACOES_INTERNAS: {
    primaryColor: "#831843",
    lightColor: "#fdf2f8",
    accentColor: "#db2777",
    footerLabel: "Relações Internas",
  },
  RELACOES_EXTERNAS: {
    primaryColor: "#134e4a",
    lightColor: "#f0fdfa",
    accentColor: "#0d9488",
    footerLabel: "Relações Externas",
  },
  EXPLICADORES: {
    primaryColor: "#3730a3",
    lightColor: "#eef2ff",
    accentColor: "#6366f1",
    footerLabel: "Explicador Académico",
  },
  STAFF: {
    primaryColor: "#374151",
    lightColor: "#f9fafb",
    accentColor: "#6b7280",
    footerLabel: "Staff do Evento",
  },
  OUTRO: {
    primaryColor: "#44403c",
    lightColor: "#fafaf9",
    accentColor: "#78716c",
    footerLabel: "Equipa UOR Connect",
  },
};

const nucleusCredentialFunctionThemes: Array<{
  matches: string[];
  theme: Omit<TeamCredentialVisualTheme, "categoryLabel">;
}> = [
  {
    matches: ["presid", "govern", "direcao"],
    theme: {
      primaryColor: "#0f172a",
      lightColor: "#f1f5f9",
      accentColor: "#475569",
      footerLabel: "Direção do Núcleo",
    },
  },
  {
    matches: ["secretaria", "secretario", "arquivo", "expediente"],
    theme: {
      primaryColor: "#0f766e",
      lightColor: "#f0fdfa",
      accentColor: "#14b8a6",
      footerLabel: "Secretaria Executiva",
    },
  },
  {
    matches: ["tesour", "patrimonio", "financ"],
    theme: {
      primaryColor: "#92400e",
      lightColor: "#fffbeb",
      accentColor: "#d97706",
      footerLabel: "Tesouraria e Património",
    },
  },
  {
    matches: ["academ", "formacao", "curso", "mentoria"],
    theme: {
      primaryColor: "#3730a3",
      lightColor: "#eef2ff",
      accentColor: "#6366f1",
      footerLabel: "Assuntos Académicos",
    },
  },
  {
    matches: ["tecnologia", "sistema", "dados", "tecnica"],
    theme: {
      primaryColor: "#075985",
      lightColor: "#f0f9ff",
      accentColor: "#0284c7",
      footerLabel: "Tecnologia e Dados",
    },
  },
  {
    matches: ["comunicacao", "imagem", "media", "conteudo"],
    theme: {
      primaryColor: "#9f1239",
      lightColor: "#fff1f2",
      accentColor: "#e11d48",
      footerLabel: "Comunicação e Imagem",
    },
  },
  {
    matches: ["evento", "projeto", "inovacao", "atividade"],
    theme: {
      primaryColor: "#065f46",
      lightColor: "#ecfdf5",
      accentColor: "#059669",
      footerLabel: "Eventos e Projetos",
    },
  },
  {
    matches: ["relacoes", "parceria", "institucional", "externa"],
    theme: {
      primaryColor: "#134e4a",
      lightColor: "#f0fdfa",
      accentColor: "#0d9488",
      footerLabel: "Relações e Parcerias",
    },
  },
  {
    matches: ["logistica", "protocolo", "operacao", "credenciacao"],
    theme: {
      primaryColor: "#164e63",
      lightColor: "#ecfeff",
      accentColor: "#0891b2",
      footerLabel: "Logística e Protocolo",
    },
  },
  {
    matches: ["apoio", "colabor", "staff"],
    theme: {
      primaryColor: "#374151",
      lightColor: "#f9fafb",
      accentColor: "#6b7280",
      footerLabel: "Apoio Operacional",
    },
  },
];

function normalizeCredentialThemeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function teamCredentialVisualThemeFor(
  source: TeamCredentialVisualSource,
): TeamCredentialVisualTheme {
  const category = source.category || "OUTRO";
  const categoryLabel = source.categoryLabel || category;
  if (category === "NUCLEO") {
    const searchText = normalizeCredentialThemeText(
      `${source.team} ${source.role} ${source.accessLevel}`,
    );
    const functionTheme = nucleusCredentialFunctionThemes.find((item) =>
      item.matches.some((needle) => searchText.includes(needle)),
    );
    if (functionTheme) return { categoryLabel, ...functionTheme.theme };
  }

  return {
    categoryLabel,
    ...(teamCredentialFallbackThemes[category] ??
      teamCredentialFallbackThemes.OUTRO),
  };
}

function teamCredentialChipStyle(
  theme: TeamCredentialVisualTheme,
): CSSProperties {
  return {
    borderColor: `${theme.accentColor}55`,
    backgroundColor: theme.lightColor,
    color: theme.primaryColor,
  };
}

const defaultProfileVisibility: ProfileVisibilityDraft = {
  photo: true,
  bio: true,
  socialLinks: true,
  course: true,
  organization: true,
};

const profileVisibilityOptions: Array<{
  key: keyof ProfileVisibilityDraft;
  label: string;
}> = [
  { key: "photo", label: "Fotografia" },
  { key: "bio", label: "Bio" },
  { key: "socialLinks", label: "Redes sociais" },
  { key: "course", label: "Curso" },
  { key: "organization", label: "Organização" },
];

function parseProfileVisibility(value?: string | null): ProfileVisibilityDraft {
  if (!value) return { ...defaultProfileVisibility };
  try {
    const parsed = JSON.parse(value) as Partial<
      Record<keyof ProfileVisibilityDraft, unknown>
    >;
    return {
      photo:
        typeof parsed.photo === "boolean"
          ? parsed.photo
          : defaultProfileVisibility.photo,
      bio:
        typeof parsed.bio === "boolean"
          ? parsed.bio
          : defaultProfileVisibility.bio,
      socialLinks:
        typeof parsed.socialLinks === "boolean"
          ? parsed.socialLinks
          : defaultProfileVisibility.socialLinks,
      course:
        typeof parsed.course === "boolean"
          ? parsed.course
          : defaultProfileVisibility.course,
      organization:
        typeof parsed.organization === "boolean"
          ? parsed.organization
          : defaultProfileVisibility.organization,
    };
  } catch {
    return { ...defaultProfileVisibility };
  }
}

function itemDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function shortTimeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function submissionTone(type: string) {
  if (type === "PROJECT") return "border-primary/25 bg-primary/5 text-primary";
  if (type === "BUSINESS")
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  return "border-violet-500/25 bg-violet-500/10 text-violet-700";
}

function submissionIcon(type: string) {
  if (type === "PROJECT") return GraduationCap;
  if (type === "BUSINESS") return BriefcaseBusiness;
  return Layers3;
}

function statusTone(status: string) {
  if (["APPROVED", "CONFIRMED", "CONFIRMED_BY_ADMIN"].includes(status))
    return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (status === "REJECTED")
    return "bg-rose-500/10 text-rose-700 border-rose-500/20";
  if (["PENDING", "PENDING_REVIEW", "SUBMITTED_BY_USER"].includes(status))
    return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  return "bg-slate-500/10 text-slate-700 border-slate-500/20";
}

function submissionHeroGradient(type: string) {
  if (type === "BUSINESS")
    return "linear-gradient(135deg, rgba(16,185,129,0.94), rgba(16,185,129,0.62), rgba(6,95,70,0.78))";
  if (type === "PRODUCT")
    return "linear-gradient(135deg, rgba(168,85,247,0.94), rgba(217,70,239,0.62), rgba(107,33,168,0.78))";
  return "linear-gradient(135deg, rgba(253,131,5,0.94), rgba(249,115,22,0.66), rgba(34,61,66,0.8))";
}

function passportMissionStatusLabel(status: PassportMissionStatus) {
  if (status === "done") return "Concluída";
  if (status === "available") return "Disponível";
  return "Bloqueada";
}

function passportMissionIconFor(type: string) {
  if (type === "EXHIBITOR_PROJECT") return BriefcaseBusiness;
  if (type === "EXHIBITOR_TEAM") return UsersRound;
  if (type === "EXHIBITOR_STAND") return MapPinCheck;
  if (type === "EXHIBITOR_DIVERSITY") return Route;
  if (type === "AMBASSADOR_MISSION") return Network;
  if (type === "EXHIBITOR_MISSION") return Trophy;
  if (type === "PASSPORT_JOIN" || type === "ACCEPT_CHALLENGE")
    return UserPlus;
  if (type === "EVENT_CHECKIN") return MapPinCheck;
  if (type === "WORKSHOP_CHECKIN") return CalendarClock;
  if (type === "WORKSHOP_MASTER_COMBO") return BookOpenCheck;
  if (type === "STAND_VISIT") return Rocket;
  if (type === "STAND_EXPLORER_COMBO" || type === "BALANCED_EXPLORER_COMBO")
    return Layers3;
  if (type === "EXHIBITOR_CHALLENGE" || type === "SPECIAL_QUIZ") return Puzzle;
  if (type === "PROJECT_CONSTRUCTIVE_FEEDBACK") return FileText;
  if (type === "NETWORKING_CROSS_COURSE") return Network;
  if (type === "NETWORKING_TRIAD_COMBO") return UsersRound;
  if (type === "NUCLEUS_MEMBER_BONUS" || type === "MENTOR_FOUND_BONUS")
    return ShieldCheck;
  if (type === "PERFECT_SEQUENCE_COMBO") return Route;
  if (type === "FAIR_SURPRISE_QR") return Gift;
  if (type === "POINT_BATTLE") return Trophy;
  if (type === "CLUE_CHAIN") return Route;
  if (type === "COOPERATIVE_MISSION") return UsersRound;
  if (type === "RECOVERY_SMART") return ShieldCheck;
  if (type === "JOURNEY_COMPLETION") return Trophy;
  return QrCode;
}

function surpriseEffectLabel(_type: string) {
  return "Surpresa revelada";
}

function surpriseEffectIconFor(_type: string) {
  return Gift;
}

function passportBadgeIconFor(label: string) {
  const normalizedLabel = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalizedLabel.includes("equipa")) return UsersRound;
  if (normalizedLabel.includes("curso")) return Route;
  if (normalizedLabel.includes("anfitriao")) return MapPinCheck;
  if (normalizedLabel.includes("penaliz")) return ShieldCheck;
  if (normalizedLabel.includes("nivel")) return Award;
  if (normalizedLabel.includes("presenca")) return MapPinCheck;
  if (normalizedLabel.includes("stand") || normalizedLabel.includes("explorador"))
    return Rocket;
  if (
    normalizedLabel.includes("workshop") ||
    normalizedLabel.includes("palestra") ||
    normalizedLabel.includes("mestre")
  )
    return CalendarClock;
  if (
    normalizedLabel.includes("conector") ||
    normalizedLabel.includes("network") ||
    normalizedLabel.includes("intercurso")
  )
    return Network;
  if (
    normalizedLabel.includes("desafio") ||
    normalizedLabel.includes("quiz") ||
    normalizedLabel.includes("pergunta")
  )
    return Puzzle;
  return BadgeCheck;
}

function exhibitorOpportunityIconFor(icon?: string | null) {
  if (icon === "route") return Route;
  if (icon === "feedback") return FileText;
  if (icon === "stand") return MapPinCheck;
  if (icon === "network") return Network;
  if (icon === "jury") return Crown;
  if (icon === "shield") return ShieldCheck;
  if (icon === "zap") return Zap;
  if (icon === "user-plus") return UserPlus;
  if (icon === "layers") return Layers3;
  if (icon === "crown") return Crown;
  if (icon === "trophy") return Trophy;
  if (icon === "award") return Award;
  if (icon === "users") return UsersRound;
  if (icon === "vote") return Send;
  return BadgeCheck;
}

function exhibitorOpportunityStatusLabel(status: string) {
  if (status === "done") return "feito";
  if (status === "attention") return "atenção";
  if (status === "locked") return "bloqueado";
  return "disponível";
}

function exhibitorOpportunityStatusClass(status: string) {
  if (status === "done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "attention") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "locked") return "border-slate-200 bg-slate-100 text-slate-500";
  return "border-orange-200 bg-orange-50 text-orange-700";
}

function exhibitorRoundPhaseLabel(phase: string) {
  if (phase === "current") return "Agora";
  if (phase === "next") return "Próxima";
  if (phase === "past") return "Fechada";
  if (phase === "upcoming") return "Depois";
  return "Encerrada";
}

function surpriseEffectTone(type: string) {
  if (type === "ADD_POINTS") return "surprise-reveal--points";
  if (type === "SUBTRACT_POINTS") return "surprise-reveal--risk";
  if (type === "MULTIPLY_BONUS") return "surprise-reveal--turbo";
  if (type === "DIVIDE_BONUS") return "surprise-reveal--fragment";
  return "surprise-reveal--points";
}

function projectChallengeStatusLabel(status?: string | null) {
  if (status === "APPROVED") return "Aprovado";
  if (status === "PENDING_APPROVAL") return "Pendente admin";
  if (status === "PAUSED") return "Pausado";
  if (status === "REJECTED") return "Recusado";
  return "Por criar";
}

function projectChallengeStatusClass(status?: string | null) {
  if (status === "APPROVED")
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  if (status === "PENDING_APPROVAL")
    return "border-amber-500/25 bg-amber-50 text-amber-800";
  if (status === "PAUSED")
    return "border-slate-300 bg-slate-100 text-slate-700";
  if (status === "REJECTED")
    return "border-rose-500/25 bg-rose-50 text-rose-800";
  return "border-violet-500/25 bg-violet-500/10 text-violet-700";
}

function draftFromProjectChallenge(
  challenge?: DigitalPassportOwnedProjectChallenge | null,
): ProjectChallengeDraft {
  return {
    question: challenge?.challenge?.question ?? "",
    options: challenge?.challenge?.options?.join("\n") ?? "",
    correctAnswer: "",
    explanation: challenge?.challenge?.explanation ?? "",
    maxAttempts: String(challenge?.challenge?.maxAttempts ?? 1),
  };
}

function clampProjectChallengeAttempts(value: string | number | null | undefined) {
  const parsed = Number.parseInt(String(value ?? "1").replace(/\D/g, ""), 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(5, parsed));
}

function playScanConfirmationTone(
  tone: ScanCelebration["tone"],
  effect: ScanCelebration["effect"] = "ready",
) {
  if (typeof window === "undefined") return;
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const audio = new AudioContextCtor();
    const now = audio.currentTime;

    // Select notes and waveform based on effect/tone
    const isNegative = effect === "loss" || effect === "sad";
    const notes =
      effect === "victory"
        ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
        : effect === "loss"
          ? [349.23, 293.66, 246.94, 196, 146.83]
          : effect === "sad"
            ? [440, 349.23, 293.66, 261.63]
            : tone === "surprise"
              ? [392, 523.25, 659.25, 783.99, 1046.5]
              : tone === "challenge"
                ? [440, 554.37, 659.25, 880]
                : tone === "warning"
                  ? [440, 349.23, 440]
                  : tone === "blocked"
                    ? [293.66, 246.94, 220]
                    : [523.25, 659.25, 783.99, 1046.5];

    const waveform: OscillatorType = isNegative ? "sawtooth" : "sine";
    const stepDuration = isNegative ? 0.14 : effect === "victory" ? 0.09 : 0.085;
    const noteDuration = isNegative ? 0.38 : effect === "victory" ? 0.28 : 0.22;
    const peakGain = isNegative ? 0.055 : 0.07;

    notes.forEach((frequency, index) => {
      const start = now + index * stepDuration;

      // Primary oscillator
      const osc1 = audio.createOscillator();
      const gain1 = audio.createGain();
      osc1.type = waveform;
      osc1.frequency.value = frequency;
      gain1.gain.setValueAtTime(0.0001, start);
      gain1.gain.exponentialRampToValueAtTime(peakGain, start + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration);
      osc1.connect(gain1);
      gain1.connect(audio.destination);
      osc1.start(start);
      osc1.stop(start + noteDuration + 0.02);

      // Harmonic layer (detuned slightly for warmth)
      if (!isNegative) {
        const osc2 = audio.createOscillator();
        const gain2 = audio.createGain();
        osc2.type = "triangle";
        osc2.frequency.value = frequency * 2.002;
        gain2.gain.setValueAtTime(0.0001, start);
        gain2.gain.exponentialRampToValueAtTime(peakGain * 0.25, start + 0.03);
        gain2.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration * 0.7);
        osc2.connect(gain2);
        gain2.connect(audio.destination);
        osc2.start(start);
        osc2.stop(start + noteDuration);
      }
    });

    // Victory: add a final shimmer chord
    if (effect === "victory") {
      const chordStart = now + notes.length * stepDuration + 0.04;
      [1046.5, 1318.51, 1567.98].forEach((freq) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, chordStart);
        gain.gain.exponentialRampToValueAtTime(0.04, chordStart + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, chordStart + 0.5);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(chordStart);
        osc.stop(chordStart + 0.55);
      });
    }

    window.setTimeout(() => void audio.close().catch(() => undefined), 1200);
  } catch {
    // Som de confirmação é progressivo; se o browser bloquear, a UI continua normal.
  }
}

function scanFeedbackForResult(result: QrScanResult | DigitalPassportChallengeAnswerResult): Partial<ScanCelebration> {
  const status = "result" in result ? result.result : result.status;
  const actionType = "actionType" in result ? result.actionType : "";
  const fallbackMessage = result.message;
  const blockedMessages: Record<string, { title: string; message: string; tone: ScanCelebration["tone"]; effect: ScanCelebration["effect"] }> = {
    SELF_SCAN: {
      title: "Regra do espelho",
      message: "Apanhado no espelho. Esse QR é teu, campeão.",
      tone: "warning",
      effect: "ready",
    },
    SELF_STAND: {
      title: "A casa conhece a casa",
      message: "Boa tentativa, mas a casa não joga contra si mesma.",
      tone: "warning",
      effect: "ready",
    },
    SELF_CHALLENGE: {
      title: "Pergunta de autor",
      message: "O autor da pergunta não pode ganhar o prémio por saber a resposta.",
      tone: "blocked",
      effect: "sad",
    },
    ALREADY_AWARDED: {
      title: actionType === "NUCLEUS_MEMBER_BONUS" ? "Crachá repetido" : "QR já registado",
      message:
        actionType === "NUCLEUS_MEMBER_BONUS"
          ? "Esse crachá já assinou o teu passaporte. Vai conhecer outro."
          : fallbackMessage,
      tone: actionType === "NUCLEUS_MEMBER_BONUS" ? "educational" : "warning",
      effect: "ready",
    },
    EXPIRED: {
      title: "Fora de cena",
      message: "Chegaste depois dos créditos finais. Este QR já saiu de cena.",
      tone: "warning",
      effect: "sad",
    },
    SAME_COURSE: {
      title: "Mistura necessária",
      message: "Boa conversa, mas os pontos são para misturar cursos.",
      tone: "educational",
      effect: "ready",
    },
    CHALLENGE_SCAN_REQUIRED: {
      title: "QR do expositor primeiro",
      message: "Este desafio só abre depois de escaneares o QR pessoal do expositor.",
      tone: "educational",
      effect: "ready",
    },
  };

  return blockedMessages[status] ?? {
    title: status === "ALREADY_DONE" ? "QR já registado" : undefined,
    message: fallbackMessage,
  };
}

function normalizePassportStatus(status: string): PassportMissionStatus {
  if (status === "done" || status === "available" || status === "locked")
    return status;
  return "locked";
}

function normalizeSocialUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buildProfileDraft(
  student: ReturnType<typeof getSessionStudent>,
  profileState: StudentProfileState | null,
): ProfileDraft {
  const extra = profileState?.profileExtra;
  return {
    name: student?.name ?? "",
    phone: student?.phone ?? "",
    alternatePhone: student?.alternatePhone ?? "",
    avatarUrl: student?.avatarUrl ?? "",
    bio: student?.bio ?? extra?.bio ?? "",
    address: student?.address ?? extra?.address ?? "",
    instagramUrl: student?.instagramUrl ?? extra?.instagramUrl ?? "",
    facebookUrl: student?.facebookUrl ?? extra?.facebookUrl ?? "",
    linkedinUrl: student?.linkedinUrl ?? extra?.linkedinUrl ?? "",
    githubUrl: student?.githubUrl ?? extra?.githubUrl ?? "",
    websiteUrl: student?.websiteUrl ?? extra?.websiteUrl ?? "",
    consentPhotoCredential: extra?.consentPhotoCredential ?? false,
    consentPublicProfile: extra?.consentPublicProfile ?? false,
    consentSocialLinks: extra?.consentSocialLinks ?? false,
    consentSms: extra?.consentSms ?? false,
    consentWhatsapp: extra?.consentWhatsapp ?? false,
    visibility: parseProfileVisibility(extra?.visibilityJson),
  };
}

function buildProjectPublicDetailsDraft(
  submission: StudentOwnedSubmissionListItem,
): ProjectPublicDetailsDraft {
  return {
    description: submission.description ?? "",
    repoUrl: submission.repoUrl ?? "",
    websiteUrl: submission.websiteUrl ?? "",
    instagramUrl: submission.instagramUrl ?? "",
    facebookUrl: submission.facebookUrl ?? "",
    linkedinUrl: submission.linkedinUrl ?? "",
    githubUrl: submission.githubUrl ?? "",
  };
}

function normalizeProjectPublicLink(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function projectPublicLinksCount(draft: ProjectPublicDetailsDraft) {
  return [
    draft.repoUrl,
    draft.websiteUrl,
    draft.instagramUrl,
    draft.facebookUrl,
    draft.linkedinUrl,
    draft.githubUrl,
  ].filter((value) => value.trim().length > 0).length;
}

export default function MinhaArea() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<
    StudentOwnedSubmissionListItem[]
  >([]);
  const [enrollments, setEnrollments] = useState<StudentEnrollmentListItem[]>(
    [],
  );
  const [attendance, setAttendance] = useState<AttendanceMePayload | null>(
    null,
  );
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [submissionsOpen, setSubmissionsOpen] = useState(true);
  const [student, setStudent] = useState(() => getSessionStudent());
  const [profileState, setProfileState] = useState<StudentProfileState | null>(
    null,
  );
  const [teamMemberDrafts, setTeamMemberDrafts] = useState<
    Record<number, string>
  >({});
  const [teamMemberStudentNumberDrafts, setTeamMemberStudentNumberDrafts] =
    useState<Record<number, string>>({});
  const [teamMemberExternalDrafts, setTeamMemberExternalDrafts] = useState<
    Record<number, TeamMemberExternalDraft>
  >({});
  const [teamMemberExternalCredentials, setTeamMemberExternalCredentials] =
    useState<Record<number, ExternalTeamMemberCredentials>>({});
  const [confirmingExternalTeamMemberId, setConfirmingExternalTeamMemberId] =
    useState<number | null>(null);
  const [dismissedJourneyAlertKeys, setDismissedJourneyAlertKeys] = useState<
    string[]
  >(() => readDismissedJourneyAlertKeys());
  const [submissionBannerDrafts, setSubmissionBannerDrafts] = useState<
    Record<number, string | null | undefined>
  >({});
  const [projectPublicDetailsDrafts, setProjectPublicDetailsDrafts] =
    useState<Record<number, ProjectPublicDetailsDraft>>({});
  const [savingProjectPublicDetailsId, setSavingProjectPublicDetailsId] =
    useState<number | null>(null);
  const [savingBannerId, setSavingBannerId] = useState<number | null>(null);
  const [addingTeamMemberId, setAddingTeamMemberId] = useState<number | null>(
    null,
  );
  const [removingTeamMemberId, setRemovingTeamMemberId] = useState<
    number | null
  >(null);
  const [savingTeamMemberStudentNumberId, setSavingTeamMemberStudentNumberId] =
    useState<number | null>(null);
  const [downloadingCertificateId, setDownloadingCertificateId] = useState<
    number | null
  >(null);
  const [downloadingExhibitorId, setDownloadingExhibitorId] = useState<
    number | null
  >(null);
  const [teamCredentialData, setTeamCredentialData] =
    useState<MyTeamCredentialResponse | null>(null);
  const [downloadingTeamPass, setDownloadingTeamPass] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<QrScanResult | null>(null);
  const [constructiveFeedbackScannerOpen, setConstructiveFeedbackScannerOpen] =
    useState(false);
  const [resolvingConstructiveFeedbackProject, setResolvingConstructiveFeedbackProject] =
    useState(false);
  const [constructiveFeedbackProject, setConstructiveFeedbackProject] =
    useState<ConstructiveFeedbackProject | null>(null);
  const [constructiveFeedbackText, setConstructiveFeedbackText] = useState("");
  const [constructiveFeedbackFocus, setConstructiveFeedbackFocus] =
    useState<DigitalPassportConstructiveFeedbackFocus>("clareza");
  const [submittingConstructiveFeedback, setSubmittingConstructiveFeedback] =
    useState(false);
  const [scanHistory, setScanHistory] = useState<StudentScanHistoryItem[]>([]);
  const [passportSummary, setPassportSummary] =
    useState<DigitalPassportSummary | null>(null);
  const [exhibitorPassportSummary, setExhibitorPassportSummary] =
    useState<StudentExhibitorPassportSummary | null>(null);
  const [passportLeaderboard, setPassportLeaderboard] = useState<
    DigitalPassportRankingRow[]
  >([]);
  const [networkingQr, setNetworkingQr] =
    useState<DigitalPassportNetworkingQr | null>(null);
  const [passportReferralCode, setPassportReferralCode] = useState<string | null>(
    null,
  );
  const [passportReferralInvite, setPassportReferralInvite] =
    useState<DigitalPassportReferralInvite | null>(null);
  const [projectChallenges, setProjectChallenges] = useState<
    DigitalPassportOwnedProjectChallenge[]
  >([]);
  const [projectChallengeDrafts, setProjectChallengeDrafts] = useState<
    Record<number, ProjectChallengeDraft>
  >({});
  const [savingProjectChallengeId, setSavingProjectChallengeId] = useState<
    number | null
  >(null);
  const [selectedVoteQrSubmission, setSelectedVoteQrSubmission] =
    useState<StudentOwnedSubmissionListItem | null>(null);
  const [voteQrImageUrl, setVoteQrImageUrl] = useState("");
  const [voteQrFailed, setVoteQrFailed] = useState(false);
  const [joiningPassport, setJoiningPassport] = useState(false);
  const [downloadingChallengeManual, setDownloadingChallengeManual] =
    useState(false);
  const [scanCelebration, setScanCelebration] =
    useState<ScanCelebration | null>(null);
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [answeringChallenge, setAnsweringChallenge] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(
    searchParams.get("edit") === "perfil",
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(() =>
    buildProfileDraft(getSessionStudent(), null),
  );
  const [activeTab, setActiveTab] = useState<StudentAreaTab>(() =>
    normalizeStudentAreaTab(searchParams.get("tab")),
  );
  const passportReferralAutoJoinRef = useRef<string | null>(null);
  const autoScanTokenRef = useRef<string | null>(null);
  const handleScanRef = useRef<(tokenValue: string) => Promise<void>>(
    async () => undefined,
  );
  const exhibitorPassportEventRef = useRef<string | null>(null);
  const selectedVoteQrUrl = selectedVoteQrSubmission
    ? buildOwnedSubmissionVoteQrUrl(selectedVoteQrSubmission)
    : "";

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "UOR Connect | Minha Área";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setVoteQrImageUrl("");
    setVoteQrFailed(false);

    if (!selectedVoteQrUrl) return undefined;

    createQrDataUrl(selectedVoteQrUrl, 260)
      .then((dataUrl) => {
        if (isMounted) setVoteQrImageUrl(dataUrl);
      })
      .catch(() => {
        if (isMounted) setVoteQrFailed(true);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedVoteQrUrl]);

  useEffect(() => {
    let active = true;

    Promise.all([
      api.auth.me(),
      api.submissions.mine(),
      api.submissions
        .exhibitorPassportMine()
        .catch(() => null as StudentExhibitorPassportSummary | null),
      api.courses.enrollmentsMine(),
      api.attendance.me(),
      api.certificates.mine(),
      api.attendance.myScans().catch(() => [] as StudentScanHistoryItem[]),
      api.passport.me().catch(() => null as DigitalPassportSummary | null),
      api.passport
        .leaderboard(8)
        .catch(() => [] as DigitalPassportRankingRow[]),
      api.passport
        .networkingQr()
        .catch(() => null as DigitalPassportNetworkingQr | null),
      api.passport
        .myProjectChallenges()
        .catch(() => [] as DigitalPassportOwnedProjectChallenge[]),
      api.teamCredentials
        .myCredential()
        .catch(() => null as MyTeamCredentialResponse | null),
      api.auth.profileState().catch(() => null as StudentProfileState | null),
      api.submissions.config().catch(() => null),
    ])
      .then(
        ([
          sessionStudent,
          submissionItems,
          exhibitorPassport,
          enrollmentItems,
          attendancePayload,
          certificateItems,
          scanItems,
          passport,
          leaderboardRows,
          nextNetworkingQr,
          nextProjectChallenges,
          teamCred,
          nextProfileState,
          config,
        ]) => {
          if (!active) return;
          setStudent(sessionStudent);
          setSubmissions(submissionItems);
          setExhibitorPassportSummary(exhibitorPassport);
          setSubmissionBannerDrafts(
            submissionItems.reduce<Record<number, string | null>>(
              (acc, item) => {
                acc[item.id] = item.bannerUrl ?? null;
                return acc;
              },
              {},
            ),
          );
          setProjectPublicDetailsDrafts(
            submissionItems.reduce<Record<number, ProjectPublicDetailsDraft>>(
              (acc, item) => {
                acc[item.id] = buildProjectPublicDetailsDraft(item);
                return acc;
              },
              {},
            ),
          );
          setEnrollments(enrollmentItems);
          setAttendance(attendancePayload);
          setCertificates(certificateItems);
          setScanHistory(scanItems);
          setPassportSummary(passport);
          setPassportLeaderboard(leaderboardRows);
          setNetworkingQr(nextNetworkingQr);
          setProjectChallenges(nextProjectChallenges);
          setProjectChallengeDrafts((current) => {
            const next = { ...current };
            nextProjectChallenges.forEach((challenge) => {
              if (!next[challenge.submissionId])
                next[challenge.submissionId] =
                  draftFromProjectChallenge(challenge);
            });
            return next;
          });
          if (teamCred) setTeamCredentialData(teamCred);
          if (nextProfileState) setProfileState(nextProfileState);
          setSubmissionsOpen(config?.isOpen ?? true);
        },
      )
      .catch((error) => {
        if (!active) return;

        if (isAuthError(error)) {
          setToken(null);
          setStudent(null);
          navigate(`/login?redirect=${encodeURIComponent("/minha-area")}`, {
            replace: true,
          });
          return;
        }

        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar a tua área.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    setActiveTab(normalizeStudentAreaTab(tabParam));
    setProfileEditorOpen(searchParams.get("edit") === "perfil");
  }, [searchParams]);

  useEffect(() => {
    const code =
      searchParams.get("convite")?.trim() ?? searchParams.get("ref")?.trim();
    if (!code) {
      setPassportReferralCode(null);
      setPassportReferralInvite(null);
      return;
    }

    setPassportReferralCode(code);
    let active = true;
    api.passport
      .referralInvite(code)
      .then((invite) => {
        if (active) setPassportReferralInvite(invite);
      })
      .catch(() => {
        if (!active) return;
        setPassportReferralCode(null);
        setPassportReferralInvite(null);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("convite");
        nextParams.delete("ref");
        nextParams.delete("aceitarConvite");
        setSearchParams(nextParams, { replace: true });
      });

    return () => {
      active = false;
    };
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setProfileDraft(buildProfileDraft(student, profileState));
  }, [profileState, student]);

  useEffect(() => {
    const position = passportSummary?.ranking?.position;
    const studentNumber = student?.studentNumber;
    if (!position || !studentNumber || typeof window === "undefined") return;

    const storageKey = `uor-passport-ranking:${studentNumber}`;
    const previousRaw = window.localStorage.getItem(storageKey);
    const previousPosition = previousRaw ? Number(previousRaw) : null;

    if (
      previousPosition &&
      Number.isFinite(previousPosition) &&
      position < previousPosition
    ) {
      const gained = previousPosition - position;
      const message =
        gained === 1
          ? "Subiste 1 posição. A corrida mexeu a teu favor."
          : `Subiste ${gained} posições. A corrida mexeu a teu favor.`;
      setScanCelebration({
        title: "Virada de Ranking",
        message,
        points: 0,
        tone: "success",
        actionLabel: `Agora estás em #${position}`,
        effect: "victory",
      });
      playScanConfirmationTone("success", "victory");
    }

    window.localStorage.setItem(storageKey, String(position));
  }, [passportSummary?.ranking?.position, student?.studentNumber]);

  const resolveSubmissionBannerPreview = (
    submission: StudentOwnedSubmissionListItem,
  ) => {
    const draft = submissionBannerDrafts[submission.id];
    return draft !== undefined ? draft : submission.bannerUrl;
  };

  const updateProfileDraft = <Key extends keyof ProfileDraft>(
    key: Key,
    value: ProfileDraft[Key],
  ) => {
    setProfileDraft((current) => ({ ...current, [key]: value }));
  };

  const updateProfileVisibility = (
    key: keyof ProfileVisibilityDraft,
    value: boolean,
  ) => {
    setProfileDraft((current) => ({
      ...current,
      visibility: {
        ...current.visibility,
        [key]: value,
      },
    }));
  };

  const profileConsentValues: ProfileConsentValues = {
    consentPublicProfile: profileDraft.consentPublicProfile,
    consentPhotoCredential: profileDraft.consentPhotoCredential,
    consentSocialLinks: profileDraft.consentSocialLinks,
    consentSms: profileDraft.consentSms,
    consentWhatsapp: profileDraft.consentWhatsapp,
  };

  const updateProfileConsentValue = <Field extends keyof ProfileConsentValues>(
    field: Field,
    value: ProfileConsentValues[Field],
  ) => {
    updateProfileDraft(field, value);
  };

  const openProfileEditor = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("edit", "perfil");
    setSearchParams(nextParams);
  };

  const closeProfileEditor = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("edit");
    setSearchParams(nextParams, { replace: true });
  };

  const handleProfileAvatarFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seleciona uma imagem válida.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5 MB.");
      return;
    }

    try {
      const dataUrl = await readCompressedImageFileAsDataUrl(file, {
        maxLength: 460_000,
        maxDimension: 512,
      });
      const uploaded = await api.media.uploadDataUrl(dataUrl, "avatars", {
        maxImageDimension: 900,
      });
      updateProfileDraft("avatarUrl", uploaded.url);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a fotografia.",
      );
    }
  };

  const handleSaveProfile = async () => {
    if (profileDraft.name.trim().length < 2) {
      toast.info("Preenche o teu nome completo.");
      return;
    }

    const draftHasSocials = [
      profileDraft.instagramUrl,
      profileDraft.facebookUrl,
      profileDraft.linkedinUrl,
      profileDraft.githubUrl,
      profileDraft.websiteUrl,
    ].some((value) => value.trim().length > 0);

    const payload: StudentProfileUpdateInput = {
      name: profileDraft.name.trim(),
      phone: profileDraft.phone.trim() || undefined,
      alternatePhone: profileDraft.alternatePhone.trim() || null,
      avatarUrl: profileDraft.avatarUrl.trim() || null,
      bio: profileDraft.bio.trim() || null,
      address: profileDraft.address.trim() || null,
      instagramUrl: normalizeSocialUrl(profileDraft.instagramUrl),
      facebookUrl: normalizeSocialUrl(profileDraft.facebookUrl),
      linkedinUrl: normalizeSocialUrl(profileDraft.linkedinUrl),
      githubUrl: normalizeSocialUrl(profileDraft.githubUrl),
      websiteUrl: normalizeSocialUrl(profileDraft.websiteUrl),
      consentPhotoCredential: Boolean(
        profileDraft.avatarUrl.trim() && profileDraft.consentPhotoCredential,
      ),
      consentPublicProfile: profileDraft.consentPublicProfile,
      consentSocialLinks: Boolean(
        draftHasSocials && profileDraft.consentSocialLinks,
      ),
      consentSms: profileDraft.consentSms,
      consentWhatsapp: profileDraft.consentWhatsapp,
      visibilityJson: JSON.stringify({
        ...profileDraft.visibility,
        email: false,
        phone: false,
        address: false,
      }),
    };

    try {
      setSavingProfile(true);
      const updatedStudent = await api.auth.updateMe(payload);
      setStudent(updatedStudent);
      const nextProfileState = await api.auth
        .profileState()
        .catch(() => null as StudentProfileState | null);
      if (nextProfileState) setProfileState(nextProfileState);
      toast.success("Perfil atualizado.");
      closeProfileEditor();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o perfil.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmissionBannerFile = async (
    submission: StudentOwnedSubmissionListItem,
    file: File | null,
  ) => {
    if (!file) return;

    if (submission.status !== "APPROVED") {
      toast.info("A foto da capa só fica disponível depois da aprovação.");
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
      const uploaded = await api.media.uploadDataUrl(
        dataUrl,
        "submission-banners",
        { maxImageDimension: 1600 },
      );
      setSubmissionBannerDrafts((current) => ({
        ...current,
        [submission.id]: uploaded.url,
      }));
      toast.success(
        'Imagem carregada. Clica em "Guardar foto" para publicar no card.',
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao processar imagem.",
      );
    }
  };

  const handleSaveOwnBanner = async (
    submission: StudentOwnedSubmissionListItem,
  ) => {
    if (submission.status !== "APPROVED") {
      toast.info("A foto da capa só fica disponível depois da aprovação.");
      return;
    }

    const nextBannerUrl = resolveSubmissionBannerPreview(submission) ?? null;

    try {
      setSavingBannerId(submission.id);
      const updated = await api.submissions.updateOwnPresentation(
        submission.id,
        { bannerUrl: nextBannerUrl },
      );
      setSubmissions((current) =>
        current.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                bannerUrl: updated.bannerUrl ?? null,
                detailPath: updated.detailPath,
              }
            : item,
        ),
      );
      setSubmissionBannerDrafts((current) => ({
        ...current,
        [submission.id]: updated.bannerUrl ?? null,
      }));
      toast.success("Foto da capa atualizada.");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setStudent(null);
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a capa.",
      );
    } finally {
      setSavingBannerId(null);
    }
  };

  const handleRemoveOwnBanner = async (
    submission: StudentOwnedSubmissionListItem,
  ) => {
    if (submission.status !== "APPROVED") {
      toast.info("A foto da capa só fica disponível depois da aprovação.");
      return;
    }

    try {
      setSavingBannerId(submission.id);
      const updated = await api.submissions.updateOwnPresentation(
        submission.id,
        { bannerUrl: null },
      );
      setSubmissions((current) =>
        current.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                bannerUrl: null,
                detailPath: updated.detailPath,
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
      if (isAuthError(error)) {
        setToken(null);
        setStudent(null);
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível remover a capa.",
      );
    } finally {
      setSavingBannerId(null);
    }
  };

  const updateProjectPublicDetailsDraft = (
    submissionId: number,
    patch: Partial<ProjectPublicDetailsDraft>,
  ) => {
    setProjectPublicDetailsDrafts((current) => ({
      ...current,
      [submissionId]: {
        ...(current[submissionId] ?? {
          description: "",
          repoUrl: "",
          websiteUrl: "",
          instagramUrl: "",
          facebookUrl: "",
          linkedinUrl: "",
          githubUrl: "",
        }),
        ...patch,
      },
    }));
  };

  const handleSaveProjectPublicDetails = async (
    submission: StudentOwnedSubmissionListItem,
  ) => {
    if (submission.status !== "APPROVED") {
      toast.info("Os detalhes públicos só ficam disponíveis depois da aprovação.");
      return;
    }

    if (submission.canManagePresentation === false) {
      toast.info("Apenas o responsável pode alterar os detalhes públicos.");
      return;
    }

    const draft =
      projectPublicDetailsDrafts[submission.id] ??
      buildProjectPublicDetailsDraft(submission);
    const description = draft.description.trim();

    if (description.length > 0 && description.length < 10) {
      toast.error("A descrição deve ter pelo menos 10 caracteres.");
      return;
    }

    try {
      setSavingProjectPublicDetailsId(submission.id);
      const updated = await api.submissions.updateOwnPresentation(
        submission.id,
        {
          description,
          repoUrl: normalizeProjectPublicLink(draft.repoUrl),
          websiteUrl: normalizeProjectPublicLink(draft.websiteUrl),
          instagramUrl: normalizeProjectPublicLink(draft.instagramUrl),
          facebookUrl: normalizeProjectPublicLink(draft.facebookUrl),
          linkedinUrl: normalizeProjectPublicLink(draft.linkedinUrl),
          githubUrl: normalizeProjectPublicLink(draft.githubUrl),
        },
      );
      setSubmissions((current) =>
        current.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                description: updated.description,
                detailPath: updated.detailPath,
                repoUrl: updated.repoUrl,
                websiteUrl: updated.websiteUrl,
                instagramUrl: updated.instagramUrl,
                facebookUrl: updated.facebookUrl,
                linkedinUrl: updated.linkedinUrl,
                githubUrl: updated.githubUrl,
              }
            : item,
        ),
      );
      setProjectPublicDetailsDrafts((current) => ({
        ...current,
        [submission.id]: {
          description: updated.description,
          repoUrl: updated.repoUrl ?? "",
          websiteUrl: updated.websiteUrl ?? "",
          instagramUrl: updated.instagramUrl ?? "",
          facebookUrl: updated.facebookUrl ?? "",
          linkedinUrl: updated.linkedinUrl ?? "",
          githubUrl: updated.githubUrl ?? "",
        },
      }));
      toast.success("Detalhes públicos atualizados.");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setStudent(null);
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar os detalhes públicos.",
      );
    } finally {
      setSavingProjectPublicDetailsId(null);
    }
  };

  const handleTabChange = (next: string) => {
    const normalized = normalizeStudentAreaTab(next);
    setActiveTab(normalized);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", normalized);
    setSearchParams(nextParams);
  };

  const showScanCelebration = (celebration: ScanCelebration) => {
    setScanCelebration(celebration);
    playScanConfirmationTone(celebration.tone, celebration.effect);
  };

  useEffect(() => {
    const latestEvent = exhibitorPassportSummary?.activeProject?.recentEvents[0];
    if (!student?.studentNumber || !latestEvent || latestEvent.effect === "NEUTRAL")
      return;

    const storageKey = `uor-exhibitor-passport-event:${student.studentNumber}:${latestEvent.submissionId}`;
    const currentKey = `${latestEvent.businessKey}:${latestEvent.points}`;

    if (exhibitorPassportEventRef.current === currentKey) return;
    if (window.localStorage.getItem(storageKey) === currentKey) return;

    exhibitorPassportEventRef.current = currentKey;
    window.localStorage.setItem(storageKey, currentKey);

    const eventTime = Date.parse(latestEvent.awardedAt);
    const sixHoursMs = 6 * 60 * 60 * 1000;
    if (Number.isFinite(eventTime) && Date.now() - eventTime > sixHoursMs) return;

    const celebration = buildExhibitorPassportCelebration(latestEvent);
    if (!celebration) return;
    showScanCelebration(celebration);
  }, [
    exhibitorPassportSummary?.activeProject?.recentEvents,
    student?.studentNumber,
  ]);

  const handleJoinPassport = async (options?: { autoAccepted?: boolean }) => {
    if (joiningPassport) return;

    setJoiningPassport(true);
    try {
      const result = await api.passport.join(
        getCookie("uor_visitor_id"),
        passportReferralCode,
      );
      setPassportSummary(result.summary);
      setPassportReferralInvite(null);
      clearPassportReferralAccepted();
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", "desafio");
      nextParams.delete("aceitarConvite");
      setSearchParams(nextParams, { replace: true });
      const leaderboardRows = await api.passport
        .leaderboard(8)
        .catch(() => passportLeaderboard);
      setPassportLeaderboard(leaderboardRows);
      const joinPoints = getPassportJoinAwardedPoints(result.summary);
      showScanCelebration({
        title: options?.autoAccepted ? "Convite aceite" : "Entraste no Desafio",
        message:
          options?.autoAccepted
            ? "O teu Passaporte Digital foi ativado na aba Desafios. Agora cada QR certo conta para o ranking."
            : "A tua jornada na feira já está ativa. Agora cada QR certo conta para o ranking.",
        points: joinPoints,
        tone: "challenge",
        actionLabel: "Passaporte Digital",
        effect: "victory",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar no desafio.",
      );
    } finally {
      setJoiningPassport(false);
    }
  };

  const handleDeclinePassportReferral = () => {
    clearPassportReferralAccepted();
    setPassportReferralInvite(null);
    setPassportReferralCode(null);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", "desafio");
    nextParams.delete("convite");
    nextParams.delete("ref");
    nextParams.delete("aceitarConvite");
    setSearchParams(nextParams, { replace: true });
    toast.info("Convite recusado. Podes entrar no desafio quando quiseres.");
  };

  const handleScan = async (tokenValue: string) => {
    const trimmed = tokenValue.trim();
    if (!trimmed) return;

    setScanning(true);
    setScanResult(null);
    setChallengeAnswer("");
    try {
      const result = await api.attendance.scan({ token: trimmed });
      setScanResult(result);
      const celebrationPoints =
        result.surprise?.deltaPoints ?? result.pointsAwarded ?? 0;
      const feedback = scanFeedbackForResult(result);
      if (result.success) {
        const scanEffect: ScanCelebration["effect"] = result.surprise
          ? result.surprise.deltaPoints < 0
            ? "loss"
            : "victory"
          : result.requiresAnswer
            ? "ready"
            : (result.pointsAwarded ?? 0) > 0
              ? "victory"
              : "ready";
        showScanCelebration({
          title: feedback.title ?? (result.requiresAnswer
            ? "Desafio liberado"
            : result.surprise
              ? "QR surpresa encontrado"
              : "QR validado"),
          message: feedback.message ?? result.surprise?.hint ?? result.message,
          points: celebrationPoints,
          tone: feedback.tone ?? (result.surprise
            ? "surprise"
            : result.requiresAnswer
              ? "challenge"
              : "success"),
          actionLabel: result.actionLabel,
          effect: feedback.effect ?? scanEffect,
        });
        toast.success(
          result.pointsAwarded && result.pointsAwarded > 0
            ? `${result.message} +${result.pointsAwarded} pontos no Passaporte.`
            : result.message,
        );
        // Reload data to reflect the change
        const [
          newAttendance,
          newEnrollments,
          newScans,
          newPassport,
          newLeaderboard,
          newExhibitorPassport,
        ] = await Promise.all([
          api.attendance.me().catch(() => attendance),
          api.courses.enrollmentsMine().catch(() => enrollments),
          api.attendance.myScans().catch(() => scanHistory),
          api.passport.me().catch(() => passportSummary),
          api.passport.leaderboard(8).catch(() => passportLeaderboard),
          api.submissions
            .exhibitorPassportMine()
            .catch(() => exhibitorPassportSummary),
        ]);
        if (newAttendance) setAttendance(newAttendance);
        if (newEnrollments) setEnrollments(newEnrollments);
        if (newScans) setScanHistory(newScans);
        if (newPassport) setPassportSummary(newPassport);
        if (newLeaderboard) setPassportLeaderboard(newLeaderboard);
        if (newExhibitorPassport) setExhibitorPassportSummary(newExhibitorPassport);
      } else {
        showScanCelebration({
          title: feedback.title ?? (
            result.result === "ALREADY_DONE"
              ? "QR já registado"
              : "QR não validado"
          ),
          message: feedback.message ?? result.message,
          points: celebrationPoints,
          tone: feedback.tone ?? "challenge",
          actionLabel: result.actionLabel || "Leitura recusada",
          effect:
            feedback.effect ??
            (result.result === "ALREADY_DONE" ? "ready" : "sad"),
        });
        toast.info(result.message);
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Falha ao processar o QR.";
      toast.error(msg);
      setScanResult({
        success: false,
        result: "ERROR",
        message: msg,
        actionType: "",
        actionLabel: "",
      });
      showScanCelebration({
        title: "Leitura recusada",
        message: msg,
        points: 0,
        tone: "challenge",
        actionLabel: "QR não validado",
        effect: "sad",
      });
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    handleScanRef.current = handleScan;
  });

  useEffect(() => {
    const autoScanToken = searchParams.get("scan")?.trim();
    if (!autoScanToken || loading) return;
    if (autoScanTokenRef.current === autoScanToken) return;

    autoScanTokenRef.current = autoScanToken;
    setActiveTab("desafio");

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", "desafio");
    nextParams.delete("scan");
    setSearchParams(nextParams, { replace: true });

    void handleScanRef.current(autoScanToken);
  }, [loading, searchParams, setSearchParams]);

  const resetConstructiveFeedbackDialog = () => {
    setConstructiveFeedbackProject(null);
    setConstructiveFeedbackText("");
    setConstructiveFeedbackFocus("clareza");
  };

  const handleConstructiveFeedbackQrRead = async (tokenValue: string) => {
    if (resolvingConstructiveFeedbackProject) return;

    const slug = extractProjectSlugFromQrValue(tokenValue);
    if (!slug) {
      toast.error("Este QR não parece ser de um projeto publicado.");
      showScanCelebration({
        title: "QR de projeto não reconhecido",
        message:
          "Usa o QR do projeto ou o QR de votação do expositor para abrir a crítica construtiva.",
        points: 0,
        tone: "challenge",
        actionLabel: "Crítica construtiva",
        effect: "sad",
      });
      return;
    }

    setResolvingConstructiveFeedbackProject(true);
    setConstructiveFeedbackScannerOpen(false);
    try {
      const project = await api.interactions.projectBySlug(slug, {
        likesLimit: 0,
        commentsLimit: 0,
      });
      setConstructiveFeedbackProject({
        id: project.id,
        name: project.name,
        slug: project.slug,
        detailPath: project.detailPath,
      });
      setConstructiveFeedbackText("");
      toast.success(`Projeto identificado: ${project.name}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o projeto deste QR.";
      toast.error(message);
      showScanCelebration({
        title: "Projeto não encontrado",
        message,
        points: 0,
        tone: "challenge",
        actionLabel: "Crítica construtiva",
        effect: "sad",
      });
    } finally {
      setResolvingConstructiveFeedbackProject(false);
    }
  };

  const handleSubmitConstructiveFeedback = async () => {
    if (!constructiveFeedbackProject || submittingConstructiveFeedback) return;

    const content = constructiveFeedbackText.trim();
    if (content.length < CONSTRUCTIVE_FEEDBACK_MIN_LENGTH) {
      toast.error(
        "Escreve uma crítica mais completa: pelo menos 60 caracteres com uma sugestão real.",
      );
      return;
    }

    setSubmittingConstructiveFeedback(true);
    try {
      const result = await api.passport.constructiveFeedback({
        submissionId: constructiveFeedbackProject.id,
        content,
        focus: constructiveFeedbackFocus,
      });
      const missionProgress = `${Math.min(
        result.completedCount,
        result.requiredCount,
      )}/${result.requiredCount}`;
      const awarded = result.pointsAwarded > 0;

      if (awarded) toast.success(`${result.message} +${result.pointsAwarded} pontos.`);
      else toast.info(result.message);

      showScanCelebration({
        title: result.missionCompleted
          ? "Crítica construtiva concluída"
          : awarded
            ? "Crítica registada"
            : "Crítica já contava",
        message: `${result.message} Progresso: ${missionProgress}.`,
        points: result.pointsAwarded,
        tone: awarded ? "educational" : "challenge",
        actionLabel: "Passaporte Digital",
        effect: awarded ? "victory" : "ready",
      });

      const [newPassport, newLeaderboard] = await Promise.all([
        api.passport.me().catch(() => passportSummary),
        api.passport.leaderboard(8).catch(() => passportLeaderboard),
      ]);
      if (newPassport) setPassportSummary(newPassport);
      if (newLeaderboard) setPassportLeaderboard(newLeaderboard);
      resetConstructiveFeedbackDialog();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível registar a crítica construtiva.";
      toast.error(message);
      showScanCelebration({
        title: "Crítica não registada",
        message,
        points: 0,
        tone: "challenge",
        actionLabel: "Passaporte Digital",
        effect: "sad",
      });
    } finally {
      setSubmittingConstructiveFeedback(false);
    }
  };

  const handleChallengeAnswer = async () => {
    const challenge = scanResult?.challenge;
    const answer = challengeAnswer.trim();
    if (!challenge || !answer) return;

    setAnsweringChallenge(true);
    try {
      const result = await api.passport.answerChallenge(challenge.id, answer);
      const feedback = scanFeedbackForResult(result);
      const toastMessage =
        result.pointsAwarded > 0
          ? `${result.message} +${result.pointsAwarded} pontos.`
          : result.message;
      if (result.correct) toast.success(toastMessage);
      else toast.info(toastMessage);
      if (result.correct || result.pointsAwarded > 0) {
        showScanCelebration({
          title: feedback.title ?? (result.correct ? "Resposta validada" : "Resposta registada"),
          message: feedback.message ?? result.message,
          points: result.pointsAwarded,
          tone: feedback.tone ?? (result.pointsAwarded > 0 ? "success" : "challenge"),
          actionLabel: scanResult?.actionLabel ?? "Desafio",
          effect: feedback.effect ?? "victory",
        });
      } else {
        showScanCelebration({
          title: feedback.title ?? "Resposta errada",
          message: feedback.message ?? result.message,
          points: 0,
          tone: feedback.tone ?? "challenge",
          actionLabel: scanResult?.actionLabel ?? "Desafio",
          effect: feedback.effect ?? "sad",
        });
      }
      setChallengeAnswer("");
      setScanResult((current) =>
        current
          ? {
              ...current,
              result: result.status,
              message: result.message,
              pointsAwarded: result.pointsAwarded,
              requiresAnswer:
                !result.correct && (result.attemptsRemaining ?? 0) > 0,
            }
          : current,
      );

      const [newPassport, newScans, newLeaderboard] = await Promise.all([
        api.passport.me().catch(() => passportSummary),
        api.attendance.myScans().catch(() => scanHistory),
        api.passport.leaderboard(8).catch(() => passportLeaderboard),
      ]);
      if (newPassport) setPassportSummary(newPassport);
      if (newScans) setScanHistory(newScans);
      if (newLeaderboard) setPassportLeaderboard(newLeaderboard);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível validar a resposta.",
      );
    } finally {
      setAnsweringChallenge(false);
    }
  };

  const handleDownloadCertificate = async (certificate: CertificateItem) => {
    try {
      setDownloadingCertificateId(certificate.id);
      const blob = await api.certificates.pdf(certificate.id);
      downloadBlobFile(blob, `${certificate.code.toLowerCase()}.pdf`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao baixar o certificado.",
      );
    } finally {
      setDownloadingCertificateId(null);
    }
  };

  const handleDownloadTeamPass = async (credential: TeamCredentialMember) => {
    try {
      setDownloadingTeamPass(true);
      const blob = await api.teamCredentials.downloadPass(
        credential.publicSlug,
      );
      downloadBlobFile(
        blob,
        `Passe_${(credential.name ?? credential.publicSlug)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao descarregar passe.",
      );
    } finally {
      setDownloadingTeamPass(false);
    }
  };

  const handleDownloadExhibitorPdf = async (
    submission: StudentOwnedSubmissionListItem,
  ) => {
    try {
      setDownloadingExhibitorId(submission.id);
      const blob = await api.submissions.exhibitorPdf(submission.id);
      downloadBlobFile(
        blob,
        `manual-expositor-${submission.referenceCode.toLowerCase()}.pdf`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao baixar o manual do expositor.",
      );
    } finally {
      setDownloadingExhibitorId(null);
    }
  };

  const handleDownloadChallengeManual = async () => {
    try {
      setDownloadingChallengeManual(true);
      const blob = await api.passport.challengeManualPdf();
      downloadBlobFile(blob, "manual-desafio-uor-connect.pdf");
      toast.success("Manual do desafio pronto para baixar.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao baixar o manual do desafio.",
      );
    } finally {
      setDownloadingChallengeManual(false);
    }
  };

  const handleCopyTeamInvite = async (
    submission: StudentOwnedSubmissionListItem,
  ) => {
    if (!submission.teamInviteUrl) {
      toast.error("Este projeto ainda não tem link de confirmação de equipa.");
      return;
    }

    try {
      await navigator.clipboard.writeText(submission.teamInviteUrl);
      toast.success("Link de confirmação copiado.");
    } catch {
      toast.info(submission.teamInviteUrl);
    }
  };

  const handleCopyVoteQrLink = async () => {
    if (!selectedVoteQrUrl) return;
    try {
      await navigator.clipboard.writeText(selectedVoteQrUrl);
      toast.success("Link de votação copiado.");
    } catch {
      toast.info(selectedVoteQrUrl);
    }
  };

  const handleCopyNetworkingQr = async () => {
    if (!networkingQr) return;
    try {
      await navigator.clipboard.writeText(networkingQr.validationUrl);
      toast.success("Link do QR de networking copiado.");
    } catch {
      toast.info(networkingQr.validationUrl);
    }
  };

  const handleCopyPassportReferral = async () => {
    const referralUrl =
      passportSummary?.referral?.url ??
      (passportSummary?.referral?.code && typeof window !== "undefined"
        ? `${window.location.origin}${buildPassportReferralInvitePath(
            passportSummary.referral.code,
          )}`
        : null);
    if (!referralUrl) {
      toast.info("O link de convite fica disponível depois de entrares no desafio.");
      return;
    }

    try {
      await navigator.clipboard.writeText(referralUrl);
      toast.success("Link de convite copiado.");
    } catch {
      toast.info(referralUrl);
    }
  };

  const updateProjectChallengeDraft = (
    submissionId: number,
    patch: Partial<ProjectChallengeDraft>,
  ) => {
    setProjectChallengeDrafts((current) => ({
      ...current,
      [submissionId]: {
        ...(current[submissionId] ??
          draftFromProjectChallenge(
            projectChallenges.find(
              (item) => item.submissionId === submissionId,
            ),
          )),
        ...patch,
      },
    }));
  };

  const handleCopyProjectChallengeQr = async (
    challenge: DigitalPassportOwnedProjectChallenge,
  ) => {
    if (!challenge.validationUrl) {
      toast.info(
        "O QR do desafio fica disponível depois de guardar a pergunta.",
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(challenge.validationUrl);
      toast.success("Link do QR de desafio copiado.");
    } catch {
      toast.info(challenge.validationUrl);
    }
  };

  const handleSaveProjectChallenge = async (
    submission: StudentOwnedSubmissionListItem,
  ) => {
    const draft =
      projectChallengeDrafts[submission.id] ??
      draftFromProjectChallenge(
        projectChallenges.find((item) => item.submissionId === submission.id),
      );
    const options = draft.options
      .split(/\r?\n/)
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 8);
    const question = draft.question.trim();
    const correctAnswer = draft.correctAnswer.trim();

    if (question.length < 8) {
      toast.info("Escreve uma pergunta clara para o desafio.");
      return;
    }
    if (options.length < 2) {
      toast.info("Adiciona pelo menos duas opções, uma por linha.");
      return;
    }
    if (
      !correctAnswer ||
      !options.some(
        (option) =>
          option.toLocaleLowerCase("pt-PT") ===
          correctAnswer.toLocaleLowerCase("pt-PT"),
      )
    ) {
      toast.info("Assinala a resposta certa escolhendo uma das opções.");
      return;
    }

    try {
      setSavingProjectChallengeId(submission.id);
      const saved = await api.passport.saveProjectChallenge({
        submissionId: submission.id,
        question,
        options,
        correctAnswer,
        explanation: draft.explanation.trim() || null,
        maxAttempts: clampProjectChallengeAttempts(draft.maxAttempts),
      });
      setProjectChallenges((current) => {
        const exists = current.some(
          (item) => item.submissionId === saved.submissionId,
        );
        return exists
          ? current.map((item) =>
              item.submissionId === saved.submissionId ? saved : item,
            )
          : [saved, ...current];
      });
      setProjectChallengeDrafts((current) => ({
        ...current,
        [submission.id]: {
          ...draft,
          question,
          options: options.join("\n"),
          correctAnswer: "",
        },
      }));
      toast.success("Desafio enviado para aprovação da admin.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível guardar o desafio.",
      );
    } finally {
      setSavingProjectChallengeId(null);
    }
  };

  const buildTeamInviteWhatsAppText = (
    submission: StudentOwnedSubmissionListItem,
  ) => {
    return [
      `Olá, equipa do projeto "${submission.name}".`,
      "Confirma a tua presença no grupo para ficares associado ao projeto no UOR Connect e poderes receber certificado.",
      submission.teamInviteUrl ? `Link: ${submission.teamInviteUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const handleAddTeamMember = async (
    submission: StudentOwnedSubmissionListItem,
  ) => {
    const name = (teamMemberDrafts[submission.id] ?? "").trim();
    if (!name) {
      toast.info("Escreve o nome do novo membro.");
      return;
    }

    try {
      setAddingTeamMemberId(submission.id);
      const team = await api.submissions.addTeamMember(submission.id, name);
      setSubmissions((current) =>
        current.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                teamInviteUrl: team.inviteUrl,
                teamJourneyLabel: team.journeyLabel,
                teamTotalMembers: team.totalMembers,
                teamConfirmedMembers: team.confirmedMembers,
                teamAllConfirmed: team.allConfirmed,
                teamMembers: team.members,
              }
            : item,
        ),
      );
      setTeamMemberDrafts((current) => ({ ...current, [submission.id]: "" }));
      toast.success("Membro adicionado ao convite e à página do projeto.");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setStudent(null);
        return;
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar o membro.",
      );
    } finally {
      setAddingTeamMemberId(null);
    }
  };

  const handleSaveTeamMemberStudentNumber = async (
    submission: StudentOwnedSubmissionListItem,
    memberId: number,
  ) => {
    const rawStudentNumber = teamMemberStudentNumberDrafts[memberId] ?? "";
    const studentNumber = rawStudentNumber.replace(/\D/g, "").trim();
    if (studentNumber.length < 8) {
      toast.info("Indica o número de estudante deste membro.");
      return;
    }

    try {
      setSavingTeamMemberStudentNumberId(memberId);
      const team = await api.submissions.updateTeamMemberStudentNumber(
        submission.id,
        memberId,
        studentNumber,
      );
      const updatedMember = team.members.find((member) => member.id === memberId);
      setSubmissions((current) =>
        current.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                teamInviteUrl: team.inviteUrl,
                teamJourneyLabel: team.journeyLabel,
                teamTotalMembers: team.totalMembers,
                teamConfirmedMembers: team.confirmedMembers,
                teamAllConfirmed: team.allConfirmed,
                teamMembers: team.members,
              }
            : item,
        ),
      );
      setTeamMemberStudentNumberDrafts((current) => ({
        ...current,
        [memberId]: updatedMember?.expectedStudentNumber ?? studentNumber,
      }));
      toast.success(
        updatedMember?.confirmed
          ? "Número validado. Este membro já estava confirmado."
          : "Número guardado. Envia o link para o membro confirmar com a própria conta.",
      );
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setStudent(null);
        return;
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível guardar o número deste membro.",
      );
    } finally {
      setSavingTeamMemberStudentNumberId(null);
    }
  };

  const handleRemoveTeamMember = async (
    submission: StudentOwnedSubmissionListItem,
    member: StudentOwnedSubmissionListItem["teamMembers"][number],
  ) => {
    if (member.isResponsible) {
      toast.info("O responsável não pode ser removido da equipa.");
      return;
    }

    const confirmed = window.confirm(
      `Remover ${member.name} do grupo do projeto "${submission.name}"?`,
    );
    if (!confirmed) return;

    try {
      setRemovingTeamMemberId(member.id);
      const team = await api.submissions.removeTeamMember(
        submission.id,
        member.id,
      );
      setSubmissions((current) =>
        current.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                teamInviteUrl: team.inviteUrl,
                teamJourneyLabel: team.journeyLabel,
                teamTotalMembers: team.totalMembers,
                teamConfirmedMembers: team.confirmedMembers,
                teamAllConfirmed: team.allConfirmed,
                teamMembers: team.members,
              }
            : item,
        ),
      );
      setTeamMemberStudentNumberDrafts((current) => {
        const next = { ...current };
        delete next[member.id];
        return next;
      });
      setTeamMemberExternalDrafts((current) => {
        const next = { ...current };
        delete next[member.id];
        return next;
      });
      setTeamMemberExternalCredentials((current) => {
        const next = { ...current };
        delete next[member.id];
        return next;
      });
      toast.success("Membro removido do grupo.");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setStudent(null);
        return;
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível remover este membro.",
      );
    } finally {
      setRemovingTeamMemberId(null);
    }
  };

  const handleConfirmExternalTeamMember = async (
    submission: StudentOwnedSubmissionListItem,
    memberId: number,
    memberName: string,
  ) => {
    const draft = teamMemberExternalDrafts[memberId] ?? {
      organization: "",
      phone: "",
    };
    const externalOrganization = draft.organization.trim();
    const phone = draft.phone.trim();

    if (externalOrganization.length < 2) {
      toast.info("Indica a universidade ou instituto médio deste membro.");
      return;
    }

    if (phone.replace(/\D/g, "").length < 8) {
      toast.info("Indica o telefone do membro externo.");
      return;
    }

    try {
      setConfirmingExternalTeamMemberId(memberId);
      const team = await api.submissions.confirmTeamMemberExternal(
        submission.id,
        memberId,
        {
          name: memberName,
          phone,
          externalOrganization,
          externalReason:
            "Membro externo confirmado pelo responsável do projeto.",
        },
      );
      setSubmissions((current) =>
        current.map((item) =>
          item.id === submission.id
            ? {
                ...item,
                teamInviteUrl: team.inviteUrl,
                teamJourneyLabel: team.journeyLabel,
                teamTotalMembers: team.totalMembers,
                teamConfirmedMembers: team.confirmedMembers,
                teamAllConfirmed: team.allConfirmed,
                teamMembers: team.members,
              }
            : item,
        ),
      );
      setTeamMemberExternalCredentials((current) => ({
        ...current,
        [memberId]: team.credentials,
      }));
      setTeamMemberExternalDrafts((current) => ({
        ...current,
        [memberId]: { organization: externalOrganization, phone },
      }));
      toast.success("Membro externo confirmado com acesso local criado.");
    } catch (error) {
      if (isAuthError(error)) {
        setToken(null);
        setStudent(null);
        return;
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar o membro externo.",
      );
    } finally {
      setConfirmingExternalTeamMemberId(null);
    }
  };

  const dismissJourneyAlert = (key: string) => {
    setDismissedJourneyAlertKeys((current) => {
      const next = Array.from(new Set([...current, key]));
      writeDismissedJourneyAlertKeys(next);
      return next;
    });
  };

  const hasConfirmedEnrollment = enrollments.some((item) =>
    ["CONFIRMED_BY_ADMIN", "CONFIRMED", "APPROVED"].includes(
      item.paymentStatus,
    ),
  );
  const hasApprovedSubmission = submissions.some(
    (item) => item.status === "APPROVED",
  );
  const voteQrSubmissions = submissions.filter(
    (item) => item.status === "APPROVED" && item.type === "PROJECT",
  );
  const teamConfirmationOverview =
    getProjectTeamConfirmationOverview(submissions);
  const teamSubmissions = teamConfirmationOverview.confirmableProjects;
  const pendingTeamSubmissions = teamConfirmationOverview.pendingProjects;
  const hasTeamConfirmationDone =
    teamConfirmationOverview.hasTeamConfirmationDone;
  const journeySteps = [
    {
      label: "Sessão ativa",
      description: student?.studentNumber
        ? `Número ${student.studentNumber}`
        : "Inicia sessão para acompanhar a jornada.",
      done: Boolean(student?.studentNumber),
      icon: User,
    },
    {
      label: "Foto de perfil",
      description: student?.avatarUrl
        ? "Imagem pública pronta para comentários e chat."
        : "Adiciona uma foto para aparecer junto ao teu nome.",
      done: Boolean(student?.avatarUrl),
      icon: BadgeCheck,
    },
    {
      label: "Inscrição em curso",
      description:
        enrollments.length > 0
          ? `${enrollments.length} inscrição(ões) registada(s).`
          : "Escolhe um curso oficial para participar.",
      done: enrollments.length > 0,
      icon: BookOpenCheck,
    },
    {
      label: "Pagamento confirmado",
      description: hasConfirmedEnrollment
        ? "Tens pelo menos uma inscrição confirmada."
        : "A confirmação aparece depois da validação administrativa.",
      done: hasConfirmedEnrollment,
      icon: BadgeCheck,
    },
    {
      label: "Projeto aprovado",
      description: hasApprovedSubmission
        ? "Tens exposição aprovada para a vitrine pública."
        : "Submete ou aguarda a análise da organização.",
      done: hasApprovedSubmission,
      icon: Rocket,
    },
    {
      label: "Equipa confirmada",
      description:
        teamSubmissions.length === 0
          ? "Projetos individuais ou recusados não exigem confirmação."
          : hasTeamConfirmationDone
            ? "Cada projeto é confirmado de forma independente."
            : "Partilha o link do projeto pendente com os membros.",
      done: hasTeamConfirmationDone,
      icon: UsersRound,
    },
    {
      label: "Presença confirmada",
      description: attendance?.checkedIn
        ? "Check-in registado pela organização."
        : "A organização confirma a presença no evento.",
      done: Boolean(attendance?.checkedIn),
      icon: ShieldCheck,
    },
    {
      label: "Certificado disponível",
      description:
        certificates.length > 0
          ? `${certificates.length} certificado(s) emitido(s).`
          : "Será liberado quando a organização emitir.",
      done: certificates.length > 0,
      icon: Trophy,
    },
  ];

  const completedSteps = journeySteps.filter((s) => s.done).length;
  const progressPercent = Math.round(
    (completedSteps / journeySteps.length) * 100,
  );
  const currentJourneyLevelIndex = journeySteps.findIndex((step) => !step.done);
  const successfulScans = scanHistory.filter((scan) =>
    PASSPORT_PROGRESS_SCAN_RESULTS.has(scan.result),
  );
  const workshopScans = successfulScans.filter((scan) =>
    /workshop|palestra|auditorio|auditório|sala/i.test(
      `${scan.actionType} ${scan.actionLabel}`,
    ),
  );
  const standScans = successfulScans.filter((scan) =>
    /stand|expositor|projeto|project/i.test(
      `${scan.actionType} ${scan.actionLabel}`,
    ),
  );
  const challengeScans = successfulScans.filter((scan) =>
    /desafio|quiz|pergunta|challenge/i.test(
      `${scan.actionType} ${scan.actionLabel} ${scan.message ?? ""}`,
    ),
  );
  const networkingScans = successfulScans.filter((scan) =>
    /network|curso diferente|intercurso|estudante/i.test(
      `${scan.actionType} ${scan.actionLabel} ${scan.message ?? ""}`,
    ),
  );
  const nucleusScans = successfulScans.filter((scan) =>
    /nucleo|núcleo|mentor|credencial|membro/i.test(
      `${scan.actionType} ${scan.actionLabel} ${scan.message ?? ""}`,
    ),
  );
  const surpriseScans = successfulScans.filter((scan) =>
    /surprise|surpresa|bonus|bónus/i.test(
      `${scan.actionType} ${scan.actionLabel} ${scan.message ?? ""}`,
    ),
  );
  const passportJoined = Boolean(
    passportSummary?.joinedAt ||
    passportSummary?.points ||
    passportSummary?.completedMissions,
  );

  useEffect(() => {
    if (
      loading ||
      joiningPassport ||
      passportJoined ||
      !passportReferralCode ||
      searchParams.get("aceitarConvite") !== "1"
    ) {
      return;
    }

    if (passportReferralAutoJoinRef.current === passportReferralCode) return;
    if (!consumePassportReferralAccepted(passportReferralCode)) return;

    passportReferralAutoJoinRef.current = passportReferralCode;
    void handleJoinPassport({ autoAccepted: true });
  }, [
    loading,
    joiningPassport,
    passportJoined,
    passportReferralCode,
    searchParams,
  ]);

  const constructiveFeedbackMission = passportSummary?.missions.find(
    (mission) => mission.key === "constructive-feedback",
  );
  const constructiveFeedbackCompletions =
    constructiveFeedbackMission?.completions ?? 0;

  const fallbackPassportMissions: Array<{
    key: string;
    label: string;
    description: string;
    points: number;
    status: PassportMissionStatus;
    icon: typeof QrCode;
  }> = [
    {
      key: "accept-challenge",
      label: "Aceitar o desafio",
      description: passportJoined
        ? "Passaporte ativado com sucesso."
        : "Ativa o teu Passaporte Digital para entrar no ranking.",
      points: 10,
      status: passportJoined ? "done" : "available",
      icon: UserPlus,
    },
    {
      key: "affiliate-invite",
      label: "Convidar colegas",
      description:
        passportSummary?.referral?.inviteCount
          ? `${passportSummary.referral.inviteCount} colega(s) entraram pelo teu link.`
          : "Opcional: partilha o teu link e ganha 5 pontos por cada colega que entrar.",
      points: 5,
      status:
        (passportSummary?.referral?.inviteCount ?? 0) > 0
          ? "done"
          : passportJoined
            ? "available"
            : "locked",
      icon: UsersRound,
    },
    {
      key: "event-checkin",
      label: "Check-in no evento",
      description: attendance?.checkedIn
        ? "Presença registada no evento."
        : "QR principal na receção da feira.",
      points: 10,
      status: attendance?.checkedIn
        ? "done"
        : passportJoined
          ? "available"
          : "locked",
      icon: MapPinCheck,
    },
    {
      key: "workshop-checkin",
      label: "Workshop ou palestra",
      description:
        workshopScans.length > 0
          ? `${workshopScans.length} entrada(s) validada(s).`
          : "QR na entrada do auditório ou sala.",
      points: 20,
      status:
        workshopScans.length > 0
          ? "done"
          : attendance?.checkedIn
            ? "available"
            : "locked",
      icon: CalendarClock,
    },
    {
      key: "workshop-master-combo",
      label: "Mestre dos workshops",
      description:
        workshopScans.length >= 2
          ? "2 workshops ou palestras validadas."
          : "Participa em 2 workshops ou palestras validadas.",
      points: 15,
      status:
        workshopScans.length >= 2
          ? "done"
          : attendance?.checkedIn
            ? "available"
            : "locked",
      icon: BookOpenCheck,
    },
    {
      key: "stand-visit",
      label: "Visita a stand",
      description:
        standScans.length > 0
          ? `${standScans.length} stand(s) visitado(s).`
          : "QR do stand ou passe do expositor.",
      points: 10,
      status:
        standScans.length > 0
          ? "done"
          : attendance?.checkedIn
            ? "available"
            : "locked",
      icon: Rocket,
    },
    {
      key: "stand-explorer-combo",
      label: "Explorador de stands",
      description:
        standScans.length >= 3
          ? "3 stands ou projetos diferentes visitados."
          : "Visita 3 stands ou projetos diferentes.",
      points: 15,
      status:
        standScans.length >= 3
          ? "done"
          : attendance?.checkedIn
            ? "available"
            : "locked",
      icon: Layers3,
    },
    {
      key: "exhibitor-challenge",
      label: "Desafio do expositor",
      description:
        challengeScans.length > 0
          ? `${challengeScans.length} desafio(s) concluído(s).`
          : "Pergunta liberada pelo QR do expositor.",
      points: 15,
      status:
        challengeScans.length > 0
          ? "done"
          : attendance?.checkedIn
            ? "available"
            : "locked",
      icon: Puzzle,
    },
    {
      key: "constructive-feedback",
      label: "Crítica construtiva",
      description:
        constructiveFeedbackCompletions >= CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS
          ? "3 projetos diferentes receberam críticas construtivas."
          : "Dá críticas construtivas em 3 projetos diferentes.",
      points: 15,
      status:
        constructiveFeedbackCompletions >= CONSTRUCTIVE_FEEDBACK_REQUIRED_PROJECTS
          ? "done"
          : standScans.length > 0 || attendance?.checkedIn
            ? "available"
            : "locked",
      icon: FileText,
    },
    {
      key: "cross-course-networking",
      label: "Networking intercurso",
      description:
        networkingScans.length > 0
          ? `${networkingScans.length} ligação(ões) validada(s).`
          : "QR pessoal de estudante de outro curso.",
      points: 10,
      status:
        networkingScans.length > 0
          ? "done"
          : attendance?.checkedIn
            ? "available"
            : "locked",
      icon: Network,
    },
    {
      key: "networking-triad-combo",
      label: "Rede intercurso",
      description:
        networkingScans.length >= 3
          ? "3 ligações intercurso validadas."
          : "Valida networking com 3 estudantes de cursos diferentes.",
      points: 15,
      status:
        networkingScans.length >= 3
          ? "done"
          : attendance?.checkedIn
            ? "available"
            : "locked",
      icon: UsersRound,
    },
    {
      key: "nucleus-member-bonus",
      label: "Pontos Núcleo",
      description:
        nucleusScans.length > 0
          ? `${nucleusScans.length} passe(s) do núcleo validado(s).`
          : "Valida o passe oficial de um membro do núcleo.",
      points: 10,
      status:
        nucleusScans.length > 0
          ? "done"
          : attendance?.checkedIn
            ? "available"
            : "locked",
      icon: ShieldCheck,
    },
    {
      key: "perfect-sequence-combo",
      label: "Sequência perfeita",
      description: "Visita stand, acerta desafio e faz networking em até 15 minutos.",
      points: 20,
      status:
        standScans.length > 0 &&
        challengeScans.length > 0 &&
        networkingScans.length > 0
          ? "done"
          : "locked",
      icon: Route,
    },
    {
      key: "balanced-explorer-combo",
      label: "Explorador balanceado",
      description: "Pontos por visitar stands de áreas diferentes.",
      points: 15,
      status: standScans.length >= 3 ? "done" : "locked",
      icon: Layers3,
    },
    {
      key: "mentor-found-bonus",
      label: "Mentor encontrado",
      description: "Pontos ao validar passe de membro estratégico do núcleo.",
      points: 15,
      status: nucleusScans.length > 0 ? "done" : "locked",
      icon: ShieldCheck,
    },
    {
      key: "fair-surprise",
      label: "Caça aos QR",
      description:
        surpriseScans.length > 0
          ? `${surpriseScans.length} QR surpresa encontrado(s).`
          : "QR surpresa espalhados pela feira.",
      points: 0,
      status:
        surpriseScans.length > 0
          ? "done"
          : attendance?.checkedIn
            ? "available"
            : "locked",
      icon: Gift,
    },
    {
      key: "journey-complete",
      label: "Jornada completa",
      description: "Pontos quando todas as missões anteriores forem concluídas.",
      points: 30,
      status:
        passportJoined &&
        attendance?.checkedIn &&
        workshopScans.length > 0 &&
        standScans.length > 0 &&
        challengeScans.length > 0 &&
        networkingScans.length > 0
          ? "done"
          : "locked",
      icon: Trophy,
    },
  ];
  const passportAcceptMissionFromSummary = passportSummary?.missions.find(
    (mission) => mission.key === "accept-challenge",
  );
  const passportAcceptMissionNeedsJoinRepair = Boolean(
    passportJoined &&
      passportAcceptMissionFromSummary &&
      normalizePassportStatus(passportAcceptMissionFromSummary.status) !== "done",
  );
  const serverPassportMissions = passportSummary?.missions.map((mission) => {
    const status =
      passportJoined && mission.key === "accept-challenge"
        ? "done"
        : normalizePassportStatus(mission.status);
    return {
      key: mission.key,
      label: mission.title,
      description: mission.description ?? "Missão do Passaporte Digital.",
      points: mission.points,
      pointsEarned:
        passportJoined && mission.key === "accept-challenge"
          ? Math.max(mission.pointsEarned, mission.points)
          : mission.pointsEarned,
      completions:
        passportJoined && mission.key === "accept-challenge"
          ? Math.max(mission.completions, 1)
          : mission.completions,
      status,
      icon: passportMissionIconFor(mission.type),
    };
  });
  const passportMissions = orderPassportMissionsForMap(
    serverPassportMissions ?? fallbackPassportMissions,
  );
  const completedPassportMissions = passportMissions.filter(
    (mission) => mission.status === "done",
  ).length;
  const computedPassportProgressPercent = Math.round(
    (completedPassportMissions / passportMissions.length) * 100,
  );
  const computedPassportPoints = passportMissions.reduce(
    (total, mission) =>
      mission.status === "done" ? total + mission.points : total,
    0,
  );
  const passportProgressPercent =
    passportAcceptMissionNeedsJoinRepair
      ? Math.max(passportSummary?.progressPercent ?? 0, computedPassportProgressPercent)
      : passportSummary?.progressPercent ?? computedPassportProgressPercent;
  const passportPoints =
    passportAcceptMissionNeedsJoinRepair
      ? Math.max(passportSummary?.points ?? 0, computedPassportPoints)
      : getPassportDisplayPoints(passportSummary, computedPassportPoints);
  const passportTotalPoints =
    passportSummary?.totalAvailablePoints ??
    passportMissions.reduce((total, mission) => total + mission.points, 0);
  const currentPassportMissionIndex = passportMissions.findIndex(
    (mission) => mission.status === "available",
  );
  const firstLockedPassportMissionIndex = passportMissions.findIndex(
    (mission) => mission.status === "locked",
  );
  const currentPassportRouteIndex =
    currentPassportMissionIndex >= 0
      ? currentPassportMissionIndex
      : firstLockedPassportMissionIndex >= 0
        ? firstLockedPassportMissionIndex
        : Math.max(0, passportMissions.length - 1);
  const nextPassportMission =
    currentPassportMissionIndex >= 0
      ? passportMissions[currentPassportMissionIndex]
      : (passportMissions.find((mission) => mission.status === "locked") ??
        passportMissions[passportMissions.length - 1]);
  const passportProgressStyle = {
    "--passport-progress": `${Math.min(100, Math.max(0, passportProgressPercent)) * 3.6}deg`,
  } as CSSProperties;
  const fallbackPassportBadges = [
    {
      label: "Presença confirmada",
      active: Boolean(attendance?.checkedIn),
      icon: MapPinCheck,
    },
    {
      label: "Explorador de Stands",
      active: standScans.length >= 3,
      icon: Rocket,
    },
    {
      label: "Mestre dos Workshops",
      active: workshopScans.length >= 2,
      icon: CalendarClock,
    },
    {
      label: "Conector Intercurso",
      active: networkingScans.length > 0,
      icon: Network,
    },
    {
      label: "Desafiante",
      active: challengeScans.length > 0,
      icon: Puzzle,
    },
  ];
  const passportBadges =
    passportSummary?.badges.map((badge) => ({
      label: badge.label,
      active: badge.earned,
      icon: passportBadgeIconFor(badge.label),
    })) ?? fallbackPassportBadges;
  const exhibitorPassportProject = exhibitorPassportSummary?.activeProject ?? null;
  const exhibitorPassportMissions = orderPassportMissionsForMap(
    (exhibitorPassportProject?.missions ?? []).map((mission) => ({
      key: mission.key,
      label: mission.title,
      description: mission.description,
      points: mission.points,
      pointsEarned: mission.pointsEarned,
      completions: mission.completions,
      status: normalizePassportStatus(mission.status),
      icon: passportMissionIconFor(mission.type),
    })),
  );
  const completedExhibitorPassportMissions = exhibitorPassportMissions.filter(
    (mission) => mission.status === "done",
  ).length;
  const computedExhibitorPassportProgressPercent =
    exhibitorPassportMissions.length > 0
      ? Math.round(
          (completedExhibitorPassportMissions /
            exhibitorPassportMissions.length) *
            100,
        )
      : 0;
  const exhibitorPassportProgressPercent =
    exhibitorPassportProject?.progressPercent ??
    computedExhibitorPassportProgressPercent;
  const exhibitorPassportPoints = exhibitorPassportProject?.score ?? 0;
  const exhibitorPassportTotalPoints =
    exhibitorPassportProject?.totalAvailablePoints ??
    exhibitorPassportMissions.reduce((total, mission) => total + mission.points, 0);
  const currentExhibitorPassportMissionIndex = exhibitorPassportMissions.findIndex(
    (mission) => mission.status === "available",
  );
  const firstLockedExhibitorPassportMissionIndex = exhibitorPassportMissions.findIndex(
    (mission) => mission.status === "locked",
  );
  const currentExhibitorPassportRouteIndex =
    currentExhibitorPassportMissionIndex >= 0
      ? currentExhibitorPassportMissionIndex
      : firstLockedExhibitorPassportMissionIndex >= 0
        ? firstLockedExhibitorPassportMissionIndex
        : Math.max(0, exhibitorPassportMissions.length - 1);
  const nextExhibitorPassportMission =
    currentExhibitorPassportMissionIndex >= 0
      ? exhibitorPassportMissions[currentExhibitorPassportMissionIndex]
      : (exhibitorPassportMissions.find((mission) => mission.status === "locked") ??
        exhibitorPassportMissions[exhibitorPassportMissions.length - 1]);
  const exhibitorPassportProgressStyle = {
    "--passport-progress": `${Math.min(100, Math.max(0, exhibitorPassportProgressPercent)) * 3.6}deg`,
  } as CSSProperties;
  const exhibitorPassportBadges =
    exhibitorPassportProject?.badges.map((badge) => ({
      label: badge.label,
      active: badge.earned,
      icon: passportBadgeIconFor(badge.label),
    })) ?? [];
  const exhibitorPassportContinuousActions =
    exhibitorPassportProject?.continuousActions.map((action) => ({
      ...action,
      icon: exhibitorOpportunityIconFor(action.icon),
    })) ?? [];
  const exhibitorPassportBonusOpportunities =
    exhibitorPassportProject?.bonusOpportunities.map((opportunity) => ({
      ...opportunity,
      icon: exhibitorOpportunityIconFor(opportunity.icon),
    })) ?? [];
  const exhibitorRoundFlow = exhibitorPassportSummary?.roundFlow ?? null;
  const exhibitorRoundMaxMultiplier = Math.max(
    1,
    ...(exhibitorRoundFlow?.items.map((round) => round.multiplier) ?? [1]),
  );
  const currentExhibitorRound =
    exhibitorRoundFlow?.items.find((round) => round.phase === "current") ?? null;
  const nextExhibitorRound =
    exhibitorRoundFlow?.items.find((round) => round.phase === "next") ?? null;

  const renderExhibitorVoteQrSection = () => {
    if (voteQrSubmissions.length === 0) return null;

    const hasMultipleProjects = voteQrSubmissions.length > 1;

    return (
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700 shadow-sm">
              <QrCode className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-sm font-bold text-slate-950 sm:text-base">
                QR de conversão do projeto
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
                Usa este QR no stand para levar o estudante direto à confirmação
                de voto. O voto pode ser registado na hora; os bónus do
                expositor entram depois da conversão validada.
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-bold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" />
            {voteQrSubmissions.length} projeto
            {voteQrSubmissions.length === 1 ? "" : "s"} aprovado
            {voteQrSubmissions.length === 1 ? "" : "s"}
          </span>
        </div>

        <div
          className={`mt-4 grid gap-2 ${hasMultipleProjects ? "sm:grid-cols-2" : ""}`}
        >
          {voteQrSubmissions.map((submission) => (
            <Button
              key={submission.id}
              type="button"
              size="sm"
              className="min-h-10 justify-start rounded-xl bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-800"
              onClick={() => setSelectedVoteQrSubmission(submission)}
            >
              <QrCode className="mr-2 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">
                {hasMultipleProjects ? submission.name : "Gerar QR de votação"}
              </span>
              <ChevronRight className="ml-2 h-4 w-4 shrink-0 opacity-70" />
            </Button>
          ))}
        </div>
      </motion.section>
    );
  };

  const renderExhibitorRoundFlow = () => {
    if (!exhibitorPassportProject || !exhibitorRoundFlow || exhibitorRoundFlow.items.length === 0) {
      return null;
    }

    return (
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.06 }}
        className="desafio-round-flow desafio-round-flow--home"
      >
        <div className="desafio-round-flow__header">
          <div className="desafio-round-flow__title">
            <span className="desafio-round-flow__title-icon">
              <CalendarClock className="h-4 w-4" />
            </span>
            <div>
              <p>Multiplicadores por ronda</p>
              <span>
                {currentExhibitorRound
                  ? `${currentExhibitorRound.label} · faltam ${currentExhibitorRound.minutesRemaining ?? 0} min`
                  : nextExhibitorRound
                    ? `Próxima: ${nextExhibitorRound.label} em ${nextExhibitorRound.startsInMinutes ?? 0} min`
                    : "Acompanha os horários de pontuação"}
              </span>
            </div>
          </div>
          <div className="desafio-round-flow__current">
            <span>Agora</span>
            <strong>x{exhibitorRoundFlow.currentMultiplier}</strong>
            <small>multiplicador atual</small>
          </div>
        </div>

        <div
          className="desafio-round-flow__track"
          aria-label="Fluxo horizontal das rondas do expositor"
        >
          {exhibitorRoundFlow.items.map((round) => (
            <div
              key={round.key}
              className={`desafio-round-flow__slot is-${round.phase}`}
              style={{
                "--round-progress": `${round.progressPercent}%`,
                "--round-height": `${56 + (round.multiplier / exhibitorRoundMaxMultiplier) * 36}px`,
              } as CSSProperties}
              data-multiplier={`x${round.multiplier}`}
            >
              {round.phase === "current" ? (
                <div className="desafio-round-flow__timer">
                  {round.minutesRemaining ?? 0} min
                </div>
              ) : null}
              <div className="desafio-round-flow__bar">
                <span />
              </div>
              <div className="desafio-round-flow__slot-meta">
                <span>{exhibitorRoundPhaseLabel(round.phase)}</span>
                <strong>{round.label}</strong>
                <small>
                  {shortTimeLabel(round.startsAt)}-
                  {shortTimeLabel(round.endsAt)} · x{round.multiplier}
                </small>
              </div>
            </div>
          ))}
        </div>

        {exhibitorRoundFlow.streakTargets.length > 0 ? (
          <div className="desafio-round-flow__streaks">
            <span className="desafio-round-flow__streak-label">
              Streaks grandes
            </span>
            {exhibitorRoundFlow.streakTargets.map((target) => (
              <span
                key={target.minCourses}
                className="desafio-round-flow__streak-pill"
              >
                {target.label} · +{target.points} pts
              </span>
            ))}
          </div>
        ) : null}
      </motion.section>
    );
  };

  const renderExhibitorTeamActivity = () => {
    if (
      !exhibitorPassportProject ||
      exhibitorPassportProject.viewerRole !== "RESPONSAVEL" ||
      exhibitorPassportProject.teamActivity.length === 0
    ) {
      return null;
    }

    const topMember = exhibitorPassportProject.teamActivity[0];

    return (
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.07 }}
        className="desafio-team-activity"
      >
        <div className="desafio-team-activity__header">
          <div className="desafio-team-activity__title">
            <span>
              <UsersRound className="h-4 w-4" />
            </span>
            <div>
              <p>Empenho da equipa</p>
              <small>Membros com mais pontos, ações e última atividade.</small>
            </div>
          </div>
          {topMember ? (
            <div className="desafio-team-activity__leader">
              <Crown className="h-3.5 w-3.5" />
              {topMember.name}
            </div>
          ) : null}
        </div>

        <div className="desafio-team-activity__list">
          {exhibitorPassportProject.teamActivity.slice(0, 8).map((member, index) => (
            <div
              key={`${member.memberId ?? "responsavel"}-${member.name}`}
              className={`desafio-team-activity__row ${index === 0 ? "is-leader" : ""}`}
            >
              <div className="desafio-team-activity__rank">{index + 1}</div>
              <div className="desafio-team-activity__member">
                <strong>{member.name}</strong>
                <span>
                  {member.role === "RESPONSAVEL" ? "Responsável" : "Membro"} ·{" "}
                  {member.confirmed ? "confirmado" : "por confirmar"}
                  {member.lastActivityAt
                    ? ` · ${shortTimeLabel(member.lastActivityAt)}`
                    : ""}
                </span>
              </div>
              <div className="desafio-team-activity__stats">
                <strong>{member.points} pts</strong>
                <span>{member.actions} ações · {member.level}</span>
              </div>
            </div>
          ))}
        </div>
      </motion.section>
    );
  };

  const renderCertificatesSection = () => (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 }}
      className="overflow-hidden rounded-2xl border border-border/50 bg-white shadow-sm"
    >
      <div className="border-b border-border/50 bg-gradient-to-r from-emerald-500/10 to-primary/10 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Award className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-heading text-base font-semibold">
                Certificado e Prémio
              </h2>
              <p className="text-xs text-muted-foreground">
                Certificados emitidos e prémios oficiais da participação
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
            <BadgeCheck className="h-3 w-3" />
            {certificates.length} disponível(eis)
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {certificates.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 py-10 text-center">
            <Award className="h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              Nenhum certificado emitido
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
              Os certificados e prémios aparecem aqui depois da emissão pela
              organização.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {certificates.map((certificate) => (
              <article
                key={certificate.id}
                className="group overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-emerald-500/[0.02] to-transparent transition-shadow hover:shadow-md"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
                        {certificate.type}
                      </p>
                      <h3 className="mt-1.5 truncate font-heading text-base font-semibold">
                        {certificate.title}
                      </h3>
                      <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground">
                        {certificate.code}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                        certificate.status === "ISSUED" ||
                        certificate.status === "VALID"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                          : "border-rose-500/20 bg-rose-500/10 text-rose-700"
                      }`}
                    >
                      {certificate.status === "ISSUED" ||
                      certificate.status === "VALID"
                        ? "Emitido"
                        : certificate.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                      onClick={() => void handleDownloadCertificate(certificate)}
                      disabled={downloadingCertificateId === certificate.id}
                    >
                      {downloadingCertificateId === certificate.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Baixar PDF
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                    >
                      <a
                        href={certificate.validationUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Validar
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );

  const renderPassesSection = () => (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.08 }}
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white shadow-inner">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-white/55">
                Credenciais imprimíveis
              </p>
              <h2 className="font-heading text-lg font-black text-white">
                Passes e funções
              </h2>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/80">
            <ShieldCheck className="h-3.5 w-3.5" />
            Identificação oficial
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
        {teamCredentials.length ? (
          teamCredentials.map((cred) => {
            const linkedMembership =
              teamMembershipsById.get(cred.teamMembershipId ?? -1) ??
              teamCredentialData?.membership;
            const membership =
              linkedMembership?.status === "ACTIVE" ? linkedMembership : null;
            const isExpositor = cred.category === "EXPOSITOR";
            const isReady = isTeamCredentialReadyStatus(cred.status);
            const displayTeam = isExpositor
              ? (cred.sourceSubmissionArea ?? cred.team)
              : (membership?.team ?? cred.team);
            const displayRole =
              isExpositor && cred.sourceSubmissionName
                ? cred.sourceSubmissionName
                : cred.role;
            const credentialTheme = teamCredentialVisualThemeFor({
              category: cred.category,
              categoryLabel: cred.categoryLabel,
              team: displayTeam,
              role: displayRole,
              accessLevel: cred.accessLevel,
            });

            return (
              <article
                key={cred.id}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                style={{
                  borderColor: `${credentialTheme.accentColor}44`,
                }}
              >
                <div
                  className="px-4 py-3"
                  style={{
                    background: `linear-gradient(135deg, ${credentialTheme.primaryColor}, ${credentialTheme.accentColor})`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                        {credentialTheme.footerLabel}
                      </p>
                      <h3 className="truncate text-sm font-bold text-white">
                        {displayTeam}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                        isReady
                          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                          : "border-amber-400/30 bg-amber-500/15 text-amber-200"
                      }`}
                    >
                      {isReady ? "Pronto" : "Pendente"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-4 p-4 min-[520px]:flex-row min-[520px]:items-center">
                  {cred.photoUrl ? (
                    <img
                      src={cred.photoUrl}
                      alt=""
                      className="h-16 w-16 rounded-xl border-2 object-cover shadow-sm"
                      style={{
                        borderColor: `${credentialTheme.accentColor}55`,
                      }}
                    />
                  ) : (
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed text-sm font-bold"
                      style={{
                        borderColor: `${credentialTheme.accentColor}66`,
                        backgroundColor: credentialTheme.lightColor,
                        color: credentialTheme.primaryColor,
                      }}
                    >
                      {(cred.name ?? student?.name ?? "UC")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-950">
                      {cred.name ?? student?.name ?? "Completa os teus dados"}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-600">
                      {cred.categoryLabel} · {displayRole}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {cred.accessLevel}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant={isReady ? "default" : "outline"}
                        size="sm"
                        className="h-9 min-w-[132px] justify-center rounded-xl text-xs"
                        style={
                          isReady
                            ? {
                                backgroundColor:
                                  credentialTheme.primaryColor,
                                borderColor: credentialTheme.primaryColor,
                                color: "#ffffff",
                              }
                            : teamCredentialChipStyle(credentialTheme)
                        }
                        disabled={downloadingTeamPass || !isReady}
                        onClick={() => void handleDownloadTeamPass(cred)}
                      >
                        {downloadingTeamPass ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {isExpositor ? "Passe de expositor" : "Passe"}
                      </Button>
                      {isReady ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-9 min-w-[104px] justify-center rounded-xl text-xs"
                          style={teamCredentialChipStyle(credentialTheme)}
                        >
                          <Link
                            to={`/equipa/perfil/${encodeURIComponent(cred.publicSlug)}`}
                          >
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Perfil
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 lg:col-span-2">
            Quando tiveres uma função confirmada na organização, expositor,
            júri ou equipa, o passe aparece aqui.
          </div>
        )}
      </div>
    </motion.section>
  );

  const journeyAlerts = [
    ...(!attendance?.checkedIn
        ? [
          {
            key: "attendance",
            title: "Falta confirmar presença",
            description:
              "Mostra o teu QR no check-in para a organização validar a tua participação.",
            action: "Ver QR",
            tab: "home" as const,
          },
        ]
      : []),
    ...(enrollments.length === 0
        ? [
          {
            key: "courses",
            title: "Ainda não tens inscrição em cursos",
            description:
              "Explora os cursos oficiais e guarda o comprovativo na tua área.",
            action: "Ver cursos",
            href: "/cursos",
          },
        ]
      : []),
    ...(submissions.length === 0
        ? [
          {
            key: "submissions",
            title: "Nenhum projeto submetido",
            description: submissionsOpen
              ? "Submete um projeto, negócio ou produto para aparecer na vitrine pública."
              : "As candidaturas de expositores estão encerradas pela organização.",
            action: submissionsOpen ? "Submeter" : "Candidaturas encerradas",
            ...(submissionsOpen
              ? { href: "/submeter" }
              : { disabled: true as const }),
          },
        ]
      : []),
    ...(pendingTeamSubmissions.length > 0
        ? [
          {
            key: "team-confirmation",
            title: "Equipa por confirmar",
            description:
              pendingTeamSubmissions.length > 1
                ? `${pendingTeamSubmissions.length} projetos ainda têm membros por confirmar.`
                : "Este projeto ainda tem membros por confirmar.",
            action: "Ver projetos",
            tab: "submissoes" as const,
          },
        ]
      : []),
    ...(certificates.length === 0 && attendance?.checkedIn
        ? [
          {
            key: "certificates",
            title: "Certificado ainda não emitido",
            description:
              "A tua presença já está registada. O certificado aparecerá aqui quando for emitido.",
            action: "Acompanhar",
            tab: "certificados" as const,
          },
        ]
      : []),
  ].filter((alert) => !dismissedJourneyAlertKeys.includes(alert.key)).slice(0, 3);

  const quickStats = [
    {
      label: "Inscrições",
      value: enrollments.length,
      icon: BookOpenCheck,
      color: "text-orange-700 bg-orange-500/10 border-orange-500/25",
      card: "from-orange-50 to-white",
    },
    {
      label: "Projetos",
      value: submissions.length,
      icon: FileText,
      color: "text-slate-950 bg-slate-950/5 border-slate-900/15",
      card: "from-stone-50 to-white",
    },
    {
      label: "Certificados",
      value: certificates.length,
      icon: Award,
      color: "text-amber-800 bg-amber-500/10 border-amber-500/25",
      card: "from-amber-50 to-white",
    },
    {
      label: "Jornada",
      value: `${progressPercent}%`,
      icon: TrendingUp,
      color: "text-orange-800 bg-orange-500/10 border-orange-500/25",
      card: "from-orange-50 to-white",
    },
  ];
  const teamCredential = teamCredentialData?.credential ?? null;
  const teamMembershipsById = new Map(
    (teamCredentialData?.memberships ?? []).map((membership) => [
      membership.id,
      membership,
    ]),
  );
  const rawTeamCredentials = teamCredentialData?.credentials?.length
    ? teamCredentialData.credentials
    : teamCredential
      ? [teamCredential]
      : [];
  const teamCredentials = rawTeamCredentials.filter((credential) => {
    if (!credential.teamMembershipId) return true;
    const membership = teamMembershipsById.get(credential.teamMembershipId);
    if (membership && membership.status !== "ACTIVE") return false;
    if (
      credential.category === "EXPOSITOR" &&
      membership &&
      membership.category !== "EXPOSITOR"
    )
      return false;
    return true;
  });
  const topPassportStudents = passportLeaderboard.slice(0, 5);
  const challengeParticipantCount = Math.max(
    passportSummary?.participantCount ?? 0,
    passportJoined ? 1 : 0,
    topPassportStudents.length,
  );

  return (
    <div className="page-section">
      <div className="page-shell space-y-6">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="uor-vital-panel minha-area-hero sm:rounded-2xl"
        >
          <div className="p-4 sm:p-6 md:p-8">
            <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3 sm:gap-5">
                <div className="relative shrink-0">
                  <div className="rounded-xl border-2 border-orange-100 bg-white p-0.5 shadow-sm sm:rounded-2xl sm:p-0.5">
                    <UserAvatar
                      name={student?.name || student?.studentNumber || "U"}
                      avatarUrl={student?.avatarUrl}
                      size="lg"
                      className="h-14 w-14 rounded-lg sm:h-16 sm:w-16 sm:rounded-xl"
                    />
                  </div>
                  {student?.avatarUrl && (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500">
                      <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-[11px]">
                    Minha Área
                  </p>
                  <h1 className="mt-0.5 max-w-full break-words text-xl font-bold leading-tight text-slate-900 sm:mt-1 sm:text-2xl">
                    {student?.name || "Completa o teu perfil"}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 sm:text-sm">
                    {student?.studentNumber && (
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-flex items-center rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-orange-300 sm:text-[11px]">
                          N.o {student.studentNumber}
                        </span>
                      </span>
                    )}
                    {student?.course && (
                      <span className="min-w-0 break-words">
                        {student.course}
                      </span>
                    )}
                  </div>
                  {(student?.email || student?.phone) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 sm:text-xs">
                      {student.email && (
                        <span className="truncate">{student.email}</span>
                      )}
                      {student.phone && <span>{student.phone}</span>}
                    </div>
                  )}
                  {(student?.university ||
                    student?.curricularYear ||
                    student?.academicYear) && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 sm:text-[11px]">
                      {student.university && <span>{student.university}</span>}
                      {student.curricularYear && (
                        <span>{student.curricularYear}o ano</span>
                      )}
                      {student.academicYear && (
                        <span>· {student.academicYear}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Button
                  size="sm"
                  className="uor-action-button bg-slate-900 text-white hover:bg-slate-800"
                  onClick={openProfileEditor}
                >
                  <Camera className="mr-1.5 h-3.5 w-3.5" />
                  Editar perfil
                </Button>
                <div className="flex items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50/80 px-3 py-2.5 sm:rounded-xl sm:px-4 sm:py-3">
                  <div className="relative h-8 w-8 sm:h-10 sm:w-10">
                    <svg
                      className="h-full w-full -rotate-90"
                      viewBox="0 0 40 40"
                    >
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-slate-200"
                      />
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={`${progressPercent} ${100 - progressPercent}`}
                        strokeLinecap="round"
                        className="text-orange-600 transition-all duration-700"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-900 sm:text-[10px]">
                      {progressPercent}%
                    </span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-950 sm:text-xs">
                      {completedSteps}/{journeySteps.length}
                    </p>
                    <p className="text-[9px] text-orange-700 sm:text-[10px]">
                      etapas
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold sm:px-3 sm:py-2 sm:text-xs ${
                    attendance?.checkedIn
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  {attendance?.checkedIn ? "Presente" : "Aguardando"}
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:gap-3 md:grid-cols-4">
              {quickStats.map((stat) => (
                <div
                  key={stat.label}
                  className={`uor-vital-stat bg-gradient-to-br ${stat.card} px-3 py-2.5 sm:px-4 sm:py-3`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`uor-icon-tile h-7 w-7 rounded-lg sm:h-8 sm:w-8 sm:rounded-xl ${stat.color}`}
                    >
                      <stat.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-slate-900 sm:text-lg">
                        {stat.value}
                      </p>
                      <p className="truncate text-[9px] font-medium text-slate-400 sm:text-[10px]">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <AnimatePresence>
          {!loading && profileEditorOpen ? (
            <motion.section
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <User className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        Editar perfil
                      </h2>
                      <p className="text-xs text-slate-500">
                        Dados públicos e de contacto. Número, curso e
                        instituição continuam oficiais.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 rounded-xl p-0"
                    onClick={closeProfileEditor}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[220px_1fr]">
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white bg-white shadow-sm">
                      <UserAvatar
                        name={
                          profileDraft.name || student?.studentNumber || "U"
                        }
                        avatarUrl={profileDraft.avatarUrl}
                        size="lg"
                        className="h-full w-full rounded-2xl"
                      />
                    </div>
                    <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50">
                      <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                      Trocar foto
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) =>
                          void handleProfileAvatarFile(
                            event.target.files?.[0] ?? null,
                          )
                        }
                      />
                    </label>
                    {profileDraft.avatarUrl ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-8 w-full rounded-xl text-xs text-slate-500"
                        onClick={() => updateProfileDraft("avatarUrl", "")}
                      >
                        Remover foto
                      </Button>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">
                      Dados oficiais
                    </p>
                    <p className="mt-1 leading-5">
                      Nome, número e curso usam fonte{" "}
                      {profileState?.fieldSources?.course === "SECRETARIA"
                        ? "Secretaria"
                        : "declarada"}
                      .
                    </p>
                    {student?.academicSyncedAt ? (
                      <p className="mt-2 text-[11px] text-slate-400">
                        Sincronizado em{" "}
                        {itemDateLabel(student.academicSyncedAt)}.
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 md:col-span-2">
                    <p className="font-semibold text-slate-700">
                      Finalidade dos dados
                    </p>
                    <p className="mt-1 leading-5">
                      Contactos servem para operação e suporte; bio, foto e
                      redes só entram no perfil público/credenciais conforme
                      consentimento; morada é reduzida e usada apenas quando
                      houver necessidade logística.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Nome completo
                    </span>
                    <Input
                      value={profileDraft.name}
                      onChange={(event) =>
                        updateProfileDraft("name", event.target.value)
                      }
                      className="h-10 rounded-xl border-slate-200 bg-slate-50"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Telefone principal{" "}
                      <span className="font-normal text-slate-400">
                        (recomendado)
                      </span>
                    </span>
                    <Input
                      value={profileDraft.phone}
                      onChange={(event) =>
                        updateProfileDraft("phone", event.target.value)
                      }
                      className="h-10 rounded-xl border-slate-200 bg-slate-50"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Telefone alternativo{" "}
                      <span className="font-normal text-slate-400">
                        (opcional)
                      </span>
                    </span>
                    <Input
                      value={profileDraft.alternatePhone}
                      onChange={(event) =>
                        updateProfileDraft("alternatePhone", event.target.value)
                      }
                      className="h-10 rounded-xl border-slate-200 bg-slate-50"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Bio curta
                    </span>
                    <Textarea
                      value={profileDraft.bio}
                      onChange={(event) =>
                        updateProfileDraft("bio", event.target.value)
                      }
                      rows={3}
                      className="resize-none rounded-xl border-slate-200 bg-slate-50"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Morada reduzida{" "}
                      <span className="font-normal text-slate-400">
                        (opcional)
                      </span>
                    </span>
                    <Input
                      value={profileDraft.address}
                      onChange={(event) =>
                        updateProfileDraft("address", event.target.value)
                      }
                      placeholder="Bairro, município ou cidade"
                      className="h-10 rounded-xl border-slate-200 bg-slate-50"
                    />
                  </label>
                  {(
                    [
                      ["instagramUrl", "Instagram", "instagram.com/utilizador"],
                      ["facebookUrl", "Facebook", "facebook.com/utilizador"],
                      ["linkedinUrl", "LinkedIn", "linkedin.com/in/utilizador"],
                      ["githubUrl", "GitHub", "github.com/utilizador"],
                      ["websiteUrl", "Site / portfolio", "meusite.com"],
                    ] as Array<
                      [
                        Extract<
                          keyof ProfileDraft,
                          | "instagramUrl"
                          | "facebookUrl"
                          | "linkedinUrl"
                          | "githubUrl"
                          | "websiteUrl"
                        >,
                        string,
                        string,
                      ]
                    >
                  ).map(([key, label, placeholder]) => (
                    <label
                      key={key}
                      className={`block ${key === "websiteUrl" ? "sm:col-span-2" : ""}`}
                    >
                      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                        {label}
                      </span>
                      <Input
                        value={profileDraft[key]}
                        onChange={(event) =>
                          updateProfileDraft(key, event.target.value)
                        }
                        placeholder={placeholder}
                        className="h-10 rounded-xl border-slate-200 bg-slate-50"
                      />
                    </label>
                  ))}
                  <ProfileConsentControls
                    values={profileConsentValues}
                    onChange={updateProfileConsentValue}
                    visibility={profileDraft.visibility}
                    visibilityOptions={profileVisibilityOptions}
                    onVisibilityChange={updateProfileVisibility}
                    className="sm:col-span-2"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={closeProfileEditor}
                  disabled={savingProfile}
                >
                  Cancelar
                </Button>
                <Button
                  className="rounded-xl bg-slate-900 hover:bg-slate-800"
                  onClick={() => void handleSaveProfile()}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Guardar perfil
                </Button>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        {/* Alerts */}
        {!loading && journeyAlerts.length > 0 ? (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {journeyAlerts.map((alert) => (
              <article
                key={alert.key}
                className="group relative rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 pr-11 transition-shadow hover:shadow-md"
              >
                <button
                  type="button"
                  aria-label={`Fechar aviso ${alert.title}`}
                  onClick={() => dismissJourneyAlert(alert.key)}
                  className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-amber-700/60 transition-colors hover:bg-amber-100 hover:text-amber-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                    <AlertTriangle className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {alert.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {alert.description}
                    </p>
                    {"disabled" in alert ? (
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        {alert.action}
                      </span>
                    ) : "href" in alert ? (
                      <Link
                        to={alert.href}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                      >
                        {alert.action}
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleTabChange(alert.tab)}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                      >
                        {alert.action}
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </motion.section>
        ) : null}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-6"
        >
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
            <TabsTrigger
              value="home"
              className="min-h-12 gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 font-heading text-xs font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:text-slate-950 hover:shadow-md data-[state=active]:border-slate-950 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-slate-950/15 sm:text-sm"
            >
              <Layers3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Início
            </TabsTrigger>
            <TabsTrigger
              value="desafio"
              className="min-h-12 gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 font-heading text-xs font-semibold text-orange-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-400 hover:bg-orange-100 hover:text-orange-950 hover:shadow-md data-[state=active]:border-orange-600 data-[state=active]:bg-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-orange-600/20 sm:text-sm"
            >
              <Gamepad2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Desafio
            </TabsTrigger>
            <TabsTrigger
              value="submissoes"
              className="min-h-12 gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-3 font-heading text-xs font-semibold text-cyan-900 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-cyan-100 hover:text-cyan-950 hover:shadow-md data-[state=active]:border-cyan-700 data-[state=active]:bg-cyan-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-cyan-700/20 sm:text-sm"
            >
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="whitespace-nowrap">Meus Projetos</span>
            </TabsTrigger>
            <TabsTrigger
              value="inscricoes"
              className="min-h-12 gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 font-heading text-xs font-semibold text-emerald-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-100 hover:text-emerald-950 hover:shadow-md data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-700/20 sm:text-sm"
            >
              <BookOpenCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Inscrições
            </TabsTrigger>
            <TabsTrigger
              value="certificados"
              className="min-h-12 gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 font-heading text-xs font-semibold text-amber-900 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-100 hover:text-amber-950 hover:shadow-md data-[state=active]:border-amber-700 data-[state=active]:bg-amber-700 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-amber-700/20 sm:text-sm"
            >
              <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="leading-tight">Certificado e Prémio</span>
            </TabsTrigger>
            <TabsTrigger
              value="passes"
              className="min-h-12 gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-heading text-xs font-semibold text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-950 hover:shadow-md data-[state=active]:border-slate-950 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-slate-950/15 sm:text-sm"
            >
              <BadgeCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Passe</span>
            </TabsTrigger>
          </TabsList>

          {/* === INICIO TAB === */}
          <TabsContent value="home" className="space-y-6">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-border/50 bg-card/80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid gap-5">
                  <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-4 sm:px-6 sm:py-5">
                      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-400/15 blur-xl" />
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                            <QrCode className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 sm:text-[11px]">
                              Credencial Digital
                            </p>
                            <h2 className="truncate text-sm font-semibold text-white sm:text-base">
                              UOR Connect
                            </h2>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold sm:text-[11px] ${
                            attendance?.checkedIn
                              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                              : "border-amber-400/30 bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          {attendance?.checkedIn ? "Presente" : "Aguardando"}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="p-4 sm:p-5">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <UserAvatar
                            name={
                              student?.name || student?.studentNumber || "U"
                            }
                            avatarUrl={student?.avatarUrl}
                            size="lg"
                            className="h-14 w-14 rounded-xl border-2 border-white text-base shadow-md sm:h-16 sm:w-16 sm:rounded-2xl"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold leading-tight text-foreground sm:text-base">
                              {attendance?.credential?.studentName ||
                                student?.name ||
                                "Completa o teu perfil"}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">
                              {student?.course ||
                                student?.university ||
                                "Curso por confirmar"}
                            </p>
                            {student?.studentNumber ? (
                              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2 py-0.5">
                                <span className="text-[9px] font-bold tracking-wider text-orange-300 sm:text-[10px]">
                                  N.o {student.studentNumber}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-slate-50 px-3 py-2">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                              Status
                            </p>
                            <p
                              className={`mt-0.5 text-xs font-semibold ${attendance?.checkedIn ? "text-emerald-600" : "text-amber-600"}`}
                            >
                              {attendance?.checkedIn
                                ? "Check-in feito"
                                : "Pendente"}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-3 py-2">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                              Última presença
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-foreground">
                              {attendance?.lastCheckIn
                                ? itemDateLabel(
                                    attendance.lastCheckIn.checkedInAt,
                                  )
                                : "Sem registo"}
                            </p>
                          </div>
                        </div>

                        {attendance?.lastCheckIn?.eventLabel ? (
                          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            {attendance.lastCheckIn.eventLabel}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-center justify-center border-t border-border/40 bg-white p-5 sm:border-l sm:border-t-0">
                        <div className="rounded-2xl border border-border/50 bg-white p-2 shadow-sm">
                          {attendance?.credential ? (
                            <img
                              src={attendance.credential.qrImageUrl}
                              alt="QR de check-in"
                              className="h-36 w-36"
                            />
                          ) : (
                            <div className="flex h-36 w-36 items-center justify-center rounded-xl bg-muted/10">
                              <QrCode className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <p className="mt-2 max-w-[170px] text-center text-[10px] leading-4 text-muted-foreground">
                          {attendance?.credential
                            ? "Apresenta este QR no check-in"
                            : "Credencial indisponível"}
                        </p>
                      </div>
                    </div>

                    {(attendance?.checkIns ?? []).length > 0 ? (
                      <div className="border-t border-slate-100 p-4 sm:p-5">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <History className="h-3.5 w-3.5" />
                          Histórico de presenças
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {(attendance?.checkIns ?? [])
                            .slice(0, 4)
                            .map((checkIn) => (
                              <div
                                key={checkIn.id}
                                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-900">
                                    {checkIn.eventLabel}
                                  </p>
                                  <p className="text-slate-500">
                                    Confirmado por{" "}
                                    {checkIn.checkedInByStudentNumber}
                                  </p>
                                </div>
                                <span className="shrink-0 text-slate-500">
                                  {itemDateLabel(checkIn.checkedInAt)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </motion.section>

                </div>

                {renderExhibitorVoteQrSection()}

                {renderExhibitorRoundFlow()}

                {renderExhibitorTeamActivity()}

                {exhibitorPassportProject ? (
                  <motion.section
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.08 }}
                    className="desafio-journey"
                  >
                    <div className="desafio-journey__header">
                      <div className="desafio-journey__header-left">
                        <div className="desafio-journey__header-icon">
                          <BriefcaseBusiness className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Mapa do Expositor
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            {exhibitorPassportProject.name} ·{" "}
                            {exhibitorPassportProject.viewerRole ===
                            "RESPONSAVEL"
                              ? "Responsável"
                              : "Membro"}
                          </p>
                        </div>
                      </div>
                      <div
                        className="passport-progress-ring"
                        style={exhibitorPassportProgressStyle}
                      >
                        <span>{exhibitorPassportProgressPercent}%</span>
                      </div>
                    </div>

                    <div className="desafio-journey__legend">
                      <div className="desafio-journey__legend-item">
                        <span className="desafio-journey__legend-dot is-done" />
                        <span>Concluída</span>
                      </div>
                      <div className="desafio-journey__legend-item">
                        <span className="desafio-journey__legend-dot is-current" />
                        <span>Disponível</span>
                      </div>
                      <div className="desafio-journey__legend-item">
                        <span className="desafio-journey__legend-dot is-locked" />
                        <span>Bloqueada</span>
                      </div>
                    </div>

                    <div className="desafio-journey__summary">
                      <div className="desafio-journey__summary-row">
                        <div className="desafio-journey__summary-item">
                          <span>Total disponível</span>
                          <strong>{exhibitorPassportTotalPoints} pts</strong>
                        </div>
                        <div className="desafio-journey__summary-divider" />
                        <div className="desafio-journey__summary-item">
                          <span>Pontos atuais</span>
                          <strong className="is-earned">
                            {exhibitorPassportPoints} pts
                          </strong>
                        </div>
                        <div className="desafio-journey__summary-divider" />
                        <div className="desafio-journey__summary-item">
                          <span>Ranking</span>
                          <strong>
                            {exhibitorPassportProject.ranking
                              ? `#${exhibitorPassportProject.ranking.position}`
                              : "Sem posição"}
                          </strong>
                        </div>
                        <div className="desafio-journey__summary-divider" />
                        <div className="desafio-journey__summary-item">
                          <span>Missões</span>
                          <strong>
                            {completedExhibitorPassportMissions}/
                            {exhibitorPassportMissions.length}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="desafio-journey__list">
                      {exhibitorPassportMissions.map((mission, index) => {
                        const MissionIcon = mission.icon;
                        const isCurrentMission =
                          currentExhibitorPassportRouteIndex === index;
                        const isDone = mission.status === "done";
                        const state = isDone
                          ? "is-done"
                          : isCurrentMission
                            ? "is-current"
                            : mission.status === "locked"
                              ? "is-locked"
                              : "";

                        return (
                          <div
                            key={mission.key}
                            className={`desafio-mission ${state}`}
                          >
                            <div className="desafio-mission__step">
                              <span className="desafio-mission__step-num">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              {index < exhibitorPassportMissions.length - 1 ? (
                                <div className="desafio-mission__connector" />
                              ) : null}
                            </div>
                            <div className="desafio-mission__pin">
                              {isDone ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <MissionIcon className="h-4 w-4" />
                              )}
                            </div>
                            <div className="desafio-mission__info">
                              <p>{mission.label}</p>
                              <span>{mission.description}</span>
                              {isDone && mission.completions > 0 ? (
                                <span className="desafio-mission__earned">
                                  {mission.pointsEarned > 0
                                    ? `${mission.pointsEarned} pts ganhos`
                                    : "Concluída"}
                                  {mission.completions > 1
                                    ? ` · ${mission.completions}x`
                                    : ""}
                                </span>
                              ) : null}
                            </div>
                            <div className="desafio-mission__score">
                              <span className="desafio-mission__points">
                                +{mission.points}
                              </span>
                              <span className="desafio-mission__points-label">
                                pts
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {nextExhibitorPassportMission &&
                    nextExhibitorPassportMission.status !== "done" ? (
                      <div className="desafio-journey__next">
                        <div className="desafio-journey__next-card">
                          <Zap className="h-4 w-4 shrink-0 text-orange-600" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-orange-900">
                              Próxima missão do expositor
                            </p>
                            <p className="mt-0.5 text-[11px] text-orange-800/70">
                              {nextExhibitorPassportMission.label} · +
                              {nextExhibitorPassportMission.points} pontos
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-orange-400" />
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                      <section className="desafio-module">
                        <div className="desafio-module__header">
                          <div className="desafio-module__header-left">
                            <div className="desafio-module__icon is-network">
                              <Swords className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">
                                Continuar a ganhar pontos
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                Ações repetíveis durante a feira
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-slate-400">
                            {exhibitorPassportContinuousActions.length} ações
                          </span>
                        </div>
                        <div className="desafio-module__body">
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {exhibitorPassportContinuousActions.map((action) => {
                              const ActionIcon = action.icon;

                              return (
                                <div
                                  key={action.key}
                                  className="flex min-h-[104px] flex-col rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                                >
                                  <div className="flex items-start gap-2.5">
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-orange-600 shadow-sm">
                                      <ActionIcon className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <p className="text-xs font-bold text-slate-900">
                                          {action.title}
                                        </p>
                                        <span
                                          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${exhibitorOpportunityStatusClass(action.status)}`}
                                        >
                                          {exhibitorOpportunityStatusLabel(
                                            action.status,
                                          )}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-[11px] leading-4 text-slate-500">
                                        {action.description}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[11px]">
                                    <span className="font-bold text-orange-700">
                                      {action.pointsLabel}
                                    </span>
                                    <span className="font-semibold text-slate-400">
                                      {action.completedCount > 0
                                        ? `${action.completedCount}x · ${action.pointsEarned} pts`
                                        : "por fazer"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </section>

                      <section className="desafio-module">
                        <div className="desafio-module__header">
                          <div className="desafio-module__header-left">
                            <div className="desafio-module__icon is-reward">
                              <Gift className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">
                                Bónus e missões extras
                              </h3>
                              <p className="text-[11px] text-slate-500">
                                Há mais formas de subir além da trilha
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-slate-400">
                            {
                              exhibitorPassportBonusOpportunities.filter(
                                (opportunity) => opportunity.status === "done",
                              ).length
                            }
                            /{exhibitorPassportBonusOpportunities.length}
                          </span>
                        </div>
                        <div className="desafio-module__body">
                          <div className="space-y-2.5">
                            {exhibitorPassportBonusOpportunities.map((opportunity) => {
                              const OpportunityIcon = opportunity.icon;

                              return (
                                <div
                                  key={opportunity.key}
                                  className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                                >
                                  <OpportunityIcon
                                    className={`h-4 w-4 shrink-0 ${
                                      opportunity.status === "done"
                                        ? "text-emerald-500"
                                        : opportunity.status === "attention"
                                          ? "text-rose-500"
                                          : "text-orange-500"
                                    }`}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-semibold text-slate-900">
                                      {opportunity.title}
                                    </p>
                                    <p className="truncate text-[10px] text-slate-500">
                                      {opportunity.description}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <span className="block text-xs font-bold text-orange-700">
                                      {opportunity.pointsLabel}
                                    </span>
                                    {opportunity.completedCount > 0 ? (
                                      <span className="text-[10px] font-semibold text-emerald-600">
                                        {opportunity.completedCount}x
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-semibold text-slate-400">
                                        possível
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    </div>

                    <div className="mt-6 grid gap-6 sm:grid-cols-2">
                      <section className="desafio-module">
                        <div className="desafio-module__header">
                          <div className="desafio-module__header-left">
                            <div className="desafio-module__icon is-badge">
                              <Award className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900">
                              Selos do Expositor
                            </h3>
                          </div>
                          <span className="text-xs font-bold text-slate-400">
                            {
                              exhibitorPassportBadges.filter(
                                (badge) => badge.active,
                              ).length
                            }
                            /{exhibitorPassportBadges.length}
                          </span>
                        </div>
                        <div className="desafio-module__body">
                          <div className="desafio-badges">
                            {exhibitorPassportBadges.map((badge) => {
                              const BadgeIcon = badge.icon;

                              return (
                                <span
                                  key={badge.label}
                                  className={`desafio-badge ${
                                    badge.active ? "is-earned" : "is-locked"
                                  }`}
                                >
                                  <BadgeIcon
                                    className={`h-3 w-3 ${
                                      badge.active ? "" : "opacity-40"
                                    }`}
                                  />
                                  {badge.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </section>

                      <section className="desafio-module">
                        <div className="desafio-module__header">
                          <div className="desafio-module__header-left">
                            <div className="desafio-module__icon is-reward">
                              <TrendingUp className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900">
                              Pontos recentes
                            </h3>
                          </div>
                          <span className="text-xs font-bold text-slate-400">
                            {exhibitorPassportProject.recentEvents.length} mov.
                          </span>
                        </div>
                        <div className="desafio-module__body">
                          {exhibitorPassportProject.recentEvents.length ? (
                            <div className="space-y-2.5">
                              {exhibitorPassportProject.recentEvents
                                .slice(0, 4)
                                .map((event) => {
                                  const gained = event.points >= 0;

                                  return (
                                    <div
                                      key={event.businessKey}
                                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                                    >
                                      {gained ? (
                                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                                      ) : (
                                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-semibold text-slate-900">
                                          {event.reason ?? event.action}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                          {event.roundLabel ?? "Pontuação"} ·{" "}
                                          {itemDateLabel(event.awardedAt)}
                                        </p>
                                      </div>
                                      <span
                                        className={`text-xs font-bold ${
                                          gained
                                            ? "text-emerald-600"
                                            : "text-rose-600"
                                        }`}
                                      >
                                        {gained ? "+" : ""}
                                        {event.points}
                                      </span>
                                    </div>
                                  );
                                })}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center rounded-xl bg-slate-50 py-8 text-center text-slate-400">
                              <Trophy className="mb-2 h-6 w-6 opacity-50" />
                              <p className="text-xs">
                                Os pontos do projeto aparecem aqui quando a
                                feira começar.
                              </p>
                            </div>
                          )}
                        </div>
                      </section>
                    </div>
                  </motion.section>
                ) : null}

              </>
            )}
          </TabsContent>

          {/* === DESAFIO TAB v2 — Premium Passport Experience === */}
          <TabsContent value="desafio" className="desafio-tab-panel space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {loading ? (
              <div className="flex min-h-[400px] items-center justify-center rounded-[28px] border border-slate-100 bg-white/50">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              </div>
            ) : (
              <>
                {/* ── Hero Passport Card — Travel Ticket ── */}
                <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="desafio-hero"
                  style={{ "--hero-progress": `${Math.min(100, Math.max(0, passportProgressPercent)) * 3.6}deg` } as CSSProperties}
                >
                  <div className="desafio-hero__glow" aria-hidden="true" />
                  <div className="desafio-hero__stamp" aria-hidden="true" />
                  <div className="desafio-hero__perforation" aria-hidden="true" />
                  <div className="desafio-hero__notch desafio-hero__notch--top" aria-hidden="true" />
                  <div className="desafio-hero__notch desafio-hero__notch--bottom" aria-hidden="true" />

                  {/* Ticket Stub — left side */}
                  <div className="desafio-hero__stub" aria-hidden="true">
                    <div className="desafio-hero__ring">
                      <span>{passportPoints}</span>
                      <em>pontos</em>
                    </div>
                  </div>

                  {/* Ticket Header Strip */}
                  <div className="desafio-hero__ticket-header">
                    <span className="desafio-hero__ticket-label">
                      <Gamepad2 className="h-3 w-3" />
                      Boarding Pass
                    </span>
                    <span className="desafio-hero__ticket-serial">
                      UOR-{new Date().getFullYear()}-{String(passportPoints).padStart(4, "0")}
                    </span>
                  </div>

                  <div className="desafio-hero__content">
                    {/* Top: Identity + Rank */}
                    <div className="desafio-hero__top">
                      <div className="desafio-hero__identity">
                        {/* Mobile-only ring */}
                        <div className="desafio-hero__ring sm:hidden">
                          <span>{passportPoints}</span>
                          <em>pontos</em>
                        </div>
                        <div className="desafio-hero__titles">
                          <h2>Passaporte UOR Connect</h2>
                          <p>Jornada Interativa · {completedPassportMissions}/{passportMissions.length} missões</p>
                        </div>
                      </div>
                      {passportSummary?.ranking ? (
                        <div className="desafio-hero__rank">
                          <strong>#{passportSummary.ranking.position}</strong>
                          <span>de {challengeParticipantCount}</span>
                        </div>
                      ) : (
                        <div className="desafio-hero__rank">
                          <strong>—</strong>
                          <span>{challengeParticipantCount} participantes</span>
                        </div>
                      )}
                    </div>

                    {/* Flight Info — FROM → TO */}
                    <div className="desafio-hero__flight-info">
                      <div className="desafio-hero__flight-point">
                        <span>Partida</span>
                        <strong>INÍCIO</strong>
                      </div>
                      <div className="desafio-hero__flight-route" />
                      <div className="desafio-hero__flight-point">
                        <span>Destino</span>
                        <strong>{passportProgressPercent >= 100 ? "META ✓" : "META"}</strong>
                      </div>
                      <div className="desafio-hero__flight-point" style={{ marginLeft: "auto" }}>
                        <span>Gate</span>
                        <strong>{completedPassportMissions}/{passportMissions.length}</strong>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="desafio-hero__progress-bar">
                        <div className="desafio-hero__progress-fill" style={{ width: `${passportProgressPercent}%` }} />
                      </div>
                      <div className="desafio-hero__progress-label">
                        <span>{completedPassportMissions} de {passportMissions.length} missões</span>
                        <span>{passportProgressPercent}%</span>
                      </div>
                    </div>

                    {/* Telemetry strip */}
                    <div className="desafio-telemetry">
                      <div className="desafio-telemetry__item">
                        <span>Etapas</span>
                        <strong>{completedPassportMissions}/{passportMissions.length}</strong>
                      </div>
                      <div className="desafio-telemetry__item">
                        <span>Pontos</span>
                        <strong>{passportPoints}</strong>
                      </div>
                      <div className="desafio-telemetry__item">
                        <span>Ranking</span>
                        <strong>{passportSummary?.ranking ? `#${passportSummary.ranking.position}` : "—"}</strong>
                      </div>
                      <div className="desafio-telemetry__item">
                        <span>Progresso</span>
                        <strong>{passportProgressPercent}%</strong>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="desafio-hero__cta">
                      {!passportJoined ? (
                        <button
                          type="button"
                          className="desafio-hero__join-btn"
                          disabled={joiningPassport}
                          onClick={() => void handleJoinPassport()}
                        >
                          {joiningPassport ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                          Aceitar Convite e Começar
                        </button>
                      ) : (
                        <div className="desafio-hero__accepted">
                          <CheckCircle2 className="h-4 w-4" />
                          Passaporte ativo · Scanner pronto
                        </div>
                      )}
                      <Button
                        variant="outline"
                        className="h-10 shrink-0 rounded-xl border-orange-400/40 bg-orange-500/10 text-xs font-bold text-orange-300 hover:border-orange-400/60 hover:bg-orange-500/20 hover:text-orange-200"
                        disabled={downloadingChallengeManual}
                        onClick={() => void handleDownloadChallengeManual()}
                      >
                        {downloadingChallengeManual ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
                        Manual do desafio
                      </Button>
                    </div>
                  </div>

                  {/* Barcode strip */}
                  <div className="desafio-hero__barcode" aria-hidden="true">
                    <div className="desafio-hero__barcode-lines">
                      {Array.from({ length: 32 }).map((_, i) => (
                        <span
                          key={i}
                          style={{
                            width: `${i % 3 === 0 ? 3 : i % 5 === 0 ? 1 : 2}px`,
                            height: `${14 + (i * 7) % 10}px`,
                            animationDelay: `${i * 90}ms`,
                          }}
                        />
                      ))}
                    </div>
                    <span className="desafio-hero__barcode-text">
                      UOR CONNECT · PASSAPORTE DIGITAL · {new Date().getFullYear()}
                    </span>
                  </div>
                </motion.section>

                {passportJoined ? (
                  <>
                {/* ── Main Content Grid ── */}
                <div className="desafio-main-grid">
                  {/* Left Column: Scanner */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="space-y-6 lg:col-span-5"
                  >
                    {/* Scanner Card */}
                    <section className="desafio-scanner">
                      <div className="desafio-scanner__header">
                        <div className="desafio-scanner__icon">
                          <ScanLine className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">Scanner Oficial</h3>
                          <p className="text-[11px] text-slate-500">Lê QR codes da feira para ganhar pontos</p>
                        </div>
                      </div>

                      <QrCameraScanner
                        open={scannerOpen}
                        onClose={() => setScannerOpen(false)}
                        onRead={(value) => { void handleScan(value); }}
                      />
                      <QrCameraScanner
                        open={constructiveFeedbackScannerOpen}
                        onClose={() => setConstructiveFeedbackScannerOpen(false)}
                        onRead={(value) => { void handleConstructiveFeedbackQrRead(value); }}
                      />

                      <div className="desafio-scanner__body">
                        <button
                          type="button"
                          className="desafio-scanner__scan-btn flex items-center justify-center gap-2"
                          onClick={() => setScannerOpen(true)}
                          disabled={scanning}
                        >
                          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                          Abrir câmera e escanear QR
                        </button>
                        <button
                          type="button"
                          className="desafio-scanner__scan-btn flex items-center justify-center gap-2"
                          onClick={() => setConstructiveFeedbackScannerOpen(true)}
                          disabled={resolvingConstructiveFeedbackProject}
                        >
                          {resolvingConstructiveFeedbackProject ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                          Escanear QR e fazer crítica
                        </button>
                        <p className="text-center text-[11px] font-medium leading-relaxed text-slate-500">
                          A leitura é feita pela câmera para proteger os pontos
                          e evitar códigos escritos manualmente.
                        </p>
                      </div>

                      {/* Scan result feedback */}
                      <AnimatePresence>
                        {scanResult ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden border-t border-slate-100"
                          >
                            <div className={`mx-5 mb-5 mt-4 flex items-start gap-3 rounded-xl p-4 ${
                              scanResult.success
                                ? "bg-emerald-50 text-emerald-900"
                                : scanResult.result === "ALREADY_DONE"
                                  ? "bg-amber-50 text-amber-900"
                                  : "bg-rose-50 text-rose-900"
                            }`}>
                              {scanResult.success ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              ) : (
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold">
                                  {scanResult.success ? "Sucesso" : scanResult.result === "ALREADY_DONE" ? "Já registado" : "Erro"}
                                </p>
                                <p className="mt-1 text-xs opacity-80">{scanResult.message}</p>
                                {scanResult.surprise ? (
                                  <div className="mt-3 rounded-lg bg-white/50 p-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">{surpriseEffectLabel(scanResult.surprise.effectType)}</p>
                                    <p className="mt-1 text-xs font-medium">{scanResult.surprise.name}</p>
                                    <div className="mt-2 flex items-center gap-2 text-sm font-bold">
                                      <span>{scanResult.surprise.beforePoints}</span>
                                      <span className="text-slate-400">→</span>
                                      <span className={scanResult.surprise.deltaPoints >= 0 ? "text-emerald-600" : "text-rose-600"}>{scanResult.surprise.afterPoints}</span>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                              <button onClick={() => setScanResult(null)} className="shrink-0 opacity-50 hover:opacity-100">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      {/* Recent scans */}
                      {scanHistory.length > 0 ? (
                        <div className="desafio-scanner__history">
                          <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                            <History className="h-3.5 w-3.5" />
                            Últimas leituras
                          </p>
                          <div className="space-y-2.5">
                            {scanHistory.slice(0, 4).map((scan) => (
                              <div key={scan.id} className="flex items-start gap-3">
                                <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${scan.result === "SUCCESS" ? "bg-emerald-500" : scan.result === "ALREADY_DONE" ? "bg-amber-500" : "bg-rose-500"}`} />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-slate-900">{scan.actionLabel}</p>
                                  <p className="truncate text-[10px] text-slate-500">{scan.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </section>

                    {/* Networking QR Card */}
                    {networkingQr ? (
                      <section className="desafio-module">
                        <div className="desafio-module__header">
                          <div className="desafio-module__header-left">
                            <div className="desafio-module__icon is-network">
                              <Network className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-slate-900">Networking</h3>
                              <p className="text-[11px] text-slate-500">QR pessoal intercurso</p>
                            </div>
                          </div>
                        </div>
                        <div className="desafio-module__body">
                          <div className="flex flex-col items-center rounded-xl bg-slate-50 p-6 text-center">
                            <div className="overflow-hidden rounded-xl bg-white p-2.5 shadow-sm">
                              <img src={networkingQr.qrImageUrl} alt="QR de Networking" className="h-28 w-28" />
                            </div>
                            <p className="mt-4 text-xs font-medium text-slate-600">Mostra este QR a estudantes de outros cursos</p>
                            <Button variant="outline" size="sm" className="mt-4 rounded-xl text-xs" onClick={() => void handleCopyNetworkingQr()}>
                              <Copy className="mr-2 h-3.5 w-3.5" />
                              Copiar link
                            </Button>
                          </div>
                        </div>
                      </section>
                    ) : null}
                  </motion.div>

                  {/* Right Column: Journey Map + Modules */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.18 }}
                    className="space-y-6 lg:col-span-7"
                  >
                    {/* Journey Map — Enhanced */}
                    <section className="desafio-journey">
                      <div className="desafio-journey__header">
                        <div className="desafio-journey__header-left">
                          <div className="desafio-journey__header-icon">
                            <Route className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Mapa do Desafio</h3>
                            <p className="text-[11px] text-slate-500">Todas as missões e pontos disponíveis</p>
                          </div>
                        </div>
                        <div className="passport-progress-ring" style={passportProgressStyle}>
                          <span>{passportProgressPercent}%</span>
                        </div>
                      </div>

                      {/* Points legend strip */}
                      <div className="desafio-journey__legend">
                        <div className="desafio-journey__legend-item">
                          <span className="desafio-journey__legend-dot is-done" />
                          <span>Concluída</span>
                        </div>
                        <div className="desafio-journey__legend-item">
                          <span className="desafio-journey__legend-dot is-current" />
                          <span>Disponível</span>
                        </div>
                        <div className="desafio-journey__legend-item">
                          <span className="desafio-journey__legend-dot is-locked" />
                          <span>Bloqueada</span>
                        </div>
                      </div>

                      <div className="desafio-journey__list">
                        {passportMissions.map((mission, index) => {
                          const MissionIcon = mission.icon;
                          const isCurrentMission = currentPassportRouteIndex === index;
                          const isDone = mission.status === "done";
                          const earnedPts = "pointsEarned" in mission ? (mission.pointsEarned as number) : (isDone ? mission.points : 0);
                          const completionCount = "completions" in mission ? (mission.completions as number) : (isDone ? 1 : 0);
                          const state = isDone
                            ? "is-done"
                            : isCurrentMission
                              ? "is-current"
                              : mission.status === "locked"
                                ? "is-locked"
                                : "";

                          return (
                            <div key={mission.key} className={`desafio-mission ${state}`}>
                              <div className="desafio-mission__step">
                                <span className="desafio-mission__step-num">{String(index + 1).padStart(2, "0")}</span>
                                {index < passportMissions.length - 1 && <div className="desafio-mission__connector" />}
                              </div>
                              <div className="desafio-mission__pin">
                                {isDone ? <CheckCircle2 className="h-4 w-4" /> : <MissionIcon className="h-4 w-4" />}
                              </div>
                              <div className="desafio-mission__info">
                                <p>{mission.label}</p>
                                <span>{mission.description}</span>
                                {isDone && completionCount > 0 && (
                                  <span className="desafio-mission__earned">
                                    {earnedPts > 0 ? `${earnedPts} pts ganhos` : "Concluída"}{completionCount > 1 ? ` · ${completionCount}x` : ""}
                                  </span>
                                )}
                                {mission.key === "affiliate-invite" && passportJoined ? (
                                  <button
                                    type="button"
                                    className="desafio-hero__accepted mt-2 transition hover:border-emerald-500/30 hover:bg-emerald-500/15"
                                    onClick={() => void handleCopyPassportReferral()}
                                  >
                                    <Copy className="h-4 w-4" />
                                    Copiar link
                                  </button>
                                ) : null}
                                {mission.key === "constructive-feedback" && passportJoined ? (
                                  <button
                                    type="button"
                                    className="desafio-hero__accepted mt-2 transition hover:border-emerald-500/30 hover:bg-emerald-500/15"
                                    onClick={() => setConstructiveFeedbackScannerOpen(true)}
                                    disabled={resolvingConstructiveFeedbackProject}
                                  >
                                    {resolvingConstructiveFeedbackProject ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <ScanLine className="h-4 w-4" />
                                    )}
                                    Escanear QR e fazer crítica
                                  </button>
                                ) : null}
                              </div>
                              <div className="desafio-mission__score">
                                <span className="desafio-mission__points">+{mission.points}</span>
                                <span className="desafio-mission__points-label">pts</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Total scoring summary */}
                      <div className="desafio-journey__summary">
                        <div className="desafio-journey__summary-row">
                          <div className="desafio-journey__summary-item">
                            <span>Total disponível</span>
                            <strong>{passportTotalPoints} pts</strong>
                          </div>
                          <div className="desafio-journey__summary-divider" />
                          <div className="desafio-journey__summary-item">
                            <span>Pontos ganhos</span>
                            <strong className="is-earned">{passportPoints} pts</strong>
                          </div>
                          <div className="desafio-journey__summary-divider" />
                          <div className="desafio-journey__summary-item">
                            <span>Missões</span>
                            <strong>{completedPassportMissions}/{passportMissions.length}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Next mission hint */}
                      {nextPassportMission && nextPassportMission.status !== "done" ? (
                        <div className="desafio-journey__next">
                          <div className="desafio-journey__next-card">
                            <Zap className="h-4 w-4 shrink-0 text-orange-600" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-orange-900">Próxima missão</p>
                              <p className="mt-0.5 text-[11px] text-orange-800/70">{nextPassportMission.label} · +{nextPassportMission.points} pontos</p>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-orange-400" />
                          </div>
                        </div>
                      ) : null}
                    </section>

                    {/* Bottom grid: Rewards + Badges */}
                    <div className="desafio-secondary-grid">
                      {/* Rewards */}
                      <section className="desafio-module">
                        <div className="desafio-module__header">
                          <div className="desafio-module__header-left">
                            <div className="desafio-module__icon is-reward">
                              <Gift className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900">QR surpresa</h3>
                          </div>
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                            {passportSummary?.recentSurprises?.length ?? 0} QR
                          </span>
                        </div>
                        <div className="desafio-module__body">
                          {passportSummary?.recentSurprises?.length ? (
                            <div className="space-y-2.5">
                              {passportSummary.recentSurprises.slice(0, 3).map((surprise) => {
                                const SurpriseIcon = surpriseEffectIconFor(surprise.effectType);
                                return (
                                  <div key={surprise.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                                    <SurpriseIcon className={`h-4 w-4 ${surprise.deltaPoints >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-semibold text-slate-900">{surprise.name}</p>
                                      <p className="text-[10px] text-slate-500">{surpriseEffectLabel(surprise.effectType)}</p>
                                    </div>
                                    <span className={`text-xs font-bold ${surprise.deltaPoints >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                      {surprise.deltaPoints >= 0 ? "+" : ""}{surprise.deltaPoints}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center rounded-xl bg-slate-50 py-8 text-center text-slate-400">
                              <Gift className="mb-2 h-6 w-6 opacity-50" />
                              <p className="text-xs">Encontra QRs surpresa pela feira para revelar efeitos no teu Passaporte.</p>
                            </div>
                          )}
                        </div>
                      </section>

                      {/* Badges / Selos */}
                      <section className="desafio-module">
                        <div className="desafio-module__header">
                          <div className="desafio-module__header-left">
                            <div className="desafio-module__icon is-badge">
                              <Award className="h-5 w-5" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900">Conquistas</h3>
                          </div>
                          <span className="text-xs font-bold text-slate-400">
                            {passportBadges.filter((b) => b.active).length}/{passportBadges.length}
                          </span>
                        </div>
                        <div className="desafio-module__body">
                          <div className="desafio-badges">
                            {passportBadges.map((badge) => {
                              const BadgeIcon = badge.icon;

                              return (
                                <span key={badge.label} className={`desafio-badge ${badge.active ? "is-earned" : "is-locked"}`}>
                                  <BadgeIcon className={`h-3 w-3 ${badge.active ? "" : "opacity-40"}`} />
                                  {badge.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    </div>
                  </motion.div>
                </div>

                {/* ── Prize Banner ── */}
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.25 }}
                  className="desafio-prize"
                >
                  <div className="desafio-prize__content">
                    <div className="flex items-center gap-4">
                      <div className="desafio-prize__icon">
                        <Trophy className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-950">Prémio oficial</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          O estudante com mais pontos ganha o <strong>Pagamento de 1 recurso no 2º semestre</strong>,
                          perfis de 1 mês de{" "}
                          <span className="font-black" style={{ color: "#00A8E1" }}>Prime Video</span>,{" "}
                          <span className="font-black" style={{ color: "#7B2CBF" }}>HBO</span> e{" "}
                          <span className="font-black" style={{ color: "#58CC02" }}>Duolingo Super</span>.
                          Certificado Top 3 para os melhores classificados.
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-bold text-orange-800">
                        <TrendingUp className="h-3 w-3" />
                        Ranking auditável
                      </span>
                    </div>
                  </div>
                </motion.section>

                {/* ── Batalha por Cursos ── */}
                {(() => {
                  const courseMap = new Map<string, { course: string; points: number; participants: number }>();
                  for (const row of passportLeaderboard) {
                    const course = row.studentCourse?.trim();
                    if (!course) continue;
                    const existing = courseMap.get(course);
                    if (existing) {
                      existing.points += row.points;
                      existing.participants += 1;
                    } else {
                      courseMap.set(course, { course, points: row.points, participants: 1 });
                    }
                  }
                  const courseRanking = Array.from(courseMap.values()).sort((a, b) => b.points - a.points);
                  const studentCourse = passportSummary?.ranking ? passportLeaderboard.find((r) => r.position === passportSummary.ranking!.position)?.studentCourse?.trim() : null;
                  const myPosition = studentCourse ? courseRanking.findIndex((c) => c.course === studentCourse) + 1 : null;
                  const top3 = courseRanking.slice(0, 3);
                  const podiumClasses = ["is-gold", "is-silver", "is-bronze"];
                  const podiumOrder = top3.length >= 2 ? [top3[1], top3[0], top3[2]].filter(Boolean) : top3;

                  if (courseRanking.length === 0) return null;

                  return (
                    <motion.section
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.3 }}
                      className="course-battle"
                    >
                      <div className="course-battle__header">
                        <div className="course-battle__header-left">
                          <div className="course-battle__header-icon">
                            <Swords className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">Batalha por Cursos</h3>
                            <p className="text-[11px] text-slate-500">Ranking coletivo por curso</p>
                          </div>
                        </div>
                        {myPosition ? (
                          <div className="course-battle__my-rank">
                            <strong>#{myPosition}</strong>
                            <span>{studentCourse}</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Podium */}
                      {top3.length >= 2 ? (
                        <div className="course-battle__podium">
                          {podiumOrder.map((item) => {
                            if (!item) return null;
                            const originalIndex = top3.indexOf(item);
                            return (
                              <div key={item.course} className="course-battle__podium-item">
                                {originalIndex === 0 ? <Crown className="h-5 w-5 course-battle__crown" /> : <div className="h-5" />}
                                <div className={`course-battle__podium-bar ${podiumClasses[originalIndex] ?? ''}`}>
                                  <span className="course-battle__podium-position">{originalIndex + 1}º</span>
                                </div>
                                <p className="course-battle__podium-name">{item.course}</p>
                                <p className="course-battle__podium-pts">{item.points} pts · {item.participants} alunos</p>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {/* Full list */}
                      <div className="course-battle__list">
                        {courseRanking.map((item, index) => (
                          <div key={item.course} className={`course-battle__row ${studentCourse && item.course === studentCourse ? 'is-mine' : ''}`}>
                            <span className="course-battle__row-pos">{index + 1}º</span>
                            <span className="course-battle__row-name">{item.course}</span>
                            <span className="course-battle__row-pts">{item.points} pts</span>
                          </div>
                        ))}
                      </div>
                    </motion.section>
                  );
                })()}
                  </>
                ) : null}
              </>
            )}
          </TabsContent>

          {/* === PROJETOS TAB === */}
          <TabsContent value="submissoes" className="space-y-5">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-border/50 bg-card/80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-border/50 bg-card py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FileText className="h-8 w-8" />
                </div>
                <p className="mt-4 text-lg font-semibold">
                  Ainda não tens projetos
                </p>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  A tua primeira candidatura vai aparecer aqui.
                </p>
                {submissionsOpen ? (
                  <Button asChild className="mt-5 rounded-xl">
                    <Link to="/submeter">Submeter agora</Link>
                  </Button>
                ) : (
                  <Button disabled className="mt-5 rounded-xl bg-slate-200 text-slate-600 hover:bg-slate-200">
                    <Lock className="mr-1.5 h-3.5 w-3.5" />
                    Candidaturas encerradas
                  </Button>
                )}
              </div>
            ) : (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: {
                    transition: { staggerChildren: 0.08 },
                  },
                }}
                className="responsive-grid"
              >
                {submissions.map((item) => {
                  const Icon = submissionIcon(item.type);
                  const canManagePresentation =
                    item.canManagePresentation !== false;
                  const canManageChallenge = item.canManageChallenge !== false;
                  const canManageBanner =
                    item.status === "APPROVED" && canManagePresentation;
                  const bannerPreview = getProjectBannerSource(
                    resolveSubmissionBannerPreview(item),
                  );
                  const savingCurrentBanner = savingBannerId === item.id;
                  const projectPublicDetailsDraft =
                    projectPublicDetailsDrafts[item.id] ??
                    buildProjectPublicDetailsDraft(item);
                  const savingProjectPublicDetails =
                    savingProjectPublicDetailsId === item.id;
                  const projectPublicLinksTotal = projectPublicLinksCount(
                    projectPublicDetailsDraft,
                  );
                  const addingCurrentMember = addingTeamMemberId === item.id;
                  const teamMemberDraft = teamMemberDrafts[item.id] ?? "";
                  const teamCardState = getProjectTeamCardState(item);
                  const canDownloadExhibitorManual =
                    item.status === "APPROVED" &&
                    Boolean(item.exhibitorPdfPath) &&
                    teamCardState.confirmed;
                  const pendingTeamMembers = teamCardState.pendingMembers;
                  const projectChallenge =
                    projectChallenges.find(
                      (challenge) => challenge.submissionId === item.id,
                    ) ?? null;
                  const projectChallengeDraft =
                    projectChallengeDrafts[item.id] ??
                    draftFromProjectChallenge(projectChallenge);
                  const challengeOptions = projectChallengeDraft.options
                    .split(/\r?\n/)
                    .map((option) => option.trim())
                    .filter(Boolean);
                  const savingProjectChallenge =
                    savingProjectChallengeId === item.id;

                  return (
                    <motion.article
                      key={item.id}
                      variants={{
                        hidden: { opacity: 0, y: 12 },
                        show: { opacity: 1, y: 0 },
                      }}
                      whileHover={{
                        y: -4,
                        boxShadow: "0 20px 50px rgba(15, 23, 42, 0.1)",
                      }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="overflow-hidden rounded-3xl border border-border/50 bg-card"
                    >
                      <div className="relative h-[180px] overflow-hidden">
                        {bannerPreview ? (
                          <img
                            src={bannerPreview}
                            alt={`Capa do projeto ${item.name}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="h-full w-full"
                            style={{
                              background: submissionHeroGradient(item.type),
                            }}
                          />
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                          <ImagePlus className="h-3 w-3" />
                          Hero
                        </div>
                        <span
                          className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${statusTone(item.status)}`}
                        >
                          {item.statusLabel}
                        </span>
                      </div>

                      <div className="p-5">
                        <div className="flex items-start gap-3">
                          <div
                            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${submissionTone(item.type)}`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              {item.typeLabel}
                            </p>
                            <h2 className="mt-0.5 truncate text-lg font-semibold leading-tight text-foreground">
                              {item.name}
                            </h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.referenceCode}
                            </p>
                          </div>
                        </div>

                        {canManageBanner ? (
                          <div className="mt-4 rounded-xl border border-border/50 bg-muted/10 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Foto de capa
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                className="w-full max-w-[200px] rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs"
                                disabled={savingCurrentBanner}
                                onChange={(event) => {
                                  void handleSubmissionBannerFile(
                                    item,
                                    event.target.files?.[0] ?? null,
                                  );
                                  event.currentTarget.value = "";
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs"
                                disabled={savingCurrentBanner}
                                onClick={() => void handleSaveOwnBanner(item)}
                              >
                                {savingCurrentBanner ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : null}
                                Guardar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs"
                                disabled={
                                  savingCurrentBanner ||
                                  !resolveSubmissionBannerPreview(item)
                                }
                                onClick={() => void handleRemoveOwnBanner(item)}
                              >
                                <Trash2 className="mr-1 h-3 w-3" />
                                Remover
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {item.status === "APPROVED" &&
                        canManagePresentation ? (
                          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/60 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-950">
                                  Detalhes públicos do projeto
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                  Atualiza a descrição, site, repositório e redes
                                  que aparecem na página pública.
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-[10px] font-bold text-cyan-800">
                                {projectPublicLinksTotal} link
                                {projectPublicLinksTotal === 1 ? "" : "s"}
                              </span>
                            </div>

                            <div className="mt-3 grid gap-3">
                              <label className="block">
                                <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                                  Descrição pública
                                </span>
                                <Textarea
                                  value={projectPublicDetailsDraft.description}
                                  maxLength={500}
                                  onChange={(event) =>
                                    updateProjectPublicDetailsDraft(item.id, {
                                      description: event.target.value.slice(
                                        0,
                                        500,
                                      ),
                                    })
                                  }
                                  className="min-h-24 rounded-xl bg-white text-sm"
                                  placeholder="Explica o problema, a solução e o que o visitante deve observar."
                                  disabled={savingProjectPublicDetails}
                                />
                                <span className="mt-1 block text-right text-[10px] font-semibold text-slate-500">
                                  {projectPublicDetailsDraft.description.length}
                                  /500
                                </span>
                              </label>

                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className="block">
                                  <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                                    Website
                                  </span>
                                  <Input
                                    value={projectPublicDetailsDraft.websiteUrl}
                                    inputMode="url"
                                    className="h-10 rounded-xl bg-white text-sm"
                                    placeholder="https://..."
                                    disabled={savingProjectPublicDetails}
                                    onChange={(event) =>
                                      updateProjectPublicDetailsDraft(item.id, {
                                        websiteUrl: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                                    Repositório
                                  </span>
                                  <Input
                                    value={projectPublicDetailsDraft.repoUrl}
                                    inputMode="url"
                                    className="h-10 rounded-xl bg-white text-sm"
                                    placeholder="https://github.com/..."
                                    disabled={savingProjectPublicDetails}
                                    onChange={(event) =>
                                      updateProjectPublicDetailsDraft(item.id, {
                                        repoUrl: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                                    Instagram
                                  </span>
                                  <Input
                                    value={projectPublicDetailsDraft.instagramUrl}
                                    inputMode="url"
                                    className="h-10 rounded-xl bg-white text-sm"
                                    placeholder="https://instagram.com/..."
                                    disabled={savingProjectPublicDetails}
                                    onChange={(event) =>
                                      updateProjectPublicDetailsDraft(item.id, {
                                        instagramUrl: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                                    Facebook
                                  </span>
                                  <Input
                                    value={projectPublicDetailsDraft.facebookUrl}
                                    inputMode="url"
                                    className="h-10 rounded-xl bg-white text-sm"
                                    placeholder="https://facebook.com/..."
                                    disabled={savingProjectPublicDetails}
                                    onChange={(event) =>
                                      updateProjectPublicDetailsDraft(item.id, {
                                        facebookUrl: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                                    LinkedIn
                                  </span>
                                  <Input
                                    value={projectPublicDetailsDraft.linkedinUrl}
                                    inputMode="url"
                                    className="h-10 rounded-xl bg-white text-sm"
                                    placeholder="https://linkedin.com/..."
                                    disabled={savingProjectPublicDetails}
                                    onChange={(event) =>
                                      updateProjectPublicDetailsDraft(item.id, {
                                        linkedinUrl: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <label className="block">
                                  <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                                    GitHub
                                  </span>
                                  <Input
                                    value={projectPublicDetailsDraft.githubUrl}
                                    inputMode="url"
                                    className="h-10 rounded-xl bg-white text-sm"
                                    placeholder="https://github.com/..."
                                    disabled={savingProjectPublicDetails}
                                    onChange={(event) =>
                                      updateProjectPublicDetailsDraft(item.id, {
                                        githubUrl: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                              </div>
                            </div>

                            <Button
                              type="button"
                              className="mt-3 h-10 w-full rounded-xl bg-cyan-700 text-xs font-bold text-white hover:bg-cyan-800"
                              disabled={savingProjectPublicDetails}
                              onClick={() =>
                                void handleSaveProjectPublicDetails(item)
                              }
                            >
                              {savingProjectPublicDetails ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Guardar detalhes públicos
                            </Button>
                          </div>
                        ) : null}

                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                          <div className="flex items-start gap-3">
                            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700">
                              <UsersRound className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">
                                  Confirmação da equipa
                                </p>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                    teamCardState.confirmed
                                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                                      : "border-amber-500/25 bg-amber-500/10 text-amber-700"
                                  }`}
                                >
                                  {teamCardState.label}
                                </span>
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {item.viewerRole === "MEMBRO"
                                  ? "Este projeto está ligado à tua equipa. Podes acompanhar o estado e baixar os documentos quando estiverem disponíveis."
                                  : teamCardState.isRejected
                                  ? "A candidatura foi recusada, por isso a confirmação de membros deixa de ser necessária."
                                  : teamCardState.confirmationRequired
                                    ? "O representante já está confirmado por padrão. Partilha o link com os restantes membros para ficarem ligados ao projeto."
                                    : "Este projeto está registado como participação individual."}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 rounded-lg border border-white bg-white p-2.5">
                            <label className="block text-[11px] font-semibold text-muted-foreground">
                              Adicionar membro ao convite
                            </label>
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={teamMemberDraft}
                                placeholder="Nome completo do membro"
                                className="h-9 rounded-lg text-xs"
                                disabled={
                                  addingCurrentMember ||
                                  !teamCardState.canManageMembers
                                }
                                onChange={(event) =>
                                  setTeamMemberDrafts((current) => ({
                                    ...current,
                                    [item.id]: event.target.value,
                                  }))
                                }
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" &&
                                    teamCardState.canManageMembers
                                  ) {
                                    event.preventDefault();
                                    void handleAddTeamMember(item);
                                  }
                                }}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 shrink-0 rounded-lg text-xs"
                                disabled={
                                  addingCurrentMember ||
                                  !teamMemberDraft.trim() ||
                                  !teamCardState.canManageMembers
                                }
                                onClick={() => void handleAddTeamMember(item)}
                              >
                                {addingCurrentMember ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                Adicionar
                              </Button>
                            </div>
                            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                              {teamCardState.canManageMembers
                                ? "O nome entra no convite da equipa e passa a aparecer na página pública do projeto."
                                : "Esta candidatura já não aceita alterações de equipa."}
                            </p>
                          </div>

                          {teamCardState.showMemberConfirmationList ? (
                            <div className="mt-3 grid gap-2">
                              {item.teamMembers.map((member) => {
                                const canEditMemberNumber =
                                  teamCardState.canManageMembers &&
                                  !member.isResponsible &&
                                  !member.confirmed;
                                const memberNumberDraft =
                                  teamMemberStudentNumberDrafts[member.id] ??
                                  member.expectedStudentNumber ??
                                  member.studentNumber ??
                                  "";
                                const savingMemberNumber =
                                  savingTeamMemberStudentNumberId === member.id;
                                const externalDraft =
                                  teamMemberExternalDrafts[member.id] ?? {
                                    organization:
                                      member.externalOrganization ?? "",
                                    phone: "",
                                  };
                                const confirmingExternal =
                                  confirmingExternalTeamMemberId === member.id;
                                const removingMember =
                                  removingTeamMemberId === member.id;
                                const canRemoveMember =
                                  teamCardState.canManageMembers &&
                                  !member.isResponsible;
                                const externalCredentials =
                                  teamMemberExternalCredentials[member.id];

                                return (
                                  <div
                                    key={member.id}
                                    className="rounded-lg border border-white bg-white px-3 py-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="min-w-0">
                                        <span className="block truncate font-medium text-foreground">
                                          {member.name}
                                        </span>
                                        <span className="block truncate text-muted-foreground">
                                          {member.roleLabel}
                                          {member.confirmed
                                            ? ` · ${member.studentNumber || "Confirmado"}`
                                            : member.expectedStudentNumber
                                              ? ` · Nº ${member.expectedStudentNumber}`
                                              : " · Nº por preencher"}
                                        </span>
                                      </span>
                                      <span
                                        className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
                                          member.confirmed
                                            ? "bg-emerald-500/10 text-emerald-700"
                                            : "bg-amber-500/10 text-amber-700"
                                        }`}
                                      >
                                        {member.confirmed ? "OK" : "A confirmar"}
                                      </span>
                                    </div>

                                    {canRemoveMember ? (
                                      <div className="mt-2 flex justify-end">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 rounded-lg px-2 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                                          disabled={removingMember}
                                          onClick={() =>
                                            void handleRemoveTeamMember(item, member)
                                          }
                                        >
                                          {removingMember ? (
                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                          )}
                                          Remover membro
                                        </Button>
                                      </div>
                                    ) : null}

                                    {canEditMemberNumber ? (
                                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                        <Input
                                          value={memberNumberDraft}
                                          inputMode="numeric"
                                          placeholder="Nº de estudante"
                                          className="h-8 rounded-lg text-xs"
                                          disabled={savingMemberNumber}
                                          onChange={(event) =>
                                            setTeamMemberStudentNumberDrafts(
                                              (current) => ({
                                                ...current,
                                                [member.id]: event.target.value,
                                              }),
                                            )
                                          }
                                          onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                              event.preventDefault();
                                              void handleSaveTeamMemberStudentNumber(
                                                item,
                                                member.id,
                                              );
                                            }
                                          }}
                                        />
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 shrink-0 rounded-lg text-xs"
                                          disabled={
                                            savingMemberNumber ||
                                            memberNumberDraft.replace(/\D/g, "").trim()
                                              .length < 8
                                          }
                                          onClick={() =>
                                            void handleSaveTeamMemberStudentNumber(
                                              item,
                                              member.id,
                                            )
                                          }
                                        >
                                          {savingMemberNumber ? (
                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Save className="mr-1.5 h-3.5 w-3.5" />
                                          )}
                                          Guardar nº
                                        </Button>
                                      </div>
                                    ) : null}

                                    {canEditMemberNumber ? (
                                      <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-2.5">
                                        <p className="text-[11px] font-semibold text-slate-700">
                                          Outra universidade / instituto médio
                                        </p>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                                          <Input
                                            value={externalDraft.organization}
                                            placeholder="Instituição"
                                            className="h-8 rounded-lg bg-white text-xs"
                                            disabled={confirmingExternal}
                                            onChange={(event) =>
                                              setTeamMemberExternalDrafts(
                                                (current) => ({
                                                  ...current,
                                                  [member.id]: {
                                                    ...externalDraft,
                                                    organization:
                                                      event.target.value,
                                                  },
                                                }),
                                              )
                                            }
                                          />
                                          <Input
                                            value={externalDraft.phone}
                                            inputMode="tel"
                                            placeholder="Telefone"
                                            className="h-8 rounded-lg bg-white text-xs"
                                            disabled={confirmingExternal}
                                            onChange={(event) =>
                                              setTeamMemberExternalDrafts(
                                                (current) => ({
                                                  ...current,
                                                  [member.id]: {
                                                    ...externalDraft,
                                                    phone: event.target.value,
                                                  },
                                                }),
                                              )
                                            }
                                          />
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 shrink-0 rounded-lg bg-white text-xs"
                                            disabled={
                                              confirmingExternal ||
                                              externalDraft.organization.trim()
                                                .length < 2 ||
                                              externalDraft.phone.replace(/\D/g, "")
                                                .length < 8
                                            }
                                            onClick={() =>
                                              void handleConfirmExternalTeamMember(
                                                item,
                                                member.id,
                                                member.name,
                                              )
                                            }
                                          >
                                            {confirmingExternal ? (
                                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                                            )}
                                            Confirmar externo
                                          </Button>
                                        </div>
                                        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                                          Usa esta opção quando o membro não
                                          pertence à UOR/ISPTEC ou ainda não tem
                                          acesso académico integrado.
                                        </p>
                                      </div>
                                    ) : null}

                                    {externalCredentials ? (
                                      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-800">
                                        <p className="font-semibold">
                                          Acesso criado para {member.name}
                                        </p>
                                        <p className="mt-1">
                                          Nº {externalCredentials.studentNumber}
                                          {" · "}
                                          Senha temporária{" "}
                                          <span className="font-mono font-bold">
                                            {externalCredentials.temporaryPassword}
                                          </span>
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}

                          {teamCardState.canPrepareInvite ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs"
                                disabled={!teamCardState.canShareInvite}
                                onClick={() => void handleCopyTeamInvite(item)}
                              >
                                <Copy className="mr-1.5 h-3.5 w-3.5" />
                                Copiar link
                              </Button>
                              {teamCardState.canShareInvite ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs"
                                >
                                  <a
                                    href={`https://wa.me/?text=${encodeURIComponent(buildTeamInviteWhatsAppText(item))}`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Send className="mr-1.5 h-3.5 w-3.5" />
                                    Enviar aos membros
                                  </a>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg text-xs"
                                  disabled
                                >
                                  <Send className="mr-1.5 h-3.5 w-3.5" />
                                  Enviar aos membros
                                </Button>
                              )}
                              {teamCardState.missingMemberStudentNumbers ? (
                                <p className="basis-full text-[11px] leading-4 text-amber-700">
                                  Preenche o número de estudante dos membros pendentes antes de enviar o link.
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {item.status === "APPROVED" ? (
                          <div
                            className={`mt-4 rounded-xl border p-3 ${
                              canDownloadExhibitorManual
                                ? "border-primary/20 bg-primary/5"
                                : "border-amber-500/25 bg-amber-50"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background ${
                                  canDownloadExhibitorManual
                                    ? "border-primary/20 text-primary"
                                    : "border-amber-500/20 text-amber-700"
                                }`}
                              >
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground">
                                  {canDownloadExhibitorManual
                                    ? "Manual do expositor disponível"
                                    : "Manual do expositor bloqueado"}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                  {canDownloadExhibitorManual
                                    ? "Projeto aprovado e equipa confirmada. O PDF inclui o manual e os passes oficiais."
                                    : pendingTeamMembers > 0
                                      ? `Falta ${pendingTeamMembers} membro(s) confirmar(em) o convite de equipa para liberar o manual.`
                                      : "Aguarda a confirmação financeira da organização para liberar o manual oficial."}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="mt-3 w-full rounded-xl text-xs"
                              disabled={
                                downloadingExhibitorId === item.id ||
                                !canDownloadExhibitorManual
                              }
                              onClick={() =>
                                void handleDownloadExhibitorPdf(item)
                              }
                            >
                              {downloadingExhibitorId === item.id ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Baixar manual do expositor
                            </Button>
                          </div>
                        ) : null}

                        {item.status === "APPROVED" && canManageChallenge ? (
                          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-3">
                                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-700">
                                  <Puzzle className="h-5 w-5" />
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-950">
                                    Desafio do expositor
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-slate-600">
                                    Cria a pergunta ligada ao teu projeto. A
                                    admin aprova antes de liberar pontos no
                                    Passaporte.
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${projectChallengeStatusClass(projectChallenge?.status)}`}
                              >
                                {projectChallengeStatusLabel(
                                  projectChallenge?.status,
                                )}
                              </span>
                            </div>
                            {projectChallenge?.challenge?.reviewNote ? (
                              <p className="mt-3 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold leading-5 text-rose-700">
                                Nota da admin: {projectChallenge.challenge.reviewNote}
                              </p>
                            ) : null}

                            <div className="mt-3 grid gap-3">
                              <label className="block">
                                <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                                  Pergunta
                                </span>
                                <Textarea
                                  value={projectChallengeDraft.question}
                                  onChange={(event) =>
                                    updateProjectChallengeDraft(item.id, {
                                      question: event.target.value,
                                    })
                                  }
                                  className="min-h-20 rounded-xl bg-white text-sm"
                                  placeholder="Ex.: Qual problema principal este projeto resolve?"
                                  disabled={savingProjectChallenge}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                                  Opções de resposta
                                </span>
                                <Textarea
                                  value={projectChallengeDraft.options}
                                  onChange={(event) =>
                                    updateProjectChallengeDraft(item.id, {
                                      options: event.target.value,
                                    })
                                  }
                                  className="min-h-20 rounded-xl bg-white text-sm"
                                  placeholder={
                                    "Uma opção por linha\nFilas\nClima\nTrânsito"
                                  }
                                  disabled={savingProjectChallenge}
                                />
                              </label>
                              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_112px]">
                                <label className="block">
                                  <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                                    Resposta certa
                                  </span>
                                  <select
                                    value={projectChallengeDraft.correctAnswer}
                                    onChange={(event) =>
                                      updateProjectChallengeDraft(item.id, {
                                        correctAnswer: event.target.value,
                                      })
                                    }
                                    className="h-10 w-full rounded-xl border border-input bg-white px-3 text-sm"
                                    disabled={savingProjectChallenge}
                                  >
                                    <option value="">Assinalar opção</option>
                                    {challengeOptions.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="block">
                                  <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                                    Tentativas
                                  </span>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={projectChallengeDraft.maxAttempts}
                                    onChange={(event) =>
                                      updateProjectChallengeDraft(item.id, {
                                        maxAttempts: event.target.value
                                          ? String(clampProjectChallengeAttempts(event.target.value))
                                          : "",
                                      })
                                    }
                                    className="h-10 rounded-xl bg-white text-sm"
                                    inputMode="numeric"
                                    disabled={savingProjectChallenge}
                                  />
                                </label>
                              </div>
                              <label className="block">
                                <span className="mb-1.5 block text-[11px] font-bold text-slate-600">
                                  Explicação curta
                                </span>
                                <Input
                                  value={projectChallengeDraft.explanation}
                                  onChange={(event) =>
                                    updateProjectChallengeDraft(item.id, {
                                      explanation: event.target.value,
                                    })
                                  }
                                  className="h-10 rounded-xl bg-white text-sm"
                                  placeholder="Opcional: explica a resposta depois da tentativa."
                                  disabled={savingProjectChallenge}
                                />
                              </label>
                            </div>

                            {projectChallenge?.qrImageUrl ? (
                              <div className="mt-3 flex flex-col gap-3 rounded-xl border border-white bg-white p-3 sm:flex-row sm:items-center">
                                <img
                                  src={projectChallenge.qrImageUrl}
                                  alt="QR do desafio do expositor"
                                  className="h-24 w-24 rounded-xl border border-slate-100 bg-white p-1"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-950">
                                    QR do desafio
                                  </p>
                                  <p className="mt-1 text-[11px] leading-4 text-slate-500">
                                    {projectChallenge.status === "APPROVED"
                                      ? "Já pode ser escaneado pelos estudantes para abrir a pergunta."
                                      : "Criado, mas só fica válido depois da aprovação da admin."}
                                  </p>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="mt-2 h-8 rounded-lg text-xs"
                                    onClick={() =>
                                      void handleCopyProjectChallengeQr(
                                        projectChallenge,
                                      )
                                    }
                                  >
                                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                                    Copiar link
                                  </Button>
                                </div>
                              </div>
                            ) : null}

                            <Button
                              type="button"
                              className="mt-3 h-10 w-full rounded-xl bg-violet-700 text-xs font-bold text-white hover:bg-violet-800"
                              disabled={savingProjectChallenge}
                              onClick={() =>
                                void handleSaveProjectChallenge(item)
                              }
                            >
                              {savingProjectChallenge ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Guardar e enviar para aprovação
                            </Button>
                          </div>
                        ) : null}

                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/40 pt-4 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {itemDateLabel(item.createdAt)}
                          </span>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-xs"
                          >
                            <Link to={item.receiptPath}>
                              Recibo
                              <ExternalLink className="ml-1.5 h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </motion.div>
            )}
          </TabsContent>

          {/* === INSCRICOES TAB === */}
          <TabsContent value="inscricoes" className="space-y-5">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-border/50 bg-card/80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : enrollments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-border/50 bg-card py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                  <BookOpenCheck className="h-8 w-8" />
                </div>
                <p className="mt-4 text-lg font-semibold">
                  Ainda não tens inscrições
                </p>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  As tuas inscrições em cursos vão aparecer aqui.
                </p>
                <Button asChild className="mt-5 rounded-xl">
                  <Link to="/cursos">Ver cursos</Link>
                </Button>
              </div>
            ) : (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: {
                    transition: { staggerChildren: 0.08 },
                  },
                }}
                className="responsive-grid"
              >
                {enrollments.map((item) => (
                  <motion.article
                    key={item.id}
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      show: { opacity: 1, y: 0 },
                    }}
                    whileHover={{
                      y: -4,
                      boxShadow: "0 20px 50px rgba(15, 23, 42, 0.1)",
                    }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="overflow-hidden rounded-3xl border border-border/50 bg-card"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-600">
                          <GraduationCap className="h-5 w-5" />
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${statusTone(item.paymentStatus)}`}
                        >
                          {item.statusLabel}
                        </span>
                      </div>
                      <div className="mt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {item.companyName}
                        </p>
                        <h2 className="mt-1 text-lg font-semibold leading-tight text-foreground">
                          {item.courseName}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.referenceCode}
                        </p>
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/40 pt-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {itemDateLabel(item.enrolledAt)}
                        </span>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs"
                        >
                          <Link to={item.receiptPath}>
                            Ver inscrição
                            <ExternalLink className="ml-1.5 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </motion.div>
            )}
          </TabsContent>

          {/* === CERTIFICADO E PREMIO TAB === */}
          <TabsContent value="certificados" className="space-y-5">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-border/50 bg-card/80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              renderCertificatesSection()
            )}
          </TabsContent>

          {/* === PASSES TAB === */}
          <TabsContent value="passes" className="space-y-5">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-border/50 bg-card/80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              renderPassesSection()
            )}
          </TabsContent>
         </Tabs>

         <Dialog
           open={Boolean(selectedVoteQrSubmission)}
           onOpenChange={(open) => {
             if (!open) setSelectedVoteQrSubmission(null);
           }}
         >
           <DialogContent className="w-[94vw] max-w-[430px] overflow-hidden rounded-3xl border-border/70 p-0">
             <div className="space-y-5 bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))] p-5 sm:p-6">
               <DialogHeader className="text-left">
                 <DialogTitle className="flex items-center gap-2 font-heading text-lg">
                   <QrCode className="h-5 w-5 text-emerald-700" />
                   QR de conversão do projeto
                 </DialogTitle>
                 <DialogDescription className="text-sm leading-relaxed">
                   {selectedVoteQrSubmission?.name}
                 </DialogDescription>
               </DialogHeader>

               <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                 {voteQrImageUrl && !voteQrFailed ? (
                   <img
                     src={voteQrImageUrl}
                     alt={`QR de votação do projeto ${selectedVoteQrSubmission?.name ?? ""}`}
                     className="mx-auto aspect-square w-full max-w-[260px] rounded-2xl border border-emerald-100 bg-white object-contain p-2"
                     onError={() => setVoteQrFailed(true)}
                   />
                 ) : (
                   <div className="mx-auto flex aspect-square w-full max-w-[260px] items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 px-4 text-center text-sm text-muted-foreground">
                     {voteQrFailed
                       ? "Não foi possível gerar o QR. Usa o link abaixo."
                       : "A gerar QR de votação..."}
                   </div>
                 )}
               </div>

               <div className="rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3">
                 <p className="text-xs font-semibold leading-5 text-slate-700">
                   Ao escanear, o estudante vê um aviso antes de votar no teu projeto. O voto é registado no sistema e os bónus de conversão são tratados pelas regras do expositor.
                 </p>
               </div>

               <div className="space-y-2">
                 <Input
                   readOnly
                   value={selectedVoteQrUrl}
                   className="rounded-2xl border-emerald-100 bg-white text-xs"
                 />
                 <div className="grid grid-cols-2 gap-2">
                   <Button
                     type="button"
                     variant="outline"
                     className="rounded-2xl border-emerald-100 bg-white text-xs font-bold"
                     onClick={() => void handleCopyVoteQrLink()}
                   >
                     <Copy className="mr-2 h-4 w-4" />
                     Copiar link
                   </Button>
                   <Button
                     type="button"
                     variant="outline"
                     className="rounded-2xl border-emerald-100 bg-white text-xs font-bold"
                     asChild
                   >
                     <a href={selectedVoteQrUrl} target="_blank" rel="noreferrer noopener">
                       <ExternalLink className="mr-2 h-4 w-4" />
                       Abrir
                     </a>
                   </Button>
                 </div>
               </div>
             </div>
         </DialogContent>
       </Dialog>

       <Dialog
         open={Boolean(constructiveFeedbackProject)}
         onOpenChange={(open) => {
           if (!open) resetConstructiveFeedbackDialog();
         }}
       >
         <DialogContent className="w-[94vw] max-w-[520px] overflow-hidden rounded-3xl border-border/70 p-0">
           <div className="space-y-5 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))] p-5 sm:p-6">
             <DialogHeader className="text-left">
               <DialogTitle className="flex items-center gap-2 font-heading text-lg">
                 <FileText className="h-5 w-5 text-emerald-700" />
                 Crítica construtiva
               </DialogTitle>
               <DialogDescription className="text-sm leading-relaxed">
                 {constructiveFeedbackProject?.name}
               </DialogDescription>
             </DialogHeader>

             <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4">
               <div className="mb-3 flex flex-wrap gap-2">
                 {constructiveFeedbackFocusOptions.map((option) => (
                   <button
                     key={option.value}
                     type="button"
                     className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                       constructiveFeedbackFocus === option.value
                         ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                         : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-700"
                     }`}
                     onClick={() => setConstructiveFeedbackFocus(option.value)}
                   >
                     {option.label}
                   </button>
                 ))}
               </div>
               <Textarea
                 value={constructiveFeedbackText}
                 onChange={(event) => setConstructiveFeedbackText(event.target.value)}
                 maxLength={700}
                 className="min-h-[150px] rounded-2xl border-emerald-100 bg-white text-sm leading-6"
                 placeholder="Ex.: O projeto está bem apresentado, mas pode melhorar se mostrar..."
                 disabled={submittingConstructiveFeedback}
               />
               <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
                 <span>
                   {Math.min(constructiveFeedbackText.trim().length, 700)}/700
                 </span>
                 <span>
                   mínimo {CONSTRUCTIVE_FEEDBACK_MIN_LENGTH} caracteres
                 </span>
               </div>
             </div>

             <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
               <p className="text-xs font-semibold leading-5 text-amber-900">
                 Tu ganhas pontos no Passaporte Digital ao enviar críticas úteis em projetos diferentes. O bónus do expositor só entra depois da validação da organização como feedback qualificado.
               </p>
             </div>

             <div className="grid gap-2 sm:grid-cols-2">
               <Button
                 type="button"
                 variant="outline"
                 className="rounded-2xl border-slate-200 bg-white text-xs font-bold"
                 onClick={resetConstructiveFeedbackDialog}
                 disabled={submittingConstructiveFeedback}
               >
                 Cancelar
               </Button>
               <Button
                 type="button"
                 className="rounded-2xl bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800"
                 onClick={() => void handleSubmitConstructiveFeedback()}
                 disabled={
                   submittingConstructiveFeedback ||
                   constructiveFeedbackText.trim().length < CONSTRUCTIVE_FEEDBACK_MIN_LENGTH
                 }
               >
                 {submittingConstructiveFeedback ? (
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                 ) : (
                   <Send className="mr-2 h-4 w-4" />
                 )}
                 Enviar crítica
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>

       <Dialog
         open={Boolean(
           passportReferralInvite &&
              !passportJoined &&
              searchParams.get("aceitarConvite") !== "1",
          )}
          onOpenChange={(open) => {
            if (!open && passportReferralInvite && !passportJoined) {
              handleDeclinePassportReferral();
            }
          }}
        >
          <DialogContent className="overflow-hidden rounded-3xl border-0 p-0 shadow-2xl sm:max-w-xl" style={{ background: 'linear-gradient(145deg, #0c0c0e 0%, #111115 40%, #0d1117 100%)' }}>
            {/* Grid texture */}
            <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)', backgroundSize: '28px 28px', maskImage: 'linear-gradient(135deg, rgb(0 0 0 / 0.5), transparent 55%)' }} aria-hidden="true" />

            {/* Header strip */}
            <div className="relative z-10 flex items-center justify-between gap-3 px-5 pt-5 pb-2">
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">
                <Gamepad2 className="h-3 w-3" />
                Boarding Pass · Convite
              </span>
              <span className="font-mono text-[10px] font-bold text-white/25" style={{ letterSpacing: '0.08em' }}>
                UOR-{new Date().getFullYear()}-REF
              </span>
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col gap-4 px-5 pb-5 pt-2">
              <DialogHeader className="space-y-1">
                <DialogTitle className="flex items-center gap-2 text-xl font-black text-white">
                  <Send className="h-5 w-5 text-orange-400" />
                  Passaporte UOR Connect
                </DialogTitle>
                <DialogDescription className="text-[13px] text-white/50">
                  {passportReferralInvite?.inviterName} convidou-te para o desafio interativo.
                  Cumpre etapas por QR e compete no ranking dos estudantes.
                </DialogDescription>
              </DialogHeader>

              {/* Route strip */}
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 sm:gap-5">
                <div className="flex flex-col items-center text-center" style={{ minWidth: '50px' }}>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">Partida</span>
                  <strong className="mt-0.5 text-sm font-black" style={{ color: '#ff7a1a' }}>CONVITE</strong>
                </div>
                <div className="relative flex flex-1 items-center" style={{ minWidth: '30px', height: '2px', background: 'linear-gradient(90deg, rgb(255 122 26 / 0.3), rgb(255 122 26 / 0.6), rgb(255 122 26 / 0.3))' }}>
                  <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm" style={{ color: '#ff7a1a', filter: 'drop-shadow(0 0 4px rgb(255 122 26 / 0.4))' }}>✈</span>
                </div>
                <div className="flex flex-col items-center text-center" style={{ minWidth: '50px' }}>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">Destino</span>
                  <strong className="mt-0.5 text-sm font-black" style={{ color: '#ff7a1a' }}>DESAFIO</strong>
                </div>
              </div>

              {/* Inviter info */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                  Convidado por
                </p>
                <p className="mt-1.5 text-sm font-bold text-white">
                  {passportReferralInvite?.inviterName}
                </p>
                {passportReferralInvite?.inviterCourse ? (
                  <p className="mt-0.5 text-xs font-semibold text-white/45">
                    {passportReferralInvite.inviterCourse}
                  </p>
                ) : null}
              </div>

              {/* Prize */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
                    <Trophy className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Prémio oficial</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-white/50">
                      Pagamento de 1 recurso para estudante elegível, 1 mês de{" "}
                      <span className="font-black" style={{ color: "#00A8E1" }}>Prime Video</span>,{" "}
                      <span className="font-black" style={{ color: "#A855F7" }}>HBO</span> e{" "}
                      <span className="font-black" style={{ color: "#58CC02" }}>Duolingo Super</span>.
                      Certificado Top 3.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  className="passport-invite__btn passport-invite__btn--decline"
                  disabled={joiningPassport}
                  onClick={handleDeclinePassportReferral}
                >
                  <X className="h-4 w-4" />
                  Não, prefiro votar
                </button>
                <button
                  type="button"
                  className="passport-invite__btn passport-invite__btn--accept"
                  disabled={joiningPassport}
                  onClick={() => {
                    if (passportReferralCode) {
                      markPassportReferralAccepted(passportReferralCode);
                    }
                    void handleJoinPassport();
                  }}
                >
                  {joiningPassport ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Aceitar convite
                </button>
              </div>
            </div>

            {/* Barcode strip */}
            <div className="relative z-10 flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3">
              <div className="flex items-end gap-px" style={{ height: '18px' }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <span
                    key={i}
                    className="block rounded-sm"
                    style={{
                      width: `${i % 3 === 0 ? 3 : i % 5 === 0 ? 1 : 2}px`,
                      height: `${10 + (i * 4) % 8}px`,
                      background: 'rgb(255 255 255 / 0.18)',
                    }}
                  />
                ))}
              </div>
              <span className="font-mono text-[9px] font-bold text-white/20" style={{ letterSpacing: '0.1em' }}>
                UOR CONNECT · CONVITE · {new Date().getFullYear()}
              </span>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(scanResult?.requiresAnswer && scanResult.challenge)}
          onOpenChange={() => undefined}
        >
          <DialogContent
            className="challenge-answer-modal overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl sm:max-w-xl"
            onPointerDownOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => event.preventDefault()}
          >
            <div className="challenge-answer-modal__grid" aria-hidden="true" />
            <div className="challenge-answer-modal__header px-5 py-5 text-white">
              <div
                className="challenge-answer-modal__pulse"
                aria-hidden="true"
              />
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-black">
                  <Puzzle className="h-5 w-5 text-emerald-300" />
                  Desafio do expositor
                </DialogTitle>
                <DialogDescription className="text-sm text-white/65">
                  Escolhe a resposta certa. As tentativas dependem do que o
                  expositor configurou.
                </DialogDescription>
              </DialogHeader>
            </div>
            {scanResult?.challenge ? (
              <motion.div
                className="relative z-10 space-y-4 p-5"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
              >
                <div className="challenge-answer-modal__question">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                    {scanResult.actionLabel}
                  </p>
                  <h3 className="mt-2 text-base font-black leading-snug text-slate-950">
                    {scanResult.challenge.question}
                  </h3>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Até {scanResult.challenge.maxAttempts} tentativa(s)
                  </p>
                </div>

                {scanResult.challenge.options?.length ? (
                  <div className="grid gap-2">
                    {scanResult.challenge.options.map((option, index) => (
                      <motion.button
                        key={option}
                        type="button"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.18, delay: index * 0.04 }}
                        className={`challenge-answer-option min-h-12 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                          challengeAnswer === option
                            ? "is-selected border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                            : "border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50"
                        }`}
                        onClick={() => setChallengeAnswer(option)}
                        disabled={answeringChallenge}
                      >
                        {option}
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <Input
                    value={challengeAnswer}
                    onChange={(event) => setChallengeAnswer(event.target.value)}
                    placeholder="A tua resposta"
                    className="h-12 rounded-2xl border-emerald-100"
                    disabled={answeringChallenge}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleChallengeAnswer();
                    }}
                  />
                )}

                <Button
                  type="button"
                  className="h-12 w-full rounded-2xl bg-slate-950 font-black text-white hover:bg-slate-800"
                  disabled={answeringChallenge || !challengeAnswer.trim()}
                  onClick={() => void handleChallengeAnswer()}
                >
                  {answeringChallenge ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Puzzle className="mr-2 h-4 w-4" />
                  )}
                  Validar resposta
                </Button>
              </motion.div>
            ) : null}
          </DialogContent>
        </Dialog>

        <AnimatePresence>
          {scanCelebration ? (
            <motion.div
              className="scan-celebration-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-label={scanCelebration.title}
            >
              {scanCelebration.effect === "victory" ? (
                <div className="scan-confetti-field" aria-hidden="true">
                  {Array.from({ length: 36 }).map((_, index) => (
                    <span
                      key={index}
                      style={
                        {
                          "--x": `${(index * 31) % 100}%`,
                          "--delay": `${index * 22}ms`,
                          "--rotate": `${index * 12}deg`,
                          "--hue": 24 + ((index * 42) % 300),
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              ) : null}
              {scanCelebration.effect === "loss" ? (
                <div className="scan-point-drain" aria-hidden="true">
                  {Array.from({ length: 14 }).map((_, index) => (
                    <span
                      key={index}
                      style={
                        {
                          "--x": `${6 + ((index * 17) % 82)}%`,
                          "--delay": `${index * 35}ms`,
                        } as CSSProperties
                      }
                    >
                      -{Math.max(1, Math.abs(scanCelebration.points || 1))}
                    </span>
                  ))}
                </div>
              ) : null}
              {scanCelebration.effect === "sad" ? (
                <div className="scan-sad-ripple" aria-hidden="true" />
              ) : null}
              <motion.div
                className={`scan-celebration-card ${scanCelebrationToneClass[scanCelebration.tone]} scan-celebration-card--effect-${scanCelebration.effect ?? "ready"}`}
                initial={{ opacity: 0, y: 24, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 280, damping: 24 }}
                style={{ padding: "0 0 1.5rem 0" }}
              >
                <div
                  className="scan-celebration-card__shine"
                  aria-hidden="true"
                />

                {/* Medal & Icon */}
                <div className="scan-celebration-card__medal">
                  {scanCelebration.tone === "surprise" ? (
                    <Gift className="h-7 w-7" />
                  ) : scanCelebration.tone === "challenge" ? (
                    <Puzzle className="h-7 w-7" />
                  ) : scanCelebration.tone === "blocked" ? (
                    <AlertTriangle className="h-7 w-7" />
                  ) : scanCelebration.tone === "warning" ? (
                    <AlertTriangle className="h-7 w-7" />
                  ) : (
                    <CheckCircle2 className="h-7 w-7" />
                  )}
                </div>

                {/* Card body with padding */}
                <div style={{ padding: "0 1.25rem" }}>
                  <p className="scan-celebration-card__kicker">
                    {scanCelebration.actionLabel}
                  </p>
                  <h2>{scanCelebration.title}</h2>
                  <p>{scanCelebration.message}</p>
                  {shouldShowPassportCelebrationPoints(scanCelebration.points) ? (
                    <strong
                      className={scanCelebration.points < 0 ? "is-negative" : ""}
                    >
                      {scanCelebration.points > 0
                        ? `+${scanCelebration.points}`
                        : scanCelebration.points}{" "}
                      pts
                    </strong>
                  ) : null}

                  {/* Stamp decoration */}
                  <p style={{
                    marginTop: "0.75rem",
                    fontFamily: "monospace",
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "rgb(148 163 184 / 0.5)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}>
                    UOR Connect · Passaporte Digital · {new Date().toLocaleDateString("pt-AO")}
                  </p>

                  <Button
                    type="button"
                    className="mt-4 h-11 w-full rounded-xl bg-slate-950 px-5 font-bold text-white hover:bg-slate-800"
                    onClick={() => setScanCelebration(null)}
                  >
                    {scanResult?.requiresAnswer && scanResult.challenge
                      ? "Responder questão"
                      : "Continuar"}
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

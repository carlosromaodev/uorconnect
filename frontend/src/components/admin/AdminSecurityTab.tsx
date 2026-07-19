import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Copy,
  Crown,
  Download,
  Eye,
  ExternalLink,
  Fingerprint,
  FileBadge2,
  Globe,
  GraduationCap,
  HelpCircle,
  IdCard,
  KeyRound,
  Layers,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
  MessageSquare,
  Mic,
  Palette,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  ThumbsUp,
  Trash2,
  Trophy,
  Unlock,
  User,
  UserCheck,
  UserPlus,
  Users,
  Rocket,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminBulkSmsAction } from "@/components/admin/AdminBulkSmsAction";
import { ContextualSmsAction } from "@/components/admin/ContextualSmsAction";
import { toast } from "@/components/ui/sonner";
import { api, type AdminAccessConflict, type AdminAuthorizedStudent, type BulkInvitationResponse, type CredentialPrintBatch, type CredentialPrintBatchGenericInput, type CredentialPrintBatchInput, type CredentialPrintBatchNominalInput, type CredentialPrintTemplate, type CredentialPrintTemplateInput, type TeamCredentialIncompleteProfiles, type TeamCredentialInput, type TeamCredentialMember, type TeamCredentialMembershipMatchOverview, type TeamCredentialOverview, type TeamCredentialPassDuplexMode, type TeamCredentialPassOptions, type TeamCredentialPassPrintMode, type TeamMembership, type TeamMembershipClaim, type TeamMembershipClaimOverview, type TeamMembershipInput, type TeamMembershipOverview, type TeamMembershipSearchResult, type TeamProfilePreset } from "@/lib/api";
import { downloadBlobFile } from "@/lib/student-documents";

type AdminSecurityTabProps = {
  scope?: "security" | "nucleus" | "credentials";
  credentialSubpage?: CredentialAdminSubpage;
  accessForm: AdminAccessForm;
  adminAccessConflicts: AdminAccessConflict[];
  authorizedAdminStudents: AdminAuthorizedStudent[];
  authorizedStudentNumber: string;
  busyKey: string | null;
  onAccessFormChange: (value: AdminAccessForm | ((current: AdminAccessForm) => AdminAccessForm)) => void;
  onAuthorizeAdminStudent: () => void;
  onAuthorizedStudentNumberChange: (value: string) => void;
  onCredentialSubpageChange?: (value: CredentialAdminSubpage) => void;
  onRevokeAdminStudent: (studentNumber: string) => void;
};

type CredentialAdminSubpage =
  | "overview"
  | "links"
  | "members"
  | "bulk-issue"
  | "printing"
  | "templates"
  | "pending";

const credentialAdminSubpages: Array<{
  id: CredentialAdminSubpage;
  label: string;
  description: string;
  icon: typeof Shield;
}> = [
  {
    id: "overview",
    label: "Painel",
    description: "Resumo e atalhos principais da operação.",
    icon: IdCard,
  },
  {
    id: "links",
    label: "Criar links",
    description: "Convites individuais, coletivos e de expositores.",
    icon: Link2,
  },
  {
    id: "members",
    label: "Membros",
    description: "Equipas, perfis prontos, pesquisa e passes individuais.",
    icon: Users,
  },
  {
    id: "bulk-issue",
    label: "Emissão em lote",
    description: "Baixar expositores, núcleo e lotes operacionais prontos.",
    icon: FileBadge2,
  },
  {
    id: "printing",
    label: "Impressão",
    description: "PDFs, lotes nominais e passes genéricos.",
    icon: Download,
  },
  {
    id: "templates",
    label: "Templates",
    description: "Cores e rodapés oficiais por categoria.",
    icon: Palette,
  },
  {
    id: "pending",
    label: "Pendentes",
    description: "Perfis incompletos e correspondências por resolver.",
    icon: AlertTriangle,
  },
];

type AdminAccessForm = {
  team: string;
  role: "SUPER_ADMIN" | "TEAM_LEAD" | "MEMBER";
  permissions: string[];
};

/* ------------------------------------------------------------------ */
/*  Permission system                                                   */
/* ------------------------------------------------------------------ */

type PermissionCategory = {
  label: string;
  color: string;
  icon: typeof Shield;
  permissions: { value: string; label: string; icon: typeof Shield }[];
};

const permissionCategories: PermissionCategory[] = [
  {
    label: "Gestão principal",
    color: "emerald",
    icon: Shield,
    permissions: [
      { value: "OVERVIEW", label: "Visão Geral", icon: Eye },
      { value: "ANALYTICS", label: "Analytics", icon: Globe },
      { value: "SECURITY", label: "Segurança", icon: Lock },
      { value: "AUDIT", label: "Auditoria", icon: Clock },
      { value: "DATA_EXPORT", label: "Exportação", icon: Download },
      { value: "NUCLEUS", label: "Núcleo", icon: Users },
      { value: "CREDENTIALS", label: "Credenciais", icon: Shield },
      { value: "TASKS", label: "Tarefas", icon: ClipboardCheck },
    ],
  },
  {
    label: "Comunicação",
    color: "blue",
    icon: MessageSquare,
    permissions: [
      { value: "SMS", label: "SMS", icon: MessageSquare },
    ],
  },
  {
    label: "Académico",
    color: "violet",
    icon: GraduationCap,
    permissions: [
      { value: "STUDENTS", label: "Estudantes", icon: Users },
      { value: "COURSES", label: "Cursos", icon: BookOpen },
      { value: "CERTIFICATES", label: "Certificados", icon: Award },
      { value: "SUBMISSIONS", label: "Candidaturas", icon: ClipboardCheck },
    ],
  },
  {
    label: "Evento",
    color: "amber",
    icon: CalendarDays,
    permissions: [
      { value: "EVENTO", label: "Evento", icon: Palette },
      { value: "SPEAKERS", label: "Palestrantes", icon: Mic },
      { value: "SCHEDULE", label: "Agenda", icon: CalendarDays },
      { value: "ATTENDANCE", label: "Check-in", icon: ClipboardCheck },
      { value: "PANELS", label: "Painéis", icon: Zap },
    ],
  },
  {
    label: "Conteúdo",
    color: "rose",
    icon: Layers,
    permissions: [
      { value: "GUIDE", label: "Guia", icon: HelpCircle },
      { value: "FAQ", label: "FAQ", icon: HelpCircle },
      { value: "LIVE", label: "Ao Vivo", icon: Radio },
      { value: "JURY", label: "Júri", icon: KeyRound },
      { value: "VOTES", label: "Votações", icon: ThumbsUp },
      { value: "WINNERS", label: "Vencedores", icon: Trophy },
    ],
  },
];

const allPermissionValues = permissionCategories.flatMap((cat) => cat.permissions.map((p) => p.value));
const permissionOptions = permissionCategories.flatMap((cat) => cat.permissions);
const NUCLEUS_ORGANIZATION_LABEL = "Núcleo de Engenharia e Informática";

function adminPermissionLabel(value: string) {
  return permissionOptions.find((permission) => permission.value === value)?.label ?? value;
}

const credentialCategories = [
  { value: "NUCLEO", label: "Membro do Núcleo" },
  { value: "EXPOSITOR", label: "Expositor" },
  { value: "JURI", label: "Júri" },
  { value: "PALESTRANTE", label: "Palestrante" },
  { value: "MESTRE_CERIMONIA", label: "Mestre de Cerimónia" },
  { value: "PROTOCOLO", label: "Protocolo" },
  { value: "MARKETING", label: "Marketing" },
  { value: "LOGISTICA", label: "Logística" },
  { value: "RELACOES_INTERNAS", label: "Relações Internas" },
  { value: "RELACOES_EXTERNAS", label: "Relações Externas" },
  { value: "EXPLICADORES", label: "Explicadores" },
  { value: "STAFF", label: "Staff" },
  { value: "CONVIDADO", label: "Convidado" },
  { value: "OUTRO", label: "Outro" },
];

const defaultCredentialForm: TeamCredentialInput = {
  category: "NUCLEO",
  team: "Núcleo",
  role: "Membro",
  accessLevel: "Membro",
  permissions: ["EVENTO"],
  name: "",
};

const defaultTeamMembershipForm: TeamMembershipInput = {
  studentNumber: "",
  fullName: "",
  category: "NUCLEO",
  team: NUCLEUS_ORGANIZATION_LABEL,
  role: "Membro",
  accessLevel: "Membro",
  permissions: ["OVERVIEW", "TASKS", "NUCLEUS", "CREDENTIALS"],
  status: "ACTIVE",
  source: "MANUAL",
  notes: "",
};

const teamMembershipStatusOptions = [
  { value: "ACTIVE", label: "Ativo" },
  { value: "SUSPENDED", label: "Suspenso" },
  { value: "REMOVED", label: "Removido" },
  { value: "ALUMNI", label: "Antigo membro" },
] as const;

const defaultPrintTemplateForm: CredentialPrintTemplateInput = {
  primaryColor: "#0f172a",
  accentColor: "#334155",
  lightColor: "#f1f5f9",
  footerLabel: "Membro Oficial do Núcleo",
};

type CredentialVisualSource = {
  category?: string | null;
  categoryLabel?: string | null;
  team?: string | null;
  role?: string | null;
  accessLevel?: string | null;
};

type CredentialVisualTheme = {
  categoryLabel: string;
  primaryColor: string;
  accentColor: string;
  lightColor: string;
  footerLabel: string;
};

const credentialCategoryFallbackThemes: Record<string, Omit<CredentialVisualTheme, "categoryLabel">> = {
  NUCLEO: { primaryColor: "#0f172a", lightColor: "#f1f5f9", accentColor: "#334155", footerLabel: "Membro Oficial do Núcleo" },
  EXPOSITOR: { primaryColor: "#92400e", lightColor: "#fffbeb", accentColor: "#d97706", footerLabel: "Expositor Certificado" },
  JURI: { primaryColor: "#581c87", lightColor: "#faf5ff", accentColor: "#9333ea", footerLabel: "Membro do Júri" },
  PALESTRANTE: { primaryColor: "#1e3a5f", lightColor: "#eff6ff", accentColor: "#2563eb", footerLabel: "Palestrante Convidado" },
  MESTRE_CERIMONIA: { primaryColor: "#881337", lightColor: "#fff1f2", accentColor: "#e11d48", footerLabel: "Mestre de Cerimónia" },
  PROTOCOLO: { primaryColor: "#065f46", lightColor: "#ecfdf5", accentColor: "#059669", footerLabel: "Equipa de Protocolo" },
  MARKETING: { primaryColor: "#9a3412", lightColor: "#fff7ed", accentColor: "#ea580c", footerLabel: "Equipa de Marketing" },
  LOGISTICA: { primaryColor: "#164e63", lightColor: "#ecfeff", accentColor: "#0891b2", footerLabel: "Equipa de Logística" },
  RELACOES_INTERNAS: { primaryColor: "#831843", lightColor: "#fdf2f8", accentColor: "#db2777", footerLabel: "Relações Internas" },
  RELACOES_EXTERNAS: { primaryColor: "#134e4a", lightColor: "#f0fdfa", accentColor: "#0d9488", footerLabel: "Relações Externas" },
  EXPLICADORES: { primaryColor: "#3730a3", lightColor: "#eef2ff", accentColor: "#6366f1", footerLabel: "Explicador Académico" },
  STAFF: { primaryColor: "#374151", lightColor: "#f9fafb", accentColor: "#6b7280", footerLabel: "Staff do Evento" },
  CONVIDADO: { primaryColor: "#1f2937", lightColor: "#f8fafc", accentColor: "#0ea5e9", footerLabel: "Convidado Oficial" },
  OUTRO: { primaryColor: "#44403c", lightColor: "#fafaf9", accentColor: "#78716c", footerLabel: "Equipa UOR Connect" },
};

const nucleusFunctionVisualThemes: Array<{ matches: string[]; theme: Omit<CredentialVisualTheme, "categoryLabel"> }> = [
  { matches: ["presid", "govern", "direcao"], theme: { primaryColor: "#0f172a", lightColor: "#f1f5f9", accentColor: "#475569", footerLabel: "Direção do Núcleo" } },
  { matches: ["secretaria", "secretario", "arquivo", "expediente"], theme: { primaryColor: "#0f766e", lightColor: "#f0fdfa", accentColor: "#14b8a6", footerLabel: "Secretaria Executiva" } },
  { matches: ["tesour", "patrimonio", "financ"], theme: { primaryColor: "#92400e", lightColor: "#fffbeb", accentColor: "#d97706", footerLabel: "Tesouraria e Património" } },
  { matches: ["academ", "formacao", "curso", "mentoria"], theme: { primaryColor: "#3730a3", lightColor: "#eef2ff", accentColor: "#6366f1", footerLabel: "Assuntos Académicos" } },
  { matches: ["tecnologia", "sistema", "dados", "tecnica"], theme: { primaryColor: "#075985", lightColor: "#f0f9ff", accentColor: "#0284c7", footerLabel: "Tecnologia e Dados" } },
  { matches: ["comunicacao", "imagem", "media", "conteudo"], theme: { primaryColor: "#9f1239", lightColor: "#fff1f2", accentColor: "#e11d48", footerLabel: "Comunicação e Imagem" } },
  { matches: ["evento", "projeto", "inovacao", "atividade"], theme: { primaryColor: "#065f46", lightColor: "#ecfdf5", accentColor: "#059669", footerLabel: "Eventos e Projetos" } },
  { matches: ["relacoes", "parceria", "institucional", "externa"], theme: { primaryColor: "#134e4a", lightColor: "#f0fdfa", accentColor: "#0d9488", footerLabel: "Relações e Parcerias" } },
  { matches: ["logistica", "protocolo", "operacao", "credenciacao"], theme: { primaryColor: "#164e63", lightColor: "#ecfeff", accentColor: "#0891b2", footerLabel: "Logística e Protocolo" } },
  { matches: ["apoio", "colabor", "staff"], theme: { primaryColor: "#374151", lightColor: "#f9fafb", accentColor: "#6b7280", footerLabel: "Apoio Operacional" } },
];

function normalizeCredentialVisualText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function credentialVisualThemeFor(source: CredentialVisualSource, templates: CredentialPrintTemplate[] = []): CredentialVisualTheme {
  const category = source.category || "OUTRO";
  const categoryLabel = source.categoryLabel ?? credentialCategories.find((item) => item.value === category)?.label ?? category;
  const customizedTemplate = templates.find((template) => template.category === category && template.isCustomized);

  if (customizedTemplate) {
    return {
      categoryLabel: customizedTemplate.categoryLabel,
      primaryColor: customizedTemplate.primaryColor,
      accentColor: customizedTemplate.accentColor,
      lightColor: customizedTemplate.lightColor,
      footerLabel: customizedTemplate.footerLabel,
    };
  }

  if (category === "NUCLEO") {
    const searchText = normalizeCredentialVisualText(`${source.team ?? ""} ${source.role ?? ""} ${source.accessLevel ?? ""}`);
    const functionTheme = nucleusFunctionVisualThemes.find((item) => item.matches.some((needle) => searchText.includes(needle)));
    if (functionTheme) return { categoryLabel, ...functionTheme.theme };
  }

  const template = templates.find((item) => item.category === category);
  if (template) {
    return {
      categoryLabel: template.categoryLabel,
      primaryColor: template.primaryColor,
      accentColor: template.accentColor,
      lightColor: template.lightColor,
      footerLabel: template.footerLabel,
    };
  }

  return { categoryLabel, ...(credentialCategoryFallbackThemes[category] ?? credentialCategoryFallbackThemes.OUTRO) };
}

function credentialPanelStyle(theme: CredentialVisualTheme): CSSProperties {
  return {
    borderColor: `${theme.accentColor}55`,
    background: `linear-gradient(135deg, ${theme.lightColor}, #ffffff 64%)`,
  };
}

function credentialChipStyle(theme: CredentialVisualTheme): CSSProperties {
  return {
    borderColor: `${theme.accentColor}66`,
    backgroundColor: theme.lightColor,
    color: theme.primaryColor,
  };
}

function credentialActionStyle(theme: CredentialVisualTheme): CSSProperties {
  return {
    borderColor: `${theme.accentColor}66`,
    color: theme.primaryColor,
    backgroundColor: "#ffffff",
  };
}

function normalizeStudentNumberInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 12);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

type PrintBatchMode = "NOMINAL" | "GENERIC";
type BulkIssueGenericKey = "STAFF" | "PROTOCOLO" | "CONVIDADO" | "JURI";

type BulkIssueVipForm = {
  name: string;
  role: string;
  team: string;
  organization: string;
  accessLevel: string;
  instagramUrl: string;
  linkedinUrl: string;
  websiteUrl: string;
};

const defaultPrintBatchGenericForm: CredentialPrintBatchGenericInput = {
  category: "STAFF",
  team: "Staff",
  role: "Apoio Geral",
  accessLevel: "Staff",
  permissions: ["EVENTO"],
  prefix: "Staff",
  quantity: 10,
  startNumber: 1,
  organization: "",
  notes: "",
};

const bulkIssueGenericPresets: Array<{
  key: BulkIssueGenericKey;
  label: string;
  description: string;
}> = [
  {
    key: "STAFF",
    label: "Staff",
    description: "Passe operacional para apoio geral e equipas de suporte.",
  },
  {
    key: "PROTOCOLO",
    label: "Protocolo",
    description: "Passe genérico para acolhimento, entrada e orientação.",
  },
  {
    key: "CONVIDADO",
    label: "Convidados",
    description: "Credenciais neutras para convidados confirmados no dia.",
  },
  {
    key: "JURI",
    label: "Júri",
    description: "Lote reservado para avaliadores sem dados nominais ainda.",
  },
];

const defaultBulkIssueGenericForms: Record<
  BulkIssueGenericKey,
  CredentialPrintBatchGenericInput
> = {
  STAFF: {
    category: "STAFF",
    team: "Staff",
    role: "Apoio Geral",
    accessLevel: "Staff",
    permissions: ["EVENTO"],
    prefix: "Staff",
    quantity: 12,
    startNumber: 1,
    organization: "UOR Connect",
    notes: "",
  },
  PROTOCOLO: {
    category: "PROTOCOLO",
    team: "Protocolo",
    role: "Acolhimento e Apoio Público",
    accessLevel: "Protocolo",
    permissions: ["EVENTO", "ATTENDANCE"],
    prefix: "Protocolo",
    quantity: 10,
    startNumber: 1,
    organization: "UOR Connect",
    notes: "",
  },
  CONVIDADO: {
    category: "CONVIDADO",
    team: "Convidados",
    role: "Convidado Oficial",
    accessLevel: "Convidado",
    permissions: ["EVENTO"],
    prefix: "Convidado",
    quantity: 8,
    startNumber: 1,
    organization: "UOR Connect",
    notes: "",
  },
  JURI: {
    category: "JURI",
    team: "Júri",
    role: "Avaliador",
    accessLevel: "Júri",
    permissions: ["EVENTO", "VOTES"],
    prefix: "Júri",
    quantity: 4,
    startNumber: 1,
    organization: "UOR Connect",
    notes: "",
  },
};

const defaultBulkIssueVipForm: BulkIssueVipForm = {
  name: "Coordenadora do Curso",
  role: "Coordenadora do Curso",
  team: "Coordenação do Curso",
  organization: "Universidade Óscar Ribas",
  accessLevel: "VIP",
  instagramUrl: "",
  linkedinUrl: "",
  websiteUrl: "",
};

function normalizeBatchCategory(value: string | undefined) {
  const normalized = value?.trim().toUpperCase().replace(/\s+/g, "_");
  return credentialCategories.some((category) => category.value === normalized) ? normalized : "CONVIDADO";
}

function parsePrintBatchNominalText(value: string): CredentialPrintBatchNominalInput[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, category, team, role, organization, instagramUrl, linkedinUrl, websiteUrl] = line
        .split(/\s*[|;\t]\s*/)
        .map((part) => part.trim());

      return {
        name,
        category: normalizeBatchCategory(category),
        team: team || category || "Convidados",
        role: role || credentialCategories.find((item) => item.value === normalizeBatchCategory(category))?.label || "Convidado",
        accessLevel: role || credentialCategories.find((item) => item.value === normalizeBatchCategory(category))?.label || "Visitante",
        permissions: ["EVENTO"],
        organization: organization || null,
        instagramUrl: instagramUrl || null,
        linkedinUrl: linkedinUrl || null,
        websiteUrl: websiteUrl || null,
      };
    })
    .filter((item) => item.name.length >= 2);
}

function buildGenericPreviewItems(form: CredentialPrintBatchGenericInput) {
  const quantity = Math.max(1, Math.min(Number(form.quantity) || 1, 80));
  const startNumber = Math.max(1, Number(form.startNumber) || 1);
  const prefix = form.prefix?.trim() || "Passe";
  const digits = Math.max(2, String(startNumber + quantity - 1).length);
  return Array.from({ length: quantity }, (_, index) => ({
    name: `${prefix} ${String(startNumber + index).padStart(digits, "0")}`,
    category: form.category || "STAFF",
    team: form.team || "Staff",
    role: form.role || "Apoio Geral",
  }));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function roleLabel(role: string) {
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "TEAM_LEAD") return "Líder de Equipa";
  return "Membro";
}

function roleColor(role: string) {
  if (role === "SUPER_ADMIN") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (role === "TEAM_LEAD") return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "border-border/60 text-muted-foreground";
}

function adminAccessConflictLabel(issue: AdminAccessConflict["issue"]) {
  if (issue === "BLOCKED_BY_INACTIVE_MEMBERSHIP") return "Bloqueado por vínculo removido/suspenso";
  if (issue === "OFFICIAL_MEMBERSHIP_PRECEDENCE") return "Vínculo oficial prevalece";
  return "Sem vínculo ativo";
}

function adminAccessSourceLabel(source: AdminAccessConflict["effectiveSource"]) {
  if (source === "TEAM_MEMBERSHIP") return "Equipa oficial";
  if (source === "BLOCKED") return "Bloqueado";
  return "Autorização manual";
}

function credentialPdfFileName(member: TeamCredentialMember) {
  const base = (member.name || member.publicSlug)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `Passe_${base || "UOR_Connect"}.pdf`;
}

function safePdfFileBase(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function isCredentialPrintableInAdminBatch(member: Pick<TeamCredentialMember, "status">) {
  return !["DISABLED", "REVOKED", "EXPIRED"].includes(member.status);
}

function isOfficialNucleusCredentialMember(
  member: Pick<TeamCredentialMember, "category" | "teamMembershipId">,
) {
  return member.category !== "NUCLEO" || Boolean(member.teamMembershipId);
}

function isLikelyApiUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.startsWith("api.") || url.port === "3333" || url.pathname.startsWith("/api");
  } catch {
    return true;
  }
}

function currentAppUrl(path: string, fallback: string) {
  if (/^https?:\/\//i.test(fallback) && !isLikelyApiUrl(fallback)) {
    return fallback;
  }

  if (typeof window === "undefined") return fallback;

  const currentUrl = new URL(path, window.location.origin).toString();
  return isLikelyApiUrl(currentUrl) ? fallback : currentUrl;
}

function credentialInviteUrl(member: TeamCredentialMember) {
  return currentAppUrl(`/equipa/credencial/${encodeURIComponent(member.token)}`, member.inviteUrl);
}

function credentialProfileUrl(member: TeamCredentialMember) {
  return currentAppUrl(`/equipa/perfil/${encodeURIComponent(member.publicSlug)}`, member.profileUrl);
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Authorized admin card                                               */
/* ------------------------------------------------------------------ */

function AuthorizedAdminCard({
  student,
  busyKey,
  onRevoke,
}: {
  student: AdminAuthorizedStudent;
  busyKey: string | null;
  onRevoke: (studentNumber: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const permissionList = student.permissions === "ALL" ? allPermissionValues : student.permissions.split(",").filter(Boolean);
  const permissionCount = student.permissions === "ALL" ? allPermissionValues.length : permissionList.length;
  const roleTone = student.role === "SUPER_ADMIN"
    ? "from-amber-50 via-white to-white border-amber-200"
    : student.role === "TEAM_LEAD"
      ? "from-cyan-50 via-white to-white border-cyan-200"
      : "from-emerald-50 via-white to-white border-emerald-200";

  return (
    <Card className={`uor-vital-card group overflow-hidden bg-gradient-to-br ${roleTone} ${expanded ? "shadow-sm" : ""}`}>
      <div className="flex cursor-pointer flex-col gap-3 p-3 sm:p-4 sm:flex-row sm:items-center" onClick={() => setExpanded(!expanded)}>
        {/* Avatar */}
        <div className={`uor-icon-tile h-10 w-10 rounded-full text-xs font-bold text-white ${
          student.role === "SUPER_ADMIN"
            ? "bg-amber-600"
            : student.role === "TEAM_LEAD"
              ? "bg-blue-600"
              : "bg-slate-500"
        }`}>
          {student.role === "SUPER_ADMIN" ? <Crown className="h-4 w-4" /> : student.role === "TEAM_LEAD" ? <BadgeCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold font-mono">{student.studentNumber}</p>
            <Badge variant="outline" className={`text-[10px] ${roleColor(student.role)}`}>
              {roleLabel(student.role)}
            </Badge>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {student.team}
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" /> {permissionCount} área(s)
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatDate(student.createdAt)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <ContextualSmsAction
            title="Avisar acesso administrativo"
            buttonLabel="Avisar"
            recipient={{ studentNumber: student.studentNumber, name: `Estudante ${student.studentNumber}` }}
            defaultMessage={`Olá {{nome}}, o teu acesso administrativo ao UOR Connect foi configurado para a equipa ${student.team}. Entra no painel para gerir as tuas áreas.`}
          />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onRevoke(student.studentNumber)}
            disabled={busyKey === `security-revoke-${student.studentNumber}`}
            className="uor-action-button min-h-10 px-2.5 text-xs"
          >
            {busyKey === `security-revoke-${student.studentNumber}` ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-3 w-3" />
            )}
            Revogar
          </Button>
        </div>

        <div className="hidden sm:block">
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded: show permission grid */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/10 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Áreas com acesso</p>
          {student.permissions === "ALL" ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
              <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-medium">Acesso total — todas as {allPermissionValues.length} áreas incluídas</span>
            </div>
          ) : (
            <div className="space-y-3">
              {permissionCategories.map((category) => {
                const activeInCategory = category.permissions.filter((p) => permissionList.includes(p.value));
                if (activeInCategory.length === 0) return null;
                return (
                  <div key={category.label}>
                    <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{category.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {activeInCategory.map((perm) => (
                        <Badge key={perm.value} variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300">
                          <perm.icon className="mr-1 h-3 w-3" />
                          {perm.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* Show what they DON'T have */}
              {(() => {
                const denied = allPermissionValues.filter((v) => !permissionList.includes(v));
                if (denied.length === 0) return null;
                return (
                  <div className="border-t border-border/30 pt-2">
                    <p className="mb-1.5 text-[11px] font-medium text-muted-foreground/60">Sem acesso</p>
                    <div className="flex flex-wrap gap-1.5">
                      {denied.map((v) => {
                        const perm = permissionCategories.flatMap((c) => c.permissions).find((p) => p.value === v);
                        return (
                          <Badge key={v} variant="outline" className="border-border/40 text-xs text-muted-foreground/50">
                            {perm?.label || v}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export default function AdminSecurityTab({
  scope = "security",
  credentialSubpage,
  accessForm,
  adminAccessConflicts,
  authorizedAdminStudents,
  authorizedStudentNumber,
  busyKey,
  onAccessFormChange,
  onAuthorizeAdminStudent,
  onAuthorizedStudentNumberChange,
  onCredentialSubpageChange,
  onRevokeAdminStudent,
}: AdminSecurityTabProps) {
  const [credentialOverview, setCredentialOverview] = useState<TeamCredentialOverview | null>(null);
  const [incompleteProfiles, setIncompleteProfiles] = useState<TeamCredentialIncompleteProfiles | null>(null);
  const [teamMembershipOverview, setTeamMembershipOverview] = useState<TeamMembershipOverview | null>(null);
  const [nucleusClaimOverview, setNucleusClaimOverview] = useState<TeamMembershipClaimOverview | null>(null);
  const [membershipMatches, setMembershipMatches] = useState<TeamCredentialMembershipMatchOverview | null>(null);
  const [teamProfilePresets, setTeamProfilePresets] = useState<TeamProfilePreset[]>([]);
  const [credentialSearch, setCredentialSearch] = useState("");
  const [credentialForm, setCredentialForm] = useState<TeamCredentialInput>(defaultCredentialForm);
  const [teamMembershipForm, setTeamMembershipForm] = useState<TeamMembershipInput>(defaultTeamMembershipForm);
  const [editingTeamMembershipId, setEditingTeamMembershipId] = useState<number | null>(null);
  const [credentialBusyKey, setCredentialBusyKey] = useState<string | null>(null);
  const [lastCreatedCredential, setLastCreatedCredential] = useState<TeamCredentialMember | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<TeamMembershipSearchResult[] | null>(null);
  const [memberSearchBusy, setMemberSearchBusy] = useState(false);
  const [bulkInvitation, setBulkInvitation] = useState<BulkInvitationResponse | null>(null);
  const [bulkExpositorInvitation, setBulkExpositorInvitation] = useState<{ token: string; url: string; totalExpositors: number; claimed: number; pending: number } | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [passPrintMode, setPassPrintMode] = useState<TeamCredentialPassPrintMode>("color");
  const [passDuplexMode, setPassDuplexMode] = useState<TeamCredentialPassDuplexMode>("short-edge");
  const [passLaminationMarginMm, setPassLaminationMarginMm] = useState(3);
  const [passTemplates, setPassTemplates] = useState<CredentialPrintTemplate[]>([]);
  const [selectedPassTemplateCategory, setSelectedPassTemplateCategory] = useState("NUCLEO");
  const [passTemplateForm, setPassTemplateForm] = useState<CredentialPrintTemplateInput>(defaultPrintTemplateForm);
  const [printBatches, setPrintBatches] = useState<CredentialPrintBatch[]>([]);
  const [selectedPrintBatch, setSelectedPrintBatch] = useState<CredentialPrintBatch | null>(null);
  const [printBatchMode, setPrintBatchMode] = useState<PrintBatchMode>("NOMINAL");
  const [printBatchTitle, setPrintBatchTitle] = useState("Lote de passes");
  const [printBatchNominalText, setPrintBatchNominalText] = useState("Maria Silva | CONVIDADO | Convidados | Convidada | UOR Connect | @maria | linkedin.com/in/maria | maria.ao");
  const [printBatchGenericForm, setPrintBatchGenericForm] = useState<CredentialPrintBatchGenericInput>(defaultPrintBatchGenericForm);
  const [bulkIssueGenericForms, setBulkIssueGenericForms] = useState<
    Record<BulkIssueGenericKey, CredentialPrintBatchGenericInput>
  >(defaultBulkIssueGenericForms);
  const [bulkIssueVipForm, setBulkIssueVipForm] =
    useState<BulkIssueVipForm>(defaultBulkIssueVipForm);
  const [internalCredentialSubpage, setInternalCredentialSubpage] =
    useState<CredentialAdminSubpage>("overview");

  const selectedPermissions = accessForm.role === "SUPER_ADMIN"
    ? allPermissionValues
    : accessForm.permissions;

  const loadTeamCredentials = async () => {
    setCredentialBusyKey((current) => current ?? "credentials-load");
    try {
      const [overview, incomplete, memberships, claims, matches, templates, presets, batches] = await Promise.all([
        api.teamCredentials.overview(),
        api.teamCredentials.incompleteProfiles(),
        api.teamCredentials.teamMemberships(),
        api.teamCredentials.nucleusClaims(),
        api.teamCredentials.membershipMatches(),
        api.teamCredentials.passTemplates(),
        api.teamCredentials.profilePresets(),
        api.teamCredentials.printBatches(),
      ]);
      setCredentialOverview(overview);
      setIncompleteProfiles(incomplete);
      setTeamMembershipOverview(memberships);
      setNucleusClaimOverview(claims);
      setMembershipMatches(matches);
      setTeamProfilePresets(presets.presets);
      setPassTemplates(templates.templates);
      setPrintBatches(batches.batches);
      setSelectedPrintBatch((current) => current ? batches.batches.find((batch) => batch.id === current.id) ?? current : batches.batches[0] ?? null);
      const activeTemplate = templates.templates.find((item) => item.category === selectedPassTemplateCategory) ?? templates.templates[0];
      if (activeTemplate) {
        setSelectedPassTemplateCategory(activeTemplate.category);
        setPassTemplateForm({
          primaryColor: activeTemplate.primaryColor,
          accentColor: activeTemplate.accentColor,
          lightColor: activeTemplate.lightColor,
          footerLabel: activeTemplate.footerLabel,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar equipa e credenciais.");
    } finally {
      setCredentialBusyKey((current) => current === "credentials-load" ? null : current);
    }
  };

  useEffect(() => {
    let active = true;
    setCredentialBusyKey("credentials-load");
    Promise.all([
      api.teamCredentials.overview(),
      api.teamCredentials.incompleteProfiles(),
      api.teamCredentials.teamMemberships(),
      api.teamCredentials.nucleusClaims(),
      api.teamCredentials.membershipMatches(),
      api.teamCredentials.passTemplates(),
      api.teamCredentials.profilePresets(),
      api.teamCredentials.printBatches(),
    ])
      .then(([overview, incomplete, memberships, claims, matches, templates, presets, batches]) => {
        if (active) {
          setCredentialOverview(overview);
          setIncompleteProfiles(incomplete);
          setTeamMembershipOverview(memberships);
          setNucleusClaimOverview(claims);
          setMembershipMatches(matches);
          setTeamProfilePresets(presets.presets);
          setPassTemplates(templates.templates);
          setPrintBatches(batches.batches);
          setSelectedPrintBatch(batches.batches[0] ?? null);
          const activeTemplate = templates.templates.find((item) => item.category === selectedPassTemplateCategory) ?? templates.templates[0];
          if (activeTemplate) {
            setSelectedPassTemplateCategory(activeTemplate.category);
            setPassTemplateForm({
              primaryColor: activeTemplate.primaryColor,
              accentColor: activeTemplate.accentColor,
              lightColor: activeTemplate.lightColor,
              footerLabel: activeTemplate.footerLabel,
            });
          }
        }
      })
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : "Falha ao carregar equipa e credenciais.");
      })
      .finally(() => {
        if (active) setCredentialBusyKey(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const updatePermission = (permission: string, checked: boolean) => {
    onAccessFormChange((current) => {
      const set = new Set(current.permissions);
      if (checked) set.add(permission); else set.delete(permission);
      return { ...current, permissions: Array.from(set) };
    });
  };

  const toggleCategory = (category: PermissionCategory) => {
    const values = category.permissions.map((p) => p.value);
    const allSelected = values.every((v) => selectedPermissions.includes(v));
    onAccessFormChange((current) => {
      const set = new Set(current.permissions);
      for (const v of values) {
        if (allSelected) set.delete(v); else set.add(v);
      }
      return { ...current, permissions: Array.from(set) };
    });
  };

  const updateCredentialPermission = (permission: string, checked: boolean) => {
    setCredentialForm((current) => {
      const set = new Set(current.permissions ?? []);
      if (checked) set.add(permission); else set.delete(permission);
      return { ...current, permissions: Array.from(set) };
    });
  };

  const applyCredentialProfilePreset = (preset: TeamProfilePreset) => {
    setCredentialForm((current) => ({
      ...current,
      category: preset.category,
      team: preset.team,
      role: preset.role,
      accessLevel: preset.accessLevel,
      permissions: preset.permissions,
    }));
  };

  const applyTeamMembershipPreset = (preset: TeamProfilePreset) => {
    setTeamMembershipForm((current) => ({
      ...current,
      category: preset.category,
      team: preset.team,
      role: preset.role,
      accessLevel: preset.accessLevel,
      permissions: preset.permissions,
    }));
  };

  const applyAccessProfilePreset = (preset: TeamProfilePreset) => {
    onAccessFormChange((current) => ({
      ...current,
      team: preset.team,
      role: preset.key === "PRESIDENCIA_GOVERNANCA" ? "TEAM_LEAD" : current.role === "SUPER_ADMIN" ? "TEAM_LEAD" : current.role,
      permissions: preset.permissions,
    }));
  };

  const resetTeamMembershipForm = () => {
    setEditingTeamMembershipId(null);
    setTeamMembershipForm(defaultTeamMembershipForm);
  };

  const updateTeamMembershipPermission = (permission: string, checked: boolean) => {
    setTeamMembershipForm((current) => {
      const set = new Set(current.permissions ?? []);
      if (checked) set.add(permission); else set.delete(permission);
      return { ...current, permissions: Array.from(set) };
    });
  };

  const handleEditTeamMembership = (membership: TeamMembership) => {
    setEditingTeamMembershipId(membership.id);
    setTeamMembershipForm({
      studentNumber: membership.studentNumber ?? "",
      fullName: membership.fullName,
      category: membership.category,
      team: membership.team,
      role: membership.role,
      accessLevel: membership.accessLevel,
      permissions: membership.permissions,
      status: membership.status as TeamMembershipInput["status"],
      mandateLabel: membership.mandateLabel,
      startsAt: membership.startsAt,
      endsAt: membership.endsAt,
      source: membership.source || "MANUAL",
      notes: membership.notes,
    });
  };

  const handleSaveTeamMembership = async () => {
    const fullName = teamMembershipForm.fullName.trim();
    if (!fullName) {
      toast.info("Indica o nome completo do membro.");
      return;
    }
    const studentNumber = normalizeStudentNumberInput(teamMembershipForm.studentNumber ?? "");
    const category = teamMembershipForm.category ?? "NUCLEO";
    if (category === "NUCLEO" && !studentNumber) {
      toast.info("Indica o número de estudante. Ele é a chave de segurança para acesso administrativo do Núcleo.");
      return;
    }

    const payload: TeamMembershipInput = {
      ...teamMembershipForm,
      studentNumber,
      fullName,
      category,
      team: teamMembershipForm.team?.trim() || NUCLEUS_ORGANIZATION_LABEL,
      role: teamMembershipForm.role?.trim() || "Membro",
      accessLevel: teamMembershipForm.accessLevel?.trim() || "Membro",
      permissions: teamMembershipForm.permissions ?? [],
      status: teamMembershipForm.status ?? "ACTIVE",
      source: teamMembershipForm.source?.trim() || "MANUAL",
      notes: teamMembershipForm.notes?.trim() || null,
    };

    setCredentialBusyKey(editingTeamMembershipId ? `membership-save-${editingTeamMembershipId}` : "membership-create");
    try {
      const saved = editingTeamMembershipId
        ? await api.teamCredentials.updateTeamMembership(editingTeamMembershipId, payload)
        : await api.teamCredentials.createTeamMembership(payload);
      toast.success(editingTeamMembershipId ? `Membro atualizado: ${saved.fullName}.` : `Membro criado: ${saved.fullName}.`);
      resetTeamMembershipForm();
      await loadTeamCredentials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao guardar membro do Núcleo.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleRemoveTeamMembership = async (membership: TeamMembership) => {
    const confirmed = window.confirm(`Remover ${membership.fullName} do cadastro digital? O histórico será preservado e credenciais ativas serão desativadas.`);
    if (!confirmed) return;
    setCredentialBusyKey(`membership-remove-${membership.id}`);
    try {
      await api.teamCredentials.deleteTeamMembership(membership.id);
      toast.success(`${membership.fullName} removido do cadastro digital.`);
      if (editingTeamMembershipId === membership.id) resetTeamMembershipForm();
      await loadTeamCredentials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover membro do Núcleo.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleApproveNucleusClaim = async (claim: TeamMembershipClaim) => {
    setCredentialBusyKey(`claim-approve-${claim.id}`);
    try {
      await api.teamCredentials.approveNucleusClaim(claim.id, {
        note: "Aprovado pela administração do Núcleo.",
      });
      toast.success(`Tomada de posse aprovada para ${claim.officialName ?? claim.studentNumber}.`);
      await loadTeamCredentials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao aprovar solicitação.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleRejectNucleusClaim = async (claim: TeamMembershipClaim) => {
    const reason = window.prompt(`Motivo da recusa para ${claim.officialName ?? claim.studentNumber}:`, "Dados não confirmados pelo Núcleo.");
    if (!reason?.trim()) return;

    setCredentialBusyKey(`claim-reject-${claim.id}`);
    try {
      await api.teamCredentials.rejectNucleusClaim(claim.id, reason.trim());
      toast.success("Solicitação recusada.");
      await loadTeamCredentials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao recusar solicitação.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleCreateCredential = async () => {
    if (!credentialForm.team?.trim() || !credentialForm.role?.trim()) {
      toast.info("Indica equipa e função para criar a credencial.");
      return;
    }

    setCredentialBusyKey("credentials-create");
    try {
      const created = await api.teamCredentials.create({
        ...credentialForm,
        team: credentialForm.team.trim(),
        role: credentialForm.role.trim(),
        accessLevel: credentialForm.accessLevel?.trim() || "Membro",
        name: credentialForm.name?.trim() || null,
      });
      toast.success(created.name ? `Credencial criada para ${created.name}.` : "Link de credencial criado.");
      setLastCreatedCredential(created);
      void handleCopyCredentialLink(credentialInviteUrl(created));
      setCredentialForm(defaultCredentialForm);
      await loadTeamCredentials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar credencial.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleImportNucleus = async () => {
    setCredentialBusyKey("credentials-import");
    try {
      const result = await api.teamCredentials.importNucleus();
      const [incomplete, claims, matches] = await Promise.all([
        api.teamCredentials.incompleteProfiles(),
        api.teamCredentials.nucleusClaims(),
        api.teamCredentials.membershipMatches(),
      ]);
      setCredentialOverview(result.overview);
      setTeamMembershipOverview(result.membershipOverview);
      setIncompleteProfiles(incomplete);
      setNucleusClaimOverview(claims);
      setMembershipMatches(matches);
      toast.success(`Núcleo importado: ${result.created} credencial(is), ${result.membershipsCreated} membro(s) oficial(is).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao sincronizar Núcleo.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleBulkInvitation = async () => {
    setCredentialBusyKey("credentials-bulk");
    try {
	      const result = await api.teamCredentials.bulkInvitation();
	      setBulkInvitation(result);
	      await navigator.clipboard.writeText(result.url);
	      toast.success(`Link coletivo copiado! ${result.claimed} aprovada(s), ${result.pending} pendente(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar link coletivo.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleImportExpositors = async () => {
    setCredentialBusyKey("credentials-import-expositors");
    try {
      const result = await api.teamCredentials.importExpositors();
      toast.success(
        `Expositores sincronizados: ${result.created} nova(s), ${result.updated} atualizada(s), ${result.membershipsCreated} membro(s).`,
      );
      await loadTeamCredentials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar expositores.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleBulkExpositorInvitation = async () => {
    setCredentialBusyKey("credentials-bulk-expositor");
    try {
      const result = await api.teamCredentials.bulkExpositorInvitation();
      setBulkExpositorInvitation(result);
      await navigator.clipboard.writeText(result.url);
      toast.success(`Link coletivo de expositores copiado! ${result.claimed}/${result.totalExpositors} já confirmaram.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar link coletivo de expositores.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleSyncSiteGuests = async () => {
    setCredentialBusyKey("credentials-sync-site-guests");
    try {
      const result = await api.teamCredentials.syncSiteGuests();
      toast.success(
        `Convidados do site sincronizados: ${result.created} novo(s), ${result.updated} atualizado(s).`,
      );
      await loadTeamCredentials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao sincronizar convidados do site.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleCopyCredentialLink = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Link copiado.");
    } catch {
      toast.info(value);
    }
  };

  const handleDownloadCredentialPass = async (member: TeamCredentialMember) => {
    setCredentialBusyKey(`credentials-pass-${member.id}`);
    try {
      const blob = await api.teamCredentials.downloadPass(member.publicSlug, passBatchPrintOptions());
      downloadBlobFile(blob, credentialPdfFileName(member));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar passe.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const passBatchPrintOptions = (): TeamCredentialPassOptions => ({
    printMode: passPrintMode,
    side: "both",
    layout: "a4-2up-landscape",
    duplexMode: passDuplexMode,
    laminationMarginMm: passLaminationMarginMm,
  });

  const handleDownloadPassCalibration = async () => {
    setCredentialBusyKey("credentials-pass-calibration");
    try {
      const blob = await api.teamCredentials.downloadPassCalibration(passBatchPrintOptions());
      downloadBlobFile(blob, `teste-alinhamento-passes-2porpagina-horizontal-${passLaminationMarginMm}mm.pdf`);
      toast.success("Teste de alinhamento pronto. Imprime em 100%, sem ajustar à página.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar teste de alinhamento.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleDownloadCredentialBatch = async () => {
    const ids = printableCredentialMembers.map((member) => member.id);
    if (ids.length === 0) {
      toast.info("Nao ha credenciais prontas no filtro atual.");
      return;
    }
    setCredentialBusyKey("credentials-pass-batch");
    try {
      const blob = await api.teamCredentials.downloadPassBatch({
        ids,
        ...passBatchPrintOptions(),
        limit: ids.length,
      });
      downloadBlobFile(blob, `passes-uor-connect-2porpagina-horizontal-${passPrintMode === "black-white" ? "pb" : "cor"}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar lote de passes.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleDownloadCredentialCategoryBatch = async (
    category: string,
    label: string,
    includePending = false,
  ) => {
    const shouldSyncExpositors = category === "EXPOSITOR" && includePending;
    const members = (credentialOverview?.members ?? []).filter(
      (member) =>
        member.category === category &&
        isOfficialNucleusCredentialMember(member) &&
        (includePending
          ? isCredentialPrintableInAdminBatch(member)
          : member.status === "PROFILE_READY"),
    );
    if (!shouldSyncExpositors && members.length === 0) {
      toast.info(`Ainda nao ha passes prontos para ${label}.`);
      return;
    }

    const busy = `credentials-pass-batch-${category}`;
    setCredentialBusyKey(busy);
    try {
      if (shouldSyncExpositors) {
        const result = await api.teamCredentials.importExpositors();
        if (result.created > 0 || result.updated > 0 || result.membershipsCreated > 0) {
          toast.success(
            `Expositores sincronizados: ${result.created} nova(s), ${result.updated} atualizada(s), ${result.membershipsCreated} membro(s).`,
          );
        }
      }

      const blob = await api.teamCredentials.downloadPassBatch({
        ids: shouldSyncExpositors ? undefined : members.map((member) => member.id),
        category: shouldSyncExpositors ? category : undefined,
        ...passBatchPrintOptions(),
        includePending,
        limit: shouldSyncExpositors ? 1000 : members.length,
      });
      const fileBase = safePdfFileBase(`passes ${label}`) || "passes-uor-connect";
      downloadBlobFile(
        blob,
        `${fileBase}-2porpagina-horizontal-${passPrintMode === "black-white" ? "pb" : "cor"}.pdf`,
      );
      if (shouldSyncExpositors) {
        await loadTeamCredentials();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Falha ao baixar passes de ${label}.`,
      );
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const updateBulkIssueGenericForm = (
    key: BulkIssueGenericKey,
    patch: Partial<CredentialPrintBatchGenericInput>,
  ) => {
    setBulkIssueGenericForms((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }));
  };

  const createAndDownloadPrintBatch = async (
    payload: CredentialPrintBatchInput,
    busy: string,
    fileLabel: string,
  ) => {
    setCredentialBusyKey(busy);
    try {
      const created = await api.teamCredentials.createPrintBatch(payload);
      setSelectedPrintBatch(created);
      setPrintBatches((current) => [
        created,
        ...current.filter((batch) => batch.id !== created.id),
      ]);
      const blob = await api.teamCredentials.downloadPrintBatch(created.id, passBatchPrintOptions());
      downloadBlobFile(
        blob,
        `${safePdfFileBase(fileLabel) || "lote-passes"}-${created.code}-2porpagina-horizontal.pdf`,
      );
      toast.success(`Lote criado e baixado com ${created.totalItems} passe(s).`);
      await loadTeamCredentials();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao criar ou baixar lote de impressão.",
      );
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleCreateAndDownloadGenericBatch = async (key: BulkIssueGenericKey) => {
    const preset = bulkIssueGenericPresets.find((item) => item.key === key);
    const form = bulkIssueGenericForms[key];
    const quantity = Math.max(1, Math.min(Number(form.quantity) || 1, 80));
    await createAndDownloadPrintBatch(
      {
        title: `Lote ${preset?.label ?? key}`,
        genericItems: [
          {
            ...form,
            category: form.category ?? key,
            quantity,
            startNumber: Math.max(1, Number(form.startNumber) || 1),
            team: form.team?.trim() || preset?.label || key,
            role: form.role?.trim() || preset?.label || key,
            accessLevel: form.accessLevel?.trim() || preset?.label || key,
            prefix: form.prefix?.trim() || preset?.label || key,
          },
        ],
      },
      `bulk-issue-generic-${key}`,
      `Lote ${preset?.label ?? key}`,
    );
  };

  const handleCreateAndDownloadVipBatch = async () => {
    const name = bulkIssueVipForm.name.trim();
    if (name.length < 2) {
      toast.info("Indica o nome do passe VIP antes de criar o lote.");
      return;
    }

    await createAndDownloadPrintBatch(
      {
        title: `Passe VIP - ${name}`,
        nominalItems: [
          {
            name,
            category: "CONVIDADO",
            team: bulkIssueVipForm.team.trim() || "Coordenação do Curso",
            role: bulkIssueVipForm.role.trim() || "Coordenação",
            accessLevel: bulkIssueVipForm.accessLevel.trim() || "VIP",
            permissions: ["EVENTO"],
            organization: bulkIssueVipForm.organization.trim() || null,
            instagramUrl: bulkIssueVipForm.instagramUrl.trim() || null,
            linkedinUrl: bulkIssueVipForm.linkedinUrl.trim() || null,
            websiteUrl: bulkIssueVipForm.websiteUrl.trim() || null,
          },
        ],
      },
      "bulk-issue-vip",
      `Passe VIP ${name}`,
    );
  };

  const handlePreviewPrintBatch = () => {
    const nominalItems = parsePrintBatchNominalText(printBatchNominalText);
    const genericItems = buildGenericPreviewItems(printBatchGenericForm);
    const count = printBatchMode === "NOMINAL" ? nominalItems.length : genericItems.length;
    if (count === 0) {
      toast.info("Adiciona dados ao lote antes da pré-visualização.");
      return;
    }
    toast.success(`Pré-visualizar lote: ${count} passe(s) pronto(s) para criação.`);
  };

  const handleCreatePrintBatch = async () => {
    const nominalItems = parsePrintBatchNominalText(printBatchNominalText);
    const genericQuantity = Math.max(1, Math.min(Number(printBatchGenericForm.quantity) || 1, 80));
    const payload: CredentialPrintBatchInput = {
      title: printBatchTitle.trim() || "Lote de passes",
      nominalItems: printBatchMode === "NOMINAL" ? nominalItems : [],
      genericItems: printBatchMode === "GENERIC"
        ? [{
          ...printBatchGenericForm,
          quantity: genericQuantity,
          startNumber: Math.max(1, Number(printBatchGenericForm.startNumber) || 1),
          team: printBatchGenericForm.team?.trim() || "Staff",
          role: printBatchGenericForm.role?.trim() || "Apoio Geral",
          accessLevel: printBatchGenericForm.accessLevel?.trim() || "Staff",
          prefix: printBatchGenericForm.prefix?.trim() || "Staff",
        }]
        : [],
    };
    const total = (payload.nominalItems?.length ?? 0) + (payload.genericItems?.reduce((sum, item) => sum + item.quantity, 0) ?? 0);
    if (total === 0) {
      toast.info("Cria pelo menos um passe no lote.");
      return;
    }

    setCredentialBusyKey("print-batch-create");
    try {
      const created = await api.teamCredentials.createPrintBatch(payload);
      setSelectedPrintBatch(created);
      setPrintBatches((current) => [created, ...current.filter((batch) => batch.id !== created.id)]);
      toast.success(`Lote criado com ${created.totalItems} passe(s).`);
      await loadTeamCredentials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar lote de impressão.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleDownloadPrintBatch = async (batch = selectedPrintBatch) => {
    if (!batch) {
      toast.info("Seleciona ou cria um lote de impressão.");
      return;
    }
    setCredentialBusyKey(`print-batch-download-${batch.id}`);
    try {
      const blob = await api.teamCredentials.downloadPrintBatch(batch.id, passBatchPrintOptions());
      downloadBlobFile(blob, `lote-passes-${batch.code}-2porpagina-horizontal-${passPrintMode === "black-white" ? "pb" : "cor"}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao baixar lote de impressão.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleSelectPassTemplateCategory = (category: string) => {
    setSelectedPassTemplateCategory(category);
    const template = passTemplates.find((item) => item.category === category);
    if (!template) return;
    setPassTemplateForm({
      primaryColor: template.primaryColor,
      accentColor: template.accentColor,
      lightColor: template.lightColor,
      footerLabel: template.footerLabel,
    });
  };

  const handleSavePassTemplate = async () => {
    setCredentialBusyKey("pass-template-save");
    try {
      const saved = await api.teamCredentials.updatePassTemplate(selectedPassTemplateCategory, passTemplateForm);
      setPassTemplates((current) => current.map((item) => item.category === saved.category ? saved : item));
      setPassTemplateForm({
        primaryColor: saved.primaryColor,
        accentColor: saved.accentColor,
        lightColor: saved.lightColor,
        footerLabel: saved.footerLabel,
      });
      toast.success("Template de passe atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao guardar template de passe.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleRevokeCredential = async (member: TeamCredentialMember) => {
    const reason = window.prompt("Motivo da revogação", "Revogada pela administração.");
    if (reason === null) return;
    setCredentialBusyKey(`credentials-revoke-${member.id}`);
    try {
      await api.teamCredentials.revoke(member.id, reason);
      toast.success("Credencial revogada.");
      await loadTeamCredentials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao revogar credencial.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleReissueCredential = async (member: TeamCredentialMember) => {
    const confirmed = window.confirm(`Reemitir a credencial de ${member.name || member.publicSlug}? A versão anterior será revogada.`);
    if (!confirmed) return;
    setCredentialBusyKey(`credentials-reissue-${member.id}`);
    try {
      const result = await api.teamCredentials.reissue(member.id);
      toast.success(`Credencial reemitida na versão ${result.next.version}.`);
      await loadTeamCredentials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao reemitir credencial.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleLinkMembershipMatch = async (credentialId: number, teamMembershipId: number) => {
    setCredentialBusyKey(`membership-link-${credentialId}-${teamMembershipId}`);
    try {
      await api.teamCredentials.linkMembershipMatch(credentialId, teamMembershipId);
      toast.success("Credencial associada ao membro oficial.");
      await loadTeamCredentials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao associar credencial.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const handleMemberSearch = async (query: string) => {
    setMemberSearch(query);
    if (query.trim().length < 2) {
      setMemberSearchResults(null);
      return;
    }
    setMemberSearchBusy(true);
    try {
      const result = await api.teamCredentials.searchTeamMemberships(query.trim());
      setMemberSearchResults(result.memberships);
    } catch {
      setMemberSearchResults([]);
    } finally {
      setMemberSearchBusy(false);
    }
  };

  const handleCreateCredentialForMember = async (membership: TeamMembership | TeamMembershipSearchResult) => {
    setCredentialBusyKey(`member-create-${membership.id}`);
    try {
      const created = await api.teamCredentials.create({
        teamMembershipId: membership.id,
        category: membership.category as TeamCredentialInput["category"],
        team: membership.team,
        role: membership.role,
        accessLevel: membership.accessLevel,
        permissions: membership.permissions,
        name: membership.fullName,
      });
      toast.success(`Link de credencial criado para ${membership.fullName}.`);
      setLastCreatedCredential(created);
      void handleCopyCredentialLink(credentialInviteUrl(created));
      await loadTeamCredentials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar credencial.");
    } finally {
      setCredentialBusyKey(null);
    }
  };

  const buildWhatsAppInviteUrl = (name: string, inviteUrl: string, phone?: string | null) => {
    const message = `Olá ${name.split(" ")[0]}, o teu link de credencial UOR Connect está pronto. Completa o cadastro e obtém o teu passe: ${inviteUrl}`;
    const encodedMessage = encodeURIComponent(message);
    const phoneDigits = phone?.replace(/\D/g, "") ?? "";
    return phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodedMessage}` : `https://wa.me/?text=${encodedMessage}`;
  };

  // Stats
  const totalAdmins = authorizedAdminStudents.length;
  const superAdmins = authorizedAdminStudents.filter((s) => s.role === "SUPER_ADMIN").length;
  const teamLeads = authorizedAdminStudents.filter((s) => s.role === "TEAM_LEAD").length;
  const members = authorizedAdminStudents.filter((s) => s.role === "MEMBER").length;

  const filteredCredentialMembers = useMemo(() => {
    let members = credentialOverview?.members ?? [];
    if (teamFilter !== "all") {
      members = members.filter((member) => member.team === teamFilter);
    }
    const q = credentialSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((member) =>
      member.team.toLowerCase().includes(q) ||
      member.role.toLowerCase().includes(q) ||
      member.categoryLabel.toLowerCase().includes(q) ||
      (member.name ?? "").toLowerCase().includes(q) ||
      (member.phone ?? "").toLowerCase().includes(q)
    );
  }, [credentialOverview?.members, credentialSearch, teamFilter]);

  const printableCredentialMembers = filteredCredentialMembers.filter((member) => member.status === "PROFILE_READY");
  const selectedPassTemplate = passTemplates.find((item) => item.category === selectedPassTemplateCategory);
  const credentialFormTheme = credentialVisualThemeFor(credentialForm, passTemplates);
  const nominalPrintBatchPreview = useMemo(
    () => parsePrintBatchNominalText(printBatchNominalText),
    [printBatchNominalText],
  );
  const genericPrintBatchPreview = useMemo(
    () => buildGenericPreviewItems(printBatchGenericForm),
    [printBatchGenericForm],
  );
  const printBatchPreviewItems = printBatchMode === "NOMINAL" ? nominalPrintBatchPreview : genericPrintBatchPreview;

  const credentialMembersByTeam = useMemo(() => {
    const grouped = new Map<string, TeamCredentialMember[]>();
    for (const member of filteredCredentialMembers) {
      const list = grouped.get(member.team) ?? [];
      list.push(member);
      grouped.set(member.team, list);
    }
    return Array.from(grouped.entries()).map(([team, members]) => ({ team, members }));
  }, [filteredCredentialMembers]);

  const incompleteProfileMembers = incompleteProfiles?.members.slice(0, 4) ?? [];
  const activeCredentialSubpage = credentialSubpage ?? internalCredentialSubpage;
  const activeCredentialSubpageMeta =
    credentialAdminSubpages.find((item) => item.id === activeCredentialSubpage) ??
    credentialAdminSubpages[0];
  const handleCredentialSubpageChange = (value: CredentialAdminSubpage) => {
    if (onCredentialSubpageChange) {
      onCredentialSubpageChange(value);
      return;
    }
    setInternalCredentialSubpage(value);
  };
  const showCredentialOverview = activeCredentialSubpage === "overview";
  const showCredentialLinks = activeCredentialSubpage === "links";
  const showCredentialMembers = activeCredentialSubpage === "members";
  const showCredentialBulkIssue = activeCredentialSubpage === "bulk-issue";
  const showCredentialPrinting = activeCredentialSubpage === "printing";
  const showCredentialTemplates = activeCredentialSubpage === "templates";
  const showCredentialPending = activeCredentialSubpage === "pending";
  const allCredentialMembers = credentialOverview?.members ?? [];
  const readyExhibitorMembers = allCredentialMembers.filter(
    (member) => member.category === "EXPOSITOR" && isCredentialPrintableInAdminBatch(member),
  );
  const allExhibitorMembers = allCredentialMembers.filter(
    (member) => member.category === "EXPOSITOR",
  );
  const readySpeakerCredentialMembers = allCredentialMembers.filter(
    (member) => member.category === "PALESTRANTE" && member.status === "PROFILE_READY",
  );
  const allSpeakerCredentialMembers = allCredentialMembers.filter(
    (member) => member.category === "PALESTRANTE",
  );
  const readyNucleusCredentialMembers = allCredentialMembers.filter(
    (member) =>
      member.category === "NUCLEO" &&
      isOfficialNucleusCredentialMember(member) &&
      member.status === "PROFILE_READY",
  );
  const allNucleusCredentialMembers = allCredentialMembers.filter(
    (member) => member.category === "NUCLEO" && isOfficialNucleusCredentialMember(member),
  );
  const allReadyNucleusMembers = (credentialOverview?.members ?? [])
    .filter(
      (member) =>
        member.category === "NUCLEO" &&
        isOfficialNucleusCredentialMember(member) &&
        member.status === "PROFILE_READY",
    )
    .slice()
    .sort((left, right) => (left.name ?? "").localeCompare(right.name ?? "", "pt"));
  const readyNucleusMembers = allReadyNucleusMembers.slice(0, 8);
  const officialTeamMemberships = teamMembershipOverview?.members.slice(0, 5) ?? [];
  const membershipMatchItems = membershipMatches?.items.slice(0, 4) ?? [];
  const nucleusMemberships = useMemo(
    () => (teamMembershipOverview?.members ?? [])
      .filter((member) => member.category === "NUCLEO" && member.source !== "NUCLEO_IMPORT")
      .sort((left, right) => left.team.localeCompare(right.team, "pt") || left.fullName.localeCompare(right.fullName, "pt")),
    [teamMembershipOverview?.members],
  );
  const nucleusSmsStudentNumbers = useMemo(
    () => Array.from(new Set(nucleusMemberships
      .filter((member) => member.status === "ACTIVE")
      .map((member) => member.studentNumber?.trim())
      .filter(Boolean) as string[])),
    [nucleusMemberships],
  );
  const nucleusSmsAudience = useMemo(() => ({
    type: "SELECTED_STUDENTS" as const,
    selectedStudentNumbers: nucleusSmsStudentNumbers,
  }), [nucleusSmsStudentNumbers]);
  const nucleusMembersByTeam = useMemo(() => {
    const grouped = new Map<string, typeof nucleusMemberships>();
    for (const member of nucleusMemberships) {
      grouped.set(member.team, [...(grouped.get(member.team) ?? []), member]);
    }
    return Array.from(grouped.entries()).map(([team, members]) => ({
      team,
      members,
      linked: members.filter((member) => Boolean(member.studentNumber)).length,
    }));
  }, [nucleusMemberships]);
  const nucleusCredentials = useMemo(
    () => (credentialOverview?.members ?? []).filter((member) => member.category === "NUCLEO"),
    [credentialOverview?.members],
  );
  const nucleusReadyCount = nucleusCredentials.filter((member) => member.status === "PROFILE_READY").length;
  const pendingNucleusClaims = useMemo(
    () => (nucleusClaimOverview?.claims ?? []).filter((claim) => claim.status === "PENDING_REVIEW"),
    [nucleusClaimOverview?.claims],
  );
  const selectedNucleusAreaPreset = useMemo(
    () => teamProfilePresets.find((preset) => preset.team === teamMembershipForm.team) ?? null,
    [teamMembershipForm.team, teamProfilePresets],
  );
  const selectedNucleusAreaFunctions = useMemo(
    () => selectedNucleusAreaPreset?.functions ?? [],
    [selectedNucleusAreaPreset],
  );
  const selectedTeamMembershipFunction = useMemo(
    () => selectedNucleusAreaFunctions.find((item) => item.label === teamMembershipForm.role) ?? null,
    [selectedNucleusAreaFunctions, teamMembershipForm.role],
  );
  const selectedCredentialAreaPreset = useMemo(
    () => teamProfilePresets.find((preset) => preset.team === credentialForm.team) ?? null,
    [credentialForm.team, teamProfilePresets],
  );
  const selectedCredentialAreaFunctions = useMemo(
    () => selectedCredentialAreaPreset?.functions ?? [],
    [selectedCredentialAreaPreset],
  );
  const selectedCredentialFunction = useMemo(
    () => selectedCredentialAreaFunctions.find((item) => item.label === credentialForm.role) ?? null,
    [credentialForm.role, selectedCredentialAreaFunctions],
  );

  if (scope === "nucleus") {
    return (
      <div className="space-y-6">
        <section className="uor-vital-panel uor-animated-entry">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm">
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  Gestão do Núcleo
                </Badge>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Tomada de posse, áreas e cargos</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                  O cadastro do Núcleo nasce das solicitações feitas no link coletivo. A administração aprova, recusa e controla permissões por área.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="uor-action-button border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50" onClick={resetTeamMembershipForm}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Novo membro
                </Button>
                <Button className="uor-action-button bg-slate-900 text-white hover:bg-slate-800" disabled={credentialBusyKey === "credentials-bulk"} onClick={() => void handleBulkInvitation()}>
                  {credentialBusyKey === "credentials-bulk" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                  Link coletivo
                </Button>
                <Button variant="outline" className="uor-action-button border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100" disabled={credentialBusyKey === "credentials-load"} onClick={() => void loadTeamCredentials()}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${credentialBusyKey === "credentials-load" ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="uor-vital-stat bg-gradient-to-br from-emerald-50 to-white">
            <span className="uor-icon-tile border-emerald-200 bg-emerald-50 text-emerald-700">
              <Users className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-900">{nucleusMemberships.length}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Membros aprovados</p>
          </div>
          <div className="uor-vital-stat bg-gradient-to-br from-cyan-50 to-white">
            <span className="uor-icon-tile border-cyan-200 bg-cyan-50 text-cyan-700">
              <Layers className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-900">{nucleusMembersByTeam.length}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Áreas do Núcleo</p>
          </div>
          <div className="uor-vital-stat bg-gradient-to-br from-violet-50 to-white">
            <span className="uor-icon-tile border-violet-200 bg-violet-50 text-violet-700">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-violet-800">{nucleusReadyCount}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Perfis confirmados</p>
          </div>
          <div className="uor-vital-stat bg-gradient-to-br from-amber-50 to-white">
            <span className="uor-icon-tile border-amber-200 bg-amber-50 text-amber-700">
              <Fingerprint className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-amber-800">{pendingNucleusClaims.length}</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Solicitações pendentes</p>
          </div>
        </div>

        <Card className="uor-vital-card overflow-hidden border-emerald-200">
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-cyan-500 to-violet-500" />
          <CardHeader className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-cyan-50">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                  <MessageSquare className="h-4 w-4 text-emerald-700" />
                  Comunicação rápida do Núcleo
                </CardTitle>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Envia SMS/WhatsApp para membros ativos com número de estudante associado. Útil para aprovações, reuniões e atualizações operacionais.
                </p>
              </div>
              <Badge variant="outline" className="w-fit border-emerald-200 bg-white text-emerald-800">
                {nucleusSmsStudentNumbers.length} destinatário(s)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 md:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Aprovação / posse</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Aviso curto para membros aprovados ou recém-associados.</p>
              <div className="mt-3">
                <AdminBulkSmsAction
                  audience={nucleusSmsAudience}
                  buttonLabel="Enviar aprovação"
                  defaultMessage="Olá {{nome}}, a tua tomada de posse no Núcleo de Engenharia e Informática foi aprovada. Acede à tua área no UOR Connect para acompanhar as próximas orientações."
                  description="Envia uma mensagem de aprovação aos membros ativos do Núcleo."
                  disabled={nucleusSmsStudentNumbers.length === 0}
                  title="SMS de aprovação do Núcleo"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-white p-3 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Reunião</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Convocatória editável para encontros de direção, área ou equipa.</p>
              <div className="mt-3">
                <AdminBulkSmsAction
                  audience={nucleusSmsAudience}
                  buttonLabel="Convocar reunião"
                  defaultMessage="Olá {{nome}}, tens uma reunião do Núcleo de Engenharia e Informática. Confirma a tua disponibilidade e acompanha os detalhes partilhados pela coordenação."
                  description="Envia uma convocatória aos membros ativos do Núcleo."
                  disabled={nucleusSmsStudentNumbers.length === 0}
                  title="Convocatória de reunião do Núcleo"
                />
              </div>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-white p-3 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Atualização</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Comunicado operacional para mudanças, tarefas e avisos rápidos.</p>
              <div className="mt-3">
                <AdminBulkSmsAction
                  audience={nucleusSmsAudience}
                  buttonLabel="Enviar atualização"
                  defaultMessage="Olá {{nome}}, há uma atualização importante do Núcleo no UOR Connect. Verifica a tua área e mantém a tua equipa informada."
                  description="Envia uma atualização operacional aos membros ativos do Núcleo."
                  disabled={nucleusSmsStudentNumbers.length === 0}
                  title="Atualização operacional do Núcleo"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="uor-vital-card border-slate-200">
          <CardHeader className="border-b border-amber-100 bg-gradient-to-r from-amber-50 to-white">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <Fingerprint className="h-4 w-4 text-amber-700" />
              Solicitações de tomada de posse
            </CardTitle>
            <p className="text-xs text-slate-500">
              Pedidos enviados por membros autenticados com dados da Secretaria. Aprovar cria o membro oficial e libera o passe.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {pendingNucleusClaims.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">Nenhuma solicitação pendente neste momento.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingNucleusClaims.map((claim) => (
                  <div key={claim.id} className="grid gap-4 p-4 transition-colors hover:bg-amber-50/40 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{claim.officialName ?? "Nome não informado"}</p>
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                          {claim.statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {claim.studentNumber} · {claim.officialCourse ?? "Curso não informado"} · Secretaria: {claim.officialPhone ?? "Telefone pendente"}
                        {claim.phone ? ` · adicional: ${claim.phone}` : ""}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {claim.requestedTeam} · {claim.requestedRole} · {claim.requestedAccessLevel}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="uor-action-button border-rose-200 text-rose-700 hover:bg-rose-50"
                        disabled={credentialBusyKey === `claim-reject-${claim.id}`}
                        onClick={() => void handleRejectNucleusClaim(claim)}
                      >
                        {credentialBusyKey === `claim-reject-${claim.id}` ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Unlock className="mr-1.5 h-3.5 w-3.5" />}
                        Recusar
                      </Button>
                      <Button
                        size="sm"
                        className="uor-action-button bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={credentialBusyKey === `claim-approve-${claim.id}`}
                        onClick={() => void handleApproveNucleusClaim(claim)}
                      >
                        {credentialBusyKey === `claim-approve-${claim.id}` ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />}
                        Aprovar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="uor-vital-card border-slate-200">
          <CardHeader className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <UserPlus className="h-4 w-4 text-emerald-700" />
	              Cadastro digital do Núcleo
	            </CardTitle>
	            <p className="text-xs text-slate-500">Registos manuais ficam como exceção administrativa; o fluxo normal é aprovar solicitações vindas do link coletivo.</p>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              {teamProfilePresets.map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="uor-chip-button border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                  onClick={() => applyTeamMembershipPreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="xl:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Nome completo</label>
                <Input
                  className="mt-1 h-11 rounded-xl border-slate-200 focus-visible:ring-emerald-500"
                  value={teamMembershipForm.fullName}
                  onChange={(event) => setTeamMembershipForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Nome do membro"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Número de estudante obrigatório</label>
                <Input
                  className="mt-1 h-11 rounded-xl border-slate-200 font-mono focus-visible:ring-emerald-500"
                  value={teamMembershipForm.studentNumber ?? ""}
                  onChange={(event) => setTeamMembershipForm((current) => ({ ...current, studentNumber: normalizeStudentNumberInput(event.target.value) }))}
                  placeholder="Ex.: 2024001234"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Estado</label>
                <select
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  value={teamMembershipForm.status ?? "ACTIVE"}
                  onChange={(event) => setTeamMembershipForm((current) => ({ ...current, status: event.target.value as TeamMembershipInput["status"] }))}
                >
                  {teamMembershipStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Organização</label>
                <Input
                  className="mt-1 h-11 rounded-xl border-emerald-200 bg-emerald-50/70 text-emerald-900"
                  value={NUCLEUS_ORGANIZATION_LABEL}
                  readOnly
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Categoria/área funcional</label>
                <select
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  value={selectedNucleusAreaPreset?.key ?? ""}
                  onChange={(event) => {
                    const preset = teamProfilePresets.find((item) => item.key === event.target.value);
                    if (preset) applyTeamMembershipPreset(preset);
                  }}
                >
                  <option value="">Seleciona a área</option>
                  {teamProfilePresets.map((preset) => (
                    <option key={preset.key} value={preset.key}>{preset.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Usa as mesmas categorias do link de tomada de posse e aplica permissões sugeridas automaticamente.
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Função/cargo</label>
                <select
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  value={selectedTeamMembershipFunction?.key ?? ""}
                  onChange={(event) => {
                    const fn = selectedNucleusAreaFunctions.find((item) => item.key === event.target.value);
                    if (!fn) return;
                    setTeamMembershipForm((current) => ({
                      ...current,
                      role: fn.label,
                      accessLevel: fn.accessLevel,
                      permissions: fn.permissions,
                    }));
                  }}
                  disabled={!selectedNucleusAreaPreset}
                >
                  <option value="">{selectedNucleusAreaPreset ? "Seleciona a função" : "Escolhe primeiro a categoria"}</option>
                  {selectedNucleusAreaFunctions.map((fn) => (
                    <option key={fn.key} value={fn.key}>{fn.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Nível de acesso</label>
                <Input
                  className="mt-1 h-11 rounded-xl border-slate-200 focus-visible:ring-emerald-500"
                  value={teamMembershipForm.accessLevel ?? ""}
                  onChange={(event) => setTeamMembershipForm((current) => ({ ...current, accessLevel: event.target.value }))}
                  placeholder="Operação, direção..."
                />
              </div>
              <div className="md:col-span-2 xl:col-span-4">
                <label className="text-xs font-semibold text-slate-600">Notas internas</label>
                <Input
                  className="mt-1 h-11 rounded-xl border-slate-200 focus-visible:ring-emerald-500"
                  value={teamMembershipForm.notes ?? ""}
                  onChange={(event) => setTeamMembershipForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Observação opcional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Permissões administrativas da área</p>
              <div className="flex flex-wrap gap-1.5">
                {allPermissionValues.map((permission) => {
                  const active = (teamMembershipForm.permissions ?? []).includes(permission);
                  return (
                    <button
                      key={permission}
                      type="button"
                      onClick={() => updateTeamMembershipPermission(permission, !active)}
                      className={`uor-chip-button px-2.5 py-1 text-[11px] ${
                        active
                          ? "border-emerald-500/30 bg-emerald-600 text-white"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {adminPermissionLabel(permission)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                {editingTeamMembershipId ? "A editar membro oficial existente." : "Novo membro entra como registo digital oficial."}
              </p>
              <div className="flex flex-wrap gap-2">
                {editingTeamMembershipId && (
                  <Button type="button" variant="outline" className="uor-action-button border-slate-200 bg-white" onClick={resetTeamMembershipForm}>
                    Cancelar edição
                  </Button>
                )}
                <Button
                  type="button"
                  className="uor-action-button bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={credentialBusyKey === "membership-create" || credentialBusyKey === `membership-save-${editingTeamMembershipId}`}
                  onClick={() => void handleSaveTeamMembership()}
                >
                  {credentialBusyKey === "membership-create" || credentialBusyKey === `membership-save-${editingTeamMembershipId}`
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <BadgeCheck className="mr-2 h-4 w-4" />}
                  {editingTeamMembershipId ? "Guardar alterações" : "Adicionar membro"}
                </Button>
              </div>
            </div>
          </CardContent>
	        </Card>

	        {bulkInvitation && (
          <div className="uor-vital-card rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-4 text-cyan-950">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <p className="text-sm font-bold">Link coletivo do Núcleo</p>
                <p className="mt-1 break-all font-mono text-xs text-cyan-800">{bulkInvitation.url}</p>
                <p className="mt-2 text-xs text-cyan-700">
                  {bulkInvitation.claimed} aprovada(s)
                  {bulkInvitation.pending > 0 && ` · ${bulkInvitation.pending} solicitação(ões) pendente(s)`}
                </p>
              </div>
              <Button variant="outline" className="uor-action-button border-cyan-200 bg-white text-cyan-900 hover:bg-cyan-100" onClick={() => void handleCopyCredentialLink(bulkInvitation.url)}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="uor-vital-card border-slate-200">
            <CardHeader className="border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-white">
              <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                <Users className="h-4 w-4 text-emerald-700" />
                Membros por área
              </CardTitle>
	          <p className="text-xs text-slate-500">Lista digital formada por tomadas de posse aprovadas e ajustes manuais auditados.</p>
            </CardHeader>
            <CardContent className="p-4">
              <div className="max-h-[680px] space-y-3 overflow-y-auto pr-1">
                {credentialBusyKey === "credentials-load" && !teamMembershipOverview ? (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-sm text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A carregar membros do Núcleo
                  </div>
                ) : nucleusMembersByTeam.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
	                    Nenhum membro aprovado ainda. Partilha o link coletivo e aprova as solicitações para formar a lista.
                  </div>
                ) : (
                  nucleusMembersByTeam.map((group) => {
                    const groupTheme = credentialVisualThemeFor({ category: "NUCLEO", team: group.team }, passTemplates);
                    return (
                    <div key={group.team} className="uor-vital-card overflow-hidden rounded-xl border bg-white" style={{ borderColor: `${groupTheme.accentColor}44` }}>
                      <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={credentialPanelStyle(groupTheme)}>
                        <div>
                          <p className="text-sm font-bold" style={{ color: groupTheme.primaryColor }}>{group.team}</p>
                          <p className="text-[11px] text-slate-500">{group.linked}/{group.members.length} com conta associada</p>
                        </div>
                        <Badge variant="outline" style={credentialChipStyle(groupTheme)}>{group.members.length}</Badge>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {group.members.map((member) => {
                          const theme = credentialVisualThemeFor(member, passTemplates);
                          return (
                          <div key={member.id} className="grid gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70 sm:grid-cols-[1fr_auto] sm:items-center">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold text-slate-900">{member.fullName}</p>
                                <Badge variant="outline" style={credentialChipStyle(theme)}>
                                  {theme.footerLabel}
                                </Badge>
                                <Badge variant="outline" className={member.studentNumber ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                                  {member.studentNumber ? "Associado" : "Manual"}
                                </Badge>
                                <Badge variant="outline" className={member.status === "ACTIVE" ? "border-slate-200 bg-slate-50 text-slate-700" : "border-rose-200 bg-rose-50 text-rose-700"}>
                                  {member.statusLabel}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {member.role} · {member.accessLevel}{member.studentNumber ? ` · ${member.studentNumber}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2 sm:justify-end">
                              <Button size="sm" variant="outline" className="uor-action-button min-h-10" style={credentialActionStyle(theme)} onClick={() => handleEditTeamMembership(member)}>
                                <UserCheck className="mr-1 h-3.5 w-3.5" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="uor-action-button min-h-10"
                                style={credentialActionStyle(theme)}
                                disabled={credentialBusyKey === `member-create-${member.id}` || member.status !== "ACTIVE"}
                                onClick={() => void handleCreateCredentialForMember(member)}
                              >
                                {credentialBusyKey === `member-create-${member.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-1 h-3.5 w-3.5" />}
                                Criar link
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="uor-action-button min-h-10"
                                disabled={credentialBusyKey === `membership-remove-${member.id}`}
                                onClick={() => void handleRemoveTeamMembership(member)}
                              >
                                {credentialBusyKey === `membership-remove-${member.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                                Remover
                              </Button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
	                    );
	                  })
		                )}
			              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-100 bg-slate-50/60">
                <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                  <Search className="h-4 w-4 text-slate-700" />
                  Procurar integrante
                </CardTitle>
                <p className="text-xs text-slate-500">Encontra rapidamente um membro e envia ou cria link de credencial.</p>
              </CardHeader>
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input className="h-11 rounded-xl pl-9" value={memberSearch} onChange={(event) => void handleMemberSearch(event.target.value)} placeholder="Nome do integrante..." />
                  {memberSearchBusy && <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />}
                </div>
                {memberSearchResults !== null && (
                  <div className="mt-3 space-y-2">
                    {memberSearchResults.filter((member) => member.category === "NUCLEO" && member.source !== "NUCLEO_IMPORT").length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">Nenhum integrante do Núcleo encontrado.</div>
                    ) : (
                      memberSearchResults
                        .filter((member) => member.category === "NUCLEO" && member.source !== "NUCLEO_IMPORT")
                        .map((member) => (
                          <div key={member.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-900">{member.fullName}</p>
                                <p className="mt-0.5 text-xs text-slate-500">{member.team} · {member.role}</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => void handleCreateCredentialForMember(member)}>
                                <Link2 className="mr-1 h-3.5 w-3.5" />
                                Link
                              </Button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-blue-950">
                  <Link2 className="h-4 w-4" />
                  Correspondência manual
                </CardTitle>
                <p className="text-xs text-blue-800">
                  Liga credenciais antigas ao cadastro digital quando o nome/número não foi resolvido automaticamente.
                </p>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0">
                {membershipMatchItems.length === 0 ? (
                  <div className="rounded-xl border border-blue-100 bg-white/80 p-5 text-center text-xs text-blue-800">Sem sugestões pendentes neste momento.</div>
                ) : (
                  membershipMatchItems.map((item) => (
                    <div key={item.credential.id} className="rounded-xl bg-white p-3 text-xs shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{item.credential.name || "Link aberto"}</span>
                        <span className={item.ambiguous ? "text-amber-700" : "text-blue-700"}>{item.ambiguous ? "revisão" : "sugestão"}</span>
                      </div>
                      <p className="mt-1 text-blue-800">{item.credential.team} · {item.credential.role}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.candidates.slice(0, 2).map((candidate) => (
                          <Button
                            key={candidate.teamMembership.id}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-auto rounded-full border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] text-blue-900 hover:bg-blue-100"
                            disabled={credentialBusyKey === `membership-link-${item.credential.id}-${candidate.teamMembership.id}`}
                            onClick={() => void handleLinkMembershipMatch(item.credential.id, candidate.teamMembership.id)}
                          >
                            {credentialBusyKey === `membership-link-${item.credential.id}-${candidate.teamMembership.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Link2 className="mr-1 h-3 w-3" />}
                            {candidate.teamMembership.fullName} · {candidate.score}%
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-sky-200 bg-sky-50/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base text-sky-950">
                  <UserCheck className="h-4 w-4" />
                  Perfis prontos
                </CardTitle>
                <p className="text-xs text-sky-800">Membros do Núcleo com credencial pronta para PDF.</p>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0">
                {readyNucleusMembers.length === 0 ? (
                  <div className="rounded-xl border border-sky-100 bg-white/80 p-5 text-center text-xs text-sky-800">Ainda não há perfis concluídos.</div>
                ) : (
                  readyNucleusMembers.map((member) => {
                    const theme = credentialVisualThemeFor(member, passTemplates);
                    return (
                    <div key={member.id} className="grid gap-2 rounded-xl border bg-white p-3 text-xs shadow-sm sm:grid-cols-[1fr_auto] sm:items-center" style={{ borderColor: `${theme.accentColor}44` }}>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{member.name || "Membro do Núcleo"}</p>
                        <p className="mt-1" style={{ color: theme.primaryColor }}>{member.team} · {member.role}</p>
                      </div>
                      <Button size="sm" variant="outline" style={credentialActionStyle(theme)} disabled={credentialBusyKey === `credentials-pass-${member.id}`} onClick={() => void handleDownloadCredentialPass(member)}>
                        {credentialBusyKey === `credentials-pass-${member.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                        PDF
                      </Button>
                    </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      {scope === "security" && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-white p-3 sm:p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Shield className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold sm:text-2xl">{totalAdmins}</p>
            <p className="truncate text-[11px] text-muted-foreground">Administradores</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-white p-3 sm:p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Crown className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold sm:text-2xl">{superAdmins}</p>
            <p className="truncate text-[11px] text-muted-foreground">Super Admins</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-white p-3 sm:p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <BadgeCheck className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold sm:text-2xl">{teamLeads}</p>
            <p className="truncate text-[11px] text-muted-foreground">Líderes</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border/50 bg-white p-3 sm:p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400">
            <Users className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold sm:text-2xl">{members}</p>
            <p className="truncate text-[11px] text-muted-foreground">Membros</p>
          </div>
        </div>
      </div>}

      {scope === "credentials" && <Card className="max-w-full overflow-hidden border-slate-200 bg-gradient-to-br from-white via-sky-50/40 to-orange-50/30 shadow-sm shadow-slate-900/5">
        <div className="h-1 bg-gradient-to-r from-sky-700 via-cyan-500 to-orange-400" />
        <CardHeader className="min-w-0 border-b border-slate-100 bg-white/75 backdrop-blur">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex min-w-0 items-center gap-2 text-lg text-slate-900">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-700 to-cyan-500 text-white shadow-sm shadow-sky-900/20">
                  <IdCard className="h-4 w-4" />
                </div>
                <span className="min-w-0 break-words">Equipa e credenciais</span>
              </CardTitle>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Links de candidatura, perfis públicos com QR e passes em PDF para núcleo, expositores, júri, palestrantes e equipa do evento.
              </p>
            </div>
            <div className="grid w-full min-w-0 grid-cols-2 gap-2 text-center sm:grid-cols-4 lg:w-auto">
              <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm">
                <p className="text-xl font-bold text-slate-900">{credentialOverview?.stats.total ?? 0}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Credenciais</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 shadow-sm">
                <p className="text-xl font-bold text-slate-900">{credentialOverview?.stats.profileReady ?? 0}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Prontas</p>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2 shadow-sm">
                <p className="text-xl font-bold text-slate-900">{credentialOverview?.stats.teams ?? 0}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Equipas</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 shadow-sm">
                <p className="text-xl font-bold text-slate-900">{incompleteProfiles?.stats.incomplete ?? 0}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Incompletas</p>
              </div>
            </div>
          </div>
        </CardHeader>
	        <CardContent className="min-w-0 space-y-5 p-4 sm:p-5">
		          <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
	            {credentialAdminSubpages.map((subpage) => {
	              const Icon = subpage.icon;
	              const isActive = activeCredentialSubpage === subpage.id;
	              return (
	                <button
	                  key={subpage.id}
	                  type="button"
	                  onClick={() => handleCredentialSubpageChange(subpage.id)}
	                  className={`flex min-h-[76px] min-w-0 items-start gap-3 rounded-2xl border p-3 text-left transition ${
	                    isActive
	                      ? "border-sky-300 bg-sky-50 text-sky-950 shadow-sm"
	                      : "border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white"
	                  }`}
	                >
	                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isActive ? "bg-sky-700 text-white" : "bg-slate-100 text-slate-500"}`}>
	                    <Icon className="h-4 w-4" />
	                  </span>
	                  <span className="min-w-0">
	                    <span className="block truncate text-sm font-bold">{subpage.label}</span>
	                    <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-slate-500">
	                      {subpage.description}
	                    </span>
	                  </span>
	                </button>
	              );
	            })}
	          </div>

	          {showCredentialOverview ? (
	            <div className="grid min-w-0 gap-4 lg:grid-cols-3">
	              {credentialAdminSubpages.filter((subpage) => subpage.id !== "overview").map((subpage) => {
	                const Icon = subpage.icon;
	                const stat =
	                  subpage.id === "links"
	                    ? `${credentialOverview?.stats.total ?? 0} link(s)`
		                      : subpage.id === "members"
		                        ? `${credentialOverview?.stats.teams ?? 0} equipa(s)`
		                        : subpage.id === "bulk-issue"
		                          ? `${readyExhibitorMembers.length + readyNucleusCredentialMembers.length + readySpeakerCredentialMembers.length} imprimível(is)`
		                      : subpage.id === "printing"
		                        ? `${printableCredentialMembers.length} passe(s) pronto(s)`
	                        : subpage.id === "templates"
	                          ? `${passTemplates.length} modelo(s)`
	                          : `${incompleteProfiles?.stats.incomplete ?? 0} pendente(s)`;
	                return (
	                  <button
	                    key={subpage.id}
	                    type="button"
	                    onClick={() => handleCredentialSubpageChange(subpage.id)}
	                    className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
	                  >
	                    <div className="flex min-w-0 items-start justify-between gap-3">
	                      <div className="min-w-0">
	                        <p className="truncate text-sm font-bold text-slate-950">{subpage.label}</p>
	                        <p className="mt-1 text-xs leading-5 text-slate-500">{subpage.description}</p>
	                      </div>
	                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition group-hover:bg-sky-700 group-hover:text-white">
	                        <Icon className="h-4 w-4" />
	                      </span>
	                    </div>
	                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
	                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Estado atual</p>
	                      <p className="mt-1 text-sm font-bold text-slate-800">{stat}</p>
	                    </div>
	                  </button>
	                );
	              })}
	            </div>
	          ) : (
	          <div className={`grid min-w-0 gap-4 ${showCredentialLinks ? "xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]" : "xl:grid-cols-1"}`}>
	            {showCredentialLinks && (
	            <div className="rounded-2xl border p-4 min-w-0" style={credentialPanelStyle(credentialFormTheme)}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold" style={{ color: credentialFormTheme.primaryColor }}>Criar link de candidatura</h3>
                  <p className="mt-1 text-xs text-slate-500">O membro completa os dados e baixa o passe pelo link.</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(135deg, ${credentialFormTheme.primaryColor}, ${credentialFormTheme.accentColor})` }}>
                  <FileBadge2 className="h-4 w-4" />
                </div>
              </div>

              {teamProfilePresets.length > 0 && (
                <div className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Perfis padrão por área</p>
                  <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
                    {teamProfilePresets.map((preset) => {
                      const theme = credentialVisualThemeFor(preset, passTemplates);
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => applyCredentialProfilePreset(preset)}
                          className="min-w-0 rounded-lg border px-3 py-2 text-left text-xs transition hover:-translate-y-0.5 hover:shadow-sm"
                          style={credentialPanelStyle(theme)}
                        >
                          <span className="flex items-center gap-2 font-semibold" style={{ color: theme.primaryColor }}>
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.accentColor }} />
                            {preset.label}
                          </span>
                          <span className="mt-0.5 block text-slate-600">{preset.role}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                <FormField label="Tipo de credencial">
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={credentialForm.category ?? "NUCLEO"}
                    onChange={(event) => setCredentialForm((current) => ({ ...current, category: event.target.value }))}
                  >
                    {credentialCategories.map((category) => (
                      <option key={category.value} value={category.value}>{category.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Equipa">
                  {(credentialForm.category ?? "NUCLEO") === "NUCLEO" ? (
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      value={selectedCredentialAreaPreset?.key ?? ""}
                      onChange={(event) => {
                        const preset = teamProfilePresets.find((item) => item.key === event.target.value);
                        if (preset) applyCredentialProfilePreset(preset);
                      }}
                    >
                      <option value="">Seleciona a categoria</option>
                      {teamProfilePresets.map((preset) => (
                        <option key={preset.key} value={preset.key}>{preset.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={credentialForm.team ?? ""}
                      onChange={(event) => setCredentialForm((current) => ({ ...current, team: event.target.value }))}
                      placeholder="Ex: Protocolo"
                    />
                  )}
                </FormField>
                <FormField label="Função">
                  {(credentialForm.category ?? "NUCLEO") === "NUCLEO" ? (
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      value={selectedCredentialFunction?.key ?? ""}
                      onChange={(event) => {
                        const fn = selectedCredentialAreaFunctions.find((item) => item.key === event.target.value);
                        if (!fn) return;
                        setCredentialForm((current) => ({
                          ...current,
                          role: fn.label,
                          accessLevel: fn.accessLevel,
                          permissions: fn.permissions,
                        }));
                      }}
                      disabled={!selectedCredentialAreaPreset}
                    >
                      <option value="">{selectedCredentialAreaPreset ? "Seleciona a função" : "Escolhe primeiro a categoria"}</option>
                      {selectedCredentialAreaFunctions.map((fn) => (
                        <option key={fn.key} value={fn.key}>{fn.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={credentialForm.role ?? ""}
                      onChange={(event) => setCredentialForm((current) => ({ ...current, role: event.target.value }))}
                      placeholder="Ex: Coordenação"
                    />
                  )}
                </FormField>
                <FormField label="Acesso no passe">
                  <Input
                    value={credentialForm.accessLevel ?? ""}
                    onChange={(event) => setCredentialForm((current) => ({ ...current, accessLevel: event.target.value }))}
                    placeholder="Ex: Palco, backstage"
                  />
                </FormField>
                <FormField label="Nome opcional">
                  <Input
                    value={credentialForm.name ?? ""}
                    onChange={(event) => setCredentialForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Deixa vazio para link aberto"
                  />
                </FormField>
                <FormField label="Expira em">
                  <Input
                    type="date"
                    value={credentialForm.expiresAt?.slice(0, 10) ?? ""}
                    onChange={(event) => setCredentialForm((current) => ({ ...current, expiresAt: event.target.value || null }))}
                  />
                </FormField>
                <div className="flex items-end">
                  <Button
                    type="button"
                    className="h-10 w-full"
                    style={{ backgroundColor: credentialFormTheme.primaryColor, borderColor: credentialFormTheme.primaryColor, color: "#ffffff" }}
                    disabled={credentialBusyKey === "credentials-create"}
                    onClick={() => void handleCreateCredential()}
                  >
                    {credentialBusyKey === "credentials-create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                    Criar link
                  </Button>
                </div>
              </div>

              {lastCreatedCredential && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Link criado</p>
                      <p className="mt-1 break-all text-xs text-emerald-800">
                        {credentialInviteUrl(lastCreatedCredential)}
                      </p>
                      {lastCreatedCredential.invitationExpiresAt && (
                        <p className="mt-1 text-[11px] font-medium text-emerald-800">
                          Convite válido até {formatDate(lastCreatedCredential.invitationExpiresAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex w-full flex-col gap-2 min-[430px]:w-auto min-[430px]:flex-row">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-100"
                        onClick={() => void handleCopyCredentialLink(credentialInviteUrl(lastCreatedCredential))}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Copiar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-100"
                        asChild
                      >
                        <a href={credentialInviteUrl(lastCreatedCredential)} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          Abrir
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acessos visuais</p>
                  <span className="text-[11px] font-semibold" style={{ color: credentialFormTheme.primaryColor }}>{credentialFormTheme.footerLabel}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allPermissionValues.map((permission) => {
                    const active = (credentialForm.permissions ?? []).includes(permission);
                    return (
                      <button
                        key={permission}
                        type="button"
                        onClick={() => updateCredentialPermission(permission, !active)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                          active
                            ? "text-white"
                            : "border-border/60 bg-background text-muted-foreground hover:border-border"
                        }`}
                        style={active ? { borderColor: `${credentialFormTheme.accentColor}77`, backgroundColor: credentialFormTheme.primaryColor } : undefined}
                      >
                        {adminPermissionLabel(permission)}
                      </button>
                    );
                  })}
	                </div>
	              </div>
	            </div>
	            )}

	            <div className="rounded-2xl border border-border/60 p-4 min-w-0 overflow-hidden">
	              <div className="flex min-w-0 flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
	                <div className="min-w-0">
	                  <h3 className="text-sm font-semibold text-slate-900">{activeCredentialSubpageMeta.label}</h3>
	                  <p className="mt-1 text-xs text-slate-500">{activeCredentialSubpageMeta.description}</p>
	                </div>
	                {(showCredentialLinks || showCredentialMembers) && (
	                <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[430px]:grid-cols-2 2xl:w-auto 2xl:grid-cols-4">
	                  <Button size="sm" className="min-w-0" disabled={credentialBusyKey === "credentials-bulk"} onClick={() => void handleBulkInvitation()}>
                    {credentialBusyKey === "credentials-bulk" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Users className="mr-1.5 h-3.5 w-3.5" />}
                    Link Núcleo
                  </Button>
                  <Button size="sm" variant="outline" className="min-w-0" disabled={credentialBusyKey === "credentials-import-expositors"} onClick={() => void handleImportExpositors()}>
                    {credentialBusyKey === "credentials-import-expositors" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-1.5 h-3.5 w-3.5" />}
                    Importar Expositores
                  </Button>
                  <Button size="sm" className="min-w-0" disabled={credentialBusyKey === "credentials-bulk-expositor"} onClick={() => void handleBulkExpositorInvitation()}>
                    {credentialBusyKey === "credentials-bulk-expositor" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-1.5 h-3.5 w-3.5" />}
                    Link Expositores
                  </Button>
                  <Button size="sm" variant="outline" className="min-w-0" disabled={credentialBusyKey === "credentials-load"} onClick={() => void loadTeamCredentials()}>
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${credentialBusyKey === "credentials-load" ? "animate-spin" : ""}`} />
	                    Atualizar
	                  </Button>
	                </div>
	                )}
		              </div>

		              {showCredentialBulkIssue && (
		                <div className="mt-3 space-y-4">
		                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
		                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
		                      <div className="min-w-0">
		                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Passes oficiais e convidados do site</p>
		                        <p className="mt-1 text-xs leading-5 text-slate-500">
		                          Emite num único PDF expositores, núcleo e palestrantes/convidados cadastrados no site.
		                        </p>
		                      </div>
		                      <div className="flex flex-wrap items-center gap-2">
		                        <Button
		                          size="sm"
		                          variant="outline"
		                          className="h-9 rounded-xl bg-white text-xs"
		                          disabled={credentialBusyKey === "credentials-sync-site-guests"}
		                          onClick={() => void handleSyncSiteGuests()}
		                        >
		                          {credentialBusyKey === "credentials-sync-site-guests" ? (
		                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
		                          ) : (
		                            <Mic className="mr-1 h-3.5 w-3.5" />
		                          )}
		                          Sincronizar convidados do site
		                        </Button>
		                        <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-white p-1">
		                          <Button
		                            size="sm"
		                            variant={passPrintMode === "color" ? "default" : "ghost"}
		                            className="h-8 px-2 text-xs"
		                            onClick={() => setPassPrintMode("color")}
		                          >
		                            <Palette className="mr-1 h-3.5 w-3.5" />
		                            Cor
		                          </Button>
		                          <Button
		                            size="sm"
		                            variant={passPrintMode === "black-white" ? "default" : "ghost"}
		                            className="h-8 px-2 text-xs"
		                            onClick={() => setPassPrintMode("black-white")}
		                          >
		                            <FileBadge2 className="mr-1 h-3.5 w-3.5" />
		                            P/B
		                          </Button>
		                        </div>
		                      </div>
		                    </div>
		                    <div className="mt-3 grid gap-3 xl:grid-cols-3">
		                      {[
		                        {
		                          category: "EXPOSITOR",
		                          title: "Todos os expositores",
		                          description: "Baixa passes CR-80 dos expositores importados, mesmo antes do perfil completo.",
		                          ready: readyExhibitorMembers.length,
		                          total: allExhibitorMembers.length,
		                          icon: Rocket,
		                          includePending: true,
		                          autoSyncBeforeDownload: true,
		                        },
		                        {
		                          category: "NUCLEO",
		                          title: "Membros do núcleo",
		                          description: "Baixa os passes de operação interna e equipas do evento.",
		                          ready: readyNucleusCredentialMembers.length,
		                          total: allNucleusCredentialMembers.length,
		                          icon: Users,
		                          includePending: false,
		                          autoSyncBeforeDownload: false,
		                        },
		                        {
		                          category: "PALESTRANTE",
		                          title: "Palestrantes do site",
		                          description: "Sincroniza os convidados cadastrados no site e baixa os passes oficiais.",
		                          ready: readySpeakerCredentialMembers.length,
		                          total: allSpeakerCredentialMembers.length,
		                          icon: Mic,
		                          includePending: false,
		                          autoSyncBeforeDownload: false,
		                        },
		                      ].map((item) => {
		                        const Icon = item.icon;
		                        const busy = `credentials-pass-batch-${item.category}`;
		                        const canAttemptBatchDownload = item.autoSyncBeforeDownload || item.ready > 0;
		                        return (
		                          <div key={item.category} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
		                            <div className="flex min-w-0 items-start justify-between gap-3">
		                              <div className="min-w-0">
		                                <p className="text-sm font-bold text-slate-950">{item.title}</p>
		                                <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
		                              </div>
		                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
		                                <Icon className="h-4 w-4" />
		                              </span>
		                            </div>
		                            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
		                              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
		                                <p className="text-xl font-black text-emerald-700">{item.ready}</p>
		                                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/70">Prontos</p>
		                              </div>
		                              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
		                                <p className="text-xl font-black text-slate-800">{item.total}</p>
		                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total</p>
		                              </div>
		                            </div>
		                            <Button
		                              size="sm"
		                              className="mt-4 w-full rounded-xl"
		                              disabled={credentialBusyKey === busy || !canAttemptBatchDownload}
		                              onClick={() => void handleDownloadCredentialCategoryBatch(item.category, item.title, item.includePending)}
		                            >
		                              {credentialBusyKey === busy ? (
		                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
		                              ) : (
		                                <Download className="mr-1.5 h-3.5 w-3.5" />
		                              )}
		                              {item.autoSyncBeforeDownload ? "Sincronizar e baixar" : "Baixar lote"}
		                            </Button>
		                          </div>
		                        );
		                      })}
		                    </div>
		                  </div>

		                  <div className="rounded-xl border border-slate-200 bg-white p-3">
		                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		                      <div className="min-w-0">
		                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Passes genéricos operacionais</p>
		                        <p className="mt-1 text-xs leading-5 text-slate-500">
		                          Cria lotes editáveis para staff, protocolo, convidados e júri, sem precisar preencher um por um.
		                        </p>
		                      </div>
		                      <Badge variant="outline" className="w-fit bg-slate-50 text-slate-700">
		                        Criar e baixar no mesmo fluxo
		                      </Badge>
		                    </div>
		                    <div className="mt-3 grid gap-3 xl:grid-cols-2">
		                      {bulkIssueGenericPresets.map((preset) => {
		                        const form = bulkIssueGenericForms[preset.key];
		                        const previewCount = buildGenericPreviewItems(form).length;
		                        const theme = credentialVisualThemeFor(
		                          {
		                            category: form.category ?? preset.key,
		                            team: form.team,
		                            role: form.role,
		                            accessLevel: form.accessLevel,
		                          },
		                          passTemplates,
		                        );
		                        const busy = `bulk-issue-generic-${preset.key}`;
		                        return (
		                          <div key={preset.key} className="rounded-2xl border p-3" style={credentialPanelStyle(theme)}>
		                            <div className="flex items-start justify-between gap-3">
		                              <div className="min-w-0">
		                                <p className="text-sm font-bold" style={{ color: theme.primaryColor }}>{preset.label}</p>
		                                <p className="mt-1 text-xs leading-5 text-slate-600">{preset.description}</p>
		                              </div>
		                              <Badge variant="outline" style={credentialChipStyle(theme)}>
		                                {previewCount} passe(s)
		                              </Badge>
		                            </div>
		                            <div className="mt-3 grid gap-2 md:grid-cols-2">
		                              <label className="space-y-1">
		                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Prefixo</span>
		                                <Input
		                                  className="h-9 bg-white text-xs"
		                                  value={form.prefix ?? ""}
		                                  onChange={(event) => updateBulkIssueGenericForm(preset.key, { prefix: event.target.value })}
		                                />
		                              </label>
		                              <label className="space-y-1">
		                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Quantidade</span>
		                                <Input
		                                  type="number"
		                                  min={1}
		                                  max={80}
		                                  className="h-9 bg-white text-xs"
		                                  value={form.quantity}
		                                  onChange={(event) => updateBulkIssueGenericForm(preset.key, { quantity: Number(event.target.value) })}
		                                />
		                              </label>
		                              <label className="space-y-1">
		                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Função</span>
		                                <Input
		                                  className="h-9 bg-white text-xs"
		                                  value={form.role ?? ""}
		                                  onChange={(event) => updateBulkIssueGenericForm(preset.key, { role: event.target.value, accessLevel: event.target.value })}
		                                />
		                              </label>
		                              <label className="space-y-1">
		                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Início</span>
		                                <Input
		                                  type="number"
		                                  min={1}
		                                  className="h-9 bg-white text-xs"
		                                  value={form.startNumber ?? 1}
		                                  onChange={(event) => updateBulkIssueGenericForm(preset.key, { startNumber: Number(event.target.value) })}
		                                />
		                              </label>
		                            </div>
		                            <Button
		                              size="sm"
		                              className="mt-3 w-full rounded-xl"
		                              style={{ backgroundColor: theme.primaryColor, borderColor: theme.primaryColor, color: "#ffffff" }}
		                              disabled={credentialBusyKey === busy}
		                              onClick={() => void handleCreateAndDownloadGenericBatch(preset.key)}
		                            >
		                              {credentialBusyKey === busy ? (
		                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
		                              ) : (
		                                <FileBadge2 className="mr-1.5 h-3.5 w-3.5" />
		                              )}
		                              Criar e baixar lote
		                            </Button>
		                          </div>
		                        );
		                      })}
		                    </div>
		                  </div>

		                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
		                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
		                      <div className="min-w-0">
		                        <p className="flex items-center gap-2 text-sm font-bold text-amber-950">
		                          <Crown className="h-4 w-4" />
		                          Passe VIP da coordenação
		                        </p>
		                        <p className="mt-1 text-xs leading-5 text-amber-900/80">
		                          Usa categoria de convidado com acesso VIP, mantendo nome, função e links editáveis antes da emissão.
		                        </p>
		                      </div>
		                      <Badge variant="outline" className="w-fit border-amber-300 bg-white text-amber-800">VIP</Badge>
		                    </div>
		                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
		                      <label className="space-y-1">
		                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/70">Nome</span>
		                        <Input
		                          className="h-9 bg-white text-xs"
		                          value={bulkIssueVipForm.name}
		                          onChange={(event) => setBulkIssueVipForm((current) => ({ ...current, name: event.target.value }))}
		                        />
		                      </label>
		                      <label className="space-y-1">
		                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/70">Função</span>
		                        <Input
		                          className="h-9 bg-white text-xs"
		                          value={bulkIssueVipForm.role}
		                          onChange={(event) => setBulkIssueVipForm((current) => ({ ...current, role: event.target.value }))}
		                        />
		                      </label>
		                      <label className="space-y-1">
		                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/70">Equipa</span>
		                        <Input
		                          className="h-9 bg-white text-xs"
		                          value={bulkIssueVipForm.team}
		                          onChange={(event) => setBulkIssueVipForm((current) => ({ ...current, team: event.target.value }))}
		                        />
		                      </label>
		                      <label className="space-y-1">
		                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/70">Organização</span>
		                        <Input
		                          className="h-9 bg-white text-xs"
		                          value={bulkIssueVipForm.organization}
		                          onChange={(event) => setBulkIssueVipForm((current) => ({ ...current, organization: event.target.value }))}
		                        />
		                      </label>
		                      <label className="space-y-1">
		                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/70">Instagram</span>
		                        <Input
		                          className="h-9 bg-white text-xs"
		                          value={bulkIssueVipForm.instagramUrl}
		                          onChange={(event) => setBulkIssueVipForm((current) => ({ ...current, instagramUrl: event.target.value }))}
		                          placeholder="@uorconnect"
		                        />
		                      </label>
		                      <label className="space-y-1">
		                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/70">LinkedIn</span>
		                        <Input
		                          className="h-9 bg-white text-xs"
		                          value={bulkIssueVipForm.linkedinUrl}
		                          onChange={(event) => setBulkIssueVipForm((current) => ({ ...current, linkedinUrl: event.target.value }))}
		                          placeholder="linkedin.com/in/..."
		                        />
		                      </label>
		                      <label className="space-y-1">
		                        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/70">Website</span>
		                        <Input
		                          className="h-9 bg-white text-xs"
		                          value={bulkIssueVipForm.websiteUrl}
		                          onChange={(event) => setBulkIssueVipForm((current) => ({ ...current, websiteUrl: event.target.value }))}
		                          placeholder="https://..."
		                        />
		                      </label>
		                      <div className="flex items-end">
		                        <Button
		                          size="sm"
		                          className="h-9 w-full rounded-xl bg-amber-700 text-white hover:bg-amber-800"
		                          disabled={credentialBusyKey === "bulk-issue-vip"}
		                          onClick={() => void handleCreateAndDownloadVipBatch()}
		                        >
		                          {credentialBusyKey === "bulk-issue-vip" ? (
		                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
		                          ) : (
		                            <Crown className="mr-1.5 h-3.5 w-3.5" />
		                          )}
		                          Criar passe VIP
		                        </Button>
		                      </div>
		                    </div>
		                  </div>
		                </div>
		              )}

		              {showCredentialPrinting && (
		              <div className="mt-3 min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex min-w-0 flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Impressao de passes</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {printableCredentialMembers.length} credencial(is) pronta(s) no filtro atual.
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                      <Button
                        size="sm"
                        variant={passPrintMode === "color" ? "default" : "ghost"}
                        className="h-8 px-2 text-xs"
                        onClick={() => setPassPrintMode("color")}
                      >
                        <Palette className="mr-1 h-3.5 w-3.5" />
                        Cor
                      </Button>
                      <Button
                        size="sm"
                        variant={passPrintMode === "black-white" ? "default" : "ghost"}
                        className="h-8 px-2 text-xs"
                        onClick={() => setPassPrintMode("black-white")}
                      >
                        <FileBadge2 className="mr-1 h-3.5 w-3.5" />
                        P/B
                      </Button>
                    </div>
                    <div className="flex min-w-[220px] flex-wrap items-center gap-2 rounded-lg border border-cyan-100 bg-white px-2 py-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-800">2 por pagina · A4 horizontal</span>
                      <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-700">
                        Virar na margem curta
                      </span>
                      <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        verso
                        <select
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                          value={passDuplexMode}
                          onChange={(event) => setPassDuplexMode(event.target.value as TeamCredentialPassDuplexMode)}
                        >
                          <option value="short-edge">margem curta</option>
                          <option value="same-position">mesma posição</option>
                          <option value="long-edge">margem longa</option>
                        </select>
                      </label>
                      <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        plastificacao
                        <Input
                          type="number"
                          min={0}
                          max={8}
                          step={0.5}
                          className="h-8 w-16 rounded-lg px-2 text-xs"
                          value={passLaminationMarginMm}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setPassLaminationMarginMm(Number.isFinite(value) ? Math.max(0, Math.min(8, value)) : 3);
                          }}
                        />
                        mm
                      </label>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={credentialBusyKey === "credentials-pass-calibration"}
                      onClick={() => void handleDownloadPassCalibration()}
                    >
                      {credentialBusyKey === "credentials-pass-calibration" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                      Teste alinhamento
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={credentialBusyKey === "credentials-pass-batch" || printableCredentialMembers.length === 0}
                      onClick={() => void handleDownloadCredentialBatch()}
                    >
                      {credentialBusyKey === "credentials-pass-batch" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                      Lote A4 2x
                    </Button>
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Lotes de impressão</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Cria passes nominais ou genéricos para júri, convidados, staff e protocolo, com prévia antes do PDF final.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                        <Button
                          size="sm"
                          variant={printBatchMode === "NOMINAL" ? "default" : "ghost"}
                          className="h-8 px-2 text-xs"
                          onClick={() => setPrintBatchMode("NOMINAL")}
                        >
                          <UserCheck className="mr-1 h-3.5 w-3.5" />
                          Passes nominais
                        </Button>
                        <Button
                          size="sm"
                          variant={printBatchMode === "GENERIC" ? "default" : "ghost"}
                          className="h-8 px-2 text-xs"
                          onClick={() => setPrintBatchMode("GENERIC")}
                        >
                          <IdCard className="mr-1 h-3.5 w-3.5" />
                          Passes genéricos
                        </Button>
                      </div>
                      <Button size="sm" variant="outline" onClick={handlePreviewPrintBatch}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Pré-visualizar lote
                      </Button>
                      <Button size="sm" disabled={credentialBusyKey === "print-batch-create"} onClick={() => void handleCreatePrintBatch()}>
                        {credentialBusyKey === "print-batch-create" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileBadge2 className="mr-1.5 h-3.5 w-3.5" />}
                        Criar lote
                      </Button>
                      <Button size="sm" variant="outline" disabled={!selectedPrintBatch || credentialBusyKey?.startsWith("print-batch-download")} onClick={() => void handleDownloadPrintBatch()}>
                        {credentialBusyKey?.startsWith("print-batch-download") ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                        Baixar lote
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
                      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
                        <label className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nome do lote</span>
                          <Input
                            className="h-9 text-xs"
                            value={printBatchTitle}
                            onChange={(event) => setPrintBatchTitle(event.target.value)}
                          />
                        </label>
                        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Prévia</p>
                          <p className="mt-1 text-lg font-bold text-slate-900">{printBatchPreviewItems.length}</p>
                        </div>
                      </div>

                      {printBatchMode === "NOMINAL" ? (
                        <div className="mt-3 space-y-2">
                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Passes nominais</span>
                            <textarea
                              className="min-h-28 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              value={printBatchNominalText}
                              onChange={(event) => setPrintBatchNominalText(event.target.value)}
                              placeholder="Nome | Categoria | Equipa | Função | Organização | Instagram | LinkedIn | Website"
                            />
                          </label>
                          <p className="text-[11px] leading-5 text-slate-500">
                            Uma linha por pessoa. Ex.: Ana Neto | JURI | Júri | Jurada | UOR | @ana | linkedin.com/in/ana | ana.ao
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Categoria</span>
                            <select
                              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              value={printBatchGenericForm.category ?? "STAFF"}
                              onChange={(event) => setPrintBatchGenericForm((current) => ({ ...current, category: event.target.value }))}
                            >
                              {credentialCategories.map((category) => (
                                <option key={category.value} value={category.value}>{category.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Prefixo</span>
                            <Input
                              className="h-9 text-xs"
                              value={printBatchGenericForm.prefix ?? ""}
                              onChange={(event) => setPrintBatchGenericForm((current) => ({ ...current, prefix: event.target.value }))}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Quantidade</span>
                            <Input
                              type="number"
                              min={1}
                              max={80}
                              className="h-9 text-xs"
                              value={printBatchGenericForm.quantity}
                              onChange={(event) => setPrintBatchGenericForm((current) => ({ ...current, quantity: Number(event.target.value) }))}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Equipa</span>
                            <Input
                              className="h-9 text-xs"
                              value={printBatchGenericForm.team ?? ""}
                              onChange={(event) => setPrintBatchGenericForm((current) => ({ ...current, team: event.target.value }))}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Função</span>
                            <Input
                              className="h-9 text-xs"
                              value={printBatchGenericForm.role ?? ""}
                              onChange={(event) => setPrintBatchGenericForm((current) => ({ ...current, role: event.target.value }))}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Início</span>
                            <Input
                              type="number"
                              min={1}
                              className="h-9 text-xs"
                              value={printBatchGenericForm.startNumber ?? 1}
                              onChange={(event) => setPrintBatchGenericForm((current) => ({ ...current, startNumber: Number(event.target.value) }))}
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pré-visualização</p>
                        <Badge variant="outline" className="bg-slate-50 text-slate-700">{printBatchPreviewItems.length} passe(s)</Badge>
                      </div>
                      <div className="mt-2 max-h-40 space-y-1 overflow-auto pr-1">
                        {printBatchPreviewItems.slice(0, 12).map((item, index) => {
                          const theme = credentialVisualThemeFor({ category: item.category, team: item.team, role: item.role }, passTemplates);
                          return (
                            <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5" style={credentialChipStyle(theme)}>
                              <span className="truncate text-xs font-semibold">{item.name}</span>
                              <span className="shrink-0 text-[10px] uppercase tracking-wide">{credentialCategories.find((category) => category.value === item.category)?.label ?? item.category}</span>
                            </div>
                          );
                        })}
                        {printBatchPreviewItems.length === 0 && (
                          <p className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">Sem passes na prévia.</p>
                        )}
                      </div>
                      <div className="mt-3 border-t border-slate-100 pt-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Lotes recentes</p>
                          <span className="text-[11px] text-slate-500">{printBatches.length}</span>
                        </div>
                        <div className="mt-2 max-h-32 space-y-1 overflow-auto">
                          {printBatches.slice(0, 5).map((batch) => (
                            <button
                              key={batch.id}
                              type="button"
                              className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition ${selectedPrintBatch?.id === batch.id ? "border-primary bg-primary/5 text-primary" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}
                              onClick={() => setSelectedPrintBatch(batch)}
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-semibold">{batch.title}</span>
                                <span className="block text-[10px] text-slate-500">{batch.totalItems} passe(s) · {formatDate(batch.createdAt)}</span>
                              </span>
                              <Eye className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          ))}
	                          {printBatches.length === 0 && (
	                            <p className="rounded-md border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-500">Nenhum lote criado ainda.</p>
	                          )}
	                        </div>
	                      </div>
	                    </div>
	                  </div>
	                </div>
	              </div>
	              )}
	              {showCredentialTemplates && (
	                <div className="mt-3 grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 2xl:grid-cols-[180px_minmax(0,1fr)_auto] 2xl:items-end">
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Template</span>
                    <select
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      value={selectedPassTemplateCategory}
                      onChange={(event) => handleSelectPassTemplateCategory(event.target.value)}
                    >
                      {passTemplates.map((template) => (
                        <option key={template.category} value={template.category}>{template.categoryLabel}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
                    {[
                      ["primaryColor", "Primaria"],
                      ["accentColor", "Acento"],
                      ["lightColor", "Fundo"],
                    ].map(([key, label]) => (
                    <label key={key} className="min-w-0 space-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
                        <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-2">
                          <input
                            type="color"
                            className="h-6 w-8 rounded border-0 bg-transparent p-0"
                            value={String(passTemplateForm[key as keyof CredentialPrintTemplateInput] ?? "#000000")}
                            onChange={(event) => setPassTemplateForm((current) => ({ ...current, [key]: event.target.value }))}
                          />
                          <span className="truncate text-xs font-mono text-slate-600">{String(passTemplateForm[key as keyof CredentialPrintTemplateInput] ?? "")}</span>
                        </div>
                      </label>
                    ))}
                    <label className="min-w-0 space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Rodape</span>
                      <Input
                        className="h-9 bg-white text-xs"
                        value={passTemplateForm.footerLabel ?? ""}
                        onChange={(event) => setPassTemplateForm((current) => ({ ...current, footerLabel: event.target.value }))}
                      />
                    </label>
                  </div>
                  <Button
                    size="sm"
                    className="w-full 2xl:w-auto"
                    disabled={!selectedPassTemplate || credentialBusyKey === "pass-template-save"}
                    onClick={() => void handleSavePassTemplate()}
                  >
	                    {credentialBusyKey === "pass-template-save" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Palette className="mr-1.5 h-3.5 w-3.5" />}
	                    Guardar
	                  </Button>
	                </div>
	              )}

	              {/* ── Bulk invitation link ── */}
	              {(showCredentialLinks || showCredentialMembers) && bulkInvitation && (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                  <div className="flex min-w-0 flex-col gap-3 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-blue-900">Link coletivo do Nucleo</p>
                      <p className="mt-0.5 truncate text-xs text-blue-700 font-mono">{bulkInvitation.url}</p>
                      <p className="mt-1 text-xs text-blue-600">
                        {bulkInvitation.claimed}/{bulkInvitation.totalMembers} confirmados
                        {bulkInvitation.pending > 0 && ` · ${bulkInvitation.pending} pendente(s)`}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => void navigator.clipboard.writeText(bulkInvitation.url).then(() => toast.success("Link copiado."))}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copiar
                    </Button>
                  </div>
                </div>
              )}

              {/* ── Bulk expositor invitation link ── */}
	              {(showCredentialLinks || showCredentialMembers) && bulkExpositorInvitation && (
                <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                  <div className="flex min-w-0 flex-col gap-3 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-violet-900">Link coletivo de Expositores</p>
                      <p className="mt-0.5 truncate text-xs text-violet-700 font-mono">{bulkExpositorInvitation.url}</p>
                      <p className="mt-1 text-xs text-violet-600">
                        {bulkExpositorInvitation.claimed}/{bulkExpositorInvitation.totalExpositors} confirmados
                        {bulkExpositorInvitation.pending > 0 && ` · ${bulkExpositorInvitation.pending} pendente(s)`}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => void navigator.clipboard.writeText(bulkExpositorInvitation.url).then(() => toast.success("Link copiado."))}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copiar
                    </Button>
                  </div>
                </div>
	              )}

	              {showCredentialLinks && !bulkInvitation && !bulkExpositorInvitation && (
	                <div className="mt-4 rounded-xl border border-dashed border-sky-200 bg-sky-50/60 p-4 text-sm text-sky-900">
	                  Usa os botões acima para gerar links coletivos ou acompanha aqui os links criados nesta sessão.
	                </div>
	              )}

	              {/* ── Claim progress per team ── */}
		              {showCredentialMembers && credentialOverview && credentialOverview.teams.length > 0 && (
                <div className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Progresso por equipa</p>
                      <p className="text-[11px] text-slate-500">Credenciais confirmadas vs. convidadas em cada equipa.</p>
                    </div>
                  </div>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    {credentialOverview.teams.map((team) => {
                      const pct = team.total > 0 ? Math.round((team.profileReady / team.total) * 100) : 0;
                      return (
                        <div key={team.name} className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-900 truncate">{team.name}</p>
                            <span className="shrink-0 text-[11px] font-medium text-slate-600">{team.profileReady}/{team.total}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : pct > 50 ? "bg-blue-500" : pct > 0 ? "bg-amber-500" : "bg-slate-300"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {team.categories.map((cat) => (
                              <span key={cat} className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] text-slate-600">{cat}</span>
                            ))}
                            {team.invited > 0 && (
                              <span className="text-[10px] text-amber-600">{team.invited} pendente(s)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Member search + invite ── */}
	              {showCredentialMembers && (
	              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <Search className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Pesquisar membro</p>
                    <p className="text-[11px] text-slate-500">Verifica se existe na lista e envia convite por SMS ou WhatsApp.</p>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="h-10 pl-9 rounded-lg border-slate-200"
                    value={memberSearch}
                    onChange={(event) => void handleMemberSearch(event.target.value)}
                    placeholder="Pesquisar por nome do membro..."
                  />
                  {memberSearchBusy && <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />}
                </div>
                {memberSearchResults !== null && (
                  <div className="mt-3 space-y-2">
                    {memberSearchResults.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
                        <p className="text-xs font-medium text-slate-500">Nenhum membro encontrado para "{memberSearch}"</p>
                        <p className="mt-1 text-[11px] text-slate-400">Podes criar um link de convite aberto na secção acima.</p>
                      </div>
                    ) : (
                      memberSearchResults.map((membership) => (
                        <div key={membership.id} className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-semibold text-slate-900">{membership.fullName}</p>
                                <Badge variant="outline" className="text-[10px]">{membership.categoryLabel}</Badge>
                                {membership.hasCredential ? (
                                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                                    <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
                                    Credencial ativa
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                                    Sem credencial
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">
                                {membership.team} · {membership.role} · {membership.accessLevel}
                                {membership.studentNumber ? ` · ${membership.studentNumber}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {membership.hasCredential && membership.credentialInviteUrl ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => void handleCopyCredentialLink(membership.credentialInviteUrl!)}
                                  >
                                    <Copy className="mr-1 h-3 w-3" />
                                    Copiar link
                                  </Button>
                                  <ContextualSmsAction
                                    title={`Enviar convite a ${membership.fullName}`}
                                    buttonLabel="SMS"
                                    recipient={{ studentNumber: membership.studentNumber ?? "", name: membership.fullName }}
                                    defaultMessage={`Olá ${membership.fullName.split(" ")[0]}, o teu link de credencial UOR Connect está pronto. Completa o cadastro e obtém o teu passe: ${membership.credentialInviteUrl}`}
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    asChild
                                  >
                                    <a href={buildWhatsAppInviteUrl(membership.fullName, membership.credentialInviteUrl, null)} target="_blank" rel="noreferrer">
                                      <MessageCircle className="mr-1 h-3 w-3" />
                                      WhatsApp
                                    </a>
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-7 bg-slate-900 px-2.5 text-[11px] text-white hover:bg-slate-800"
                                  disabled={credentialBusyKey === `member-create-${membership.id}`}
                                  onClick={() => void handleCreateCredentialForMember(membership)}
                                >
                                  {credentialBusyKey === `member-create-${membership.id}` ? (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Link2 className="mr-1 h-3 w-3" />
                                  )}
                                  Criar link
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
	              </div>
	              )}

	              {showCredentialMembers && (
	              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Cadastro digital da equipa</p>
                    <p className="mt-1 text-xs text-emerald-800">
                      {teamMembershipOverview
                        ? `${teamMembershipOverview.stats.active} ativo(s) · ${teamMembershipOverview.stats.linkedToStudent} com número · ${teamMembershipOverview.stats.verified} verificado(s).`
                        : "A carregar membros aprovados."}
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit border-emerald-300 bg-white text-emerald-800">
                    {teamMembershipOverview?.stats.total ?? 0} oficiais
                  </Badge>
                </div>
                {officialTeamMemberships.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {officialTeamMemberships.map((member) => (
                      <div key={member.id} className="rounded-lg bg-white px-3 py-2 text-xs shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">{member.fullName}</span>
                          <span>{member.studentNumber ?? "sem número"}</span>
                        </div>
                        <p className="mt-1 text-emerald-800">
                          {member.team} · {member.role} · {member.statusLabel}
                        </p>
                        <p className="mt-1 text-emerald-700">
                          {member.verifiedAt
                            ? `Verificado por ${member.verifiedByStudentNumber ?? "admin"} em ${formatDateTime(member.verifiedAt)}`
                            : "Sem verificação registada"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
	              </div>
	              )}

	              {showCredentialMembers && (
	              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sky-950">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Perfis do Núcleo concluídos</p>
                    <p className="mt-1 text-xs text-sky-800">
                      Membros com dados completos e passe pronto para baixar.
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit border-sky-300 bg-white text-sky-800">
                    {allReadyNucleusMembers.length} pronto(s)
                  </Badge>
                </div>
                {readyNucleusMembers.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {readyNucleusMembers.map((member) => {
                      const theme = credentialVisualThemeFor(member, passTemplates);
                      return (
                      <div key={member.id} className="grid min-w-0 gap-3 rounded-lg border bg-white px-3 py-2 text-xs shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" style={{ borderColor: `${theme.accentColor}44` }}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{member.name || "Membro do Núcleo"}</span>
                            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={credentialChipStyle(theme)}>
                              <UserCheck className="h-3 w-3" />
                              Perfil completo
                            </span>
                          </div>
                          <p className="mt-1" style={{ color: theme.primaryColor }}>
                            {member.team} · {member.role} · {member.accessLevel}
                          </p>
                          {(member.course || member.phone || member.email) && (
                            <p className="mt-1 truncate text-[11px] text-slate-500">
                              {[member.course, member.phone, member.email].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          style={credentialActionStyle(theme)}
                          disabled={credentialBusyKey === `credentials-pass-${member.id}`}
                          onClick={() => void handleDownloadCredentialPass(member)}
                        >
                          {credentialBusyKey === `credentials-pass-${member.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                          Baixar passe
                        </Button>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-sky-200 bg-white/70 px-3 py-4 text-center text-xs text-sky-800">
                    Ainda não há membros do Núcleo com perfil concluído nesta lista.
                  </div>
                )}
	              </div>
	              )}

	              {showCredentialPending && (
	              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-950">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Correspondência nome/número</p>
                    <p className="mt-1 text-xs text-blue-800">
                      {membershipMatches
                        ? `${membershipMatches.stats.linkedCredentials} ligada(s) · ${membershipMatches.stats.unlinkedCredentials} por resolver · ${membershipMatches.stats.ambiguous} ambígua(s).`
                        : "A procurar associações entre credenciais e cadastro digital."}
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit border-blue-300 bg-white text-blue-800">
                    {membershipMatches?.stats.suggested ?? 0} sugestão(ões)
                  </Badge>
                </div>
                {membershipMatchItems.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {membershipMatchItems.map((item) => (
                      <div key={item.credential.id} className="rounded-lg bg-white px-3 py-2 text-xs shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">{item.credential.name || "Link aberto"}</span>
                          <span className={item.ambiguous ? "text-amber-700" : "text-blue-700"}>
                            {item.ambiguous ? "revisão manual" : "sugestão"}
                          </span>
                        </div>
                        <p className="mt-1 text-blue-800">
                          {item.credential.team} · {item.credential.role}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.candidates.slice(0, 2).map((candidate) => (
                            <Button
                              key={candidate.teamMembership.id}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-auto rounded-full border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] text-blue-900 hover:bg-blue-100"
                              disabled={credentialBusyKey === `membership-link-${item.credential.id}-${candidate.teamMembership.id}`}
                              onClick={() => void handleLinkMembershipMatch(item.credential.id, candidate.teamMembership.id)}
                            >
                              {credentialBusyKey === `membership-link-${item.credential.id}-${candidate.teamMembership.id}` ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Link2 className="mr-1 h-3 w-3" />
                              )}
                              {candidate.teamMembership.fullName} · {candidate.score}%
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
	              </div>
	              )}

	              {showCredentialPending && (
	              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-950">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Relatório de perfis incompletos</p>
                    <p className="mt-1 text-xs text-amber-800">
                      {incompleteProfiles
                        ? `${incompleteProfiles.stats.incomplete} de ${incompleteProfiles.stats.total} perfil(is) precisam de atenção.`
                        : "A carregar estado dos perfis administrativos."}
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit border-amber-300 bg-white text-amber-800">
                    {incompleteProfiles?.stats.ready ?? 0} prontos
                  </Badge>
                </div>
                {incompleteProfileMembers.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {incompleteProfileMembers.map((member) => (
                      <div key={member.id} className="rounded-lg bg-white px-3 py-2 text-xs shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold">{member.name || "Link aberto"}</span>
                          <span>{member.status === "PROFILE_READY" ? `${member.completionScore}% completo` : member.statusLabel}</span>
                        </div>
                        <p className="mt-1 text-amber-800">
                          {member.status !== "PROFILE_READY"
                            ? "Perfil pendente de submissão."
                            : member.missingFields.length
                              ? member.missingFields.map((field) => field.label).join(", ")
                              : "Revisão administrativa pendente."}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
	              </div>
	              )}

	              {showCredentialMembers && (
	                  <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
	                    <div className="relative min-w-0 flex-1">
	                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
	                      <Input
	                        className="h-9 pl-9"
	                        value={credentialSearch}
	                        onChange={(event) => setCredentialSearch(event.target.value)}
	                        placeholder="Filtrar por nome, função ou telefone..."
	                      />
	                    </div>
	                    <select
	                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:w-56"
	                      value={teamFilter}
	                      onChange={(event) => setTeamFilter(event.target.value)}
	                    >
	                      <option value="all">Todas as equipas</option>
	                      {(credentialOverview?.teams ?? []).map((team) => (
	                        <option key={team.name} value={team.name}>{team.name} ({team.total})</option>
	                      ))}
	                    </select>
		                  </div>
	              )}

	              {showCredentialMembers && (
	              <div className="mt-4 min-w-0 space-y-3 lg:max-h-[620px] lg:overflow-y-auto lg:pr-1">
                {credentialBusyKey === "credentials-load" && !credentialOverview ? (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 py-12 text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A carregar credenciais
                  </div>
                ) : credentialMembersByTeam.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                    Nenhuma credencial encontrada.
                  </div>
	                ) : (
	                  credentialMembersByTeam.map(({ team, members }) => {
                    const groupTheme = credentialVisualThemeFor(members[0] ?? { category: "OUTRO", team }, passTemplates);
                    return (
                    <div key={team} className="min-w-0 overflow-hidden rounded-2xl border bg-white/90 shadow-sm shadow-slate-900/5" style={{ borderColor: `${groupTheme.accentColor}44` }}>
                      <div className="flex flex-col gap-2 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between" style={credentialPanelStyle(groupTheme)}>
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold" style={{ color: groupTheme.primaryColor }}>{team}</p>
                          <Badge variant="outline" className="text-xs" style={credentialChipStyle(groupTheme)}>{members.length}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-emerald-600 font-medium">
                            {members.filter((m) => m.status === "PROFILE_READY").length} pronto(s)
                          </span>
	                          {members.some((m) => m.status === "INVITED") && (
	                            <span className="text-[10px] text-amber-600 font-medium">
	                              {members.filter((m) => m.status === "INVITED").length} pendente(s)
	                            </span>
	                          )}
	                        </div>
	                      </div>
                      <div className="space-y-2 p-2">
                        {members.map((member) => {
                          const inviteUrl = credentialInviteUrl(member);
                          const profileUrl = credentialProfileUrl(member);
                          const theme = credentialVisualThemeFor(member, passTemplates);
                          return (
                            <article
                              key={member.id}
                              className="overflow-hidden rounded-2xl border border-l-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                              style={{
                                borderColor: `${theme.accentColor}33`,
                                borderLeftColor: theme.accentColor,
                                background: `linear-gradient(135deg, ${theme.lightColor}, #ffffff 42%, #ffffff)`,
                              }}
                            >
                              <div className="min-w-0 p-3 sm:p-4">
                                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-start gap-3">
                                      <div
                                        className="flex h-12 w-12 shrink-0 overflow-hidden rounded-2xl border text-sm font-black shadow-sm"
                                        style={{ borderColor: `${theme.accentColor}44`, backgroundColor: theme.lightColor, color: theme.primaryColor }}
                                      >
                                        {member.photoUrl ? (
                                          <img src={member.photoUrl} alt={member.name ?? member.role} className="h-full w-full object-cover" />
                                        ) : (
                                          (member.name || member.team || "UC").slice(0, 2).toUpperCase()
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <p className="min-w-0 max-w-full truncate text-sm font-bold text-slate-950 sm:text-base">
                                            {member.name || "Link aberto"}
                                          </p>
                                          <Badge variant="outline" className="h-6 text-[10px]" style={credentialChipStyle(theme)}>{theme.categoryLabel}</Badge>
                                          <Badge variant="outline" className={`h-6 text-[10px] ${member.status === "PROFILE_READY" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : member.status === "REVOKED" || member.status === "EXPIRED" ? "border-rose-500/30 bg-rose-500/10 text-rose-700" : "border-amber-500/30 bg-amber-500/10 text-amber-700"}`}>
                                            {member.statusLabel}
                                          </Badge>
                                          <Badge variant="outline" className="h-6 text-[10px]">v{member.version}</Badge>
                                        </div>
                                        <p className="mt-1 break-words text-xs font-medium text-slate-600">
                                          {member.team} · {member.role} · {member.accessLevel}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="mt-3 grid min-w-0 gap-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
                                      <div className="min-w-0 rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Área</p>
                                        <p className="mt-1 truncate font-semibold text-slate-800">{member.team}</p>
                                      </div>
                                      <div className="min-w-0 rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Função</p>
                                        <p className="mt-1 truncate font-semibold text-slate-800">{member.role}</p>
                                      </div>
                                      <div className="min-w-0 rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Validade</p>
                                        <p className="mt-1 truncate font-semibold text-slate-800">
                                          {member.expiresAt ? formatDate(member.expiresAt) : member.status === "INVITED" && member.invitationExpiresAt ? formatDate(member.invitationExpiresAt) : "Sem expiração"}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="mt-3 hidden min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-[11px] text-slate-500 sm:flex">
                                      <Link2 className="h-3.5 w-3.5 shrink-0" />
                                      <span className="shrink-0 font-semibold text-slate-600">Link</span>
                                      <span className="min-w-0 flex-1 truncate font-mono">{inviteUrl}</span>
                                    </div>
                                  </div>

                                  <div className="grid w-full min-w-0 grid-cols-2 gap-2 min-[430px]:grid-cols-3 2xl:w-[520px]">
                                    <Button className="h-10 w-full rounded-xl px-2 text-xs" size="sm" variant="outline" style={credentialActionStyle(theme)} onClick={() => void handleCopyCredentialLink(inviteUrl)}>
                                      <Copy className="mr-1 h-3.5 w-3.5" />
                                      Link
                                    </Button>
                                    <Button className="h-10 w-full rounded-xl px-2 text-xs" size="sm" variant="outline" style={credentialActionStyle(theme)} asChild>
                                      <a href={profileUrl} target="_blank" rel="noreferrer">
                                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                        Perfil
                                      </a>
                                    </Button>
                                    <Button
                                      className="h-10 w-full rounded-xl px-2 text-xs"
                                      size="sm"
                                      variant="outline"
                                      style={credentialActionStyle(theme)}
                                      disabled={member.status !== "PROFILE_READY"}
                                      asChild={member.status === "PROFILE_READY"}
                                    >
                                      {member.status === "PROFILE_READY" ? (
                                        <a href={api.teamCredentials.passPdfUrl(member.publicSlug, passBatchPrintOptions())} target="_blank" rel="noreferrer">
                                          <Eye className="mr-1 h-3.5 w-3.5" />
                                          Preview
                                        </a>
                                      ) : (
                                        <>
                                          <Eye className="mr-1 h-3.5 w-3.5" />
                                          Preview
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      className="h-10 w-full rounded-xl px-2 text-xs"
                                      size="sm"
                                      variant="outline"
                                      style={credentialActionStyle(theme)}
                                      disabled={credentialBusyKey === `credentials-pass-${member.id}` || member.status === "REVOKED" || member.status === "EXPIRED" || member.status === "DISABLED"}
                                      onClick={() => void handleDownloadCredentialPass(member)}
                                    >
                                      {credentialBusyKey === `credentials-pass-${member.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
                                      PDF
                                    </Button>
                                    <Button
                                      className="h-10 w-full rounded-xl px-2 text-xs"
                                      size="sm"
                                      variant="outline"
                                      style={credentialActionStyle(theme)}
                                      disabled={credentialBusyKey === `credentials-reissue-${member.id}`}
                                      onClick={() => void handleReissueCredential(member)}
                                    >
                                      {credentialBusyKey === `credentials-reissue-${member.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                                      Reemitir
                                    </Button>
                                    <Button
                                      className="h-10 w-full rounded-xl px-2 text-xs"
                                      size="sm"
                                      variant="outline"
                                      style={credentialActionStyle(theme)}
                                      disabled={credentialBusyKey === `credentials-revoke-${member.id}` || member.status === "REVOKED" || member.status === "DISABLED"}
                                      onClick={() => void handleRevokeCredential(member)}
                                    >
                                      {credentialBusyKey === `credentials-revoke-${member.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Unlock className="mr-1 h-3.5 w-3.5" />}
                                      Revogar
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })
                )}
	              </div>
	              )}
	            </div>
	          </div>
	          )}
	        </CardContent>
      </Card>}

      {scope === "security" && <div className="space-y-5">
        <section className="uor-vital-panel uor-animated-entry p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-800 shadow-sm">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                Direção e Segurança
              </Badge>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Acessos administrativos com controlo claro</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
                Número de estudante, equipa oficial e permissões ficam ligados numa visão única para proteger a operação.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                <p className="text-lg font-bold">{authorizedAdminStudents.length}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Autorizados</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                <p className="text-lg font-bold">{adminAccessConflicts.length}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">A rever</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  LEFT: Access management                                      */}
        {/* ============================================================ */}
        <div className="space-y-5">
          {/* New access form */}
          <Card className="uor-vital-card border-border/50">
            <CardHeader className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Novo acesso administrativo
              </CardTitle>
              <p className="text-xs text-muted-foreground">Define a equipa, o perfil e os módulos que este utilizador pode gerir.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {teamProfilePresets.length > 0 && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Perfis padrão por área</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {teamProfilePresets.map((preset) => (
                      <Button
                        key={preset.key}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="uor-chip-button border-emerald-200 bg-white px-3 text-xs text-emerald-800 hover:bg-emerald-50"
                        onClick={() => applyAccessProfilePreset(preset)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Número de estudante">
                  <Input
                    value={authorizedStudentNumber}
                    onChange={(e) => onAuthorizedStudentNumberChange(normalizeStudentNumberInput(e.target.value))}
                    placeholder="Até 12 dígitos"
                    inputMode="numeric"
                    maxLength={12}
                    className="h-11 rounded-xl border-slate-200 font-mono focus-visible:ring-emerald-500"
                  />
                </FormField>
                <FormField label="Equipa">
                  <Input
                    value={accessForm.team}
                    onChange={(e) => onAccessFormChange((c) => ({ ...c, team: e.target.value }))}
                    className="h-11 rounded-xl border-slate-200 focus-visible:ring-emerald-500"
                    placeholder="Ex: Credenciamento"
                  />
                </FormField>
                <FormField label="Perfil de acesso">
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-background px-3 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={accessForm.role}
                    onChange={(e) => {
                      const role = e.target.value as AdminAccessForm["role"];
                      onAccessFormChange((c) => ({
                        ...c,
                        role,
                        permissions: role === "SUPER_ADMIN" ? c.permissions : c.permissions.length ? c.permissions : ["OVERVIEW"],
                      }));
                    }}
                  >
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="TEAM_LEAD">Líder de Equipa</option>
                    <option value="MEMBER">Membro</option>
                  </select>
                </FormField>
                <div className="flex items-end">
                  <Button
                    className="uor-action-button h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={onAuthorizeAdminStudent}
                    disabled={busyKey === "security-authorize" || !authorizedStudentNumber}
                  >
                    {busyKey === "security-authorize" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Autorizar acesso
                  </Button>
                </div>
              </div>

              {/* Permission grid by category */}
              <div className="space-y-3 rounded-xl border border-cyan-100 bg-cyan-50/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Áreas permitidas</p>
                  {accessForm.role === "SUPER_ADMIN" && (
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300">
                      <Crown className="mr-1 h-3 w-3" />
                      Acesso total
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {selectedPermissions.length}/{allPermissionValues.length} selecionadas
                  </span>
                </div>

                {permissionCategories.map((category) => {
                  const catSelected = category.permissions.filter((p) => selectedPermissions.includes(p.value)).length;
                  const catTotal = category.permissions.length;
                  return (
                    <div key={category.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => {
                            if (accessForm.role !== "SUPER_ADMIN") toggleCategory(category);
                          }}
                          disabled={accessForm.role === "SUPER_ADMIN"}
                        >
                          <category.icon className="h-3.5 w-3.5" />
                          {category.label}
                        </button>
                        <span className="text-[10px] text-muted-foreground/60">{catSelected}/{catTotal}</span>
                      </div>
                      <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                        {category.permissions.map((perm) => {
                          const isSelected = selectedPermissions.includes(perm.value);
                          return (
                            <label
                              key={perm.value}
                              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all ${
                                isSelected
                                  ? "border-emerald-500/30 bg-white text-emerald-950 shadow-sm"
                                  : "border-border/50 bg-white/80 text-muted-foreground hover:border-cyan-200 hover:bg-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={isSelected}
                                disabled={accessForm.role === "SUPER_ADMIN"}
                                onChange={(e) => updatePermission(perm.value, e.target.checked)}
                              />
                              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                isSelected ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"
                              }`}>
                                {isSelected && <CheckCircle2 className="h-3 w-3" />}
                              </div>
                              <perm.icon className="h-3 w-3 shrink-0" />
                              {perm.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {adminAccessConflicts.length > 0 && (
            <Card className="uor-vital-card border-amber-200 bg-gradient-to-br from-amber-50 to-white">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-amber-950">
                  <Lock className="h-4 w-4 text-amber-700" />
                  Revisão de acessos
                  <Badge variant="outline" className="border-amber-300 bg-white text-xs text-amber-800">
                    {adminAccessConflicts.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {adminAccessConflicts.slice(0, 6).map((conflict) => (
                  <div key={`${conflict.studentNumber}-${conflict.issue}`} className="uor-vital-card rounded-lg border border-amber-200 bg-white px-3 py-2.5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-sm font-semibold text-slate-900">{conflict.studentNumber}</span>
                          <Badge variant={conflict.accessBlocked ? "destructive" : "outline"} className="text-[10px]">
                            {adminAccessConflictLabel(conflict.issue)}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {adminAccessSourceLabel(conflict.effectiveSource)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {conflict.memberships.length > 0
                            ? conflict.memberships.map((membership) => `${membership.fullName} · ${membership.team} · ${membership.status}`).join(" | ")
                            : "Sem registo ativo em TeamMembership."}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-amber-800">
                        {conflict.severity === "HIGH" ? "Alta prioridade" : "Rever"}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Authorized admins list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Administradores autorizados
                <Badge variant="secondary" className="text-xs">{authorizedAdminStudents.length}</Badge>
              </h3>
            </div>

            {authorizedAdminStudents.length === 0 ? (
              <Card className="uor-vital-card border-dashed border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="uor-icon-tile mb-3 h-14 w-14 rounded-full border-slate-200 bg-slate-50">
                    <Unlock className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhum administrador autorizado</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">Utiliza o formulário acima para autorizar o primeiro acesso.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {authorizedAdminStudents.map((student) => (
                  <AuthorizedAdminCard
                    key={student.id}
                    student={student}
                    busyKey={busyKey}
                    onRevoke={onRevokeAdminStudent}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>}
    </div>
  );
}

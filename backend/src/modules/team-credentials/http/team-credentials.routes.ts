import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { renderQrDataUri } from "../../../shared/qr";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, getAdminProfileByStudentNumber, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { escapeHtml, loadLogoDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";
import { recordAdminAudit } from "../../audit/application/audit.service";
import { ALL_ADMIN_PERMISSIONS, isDefaultAdminStudentNumber } from "../../auth/domain/admin-authorized-students";
import { profileCompletion } from "../../profile/application/profile-completion.service";
import {
  hasSocialProfileFields,
  upsertStudentProfileExtra,
} from "../../profile/application/profile-extra.service";
import { isProfileFieldVisible } from "../../profile/application/profile-visibility.service";
import { persistMediaValue } from "../../media/application/media-storage";
import { isPaymentConfirmedByAdmin } from "../../payments/payment-status";
import { buildSubmissionSlug } from "../../submission/domain/submission-format";
import { buildValidationUrl } from "../../validation/application/validation-links";
import {
  credentialStatusLabel,
  isCredentialOperationallyUsable,
  isCredentialPubliclyValid,
  normalizeCredentialStatus,
} from "../../credentials/application/credential-policy";
import {
  applyOfficialMembershipToNucleusBatchCredential,
  isOfficialNucleusBatchCredential,
} from "../application/credential-print-batch-policy";

const DEFAULT_PUBLIC_APP_URL = "http://localhost:5173";

const memberCategories = [
  "NUCLEO",
  "EXPOSITOR",
  "JURI",
  "PALESTRANTE",
  "MESTRE_CERIMONIA",
  "PROTOCOLO",
  "MARKETING",
  "LOGISTICA",
  "RELACOES_INTERNAS",
  "RELACOES_EXTERNAS",
  "EXPLICADORES",
  "STAFF",
  "CONVIDADO",
  "OUTRO",
] as const;

export type EventTeamCredentialRecord = {
  id: number;
  teamMembershipId: number | null;
  token: string;
  publicSlug: string;
  category: string;
  team: string;
  role: string;
  accessLevel: string;
  permissions: string;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  course: string | null;
  organization: string | null;
  bio: string | null;
  photoUrl: string | null;
  address: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  consentPhotoCredential: boolean;
  consentPublicProfile: boolean;
  consentSocialLinks: boolean;
  consentSms: boolean;
  consentWhatsapp: boolean;
  sourceSubmissionId: number | null;
  sourceSubmissionRef: string | null;
  sourceSubmissionName: string | null;
  sourceSubmissionType: string | null;
  sourceSubmissionArea: string | null;
  notes: string | null;
  createdByStudentNumber: string | null;
  issuedAt: Date | null;
  issuedByStudentNumber: string | null;
  issuedSnapshotJson: string | null;
  invitationExpiresAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  version: number;
  reissuedFromId: number | null;
  submittedAt: Date | null;
  lastPassIssuedAt: Date | null;
  lastPassSnapshotJson: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TeamMembershipRecord = {
  id: number;
  studentNumber: string | null;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  category: string;
  team: string;
  role: string;
  accessLevel: string;
  permissions: string;
  status: string;
  version: number;
  mandateLabel: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  source: string;
  notes: string | null;
  createdByStudentNumber: string | null;
  verifiedAt: Date | null;
  verifiedByStudentNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TeamMembershipClaimRecord = {
  id: number;
  studentId: number | null;
  studentNumber: string;
  officialName: string | null;
  officialEmail: string | null;
  officialCourse: string | null;
  officialPhone: string | null;
  requestedCategory: string;
  requestedTeam: string;
  requestedRole: string;
  requestedAccessLevel: string;
  requestedPermissions: string;
  status: string;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  course: string | null;
  organization: string | null;
  bio: string | null;
  address: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  consentPhotoCredential: boolean;
  consentPublicProfile: boolean;
  consentSocialLinks: boolean;
  consentSms: boolean;
  consentWhatsapp: boolean;
  sourceToken: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  reviewedByStudentNumber: string | null;
  teamMembershipId: number | null;
  credentialId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

const teamMembershipStatuses = ["ACTIVE", "SUSPENDED", "REMOVED", "ALUMNI"] as const;
const teamMembershipClaimStatuses = ["PENDING_REVIEW", "APPROVED", "REJECTED", "CANCELED"] as const;
const credentialStatuses = ["DRAFT", "INVITED", "ISSUED", "PROFILE_READY", "ACTIVE", "REVOKED", "DISABLED"] as const;
const credentialPassPrintModes = ["color", "black-white"] as const;
const credentialPassSides = ["front", "back", "both"] as const;
const credentialPassLayouts = ["single", "a4-4up"] as const;
const credentialPassDuplexModes = ["long-edge", "short-edge", "same-position"] as const;
const credentialInvitationTtlDays = 14;
const nucleusBaseAdminPermissions = ["OVERVIEW", "TASKS", "NUCLEUS", "CREDENTIALS"] as const;
const nucleusFullAdminPermissions = [...ALL_ADMIN_PERMISSIONS];
const cr80CardWidthMm = 53.98;
const cr80CardHeightMm = 85.6;
const passDesignWidthMm = 90;
const passDesignHeightMm = 140;

type NucleusFunctionDefinition = {
  key: string;
  label: string;
  accessLevel: string;
  description: string;
  permissions: readonly string[];
  includeAreaPermissions: boolean;
};

type NucleusAreaDefinition = {
  key: string;
  label: string;
  team: string;
  description: string;
  permissions: readonly string[];
  functions: readonly NucleusFunctionDefinition[];
};

function nucleusFunction(
  key: string,
  label: string,
  accessLevel: string,
  description: string,
  permissions: readonly string[] = [],
  includeAreaPermissions = true,
): NucleusFunctionDefinition {
  return { key, label, accessLevel, description, permissions, includeAreaPermissions };
}

const nucleusAreaOptions: readonly NucleusAreaDefinition[] = [
  {
    key: "PRESIDENCIA_GOVERNANCA",
    label: "Presidência e Governança",
    team: "Presidência e Governança",
    description: "Representação institucional, estratégia, mandato, prestação de contas e supervisão geral.",
    permissions: ["OVERVIEW", "ANALYTICS", "SECURITY", "AUDIT", "DATA_EXPORT", "NUCLEUS", "CREDENTIALS", "TASKS", "SMS"],
    functions: [
      nucleusFunction("PRESIDENTE_ORGANIZACAO", "Presidente da Organização", "Direção executiva", "Representa e coordena a organização, com decisão transversal."),
      nucleusFunction("VICE_PRESIDENTE", "Vice-Presidente", "Direção executiva", "Apoia a presidência e assume coordenação transversal quando necessário."),
    ],
  },
  {
    key: "SECRETARIA_GERAL",
    label: "Secretaria Geral",
    team: "Secretaria Geral",
    description: "Atas, arquivo, expediente, cadastro interno, comunicações formais e apoio administrativo.",
    permissions: ["OVERVIEW", "TASKS", "NUCLEUS", "CREDENTIALS", "STUDENTS", "DATA_EXPORT", "AUDIT", "SMS"],
    functions: [
      nucleusFunction("SECRETARIO_GERAL", "Secretário-Geral", "Secretaria executiva", "Gere expediente, atas, arquivo e cadastros oficiais do Núcleo."),
    ],
  },
  {
    key: "TESOURARIA_PATRIMONIO",
    label: "Tesouraria e Património",
    team: "Tesouraria e Património",
    description: "Orçamento, patrocínios, recursos, inventário, pagamentos e controlo financeiro.",
    permissions: ["OVERVIEW", "TASKS", "NUCLEUS", "SUBMISSIONS", "COURSES", "DATA_EXPORT", "AUDIT"],
    functions: [
      nucleusFunction("TESOUREIRO", "Tesoureiro", "Gestão financeira", "Controla receitas, despesas, prestação de contas e património."),
      nucleusFunction("ASSISTENTE_FINANCEIRO", "Assistente Financeiro", "Assistência financeira", "Apoia registos financeiros, comprovativos e organização documental."),
      nucleusFunction("AUDITOR_INTERNO", "Auditor Interno", "Controlo interno", "Revê procedimentos financeiros e ajuda a manter rastreabilidade."),
      nucleusFunction("COORDENADOR_ORCAMENTO", "Coordenador de Orçamento", "Coordenação financeira", "Planeia orçamento, recursos e necessidades por atividade."),
    ],
  },
  {
    key: "ACADEMICA_FORMACAO",
    label: "Assuntos Académicos e Formação",
    team: "Assuntos Académicos e Formação",
    description: "Apoio académico, workshops, cursos, certificados, mentoria e acompanhamento estudantil.",
    permissions: ["OVERVIEW", "TASKS", "COURSES", "CERTIFICATES", "STUDENTS", "GUIDE", "FAQ", "SMS"],
    functions: [
      nucleusFunction("DIRETOR_ACADEMICO", "Diretor Académico", "Direção académica", "Define e acompanha a estratégia académica e formativa."),
      nucleusFunction("COORDENADOR_PEDAGOGICO", "Coordenador Pedagógico", "Coordenação pedagógica", "Organiza métodos, calendário e acompanhamento pedagógico."),
      nucleusFunction("COORDENADOR_FORMACAO", "Coordenador de Formação", "Coordenação formativa", "Planeia formações, oficinas e trilhas de aprendizagem."),
      nucleusFunction("SUPERVISOR_ACADEMICO", "Supervisor Académico", "Supervisão académica", "Acompanha qualidade, presença e progresso académico."),
      nucleusFunction("RESPONSAVEL_CERTIFICACAO", "Responsável por Certificação", "Certificação", "Controla emissão, validação e organização de certificados."),
      nucleusFunction("GESTOR_CURSOS", "Gestor de Cursos", "Gestão de cursos", "Gere cursos, inscrições e comunicação com participantes."),
      nucleusFunction("ASSISTENTE_ACADEMICO", "Assistente Académico", "Assistência académica", "Apoia estudantes, formadores e registos académicos."),
      nucleusFunction("COORDENADOR_WORKSHOPS", "Coordenador de Workshops", "Coordenação de workshops", "Planeia workshops, materiais e logística pedagógica."),
      nucleusFunction("RESPONSAVEL_AVALIACAO", "Responsável por Avaliação", "Avaliação", "Organiza critérios, avaliações e relatórios de desempenho."),
      nucleusFunction("MENTOR_FORMADOR", "Mentor/Formador", "Mentoria e formação", "Ministra formações e acompanha estudantes em atividades práticas."),
    ],
  },
  {
    key: "TECNOLOGIA_DADOS",
    label: "Tecnologia, Sistemas e Dados",
    team: "Tecnologia, Sistemas e Dados",
    description: "Plataforma, suporte técnico, QR, check-in, dados operacionais e ferramentas digitais.",
    permissions: ["OVERVIEW", "ANALYTICS", "SECURITY", "AUDIT", "DATA_EXPORT", "NUCLEUS", "CREDENTIALS", "TASKS", "ATTENDANCE", "LIVE", "EVENTO"],
    functions: [
      nucleusFunction("DIRETOR_TECNOLOGIA", "Diretor de Tecnologia", "Direção tecnológica", "Coordena sistemas, dados, segurança e evolução digital."),
      nucleusFunction("DESENVOLVEDOR_FULL_STACK", "Desenvolvedor Full Stack", "Desenvolvimento", "Implementa frontend, backend e integrações da plataforma."),
      nucleusFunction("DESENVOLVEDOR_FRONTEND", "Desenvolvedor Frontend", "Frontend", "Cuida da interface, usabilidade e experiência visual."),
      nucleusFunction("DESENVOLVEDOR_BACKEND", "Desenvolvedor Backend", "Backend", "Cuida de APIs, dados, regras de negócio e integrações."),
      nucleusFunction("ADMINISTRADOR_SISTEMAS", "Administrador de Sistemas", "Administração de sistemas", "Acompanha infraestrutura, disponibilidade e ambiente de produção."),
      nucleusFunction("ANALISTA_DADOS", "Analista de Dados", "Dados", "Analisa métricas, relatórios e suporte à decisão."),
      nucleusFunction("GESTOR_BASE_DADOS", "Gestor de Base de Dados", "Base de dados", "Organiza integridade, consultas e estrutura de dados."),
      nucleusFunction("TECNICO_REDES", "Técnico de Redes", "Redes", "Apoia rede, conectividade e operação técnica local."),
      nucleusFunction("ESPECIALISTA_SEGURANCA", "Especialista em Segurança", "Segurança", "Acompanha riscos, acessos, auditoria e proteção dos sistemas."),
      nucleusFunction("TECNICO_SUPORTE", "Técnico de Suporte", "Suporte técnico", "Apoia utilizadores, dispositivos e resolução de incidentes."),
      nucleusFunction("DESIGNER_UI_UX", "Designer UI/UX", "Produto digital", "Desenha fluxos, interfaces e padrões de experiência."),
      nucleusFunction("GESTOR_PRODUTO_DIGITAL", "Gestor de Produto Digital", "Gestão de produto", "Prioriza funcionalidades, experiência e evolução do produto."),
    ],
  },
  {
    key: "COMUNICACAO_MEDIA",
    label: "Comunicação, Imagem e Media",
    team: "Comunicação, Imagem e Media",
    description: "Identidade visual, conteúdo, cobertura, redes sociais, notícias e comunicação pública.",
    permissions: ["OVERVIEW", "ANALYTICS", "TASKS", "GUIDE", "FAQ", "LIVE", "PANELS", "SPEAKERS", "SMS"],
    functions: [
      nucleusFunction("DIRETOR_COMUNICACAO", "Diretor de Comunicação", "Direção de comunicação", "Coordena comunicação institucional, imagem e narrativa pública."),
      nucleusFunction("GESTOR_MARKETING", "Gestor de Marketing", "Marketing", "Planeia campanhas, divulgação e presença digital."),
      nucleusFunction("DESIGNER_GRAFICO", "Designer Gráfico", "Design gráfico", "Produz peças visuais, identidade e materiais de comunicação."),
      nucleusFunction("VIDEOGRAFO", "Videógrafo", "Produção audiovisual", "Capta vídeos, entrevistas e cobertura de atividades."),
      nucleusFunction("EDITOR_VIDEO", "Editor de Vídeo", "Edição audiovisual", "Edita vídeos, cortes e conteúdos para publicação."),
    ],
  },
  {
    key: "EVENTOS_PROJETOS",
    label: "Eventos, Projetos e Inovação",
    team: "Eventos, Projetos e Inovação",
    description: "Planeamento de eventos, projetos técnicos, hackathons, exposições e atividades práticas.",
    permissions: ["OVERVIEW", "TASKS", "EVENTO", "SCHEDULE", "SUBMISSIONS", "PANELS", "VOTES", "WINNERS", "ATTENDANCE", "CREDENTIALS", "SMS"],
    functions: [
      nucleusFunction("DIRETOR_EVENTOS", "Diretor de Eventos", "Direção de eventos", "Coordena planeamento, execução e avaliação dos eventos."),
      nucleusFunction("COORDENADOR_PROJETOS", "Coordenador de Projetos", "Coordenação de projetos", "Acompanha projetos, equipas e entregas."),
      nucleusFunction("GESTOR_INOVACAO", "Gestor de Inovação", "Inovação", "Promove ideias, desafios, protótipos e melhoria contínua."),
      nucleusFunction("PRODUTOR_EXECUTIVO", "Produtor Executivo", "Produção executiva", "Garante execução operacional do evento e recursos necessários."),
      nucleusFunction("COORDENADOR_OPERACIONAL", "Coordenador Operacional", "Coordenação operacional", "Organiza fluxo de atividades, equipas e operação no terreno."),
      nucleusFunction("SUPERVISOR_ATIVIDADES", "Supervisor de Atividades", "Supervisão de atividades", "Acompanha execução, horários e qualidade das atividades."),
      nucleusFunction("RESPONSAVEL_PROGRAMACAO", "Responsável por Programação", "Programação", "Organiza agenda, painéis e sequência de atividades."),
      nucleusFunction("GESTOR_EXPOSITORES", "Gestor de Expositores", "Expositores", "Acompanha candidaturas, expositores, stands e comunicação operacional."),
      nucleusFunction("COORDENADOR_COMPETICOES", "Coordenador de Competições", "Competições", "Organiza júri, regras, votação e resultados."),
      nucleusFunction("ASSISTENTE_EVENTOS", "Assistente de Eventos", "Assistência de eventos", "Apoia preparação, checklists e execução de eventos."),
      nucleusFunction("CURADOR_CONTEUDO", "Curador de Conteúdo", "Curadoria", "Seleciona temas, conteúdos, convidados e experiências do evento."),
    ],
  },
  {
    key: "RELACOES_INSTITUCIONAIS",
    label: "Relações Institucionais",
    team: "Relações Institucionais",
    description: "Universidade, empresas, convidados, parcerias, patrocínios e representação externa.",
    permissions: ["OVERVIEW", "TASKS", "SPEAKERS", "PANELS", "SCHEDULE", "SUBMISSIONS", "SMS"],
    functions: [
      nucleusFunction("DIRETOR_RELACOES_INSTITUCIONAIS", "Diretor de Relações Institucionais", "Direção institucional", "Coordena representação, parcerias e relações estratégicas."),
      nucleusFunction("ASSISTENTE_RELACOES_INTERNAS", "Assistente de Relações Internas", "Relações internas", "Apoia articulação com estudantes, áreas internas e universidade."),
      nucleusFunction("GESTOR_PARCERIAS", "Gestor de Parcerias", "Parcerias", "Acompanha contactos, propostas e benefícios com parceiros."),
      nucleusFunction("COORDENADOR_PATROCINIOS", "Coordenador de Patrocínios", "Patrocínios", "Organiza captação, negociação e acompanhamento de patrocínios."),
      nucleusFunction("ASSISTENTE_RELACOES_EXTERNAS", "Assistente de Relações Externas", "Relações externas", "Apoia contacto com convidados, empresas e entidades externas."),
    ],
  },
  {
    key: "LOGISTICA",
    label: "Logística",
    team: "Logística",
    description: "Materiais, salas, equipamentos, montagem, transportes internos e recursos físicos.",
    permissions: ["TASKS", "EVENTO", "SCHEDULE", "ATTENDANCE", "CREDENTIALS"],
    functions: [
      nucleusFunction("COORDENADOR_LOGISTICA", "Coordenador de Logística", "Coordenação logística", "Coordena materiais, espaços, montagem e necessidades operacionais."),
      nucleusFunction("ADJUNTO_LOGISTICA", "Adjunto de Logística", "Adjunto logístico", "Apoia coordenação logística e assume tarefas operacionais."),
      nucleusFunction("RESPONSAVEL_MATERIAIS", "Responsável por Materiais", "Materiais", "Controla inventário, entrega, recolha e conservação de materiais."),
    ],
  },
  {
    key: "PROTOCOLO",
    label: "Protocolo",
    team: "Protocolo",
    description: "Acolhimento, sala, backoffice, apoio ao público, moderação e fluxo de participantes.",
    permissions: ["TASKS", "EVENTO", "SCHEDULE", "ATTENDANCE", "CREDENTIALS", "SPEAKERS", "PANELS"],
    functions: [
      nucleusFunction("COORDENADOR_PROTOCOLO", "Coordenador de Protocolo", "Coordenação de protocolo", "Coordena acolhimento, fluxo de convidados e protocolo institucional."),
      nucleusFunction("ADJUNTO_PROTOCOLO", "Adjunto de Protocolo", "Adjunto de protocolo", "Apoia o coordenador e acompanha equipas de sala."),
      nucleusFunction("SUPERVISOR_OPERACIONAL", "Supervisor Operacional", "Supervisão operacional", "Acompanha execução, equipas, filas e resolução rápida de ocorrências."),
      nucleusFunction("APOIO_PUBLICO", "Apoio ao Público", "Atendimento", "Orienta participantes, estudantes, convidados e visitantes."),
      nucleusFunction("MODERADOR_SALA", "Moderador de Sala", "Moderação de sala", "Apoia sessões, apresentações, tempo e organização de sala."),
      nucleusFunction("ASSISTENTE_BACKOFFICE", "Assistente de Backoffice", "Backoffice", "Apoia registos, listas, materiais e operações internas."),
      nucleusFunction("OPERADOR_HELP_DESK", "Operador de Help Desk", "Help desk", "Apoia dúvidas, check-in, orientação e incidentes simples."),
    ],
  },
  {
    key: "APOIO_OPERACIONAL",
    label: "Apoio Operacional",
    team: "Apoio Operacional",
    description: "Apoio transversal em atividades pontuais, equipas temporárias e execução de tarefas.",
    permissions: ["TASKS", "EVENTO", "ATTENDANCE", "CREDENTIALS"],
    functions: [
      nucleusFunction("ASSISTENTE_GERAL", "Assistente Geral", "Assistência geral", "Apoia tarefas gerais e necessidades pontuais do Núcleo."),
      nucleusFunction("APOIO_TECNICO", "Apoio Técnico", "Apoio técnico", "Apoia equipamento, organização técnica e suporte simples."),
      nucleusFunction("AUXILIAR_OPERACIONAL", "Auxiliar Operacional", "Operação", "Executa tarefas operacionais e apoio direto no terreno."),
      nucleusFunction("VOLUNTARIO_OPERACIONAL", "Voluntário Operacional", "Voluntariado", "Apoia atividades pontuais sob orientação da coordenação."),
    ],
  },
] as const;

const nucleusFunctionOptions = nucleusAreaOptions.flatMap((area) => (
  area.functions.map((fn) => ({ ...fn, areaKey: area.key, team: area.team }))
));

type NucleusPossessionStudent = {
  studentNumber?: string | null;
  academicSyncedAt?: Date | string | null;
  registrationSource?: string | null;
};

export function isStudentEligibleForNucleusPossession<T extends NucleusPossessionStudent>(
  student: T | null | undefined,
): student is T {
  if (!student) return false;
  const studentNumber = student.studentNumber?.trim() ?? "";
  if (studentNumber && isDefaultAdminStudentNumber(studentNumber)) return true;
  return Boolean(student.academicSyncedAt || student.registrationSource === "SECRETARIA");
}

const credentialPassOptionsQuerySchema = z.object({
  printMode: z.enum(credentialPassPrintModes).optional().default("color"),
  side: z.enum(credentialPassSides).optional().default("both"),
  layout: z.enum(credentialPassLayouts).optional().default("single"),
  duplexMode: z.enum(credentialPassDuplexModes).optional().default("long-edge"),
  marginMm: z.coerce.number().min(6).max(30).optional().default(18),
  bleedMm: z.coerce.number().min(0).max(10).optional().default(4),
  laminationMarginMm: z.coerce.number().min(0).max(8).optional().default(3),
});

const queryBooleanSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["1", "true", "sim", "yes", "on"].includes(value.trim().toLowerCase());
  }
  return value;
}, z.boolean());

const adminPassBatchQuerySchema = credentialPassOptionsQuerySchema.extend({
  ids: z.string().trim().optional(),
  category: z.enum(memberCategories).optional(),
  team: z.string().trim().min(1).max(120).optional(),
  includePending: queryBooleanSchema.optional().default(false),
  calibration: queryBooleanSchema.optional().default(false),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(200),
});

export type CredentialPassOptions = z.infer<typeof credentialPassOptionsQuerySchema>;

const memberInputSchema = z.object({
  teamMembershipId: z.coerce.number().int().positive().optional().nullable(),
  category: z.enum(memberCategories).default("NUCLEO"),
  team: z.string().min(2).max(90).default("Núcleo"),
  role: z.string().min(2).max(90).default("Membro"),
  accessLevel: z.string().min(2).max(90).default("Membro"),
  permissions: z.array(z.string().min(1).max(40)).default([]),
  name: z.string().max(140).optional().nullable(),
  email: z.string().max(160).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  course: z.string().max(160).optional().nullable(),
  organization: z.string().max(160).optional().nullable(),
  bio: z.string().max(800).optional().nullable(),
  photoUrl: z.string().max(7_000_000).optional().nullable(),
  address: z.string().max(240).optional().nullable(),
  instagramUrl: z.string().max(240).optional().nullable(),
  facebookUrl: z.string().max(240).optional().nullable(),
  linkedinUrl: z.string().max(240).optional().nullable(),
  githubUrl: z.string().max(240).optional().nullable(),
  websiteUrl: z.string().max(240).optional().nullable(),
  consentPhotoCredential: z.boolean().optional(),
  consentPublicProfile: z.boolean().optional(),
  consentSocialLinks: z.boolean().optional(),
  consentSms: z.boolean().optional(),
  consentWhatsapp: z.boolean().optional(),
  notes: z.string().max(800).optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
});

const teamMembershipInputSchema = z.object({
  studentNumber: z.string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 0 || (value.length >= 8 && value.length <= 12), "Número de estudante inválido.")
    .optional()
    .nullable(),
  fullName: z.string().trim().min(2).max(140),
  category: z.enum(memberCategories).default("NUCLEO"),
  team: z.string().trim().min(2).max(90).default("Núcleo"),
  role: z.string().trim().min(2).max(90).default("Membro"),
  accessLevel: z.string().trim().min(2).max(90).default("Membro"),
  permissions: z.array(z.string().min(1).max(40)).default([]),
  status: z.enum(teamMembershipStatuses).default("ACTIVE"),
  mandateLabel: z.string().max(120).optional().nullable(),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  source: z.string().trim().min(2).max(60).default("MANUAL"),
  notes: z.string().max(800).optional().nullable(),
});

const credentialRevocationSchema = z.object({
  reason: z.string().trim().max(240).optional().nullable(),
});

const credentialReissueSchema = z.object({
  expiresAt: z.coerce.date().optional().nullable(),
});

const hexColorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/);

const credentialPrintTemplateInputSchema = z.object({
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  lightColor: hexColorSchema,
  footerLabel: z.string().trim().min(2).max(80).optional().nullable(),
});

const credentialPrintTemplateResponseSchema = z.object({
  category: z.string(),
  categoryLabel: z.string(),
  primaryColor: z.string(),
  accentColor: z.string(),
  lightColor: z.string(),
  footerLabel: z.string(),
  isCustomized: z.boolean(),
  updatedAt: z.string().nullable(),
  updatedByStudentNumber: z.string().nullable(),
});

const publicSubmissionSchema = z.object({
  name: z.string().min(2).max(140),
  email: z.string().max(160).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  course: z.string().max(160).optional().nullable(),
  organization: z.string().max(160).optional().nullable(),
  bio: z.string().max(800).optional().nullable(),
  photoUrl: z.string().max(7_000_000).optional().nullable(),
  address: z.string().max(240).optional().nullable(),
  instagramUrl: z.string().max(240).optional().nullable(),
  facebookUrl: z.string().max(240).optional().nullable(),
  linkedinUrl: z.string().max(240).optional().nullable(),
  githubUrl: z.string().max(240).optional().nullable(),
  websiteUrl: z.string().max(240).optional().nullable(),
  consentPhotoCredential: z.boolean().optional(),
  consentPublicProfile: z.boolean().optional(),
  consentSocialLinks: z.boolean().optional(),
  consentSms: z.boolean().optional(),
  consentWhatsapp: z.boolean().optional(),
});

const nucleusClaimRequestSchema = publicSubmissionSchema.extend({
  areaKey: z.string().trim().min(2).max(80),
  functionKey: z.string().trim().min(2).max(80),
});

const nucleusClaimReviewSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
  category: z.enum(memberCategories).optional(),
  team: z.string().trim().min(2).max(90).optional(),
  role: z.string().trim().min(2).max(90).optional(),
  accessLevel: z.string().trim().min(2).max(90).optional(),
  permissions: z.array(z.string().min(1).max(40)).optional(),
});

const memberResponseSchema = z.object({
  id: z.number(),
  teamMembershipId: z.number().nullable(),
  token: z.string(),
  publicSlug: z.string(),
  category: z.string(),
  categoryLabel: z.string(),
  team: z.string(),
  role: z.string(),
  accessLevel: z.string(),
  permissions: z.array(z.string()),
  status: z.string(),
  statusLabel: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  course: z.string().nullable(),
  organization: z.string().nullable(),
  bio: z.string().nullable(),
  photoUrl: z.string().nullable(),
  address: z.string().nullable(),
  instagramUrl: z.string().nullable(),
  facebookUrl: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  consentPhotoCredential: z.boolean(),
  consentPublicProfile: z.boolean(),
  consentSocialLinks: z.boolean(),
  consentSms: z.boolean(),
  consentWhatsapp: z.boolean(),
  sourceSubmissionId: z.number().nullable(),
  sourceSubmissionRef: z.string().nullable(),
  sourceSubmissionName: z.string().nullable(),
  sourceSubmissionType: z.string().nullable(),
  sourceSubmissionArea: z.string().nullable(),
  notes: z.string().nullable(),
  createdByStudentNumber: z.string().nullable(),
  issuedAt: z.string().nullable(),
  issuedByStudentNumber: z.string().nullable(),
  hasIssuedSnapshot: z.boolean(),
  invitationExpiresAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  revokedReason: z.string().nullable(),
  version: z.number(),
  reissuedFromId: z.number().nullable(),
  inviteUrl: z.string(),
  profileUrl: z.string(),
  passPdfPath: z.string(),
  passPdfUrl: z.string().nullable(),
  submittedAt: z.string().nullable(),
  lastPassIssuedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const printBatchModeSchema = z.enum(["NOMINAL", "GENERIC", "MIXED"]);

const printBatchNominalItemSchema = z.object({
  name: z.string().trim().min(2).max(140),
  category: z.enum(memberCategories).default("CONVIDADO"),
  team: z.string().trim().min(2).max(90).default("Convidados"),
  role: z.string().trim().min(2).max(90).default("Convidado"),
  accessLevel: z.string().trim().min(2).max(90).default("Visitante"),
  permissions: z.array(z.string().min(1).max(40)).default([]),
  email: z.string().max(160).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  course: z.string().max(160).optional().nullable(),
  organization: z.string().max(160).optional().nullable(),
  bio: z.string().max(800).optional().nullable(),
  photoUrl: z.string().max(7_000_000).optional().nullable(),
  address: z.string().max(240).optional().nullable(),
  instagramUrl: z.string().max(240).optional().nullable(),
  facebookUrl: z.string().max(240).optional().nullable(),
  linkedinUrl: z.string().max(240).optional().nullable(),
  githubUrl: z.string().max(240).optional().nullable(),
  websiteUrl: z.string().max(240).optional().nullable(),
  notes: z.string().max(800).optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
});

const printBatchGenericItemSchema = z.object({
  category: z.enum(memberCategories).default("STAFF"),
  team: z.string().trim().min(2).max(90).default("Staff"),
  role: z.string().trim().min(2).max(90).default("Apoio Geral"),
  accessLevel: z.string().trim().min(2).max(90).default("Staff"),
  permissions: z.array(z.string().min(1).max(40)).default([]),
  prefix: z.string().trim().min(2).max(60).default("Staff"),
  quantity: z.coerce.number().int().min(1).max(80),
  startNumber: z.coerce.number().int().min(1).max(9999).default(1),
  organization: z.string().max(160).optional().nullable(),
  notes: z.string().max(800).optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
});

const printBatchCreateSchema = z.object({
  title: z.string().trim().min(2).max(120).default("Lote de passes"),
  notes: z.string().trim().max(800).optional().nullable(),
  nominalItems: z.array(printBatchNominalItemSchema).max(80).default([]),
  genericItems: z.array(printBatchGenericItemSchema).max(20).default([]),
});

const printBatchItemResponseSchema = z.object({
  id: z.number(),
  position: z.number(),
  label: z.string().nullable(),
  itemType: z.string(),
  credential: memberResponseSchema,
  createdAt: z.string(),
});

const printBatchResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  title: z.string(),
  mode: printBatchModeSchema,
  status: z.string(),
  totalItems: z.number(),
  createdByStudentNumber: z.string().nullable(),
  notes: z.string().nullable(),
  downloadUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  items: z.array(printBatchItemResponseSchema),
});

const nucleusOptionSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
});

const nucleusFunctionOptionSchema = nucleusOptionSchema.extend({
  areaKey: z.string(),
  team: z.string(),
  accessLevel: z.string(),
  permissions: z.array(z.string()),
});

const nucleusAreaOptionSchema = nucleusOptionSchema.extend({
  team: z.string(),
  permissions: z.array(z.string()),
  functions: z.array(nucleusFunctionOptionSchema),
});

const nucleusClaimResponseSchema = z.object({
  id: z.number(),
  studentNumber: z.string(),
  officialName: z.string().nullable(),
  officialEmail: z.string().nullable(),
  officialCourse: z.string().nullable(),
  officialPhone: z.string().nullable(),
  requestedCategory: z.string(),
  requestedTeam: z.string(),
  requestedRole: z.string(),
  requestedAccessLevel: z.string(),
  requestedPermissions: z.array(z.string()),
  status: z.string(),
  statusLabel: z.string(),
  photoUrl: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  course: z.string().nullable(),
  organization: z.string().nullable(),
  bio: z.string().nullable(),
  reviewNote: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewedByStudentNumber: z.string().nullable(),
  teamMembershipId: z.number().nullable(),
  credentialId: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const profileRequirementSchema = z.object({
  key: z.string(),
  label: z.string(),
  required: z.boolean(),
});

const teamMembershipResponseSchema = z.object({
  id: z.number(),
  studentNumber: z.string().nullable(),
  fullName: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  category: z.string(),
  categoryLabel: z.string(),
  team: z.string(),
  role: z.string(),
  accessLevel: z.string(),
  permissions: z.array(z.string()),
  status: z.string(),
  statusLabel: z.string(),
  version: z.number(),
  mandateLabel: z.string().nullable(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  source: z.string(),
  notes: z.string().nullable(),
  createdByStudentNumber: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  verifiedByStudentNumber: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const teamMembershipOverviewResponseSchema = z.object({
  stats: z.object({
    total: z.number(),
    active: z.number(),
    suspended: z.number(),
    removed: z.number(),
    alumni: z.number(),
    linkedToStudent: z.number(),
    verified: z.number(),
  }),
  members: z.array(teamMembershipResponseSchema),
});

const teamProfilePresetResponseSchema = z.object({
  key: z.string(),
  label: z.string(),
  category: z.string(),
  team: z.string(),
  role: z.string(),
  accessLevel: z.string(),
  permissions: z.array(z.string()),
  description: z.string(),
  functions: z.array(z.object({
    key: z.string(),
    areaKey: z.string(),
    team: z.string(),
    label: z.string(),
    accessLevel: z.string(),
    description: z.string(),
    permissions: z.array(z.string()),
  })),
});

const credentialMembershipMatchCandidateSchema = z.object({
  teamMembership: teamMembershipResponseSchema,
  score: z.number(),
  confidence: z.string(),
  reasons: z.array(z.string()),
});

const credentialMembershipMatchResponseSchema = z.object({
  stats: z.object({
    totalCredentials: z.number(),
    linkedCredentials: z.number(),
    unlinkedCredentials: z.number(),
    suggested: z.number(),
    ambiguous: z.number(),
    membershipsWithoutStudentNumber: z.number(),
  }),
  items: z.array(z.object({
    credential: memberResponseSchema,
    candidates: z.array(credentialMembershipMatchCandidateSchema),
    ambiguous: z.boolean(),
    recommendedTeamMembershipId: z.number().nullable(),
  })),
});

const credentialMembershipLinkSchema = z.object({
  teamMembershipId: z.coerce.number().int().positive(),
});

const overviewResponseSchema = z.object({
  stats: z.object({
    total: z.number(),
    invited: z.number(),
    profileReady: z.number(),
    disabled: z.number(),
    teams: z.number(),
  }),
  members: z.array(memberResponseSchema),
  teams: z.array(z.object({
    name: z.string(),
    total: z.number(),
    profileReady: z.number(),
    invited: z.number(),
    categories: z.array(z.string()),
  })),
});

const adminSessionProfileResponseSchema = z.object({
  requiresCompletion: z.boolean(),
  reason: z.string().nullable(),
  completionScore: z.number(),
  missingFields: z.array(profileRequirementSchema),
  student: z.object({
    studentNumber: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    course: z.string().nullable(),
    phone: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    bio: z.string().nullable(),
    address: z.string().nullable(),
    instagramUrl: z.string().nullable(),
    facebookUrl: z.string().nullable(),
    linkedinUrl: z.string().nullable(),
    githubUrl: z.string().nullable(),
    websiteUrl: z.string().nullable(),
    profileCompletedAt: z.string().nullable(),
  }).nullable(),
  member: memberResponseSchema.nullable(),
});

const incompleteProfilesResponseSchema = z.object({
  stats: z.object({
    total: z.number(),
    incomplete: z.number(),
    ready: z.number(),
  }),
  members: z.array(memberResponseSchema.extend({
    completionScore: z.number(),
    missingFields: z.array(profileRequirementSchema),
  })),
});

const nucleusInvitationContextSchema = z.object({
  student: z.object({
    id: z.number(),
    studentNumber: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    course: z.string().nullable(),
    phone: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    academicSyncedAt: z.string().nullable(),
  }),
  suggestedTeamMembershipId: z.number().nullable(),
  suggestedMatchConfidence: z.enum(["studentNumber", "exact", "firstLast", "partial"]).nullable(),
  isBulk: z.boolean().optional(),
  alreadyClaimed: z.boolean().optional(),
  claimedCredential: memberResponseSchema.optional().nullable(),
  members: z.array(teamMembershipResponseSchema),
  claimOptions: z.object({
    areas: z.array(nucleusAreaOptionSchema),
    functions: z.array(nucleusFunctionOptionSchema),
  }),
  pendingClaim: nucleusClaimResponseSchema.optional().nullable(),
});

const nucleusClaimSchema = publicSubmissionSchema.extend({
  teamMembershipId: z.coerce.number().int().positive(),
});

const credentialReissueResponseSchema = z.object({
  previous: memberResponseSchema,
  next: memberResponseSchema,
});

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getPublicAppUrl(env: Env) {
  const isApiLikeHost = (value: string) => {
    try {
      const url = new URL(value);
      return url.hostname.startsWith("api.") || url.pathname.startsWith("/api");
    } catch {
      return true;
    }
  };

  const publicAppUrl = env.PUBLIC_APP_URL && !isApiLikeHost(env.PUBLIC_APP_URL)
    ? env.PUBLIC_APP_URL
    : null;
  const corsAppUrl = env.CORS_ORIGIN
    .split(",")
    .map((item) => item.trim())
    .find((item) => item.startsWith("http") && !isApiLikeHost(item));

  return stripTrailingSlash(
    publicAppUrl
      ?? corsAppUrl
      ?? DEFAULT_PUBLIC_APP_URL,
  );
}

function getPublicApiUrl(env: Env) {
  return env.PUBLIC_API_URL ? stripTrailingSlash(env.PUBLIC_API_URL) : null;
}

function buildInviteUrl(env: Env, token: string) {
  return `${getPublicAppUrl(env)}/equipa/credencial/${encodeURIComponent(token)}`;
}

function buildProfileUrl(env: Env, slug: string) {
  return `${getPublicAppUrl(env)}/equipa/perfil/${encodeURIComponent(slug)}`;
}

function buildCredentialProjectUrl(
  env: Env,
  member: Pick<EventTeamCredentialRecord, "sourceSubmissionId" | "sourceSubmissionName">,
) {
  if (!member.sourceSubmissionId || !member.sourceSubmissionName) return null;
  return `${getPublicAppUrl(env)}/projeto/${buildSubmissionSlug(member.sourceSubmissionName, member.sourceSubmissionId)}`;
}

async function ensureExhibitorChallengeQrActionForPass(
  member: Pick<
    EventTeamCredentialRecord,
    "category" | "id" | "name" | "sourceSubmissionId" | "sourceSubmissionName" | "sourceSubmissionType" | "sourceSubmissionArea"
  >,
) {
  if (member.category !== "EXPOSITOR" || !member.sourceSubmissionId || !member.sourceSubmissionName) return null;

  const submission = await prisma.submission.findFirst({
    where: { id: member.sourceSubmissionId, status: "APPROVED", deletedAt: null },
    select: { id: true, name: true, type: true, area: true },
  });
  if (!submission) return null;

  const existing = await prisma.qrAction.findFirst({
    where: {
      type: "EXHIBITOR_CHALLENGE",
      targetId: submission.id,
    },
    orderBy: [{ createdAt: "asc" }],
  });
  if (existing) return existing;

  const mission = await prisma.passportMission.findUnique({
    where: { key: "exhibitor-challenge" },
    select: { id: true },
  }).catch(() => null);

  return prisma.qrAction.create({
    data: {
      token: createToken("qra"),
      type: "EXHIBITOR_CHALLENGE",
      label: `Desafio: ${submission.name}`,
      description: "QR pessoal do expositor para abrir o Desafio do Expositor no Passaporte Digital.",
      targetId: submission.id,
      targetMeta: JSON.stringify({
        submissionId: submission.id,
        submissionName: submission.name,
        submissionType: submission.type,
        submissionArea: submission.area,
        source: "EXHIBITOR_PASS_BACK_QR",
        credentialId: member.id,
        exhibitorName: member.name ?? null,
      }),
      eventKey: `submission:${submission.id}:challenge`,
      eventLabel: submission.name,
      active: true,
      passportMissionId: mission?.id ?? null,
    },
  });
}

async function resolveCredentialPassQrTargets(
  env: Env,
  member: EventTeamCredentialRecord,
  qrSize: 180 | 220 | 280 | 720,
) {
  const siteUrl = getPublicAppUrl(env);
  const profileUrl = buildProfileUrl(env, member.publicSlug);
  const projectUrl = buildCredentialProjectUrl(env, member);

  let frontUrl = siteUrl;
  let backUrl = profileUrl;
  let frontQrLabel = "QR do site UOR Connect";
  let backQrLabel = "Perfil Público";
  let tokenHashPurpose = "front-site-back-profile";

  if (member.category === "EXPOSITOR" && projectUrl) {
    const challengeAction = await ensureExhibitorChallengeQrActionForPass(member);
    frontUrl = projectUrl;
    backUrl = challengeAction ? buildValidationUrl(env, challengeAction.token) : profileUrl;
    frontQrLabel = "Projeto do expositor";
    backQrLabel = "Desafio do expositor";
    tokenHashPurpose = "front-project-back-exhibitor-challenge";
  }

  const [frontQrDataUri, backQrDataUri] = await Promise.all([
    renderQrDataUri(frontUrl, qrSize, { transparentBackground: true }),
    renderQrDataUri(backUrl, qrSize, { transparentBackground: true }),
  ]);

  return {
    siteUrl,
    profileUrl,
    frontUrl,
    backUrl,
    frontQrLabel,
    backQrLabel,
    frontQrDataUri,
    backQrDataUri,
    tokenHashPurpose,
  };
}

function buildPassPdfPath(slug: string) {
  return `/team-credentials/members/${encodeURIComponent(slug)}/pass.pdf`;
}

function buildPassPdfUrl(env: Env, slug: string) {
  const publicApiUrl = getPublicApiUrl(env);
  return publicApiUrl ? `${publicApiUrl}${buildPassPdfPath(slug)}` : null;
}

function buildPrintBatchPdfPath(batchId: number) {
  return `/team-credentials/admin/print-batches/${batchId}/pass.pdf`;
}

function buildPrintBatchPdfUrl(env: Env, batchId: number) {
  const publicApiUrl = getPublicApiUrl(env);
  const path = buildPrintBatchPdfPath(batchId);
  return publicApiUrl ? `${publicApiUrl}${path}` : path;
}

function normalizeOptional(value?: string | null) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function normalizePermissionList(value: readonly string[] = []) {
  const allowed = new Set<string>([...ALL_ADMIN_PERMISSIONS, "ALL"]);
  const unique = Array.from(new Set(value.map((item) => item.trim().toUpperCase()).filter(Boolean)));
  if (unique.includes("ALL")) return "ALL";
  return unique.filter((item) => allowed.has(item)).join(",");
}

function parsePermissions(value: string | null | undefined) {
  const raw = value?.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean) ?? [];
  if (raw.includes("ALL")) return [...ALL_ADMIN_PERMISSIONS];
  return raw;
}

function categoryLabel(value: string) {
  const labels: Record<string, string> = {
    NUCLEO: "Núcleo",
    EXPOSITOR: "Expositor",
    JURI: "Júri",
    PALESTRANTE: "Palestrante",
    MESTRE_CERIMONIA: "Mestre de Cerimónia",
    PROTOCOLO: "Protocolo",
    MARKETING: "Marketing",
    LOGISTICA: "Logística",
    RELACOES_INTERNAS: "Relações Internas",
    RELACOES_EXTERNAS: "Relações Externas",
    EXPLICADORES: "Explicadores",
    STAFF: "Staff",
    CONVIDADO: "Convidado",
    OUTRO: "Outro",
  };
  return labels[value] ?? value;
}

function statusLabel(value: string) {
  return credentialStatusLabel(value);
}

function buildInvitationExpiresAt(now = new Date()) {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + credentialInvitationTtlDays);
  return expiresAt;
}

function isCredentialInvitationExpired(
  member: Pick<EventTeamCredentialRecord, "status" | "invitationExpiresAt">,
  now = new Date(),
) {
  return member.status === "INVITED"
    && Boolean(member.invitationExpiresAt)
    && member.invitationExpiresAt!.getTime() < now.getTime();
}

function credentialEffectiveStatus(member: Pick<EventTeamCredentialRecord, "status" | "expiresAt" | "revokedAt" | "invitationExpiresAt">) {
  const status = normalizeCredentialStatus(member);
  if (status === "INVITED" && isCredentialInvitationExpired(member)) return "EXPIRED";
  return status;
}

function isCredentialUsable(member: Pick<EventTeamCredentialRecord, "status" | "expiresAt" | "revokedAt" | "invitationExpiresAt">) {
  return isCredentialOperationallyUsable(member) && !isCredentialInvitationExpired(member);
}

function isCredentialReadyStatus(status: string) {
  return isCredentialPubliclyValid({ status });
}

function isCredentialReadyForPublicUse(member: Pick<EventTeamCredentialRecord, "status" | "expiresAt" | "revokedAt" | "invitationExpiresAt">) {
  return isCredentialReadyStatus(credentialEffectiveStatus(member));
}

function isCredentialPrintableForAdminBatch(
  member: Pick<EventTeamCredentialRecord, "status" | "expiresAt" | "revokedAt" | "invitationExpiresAt">,
  includePending = false,
) {
  if (isCredentialReadyForPublicUse(member)) return true;
  return includePending && isCredentialOperationallyUsable(member);
}

function sendInvitationExpired(reply: FastifyReply) {
  return reply.code(410).send({ message: "Convite expirado. Pede à organização um novo link de credencial." });
}

function membershipStatusLabel(value: string) {
  if (value === "ACTIVE") return "Ativo";
  if (value === "SUSPENDED") return "Suspenso";
  if (value === "REMOVED") return "Removido";
  if (value === "ALUMNI") return "Antigo membro";
  return value;
}

function sanitizeSlugPart(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 70);

  return normalized || "membro";
}

function createToken(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

async function createUniquePublicSlug(seed?: string | null) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix = randomUUID().replace(/-/g, "").slice(0, attempt === 0 ? 8 : 12);
    const slug = `${sanitizeSlugPart(seed ?? "membro")}-${suffix}`;
    const existing = await prisma.eventTeamCredential.findUnique({ where: { publicSlug: slug } });
    if (!existing) return slug;
  }

  return `membro-${randomUUID().replace(/-/g, "")}`;
}

function serializeMember(env: Env, member: EventTeamCredentialRecord) {
  const effectiveStatus = credentialEffectiveStatus(member);
  return {
    id: member.id,
    teamMembershipId: member.teamMembershipId,
    token: member.token,
    publicSlug: member.publicSlug,
    category: member.category,
    categoryLabel: categoryLabel(member.category),
    team: member.team,
    role: member.role,
    accessLevel: member.accessLevel,
    permissions: parsePermissions(member.permissions),
    status: effectiveStatus,
    statusLabel: statusLabel(effectiveStatus),
    name: member.name,
    email: member.email,
    phone: member.phone,
    course: member.course,
    organization: member.organization,
    bio: member.bio,
    photoUrl: member.photoUrl,
    address: member.address,
    instagramUrl: member.instagramUrl,
    facebookUrl: member.facebookUrl,
    linkedinUrl: member.linkedinUrl,
    githubUrl: member.githubUrl,
    websiteUrl: member.websiteUrl,
    consentPhotoCredential: member.consentPhotoCredential,
    consentPublicProfile: member.consentPublicProfile,
    consentSocialLinks: member.consentSocialLinks,
    consentSms: member.consentSms,
    consentWhatsapp: member.consentWhatsapp,
    sourceSubmissionId: member.sourceSubmissionId,
    sourceSubmissionRef: member.sourceSubmissionRef,
    sourceSubmissionName: member.sourceSubmissionName,
    sourceSubmissionType: member.sourceSubmissionType,
    sourceSubmissionArea: member.sourceSubmissionArea,
    notes: member.notes,
    createdByStudentNumber: member.createdByStudentNumber,
    issuedAt: member.issuedAt?.toISOString() ?? null,
    issuedByStudentNumber: member.issuedByStudentNumber,
    hasIssuedSnapshot: Boolean(member.issuedSnapshotJson),
    invitationExpiresAt: member.invitationExpiresAt?.toISOString() ?? null,
    expiresAt: member.expiresAt?.toISOString() ?? null,
    revokedAt: member.revokedAt?.toISOString() ?? null,
    revokedReason: member.revokedReason,
    version: member.version,
    reissuedFromId: member.reissuedFromId,
    inviteUrl: buildInviteUrl(env, member.token),
    profileUrl: buildProfileUrl(env, member.publicSlug),
    passPdfPath: buildPassPdfPath(member.publicSlug),
    passPdfUrl: buildPassPdfUrl(env, member.publicSlug),
    submittedAt: member.submittedAt?.toISOString() ?? null,
    lastPassIssuedAt: member.lastPassIssuedAt?.toISOString() ?? null,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

type CredentialPrintBatchRecord = {
  id: number;
  code: string;
  title: string;
  mode: "NOMINAL" | "GENERIC" | "MIXED" | string;
  status: string;
  totalItems: number;
  createdByStudentNumber: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: Array<{
    id: number;
    position: number;
    label: string | null;
    itemType: string;
    createdAt: Date;
    credential: EventTeamCredentialRecord;
  }>;
};

type PrintBatchNominalItem = z.infer<typeof printBatchNominalItemSchema>;
type PrintBatchGenericItem = z.infer<typeof printBatchGenericItemSchema>;

function serializePrintBatch(env: Env, batch: CredentialPrintBatchRecord) {
  return {
    id: batch.id,
    code: batch.code,
    title: batch.title,
    mode: batch.mode === "NOMINAL" || batch.mode === "GENERIC" ? batch.mode : "MIXED",
    status: batch.status,
    totalItems: batch.totalItems,
    createdByStudentNumber: batch.createdByStudentNumber,
    notes: batch.notes,
    downloadUrl: buildPrintBatchPdfUrl(env, batch.id),
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
    items: (batch.items ?? [])
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((item) => ({
        id: item.id,
        position: item.position,
        label: item.label,
        itemType: item.itemType,
        credential: serializeMember(env, item.credential),
        createdAt: item.createdAt.toISOString(),
      })),
  };
}

function hasSocialLinks(value: {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  websiteUrl?: string | null;
}) {
  return Boolean(
    normalizeOptional(value.instagramUrl)
    || normalizeOptional(value.facebookUrl)
    || normalizeOptional(value.linkedinUrl)
    || normalizeOptional(value.githubUrl)
    || normalizeOptional(value.websiteUrl),
  );
}

function inferPrintBatchMode(nominalCount: number, genericCount: number): z.infer<typeof printBatchModeSchema> {
  if (nominalCount > 0 && genericCount > 0) return "MIXED";
  if (genericCount > 0) return "GENERIC";
  return "NOMINAL";
}

function printBatchCode() {
  return `print_${Date.now().toString(36)}_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function genericCredentialName(item: PrintBatchGenericItem, index: number) {
  const number = String(item.startNumber + index).padStart(Math.max(2, String(item.startNumber + item.quantity - 1).length), "0");
  return `${item.prefix} ${number}`;
}

function splitFullName(value: string) {
  const parts = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts[parts.length - 1] : null,
  };
}

function normalizeStudentNumber(value?: string | null) {
  const normalized = value?.replace(/\D/g, "").trim();
  return normalized || null;
}

function membershipVerificationData(actorStudentNumber?: string | null, verifiedAt = new Date()) {
  return {
    verifiedAt,
    verifiedByStudentNumber: actorStudentNumber ?? null,
  };
}

function serializeTeamMembership(member: TeamMembershipRecord) {
  return {
    id: member.id,
    studentNumber: member.studentNumber,
    fullName: member.fullName,
    firstName: member.firstName,
    lastName: member.lastName,
    category: member.category,
    categoryLabel: categoryLabel(member.category),
    team: member.team,
    role: member.role,
    accessLevel: member.accessLevel,
    permissions: parsePermissions(member.permissions),
    status: member.status,
    statusLabel: membershipStatusLabel(member.status),
    version: member.version,
    mandateLabel: member.mandateLabel,
    startsAt: member.startsAt?.toISOString() ?? null,
    endsAt: member.endsAt?.toISOString() ?? null,
    source: member.source,
    notes: member.notes,
    createdByStudentNumber: member.createdByStudentNumber,
    verifiedAt: member.verifiedAt?.toISOString() ?? null,
    verifiedByStudentNumber: member.verifiedByStudentNumber,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}

function membershipClaimStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING_REVIEW: "Aguardando validação",
    APPROVED: "Aprovado",
    REJECTED: "Recusado",
    CANCELED: "Cancelado",
  };
  return labels[status] ?? status;
}

function serializeNucleusClaim(claim: TeamMembershipClaimRecord) {
  return {
    id: claim.id,
    studentNumber: claim.studentNumber,
    officialName: claim.officialName,
    officialEmail: claim.officialEmail,
    officialCourse: claim.officialCourse,
    officialPhone: claim.officialPhone,
    requestedCategory: claim.requestedCategory,
    requestedTeam: claim.requestedTeam,
    requestedRole: claim.requestedRole,
    requestedAccessLevel: claim.requestedAccessLevel,
    requestedPermissions: parsePermissions(claim.requestedPermissions),
    status: claim.status,
    statusLabel: membershipClaimStatusLabel(claim.status),
    photoUrl: claim.photoUrl,
    email: claim.email,
    phone: claim.phone,
    course: claim.course,
    organization: claim.organization,
    bio: claim.bio,
    reviewNote: claim.reviewNote,
    reviewedAt: claim.reviewedAt?.toISOString() ?? null,
    reviewedByStudentNumber: claim.reviewedByStudentNumber,
    teamMembershipId: claim.teamMembershipId,
    credentialId: claim.credentialId,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  };
}

function resolveNucleusFunctionPermissions(area: NucleusAreaDefinition, fn: NucleusFunctionDefinition) {
  return parsePermissions(normalizePermissionList(resolveNucleusMembershipPermissions({
    category: "NUCLEO",
    team: area.team,
    role: fn.label,
    accessLevel: fn.accessLevel,
    permissions: [
      ...(fn.includeAreaPermissions ? area.permissions : []),
      ...fn.permissions,
    ],
  })));
}

function serializeNucleusFunctionOption(area: NucleusAreaDefinition, fn: NucleusFunctionDefinition) {
  return {
    key: fn.key,
    areaKey: area.key,
    team: area.team,
    label: fn.label,
    accessLevel: fn.accessLevel,
    description: fn.description,
    permissions: resolveNucleusFunctionPermissions(area, fn),
  };
}

function serializeNucleusClaimOptions() {
  const functions = nucleusAreaOptions.flatMap((area) => area.functions.map((fn) => serializeNucleusFunctionOption(area, fn)));

  return {
    areas: nucleusAreaOptions.map((area) => ({
      key: area.key,
      label: area.label,
      team: area.team,
      description: area.description,
      permissions: [...area.permissions],
      functions: area.functions.map((fn) => serializeNucleusFunctionOption(area, fn)),
    })),
    functions,
  };
}

function findNucleusAreaOption(key: string) {
  return nucleusAreaOptions.find((area) => area.key === key);
}

function findNucleusFunctionOption(key: string) {
  return nucleusFunctionOptions.find((item) => item.key === key);
}

function normalizeNucleusText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isNucleusFullAccessPosition(role?: string | null, accessLevel?: string | null) {
  const text = `${normalizeNucleusText(role)} ${normalizeNucleusText(accessLevel)}`;
  return [
    "presidente",
    "vice",
    "diretor",
    "secretario",
    "tesoureiro",
    "gestor",
    "supervisor",
    "responsavel",
    "auditor",
    "coordenador",
    "subcoordenador",
    "lider",
    "direcao",
    "secretaria",
    "tesouraria",
    "coordenacao",
    "lideranca",
  ].some((term) => text.includes(term));
}

function findNucleusAreaByTeam(team?: string | null) {
  const normalizedTeam = normalizeNucleusText(team);
  return nucleusAreaOptions.find((area) => normalizeNucleusText(area.team) === normalizedTeam) ?? null;
}

function resolveNucleusMembershipPermissions(input: {
  category?: string | null;
  team?: string | null;
  role?: string | null;
  accessLevel?: string | null;
  permissions?: readonly string[] | null;
}) {
  const explicitPermissions = input.permissions ?? [];
  if (input.category !== "NUCLEO") {
    return explicitPermissions;
  }

  if (isNucleusFullAccessPosition(input.role, input.accessLevel)) {
    return nucleusFullAdminPermissions;
  }

  const areaPermissions = findNucleusAreaByTeam(input.team)?.permissions ?? [];
  return [
    ...nucleusBaseAdminPermissions,
    ...areaPermissions,
    ...explicitPermissions,
  ];
}

function buildNucleusClaimSelection(areaKey: string, functionKey: string) {
  const area = findNucleusAreaOption(areaKey);
  const fn = findNucleusFunctionOption(functionKey);
  if (!area || !fn || fn.areaKey !== area.key) return null;

  return {
    requestedCategory: "NUCLEO",
    requestedTeam: area.team,
    requestedRole: fn.label,
    requestedAccessLevel: fn.accessLevel,
    requestedPermissions: normalizePermissionList(resolveNucleusMembershipPermissions({
      category: "NUCLEO",
      team: area.team,
      role: fn.label,
      accessLevel: fn.accessLevel,
      permissions: [
        ...(fn.includeAreaPermissions ? area.permissions : []),
        ...fn.permissions,
      ],
    })),
  };
}

function buildTeamMembershipOverview(members: TeamMembershipRecord[]) {
  return {
    stats: {
      total: members.length,
      active: members.filter((member) => member.status === "ACTIVE").length,
      suspended: members.filter((member) => member.status === "SUSPENDED").length,
      removed: members.filter((member) => member.status === "REMOVED").length,
      alumni: members.filter((member) => member.status === "ALUMNI").length,
      linkedToStudent: members.filter((member) => Boolean(member.studentNumber)).length,
      verified: members.filter((member) => Boolean(member.verifiedAt)).length,
    },
    members: members.map(serializeTeamMembership),
  };
}

function auditActor(request: FastifyRequest) {
  if (request.student?.studentNumber) {
    return {
      actorStudentNumber: request.student.studentNumber,
      actorRole: "admin",
    };
  }

  if (request.jury?.phone) {
    return {
      actorStudentNumber: request.jury.phone,
      actorRole: "jury",
    };
  }

  return {
    actorStudentNumber: "unknown",
    actorRole: "admin",
  };
}

async function auditCredentialClaimRefusal(
  request: FastifyRequest,
  input: {
    flow: string;
    reason: string;
    token?: string | null;
    credential?: Pick<EventTeamCredentialRecord, "id" | "category" | "status" | "teamMembershipId" | "sourceSubmissionId"> | null;
    studentNumber?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const actorStudentNumber = request.student?.studentNumber ?? request.jury?.phone ?? input.studentNumber ?? null;
  await recordAdminAudit({
    actorStudentNumber,
    actorRole: request.student ? "student" : request.jury ? "jury" : "public",
    action: "team_credential.claim_rejected",
    entityType: "EventTeamCredential",
    entityId: input.credential?.id ?? null,
    summary: `Tentativa recusada em ${input.flow}: ${input.reason}.`,
    metadata: {
      flow: input.flow,
      reason: input.reason,
      tokenPrefix: input.token ? input.token.slice(0, 16) : null,
      category: input.credential?.category ?? null,
      status: input.credential?.status ?? null,
      teamMembershipId: input.credential?.teamMembershipId ?? null,
      sourceSubmissionId: input.credential?.sourceSubmissionId ?? null,
      studentNumber: input.studentNumber ?? request.student?.studentNumber ?? null,
      ...input.metadata,
    },
  }).catch((error) => {
    request.log.warn({ err: error, flow: input.flow, reason: input.reason }, "failed to audit rejected credential claim");
  });
}

function teamMembershipAuditSnapshot(member: TeamMembershipRecord) {
  return {
    id: member.id,
    studentNumber: member.studentNumber,
    fullName: member.fullName,
    category: member.category,
    team: member.team,
    role: member.role,
    accessLevel: member.accessLevel,
    permissions: parsePermissions(member.permissions),
    status: member.status,
    version: member.version,
    mandateLabel: member.mandateLabel,
    startsAt: member.startsAt?.toISOString() ?? null,
    endsAt: member.endsAt?.toISOString() ?? null,
    source: member.source,
    verifiedAt: member.verifiedAt?.toISOString() ?? null,
    verifiedByStudentNumber: member.verifiedByStudentNumber,
  };
}

function teamCredentialAuditSnapshot(member: EventTeamCredentialRecord) {
  return {
    id: member.id,
    teamMembershipId: member.teamMembershipId,
    publicSlug: member.publicSlug,
    category: member.category,
    team: member.team,
    role: member.role,
    accessLevel: member.accessLevel,
    permissions: parsePermissions(member.permissions),
    status: member.status,
    effectiveStatus: credentialEffectiveStatus(member),
    name: member.name,
    version: member.version,
    issuedAt: member.issuedAt?.toISOString() ?? null,
    issuedByStudentNumber: member.issuedByStudentNumber,
    hasIssuedSnapshot: Boolean(member.issuedSnapshotJson),
    invitationExpiresAt: member.invitationExpiresAt?.toISOString() ?? null,
    expiresAt: member.expiresAt?.toISOString() ?? null,
    revokedAt: member.revokedAt?.toISOString() ?? null,
    revokedReason: member.revokedReason,
    reissuedFromId: member.reissuedFromId,
  };
}

function buildTeamCredentialIssueSnapshot(
  member: EventTeamCredentialRecord,
  reason: string,
  issuedAt: Date,
  issuedByStudentNumber: string | null,
) {
  return {
    documentType: "EVENT_TEAM_CREDENTIAL",
    snapshotVersion: 1,
    reason,
    capturedAt: new Date().toISOString(),
    credential: {
      id: member.id,
      publicSlug: member.publicSlug,
      category: member.category,
      team: member.team,
      role: member.role,
      accessLevel: member.accessLevel,
      permissions: parsePermissions(member.permissions),
      status: member.status,
      effectiveStatus: credentialEffectiveStatus(member),
      version: member.version,
      reissuedFromId: member.reissuedFromId,
      issuedAt: issuedAt.toISOString(),
      issuedByStudentNumber,
      expiresAt: member.expiresAt?.toISOString() ?? null,
    },
    holder: {
      name: member.name,
      email: member.email,
      phone: member.phone,
      course: member.course,
      organization: member.organization,
      photoUrl: member.photoUrl,
      address: member.address,
      socialLinks: {
        instagramUrl: member.instagramUrl,
        facebookUrl: member.facebookUrl,
        linkedinUrl: member.linkedinUrl,
        githubUrl: member.githubUrl,
        websiteUrl: member.websiteUrl,
      },
    },
    source: {
      teamMembershipId: member.teamMembershipId,
      sourceSubmissionId: member.sourceSubmissionId,
      sourceSubmissionRef: member.sourceSubmissionRef,
      sourceSubmissionName: member.sourceSubmissionName,
      sourceSubmissionType: member.sourceSubmissionType,
      sourceSubmissionArea: member.sourceSubmissionArea,
    },
    consents: {
      photoCredential: member.consentPhotoCredential,
      publicProfile: member.consentPublicProfile,
      socialLinks: member.consentSocialLinks,
      sms: member.consentSms,
      whatsapp: member.consentWhatsapp,
    },
  };
}

async function persistTeamCredentialIssueSnapshot(
  member: EventTeamCredentialRecord,
  reason: string,
  issuedByStudentNumber?: string | null,
) {
  const issuedAt = member.issuedAt ?? new Date();
  const actor = member.issuedByStudentNumber ?? issuedByStudentNumber ?? null;
  return prisma.eventTeamCredential.update({
    where: { id: member.id },
    data: {
      issuedAt,
      issuedByStudentNumber: actor,
      issuedSnapshotJson: JSON.stringify(buildTeamCredentialIssueSnapshot(member, reason, issuedAt, actor)),
    },
  });
}

async function hasApprovedCredentialOperationalLink(
  member: Pick<EventTeamCredentialRecord, "teamMembershipId" | "sourceSubmissionId">,
) {
  if (member.teamMembershipId) {
    const membership = await prisma.teamMembership.findUnique({
      where: { id: member.teamMembershipId },
      select: { status: true },
    });
    return membership?.status === "ACTIVE";
  }

  if (member.sourceSubmissionId) {
    const submission = await prisma.submission.findUnique({
      where: { id: member.sourceSubmissionId },
      select: { status: true, paymentStatus: true },
    });
    return submission?.status === "APPROVED" && isPaymentConfirmedByAdmin(submission.paymentStatus);
  }

  return false;
}

function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

function adminCredentialRequirements(member?: Partial<EventTeamCredentialRecord> | null) {
  return [
    { key: "name", label: "Nome completo", required: true, ready: Boolean(normalizeOptional(member?.name)) },
    { key: "photoUrl", label: "Fotografia", required: true, ready: Boolean(normalizeOptional(member?.photoUrl)) },
    { key: "team", label: "Equipa ou área", required: true, ready: Boolean(normalizeOptional(member?.team)) },
    { key: "role", label: "Cargo", required: true, ready: Boolean(normalizeOptional(member?.role)) },
    { key: "accessLevel", label: "Nível de acesso", required: true, ready: Boolean(normalizeOptional(member?.accessLevel)) },
    { key: "phone", label: "Telefone", required: false, ready: Boolean(normalizeOptional(member?.phone)) },
    { key: "email", label: "Email", required: false, ready: Boolean(normalizeOptional(member?.email)) },
  ];
}

function adminCredentialCompletion(member?: Partial<EventTeamCredentialRecord> | null) {
  const requirements = adminCredentialRequirements(member);
  const requiredItems = requirements.filter((item) => item.required);
  const missingFields = requirements
    .filter((item) => !item.ready)
    .map(({ key, label, required }) => ({ key, label, required }));
  const readyRequired = requiredItems.filter((item) => item.ready).length;

  return {
    completionScore: requiredItems.length > 0 ? Math.round((readyRequired / requiredItems.length) * 100) : 100,
    missingFields,
    missingRequiredFields: missingFields.filter((item) => item.required),
  };
}

function serializeMemberWithCompletion(env: Env, member: EventTeamCredentialRecord) {
  const completion = adminCredentialCompletion(member);
  return {
    ...serializeMember(env, member),
    completionScore: completion.completionScore,
    missingFields: completion.missingFields,
  };
}

function buildOverview(env: Env, members: EventTeamCredentialRecord[]) {
  const teamMap = new Map<string, { name: string; total: number; profileReady: number; invited: number; categories: Set<string> }>();

  for (const member of members) {
    const team = teamMap.get(member.team) ?? {
      name: member.team,
      total: 0,
      profileReady: 0,
      invited: 0,
      categories: new Set<string>(),
    };

    team.total += 1;
    const status = credentialEffectiveStatus(member);
    if (isCredentialReadyStatus(status)) team.profileReady += 1;
    if (status === "INVITED") team.invited += 1;
    team.categories.add(member.category);
    teamMap.set(member.team, team);
  }

  return {
    stats: {
      total: members.length,
      invited: members.filter((member) => credentialEffectiveStatus(member) === "INVITED").length,
      profileReady: members.filter((member) => isCredentialReadyStatus(credentialEffectiveStatus(member))).length,
      disabled: members.filter((member) => ["DISABLED", "REVOKED", "EXPIRED"].includes(credentialEffectiveStatus(member))).length,
      teams: teamMap.size,
    },
    members: members.map((member) => serializeMember(env, member)),
    teams: Array.from(teamMap.values()).map((team) => ({
      name: team.name,
      total: team.total,
      profileReady: team.profileReady,
      invited: team.invited,
      categories: Array.from(team.categories),
    })),
  };
}

function defaultNucleusRoleForArea(areaKey: string) {
  return findNucleusAreaOption(areaKey)?.functions[0]?.label ?? "Membro do Núcleo";
}

function defaultNucleusAccessLevelForArea(areaKey: string) {
  return findNucleusAreaOption(areaKey)?.functions[0]?.accessLevel ?? "Membro";
}

const teamProfilePresets = nucleusAreaOptions.map((area) => ({
  key: area.key,
  label: area.label,
  category: "NUCLEO" as const,
  team: area.team,
  role: defaultNucleusRoleForArea(area.key),
  accessLevel: defaultNucleusAccessLevelForArea(area.key),
  permissions: area.functions[0] ? resolveNucleusFunctionPermissions(area, area.functions[0]) : parsePermissions(normalizePermissionList(area.permissions)),
  description: area.description,
  functions: area.functions.map((fn) => serializeNucleusFunctionOption(area, fn)),
})) satisfies Array<{
  key: string;
  label: string;
  category: (typeof memberCategories)[number];
  team: string;
  role: string;
  accessLevel: string;
  permissions: string[];
  description: string;
  functions: Array<{
    key: string;
    areaKey: string;
    team: string;
    label: string;
    accessLevel: string;
    description: string;
    permissions: string[];
  }>;
}>;

function normalizeNameForMatch(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function firstLastNameSignature(value?: string | null) {
  const parts = normalizeNameForMatch(value).split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function buildCredentialMembershipCandidate(
  credential: Pick<EventTeamCredentialRecord, "name" | "team" | "role">,
  membership: TeamMembershipRecord,
) {
  const reasons: string[] = [];
  const credentialName = normalizeNameForMatch(credential.name);
  const membershipName = normalizeNameForMatch(membership.fullName);
  const credentialFirstLast = firstLastNameSignature(credential.name);
  const membershipFirstLast = firstLastNameSignature(membership.fullName);
  let score = 0;

  if (credentialName && credentialName === membershipName) {
    score += 70;
    reasons.push("nome completo coincide");
  } else if (credentialFirstLast && credentialFirstLast === membershipFirstLast) {
    score += 52;
    reasons.push("primeiro e último nome coincidem");
  }

  if (normalizeNameForMatch(credential.team) === normalizeNameForMatch(membership.team)) {
    score += 18;
    reasons.push("equipa coincide");
  }

  if (normalizeNameForMatch(credential.role) === normalizeNameForMatch(membership.role)) {
    score += 12;
    reasons.push("cargo coincide");
  }

  if (membership.studentNumber) {
    score += 8;
    reasons.push("tem número de estudante");
  }

  const confidence = score >= 90 ? "ALTA" : score >= 70 ? "MEDIA" : "BAIXA";
  return {
    teamMembership: serializeTeamMembership(membership),
    score,
    confidence,
    reasons,
  };
}

function buildCredentialMembershipMatches(
  env: Env,
  credentials: EventTeamCredentialRecord[],
  memberships: TeamMembershipRecord[],
) {
  const linkedMembershipIds = new Set(credentials.map((credential) => credential.teamMembershipId).filter((value): value is number => Boolean(value)));
  const items = credentials
    .filter((credential) => isCredentialUsable(credential) && !credential.teamMembershipId)
    .map((credential) => {
      const candidates = memberships
        .filter((membership) => membership.status === "ACTIVE" && !linkedMembershipIds.has(membership.id))
        .map((membership) => buildCredentialMembershipCandidate(credential, membership))
        .filter((candidate) => candidate.score >= 52)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      const topScore = candidates[0]?.score ?? 0;
      const topCandidates = candidates.filter((candidate) => candidate.score === topScore);
      const recommendedTeamMembershipId = topCandidates.length === 1 && topScore >= 90
        ? topCandidates[0]?.teamMembership.id ?? null
        : null;

      return {
        credential: serializeMember(env, credential),
        candidates,
        ambiguous: candidates.length > 1 && !recommendedTeamMembershipId,
        recommendedTeamMembershipId,
      };
    })
    .filter((item) => item.candidates.length > 0);

  return {
    stats: {
      totalCredentials: credentials.filter(isCredentialUsable).length,
      linkedCredentials: credentials.filter((credential) => isCredentialUsable(credential) && Boolean(credential.teamMembershipId)).length,
      unlinkedCredentials: credentials.filter((credential) => isCredentialUsable(credential) && !credential.teamMembershipId).length,
      suggested: items.filter((item) => Boolean(item.recommendedTeamMembershipId)).length,
      ambiguous: items.filter((item) => item.ambiguous).length,
      membershipsWithoutStudentNumber: memberships.filter((membership) => membership.status === "ACTIVE" && !membership.studentNumber).length,
    },
    items,
  };
}

async function findActiveMembershipForStudent(studentNumber?: string | null) {
  const memberships = await findActiveMembershipsForStudent(studentNumber);
  return memberships.find((membership) => Boolean(membership.verifiedAt))
    ?? memberships.find((membership) => membership.category === "NUCLEO" && membership.source !== "NUCLEO_IMPORT")
    ?? memberships.find((membership) => parsePermissions(membership.permissions).length > 0)
    ?? memberships[0]
    ?? null;
}

async function findActiveMembershipsForStudent(studentNumber?: string | null) {
  const normalizedStudentNumber = normalizeStudentNumber(studentNumber);
  if (!normalizedStudentNumber) return [];
  return prisma.teamMembership.findMany({
    where: { studentNumber: normalizedStudentNumber, status: "ACTIVE" },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
}

async function findCredentialForStudent(teamMembershipId?: number | null) {
  if (!teamMembershipId) return null;
  const credential = await prisma.eventTeamCredential.findFirst({
    where: { status: { notIn: ["DISABLED", "REVOKED"] }, teamMembershipId },
    orderBy: [{ updatedAt: "desc" }],
  });
  return credential && isCredentialUsable(credential) ? credential : null;
}

async function findSelfIssuedAdminCredential(studentNumber: string, studentName?: string | null) {
  const candidates = await prisma.eventTeamCredential.findMany({
    where: {
      teamMembershipId: null,
      category: "NUCLEO",
      status: { notIn: ["DISABLED", "REVOKED"] },
      createdByStudentNumber: studentNumber,
      issuedByStudentNumber: studentNumber,
      ...(studentName ? { name: studentName } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 1,
  });
  const credential = candidates[0] ?? null;
  return credential && isCredentialUsable(credential) ? credential : null;
}

function isCredentialConsistentWithMembership(
  member: Pick<EventTeamCredentialRecord, "category" | "teamMembershipId">,
  membership?: Pick<TeamMembershipRecord, "category" | "status"> | null,
) {
  if (!member.teamMembershipId) return true;
  if (!membership || membership.status !== "ACTIVE") return false;

  if (member.category === "EXPOSITOR" || membership.category === "EXPOSITOR") {
    return member.category === membership.category;
  }

  return member.category === membership.category || member.category === "NUCLEO";
}

function credentialDisplayKey(member: EventTeamCredentialRecord) {
  if (member.teamMembershipId) {
    return `membership:${member.teamMembershipId}`;
  }

  return [
    "direct",
    member.category,
    normalizeNameForMatch(member.name),
    normalizeNameForMatch(member.team),
    normalizeNameForMatch(member.role),
    normalizeNameForMatch(member.accessLevel),
    member.createdByStudentNumber ?? "",
  ].join(":");
}

function dedupeCredentialsForDisplay(members: EventTeamCredentialRecord[]) {
  const byKey = new Map<string, EventTeamCredentialRecord>();
  for (const member of members) {
    const key = credentialDisplayKey(member);
    const current = byKey.get(key);
    if (!current || member.updatedAt.getTime() > current.updatedAt.getTime()) {
      byKey.set(key, member);
    }
  }
  return Array.from(byKey.values());
}

function initials(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "UC";
  return `${parts[0]?.[0] ?? "U"}${parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""}`.toUpperCase();
}

function isImageDataUri(value?: string | null) {
  return Boolean(value && /^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i.test(value));
}

function safeFileName(value: string) {
  return sanitizeSlugPart(value).replace(/-/g, "_") || "credencial";
}

function buildCredentialProfileExtraData(body: z.infer<typeof publicSubmissionSchema>) {
  const hasSocials = hasSocialProfileFields(body);
  return {
    address: normalizeOptional(body.address),
    instagramUrl: normalizeOptional(body.instagramUrl),
    facebookUrl: normalizeOptional(body.facebookUrl),
    linkedinUrl: normalizeOptional(body.linkedinUrl),
    githubUrl: normalizeOptional(body.githubUrl),
    websiteUrl: normalizeOptional(body.websiteUrl),
    consentPhotoCredential: body.consentPhotoCredential === true,
    consentPublicProfile: body.consentPublicProfile === true,
    consentSocialLinks: body.consentSocialLinks === true && hasSocials,
    consentSms: body.consentSms === true,
    consentWhatsapp: body.consentWhatsapp === true,
  };
}

type PublicCredentialProfile = {
  avatarUrl: string | null;
  course: string | null;
  bio: string | null;
  address: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  profileExtra: {
    bio: string | null;
    address: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
    websiteUrl: string | null;
    consentPhotoCredential: boolean;
    consentPublicProfile: boolean;
    consentSocialLinks: boolean;
    visibilityJson: string | null;
  } | null;
} | null;

export function sanitizePublicMemberPayload(
  payload: ReturnType<typeof serializeMember>,
  profile: PublicCredentialProfile,
) {
  const profileExtra = profile?.profileExtra ?? null;
  const consentPublicProfile = profileExtra
    ? profileExtra.consentPublicProfile
    : payload.consentPublicProfile;
  const consentPhotoCredential = profileExtra
    ? profileExtra.consentPhotoCredential
    : payload.consentPhotoCredential;
  const consentSocialLinks = profileExtra
    ? profileExtra.consentSocialLinks
    : payload.consentSocialLinks;
  const visibilityJson = profileExtra?.visibilityJson ?? null;
  const canShowPhoto = isProfileFieldVisible(visibilityJson, "photo");
  const canShowBio = isProfileFieldVisible(visibilityJson, "bio");
  const canShowSocialLinks = isProfileFieldVisible(visibilityJson, "socialLinks");
  const canShowCourse = isProfileFieldVisible(visibilityJson, "course");
  const canShowOrganization = isProfileFieldVisible(visibilityJson, "organization");
  const liveBio = profileExtra?.bio ?? profile?.bio ?? payload.bio;
  const livePhotoUrl = profile?.avatarUrl ?? payload.photoUrl;
  const liveCourse = profile?.course ?? payload.course;
  const social = {
    instagram: profileExtra?.instagramUrl ?? profile?.instagramUrl ?? payload.instagramUrl ?? null,
    facebook: profileExtra?.facebookUrl ?? profile?.facebookUrl ?? payload.facebookUrl ?? null,
    linkedin: profileExtra?.linkedinUrl ?? profile?.linkedinUrl ?? payload.linkedinUrl ?? null,
    github: profileExtra?.githubUrl ?? profile?.githubUrl ?? payload.githubUrl ?? null,
    website: profileExtra?.websiteUrl ?? profile?.websiteUrl ?? payload.websiteUrl ?? null,
  };

  return {
    ...payload,
    email: null,
    phone: null,
    address: null,
    instagramUrl: consentPublicProfile && consentSocialLinks && canShowSocialLinks ? social.instagram : null,
    facebookUrl: consentPublicProfile && consentSocialLinks && canShowSocialLinks ? social.facebook : null,
    linkedinUrl: consentPublicProfile && consentSocialLinks && canShowSocialLinks ? social.linkedin : null,
    githubUrl: consentPublicProfile && consentSocialLinks && canShowSocialLinks ? social.github : null,
    websiteUrl: consentPublicProfile && consentSocialLinks && canShowSocialLinks ? social.website : null,
    bio: consentPublicProfile && canShowBio ? liveBio : null,
    photoUrl: consentPublicProfile && consentPhotoCredential && canShowPhoto ? livePhotoUrl : null,
    course: consentPublicProfile && canShowCourse ? liveCourse : null,
    organization: consentPublicProfile && canShowOrganization ? payload.organization : null,
    notes: null,
    createdByStudentNumber: null,
    issuedByStudentNumber: null,
  };
}

function normalizeCompare(value?: string | null) {
  return value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";
}

type SuggestedMatch = { id: number | null; confidence: "studentNumber" | "exact" | "firstLast" | "partial" | null };

function pickSuggestedMembership(
  memberships: TeamMembershipRecord[],
  student: { studentNumber: string; name: string | null },
): SuggestedMatch {
  const byStudentNumber = memberships.find((membership) => membership.studentNumber === student.studentNumber);
  if (byStudentNumber) return { id: byStudentNumber.id, confidence: "studentNumber" };

  const studentName = normalizeCompare(student.name);
  if (!studentName) return { id: null, confidence: null };

  const exact = memberships.find((membership) => normalizeCompare(membership.fullName) === studentName);
  if (exact) return { id: exact.id, confidence: "exact" };

  // First+last name matching
  const studentParts = studentName.split(" ").filter((part) => part.length > 1);
  if (studentParts.length >= 2) {
    const studentFirst = studentParts[0];
    const studentLast = studentParts[studentParts.length - 1];
    const firstLastMatch = memberships.find((membership) => {
      const memberFirst = normalizeCompare(membership.firstName);
      const memberLast = normalizeCompare(membership.lastName);
      if (memberFirst && memberLast) {
        return memberFirst === studentFirst && memberLast === studentLast;
      }
      const memberParts = normalizeCompare(membership.fullName).split(" ").filter((part) => part.length > 1);
      if (memberParts.length >= 2) {
        return memberParts[0] === studentFirst && memberParts[memberParts.length - 1] === studentLast;
      }
      return false;
    });
    if (firstLastMatch) return { id: firstLastMatch.id, confidence: "firstLast" };
  }

  const studentWordSet = new Set(studentParts.filter((part) => part.length > 2));
  const scored = memberships
    .map((membership) => {
      const parts = normalizeCompare(membership.fullName).split(" ").filter((part) => part.length > 2);
      const score = parts.filter((part) => studentWordSet.has(part)).length;
      return { id: membership.id, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored[0] ? { id: scored[0].id, confidence: "partial" } : { id: null, confidence: null };
}

function buildTeamMembershipData(
  body: z.infer<typeof teamMembershipInputSchema>,
  createdByStudentNumber?: string | null,
) {
  const nameParts = splitFullName(body.fullName);
  const studentNumber = normalizeStudentNumber(body.studentNumber);
  return {
    studentNumber,
    fullName: body.fullName.replace(/\s+/g, " ").trim(),
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    category: body.category,
    team: body.team.trim(),
    role: body.role.trim(),
    accessLevel: body.accessLevel.trim(),
    permissions: normalizePermissionList(resolveNucleusMembershipPermissions({
      category: body.category,
      team: body.team,
      role: body.role,
      accessLevel: body.accessLevel,
      permissions: body.permissions,
    })),
    status: body.status,
    mandateLabel: normalizeOptional(body.mandateLabel),
    startsAt: body.startsAt ?? null,
    endsAt: body.endsAt ?? null,
    source: body.source.trim(),
    notes: normalizeOptional(body.notes),
    createdByStudentNumber: createdByStudentNumber ?? null,
    ...membershipVerificationData(createdByStudentNumber),
  };
}

function nucleusStudentNumberError(category: string, studentNumber?: string | null) {
  if (category === "NUCLEO" && !studentNumber) {
    return "Número de estudante é obrigatório para membros do Núcleo, pois é a chave de acesso e segurança administrativa.";
  }
  return null;
}

async function upsertExpositorCredential(params: {
  studentNumber: string;
  name: string;
  submission: { id: number; referenceCode: string; name: string; type: string; area: string };
  actorNumber: string | null;
}): Promise<"created" | "membership_created" | "skipped"> {
  const { studentNumber, name, submission, actorNumber } = params;

  // Check if credential already exists for this student + submission
  const existingCred = await prisma.eventTeamCredential.findFirst({
    where: {
      category: "EXPOSITOR",
      teamMembership: { studentNumber },
    },
  });
  if (existingCred) return "skipped";

  const nameParts = splitFullName(name);
  let membershipCreated = false;
  let membership = await prisma.teamMembership.findFirst({
    where: { studentNumber, category: "EXPOSITOR" },
    orderBy: [{ updatedAt: "desc" }],
  });
  if (!membership) {
    membership = await prisma.teamMembership.create({
      data: {
        studentNumber,
        fullName: name,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        category: "EXPOSITOR",
        team: "Expositores",
        role: submission.type === "PROJECT" ? "Projeto" : submission.type === "BUSINESS" ? "Negócio" : "Produto",
        accessLevel: "Expositor",
        permissions: "EVENTO",
        status: "ACTIVE",
        source: "EXPOSITOR_IMPORT",
        createdByStudentNumber: actorNumber,
        ...membershipVerificationData(actorNumber),
      },
    });
    membershipCreated = true;
  } else if (!membership.verifiedAt) {
    membership = await prisma.teamMembership.update({
      where: { id: membership.id },
      data: membershipVerificationData(actorNumber),
    });
  }

  const credential = await prisma.eventTeamCredential.create({
    data: {
      token: createToken("cred"),
      teamMembershipId: membership.id,
      publicSlug: await createUniquePublicSlug(name),
      category: "EXPOSITOR",
      team: "Expositores",
      role: submission.type === "PROJECT" ? "Projeto" : submission.type === "BUSINESS" ? "Negócio" : "Produto",
      accessLevel: "Expositor",
      permissions: "EVENTO",
      status: "INVITED",
      invitationExpiresAt: buildInvitationExpiresAt(),
      name,
      sourceSubmissionId: submission.id,
      sourceSubmissionRef: submission.referenceCode,
      sourceSubmissionName: submission.name,
      sourceSubmissionType: submission.type,
      sourceSubmissionArea: submission.area,
      issuedAt: new Date(),
      issuedByStudentNumber: actorNumber,
    },
  });
  await persistTeamCredentialIssueSnapshot(credential, "EXPOSITOR_MEMBER_INVITATION", actorNumber);

  return membershipCreated ? "membership_created" : "created";
}

function parseSocialLinks(member: Pick<EventTeamCredentialRecord, "instagramUrl" | "linkedinUrl" | "githubUrl" | "websiteUrl">) {
  return {
    instagram: member.instagramUrl ?? null,
    linkedin: member.linkedinUrl ?? null,
    github: member.githubUrl ?? null,
    website: member.websiteUrl ?? null,
  };
}

export type CredentialPassTemplate = {
  primary: string;
  light: string;
  accent: string;
  icon: string;
  footerLabel: string;
};

export function categoryTheme(cat: string, printMode: CredentialPassOptions["printMode"] = "color"): CredentialPassTemplate {
  const themes: Record<string, CredentialPassTemplate> = {
    NUCLEO: { primary: "#0f172a", light: "#f1f5f9", accent: "#334155", footerLabel: "Membro Oficial do Núcleo", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
    EXPOSITOR: { primary: "#92400e", light: "#fffbeb", accent: "#d97706", footerLabel: "Expositor Certificado", icon: "M2 7l10-5 10 5M4 10v7a2 2 0 002 2h12a2 2 0 002-2v-7" },
    JURI: { primary: "#581c87", light: "#faf5ff", accent: "#9333ea", footerLabel: "Membro do Júri", icon: "M12 1v4M6.3 6.3l2.8 2.8M1 12h4m.3 5.7l2.8-2.8M12 23v-4m5.7.7l-2.8-2.8M23 12h-4m-.3-5.7l-2.8 2.8M16 12a4 4 0 11-8 0 4 4 0 018 0z" },
    PALESTRANTE: { primary: "#1e3a5f", light: "#eff6ff", accent: "#2563eb", footerLabel: "Palestrante Convidado", icon: "M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" },
    MESTRE_CERIMONIA: { primary: "#881337", light: "#fff1f2", accent: "#e11d48", footerLabel: "Mestre de Cerimónia", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
    PROTOCOLO: { primary: "#065f46", light: "#ecfdf5", accent: "#059669", footerLabel: "Equipa de Protocolo", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
    MARKETING: { primary: "#9a3412", light: "#fff7ed", accent: "#ea580c", footerLabel: "Equipa de Marketing", icon: "M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z" },
    LOGISTICA: { primary: "#164e63", light: "#ecfeff", accent: "#0891b2", footerLabel: "Equipa de Logística", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    RELACOES_INTERNAS: { primary: "#831843", light: "#fdf2f8", accent: "#db2777", footerLabel: "Relações Internas", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
    RELACOES_EXTERNAS: { primary: "#134e4a", light: "#f0fdfa", accent: "#0d9488", footerLabel: "Relações Externas", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    EXPLICADORES: { primary: "#3730a3", light: "#eef2ff", accent: "#6366f1", footerLabel: "Explicador Académico", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
    STAFF: { primary: "#374151", light: "#f9fafb", accent: "#6b7280", footerLabel: "Staff do Evento", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
    CONVIDADO: { primary: "#1f2937", light: "#f8fafc", accent: "#0ea5e9", footerLabel: "Convidado Oficial", icon: "M12 2a5 5 0 00-5 5v1a5 5 0 0010 0V7a5 5 0 00-5-5zM4 22a8 8 0 0116 0M8 11h8M8 15h8" },
    OUTRO: { primary: "#44403c", light: "#fafaf9", accent: "#78716c", footerLabel: "Equipa UOR Connect", icon: "M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  };
  const template = themes[cat] ?? themes.OUTRO;
  if (printMode === "black-white") {
    return {
      ...template,
      primary: "#111827",
      light: "#f8fafc",
      accent: "#475569",
    };
  }
  return template;
}

function normalizeThemeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function maybeBlackWhiteTemplate(template: CredentialPassTemplate, printMode: CredentialPassOptions["printMode"]) {
  if (printMode === "black-white") {
    return {
      ...template,
      primary: "#111827",
      light: "#f8fafc",
      accent: "#475569",
    };
  }
  return template;
}

function nucleusFunctionTheme(
  member: Pick<EventTeamCredentialRecord, "category" | "team" | "role" | "accessLevel">,
  printMode: CredentialPassOptions["printMode"] = "color",
): CredentialPassTemplate | null {
  if (member.category !== "NUCLEO") return null;

  const source = normalizeThemeText(`${member.team} ${member.role} ${member.accessLevel}`);
  const icon = categoryTheme("NUCLEO", "color").icon;
  const themes: Array<{ matches: string[]; template: CredentialPassTemplate }> = [
    {
      matches: ["presid", "govern", "direcao"],
      template: { primary: "#0f172a", light: "#f1f5f9", accent: "#475569", footerLabel: "Direção do Núcleo", icon },
    },
    {
      matches: ["secretaria", "secretario", "arquivo", "expediente"],
      template: { primary: "#0f766e", light: "#f0fdfa", accent: "#14b8a6", footerLabel: "Secretaria Executiva", icon },
    },
    {
      matches: ["tesour", "patrimonio", "financ"],
      template: { primary: "#92400e", light: "#fffbeb", accent: "#d97706", footerLabel: "Tesouraria e Património", icon },
    },
    {
      matches: ["academ", "formacao", "curso", "mentoria"],
      template: { primary: "#3730a3", light: "#eef2ff", accent: "#6366f1", footerLabel: "Assuntos Académicos", icon },
    },
    {
      matches: ["tecnologia", "sistema", "dados", "tecnica"],
      template: { primary: "#075985", light: "#f0f9ff", accent: "#0284c7", footerLabel: "Tecnologia e Dados", icon },
    },
    {
      matches: ["comunicacao", "imagem", "media", "conteudo"],
      template: { primary: "#9f1239", light: "#fff1f2", accent: "#e11d48", footerLabel: "Comunicação e Imagem", icon },
    },
    {
      matches: ["evento", "projeto", "inovacao", "atividade"],
      template: { primary: "#065f46", light: "#ecfdf5", accent: "#059669", footerLabel: "Eventos e Projetos", icon },
    },
    {
      matches: ["relacoes", "parceria", "institucional", "externa"],
      template: { primary: "#134e4a", light: "#f0fdfa", accent: "#0d9488", footerLabel: "Relações e Parcerias", icon },
    },
    {
      matches: ["logistica", "protocolo", "operacao", "credenciacao"],
      template: { primary: "#164e63", light: "#ecfeff", accent: "#0891b2", footerLabel: "Logística e Protocolo", icon },
    },
    {
      matches: ["apoio", "colabor", "staff"],
      template: { primary: "#374151", light: "#f9fafb", accent: "#6b7280", footerLabel: "Apoio Operacional", icon },
    },
  ];
  const match = themes.find((theme) => theme.matches.some((needle) => source.includes(needle)));
  return match ? maybeBlackWhiteTemplate(match.template, printMode) : null;
}

type CredentialPrintTemplateRow = {
  category: string;
  primaryColor: string;
  accentColor: string;
  lightColor: string;
  footerLabel: string | null;
  updatedAt: Date;
  updatedByStudentNumber: string | null;
};

function mergeCredentialPrintTemplate(
  category: string,
  row: CredentialPrintTemplateRow | null | undefined,
  printMode: CredentialPassOptions["printMode"] = "color",
): CredentialPassTemplate {
  const base = categoryTheme(category, "color");
  const customized: CredentialPassTemplate = row
    ? {
      ...base,
      primary: row.primaryColor,
      accent: row.accentColor,
      light: row.lightColor,
      footerLabel: row.footerLabel?.trim() || base.footerLabel,
    }
    : base;

  if (printMode === "black-white") {
    return {
      ...customized,
      primary: "#111827",
      accent: "#475569",
      light: "#f8fafc",
    };
  }

  return customized;
}

function serializeCredentialPrintTemplate(category: string, row: CredentialPrintTemplateRow | null | undefined) {
  const base = categoryTheme(category, "color");
  return {
    category,
    categoryLabel: categoryLabel(category),
    primaryColor: row?.primaryColor ?? base.primary,
    accentColor: row?.accentColor ?? base.accent,
    lightColor: row?.lightColor ?? base.light,
    footerLabel: row?.footerLabel ?? base.footerLabel,
    isCustomized: Boolean(row),
    updatedAt: row?.updatedAt.toISOString() ?? null,
    updatedByStudentNumber: row?.updatedByStudentNumber ?? null,
  };
}

async function loadCredentialPassTemplateRow(category: string) {
  return prisma.credentialPrintTemplate.findUnique({ where: { category } });
}

async function loadCredentialPassTemplatesForCategories(
  categories: string[],
) {
  const uniqueCategories = Array.from(new Set(categories.filter(Boolean)));
  const rows = await prisma.credentialPrintTemplate.findMany({
    where: { category: { in: uniqueCategories } },
  });
  return new Map(rows.map((row) => [row.category, row]));
}

export function credentialThemeForMember(
  member: Pick<EventTeamCredentialRecord, "category" | "team" | "role" | "accessLevel">,
  row: CredentialPrintTemplateRow | null | undefined,
  printMode: CredentialPassOptions["printMode"] = "color",
) {
  if (row) return mergeCredentialPrintTemplate(member.category, row, printMode);
  return nucleusFunctionTheme(member, printMode) ?? categoryTheme(member.category, printMode);
}

function buildCredentialPassHtml(params: {
  member: EventTeamCredentialRecord;
  logoDataUri: string | null;
  frontQrDataUri: string;
  backQrDataUri: string;
  frontQrLabel: string;
  backQrLabel: string;
  siteUrl: string;
  profileUrl: string;
  options?: CredentialPassOptions;
  template?: CredentialPassTemplate;
}) {
  const member = params.member;
  const options: CredentialPassOptions = params.options ?? {
    printMode: "color",
    side: "both",
    layout: "single",
    duplexMode: "long-edge",
    marginMm: 18,
    bleedMm: 4,
    laminationMarginMm: 3,
  };
  const name = member.name ?? "Membro UOR Connect";
  const catLabel = categoryLabel(member.category);
  const theme = params.template ?? categoryTheme(member.category, options.printMode);
  const subtitle = [member.team, member.role].filter(Boolean).join(" · ") || "Equipa UOR Connect";
  const issuedAtLabel = member.issuedAt
    ? new Intl.DateTimeFormat("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(member.issuedAt)
    : null;
  const expiresAtLabel = member.expiresAt
    ? new Intl.DateTimeFormat("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(member.expiresAt)
    : null;
  const submissionInfo = (() => {
    if (member.category !== "EXPOSITOR" || !member.sourceSubmissionName) return null;
    return { name: member.sourceSubmissionName, type: member.sourceSubmissionType ?? "PROJECT" };
  })();

  const marginMm = options.marginMm;
  const bleedMm = options.bleedMm;
  const cardW = cr80CardWidthMm, cardH = cr80CardHeightMm, moldW = cr80CardWidthMm, moldH = cr80CardHeightMm;
  const designW = passDesignWidthMm, designH = passDesignHeightMm;
  const scaleX = cardW / designW, scaleY = cardH / designH;
  const cutL = (210 - cardW) / 2, cutT = (297 - cardH) / 2;
  const moldL = (210 - moldW) / 2, moldT = (297 - moldH) / 2;
  const safeL = cutL + bleedMm, safeT = cutT + bleedMm;
  const safeW = cardW - bleedMm * 2, safeH = cardH - bleedMm * 2;

  const css = `
    @page{size:A4;margin:0}
    *{box-sizing:border-box;margin:0;padding:0}
    body{width:210mm;min-height:297mm;font-family:'Space Grotesk','DM Sans',Arial,sans-serif;background:#eef0f4;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .sheet{position:relative;width:210mm;height:297mm;padding:${marginMm}mm;display:grid;place-items:center;background:#eef0f4}
    .cut{position:absolute;width:10mm;height:10mm;border-color:#94a3b8}
    .cut.tl{top:${cutT-3}mm;left:${cutL-3}mm;border-top:.3mm solid;border-left:.3mm solid}
    .cut.tr{top:${cutT-3}mm;right:${cutL-3}mm;border-top:.3mm solid;border-right:.3mm solid}
    .cut.bl{bottom:${cutT-3}mm;left:${cutL-3}mm;border-bottom:.3mm solid;border-left:.3mm solid}
    .cut.br{bottom:${cutT-3}mm;right:${cutL-3}mm;border-bottom:.3mm solid;border-right:.3mm solid}
    .mold-line{position:absolute;left:${moldL}mm;top:${moldT}mm;width:${moldW}mm;height:${moldH}mm;border:.18mm solid rgba(100,116,139,.22);border-radius:6mm;pointer-events:none}
    .cut-line{position:absolute;left:${cutL}mm;top:${cutT}mm;width:${cardW}mm;height:${cardH}mm;border:.32mm solid rgba(15,23,42,.5);border-radius:4.5mm;pointer-events:none}
    .safe-line{position:absolute;left:${safeL}mm;top:${safeT}mm;width:${safeW}mm;height:${safeH}mm;border:.2mm dashed ${theme.accent}55;border-radius:3.5mm;pointer-events:none}
    .print-note{position:absolute;left:${marginMm}mm;right:${marginMm}mm;top:${marginMm-5}mm;display:flex;justify-content:space-between;color:#64748b;font-size:7px;letter-spacing:.06em;text-transform:uppercase}
    .pass{position:relative;width:${cardW}mm;height:${cardH}mm;overflow:hidden;border-radius:3.18mm;background:#fff;box-shadow:0 4mm 14mm rgba(15,23,42,.12)}
    .pass-inner{position:absolute;left:0;top:0;width:${designW}mm;height:${designH}mm;overflow:hidden;border-radius:4.5mm;background:#fff;transform:scale(${scaleX},${scaleY});transform-origin:top left}
    .accent-bar{position:absolute;left:0;top:0;bottom:0;width:1.6mm;background:${theme.primary};z-index:10}
    .pass-top{position:relative;height:60%;overflow:hidden;background:${theme.primary};display:flex;flex-direction:column;justify-content:space-between;padding:4mm 5mm 0}
    .pass-top-bar{display:flex;align-items:center;justify-content:space-between;position:relative;z-index:3}
    .logo-text{font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.85)}
    .logo-text img{max-width:24mm;max-height:7mm;object-fit:contain;filter:brightness(0) invert(1)}
    .ed-pill{font-size:6px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${theme.accent};border:.2mm solid ${theme.accent}55;border-radius:999px;padding:.8mm 2mm}
    .big-cat{position:relative;z-index:2;padding-bottom:5mm}
    .big-cat .l1{display:block;font-size:26px;font-weight:700;line-height:.9;letter-spacing:-.03em;text-transform:uppercase;color:#fff}
    .big-cat .l2{display:block;font-size:22px;font-weight:700;line-height:.88;letter-spacing:-.025em;text-transform:uppercase;color:rgba(255,255,255,.4)}
    .ghost{position:absolute;right:4mm;bottom:8mm;width:auto;font-size:56px;font-weight:700;line-height:.75;letter-spacing:-.05em;text-align:right;text-transform:uppercase;color:rgba(255,255,255,.05);z-index:1;pointer-events:none;white-space:nowrap}
    .front-site-qr-watermark{position:absolute;left:50%;top:21.5mm;width:30mm;height:30mm;transform:translateX(-50%);z-index:2;opacity:.105;pointer-events:none}
    .front-site-qr-watermark img{display:block;width:100%;height:100%;filter:brightness(0) invert(1)}
    .pass-bot{height:40%;display:flex;flex-direction:column;justify-content:center;padding:0 5mm;background:${theme.light}}
    .pname{font-size:16.8px;font-weight:700;line-height:1.03;letter-spacing:-.01em;color:${theme.primary}}
    .pmeta{margin-top:1.7mm;font-size:9.8px;font-weight:500;color:${theme.primary};opacity:.64;letter-spacing:.02em}
    .pid{position:absolute;bottom:3mm;right:5mm;font-size:6.5px;font-weight:700;letter-spacing:.1em;color:${theme.primary};opacity:.25;font-variant-numeric:tabular-nums}
    .pline{position:absolute;bottom:0;left:0;right:0;height:1.2mm;background:${theme.accent}}
    ${submissionInfo ? `.proj-tag{margin-top:2mm;display:inline-block;background:${theme.accent}18;border:.2mm solid ${theme.accent}33;border-radius:999px;padding:.8mm 2.5mm;font-size:7.5px;font-weight:700;color:${theme.accent};text-transform:uppercase;letter-spacing:.06em}` : ""}
    .back-sheet{page-break-before:always;break-before:page}
    .back .pass-top{height:38%}
    .back .big-cat .l1{font-size:18px}
    .back .ghost{font-size:42px;bottom:4mm}
    .back .pass-bot{height:62%;justify-content:flex-start;padding-top:3.5mm}
    .bid-card{background:${theme.primary}08;border:.2mm solid ${theme.accent}30;border-radius:2.5mm;padding:2.5mm 3mm;margin-bottom:2.5mm}
    .bid-card .blb{font-size:7.2px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${theme.accent}}
    .bid-card .bname{font-size:13.5px;font-weight:700;color:${theme.primary};margin-top:1mm;line-height:1.1}
    .bid-card .bsub{font-size:8px;color:${theme.primary};opacity:.58;margin-top:.5mm}
    .qr-row{display:flex;gap:2.5mm;align-items:center;background:${theme.primary}06;border:.2mm solid ${theme.accent}20;border-radius:2.5mm;padding:2.5mm;margin-bottom:2.5mm}
    .qr-sq{width:24mm;height:24mm;flex-shrink:0}
    .qr-sq img{width:24mm;height:24mm;display:block}
    .qt2{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${theme.accent}}
    .qu2{font-size:7.2px;color:${theme.primary};opacity:.58;margin-top:1mm;line-height:1.3;overflow-wrap:anywhere}
    .mrow{display:grid;grid-template-columns:1fr 1fr;gap:1.2mm}
    .mcell{background:${theme.primary}06;border-radius:1.8mm;padding:1.5mm 2mm}
    .mcell .mlab{font-size:6.2px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${theme.primary};opacity:.48}
    .mcell .mval{font-size:8.4px;font-weight:600;color:${theme.primary};margin-top:.3mm}
    body.print-mode-bw .pass-top,body.print-mode-bw .accent-bar{background:#111827!important}
    body.print-mode-bw .pass-bot{background:#f8fafc!important}
  `;

  const logoTag = params.logoDataUri
    ? `<img src="${params.logoDataUri}" alt="UOR Connect" />`
    : `UOR CONNECT`;

  // Use footerLabel for nucleus sub-areas (more specific than generic "Núcleo")
  const displayLabel = theme.footerLabel || catLabel;
  const catUpper = displayLabel.toUpperCase();
  const catGhost = catUpper.slice(0, 3);

  const frontHtml = `
    <div class="sheet front-sheet">
      <div class="print-note"><span>UOR Connect · ${escapeHtml(catLabel)} · Frente</span><span>CR-80 PVC · 53,98×85,60 mm</span></div>
      <span class="cut tl"></span><span class="cut tr"></span><span class="cut bl"></span><span class="cut br"></span>
      <div class="mold-line"></div><div class="cut-line"></div><div class="safe-line"></div>
      <article class="pass">
        <div class="pass-inner">
          <div class="accent-bar"></div>
          <div class="pass-top">
            <div class="pass-top-bar">
              <span class="logo-text">${logoTag}</span>
              <span class="ed-pill">WORKSHOP 2026</span>
            </div>
            <div class="front-site-qr-watermark" aria-label="${escapeHtml(params.frontQrLabel)}">
              <img src="${params.frontQrDataUri}" alt="${escapeHtml(params.frontQrLabel)}" />
            </div>
            <div class="big-cat">
              <span class="l1">${escapeHtml(catUpper)}</span>
            </div>
            <div class="ghost">${escapeHtml(catGhost)}</div>
          </div>
          <div class="pass-bot">
            <div class="pname">${escapeHtml(name)}</div>
            <div class="pmeta">${escapeHtml(subtitle)}</div>
            ${submissionInfo ? `<span class="proj-tag">${escapeHtml(submissionInfo.type === "PROJECT" ? "Projeto" : submissionInfo.type === "BUSINESS" ? "Negócio" : "Produto")} · ${escapeHtml(submissionInfo.name)}</span>` : ""}
            <div class="pid">#${member.id.toString().padStart(4, "0")}</div>
            <div class="pline"></div>
          </div>
        </div>
      </article>
    </div>`;

  const backHtml = options.side === "front" ? "" : `
    <div class="sheet back-sheet">
      <div class="print-note"><span>UOR Connect · ${escapeHtml(catLabel)} · Verso</span><span>CR-80 PVC · 53,98×85,60 mm</span></div>
      <span class="cut tl"></span><span class="cut tr"></span><span class="cut bl"></span><span class="cut br"></span>
      <div class="mold-line"></div><div class="cut-line"></div><div class="safe-line"></div>
      <article class="pass back">
        <div class="pass-inner">
          <div class="accent-bar"></div>
          <div class="pass-top">
            <div class="pass-top-bar">
              <span class="logo-text">${logoTag}</span>
              <span class="ed-pill">VERSO</span>
            </div>
            <div class="big-cat"><span class="l1">${escapeHtml(catUpper)}</span></div>
            <div class="ghost">${escapeHtml(catGhost)}</div>
          </div>
          <div class="pass-bot">
            <div class="bid-card">
              <div class="blb">${escapeHtml(theme.footerLabel)}</div>
              <div class="bname">${escapeHtml(name)}</div>
              <div class="bsub">${escapeHtml(subtitle)}</div>
            </div>
            <div class="qr-row">
              <div class="qr-sq"><img src="${params.backQrDataUri}" alt="QR" /></div>
              <div>
                <div class="qt2">${escapeHtml(params.backQrLabel)}</div>
                <div class="qu2">${escapeHtml(params.profileUrl)}</div>
              </div>
            </div>
            <div class="mrow">
              <div class="mcell"><div class="mlab">ID</div><div class="mval">#${member.id.toString().padStart(4, "0")}</div></div>
              <div class="mcell"><div class="mlab">Versão</div><div class="mval">v${member.version}</div></div>
              <div class="mcell"><div class="mlab">Emitido</div><div class="mval">${escapeHtml(issuedAtLabel ?? "—")}</div></div>
              <div class="mcell"><div class="mlab">Validade</div><div class="mval">${escapeHtml(expiresAtLabel ?? "Conf. evento")}</div></div>
            </div>
            <div class="pline"></div>
          </div>
        </div>
      </article>
    </div>`;

  const bodyClass = options.printMode === "black-white" ? "print-mode-bw" : "print-mode-color";
  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Passe ${escapeHtml(name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>${css}</style>
</head>
<body class="${bodyClass}">
  ${options.side === "back" ? "" : frontHtml}
  ${backHtml}
</body>
</html>`;
}


async function sendCredentialPassPdf(
  reply: FastifyReply,
  env: Env,
  member: EventTeamCredentialRecord,
  options: CredentialPassOptions = {
    printMode: "color",
    side: "both",
    layout: "single",
    duplexMode: "long-edge",
    marginMm: 18,
    bleedMm: 4,
    laminationMarginMm: 3,
  },
) {
  const [qrTargets, logoDataUri] = await Promise.all([
    resolveCredentialPassQrTargets(env, member, 720),
    loadLogoDataUri(),
  ]);
  const templateRow = await loadCredentialPassTemplateRow(member.category);
  const template = credentialThemeForMember(member, templateRow, options.printMode);
  const html = buildCredentialPassHtml({
    member,
    logoDataUri,
    frontQrDataUri: qrTargets.frontQrDataUri,
    backQrDataUri: qrTargets.backQrDataUri,
    frontQrLabel: qrTargets.frontQrLabel,
    backQrLabel: qrTargets.backQrLabel,
    siteUrl: qrTargets.siteUrl,
    profileUrl: qrTargets.backUrl,
    options,
    template,
  });
  const buffer = await renderPdfFromHtml(html, {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  const issuedAt = new Date();
  const passSnapshot = {
    documentType: "TEAM_CREDENTIAL_PASS",
    credentialId: member.id,
    publicSlug: member.publicSlug,
    tokenHashPurpose: qrTargets.tokenHashPurpose,
    holderName: member.name,
    category: member.category,
    team: member.team,
    role: member.role,
    accessLevel: member.accessLevel,
    version: member.version,
    issuedAt: member.issuedAt?.toISOString() ?? null,
    expiresAt: member.expiresAt?.toISOString() ?? null,
    generatedAt: issuedAt.toISOString(),
    siteUrl: qrTargets.siteUrl,
    profileUrl: qrTargets.profileUrl,
    frontQrUrl: qrTargets.frontUrl,
    backQrUrl: qrTargets.backUrl,
    print: options,
    template: {
      primaryColor: template.primary,
      accentColor: template.accent,
      lightColor: template.light,
      footerLabel: template.footerLabel,
    },
  };

  await prisma.eventTeamCredential.update({
    where: { id: member.id },
    data: {
      lastPassIssuedAt: issuedAt,
      lastPassSnapshotJson: JSON.stringify(passSnapshot),
    },
  });

  const fileName = `Passe_${safeFileName(member.name ?? member.publicSlug)}.pdf`;
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `inline; filename="${fileName}"`)
    .send(buffer);
}

export type CredentialPassPrintItem = {
  member: EventTeamCredentialRecord;
  frontQrDataUri: string;
  backQrDataUri: string;
  frontQrLabel: string;
  backQrLabel: string;
  siteUrl: string;
  profileUrl: string;
  template: CredentialPassTemplate;
};

export function buildCredentialPassPrintContent(params: {
  items: CredentialPassPrintItem[];
  logoDataUri: string | null;
  options: CredentialPassOptions;
  notePrefix?: string;
  formatLabel?: string;
  pageNumberOffset?: number;
}) {
  const notePrefix = params.notePrefix ?? "UOR Connect · Lote";
  const formatLabel = params.formatLabel ?? "CR-80 PVC";
  const pageNumberOffset = params.pageNumberOffset ?? 0;
  const marginMm = params.options.marginMm;
  const bleedMm = params.options.bleedMm;
  const cardW = cr80CardWidthMm, cardH = cr80CardHeightMm, moldW = cr80CardWidthMm, moldH = cr80CardHeightMm;
  const designW = passDesignWidthMm, designH = passDesignHeightMm;
  const scaleX = cardW / designW, scaleY = cardH / designH;
  const cutL = (210 - cardW) / 2, cutT = (297 - cardH) / 2;
  const moldL = (210 - moldW) / 2, moldT = (297 - moldH) / 2;
  const safeL = cutL + bleedMm, safeT = cutT + bleedMm;
  const safeW = cardW - bleedMm * 2, safeH = cardH - bleedMm * 2;

  const sheetCss = `
    @page{size:A4;margin:0}
    .credential-pass-print{width:210mm;min-height:297mm;font-family:'Space Grotesk','DM Sans',Arial,sans-serif;background:#eef0f4;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .credential-pass-print *{box-sizing:border-box;margin:0;padding:0}
    .sheet{position:relative;width:210mm;height:297mm;padding:${marginMm}mm;display:grid;place-items:center;background:#eef0f4;page-break-after:always;break-after:page}
    .sheet:last-child{page-break-after:auto;break-after:auto}
    .cut{position:absolute;width:10mm;height:10mm;border-color:#94a3b8}
    .cut.tl{top:${cutT-3}mm;left:${cutL-3}mm;border-top:.3mm solid;border-left:.3mm solid}
    .cut.tr{top:${cutT-3}mm;right:${cutL-3}mm;border-top:.3mm solid;border-right:.3mm solid}
    .cut.bl{bottom:${cutT-3}mm;left:${cutL-3}mm;border-bottom:.3mm solid;border-left:.3mm solid}
    .cut.br{bottom:${cutT-3}mm;right:${cutL-3}mm;border-bottom:.3mm solid;border-right:.3mm solid}
    .mold-line{position:absolute;left:${moldL}mm;top:${moldT}mm;width:${moldW}mm;height:${moldH}mm;border:.18mm solid rgba(100,116,139,.22);border-radius:6mm;pointer-events:none}
    .cut-line{position:absolute;left:${cutL}mm;top:${cutT}mm;width:${cardW}mm;height:${cardH}mm;border:.32mm solid rgba(15,23,42,.5);border-radius:4.5mm;pointer-events:none}
    .safe-line{position:absolute;left:${safeL}mm;top:${safeT}mm;width:${safeW}mm;height:${safeH}mm;border:.2mm dashed var(--acc55);border-radius:3.5mm;pointer-events:none}
    .print-note{position:absolute;left:${marginMm}mm;right:${marginMm}mm;top:${marginMm-5}mm;display:flex;justify-content:space-between;color:#64748b;font-size:7px;letter-spacing:.06em;text-transform:uppercase}
    .pass{position:relative;width:${cardW}mm;height:${cardH}mm;overflow:hidden;border-radius:3.18mm;background:#fff;box-shadow:0 4mm 14mm rgba(15,23,42,.12)}
    .pass-inner{position:absolute;left:0;top:0;width:${designW}mm;height:${designH}mm;overflow:hidden;border-radius:4.5mm;background:#fff;transform:scale(${scaleX},${scaleY});transform-origin:top left}
    .accent-bar{position:absolute;left:0;top:0;bottom:0;width:1.6mm;background:var(--pri);z-index:10}
    .pass-top{position:relative;height:60%;overflow:hidden;background:var(--pri);display:flex;flex-direction:column;justify-content:space-between;padding:4mm 5mm 0}
    .pass-top-bar{display:flex;align-items:center;justify-content:space-between;position:relative;z-index:3}
    .logo-text{font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.85)}
    .logo-text img{max-width:24mm;max-height:7mm;object-fit:contain;filter:brightness(0) invert(1)}
    .ed-pill{font-size:6px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--acc);border:.2mm solid var(--acc55);border-radius:999px;padding:.8mm 2mm}
    .big-cat{position:relative;z-index:2;padding-bottom:5mm}
    .big-cat .l1{display:block;font-size:26px;font-weight:700;line-height:.9;letter-spacing:-.03em;text-transform:uppercase;color:#fff}
    .ghost{position:absolute;right:4mm;bottom:8mm;width:auto;font-size:56px;font-weight:700;line-height:.75;letter-spacing:-.05em;text-align:right;text-transform:uppercase;color:rgba(255,255,255,.05);z-index:1;pointer-events:none;white-space:nowrap}
    .front-site-qr-watermark{position:absolute;left:50%;top:21.5mm;width:30mm;height:30mm;transform:translateX(-50%);z-index:2;opacity:.105;pointer-events:none}
    .front-site-qr-watermark img{display:block;width:100%;height:100%;filter:brightness(0) invert(1)}
    .pass-bot{height:40%;display:flex;flex-direction:column;justify-content:center;padding:0 5mm;background:var(--lt)}
    .pname{font-size:16.8px;font-weight:700;line-height:1.03;letter-spacing:-.01em;color:var(--pri)}
    .pmeta{margin-top:1.7mm;font-size:9.8px;font-weight:500;color:var(--pri);opacity:.64;letter-spacing:.02em}
    .pid{position:absolute;bottom:3mm;right:5mm;font-size:6.5px;font-weight:700;letter-spacing:.1em;color:var(--pri);opacity:.25;font-variant-numeric:tabular-nums}
    .pline{position:absolute;bottom:0;left:0;right:0;height:1.2mm;background:var(--acc)}
    .proj-tag{margin-top:2mm;display:inline-block;background:var(--acc18);border:.2mm solid var(--acc33);border-radius:999px;padding:.8mm 2.5mm;font-size:7.5px;font-weight:700;color:var(--acc);text-transform:uppercase;letter-spacing:.06em}
    .back .pass-top{height:38%}
    .back .big-cat .l1{font-size:18px}
    .back .ghost{font-size:42px;bottom:4mm}
    .back .pass-bot{height:62%;justify-content:flex-start;padding-top:3.5mm}
    .bid-card{background:var(--pri08);border:.2mm solid var(--acc30);border-radius:2.5mm;padding:2.5mm 3mm;margin-bottom:2.5mm}
    .bid-card .blb{font-size:7.2px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--acc)}
    .bid-card .bname{font-size:13.5px;font-weight:700;color:var(--pri);margin-top:1mm;line-height:1.1}
    .bid-card .bsub{font-size:8px;color:var(--pri);opacity:.58;margin-top:.5mm}
    .qr-row{display:flex;gap:2.5mm;align-items:center;background:var(--pri06);border:.2mm solid var(--acc20);border-radius:2.5mm;padding:2.5mm;margin-bottom:2.5mm}
    .qr-sq{width:24mm;height:24mm;flex-shrink:0}
    .qr-sq img{width:24mm;height:24mm;display:block}
    .qt2{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--acc)}
    .qu2{font-size:7.2px;color:var(--pri);opacity:.58;margin-top:1mm;line-height:1.3;overflow-wrap:anywhere}
    .mrow{display:grid;grid-template-columns:1fr 1fr;gap:1.2mm}
    .mcell{background:var(--pri06);border-radius:1.8mm;padding:1.5mm 2mm}
    .mcell .mlab{font-size:6.2px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--pri);opacity:.48}
    .mcell .mval{font-size:8.4px;font-weight:600;color:var(--pri);margin-top:.3mm}
    .credential-pass-print.print-mode-bw .pass-top,.credential-pass-print.print-mode-bw .accent-bar{background:#111827!important}
    .credential-pass-print.print-mode-bw .pass-bot{background:#f8fafc!important}
  `;

  const renderFrontPass = (item: CredentialPassPrintItem) => {
    const m = item.member;
    const t = item.template;
    const cat = (t.footerLabel || categoryLabel(m.category)).toUpperCase();
    const ghost = cat.slice(0, 3);
    const name = m.name ?? "Membro UOR Connect";
    const subtitle = [m.team, m.role].filter(Boolean).join(" · ") || t.footerLabel;
    const submissionInfo = m.category === "EXPOSITOR" && m.sourceSubmissionName
      ? { name: m.sourceSubmissionName, type: m.sourceSubmissionType ?? "PROJECT" } : null;
    const logo = params.logoDataUri
      ? `<img src="${params.logoDataUri}" alt="UOR Connect" />`
      : `UOR CONNECT`;
    const vars = `--pri:${t.primary};--acc:${t.accent};--lt:${t.light};--acc55:${t.accent}55;--acc33:${t.accent}33;--acc18:${t.accent}18;--acc30:${t.accent}30;--acc20:${t.accent}20;--pri08:${t.primary}08;--pri06:${t.primary}06`;
    return `<article class="pass" style="${vars}">
      <div class="pass-inner">
        <div class="accent-bar"></div>
        <div class="pass-top">
          <div class="pass-top-bar"><span class="logo-text">${logo}</span><span class="ed-pill">WORKSHOP 2026</span></div>
          <div class="front-site-qr-watermark" aria-label="${escapeHtml(item.frontQrLabel)}"><img src="${item.frontQrDataUri}" alt="${escapeHtml(item.frontQrLabel)}" /></div>
          <div class="big-cat"><span class="l1">${escapeHtml(cat)}</span></div>
          <div class="ghost">${escapeHtml(ghost)}</div>
        </div>
        <div class="pass-bot">
          <div class="pname">${escapeHtml(name)}</div>
          <div class="pmeta">${escapeHtml(subtitle)}</div>
          ${submissionInfo ? `<span class="proj-tag">${escapeHtml(submissionInfo.type === "PROJECT" ? "Projeto" : submissionInfo.type === "BUSINESS" ? "Negócio" : "Produto")} · ${escapeHtml(submissionInfo.name)}</span>` : ""}
          <div class="pid">#${m.id.toString().padStart(4, "0")}</div>
          <div class="pline"></div>
        </div>
      </div>
    </article>`;
  };

  const renderBackPass = (item: CredentialPassPrintItem) => {
    const m = item.member;
    const t = item.template;
    const cat = (t.footerLabel || categoryLabel(m.category)).toUpperCase();
    const ghost = cat.slice(0, 3);
    const name = m.name ?? "Membro UOR Connect";
    const subtitle = [m.team, m.role].filter(Boolean).join(" · ") || "Equipa UOR Connect";
    const issuedAt = m.issuedAt
      ? new Intl.DateTimeFormat("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(m.issuedAt) : "—";
    const expiresAt = m.expiresAt
      ? new Intl.DateTimeFormat("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(m.expiresAt) : "Conf. evento";
    const logo = params.logoDataUri
      ? `<img src="${params.logoDataUri}" alt="UOR Connect" />`
      : `UOR CONNECT`;
    const vars = `--pri:${t.primary};--acc:${t.accent};--lt:${t.light};--acc55:${t.accent}55;--acc33:${t.accent}33;--acc30:${t.accent}30;--acc20:${t.accent}20;--acc18:${t.accent}18;--pri08:${t.primary}08;--pri06:${t.primary}06`;
    return `<article class="pass back" style="${vars}">
      <div class="pass-inner">
        <div class="accent-bar"></div>
        <div class="pass-top">
          <div class="pass-top-bar"><span class="logo-text">${logo}</span><span class="ed-pill">VERSO</span></div>
          <div class="big-cat"><span class="l1">${escapeHtml(cat)}</span></div>
          <div class="ghost">${escapeHtml(ghost)}</div>
        </div>
        <div class="pass-bot">
          <div class="bid-card">
            <div class="blb">${escapeHtml(t.footerLabel)}</div>
            <div class="bname">${escapeHtml(name)}</div>
            <div class="bsub">${escapeHtml(subtitle)}</div>
          </div>
          <div class="qr-row">
            <div class="qr-sq"><img src="${item.backQrDataUri}" alt="QR" /></div>
            <div>
              <div class="qt2">${escapeHtml(item.backQrLabel)}</div>
              <div class="qu2">${escapeHtml(item.profileUrl)}</div>
            </div>
          </div>
          <div class="mrow">
            <div class="mcell"><div class="mlab">ID</div><div class="mval">#${m.id.toString().padStart(4, "0")}</div></div>
            <div class="mcell"><div class="mlab">Versão</div><div class="mval">v${m.version}</div></div>
            <div class="mcell"><div class="mlab">Emitido</div><div class="mval">${escapeHtml(issuedAt)}</div></div>
            <div class="mcell"><div class="mlab">Validade</div><div class="mval">${escapeHtml(expiresAt)}</div></div>
          </div>
          <div class="pline"></div>
        </div>
      </div>
    </article>`;
  };

  const buildFourUpContent = () => {
    const laminationMarginMm = params.options.laminationMarginMm;
    const laminationW = cardW + laminationMarginMm * 2;
    const laminationH = cardH + laminationMarginMm * 2;
    const gapX = 12;
    const gapY = 12;
    const gridW = laminationW * 2 + gapX;
    const gridH = laminationH * 2 + gapY;
    const startX = (210 - gridW) / 2;
    const startY = (297 - gridH) / 2;
    const slotPositions = [
      { left: startX, top: startY },
      { left: startX + laminationW + gapX, top: startY },
      { left: startX, top: startY + laminationH + gapY },
      { left: startX + laminationW + gapX, top: startY + laminationH + gapY },
    ];
    const laminationLabel = `${laminationW.toFixed(2).replace(".", ",")}×${laminationH.toFixed(2).replace(".", ",")} mm`;

    const fourUpCss = `
      .credential-pass-print.layout-4up{background:#f8fafc}
      .credential-pass-print.layout-4up .sheet{display:block;padding:0;background:#f8fafc}
      .four-up-note{position:absolute;left:14mm;right:14mm;top:10mm;display:flex;align-items:flex-start;justify-content:space-between;gap:8mm;color:#475569;font-size:7px;letter-spacing:.06em;text-transform:uppercase}
      .four-up-note strong{display:block;color:#0f172a;font-size:8px;letter-spacing:.08em}
      .four-up-note span{display:block;margin-top:1mm}
      .registration-mark{position:absolute;width:7mm;height:7mm;border-color:#0f172a;opacity:.55}
      .registration-mark.tl{left:12mm;top:12mm;border-left:.18mm solid;border-top:.18mm solid}
      .registration-mark.tr{right:12mm;top:12mm;border-right:.18mm solid;border-top:.18mm solid}
      .registration-mark.bl{left:12mm;bottom:12mm;border-left:.18mm solid;border-bottom:.18mm solid}
      .registration-mark.br{right:12mm;bottom:12mm;border-right:.18mm solid;border-bottom:.18mm solid}
      .four-up-grid{position:absolute;left:0;top:0;width:210mm;height:297mm}
      .four-up-slot{position:absolute;width:${laminationW}mm;height:${laminationH}mm}
      ${slotPositions.map((pos, index) => `.slot-${index + 1}{left:${pos.left}mm;top:${pos.top}mm}`).join("\n")}
      .lamination-cut-line{position:absolute;inset:0;border:.24mm dashed rgba(15,23,42,.48);border-radius:${Math.max(5, 3.18 + laminationMarginMm)}mm;pointer-events:none}
      .pass-cut-line{position:absolute;left:${laminationMarginMm}mm;top:${laminationMarginMm}mm;width:${cardW}mm;height:${cardH}mm;border:.22mm solid rgba(15,23,42,.82);border-radius:3.18mm;pointer-events:none}
      .slot-corner{position:absolute;width:5mm;height:5mm;border-color:#0f172a;opacity:.75}
      .slot-corner.tl{left:-1.8mm;top:-1.8mm;border-left:.2mm solid;border-top:.2mm solid}
      .slot-corner.tr{right:-1.8mm;top:-1.8mm;border-right:.2mm solid;border-top:.2mm solid}
      .slot-corner.bl{left:-1.8mm;bottom:-1.8mm;border-left:.2mm solid;border-bottom:.2mm solid}
      .slot-corner.br{right:-1.8mm;bottom:-1.8mm;border-right:.2mm solid;border-bottom:.2mm solid}
      .guide-label{position:absolute;left:${laminationMarginMm}mm;font-size:5.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#334155;background:#f8fafc;padding:.5mm 1mm;border-radius:999px}
      .pass-cut-label{top:${Math.max(0.4, laminationMarginMm - 2.6)}mm}
      .lamination-cut-label{left:1.2mm;bottom:1mm;color:#64748b}
      .four-up-slot .pass{position:absolute;left:${laminationMarginMm}mm;top:${laminationMarginMm}mm;box-shadow:none}
      .four-up-slot.blank::after{content:"";position:absolute;left:${laminationMarginMm}mm;top:${laminationMarginMm}mm;width:${cardW}mm;height:${cardH}mm;border-radius:3.18mm;background:rgba(226,232,240,.18)}
      .four-up-footer{position:absolute;left:14mm;right:14mm;bottom:10mm;display:flex;justify-content:space-between;color:#64748b;font-size:7px;letter-spacing:.04em}
    `;

    const backSlotOrder = (() => {
      if (params.options.duplexMode === "short-edge") return [2, 3, 0, 1];
      if (params.options.duplexMode === "same-position") return [0, 1, 2, 3];
      return [1, 0, 3, 2];
    })();

    const chunkItems = (items: CredentialPassPrintItem[]) => {
      const chunks: CredentialPassPrintItem[][] = [];
      for (let index = 0; index < items.length; index += 4) {
        chunks.push(items.slice(index, index + 4));
      }
      return chunks.length > 0 ? chunks : [[]];
    };

    const arrangeBackChunk = (chunk: CredentialPassPrintItem[]) =>
      backSlotOrder.map((sourceIndex) => chunk[sourceIndex] ?? null);

    const renderFourUpSlot = (item: CredentialPassPrintItem | null, side: "front" | "back", index: number) => (
      `<div class="four-up-slot slot-${index + 1}${item ? "" : " blank"}" data-slot="${index + 1}"${item ? ` data-credential-id="${item.member.id}"` : ""}>
        <span class="slot-corner tl"></span><span class="slot-corner tr"></span><span class="slot-corner bl"></span><span class="slot-corner br"></span>
        <div class="lamination-cut-line"></div>
        <div class="pass-cut-line"></div>
        ${index === 0 ? `<span class="guide-label pass-cut-label">Corte do passe</span><span class="guide-label lamination-cut-label">Corte plastificacao</span>` : ""}
        ${item ? (side === "front" ? renderFrontPass(item) : renderBackPass(item)) : ""}
      </div>`
    );

    const renderFourUpSheet = (chunk: CredentialPassPrintItem[], side: "front" | "back", pageIndex: number) => {
      const slotItems = side === "back" ? arrangeBackChunk(chunk) : [chunk[0] ?? null, chunk[1] ?? null, chunk[2] ?? null, chunk[3] ?? null];
      return `<section class="sheet ${side}-sheet">
        <div class="four-up-note">
          <div>
            <strong>${escapeHtml(notePrefix)} · ${side === "front" ? "Frente" : "Verso"} · 4 por pagina</strong>
            <span>CR-80 ${cardW.toFixed(2).replace(".", ",")}×${cardH.toFixed(2).replace(".", ",")} mm · plastificacao ${laminationLabel}</span>
          </div>
          <div>
            <strong>Imprimir em 100%</strong>
            <span>Duplex: ${escapeHtml(params.options.duplexMode)} · pág. ${pageNumberOffset + pageIndex}</span>
          </div>
        </div>
        <span class="registration-mark tl"></span><span class="registration-mark tr"></span><span class="registration-mark bl"></span><span class="registration-mark br"></span>
        <div class="four-up-grid">
          ${slotItems.map((item, index) => renderFourUpSlot(item, side, index)).join("")}
        </div>
        <div class="four-up-footer">
          <span>Linha continua: corte do passe</span>
          <span>Linha tracejada: corte da plastificacao</span>
        </div>
      </section>`;
    };

    const pages: string[] = [];
    for (const chunk of chunkItems(params.items)) {
      if (params.options.side !== "back") pages.push(renderFourUpSheet(chunk, "front", pages.length + 1));
      if (params.options.side !== "front") pages.push(renderFourUpSheet(chunk, "back", pages.length + 1));
    }

    const bodyClass = params.options.printMode === "black-white" ? "print-mode-bw" : "print-mode-color";
    return {
      css: `${sheetCss}\n${fourUpCss}`,
      sheets: `<div class="credential-pass-print ${bodyClass} layout-4up">${pages.join("")}</div>`,
      bodyClass,
    };
  };

  if (params.options.layout === "a4-4up") {
    return buildFourUpContent();
  }

  const renderSheet = (item: CredentialPassPrintItem, side: "front" | "back", pageIndex: number) => {
    const cat = categoryLabel(item.member.category);
    const pageNumber = pageNumberOffset + pageIndex;
    return `<section class="sheet ${side}-sheet">
      <div class="print-note"><span>${escapeHtml(notePrefix)} · ${side === "front" ? "Frente" : "Verso"} · ${escapeHtml(cat)}</span><span>${escapeHtml(formatLabel)} · 53,98×85,60 mm · pág. ${pageNumber}</span></div>
      <span class="cut tl"></span><span class="cut tr"></span><span class="cut bl"></span><span class="cut br"></span>
      <div class="mold-line"></div><div class="cut-line"></div><div class="safe-line"></div>
      ${side === "front" ? renderFrontPass(item) : renderBackPass(item)}
    </section>`;
  };

  const pages: string[] = [];
  for (const item of params.items) {
    if (params.options.side !== "back") pages.push(renderSheet(item, "front", pages.length + 1));
    if (params.options.side !== "front") pages.push(renderSheet(item, "back", pages.length + 1));
  }

  const bodyClass = params.options.printMode === "black-white" ? "print-mode-bw" : "print-mode-color";
  return {
    css: sheetCss,
    sheets: `<div class="credential-pass-print ${bodyClass}">${pages.join("")}</div>`,
    bodyClass,
  };
}

export function buildCredentialPassBatchHtml(params: {
  items: Array<{
    member: EventTeamCredentialRecord;
    frontQrDataUri: string;
    backQrDataUri: string;
    frontQrLabel: string;
    backQrLabel: string;
    siteUrl: string;
    profileUrl: string;
    template: CredentialPassTemplate;
  }>;
  logoDataUri: string | null;
  options: CredentialPassOptions;
}) {
  const printContent = buildCredentialPassPrintContent(params);
  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Lote de passes UOR Connect</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>${printContent.css}</style>
</head>
<body class="${printContent.bodyClass}">
  ${printContent.sheets}
</body>
</html>`;
}

export function buildCredentialPassCalibrationHtml(params: {
  options: CredentialPassOptions;
}) {
  const printContent = buildCredentialPassPrintContent({
    items: [],
    logoDataUri: null,
    options: {
      ...params.options,
      side: params.options.side === "back" ? "back" : "both",
      layout: "a4-4up",
    },
    notePrefix: "UOR Connect · Teste de alinhamento",
    formatLabel: "CR-80 PVC + plastificacao",
  });

  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Teste de alinhamento dos passes UOR Connect</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>${printContent.css}</style>
</head>
<body class="${printContent.bodyClass}">
  ${printContent.sheets}
</body>
</html>`;
}


async function sendCredentialPassBatchPdf(
  reply: FastifyReply,
  env: Env,
  members: EventTeamCredentialRecord[],
  options: CredentialPassOptions,
) {
  const logoDataUri = await loadLogoDataUri();
  const templates = await loadCredentialPassTemplatesForCategories(members.map((member) => member.category));
  const items = await Promise.all(members.map(async (member) => {
    const qrTargets = await resolveCredentialPassQrTargets(env, member, 280);
    return {
      member,
      siteUrl: qrTargets.siteUrl,
      profileUrl: qrTargets.backUrl,
      template: credentialThemeForMember(member, templates.get(member.category), options.printMode),
      frontQrDataUri: qrTargets.frontQrDataUri,
      backQrDataUri: qrTargets.backQrDataUri,
      frontQrLabel: qrTargets.frontQrLabel,
      backQrLabel: qrTargets.backQrLabel,
    };
  }));
  const html = buildCredentialPassBatchHtml({ items, logoDataUri, options });
  const buffer = await renderPdfFromHtml(html, {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `inline; filename="passes-uor-connect-lote.pdf"`)
    .send(buffer);
}

async function sendCredentialPassCalibrationPdf(
  reply: FastifyReply,
  options: CredentialPassOptions,
) {
  const html = buildCredentialPassCalibrationHtml({ options });
  const buffer = await renderPdfFromHtml(html, {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `inline; filename="teste-alinhamento-passes-uor-connect.pdf"`)
    .send(buffer);
}

export async function teamCredentialsRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.get("/invitations/:token", {
    schema: {
      tags: ["Team Credentials"],
      params: z.object({ token: z.string().min(8) }),
      response: {
        200: memberResponseSchema,
        410: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const params = z.object({ token: z.string() }).parse(request.params);
    const member = await prisma.eventTeamCredential.findUnique({ where: { token: params.token } });
    if (!member || !isCredentialOperationallyUsable(member)) {
      return reply.code(404).send({ message: "Convite de credencial não encontrado." });
    }
    if (isCredentialInvitationExpired(member)) return sendInvitationExpired(reply);

    return serializeMember(opts.env, member);
  });

  app.post("/invitations/:token/submit", {
    schema: {
      tags: ["Team Credentials"],
      params: z.object({ token: z.string().min(8) }),
      body: publicSubmissionSchema,
      response: {
        200: memberResponseSchema,
        400: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
        410: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const params = z.object({ token: z.string() }).parse(request.params);
    const body = publicSubmissionSchema.parse(request.body);
    const existing = await prisma.eventTeamCredential.findUnique({ where: { token: params.token } });
    if (!existing || !isCredentialOperationallyUsable(existing)) {
      return reply.code(404).send({ message: "Convite de credencial não encontrado." });
    }
    if (isCredentialInvitationExpired(existing)) return sendInvitationExpired(reply);

    if (existing.category === "NUCLEO" || existing.category === "EXPOSITOR") {
      await auditCredentialClaimRefusal(request, {
        flow: "public_submit",
        reason: "sensitive_category_requires_protected_flow",
        token: params.token,
        credential: existing,
        metadata: { category: existing.category },
      });
      return reply.code(403).send({
        message: existing.category === "NUCLEO"
          ? "Credenciais do Núcleo exigem autenticação académica. Usa o fluxo de verificação oficial."
          : "Credenciais de expositor exigem candidatura aprovada. Usa o fluxo oficial de expositor.",
      });
    }

    if (!await hasApprovedCredentialOperationalLink(existing)) {
      await auditCredentialClaimRefusal(request, {
        flow: "public_submit",
        reason: "missing_operational_link",
        token: params.token,
        credential: existing,
      });
      return reply.code(403).send({
        message: "Esta credencial precisa de vínculo operacional validado antes de ser emitida.",
      });
    }

    const requestedPhotoUrl = normalizeOptional(body.photoUrl);
    if (requestedPhotoUrl && body.consentPhotoCredential !== true) {
      await auditCredentialClaimRefusal(request, {
        flow: "public_submit",
        reason: "photo_consent_missing",
        token: params.token,
        credential: existing,
      });
      return reply.code(400).send({ message: "Autoriza explicitamente o uso da fotografia antes de guardar a credencial." });
    }

    const storedPhotoUrl = await persistMediaValue(opts.env, requestedPhotoUrl, {
      purpose: "credential-photos",
      maxImageDimension: 900,
    });

    const member = await prisma.eventTeamCredential.update({
      where: { id: existing.id },
      data: {
        status: "PROFILE_READY",
        invitationExpiresAt: null,
        name: normalizeOptional(body.name),
        email: normalizeOptional(body.email),
        phone: normalizeOptional(body.phone),
        course: normalizeOptional(body.course),
        organization: normalizeOptional(body.organization),
        bio: normalizeOptional(body.bio),
        photoUrl: storedPhotoUrl ?? null,
        ...buildCredentialProfileExtraData(body),
        notes: null,
        submittedAt: new Date(),
      },
    });

    return serializeMember(opts.env, member);
  });

  app.register(async (protectedApp) => {
    protectedApp.register(authGuard, { env: opts.env });

    protectedApp.get("/invitations/:token/nucleus-context", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ token: z.string().min(8) }),
        response: {
          200: nucleusInvitationContextSchema,
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
        410: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
      },
    }, async (request, reply) => {
      const params = z.object({ token: z.string() }).parse(request.params);
      const studentNumber = request.student?.studentNumber;

      if (!studentNumber) {
        return reply.code(401).send({ message: "Inicia sessão com estudante UOR para continuar." });
      }

      const isBulk = params.token.startsWith("bulk_nucleo_");

      const [credential, student, pendingClaim] = await Promise.all([
        prisma.eventTeamCredential.findUnique({ where: { token: params.token } }),
        prisma.student.findUnique({
          where: { studentNumber },
          select: {
            id: true,
            studentNumber: true,
            name: true,
            email: true,
            course: true,
            phone: true,
            avatarUrl: true,
            academicSyncedAt: true,
            registrationSource: true,
          },
        }),
        prisma.teamMembershipClaim.findFirst({
          where: {
            studentNumber,
            sourceToken: params.token,
            status: { in: ["PENDING_REVIEW", "APPROVED", "REJECTED"] },
          },
          orderBy: [{ updatedAt: "desc" }],
        }),
      ]);

      if (!credential || !isCredentialOperationallyUsable(credential) || credential.category !== "NUCLEO") {
        return reply.code(404).send({ message: "Convite oficial do Núcleo não encontrado." });
      }
      if (isCredentialInvitationExpired(credential)) return sendInvitationExpired(reply);

      if (!isStudentEligibleForNucleusPossession(student)) {
        return reply.code(403).send({ message: "Este acesso é exclusivo para estudantes UOR validados pela secretaria." });
      }

      // For bulk tokens, check if student already has a claimed credential
      if (isBulk) {
        const existingMembership = await prisma.teamMembership.findFirst({
          where: { studentNumber, category: "NUCLEO", status: "ACTIVE" },
          orderBy: [{ updatedAt: "desc" }],
        });
        if (existingMembership) {
          const existingCredential = await prisma.eventTeamCredential.findFirst({
            where: { teamMembershipId: existingMembership.id, status: { in: ["PROFILE_READY", "ACTIVE", "ISSUED"] } },
          });
          if (existingCredential) {
            const { registrationSource: _registrationSource, ...publicStudent } = student;
            return {
              student: { ...publicStudent, academicSyncedAt: student.academicSyncedAt?.toISOString() ?? null },
              suggestedTeamMembershipId: null,
              suggestedMatchConfidence: null,
              isBulk: true,
              alreadyClaimed: true,
              claimedCredential: serializeMember(opts.env, existingCredential),
              members: [],
              claimOptions: serializeNucleusClaimOptions(),
              pendingClaim: pendingClaim ? serializeNucleusClaim(pendingClaim) : null,
            };
          }
        }
      }

      const { registrationSource: _registrationSource, ...publicStudent } = student;
      return {
        student: {
          ...publicStudent,
          academicSyncedAt: student.academicSyncedAt?.toISOString() ?? null,
        },
        suggestedTeamMembershipId: null,
        suggestedMatchConfidence: null,
        isBulk: isBulk || undefined,
        members: [],
        claimOptions: serializeNucleusClaimOptions(),
        pendingClaim: pendingClaim ? serializeNucleusClaim(pendingClaim) : null,
      };
    });

    protectedApp.post("/invitations/:token/nucleus-claim", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ token: z.string().min(8) }),
        body: nucleusClaimSchema,
        response: {
          200: memberResponseSchema,
          400: z.object({ message: z.string() }),
        401: z.object({ message: z.string() }),
        403: z.object({ message: z.string() }),
        410: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
        409: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const studentNumber = request.student?.studentNumber;

      if (!studentNumber) {
        return reply.code(401).send({ message: "Inicia sessão com estudante UOR para continuar." });
      }

      return reply.code(410).send({
        message: "A tomada de posse do Núcleo agora exige solicitação e aprovação administrativa.",
      });
    });

    protectedApp.post("/invitations/:token/nucleus-claim-request", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ token: z.string().min(8) }),
        body: nucleusClaimRequestSchema,
        response: {
          200: nucleusClaimResponseSchema,
          201: nucleusClaimResponseSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          410: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ token: z.string() }).parse(request.params);
      const body = nucleusClaimRequestSchema.parse(request.body);
      const studentNumber = request.student?.studentNumber;

      if (!studentNumber) {
        return reply.code(401).send({ message: "Inicia sessão com estudante UOR para solicitar tomada de posse." });
      }

      const selection = buildNucleusClaimSelection(body.areaKey, body.functionKey);
      if (!selection) {
        return reply.code(400).send({ message: "Categoria ou função do Núcleo inválida." });
      }

      const [credential, student, existingApproved, existingPending] = await Promise.all([
        prisma.eventTeamCredential.findUnique({ where: { token: params.token } }),
        prisma.student.findUnique({ where: { studentNumber } }),
        prisma.teamMembershipClaim.findFirst({
          where: { studentNumber, status: "APPROVED" },
          orderBy: [{ updatedAt: "desc" }],
        }),
        prisma.teamMembershipClaim.findFirst({
          where: { studentNumber, sourceToken: params.token, status: "PENDING_REVIEW" },
          orderBy: [{ updatedAt: "desc" }],
        }),
      ]);

      if (!credential || !isCredentialOperationallyUsable(credential) || credential.category !== "NUCLEO") {
        return reply.code(404).send({ message: "Convite oficial do Núcleo não encontrado." });
      }
      if (isCredentialInvitationExpired(credential)) return sendInvitationExpired(reply);

      if (!isStudentEligibleForNucleusPossession(student)) {
        await auditCredentialClaimRefusal(request, {
          flow: "nucleus_claim_request",
          reason: "student_not_academically_synced",
          token: params.token,
          credential,
          studentNumber,
        });
        return reply.code(403).send({ message: "A tomada de posse exige login validado pela Secretaria." });
      }

      if (existingApproved?.credentialId) {
        return reply.code(409).send({ message: "Já existe uma tomada de posse aprovada para este estudante." });
      }

      const storedPhotoUrl = await persistMediaValue(opts.env, normalizeOptional(body.photoUrl), {
        purpose: "credential-photos",
        maxImageDimension: 900,
      });
      const claimPhotoUrl = storedPhotoUrl ?? student.avatarUrl;
      if (!claimPhotoUrl) {
        return reply.code(400).send({ message: "A fotografia é obrigatória para solicitar o passe do Núcleo." });
      }
      if (body.consentPhotoCredential !== true) {
        return reply.code(400).send({ message: "Autoriza explicitamente o uso da fotografia no passe antes de enviar." });
      }

      const now = new Date();
      const officialPhone = normalizeOptional(student.phone);
      const additionalPhone = normalizeOptional(body.phone);
      const officialCourse = normalizeOptional(student.course);
      const requestedCourse = normalizeOptional(body.course);
      const claimData = {
        studentId: student.id,
        studentNumber: student.studentNumber,
        officialName: student.name,
        officialEmail: student.email,
        officialCourse,
        officialPhone,
        ...selection,
        photoUrl: claimPhotoUrl,
        email: normalizeOptional(body.email) ?? student.email,
        phone: additionalPhone && additionalPhone !== officialPhone ? additionalPhone : null,
        course: requestedCourse && requestedCourse !== officialCourse ? requestedCourse : null,
        organization: normalizeOptional(body.organization) ?? opts.env.UORCONNECT_INSTITUTION_NAME,
        bio: normalizeOptional(body.bio),
        ...buildCredentialProfileExtraData(body),
        sourceToken: params.token,
      };

      const claim = existingPending
        ? await prisma.teamMembershipClaim.update({
            where: { id: existingPending.id },
            data: claimData,
          })
        : await prisma.teamMembershipClaim.create({
            data: claimData,
          });

      await prisma.student.update({
        where: { id: student.id },
        data: {
          email: claimData.email,
          phone: officialPhone ?? additionalPhone,
          alternatePhone: additionalPhone && additionalPhone !== officialPhone
            ? additionalPhone
            : student.alternatePhone,
          course: officialCourse ?? requestedCourse,
          avatarUrl: claimPhotoUrl,
          university: opts.env.UORCONNECT_INSTITUTION_NAME,
          isUorStudent: true,
          registrationSource: student.registrationSource ?? "NUCLEO_CLAIM",
          bio: claimData.bio ?? student.bio,
          address: claimData.address ?? student.address,
          instagramUrl: claimData.instagramUrl ?? student.instagramUrl,
          facebookUrl: claimData.facebookUrl ?? student.facebookUrl,
          linkedinUrl: claimData.linkedinUrl ?? student.linkedinUrl,
          githubUrl: claimData.githubUrl ?? student.githubUrl,
          websiteUrl: claimData.websiteUrl ?? student.websiteUrl,
          profileCompletedAt: student.profileCompletedAt ?? now,
        },
      });

      await upsertStudentProfileExtra(prisma, student.id, {
        bio: body.bio,
        address: body.address,
        instagramUrl: body.instagramUrl,
        facebookUrl: body.facebookUrl,
        linkedinUrl: body.linkedinUrl,
        githubUrl: body.githubUrl,
        websiteUrl: body.websiteUrl,
        consentPhotoCredential: body.consentPhotoCredential,
        consentPublicProfile: body.consentPublicProfile,
        consentSocialLinks: body.consentSocialLinks !== undefined
          ? body.consentSocialLinks && hasSocialProfileFields(body)
          : undefined,
        consentSms: body.consentSms,
        consentWhatsapp: body.consentWhatsapp,
      });

      await recordAdminAudit({
        ...auditActor(request),
        action: existingPending ? "team_membership_claim.update" : "team_membership_claim.submit",
        entityType: "TeamMembershipClaim",
        entityId: claim.id,
        summary: `${student.name ?? student.studentNumber} solicitou tomada de posse no Núcleo.`,
        metadata: {
          claim: serializeNucleusClaim(claim),
          selectedAreaKey: body.areaKey,
          selectedFunctionKey: body.functionKey,
        },
      });

      return reply.code(existingPending ? 200 : 201).send(serializeNucleusClaim(claim));
    });

    // ── Expositor flow ──

    const expositorContextSchema = z.object({
      student: z.object({
        id: z.number(),
        studentNumber: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
        course: z.string().nullable(),
        phone: z.string().nullable(),
        avatarUrl: z.string().nullable(),
      }),
      submissions: z.array(z.object({
        id: z.number(),
        referenceCode: z.string(),
        name: z.string(),
        type: z.string(),
        area: z.string(),
        status: z.string(),
      })),
      suggestedSubmissionId: z.number().nullable(),
      alreadyClaimed: z.boolean().optional(),
      claimedCredential: memberResponseSchema.optional().nullable(),
    });

    protectedApp.get("/invitations/:token/expositor-context", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ token: z.string().min(8) }),
        response: {
          200: expositorContextSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          410: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ token: z.string() }).parse(request.params);
      const studentNumber = request.student?.studentNumber;

      if (!studentNumber) {
        return reply.code(401).send({ message: "Inicia sessão para continuar." });
      }

      const [credential, student] = await Promise.all([
        prisma.eventTeamCredential.findUnique({ where: { token: params.token } }),
        prisma.student.findUnique({
          where: { studentNumber },
          select: { id: true, studentNumber: true, name: true, email: true, course: true, phone: true, avatarUrl: true },
        }),
      ]);

      if (!credential || !isCredentialOperationallyUsable(credential) || credential.category !== "EXPOSITOR") {
        return reply.code(404).send({ message: "Convite de expositor não encontrado." });
      }
      if (isCredentialInvitationExpired(credential)) return sendInvitationExpired(reply);

      if (!student) {
        return reply.code(403).send({ message: "Estudante não encontrado." });
      }

      // Find submissions where the student is the owner or a confirmed member
      const [ownedSubmissions, memberSubmissions] = await Promise.all([
        prisma.submission.findMany({
          where: { studentId: student.id, status: "APPROVED" },
          select: { id: true, referenceCode: true, name: true, type: true, area: true, status: true },
          orderBy: { name: "asc" },
        }),
        prisma.submissionMember.findMany({
          where: { studentId: student.id, confirmedAt: { not: null } },
          select: {
            submission: {
              select: { id: true, referenceCode: true, name: true, type: true, area: true, status: true },
            },
          },
        }),
      ]);

      const submissionMap = new Map<number, typeof ownedSubmissions[number]>();
      for (const sub of ownedSubmissions) submissionMap.set(sub.id, sub);
      for (const membership of memberSubmissions) {
        if (membership.submission.status === "APPROVED") {
          submissionMap.set(membership.submission.id, membership.submission);
        }
      }
      const submissions = Array.from(submissionMap.values());

      return {
        student,
        submissions,
        suggestedSubmissionId: submissions.length === 1 ? submissions[0].id : null,
      };
    });

    const expositorClaimSchema = publicSubmissionSchema.extend({
      submissionId: z.coerce.number().int().positive(),
    });

    protectedApp.post("/invitations/:token/expositor-claim", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ token: z.string().min(8) }),
        body: expositorClaimSchema,
        response: {
          200: memberResponseSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
          410: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ token: z.string() }).parse(request.params);
      const body = expositorClaimSchema.parse(request.body);
      const studentNumber = request.student?.studentNumber;

      if (!studentNumber) {
        return reply.code(401).send({ message: "Inicia sessão para continuar." });
      }

      const [existing, student, submission] = await Promise.all([
        prisma.eventTeamCredential.findUnique({ where: { token: params.token } }),
        prisma.student.findUnique({ where: { studentNumber } }),
        prisma.submission.findUnique({ where: { id: body.submissionId }, select: { id: true, name: true, type: true, area: true, referenceCode: true, status: true, paymentStatus: true, studentId: true } }),
      ]);

      if (!existing || !isCredentialOperationallyUsable(existing) || existing.category !== "EXPOSITOR") {
        return reply.code(404).send({ message: "Convite de expositor não encontrado." });
      }
      if (isCredentialInvitationExpired(existing)) return sendInvitationExpired(reply);

      if (!student) {
        await auditCredentialClaimRefusal(request, {
          flow: "expositor_claim",
          reason: "student_not_found",
          token: params.token,
          credential: existing,
          studentNumber,
        });
        return reply.code(403).send({ message: "Estudante não encontrado." });
      }

      if (!submission || submission.status !== "APPROVED" || !isPaymentConfirmedByAdmin(submission.paymentStatus)) {
        await auditCredentialClaimRefusal(request, {
          flow: "expositor_claim",
          reason: "approved_submission_not_found",
          token: params.token,
          credential: existing,
          studentNumber,
          metadata: { submissionId: body.submissionId, submissionStatus: submission?.status ?? null, paymentStatus: submission?.paymentStatus ?? null },
        });
        return reply.code(404).send({ message: "Projeto aprovado com pagamento confirmado não encontrado." });
      }

      // Verify student is associated with this submission
      const isOwner = submission.studentId === student.id;
      const isMember = !isOwner && await prisma.submissionMember.findFirst({
        where: { submissionId: submission.id, studentId: student.id, confirmedAt: { not: null } },
      });

      if (!isOwner && !isMember) {
        await auditCredentialClaimRefusal(request, {
          flow: "expositor_claim",
          reason: "student_not_associated_to_submission",
          token: params.token,
          credential: existing,
          studentNumber,
          metadata: { submissionId: submission.id },
        });
        return reply.code(403).send({ message: "Não estás associado a este projeto." });
      }

      const normalizedName = normalizeOptional(body.name) ?? student.name ?? "Expositor";
      const now = new Date();
      const existingSubmissionCredential = await prisma.eventTeamCredential.findFirst({
        where: {
          category: "EXPOSITOR",
          sourceSubmissionId: submission.id,
          teamMembership: { studentNumber },
          status: { notIn: ["REVOKED", "DISABLED"] },
        },
        orderBy: [{ updatedAt: "desc" }],
      });

      if (existingSubmissionCredential && isCredentialReadyStatus(existingSubmissionCredential.status) && existingSubmissionCredential.id !== existing.id) {
        await auditCredentialClaimRefusal(request, {
          flow: "expositor_claim",
          reason: "submission_already_claimed",
          token: params.token,
          credential: existing,
          studentNumber,
          metadata: {
            submissionId: submission.id,
            existingCredentialId: existingSubmissionCredential.id,
          },
        });
        return reply.code(409).send({ message: "Esta credencial de expositor já foi emitida para este projeto." });
      }

      // Upsert team membership for expositor
      const nameParts = splitFullName(normalizedName);
      let membership = existingSubmissionCredential?.teamMembershipId
        ? await prisma.teamMembership.findUnique({ where: { id: existingSubmissionCredential.teamMembershipId } })
        : null;
      if (!membership) {
        membership = await prisma.teamMembership.create({
          data: {
            studentNumber,
            fullName: normalizedName,
            firstName: nameParts.firstName,
            lastName: nameParts.lastName,
            category: "EXPOSITOR",
            team: "Expositores",
            role: submission.type === "PROJECT" ? "Projeto" : submission.type === "BUSINESS" ? "Negócio" : "Produto",
            accessLevel: "Expositor",
            permissions: "EVENTO",
            status: "ACTIVE",
            source: "EXPOSITOR_CLAIM",
            createdByStudentNumber: studentNumber,
            ...membershipVerificationData(studentNumber, now),
          },
        });
      } else if (!membership.verifiedAt) {
        membership = await prisma.teamMembership.update({
          where: { id: membership.id },
          data: membershipVerificationData(studentNumber, now),
        });
      }

      const hasSocials = hasSocialProfileFields(body);
      const isBulk = params.token.startsWith("bulk_expositor_");
      const storedPhotoUrl = await persistMediaValue(opts.env, normalizeOptional(body.photoUrl), {
        purpose: "credential-photos",
        maxImageDimension: 900,
      });
      const credentialPhotoUrl = storedPhotoUrl ?? student.avatarUrl;
      if (!credentialPhotoUrl) {
        await auditCredentialClaimRefusal(request, {
          flow: "expositor_claim",
          reason: "photo_missing",
          token: params.token,
          credential: existing,
          studentNumber,
          metadata: { submissionId: submission.id },
        });
        return reply.code(400).send({ message: "A fotografia é obrigatória para emitir a credencial de expositor." });
      }
      if (body.consentPhotoCredential !== true) {
        await auditCredentialClaimRefusal(request, {
          flow: "expositor_claim",
          reason: "photo_consent_missing",
          token: params.token,
          credential: existing,
          studentNumber,
          metadata: { submissionId: submission.id },
        });
        return reply.code(400).send({ message: "Autoriza explicitamente o uso da fotografia na credencial de expositor." });
      }
      const credProfileData = {
        teamMembershipId: membership.id,
        status: "PROFILE_READY" as const,
        invitationExpiresAt: null,
        name: normalizedName,
        email: normalizeOptional(body.email) ?? student.email,
        phone: normalizeOptional(body.phone) ?? student.phone,
        course: normalizeOptional(body.course) ?? student.course,
        organization: normalizeOptional(body.organization) ?? `${submission.name} (${submission.referenceCode})`,
        bio: normalizeOptional(body.bio),
        photoUrl: credentialPhotoUrl,
        ...buildCredentialProfileExtraData(body),
        sourceSubmissionId: submission.id,
        sourceSubmissionRef: submission.referenceCode,
        sourceSubmissionName: submission.name,
        sourceSubmissionType: submission.type,
        sourceSubmissionArea: submission.area,
        notes: null,
        submittedAt: now,
      };

      let member: EventTeamCredentialRecord;

      if (isBulk) {
        // For bulk: find existing INVITED credential for this membership, or create one
        const memberCred = await prisma.eventTeamCredential.findFirst({
          where: { teamMembershipId: membership.id, status: "INVITED", category: "EXPOSITOR" },
        });
        member = memberCred
          ? await prisma.eventTeamCredential.update({ where: { id: memberCred.id }, data: credProfileData })
          : await prisma.eventTeamCredential.create({
              data: {
                ...credProfileData,
                token: createToken("cred"),
                publicSlug: await createUniquePublicSlug(normalizedName),
                category: "EXPOSITOR",
                team: "Expositores",
                role: submission.type === "PROJECT" ? "Projeto" : submission.type === "BUSINESS" ? "Negócio" : "Produto",
                accessLevel: "Expositor",
                permissions: "EVENTO",
                issuedAt: now,
                issuedByStudentNumber: studentNumber,
              },
            });
      } else {
        member = await prisma.eventTeamCredential.update({
          where: { id: existing.id },
          data: credProfileData,
        });
      }

      member = await persistTeamCredentialIssueSnapshot(member, "EXPOSITOR_CLAIM", studentNumber);

      // Update student profile
      await prisma.student.update({
        where: { id: student.id },
        data: {
          name: normalizedName,
          email: normalizeOptional(body.email) ?? student.email,
          phone: normalizeOptional(body.phone) ?? student.phone,
          course: normalizeOptional(body.course) ?? student.course,
          avatarUrl: storedPhotoUrl ?? student.avatarUrl,
          university: opts.env.UORCONNECT_INSTITUTION_NAME,
          isUorStudent: true,
          profileCompletedAt: student.profileCompletedAt ?? now,
        },
      });

      await upsertStudentProfileExtra(prisma, student.id, {
        bio: body.bio,
        address: body.address,
        instagramUrl: body.instagramUrl,
        facebookUrl: body.facebookUrl,
        linkedinUrl: body.linkedinUrl,
        githubUrl: body.githubUrl,
        websiteUrl: body.websiteUrl,
        consentPhotoCredential: body.consentPhotoCredential,
        consentPublicProfile: body.consentPublicProfile,
        consentSocialLinks: body.consentSocialLinks !== undefined
          ? body.consentSocialLinks && hasSocials
          : undefined,
        consentSms: body.consentSms,
        consentWhatsapp: body.consentWhatsapp,
      });

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.expositor_claim",
        entityType: "EventTeamCredential",
        entityId: member.id,
        summary: `${normalizedName} registou-se como expositor (${submission.referenceCode}).`,
        metadata: {
          after: teamCredentialAuditSnapshot(member),
          submissionId: submission.id,
          submissionRef: submission.referenceCode,
        },
      });

      return serializeMember(opts.env, member);
    });
  });

  app.register(async (meApp) => {
    meApp.register(authGuard, { env: opts.env });

    meApp.get("/me", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: z.object({
            credential: memberResponseSchema.nullable(),
            membership: teamMembershipResponseSchema.nullable(),
            credentials: z.array(memberResponseSchema),
            memberships: z.array(teamMembershipResponseSchema),
          }),
          401: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const studentNumber = request.student?.studentNumber;
      if (!studentNumber) {
        return reply.code(401).send({ message: "Autenticação necessária." });
      }

      const memberships = await prisma.teamMembership.findMany({
        where: { studentNumber, status: "ACTIVE" },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      });

      const [student, adminProfile, linkedCredentials] = await Promise.all([
        prisma.student.findUnique({ where: { studentNumber }, select: { name: true } }),
        getAdminProfileByStudentNumber(studentNumber),
        memberships.length > 0
          ? prisma.eventTeamCredential.findMany({
              where: {
                teamMembershipId: { in: memberships.map((membership) => membership.id) },
                status: { notIn: ["DISABLED"] },
              },
              orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            })
          : Promise.resolve([] as EventTeamCredentialRecord[]),
      ]);

      const membershipById = new Map(memberships.map((membership) => [membership.id, membership]));
      const linkedDisplayCredentials = linkedCredentials.filter((credential) =>
          isCredentialConsistentWithMembership(credential, membershipById.get(credential.teamMembershipId ?? -1)),
      );
      const selfAdminCredential = adminProfile && linkedDisplayCredentials.length === 0
        ? await findSelfIssuedAdminCredential(studentNumber, student?.name)
        : null;
      const credentials = dedupeCredentialsForDisplay([
        ...linkedDisplayCredentials,
        ...(selfAdminCredential ? [selfAdminCredential] : []),
      ]);

      const primaryCredential = credentials.find((credential) => credential.status === "PROFILE_READY" || credential.status === "ACTIVE")
        ?? credentials[0]
        ?? null;
      const primaryMembership = primaryCredential
        ? memberships.find((membership) => membership.id === primaryCredential.teamMembershipId) ?? memberships[0]
        : memberships[0];

      return {
        credential: primaryCredential ? serializeMember(opts.env, primaryCredential) : null,
        membership: primaryMembership ? serializeTeamMembership(primaryMembership) : null,
        credentials: credentials.map((credential) => serializeMember(opts.env, credential)),
        memberships: memberships.map(serializeTeamMembership),
      };
    });
  });

  app.get("/members/:slug", {
    schema: {
      tags: ["Team Credentials"],
      params: z.object({ slug: z.string().min(4) }),
      response: {
          200: memberResponseSchema.omit({ token: true, teamMembershipId: true }),
        404: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const params = z.object({ slug: z.string() }).parse(request.params);
    const member = await prisma.eventTeamCredential.findUnique({
      where: { publicSlug: params.slug },
      include: {
        teamMembership: {
          select: {
            student: {
              select: {
                avatarUrl: true,
                course: true,
                bio: true,
                address: true,
                instagramUrl: true,
                facebookUrl: true,
                linkedinUrl: true,
                githubUrl: true,
                websiteUrl: true,
                profileExtra: true,
              },
            },
          },
        },
      },
    });
    if (!member || !isCredentialReadyForPublicUse(member)) {
      return reply.code(404).send({ message: "Perfil de membro não encontrado." });
    }

    const sanitized = sanitizePublicMemberPayload(
      serializeMember(opts.env, member),
      member.teamMembership?.student ?? null,
    );
    const { token: _token, teamMembershipId: _teamMembershipId, ...payload } = sanitized;
    return payload;
  });

  app.get("/members/:slug/pass.pdf", {
    schema: {
      tags: ["Team Credentials"],
      params: z.object({ slug: z.string().min(4) }),
      querystring: credentialPassOptionsQuerySchema,
      response: {
        404: z.object({ message: z.string() }),
      },
    },
  }, async (request, reply) => {
    const params = z.object({ slug: z.string() }).parse(request.params);
    const passOptions = credentialPassOptionsQuerySchema.parse(request.query);
    const member = await prisma.eventTeamCredential.findUnique({
      where: { publicSlug: params.slug },
      include: {
        teamMembership: {
          select: {
            student: {
              select: {
                avatarUrl: true,
                course: true,
                bio: true,
                address: true,
                instagramUrl: true,
                facebookUrl: true,
                linkedinUrl: true,
                githubUrl: true,
                websiteUrl: true,
                profileExtra: true,
              },
            },
          },
        },
      },
    });
    if (!member || !isCredentialReadyForPublicUse(member)) {
      return reply.code(404).send({ message: "Credencial não encontrada." });
    }

    const publicPayload = sanitizePublicMemberPayload(
      serializeMember(opts.env, member),
      member.teamMembership?.student ?? null,
    );
    const profileExtra = member.teamMembership?.student?.profileExtra ?? null;
    const canUseCredentialPhoto = profileExtra
      ? profileExtra.consentPhotoCredential
      : member.consentPhotoCredential;

    return sendCredentialPassPdf(reply, opts.env, {
      ...member,
      email: null,
      phone: null,
      course: publicPayload.course,
      organization: publicPayload.organization,
      bio: publicPayload.bio,
      photoUrl: canUseCredentialPhoto ? publicPayload.photoUrl : null,
      address: null,
      instagramUrl: publicPayload.instagramUrl,
      facebookUrl: publicPayload.facebookUrl,
      linkedinUrl: publicPayload.linkedinUrl,
      githubUrl: publicPayload.githubUrl,
      websiteUrl: publicPayload.websiteUrl,
      notes: null,
      createdByStudentNumber: null,
      issuedByStudentNumber: null,
    }, passOptions);
  });

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);
    setDefaultAdminPermission(adminApp, ["NUCLEUS", "CREDENTIALS", "SECURITY"]);

    adminApp.get("/admin/overview", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: overviewResponseSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async () => {
      const members = await prisma.eventTeamCredential.findMany({
        where: { status: { notIn: ["DISABLED", "REVOKED"] } },
        orderBy: [{ team: "asc" }, { category: "asc" }, { name: "asc" }, { createdAt: "desc" }],
      });
      const linkedMembershipIds = members
        .map((member) => member.teamMembershipId)
        .filter((id): id is number => Boolean(id));
      const linkedMemberships = linkedMembershipIds.length > 0
        ? await prisma.teamMembership.findMany({ where: { id: { in: linkedMembershipIds } } })
        : [];
      const membershipById = new Map(linkedMemberships.map((membership) => [membership.id, membership]));
      const displayMembers = dedupeCredentialsForDisplay(
        members.filter((member) =>
          isCredentialConsistentWithMembership(member, membershipById.get(member.teamMembershipId ?? -1)),
        ),
      );

      return buildOverview(opts.env, displayMembers);
    });

    adminApp.get("/admin/team-profile-presets", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: z.object({ presets: z.array(teamProfilePresetResponseSchema) }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async () => ({ presets: teamProfilePresets }));

    adminApp.get("/admin/team-memberships", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: teamMembershipOverviewResponseSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async () => {
      const members = await prisma.teamMembership.findMany({
        orderBy: [{ status: "asc" }, { team: "asc" }, { fullName: "asc" }, { updatedAt: "desc" }],
      });
      return buildTeamMembershipOverview(members);
    });

    adminApp.get("/admin/team-memberships/search", {
      schema: {
        tags: ["Team Credentials"],
        querystring: z.object({ q: z.string().trim().min(2).max(100) }),
        response: {
          200: z.object({
            memberships: z.array(teamMembershipResponseSchema.extend({
              hasCredential: z.boolean(),
              credentialStatus: z.string().nullable(),
              credentialInviteUrl: z.string().nullable(),
            })),
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request) => {
      const { q } = z.object({ q: z.string().trim().min(2) }).parse(request.query);
      const normalizedQuery = normalizeNameForMatch(q);

      const allMemberships = await prisma.teamMembership.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ team: "asc" }, { fullName: "asc" }],
      });

      const matched = allMemberships.filter((membership) => {
        const normalizedName = normalizeNameForMatch(membership.fullName);
        return normalizedName.includes(normalizedQuery)
          || normalizedQuery.split(" ").filter(Boolean).every((part) => normalizedName.includes(part));
      }).slice(0, 15);

      const credentials = matched.length > 0
        ? await prisma.eventTeamCredential.findMany({
          where: {
            status: { notIn: ["DISABLED"] },
            OR: [
              { teamMembershipId: { in: matched.map((m) => m.id) } },
              { name: { not: null } },
            ],
          },
        })
        : [];

      const credentialByMembershipId = new Map(
        credentials.filter((c) => c.teamMembershipId).map((c) => [c.teamMembershipId!, c]),
      );

      return {
        memberships: matched.map((membership) => {
          const credential = credentialByMembershipId.get(membership.id)
            ?? credentials.find((c) =>
              c.name && normalizeNameForMatch(c.name) === normalizeNameForMatch(membership.fullName),
            )
            ?? null;

          return {
            ...serializeTeamMembership(membership),
            hasCredential: Boolean(credential && isCredentialUsable(credential)),
            credentialStatus: credential ? credentialEffectiveStatus(credential) : null,
            credentialInviteUrl: credential ? buildInviteUrl(opts.env, credential.token) : null,
          };
        }),
      };
    });

    adminApp.post("/admin/team-memberships", {
      schema: {
        tags: ["Team Credentials"],
        body: teamMembershipInputSchema,
        response: {
          200: teamMembershipResponseSchema,
          201: teamMembershipResponseSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const body = teamMembershipInputSchema.parse(request.body);
      const data = buildTeamMembershipData(body, request.student?.studentNumber ?? request.jury?.phone ?? null);
      const identityError = nucleusStudentNumberError(data.category, data.studentNumber);
      if (identityError) return reply.code(400).send({ message: identityError });
      const existing = data.studentNumber
        ? await prisma.teamMembership.findFirst({
          where: {
            studentNumber: data.studentNumber,
            category: data.category,
            team: data.team,
            role: data.role,
          },
          orderBy: [{ updatedAt: "desc" }],
        })
        : null;

      const membership = existing
        ? await prisma.teamMembership.update({
          where: { id: existing.id },
          data: {
            ...data,
            version: { increment: 1 },
          },
        })
        : await prisma.teamMembership.create({ data });

      const after = teamMembershipAuditSnapshot(membership);
      const before = existing ? teamMembershipAuditSnapshot(existing) : null;
      await recordAdminAudit({
        ...auditActor(request),
        action: existing ? "team_membership.update" : "team_membership.create",
        entityType: "TeamMembership",
        entityId: membership.id,
        summary: existing
          ? `Membro oficial atualizado: ${membership.fullName}.`
          : `Membro oficial criado: ${membership.fullName}.`,
        metadata: {
          before,
          after,
          changedFields: before ? changedFields(before, after) : Object.keys(after),
        },
      });

      return reply.code(existing ? 200 : 201).send(serializeTeamMembership(membership));
    });

    adminApp.patch("/admin/team-memberships/:id", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: teamMembershipInputSchema.partial(),
        response: {
          200: teamMembershipResponseSchema,
          400: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
      const body = teamMembershipInputSchema.partial().parse(request.body);
      const existing = await prisma.teamMembership.findUnique({ where: { id: params.id } });
      if (!existing) return reply.code(404).send({ message: "Membro oficial não encontrado." });
      const before = teamMembershipAuditSnapshot(existing);

      const fullName = body.fullName?.replace(/\s+/g, " ").trim();
      const nameParts = fullName ? splitFullName(fullName) : null;
      const actorStudentNumber = request.student?.studentNumber ?? request.jury?.phone ?? null;
      const nextStudentNumber = body.studentNumber !== undefined
        ? normalizeStudentNumber(body.studentNumber)
        : existing.studentNumber;
      const nextCategory = body.category ?? existing.category;
      const nextTeam = body.team?.trim() || existing.team;
      const nextRole = body.role?.trim() || existing.role;
      const nextAccessLevel = body.accessLevel?.trim() || existing.accessLevel;
      const nextPermissions = body.permissions ?? parsePermissions(existing.permissions);
      const identityError = nucleusStudentNumberError(nextCategory, nextStudentNumber);
      if (identityError) return reply.code(400).send({ message: identityError });
      const membership = await prisma.teamMembership.update({
        where: { id: params.id },
        data: {
          ...(body.studentNumber !== undefined ? { studentNumber: nextStudentNumber } : {}),
          ...(fullName ? { fullName, firstName: nameParts?.firstName ?? null, lastName: nameParts?.lastName ?? null } : {}),
          ...(body.category ? { category: nextCategory } : {}),
          ...(body.team ? { team: nextTeam } : {}),
          ...(body.role ? { role: nextRole } : {}),
          ...(body.accessLevel ? { accessLevel: nextAccessLevel } : {}),
          permissions: normalizePermissionList(resolveNucleusMembershipPermissions({
            category: nextCategory,
            team: nextTeam,
            role: nextRole,
            accessLevel: nextAccessLevel,
            permissions: nextPermissions,
          })),
          ...(body.status ? { status: body.status } : {}),
          ...(body.mandateLabel !== undefined ? { mandateLabel: normalizeOptional(body.mandateLabel) } : {}),
          ...(body.startsAt !== undefined ? { startsAt: body.startsAt ?? null } : {}),
          ...(body.endsAt !== undefined ? { endsAt: body.endsAt ?? null } : {}),
          ...(body.source ? { source: body.source.trim() } : {}),
          ...(body.notes !== undefined ? { notes: normalizeOptional(body.notes) } : {}),
          ...membershipVerificationData(actorStudentNumber),
          version: { increment: 1 },
        },
      });
      const after = teamMembershipAuditSnapshot(membership);

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_membership.update",
        entityType: "TeamMembership",
        entityId: membership.id,
        summary: `Membro oficial atualizado: ${membership.fullName}.`,
        metadata: {
          before,
          after,
          changedFields: changedFields(before, after),
        },
      });

      return serializeTeamMembership(membership);
    });

    adminApp.delete("/admin/team-memberships/:id", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: teamMembershipResponseSchema,
          404: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
      const existing = await prisma.teamMembership.findUnique({ where: { id: params.id } });
      if (!existing) return reply.code(404).send({ message: "Membro oficial não encontrado." });

      const before = teamMembershipAuditSnapshot(existing);
      const now = new Date();
      const actorStudentNumber = request.student?.studentNumber ?? request.jury?.phone ?? null;
      const [membership, disabledCredentials] = await prisma.$transaction([
        prisma.teamMembership.update({
          where: { id: existing.id },
          data: {
            status: "REMOVED",
            notes: existing.notes ?? "Removido do cadastro digital; histórico preservado.",
            ...membershipVerificationData(actorStudentNumber, now),
            version: { increment: 1 },
          },
        }),
        prisma.eventTeamCredential.updateMany({
          where: {
            teamMembershipId: existing.id,
            status: { notIn: ["DISABLED", "REVOKED"] },
          },
          data: {
            status: "DISABLED",
            revokedAt: now,
            revokedReason: "Membro removido do cadastro digital do Núcleo/equipa.",
          },
        }),
      ]);
      const after = teamMembershipAuditSnapshot(membership);

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_membership.remove",
        entityType: "TeamMembership",
        entityId: membership.id,
        summary: `Membro oficial removido: ${membership.fullName}.`,
        metadata: {
          before,
          after,
          changedFields: changedFields(before, after),
          disabledCredentials: disabledCredentials.count,
        },
      });

      return serializeTeamMembership(membership);
    });

    adminApp.get("/admin/nucleus-claims", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: z.object({
            stats: z.object({
              total: z.number(),
              pending: z.number(),
              approved: z.number(),
              rejected: z.number(),
            }),
            claims: z.array(nucleusClaimResponseSchema),
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async () => {
      const claims = await prisma.teamMembershipClaim.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 120,
      });

      return {
        stats: {
          total: claims.length,
          pending: claims.filter((claim) => claim.status === "PENDING_REVIEW").length,
          approved: claims.filter((claim) => claim.status === "APPROVED").length,
          rejected: claims.filter((claim) => claim.status === "REJECTED").length,
        },
        claims: claims.map(serializeNucleusClaim),
      };
    });

    adminApp.post("/admin/nucleus-claims/:id/approve", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: nucleusClaimReviewSchema.optional(),
        response: {
          200: z.object({
            claim: nucleusClaimResponseSchema,
            membership: teamMembershipResponseSchema,
            credential: memberResponseSchema,
          }),
          404: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
      const body = nucleusClaimReviewSchema.optional().parse(request.body) ?? {};
      const claim = await prisma.teamMembershipClaim.findUnique({ where: { id: params.id } });
      if (!claim) return reply.code(404).send({ message: "Solicitação de tomada de posse não encontrada." });
      if (claim.status !== "PENDING_REVIEW") {
        return reply.code(409).send({ message: "Esta solicitação já foi revista." });
      }

      const now = new Date();
      const actorStudentNumber = request.student?.studentNumber ?? request.jury?.phone ?? null;
      const requestedCategory = (memberCategories as readonly string[]).includes(claim.requestedCategory)
        ? claim.requestedCategory
        : "NUCLEO";
      const category = body.category ?? requestedCategory;
      const team = body.team?.trim() || claim.requestedTeam;
      const role = body.role?.trim() || claim.requestedRole;
      const accessLevel = body.accessLevel?.trim() || claim.requestedAccessLevel;
      const permissions = normalizePermissionList(resolveNucleusMembershipPermissions({
        category,
        team,
        role,
        accessLevel,
        permissions: body.permissions ?? parsePermissions(claim.requestedPermissions),
      }));
      const fullName = normalizeOptional(claim.officialName) ?? `Estudante ${claim.studentNumber}`;
      const nameParts = splitFullName(fullName);

      const existingMembership = claim.teamMembershipId
        ? await prisma.teamMembership.findUnique({ where: { id: claim.teamMembershipId } })
        : await prisma.teamMembership.findFirst({
            where: {
              studentNumber: claim.studentNumber,
              category,
              status: { not: "REMOVED" },
            },
            orderBy: [{ updatedAt: "desc" }],
          });

      const membership = existingMembership
        ? await prisma.teamMembership.update({
            where: { id: existingMembership.id },
            data: {
              studentNumber: claim.studentNumber,
              fullName,
              firstName: nameParts.firstName,
              lastName: nameParts.lastName,
              category,
              team,
              role,
              accessLevel,
              permissions,
              status: "ACTIVE",
              source: existingMembership.source === "MANUAL" ? "NUCLEO_CLAIM" : existingMembership.source,
              ...membershipVerificationData(actorStudentNumber, now),
              version: { increment: 1 },
            },
          })
        : await prisma.teamMembership.create({
            data: {
              studentNumber: claim.studentNumber,
              fullName,
              firstName: nameParts.firstName,
              lastName: nameParts.lastName,
              category,
              team,
              role,
              accessLevel,
              permissions,
              status: "ACTIVE",
              source: "NUCLEO_CLAIM",
              createdByStudentNumber: actorStudentNumber,
              ...membershipVerificationData(actorStudentNumber, now),
            },
          });

      const existingCredential = await prisma.eventTeamCredential.findFirst({
        where: {
          teamMembershipId: membership.id,
          status: { notIn: ["DISABLED", "REVOKED"] },
        },
        orderBy: [{ updatedAt: "desc" }],
      });

      const credentialData = {
        teamMembershipId: membership.id,
        category,
        team,
        role,
        accessLevel,
        permissions,
        status: "PROFILE_READY" as const,
        name: fullName,
        email: claim.email ?? claim.officialEmail,
        phone: claim.officialPhone ?? claim.phone,
        course: claim.officialCourse ?? claim.course,
        organization: claim.organization ?? opts.env.UORCONNECT_INSTITUTION_NAME,
        bio: claim.bio,
        photoUrl: claim.photoUrl,
        address: claim.address,
        instagramUrl: claim.instagramUrl,
        facebookUrl: claim.facebookUrl,
        linkedinUrl: claim.linkedinUrl,
        githubUrl: claim.githubUrl,
        websiteUrl: claim.websiteUrl,
        consentPhotoCredential: claim.consentPhotoCredential,
        consentPublicProfile: claim.consentPublicProfile,
        consentSocialLinks: claim.consentSocialLinks,
        consentSms: claim.consentSms,
        consentWhatsapp: claim.consentWhatsapp,
        notes: null,
        submittedAt: now,
        issuedAt: now,
        issuedByStudentNumber: actorStudentNumber,
        invitationExpiresAt: null,
      };

      let credential = existingCredential
        ? await prisma.eventTeamCredential.update({
            where: { id: existingCredential.id },
            data: credentialData,
          })
        : await prisma.eventTeamCredential.create({
            data: {
              ...credentialData,
              token: createToken("cred"),
              publicSlug: await createUniquePublicSlug(fullName),
              createdByStudentNumber: actorStudentNumber,
            },
          });

      credential = await persistTeamCredentialIssueSnapshot(credential, "NUCLEUS_CLAIM_APPROVED", actorStudentNumber);

      const updatedClaim = await prisma.teamMembershipClaim.update({
        where: { id: claim.id },
        data: {
          status: "APPROVED",
          reviewNote: normalizeOptional(body.note) ?? "Tomada de posse aprovada.",
          reviewedAt: now,
          reviewedByStudentNumber: actorStudentNumber,
          teamMembershipId: membership.id,
          credentialId: credential.id,
        },
      });

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_membership_claim.approve",
        entityType: "TeamMembershipClaim",
        entityId: updatedClaim.id,
        summary: `Tomada de posse aprovada: ${fullName} em ${team}.`,
        metadata: {
          claim: serializeNucleusClaim(updatedClaim),
          teamMembership: teamMembershipAuditSnapshot(membership),
          credential: teamCredentialAuditSnapshot(credential),
        },
      });

      return {
        claim: serializeNucleusClaim(updatedClaim),
        membership: serializeTeamMembership(membership),
        credential: serializeMember(opts.env, credential),
      };
    });

    adminApp.post("/admin/nucleus-claims/:id/reject", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: z.object({ note: z.string().trim().min(2).max(500) }),
        response: {
          200: nucleusClaimResponseSchema,
          404: z.object({ message: z.string() }),
          409: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
      const body = z.object({ note: z.string().trim().min(2).max(500) }).parse(request.body);
      const claim = await prisma.teamMembershipClaim.findUnique({ where: { id: params.id } });
      if (!claim) return reply.code(404).send({ message: "Solicitação de tomada de posse não encontrada." });
      if (claim.status !== "PENDING_REVIEW") {
        return reply.code(409).send({ message: "Esta solicitação já foi revista." });
      }

      const updatedClaim = await prisma.teamMembershipClaim.update({
        where: { id: claim.id },
        data: {
          status: "REJECTED",
          reviewNote: body.note,
          reviewedAt: new Date(),
          reviewedByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
        },
      });

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_membership_claim.reject",
        entityType: "TeamMembershipClaim",
        entityId: updatedClaim.id,
        summary: `Tomada de posse recusada: ${updatedClaim.officialName ?? updatedClaim.studentNumber}.`,
        metadata: { claim: serializeNucleusClaim(updatedClaim) },
      });

      return serializeNucleusClaim(updatedClaim);
    });

    adminApp.get("/admin/membership-matches", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: credentialMembershipMatchResponseSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async () => {
      const [credentials, memberships] = await Promise.all([
        prisma.eventTeamCredential.findMany({
          orderBy: [{ team: "asc" }, { name: "asc" }, { createdAt: "desc" }],
        }),
        prisma.teamMembership.findMany({
          orderBy: [{ status: "asc" }, { team: "asc" }, { fullName: "asc" }],
        }),
      ]);
      return buildCredentialMembershipMatches(opts.env, credentials, memberships);
    });

    adminApp.post("/admin/membership-matches/:credentialId/link", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ credentialId: z.coerce.number().int().positive() }),
        body: credentialMembershipLinkSchema,
        response: {
          200: memberResponseSchema,
          400: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ credentialId: z.coerce.number().int().positive() }).parse(request.params);
      const body = credentialMembershipLinkSchema.parse(request.body);
      const [credential, membership] = await Promise.all([
        prisma.eventTeamCredential.findUnique({ where: { id: params.credentialId } }),
        prisma.teamMembership.findUnique({ where: { id: body.teamMembershipId } }),
      ]);

      if (!credential) return reply.code(404).send({ message: "Credencial não encontrada." });
      if (!membership) return reply.code(404).send({ message: "Membro oficial não encontrado." });
      if (membership.status !== "ACTIVE") {
        return reply.code(400).send({ message: "Só é possível associar credenciais a membros ativos." });
      }
      const before = teamCredentialAuditSnapshot(credential);

      const member = await prisma.eventTeamCredential.update({
        where: { id: credential.id },
        data: {
          teamMembershipId: membership.id,
          category: membership.category,
          team: membership.team,
          role: membership.role,
          accessLevel: membership.accessLevel,
          permissions: membership.permissions,
          name: normalizeOptional(credential.name) ?? membership.fullName,
        },
      });
      const after = teamCredentialAuditSnapshot(member);

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_membership.link_credential",
        entityType: "EventTeamCredential",
        entityId: credential.id,
        summary: `Credencial de ${member.name ?? member.publicSlug} associada a ${membership.fullName}.`,
        metadata: {
          before,
          after,
          changedFields: changedFields(before, after),
          teamMembership: teamMembershipAuditSnapshot(membership),
        },
      });

      return serializeMember(opts.env, member);
    });

    adminApp.get("/admin/session-profile", {
      config: { adminPermissionPolicy: null },
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: adminSessionProfileResponseSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request) => {
      if (request.jury) {
        return {
          requiresCompletion: false,
          reason: null,
          completionScore: 100,
          missingFields: [],
          student: null,
          member: null,
        };
      }

      const studentNumber = request.student?.studentNumber;
      if (!studentNumber) {
        return {
          requiresCompletion: false,
          reason: null,
          completionScore: 100,
          missingFields: [],
          student: null,
          member: null,
        };
      }

      const [student, adminProfile, membership] = await Promise.all([
        prisma.student.findUnique({
          where: { studentNumber },
          select: {
            studentNumber: true,
            name: true,
            email: true,
            course: true,
            phone: true,
            avatarUrl: true,
            bio: true,
            address: true,
            instagramUrl: true,
            facebookUrl: true,
            linkedinUrl: true,
            githubUrl: true,
            websiteUrl: true,
            profileCompletedAt: true,
            profileExtra: true,
          },
        }),
        getAdminProfileByStudentNumber(studentNumber),
        findActiveMembershipForStudent(studentNumber),
      ]);

      let member = await findCredentialForStudent(membership?.id);

      if (!member && membership) {
        member = await prisma.eventTeamCredential.create({
          data: {
            token: createToken("cred"),
            teamMembershipId: membership.id,
            publicSlug: await createUniquePublicSlug(membership.fullName),
            category: membership.category,
            team: membership.team,
            role: membership.role,
            accessLevel: membership.accessLevel,
            permissions: normalizePermissionList(adminProfile?.isSuperAdmin ? ["ALL"] : parsePermissions(membership.permissions)),
            status: "INVITED",
            issuedAt: new Date(),
            issuedByStudentNumber: studentNumber,
            name: membership.fullName,
            email: student?.email,
            phone: student?.phone,
            course: student?.course,
            photoUrl: student?.avatarUrl,
            createdByStudentNumber: studentNumber,
          },
        });
        member = await persistTeamCredentialIssueSnapshot(member, "ADMIN_SESSION_AUTO_CREATE", studentNumber);
        await recordAdminAudit({
          ...auditActor(request),
          action: "team_credential.auto_create",
          entityType: "EventTeamCredential",
          entityId: member.id,
          summary: `Credencial administrativa criada a partir do cadastro digital para ${membership.fullName}.`,
          metadata: {
            after: teamCredentialAuditSnapshot(member),
            teamMembership: teamMembershipAuditSnapshot(membership),
          },
        });
      }

      if (!member && student?.name && adminProfile) {
        member = await findSelfIssuedAdminCredential(studentNumber, student.name);
      }

      if (!member && student?.name && adminProfile) {
        member = await prisma.eventTeamCredential.create({
          data: {
            token: createToken("cred"),
            publicSlug: await createUniquePublicSlug(student.name),
            category: "NUCLEO",
            team: adminProfile.team,
            role: adminProfile.isSuperAdmin ? "Admin geral" : adminProfile.role,
            accessLevel: adminProfile.isSuperAdmin ? "Admin geral" : adminProfile.team,
            permissions: normalizePermissionList(adminProfile.isSuperAdmin ? ["OVERVIEW", "SECURITY"] : adminProfile.permissions),
            status: "INVITED",
            issuedAt: new Date(),
            issuedByStudentNumber: studentNumber,
            name: student.name,
            email: student.email,
            phone: student.phone,
            course: student.course,
            photoUrl: student.avatarUrl,
            createdByStudentNumber: studentNumber,
          },
        });
        member = await persistTeamCredentialIssueSnapshot(member, "ADMIN_SESSION_AUTO_CREATE", studentNumber);
        await recordAdminAudit({
          ...auditActor(request),
          action: "team_credential.auto_create",
          entityType: "EventTeamCredential",
          entityId: member.id,
          summary: `Credencial administrativa criada para ${student.name}.`,
          metadata: {
            after: teamCredentialAuditSnapshot(member),
            source: "admin_profile",
          },
        });
      }

      if (student?.profileCompletedAt && member) {
        const syncedProfileExtras = buildCredentialProfileExtraData({
          name: student.name ?? member.name ?? "Membro UOR Connect",
          email: student.email,
          phone: student.phone,
          course: student.course,
          organization: opts.env.UORCONNECT_INSTITUTION_NAME,
          bio: student.bio,
          photoUrl: student.profileExtra?.consentPhotoCredential ? student.avatarUrl : null,
          address: student.address,
          instagramUrl: student.instagramUrl,
          facebookUrl: student.facebookUrl,
          linkedinUrl: student.linkedinUrl,
          githubUrl: student.githubUrl,
          websiteUrl: student.websiteUrl,
          consentPhotoCredential: student.profileExtra?.consentPhotoCredential ?? false,
          consentPublicProfile: student.profileExtra?.consentPublicProfile ?? false,
          consentSocialLinks: student.profileExtra?.consentSocialLinks ?? false,
          consentSms: student.profileExtra?.consentSms ?? false,
          consentWhatsapp: student.profileExtra?.consentWhatsapp ?? false,
        });
        member = await prisma.eventTeamCredential.update({
          where: { id: member.id },
          data: {
            status: "PROFILE_READY",
            invitationExpiresAt: null,
            name: student.name ?? member.name,
            email: student.email ?? member.email,
            phone: student.phone ?? member.phone,
            course: student.course ?? member.course,
            organization: member.organization ?? opts.env.UORCONNECT_INSTITUTION_NAME,
            bio: student.bio ?? member.bio,
            photoUrl: student.profileExtra?.consentPhotoCredential ? student.avatarUrl ?? member.photoUrl : null,
            ...syncedProfileExtras,
            notes: null,
            submittedAt: member.submittedAt ?? new Date(),
          },
        });
        member = await persistTeamCredentialIssueSnapshot(member, "ADMIN_PROFILE_SYNC", studentNumber);
      }

      const completion = profileCompletion("ADMIN_READY", {
        student,
        profileExtra: student?.profileExtra,
        member,
      });
      const studentProfileReady = completion.ready;
      const { profileExtra: _profileExtra, ...studentPayload } = student ?? {};

      return {
        requiresCompletion: Boolean(member && !studentProfileReady),
        reason: member && !studentProfileReady
          ? "Completa o teu perfil UOR Connect uma única vez para usar a consola e as credenciais."
          : null,
        completionScore: completion.completionScore,
        missingFields: completion.missingFields,
        student: student ? {
          ...studentPayload,
          profileCompletedAt: student.profileCompletedAt?.toISOString() ?? null,
        } : null,
        member: member ? serializeMember(opts.env, member) : null,
      };
    });

    adminApp.get("/admin/incomplete-profiles", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: incompleteProfilesResponseSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async () => {
      const members = await prisma.eventTeamCredential.findMany({
        where: { status: { notIn: ["DISABLED", "REVOKED"] } },
        orderBy: [{ team: "asc" }, { name: "asc" }, { createdAt: "desc" }],
      });
      const serializedMembers = members.filter(isCredentialUsable).map((member) => serializeMemberWithCompletion(opts.env, member));
      const incomplete = serializedMembers.filter((member) =>
        !isCredentialReadyStatus(member.status) || member.missingFields.some((field) => field.required),
      );

      return {
        stats: {
          total: serializedMembers.length,
          incomplete: incomplete.length,
          ready: serializedMembers.length - incomplete.length,
        },
        members: incomplete,
      };
    });

    adminApp.get("/admin/pass-templates", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: z.object({ templates: z.array(credentialPrintTemplateResponseSchema) }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async () => {
      const rows = await prisma.credentialPrintTemplate.findMany();
      const rowByCategory = new Map(rows.map((row) => [row.category, row]));
      return {
        templates: memberCategories.map((category) => serializeCredentialPrintTemplate(category, rowByCategory.get(category))),
      };
    });

    adminApp.put("/admin/pass-templates/:category", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ category: z.enum(memberCategories) }),
        body: credentialPrintTemplateInputSchema,
        response: {
          200: credentialPrintTemplateResponseSchema,
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request) => {
      const params = z.object({ category: z.enum(memberCategories) }).parse(request.params);
      const body = credentialPrintTemplateInputSchema.parse(request.body);
      const row = await prisma.credentialPrintTemplate.upsert({
        where: { category: params.category },
        create: {
          category: params.category,
          primaryColor: body.primaryColor,
          accentColor: body.accentColor,
          lightColor: body.lightColor,
          footerLabel: body.footerLabel?.trim() || categoryTheme(params.category).footerLabel,
          updatedByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
        },
        update: {
          primaryColor: body.primaryColor,
          accentColor: body.accentColor,
          lightColor: body.lightColor,
          footerLabel: body.footerLabel?.trim() || categoryTheme(params.category).footerLabel,
          updatedByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
        },
      });

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.pass_template_update",
        entityType: "CredentialPrintTemplate",
        entityId: row.id,
        summary: `Template de passe atualizado para ${categoryLabel(params.category)}.`,
        metadata: {
          category: params.category,
          primaryColor: row.primaryColor,
          accentColor: row.accentColor,
          lightColor: row.lightColor,
          footerLabel: row.footerLabel,
        },
      });

      return serializeCredentialPrintTemplate(params.category, row);
    });

    adminApp.get("/admin/members/pass-batch.pdf", {
      schema: {
        tags: ["Team Credentials"],
        querystring: adminPassBatchQuerySchema,
        response: {
          404: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const query = adminPassBatchQuerySchema.parse(request.query);
      if (query.calibration) {
        await recordAdminAudit({
          ...auditActor(request),
          action: "team_credential.pass_batch_calibration_pdf",
          entityType: "EventTeamCredential",
          summary: "Teste de alinhamento A4 4 por página gerado para passes.",
          metadata: {
            printMode: query.printMode,
            side: query.side,
            layout: query.layout,
            duplexMode: query.duplexMode,
            marginMm: query.marginMm,
            bleedMm: query.bleedMm,
            laminationMarginMm: query.laminationMarginMm,
          },
        });
        return sendCredentialPassCalibrationPdf(reply, {
          printMode: query.printMode,
          side: query.side,
          layout: "a4-4up",
          duplexMode: query.duplexMode,
          marginMm: query.marginMm,
          bleedMm: query.bleedMm,
          laminationMarginMm: query.laminationMarginMm,
        });
      }

      const ids = query.ids
        ? query.ids.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0)
        : [];
      const members = await prisma.eventTeamCredential.findMany({
        where: {
          ...(ids.length > 0 ? { id: { in: ids } } : {}),
          ...(query.category ? { category: query.category } : {}),
          ...(query.team ? { team: { contains: query.team } } : {}),
          status: { notIn: ["DISABLED", "REVOKED"] },
        },
        orderBy: [{ team: "asc" }, { name: "asc" }, { createdAt: "desc" }],
        take: query.limit,
      });
      const linkedMembershipIds = members
        .map((member) => member.teamMembershipId)
        .filter((id): id is number => Boolean(id));
      const linkedMemberships = linkedMembershipIds.length > 0
        ? await prisma.teamMembership.findMany({ where: { id: { in: linkedMembershipIds } } })
        : [];
      const membershipById = new Map(linkedMemberships.map((membership) => [membership.id, membership]));
      const printableMembers = dedupeCredentialsForDisplay(members)
        .filter((member) => isCredentialConsistentWithMembership(member, membershipById.get(member.teamMembershipId ?? -1)))
        .filter((member) => isOfficialNucleusBatchCredential(member, membershipById.get(member.teamMembershipId ?? -1)))
        .map((member) => applyOfficialMembershipToNucleusBatchCredential(member, membershipById.get(member.teamMembershipId ?? -1)))
        .filter((member) => isCredentialPrintableForAdminBatch(member, query.includePending));
      if (printableMembers.length === 0) {
        return reply.code(404).send({ message: "Nenhuma credencial pronta para impressao em lote." });
      }

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.pass_batch_pdf",
        entityType: "EventTeamCredential",
        summary: `Lote A4 de passes gerado com ${printableMembers.length} credencial(is).`,
        metadata: {
          count: printableMembers.length,
          ids: printableMembers.map((member) => member.id),
          category: query.category ?? null,
          team: query.team ?? null,
          includePending: query.includePending,
          printMode: query.printMode,
          side: query.side,
          layout: query.layout,
          duplexMode: query.duplexMode,
          marginMm: query.marginMm,
          bleedMm: query.bleedMm,
          laminationMarginMm: query.laminationMarginMm,
        },
      });

      return sendCredentialPassBatchPdf(reply, opts.env, printableMembers, {
        printMode: query.printMode,
        side: query.side,
        layout: query.layout,
        duplexMode: query.duplexMode,
        marginMm: query.marginMm,
        bleedMm: query.bleedMm,
        laminationMarginMm: query.laminationMarginMm,
      });
    });

    adminApp.get("/admin/print-batches", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: z.object({ batches: z.array(printBatchResponseSchema) }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async () => {
      const batches = await prisma.credentialPrintBatch.findMany({
        include: {
          items: {
            orderBy: { position: "asc" },
            include: { credential: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      return { batches: batches.map((batch) => serializePrintBatch(opts.env, batch)) };
    });

    adminApp.post("/admin/print-batches", {
      schema: {
        tags: ["Team Credentials"],
        body: printBatchCreateSchema,
        response: {
          201: printBatchResponseSchema,
          400: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const body = printBatchCreateSchema.parse(request.body);
      const nominalItems = body.nominalItems;
      const genericItemCount = body.genericItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalItems = nominalItems.length + genericItemCount;
      if (totalItems === 0) {
        return reply.code(400).send({ message: "Adiciona pelo menos um passe nominal ou genérico ao lote." });
      }
      if (totalItems > 80) {
        return reply.code(400).send({ message: "Um lote pode ter no máximo 80 passes por PDF." });
      }

      const actorStudentNumber = request.student?.studentNumber ?? request.jury?.phone ?? null;
      const nominalCredentialDrafts = await Promise.all(nominalItems.map(async (item) => ({
        item,
        publicSlug: await createUniquePublicSlug(item.name),
        photoUrl: await persistMediaValue(opts.env, normalizeOptional(item.photoUrl), {
          purpose: "credential-photos",
          maxImageDimension: 900,
        }),
      })));

      const genericCredentialDrafts: Array<{
        item: PrintBatchGenericItem;
        name: string;
        publicSlug: string;
      }> = [];
      for (const item of body.genericItems) {
        for (let index = 0; index < item.quantity; index += 1) {
          const name = genericCredentialName(item, index);
          genericCredentialDrafts.push({
            item,
            name,
            publicSlug: await createUniquePublicSlug(name),
          });
        }
      }

      const createdForSnapshot: Array<{ credential: EventTeamCredentialRecord; reason: "PRINT_BATCH_NOMINAL" | "PRINT_BATCH_GENERIC" }> = [];
      const mode = inferPrintBatchMode(nominalItems.length, genericItemCount);
      const batch = await prisma.$transaction(async (tx) => {
        const createdBatch = await tx.credentialPrintBatch.create({
          data: {
            code: printBatchCode(),
            title: body.title,
            mode,
            status: "READY",
            totalItems,
            createdByStudentNumber: actorStudentNumber,
            notes: normalizeOptional(body.notes),
          },
        });

        let position = 1;
        for (const draft of nominalCredentialDrafts) {
          const item = draft.item;
          const credential = await tx.eventTeamCredential.create({
            data: {
              token: createToken("cred"),
              publicSlug: draft.publicSlug,
              category: item.category,
              team: item.team,
              role: item.role,
              accessLevel: item.accessLevel,
              permissions: normalizePermissionList(item.permissions),
              status: "PROFILE_READY",
              name: normalizeOptional(item.name),
              email: normalizeOptional(item.email),
              phone: normalizeOptional(item.phone),
              course: normalizeOptional(item.course),
              organization: normalizeOptional(item.organization),
              bio: normalizeOptional(item.bio),
              photoUrl: draft.photoUrl ?? null,
              address: normalizeOptional(item.address),
              instagramUrl: normalizeOptional(item.instagramUrl),
              facebookUrl: normalizeOptional(item.facebookUrl),
              linkedinUrl: normalizeOptional(item.linkedinUrl),
              githubUrl: normalizeOptional(item.githubUrl),
              websiteUrl: normalizeOptional(item.websiteUrl),
              consentPhotoCredential: Boolean(draft.photoUrl),
              consentPublicProfile: true,
              consentSocialLinks: hasSocialLinks(item),
              notes: normalizeOptional(item.notes),
              createdByStudentNumber: actorStudentNumber,
              issuedAt: new Date(),
              issuedByStudentNumber: actorStudentNumber,
              expiresAt: item.expiresAt ?? null,
              submittedAt: new Date(),
            },
          });
          createdForSnapshot.push({ credential, reason: "PRINT_BATCH_NOMINAL" });
          await tx.credentialPrintBatchItem.create({
            data: {
              batchId: createdBatch.id,
              credentialId: credential.id,
              position,
              label: item.name,
              itemType: "NOMINAL",
            },
          });
          position += 1;
        }

        for (const draft of genericCredentialDrafts) {
          const item = draft.item;
          const credential = await tx.eventTeamCredential.create({
            data: {
              token: createToken("cred"),
              publicSlug: draft.publicSlug,
              category: item.category,
              team: item.team,
              role: item.role,
              accessLevel: item.accessLevel,
              permissions: normalizePermissionList(item.permissions),
              status: "PROFILE_READY",
              name: draft.name,
              organization: normalizeOptional(item.organization),
              notes: normalizeOptional(item.notes),
              createdByStudentNumber: actorStudentNumber,
              issuedAt: new Date(),
              issuedByStudentNumber: actorStudentNumber,
              expiresAt: item.expiresAt ?? null,
              submittedAt: new Date(),
            },
          });
          createdForSnapshot.push({ credential, reason: "PRINT_BATCH_GENERIC" });
          await tx.credentialPrintBatchItem.create({
            data: {
              batchId: createdBatch.id,
              credentialId: credential.id,
              position,
              label: draft.name,
              itemType: "GENERIC",
            },
          });
          position += 1;
        }

        return createdBatch;
      });

      await Promise.all(createdForSnapshot.map((item) =>
        persistTeamCredentialIssueSnapshot(item.credential, item.reason, actorStudentNumber),
      ));

      const batchWithItems = await prisma.credentialPrintBatch.findUnique({
        where: { id: batch.id },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: { credential: true },
          },
        },
      });
      if (!batchWithItems) {
        return reply.code(400).send({ message: "Lote criado, mas não foi possível carregar o detalhe." });
      }

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.print_batch_create",
        entityType: "CredentialPrintBatch",
        entityId: batch.id,
        summary: `Lote de impressão criado com ${totalItems} passe(s).`,
        metadata: {
          code: batch.code,
          title: batch.title,
          mode,
          totalItems,
          nominalItems: nominalItems.length,
          genericItems: genericItemCount,
        },
      });

      return reply.code(201).send(serializePrintBatch(opts.env, batchWithItems));
    });

    adminApp.get("/admin/print-batches/:id", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: printBatchResponseSchema,
          404: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
      const batch = await prisma.credentialPrintBatch.findUnique({
        where: { id: params.id },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: { credential: true },
          },
        },
      });
      if (!batch) return reply.code(404).send({ message: "Lote de impressão não encontrado." });
      return serializePrintBatch(opts.env, batch);
    });

    adminApp.get("/admin/print-batches/:id/pass.pdf", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ id: z.coerce.number().int().positive() }),
        querystring: credentialPassOptionsQuerySchema,
        response: {
          404: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
      const query = credentialPassOptionsQuerySchema.parse(request.query);
      const batch = await prisma.credentialPrintBatch.findUnique({
        where: { id: params.id },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: { credential: true },
          },
        },
      });
      if (!batch) return reply.code(404).send({ message: "Lote de impressão não encontrado." });
      const printableMembers = batch.items
        .map((item) => item.credential)
        .filter(isCredentialReadyForPublicUse);
      if (printableMembers.length === 0) {
        return reply.code(404).send({ message: "Este lote não tem passes prontos para impressão." });
      }

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.print_batch_pdf",
        entityType: "CredentialPrintBatch",
        entityId: batch.id,
        summary: `PDF do lote ${batch.code} gerado com ${printableMembers.length} passe(s).`,
        metadata: {
          code: batch.code,
          ids: printableMembers.map((member) => member.id),
          printMode: query.printMode,
          side: query.side,
          layout: query.layout,
          duplexMode: query.duplexMode,
          marginMm: query.marginMm,
          bleedMm: query.bleedMm,
          laminationMarginMm: query.laminationMarginMm,
        },
      });

      return sendCredentialPassBatchPdf(reply, opts.env, printableMembers, {
        printMode: query.printMode,
        side: query.side,
        layout: query.layout,
        duplexMode: query.duplexMode,
        marginMm: query.marginMm,
        bleedMm: query.bleedMm,
        laminationMarginMm: query.laminationMarginMm,
      });
    });

    adminApp.post("/admin/members", {
      schema: {
        tags: ["Team Credentials"],
        body: memberInputSchema,
        response: {
          201: memberResponseSchema,
          400: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const body = memberInputSchema.parse(request.body);
      const membership = body.teamMembershipId
        ? await prisma.teamMembership.findUnique({ where: { id: body.teamMembershipId } })
        : null;
      if (body.teamMembershipId && !membership) {
        return reply.code(404).send({ message: "Membro oficial não encontrado." });
      }
      if (membership && membership.status !== "ACTIVE") {
        return reply.code(400).send({ message: "Só é possível criar credencial para membro oficial ativo." });
      }

      const storedPhotoUrl = await persistMediaValue(opts.env, normalizeOptional(body.photoUrl), {
        purpose: "credential-photos",
        maxImageDimension: 900,
      });
      const publicSlug = await createUniquePublicSlug(membership?.fullName ?? body.name ?? body.team);
      const initialStatus = membership ? "INVITED" : body.name ? "PROFILE_READY" : "INVITED";
      let member = await prisma.eventTeamCredential.create({
        data: {
          token: createToken("cred"),
          teamMembershipId: membership?.id ?? null,
          publicSlug,
          category: membership?.category ?? body.category,
          team: membership?.team ?? body.team.trim(),
          role: membership?.role ?? body.role.trim(),
          accessLevel: membership?.accessLevel ?? body.accessLevel.trim(),
          permissions: membership?.permissions ?? normalizePermissionList(body.permissions),
          status: initialStatus,
          invitationExpiresAt: initialStatus === "INVITED" ? buildInvitationExpiresAt() : null,
          issuedAt: new Date(),
          issuedByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
          expiresAt: body.expiresAt ?? null,
          name: normalizeOptional(body.name) ?? membership?.fullName ?? null,
          email: normalizeOptional(body.email),
          phone: normalizeOptional(body.phone),
          course: normalizeOptional(body.course),
          organization: normalizeOptional(body.organization),
          bio: normalizeOptional(body.bio),
          photoUrl: storedPhotoUrl ?? null,
          address: normalizeOptional(body.address),
          instagramUrl: normalizeOptional(body.instagramUrl),
          facebookUrl: normalizeOptional(body.facebookUrl),
          linkedinUrl: normalizeOptional(body.linkedinUrl),
          githubUrl: normalizeOptional(body.githubUrl),
          websiteUrl: normalizeOptional(body.websiteUrl),
          consentPhotoCredential: body.consentPhotoCredential ?? Boolean(storedPhotoUrl),
          consentPublicProfile: body.consentPublicProfile ?? Boolean(body.name),
          consentSocialLinks: body.consentSocialLinks ?? hasSocialLinks(body),
          consentSms: body.consentSms ?? false,
          consentWhatsapp: body.consentWhatsapp ?? false,
          notes: normalizeOptional(body.notes),
          createdByStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? null,
          submittedAt: body.name ? new Date() : null,
        },
      });
      member = await persistTeamCredentialIssueSnapshot(
        member,
        initialStatus === "INVITED" ? "ADMIN_INVITATION" : "ADMIN_DIRECT_ISSUE",
        request.student?.studentNumber ?? request.jury?.phone ?? null,
      );
      const after = teamCredentialAuditSnapshot(member);

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.create",
        entityType: "EventTeamCredential",
        entityId: member.id,
        summary: `Credencial criada para ${member.name ?? member.team}.`,
        metadata: {
          after,
        },
      });

      return reply.code(201).send(serializeMember(opts.env, member));
    });

    adminApp.patch("/admin/members/:id", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: memberInputSchema.partial().extend({ status: z.enum(credentialStatuses).optional() }),
        response: {
          200: memberResponseSchema,
          404: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
      const body = memberInputSchema.partial().extend({ status: z.enum(credentialStatuses).optional() }).parse(request.body);
      const existing = await prisma.eventTeamCredential.findUnique({ where: { id: params.id } });
      if (!existing) return reply.code(404).send({ message: "Credencial não encontrada." });
      const before = teamCredentialAuditSnapshot(existing);
      const storedPhotoUrl = body.photoUrl !== undefined
        ? await persistMediaValue(opts.env, normalizeOptional(body.photoUrl), {
          purpose: "credential-photos",
          maxImageDimension: 900,
        })
        : undefined;
      const invitationStatusPatch = body.status === "INVITED"
        ? { invitationExpiresAt: buildInvitationExpiresAt() }
        : body.status
          ? { invitationExpiresAt: null }
          : {};

      let member = await prisma.eventTeamCredential.update({
        where: { id: params.id },
        data: {
          ...(body.category ? { category: body.category } : {}),
          ...(body.team ? { team: body.team.trim() } : {}),
          ...(body.role ? { role: body.role.trim() } : {}),
          ...(body.accessLevel ? { accessLevel: body.accessLevel.trim() } : {}),
          ...(body.permissions ? { permissions: normalizePermissionList(body.permissions) } : {}),
          ...(body.status ? { status: body.status } : {}),
          ...invitationStatusPatch,
          ...(body.name !== undefined ? { name: normalizeOptional(body.name) } : {}),
          ...(body.email !== undefined ? { email: normalizeOptional(body.email) } : {}),
          ...(body.phone !== undefined ? { phone: normalizeOptional(body.phone) } : {}),
          ...(body.course !== undefined ? { course: normalizeOptional(body.course) } : {}),
          ...(body.organization !== undefined ? { organization: normalizeOptional(body.organization) } : {}),
          ...(body.bio !== undefined ? { bio: normalizeOptional(body.bio) } : {}),
          ...(body.photoUrl !== undefined ? { photoUrl: storedPhotoUrl ?? null } : {}),
          ...(body.address !== undefined ? { address: normalizeOptional(body.address) } : {}),
          ...(body.instagramUrl !== undefined ? { instagramUrl: normalizeOptional(body.instagramUrl) } : {}),
          ...(body.facebookUrl !== undefined ? { facebookUrl: normalizeOptional(body.facebookUrl) } : {}),
          ...(body.linkedinUrl !== undefined ? { linkedinUrl: normalizeOptional(body.linkedinUrl) } : {}),
          ...(body.githubUrl !== undefined ? { githubUrl: normalizeOptional(body.githubUrl) } : {}),
          ...(body.websiteUrl !== undefined ? { websiteUrl: normalizeOptional(body.websiteUrl) } : {}),
          ...(body.consentPhotoCredential !== undefined ? { consentPhotoCredential: body.consentPhotoCredential } : {}),
          ...(body.consentPublicProfile !== undefined ? { consentPublicProfile: body.consentPublicProfile } : {}),
          ...(body.consentSocialLinks !== undefined ? { consentSocialLinks: body.consentSocialLinks } : {}),
          ...(body.consentSms !== undefined ? { consentSms: body.consentSms } : {}),
          ...(body.consentWhatsapp !== undefined ? { consentWhatsapp: body.consentWhatsapp } : {}),
          ...(body.notes !== undefined ? { notes: normalizeOptional(body.notes) } : {}),
          ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ?? null } : {}),
        },
      });
      if (body.status === "PROFILE_READY" || body.status === "ACTIVE") {
        member = await persistTeamCredentialIssueSnapshot(
          member,
          "ADMIN_STATUS_ISSUE",
          request.student?.studentNumber ?? request.jury?.phone ?? null,
        );
      }
      const after = teamCredentialAuditSnapshot(member);

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.update",
        entityType: "EventTeamCredential",
        entityId: member.id,
        summary: `Credencial atualizada para ${member.name ?? member.publicSlug}.`,
        metadata: {
          before,
          after,
          changedFields: changedFields(before, after),
        },
      });

      return serializeMember(opts.env, member);
    });

    adminApp.post("/admin/members/:id/revoke", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: credentialRevocationSchema,
        response: {
          200: memberResponseSchema,
          404: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
      const body = credentialRevocationSchema.parse(request.body);
      const existing = await prisma.eventTeamCredential.findUnique({ where: { id: params.id } });
      if (!existing) return reply.code(404).send({ message: "Credencial não encontrada." });
      const before = teamCredentialAuditSnapshot(existing);

      const member = await prisma.eventTeamCredential.update({
        where: { id: existing.id },
        data: {
          status: "REVOKED",
          revokedAt: new Date(),
          revokedReason: normalizeOptional(body.reason) ?? "Revogada pela administração.",
        },
      });
      const after = teamCredentialAuditSnapshot(member);

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.revoke",
        entityType: "EventTeamCredential",
        entityId: member.id,
        summary: `Credencial revogada: ${member.name ?? member.publicSlug}.`,
        metadata: {
          before,
          after,
          changedFields: changedFields(before, after),
        },
      });

      return serializeMember(opts.env, member);
    });

    adminApp.post("/admin/members/:id/reissue", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ id: z.coerce.number().int().positive() }),
        body: credentialReissueSchema,
        response: {
          200: credentialReissueResponseSchema,
          404: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
      const body = credentialReissueSchema.parse(request.body);
      const existing = await prisma.eventTeamCredential.findUnique({ where: { id: params.id } });
      if (!existing) return reply.code(404).send({ message: "Credencial não encontrada." });
      const before = teamCredentialAuditSnapshot(existing);
      const actorStudentNumber = request.student?.studentNumber ?? request.jury?.phone ?? null;
      const nextVersion = existing.version + 1;
      const nextPublicSlug = await createUniquePublicSlug(existing.name ?? existing.publicSlug);
      const nextStatus = existing.name ? "PROFILE_READY" : "INVITED";

      const [previous, createdNext] = await prisma.$transaction(async (tx) => {
        const revoked = await tx.eventTeamCredential.update({
          where: { id: existing.id },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
            revokedReason: `Reemitida na versão ${nextVersion}.`,
          },
        });
        const created = await tx.eventTeamCredential.create({
          data: {
            token: createToken("cred"),
            teamMembershipId: existing.teamMembershipId,
            publicSlug: nextPublicSlug,
            category: existing.category,
            team: existing.team,
            role: existing.role,
            accessLevel: existing.accessLevel,
            permissions: existing.permissions,
            status: nextStatus,
            invitationExpiresAt: nextStatus === "INVITED" ? buildInvitationExpiresAt() : null,
            name: existing.name,
            email: existing.email,
            phone: existing.phone,
            course: existing.course,
            organization: existing.organization,
            bio: existing.bio,
            photoUrl: existing.photoUrl,
            address: existing.address,
            instagramUrl: existing.instagramUrl,
            facebookUrl: existing.facebookUrl,
            linkedinUrl: existing.linkedinUrl,
            githubUrl: existing.githubUrl,
            websiteUrl: existing.websiteUrl,
            consentPhotoCredential: existing.consentPhotoCredential,
            consentPublicProfile: existing.consentPublicProfile,
            consentSocialLinks: existing.consentSocialLinks,
            consentSms: existing.consentSms,
            consentWhatsapp: existing.consentWhatsapp,
            notes: existing.notes,
            createdByStudentNumber: actorStudentNumber,
            issuedAt: new Date(),
            issuedByStudentNumber: actorStudentNumber,
            expiresAt: body.expiresAt ?? existing.expiresAt,
            version: nextVersion,
            reissuedFromId: existing.id,
            submittedAt: existing.name ? new Date() : null,
          },
        });
        return [revoked, created] as const;
      });

      const next = await persistTeamCredentialIssueSnapshot(createdNext, "ADMIN_REISSUE", actorStudentNumber);
      const previousAfter = teamCredentialAuditSnapshot(previous);
      const nextAfter = teamCredentialAuditSnapshot(next);
      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.reissue",
        entityType: "EventTeamCredential",
        entityId: next.id,
        summary: `Credencial reemitida: ${next.name ?? next.publicSlug} v${next.version}.`,
        metadata: {
          previousBefore: before,
          previousAfter,
          next: nextAfter,
          changedFields: changedFields(before, previousAfter),
        },
      });

      return {
        previous: serializeMember(opts.env, previous),
        next: serializeMember(opts.env, next),
      };
    });

    adminApp.delete("/admin/members/:id", {
      schema: {
        tags: ["Team Credentials"],
        params: z.object({ id: z.coerce.number().int().positive() }),
        response: {
          200: z.object({ success: z.literal(true) }),
          404: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(request.params);
      const existing = await prisma.eventTeamCredential.findUnique({ where: { id: params.id } });
      if (!existing) return reply.code(404).send({ message: "Credencial não encontrada." });
      const member = await prisma.eventTeamCredential.update({
        where: { id: params.id },
        data: {
          status: "DISABLED",
          revokedAt: existing.revokedAt ?? new Date(),
          revokedReason: existing.revokedReason ?? "Removida da operação administrativa; histórico preservado.",
        },
      });
      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.disable",
        entityType: "EventTeamCredential",
        entityId: existing.id,
        summary: `Credencial desativada: ${existing.name ?? existing.publicSlug}.`,
        metadata: {
          before: teamCredentialAuditSnapshot(existing),
          after: teamCredentialAuditSnapshot(member),
        },
      });
      return { success: true as const };
    });

    adminApp.post("/admin/import-nucleus", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: z.object({
            created: z.number(),
            skipped: z.number(),
            membershipsCreated: z.number(),
            membershipsSkipped: z.number(),
            overview: overviewResponseSchema,
            membershipOverview: teamMembershipOverviewResponseSchema,
          }),
          400: z.object({ message: z.string() }),
          410: z.object({ message: z.string() }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request, reply) => {
      await recordAdminAudit({
        ...auditActor(request),
        action: "team_membership.import_nucleus.deprecated",
        entityType: "TeamMembership",
        entityId: "nucleus",
        summary: "Tentativa de importar lista antiga do Núcleo recusada; o fluxo atual usa tomada de posse por solicitação.",
        metadata: {
          actor: request.student?.studentNumber ?? request.jury?.phone ?? null,
        },
      });
      return reply.code(410).send({
        message: "A importação da lista antiga do Núcleo foi desativada. Usa o link coletivo e aprova as solicitações de tomada de posse.",
      });
    });

    adminApp.post("/admin/bulk-invitation", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: z.object({
            token: z.string(),
            url: z.string(),
            totalMembers: z.number(),
            claimed: z.number(),
            pending: z.number(),
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request) => {
      // Check for existing bulk token
      const existingBulk = await prisma.eventTeamCredential.findFirst({
        where: { token: { startsWith: "bulk_nucleo_" }, status: { notIn: ["REVOKED", "DISABLED"] } },
      });

      let bulkToken: string;

      if (existingBulk) {
        bulkToken = existingBulk.token;
        if (!existingBulk.invitationExpiresAt || isCredentialInvitationExpired(existingBulk)) {
          await prisma.eventTeamCredential.update({
            where: { id: existingBulk.id },
            data: { status: "INVITED", invitationExpiresAt: buildInvitationExpiresAt() },
          });
        }
      } else {
        bulkToken = `bulk_nucleo_${randomUUID().replace(/-/g, "")}`;
        const credential = await prisma.eventTeamCredential.create({
          data: {
            token: bulkToken,
            publicSlug: await createUniquePublicSlug("nucleo-coletivo"),
            category: "NUCLEO",
            team: "Núcleo",
            role: "Convite Coletivo",
            accessLevel: "Membro",
            permissions: "",
            status: "INVITED",
            invitationExpiresAt: buildInvitationExpiresAt(),
            name: "Convite Coletivo do Núcleo",
            issuedAt: new Date(),
            issuedByStudentNumber: request.student?.studentNumber ?? null,
          },
        });
        await persistTeamCredentialIssueSnapshot(
          credential,
          "NUCLEUS_BULK_INVITATION",
          request.student?.studentNumber ?? null,
        );
      }

      // Count progress from the new possession request flow.
      const [approvedClaims, pendingClaims] = await Promise.all([
        prisma.teamMembershipClaim.count({ where: { status: "APPROVED", requestedCategory: "NUCLEO" } }),
        prisma.teamMembershipClaim.count({ where: { status: "PENDING_REVIEW", requestedCategory: "NUCLEO" } }),
      ]);

      const publicAppUrl = getPublicAppUrl(opts.env);

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.bulk_invitation",
        entityType: "EventTeamCredential",
        entityId: bulkToken,
        summary: `Link coletivo do Núcleo ${existingBulk ? "consultado" : "criado"}.`,
        metadata: { approvedRequests: approvedClaims, pendingRequests: pendingClaims },
      });

      return {
        token: bulkToken,
        url: `${publicAppUrl}/equipa/credencial/${bulkToken}`,
        totalMembers: approvedClaims + pendingClaims,
        claimed: approvedClaims,
        pending: pendingClaims,
      };
    });

    adminApp.post("/admin/import-expositors", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: z.object({
            created: z.number(),
            skipped: z.number(),
            membershipsCreated: z.number(),
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request) => {
      const approvedSubmissions = await prisma.submission.findMany({
        where: { status: "APPROVED" },
        include: {
          student: { select: { id: true, studentNumber: true, name: true, phone: true } },
          memberConfirmations: {
            where: { confirmedAt: { not: null } },
            select: { studentId: true, studentNumber: true, studentName: true, name: true },
          },
        },
      });

      let created = 0;
      let skipped = 0;
      let membershipsCreated = 0;
      const actorNumber = request.student?.studentNumber ?? request.jury?.phone ?? null;

      for (const submission of approvedSubmissions) {
        // Process submission leader
        const leader = submission.student;
        if (leader?.studentNumber) {
          const result = await upsertExpositorCredential({
            studentNumber: leader.studentNumber,
            name: leader.name ?? "Expositor",
            submission,
            actorNumber,
          });
          if (result === "created") created += 1;
          else if (result === "membership_created") { membershipsCreated += 1; created += 1; }
          else skipped += 1;
        }

        // Process confirmed members
        for (const member of submission.memberConfirmations) {
          if (member.studentNumber) {
            const result = await upsertExpositorCredential({
              studentNumber: member.studentNumber,
              name: member.studentName ?? member.name,
              submission,
              actorNumber,
            });
            if (result === "created") created += 1;
            else if (result === "membership_created") { membershipsCreated += 1; created += 1; }
            else skipped += 1;
          }
        }
      }

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.import_expositors",
        entityType: "EventTeamCredential",
        entityId: "expositors",
        summary: `Expositores importados: ${created} credencial(is), ${membershipsCreated} membro(s).`,
        metadata: { created, skipped, membershipsCreated },
      });

      return { created, skipped, membershipsCreated };
    });

    adminApp.post("/admin/sync-site-guests", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: z.object({
            created: z.number(),
            updated: z.number(),
            skipped: z.number(),
            speakers: z.number(),
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request) => {
      const speakers = await prisma.speaker.findMany({
        orderBy: [{ day: "asc" }, { name: "asc" }],
      });
      const actorNumber = request.student?.studentNumber ?? request.jury?.phone ?? null;
      const now = new Date();
      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const speaker of speakers) {
        const sourceMarker = `source:speaker:${speaker.id}`;
        const name = normalizeOptional(speaker.name);
        if (!name) {
          skipped += 1;
          continue;
        }

        const existing = await prisma.eventTeamCredential.findFirst({
          where: {
            status: { notIn: ["REVOKED", "DISABLED"] },
            OR: [
              { notes: { contains: sourceMarker } },
              {
                category: "PALESTRANTE",
                name,
                role: speaker.talk,
              },
            ],
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        });

        const credentialData = {
          category: "PALESTRANTE",
          team: "Palestrantes do site",
          role: normalizeOptional(speaker.talk) ?? "Palestrante",
          accessLevel: "Convidado",
          permissions: "EVENTO,SPEAKERS",
          status: "PROFILE_READY" as const,
          invitationExpiresAt: null,
          name,
          organization: normalizeOptional(speaker.specialty) ?? "UOR Connect",
          bio: normalizeOptional(speaker.bio),
          photoUrl: normalizeOptional(speaker.avatarUrl),
          linkedinUrl: normalizeOptional(speaker.linkedin),
          consentPhotoCredential: Boolean(normalizeOptional(speaker.avatarUrl)),
          consentPublicProfile: true,
          consentSocialLinks: Boolean(normalizeOptional(speaker.linkedin)),
          notes: `${sourceMarker}; day:${speaker.day}; talk:${speaker.talk}`,
          issuedAt: existing?.issuedAt ?? now,
          issuedByStudentNumber: existing?.issuedByStudentNumber ?? actorNumber,
          submittedAt: existing?.submittedAt ?? now,
        };

        const credential = existing
          ? await prisma.eventTeamCredential.update({
              where: { id: existing.id },
              data: credentialData,
            })
          : await prisma.eventTeamCredential.create({
              data: {
                ...credentialData,
                token: createToken("cred"),
                publicSlug: await createUniquePublicSlug(name),
                createdByStudentNumber: actorNumber,
              },
            });

        await persistTeamCredentialIssueSnapshot(credential, "SPEAKER_SYNC", actorNumber);

        if (existing) updated += 1;
        else created += 1;
      }

      await recordAdminAudit({
        ...auditActor(request),
        action: "team_credential.sync_site_guests",
        entityType: "EventTeamCredential",
        entityId: "site-speakers",
        summary: `Convidados/palestrantes do site sincronizados: ${created} novo(s), ${updated} atualizado(s).`,
        metadata: { created, updated, skipped, speakers: speakers.length },
      });

      return { created, updated, skipped, speakers: speakers.length };
    });

    adminApp.post("/admin/bulk-expositor-invitation", {
      schema: {
        tags: ["Team Credentials"],
        response: {
          200: z.object({
            token: z.string(),
            url: z.string(),
            totalExpositors: z.number(),
            claimed: z.number(),
            pending: z.number(),
          }),
          401: z.object({ message: z.string() }),
          403: z.object({ message: z.string() }),
        },
      },
    }, async (request) => {
      const existingBulk = await prisma.eventTeamCredential.findFirst({
        where: { token: { startsWith: "bulk_expositor_" }, status: { notIn: ["REVOKED", "DISABLED"] } },
      });

      let bulkToken: string;
      if (existingBulk) {
        bulkToken = existingBulk.token;
        if (!existingBulk.invitationExpiresAt || isCredentialInvitationExpired(existingBulk)) {
          await prisma.eventTeamCredential.update({
            where: { id: existingBulk.id },
            data: { status: "INVITED", invitationExpiresAt: buildInvitationExpiresAt() },
          });
        }
      } else {
        bulkToken = `bulk_expositor_${randomUUID().replace(/-/g, "")}`;
        const credential = await prisma.eventTeamCredential.create({
          data: {
            token: bulkToken,
            publicSlug: await createUniquePublicSlug("expositor-coletivo"),
            category: "EXPOSITOR",
            team: "Expositores",
            role: "Convite Coletivo",
            accessLevel: "Expositor",
            permissions: "EVENTO",
            status: "INVITED",
            invitationExpiresAt: buildInvitationExpiresAt(),
            name: "Convite Coletivo de Expositores",
            issuedAt: new Date(),
            issuedByStudentNumber: request.student?.studentNumber ?? null,
          },
        });
        await persistTeamCredentialIssueSnapshot(
          credential,
          "EXPOSITOR_BULK_INVITATION",
          request.student?.studentNumber ?? null,
        );
      }

      const totalExpositors = await prisma.eventTeamCredential.count({
        where: { category: "EXPOSITOR", status: { not: "DISABLED" } },
      });
      const claimed = await prisma.eventTeamCredential.count({
        where: { category: "EXPOSITOR", status: "PROFILE_READY" },
      });

      const publicAppUrl = getPublicAppUrl(opts.env);

      return {
        token: bulkToken,
        url: `${publicAppUrl}/equipa/credencial/${bulkToken}`,
        totalExpositors,
        claimed,
        pending: totalExpositors - claimed,
      };
    });
  });
}

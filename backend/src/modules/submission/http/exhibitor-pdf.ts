import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import { renderQrDataUri } from "../../../shared/qr";
import { escapeHtml, formatDateLabel, loadLogoDataUri, renderPdfFromHtml } from "../../reports/http/pdf-report.utils";
import { buildSubmissionSlug, normalizeTeamMembersInput } from "../domain/submission-format";
import { getSubmissionTypeLabel, isCompetitionEligible } from "../domain/submission-policy";
import { buildSubmissionTeamPayload, normalizeSubmissionMemberKey } from "./submission-team";
import { isPaymentConfirmedByAdmin } from "../../payments/payment-status";
import {
  buildCredentialPassPrintContent,
  categoryTheme,
  type EventTeamCredentialRecord,
} from "../../team-credentials/http/team-credentials.routes";
import { buildValidationUrl } from "../../validation/application/validation-links";

const DEFAULT_PUBLIC_APP_URL = "http://localhost:5173";
const EXHIBITOR_PDF_TEMPLATE_VERSION = "premium-exhibitor-v8-mobile-live-guide";

type ExhibitorPdfSubmission = Awaited<ReturnType<typeof loadSubmissionForExhibitorPdf>>;
type ExhibitorPassTheme = ReturnType<typeof categoryTheme>;
type ExhibitorPdfPass = {
  name: string;
  role: "Representante" | "Membro";
  studentNumber: string | null;
  profileUrl: string;
};
type ExhibitorPdfPassDraft = Omit<ExhibitorPdfPass, "profileUrl">;
type ExhibitorPdfPassRender = ExhibitorPdfPass;

type ExhibitorPdfData = {
  nome: string;
  titulo: string;
  curso: string;
  numero: string;
  id: string;
  evento: string;
  dataEvento: string;
  localEvento: string;
  link: string;
  voteQrLink: string;
  challengeUrl: string;
  description: string;
  repoUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  email: string | null;
  area: string;
  tipo: string;
  submissionType: string;
  referencia: string;
  membros: string[];
  necessidades: string[];
  passes: ExhibitorPdfPass[];
  competitionEligible: boolean;
  coverEyebrow: string;
  approvedLabel: string;
  subjectLabel: string;
  subjectTitleLabel: string;
  publicPageLabel: string;
  qrLabel: string;
  qrPurpose: string;
  alertTitle: string;
  alertText: string;
  technicalIntro: string;
  technicalUsageAudience: string;
  technicalFooter: string;
};

export type ExhibitorPdfMetadata = {
  submissionId: number;
  referenceCode: string;
  version: number;
  fileName: string;
  storageFileName: string;
  fileSize: number;
  fingerprint: string;
  accessToken: string;
  qrValue: string;
  pdfPath: string;
  publicUrl: string | null;
  recipientEmail: string | null;
  generatedAt: string;
  event: {
    name: string;
    date: string;
    location: string;
  };
};

export type ExhibitorPdfGenerationResult = {
  metadata: ExhibitorPdfMetadata;
  buffer: Buffer;
  created: boolean;
};

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function getPublicAppUrl(env: Env) {
  return env.PUBLIC_APP_URL ? stripTrailingSlash(env.PUBLIC_APP_URL) : DEFAULT_PUBLIC_APP_URL;
}

function getPublicApiUrl(env: Env) {
  return env.PUBLIC_API_URL ? stripTrailingSlash(env.PUBLIC_API_URL) : null;
}

function getStorageRoot(env: Env) {
  return path.resolve(process.cwd(), env.EXHIBITOR_PDF_STORAGE_DIR);
}

function getSubmissionStorageDir(env: Env, submissionId: number) {
  return path.join(getStorageRoot(env), `submission-${submissionId}`);
}

function getLatestMetadataPath(env: Env, submissionId: number) {
  return path.join(getSubmissionStorageDir(env, submissionId), "latest.json");
}

function resolvePdfPath(env: Env, metadata: ExhibitorPdfMetadata) {
  return path.join(getSubmissionStorageDir(env, metadata.submissionId), metadata.storageFileName);
}

function sanitizeFilePart(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 70);

  return normalized || "UOR_Connect";
}

function createDownloadFileName(data: Pick<ExhibitorPdfData, "nome" | "evento">) {
  return `Manual_Expositor_${sanitizeFilePart(data.nome)}_${sanitizeFilePart(data.evento)}.pdf`;
}

function createStorageFileName(version: number, fileName: string) {
  return `${version}-${fileName}`;
}

function isSyntheticEmail(value?: string | null) {
  return Boolean(value && /^submission-\d+@uor-connect\.local$/i.test(value));
}

function compact(value?: string | null, fallback = "Não informado") {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function buildProjectUrl(env: Env, submission: { id: number; name: string }) {
  return `${getPublicAppUrl(env)}/projeto/${buildSubmissionSlug(submission.name, submission.id)}`;
}

function buildProjectVoteQrUrl(projectUrl: string) {
  const url = new URL(projectUrl);
  url.searchParams.set("vote", "1");
  url.searchParams.set("source", "exhibitor_qr");
  return url.toString();
}

function createQrActionToken() {
  return `qra_${randomUUID().replace(/-/g, "")}`;
}

async function resolveExhibitorPdfChallengeUrl(
  env: Env,
  submission: { id: number; name: string; type: string; area: string | null },
) {
  const existing = await prisma.qrAction.findFirst({
    where: {
      type: "EXHIBITOR_CHALLENGE",
      targetId: submission.id,
    },
    orderBy: [{ createdAt: "asc" }],
  });
  if (existing) return buildValidationUrl(env, existing.token);

  const mission = await prisma.passportMission.findUnique({
    where: { key: "exhibitor-challenge" },
    select: { id: true },
  }).catch(() => null);

  const action = await prisma.qrAction.create({
    data: {
      token: createQrActionToken(),
      type: "EXHIBITOR_CHALLENGE",
      label: `Desafio: ${submission.name}`,
      description: "QR do expositor para liberar pergunta do Passaporte Digital.",
      targetId: submission.id,
      targetMeta: JSON.stringify({
        submissionId: submission.id,
        submissionName: submission.name,
        submissionType: submission.type,
        submissionArea: submission.area,
        source: "EXHIBITOR_MANUAL_PASS_BACK_QR",
      }),
      eventKey: `submission:${submission.id}:challenge`,
      eventLabel: submission.name,
      active: true,
      passportMissionId: mission?.id ?? null,
    },
  });

  return buildValidationUrl(env, action.token);
}

function buildPdfRoute(submissionId: number, accessToken?: string) {
  const token = accessToken ? `?token=${encodeURIComponent(accessToken)}` : "";
  return `/submissions/${submissionId}/exhibitor-pack.pdf${token}`;
}

function buildPublicPdfUrl(env: Env, submissionId: number, accessToken: string) {
  const publicApiUrl = getPublicApiUrl(env);
  return publicApiUrl ? `${publicApiUrl}${buildPdfRoute(submissionId, accessToken)}` : null;
}

function hashPdfData(data: ExhibitorPdfData, passTheme: ExhibitorPassTheme) {
  return createHash("sha256")
    .update(EXHIBITOR_PDF_TEMPLATE_VERSION)
    .update(JSON.stringify({ data, passTheme }))
    .digest("hex");
}

async function pathExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadLatestExhibitorPdfMetadata(env: Env, submissionId: number) {
  try {
    const payload = await readFile(getLatestMetadataPath(env, submissionId), "utf8");
    return JSON.parse(payload) as ExhibitorPdfMetadata;
  } catch {
    return null;
  }
}

export async function readExhibitorPdfFile(env: Env, metadata: ExhibitorPdfMetadata) {
  return readFile(resolvePdfPath(env, metadata));
}

async function loadExhibitorPassTheme(): Promise<ExhibitorPassTheme> {
  const base = categoryTheme("EXPOSITOR", "color");
  const row = await prisma.credentialPrintTemplate.findUnique({ where: { category: "EXPOSITOR" } });
  if (!row) return base;

  return {
    ...base,
    primary: row.primaryColor,
    accent: row.accentColor,
    light: row.lightColor,
    footerLabel: row.footerLabel?.trim() || base.footerLabel,
  };
}

async function loadSubmissionForExhibitorPdf(submissionId: number) {
  return prisma.submission.findFirst({
    where: { id: submissionId, deletedAt: null },
    include: {
      student: {
        select: {
          id: true,
          studentNumber: true,
          name: true,
          email: true,
          course: true,
          phone: true,
        },
      },
    },
  });
}

async function mapSubmissionToPdfData(
  env: Env,
  submission: NonNullable<ExhibitorPdfSubmission>,
  team: Awaited<ReturnType<typeof buildSubmissionTeamPayload>>,
): Promise<ExhibitorPdfData> {
  const members = normalizeTeamMembersInput(submission.members);
  const email = !isSyntheticEmail(submission.leaderEmail)
    ? submission.leaderEmail
    : submission.student?.email ?? null;
  const studentNumber = submission.student?.studentNumber ?? submission.studentNumberSnapshot ?? `EXP-${submission.id}`;
  const projectUrl = buildProjectUrl(env, submission);
  const voteQrLink = buildProjectVoteQrUrl(projectUrl);
  const challengeUrl = await resolveExhibitorPdfChallengeUrl(env, submission);
  const tipo = getSubmissionTypeLabel(submission.type, submission.area);
  const competitionEligible = isCompetitionEligible(submission.type, submission.area);
  const subjectLabel = competitionEligible ? "projeto" : "expositor";
  const subjectTitleLabel = competitionEligible ? "Projeto" : "Expositor";
  const seenPasses = new Set<string>();
  const passDrafts: ExhibitorPdfPassDraft[] = [];
  const addPass = (pass: ExhibitorPdfPassDraft) => {
    const key = pass.studentNumber ? `student:${pass.studentNumber}` : `name:${normalizeSubmissionMemberKey(pass.name)}`;
    if (seenPasses.has(key)) return;
    seenPasses.add(key);
    passDrafts.push(pass);
  };

  addPass({
    name: compact(submission.leaderName ?? submission.student?.name, `Expositor ${studentNumber}`),
    role: "Representante",
    studentNumber,
  });

  for (const member of team.members) {
    if (!member.confirmed) continue;
    addPass({
      name: compact(member.studentName ?? member.name, member.name),
      role: "Membro",
      studentNumber: member.studentNumber,
    });
  }

  const credentials = await prisma.eventTeamCredential.findMany({
    where: {
      category: "EXPOSITOR",
      sourceSubmissionId: submission.id,
      status: { in: ["INVITED", "ISSUED", "PROFILE_READY", "ACTIVE"] },
    },
    select: {
      publicSlug: true,
      status: true,
      teamMembership: { select: { studentNumber: true } },
    },
  });
  const profileUrlByStudentNumber = new Map<string, string>();
  const statusPriority = new Map([
    ["ACTIVE", 0],
    ["PROFILE_READY", 1],
    ["ISSUED", 2],
    ["INVITED", 3],
  ]);
  const sortedCredentials = [...credentials].sort((left, right) =>
    (statusPriority.get(left.status) ?? 99) - (statusPriority.get(right.status) ?? 99),
  );
  for (const credential of sortedCredentials) {
    const number = credential.teamMembership?.studentNumber;
    if (number && !profileUrlByStudentNumber.has(number)) {
      profileUrlByStudentNumber.set(number, `${getPublicAppUrl(env)}/equipa/perfil/${encodeURIComponent(credential.publicSlug)}`);
    }
  }
  const passes = passDrafts.map((pass): ExhibitorPdfPass => ({
    ...pass,
    profileUrl: profileUrlByStudentNumber.get(pass.studentNumber ?? "") ?? projectUrl,
  }));

  return {
    nome: compact(submission.leaderName ?? submission.student?.name, `Expositor ${studentNumber}`),
    titulo: compact(submission.name, "Projeto aprovado"),
    curso: compact(submission.course ?? submission.student?.course ?? submission.area),
    numero: studentNumber,
    id: submission.referenceCode,
    evento: env.UORCONNECT_EVENT_NAME,
    dataEvento: env.UORCONNECT_EVENT_DATE,
    localEvento: env.UORCONNECT_EVENT_LOCATION,
    link: projectUrl,
    voteQrLink,
    challengeUrl,
    description: compact(submission.description, "Descrição pública ainda não preenchida."),
    repoUrl: submission.repoUrl ?? null,
    websiteUrl: submission.websiteUrl ?? null,
    instagramUrl: submission.instagramUrl ?? null,
    facebookUrl: submission.facebookUrl ?? null,
    linkedinUrl: submission.linkedinUrl ?? null,
    githubUrl: submission.githubUrl ?? null,
    email,
    area: compact(submission.area, "Geral"),
    tipo,
    submissionType: submission.type,
    referencia: submission.referenceCode,
    membros: members,
    necessidades: normalizeTeamMembersInput(submission.needs),
    passes,
    competitionEligible,
    coverEyebrow: competitionEligible
      ? "Credencial técnica de exposição"
      : "Participação expositiva sem votação pública",
    approvedLabel: competitionEligible ? "Projeto aprovado" : `${tipo} aprovado`,
    subjectLabel,
    subjectTitleLabel,
    publicPageLabel: `Página pública do ${subjectLabel}`,
    qrLabel: competitionEligible ? "QR Code oficial do projeto" : "QR Code oficial do expositor",
    qrPurpose: competitionEligible
      ? "Escaneia para ver o projeto. Usa este cartão na bancada durante a exposição."
      : "Escaneia para conhecer este expositor. Esta participação é expositiva e não concorre à votação pública de projetos.",
    alertTitle: competitionEligible ? "Pontos críticos" : "Participação sem votação",
    alertText: competitionEligible
      ? "A aprovação confirma a participação, mas não substitui o check-in no evento. O cartão QR deve estar impresso em boa qualidade, sem cortes junto ao código e pronto para leitura por visitantes e avaliadores. A pergunta obrigatória transforma a visita em aprendizagem ativa: o estudante escaneia o QR do expositor, responde na aplicação e recebe pontos quando acertar dentro das tentativas definidas."
      : "Esta categoria é expositiva: apresenta produto ou negócio ao público, mas não concorre à votação pública de projetos. A pergunta obrigatória transforma a visita em aprendizagem ativa. Os pontos pertencem ao Passaporte Digital do estudante e não criam votos, ranking ou vantagem competitiva para o expositor.",
    technicalIntro: competitionEligible
      ? "O QR Code liga o espaço físico da exposição à página pública do projeto, aumentando rastreabilidade, interação e visibilidade dentro do UOR Connect."
      : "O QR Code liga o espaço físico da exposição à página pública do expositor, aumentando rastreabilidade, interação e visibilidade dentro do UOR Connect sem abrir votação pública para esta categoria.",
    technicalUsageAudience: competitionEligible ? "visitantes e avaliadores" : "visitantes e equipa de apoio",
    technicalFooter: competitionEligible
      ? "projeto físico conectado à visibilidade digital"
      : "participação expositiva conectada à visibilidade digital",
  };
}

function listItems(items: string[]) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function logoMarkup(logoDataUri: string | null) {
  if (logoDataUri) {
    return `<img src="${logoDataUri}" alt="UOR Connect" class="brand-logo" />`;
  }

  return `
    <div class="brand-fallback">
      <div class="brand-symbol">UOR</div>
      <div>
        <strong>UOR Connect</strong>
        <span>Universidade Óscar Ribas</span>
      </div>
    </div>
  `;
}

function scissorsSvg(className: string) {
  return `
    <svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 7.5a2.5 2.5 0 1 0 4.2 1.8L20 4" />
      <path d="M4.5 16.5a2.5 2.5 0 1 1 4.2-1.8L20 20" />
      <path d="M8.7 9.3 12 12l-3.3 2.7" />
    </svg>
  `;
}

function infoRow(label: string, value: string) {
  return `
    <div class="info-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function shortUrlLabel(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./i, "");
    return `${host}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

function guideSection(title: string, items: string[], tone: "default" | "critical" | "challenge" = "default") {
  return `
    <section class="guide-section ${tone === "critical" ? "guide-section-critical" : ""} ${tone === "challenge" ? "guide-section-challenge" : ""}">
      <h2>${escapeHtml(title)}</h2>
      <ul>${listItems(items)}</ul>
    </section>
  `;
}

function manualStepList(items: string[]) {
  return `
    <ol class="mobile-step-list">
      ${items.map((item, index) => `<li><span>${index + 1}</span>${escapeHtml(item)}</li>`).join("")}
    </ol>
  `;
}

function manualMobileScreen(params: {
  title: string;
  badge: string;
  body: string;
  footer?: string;
}) {
  return `
    <div class="mobile-device">
      <div class="mobile-device-notch"></div>
      <div class="mobile-device-screen">
        <div class="mobile-app-bar">
          <div>
            <span>Minha Área</span>
            <strong>${escapeHtml(params.title)}</strong>
          </div>
          <em>${escapeHtml(params.badge)}</em>
        </div>
        ${params.body}
        ${params.footer ? `<div class="mobile-footer-note">${escapeHtml(params.footer)}</div>` : ""}
      </div>
    </div>
  `;
}

function mobileGuidePanel(params: {
  title: string;
  intro: string;
  snapshot: string;
  steps: string[];
  tone?: "default" | "green" | "cyan" | "violet" | "amber";
}) {
  return `
    <section class="mobile-guide-panel mobile-guide-panel-${params.tone ?? "default"}">
      <div class="mobile-guide-copy">
        <h2>${escapeHtml(params.title)}</h2>
        <p>${escapeHtml(params.intro)}</p>
        ${manualStepList(params.steps)}
      </div>
      ${params.snapshot}
    </section>
  `;
}

function manualLinkRows(data: ExhibitorPdfData) {
  const links = [
    { label: "Website", value: data.websiteUrl },
    { label: "Repositório", value: data.repoUrl },
    { label: "Instagram", value: data.instagramUrl },
    { label: "Facebook", value: data.facebookUrl },
    { label: "LinkedIn", value: data.linkedinUrl },
    { label: "GitHub", value: data.githubUrl },
  ].filter((link) => Boolean(link.value));

  if (links.length === 0) {
    return `<div class="mobile-empty-state">Sem links públicos adicionados.</div>`;
  }

  return links.slice(0, 4).map(({ label, value }) => `
    <div class="mobile-link-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(shortUrlLabel(value ?? ""))}</strong>
    </div>
  `).join("");
}

function buildMobileQrSnapshot(params: {
  data: ExhibitorPdfData;
  voteQrDataUri: string;
}) {
  return manualMobileScreen({
    title: "Início",
    badge: "QR",
    body: `
      <section class="mobile-card mobile-card-green">
        <div class="mobile-card-title-row">
          <span class="mobile-icon-box">QR</span>
          <div>
            <h3>QR de conversão do projeto</h3>
            <p>Leva o estudante direto à confirmação de voto.</p>
          </div>
        </div>
        <div class="mobile-qr-box">
          <img src="${params.voteQrDataUri}" alt="QR de conversão do projeto ${escapeHtml(params.data.titulo)}" />
        </div>
        <button>Gerar QR de votação</button>
        <small>${escapeHtml(shortUrlLabel(params.data.voteQrLink))}</small>
      </section>
    `,
    footer: "Mostra este QR no stand quando o estudante estiver pronto para votar.",
  });
}

function buildMobileDetailsSnapshot(data: ExhibitorPdfData) {
  return manualMobileScreen({
    title: "Projeto",
    badge: "Editar",
    body: `
      <section class="mobile-card mobile-card-cyan">
        <div class="mobile-card-title-row">
          <span class="mobile-icon-box">DET</span>
          <div>
            <h3>Detalhes públicos do projeto</h3>
            <p>Descrição, site, repositório e redes sociais.</p>
          </div>
        </div>
        <label>Descrição pública</label>
        <div class="mobile-textarea">${escapeHtml(data.description)}</div>
        <label>Links públicos</label>
        <div class="mobile-link-stack">${manualLinkRows(data)}</div>
        <button>Guardar detalhes públicos</button>
      </section>
    `,
    footer: "Editar aqui não reabre a submissão nem altera o estado financeiro.",
  });
}

function buildMobileTeamSnapshot(data: ExhibitorPdfData) {
  const sampleMembers = data.membros.slice(0, 3);
  return manualMobileScreen({
    title: "Projeto",
    badge: "Equipa",
    body: `
      <section class="mobile-card">
        <div class="mobile-card-title-row">
          <span class="mobile-icon-box">EQ</span>
          <div>
            <h3>Confirmação da equipa</h3>
            <p>Partilha convite, confirma externos e remove erros.</p>
          </div>
        </div>
        <div class="mobile-input-row">
          <span>Nome completo do membro</span>
          <button>Adicionar</button>
        </div>
        <div class="mobile-member-list">
          ${sampleMembers.map((member, index) => `
            <div class="mobile-member-row">
              <div><strong>${escapeHtml(member)}</strong><span>${index === 0 ? "Responsável" : "Membro"}</span></div>
              <em>${index === 0 ? "OK" : "A confirmar"}</em>
              ${index === 0 ? "" : "<button>Remover membro</button>"}
            </div>
          `).join("")}
        </div>
        <div class="mobile-dashed-box">
          <strong>Outra universidade / instituto médio</strong>
          <span>Instituição + telefone geram acesso temporário.</span>
        </div>
      </section>
    `,
    footer: "O responsável permanece protegido; os outros membros podem ser removidos antes da confirmação final.",
  });
}

function buildMobileChallengeSnapshot() {
  return manualMobileScreen({
    title: "Projeto",
    badge: "Desafio",
    body: `
      <section class="mobile-card mobile-card-violet">
        <div class="mobile-card-title-row">
          <span class="mobile-icon-box">?</span>
          <div>
            <h3>Desafio do expositor</h3>
            <p>Pergunta aprovada pela organização antes de dar pontos.</p>
          </div>
        </div>
        <div class="mobile-status-row"><span>Pendente</span><span>Aprovado</span><span>Rejeitado</span></div>
        <label>Pergunta</label>
        <div class="mobile-textarea short">Qual problema principal este projeto resolve?</div>
        <label>Opções de resposta</label>
        <div class="mobile-option-list"><span>Filas</span><span>Clima</span><span>Trânsito</span></div>
        <button>Guardar e enviar para aprovação</button>
      </section>
    `,
    footer: "Se a admin devolver nota, corrige e reenvia antes da atividade.",
  });
}

function buildMobileScoringSnapshot() {
  return manualMobileScreen({
    title: "Início",
    badge: "Pontos",
    body: `
      <section class="mobile-card mobile-card-amber">
        <div class="mobile-card-title-row">
          <span class="mobile-icon-box">XP</span>
          <div>
            <h3>Mapa do Expositor</h3>
            <p>Vê etapas, bónus, perdas e rondas do dia.</p>
          </div>
        </div>
        <div class="mobile-score-row">
          <div><span>Pontos atuais</span><strong>128 pts</strong></div>
          <div><span>Total disponível</span><strong>320 pts</strong></div>
        </div>
        <div class="mobile-round-flow">
          <span></span><span class="current"></span><span></span><span></span><span></span>
        </div>
        <div class="mobile-mission-list">
          <div><strong>Voto válido</strong><span>+1 ponto</span></div>
          <div><strong>Outra universidade</strong><span>+3 pontos</span></div>
          <div><strong>Streak ativo</strong><span>multiplicador</span></div>
        </div>
      </section>
    `,
    footer: "As animações de ganho/perda aparecem quando a pontuação muda.",
  });
}

function buildMobileRankingSnapshot(data: ExhibitorPdfData) {
  return manualMobileScreen({
    title: "Início",
    badge: "Ranking",
    body: `
      <section class="mobile-card">
        <div class="mobile-card-title-row">
          <span class="mobile-icon-box">R</span>
          <div>
            <h3>Ranking interno dos embaixadores</h3>
            <p>Mostra quem está a converter mais interações.</p>
          </div>
        </div>
        <div class="mobile-ranking-list">
          ${data.membros.slice(0, 4).map((member, index) => `
            <div>
              <span>${index + 1}</span>
              <strong>${escapeHtml(member)}</strong>
              <em>${Math.max(12, 44 - index * 7)} pts</em>
            </div>
          `).join("")}
        </div>
      </section>
    `,
    footer: "O ranking é interno ao grupo; serve para acompanhar empenho.",
  });
}

function buildManualPassCredentialRecord(pass: ExhibitorPdfPassRender, data: ExhibitorPdfData, index: number): EventTeamCredentialRecord {
  const createdAt = new Date(0);
  return {
    id: index + 1,
    teamMembershipId: null,
    token: `manual-exhibitor-${data.referencia}-${index + 1}`,
    publicSlug: `manual-exhibitor-${data.referencia}-${index + 1}`,
    category: "EXPOSITOR",
    team: "Expositores",
    role: pass.role,
    accessLevel: "Expositor",
    permissions: "EVENTO",
    status: "ACTIVE",
    name: pass.name,
    email: null,
    phone: null,
    course: data.curso,
    organization: data.titulo,
    bio: null,
    photoUrl: null,
    address: null,
    instagramUrl: null,
    facebookUrl: null,
    linkedinUrl: null,
    githubUrl: null,
    websiteUrl: null,
    consentPhotoCredential: true,
    consentPublicProfile: true,
    consentSocialLinks: false,
    consentSms: false,
    consentWhatsapp: false,
    sourceSubmissionId: null,
    sourceSubmissionRef: data.referencia,
    sourceSubmissionName: data.titulo,
    sourceSubmissionType: data.submissionType,
    sourceSubmissionArea: data.area,
    notes: pass.studentNumber ? `Nº ${pass.studentNumber}` : null,
    createdByStudentNumber: null,
    issuedAt: null,
    issuedByStudentNumber: null,
    issuedSnapshotJson: null,
    invitationExpiresAt: null,
    expiresAt: null,
    revokedAt: null,
    revokedReason: null,
    version: 1,
    reissuedFromId: null,
    submittedAt: null,
    lastPassIssuedAt: null,
    lastPassSnapshotJson: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildManualCredentialPassPrintContent(params: {
  data: ExhibitorPdfData;
  passes: ExhibitorPdfPassRender[];
  theme: ExhibitorPassTheme;
  projectQrDataUri: string;
  challengeQrDataUri: string;
  logoDataUri: string | null;
  startPage: number;
}) {
  return buildCredentialPassPrintContent({
    items: params.passes.map((pass, index) => ({
      member: buildManualPassCredentialRecord(pass, params.data, index),
      frontQrDataUri: params.projectQrDataUri,
      backQrDataUri: params.challengeQrDataUri,
      frontQrLabel: "Projeto do expositor",
      backQrLabel: "Desafio do expositor",
      siteUrl: params.data.link,
      profileUrl: params.data.challengeUrl,
      template: params.theme,
    })),
    logoDataUri: params.logoDataUri,
    options: {
      printMode: "color",
      side: "both",
      layout: "single",
      duplexMode: "long-edge",
      marginMm: 18,
      bleedMm: 4,
      laminationMarginMm: 3,
    },
    notePrefix: "UOR Connect · Manual do expositor",
    formatLabel: "CR-80 PVC",
    pageNumberOffset: params.startPage - 1,
  });
}

function buildExhibitorPdfHtml(params: {
  submissionId: number;
  data: ExhibitorPdfData;
  passRenderItems: ExhibitorPdfPassRender[];
  passTheme: ExhibitorPassTheme;
  qrDataUri: string;
  voteQrDataUri: string;
  projectQrDataUri: string;
  challengeQrDataUri: string;
  logoDataUri: string | null;
  generatedAt: Date;
  pdfUrl: string | null;
}) {
  const membersLabel = params.data.membros.length > 0 ? params.data.membros.join(", ") : "Equipa individual";
  const needsLabel = params.data.necessidades.length > 0 ? params.data.necessidades.join(", ") : "Sem necessidades adicionais registadas";
  const generatedAt = formatDateLabel(params.generatedAt);
  const shortProjectUrl = shortUrlLabel(params.data.link);
  const passPageCount = params.data.passes.length * 2;
  const manualPagesBeforePasses = 5;
  const technicalPageNumber = manualPagesBeforePasses + passPageCount + 1;
  const credentialPassPrint = buildManualCredentialPassPrintContent({
    data: params.data,
    passes: params.passRenderItems,
    theme: params.passTheme,
    projectQrDataUri: params.projectQrDataUri,
    challengeQrDataUri: params.challengeQrDataUri,
    logoDataUri: params.logoDataUri,
    startPage: manualPagesBeforePasses + 1,
  });

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(params.data.evento)} - ${escapeHtml(params.data.nome)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    color: #152434;
    font-family: Inter, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 14mm 15mm 12mm;
    position: relative;
    overflow: hidden;
    background:
      linear-gradient(180deg, #fffdfa 0%, #ffffff 44%, #f8fbfa 100%);
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }
  .page::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 5mm;
    background: linear-gradient(90deg, #fd8305 0%, #223d42 72%, #4aa391 100%);
  }
  .page::after {
    content: "";
    position: absolute;
    left: 15mm;
    right: 15mm;
    top: 11mm;
    height: 1px;
    background: rgba(34, 61, 66, 0.08);
  }
  .page-content {
    position: relative;
    z-index: 1;
    height: calc(297mm - 26mm);
    display: flex;
    flex-direction: column;
  }
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10mm;
    padding-top: 6mm;
  }
  .brand-logo {
    width: 43mm;
    max-height: 20mm;
    object-fit: contain;
    display: block;
  }
  .brand-fallback {
    display: flex;
    align-items: center;
    gap: 3.5mm;
  }
  .brand-symbol {
    width: 15mm;
    height: 15mm;
    border-radius: 4mm;
    display: grid;
    place-items: center;
    color: #ffffff;
    background: #223d42;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0;
  }
  .brand-fallback strong,
  .brand-fallback span {
    display: block;
    letter-spacing: 0;
  }
  .brand-fallback strong { font-size: 15px; }
  .brand-fallback span { margin-top: 1mm; font-size: 9px; color: #61707f; }
  .doc-kicker {
    text-align: right;
    color: #61707f;
    font-size: 10px;
    line-height: 1.45;
  }
  .doc-kicker strong {
    display: block;
    color: #152434;
    font-size: 12px;
    font-weight: 750;
  }
  .eyebrow {
    margin: 0 0 3mm;
    color: #fd8305;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: uppercase;
  }
  h1, h2, h3, p { margin: 0; }
  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 78mm;
    gap: 7mm;
    margin-top: 15mm;
    align-items: start;
  }
  .identity h1 {
    font-size: 29px;
    line-height: 1.06;
    font-weight: 830;
    max-width: 96mm;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .project-title {
    margin-top: 6mm;
    padding-left: 4mm;
    border-left: 1.2mm solid #fd8305;
  }
  .project-title span {
    display: block;
    color: #61707f;
    font-size: 10px;
    font-weight: 700;
  }
  .project-title strong {
    display: block;
    margin-top: 1.5mm;
    font-size: 17px;
    line-height: 1.28;
    font-weight: 780;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 3mm;
    margin-top: 8mm;
  }
  .info-row {
    min-height: 17mm;
    border-top: 1px solid #dbe5e3;
    padding-top: 2.6mm;
  }
  .info-row span {
    display: block;
    color: #61707f;
    font-size: 9px;
    font-weight: 700;
  }
  .info-row strong {
    display: block;
    margin-top: 1.3mm;
    font-size: 12px;
    line-height: 1.4;
    font-weight: 730;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .event-strip {
    margin-top: 7mm;
    border: 1px solid #dbe5e3;
    border-radius: 7px;
    padding: 4mm 4.5mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3mm;
    background: #fbfdfc;
  }
  .event-strip div {
    font-size: 10.5px;
    line-height: 1.45;
    color: #344958;
  }
  .event-strip span {
    display: block;
    margin-bottom: 1mm;
    color: #61707f;
    font-size: 8.5px;
    font-weight: 700;
  }
  .qr-detachable {
    position: relative;
    break-inside: avoid;
    border: 1.2px dashed #6f8783;
    border-radius: 9px;
    padding: 8mm 7mm 7mm;
    min-height: 162mm;
    background:
      linear-gradient(180deg, #ffffff 0%, #fbfdfc 100%);
  }
  .qr-detachable::before {
    content: "";
    position: absolute;
    inset: 4mm;
    border: 1px solid #e2ebe9;
    border-radius: 5px;
    pointer-events: none;
  }
  .cut-mark {
    position: absolute;
    width: 9mm;
    height: 9mm;
  }
  .cut-mark::before,
  .cut-mark::after {
    content: "";
    position: absolute;
    background: #5f7773;
  }
  .cut-mark::before { width: 9mm; height: 0.35mm; }
  .cut-mark::after { width: 0.35mm; height: 9mm; }
  .cut-tl { left: -0.5mm; top: -0.5mm; }
  .cut-tr { right: -0.5mm; top: -0.5mm; transform: rotate(90deg); }
  .cut-bl { left: -0.5mm; bottom: -0.5mm; transform: rotate(-90deg); }
  .cut-br { right: -0.5mm; bottom: -0.5mm; transform: rotate(180deg); }
  .scissors-a,
  .scissors-b {
    position: absolute;
    width: 5.5mm;
    height: 5.5mm;
    fill: none;
    stroke: #5f7773;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
    background: #fff;
  }
  .scissors-a { top: -3mm; left: 8mm; }
  .scissors-b { bottom: -3mm; right: 8mm; transform: rotate(180deg); }
  .qr-label {
    text-align: center;
    color: #223d42;
    font-size: 12px;
    font-weight: 780;
  }
  .qr-id {
    margin-top: 1.2mm;
    text-align: center;
    color: #61707f;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
  }
  .qr-box {
    margin: 7mm auto 5mm;
    width: 68mm;
    height: 68mm;
    display: grid;
    place-items: center;
    border: 1px solid #dfe8e6;
    border-radius: 6px;
    background: #ffffff;
  }
  .qr-box img {
    width: 59mm;
    height: 59mm;
    display: block;
  }
  .qr-purpose {
    margin: 0 auto;
    max-width: 60mm;
    text-align: center;
    color: #344958;
    font-size: 11px;
    line-height: 1.55;
  }
  .qr-link {
    margin-top: 5mm;
    padding-top: 4mm;
    border-top: 1px solid #e2ebe9;
    color: #223d42;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 9px;
    text-align: center;
    line-height: 1.45;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .utility-note {
    margin-top: 9mm;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 4mm;
  }
  .note {
    border-top: 1px solid #dbe5e3;
    padding-top: 3mm;
  }
  .note strong {
    display: block;
    color: #152434;
    font-size: 11px;
    font-weight: 760;
  }
  .note span {
    display: block;
    margin-top: 1.5mm;
    color: #61707f;
    font-size: 9.5px;
    line-height: 1.45;
  }
  .page-footer {
    margin-top: auto;
    padding-top: 5mm;
    border-top: 1px solid #dbe5e3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8mm;
    color: #61707f;
    font-size: 9px;
  }
  .page-footer strong { color: #223d42; font-weight: 760; }
  .section-title {
    margin-top: 15mm;
    display: grid;
    grid-template-columns: 1fr 57mm;
    gap: 10mm;
    align-items: end;
  }
  .section-title h1 {
    font-size: 28px;
    line-height: 1.08;
    font-weight: 830;
  }
  .section-title p {
    margin-top: 4mm;
    max-width: 118mm;
    color: #526572;
    font-size: 12.2px;
    line-height: 1.6;
  }
  .section-side {
    border-left: 1px solid #dbe5e3;
    padding-left: 5mm;
    color: #526572;
    font-size: 10.2px;
    line-height: 1.55;
  }
  .guide-grid {
    margin-top: 10mm;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5mm;
  }
  .guide-section {
    min-height: 37mm;
    border: 1px solid #dbe5e3;
    border-radius: 7px;
    padding: 5mm;
    background: rgba(255, 255, 255, 0.78);
    break-inside: avoid;
  }
  .guide-section-critical {
    border-color: rgba(253, 131, 5, 0.34);
    background: #fffaf4;
  }
  .guide-section-challenge {
    border-color: rgba(124, 58, 237, 0.34);
    background: linear-gradient(135deg, #f5f3ff 0%, #ffffff 100%);
  }
  .guide-section h2 {
    color: #223d42;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 800;
  }
  .guide-section-challenge h2 {
    color: #5b21b6;
  }
  .guide-section ul,
  .practice-list,
  .faq-list {
    margin: 3.5mm 0 0;
    padding: 0;
    list-style: none;
  }
  .guide-section li,
  .practice-list li,
  .faq-list li {
    position: relative;
    padding-left: 5mm;
    margin-top: 2.2mm;
    color: #344958;
    font-size: 10.4px;
    line-height: 1.48;
  }
  .guide-section li::before,
  .practice-list li::before,
  .faq-list li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 1.6mm;
    width: 2mm;
    height: 2mm;
    border-radius: 50%;
    background: #fd8305;
  }
  .guide-section-challenge li::before {
    background: #7c3aed;
  }
  .alert-box {
    margin-top: 7mm;
    border: 1px solid rgba(34, 61, 66, 0.16);
    border-radius: 7px;
    padding: 5mm 5.5mm;
    background: #f7fbfa;
    display: grid;
    grid-template-columns: 36mm 1fr;
    gap: 6mm;
    break-inside: avoid;
  }
  .alert-box strong {
    color: #223d42;
    font-size: 12px;
    line-height: 1.35;
  }
  .alert-box p {
    color: #344958;
    font-size: 10.8px;
    line-height: 1.55;
  }
  .technical-grid {
    margin-top: 8mm;
    display: grid;
    grid-template-columns: 1fr 58mm;
    gap: 7mm;
    align-items: start;
  }
  .practice-panel {
    border: 1px solid #dbe5e3;
    border-radius: 7px;
    padding: 4mm;
    background: #ffffff;
    break-inside: avoid;
  }
  .practice-panel + .practice-panel { margin-top: 4mm; }
  .practice-panel h2 {
    color: #223d42;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.25;
  }
  .do-dont-grid {
    margin-top: 4mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3mm;
  }
  .decision-card {
    border: 1px solid #dbe5e3;
    border-radius: 7px;
    padding: 3.8mm;
    background: #ffffff;
    break-inside: avoid;
  }
  .decision-card h2 {
    font-size: 12.5px;
    font-weight: 800;
    line-height: 1.25;
  }
  .decision-card.do h2 { color: #1f6b52; }
  .decision-card.avoid {
    border-color: rgba(253, 131, 5, 0.32);
    background: #fffaf4;
  }
  .decision-card.avoid h2 { color: #a04b00; }
  .final-checklist {
    margin-top: 4mm;
    border: 1px solid #dbe5e3;
    border-radius: 8px;
    padding: 4mm;
    background: #f7fbfa;
    break-inside: avoid;
  }
  .final-checklist h2 {
    color: #223d42;
    font-size: 13px;
    font-weight: 800;
  }
  .check-grid {
    margin-top: 3mm;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2mm;
  }
  .check-item {
    position: relative;
    min-height: 7.5mm;
    padding: 1.8mm 2mm 1.8mm 7mm;
    border: 1px solid #dbe5e3;
    border-radius: 5px;
    background: #ffffff;
    color: #344958;
    font-size: 8.8px;
    line-height: 1.35;
  }
  .check-item::before {
    content: "";
    position: absolute;
    left: 2.2mm;
    top: 2.3mm;
    width: 3mm;
    height: 3mm;
    border: 1px solid #8aa19d;
    border-radius: 2px;
    background: #ffffff;
  }
  .placement-card {
    border: 1px solid #dbe5e3;
    border-radius: 8px;
    padding: 4mm;
    background: #fbfdfc;
    break-inside: avoid;
  }
  .placement-diagram {
    position: relative;
    height: 56mm;
    margin-top: 4mm;
    border: 1px solid #e2ebe9;
    border-radius: 7px;
    background:
      linear-gradient(180deg, #ffffff 0%, #f4f8f7 100%);
  }
  .diagram-panel {
    position: absolute;
    left: 8mm;
    top: 7mm;
    width: 41mm;
    height: 34mm;
    border: 1px solid #9ab0ac;
    border-radius: 3px;
    background: #ffffff;
  }
  .diagram-table {
    position: absolute;
    left: 5mm;
    right: 5mm;
    bottom: 7mm;
    height: 14mm;
    border-radius: 3px;
    background: #dfe8e6;
  }
  .diagram-qr {
    position: absolute;
    right: 9mm;
    bottom: 20mm;
    width: 15mm;
    height: 15mm;
    border: 1px solid #152434;
    background:
      linear-gradient(90deg, #152434 35%, transparent 35% 65%, #152434 65%),
      linear-gradient(#152434 35%, transparent 35% 65%, #152434 65%);
    background-size: 6mm 6mm;
  }
  .placement-card h2 {
    color: #223d42;
    font-size: 13px;
    font-weight: 800;
  }
  .placement-caption {
    margin-top: 3mm;
    color: #526572;
    font-size: 9.8px;
    line-height: 1.5;
  }
  .mini-specs {
    margin-top: 4mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3mm;
  }
  .mini-specs div {
    border-top: 1px solid #dbe5e3;
    padding-top: 2mm;
    color: #344958;
    font-size: 9px;
    line-height: 1.42;
  }
  .mini-specs strong {
    display: block;
    color: #152434;
    font-size: 10.5px;
    margin-bottom: 1mm;
  }
  .component-grid {
    margin-top: 8mm;
    display: grid;
    grid-template-columns: 1.12fr 0.88fr;
    gap: 5mm;
    align-items: stretch;
  }
  .component-stack {
    display: grid;
    gap: 3.5mm;
  }
  .component-card {
    border: 1px solid #dbe5e3;
    border-radius: 8px;
    padding: 4.2mm;
    background: rgba(255, 255, 255, 0.86);
    break-inside: avoid;
  }
  .component-card h2 {
    color: #223d42;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 820;
  }
  .component-card p {
    margin-top: 2mm;
    color: #526572;
    font-size: 9.8px;
    line-height: 1.48;
  }
  .component-card strong {
    color: #152434;
    font-weight: 800;
  }
  .component-card-highlight {
    background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 72%);
    border-color: rgba(5, 150, 105, 0.25);
  }
  .component-card-challenge {
    background: linear-gradient(135deg, #f5f3ff 0%, #ffffff 72%);
    border-color: rgba(124, 58, 237, 0.25);
  }
  .component-qr-panel {
    min-height: 95mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    border: 1px solid rgba(5, 150, 105, 0.24);
    border-radius: 9px;
    padding: 5mm;
    background:
      radial-gradient(circle at top right, rgba(16, 185, 129, 0.16), transparent 34mm),
      #ffffff;
    break-inside: avoid;
  }
  .component-qr-panel h2 {
    color: #065f46;
    font-size: 15px;
    line-height: 1.18;
    font-weight: 860;
  }
  .component-qr-preview {
    margin: 5mm auto 3mm;
    width: 42mm;
    height: 42mm;
    display: grid;
    place-items: center;
    border: 1px solid #d1fae5;
    border-radius: 7px;
    background: #ffffff;
    box-shadow: 0 4mm 12mm rgba(6, 95, 70, 0.08);
  }
  .component-qr-preview img {
    width: 34mm;
    height: 34mm;
    display: block;
  }
  .component-url {
    margin-top: 3mm;
    border-top: 1px solid #dbe5e3;
    padding-top: 2.5mm;
    color: #61707f;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 8px;
    line-height: 1.38;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .component-flow {
    margin-top: 3mm;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2mm;
  }
  .component-step {
    min-height: 16mm;
    border: 1px solid #e2ebe9;
    border-radius: 6px;
    padding: 2.2mm;
    background: #fbfdfc;
    color: #344958;
    font-size: 8.2px;
    line-height: 1.3;
  }
  .component-step span {
    display: block;
    margin-bottom: 1mm;
    color: #fd8305;
    font-weight: 850;
    text-transform: uppercase;
  }
  .map-strip {
    margin-top: 3mm;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 1.5mm;
    align-items: end;
    height: 24mm;
    padding: 3mm;
    border: 1px solid #e2ebe9;
    border-radius: 7px;
    background: #f8fafc;
  }
  .map-strip span {
    display: block;
    border-radius: 4px 4px 1px 1px;
    background: linear-gradient(180deg, #fdba74 0%, #fd8305 100%);
  }
  .map-strip span:nth-child(1) { height: 9mm; opacity: .42; }
  .map-strip span:nth-child(2) { height: 14mm; opacity: .62; }
  .map-strip span:nth-child(3) { height: 19mm; opacity: .98; }
  .map-strip span:nth-child(4) { height: 12mm; opacity: .58; }
  .map-strip span:nth-child(5) { height: 17mm; opacity: .78; }
  .points-pill-grid {
    margin-top: 3mm;
    display: flex;
    flex-wrap: wrap;
    gap: 1.6mm;
  }
  .points-pill-grid span {
    border: 1px solid #dbe5e3;
    border-radius: 999px;
    padding: 1.2mm 2.4mm;
    background: #ffffff;
    color: #344958;
    font-size: 8.2px;
    font-weight: 760;
  }
  .mobile-guide-layout {
    margin-top: 7mm;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5mm;
  }
  .mobile-guide-panel {
    min-height: 158mm;
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 4mm;
    border: 1px solid #dbe5e3;
    border-radius: 10px;
    padding: 4mm;
    background: rgba(255,255,255,.88);
    break-inside: avoid;
  }
  .mobile-guide-panel-green { border-color: rgba(5,150,105,.24); background: linear-gradient(135deg,#ecfdf5 0%,#fff 68%); }
  .mobile-guide-panel-cyan { border-color: rgba(8,145,178,.24); background: linear-gradient(135deg,#ecfeff 0%,#fff 68%); }
  .mobile-guide-panel-violet { border-color: rgba(124,58,237,.24); background: linear-gradient(135deg,#f5f3ff 0%,#fff 68%); }
  .mobile-guide-panel-amber { border-color: rgba(217,119,6,.24); background: linear-gradient(135deg,#fffbeb 0%,#fff 68%); }
  .mobile-guide-copy h2 {
    color: #152434;
    font-size: 13px;
    line-height: 1.24;
    font-weight: 850;
  }
  .mobile-guide-copy p {
    margin-top: 1.6mm;
    color: #526572;
    font-size: 9.5px;
    line-height: 1.45;
  }
  .mobile-step-list {
    margin: 3mm 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 1.5mm;
  }
  .mobile-step-list li {
    display: grid;
    grid-template-columns: 5mm 1fr;
    gap: 2mm;
    align-items: start;
    color: #344958;
    font-size: 8.5px;
    line-height: 1.35;
  }
  .mobile-step-list span {
    width: 5mm;
    height: 5mm;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: #223d42;
    color: #fff;
    font-size: 7px;
    font-weight: 850;
  }
  .mobile-device {
    width: 55mm;
    min-height: 96mm;
    margin: 0 auto;
    border: 1.2mm solid #17232d;
    border-radius: 9mm;
    padding: 2mm;
    background: #17232d;
    box-shadow: 0 6mm 16mm rgba(15,23,42,.14);
  }
  .mobile-device-notch {
    width: 17mm;
    height: 2.6mm;
    margin: 0 auto 1.8mm;
    border-radius: 0 0 4mm 4mm;
    background: #0f172a;
  }
  .mobile-device-screen {
    min-height: 88mm;
    border-radius: 6.2mm;
    padding: 3.5mm;
    background: #f8fafc;
    overflow: hidden;
  }
  .mobile-app-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2mm;
    margin-bottom: 3mm;
  }
  .mobile-app-bar span {
    display: block;
    color: #64748b;
    font-size: 6.7px;
    font-weight: 850;
    text-transform: uppercase;
  }
  .mobile-app-bar strong {
    display: block;
    margin-top: .6mm;
    color: #0f172a;
    font-size: 10px;
    font-weight: 900;
  }
  .mobile-app-bar em {
    border-radius: 999px;
    padding: 1mm 2mm;
    background: #ffffff;
    color: #223d42;
    font-style: normal;
    font-size: 7px;
    font-weight: 850;
  }
  .mobile-card {
    border: 1px solid #e2e8f0;
    border-radius: 5mm;
    padding: 3mm;
    background: #ffffff;
  }
  .mobile-card-green { border-color: #a7f3d0; background: #ecfdf5; }
  .mobile-card-cyan { border-color: #a5f3fc; background: #ecfeff; }
  .mobile-card-violet { border-color: #ddd6fe; background: #f5f3ff; }
  .mobile-card-amber { border-color: #fde68a; background: #fffbeb; }
  .mobile-card-title-row {
    display: grid;
    grid-template-columns: 9mm 1fr;
    gap: 2.2mm;
    align-items: start;
  }
  .mobile-icon-box {
    width: 8.5mm;
    height: 8.5mm;
    display: grid;
    place-items: center;
    border-radius: 2.6mm;
    background: #ffffff;
    color: #223d42;
    font-size: 7px;
    font-weight: 900;
  }
  .mobile-card h3 {
    color: #0f172a;
    font-size: 9.5px;
    line-height: 1.22;
    font-weight: 900;
  }
  .mobile-card p,
  .mobile-footer-note {
    color: #526572;
    font-size: 7.6px;
    line-height: 1.35;
  }
  .mobile-card label {
    display: block;
    margin-top: 2.4mm;
    color: #475569;
    font-size: 6.7px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .mobile-card button {
    width: 100%;
    margin-top: 2.6mm;
    border: 0;
    border-radius: 3mm;
    padding: 2mm;
    background: #223d42;
    color: #ffffff;
    font-size: 7.5px;
    font-weight: 900;
  }
  .mobile-card small {
    display: block;
    margin-top: 1.8mm;
    color: #64748b;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 6px;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .mobile-qr-box {
    width: 32mm;
    height: 32mm;
    margin: 3mm auto 1mm;
    display: grid;
    place-items: center;
    border: 1px solid #d1fae5;
    border-radius: 4mm;
    background: #fff;
  }
  .mobile-qr-box img { width: 25mm; height: 25mm; }
  .mobile-textarea {
    min-height: 19mm;
    margin-top: 1.4mm;
    border: 1px solid #e2e8f0;
    border-radius: 3mm;
    padding: 2mm;
    background: #ffffff;
    color: #334155;
    font-size: 7.2px;
    line-height: 1.35;
    overflow: hidden;
  }
  .mobile-textarea.short { min-height: 12mm; }
  .mobile-link-stack,
  .mobile-member-list,
  .mobile-mission-list,
  .mobile-ranking-list {
    margin-top: 1.5mm;
    display: grid;
    gap: 1.4mm;
  }
  .mobile-link-row,
  .mobile-input-row,
  .mobile-member-row,
  .mobile-mission-list div,
  .mobile-ranking-list div {
    border: 1px solid #e2e8f0;
    border-radius: 3mm;
    padding: 1.8mm;
    background: rgba(255,255,255,.9);
  }
  .mobile-link-row span,
  .mobile-member-row span,
  .mobile-mission-list span,
  .mobile-score-row span {
    display: block;
    color: #64748b;
    font-size: 6.4px;
    font-weight: 850;
  }
  .mobile-link-row strong,
  .mobile-member-row strong,
  .mobile-mission-list strong {
    display: block;
    margin-top: .5mm;
    color: #0f172a;
    font-size: 7.2px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }
  .mobile-empty-state,
  .mobile-dashed-box {
    border: 1px dashed #cbd5e1;
    border-radius: 3mm;
    padding: 2mm;
    background: rgba(255,255,255,.72);
    color: #64748b;
    font-size: 7px;
    line-height: 1.35;
  }
  .mobile-input-row {
    display: grid;
    grid-template-columns: 1fr 18mm;
    gap: 1.5mm;
    align-items: center;
    color: #94a3b8;
    font-size: 7px;
  }
  .mobile-input-row button,
  .mobile-member-row button {
    width: auto;
    margin: 1.5mm 0 0;
    padding: 1.2mm 2mm;
    background: #fff1f2;
    color: #be123c;
    font-size: 6.4px;
  }
  .mobile-member-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1.5mm;
  }
  .mobile-member-row em,
  .mobile-status-row span,
  .mobile-mission-list span,
  .mobile-ranking-list em {
    border-radius: 999px;
    padding: .8mm 1.5mm;
    background: #ecfdf5;
    color: #047857;
    font-style: normal;
    font-size: 6.3px;
    font-weight: 900;
    white-space: nowrap;
  }
  .mobile-dashed-box { margin-top: 2mm; }
  .mobile-dashed-box strong,
  .mobile-dashed-box span {
    display: block;
  }
  .mobile-status-row {
    margin-top: 2.5mm;
    display: flex;
    flex-wrap: wrap;
    gap: 1.2mm;
  }
  .mobile-option-list {
    margin-top: 1.4mm;
    display: flex;
    flex-wrap: wrap;
    gap: 1.2mm;
  }
  .mobile-option-list span {
    border-radius: 999px;
    padding: 1mm 1.8mm;
    background: #ffffff;
    color: #4c1d95;
    font-size: 6.6px;
    font-weight: 850;
  }
  .mobile-score-row {
    margin-top: 3mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.4mm;
  }
  .mobile-score-row div {
    border: 1px solid #fde68a;
    border-radius: 3mm;
    padding: 1.8mm;
    background: #ffffff;
  }
  .mobile-score-row strong {
    display: block;
    margin-top: .7mm;
    color: #92400e;
    font-size: 9px;
    font-weight: 950;
  }
  .mobile-round-flow {
    margin-top: 3mm;
    height: 18mm;
    display: grid;
    grid-template-columns: repeat(5,1fr);
    gap: 1mm;
    align-items: end;
    border-bottom: 1px solid #94a3b8;
  }
  .mobile-round-flow span {
    display: block;
    height: 10mm;
    border-radius: 2.5mm 2.5mm 0 0;
    background: #d1d5db;
  }
  .mobile-round-flow span:nth-child(2) { height: 15mm; }
  .mobile-round-flow span:nth-child(3) { height: 12mm; }
  .mobile-round-flow span:nth-child(4) { height: 17mm; }
  .mobile-round-flow span:nth-child(5) { height: 14mm; }
  .mobile-round-flow .current {
    background: linear-gradient(180deg,#fde68a 0%,#f59e0b 100%);
  }
  .mobile-ranking-list div {
    display: grid;
    grid-template-columns: 6mm 1fr auto;
    gap: 1.5mm;
    align-items: center;
  }
  .mobile-ranking-list span {
    width: 5mm;
    height: 5mm;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: #223d42;
    color: #fff;
    font-size: 6.5px;
    font-weight: 900;
  }
  .mobile-ranking-list strong {
    color: #0f172a;
    font-size: 7.2px;
    line-height: 1.2;
  }
  .mobile-footer-note {
    margin-top: 2.5mm;
    border-top: 1px solid #e2e8f0;
    padding-top: 2mm;
  }
  .small-link {
    color: #61707f;
    font-size: 8.5px;
    line-height: 1.4;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .credential-pass-sheet {
    position: relative;
    width: 210mm;
    height: 297mm;
    padding: 18mm;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: #f8fafc;
    page-break-after: always;
    break-after: page;
  }
  .credential-pass-print-note {
    position: absolute;
    left: 18mm;
    right: 18mm;
    top: 18mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8mm;
    color: #475569;
    font-size: 8px;
    font-weight: 750;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .credential-pass-cut {
    position: absolute;
    width: 10mm;
    height: 10mm;
    border-color: #94a3b8;
  }
  .credential-pass-cut-tl { top: 75.5mm; left: 57mm; border-top: .3mm solid; border-left: .3mm solid; }
  .credential-pass-cut-tr { top: 75.5mm; right: 57mm; border-top: .3mm solid; border-right: .3mm solid; }
  .credential-pass-cut-bl { bottom: 75.5mm; left: 57mm; border-bottom: .3mm solid; border-left: .3mm solid; }
  .credential-pass-cut-br { bottom: 75.5mm; right: 57mm; border-bottom: .3mm solid; border-right: .3mm solid; }
  .credential-pass-mold-line {
    position: absolute;
    left: 55mm;
    top: 73.5mm;
    width: 100mm;
    height: 150mm;
    border: .18mm solid rgba(249, 115, 22, .22);
    border-radius: 6mm;
    background:
      linear-gradient(90deg, rgba(249, 115, 22, .12) 0 1px, transparent 1px) 0 0 / 10mm 10mm,
      linear-gradient(0deg, rgba(249, 115, 22, .10) 0 1px, transparent 1px) 0 0 / 10mm 10mm;
    pointer-events: none;
  }
  .credential-pass-cut-line {
    position: absolute;
    left: 60mm;
    top: 78.5mm;
    width: 90mm;
    height: 140mm;
    border: .32mm solid rgba(15, 23, 42, .44);
    border-radius: 4.5mm;
    box-shadow: 0 0 0 1.7mm rgba(15, 23, 42, .035);
    pointer-events: none;
  }
  .credential-pass-cut-line::before,
  .credential-pass-cut-line::after {
    content: "";
    position: absolute;
    left: 50%;
    top: -2.6mm;
    width: .3mm;
    height: 2mm;
    background: rgba(15, 23, 42, .38);
    transform: translateX(-50%);
  }
  .credential-pass-cut-line::after {
    top: auto;
    bottom: -2.6mm;
  }
  .credential-pass-safe-line {
    position: absolute;
    left: 64mm;
    top: 82.5mm;
    width: 82mm;
    height: 132mm;
    border: .25mm dashed var(--pass-safe-border);
    border-radius: 3.5mm;
    pointer-events: none;
  }
  .credential-pass-card {
    position: relative;
    width: 90mm;
    height: 140mm;
    overflow: hidden;
    border: .3mm solid #e2e8f0;
    border-radius: 4.5mm;
    background: #ffffff;
    color: #17232d;
    box-shadow: 0 4mm 14mm rgba(15, 23, 42, .1);
  }
  .credential-pass-top {
    position: relative;
    padding: 4mm 5mm 12mm;
    color: #ffffff;
    background: linear-gradient(135deg, var(--pass-primary) 0%, var(--pass-accent) 100%);
  }
  .credential-pass-top-accent {
    position: absolute;
    top: 0;
    right: 0;
    width: 30mm;
    height: 30mm;
    border-radius: 0 0 0 30mm;
    background: rgba(255, 255, 255, .06);
  }
  .credential-pass-brand {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 3mm;
  }
  .credential-pass-logo {
    max-width: 28mm;
    max-height: 8.5mm;
    object-fit: contain;
    filter: brightness(0) invert(1);
  }
  .credential-pass-logo-fallback {
    color: #ffffff;
    font-size: 11px;
    font-weight: 850;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .credential-pass-category {
    display: flex;
    align-items: center;
    gap: 2mm;
  }
  .credential-pass-icon {
    width: 7mm;
    height: 7mm;
    display: grid;
    place-items: center;
    border-radius: 2mm;
    background: rgba(255, 255, 255, .15);
    border: .2mm solid rgba(255, 255, 255, .18);
  }
  .credential-pass-icon svg,
  .credential-pass-ribbon svg,
  .credential-pass-watermark svg {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .credential-pass-icon svg {
    width: 3.7mm;
    height: 3.7mm;
    stroke: #ffffff;
    stroke-width: 1.8;
  }
  .credential-pass-category strong {
    border-radius: 999px;
    background: rgba(255, 255, 255, .14);
    border: .2mm solid rgba(255, 255, 255, .2);
    padding: 1.2mm 2.8mm;
    font-size: 8px;
    font-weight: 850;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .credential-pass-ribbon {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5mm;
    padding: 1.5mm 0;
    background: var(--pass-light);
    border-top: .2mm solid var(--pass-accent-line);
    border-bottom: .2mm solid var(--pass-accent-line);
    color: var(--pass-primary);
    font-size: 7.3px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .credential-pass-ribbon svg {
    width: 3mm;
    height: 3mm;
    stroke: var(--pass-accent);
    stroke-width: 2;
  }
  .credential-pass-watermark {
    position: absolute;
    left: 4mm;
    bottom: 8mm;
    width: 20mm;
    height: 20mm;
    opacity: .04;
  }
  .credential-pass-watermark svg {
    width: 100%;
    height: 100%;
    stroke: var(--pass-primary);
    stroke-width: 1.2;
  }
  .credential-pass-body {
    position: relative;
    padding: 4mm 5mm 10mm;
  }
  .credential-pass-body h1 {
    margin: 0;
    color: #0f172a;
    text-align: center;
    font-size: 16px;
    line-height: 1.15;
    font-weight: 850;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .credential-pass-subtitle {
    margin: 2mm auto 0;
    max-width: 66mm;
    color: #475569;
    text-align: center;
    font-size: 9.5px;
    line-height: 1.3;
  }
  .credential-pass-project {
    margin: 1.8mm 0 2.4mm;
    padding: 2mm 3mm;
    border: .3mm solid var(--pass-accent-soft);
    border-radius: 2.5mm;
    background: var(--pass-light);
  }
  .credential-pass-project span {
    display: block;
    color: var(--pass-accent);
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .credential-pass-project strong {
    display: block;
    margin-top: 1mm;
    color: var(--pass-primary);
    font-size: 9.5px;
    line-height: 1.2;
    font-weight: 760;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .credential-pass-project small {
    display: block;
    margin-top: .5mm;
    color: #475569;
    font-size: 7.3px;
    line-height: 1.35;
  }
  .credential-pass-code {
    margin: 2mm auto 0;
    display: flex;
    justify-content: center;
  }
  .credential-pass-code span {
    display: inline-block;
    border-radius: 999px;
    padding: 1.2mm 3.4mm;
    background: var(--pass-primary);
    color: #ffffff;
    font-size: 8px;
    font-weight: 850;
    letter-spacing: 0.08em;
  }
  .credential-pass-info-grid {
    margin: 2.6mm 0 2.4mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.6mm;
  }
  .credential-pass-info-grid div {
    min-height: 11.5mm;
    border: .2mm solid #e2e8f0;
    border-radius: 2.2mm;
    padding: 1.9mm 2.2mm;
    background: #f8fafc;
  }
  .credential-pass-info-grid span,
  .credential-pass-back-identity span,
  .credential-pass-back-qr span,
  .credential-pass-snapshot-grid span {
    display: block;
    color: #475569;
    font-size: 7.2px;
    font-weight: 850;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .credential-pass-info-grid strong {
    display: block;
    margin-top: .8mm;
    color: #1e293b;
    font-size: 9.2px;
    line-height: 1.2;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .credential-pass-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5mm;
    margin-bottom: 2.4mm;
  }
  .credential-pass-chip-row span {
    display: inline-flex;
    align-items: center;
    border: .2mm solid #e2e8f0;
    border-radius: 999px;
    padding: 1mm 2.5mm;
    background: #f8fafc;
    color: #475569;
    font-size: 7.6px;
    font-weight: 700;
  }
  .credential-pass-qr-section {
    display: grid;
    grid-template-columns: 22mm 1fr;
    gap: 3mm;
    align-items: center;
    border-top: .25mm solid #e2e8f0;
    padding-top: 2.8mm;
    margin-bottom: 6mm;
  }
  .credential-pass-qr {
    width: 22mm;
    height: 22mm;
    display: grid;
    place-items: center;
    border: .25mm solid #e2e8f0;
    border-radius: 2.5mm;
    background: #ffffff;
  }
  .credential-pass-qr img { width: 18.5mm; height: 18.5mm; }
  .credential-pass-qr-section span {
    display: block;
    color: var(--pass-accent);
    font-size: 8px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .credential-pass-qr-section p {
    margin-top: 1mm;
    color: #475569;
    font-size: 7.6px;
    line-height: 1.35;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .credential-pass-footer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 6mm;
    padding: 0 5mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4mm;
    color: #ffffff;
    background: var(--pass-primary);
    font-size: 7.2px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .credential-pass-card-back {
    background:
      radial-gradient(circle at top left, var(--pass-light) 0, transparent 36mm),
      #ffffff;
  }
  .credential-pass-back-top {
    padding-bottom: 8mm;
  }
  .credential-pass-back-body {
    padding: 5mm 5mm 10mm;
  }
  .credential-pass-back-identity strong {
    display: block;
    margin-top: 1.4mm;
    color: #0f172a;
    font-size: 15px;
    line-height: 1.16;
    font-weight: 850;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .credential-pass-back-identity p {
    margin-top: 1.4mm;
    color: #475569;
    font-size: 8.8px;
    line-height: 1.35;
  }
  .credential-pass-back-qr {
    margin-top: 3.5mm;
    display: grid;
    grid-template-columns: 28mm 1fr;
    gap: 3mm;
    align-items: center;
    padding: 3mm;
    border: .3mm solid var(--pass-accent-soft);
    border-radius: 3mm;
    background: var(--pass-light);
  }
  .credential-pass-back-qr img {
    width: 25mm;
    height: 25mm;
    border: .25mm solid #ffffff;
    border-radius: 2mm;
    background: #ffffff;
  }
  .credential-pass-back-qr p {
    margin-top: 1mm;
    color: #475569;
    font-size: 7.5px;
    line-height: 1.35;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .credential-pass-usage {
    margin-top: 3.5mm;
    border: .25mm solid #e2e8f0;
    border-radius: 3mm;
    padding: 3mm;
    background: #ffffff;
  }
  .credential-pass-usage h2 {
    margin: 0;
    color: var(--pass-primary);
    font-size: 10px;
    font-weight: 850;
  }
  .credential-pass-usage ul {
    margin: 2mm 0 0;
    padding-left: 4mm;
  }
  .credential-pass-usage li {
    margin-top: 1.1mm;
    color: #334155;
    font-size: 7.8px;
    line-height: 1.36;
  }
  .credential-pass-snapshot-grid {
    margin-top: 3.5mm;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.6mm;
  }
  .credential-pass-snapshot-grid div {
    border-top: .25mm solid #e2e8f0;
    padding-top: 1.5mm;
  }
  .credential-pass-snapshot-grid strong {
    display: block;
    margin-top: .8mm;
    color: #0f172a;
    font-size: 8.5px;
    line-height: 1.25;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  ${credentialPassPrint.css}
</style>
</head>
<body>
  <section class="page">
    <div class="page-content">
      <header class="header">
        ${logoMarkup(params.logoDataUri)}
        <div class="doc-kicker">
          <strong>${escapeHtml(params.data.evento)}</strong>
          Documento oficial do expositor<br />
          Gerado em ${escapeHtml(generatedAt)}
        </div>
      </header>

      <main class="hero-grid">
        <section class="identity">
          <p class="eyebrow">${escapeHtml(params.data.coverEyebrow)}</p>
          <h1>${escapeHtml(params.data.nome)}</h1>

          <div class="project-title">
            <span>${escapeHtml(params.data.approvedLabel)}</span>
            <strong>${escapeHtml(params.data.titulo)}</strong>
          </div>

          <div class="info-grid">
            ${infoRow("Curso", params.data.curso)}
            ${infoRow("Número de estudante", params.data.numero)}
            ${infoRow("Identificador", params.data.id)}
            ${infoRow("Tipo / Área", `${params.data.tipo} / ${params.data.area}`)}
            ${infoRow("Equipa", membersLabel)}
            ${infoRow("Requisitos", needsLabel)}
          </div>

          <div class="event-strip">
            <div><span>Data do evento</span>${escapeHtml(params.data.dataEvento)}</div>
            <div><span>Local</span>${escapeHtml(params.data.localEvento)}</div>
          </div>
        </section>

        <aside class="qr-detachable" aria-label="Cartão destacável com QR Code">
          <span class="cut-mark cut-tl"></span>
          <span class="cut-mark cut-tr"></span>
          <span class="cut-mark cut-bl"></span>
          <span class="cut-mark cut-br"></span>
          ${scissorsSvg("scissors-a")}
          ${scissorsSvg("scissors-b")}

          <div class="qr-label">${escapeHtml(params.data.qrLabel)}</div>
          <div class="qr-id">${escapeHtml(params.data.referencia)}</div>
          <div class="qr-box">
            <img src="${params.qrDataUri}" alt="${escapeHtml(params.data.qrLabel)} ${escapeHtml(params.data.titulo)}" />
          </div>
          <p class="qr-purpose">
            ${escapeHtml(params.data.qrPurpose)}
          </p>
          <p class="qr-link">${escapeHtml(shortProjectUrl)}</p>
        </aside>
      </main>

      <div class="utility-note">
        <div class="note">
          <strong>Preparado para impressão</strong>
          <span>Recorta pela linha tracejada mantendo a margem de segurança em torno do código.</span>
        </div>
        <div class="note">
          <strong>Uso no evento</strong>
          <span>Coloca o cartão na mesa, painel ou suporte visível durante toda a exposição.</span>
        </div>
        <div class="note">
          <strong>Validação digital</strong>
          <span>Testa a leitura antes do evento e evita dobras, reflexos ou plastificação sobre o código.</span>
        </div>
      </div>

      <footer class="page-footer">
        <span><strong>UOR Connect</strong> - extensão oficial da experiência académica e de eventos</span>
        <span>${escapeHtml(params.data.referencia)}</span>
      </footer>
    </div>
  </section>

  <section class="page">
    <div class="page-content">
      <header class="header">
        ${logoMarkup(params.logoDataUri)}
        <div class="doc-kicker">
          <strong>Guia do Expositor</strong>
          ${escapeHtml(params.data.evento)}<br />
          ${escapeHtml(params.data.localEvento)}
        </div>
      </header>

      <div class="section-title">
        <div>
          <p class="eyebrow">Manual curto de participação</p>
          <h1>Guia do Expositor</h1>
          <p>
            Usa esta página como referência rápida para chegada, montagem, apresentação e conduta durante a exposição.
          </p>
        </div>
        <div class="section-side">
          Expositor: <strong>${escapeHtml(params.data.nome)}</strong><br />
          ${escapeHtml(params.data.subjectTitleLabel)}: <strong>${escapeHtml(params.data.titulo)}</strong><br />
          ID: <strong>${escapeHtml(params.data.referencia)}</strong>
        </div>
      </div>

      <div class="guide-grid">
        ${guideSection("Obrigatório antes do evento", [
          "Chegar com antecedência para validar presença.",
          "Confirmar mesa, painel e requisitos técnicos.",
          "Criar e submeter a pergunta do desafio para aprovação da organização.",
          "Levar identificação académica ou número de estudante."
        ], "critical")}
        ${params.data.competitionEligible
          ? guideSection("Itens essenciais", [
            "Carregadores, cabos e adaptadores.",
            "Protótipo, demonstração ou materiais de apoio.",
            "Cartão QR impresso e testado."
          ])
          : guideSection("Participação expositiva sem votação pública", [
            "A participação não concorre à votação pública de projetos.",
            "O QR e a pergunta servem para interação, aprendizagem e Passaporte Digital.",
            "Os pontos pertencem ao Passaporte Digital do estudante."
          ], "critical")}
        ${guideSection("Durante a exposição", [
          "Manter o QR Code sempre visível.",
          `Receber ${params.data.technicalUsageAudience} com clareza.`,
          "Conservar a mesa limpa e organizada."
        ])}
        ${guideSection("Boas práticas", [
          "Explicar problema, solução e impacto.",
          "Usar linguagem simples e exemplos concretos.",
          `Preparar uma pergunta ligada ao conteúdo real do ${params.data.subjectLabel}.`,
          "Demonstrar o que já funciona."
        ])}
        ${guideSection("Pergunta do desafio", [
          "Criar a pergunta na área do projeto antes do evento e submeter para aprovação.",
          "Preparar uma pergunta ligada ao conteúdo real do projeto, produto ou negócio.",
          "O QR do expositor abre a etapa do desafio; o estudante responde e recebe pontos quando acertar.",
          "Este passo transforma a visita em aprendizagem ativa e mantém a pontuação do Passaporte Digital auditável."
        ], "challenge")}
        ${guideSection("Cuidados", [
          "Não esconder o QR com objetos.",
          "Não deixar a bancada abandonada em períodos críticos.",
          "Comunicar falhas técnicas à organização."
        ], "critical")}
        ${guideSection("Postura do expositor", [
          "Ser cordial, objetivo e profissional.",
          "Representar a equipa e o curso com rigor.",
          "Encerrar cada conversa com convite ao scan."
        ])}
      </div>

      <div class="alert-box">
        <strong>${escapeHtml(params.data.alertTitle)}</strong>
        <p>
          ${escapeHtml(params.data.alertText)}
        </p>
      </div>

      <footer class="page-footer">
        <span><strong>Boa prática:</strong> foco na demonstração, linguagem simples e dados verificáveis.</span>
        <span>Página 2</span>
      </footer>
    </div>
  </section>

  <section class="page">
    <div class="page-content">
      <header class="header">
        ${logoMarkup(params.logoDataUri)}
        <div class="doc-kicker">
          <strong>Componentes do sistema mobile</strong>
          Início, QR e detalhes públicos<br />
          ${escapeHtml(params.data.referencia)}
        </div>
      </header>

      <div class="section-title">
        <div>
          <p class="eyebrow">Como usar a plataforma</p>
          <h1>Guia vivo no telemóvel</h1>
          <p>
            Os exemplos abaixo seguem a versão mobile da Minha Área. O objetivo é o expositor reconhecer o mesmo
            componente no telemóvel, entender o estado e saber exatamente que ação deve executar.
          </p>
        </div>
        <div class="section-side">
          Começa pela <strong>Minha Área do expositor</strong>, no separador <strong>Início</strong>: abre o QR de conversão,
          confirma se o mapa de pontos está ativo e só depois ajusta os dados públicos do projeto.
        </div>
      </div>

      <div class="mobile-guide-layout">
        ${mobileGuidePanel({
          title: params.data.competitionEligible ? "QR de conversão do projeto" : "QR de interação do expositor",
          intro: params.data.competitionEligible
            ? "Este é o botão que abre o QR usado no stand para converter visitas em voto válido."
            : "Este é o QR de interação usado para orientar visitas sem abrir votação pública de projeto.",
          snapshot: buildMobileQrSnapshot({ data: params.data, voteQrDataUri: params.voteQrDataUri }),
          steps: [
            "Entrar em Minha Área no telemóvel.",
            "Abrir a aba Início e tocar em Gerar QR de votação.",
            "Mostrar o QR ao estudante no fim da explicação.",
            "Confirmar que o estudante viu o aviso antes de votar.",
          ],
          tone: "green",
        })}
        ${mobileGuidePanel({
          title: "Detalhes públicos do projeto",
          intro: "O responsável consegue atualizar a descrição, site, repositório e redes que aparecem na página pública.",
          snapshot: buildMobileDetailsSnapshot(params.data),
          steps: [
            "Abrir a aba Projeto em Minha Área.",
            "Editar a descrição em linguagem clara para visitantes e jurados.",
            "Adicionar links reais do projeto e redes sociais oficiais.",
            "Tocar em Guardar detalhes públicos; a submissão continua aprovada.",
          ],
          tone: "cyan",
        })}
      </div>

      <footer class="page-footer">
        <span><strong>Regra prática:</strong> o QR converte a visita; os detalhes públicos explicam o projeto antes e depois do voto.</span>
        <span>Página 3</span>
      </footer>
    </div>
  </section>

  <section class="page">
    <div class="page-content">
      <header class="header">
        ${logoMarkup(params.logoDataUri)}
        <div class="doc-kicker">
          <strong>Equipa e desafio mobile</strong>
          Gestão de membros e pergunta oficial<br />
          ${escapeHtml(params.data.referencia)}
        </div>
      </header>

      <div class="section-title">
        <div>
          <p class="eyebrow">Operação do expositor</p>
          <h1>Equipa e desafio no telemóvel</h1>
          <p>
            Esta parte ensina o responsável a preparar a equipa e a pergunta obrigatória sem depender de computador.
            Tudo deve estar pronto antes do início da atividade.
          </p>
        </div>
        <div class="section-side">
          A gestão da equipa protege a presença dos membros. O desafio aprovado transforma a visita ao stand em
          aprendizagem ativa dentro do Passaporte Digital.
        </div>
      </div>

      <div class="mobile-guide-layout">
        ${mobileGuidePanel({
          title: "Confirmação da equipa",
          intro: "Usa este componente para adicionar membros, confirmar externos e usar Remover membros do grupo quando houver nomes errados antes do evento.",
          snapshot: buildMobileTeamSnapshot(params.data),
          steps: [
            "Adicionar o nome completo do membro.",
            "Preencher número de estudante ou marcar como externo.",
            "Partilhar o link de convite com os membros pendentes.",
            "Usar Remover membro apenas para corrigir erro, desistência ou troca.",
          ],
        })}
        ${mobileGuidePanel({
          title: "Desafio do Expositor",
          intro: "O desafio precisa representar o conteúdo real do projeto e só dá pontos depois de aprovado pela organização.",
          snapshot: buildMobileChallengeSnapshot(),
          steps: [
            "Escrever uma pergunta objetiva ligada à demonstração.",
            "Adicionar opções claras e marcar a resposta certa.",
            "Definir tentativas e explicação curta.",
            "Enviar para aprovação e corrigir se a admin devolver nota.",
          ],
          tone: "violet",
        })}
      </div>

      <footer class="page-footer">
        <span><strong>Regra prática:</strong> equipa confirmada e desafio aprovado evitam bloqueios no dia da feira.</span>
        <span>Página 4</span>
      </footer>
    </div>
  </section>

  <section class="page">
    <div class="page-content">
      <header class="header">
        ${logoMarkup(params.logoDataUri)}
        <div class="doc-kicker">
          <strong>Pontuação mobile</strong>
          Mapa, rondas, ranking e regras<br />
          ${escapeHtml(params.data.referencia)}
        </div>
      </header>

      <div class="section-title">
        <div>
          <p class="eyebrow">Jogo do expositor</p>
          <h1>Pontos, bónus e ranking interno</h1>
          <p>
            O expositor acompanha o progresso no Início da Minha Área. O sistema mostra pontos, rondas por horário,
            ações contínuas, bónus e ranking interno dos embaixadores.
          </p>
        </div>
        <div class="section-side">
          Os pontos devem nascer de interações reais: voto válido, curso novo, estudante de outra universidade,
          feedback qualificado e presença ativa no stand.
        </div>
      </div>

      <div class="mobile-guide-layout">
        ${mobileGuidePanel({
          title: "Mapa do expositor e rondas",
          intro: "Mostra onde a equipa está no jogo, que ronda está ativa e que ações ainda rendem pontos.",
          snapshot: buildMobileScoringSnapshot(),
          steps: [
            "Consultar o Início antes de cada ronda.",
            "Priorizar ações com multiplicador ativo.",
            "Evitar infrações que geram perda de pontos.",
            "Aguardar o modal de ganho/perda para confirmar mudança de pontuação.",
          ],
          tone: "amber",
        })}
        ${mobileGuidePanel({
          title: "Ranking interno dos embaixadores",
          intro: "Ajuda o responsável a ver quem mais se empenhou em conversões, feedback e apoio ao projeto.",
          snapshot: buildMobileRankingSnapshot(params.data),
          steps: [
            "Abrir o Início e acompanhar o ranking do projeto.",
            "Distribuir tarefas entre membros fora do stand.",
            "Comparar esforço sem confundir com ranking geral da feira.",
            "Usar os dados para melhorar a abordagem da equipa.",
          ],
        })}
      </div>

      <div class="points-pill-grid">
        <span>+1 voto UOR válido</span>
        <span>+3 voto de outra universidade</span>
        <span>Bónus por curso novo</span>
        <span>Feedback qualificado</span>
        <span>Streaks e rondas com multiplicador</span>
        <span>Penalizações por infração</span>
      </div>

      <footer class="page-footer">
        <span><strong>Regra prática:</strong> o ranking interno mede empenho; o resultado final depende de pontos auditáveis.</span>
        <span>Página 5</span>
      </footer>
    </div>
  </section>

  ${credentialPassPrint.sheets}

  <section class="page">
    <div class="page-content">
      <header class="header">
        ${logoMarkup(params.logoDataUri)}
        <div class="doc-kicker">
          <strong>Uso técnico do QR Code</strong>
          Impressão, recorte e posicionamento<br />
          ${escapeHtml(params.data.referencia)}
        </div>
      </header>

      <div class="section-title">
        <div>
          <p class="eyebrow">Instrução técnica</p>
          <h1>QR Code e visibilidade digital</h1>
          <p>
            ${escapeHtml(params.data.technicalIntro)}
          </p>
        </div>
        <div class="section-side small-link">
          ${escapeHtml(params.data.publicPageLabel)}:<br />
          <strong>${escapeHtml(shortProjectUrl)}</strong><br /><br />
          O link seguro do PDF é gerido pela plataforma e não precisa ser impresso no material de bancada.
        </div>
      </div>

      <div class="technical-grid">
        <div>
          <section class="practice-panel">
            <h2>Boas práticas de impressão</h2>
            <ul class="practice-list">
              <li>Imprime em boa qualidade, preferencialmente em papel firme ou cartolina leve.</li>
              <li>Usa escala 100% e evita modos de economia que reduzem contraste.</li>
              <li>Recorta respeitando a margem indicada e sem invadir a área do código.</li>
              <li>Testa a leitura com um telemóvel antes de levar o material para o evento.</li>
            </ul>
          </section>

          <section class="practice-panel">
            <h2>Uso durante a exposição</h2>
            <ul class="practice-list">
              <li>Mantém o QR Code visível na mesa ou painel, sem objetos a cobri-lo.</li>
              <li>Evita dobras, reflexos fortes, sombras e plastificação opaca sobre o código.</li>
              <li>Posiciona o cartão a uma altura confortável para leitura por ${escapeHtml(params.data.technicalUsageAudience)}.</li>
              <li>Usa a página pública em conjunto com a apresentação para mostrar contexto, equipa e ligações.</li>
            </ul>
          </section>

          <div class="do-dont-grid">
            <section class="decision-card do">
              <h2>Fazer</h2>
              <ul class="practice-list">
                <li>Deixar área livre em volta do QR.</li>
                <li>Testar a leitura a 30-80 cm.</li>
                <li>Fixar em suporte firme e visível.</li>
              </ul>
            </section>
            <section class="decision-card avoid">
              <h2>Evitar</h2>
              <ul class="practice-list">
                <li>Dobras, reflexos e sombras fortes.</li>
                <li>Objetos sobre o código.</li>
                <li>Corte muito próximo da matriz do QR.</li>
              </ul>
            </section>
          </div>

          <section class="final-checklist">
            <h2>Checklist final</h2>
            <div class="check-grid">
              <div class="check-item">QR testado</div>
              <div class="check-item">Impressão validada</div>
              <div class="check-item">Mesa organizada</div>
              <div class="check-item">Materiais preparados</div>
              <div class="check-item">Apresentação pronta</div>
              <div class="check-item">Organização avisada sobre requisitos</div>
            </div>
          </section>
        </div>

        <aside class="placement-card">
          <h2>Posicionamento recomendado</h2>
          <div class="placement-diagram">
            <div class="diagram-panel"></div>
            <div class="diagram-table"></div>
            <div class="diagram-qr"></div>
          </div>
          <p class="placement-caption">
            Coloca o QR Code no lado frontal da mesa ou num suporte lateral do painel, com área livre em volta e ângulo
            favorável para leitura.
          </p>

          <div class="mini-specs">
            <div><strong>Margem</strong> Mantém espaço branco em torno do código.</div>
            <div><strong>Contraste</strong> Fundo claro e código escuro, sem textura por baixo.</div>
            <div><strong>Fixação</strong> Usa fita, suporte acrílico ou base rígida.</div>
            <div><strong>Teste</strong> Faz leitura a 30-80 cm antes da exposição.</div>
          </div>
        </aside>
      </div>

      <footer class="page-footer">
        <span><strong>UOR Connect</strong> - ${escapeHtml(params.data.technicalFooter)}.</span>
        <span>Página ${technicalPageNumber}</span>
      </footer>
    </div>
  </section>
</body>
</html>`;
}

async function writeMetadata(env: Env, metadata: ExhibitorPdfMetadata) {
  const dir = getSubmissionStorageDir(env, metadata.submissionId);
  await mkdir(dir, { recursive: true });
  await writeFile(getLatestMetadataPath(env, metadata.submissionId), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

export async function generateExhibitorPdfForSubmission(env: Env, submissionId: number, options?: { force?: boolean }): Promise<ExhibitorPdfGenerationResult> {
  const submission = await loadSubmissionForExhibitorPdf(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }
  if (submission.status !== "APPROVED") {
    throw new Error("Submission not approved");
  }
  if (!isPaymentConfirmedByAdmin(submission.paymentStatus)) {
    throw new Error("Submission payment not confirmed by admin");
  }
  const team = await buildSubmissionTeamPayload(env, submission);
  if (team.totalMembers > 0 && !team.allConfirmed) {
    throw new Error("Manual do expositor disponível apenas depois de todos os membros confirmarem o convite de equipa.");
  }

  const data = await mapSubmissionToPdfData(env, submission, team);
  const passTheme = await loadExhibitorPassTheme();
  const fingerprint = hashPdfData(data, passTheme);
  const latest = await loadLatestExhibitorPdfMetadata(env, submissionId);
  const latestFileExists = latest ? await pathExists(resolvePdfPath(env, latest)) : false;

  if (!options?.force && latest && latest.fingerprint === fingerprint && latestFileExists) {
    return {
      metadata: latest,
      buffer: await readExhibitorPdfFile(env, latest),
      created: false,
    };
  }

  const version = Date.now();
  const accessToken = latest?.accessToken ?? `expdf_${randomUUID().replace(/-/g, "")}`;
  const fileName = createDownloadFileName(data);
  const storageFileName = createStorageFileName(version, fileName);
  const generatedAt = new Date();
  const publicUrl = buildPublicPdfUrl(env, submissionId, accessToken);
  const [qrDataUri, projectQrDataUri, challengeQrDataUri, logoDataUri] = await Promise.all([
    renderQrDataUri(data.link, 720),
    renderQrDataUri(data.link, 720, { transparentBackground: true }),
    renderQrDataUri(data.challengeUrl, 720, { transparentBackground: true }),
    loadLogoDataUri(),
  ]);
  const html = buildExhibitorPdfHtml({
    submissionId,
    data,
    passRenderItems: data.passes,
    passTheme,
    qrDataUri,
    voteQrDataUri: await renderQrDataUri(data.voteQrLink, 720, { transparentBackground: true }),
    projectQrDataUri,
    challengeQrDataUri,
    logoDataUri,
    generatedAt,
    pdfUrl: publicUrl,
  });
  const buffer = await renderPdfFromHtml(html, {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: {
      top: "0",
      right: "0",
      bottom: "0",
      left: "0",
    },
  });
  const dir = getSubmissionStorageDir(env, submissionId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storageFileName), buffer);

  const metadata: ExhibitorPdfMetadata = {
    submissionId,
    referenceCode: submission.referenceCode,
    version,
    fileName,
    storageFileName,
    fileSize: buffer.byteLength,
    fingerprint,
    accessToken,
    qrValue: data.link,
    pdfPath: buildPdfRoute(submissionId),
    publicUrl,
    recipientEmail: data.email,
    generatedAt: generatedAt.toISOString(),
    event: {
      name: data.evento,
      date: data.dataEvento,
      location: data.localEvento,
    },
  };

  await writeMetadata(env, metadata);

  return { metadata, buffer, created: true };
}

export async function notifyExhibitorPdfReady(env: Env, result: ExhibitorPdfGenerationResult) {
  if (!env.EXHIBITOR_PDF_EMAIL_WEBHOOK_URL || !result.metadata.recipientEmail) {
    return { sent: false, reason: "email webhook or recipient missing" };
  }

  const subject = `${result.metadata.event.name}: manual oficial do expositor`;
  const payload = {
    to: result.metadata.recipientEmail,
    subject,
    fileName: result.metadata.fileName,
    pdfUrl: result.metadata.publicUrl,
    submissionId: result.metadata.submissionId,
    referenceCode: result.metadata.referenceCode,
    event: result.metadata.event,
    text: [
      "A tua candidatura foi aprovada e o manual oficial do expositor já está disponível.",
      result.metadata.publicUrl ? `Manual: ${result.metadata.publicUrl}` : "Entra na Minha Área para baixar o manual.",
      "Imprime o material em boa qualidade e mantém o QR Code visível durante a exposição.",
    ].join("\n\n"),
    html: `
      <p>A tua candidatura foi aprovada e o manual oficial do expositor já está disponível.</p>
      ${result.metadata.publicUrl ? `<p><a href="${escapeHtml(result.metadata.publicUrl)}">Baixar manual do expositor</a></p>` : "<p>Entra na Minha Área para baixar o manual.</p>"}
      <p>Imprime o material em boa qualidade e mantém o QR Code visível durante a exposição.</p>
    `,
  };

  const response = await fetch(env.EXHIBITOR_PDF_EMAIL_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Exhibitor PDF email webhook failed: ${response.status} ${text}`.trim());
  }

  return { sent: true };
}

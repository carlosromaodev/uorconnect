import type { Env } from "../../../config/env";
import { prisma } from "../../../shared/prisma";
import {
  escapeHtml,
  formatDateLabel,
  loadLogoDataUri,
  renderPdfFromHtml,
} from "../../reports/http/pdf-report.utils";
import {
  getOdinOverview,
  type OdinDeviceRisk,
  type OdinOverview,
  type OdinProjectPressure,
  type OdinRiskLevel,
  type OdinStudentRisk,
} from "../application/odin.service";
import {
  buildForensicQueue,
  type ForensicActionUrgency,
  type ForensicCaseSignals,
} from "../application/odin-forensic.service";

type OdinReportAnalysis = {
  id: number;
  caseType: string;
  caseId: string;
  riskScore: number;
  riskLevel: string;
  narrative: string;
  fraudProbability: number;
  legitimateProbability: number;
  mostLikelyScenario: string;
  alternativeScenario: string;
  recommendation: string;
  confidenceLevel: string;
  actionType: string;
  patternType: string | null;
  actionUrgency: string | null;
  operationalState: string;
  ruleRiskScore: number | null;
  unifiedRiskScore: number | null;
  consistencyCheck: string;
  consistencyReason: string | null;
  evidenceSummary: string | null;
  commentAnalysis: string | null;
  alternativePlausibility: string | null;
  recommendedAction: string | null;
  votesToReview: number | null;
  accountsToReview: number | null;
  notifyExpositor: boolean;
  cannotBeFalsePositiveIf: string | null;
  modelVersion: string;
  promptVersion: string;
  createdByStudentNumber: string | null;
  createdAt: Date;
  _count?: { feedback: number };
};

type OdinReportEvent = {
  id: number;
  deviceId: string;
  studentId?: number | null;
  studentNumber: string | null;
  studentName: string | null;
  studentCourse: string | null;
  eventType: string;
  targetType: string | null;
  targetId: number | null;
  targetLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  riskContextJson?: string | null;
  createdAt: Date;
};

type OdinReportStudentSource = {
  id: number;
  studentNumber: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  course: string | null;
  university: string | null;
  registrationSource: string | null;
  academicSyncedAt: Date | null;
  profileCompletedAt: Date | null;
  avatarUrl: string | null;
  deletedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  _count?: {
    loginAudits: number;
    votes: number;
    comments: number;
    passportScans: number;
    submissionMemberships: number;
  };
};

type OdinReportDetailedEvent = OdinReportEvent & {
  student: OdinReportStudentSource | null;
};

type OdinReportInvalidStudent = {
  studentNumber: string;
  name: string;
  course: string;
  university: string;
  sourceLabel: string;
  flags: string[];
  activity: string;
};

type OdinReportDeviceIdentity = {
  deviceId: string;
  riskScore: number;
  riskLevel: string;
  contextualFraudScore: number;
  classification: string;
  firstAccountLabel: string;
  firstAccountCourse: string;
  firstLoginAt: Date | null;
  lastLoginAt: Date | null;
  distinctAccounts: number;
  courses: Array<{ course: string; count: number }>;
  accounts: string[];
  loginTimeline: Array<{
    studentNumber: string;
    studentName: string;
    studentCourse: string;
    loginAt: Date;
  }>;
  dominantProject: string;
  averageLoginToVoteSeconds: number | null;
  fastestLoginToVoteSeconds: number | null;
  rapidConversions: number;
  rapidAccountSwitches: number;
  invalidOrTemporaryAccounts: number;
  officialAccounts: number;
  recommendation: string;
};

type OdinReportCourseRisk = {
  course: string;
  students: number;
  devices: number;
  rapidConversions: number;
};

type OdinReportProjectInvestigation = {
  submissionId: number;
  name: string;
  type: string;
  course: string;
  members: number;
  confirmedMembers: number;
  comments: number;
  recentCommentSignals: string[];
  suspiciousVotes: number;
  suspiciousStudents: number;
  temporaryOrIncompleteVoters: number;
  averageLoginToVoteSeconds: number | null;
  recommendation: string;
};

type OdinReportExhibitorDeviceSignal = {
  submissionId: number;
  submissionName: string;
  memberName: string;
  memberStudentNumber: string;
  deviceId: string;
  firstAccountLabel: string;
  distinctAccounts: number;
  accountSwitches: number;
  rapidAccountSwitches: number;
  ownProjectVotes: number;
  ownProjectVoterAccounts: number;
  averageLoginToVoteSeconds: number | null;
  fastestLoginToVoteSeconds: number | null;
  invalidOrTemporaryAccounts: number;
  officialAccounts: number;
  classification: string;
  recommendation: string;
};

type OdinReportInvestigationContext = {
  invalidStudentTotal: number;
  invalidStudents: OdinReportInvalidStudent[];
  deviceIdentities: OdinReportDeviceIdentity[];
  courseRisks: OdinReportCourseRisk[];
  projectInvestigations: OdinReportProjectInvestigation[];
  exhibitorDeviceSignals: OdinReportExhibitorDeviceSignal[];
};

const reportKind = "security.odin.report";
const officialRegistrationSources = new Set(["SECRETARIA", "ISPTEC_OFFICIAL"]);

function clampWindowHours(windowHours?: number) {
  return Number.isFinite(windowHours)
    ? Math.min(24 * 14, Math.max(1, Math.floor(windowHours as number)))
    : 48;
}

function riskLabel(level: string) {
  if (level === "CRITICAL") return "Crítico";
  if (level === "HIGH") return "Alto";
  if (level === "MEDIUM") return "Médio";
  return "Baixo";
}

function riskClass(level: string) {
  if (level === "CRITICAL") return "risk-critical";
  if (level === "HIGH") return "risk-high";
  if (level === "MEDIUM") return "risk-medium";
  return "risk-low";
}

function caseTypeLabel(value: string) {
  if (value === "DEVICE") return "Dispositivo";
  if (value === "STUDENT") return "Utilizador";
  if (value === "PROJECT") return "Projeto";
  return value;
}

function actionTypeLabel(value: string) {
  if (value === "MONITOR") return "Monitorizar";
  if (value === "REVIEW") return "Rever";
  if (value === "INVALIDATE_VOTES") return "Invalidar votos";
  if (value === "NOTIFY_FOR_APPEAL") return "Notificar para recurso";
  if (value === "ESCALATE_TO_ORGANIZATION") return "Escalar para organização";
  return value;
}

function urgencyLabel(value: ForensicActionUrgency) {
  if (value === "IMEDIATA") return "ACÇÃO IMEDIATA";
  if (value === "24H") return "INVESTIGAR 24H";
  return "PODE ESPERAR";
}

function urgencyClass(value: ForensicActionUrgency) {
  if (value === "IMEDIATA") return "risk-critical";
  if (value === "24H") return "risk-high";
  return "risk-low";
}

function eventTypeLabel(value: string) {
  if (value === "LOGIN_SUCCESS") return "Login";
  if (value === "PROJECT_VOTE") return "Voto";
  if (value === "PROJECT_LIKE") return "Like";
  if (value === "PROJECT_COMMENT") return "Comentário";
  if (value === "PASSPORT_SCAN") return "Passaporte";
  if (value === "PROFILE_EXCLUDED") return "Exclusão";
  return value;
}

function shortId(value: string | null | undefined, start = 8, end = 6) {
  const text = value?.trim() ?? "";
  if (!text) return "Indisponível";
  if (text.length <= start + end + 3) return text;
  return `${text.slice(0, start)}...${text.slice(-end)}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-AO").format(value);
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "Sem amostra";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function eventStudentKey(event: Pick<OdinReportEvent, "studentId" | "studentNumber">) {
  if (event.studentId) return `id:${event.studentId}`;
  if (event.studentNumber) return `number:${event.studentNumber}`;
  return null;
}

function normalizeStudentNumber(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function transitionCount(events: OdinReportDetailedEvent[]) {
  let switches = 0;
  let rapidSwitches = 0;
  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1];
    const current = events[index];
    if (eventStudentKey(previous) === eventStudentKey(current)) continue;
    switches += 1;
    const gap = Math.max(0, Math.round((current.createdAt.getTime() - previous.createdAt.getTime()) / 1000));
    if (gap <= 90) rapidSwitches += 1;
  }
  return { switches, rapidSwitches };
}

function isOfficialStudent(student: Pick<OdinReportStudentSource, "academicSyncedAt" | "registrationSource"> | null | undefined) {
  if (!student) return false;
  return Boolean(student.academicSyncedAt || officialRegistrationSources.has(student.registrationSource?.trim().toUpperCase() ?? ""));
}

function validStudentNumber(value?: string | null) {
  const normalized = value?.trim() ?? "";
  return Boolean(normalized && normalized.length <= 40 && /^[\p{L}\p{N}._-]+$/u.test(normalized));
}

function studentIntegrityFlags(student: OdinReportStudentSource | null | undefined) {
  const flags: string[] = [];
  if (!student) {
    flags.push("SEM_REGISTO_NA_BASE");
    return flags;
  }

  if (student.deletedAt) flags.push("CONTA_ELIMINADA");
  if (!isOfficialStudent(student)) flags.push("LOGIN_NAO_OFICIAL");
  if (!validStudentNumber(student.studentNumber)) flags.push("NUMERO_INVALIDO");
  if (!student.name?.trim()) flags.push("NOME_EM_FALTA");
  if (!student.course?.trim()) flags.push("CURSO_EM_FALTA");
  if (!student.email?.trim() && !student.phone?.trim()) flags.push("CONTACTO_EM_FALTA");
  if (!student.avatarUrl?.trim()) flags.push("SEM_FOTO");
  if (!student.profileCompletedAt) flags.push("PERFIL_INCOMPLETO");
  return flags;
}

function sourceLabel(student: Pick<OdinReportStudentSource, "academicSyncedAt" | "registrationSource"> | null | undefined) {
  if (student?.registrationSource === "SECRETARIA") return "Oficial UOR";
  if (student?.registrationSource === "ISPTEC_OFFICIAL") return "Oficial ISPTEC";
  if (student?.academicSyncedAt) return "Académico sincronizado";
  return "Não oficial / temporário";
}

function personLabel(event: Pick<OdinReportEvent, "studentName" | "studentNumber" | "studentCourse">) {
  const name = event.studentName?.trim() || event.studentNumber?.trim() || "Conta sem nome";
  const course = event.studentCourse?.trim();
  return course ? `${name} · ${course}` : name;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function maxRiskLevel(overview: OdinOverview): OdinRiskLevel {
  if (overview.devices.some((device) => device.riskLevel === "CRITICAL")) return "CRITICAL";
  if (overview.devices.some((device) => device.riskLevel === "HIGH")) return "HIGH";
  if (overview.devices.some((device) => device.riskLevel === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

function renderLogo(logoDataUri: string | null) {
  return logoDataUri
    ? `<img src="${logoDataUri}" alt="UOR Connect" class="brand-logo" />`
    : `<div class="brand-fallback"><strong>UOR Connect</strong></div>`;
}

function renderBorderLabels() {
  return `
    <div class="border-label border-label--left">UOR CONNECT</div>
    <div class="border-label border-label--right">ODIN</div>
  `;
}

function renderHeader(logoMarkup: string, title: string) {
  return `
    <header class="header">
      <div>${logoMarkup}</div>
      <div class="doc-kicker">
        <strong>${escapeHtml(title)}</strong>
        Sistema ODIN · Segurança e Auditoria
      </div>
    </header>
  `;
}

function renderFooter(reportNumber: string, pageNumber: number, totalPages: number) {
  return `
    <div class="page-footer">
      <span>${escapeHtml(reportNumber)} · Documento confidencial da organização.</span>
      <span>Página <strong>${pageNumber}</strong> de <strong>${totalPages}</strong></span>
    </div>
  `;
}

function renderMetric(label: string, value: string | number, note: string) {
  return `
    <div class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <p>${escapeHtml(note)}</p>
    </div>
  `;
}

function renderRiskPill(level: string, score?: number) {
  return `<span class="risk-pill ${riskClass(level)}">${escapeHtml(riskLabel(level))}${typeof score === "number" ? ` · ${score}` : ""}</span>`;
}

function renderAnalysisCards(analyses: OdinReportAnalysis[]) {
  if (!analyses.length) {
    return `
      <div class="empty-state">
        <h3>Sem análise ODIN assistida nesta janela</h3>
        <p>O relatório continua válido com regras do ODIN. Quando a organização gerar análises assistidas na aba ODIN, elas aparecerão aqui com narrativa, cenário alternativo e recomendação proporcional.</p>
      </div>
    `;
  }

  return analyses.slice(0, 4).map((analysis) => `
    <article class="analysis-card">
      <div class="analysis-heading">
        <div>
          <span class="eyebrow">${escapeHtml(caseTypeLabel(analysis.caseType))} · ${escapeHtml(shortId(analysis.caseId, 10, 6))}</span>
          <h3>${escapeHtml(actionTypeLabel(analysis.actionType))}</h3>
        </div>
        ${renderRiskPill(analysis.riskLevel, analysis.riskScore)}
      </div>
      <p class="analysis-narrative">${escapeHtml(analysis.narrative)}</p>
      <div class="probability-grid">
        <div><span>Fraude provável</span><strong>${analysis.fraudProbability}%</strong></div>
        <div><span>Explicação legítima</span><strong>${analysis.legitimateProbability}%</strong></div>
        <div><span>Confiança</span><strong>${escapeHtml(analysis.confidenceLevel)}</strong></div>
        <div><span>Feedback</span><strong>${analysis._count?.feedback ?? 0}</strong></div>
      </div>
      <div class="scenario-grid">
        <div><span>Cenário mais provável</span><p>${escapeHtml(analysis.mostLikelyScenario)}</p></div>
        <div><span>Cenário alternativo</span><p>${escapeHtml(analysis.alternativeScenario)}</p></div>
      </div>
      <div class="recommendation-box">
        <span>Recomendação ODIN</span>
        <p>${escapeHtml(analysis.recommendation)}</p>
      </div>
    </article>
  `).join("");
}

function renderForensicQueueRows(queue: ReturnType<typeof buildForensicQueue>) {
  if (!queue.length) {
    return `<tr><td colspan="9">Sem casos ativos para triagem operacional nesta janela.</td></tr>`;
  }

  return queue.slice(0, 18).map((item, index) => `
    <tr>
      <td><strong>ODIN-${String(index + 1).padStart(3, "0")}</strong><small>${escapeHtml(item.caseId)}</small></td>
      <td><span class="risk-pill ${urgencyClass(item.actionUrgency)}">${escapeHtml(item.patternType)}</span></td>
      <td><strong>${escapeHtml(urgencyLabel(item.actionUrgency))}</strong><small>${escapeHtml(item.operationalState)}</small></td>
      <td>${escapeHtml(item.entityLabel)}</td>
      <td class="number-cell">${item.votesToReview}</td>
      <td>${item.rankingTop3Affected ? "Top 3 pode mudar" : "Sem impacto top 3 confirmado"}</td>
      <td>${escapeHtml(item.nextStep)}</td>
      <td>Organização</td>
      <td>${item.actionUrgency === "IMEDIATA" ? "30 min" : item.actionUrgency === "24H" ? "24h" : "Monitorizar"}</td>
    </tr>
  `).join("");
}

function renderForensicCaseDossier(queue: ReturnType<typeof buildForensicQueue>) {
  const item = queue[0];
  if (!item) {
    return `<div class="empty-state"><h3>Sem dossiê individual</h3><p>O ODIN não encontrou caso com dados suficientes para abrir um dossiê operacional nesta janela.</p></div>`;
  }

  return `
    <div class="section-card">
      <p class="eyebrow">DOSSIÊ DE CASO</p>
      <h2>${escapeHtml(item.caseId)} · ${escapeHtml(item.patternType)}</h2>
      <div class="metric-grid">
        ${renderMetric("Urgência", urgencyLabel(item.actionUrgency), "Fila operacional do caso.")}
        ${renderMetric("Estado", item.operationalState, "Estado calculado para Fase 1.")}
        ${renderMetric("Votos a rever", item.votesToReview, "Votos associados ao padrão.")}
        ${renderMetric("Contas a rever", item.accountsToReview, "Contas associadas ao caso.")}
      </div>
      <p class="lead">${escapeHtml(item.evidenceSummary)}</p>
    </div>
    <div class="section-card">
      <p class="eyebrow">Prova Matemática</p>
      <h2>Factos verificáveis na base de dados</h2>
      <table class="score-table">
        <tbody>
          <tr><th>Entidade</th><td>${escapeHtml(item.entityLabel)}</td></tr>
          <tr><th>Score unificado</th><td>${item.unifiedRiskScore}/100</td></tr>
          <tr><th>Condição de falso positivo improvável</th><td>${escapeHtml(item.cannotBeFalsePositiveIf)}</td></tr>
          <tr><th>Impacto</th><td>${item.rankingTop3Affected ? "Pode alterar posição no top 3." : "Sem alteração de top 3 confirmada pelos dados atuais."}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="section-card">
      <p class="eyebrow">Análise Contextual</p>
      <h2>Interpretação assistida e protocolo</h2>
      <p class="muted">${escapeHtml(item.commentAnalysis)}</p>
      <div class="recommendation-box">
        <span>Próximo passo</span>
        <p>${escapeHtml(item.recommendedAction)}</p>
      </div>
    </div>
  `;
}

function renderStudentRows(students: OdinStudentRisk[]) {
  if (!students.length) {
    return `<tr><td colspan="7">Nenhum utilizador suspeito nesta janela.</td></tr>`;
  }

  return students.slice(0, 18).map((student) => `
    <tr>
      <td>
        <strong>${escapeHtml(student.studentName ?? student.studentNumber)}</strong>
        <small>${escapeHtml(student.studentNumber)}</small>
      </td>
      <td>${escapeHtml(student.studentCourse ?? "Curso em falta")}</td>
      <td>${renderRiskPill(student.riskLevel, student.riskScore)}</td>
      <td class="number-cell">${student.loginCount}</td>
      <td class="number-cell">${student.voteCount}</td>
      <td>${escapeHtml(student.devices.map((device) => shortId(device, 5, 4)).join(", ") || "Sem dispositivo")}</td>
      <td>${escapeHtml(student.reasons[0] ?? "Rever comportamento recente.")}</td>
    </tr>
  `).join("");
}

function renderDeviceRows(devices: OdinDeviceRisk[]) {
  const riskyDevices = devices.filter((device) => device.riskScore >= 40);
  if (!riskyDevices.length) {
    return `<tr><td colspan="8">Nenhum dispositivo suspeito nesta janela.</td></tr>`;
  }

  return riskyDevices.slice(0, 16).map((device) => `
    <tr>
      <td><strong>${escapeHtml(shortId(device.deviceId))}</strong><small>${escapeHtml(device.lastIp ?? "IP indisponível")}</small></td>
      <td>${renderRiskPill(device.riskLevel, device.riskScore)}</td>
      <td class="number-cell">${device.distinctStudents}</td>
      <td class="number-cell">${device.loginCount}</td>
      <td class="number-cell">${device.voteCount}</td>
      <td class="number-cell">${device.distinctProjectsVoted}</td>
      <td>${escapeHtml(device.students.slice(0, 3).map((student) => student.studentName ?? student.studentNumber).join(", ") || "Sem contas")}</td>
      <td>${escapeHtml(device.reasons[0] ?? "Rever padrão do dispositivo.")}</td>
    </tr>
  `).join("");
}

function renderProjectRows(projects: OdinProjectPressure[]) {
  if (!projects.length) {
    return `<tr><td colspan="5">Nenhum projeto com pressão suspeita nesta janela.</td></tr>`;
  }

  return projects.slice(0, 12).map((project) => `
    <tr>
      <td><strong>${escapeHtml(project.submissionName)}</strong><small>#${project.submissionId}</small></td>
      <td class="number-cell">${project.suspiciousVotes}</td>
      <td class="number-cell">${project.suspiciousDevices}</td>
      <td class="number-cell">${project.suspiciousStudents}</td>
      <td>Rever votos associados antes de qualquer remoção.</td>
    </tr>
  `).join("");
}

function renderEventRows(events: OdinReportEvent[]) {
  if (!events.length) {
    return `<tr><td colspan="5">Sem eventos ODIN recentes nesta janela.</td></tr>`;
  }

  return events.slice(0, 24).map((event) => `
    <tr>
      <td>${escapeHtml(formatDateLabel(event.createdAt))}</td>
      <td>${escapeHtml(eventTypeLabel(event.eventType))}</td>
      <td>${escapeHtml(event.studentName ?? event.studentNumber ?? "Conta não associada")}</td>
      <td>${escapeHtml(event.targetLabel ?? event.targetType ?? "Sem alvo")}</td>
      <td>${escapeHtml(shortId(event.deviceId, 6, 4))}</td>
    </tr>
  `).join("");
}

function renderCourseRiskChart(courseRisks: OdinReportCourseRisk[]) {
  if (!courseRisks.length) {
    return `<div class="empty-state"><h3>Sem gráfico de cursos</h3><p>Não há contas suficientes para relacionar curso, dispositivo e conversão nesta janela.</p></div>`;
  }

  const maxStudents = Math.max(...courseRisks.map((item) => item.students), 1);
  return `
    <div class="course-chart">
      ${courseRisks.slice(0, 8).map((item) => {
        const width = Math.max(8, Math.round((item.students / maxStudents) * 100));
        return `
          <div class="course-chart-row">
            <div>
              <strong>${escapeHtml(item.course)}</strong>
              <span>${item.students} conta(s) · ${item.devices} dispositivo(s) · ${item.rapidConversions} conversão(ões) rápidas</span>
            </div>
            <div class="course-chart-track"><i style="width:${width}%"></i></div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderDeviceIdentityCards(devices: OdinReportDeviceIdentity[]) {
  if (!devices.length) {
    return `<div class="empty-state"><h3>Sem dossiês de dispositivo</h3><p>Nenhum dispositivo reuniu dados suficientes para uma análise identitária nesta janela.</p></div>`;
  }

  return devices.slice(0, 8).map((device) => `
    <article class="intel-card">
      <div class="intel-card-head">
        <div>
          <span class="eyebrow">Dispositivo ${escapeHtml(shortId(device.deviceId, 7, 5))}</span>
          <h3>${escapeHtml(device.classification)}</h3>
        </div>
        <span class="risk-pill ${riskClass(device.riskLevel)}">Índice de fraude contextual · ${device.contextualFraudScore}</span>
      </div>
      <div class="intel-grid">
        <div><span>Primeira conta observada</span><strong>${escapeHtml(device.firstAccountLabel)}</strong><p>${escapeHtml(device.firstAccountCourse)}</p></div>
        <div><span>Horários de login</span><strong>${escapeHtml(device.firstLoginAt ? formatDateLabel(device.firstLoginAt) : "Sem login")}</strong><p>Último: ${escapeHtml(device.lastLoginAt ? formatDateLabel(device.lastLoginAt) : "Sem login")}</p></div>
        <div><span>Tempo login→voto</span><strong>${escapeHtml(formatDuration(device.averageLoginToVoteSeconds))}</strong><p>Mais rápido: ${escapeHtml(formatDuration(device.fastestLoginToVoteSeconds))}</p></div>
        <div><span>Contas no aparelho</span><strong>${device.distinctAccounts}</strong><p>${device.officialAccounts} oficiais · ${device.invalidOrTemporaryAccounts} incompletas/temporárias</p></div>
        <div><span>Conversões rápidas</span><strong>${device.rapidConversions}</strong><p>${device.rapidAccountSwitches} troca(s) de conta em menos de 90s</p></div>
      </div>
      <p class="intel-line"><strong>Projeto dominante:</strong> ${escapeHtml(device.dominantProject)}</p>
      <p class="intel-line"><strong>Contas vistas:</strong> ${escapeHtml(device.accounts.join(", ") || "Sem contas associadas")}</p>
      <p class="intel-line"><strong>Cursos:</strong> ${escapeHtml(device.courses.map((course) => `${course.course} (${course.count})`).join(", ") || "Sem curso")}</p>
      <p class="intel-line"><strong>Horários exatos de login:</strong> ${escapeHtml(device.loginTimeline.slice(-8).map((login) => `${formatDateLabel(login.loginAt)} — ${login.studentName} (${login.studentNumber})`).join(" · ") || "Sem eventos LOGIN_SUCCESS na janela")}</p>
      <div class="recommendation-box"><span>Leitura ODIN</span><p>${escapeHtml(device.recommendation)}</p></div>
    </article>
  `).join("");
}

function renderInvalidStudentRows(students: OdinReportInvalidStudent[]) {
  if (!students.length) {
    return `<tr><td colspan="6">Nenhum estudante com dados inválidos ou incompletos encontrado na amostra.</td></tr>`;
  }

  return students.slice(0, 22).map((student) => `
    <tr>
      <td><strong>${escapeHtml(student.name)}</strong><small>${escapeHtml(student.studentNumber)}</small></td>
      <td>${escapeHtml(student.course)}</td>
      <td>${escapeHtml(student.university)}</td>
      <td>${escapeHtml(student.sourceLabel)}</td>
      <td>${escapeHtml(student.flags.slice(0, 4).join(", "))}</td>
      <td>${escapeHtml(student.activity)}</td>
    </tr>
  `).join("");
}

function renderProjectInvestigationRows(projects: OdinReportProjectInvestigation[]) {
  if (!projects.length) {
    return `<tr><td colspan="8">Sem projetos com dados suficientes para investigação contextual nesta janela.</td></tr>`;
  }

  return projects.slice(0, 12).map((project) => `
    <tr>
      <td><strong>${escapeHtml(project.name)}</strong><small>#${project.submissionId} · ${escapeHtml(project.type)}</small></td>
      <td>${escapeHtml(project.course)}</td>
      <td class="number-cell">${project.suspiciousVotes}</td>
      <td class="number-cell">${project.suspiciousStudents}</td>
      <td class="number-cell">${project.temporaryOrIncompleteVoters}</td>
      <td>${escapeHtml(formatDuration(project.averageLoginToVoteSeconds))}</td>
      <td><strong>${project.confirmedMembers}/${project.members}</strong><small>${project.comments} comentário(s)</small></td>
      <td>${escapeHtml(project.recommendation)}</td>
    </tr>
  `).join("");
}

function renderProjectCommentSignals(projects: OdinReportProjectInvestigation[]) {
  const signals = projects
    .flatMap((project) => project.recentCommentSignals.map((signal) => ({ project: project.name, signal })))
    .slice(0, 8);
  if (!signals.length) {
    return `<p class="muted">Sem comentários recentes associados aos projetos analisados.</p>`;
  }

  return `
    <div class="method-grid">
      ${signals.map((item) => `
        <div class="method-card">
          <span>${escapeHtml(item.project)}</span>
          <p>${escapeHtml(item.signal)}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderExhibitorDeviceSignalRows(signals: OdinReportExhibitorDeviceSignal[]) {
  if (!signals.length) {
    return `<tr><td colspan="9">Sem dispositivos de expositores com troca de contas ou votos ao próprio projeto nesta janela.</td></tr>`;
  }

  return signals.slice(0, 18).map((signal) => `
    <tr>
      <td><strong>${escapeHtml(signal.submissionName)}</strong><small>#${signal.submissionId}</small></td>
      <td><strong>${escapeHtml(signal.memberName)}</strong><small>${escapeHtml(signal.memberStudentNumber)}</small></td>
      <td><strong>${escapeHtml(shortId(signal.deviceId, 7, 5))}</strong><small>${escapeHtml(signal.firstAccountLabel)}</small></td>
      <td class="number-cell">${signal.accountSwitches}<small>${signal.rapidAccountSwitches} rápida(s)</small></td>
      <td class="number-cell">${signal.distinctAccounts}<small>${signal.officialAccounts} oficiais · ${signal.invalidOrTemporaryAccounts} frágeis</small></td>
      <td class="number-cell">${signal.ownProjectVotes}<small>${signal.ownProjectVoterAccounts} conta(s)</small></td>
      <td>${escapeHtml(formatDuration(signal.averageLoginToVoteSeconds))}<small>Mais rápido: ${escapeHtml(formatDuration(signal.fastestLoginToVoteSeconds))}</small></td>
      <td><strong>${escapeHtml(signal.classification)}</strong></td>
      <td>${escapeHtml(signal.recommendation)}</td>
    </tr>
  `).join("");
}

function buildInvalidStudentWhere() {
  return {
    OR: [
      { name: null },
      { name: "" },
      { course: null },
      { course: "" },
      { profileCompletedAt: null },
      { avatarUrl: null },
      { avatarUrl: "" },
      {
        AND: [
          { email: null },
          { phone: null },
        ],
      },
      {
        AND: [
          { academicSyncedAt: null },
          {
            OR: [
              { registrationSource: null },
              { registrationSource: { notIn: Array.from(officialRegistrationSources) } },
            ],
          },
        ],
      },
    ],
  };
}

function toInvalidStudentRow(student: OdinReportStudentSource): OdinReportInvalidStudent {
  const flags = studentIntegrityFlags(student);
  return {
    studentNumber: student.studentNumber,
    name: student.name?.trim() || "Nome em falta",
    course: student.course?.trim() || "Curso em falta",
    university: student.university?.trim() || "Universidade em falta",
    sourceLabel: sourceLabel(student),
    flags,
    activity: `${student._count?.loginAudits ?? 0} login(s), ${student._count?.votes ?? 0} voto(s), ${student._count?.passportScans ?? 0} scan(s)`,
  };
}

function buildDeviceIdentities(events: OdinReportDetailedEvent[], overview: OdinOverview): OdinReportDeviceIdentity[] {
  const byDevice = new Map<string, OdinReportDetailedEvent[]>();
  for (const event of events) {
    byDevice.set(event.deviceId, [...(byDevice.get(event.deviceId) ?? []), event]);
  }

  const overviewByDevice = new Map(overview.devices.map((device) => [device.deviceId, device]));

  return Array.from(byDevice.entries()).map(([deviceId, deviceEvents]) => {
    const sortedEvents = [...deviceEvents].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    const overviewDevice = overviewByDevice.get(deviceId);
    const studentEvents = sortedEvents.filter((event) => eventStudentKey(event));
    const firstStudentEvent = studentEvents[0] ?? null;
    const accounts = new Map<string, OdinReportDetailedEvent>();
    const voteProjects = new Map<string, number>();
    const loginToVoteDurations: number[] = [];
    let rapidConversions = 0;
    let rapidAccountSwitches = 0;

    for (const event of studentEvents) {
      const key = eventStudentKey(event);
      if (key && !accounts.has(key)) accounts.set(key, event);
      if (event.eventType === "PROJECT_VOTE" && event.targetLabel) {
        voteProjects.set(event.targetLabel, (voteProjects.get(event.targetLabel) ?? 0) + 1);
      }
    }

    const loginEvents = sortedEvents.filter((event) => event.eventType === "LOGIN_SUCCESS" && eventStudentKey(event));
    for (const loginEvent of loginEvents) {
      const key = eventStudentKey(loginEvent);
      const vote = sortedEvents.find((event) =>
        event.eventType === "PROJECT_VOTE"
        && eventStudentKey(event) === key
        && event.createdAt >= loginEvent.createdAt
      );
      if (!vote) continue;
      const duration = Math.max(0, Math.round((vote.createdAt.getTime() - loginEvent.createdAt.getTime()) / 1000));
      loginToVoteDurations.push(duration);
      if (duration <= 90) rapidConversions += 1;
    }

    for (let index = 1; index < loginEvents.length; index += 1) {
      const previous = loginEvents[index - 1];
      const current = loginEvents[index];
      if (eventStudentKey(previous) === eventStudentKey(current)) continue;
      const gap = Math.max(0, Math.round((current.createdAt.getTime() - previous.createdAt.getTime()) / 1000));
      if (gap <= 90) rapidAccountSwitches += 1;
    }

    const accountEvents = Array.from(accounts.values());
    const invalidOrTemporaryAccounts = accountEvents.filter((event) =>
      !isOfficialStudent(event.student) || studentIntegrityFlags(event.student).length > 0
    ).length;
    const officialAccounts = accountEvents.filter((event) => isOfficialStudent(event.student)).length;
    const courseCounts = new Map<string, number>();
    for (const event of accountEvents) {
      const course = event.student?.course?.trim() || event.studentCourse?.trim() || "Curso em falta";
      courseCounts.set(course, (courseCounts.get(course) ?? 0) + 1);
    }

    const dominantProject = Array.from(voteProjects.entries())
      .sort((left, right) => right[1] - left[1])[0]?.[0] ?? "Sem projeto dominante";
    const baseScore = overviewDevice?.riskScore ?? 0;
    const contextualFraudScore = clampScore(
      baseScore
      + (rapidConversions >= 3 ? 18 : rapidConversions > 0 ? 10 : 0)
      + (rapidAccountSwitches >= 2 ? 15 : rapidAccountSwitches > 0 ? 8 : 0)
      + (invalidOrTemporaryAccounts >= 3 ? 18 : invalidOrTemporaryAccounts > 0 ? 9 : 0)
      + (voteProjects.size === 1 && accountEvents.length >= 3 ? 10 : 0),
    );

    const classification = contextualFraudScore >= 90
      ? "Fraude provável por roteiro de credenciais"
      : contextualFraudScore >= 75
        ? "Suspeita forte de operador único"
        : contextualFraudScore >= 55
          ? "Partilha anormal com revisão obrigatória"
          : "Uso partilhado a monitorizar";

    const recommendation = contextualFraudScore >= 75
      ? "Comparar estes votos com a lista de presença e validar se cada estudante esteve fisicamente envolvido. Se confirmar operação por credenciais, invalidar apenas os votos ligados ao padrão."
      : "Não concluir fraude sem revisão humana. Confirmar se o dispositivo pertence a laboratório, protocolo ou expositor antes de qualquer ação.";

    return {
      deviceId,
      riskScore: baseScore,
      riskLevel: overviewDevice?.riskLevel ?? "LOW",
      contextualFraudScore,
      classification,
      firstAccountLabel: firstStudentEvent ? personLabel(firstStudentEvent) : "Sem primeira conta",
      firstAccountCourse: firstStudentEvent?.student?.course ?? firstStudentEvent?.studentCourse ?? "Curso em falta",
      firstLoginAt: loginEvents[0]?.createdAt ?? null,
      lastLoginAt: loginEvents[loginEvents.length - 1]?.createdAt ?? null,
      distinctAccounts: accountEvents.length,
      courses: Array.from(courseCounts.entries()).map(([course, count]) => ({ course, count }))
        .sort((left, right) => right.count - left.count || left.course.localeCompare(right.course)),
      accounts: accountEvents.map((event) => event.student?.name ?? event.studentName ?? event.studentNumber ?? "Conta sem nome").slice(0, 10),
      loginTimeline: loginEvents.map((event) => ({
        studentNumber: event.studentNumber ?? "sem-numero",
        studentName: event.student?.name ?? event.studentName ?? "Conta sem nome",
        studentCourse: event.student?.course ?? event.studentCourse ?? "Curso em falta",
        loginAt: event.createdAt,
      })).slice(-30),
      dominantProject,
      averageLoginToVoteSeconds: average(loginToVoteDurations),
      fastestLoginToVoteSeconds: loginToVoteDurations.length ? Math.min(...loginToVoteDurations) : null,
      rapidConversions,
      rapidAccountSwitches,
      invalidOrTemporaryAccounts,
      officialAccounts,
      recommendation,
    };
  }).filter((device) =>
    device.distinctAccounts >= 2 || device.contextualFraudScore >= 40 || device.rapidConversions > 0
  ).sort((left, right) =>
    right.contextualFraudScore - left.contextualFraudScore || right.distinctAccounts - left.distinctAccounts
  );
}

function buildCourseRisks(devices: OdinReportDeviceIdentity[]) {
  const byCourse = new Map<string, { students: Set<string>; devices: Set<string>; rapidConversions: number }>();
  for (const device of devices) {
    for (const course of device.courses) {
      const current = byCourse.get(course.course) ?? {
        students: new Set<string>(),
        devices: new Set<string>(),
        rapidConversions: 0,
      };
      current.devices.add(device.deviceId);
      for (let index = 0; index < course.count; index += 1) {
        current.students.add(`${device.deviceId}:${course.course}:${index}`);
      }
      current.rapidConversions += device.rapidConversions;
      byCourse.set(course.course, current);
    }
  }
  return Array.from(byCourse.entries()).map(([course, item]) => ({
    course,
    students: item.students.size,
    devices: item.devices.size,
    rapidConversions: item.rapidConversions,
  })).sort((left, right) => right.students - left.students || right.rapidConversions - left.rapidConversions);
}

function projectConversionAverage(projectId: number, devices: OdinReportDeviceIdentity[], events: OdinReportDetailedEvent[]) {
  const deviceIds = new Set(
    events
      .filter((event) => event.eventType === "PROJECT_VOTE" && event.targetType === "Submission" && event.targetId === projectId)
      .map((event) => event.deviceId),
  );
  return average(devices
    .filter((device) => deviceIds.has(device.deviceId))
    .map((device) => device.averageLoginToVoteSeconds)
    .filter((value): value is number => typeof value === "number"));
}

async function buildProjectInvestigations(
  overview: OdinOverview,
  events: OdinReportDetailedEvent[],
  devices: OdinReportDeviceIdentity[],
): Promise<OdinReportProjectInvestigation[]> {
  const projectIds = Array.from(new Set([
    ...overview.projects.map((project) => project.submissionId),
    ...events
      .filter((event) => event.targetType === "Submission" && event.targetId)
      .map((event) => event.targetId as number),
  ])).slice(0, 30);
  if (!projectIds.length) return [];

  const submissions = await prisma.submission.findMany({
    where: { id: { in: projectIds } },
    select: {
      id: true,
      name: true,
      type: true,
      course: true,
      area: true,
      category: true,
      description: true,
      memberConfirmations: {
        select: {
          confirmedAt: true,
          studentId: true,
          studentNumber: true,
          isExternal: true,
        },
        take: 30,
      },
      studentComments: {
        select: {
          content: true,
          moderationStatus: true,
          createdAt: true,
          student: {
            select: {
              studentNumber: true,
              name: true,
              course: true,
              registrationSource: true,
              academicSyncedAt: true,
              profileCompletedAt: true,
              avatarUrl: true,
              email: true,
              phone: true,
              university: true,
              deletedAt: true,
              lastLoginAt: true,
              createdAt: true,
              _count: {
                select: {
                  loginAudits: true,
                  votes: true,
                  comments: true,
                  passportScans: true,
                  submissionMemberships: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: {
        select: {
          studentVotes: true,
          studentComments: true,
          memberConfirmations: true,
          exhibitorScoreEvents: true,
        },
      },
    },
  });

  return submissions.map((submission) => {
    const pressure = overview.projects.find((project) => project.submissionId === submission.id);
    const projectEvents = events.filter((event) => event.targetType === "Submission" && event.targetId === submission.id);
    const voterEvents = projectEvents.filter((event) => event.eventType === "PROJECT_VOTE");
    const temporaryOrIncompleteVoters = new Set(
      voterEvents
        .filter((event) => !isOfficialStudent(event.student) || studentIntegrityFlags(event.student).length > 0)
        .map((event) => eventStudentKey(event) ?? event.studentNumber ?? `event:${event.id}`),
    ).size;
    const recentCommentSignals = submission.studentComments.map((comment) => {
      const author = comment.student?.name ?? comment.student?.studentNumber ?? "Conta sem nome";
      const source = sourceLabel(comment.student);
      return `${author} (${source}): ${comment.content.slice(0, 70)}`;
    }).slice(0, 3);
    const confirmedMembers = submission.memberConfirmations.filter((member) => member.confirmedAt).length;
    const averageLoginToVoteSeconds = projectConversionAverage(submission.id, devices, events);
    const recommendation = temporaryOrIncompleteVoters > 0 || (averageLoginToVoteSeconds !== null && averageLoginToVoteSeconds <= 90)
      ? "Rever padrões de login e votação dos estudantes envolvidos, com foco em perfis incompletos, temporários e alta atividade."
      : "Manter monitorização; sem evidência suficiente para ação automática.";

    return {
      submissionId: submission.id,
      name: submission.name,
      type: String(submission.type),
      course: submission.course ?? submission.area ?? submission.category ?? "Curso/área em falta",
      members: submission._count.memberConfirmations,
      confirmedMembers,
      comments: submission._count.studentComments,
      recentCommentSignals,
      suspiciousVotes: pressure?.suspiciousVotes ?? 0,
      suspiciousStudents: pressure?.suspiciousStudents ?? 0,
      temporaryOrIncompleteVoters,
      averageLoginToVoteSeconds,
      recommendation,
    };
  }).sort((left, right) =>
    right.suspiciousVotes - left.suspiciousVotes
    || right.temporaryOrIncompleteVoters - left.temporaryOrIncompleteVoters
    || (left.averageLoginToVoteSeconds ?? 9999) - (right.averageLoginToVoteSeconds ?? 9999)
  );
}

function memberMatchesEvent(
  member: { studentId: number | null; studentNumber: string | null; expectedStudentNumber: string | null },
  event: OdinReportDetailedEvent,
) {
  if (member.studentId && event.studentId === member.studentId) return true;
  const eventNumber = normalizeStudentNumber(event.studentNumber);
  if (!eventNumber) return false;
  return [
    member.studentNumber,
    member.expectedStudentNumber,
  ].some((value) => normalizeStudentNumber(value) === eventNumber);
}

function deviceLoginToVoteDurations(deviceEvents: OdinReportDetailedEvent[]) {
  const durations: number[] = [];
  const sortedEvents = [...deviceEvents].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const loginEvents = sortedEvents.filter((event) => event.eventType === "LOGIN_SUCCESS" && eventStudentKey(event));

  for (const loginEvent of loginEvents) {
    const key = eventStudentKey(loginEvent);
    const vote = sortedEvents.find((event) =>
      event.eventType === "PROJECT_VOTE"
      && eventStudentKey(event) === key
      && event.createdAt >= loginEvent.createdAt
    );
    if (!vote) continue;
    durations.push(Math.max(0, Math.round((vote.createdAt.getTime() - loginEvent.createdAt.getTime()) / 1000)));
  }

  return durations;
}

function classifyExhibitorDeviceSignal(input: {
  distinctAccounts: number;
  accountSwitches: number;
  rapidAccountSwitches: number;
  ownProjectVotes: number;
  ownProjectVoterAccounts: number;
  averageLoginToVoteSeconds: number | null;
  invalidOrTemporaryAccounts: number;
}) {
  const fastConversion = input.averageLoginToVoteSeconds !== null && input.averageLoginToVoteSeconds <= 90;
  if (input.ownProjectVotes >= 4 && input.accountSwitches >= 3 && (fastConversion || input.rapidAccountSwitches >= 2)) {
    return {
      classification: "Forte suspeita de operação por expositor",
      recommendation: "Comparar este aparelho com presença física, testemunho do membro e sequência de votos. O padrão sugere posse de credenciais ou troca guiada de contas, não apenas telefone emprestado.",
    };
  }
  if (input.ownProjectVotes >= 2 && input.distinctAccounts >= 3) {
    return {
      classification: "Revisão necessária por vantagem ao próprio projeto",
      recommendation: "Ouvir o expositor e validar se os estudantes votaram presencialmente. Se houver contas sem origem oficial ou conversões em segundos, isolar estes votos para revisão.",
    };
  }
  if (input.distinctAccounts <= 2 && input.ownProjectVotes <= 1 && input.invalidOrTemporaryAccounts === 0) {
    return {
      classification: "Telefone emprestado plausível",
      recommendation: "Partilha pontual pode ser legítima quando há poucas contas, origem oficial e ausência de voto em massa no projeto do membro. Manter apenas monitorização.",
    };
  }
  return {
    classification: "Telefone emprestado com sinais mistos",
    recommendation: "Não concluir fraude automaticamente. A recomendação é comparar tempo login→voto, origem das contas e se o aparelho beneficiou repetidamente o próprio projeto.",
  };
}

async function buildExhibitorDeviceSignals(
  overview: OdinOverview,
  events: OdinReportDetailedEvent[],
): Promise<OdinReportExhibitorDeviceSignal[]> {
  const projectIds = Array.from(new Set([
    ...overview.projects.map((project) => project.submissionId),
    ...events
      .filter((event) => event.targetType === "Submission" && event.targetId)
      .map((event) => event.targetId as number),
  ])).slice(0, 50);
  if (!projectIds.length) return [];

  const submissions = await prisma.submission.findMany({
    where: { id: { in: projectIds } },
    select: {
      id: true,
      name: true,
      memberConfirmations: {
        select: {
          id: true,
          name: true,
          studentId: true,
          studentNumber: true,
          expectedStudentNumber: true,
          confirmedAt: true,
        },
        take: 60,
      },
    },
  });

  const eventsByDevice = new Map<string, OdinReportDetailedEvent[]>();
  for (const event of events) {
    eventsByDevice.set(event.deviceId, [...(eventsByDevice.get(event.deviceId) ?? []), event]);
  }

  const signals: OdinReportExhibitorDeviceSignal[] = [];
  const seen = new Set<string>();

  for (const submission of submissions) {
    for (const member of submission.memberConfirmations) {
      const memberEvents = events.filter((event) => memberMatchesEvent(member, event));
      const memberDeviceIds = Array.from(new Set(memberEvents.map((event) => event.deviceId)));
      for (const deviceId of memberDeviceIds) {
        const key = `${submission.id}:${member.id}:${deviceId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const deviceEvents = [...(eventsByDevice.get(deviceId) ?? [])]
          .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
        const studentEvents = deviceEvents.filter((event) => eventStudentKey(event));
        const accountEvents = new Map<string, OdinReportDetailedEvent>();
        for (const event of studentEvents) {
          const accountKey = eventStudentKey(event);
          if (accountKey && !accountEvents.has(accountKey)) accountEvents.set(accountKey, event);
        }

        const ownProjectVotes = deviceEvents.filter((event) =>
          event.eventType === "PROJECT_VOTE"
          && event.targetType === "Submission"
          && event.targetId === submission.id
        );
        const ownProjectVoterAccounts = new Set(
          ownProjectVotes.map((event) => eventStudentKey(event) ?? event.studentNumber ?? `event:${event.id}`),
        ).size;

        const loginEvents = deviceEvents.filter((event) => event.eventType === "LOGIN_SUCCESS" && eventStudentKey(event));
        const sequence = loginEvents.length >= 2
          ? loginEvents
          : studentEvents;
        const { switches, rapidSwitches } = transitionCount(sequence);
        const accountRows = Array.from(accountEvents.values());
        const invalidOrTemporaryAccounts = accountRows.filter((event) =>
          !isOfficialStudent(event.student) || studentIntegrityFlags(event.student).length > 0
        ).length;
        const officialAccounts = accountRows.filter((event) => isOfficialStudent(event.student)).length;
        const durations = deviceLoginToVoteDurations(deviceEvents);
        const averageLoginToVoteSeconds = average(durations);
        const fastestLoginToVoteSeconds = durations.length ? Math.min(...durations) : null;
        const classified = classifyExhibitorDeviceSignal({
          distinctAccounts: accountRows.length,
          accountSwitches: switches,
          rapidAccountSwitches: rapidSwitches,
          ownProjectVotes: ownProjectVotes.length,
          ownProjectVoterAccounts,
          averageLoginToVoteSeconds,
          invalidOrTemporaryAccounts,
        });

        if (
          accountRows.length < 2
          && ownProjectVotes.length === 0
          && switches === 0
        ) {
          continue;
        }

        const firstAccount = studentEvents[0] ?? null;
        signals.push({
          submissionId: submission.id,
          submissionName: submission.name,
          memberName: member.name,
          memberStudentNumber: member.studentNumber ?? member.expectedStudentNumber ?? "Sem número associado",
          deviceId,
          firstAccountLabel: firstAccount ? personLabel(firstAccount) : "Sem primeira conta",
          distinctAccounts: accountRows.length,
          accountSwitches: switches,
          rapidAccountSwitches: rapidSwitches,
          ownProjectVotes: ownProjectVotes.length,
          ownProjectVoterAccounts,
          averageLoginToVoteSeconds,
          fastestLoginToVoteSeconds,
          invalidOrTemporaryAccounts,
          officialAccounts,
          classification: classified.classification,
          recommendation: classified.recommendation,
        });
      }
    }
  }

  return signals.sort((left, right) =>
    right.ownProjectVotes - left.ownProjectVotes
    || right.accountSwitches - left.accountSwitches
    || right.distinctAccounts - left.distinctAccounts
    || left.submissionName.localeCompare(right.submissionName)
  );
}

function buildForensicSignalsFromInvestigation(
  investigation: OdinReportInvestigationContext,
): ForensicCaseSignals[] {
  const deviceSignals = investigation.deviceIdentities.map((device) => ({
    caseId: `DEVICE:${shortId(device.deviceId, 8, 6)}`,
    entityLabel: `Dispositivo ${shortId(device.deviceId, 8, 6)}`,
    riskScore: device.contextualFraudScore,
    distinctAccounts: device.distinctAccounts,
    votes: device.rapidConversions + device.distinctAccounts,
    fragileAccounts: device.invalidOrTemporaryAccounts,
    officialAccounts: device.officialAccounts,
    medianLoginToVoteSeconds: device.averageLoginToVoteSeconds,
    fastestLoginToVoteSeconds: device.fastestLoginToVoteSeconds,
    rapidAccountSwitches: device.rapidAccountSwitches,
    dominantProjectVotes: device.rapidConversions || device.distinctAccounts,
    projectMemberDevice: false,
    rankingTop3Affected: device.contextualFraudScore >= 90 && device.distinctAccounts >= 10,
    comments: [],
  }));

  const exhibitorSignals = investigation.exhibitorDeviceSignals.map((signal) => ({
    caseId: `EXHIBITOR:${signal.submissionId}:${shortId(signal.deviceId, 6, 4)}`,
    entityLabel: `${signal.memberName} · ${signal.submissionName}`,
    riskScore: signal.ownProjectVotes >= 4 ? 82 : 64,
    distinctAccounts: signal.distinctAccounts,
    votes: signal.ownProjectVotes,
    fragileAccounts: signal.invalidOrTemporaryAccounts,
    officialAccounts: signal.officialAccounts,
    medianLoginToVoteSeconds: signal.averageLoginToVoteSeconds,
    fastestLoginToVoteSeconds: signal.fastestLoginToVoteSeconds,
    rapidAccountSwitches: signal.rapidAccountSwitches,
    dominantProjectVotes: signal.ownProjectVotes,
    projectMemberDevice: true,
    rankingTop3Affected: signal.ownProjectVotes >= 10,
    comments: [],
  }));

  return [...deviceSignals, ...exhibitorSignals];
}

export async function buildOdinReportInvestigationContext(
  from: Date,
  overview: OdinOverview,
): Promise<OdinReportInvestigationContext> {
  const invalidStudentWhere = buildInvalidStudentWhere();
  const [invalidStudentTotal, invalidStudentRows, detailedEvents] = await Promise.all([
    prisma.student.count({ where: invalidStudentWhere }),
    prisma.student.findMany({
      where: invalidStudentWhere,
      select: {
        id: true,
        studentNumber: true,
        name: true,
        email: true,
        phone: true,
        course: true,
        university: true,
        registrationSource: true,
        academicSyncedAt: true,
        profileCompletedAt: true,
        avatarUrl: true,
        deletedAt: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: {
            loginAudits: true,
            votes: true,
            comments: true,
            passportScans: true,
            submissionMemberships: true,
          },
        },
      },
      orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
      take: 60,
    }),
    prisma.odinEvent.findMany({
      where: { createdAt: { gte: from } },
      orderBy: { createdAt: "asc" },
      take: 5000,
      select: {
        id: true,
        deviceId: true,
        studentId: true,
        studentNumber: true,
        studentName: true,
        studentCourse: true,
        eventType: true,
        targetType: true,
        targetId: true,
        targetLabel: true,
        ipAddress: true,
        userAgent: true,
        riskContextJson: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            studentNumber: true,
            name: true,
            email: true,
            phone: true,
            course: true,
            university: true,
            registrationSource: true,
            academicSyncedAt: true,
            profileCompletedAt: true,
            avatarUrl: true,
            deletedAt: true,
            lastLoginAt: true,
            createdAt: true,
            _count: {
              select: {
                loginAudits: true,
                votes: true,
                comments: true,
                passportScans: true,
                submissionMemberships: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const events = detailedEvents as OdinReportDetailedEvent[];
  const deviceIdentities = buildDeviceIdentities(events, overview);
  const courseRisks = buildCourseRisks(deviceIdentities);
  const [projectInvestigations, exhibitorDeviceSignals] = await Promise.all([
    buildProjectInvestigations(overview, events, deviceIdentities),
    buildExhibitorDeviceSignals(overview, events),
  ]);

  return {
    invalidStudentTotal,
    invalidStudents: (invalidStudentRows as OdinReportStudentSource[]).map(toInvalidStudentRow),
    deviceIdentities,
    courseRisks,
    projectInvestigations,
    exhibitorDeviceSignals,
  };
}

export async function buildOdinSecurityReportSnapshot(windowHours?: number) {
  const hours = clampWindowHours(windowHours);
  const from = new Date(Date.now() - hours * 60 * 60 * 1000);
  const [events, analyses, devices] = await Promise.all([
    prisma.odinEvent.aggregate({
      where: { createdAt: { gte: from } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.odinAiAnalysis.aggregate({
      where: { createdAt: { gte: from } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.odinDevice.aggregate({
      where: { lastSeenAt: { gte: from } },
      _count: { _all: true },
      _max: { lastSeenAt: true },
    }),
  ]);

  return {
    report: reportKind,
    windowHours: hours,
    eventCount: events._count._all,
    latestEventAt: events._max.createdAt?.toISOString() ?? null,
    analysisCount: analyses._count._all,
    latestAnalysisAt: analyses._max.createdAt?.toISOString() ?? null,
    deviceCount: devices._count._all,
    latestDeviceAt: devices._max.lastSeenAt?.toISOString() ?? null,
  };
}

export async function generateOdinSecurityReportPdf(
  env: Env,
  input: { windowHours?: number } = {},
) {
  const windowHours = clampWindowHours(input.windowHours);
  const generatedAt = new Date();
  const from = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const [overview, analyses, recentEvents, logoDataUri] = await Promise.all([
    getOdinOverview(windowHours),
    prisma.odinAiAnalysis.findMany({
      where: { createdAt: { gte: from } },
      orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }],
      take: 20,
      include: { _count: { select: { feedback: true } } },
    }),
    prisma.odinEvent.findMany({
      where: { createdAt: { gte: from } },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    loadLogoDataUri(),
  ]);
  const investigation = await buildOdinReportInvestigationContext(from, overview);
  const forensicQueue = buildForensicQueue(buildForensicSignalsFromInvestigation(investigation));
  const immediateCases = forensicQueue.filter((item) => item.actionUrgency === "IMEDIATA").length;
  const cases24h = forensicQueue.filter((item) => item.actionUrgency === "24H").length;
  const waitingCases = forensicQueue.filter((item) => item.actionUrgency === "PODE_ESPERAR").length;

  const reportNumber = `ODIN-DOSSIER-${generatedAt.toISOString().slice(0, 10)}`;
  const logoMarkup = renderLogo(logoDataUri);
  const totalPages = 11;
  const globalRiskLevel = maxRiskLevel(overview);
  const html = `<!doctype html>
<html lang="pt-AO">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(reportNumber)} · Relatório de Segurança ODIN</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { color: #152434; font-family: Inter, "SF Pro Text", "Helvetica Neue", Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; padding: 14mm 18mm 12mm; position: relative; overflow: hidden; background: linear-gradient(180deg, #fffdfa 0%, #ffffff 46%, #f8fbfa 100%); page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .page::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 5mm; background: linear-gradient(90deg, #fd8305 0%, #223d42 72%, #4aa391 100%); }
  .page::after { content: ""; position: absolute; left: 18mm; right: 18mm; top: 11mm; height: 1px; background: rgba(34,61,66,.08); }
  .page-content { position: relative; z-index: 2; min-height: calc(297mm - 26mm); display: flex; flex-direction: column; }
  .border-label { position: absolute; top: 38mm; bottom: 32mm; z-index: 1; color: rgba(34,61,66,.12); font-size: 9px; font-weight: 900; letter-spacing: .22em; writing-mode: vertical-rl; text-transform: uppercase; }
  .border-label--left { left: 6mm; transform: rotate(180deg); }
  .border-label--right { right: 6mm; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; padding-top: 6mm; }
  .brand-logo { width: 43mm; max-height: 20mm; object-fit: contain; display: block; }
  .brand-fallback { font-size: 18px; font-weight: 900; color: #223d42; }
  .doc-kicker { text-align: right; color: #61707f; font-size: 10px; line-height: 1.45; }
  .doc-kicker strong { display: block; color: #152434; font-size: 12px; font-weight: 750; }
  h1, h2, h3, p { margin: 0; }
  .eyebrow { margin: 0 0 3mm; color: #fd8305; font-size: 10px; font-weight: 900; letter-spacing: 0; text-transform: uppercase; }
  .hero { margin-top: 14mm; }
  .hero h1 { max-width: 145mm; color: #152434; font-size: 27px; font-weight: 860; line-height: 1.1; }
  .lead { margin-top: 4mm; max-width: 160mm; color: #344958; font-size: 12px; line-height: 1.58; }
  .section-card { margin-top: 7mm; border: 1px solid #dbe5e3; border-radius: 4mm; padding: 4.5mm 5mm; background: #fbfdfc; break-inside: avoid; }
  .section-card h2 { color: #152434; font-size: 15px; font-weight: 850; margin-bottom: 2.5mm; }
  .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-top: 8mm; }
  .metric-grid--three { grid-template-columns: repeat(3, 1fr); }
  .metric-card { border: .3mm solid rgba(34,61,66,.08); border-radius: 4mm; padding: 4mm; background: #fff; min-height: 28mm; }
  .metric-card span { display: block; color: #61707f; font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .metric-card strong { display: block; margin-top: 1.5mm; color: #152434; font-size: 18px; font-weight: 860; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .metric-card p { margin-top: 2mm; color: #344958; font-size: 9px; line-height: 1.45; }
  .risk-pill { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; padding: 1.7mm 2.5mm; font-size: 8px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
  .risk-low { background: #f1f5f9; color: #334155; }
  .risk-medium { background: #fff7ed; color: #9a3412; }
  .risk-high { background: #ffedd5; color: #c2410c; }
  .risk-critical { background: #ffe4e6; color: #be123c; }
  .analysis-card { margin-top: 4mm; border: 1px solid #dbe5e3; border-radius: 4mm; padding: 4mm; background: #fff; break-inside: avoid; }
  .analysis-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 4mm; }
  .analysis-heading h3 { color: #152434; font-size: 14px; font-weight: 850; }
  .analysis-narrative { margin-top: 3mm; color: #344958; font-size: 10px; line-height: 1.5; }
  .probability-grid, .scenario-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 2.5mm; margin-top: 3mm; }
  .probability-grid div, .scenario-grid div, .recommendation-box { border-radius: 3mm; background: #f8fbfa; padding: 3mm; border: 1px solid rgba(34,61,66,.08); }
  .probability-grid span, .scenario-grid span, .recommendation-box span { display: block; color: #61707f; font-size: 7.5px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .probability-grid strong { display: block; margin-top: 1mm; color: #152434; font-size: 15px; font-weight: 850; }
  .scenario-grid p, .recommendation-box p { margin-top: 1mm; color: #344958; font-size: 9px; line-height: 1.45; }
  .recommendation-box { margin-top: 3mm; }
  .score-table { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 9px; }
  .score-table th { text-align: left; padding: 2.2mm 2.5mm; background: #223d42; color: #fff; font-weight: 800; font-size: 7.8px; letter-spacing: .04em; text-transform: uppercase; }
  .score-table td { padding: 2.2mm 2.5mm; border-bottom: 1px solid #e2ebe9; color: #344958; font-size: 8.6px; line-height: 1.35; vertical-align: top; }
  .score-table strong { display: block; color: #152434; font-weight: 850; }
  .score-table small { display: block; margin-top: .7mm; color: #61707f; font-size: 7.2px; }
  .number-cell { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .reason-list { margin: 2mm 0 0; padding-left: 4mm; color: #344958; font-size: 9.5px; line-height: 1.55; }
  .method-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; margin-top: 5mm; }
  .method-card { border-radius: 4mm; border: 1px solid #dbe5e3; background: #fff; padding: 3.5mm; }
  .method-card span { display: block; color: #fd8305; font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; }
  .method-card p { margin-top: 1.5mm; color: #344958; font-size: 9.5px; line-height: 1.45; }
  .intel-card { margin-top: 4mm; border: 1px solid #dbe5e3; border-radius: 4mm; padding: 4mm; background: #fff; break-inside: avoid; }
  .intel-card-head { display: flex; justify-content: space-between; gap: 4mm; align-items: flex-start; }
  .intel-card h3 { color: #152434; font-size: 13px; font-weight: 880; }
  .intel-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.5mm; margin-top: 3mm; }
  .intel-grid div { border: 1px solid rgba(34,61,66,.08); border-radius: 3mm; background: #f8fbfa; padding: 2.7mm; min-height: 18mm; }
  .intel-grid span { display: block; color: #61707f; font-size: 7.2px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .intel-grid strong { display: block; margin-top: 1mm; color: #152434; font-size: 12px; font-weight: 880; line-height: 1.15; }
  .intel-grid p, .intel-line { margin-top: 1.5mm; color: #344958; font-size: 8.6px; line-height: 1.35; }
  .course-chart { display: grid; gap: 2.4mm; margin-top: 4mm; }
  .course-chart-row { display: grid; grid-template-columns: 54mm 1fr; gap: 4mm; align-items: center; }
  .course-chart-row strong { display: block; color: #152434; font-size: 9px; font-weight: 850; }
  .course-chart-row span { display: block; margin-top: .6mm; color: #61707f; font-size: 7.4px; line-height: 1.25; }
  .course-chart-track { height: 5mm; border-radius: 999px; background: #e7efed; overflow: hidden; }
  .course-chart-track i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #fd8305, #223d42); }
  .empty-state { border: 1px dashed #dbe5e3; border-radius: 4mm; background: #fff; padding: 7mm; text-align: center; color: #344958; }
  .empty-state h3 { color: #152434; font-size: 14px; font-weight: 850; }
  .empty-state p { margin-top: 2mm; font-size: 10px; line-height: 1.55; }
  .muted { color: #61707f; font-size: 9.5px; line-height: 1.45; }
  .page-footer { margin-top: auto; padding-top: 5mm; border-top: 1px solid #dbe5e3; display: flex; justify-content: space-between; align-items: flex-end; color: #61707f; font-size: 8.5px; }
  .page-footer strong { color: #152434; }
</style>
</head>
<body>
  <!-- PAGE 1 — Capa Operacional -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Dossiê Forense ODIN")}
      <div class="hero">
        <p class="eyebrow">ODIN-DOSSIER · CONFIDENCIAL — uso interno</p>
        <h1>Relatório de Segurança ODIN</h1>
        <p class="lead">Dossiê operacional para decidir com prova, contexto e sequência de ação. O ODIN separa factos verificáveis, análise contextual e protocolo de decisão para que cada ação seja defensável depois do evento.</p>
      </div>
      <div class="metric-grid">
        ${renderMetric("Relatório", reportNumber, "Identificador do documento.")}
        ${renderMetric("Gerado em", formatDateLabel(generatedAt), "Data e hora da emissão.")}
        ${renderMetric("Janela", `${windowHours}h`, "Período analisado.")}
        ${renderMetric("Risco global", riskLabel(globalRiskLevel), "Maior nível observado.")}
      </div>
      <div class="section-card">
        <p class="eyebrow">Estado global</p>
        <h2>Triagem operacional em quatro números</h2>
        <div class="metric-grid">
          ${renderMetric("ACÇÃO IMEDIATA", immediateCases, "Casos que exigem decisão durante o evento.")}
          ${renderMetric("INVESTIGAR 24H", cases24h, "Casos que precisam de checklist ou confronto.")}
          ${renderMetric("PODE ESPERAR", waitingCases, "Casos documentados para monitorização.")}
          ${renderMetric("RESOLVIDOS HOJE", 0, "Fechos registados nesta emissão.")}
        </div>
      </div>
      <div class="section-card">
        <p class="eyebrow">Impacto no ranking</p>
        <h2>Projetos com votos sob análise</h2>
        <table class="score-table">
          <thead><tr><th>Projeto</th><th>Votos sob análise</th><th>Dispositivos</th><th>Contas</th><th>Leitura operacional</th></tr></thead>
          <tbody>${renderProjectRows(overview.projects.slice(0, 3))}</tbody>
        </table>
      </div>
      <div class="section-card">
        <p class="eyebrow">BASE DE DADOS FRÁGIL</p>
        <h2>${formatNumber(investigation.invalidStudentTotal)} contas com dados inválidos detectadas</h2>
        <p class="muted">Este problema é estrutural: não é fraude por si só, mas contamina a análise porque torna mais difícil separar estudante legítimo com perfil incompleto de conta criada para manipular votação. Ver página 8.</p>
      </div>
      ${renderFooter(reportNumber, 1, totalPages)}
    </div>
  </section>

  <!-- PAGE 2 — Fila de Triagem -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Fila de Triagem")}
      <div class="section-card">
        <p class="eyebrow">Tabela de comando</p>
        <h2>Fila de Triagem ODIN</h2>
        <p class="muted">Cada linha tem um dono operacional e um próximo passo. A fila distingue ação imediata, investigação em 24h e casos que podem esperar sem misturar prova matemática com interpretação.</p>
        <table class="score-table">
          <thead><tr><th>ID</th><th>Tipo</th><th>Urgência</th><th>Entidade principal</th><th>Votos</th><th>Impacto ranking</th><th>Próximo passo</th><th>Admin</th><th>Prazo</th></tr></thead>
          <tbody>${renderForensicQueueRows(forensicQueue)}</tbody>
        </table>
      </div>
      ${renderFooter(reportNumber, 2, totalPages)}
    </div>
  </section>

  <!-- PAGE 3 — Dossiê Individual -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Dossiê Individual")}
      ${renderForensicCaseDossier(forensicQueue)}
      ${analyses.length ? `<div class="section-card"><p class="eyebrow">Análises ODIN guardadas</p><h2>Contexto complementar</h2><p class="muted">Quando existem análises já geradas no painel, elas continuam arquivadas como apoio contextual. A prova matemática permanece separada para evitar decisões baseadas apenas em interpretação.</p></div>${renderAnalysisCards(analyses.slice(0, 2))}` : ""}
      ${renderFooter(reportNumber, 3, totalPages)}
    </div>
  </section>

  <!-- PAGE 4 — Utilizadores -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Utilizadores")}
      <div class="section-card">
        <p class="eyebrow">Utilizadores</p>
        <h2>Perfis associados a padrões suspeitos</h2>
        <table class="score-table">
          <thead><tr><th>Utilizador</th><th>Curso</th><th>Risco</th><th>Logins</th><th>Votos</th><th>Dispositivos</th><th>Motivo principal</th></tr></thead>
          <tbody>${renderStudentRows(overview.students)}</tbody>
        </table>
      </div>
      ${renderFooter(reportNumber, 4, totalPages)}
    </div>
  </section>

  <!-- PAGE 5 — Dispositivos -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Dispositivos")}
      <div class="section-card">
        <p class="eyebrow">Dispositivos</p>
        <h2>Cookies, IPs e padrões de multi-conta</h2>
        <table class="score-table">
          <thead><tr><th>Dispositivo</th><th>Risco</th><th>Contas</th><th>Logins</th><th>Votos</th><th>Projetos</th><th>Contas recentes</th><th>Motivo principal</th></tr></thead>
          <tbody>${renderDeviceRows(overview.devices)}</tbody>
        </table>
      </div>
      ${renderFooter(reportNumber, 5, totalPages)}
    </div>
  </section>

  <!-- PAGE 6 — Projetos e Eventos -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Projetos e Eventos")}
      <div class="section-card">
        <p class="eyebrow">Projetos</p>
        <h2>Projetos sob pressão suspeita</h2>
        <table class="score-table">
          <thead><tr><th>Projeto</th><th>Votos suspeitos</th><th>Dispositivos</th><th>Utilizadores</th><th>Orientação</th></tr></thead>
          <tbody>${renderProjectRows(overview.projects)}</tbody>
        </table>
      </div>
      <div class="section-card">
        <p class="eyebrow">Linha do tempo</p>
        <h2>Eventos recentes registados pelo ODIN</h2>
        <table class="score-table">
          <thead><tr><th>Data</th><th>Evento</th><th>Utilizador</th><th>Alvo</th><th>Dispositivo</th></tr></thead>
          <tbody>${renderEventRows(recentEvents)}</tbody>
        </table>
      </div>
      ${renderFooter(reportNumber, 6, totalPages)}
    </div>
  </section>

  <!-- PAGE 7 — Dossiê CIA -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Dossiê CIA")}
      <div class="section-card">
        <p class="eyebrow">Mapa de Dispositivos e Identidades</p>
        <h2>Dispositivos, cursos, primeira conta e tempo de conversão</h2>
        <p class="muted">Esta página compara o tempo normal de convencimento com o padrão de operador único: várias contas entram no mesmo aparelho, votam rapidamente no mesmo projeto e aparecem com perfis incompletos, temporários ou sem origem oficial UOR/ISPTEC.</p>
      <div class="metric-grid">
        ${renderMetric("Dados inválidos", formatNumber(investigation.invalidStudentTotal), "Contas na base com dados incompletos, temporários ou não oficiais.")}
        ${renderMetric("Dossiês", investigation.deviceIdentities.length, "Dispositivos com identidade correlacionada.")}
        ${renderMetric("Conversões rápidas", investigation.deviceIdentities.reduce((total, device) => total + device.rapidConversions, 0), "Login→voto em até 90 segundos.")}
        ${renderMetric("Expositores", investigation.exhibitorDeviceSignals.length, "Dispositivos de membros cruzados com troca de contas.")}
      </div>
        ${renderCourseRiskChart(investigation.courseRisks)}
      </div>
      ${renderDeviceIdentityCards(investigation.deviceIdentities)}
      ${renderFooter(reportNumber, 7, totalPages)}
    </div>
  </section>

  <!-- PAGE 8 — Dados inválidos -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Dados Inválidos")}
      <div class="section-card">
        <p class="eyebrow">Motor de Integridade de Dados</p>
        <h2>BASE DE DADOS FRÁGIL · Dados inválidos ou incompletos</h2>
        <p class="muted">Esta camada é separada da fraude: ela aponta falhas estruturais de cadastro que precisam de validação antes do próximo evento. Contas frágeis não são automaticamente fraude, mas reduzem a precisão de qualquer decisão.</p>
        <table class="score-table">
          <thead><tr><th>Estudante</th><th>Curso</th><th>Universidade</th><th>Origem</th><th>Falhas</th><th>Atividade</th></tr></thead>
          <tbody>${renderInvalidStudentRows(investigation.invalidStudents)}</tbody>
        </table>
      </div>
      ${renderFooter(reportNumber, 8, totalPages)}
    </div>
  </section>

  <!-- PAGE 9 — Projetos investigados -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Projetos Investigados")}
      <div class="section-card">
        <p class="eyebrow">Projetos, comentários e membros</p>
        <h2>Contexto para análise ODIN assistida</h2>
        <table class="score-table">
          <thead><tr><th>Projeto</th><th>Curso/área</th><th>Votos sob análise</th><th>Contas</th><th>Perfis frágeis</th><th>Tempo login→voto</th><th>Membros</th><th>Recomendação</th></tr></thead>
          <tbody>${renderProjectInvestigationRows(investigation.projectInvestigations)}</tbody>
        </table>
      </div>
      ${renderFooter(reportNumber, 9, totalPages)}
    </div>
  </section>

  <!-- PAGE 10 — Comentários e leitura final -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Comentários e Leitura Final")}
      <div class="section-card">
        <p class="eyebrow">Nota investigativa</p>
        <h2>Como interpretar o índice de fraude contextual</h2>
        <p class="muted">Um tempo login→voto muito curto em várias contas no mesmo dispositivo é mais compatível com alguém que já possui credenciais do que com um expositor a convencer estudantes organicamente. Ainda assim, laboratório, equipa de apoio, telemóvel emprestado ou dificuldade de acesso podem explicar parte do padrão; por isso a recomendação continua a ser revisão humana antes de invalidar votos.</p>
      </div>
      <div class="section-card">
        <p class="eyebrow">Comentários recentes</p>
        <h2>Sinais qualitativos dos projetos</h2>
        ${renderProjectCommentSignals(investigation.projectInvestigations)}
      </div>
      ${renderFooter(reportNumber, 10, totalPages)}
    </div>
  </section>

  <!-- PAGE 11 — Dispositivos de Expositores -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Dispositivos de Expositores")}
      <div class="section-card">
        <p class="eyebrow">Dispositivos associados a expositores</p>
        <h2>Telefone emprestado vs. operação de contas no próprio projeto</h2>
        <p class="muted">Esta leitura foi criada para tratar a justificativa de telefone emprestado com justiça. O ODIN compara quantas Trocas de conta ocorreram no aparelho do membro, quantos Votos para o próprio projeto saíram desse dispositivo, se as contas tinham origem oficial e o tempo login→voto. Partilha pontual não é fraude automática; padrão repetido, rápido e favorável ao próprio projeto exige revisão.</p>
        <table class="score-table">
          <thead><tr><th>Projeto</th><th>Expositor/membro</th><th>Dispositivo</th><th>Trocas de conta</th><th>Contas</th><th>Votos para o próprio projeto</th><th>Tempo login→voto</th><th>Leitura</th><th>Recomendação</th></tr></thead>
          <tbody>${renderExhibitorDeviceSignalRows(investigation.exhibitorDeviceSignals)}</tbody>
        </table>
      </div>
      ${renderFooter(reportNumber, 11, totalPages)}
    </div>
  </section>
</body>
</html>`;

  const pdfBuffer = await renderPdfFromHtml(html, {
    preferCssPageSize: true,
    displayHeaderFooter: false,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  return {
    pdfBuffer,
    fileName: `uor-connect-relatorio-seguranca-odin-${generatedAt.toISOString().slice(0, 10)}.pdf`,
  };
}

export { reportKind as ODIN_SECURITY_REPORT_KIND };

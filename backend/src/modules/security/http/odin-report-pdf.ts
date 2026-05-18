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
  modelVersion: string;
  promptVersion: string;
  createdByStudentNumber: string | null;
  createdAt: Date;
  _count?: { feedback: number };
};

type OdinReportEvent = {
  id: number;
  deviceId: string;
  studentNumber: string | null;
  studentName: string | null;
  studentCourse: string | null;
  eventType: string;
  targetType: string | null;
  targetId: number | null;
  targetLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

const reportKind = "security.odin.report";

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

function renderReasonList(reasons: string[]) {
  if (!reasons.length) return `<p class="muted">Sem motivos registados.</p>`;
  return `
    <ul class="reason-list">
      ${reasons.slice(0, 4).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
    </ul>
  `;
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

function renderSuggestions(suggestions: string[]) {
  return suggestions.map((suggestion) => `
    <div class="method-card">
      <span>Boa prática</span>
      <p>${escapeHtml(suggestion)}</p>
    </div>
  `).join("");
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

  const reportNumber = `ODIN-${generatedAt.toISOString().slice(0, 10)}`;
  const logoMarkup = renderLogo(logoDataUri);
  const totalPages = 6;
  const globalRiskLevel = maxRiskLevel(overview);
  const suspiciousDeviceCount = overview.devices.filter((device) => device.riskScore >= 40).length;
  const criticalDeviceCount = overview.devices.filter((device) => device.riskLevel === "CRITICAL").length;
  const highDeviceCount = overview.devices.filter((device) => device.riskLevel === "HIGH").length;

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
  .empty-state { border: 1px dashed #dbe5e3; border-radius: 4mm; background: #fff; padding: 7mm; text-align: center; color: #344958; }
  .empty-state h3 { color: #152434; font-size: 14px; font-weight: 850; }
  .empty-state p { margin-top: 2mm; font-size: 10px; line-height: 1.55; }
  .muted { color: #61707f; font-size: 9.5px; line-height: 1.45; }
  .page-footer { margin-top: auto; padding-top: 5mm; border-top: 1px solid #dbe5e3; display: flex; justify-content: space-between; align-items: flex-end; color: #61707f; font-size: 8.5px; }
  .page-footer strong { color: #152434; }
</style>
</head>
<body>
  <!-- PAGE 1 — Capa -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Relatório de Segurança ODIN")}
      <div class="hero">
        <p class="eyebrow">Auditoria de segurança</p>
        <h1>Relatório de Segurança ODIN</h1>
        <p class="lead">Análise administrativa de utilizadores, dispositivos, projetos sob pressão e decisões assistidas pelo ODIN. Este documento é confidencial e deve ser usado como apoio à investigação humana, não como sentença automática.</p>
      </div>
      <div class="metric-grid">
        ${renderMetric("Relatório", reportNumber, "Identificador do documento.")}
        ${renderMetric("Gerado em", formatDateLabel(generatedAt), "Data e hora da emissão.")}
        ${renderMetric("Janela", `${windowHours}h`, "Período analisado.")}
        ${renderMetric("Risco global", riskLabel(globalRiskLevel), "Maior nível observado.")}
      </div>
      <div class="section-card">
        <p class="eyebrow">Leitura rápida</p>
        <h2>Estado de segurança da votação</h2>
        <div class="metric-grid metric-grid--three">
          ${renderMetric("Eventos", formatNumber(overview.stats.totalEvents), "Logins, votos e ações ODIN.")}
          ${renderMetric("Dispositivos", formatNumber(overview.stats.deviceCount), "Cookies/dispositivos observados.")}
          ${renderMetric("Suspeitos", formatNumber(suspiciousDeviceCount), "Dispositivos acima do limiar de revisão.")}
          ${renderMetric("Contas em risco", formatNumber(overview.stats.suspectStudents), "Utilizadores ligados a padrões suspeitos.")}
          ${renderMetric("Votos sob análise", formatNumber(overview.stats.suspectVotes), "Votos associados a sinais ODIN.")}
          ${renderMetric("Projetos", formatNumber(overview.stats.projectPressureCount), "Projetos com pressão suspeita.")}
        </div>
      </div>
      ${renderFooter(reportNumber, 1, totalPages)}
    </div>
  </section>

  <!-- PAGE 2 — Resumo Executivo -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Resumo Executivo")}
      <div class="section-card">
        <p class="eyebrow">Resumo executivo</p>
        <h2>Principais sinais encontrados</h2>
        <div class="metric-grid">
          ${renderMetric("Críticos", criticalDeviceCount, "Dispositivos com risco máximo.")}
          ${renderMetric("Alto risco", highDeviceCount, "Dispositivos com forte indício.")}
          ${renderMetric("Multi-conta", overview.stats.multiAccountDevices, "Mesma cookie/dispositivo com várias contas.")}
          ${renderMetric("Análises ODIN", analyses.length, "Narrativas assistidas guardadas.")}
        </div>
        ${renderReasonList([
          ...overview.devices.flatMap((device) => device.reasons),
          ...overview.students.flatMap((student) => student.reasons),
        ].slice(0, 8))}
      </div>
      <div class="method-grid">
        ${renderSuggestions(overview.suggestions)}
      </div>
      ${renderFooter(reportNumber, 2, totalPages)}
    </div>
  </section>

  <!-- PAGE 3 — Análise ODIN -->
  <section class="page">
    ${renderBorderLabels()}
    <div class="page-content">
      ${renderHeader(logoMarkup, "Análise ODIN")}
      <div class="section-card">
        <p class="eyebrow">Motor ODIN</p>
        <h2>Análises assistidas e recomendações proporcionais</h2>
        <p class="muted">As análises abaixo são internas. O ODIN apresenta probabilidades, cenários e recomendações, mas a decisão final permanece sempre com a organização.</p>
      </div>
      ${renderAnalysisCards(analyses)}
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

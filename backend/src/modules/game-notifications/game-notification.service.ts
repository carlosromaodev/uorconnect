import type { Env } from "../../config/env";

type GameStudent = {
  id?: number | null;
  studentNumber: string;
  name?: string | null;
  course?: string | null;
  phone?: string | null;
};

type PassportNotificationKind =
  | "POINTS_GAINED"
  | "POINTS_LOST"
  | "NEGATIVE_BALANCE"
  | "PASSPORT_POINTS_GAINED"
  | "PASSPORT_POINTS_LOST"
  | "PASSPORT_NEGATIVE_BALANCE";

type ExhibitorNotificationKind =
  | "POINTS_GAINED"
  | "POINTS_LOST"
  | "EXHIBITOR_POINTS_GAINED"
  | "EXHIBITOR_POINTS_LOST";

type GameNotification = {
  title: string;
  message: string;
  eventKey:
    | "PASSPORT_POINTS_GAINED"
    | "PASSPORT_POINTS_LOST"
    | "PASSPORT_NEGATIVE_BALANCE"
    | "EXHIBITOR_POINTS_GAINED"
    | "EXHIBITOR_POINTS_LOST";
};

type GameNotificationGateEnv = Pick<Env, "GAME_NOTIFICATIONS_START_AT">;

export function shouldSendGameNotifications(env: GameNotificationGateEnv, now = new Date()) {
  const startAt = new Date(env.GAME_NOTIFICATIONS_START_AT);
  if (Number.isNaN(startAt.getTime())) return true;
  return now.getTime() >= startAt.getTime();
}

function firstName(value?: string | null) {
  return value?.trim().split(/\s+/).filter(Boolean).at(0) ?? "estudante";
}

function signedPoints(points: number) {
  return points > 0 ? `+${points}` : String(points);
}

function normalizePassportKind(kind: PassportNotificationKind): GameNotification["eventKey"] {
  if (kind === "NEGATIVE_BALANCE" || kind === "PASSPORT_NEGATIVE_BALANCE") return "PASSPORT_NEGATIVE_BALANCE";
  if (kind === "POINTS_LOST" || kind === "PASSPORT_POINTS_LOST") return "PASSPORT_POINTS_LOST";
  return "PASSPORT_POINTS_GAINED";
}

function normalizeExhibitorKind(kind: ExhibitorNotificationKind): GameNotification["eventKey"] {
  if (kind === "POINTS_LOST" || kind === "EXHIBITOR_POINTS_LOST") return "EXHIBITOR_POINTS_LOST";
  return "EXHIBITOR_POINTS_GAINED";
}

export function sanitizeGameMessage(message: string) {
  return message
    .replace(/{{\s*[a-zA-Z0-9_]+\s*}}/g, "")
    .replace(/\b(?:undefined|null)\b/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function composePassportGameNotification(input: {
  kind: PassportNotificationKind;
  studentName?: string | null;
  deltaPoints: number;
  currentPoints: number;
  qrDisplayCode?: string | null;
  hint?: string | null;
  recoveryPriceKz?: number | null;
  recoveryPoints?: number | null;
}): GameNotification {
  const eventKey = normalizePassportKind(input.kind);
  const name = firstName(input.studentName);

  if (eventKey === "PASSPORT_NEGATIVE_BALANCE") {
    const price = input.recoveryPriceKz ?? 300;
    const points = input.recoveryPoints ?? 60;
    return {
      eventKey,
      title: "Passaporte Digital: recuperar pontos",
      message: sanitizeGameMessage([
        `${name}, o teu saldo esta negativo no Passaporte Digital.`,
        `Vai a stand da UOR Connect para recarregar ate ${points} pontos por ${price} Kz com validacao da organizacao.`,
        input.hint ? `Palpite: ${input.hint}` : "Palpite: leva o teu telefone a equipa UOR Connect para recuperar antes do proximo checkpoint.",
      ].join("\n")),
    };
  }

  if (eventKey === "PASSPORT_POINTS_LOST") {
    return {
      eventKey,
      title: `Passaporte Digital: ${signedPoints(input.deltaPoints)} pontos`,
      message: sanitizeGameMessage([
        `${name}, este QR tirou ${Math.abs(input.deltaPoints)} pontos do teu Passaporte Digital.`,
        `Saldo atual: ${input.currentPoints} pontos.`,
        input.qrDisplayCode ? `Codigo escaneado: ${input.qrDisplayCode}.` : "",
        input.hint ? `Palpite: ${input.hint}` : "Ainda estas no jogo. O proximo QR pode compensar.",
      ].join("\n")),
    };
  }

  return {
    eventKey,
    title: `Passaporte Digital: +${Math.max(0, input.deltaPoints)} pontos`,
    message: sanitizeGameMessage([
      `${name}, ganhaste +${Math.max(0, input.deltaPoints)} pontos no Passaporte Digital.`,
      `Saldo atual: ${input.currentPoints} pontos.`,
      input.qrDisplayCode ? `Codigo escaneado: ${input.qrDisplayCode}.` : "",
      input.hint ? `Proxima pista: ${input.hint}` : "Continua atento aos QR numerados espalhados pela feira.",
    ].join("\n")),
  };
}

export function composeExhibitorGameNotification(input: {
  kind: ExhibitorNotificationKind;
  projectName: string;
  studentName?: string | null;
  deltaPoints: number;
  reason?: string | null;
  currentScore?: number | null;
}): GameNotification {
  const eventKey = normalizeExhibitorKind(input.kind);
  const absolute = Math.abs(input.deltaPoints);

  if (eventKey === "EXHIBITOR_POINTS_LOST") {
    return {
      eventKey,
      title: `Desafio do Expositor: -${absolute} pontos`,
      message: sanitizeGameMessage([
        `O projeto ${input.projectName} perdeu ${absolute} pontos no Desafio do Expositor.`,
        input.reason ? `Motivo: ${input.reason}.` : "",
        typeof input.currentScore === "number" ? `Pontuacao atual: ${input.currentScore} pontos.` : "",
        "A equipa pode recuperar com boas praticas, feedback qualificado e novas conversoes validas.",
      ].join("\n")),
    };
  }

  return {
    eventKey,
    title: `Desafio do Expositor: +${Math.max(0, input.deltaPoints)} pontos`,
    message: sanitizeGameMessage([
      `O projeto ${input.projectName} ganhou +${Math.max(0, input.deltaPoints)} pontos no Desafio do Expositor.`,
      input.reason ? `Origem: ${input.reason}.` : "",
      typeof input.currentScore === "number" ? `Pontuacao atual: ${input.currentScore} pontos.` : "",
      input.studentName ? `Acao ligada a ${input.studentName}.` : "",
    ].join("\n")),
  };
}

async function sendGameNotification(
  env: Env,
  student: GameStudent,
  notification: GameNotification,
) {
  if (!shouldSendGameNotifications(env)) {
    return {
      ok: false,
      skipped: true,
      reason: "GAME_NOTIFICATIONS_PAUSED",
      startAt: env.GAME_NOTIFICATIONS_START_AT,
      results: [],
    };
  }

  const [{ sendSmsAudienceAutomationEvent }, { sendWhatsAppAutomationEvent }] = await Promise.all([
    import("../sms/http/sms.routes.js"),
    import("../whatsapp/http/whatsapp.routes.js"),
  ]);
  const values = {
    titulo: notification.title,
    detalhe: notification.message,
    evento: "UOR Connect",
    pontos: notification.message,
  };

  const tasks = [
    sendWhatsAppAutomationEvent(env, notification.eventKey, {
      phone: student.phone,
      studentId: student.id,
      studentNumber: student.studentNumber,
      recipientName: student.name,
      recipientCourse: student.course,
      values,
    }),
    sendSmsAudienceAutomationEvent(env, notification.eventKey, {
      audience: {
        type: "SELECTED_STUDENTS",
        selectedStudentNumbers: [student.studentNumber],
      },
      values,
    }),
  ];

  const results = await Promise.allSettled(tasks);
  return {
    ok: results.some((result) => result.status === "fulfilled" && !isSkippedAutomationResult(result.value)),
    results,
  };
}

function isSkippedAutomationResult(value: unknown) {
  return Boolean(
    value
    && typeof value === "object"
    && "skipped" in value
    && (value as { skipped?: unknown }).skipped === true,
  );
}

export async function notifyPassportGameEvent(
  env: Env,
  input: {
    student: GameStudent;
    kind: PassportNotificationKind;
    deltaPoints: number;
    currentPoints: number;
    qrDisplayCode?: string | null;
    hint?: string | null;
  },
) {
  const kind = input.currentPoints < 0 ? "PASSPORT_NEGATIVE_BALANCE" : input.kind;
  const notification = composePassportGameNotification({
    kind,
    studentName: input.student.name,
    deltaPoints: input.deltaPoints,
    currentPoints: input.currentPoints,
    qrDisplayCode: input.qrDisplayCode,
    hint: input.hint,
  });
  return sendGameNotification(env, input.student, notification);
}

export async function notifyExhibitorGameEvent(
  env: Env,
  input: {
    student: GameStudent;
    kind: ExhibitorNotificationKind;
    projectName: string;
    deltaPoints: number;
    reason?: string | null;
    currentScore?: number | null;
  },
) {
  const notification = composeExhibitorGameNotification({
    kind: input.kind,
    projectName: input.projectName,
    studentName: input.student.name,
    deltaPoints: input.deltaPoints,
    reason: input.reason,
    currentScore: input.currentScore,
  });
  return sendGameNotification(env, input.student, notification);
}

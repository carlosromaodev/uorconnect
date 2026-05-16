import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../shared/prisma";
import type { Env } from "../../../config/env";
import { authGuard } from "../../auth/http/auth.middleware";
import { adminGuard, requireAdminPermission, setDefaultAdminPermission } from "../../auth/http/admin.middleware";
import { getCookie } from "../../../shared/cookies";
import { verifyStudentToken } from "../../auth/utils/jwt";
import { recordAdminAudit } from "../../audit/application/audit.service";

const analyticsCategoryValues = [
  "NAVIGATION",
  "ENGAGEMENT",
  "CONVERSION",
  "LIVE",
  "AUTH",
  "MARKETING",
  "FUNCTIONAL",
  "CONSENT",
  "SECURITY",
] as const;

const defaultConsentVersion = "2026.03";
const cleanupWindowMs = 1000 * 60 * 60 * 6;
const dashboardEventSampleLimit = 20_000;
const dashboardSessionSampleLimit = 10_000;
let lastCleanupAt = 0;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const consentSchema = z.object({
  essential: z.literal(true).default(true),
  analytics: z.boolean().default(false),
  functional: z.boolean().default(false),
  marketing: z.boolean().default(false),
  version: z.string().trim().min(2).max(32).default(defaultConsentVersion),
});

const eventSchema = z.object({
  type: z.string().trim().min(2).max(80),
  category: z.enum(analyticsCategoryValues),
  pageUrl: z.string().trim().max(500).nullable().optional(),
  routeName: z.string().trim().max(120).nullable().optional(),
  referrer: z.string().trim().max(500).nullable().optional(),
  elementId: z.string().trim().max(160).nullable().optional(),
  elementLabel: z.string().trim().max(200).nullable().optional(),
  duration: z.number().int().min(0).max(1000 * 60 * 60 * 8).nullable().optional(),
  scrollDepth: z.number().int().min(0).max(100).nullable().optional(),
  metadata: z.record(z.string(), jsonValueSchema).nullable().optional(),
});

const consentPayloadSchema = z.object({
  visitorId: z.string().trim().min(8).max(120).nullable().optional(),
  sessionId: z.string().trim().min(8).max(120).nullable().optional(),
  source: z.string().trim().min(2).max(40).default("banner"),
  lastVisitedPage: z.string().trim().max(500).nullable().optional(),
  lastCampaign: z.string().trim().max(160).nullable().optional(),
  consent: consentSchema,
});

const analyticsTrackSchema = z.object({
  visitorId: z.string().trim().min(8).max(120),
  sessionId: z.string().trim().min(8).max(120),
  deviceId: z.string().trim().max(120).nullable().optional(),
  pageUrl: z.string().trim().max(500).nullable().optional(),
  referrer: z.string().trim().max(500).nullable().optional(),
  utmSource: z.string().trim().max(160).nullable().optional(),
  utmMedium: z.string().trim().max(160).nullable().optional(),
  utmCampaign: z.string().trim().max(160).nullable().optional(),
  utmContent: z.string().trim().max(160).nullable().optional(),
  utmTerm: z.string().trim().max(160).nullable().optional(),
  consent: consentSchema,
  events: z.array(eventSchema).min(1).max(40),
});

const analyticsFilterSchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  course: z.string().trim().optional(),
  audience: z.enum(["all", "anonymous", "authenticated"]).default("all"),
  source: z.string().trim().optional(),
  consent: z.enum(["all", "analytics", "functional", "marketing", "essential-only"]).default("all"),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(10).max(200).default(50),
  page: z.coerce.number().int().min(1).default(1),
});

function formatDayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateRange(query: z.infer<typeof analyticsFilterSchema>) {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  defaultFrom.setHours(0, 0, 0, 0);

  const from = query.from ? new Date(query.from) : defaultFrom;
  const to = query.to ? new Date(query.to) : now;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { from: defaultFrom, to: now };
  }

  return { from, to };
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function hashIp(ip: string | undefined, env: Env) {
  return createHash("sha256")
    .update(`${env.JWT_SECRET}:${ip ?? "unknown"}`)
    .digest("hex")
    .slice(0, 24);
}

async function runAnalyticsCleanup(env: Env) {
  const now = Date.now();
  if ((now - lastCleanupAt) < cleanupWindowMs) return;
  lastCleanupAt = now;

  const cutoff = new Date(now - (env.ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000));

  await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  await prisma.analyticsSession.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });
  await prisma.consentRecord.deleteMany({ where: { createdAt: { lt: cutoff } } });
}

async function resolveAuthenticatedContext(request: FastifyRequest, env: Env) {
  const authHeader = request.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring("Bearer ".length)
    : null;
  const cookieToken = getCookie(request, "uor_auth");
  const token = cookieToken || bearerToken;

  if (!token) return null;

  try {
    const payload = verifyStudentToken(token, env);
    const [student, adminAccess] = await Promise.all([
      prisma.student.findUnique({
        where: { id: payload.sub },
        select: { id: true, studentNumber: true, name: true, course: true }
      }),
      prisma.adminAuthorizedStudent.findUnique({
        where: { studentNumber: payload.studentNumber },
        select: { id: true, isActive: true }
      })
    ]);

    if (!student) return null;

    return {
      id: student.id,
      studentNumber: student.studentNumber,
      name: student.name ?? `Estudante ${student.studentNumber}`,
      course: student.course ?? null,
      role: adminAccess?.isActive ? "admin" : "student",
    };
  } catch {
    return null;
  }
}

function allowsEventCollection(category: typeof analyticsCategoryValues[number], consent: z.infer<typeof consentSchema>) {
  if (category === "CONSENT" || category === "SECURITY") return true;
  if (category === "FUNCTIONAL") return consent.functional;
  if (category === "MARKETING") return consent.marketing;
  return consent.analytics;
}

function buildEventWhere(filter: z.infer<typeof analyticsFilterSchema>) {
  const { from, to } = parseDateRange(filter);
  const where: Prisma.AnalyticsEventWhereInput = {
    createdAt: { gte: from, lte: to }
  };

  if (filter.course && filter.course !== "all") {
    where.studentCourse = filter.course;
  }

  if (filter.audience === "anonymous") {
    where.audience = "ANONYMOUS";
  } else if (filter.audience === "authenticated") {
    where.audience = "AUTHENTICATED";
  }

  if (filter.source && filter.source !== "all") {
    where.OR = [
      { referrer: { contains: filter.source } },
      { session: { is: { utmSource: { contains: filter.source } } } },
      { session: { is: { utmCampaign: { contains: filter.source } } } }
    ];
  }

  if (filter.consent === "analytics") {
    where.session = { is: { analyticsAllowed: true } };
  } else if (filter.consent === "functional") {
    where.session = { is: { functionalAllowed: true } };
  } else if (filter.consent === "marketing") {
    where.session = { is: { marketingAllowed: true } };
  } else if (filter.consent === "essential-only") {
    where.session = { is: { analyticsAllowed: false, functionalAllowed: false, marketingAllowed: false } };
  }

  if (filter.search) {
    const searchFilter: Prisma.AnalyticsEventWhereInput = {
      OR: [
        { eventType: { contains: filter.search } },
        { pageUrl: { contains: filter.search } },
        { elementLabel: { contains: filter.search } },
        { studentName: { contains: filter.search } },
        { studentCourse: { contains: filter.search } }
      ]
    };

    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      searchFilter
    ];
  }

  return where;
}

function buildSessionWhere(filter: z.infer<typeof analyticsFilterSchema>) {
  const { from, to } = parseDateRange(filter);
  const where: Prisma.AnalyticsSessionWhereInput = {
    lastSeenAt: { gte: from, lte: to }
  };

  if (filter.course && filter.course !== "all") {
    where.studentCourse = filter.course;
  }

  if (filter.audience === "anonymous") {
    where.audience = "ANONYMOUS";
  } else if (filter.audience === "authenticated") {
    where.audience = "AUTHENTICATED";
  }

  if (filter.source && filter.source !== "all") {
    where.OR = [
      { referrer: { contains: filter.source } },
      { utmSource: { contains: filter.source } },
      { utmCampaign: { contains: filter.source } }
    ];
  }

  if (filter.consent === "analytics") {
    where.analyticsAllowed = true;
  } else if (filter.consent === "functional") {
    where.functionalAllowed = true;
  } else if (filter.consent === "marketing") {
    where.marketingAllowed = true;
  } else if (filter.consent === "essential-only") {
    where.analyticsAllowed = false;
    where.functionalAllowed = false;
    where.marketingAllowed = false;
  }

  return where;
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

export async function analyticsRoutes(app: FastifyInstance, opts: { env: Env }) {
  app.post("/consent", {
    schema: {
      body: consentPayloadSchema,
      response: { 200: z.object({ success: z.literal(true) }) }
    }
  }, async (request, reply) => {
    await runAnalyticsCleanup(opts.env);
    const payload = request.body as z.infer<typeof consentPayloadSchema>;
    const authContext = await resolveAuthenticatedContext(request, opts.env);

    await prisma.consentRecord.create({
      data: {
        visitorId: normalizeOptionalText(payload.visitorId),
        sessionId: normalizeOptionalText(payload.sessionId),
        studentId: authContext?.id ?? null,
        source: payload.source,
        consentVersion: payload.consent.version,
        essential: true,
        analytics: payload.consent.analytics,
        functional: payload.consent.functional,
        marketing: payload.consent.marketing,
        lastVisitedPage: normalizeOptionalText(payload.lastVisitedPage),
        lastCampaign: normalizeOptionalText(payload.lastCampaign)
      }
    });

    if (payload.sessionId) {
      await prisma.analyticsSession.upsert({
        where: { sessionId: payload.sessionId },
        update: {
          visitorId: payload.visitorId ?? `consent:${payload.sessionId}`,
          analyticsAllowed: payload.consent.analytics,
          functionalAllowed: payload.consent.functional,
          marketingAllowed: payload.consent.marketing,
          consentVersion: payload.consent.version,
          lastPageUrl: normalizeOptionalText(payload.lastVisitedPage),
          studentId: authContext?.id ?? null,
          studentName: authContext?.name ?? null,
          studentCourse: authContext?.course ?? null,
          userRole: authContext?.role ?? null,
          audience: authContext ? "AUTHENTICATED" : "ANONYMOUS",
          lastSeenAt: new Date()
        },
        create: {
          sessionId: payload.sessionId,
          visitorId: payload.visitorId ?? `consent:${payload.sessionId}`,
          studentId: authContext?.id ?? null,
          studentName: authContext?.name ?? null,
          studentCourse: authContext?.course ?? null,
          userRole: authContext?.role ?? null,
          audience: authContext ? "AUTHENTICATED" : "ANONYMOUS",
          analyticsAllowed: payload.consent.analytics,
          functionalAllowed: payload.consent.functional,
          marketingAllowed: payload.consent.marketing,
          consentVersion: payload.consent.version,
          lastPageUrl: normalizeOptionalText(payload.lastVisitedPage),
          entryPageUrl: normalizeOptionalText(payload.lastVisitedPage),
          lastSeenAt: new Date()
        }
      });
    }

    return reply.send({ success: true });
  });

  app.post("/track", {
    schema: {
      body: analyticsTrackSchema,
      response: {
        200: z.object({ success: z.literal(true), storedEvents: z.number().int().min(0) })
      }
    }
  }, async (request, reply) => {
    await runAnalyticsCleanup(opts.env);
    const payload = request.body as z.infer<typeof analyticsTrackSchema>;
    const authContext = await resolveAuthenticatedContext(request, opts.env);
    const audience = authContext ? "AUTHENTICATED" : "ANONYMOUS";
    const storableEvents = payload.events.filter((event) => allowsEventCollection(event.category, payload.consent));

    if (storableEvents.length === 0) {
      return reply.send({ success: true, storedEvents: 0 });
    }

    await prisma.analyticsSession.upsert({
      where: { sessionId: payload.sessionId },
      update: {
        visitorId: payload.visitorId,
        studentId: authContext?.id ?? null,
        studentName: authContext?.name ?? null,
        studentCourse: authContext?.course ?? null,
        userRole: authContext?.role ?? null,
        audience,
        lastPageUrl: normalizeOptionalText(payload.pageUrl) ?? normalizeOptionalText(storableEvents[storableEvents.length - 1]?.pageUrl),
        referrer: normalizeOptionalText(payload.referrer) ?? normalizeOptionalText(storableEvents[0]?.referrer),
        deviceId: normalizeOptionalText(payload.deviceId),
        analyticsAllowed: payload.consent.analytics,
        functionalAllowed: payload.consent.functional,
        marketingAllowed: payload.consent.marketing,
        consentVersion: payload.consent.version,
        utmSource: normalizeOptionalText(payload.utmSource),
        utmMedium: normalizeOptionalText(payload.utmMedium),
        utmCampaign: normalizeOptionalText(payload.utmCampaign),
        utmContent: normalizeOptionalText(payload.utmContent),
        utmTerm: normalizeOptionalText(payload.utmTerm),
        lastSeenAt: new Date(),
        eventCount: { increment: storableEvents.length }
      },
      create: {
        sessionId: payload.sessionId,
        visitorId: payload.visitorId,
        studentId: authContext?.id ?? null,
        studentName: authContext?.name ?? null,
        studentCourse: authContext?.course ?? null,
        userRole: authContext?.role ?? null,
        audience,
        entryPageUrl: normalizeOptionalText(payload.pageUrl) ?? normalizeOptionalText(storableEvents[0]?.pageUrl),
        lastPageUrl: normalizeOptionalText(payload.pageUrl) ?? normalizeOptionalText(storableEvents[storableEvents.length - 1]?.pageUrl),
        referrer: normalizeOptionalText(payload.referrer) ?? normalizeOptionalText(storableEvents[0]?.referrer),
        deviceId: normalizeOptionalText(payload.deviceId),
        analyticsAllowed: payload.consent.analytics,
        functionalAllowed: payload.consent.functional,
        marketingAllowed: payload.consent.marketing,
        consentVersion: payload.consent.version,
        utmSource: normalizeOptionalText(payload.utmSource),
        utmMedium: normalizeOptionalText(payload.utmMedium),
        utmCampaign: normalizeOptionalText(payload.utmCampaign),
        utmContent: normalizeOptionalText(payload.utmContent),
        utmTerm: normalizeOptionalText(payload.utmTerm),
        eventCount: storableEvents.length,
      }
    });

    await prisma.analyticsEvent.createMany({
      data: storableEvents.map((event) => ({
        visitorId: payload.visitorId,
        sessionId: payload.sessionId,
        studentId: authContext?.id ?? null,
        studentName: authContext?.name ?? null,
        studentCourse: authContext?.course ?? null,
        userRole: authContext?.role ?? null,
        audience,
        eventType: event.type,
        eventCategory: event.category,
        pageUrl: normalizeOptionalText(event.pageUrl) ?? normalizeOptionalText(payload.pageUrl),
        routeName: normalizeOptionalText(event.routeName),
        referrer: normalizeOptionalText(event.referrer) ?? normalizeOptionalText(payload.referrer),
        elementId: normalizeOptionalText(event.elementId),
        elementLabel: normalizeOptionalText(event.elementLabel),
        duration: event.duration ?? null,
        scrollDepth: event.scrollDepth ?? null,
        consentVersion: payload.consent.version,
        metadata: event.metadata ?? Prisma.JsonNull,
        ipHash: hashIp(request.ip, opts.env),
        userAgent: normalizeOptionalText(request.headers["user-agent"]),
      }))
    });

    return reply.send({ success: true, storedEvents: storableEvents.length });
  });

  app.register(async (adminApp) => {
    adminApp.register(authGuard, { env: opts.env });
    adminApp.register(adminGuard);
    setDefaultAdminPermission(adminApp, ["ANALYTICS"]);

    adminApp.get("/dashboard", {
      schema: { querystring: analyticsFilterSchema }
    }, async (request, reply) => {
      await runAnalyticsCleanup(opts.env);
      const filter = analyticsFilterSchema.parse(request.query);
      const eventWhere = buildEventWhere(filter);
      const sessionWhere = buildSessionWhere(filter);
      const { from, to } = parseDateRange(filter);
      const dayFrom = new Date();
      dayFrom.setHours(0, 0, 0, 0);

      const conversionEventTypes = [
        "course_enrollment_submitted",
        "submission_created",
        "course_ticket_download",
        "submission_ticket_download",
      ];
      const enrollmentEventTypes = ["course_enrollment_submitted", "submission_created"];

      const [
        eventsSample,
        sessionsSample,
        totalSessionsCount,
        uniqueVisitorRows,
        todayVisitorRows,
        authenticatedUserRows,
        durationAggregate,
        conversionSessionRows,
        liveSessionRows,
        ticketSharesCount,
        coursePageViewsCount,
        projectPageViewsCount,
        audienceSplitCounts,
        recentConsents,
        recentEvents
      ] = await Promise.all([
        prisma.analyticsEvent.findMany({
          where: eventWhere,
          select: {
            visitorId: true,
            sessionId: true,
            studentId: true,
            studentCourse: true,
            audience: true,
            eventType: true,
            eventCategory: true,
            pageUrl: true,
            referrer: true,
            duration: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: dashboardEventSampleLimit,
        }),
        prisma.analyticsSession.findMany({
          where: sessionWhere,
          select: {
            sessionId: true,
            visitorId: true,
            studentCourse: true,
            audience: true,
            referrer: true,
            utmSource: true,
            utmCampaign: true,
            analyticsAllowed: true,
            functionalAllowed: true,
            marketingAllowed: true,
          },
          orderBy: { lastSeenAt: "desc" },
          take: dashboardSessionSampleLimit,
        }),
        prisma.analyticsSession.count({
          where: sessionWhere,
        }),
        prisma.analyticsEvent.groupBy({
          by: ["visitorId"],
          where: eventWhere,
          _count: { _all: true },
        }),
        prisma.analyticsEvent.groupBy({
          by: ["visitorId"],
          where: { AND: [eventWhere, { createdAt: { gte: dayFrom, lte: to } }] },
          _count: { _all: true },
        }),
        prisma.analyticsEvent.groupBy({
          by: ["studentId"],
          where: { AND: [eventWhere, { studentId: { not: null } }] },
          _count: { _all: true },
        }),
        prisma.analyticsEvent.aggregate({
          where: eventWhere,
          _avg: { duration: true },
        }),
        prisma.analyticsEvent.groupBy({
          by: ["sessionId"],
          where: { AND: [eventWhere, { eventType: { in: conversionEventTypes } }] },
          _count: { _all: true },
        }),
        prisma.analyticsEvent.groupBy({
          by: ["sessionId"],
          where: { AND: [eventWhere, { eventCategory: "LIVE" }] },
          _count: { _all: true },
        }),
        prisma.analyticsEvent.count({
          where: { AND: [eventWhere, { eventType: { in: ["ticket_share", "project_share"] } }] },
        }),
        prisma.analyticsEvent.count({
          where: { AND: [eventWhere, { pageUrl: { contains: "/cursos" } }] },
        }),
        prisma.analyticsEvent.count({
          where: { AND: [eventWhere, { pageUrl: { contains: "/projeto/" } }] },
        }),
        prisma.analyticsSession.groupBy({
          by: ["audience"],
          where: sessionWhere,
          _count: { _all: true },
        }),
        prisma.consentRecord.findMany({
          where: { createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: "desc" },
          take: 200
        }),
        prisma.analyticsEvent.findMany({
          where: eventWhere,
          orderBy: { createdAt: "desc" },
          take: 14,
          select: {
            id: true,
            createdAt: true,
            eventType: true,
            eventCategory: true,
            pageUrl: true,
            audience: true,
            studentName: true,
            studentCourse: true,
            elementLabel: true,
            referrer: true,
          }
        })
      ]);

      const events = [...eventsSample].reverse();
      const sessions = sessionsSample;
      const sampled = eventsSample.length >= dashboardEventSampleLimit || sessionsSample.length >= dashboardSessionSampleLimit;

      const totalSessions = totalSessionsCount;
      const totalVisitors = uniqueVisitorRows.length;
      const visitorsToday = todayVisitorRows.length;
      const authenticatedUsers = authenticatedUserRows.length;
      const averageSessionDuration = totalSessions > 0
        ? Math.round((durationAggregate._avg.duration ?? 0) / 1000)
        : 0;
      const conversionSessions = conversionSessionRows.length;
      const conversionSessionIds = new Set(
        events
          .filter((event) => enrollmentEventTypes.includes(event.eventType))
          .map((event) => event.sessionId)
      );
      const conversionRate = totalSessions > 0 ? Number(((conversionSessions / totalSessions) * 100).toFixed(1)) : 0;
      const liveEngagement = totalSessions > 0
        ? Number(((liveSessionRows.length / totalSessions) * 100).toFixed(1))
        : 0;
      const ticketShares = ticketSharesCount;
      const coursePageViews = coursePageViewsCount;
      const projectPageViews = projectPageViewsCount;

      const byDay = new Map<string, { visitors: Set<string>; sessions: Set<string>; conversions: Set<string> }>();
      const topPagesMap = new Map<string, number>();
      const topEventsMap = new Map<string, number>();
      const topCourseMap = new Map<string, number>();
      const funnel = {
        landing: new Set<string>(),
        ticket: new Set<string>(),
        login: new Set<string>(),
        enroll: new Set<string>(),
        pdf: new Set<string>(),
        community: new Set<string>(),
      };

      for (const event of events) {
        const dayKey = formatDayKey(event.createdAt);
        const entry = byDay.get(dayKey) ?? { visitors: new Set<string>(), sessions: new Set<string>(), conversions: new Set<string>() };
        entry.visitors.add(event.visitorId);
        entry.sessions.add(event.sessionId);
        if (["course_enrollment_submitted", "submission_created"].includes(event.eventType)) {
          entry.conversions.add(event.sessionId);
        }
        byDay.set(dayKey, entry);

        const pageKey = event.pageUrl || event.referrer || "Sem página";
        topPagesMap.set(pageKey, (topPagesMap.get(pageKey) ?? 0) + 1);
        topEventsMap.set(event.eventType, (topEventsMap.get(event.eventType) ?? 0) + 1);

        if (event.studentCourse) {
          topCourseMap.set(event.studentCourse, (topCourseMap.get(event.studentCourse) ?? 0) + 1);
        }

        if (event.eventType === "page_view") funnel.landing.add(event.sessionId);
        if (event.eventType.includes("ticket")) funnel.ticket.add(event.sessionId);
        if (event.eventType === "auth_login_success") funnel.login.add(event.sessionId);
        if (event.eventType === "course_enrollment_submitted" || event.eventType === "submission_created") funnel.enroll.add(event.sessionId);
        if (event.eventType === "course_ticket_download" || event.eventType === "submission_ticket_download") funnel.pdf.add(event.sessionId);
        if (event.eventType === "whatsapp_open" || event.eventType === "community_open") funnel.community.add(event.sessionId);
      }

      const campaignMap = new Map<string, { sessions: number; conversions: number }>();
      for (const session of sessions) {
        const label = session.utmCampaign || session.utmSource || "Orgânico";
        const entry = campaignMap.get(label) ?? { sessions: 0, conversions: 0 };
        entry.sessions += 1;
        if (conversionSessionIds.has(session.sessionId)) {
          entry.conversions += 1;
        }
        campaignMap.set(label, entry);
      }

      const courseOptions = Array.from(new Set([
        ...sessions.map((session) => session.studentCourse).filter(Boolean),
        ...events.map((event) => event.studentCourse).filter(Boolean)
      ])).sort();

      return reply.send({
        filters: {
          from: from.toISOString(),
          to: to.toISOString(),
          course: filter.course ?? "all",
          audience: filter.audience,
          source: filter.source ?? "all",
          consent: filter.consent,
        },
        kpis: {
          visitorsToday,
          uniqueVisitors: totalVisitors,
          uniqueSessions: totalSessions,
          authenticatedUsers,
          averageSessionDurationSeconds: averageSessionDuration,
          conversionRate,
          liveEngagementRate: liveEngagement,
          ticketShares,
          coursePageViews,
          projectPageViews,
        },
        charts: {
          visitorsByDay: Array.from(byDay.entries()).map(([date, entry]) => ({
            date,
            visitors: entry.visitors.size,
            sessions: entry.sessions.size,
            conversions: entry.conversions.size,
          })),
          conversionFunnel: [
            { step: "Visitou", value: funnel.landing.size },
            { step: "Viu ticket", value: funnel.ticket.size },
            { step: "Fez login", value: funnel.login.size },
            { step: "Inscreveu-se", value: funnel.enroll.size },
            { step: "Baixou PDF", value: funnel.pdf.size },
            { step: "Abriu comunidade", value: funnel.community.size },
          ],
          topPages: Array.from(topPagesMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value })),
          topEvents: Array.from(topEventsMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value })),
          audienceSplit: [
            { label: "Anónimo", value: audienceSplitCounts.find((entry) => entry.audience === "ANONYMOUS")?._count._all ?? 0 },
            { label: "Autenticado", value: audienceSplitCounts.find((entry) => entry.audience === "AUTHENTICATED")?._count._all ?? 0 },
          ],
          topCourses: Array.from(topCourseMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })),
        },
        logistics: {
          expectedOccupancySignal: events.filter((event) => event.eventType === "course_interest_click").length + events.filter((event) => event.eventType === "course_registration_view").length,
          ticketInfluenceVisits: events.filter((event) => event.referrer?.includes("ticket") || event.eventType === "ticket_share").length,
          whatsappClicks: events.filter((event) => event.eventType === "whatsapp_open").length,
        },
        marketing: Array.from(campaignMap.entries()).map(([campaign, data]) => ({
          campaign,
          sessions: data.sessions,
          conversions: data.conversions,
          conversionRate: data.sessions > 0 ? Number(((data.conversions / data.sessions) * 100).toFixed(1)) : 0
        })).sort((a, b) => b.sessions - a.sessions),
        consent: {
          analytics: recentConsents.filter((record) => record.analytics).length,
          functional: recentConsents.filter((record) => record.functional).length,
          marketing: recentConsents.filter((record) => record.marketing).length,
          essentialOnly: recentConsents.filter((record) => !record.analytics && !record.functional && !record.marketing).length,
        },
        recentEvents,
        courseOptions,
        sampled,
      });
    });

    adminApp.get("/events", {
      schema: { querystring: analyticsFilterSchema }
    }, async (request, reply) => {
      const filter = analyticsFilterSchema.parse(request.query);
      const where = buildEventWhere(filter);
      const skip = (filter.page - 1) * filter.limit;

      const [items, total] = await Promise.all([
        prisma.analyticsEvent.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: filter.limit,
          select: {
            id: true,
            createdAt: true,
            eventType: true,
            eventCategory: true,
            pageUrl: true,
            audience: true,
            studentName: true,
            studentCourse: true,
            userRole: true,
            referrer: true,
            elementLabel: true,
            duration: true,
            scrollDepth: true,
          }
        }),
        prisma.analyticsEvent.count({ where })
      ]);

      return reply.send({
        items,
        total,
        page: filter.page,
        totalPages: Math.max(1, Math.ceil(total / filter.limit))
      });
    });

    adminApp.get("/events/export.csv", {
      config: requireAdminPermission(["DATA_EXPORT"]),
      schema: {
        querystring: analyticsFilterSchema.omit({ limit: true, page: true }).extend({
          limit: z.coerce.number().int().min(100).max(5000).default(1000)
        })
      }
    }, async (request, reply) => {
      const exportSchema = analyticsFilterSchema.omit({ page: true }).extend({
        limit: z.coerce.number().int().min(100).max(5000).default(1000)
      });
      const filter = exportSchema.parse(request.query);
      const where = buildEventWhere({ ...filter, page: 1 });

      const items = await prisma.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filter.limit,
        select: {
          createdAt: true,
          eventType: true,
          eventCategory: true,
          pageUrl: true,
          audience: true,
          studentName: true,
          studentCourse: true,
          userRole: true,
          referrer: true,
          elementLabel: true,
          duration: true,
          scrollDepth: true,
        }
      });

      const header = ["createdAt", "eventType", "eventCategory", "pageUrl", "audience", "studentName", "studentCourse", "userRole", "referrer", "elementLabel", "duration", "scrollDepth"];
      const rows = items.map((item) => [
        item.createdAt.toISOString(),
        item.eventType,
        item.eventCategory,
        item.pageUrl ?? "",
        item.audience,
        item.studentName ?? "",
        item.studentCourse ?? "",
        item.userRole ?? "",
        item.referrer ?? "",
        item.elementLabel ?? "",
        item.duration ?? "",
        item.scrollDepth ?? "",
      ].map(csvEscape).join(","));

      await recordAdminAudit({
        actorStudentNumber: request.student?.studentNumber ?? request.jury?.phone ?? "unknown",
        actorRole: request.jury ? "jury_admin" : "admin",
        action: "data_export.analytics_events_csv",
        entityType: "AnalyticsEvent",
        summary: `Exportação CSV de analytics com ${items.length} evento(s).`,
        metadata: {
          count: items.length,
          filters: filter,
        },
      });

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="uor-connect-analytics-${new Date().toISOString().slice(0, 10)}.csv"`);
      return reply.send([header.join(","), ...rows].join("\n"));
    });
  });
}

import type { FastifyInstance } from "fastify";
import { healthRoutes } from "./system/health.route";
import { type Env } from "../../config/env";
import type { AppDependencies } from "../../app";
import { submissionRoutes } from "../../modules/submission/http/submission.routes";
import { agendaRoutes } from "../../modules/agenda/http/agenda.routes";
import { speakerRoutes } from "../../modules/speaker/http/speaker.routes";
import { statsRoutes } from "../../modules/stats/http/stats.routes";
import { authRoutes } from "../../modules/auth/http/auth.routes";
import { interactionsRoutes } from "../../modules/interactions/http/interactions.routes";
import { faqRoutes } from "../../modules/faq/http/faq.routes";
import { guideRoutes } from "../../modules/guide/http/guide.routes";
import { homeContentRoutes } from "../../modules/home-content/http/home-content.routes";
import { coursesRoutes } from "../../modules/courses/http/courses.routes";
import { reportsRoutes } from "../../modules/reports/http/reports.routes";
import { analyticsRoutes } from "../../modules/analytics/http/analytics.routes";
import { smsRoutes } from "../../modules/sms/http/sms.routes";
import { whatsappRoutes } from "../../modules/whatsapp/http/whatsapp.routes";
import { attendanceRoutes } from "../../modules/attendance/http/attendance.routes";
import { certificatesRoutes } from "../../modules/certificates/http/certificates.routes";
import { validationRoutes } from "../../modules/validation/http/validation.routes";
import { auditRoutes } from "../../modules/audit/http/audit.routes";
import { teamCredentialsRoutes } from "../../modules/team-credentials/http/team-credentials.routes";
import { adminTasksRoutes } from "../../modules/admin-tasks/http/admin-tasks.routes";
import { mediaRoutes } from "../../modules/media/http/media.routes";
import { passportRoutes } from "../../modules/passport/http/passport.routes";
import { trainersRoutes } from "../../modules/trainers/http/trainers.routes";
import { odinRoutes } from "../../modules/security/http/odin.routes";

const DEFAULT_PUBLIC_APP_URL = "http://localhost:8082";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isApiLikePublicUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.startsWith("api.") || url.pathname.startsWith("/api");
  } catch {
    return true;
  }
}

function getPublicAppUrl(env: Env) {
  const configuredAppUrl = env.PUBLIC_APP_URL && !isApiLikePublicUrl(env.PUBLIC_APP_URL)
    ? env.PUBLIC_APP_URL
    : null;
  const corsAppUrl = env.CORS_ORIGIN
    .split(",")
    .map((item) => item.trim())
    .find((item) => item.startsWith("http") && !isApiLikePublicUrl(item));

  return stripTrailingSlash(configuredAppUrl ?? corsAppUrl ?? DEFAULT_PUBLIC_APP_URL);
}

export function registerRoutes(app: FastifyInstance, env: Env, deps?: AppDependencies) {
  // Basic landing route so hitting "/" does not 404
  app.get("/", async () => ({ status: "ok" }));

  // Compatibility redirect for invitation links accidentally opened on the API host.
  app.get<{ Params: { token: string } }>("/equipa/credencial/:token", async (request, reply) => {
    return reply.redirect(`${getPublicAppUrl(env)}/equipa/credencial/${encodeURIComponent(request.params.token)}`);
  });

  app.register(healthRoutes, { prefix: "/health" });
  app.register(authRoutes, { prefix: "/auth", env });
  app.register(submissionRoutes, { prefix: "/submissions", env });
  app.register(agendaRoutes, { prefix: "/agenda", env });
  app.register(speakerRoutes, { prefix: "/speakers", env });
  app.register(statsRoutes, { prefix: "/stats" });
  app.register(interactionsRoutes, { prefix: "/interactions", env });
  app.register(faqRoutes, { prefix: "/faq", env });
  app.register(guideRoutes, { prefix: "/guide", env });
  app.register(homeContentRoutes, { prefix: "/home-content", env });
  app.register(coursesRoutes, { prefix: "/courses", env });
  app.register(reportsRoutes, { prefix: "/reports", env });
  app.register(analyticsRoutes, { prefix: "/analytics", env });
  app.register(smsRoutes, { prefix: "/sms", env });
  app.register(whatsappRoutes, { prefix: "/whatsapp", env });
  app.register(attendanceRoutes, { prefix: "/attendance", env });
  app.register(certificatesRoutes, { prefix: "/certificates", env });
  app.register(validationRoutes, { prefix: "/validation", env });
  app.register(auditRoutes, { prefix: "/audit", env });
  app.register(mediaRoutes, { prefix: "/media", env });
  app.register(passportRoutes, { prefix: "/passport", env });
  app.register(odinRoutes, { prefix: "/security", env });
  app.register(trainersRoutes, { prefix: "/trainers", env });
  app.register(teamCredentialsRoutes, { prefix: "/team-credentials", env });
  app.register(adminTasksRoutes, { prefix: "/admin-tasks", env });
}

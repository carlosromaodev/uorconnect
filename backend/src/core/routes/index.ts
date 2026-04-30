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
import { contestAuthRoutes } from "../../modules/contest/http/contest-auth.routes";
import { contestAdminRoutes } from "../../modules/contest/http/contest-admin.routes";
import { smsRoutes } from "../../modules/sms/http/sms.routes";
import { whatsappRoutes } from "../../modules/whatsapp/http/whatsapp.routes";
import { attendanceRoutes } from "../../modules/attendance/http/attendance.routes";
import { certificatesRoutes } from "../../modules/certificates/http/certificates.routes";
import { validationRoutes } from "../../modules/validation/http/validation.routes";
import { auditRoutes } from "../../modules/audit/http/audit.routes";

export function registerRoutes(app: FastifyInstance, env: Env, deps?: AppDependencies) {
  // Basic landing route so hitting "/" does not 404
  app.get("/", async () => ({ status: "ok" }));

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
  app.register(contestAuthRoutes, { prefix: "/contest", env });
  app.register(contestAdminRoutes, { prefix: "/contest", env });
}

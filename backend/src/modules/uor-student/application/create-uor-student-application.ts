import type { MoodleApplication } from "../../moodle/application/ports";
import type { SecretariaApplication } from "../../secretaria/application/secretaria.application";
import { PrismaUorStudentReadRepository } from "../infra/prisma-uor-student-read.repository";
import { PrismaUorStudentSyncJobRepository } from "../sync/prisma-uor-student-sync-job.repository";
import { PrismaUorStudentRefreshCandidateSource } from "../sync/prisma-uor-student-refresh-candidate.source";
import { UorStudentSyncWorker } from "../sync/uor-student-sync-worker";
import { PrismaUorStudentIdentityRepository } from "../identity/prisma-uor-student-identity.repository";
import { PrismaUorStudentOfficialDataRepository } from "../academics/prisma-uor-student-official-data.repository";
import { LiveUorStudentAcademicApplication } from "../academics/academic-service";
import { PrismaUorStudentAcademicRepository } from "../academics/prisma-uor-student-academic.repository";
import { PrismaUorStudentWorkflowRepository } from "../workflows/prisma-uor-student-workflow.repository";
import { LiveUorStudentWorkflowApplication } from "../workflows/workflow-service";
import { LiveUorStudentApplication } from "./live-uor-student.application";
import type { UorStudentApplication } from "./ports";
import type { Env } from "../../../config/env";
import { LiveUorStudentAuthorizationApplication, OmbalaUorStudentOtpDelivery } from "../authorizations/authorization-service";
import { LiveUorStudentRankingApplication } from "../rankings/ranking-service";
import { UorStudentExternalWriteApplication } from "../external-writes/external-write-service";
import { LiveUorStudentAcademicInsights } from "../academics/academic-insights";
import { UorStudentLearningApplication } from "../learning/learning-service";
import { UorStudentAdminApplication } from "../admin/admin-service";
import { UorStudentDelegatedFinanceApplication } from "../finance/delegated-finance-service";
import { UorStudentStepUpApplication } from "../security/step-up-service";
import { UorStudentOfficialChangeApplication } from "../sync/official-change-service";
import { PrismaUorStudentPublicIdentityResolver } from "../identity/prisma-uor-student-public-identity.resolver";

export function createUorStudentApplication(options: {
  secretaria: SecretariaApplication;
  moodle: MoodleApplication;
  cursorSecret: string;
  env: Env;
  override?: UorStudentApplication;
}) {
  if (options.override) return options.override;
  const changes = new UorStudentOfficialChangeApplication();
  const syncScheduler = new UorStudentSyncWorker(
    new PrismaUorStudentSyncJobRepository(),
    options.secretaria,
    options.moodle,
    {
      enabled: options.env.SECRETARIA_INTEGRATION_ENABLED || options.env.MOODLE_INTEGRATION_ENABLED,
      refreshSource: new PrismaUorStudentRefreshCandidateSource(),
      changeProcessor: changes,
    },
  );
  const officialData = new PrismaUorStudentOfficialDataRepository(options.cursorSecret);
  const academics = new LiveUorStudentAcademicApplication(
    officialData,
    new PrismaUorStudentAcademicRepository(),
  );
  const identities = new PrismaUorStudentPublicIdentityResolver();
  const workflows = new LiveUorStudentWorkflowApplication(new PrismaUorStudentWorkflowRepository(), officialData, identities);
  const authorizations = new LiveUorStudentAuthorizationApplication(options.cursorSecret, new OmbalaUorStudentOtpDelivery(options.env));
  const stepUp = new UorStudentStepUpApplication(options.cursorSecret, new OmbalaUorStudentOtpDelivery(options.env));
  return new LiveUorStudentApplication(
    new PrismaUorStudentReadRepository(),
    options.secretaria,
    options.moodle,
    syncScheduler,
    new PrismaUorStudentIdentityRepository(),
    officialData,
    academics,
    workflows,
    authorizations,
    new LiveUorStudentRankingApplication(academics),
    new UorStudentExternalWriteApplication(options.secretaria),
    new LiveUorStudentAcademicInsights(officialData, workflows),
    new UorStudentLearningApplication(options.moodle),
    new UorStudentAdminApplication(options.cursorSecret, new OmbalaUorStudentOtpDelivery(options.env)),
    new UorStudentDelegatedFinanceApplication(authorizations, officialData, identities),
    stepUp,
    changes,
  );
}

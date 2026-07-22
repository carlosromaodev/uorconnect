import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@uor/moodle-test-prisma";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SecretariaGateway } from "../domain/gateway";
import { SecretariaCryptoKeyring } from "../infra/secretaria-crypto";
import { LiveSecretariaApplication } from "./secretaria.application";

let directory = "";
let database: PrismaClient;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "uor-secretaria-command-"));
  database = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${join(directory, "test.db")}` }) });
  const statements = [
    `CREATE TABLE "Student" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT)`,
    `CREATE TABLE "SecretariaConnection" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "studentId" INTEGER NOT NULL UNIQUE,
      "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
      "upstreamStudentNumber" TEXT,
      "displayName" TEXT,
      "credentialsEnvelope" TEXT,
      "sessionEnvelope" TEXT,
      "connectionGeneration" INTEGER NOT NULL DEFAULT 0,
      "sessionVersion" INTEGER NOT NULL DEFAULT 0,
      "activeSnapshotVersion" INTEGER,
      "lastAuthenticatedAt" DATETIME,
      "lastSuccessfulSyncAt" DATETIME,
      "lastUsedAt" DATETIME,
      "lastErrorCode" TEXT,
      "failedReauthCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE
    )`,
    `CREATE TABLE "SecretariaCommand" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "studentId" INTEGER NOT NULL,
      "type" TEXT NOT NULL,
      "risk" TEXT NOT NULL DEFAULT 'MEDIUM',
      "status" TEXT NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
      "idempotencyKey" TEXT NOT NULL,
      "requestHash" TEXT NOT NULL,
      "payloadEnvelope" TEXT NOT NULL,
      "connectionGeneration" INTEGER NOT NULL,
      "resultEnvelope" TEXT,
      "errorCode" TEXT,
      "confirmationExpiresAt" DATETIME,
      "submittedAt" DATETIME,
      "leaseUntil" DATETIME,
      "completedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX "SecretariaCommand_studentId_type_idempotencyKey_key" ON "SecretariaCommand"("studentId", "type", "idempotencyKey")`,
    `CREATE TABLE "SecretariaCommandAttempt" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "commandId" TEXT NOT NULL,
      "attempt" INTEGER NOT NULL,
      "status" TEXT NOT NULL,
      "requestHash" TEXT NOT NULL,
      "responseHash" TEXT,
      "errorCode" TEXT,
      "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "finishedAt" DATETIME,
      FOREIGN KEY ("commandId") REFERENCES "SecretariaCommand"("id") ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX "SecretariaCommandAttempt_commandId_attempt_key" ON "SecretariaCommandAttempt"("commandId", "attempt")`,
  ];
  for (const statement of statements) await database.$executeRawUnsafe(statement);
  await database.$executeRawUnsafe(`INSERT INTO "Student" ("id") VALUES (1)`);
});

afterAll(async () => {
  await database?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe("Secretaria command persistence", () => {
  it("persiste antes da escrita, deduplica e cifra payload/resultado", async () => {
    const gateway: SecretariaGateway = {
      authenticate: vi.fn(async () => ({
        session: { cookies: { session: "opaque" }, authenticatedAt: "2026-07-21T20:00:00.000Z" },
        profile: { studentNumber: "20240001", displayName: "Estudante Teste", email: null, course: null, birthDate: null, nationality: null, phone: null },
      })),
      validateSession: vi.fn(async () => true),
      getProfile: vi.fn(),
      getContactDetails: vi.fn(),
      getPhoto: vi.fn(),
      getConsents: vi.fn(),
      getDataset: vi.fn(),
      getPaymentReferenceDocument: vi.fn(),
      getReceipt: vi.fn(),
      prepareContactDetails: vi.fn(async (_session, patch) => ({ patch, preconditionHash: "contact-precondition-hash" })),
      updateContactDetails: vi.fn(async () => ({ items: [{ outcome: "CHANGE_REQUEST_SUBMITTED", changedFields: ["mobile"] }], observedAt: "2026-07-21T20:02:00.000Z" })),
      prepareContactDetailsCancellation: vi.fn(async () => ({ preconditionHash: "contact-precondition-hash" })),
      cancelContactDetailsChangeRequest: vi.fn(async () => ({ items: [{ outcome: "CONTACT_CHANGE_REQUEST_CANCELLED" }], observedAt: "2026-07-21T20:02:30.000Z" })),
      preparePhoto: vi.fn(async () => ({ preconditionHash: "photo-precondition-hash" })),
      updatePhoto: vi.fn(async (_session, jpeg) => ({ items: [{ outcome: "PHOTO_CHANGE_REQUEST_SUBMITTED", sha256: createHash("sha256").update(jpeg).digest("hex"), contentType: "image/jpeg", size: jpeg.length }], observedAt: "2026-07-21T20:03:00.000Z" })),
      prepareExamRegistrationCancellation: vi.fn(async (_session, registrationRef) => ({ registrationRef, preconditionHash: "exam-precondition-hash" })),
      cancelExamRegistration: vi.fn(async (_session, cancellation) => ({ items: [{ outcome: "EXAM_REGISTRATION_CANCELLED", registrationRef: cancellation.registrationRef }], observedAt: "2026-07-22T09:00:00.000Z" })),
      verifyExamRegistrationCancellation: vi.fn(),
      prepareGradeReview: vi.fn(async (_session, reviewRef, operation, justification) => ({ reviewRef, operation, justification, preconditionHash: "grade-review-precondition-hash" })),
      submitGradeReview: vi.fn(async (_session, submission) => ({ items: [{ outcome: "GRADE_REVIEW_SUBMITTED", reviewRef: submission.reviewRef, state: "Em Validação", requestNumber: "TEST" }], observedAt: "2026-07-22T10:00:00.000Z" })),
      verifyGradeReview: vi.fn(),
      preparePaymentReference: vi.fn(async (_session, chargeRefs) => ({ chargeRefs })),
      generatePaymentReference: vi.fn(async () => ({ items: [{ reference: "REFERENCE-SECRET" }], observedAt: "2026-07-21T20:01:00.000Z" })),
      verifyPaymentReference: vi.fn(),
      logout: vi.fn(),
    };
    const keyring = SecretariaCryptoKeyring.fromConfig("v1", `v1:${randomBytes(32).toString("base64")}`);
    const application = new LiveSecretariaApplication(gateway, keyring, {
      paymentReferenceEnabled: true,
      contactDetailsEnabled: true,
      photoEnabled: true,
      examRegistrationCancelEnabled: true,
      gradeReviewEnabled: true,
      confirmationTtlSeconds: 300,
      commandLeaseSeconds: 300,
    }, database as never);
    const student = { id: 1, studentNumber: "20240001" };
    const chargeRef = `scr_${"a".repeat(43)}`;

    await application.connect(student, { username: "20240001", password: "runtime-only", rememberCredentials: true });
    const prepared = await application.preparePaymentReference(student, [chargeRef], "payment-reference-001");
    expect(prepared.status).toBe("AWAITING_CONFIRMATION");
    expect(await application.preparePaymentReference(student, [chargeRef], "payment-reference-001")).toEqual(prepared);
    expect(gateway.preparePaymentReference).toHaveBeenCalledTimes(1);
    await expect(application.preparePaymentReference(student, [`scr_${"b".repeat(43)}`], "payment-reference-001"))
      .rejects.toMatchObject({ code: "SECRETARIA_IDEMPOTENCY_CONFLICT" });

    const storedBefore = await database.secretariaCommand.findUniqueOrThrow({ where: { id: prepared.id } });
    expect(storedBefore.status).toBe("AWAITING_CONFIRMATION");
    expect(storedBefore.payloadEnvelope).not.toContain(chargeRef);
    expect(storedBefore.resultEnvelope).toBeNull();

    const succeeded = await application.confirmCommand(student, prepared.id);
    expect(succeeded.status).toBe("SUCCEEDED");
    expect(succeeded.result?.items[0]).toEqual({ reference: "REFERENCE-SECRET" });
    expect((await application.confirmCommand(student, prepared.id)).status).toBe("SUCCEEDED");
    expect(gateway.generatePaymentReference).toHaveBeenCalledTimes(1);

    const storedAfter = await database.secretariaCommand.findUniqueOrThrow({ where: { id: prepared.id } });
    expect(storedAfter.resultEnvelope).toBeTruthy();
    expect(storedAfter.resultEnvelope).not.toContain("REFERENCE-SECRET");
    expect(await application.getCommandAttempts(student, prepared.id)).toHaveLength(1);
    expect((await application.getCommand(student, prepared.id)).result?.items[0]).toEqual({ reference: "REFERENCE-SECRET" });

    const contact = await application.prepareContactDetails(student, { mobile: "+244 900 000 000" }, "contact-details-001");
    expect(contact).toMatchObject({ type: "UPDATE_CONTACT_DETAILS", status: "AWAITING_CONFIRMATION" });
    await expect(application.confirmCommand(student, contact.id, "GENERATE_PAYMENT_REFERENCE"))
      .rejects.toMatchObject({ code: "SECRETARIA_COMMAND_STATE_INVALID" });
    const contactSucceeded = await application.confirmCommand(student, contact.id, "UPDATE_CONTACT_DETAILS");
    expect(contactSucceeded).toMatchObject({
      type: "UPDATE_CONTACT_DETAILS",
      status: "SUCCEEDED",
      result: { items: [{ outcome: "CHANGE_REQUEST_SUBMITTED", changedFields: ["mobile"] }] },
    });
    expect(gateway.updateContactDetails).toHaveBeenCalledTimes(1);

    const contactCancellation = await application.prepareContactDetailsCancellation(student, "contact-cancel-001");
    expect(contactCancellation).toMatchObject({ type: "CANCEL_CONTACT_CHANGE_REQUEST", status: "AWAITING_CONFIRMATION" });
    const contactCancellationSucceeded = await application.confirmCommand(student, contactCancellation.id, "CANCEL_CONTACT_CHANGE_REQUEST");
    expect(contactCancellationSucceeded).toMatchObject({
      type: "CANCEL_CONTACT_CHANGE_REQUEST",
      status: "SUCCEEDED",
      result: { items: [{ outcome: "CONTACT_CHANGE_REQUEST_CANCELLED" }] },
    });
    expect(gateway.cancelContactDetailsChangeRequest).toHaveBeenCalledTimes(1);

    const photoBody = Buffer.alloc(128, 1);
    const photoHash = createHash("sha256").update(photoBody).digest("hex");
    const photo = await application.preparePhoto(student, { body: photoBody, sha256: photoHash, width: 128, height: 128 }, "photo-001");
    expect(photo).toMatchObject({ type: "UPDATE_PHOTO", status: "AWAITING_CONFIRMATION" });
    const storedPhoto = await database.secretariaCommand.findUniqueOrThrow({ where: { id: photo.id } });
    expect(storedPhoto.payloadEnvelope).not.toContain(photoBody.toString("base64"));
    const photoSucceeded = await application.confirmCommand(student, photo.id, "UPDATE_PHOTO");
    expect(photoSucceeded).toMatchObject({ type: "UPDATE_PHOTO", status: "SUCCEEDED", result: { items: [{ outcome: "PHOTO_CHANGE_REQUEST_SUBMITTED", sha256: photoHash }] } });
    expect(gateway.updatePhoto).toHaveBeenCalledTimes(1);

    const registrationRef = `ser_${"c".repeat(43)}`;
    const cancellation = await application.prepareExamRegistrationCancellation(student, registrationRef, "exam-cancel-001");
    expect(cancellation).toMatchObject({ type: "CANCEL_EXAM_REGISTRATION", status: "AWAITING_CONFIRMATION" });
    const storedCancellation = await database.secretariaCommand.findUniqueOrThrow({ where: { id: cancellation.id } });
    expect(storedCancellation.payloadEnvelope).not.toContain(registrationRef);
    const cancellationSucceeded = await application.confirmCommand(student, cancellation.id, "CANCEL_EXAM_REGISTRATION");
    expect(cancellationSucceeded).toMatchObject({
      type: "CANCEL_EXAM_REGISTRATION",
      status: "SUCCEEDED",
      result: { items: [{ outcome: "EXAM_REGISTRATION_CANCELLED", registrationRef }] },
    });
    expect(gateway.cancelExamRegistration).toHaveBeenCalledTimes(1);

    const reviewRef = `sgr_${"e".repeat(43)}`;
    const justification = "A classificação deve ser revista com base nos critérios publicados.";
    const review = await application.prepareGradeReview(student, reviewRef, "REVIEW", justification, "grade-review-001");
    expect(review).toMatchObject({ type: "SUBMIT_GRADE_REVIEW", risk: "HIGH", status: "AWAITING_CONFIRMATION" });
    const storedReview = await database.secretariaCommand.findUniqueOrThrow({ where: { id: review.id } });
    expect(storedReview.payloadEnvelope).not.toContain(reviewRef);
    expect(storedReview.payloadEnvelope).not.toContain(justification);
    const reviewSucceeded = await application.confirmCommand(student, review.id, "SUBMIT_GRADE_REVIEW");
    expect(reviewSucceeded).toMatchObject({
      type: "SUBMIT_GRADE_REVIEW",
      status: "SUCCEEDED",
      result: { items: [{ outcome: "GRADE_REVIEW_SUBMITTED", reviewRef }] },
    });
    expect(gateway.submitGradeReview).toHaveBeenCalledTimes(1);

    const uncertainRef = `ser_${"d".repeat(43)}`;
    const uncertain = await application.prepareExamRegistrationCancellation(student, uncertainRef, "exam-cancel-unknown-001");
    await database.secretariaCommand.update({ where: { id: uncertain.id }, data: { status: "UNKNOWN", errorCode: "SECRETARIA_COMMAND_OUTCOME_UNKNOWN" } });
    vi.mocked(gateway.verifyExamRegistrationCancellation).mockResolvedValue({
      items: [{ outcome: "EXAM_REGISTRATION_CANCELLED", registrationRef: uncertainRef }],
      observedAt: "2026-07-22T09:05:00.000Z",
    });
    const reconciled = await application.reconcileCommand(student, uncertain.id);
    expect(reconciled).toMatchObject({ status: "SUCCEEDED", result: { items: [{ registrationRef: uncertainRef }] } });
    expect(gateway.verifyExamRegistrationCancellation).toHaveBeenCalledWith(expect.anything(), uncertainRef);
    photoBody.fill(0);
    application.stop();
  }, 15_000);
});

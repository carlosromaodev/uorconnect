-- CreateTable
CREATE TABLE IF NOT EXISTS "PassportChallenge" (
  "id" SERIAL NOT NULL,
  "missionId" INTEGER,
  "qrActionId" INTEGER,
  "type" TEXT NOT NULL DEFAULT 'EXHIBITOR_CHALLENGE',
  "question" TEXT NOT NULL,
  "optionsJson" TEXT,
  "correctAnswerHash" TEXT NOT NULL,
  "explanation" TEXT,
  "maxAttempts" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdByStudentNumber" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedByStudentNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PassportChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PassportChallengeAnswer" (
  "id" SERIAL NOT NULL,
  "challengeId" INTEGER NOT NULL,
  "studentId" INTEGER,
  "studentNumber" TEXT NOT NULL,
  "studentName" TEXT,
  "studentCourse" TEXT,
  "answerHash" TEXT NOT NULL,
  "correct" BOOLEAN NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PassportChallengeAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PassportChallenge_qrActionId_key" ON "PassportChallenge"("qrActionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportChallenge_missionId_active_idx" ON "PassportChallenge"("missionId", "active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportChallenge_type_active_idx" ON "PassportChallenge"("type", "active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportChallenge_createdAt_idx" ON "PassportChallenge"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PassportChallengeAnswer_challengeId_studentNumber_attemptNumber_key" ON "PassportChallengeAnswer"("challengeId", "studentNumber", "attemptNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportChallengeAnswer_studentNumber_answeredAt_idx" ON "PassportChallengeAnswer"("studentNumber", "answeredAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PassportChallengeAnswer_challengeId_correct_idx" ON "PassportChallengeAnswer"("challengeId", "correct");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PassportChallenge"
    ADD CONSTRAINT "PassportChallenge_missionId_fkey"
    FOREIGN KEY ("missionId") REFERENCES "PassportMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PassportChallenge"
    ADD CONSTRAINT "PassportChallenge_qrActionId_fkey"
    FOREIGN KEY ("qrActionId") REFERENCES "QrAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PassportChallengeAnswer"
    ADD CONSTRAINT "PassportChallengeAnswer_challengeId_fkey"
    FOREIGN KEY ("challengeId") REFERENCES "PassportChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PassportChallengeAnswer"
    ADD CONSTRAINT "PassportChallengeAnswer_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

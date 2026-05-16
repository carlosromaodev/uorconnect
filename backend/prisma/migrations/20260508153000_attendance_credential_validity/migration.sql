ALTER TABLE "AttendanceCredential" ADD COLUMN "eventKey" TEXT NOT NULL DEFAULT 'main-event';
ALTER TABLE "AttendanceCredential" ADD COLUMN "eventLabel" TEXT NOT NULL DEFAULT 'Evento principal UOR Connect';
ALTER TABLE "AttendanceCredential" ADD COLUMN "validFrom" DATETIME;
ALTER TABLE "AttendanceCredential" ADD COLUMN "validUntil" DATETIME;
ALTER TABLE "AttendanceCredential" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "AttendanceCredential_eventKey_status_idx" ON "AttendanceCredential"("eventKey", "status");
CREATE INDEX "AttendanceCredential_validUntil_idx" ON "AttendanceCredential"("validUntil");

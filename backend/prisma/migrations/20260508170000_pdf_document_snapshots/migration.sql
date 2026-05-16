ALTER TABLE "EventTeamCredential" ADD COLUMN "lastPassSnapshotJson" TEXT;

ALTER TABLE "AttendanceCredential" ADD COLUMN "lastCardIssuedAt" DATETIME;
ALTER TABLE "AttendanceCredential" ADD COLUMN "lastCardSnapshotJson" TEXT;

-- CreateTable
CREATE TABLE "QrAction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "targetId" INTEGER,
    "targetMeta" TEXT,
    "eventKey" TEXT,
    "eventLabel" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxScans" INTEGER,
    "expiresAt" DATETIME,
    "smsOnScan" BOOLEAN NOT NULL DEFAULT false,
    "smsTemplate" TEXT,
    "smsSender" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QrActionScan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "qrActionId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "studentName" TEXT,
    "result" TEXT NOT NULL,
    "message" TEXT,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QrActionScan_qrActionId_fkey" FOREIGN KEY ("qrActionId") REFERENCES "QrAction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QrActionScan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "QrAction_token_key" ON "QrAction"("token");
CREATE INDEX "QrAction_type_idx" ON "QrAction"("type");
CREATE INDEX "QrAction_active_idx" ON "QrAction"("active");
CREATE INDEX "QrAction_createdAt_idx" ON "QrAction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QrActionScan_qrActionId_studentId_key" ON "QrActionScan"("qrActionId", "studentId");
CREATE INDEX "QrActionScan_qrActionId_idx" ON "QrActionScan"("qrActionId");
CREATE INDEX "QrActionScan_studentId_idx" ON "QrActionScan"("studentId");
CREATE INDEX "QrActionScan_scannedAt_idx" ON "QrActionScan"("scannedAt");

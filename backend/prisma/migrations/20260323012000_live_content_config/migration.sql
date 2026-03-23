CREATE TABLE IF NOT EXISTS "LiveContentConfig" (
  "key" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  "mode" TEXT NOT NULL DEFAULT 'AGENDA',
  "title" TEXT,
  "local" TEXT,
  "speaker" TEXT,
  "description" TEXT,
  "type" TEXT,
  "theme" TEXT,
  "day" TEXT,
  "date" DATETIME,
  "startTime" TEXT,
  "endTime" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

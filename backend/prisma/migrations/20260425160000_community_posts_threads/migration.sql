-- Community Posts
CREATE TABLE "CommunityPost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FREE',
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "contextId" INTEGER,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CommunityPost_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CommunityPost_createdAt_idx" ON "CommunityPost"("createdAt");
CREATE INDEX "CommunityPost_studentId_createdAt_idx" ON "CommunityPost"("studentId", "createdAt");
CREATE INDEX "CommunityPost_type_createdAt_idx" ON "CommunityPost"("type", "createdAt");

-- Community Post Likes
CREATE TABLE "CommunityPostLike" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityPostLike_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CommunityPostLike_postId_studentId_key" ON "CommunityPostLike"("postId", "studentId");
CREATE INDEX "CommunityPostLike_postId_idx" ON "CommunityPostLike"("postId");
CREATE INDEX "CommunityPostLike_studentId_idx" ON "CommunityPostLike"("studentId");

-- Community Post Comments
CREATE TABLE "CommunityPostComment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityPostComment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CommunityPostComment_postId_createdAt_idx" ON "CommunityPostComment"("postId", "createdAt");
CREATE INDEX "CommunityPostComment_studentId_idx" ON "CommunityPostComment"("studentId");

-- Community Chat Threads
CREATE TABLE "CommunityChatThread" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contextType" TEXT NOT NULL,
    "contextId" INTEGER NOT NULL,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "CommunityChatThread_contextType_contextId_key" ON "CommunityChatThread"("contextType", "contextId");
CREATE INDEX "CommunityChatThread_contextType_idx" ON "CommunityChatThread"("contextType");

-- Community Chat Messages
CREATE TABLE "CommunityChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "threadId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommunityChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityChatMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CommunityChatMessage_threadId_createdAt_idx" ON "CommunityChatMessage"("threadId", "createdAt");
CREATE INDEX "CommunityChatMessage_studentId_idx" ON "CommunityChatMessage"("studentId");

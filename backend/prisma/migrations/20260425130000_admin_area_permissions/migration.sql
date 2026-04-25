ALTER TABLE "AdminAuthorizedStudent" ADD COLUMN "team" TEXT NOT NULL DEFAULT 'Geral';
ALTER TABLE "AdminAuthorizedStudent" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'SUPER_ADMIN';
ALTER TABLE "AdminAuthorizedStudent" ADD COLUMN "permissions" TEXT NOT NULL DEFAULT 'ALL';

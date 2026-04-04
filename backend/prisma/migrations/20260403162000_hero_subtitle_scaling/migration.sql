ALTER TABLE "HomeSocialConfig"
  ADD COLUMN "heroSubtitleColor" TEXT NOT NULL DEFAULT '#4b5563',
  ADD COLUMN "heroSubtitleMobileSize" TEXT NOT NULL DEFAULT '1.05rem',
  ADD COLUMN "heroSubtitleTabletSize" TEXT NOT NULL DEFAULT '1.20rem',
  ADD COLUMN "heroSubtitleDesktopSize" TEXT NOT NULL DEFAULT '1.35rem';

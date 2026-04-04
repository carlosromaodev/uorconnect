import { prisma } from "../../../shared/prisma";
import type {
  HeroFloatingIconInput,
  HomeContentRepository,
  HomeCourseInput,
  HomeSocialConfigInput,
  HomeSocialConfigRecord,
  HomeSponsorInput,
  PanelTopicInput,
} from "../domain/home-content.repository";

const defaultFloatingIcons: HeroFloatingIconInput[] = [
  { id: "hero-icon-1", icon: "WifiHigh", top: 12, left: 8, size: 34, rotate: 0, opacity: 18 },
  { id: "hero-icon-2", icon: "Radio", top: 30, left: 72, size: 42, rotate: 24, opacity: 16 },
  { id: "hero-icon-3", icon: "GlobeHemisphereWest", top: 58, left: 18, size: 36, rotate: -18, opacity: 15 },
  { id: "hero-icon-4", icon: "CellSignalHigh", top: 72, left: 84, size: 38, rotate: 14, opacity: 14 },
];

const defaultSponsors: HomeSponsorInput[] = [
  { id: "uor", name: "Universidade Óscar Ribas", imageUrl: "/logo-uor.png", label: null },
  { id: "neic", name: "Núcleo de Engenharia Informática e Comunicações", imageUrl: "/logo-neic.jpeg", label: "Núcleo de Engenharia Informática e Comunicações" },
  { id: "uor-connect", name: "UOR Connect", imageUrl: "/logo-gestor.png", label: "UOR Connect" },
];

const defaultSocialConfigValues = {
  instagramUrl: "https://www.instagram.com/uorconnect?igsh=bmo4enl2cGN2cGc2&utm_source=qr",
  facebookUrl: null,
  linkedinUrl: null,
  courseEnrollmentEnabled: true,
  firstYearContestEnabled: true,
  primaryColor: "#f97316",
  primaryGradient: "linear-gradient(135deg, rgba(249,115,22,0.16) 0%, rgba(251,146,60,0.28) 100%)",
  titleColor: "#111827",
  accentColor: "#f97316",
  dashedColor: "#f97316",
  dashedOpacity: 35,
  heroIconsOpacity: 18,
  heroBlobsIntensity: 68,
  heroMeshEnabled: true,
  heroBadgeText: "Plataforma Académica Digital · Chave-na-Mão",
  heroTitlePrefix: "3ª edição da",
  heroTitleHighlight: "Feira do Dia das Telecomunicações",
  heroSubtitleText: "Conectando o Conhecimento Académico ao Mercado Tecnológico com Energia e Empreendedorismo.",
  heroSubtitleColor: "#4b5563",
  heroTitleMobileSize: "2.8rem",
  heroTitleTabletSize: "4.2rem",
  heroTitleDesktopSize: "5.4rem",
  heroSubtitleMobileSize: "1.05rem",
  heroSubtitleTabletSize: "1.20rem",
  heroSubtitleDesktopSize: "1.35rem",
  heroFloatingIconsJson: JSON.stringify(defaultFloatingIcons),
  sponsorsJson: JSON.stringify(defaultSponsors),
} as const;

type LegacySocialConfigRow = {
  key: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function normalizePercent(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeCssSize(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized && normalized.length <= 16 ? normalized : fallback;
}

function parseJsonArray<T>(value: string | null | undefined, fallback: T[]): T[] {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeFloatingIcons(value: HeroFloatingIconInput[] | null | undefined) {
  const source = Array.isArray(value) && value.length > 0 ? value : defaultFloatingIcons;
  return source.map((icon, index) => ({
    id: normalizeText(icon.id, `hero-icon-${index + 1}`),
    icon: normalizeText(icon.icon, "WifiHigh"),
    top: Math.max(4, Math.min(96, normalizePercent(icon.top, 10 + index * 12))),
    left: Math.max(4, Math.min(96, normalizePercent(icon.left, 12 + index * 15))),
    size: Math.max(18, Math.min(96, Math.round(icon.size || 36))),
    rotate: Math.max(-180, Math.min(180, Math.round(icon.rotate || 0))),
    opacity: normalizePercent(icon.opacity, 18),
  }));
}

function normalizeSponsors(value: HomeSponsorInput[] | null | undefined) {
  const source = Array.isArray(value) && value.length > 0 ? value : defaultSponsors;
  return source.map((sponsor, index) => ({
    id: normalizeText(sponsor.id, `sponsor-${index + 1}`),
    name: normalizeText(sponsor.name, `Patrocinador ${index + 1}`),
    imageUrl: normalizeText(sponsor.imageUrl, "/logo-gestor.png"),
    label: sponsor.label?.trim() || null,
  }));
}

function toSocialConfigRecord(config: Partial<HomeSocialConfigRecord> & {
  key: string;
  createdAt: Date;
  updatedAt: Date;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  courseEnrollmentEnabled?: boolean;
  firstYearContestEnabled?: boolean;
  primaryColor?: string | null;
  primaryGradient?: string | null;
  titleColor?: string | null;
  accentColor?: string | null;
  dashedColor?: string | null;
  dashedOpacity?: number | null;
  heroIconsOpacity?: number | null;
  heroBlobsIntensity?: number | null;
  heroMeshEnabled?: boolean | null;
  heroBadgeText?: string | null;
  heroTitlePrefix?: string | null;
  heroTitleHighlight?: string | null;
  heroSubtitleText?: string | null;
  heroSubtitleColor?: string | null;
  heroTitleMobileSize?: string | null;
  heroTitleTabletSize?: string | null;
  heroTitleDesktopSize?: string | null;
  heroSubtitleMobileSize?: string | null;
  heroSubtitleTabletSize?: string | null;
  heroSubtitleDesktopSize?: string | null;
  heroFloatingIconsJson?: string | null;
  sponsorsJson?: string | null;
}): HomeSocialConfigRecord {
  const heroFloatingIcons = normalizeFloatingIcons(
    "heroFloatingIcons" in config
      ? config.heroFloatingIcons
      : parseJsonArray(config.heroFloatingIconsJson, defaultFloatingIcons)
  );
  const sponsors = normalizeSponsors(
    "sponsors" in config
      ? config.sponsors
      : parseJsonArray(config.sponsorsJson, defaultSponsors)
  );

  return {
    key: config.key,
    instagramUrl: normalizeSocialUrl(config.instagramUrl),
    facebookUrl: normalizeSocialUrl(config.facebookUrl),
    linkedinUrl: normalizeSocialUrl(config.linkedinUrl),
    courseEnrollmentEnabled: config.courseEnrollmentEnabled ?? true,
    firstYearContestEnabled: config.firstYearContestEnabled ?? true,
    primaryColor: normalizeText(config.primaryColor, defaultSocialConfigValues.primaryColor),
    primaryGradient: normalizeText(config.primaryGradient, defaultSocialConfigValues.primaryGradient),
    titleColor: normalizeText(config.titleColor, defaultSocialConfigValues.titleColor),
    accentColor: normalizeText(config.accentColor, defaultSocialConfigValues.accentColor),
    dashedColor: normalizeText(config.dashedColor, defaultSocialConfigValues.dashedColor),
    dashedOpacity: normalizePercent(config.dashedOpacity, defaultSocialConfigValues.dashedOpacity),
    heroIconsOpacity: normalizePercent(config.heroIconsOpacity, defaultSocialConfigValues.heroIconsOpacity),
    heroBlobsIntensity: normalizePercent(config.heroBlobsIntensity, defaultSocialConfigValues.heroBlobsIntensity),
    heroMeshEnabled: config.heroMeshEnabled ?? true,
    heroBadgeText: normalizeText(config.heroBadgeText, defaultSocialConfigValues.heroBadgeText),
    heroTitlePrefix: normalizeText(config.heroTitlePrefix, defaultSocialConfigValues.heroTitlePrefix),
    heroTitleHighlight: normalizeText(config.heroTitleHighlight, defaultSocialConfigValues.heroTitleHighlight),
    heroSubtitleText: normalizeText(config.heroSubtitleText, defaultSocialConfigValues.heroSubtitleText),
    heroSubtitleColor: normalizeText(config.heroSubtitleColor, defaultSocialConfigValues.heroSubtitleColor),
    heroTitleMobileSize: normalizeCssSize(config.heroTitleMobileSize, defaultSocialConfigValues.heroTitleMobileSize),
    heroTitleTabletSize: normalizeCssSize(config.heroTitleTabletSize, defaultSocialConfigValues.heroTitleTabletSize),
    heroTitleDesktopSize: normalizeCssSize(config.heroTitleDesktopSize, defaultSocialConfigValues.heroTitleDesktopSize),
    heroSubtitleMobileSize: normalizeCssSize(config.heroSubtitleMobileSize, defaultSocialConfigValues.heroSubtitleMobileSize),
    heroSubtitleTabletSize: normalizeCssSize(config.heroSubtitleTabletSize, defaultSocialConfigValues.heroSubtitleTabletSize),
    heroSubtitleDesktopSize: normalizeCssSize(config.heroSubtitleDesktopSize, defaultSocialConfigValues.heroSubtitleDesktopSize),
    heroFloatingIcons,
    sponsors,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  };
}

function normalizeSocialUrl(url: string | null | undefined) {
  if (!url) return null;

  const normalized = url.replace("??", "?").trim();

  try {
    return new URL(normalized).toString();
  } catch {
    return null;
  }
}

function hasMissingSocialConfigFeatureColumns(error: unknown) {
  if (!(error instanceof Error)) return false;

  return [
    "courseEnrollmentEnabled",
    "firstYearContestEnabled",
    "primaryColor",
    "primaryGradient",
    "titleColor",
    "accentColor",
    "dashedColor",
    "dashedOpacity",
    "heroIconsOpacity",
    "heroBlobsIntensity",
    "heroMeshEnabled",
    "heroBadgeText",
    "heroTitlePrefix",
    "heroTitleHighlight",
    "heroSubtitleText",
    "heroSubtitleColor",
    "heroTitleMobileSize",
    "heroTitleTabletSize",
    "heroTitleDesktopSize",
    "heroSubtitleMobileSize",
    "heroSubtitleTabletSize",
    "heroSubtitleDesktopSize",
    "heroFloatingIconsJson",
    "sponsorsJson",
  ].some((field) => error.message.includes(field));
}

function buildNormalizedSocialConfig(current: HomeSocialConfigRecord, data: HomeSocialConfigInput) {
  const heroFloatingIcons = normalizeFloatingIcons(data.heroFloatingIcons ?? current.heroFloatingIcons);
  const sponsors = normalizeSponsors(data.sponsors ?? current.sponsors);

  return {
    instagramUrl: normalizeSocialUrl(data.instagramUrl ?? current.instagramUrl),
    facebookUrl: normalizeSocialUrl(data.facebookUrl ?? current.facebookUrl),
    linkedinUrl: normalizeSocialUrl(data.linkedinUrl ?? current.linkedinUrl),
    courseEnrollmentEnabled: data.courseEnrollmentEnabled ?? current.courseEnrollmentEnabled,
    firstYearContestEnabled: data.firstYearContestEnabled ?? current.firstYearContestEnabled,
    primaryColor: normalizeText(data.primaryColor, current.primaryColor),
    primaryGradient: normalizeText(data.primaryGradient, current.primaryGradient),
    titleColor: normalizeText(data.titleColor, current.titleColor),
    accentColor: normalizeText(data.accentColor, current.accentColor),
    dashedColor: normalizeText(data.dashedColor, current.dashedColor),
    dashedOpacity: normalizePercent(data.dashedOpacity, current.dashedOpacity),
    heroIconsOpacity: normalizePercent(data.heroIconsOpacity, current.heroIconsOpacity),
    heroBlobsIntensity: normalizePercent(data.heroBlobsIntensity, current.heroBlobsIntensity),
    heroMeshEnabled: data.heroMeshEnabled ?? current.heroMeshEnabled,
    heroBadgeText: normalizeText(data.heroBadgeText, current.heroBadgeText),
    heroTitlePrefix: normalizeText(data.heroTitlePrefix, current.heroTitlePrefix),
    heroTitleHighlight: normalizeText(data.heroTitleHighlight, current.heroTitleHighlight),
    heroSubtitleText: normalizeText(data.heroSubtitleText, current.heroSubtitleText),
    heroSubtitleColor: normalizeText(data.heroSubtitleColor, current.heroSubtitleColor),
    heroTitleMobileSize: normalizeCssSize(data.heroTitleMobileSize, current.heroTitleMobileSize),
    heroTitleTabletSize: normalizeCssSize(data.heroTitleTabletSize, current.heroTitleTabletSize),
    heroTitleDesktopSize: normalizeCssSize(data.heroTitleDesktopSize, current.heroTitleDesktopSize),
    heroSubtitleMobileSize: normalizeCssSize(data.heroSubtitleMobileSize, current.heroSubtitleMobileSize),
    heroSubtitleTabletSize: normalizeCssSize(data.heroSubtitleTabletSize, current.heroSubtitleTabletSize),
    heroSubtitleDesktopSize: normalizeCssSize(data.heroSubtitleDesktopSize, current.heroSubtitleDesktopSize),
    heroFloatingIconsJson: JSON.stringify(heroFloatingIcons),
    sponsorsJson: JSON.stringify(sponsors),
  };
}

async function upsertLegacySocialConfigRow(input: {
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
}): Promise<LegacySocialConfigRow> {
  await prisma.$executeRaw`
    INSERT INTO "HomeSocialConfig" ("key", "instagramUrl", "facebookUrl", "linkedinUrl", "updatedAt")
    VALUES ('default', ${input.instagramUrl}, ${input.facebookUrl}, ${input.linkedinUrl}, CURRENT_TIMESTAMP)
    ON CONFLICT("key") DO UPDATE SET
      "instagramUrl" = excluded."instagramUrl",
      "facebookUrl" = excluded."facebookUrl",
      "linkedinUrl" = excluded."linkedinUrl",
      "updatedAt" = CURRENT_TIMESTAMP
  `;

  const rows = await prisma.$queryRaw<LegacySocialConfigRow[]>`
    SELECT "key", "instagramUrl", "facebookUrl", "linkedinUrl", "createdAt", "updatedAt"
    FROM "HomeSocialConfig"
    WHERE "key" = 'default'
    LIMIT 1
  `;

  if (!rows.length) {
    throw new Error("Legacy social config row not found after upsert");
  }

  return rows[0];
}

export class PrismaHomeContentRepository implements HomeContentRepository {
  async listCourses(includeDrafts = false) {
    return prisma.homeCourse.findMany({
      where: includeDrafts ? {} : { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  async findCourseById(id: number) {
    return prisma.homeCourse.findUnique({ where: { id } });
  }

  async createCourse(data: HomeCourseInput) {
    return prisma.homeCourse.create({
      data: {
        ...data,
        ctaText: data.ctaText ?? null,
        sortOrder: data.sortOrder ?? 0,
        isPublished: data.isPublished ?? true
      }
    });
  }

  async updateCourse(id: number, data: HomeCourseInput) {
    return prisma.homeCourse.update({
      where: { id },
      data: {
        ...data,
        ctaText: data.ctaText ?? null,
        sortOrder: data.sortOrder ?? 0,
        isPublished: data.isPublished ?? true
      }
    });
  }

  async deleteCourse(id: number) {
    await prisma.homeCourse.delete({ where: { id } });
  }

  async listPanelTopics(includeDrafts = false) {
    return prisma.panelTopic.findMany({
      where: includeDrafts ? {} : { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  async findPanelTopicById(id: number) {
    return prisma.panelTopic.findUnique({ where: { id } });
  }

  async createPanelTopic(data: PanelTopicInput) {
    return prisma.panelTopic.create({
      data: {
        ...data,
        sortOrder: data.sortOrder ?? 0,
        isPublished: data.isPublished ?? true
      }
    });
  }

  async updatePanelTopic(id: number, data: PanelTopicInput) {
    return prisma.panelTopic.update({
      where: { id },
      data: {
        ...data,
        sortOrder: data.sortOrder ?? 0,
        isPublished: data.isPublished ?? true
      }
    });
  }

  async deletePanelTopic(id: number) {
    await prisma.panelTopic.delete({ where: { id } });
  }

  async getSocialConfig() {
    try {
      const config = await prisma.homeSocialConfig.upsert({
        where: { key: "default" },
        update: {},
        create: {
          key: "default",
          ...defaultSocialConfigValues,
        }
      });

      const current = toSocialConfigRecord(config);
      const normalized = buildNormalizedSocialConfig(current, {});

      if (
        normalized.instagramUrl !== config.instagramUrl ||
        normalized.facebookUrl !== config.facebookUrl ||
        normalized.linkedinUrl !== config.linkedinUrl ||
        normalized.primaryColor !== config.primaryColor ||
        normalized.primaryGradient !== config.primaryGradient ||
        normalized.titleColor !== config.titleColor ||
        normalized.accentColor !== config.accentColor ||
        normalized.dashedColor !== config.dashedColor ||
        normalized.dashedOpacity !== config.dashedOpacity ||
        normalized.heroIconsOpacity !== config.heroIconsOpacity ||
        normalized.heroBlobsIntensity !== config.heroBlobsIntensity ||
        normalized.heroMeshEnabled !== config.heroMeshEnabled ||
        normalized.heroBadgeText !== config.heroBadgeText ||
        normalized.heroTitlePrefix !== config.heroTitlePrefix ||
        normalized.heroTitleHighlight !== config.heroTitleHighlight ||
        normalized.heroSubtitleText !== config.heroSubtitleText ||
        normalized.heroSubtitleColor !== config.heroSubtitleColor ||
        normalized.heroTitleMobileSize !== config.heroTitleMobileSize ||
        normalized.heroTitleTabletSize !== config.heroTitleTabletSize ||
        normalized.heroTitleDesktopSize !== config.heroTitleDesktopSize ||
        normalized.heroSubtitleMobileSize !== config.heroSubtitleMobileSize ||
        normalized.heroSubtitleTabletSize !== config.heroSubtitleTabletSize ||
        normalized.heroSubtitleDesktopSize !== config.heroSubtitleDesktopSize ||
        normalized.heroFloatingIconsJson !== config.heroFloatingIconsJson ||
        normalized.sponsorsJson !== config.sponsorsJson
      ) {
        const updated = await prisma.homeSocialConfig.update({
          where: { key: config.key },
          data: normalized,
        });
        return toSocialConfigRecord(updated);
      }

      return current;
    } catch (error) {
      if (!hasMissingSocialConfigFeatureColumns(error)) {
        throw error;
      }

      const legacyConfig = await upsertLegacySocialConfigRow({
        instagramUrl: defaultSocialConfigValues.instagramUrl,
        facebookUrl: defaultSocialConfigValues.facebookUrl,
        linkedinUrl: defaultSocialConfigValues.linkedinUrl,
      });

      return toSocialConfigRecord(legacyConfig);
    }
  }

  async updateSocialConfig(data: HomeSocialConfigInput) {
    const current = await this.getSocialConfig();
    const normalized = buildNormalizedSocialConfig(current, data);

    try {
      const saved = await prisma.homeSocialConfig.upsert({
        where: { key: "default" },
        update: normalized,
        create: {
          key: "default",
          ...normalized,
        }
      });
      return toSocialConfigRecord(saved);
    } catch (error) {
      if (!hasMissingSocialConfigFeatureColumns(error)) {
        throw error;
      }

      const legacyConfig = await upsertLegacySocialConfigRow({
        instagramUrl: normalized.instagramUrl,
        facebookUrl: normalized.facebookUrl,
        linkedinUrl: normalized.linkedinUrl,
      });

      return toSocialConfigRecord({
        ...legacyConfig,
        courseEnrollmentEnabled: normalized.courseEnrollmentEnabled,
        firstYearContestEnabled: normalized.firstYearContestEnabled,
        primaryColor: normalized.primaryColor,
        primaryGradient: normalized.primaryGradient,
        titleColor: normalized.titleColor,
        accentColor: normalized.accentColor,
        dashedColor: normalized.dashedColor,
        dashedOpacity: normalized.dashedOpacity,
        heroIconsOpacity: normalized.heroIconsOpacity,
        heroBlobsIntensity: normalized.heroBlobsIntensity,
        heroMeshEnabled: normalized.heroMeshEnabled,
        heroBadgeText: normalized.heroBadgeText,
        heroTitlePrefix: normalized.heroTitlePrefix,
        heroTitleHighlight: normalized.heroTitleHighlight,
        heroSubtitleText: normalized.heroSubtitleText,
        heroSubtitleColor: normalized.heroSubtitleColor,
        heroTitleMobileSize: normalized.heroTitleMobileSize,
        heroTitleTabletSize: normalized.heroTitleTabletSize,
        heroTitleDesktopSize: normalized.heroTitleDesktopSize,
        heroSubtitleMobileSize: normalized.heroSubtitleMobileSize,
        heroSubtitleTabletSize: normalized.heroSubtitleTabletSize,
        heroSubtitleDesktopSize: normalized.heroSubtitleDesktopSize,
        heroFloatingIconsJson: normalized.heroFloatingIconsJson,
        sponsorsJson: normalized.sponsorsJson,
      });
    }
  }
}

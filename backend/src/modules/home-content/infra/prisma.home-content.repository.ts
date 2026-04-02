import { prisma } from "../../../shared/prisma";
import type { HomeContentRepository, HomeCourseInput, HomeSocialConfigInput, PanelTopicInput } from "../domain/home-content.repository";

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

  return (
    error.message.includes("courseEnrollmentEnabled") ||
    error.message.includes("firstYearContestEnabled")
  );
}

function withDefaultFeatureFlags<T extends {
  key: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  linkedinUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}>(config: T) {
  return {
    ...config,
    courseEnrollmentEnabled: true,
    firstYearContestEnabled: true,
  };
}

function buildNormalizedSocialConfig(data: HomeSocialConfigInput) {
  return {
    instagramUrl: normalizeSocialUrl(data.instagramUrl),
    facebookUrl: normalizeSocialUrl(data.facebookUrl),
    linkedinUrl: normalizeSocialUrl(data.linkedinUrl),
    courseEnrollmentEnabled: data.courseEnrollmentEnabled ?? true,
    firstYearContestEnabled: data.firstYearContestEnabled ?? true,
  };
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
          instagramUrl: "https://www.instagram.com/uorconnect?igsh=bmo4enl2cGN2cGc2&utm_source=qr",
          facebookUrl: null,
          linkedinUrl: null,
          courseEnrollmentEnabled: true,
          firstYearContestEnabled: true,
        }
      });

      const sanitized = buildNormalizedSocialConfig(config);

      if (
        sanitized.instagramUrl !== config.instagramUrl ||
        sanitized.facebookUrl !== config.facebookUrl ||
        sanitized.linkedinUrl !== config.linkedinUrl
      ) {
        return prisma.homeSocialConfig.update({
          where: { key: config.key },
          data: sanitized,
        });
      }

      return config;
    } catch (error) {
      if (!hasMissingSocialConfigFeatureColumns(error)) {
        throw error;
      }

      const legacyConfig = await prisma.homeSocialConfig.upsert({
        where: { key: "default" },
        update: {},
        create: {
          key: "default",
          instagramUrl: "https://www.instagram.com/uorconnect?igsh=bmo4enl2cGN2cGc2&utm_source=qr",
          facebookUrl: null,
          linkedinUrl: null,
        },
        select: {
          key: true,
          instagramUrl: true,
          facebookUrl: true,
          linkedinUrl: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      const sanitized = {
        instagramUrl: normalizeSocialUrl(legacyConfig.instagramUrl),
        facebookUrl: normalizeSocialUrl(legacyConfig.facebookUrl),
        linkedinUrl: normalizeSocialUrl(legacyConfig.linkedinUrl),
      };

      if (
        sanitized.instagramUrl !== legacyConfig.instagramUrl ||
        sanitized.facebookUrl !== legacyConfig.facebookUrl ||
        sanitized.linkedinUrl !== legacyConfig.linkedinUrl
      ) {
        const updated = await prisma.homeSocialConfig.update({
          where: { key: legacyConfig.key },
          data: sanitized,
          select: {
            key: true,
            instagramUrl: true,
            facebookUrl: true,
            linkedinUrl: true,
            createdAt: true,
            updatedAt: true,
          }
        });

        return withDefaultFeatureFlags(updated);
      }

      return withDefaultFeatureFlags(legacyConfig);
    }
  }

  async updateSocialConfig(data: HomeSocialConfigInput) {
    const normalized = buildNormalizedSocialConfig(data);

    try {
      return prisma.homeSocialConfig.upsert({
        where: { key: "default" },
        update: normalized,
        create: {
          key: "default",
          ...normalized,
        }
      });
    } catch (error) {
      if (!hasMissingSocialConfigFeatureColumns(error)) {
        throw error;
      }

      const legacyConfig = await prisma.homeSocialConfig.upsert({
        where: { key: "default" },
        update: {
          instagramUrl: normalized.instagramUrl,
          facebookUrl: normalized.facebookUrl,
          linkedinUrl: normalized.linkedinUrl,
        },
        create: {
          key: "default",
          instagramUrl: normalized.instagramUrl,
          facebookUrl: normalized.facebookUrl,
          linkedinUrl: normalized.linkedinUrl,
        },
        select: {
          key: true,
          instagramUrl: true,
          facebookUrl: true,
          linkedinUrl: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      return {
        ...withDefaultFeatureFlags(legacyConfig),
        courseEnrollmentEnabled: normalized.courseEnrollmentEnabled,
        firstYearContestEnabled: normalized.firstYearContestEnabled,
      };
    }
  }
}

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
    const config = await prisma.homeSocialConfig.upsert({
      where: { key: "default" },
      update: {},
      create: {
        key: "default",
        instagramUrl: "https://www.instagram.com/uorconnect?igsh=bmo4enl2cGN2cGc2&utm_source=qr",
        facebookUrl: null,
        linkedinUrl: null
      }
    });

    const sanitized = {
      instagramUrl: normalizeSocialUrl(config.instagramUrl),
      facebookUrl: normalizeSocialUrl(config.facebookUrl),
      linkedinUrl: normalizeSocialUrl(config.linkedinUrl),
    };

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
  }

  async updateSocialConfig(data: HomeSocialConfigInput) {
    return prisma.homeSocialConfig.upsert({
      where: { key: "default" },
      update: {
        instagramUrl: normalizeSocialUrl(data.instagramUrl),
        facebookUrl: normalizeSocialUrl(data.facebookUrl),
        linkedinUrl: normalizeSocialUrl(data.linkedinUrl)
      },
      create: {
        key: "default",
        instagramUrl: normalizeSocialUrl(data.instagramUrl),
        facebookUrl: normalizeSocialUrl(data.facebookUrl),
        linkedinUrl: normalizeSocialUrl(data.linkedinUrl)
      }
    });
  }
}

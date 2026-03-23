import { prisma } from "../../../shared/prisma";
import type { GuideRepository, GuideStepInput, GuideTipInput, VenueInput } from "../domain/guide.repository";

export class PrismaGuideRepository implements GuideRepository {
  async listSteps(includeDrafts = false) {
    return prisma.guideStep.findMany({
      where: includeDrafts ? {} : { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }
  async findStepById(id: number) { return prisma.guideStep.findUnique({ where: { id } }); }
  async createStep(data: GuideStepInput) {
    return prisma.guideStep.create({ data: { ...data, sortOrder: data.sortOrder ?? 0, isPublished: data.isPublished ?? true, link: data.link ?? null, linkText: data.linkText ?? null } });
  }
  async updateStep(id: number, data: GuideStepInput) {
    return prisma.guideStep.update({ where: { id }, data: { ...data, sortOrder: data.sortOrder ?? 0, isPublished: data.isPublished ?? true, link: data.link ?? null, linkText: data.linkText ?? null } });
  }
  async deleteStep(id: number) { await prisma.guideStep.delete({ where: { id } }); }

  async listTips(includeDrafts = false) {
    return prisma.guideTip.findMany({
      where: includeDrafts ? {} : { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }
  async findTipById(id: number) { return prisma.guideTip.findUnique({ where: { id } }); }
  async createTip(data: GuideTipInput) {
    return prisma.guideTip.create({ data: { ...data, sortOrder: data.sortOrder ?? 0, isPublished: data.isPublished ?? true } });
  }
  async updateTip(id: number, data: GuideTipInput) {
    return prisma.guideTip.update({ where: { id }, data: { ...data, sortOrder: data.sortOrder ?? 0, isPublished: data.isPublished ?? true } });
  }
  async deleteTip(id: number) { await prisma.guideTip.delete({ where: { id } }); }

  async listVenues(includeDrafts = false) {
    return prisma.venue.findMany({
      where: includeDrafts ? {} : { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }
  async findVenueById(id: number) { return prisma.venue.findUnique({ where: { id } }); }
  async createVenue(data: VenueInput) {
    return prisma.venue.create({ data: { ...data, sortOrder: data.sortOrder ?? 0, isPublished: data.isPublished ?? true } });
  }
  async updateVenue(id: number, data: VenueInput) {
    return prisma.venue.update({ where: { id }, data: { ...data, sortOrder: data.sortOrder ?? 0, isPublished: data.isPublished ?? true } });
  }
  async deleteVenue(id: number) { await prisma.venue.delete({ where: { id } }); }
}

import { prisma } from "../../../shared/prisma";
import type { SpeakerInput, SpeakerRepository } from "../domain/speaker.repository";

export class PrismaSpeakerRepository implements SpeakerRepository {
  async list() { return prisma.speaker.findMany({ orderBy: { name: "asc" } }); }
  async findById(id: number) { return prisma.speaker.findUnique({ where: { id } }); }
  async create(data: SpeakerInput) { return prisma.speaker.create({ data }); }
  async update(id: number, data: SpeakerInput) { return prisma.speaker.update({ where: { id }, data }); }
  async delete(id: number) { await prisma.speaker.delete({ where: { id } }); }
}

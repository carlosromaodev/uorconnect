import { prisma } from "../../../shared/prisma";
import type { AgendaRepository, AgendaInput, AgendaLiveConfigInput } from "../domain/agenda.repository";

export class PrismaAgendaRepository implements AgendaRepository {
  async list() {
    return prisma.agendaItem.findMany({ orderBy: [{ date: "asc" }, { startTime: "asc" }] });
  }
  async findById(id: number) {
    return prisma.agendaItem.findUnique({ where: { id } });
  }
  async create(data: AgendaInput) {
    return prisma.agendaItem.create({ data });
  }
  async update(id: number, data: AgendaInput) {
    return prisma.agendaItem.update({ where: { id }, data });
  }
  async delete(id: number) {
    await prisma.agendaItem.delete({ where: { id } });
  }
  async getLiveConfig() {
    return prisma.liveContentConfig.upsert({
      where: { key: "default" },
      update: {},
      create: { key: "default" }
    });
  }
  async updateLiveConfig(data: AgendaLiveConfigInput) {
    return prisma.liveContentConfig.upsert({
      where: { key: "default" },
      update: {
        mode: data.mode,
        title: data.current?.title ?? null,
        local: data.current?.local ?? null,
        speaker: data.current?.speaker ?? null,
        description: data.current?.description ?? null,
        type: data.current?.type ?? null,
        theme: data.current?.theme ?? null,
        day: data.current?.day ?? null,
        date: data.current?.date ?? null,
        startTime: data.current?.startTime ?? null,
        endTime: data.current?.endTime ?? null
      },
      create: {
        key: "default",
        mode: data.mode,
        title: data.current?.title ?? null,
        local: data.current?.local ?? null,
        speaker: data.current?.speaker ?? null,
        description: data.current?.description ?? null,
        type: data.current?.type ?? null,
        theme: data.current?.theme ?? null,
        day: data.current?.day ?? null,
        date: data.current?.date ?? null,
        startTime: data.current?.startTime ?? null,
        endTime: data.current?.endTime ?? null
      }
    });
  }
}

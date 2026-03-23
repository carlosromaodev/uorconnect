import { beforeEach, describe, expect, it } from "vitest";
import type { LiveContentConfig } from "@prisma/client";
import type { AgendaInput, AgendaRepository } from "../domain/agenda.repository";
import { GetAgendaLiveState } from "./get-live-state";

class InMemoryAgendaRepository implements AgendaRepository {
  items: any[] = [];
  liveConfig: LiveContentConfig = {
    key: "default",
    mode: "AGENDA",
    title: null,
    local: null,
    speaker: null,
    description: null,
    type: null,
    theme: null,
    day: null,
    date: null,
    startTime: null,
    endTime: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  async list() {
    return this.items;
  }

  async findById(id: number) {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async create(data: AgendaInput) {
    const item = { id: this.items.length + 1, ...data, createdAt: new Date(), updatedAt: new Date() };
    this.items.push(item);
    return item;
  }

  async update(id: number, data: AgendaInput) {
    const index = this.items.findIndex((item) => item.id === id);
    this.items[index] = { ...this.items[index], ...data };
    return this.items[index];
  }

  async delete(id: number) {
    this.items = this.items.filter((item) => item.id !== id);
  }

  async getLiveConfig() {
    return this.liveConfig;
  }

  async updateLiveConfig(data: { mode: "AGENDA" | "MANUAL"; current: AgendaInput | null }) {
    this.liveConfig = {
      ...this.liveConfig,
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
      endTime: data.current?.endTime ?? null,
      updatedAt: new Date()
    };
    return this.liveConfig;
  }
}

describe("GetAgendaLiveState", () => {
  let repository: InMemoryAgendaRepository;

  beforeEach(async () => {
    repository = new InMemoryAgendaRepository();
    await repository.create({
      day: "DAY1",
      date: new Date("2026-05-17T00:00:00.000Z"),
      startTime: "09:00",
      endTime: "10:00",
      title: "Abertura",
      local: "Auditório",
      speaker: "Equipe",
      description: "Inicio",
      type: "CEREMONY",
      theme: "Geral"
    });
    await repository.create({
      day: "DAY1",
      date: new Date("2026-05-17T00:00:00.000Z"),
      startTime: "10:30",
      endTime: "11:30",
      title: "Painel",
      local: "Sala 1",
      speaker: "Convidado",
      description: "Painel principal",
      type: "PANEL",
      theme: "Carreira"
    });
  });

  it("retorna sessão atual e próxima", async () => {
    const result = await new GetAgendaLiveState(repository).execute(new Date("2026-05-17T09:15:00.000Z"));
    expect(result.current?.title).toBe("Abertura");
    expect(result.next?.title).toBe("Painel");
  });

  it("retorna próxima quando ainda não começou", async () => {
    const result = await new GetAgendaLiveState(repository).execute(new Date("2026-05-17T08:00:00.000Z"));
    expect(result.current).toBeNull();
    expect(result.next?.title).toBe("Abertura");
  });
});

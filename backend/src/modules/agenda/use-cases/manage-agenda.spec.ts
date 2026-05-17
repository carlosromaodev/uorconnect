import { beforeEach, describe, expect, it } from "vitest";
import type { LiveContentConfig } from "@prisma/client";
import type { AgendaInput, AgendaRepository } from "../domain/agenda.repository";
import { CreateAgendaItem, DeleteAgendaItem, ListAgendaItems, UpdateAgendaItem, UpdateAgendaLiveConfig } from "./manage-agenda";

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
  async list() { return this.items; }
  async findById(id: number) { return this.items.find((item) => item.id === id) ?? null; }
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
  async delete(id: number) { this.items = this.items.filter((item) => item.id !== id); }
  async getLiveConfig() { return this.liveConfig; }
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

const baseInput: AgendaInput = {
  day: "DAY1",
  date: new Date("2026-05-17T00:00:00.000Z"),
  startTime: "09:00",
  endTime: "10:00",
  title: "Sessao",
  local: "Sala 1",
  speaker: "Speaker",
  description: "Descricao",
  type: "PANEL",
  theme: "Tema"
};

describe("Agenda use cases", () => {
  let repository: InMemoryAgendaRepository;
  beforeEach(() => { repository = new InMemoryAgendaRepository(); });

  it("cria e lista agenda", async () => {
    await new CreateAgendaItem(repository).execute(baseInput);
    expect((await new ListAgendaItems(repository).execute())).toHaveLength(1);
  });

  it("atualiza agenda", async () => {
    const created = await new CreateAgendaItem(repository).execute(baseInput);
    const updated = await new UpdateAgendaItem(repository).execute(created.id, { ...baseInput, title: "Novo titulo" });
    expect(updated.title).toBe("Novo titulo");
  });

  it("remove agenda", async () => {
    const created = await new CreateAgendaItem(repository).execute(baseInput);
    await new DeleteAgendaItem(repository).execute(created.id);
    expect(repository.items).toHaveLength(0);
  });

  it("bloqueia conteúdo manual do Ao Vivo fora do tema Geral", async () => {
    await expect(
      new UpdateAgendaLiveConfig(repository).execute({
        mode: "MANUAL",
        current: { ...baseInput, theme: "Carreira" }
      })
    ).rejects.toThrow('O Ao Vivo só aceita conteúdos com o tema "Geral" da agenda.');
  });
});

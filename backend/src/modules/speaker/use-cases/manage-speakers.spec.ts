import { beforeEach, describe, expect, it } from "vitest";
import type { Speaker } from "@prisma/client";
import type { SpeakerInput, SpeakerRepository } from "../domain/speaker.repository";
import { CreateSpeaker, DeleteSpeaker, ListSpeakers, UpdateSpeaker } from "./manage-speakers";

class InMemorySpeakerRepository implements SpeakerRepository {
  items: Speaker[] = [];
  async list() { return this.items; }
  async findById(id: number) { return this.items.find((item) => item.id === id) ?? null; }
  async create(data: SpeakerInput) {
    const item = { id: this.items.length + 1, ...data, avatarUrl: data.avatarUrl ?? null, createdAt: new Date(), updatedAt: new Date() };
    this.items.push(item);
    return item;
  }
  async update(id: number, data: SpeakerInput) {
    const index = this.items.findIndex((item) => item.id === id);
    this.items[index] = { ...this.items[index], ...data };
    return this.items[index];
  }
  async delete(id: number) { this.items = this.items.filter((item) => item.id !== id); }
}

const baseInput: SpeakerInput = {
  name: "Speaker",
  bio: "Bio",
  specialty: "Specialty",
  talk: "Talk",
  day: "DAY1",
  linkedin: "https://linkedin.com/in/test",
  avatarUrl: null
};

describe("Speaker use cases", () => {
  let repository: InMemorySpeakerRepository;
  beforeEach(() => { repository = new InMemorySpeakerRepository(); });

  it("cria e lista speakers", async () => {
    await new CreateSpeaker(repository).execute(baseInput);
    expect((await new ListSpeakers(repository).execute())).toHaveLength(1);
  });

  it("atualiza speaker", async () => {
    const created = await new CreateSpeaker(repository).execute(baseInput);
    const updated = await new UpdateSpeaker(repository).execute(created.id, { ...baseInput, name: "Novo Nome" });
    expect(updated.name).toBe("Novo Nome");
  });

  it("remove speaker", async () => {
    const created = await new CreateSpeaker(repository).execute(baseInput);
    await new DeleteSpeaker(repository).execute(created.id);
    expect(repository.items).toHaveLength(0);
  });
});

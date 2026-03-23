import { beforeEach, describe, expect, it } from "vitest";
import type { GuideRepository } from "../domain/guide.repository";
import { CreateGuideStep, CreateGuideTip, CreateVenue, DeleteGuideStep, DeleteGuideTip, DeleteVenue, ListGuideContent, UpdateGuideStep, UpdateGuideTip, UpdateVenue } from "./manage-guide";

class InMemoryGuideRepository implements GuideRepository {
  steps: any[] = [];
  tips: any[] = [];
  venues: any[] = [];
  async listSteps(includeDrafts = false) { return this.steps.filter((item) => includeDrafts || item.isPublished); }
  async findStepById(id: number) { return this.steps.find((item) => item.id === id) ?? null; }
  async createStep(data: any) { const item = { id: this.steps.length + 1, isPublished: true, sortOrder: 0, ...data, createdAt: new Date(), updatedAt: new Date() }; this.steps.push(item); return item; }
  async updateStep(id: number, data: any) { const index = this.steps.findIndex((item) => item.id === id); this.steps[index] = { ...this.steps[index], ...data }; return this.steps[index]; }
  async deleteStep(id: number) { this.steps = this.steps.filter((item) => item.id !== id); }
  async listTips(includeDrafts = false) { return this.tips.filter((item) => includeDrafts || item.isPublished); }
  async findTipById(id: number) { return this.tips.find((item) => item.id === id) ?? null; }
  async createTip(data: any) { const item = { id: this.tips.length + 1, isPublished: true, sortOrder: 0, ...data, createdAt: new Date(), updatedAt: new Date() }; this.tips.push(item); return item; }
  async updateTip(id: number, data: any) { const index = this.tips.findIndex((item) => item.id === id); this.tips[index] = { ...this.tips[index], ...data }; return this.tips[index]; }
  async deleteTip(id: number) { this.tips = this.tips.filter((item) => item.id !== id); }
  async listVenues(includeDrafts = false) { return this.venues.filter((item) => includeDrafts || item.isPublished); }
  async findVenueById(id: number) { return this.venues.find((item) => item.id === id) ?? null; }
  async createVenue(data: any) { const item = { id: this.venues.length + 1, isPublished: true, sortOrder: 0, ...data, createdAt: new Date(), updatedAt: new Date() }; this.venues.push(item); return item; }
  async updateVenue(id: number, data: any) { const index = this.venues.findIndex((item) => item.id === id); this.venues[index] = { ...this.venues[index], ...data }; return this.venues[index]; }
  async deleteVenue(id: number) { this.venues = this.venues.filter((item) => item.id !== id); }
}

describe("Guide use cases", () => {
  let repository: InMemoryGuideRepository;
  beforeEach(() => { repository = new InMemoryGuideRepository(); });

  it("cria e lista conteúdos de guia", async () => {
    await new CreateGuideStep(repository).execute({ title: "Step", description: "Desc", icon: "UserCheck" });
    await new CreateGuideTip(repository).execute({ content: "Tip" });
    await new CreateVenue(repository).execute({ name: "Auditório", description: "Desc", capacity: "100", floor: "Piso 0" });
    const content = await new ListGuideContent(repository).execute();
    expect(content.steps).toHaveLength(1);
    expect(content.tips).toHaveLength(1);
    expect(content.venues).toHaveLength(1);
  });

  it("atualiza conteúdos", async () => {
    const step = await new CreateGuideStep(repository).execute({ title: "Step", description: "Desc", icon: "UserCheck" });
    const tip = await new CreateGuideTip(repository).execute({ content: "Tip" });
    const venue = await new CreateVenue(repository).execute({ name: "Auditório", description: "Desc", capacity: "100", floor: "Piso 0" });
    expect((await new UpdateGuideStep(repository).execute(step.id, { title: "Novo", description: "Desc", icon: "UserCheck" })).title).toBe("Novo");
    expect((await new UpdateGuideTip(repository).execute(tip.id, { content: "Nova tip" })).content).toBe("Nova tip");
    expect((await new UpdateVenue(repository).execute(venue.id, { name: "Sala", description: "Desc", capacity: "20", floor: "Piso 1" })).name).toBe("Sala");
  });

  it("remove conteúdos", async () => {
    const step = await new CreateGuideStep(repository).execute({ title: "Step", description: "Desc", icon: "UserCheck" });
    const tip = await new CreateGuideTip(repository).execute({ content: "Tip" });
    const venue = await new CreateVenue(repository).execute({ name: "Auditório", description: "Desc", capacity: "100", floor: "Piso 0" });
    await new DeleteGuideStep(repository).execute(step.id);
    await new DeleteGuideTip(repository).execute(tip.id);
    await new DeleteVenue(repository).execute(venue.id);
    expect(repository.steps).toHaveLength(0);
    expect(repository.tips).toHaveLength(0);
    expect(repository.venues).toHaveLength(0);
  });
});

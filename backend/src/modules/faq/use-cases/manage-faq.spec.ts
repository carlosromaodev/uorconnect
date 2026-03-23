import { beforeEach, describe, expect, it } from "vitest";
import type { FaqInput, FaqItem } from "../domain/faq";
import type { FaqRepository } from "../domain/faq.repository";
import { CreateFaqItem, DeleteFaqItem, ListFaqItems, UpdateFaqItem } from "./manage-faq";

class InMemoryFaqRepository implements FaqRepository {
  items: FaqItem[] = [];

  async list(includeDrafts = false): Promise<FaqItem[]> {
    return this.items
      .filter((item) => includeDrafts || item.isPublished)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  async findById(id: number): Promise<FaqItem | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }
  async create(data: FaqInput): Promise<FaqItem> {
    const item: FaqItem = {
      id: this.items.length + 1,
      question: data.question,
      answer: data.answer,
      sortOrder: data.sortOrder ?? 0,
      isPublished: data.isPublished ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.items.push(item);
    return item;
  }
  async update(id: number, data: FaqInput): Promise<FaqItem> {
    const index = this.items.findIndex((item) => item.id === id);
    this.items[index] = { ...this.items[index], ...data, sortOrder: data.sortOrder ?? 0, isPublished: data.isPublished ?? true };
    return this.items[index];
  }
  async delete(id: number): Promise<void> {
    this.items = this.items.filter((item) => item.id !== id);
  }
}

describe("FAQ use cases", () => {
  let repository: InMemoryFaqRepository;

  beforeEach(() => {
    repository = new InMemoryFaqRepository();
  });

  it("cria e lista FAQs", async () => {
    await new CreateFaqItem(repository).execute({ question: "Q1", answer: "A1", sortOrder: 2 });
    await new CreateFaqItem(repository).execute({ question: "Q2", answer: "A2", sortOrder: 1 });

    const result = await new ListFaqItems(repository).execute();
    expect(result.map((item) => item.question)).toEqual(["Q2", "Q1"]);
  });

  it("atualiza FAQ", async () => {
    const created = await new CreateFaqItem(repository).execute({ question: "Q1", answer: "A1" });
    const updated = await new UpdateFaqItem(repository).execute(created.id, { question: "QX", answer: "AX", isPublished: false });
    expect(updated.question).toBe("QX");
    expect(updated.isPublished).toBe(false);
  });

  it("remove FAQ", async () => {
    const created = await new CreateFaqItem(repository).execute({ question: "Q1", answer: "A1" });
    await new DeleteFaqItem(repository).execute(created.id);
    expect(repository.items).toHaveLength(0);
  });
});

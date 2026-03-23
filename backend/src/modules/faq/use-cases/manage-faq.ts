import type { FaqInput } from "../domain/faq";
import type { FaqRepository } from "../domain/faq.repository";

export class ListFaqItems {
  constructor(private readonly faqRepository: FaqRepository) {}
  async execute(includeDrafts = false) {
    return this.faqRepository.list(includeDrafts);
  }
}

export class CreateFaqItem {
  constructor(private readonly faqRepository: FaqRepository) {}
  async execute(data: FaqInput) {
    return this.faqRepository.create(data);
  }
}

export class UpdateFaqItem {
  constructor(private readonly faqRepository: FaqRepository) {}
  async execute(id: number, data: FaqInput) {
    const existing = await this.faqRepository.findById(id);
    if (!existing) throw new Error("FAQ not found");
    return this.faqRepository.update(id, data);
  }
}

export class DeleteFaqItem {
  constructor(private readonly faqRepository: FaqRepository) {}
  async execute(id: number) {
    const existing = await this.faqRepository.findById(id);
    if (!existing) throw new Error("FAQ not found");
    await this.faqRepository.delete(id);
  }
}

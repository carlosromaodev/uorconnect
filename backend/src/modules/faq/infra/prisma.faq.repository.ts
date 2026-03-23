import { prisma } from "../../../shared/prisma";
import type { FaqInput, FaqItem } from "../domain/faq";
import type { FaqRepository } from "../domain/faq.repository";

export class PrismaFaqRepository implements FaqRepository {
  async list(includeDrafts = false): Promise<FaqItem[]> {
    return prisma.faqItem.findMany({
      where: includeDrafts ? {} : { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  }

  async findById(id: number): Promise<FaqItem | null> {
    return prisma.faqItem.findUnique({ where: { id } });
  }

  async create(data: FaqInput): Promise<FaqItem> {
    return prisma.faqItem.create({
      data: {
        question: data.question,
        answer: data.answer,
        sortOrder: data.sortOrder ?? 0,
        isPublished: data.isPublished ?? true
      }
    });
  }

  async update(id: number, data: FaqInput): Promise<FaqItem> {
    return prisma.faqItem.update({
      where: { id },
      data: {
        question: data.question,
        answer: data.answer,
        sortOrder: data.sortOrder ?? 0,
        isPublished: data.isPublished ?? true
      }
    });
  }

  async delete(id: number): Promise<void> {
    await prisma.faqItem.delete({ where: { id } });
  }
}

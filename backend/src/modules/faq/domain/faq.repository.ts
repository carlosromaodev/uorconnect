import type { FaqInput, FaqItem } from "./faq";

export interface FaqRepository {
  list(includeDrafts?: boolean): Promise<FaqItem[]>;
  findById(id: number): Promise<FaqItem | null>;
  create(data: FaqInput): Promise<FaqItem>;
  update(id: number, data: FaqInput): Promise<FaqItem>;
  delete(id: number): Promise<void>;
}

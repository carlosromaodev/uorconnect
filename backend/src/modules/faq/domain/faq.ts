export type FaqItem = {
  id: number;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type FaqInput = {
  question: string;
  answer: string;
  sortOrder?: number;
  isPublished?: boolean;
};

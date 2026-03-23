import type { Speaker } from "@prisma/client";

export type SpeakerInput = {
  name: string;
  bio: string;
  specialty: string;
  talk: string;
  day: string;
  linkedin: string;
  avatarUrl?: string | null;
};

export interface SpeakerRepository {
  list(): Promise<Speaker[]>;
  findById(id: number): Promise<Speaker | null>;
  create(data: SpeakerInput): Promise<Speaker>;
  update(id: number, data: SpeakerInput): Promise<Speaker>;
  delete(id: number): Promise<void>;
}

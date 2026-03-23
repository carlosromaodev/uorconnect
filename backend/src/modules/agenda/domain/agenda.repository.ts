import type { AgendaItem, LiveContentConfig } from "@prisma/client";

export type AgendaInput = {
  day: "DAY1" | "DAY2";
  date: Date;
  startTime: string;
  endTime: string;
  title: string;
  local: string;
  speaker: string;
  description: string;
  type: "PANEL" | "WORKSHOP" | "PRESENTATION" | "CEREMONY" | "BREAK";
  theme: string;
};

export type AgendaLiveConfigInput = {
  mode: "AGENDA" | "MANUAL";
  current: {
    day: "DAY1" | "DAY2";
    date: Date;
    startTime: string;
    endTime: string;
    title: string;
    local: string;
    speaker: string;
    description: string;
    type: "PANEL" | "WORKSHOP" | "PRESENTATION" | "CEREMONY" | "BREAK";
    theme: string;
  } | null;
};

export interface AgendaRepository {
  list(): Promise<AgendaItem[]>;
  findById(id: number): Promise<AgendaItem | null>;
  create(data: AgendaInput): Promise<AgendaItem>;
  update(id: number, data: AgendaInput): Promise<AgendaItem>;
  delete(id: number): Promise<void>;
  getLiveConfig(): Promise<LiveContentConfig>;
  updateLiveConfig(data: AgendaLiveConfigInput): Promise<LiveContentConfig>;
}

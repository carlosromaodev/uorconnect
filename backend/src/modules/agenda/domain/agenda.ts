export type AgendaDay = "DAY1" | "DAY2";
export type AgendaType = "PANEL" | "WORKSHOP" | "PRESENTATION" | "CEREMONY" | "BREAK";

export type AgendaItem = {
  id: number;
  day: AgendaDay;
  date: Date;
  startTime: string;
  endTime: string;
  title: string;
  local: string;
  speaker: string;
  description: string;
  type: AgendaType;
  theme: string;
};

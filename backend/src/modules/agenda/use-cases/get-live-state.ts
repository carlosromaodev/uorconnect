import type { AgendaItem } from "@prisma/client";
import type { AgendaRepository } from "../domain/agenda.repository";

export type AgendaLiveState = {
  current: AgendaItem | null;
  next: AgendaItem | null;
};

const ANGOLA_TIMEZONE_OFFSET = "+01:00";
const LIVE_GENERAL_THEME = "geral";

export function getAgendaTimestamp(item: AgendaItem, time: string) {
  return new Date(`${item.date.toISOString().slice(0, 10)}T${time}:00.000${ANGOLA_TIMEZONE_OFFSET}`).getTime();
}

export function isGeneralAgendaTheme(theme?: string | null) {
  return theme?.trim().toLocaleLowerCase("pt-PT") === LIVE_GENERAL_THEME;
}

export function resolveAgendaLiveState(items: AgendaItem[], now: Date): AgendaLiveState {
  const sorted = items.filter((item) => isGeneralAgendaTheme(item.theme)).sort(
    (left, right) => getAgendaTimestamp(left, left.startTime) - getAgendaTimestamp(right, right.startTime)
  );

  const current = sorted.find((item) => {
    const start = getAgendaTimestamp(item, item.startTime);
    const end = getAgendaTimestamp(item, item.endTime);
    return now.getTime() >= start && now.getTime() <= end;
  }) ?? null;

  const currentStart = current ? getAgendaTimestamp(current, current.startTime) : now.getTime();
  const next = sorted.find((item) => getAgendaTimestamp(item, item.startTime) > currentStart) ?? null;

  return { current, next };
}

export class GetAgendaLiveState {
  constructor(private readonly agendaRepository: AgendaRepository) {}

  async execute(now = new Date()): Promise<AgendaLiveState> {
    const items = await this.agendaRepository.list();
    return resolveAgendaLiveState(items, now);
  }
}

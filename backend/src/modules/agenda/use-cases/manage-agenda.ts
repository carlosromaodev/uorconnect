import type { AgendaInput, AgendaLiveConfigInput, AgendaRepository } from "../domain/agenda.repository";
import { isGeneralAgendaTheme, resolveAgendaLiveState } from "./get-live-state";

export class ListAgendaItems {
  constructor(private readonly agendaRepository: AgendaRepository) {}
  async execute() { return this.agendaRepository.list(); }
}

export class CreateAgendaItem {
  constructor(private readonly agendaRepository: AgendaRepository) {}
  async execute(data: AgendaInput) { return this.agendaRepository.create(data); }
}

export class UpdateAgendaItem {
  constructor(private readonly agendaRepository: AgendaRepository) {}
  async execute(id: number, data: AgendaInput) {
    const existing = await this.agendaRepository.findById(id);
    if (!existing) throw new Error("Agenda item not found");
    return this.agendaRepository.update(id, data);
  }
}

export class DeleteAgendaItem {
  constructor(private readonly agendaRepository: AgendaRepository) {}
  async execute(id: number) {
    const existing = await this.agendaRepository.findById(id);
    if (!existing) throw new Error("Agenda item not found");
    await this.agendaRepository.delete(id);
  }
}

export class GetAgendaLiveConfig {
  constructor(private readonly agendaRepository: AgendaRepository) {}
  async execute() { return this.agendaRepository.getLiveConfig(); }
}

export class UpdateAgendaLiveConfig {
  constructor(private readonly agendaRepository: AgendaRepository) {}

  async execute(data: AgendaLiveConfigInput, now = new Date()) {
    if (data.mode === "MANUAL" && !data.current) {
      throw new Error("O conteúdo atual é obrigatório no modo manual.");
    }

    if (data.mode === "MANUAL" && data.current && !isGeneralAgendaTheme(data.current.theme)) {
      throw new Error('O Ao Vivo só aceita conteúdos com o tema "Geral" da agenda.');
    }

    const updatedConfig = await this.agendaRepository.updateLiveConfig(data);

    if (data.mode === "MANUAL" && data.current) {
      const items = await this.agendaRepository.list();
      const { current } = resolveAgendaLiveState(items, now);

      if (current) {
        await this.agendaRepository.update(current.id, {
          day: data.current.day,
          date: current.date,
          startTime: current.startTime,
          endTime: current.endTime,
          title: data.current.title,
          local: data.current.local,
          speaker: data.current.speaker,
          description: data.current.description,
          type: data.current.type,
          theme: data.current.theme
        });
      }
    }

    return updatedConfig;
  }
}

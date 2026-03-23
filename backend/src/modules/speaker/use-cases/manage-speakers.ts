import type { SpeakerInput, SpeakerRepository } from "../domain/speaker.repository";

export class ListSpeakers {
  constructor(private readonly speakerRepository: SpeakerRepository) {}
  async execute() { return this.speakerRepository.list(); }
}

export class CreateSpeaker {
  constructor(private readonly speakerRepository: SpeakerRepository) {}
  async execute(data: SpeakerInput) { return this.speakerRepository.create(data); }
}

export class UpdateSpeaker {
  constructor(private readonly speakerRepository: SpeakerRepository) {}
  async execute(id: number, data: SpeakerInput) {
    const existing = await this.speakerRepository.findById(id);
    if (!existing) throw new Error("Speaker not found");
    return this.speakerRepository.update(id, data);
  }
}

export class DeleteSpeaker {
  constructor(private readonly speakerRepository: SpeakerRepository) {}
  async execute(id: number) {
    const existing = await this.speakerRepository.findById(id);
    if (!existing) throw new Error("Speaker not found");
    await this.speakerRepository.delete(id);
  }
}

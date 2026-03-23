import type { GuideRepository, GuideStepInput, GuideTipInput, VenueInput } from "../domain/guide.repository";

export class ListGuideContent {
  constructor(private readonly guideRepository: GuideRepository) {}
  async execute(includeDrafts = false) {
    const [steps, tips, venues] = await Promise.all([
      this.guideRepository.listSteps(includeDrafts),
      this.guideRepository.listTips(includeDrafts),
      this.guideRepository.listVenues(includeDrafts)
    ]);
    return { steps, tips, venues };
  }
}

export class CreateGuideStep {
  constructor(private readonly guideRepository: GuideRepository) {}
  async execute(data: GuideStepInput) { return this.guideRepository.createStep(data); }
}
export class UpdateGuideStep {
  constructor(private readonly guideRepository: GuideRepository) {}
  async execute(id: number, data: GuideStepInput) {
    const existing = await this.guideRepository.findStepById(id);
    if (!existing) throw new Error("Guide step not found");
    return this.guideRepository.updateStep(id, data);
  }
}
export class DeleteGuideStep {
  constructor(private readonly guideRepository: GuideRepository) {}
  async execute(id: number) {
    const existing = await this.guideRepository.findStepById(id);
    if (!existing) throw new Error("Guide step not found");
    await this.guideRepository.deleteStep(id);
  }
}

export class CreateGuideTip {
  constructor(private readonly guideRepository: GuideRepository) {}
  async execute(data: GuideTipInput) { return this.guideRepository.createTip(data); }
}
export class UpdateGuideTip {
  constructor(private readonly guideRepository: GuideRepository) {}
  async execute(id: number, data: GuideTipInput) {
    const existing = await this.guideRepository.findTipById(id);
    if (!existing) throw new Error("Guide tip not found");
    return this.guideRepository.updateTip(id, data);
  }
}
export class DeleteGuideTip {
  constructor(private readonly guideRepository: GuideRepository) {}
  async execute(id: number) {
    const existing = await this.guideRepository.findTipById(id);
    if (!existing) throw new Error("Guide tip not found");
    await this.guideRepository.deleteTip(id);
  }
}

export class CreateVenue {
  constructor(private readonly guideRepository: GuideRepository) {}
  async execute(data: VenueInput) { return this.guideRepository.createVenue(data); }
}
export class UpdateVenue {
  constructor(private readonly guideRepository: GuideRepository) {}
  async execute(id: number, data: VenueInput) {
    const existing = await this.guideRepository.findVenueById(id);
    if (!existing) throw new Error("Venue not found");
    return this.guideRepository.updateVenue(id, data);
  }
}
export class DeleteVenue {
  constructor(private readonly guideRepository: GuideRepository) {}
  async execute(id: number) {
    const existing = await this.guideRepository.findVenueById(id);
    if (!existing) throw new Error("Venue not found");
    await this.guideRepository.deleteVenue(id);
  }
}

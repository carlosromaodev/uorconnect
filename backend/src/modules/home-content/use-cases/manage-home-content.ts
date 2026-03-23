import type { HomeContentRepository, HomeCourseInput, HomeSocialConfigInput, PanelTopicInput } from "../domain/home-content.repository";

export class ListHomeContent {
  constructor(private readonly repository: HomeContentRepository) {}

  async execute(includeDrafts = false) {
    const [courses, panelTopics, socialConfig] = await Promise.all([
      this.repository.listCourses(includeDrafts),
      this.repository.listPanelTopics(includeDrafts),
      this.repository.getSocialConfig()
    ]);

    return { courses, panelTopics, socialConfig };
  }
}

export class UpdateHomeSocialConfig {
  constructor(private readonly repository: HomeContentRepository) {}

  async execute(data: HomeSocialConfigInput) {
    return this.repository.updateSocialConfig(data);
  }
}

export class CreateHomeCourse {
  constructor(private readonly repository: HomeContentRepository) {}
  async execute(data: HomeCourseInput) {
    return this.repository.createCourse(data);
  }
}

export class UpdateHomeCourse {
  constructor(private readonly repository: HomeContentRepository) {}
  async execute(id: number, data: HomeCourseInput) {
    const existing = await this.repository.findCourseById(id);
    if (!existing) throw new Error("Course not found");
    return this.repository.updateCourse(id, data);
  }
}

export class DeleteHomeCourse {
  constructor(private readonly repository: HomeContentRepository) {}
  async execute(id: number) {
    const existing = await this.repository.findCourseById(id);
    if (!existing) throw new Error("Course not found");
    await this.repository.deleteCourse(id);
  }
}

export class CreatePanelTopic {
  constructor(private readonly repository: HomeContentRepository) {}
  async execute(data: PanelTopicInput) {
    return this.repository.createPanelTopic(data);
  }
}

export class UpdatePanelTopic {
  constructor(private readonly repository: HomeContentRepository) {}
  async execute(id: number, data: PanelTopicInput) {
    const existing = await this.repository.findPanelTopicById(id);
    if (!existing) throw new Error("Panel topic not found");
    return this.repository.updatePanelTopic(id, data);
  }
}

export class DeletePanelTopic {
  constructor(private readonly repository: HomeContentRepository) {}
  async execute(id: number) {
    const existing = await this.repository.findPanelTopicById(id);
    if (!existing) throw new Error("Panel topic not found");
    await this.repository.deletePanelTopic(id);
  }
}

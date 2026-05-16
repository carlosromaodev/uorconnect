import { beforeEach, describe, expect, it } from "vitest";
import type { HomeCourse, PanelTopic } from "@prisma/client";
import type { HomeContentRepository, HomeCourseInput, HomeSocialConfigInput, HomeSocialConfigRecord, PanelTopicInput } from "../domain/home-content.repository";
import {
  CreateHomeCourse,
  CreatePanelTopic,
  DeleteHomeCourse,
  DeletePanelTopic,
  ListHomeContent,
  UpdateHomeSocialConfig,
  UpdateHomeCourse,
  UpdatePanelTopic
} from "./manage-home-content";

class InMemoryHomeContentRepository implements HomeContentRepository {
  courses: HomeCourse[] = [];
  panelTopics: PanelTopic[] = [];
  socialConfig: HomeSocialConfigRecord = {
    key: "default",
    instagramUrl: "https://www.instagram.com/uorconnect??igsh=bmo4enl2cGN2cGc2&utm_source=qr",
    facebookUrl: null,
    linkedinUrl: null,
    courseEnrollmentEnabled: true,
    firstYearContestEnabled: true,
    primaryColor: "#f97316",
    primaryGradient: "linear-gradient(135deg, rgba(249,115,22,0.16) 0%, rgba(251,146,60,0.28) 100%)",
    titleColor: "#111827",
    accentColor: "#f97316",
    dashedColor: "#f97316",
    dashedOpacity: 35,
    heroIconsOpacity: 18,
    heroBlobsIntensity: 68,
    heroMeshEnabled: true,
    heroBadgeText: "Plataforma Académica Digital · Chave-na-Mão",
    heroTitlePrefix: "3ª edição da",
    heroTitleHighlight: "Feira do Dia das Telecomunicações",
    heroSubtitleText: "Conectando o Conhecimento Académico ao Mercado Tecnológico com Energia e Empreendedorismo.",
    heroSubtitleColor: "#4b5563",
    heroTitleMobileSize: "2.8rem",
    heroTitleTabletSize: "4.2rem",
    heroTitleDesktopSize: "5.4rem",
    heroSubtitleMobileSize: "1.05rem",
    heroSubtitleTabletSize: "1.20rem",
    heroSubtitleDesktopSize: "1.35rem",
    heroFloatingIcons: [{ id: "hero-icon-1", icon: "WifiHigh", top: 20, left: 15, size: 34, rotate: 0, opacity: 18 }],
    sponsors: [{ id: "sponsor-1", name: "UOR Connect", imageUrl: "/logo-gestor.png", label: "UOR Connect" }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  async listCourses(includeDrafts = false) {
    return this.courses.filter((item) => includeDrafts || item.isPublished);
  }
  async findCourseById(id: number) {
    return this.courses.find((item) => item.id === id) ?? null;
  }
  async createCourse(data: HomeCourseInput) {
    const item = { id: this.courses.length + 1, ctaText: null, sortOrder: 0, isPublished: true, ...data, createdAt: new Date(), updatedAt: new Date() };
    this.courses.push(item);
    return item;
  }
  async updateCourse(id: number, data: HomeCourseInput) {
    const index = this.courses.findIndex((item) => item.id === id);
    this.courses[index] = { ...this.courses[index], ...data };
    return this.courses[index];
  }
  async deleteCourse(id: number) {
    this.courses = this.courses.filter((item) => item.id !== id);
  }

  async listPanelTopics(includeDrafts = false) {
    return this.panelTopics.filter((item) => includeDrafts || item.isPublished);
  }
  async findPanelTopicById(id: number) {
    return this.panelTopics.find((item) => item.id === id) ?? null;
  }
  async createPanelTopic(data: PanelTopicInput) {
    const item = { id: this.panelTopics.length + 1, sortOrder: 0, isPublished: true, ...data, createdAt: new Date(), updatedAt: new Date() };
    this.panelTopics.push(item);
    return item;
  }
  async updatePanelTopic(id: number, data: PanelTopicInput) {
    const index = this.panelTopics.findIndex((item) => item.id === id);
    this.panelTopics[index] = { ...this.panelTopics[index], ...data };
    return this.panelTopics[index];
  }
  async deletePanelTopic(id: number) {
    this.panelTopics = this.panelTopics.filter((item) => item.id !== id);
  }

  async getSocialConfig() {
    return this.socialConfig;
  }

  async updateSocialConfig(data: HomeSocialConfigInput) {
    this.socialConfig = { ...this.socialConfig, ...data, updatedAt: new Date() };
    return this.socialConfig;
  }
}

describe("Home content use cases", () => {
  let repository: InMemoryHomeContentRepository;

  beforeEach(() => {
    repository = new InMemoryHomeContentRepository();
  });

  it("creates and lists courses and panel topics", async () => {
    await new CreateHomeCourse(repository).execute({ title: "Curso 5G", description: "Intro", icon: "BookOpen" });
    await new CreatePanelTopic(repository).execute({
      title: "Painel IA",
      description: "Desc",
      speaker: "Ana",
      time: "09:00",
      local: "Auditório",
      day: "Dia 1",
      dateLabel: "17 Mai",
      icon: "Mic",
      type: "Painel"
    });

    const result = await new ListHomeContent(repository).execute();
    expect(result.courses).toHaveLength(1);
    expect(result.panelTopics).toHaveLength(1);
    expect(result.socialConfig.instagramUrl).toContain("instagram.com/uorconnect");
  });

  it("updates content", async () => {
    const course = await new CreateHomeCourse(repository).execute({ title: "Curso 5G", description: "Intro", icon: "BookOpen" });
    const panel = await new CreatePanelTopic(repository).execute({
      title: "Painel IA",
      description: "Desc",
      speaker: "Ana",
      time: "09:00",
      local: "Auditório",
      day: "Dia 1",
      dateLabel: "17 Mai",
      icon: "Mic",
      type: "Painel"
    });

    expect((await new UpdateHomeCourse(repository).execute(course.id, { title: "Curso Git", description: "Novo", icon: "BookOpen" })).title).toBe("Curso Git");
    expect((await new UpdatePanelTopic(repository).execute(panel.id, {
      title: "Painel Cloud",
      description: "Nova",
      speaker: "Pedro",
      time: "10:00",
      local: "Sala 2",
      day: "Dia 2",
      dateLabel: "18 Mai",
      icon: "Zap",
      type: "Painel"
    })).title).toBe("Painel Cloud");
  });

  it("deletes content", async () => {
    const course = await new CreateHomeCourse(repository).execute({ title: "Curso 5G", description: "Intro", icon: "BookOpen" });
    const panel = await new CreatePanelTopic(repository).execute({
      title: "Painel IA",
      description: "Desc",
      speaker: "Ana",
      time: "09:00",
      local: "Auditório",
      day: "Dia 1",
      dateLabel: "17 Mai",
      icon: "Mic",
      type: "Painel"
    });
    await new DeleteHomeCourse(repository).execute(course.id);
    await new DeletePanelTopic(repository).execute(panel.id);
    expect(repository.courses).toHaveLength(0);
    expect(repository.panelTopics).toHaveLength(0);
  });

  it("updates social config", async () => {
    const result = await new UpdateHomeSocialConfig(repository).execute({
      facebookUrl: "https://facebook.com/uorconnect",
      linkedinUrl: "https://linkedin.com/company/uorconnect",
      courseEnrollmentEnabled: false,
      firstYearContestEnabled: false,
    });

    expect(result.facebookUrl).toContain("facebook.com/uorconnect");
    expect(result.linkedinUrl).toContain("linkedin.com/company/uorconnect");
    expect(result.courseEnrollmentEnabled).toBe(false);
    expect(result.firstYearContestEnabled).toBe(false);
  });
});

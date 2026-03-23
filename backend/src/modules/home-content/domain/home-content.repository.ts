import type { HomeCourse, HomeSocialConfig, PanelTopic } from "@prisma/client";

export type HomeCourseInput = {
  title: string;
  description: string;
  icon: string;
  ctaText?: string | null;
  sortOrder?: number;
  isPublished?: boolean;
};

export type PanelTopicInput = {
  title: string;
  description: string;
  speaker: string;
  time: string;
  local: string;
  day: string;
  dateLabel: string;
  icon: string;
  type: string;
  sortOrder?: number;
  isPublished?: boolean;
};

export type HomeSocialConfigInput = {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
};

export interface HomeContentRepository {
  listCourses(includeDrafts?: boolean): Promise<HomeCourse[]>;
  findCourseById(id: number): Promise<HomeCourse | null>;
  createCourse(data: HomeCourseInput): Promise<HomeCourse>;
  updateCourse(id: number, data: HomeCourseInput): Promise<HomeCourse>;
  deleteCourse(id: number): Promise<void>;

  listPanelTopics(includeDrafts?: boolean): Promise<PanelTopic[]>;
  findPanelTopicById(id: number): Promise<PanelTopic | null>;
  createPanelTopic(data: PanelTopicInput): Promise<PanelTopic>;
  updatePanelTopic(id: number, data: PanelTopicInput): Promise<PanelTopic>;
  deletePanelTopic(id: number): Promise<void>;

  getSocialConfig(): Promise<HomeSocialConfig>;
  updateSocialConfig(data: HomeSocialConfigInput): Promise<HomeSocialConfig>;
}

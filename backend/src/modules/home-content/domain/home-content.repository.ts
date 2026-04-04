import type { HomeCourse, HomeSocialConfig, PanelTopic } from "@prisma/client";

export type HeroFloatingIconInput = {
  id: string;
  icon: string;
  top: number;
  left: number;
  size: number;
  rotate: number;
  opacity: number;
};

export type HomeSponsorInput = {
  id: string;
  name: string;
  imageUrl: string;
  label?: string | null;
};

export type HomeSocialConfigRecord = Omit<HomeSocialConfig, "heroFloatingIconsJson" | "sponsorsJson"> & {
  heroFloatingIcons: HeroFloatingIconInput[];
  sponsors: HomeSponsorInput[];
};

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
  courseEnrollmentEnabled?: boolean;
  firstYearContestEnabled?: boolean;
  primaryColor?: string;
  primaryGradient?: string;
  titleColor?: string;
  accentColor?: string;
  dashedColor?: string;
  dashedOpacity?: number;
  heroIconsOpacity?: number;
  heroBlobsIntensity?: number;
  heroMeshEnabled?: boolean;
  heroBadgeText?: string;
  heroTitlePrefix?: string;
  heroTitleHighlight?: string;
  heroSubtitleText?: string;
  heroSubtitleColor?: string;
  heroTitleMobileSize?: string;
  heroTitleTabletSize?: string;
  heroTitleDesktopSize?: string;
  heroSubtitleMobileSize?: string;
  heroSubtitleTabletSize?: string;
  heroSubtitleDesktopSize?: string;
  heroFloatingIcons?: HeroFloatingIconInput[];
  sponsors?: HomeSponsorInput[];
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

  getSocialConfig(): Promise<HomeSocialConfigRecord>;
  updateSocialConfig(data: HomeSocialConfigInput): Promise<HomeSocialConfigRecord>;
}

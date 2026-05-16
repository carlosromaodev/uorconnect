import type { HeroFloatingIcon, HomeContent, HomeSocialConfig, HomeSponsor } from "@/lib/api";

export const defaultHeroFloatingIcons: HeroFloatingIcon[] = [
  { id: "hero-icon-1", icon: "WifiHigh", top: 12, left: 8, size: 34, rotate: 0, opacity: 18 },
  { id: "hero-icon-2", icon: "Radio", top: 30, left: 72, size: 42, rotate: 24, opacity: 16 },
  { id: "hero-icon-3", icon: "GlobeHemisphereWest", top: 58, left: 18, size: 36, rotate: -18, opacity: 15 },
  { id: "hero-icon-4", icon: "CellSignalHigh", top: 72, left: 84, size: 38, rotate: 14, opacity: 14 },
];

export const defaultHeroSponsors: HomeSponsor[] = [
  { id: "uor", name: "Universidade Óscar Ribas", imageUrl: "/logo-uor.png", label: null },
  { id: "neic", name: "Núcleo de Engenharia Informática e Comunicações", imageUrl: "/logo-neic.jpeg", label: null },
  { id: "uor-connect", name: "UOR Connect", imageUrl: "/logoworconnect.png", label: null },
];

export const UOR_EVENT_TITLE_PREFIX = "3ª Edição do";
export const UOR_EVENT_TITLE_HIGHLIGHT = "Workshop Alusivo ao Dia das Telecomunicações e da Sociedade da Informação";
export const UOR_EVENT_LEMA = "Da sala de aula ao mercado de trabalho";

export const defaultHomeSocialConfig: HomeSocialConfig = {
  key: "default",
  instagramUrl: null,
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
  heroBadgeText: "UOR Connect · Workshop",
  heroTitlePrefix: UOR_EVENT_TITLE_PREFIX,
  heroTitleHighlight: UOR_EVENT_TITLE_HIGHLIGHT,
  heroSubtitleText: UOR_EVENT_LEMA,
  heroSubtitleColor: "#4b5563",
  heroTitleMobileSize: "2.8rem",
  heroTitleTabletSize: "4.2rem",
  heroTitleDesktopSize: "5.4rem",
  heroSubtitleMobileSize: "1.05rem",
  heroSubtitleTabletSize: "1.20rem",
  heroSubtitleDesktopSize: "1.35rem",
  heroFloatingIcons: defaultHeroFloatingIcons,
  sponsors: defaultHeroSponsors,
  createdAt: "",
  updatedAt: "",
};

export const defaultHomeContent: HomeContent = {
  courses: [],
  panelTopics: [],
  socialConfig: defaultHomeSocialConfig,
};

export function isCourseEnrollmentEnabled(config?: HomeSocialConfig | null) {
  return config?.courseEnrollmentEnabled ?? true;
}

export function isFirstYearContestEnabled(config?: HomeSocialConfig | null) {
  return config?.firstYearContestEnabled ?? true;
}

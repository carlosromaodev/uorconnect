import type { ComponentType, SVGProps } from "react";
import {
  BookOpen,
  Building2,
  Cpu,
  Globe,
  GraduationCap,
  Heart,
  MessageSquare,
  Mic,
  Palette,
  Presentation,
  Radio,
  Rocket,
  ShieldCheck,
  Signal,
  Smartphone,
  Sparkles,
  Trophy,
  TrendingUp,
  UserCheck,
  Users,
  Wifi,
  Zap,
} from "lucide-react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const iconRegistry = {
  WifiHigh: Wifi,
  Radio,
  GlobeHemisphereWest: Globe,
  CellSignalHigh: Signal,
  DeviceMobile: Smartphone,
  Lightning: Zap,
  ChatCenteredText: MessageSquare,
  BookOpen,
  Mic,
  UserCheck,
  UsersThree: Users,
  Trophy,
  TrendUp: TrendingUp,
  Heart,
  Palette,
  Sparkle: Sparkles,
  Presentation,
  Rocket,
  ShieldCheck,
  Building2,
  GraduationCap,
  Cpu,
} satisfies Record<string, IconComponent>;

const legacyHeroIconAliases: Record<string, string> = {
  Wifi: "WifiHigh",
  Globe: "GlobeHemisphereWest",
  Smartphone: "DeviceMobile",
  Signal: "CellSignalHigh",
  Zap: "Lightning",
  MessageSquare: "ChatCenteredText",
};

const iconNames = Object.keys(iconRegistry).sort((left, right) => left.localeCompare(right));
const iconMap = new Map<string, IconComponent>(Object.entries(iconRegistry));
const iconLookupMap = new Map<string, string>();

const fallbackIconName = "WifiHigh";

function toLookupKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

for (const iconName of iconNames) {
  iconLookupMap.set(toLookupKey(iconName), iconName);
}

for (const [alias, target] of Object.entries(legacyHeroIconAliases)) {
  if (iconMap.has(target)) {
    iconLookupMap.set(toLookupKey(alias), target);
  }
}

function resolveHeroIconName(iconName: string) {
  const trimmed = iconName.trim();
  if (!trimmed) return null;

  if (iconMap.has(trimmed)) {
    return trimmed;
  }

  const alias = legacyHeroIconAliases[trimmed];
  if (alias && iconMap.has(alias)) {
    return alias;
  }

  return iconLookupMap.get(toLookupKey(trimmed)) ?? null;
}

export function normalizeHeroIconName(iconName: string) {
  return resolveHeroIconName(iconName) ?? iconName.trim();
}

export function isHeroIconAvailable(iconName: string) {
  return resolveHeroIconName(iconName) !== null;
}

export function getHeroIconByName(iconName: string) {
  const resolved = resolveHeroIconName(iconName);
  return (resolved ? iconMap.get(resolved) : null) ?? iconMap.get(fallbackIconName) ?? (() => null);
}

export function getHeroIconSuggestions(iconName: string, limit = 10) {
  const query = iconName.trim().toLowerCase();
  if (!query) {
    return iconNames.slice(0, limit);
  }

  return iconNames
    .map((name) => {
      const lower = name.toLowerCase();
      const startsWith = lower.startsWith(query);
      const includes = lower.includes(query);
      const compactIncludes = toLookupKey(name).includes(toLookupKey(query));

      if (!startsWith && !includes && !compactIncludes) {
        return null;
      }

      return {
        name,
        score: startsWith ? 0 : includes ? 1 : 2,
      };
    })
    .filter((item): item is { name: string; score: number } => item !== null)
    .sort((left, right) => (left.score - right.score) || left.name.localeCompare(right.name))
    .slice(0, limit)
    .map((item) => item.name);
}

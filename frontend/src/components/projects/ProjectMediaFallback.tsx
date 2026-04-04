import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  Code2,
  Cpu,
  GraduationCap,
  Lightbulb,
  Package,
  Rocket,
  Sparkles,
  Zap,
} from "lucide-react";

const ICON_LAYOUT = [
  { left: "14%", top: "18%", rotate: -16, size: "h-8 w-8 sm:h-10 sm:w-10" },
  { left: "34%", top: "28%", rotate: 10, size: "h-10 w-10 sm:h-12 sm:w-12" },
  { left: "58%", top: "18%", rotate: -8, size: "h-9 w-9 sm:h-11 sm:w-11" },
  { left: "80%", top: "30%", rotate: 14, size: "h-8 w-8 sm:h-10 sm:w-10" },
  { left: "22%", top: "58%", rotate: 12, size: "h-10 w-10 sm:h-12 sm:w-12" },
  { left: "46%", top: "50%", rotate: -12, size: "h-12 w-12 sm:h-14 sm:w-14" },
  { left: "72%", top: "58%", rotate: 16, size: "h-9 w-9 sm:h-11 sm:w-11" },
  { left: "88%", top: "72%", rotate: -12, size: "h-8 w-8 sm:h-10 sm:w-10" },
  { left: "10%", top: "78%", rotate: 8, size: "h-8 w-8 sm:h-10 sm:w-10" },
];

function resolveBackdropIcons(theme: string): LucideIcon[] {
  const normalizedTheme = theme.toLowerCase();

  if (normalizedTheme.includes("negócio") || normalizedTheme.includes("negocio")) {
    return [Briefcase, Sparkles, Rocket, Zap, BookOpen];
  }

  if (
    normalizedTheme.includes("produto")
    || normalizedTheme.includes("software")
    || normalizedTheme.includes("hardware")
  ) {
    return [Package, Cpu, Code2, Sparkles, Zap];
  }

  return [Lightbulb, Code2, Cpu, GraduationCap, Rocket, BookOpen];
}

export function ProjectMediaFallback({
  area,
  typeLabel,
  primaryColor,
  secondaryColor,
  compact = false,
}: {
  area?: string | null;
  typeLabel?: string | null;
  primaryColor: string;
  secondaryColor: string;
  compact?: boolean;
}) {
  const icons = resolveBackdropIcons(`${typeLabel ?? ""} ${area ?? ""}`);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 18% 18%, ${primaryColor}44, transparent 32%), radial-gradient(circle at 82% 16%, ${secondaryColor}55, transparent 30%), linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.18),rgba(15,23,42,0.24))]" />

      {ICON_LAYOUT.map((item, index) => {
        const Icon = icons[index % icons.length];
        return (
          <div
            key={`${item.left}-${item.top}-${index}`}
            className="absolute rounded-full border border-white/6 bg-white/[0.04] p-3 text-white/12 shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur-[2px]"
            style={{
              left: item.left,
              top: item.top,
              transform: `translate(-50%, -50%) rotate(${item.rotate}deg) scale(${compact ? 0.82 : 1})`,
            }}
          >
            <Icon className={item.size} strokeWidth={1.5} />
          </div>
        );
      })}

      <div
        className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full blur-3xl sm:h-40 sm:w-40"
        style={{ backgroundColor: `${primaryColor}55` }}
      />
      <div
        className="absolute -right-12 top-4 h-36 w-36 rounded-full blur-3xl sm:h-44 sm:w-44"
        style={{ backgroundColor: `${secondaryColor}5c` }}
      />
    </div>
  );
}

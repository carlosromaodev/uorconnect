import React from "react";
import {
  Palette as LucidePalette,
  Blend as LucideGradient,
  Type as LucideTextAa,
  Slash as LucideLineSegments,
  Image as LucideImage,
  Sparkles as LucideSparkle,
  Eye as LucideEye,
  Save as LucideFloppy,
  Minus as LucideMinus,
  Zap as LucideLightning,
  Clock as LucideClock,
  Trophy as LucideTrophy,
  TrendingUp as LucideTrendUp,
  Heart as LucideHeart,
  MessageSquare as LucideChatTeardrop,
  Users as LucideUsers,
  Plus as LucidePlus,
  Trash2 as LucideTrash,
} from "lucide-react";

type IconProps = React.SVGProps<SVGSVGElement>;

const wrap = (Icon: React.ComponentType<IconProps>) => (props: IconProps) => <Icon {...props} />;

export const Palette = wrap(LucidePalette);
export const Gradient = wrap(LucideGradient);
export const TextAa = wrap(LucideTextAa);
export const LineSegments = wrap(LucideLineSegments);
export const Image = wrap(LucideImage);
export const Sparkle = wrap(LucideSparkle);
export const Eye = wrap(LucideEye);
export const FloppyDisk = wrap(LucideFloppy);
export const Minus = wrap(LucideMinus);
export const Lightning = wrap(LucideLightning);
export const Clock = wrap(LucideClock);
export const Trophy = wrap(LucideTrophy);
export const TrendUp = wrap(LucideTrendUp);
export const Heart = wrap(LucideHeart);
export const ChatTeardrop = wrap(LucideChatTeardrop);
export const UsersThree = wrap(LucideUsers);
export const Plus = wrap(LucidePlus);
export const Trash = wrap(LucideTrash);

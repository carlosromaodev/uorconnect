import type { ComponentPropsWithoutRef, HTMLAttributes } from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { contestTheme } from "@/components/challenges/contest-theme.tokens";

const contestCardVariants = cva(
  "relative min-w-0 overflow-hidden border shadow-[0_18px_48px_rgba(0,0,0,0.22)] transition-colors duration-200 ease-out",
  {
    variants: {
      tone: {
        default: `${contestTheme.border} ${contestTheme.surface} ${contestTheme.accentHover}`,
        accent: `${contestTheme.accentBorder} ${contestTheme.surfaceRaised} hover:border-[#7bd3c6]/34`,
        subtle: "border-white/8 bg-[rgba(255,255,255,0.03)] hover:border-[#7bd3c6]/26",
        muted: "border-[#182028] bg-[rgba(11,16,21,0.88)] hover:border-[#24313d]",
        terminal: "border-white/8 bg-[rgba(15,23,35,0.76)] hover:border-[#7bd3c6]/24",
        transparent: "border-white/6 bg-black/20 hover:border-[#7bd3c6]/20",
      },
      padding: {
        default: "p-5 md:p-6",
        compact: "p-4 md:p-5",
        cozy: "p-4",
        flush: "p-0",
      },
      radius: {
        default: "rounded-[28px]",
        lg: "rounded-[32px]",
        pill: "rounded-full",
      },
    },
    defaultVariants: {
      tone: "default",
      padding: "default",
      radius: "default",
    },
  },
);

type ContestCardProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof contestCardVariants>;

export function ContestCard({ className, tone, padding, radius, ...props }: ContestCardProps) {
  return <div className={cn(contestCardVariants({ tone, padding, radius }), className)} {...props} />;
}

const contestBadgeVariants = cva(
  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-tech-mono text-[11px] uppercase tracking-[0.18em]",
  {
    variants: {
      tone: {
        accent: "border-[#7bd3c6]/18 bg-[#7bd3c6]/10 text-[#7bd3c6]",
        neutral: "border-white/10 bg-white/[0.04] text-slate-300",
        muted: "border-[#25303c] bg-[#0f151b] text-[#7b8ca3]",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
        warning: "border-amber-500/20 bg-amber-500/10 text-amber-200",
        danger: "border-red-500/20 bg-red-500/10 text-red-200",
        accentStrong: "border-[#7bd3c6]/24 bg-[#7bd3c6] text-[#0f1720]",
      },
      size: {
        default: "",
        compact: "px-2.5 py-1 text-[10px] tracking-[0.16em]",
      },
    },
    defaultVariants: {
      tone: "accent",
      size: "default",
    },
  },
);

type ContestBadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof contestBadgeVariants>;

export function ContestBadge({ className, tone, size, ...props }: ContestBadgeProps) {
  return <span className={cn(contestBadgeVariants({ tone, size }), className)} {...props} />;
}

type ContestProgressBarProps = ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
};

export function ContestProgressBar({
  className,
  indicatorClassName,
  value = 0,
  ...props
}: ContestProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <ProgressPrimitive.Root
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full border border-white/8 bg-[rgba(255,255,255,0.06)]",
        className,
      )}
      value={safeValue}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 rounded-full bg-[linear-gradient(90deg,#7bd3c6,#ffbe5c)] transition-transform duration-500 ease-out",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - safeValue}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

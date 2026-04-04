import type { ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NotificationTone = "success" | "error" | "warning" | "info" | "neutral";

const toneStyles: Record<NotificationTone, { container: string; icon: ReactNode }> = {
  success: {
    container: "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]",
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
  error: {
    container: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: <XCircle className="h-5 w-5" />,
  },
  warning: {
    container: "border-[hsl(var(--warning))]/35 bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]",
    icon: <TriangleAlert className="h-5 w-5" />,
  },
  info: {
    container: "border-[hsl(var(--area-web))]/30 bg-[hsl(var(--area-web))]/10 text-[hsl(var(--area-web))]",
    icon: <Info className="h-5 w-5" />,
  },
  neutral: {
    container: "border-border/70 bg-muted/30 text-foreground",
    icon: <Info className="h-5 w-5" />,
  },
};

type NotificationAction = {
  label: string;
  onClick: () => void;
};

type NotificationInlineProps = {
  tone?: NotificationTone;
  title: string;
  message?: string;
  action?: NotificationAction;
  onClose?: () => void;
  className?: string;
};

export function NotificationInline({
  tone = "neutral",
  title,
  message,
  action,
  onClose,
  className,
}: NotificationInlineProps) {
  const toneStyle = toneStyles[tone];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 shadow-sm",
        toneStyle.container,
        className,
      )}
    >
      <div className="mt-0.5 shrink-0">{toneStyle.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        {message ? <p className="mt-1 text-sm leading-6 text-current/85">{message}</p> : null}
        {action ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 h-8 rounded-lg border-current/30 bg-transparent px-3 text-xs font-semibold text-current hover:bg-black/5"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          aria-label="Fechar notificação"
          className="rounded-lg p-1 text-current/70 transition-colors hover:bg-black/5 hover:text-current"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

type NotificationBannerProps = NotificationInlineProps;

export function NotificationBanner(props: NotificationBannerProps) {
  return <NotificationInline {...props} className={cn("w-full rounded-2xl", props.className)} />;
}

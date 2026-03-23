import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { cn } from "@/lib/utils";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      expand
      closeButton
      visibleToasts={4}
      duration={4200}
      offset={16}
      mobileOffset={16}
      toastOptions={{
        classNames: {
          toast: cn(
            "group toast rounded-2xl border px-5 py-4 shadow-xl backdrop-blur-sm",
            "group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border",
          ),
          title: "text-sm font-semibold",
          description: "text-sm text-current/85",
          success: "border-[hsl(var(--success))]/20 bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]",
          error: "border-destructive/20 bg-destructive text-destructive-foreground",
          warning: "border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]",
          info: "border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]",
          actionButton: "bg-white/90 text-foreground hover:bg-white",
          cancelButton: "bg-black/10 text-current hover:bg-black/15",
          closeButton: "border-white/25 bg-black/10 text-current hover:bg-black/15",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };

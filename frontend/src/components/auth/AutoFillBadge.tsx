import { CheckCircle2 } from "lucide-react";

export function AutoFillBadge({ visible = true }: { visible?: boolean }) {
  if (!visible) return null;

  return (
    <span className="auto-fill-pill">
      <CheckCircle2 className="h-3.5 w-3.5 animate-pulse" />
      Preenchido automaticamente
    </span>
  );
}

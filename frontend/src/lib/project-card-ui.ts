import { normalizeSubmissionType } from "@/lib/submission-meta";

const areaColors: Record<string, string> = {
  IoT: "bg-[hsl(var(--area-iot))]/10 text-[hsl(var(--area-iot))]",
  Telecom: "bg-primary/10 text-primary",
  Seguranca: "bg-destructive/10 text-destructive",
  Segurança: "bg-destructive/10 text-destructive",
  Web: "bg-[hsl(var(--area-web))]/10 text-[hsl(var(--area-web))]",
  IA: "bg-[hsl(var(--area-ia))]/10 text-[hsl(var(--area-ia))]",
  Negocio: "bg-[hsl(var(--area-negocio))]/10 text-[hsl(var(--area-negocio))]",
  Negócio: "bg-[hsl(var(--area-negocio))]/10 text-[hsl(var(--area-negocio))]",
  Produto: "bg-[hsl(var(--area-produto))]/10 text-[hsl(var(--area-produto))]",
};

const areaTopBar: Record<string, string> = {
  IoT: "bg-[hsl(var(--area-iot))]",
  Telecom: "bg-primary",
  Seguranca: "bg-destructive",
  Segurança: "bg-destructive",
  Web: "bg-[hsl(var(--area-web))]",
  IA: "bg-[hsl(var(--area-ia))]",
  Negocio: "bg-[hsl(var(--area-negocio))]",
  Negócio: "bg-[hsl(var(--area-negocio))]",
  Produto: "bg-[hsl(var(--area-produto))]",
};

const areaBorderAccent: Record<string, string> = {
  IoT: "border-[hsl(var(--area-iot))]/30 hover:border-[hsl(var(--area-iot))]/60",
  Telecom: "border-primary/30 hover:border-primary/60",
  Seguranca: "border-destructive/30 hover:border-destructive/60",
  Segurança: "border-destructive/30 hover:border-destructive/60",
  Web: "border-[hsl(var(--area-web))]/30 hover:border-[hsl(var(--area-web))]/60",
  IA: "border-[hsl(var(--area-ia))]/30 hover:border-[hsl(var(--area-ia))]/60",
  Negocio: "border-[hsl(var(--area-negocio))]/30 hover:border-[hsl(var(--area-negocio))]/60",
  Negócio: "border-[hsl(var(--area-negocio))]/30 hover:border-[hsl(var(--area-negocio))]/60",
  Produto: "border-[hsl(var(--area-produto))]/30 hover:border-[hsl(var(--area-produto))]/60",
};

export function getProjectAreaClasses(area: string, type?: string) {
  const normalizedType = normalizeSubmissionType(type, area);

  if (normalizedType === "BUSINESS") {
    return {
      badge: areaColors["Negócio"],
      topBar: areaTopBar["Negócio"],
      border: areaBorderAccent["Negócio"],
    };
  }

  if (normalizedType === "PRODUCT") {
    return {
      badge: areaColors.Produto,
      topBar: areaTopBar.Produto,
      border: areaBorderAccent.Produto,
    };
  }

  return {
    badge: areaColors[area] || "bg-secondary text-secondary-foreground",
    topBar: areaTopBar[area] || "bg-primary",
    border: areaBorderAccent[area] || "border-border hover:border-primary/40",
  };
}

export function withAlpha(color?: string | null, alpha = "22") {
  return color ? `${color}${alpha}` : "rgba(148,163,184,0.18)";
}

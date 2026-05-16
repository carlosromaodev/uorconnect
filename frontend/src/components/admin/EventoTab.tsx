import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/sonner";
import {
  Eye,
  FloppyDisk,
  Image,
  Plus,
  Sparkle,
  Trash,
} from "@/icons/phosphor";
import { api, type HeroFloatingIcon, type HomeSocialConfigInput, type HomeSponsor } from "@/lib/api";
import { defaultHeroFloatingIcons, defaultHeroSponsors, defaultHomeSocialConfig } from "@/lib/home-content";
import { getHeroIconByName, getHeroIconSuggestions, isHeroIconAvailable, normalizeHeroIconName } from "@/lib/phosphor-icons";
import { readCompressedImageFileAsDataUrl } from "@/lib/project-media";

type EventoTabProps = {
  value: HomeSocialConfigInput;
  onChange: Dispatch<SetStateAction<HomeSocialConfigInput>>;
  onSave: () => void;
  isSaving?: boolean;
};

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1_000)}`;
}

function resolveHeroConfig(value: HomeSocialConfigInput) {
  return {
    primaryColor: value.primaryColor ?? defaultHomeSocialConfig.primaryColor,
    primaryGradient: value.primaryGradient ?? defaultHomeSocialConfig.primaryGradient,
    titleColor: value.titleColor ?? defaultHomeSocialConfig.titleColor,
    accentColor: value.accentColor ?? defaultHomeSocialConfig.accentColor,
    dashedColor: value.dashedColor ?? defaultHomeSocialConfig.dashedColor,
    dashedOpacity: value.dashedOpacity ?? defaultHomeSocialConfig.dashedOpacity,
    heroIconsOpacity: value.heroIconsOpacity ?? defaultHomeSocialConfig.heroIconsOpacity,
    heroBlobsIntensity: value.heroBlobsIntensity ?? defaultHomeSocialConfig.heroBlobsIntensity,
    heroMeshEnabled: value.heroMeshEnabled ?? defaultHomeSocialConfig.heroMeshEnabled,
    heroFloatingIcons: value.heroFloatingIcons && value.heroFloatingIcons.length > 0 ? value.heroFloatingIcons : defaultHeroFloatingIcons,
    sponsors: value.sponsors && value.sponsors.length > 0 ? value.sponsors : defaultHeroSponsors,
  };
}

export function EventoTab({ value, onChange, onSave, isSaving = false }: EventoTabProps) {
  const [uploadingSponsorId, setUploadingSponsorId] = useState<string | null>(null);
  const preview = useMemo(() => resolveHeroConfig(value), [value]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--event-primary-color", preview.primaryColor);
    root.style.setProperty("--event-primary-gradient", preview.primaryGradient);
    root.style.setProperty("--event-title-color", preview.titleColor);
    root.style.setProperty("--event-accent-color", preview.accentColor);
    root.style.setProperty("--event-dashed-color", preview.dashedColor);
    root.style.setProperty("--event-dashed-opacity", String(preview.dashedOpacity / 100));
    root.style.setProperty("--event-icons-opacity", String(preview.heroIconsOpacity / 100));
    root.style.setProperty("--event-blobs-intensity", String(preview.heroBlobsIntensity / 100));
    root.style.setProperty("--event-hero-mesh", preview.heroMeshEnabled ? "1" : "0");
    window.dispatchEvent(new CustomEvent("evento-variables-changed", { detail: preview }));
  }, [preview]);

  const updateField = <K extends keyof HomeSocialConfigInput>(key: K, nextValue: HomeSocialConfigInput[K]) => {
    onChange((current) => ({ ...current, [key]: nextValue }));
  };

  const updateFloatingIcon = (id: string, patch: Partial<HeroFloatingIcon>) => {
    onChange((current) => ({
      ...current,
      heroFloatingIcons: resolveHeroConfig(current).heroFloatingIcons.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  };

  const addFloatingIcon = () => {
    onChange((current) => ({
      ...current,
      heroFloatingIcons: [
        ...resolveHeroConfig(current).heroFloatingIcons,
        { id: makeId("hero-icon"), icon: "WifiHigh", top: 24, left: 24, size: 34, rotate: 0, opacity: 18 },
      ],
    }));
  };

  const removeFloatingIcon = (id: string) => {
    onChange((current) => ({
      ...current,
      heroFloatingIcons: resolveHeroConfig(current).heroFloatingIcons.filter((item) => item.id !== id),
    }));
  };

  const updateSponsor = (id: string, patch: Partial<HomeSponsor>) => {
    onChange((current) => ({
      ...current,
      sponsors: resolveHeroConfig(current).sponsors.map((item) => item.id === id ? { ...item, ...patch } : item),
    }));
  };

  const handleSponsorLogoFile = async (id: string, file?: File | null) => {
    if (!file) return;

    setUploadingSponsorId(id);
    try {
      const dataUrl = await readCompressedImageFileAsDataUrl(file, {
        maxDimension: 900,
        maxLength: 700_000,
      });
      const uploaded = await api.media.uploadDataUrl(dataUrl, "home-sponsors", {
        maxImageDimension: 900,
      });
      updateSponsor(id, { imageUrl: uploaded.url });
      toast.success("Imagem do patrocinador carregada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a imagem do patrocinador.",
      );
    } finally {
      setUploadingSponsorId(null);
    }
  };

  const addSponsor = () => {
    onChange((current) => ({
      ...current,
      sponsors: [
        ...resolveHeroConfig(current).sponsors,
        { id: makeId("sponsor"), name: "Novo patrocinador", imageUrl: "https://", label: null },
      ],
    }));
  };

  const removeSponsor = (id: string) => {
    onChange((current) => ({
      ...current,
      sponsors: resolveHeroConfig(current).sponsors.filter((item) => item.id !== id),
    }));
  };

  const dashedStyle = {
    borderTop: `2px dashed ${preview.dashedColor}`,
    opacity: preview.dashedOpacity / 100,
  };

  return (
    <div className="grid gap-3 sm:gap-4 md:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-5">
        <Card className="border-border/60 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Image className="h-5 w-5" />
                Ícones Flutuantes
              </CardTitle>
              <CardDescription>Usa qualquer nome de ícone do Phosphor Icons, com validação em tempo real.</CardDescription>
            </div>
            <Button type="button" variant="outline" className="gap-2 w-full sm:w-auto" onClick={addFloatingIcon}>
              <Plus className="h-4 w-4" />
              Novo ícone
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="rounded-lg sm:rounded-xl md:rounded-2xl border border-border/60 bg-muted/20 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                <span>Opacidade geral dos ícones</span>
                <span className="shrink-0 font-semibold">{preview.heroIconsOpacity}%</span>
              </div>
              <Slider value={[preview.heroIconsOpacity]} onValueChange={([next]) => updateField("heroIconsOpacity", next)} min={0} max={100} step={1} />
            </div>
            {preview.heroFloatingIcons.map((icon) => {
              const Icon = getHeroIconByName(icon.icon);
              const isAvailable = isHeroIconAvailable(icon.icon);
              const suggestions = getHeroIconSuggestions(icon.icon, 12);
              const normalizedIconName = normalizeHeroIconName(icon.icon);
              const datalistId = `hero-icon-suggestions-${icon.id}`;
              return (
                <div key={icon.id} className="rounded-lg sm:rounded-xl md:rounded-2xl border border-border/60 bg-background/80 p-3 sm:p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10" style={{ color: preview.accentColor }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{icon.icon}</p>
                        <p className="text-xs text-muted-foreground">{icon.id}</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeFloatingIcon(icon.id)}>
                      <Trash className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
                    <Label className="space-y-2">
                      <span>Ícone (Phosphor)</span>
                      <Input
                        value={icon.icon}
                        onChange={(event) => updateFloatingIcon(icon.id, { icon: event.target.value })}
                        onBlur={(event) => {
                          const next = event.target.value.trim();
                          if (!next) return;
                          const normalized = normalizeHeroIconName(next);
                          if (normalized && normalized !== next && isHeroIconAvailable(next)) {
                            updateFloatingIcon(icon.id, { icon: normalized });
                          }
                        }}
                        placeholder="Ex.: WifiHigh, Briefcase, GraduationCap"
                        list={datalistId}
                        className={isAvailable ? "border-[hsl(var(--success))]/35" : "border-[hsl(var(--warning))]/40"}
                      />
                      <datalist id={datalistId}>
                        {suggestions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                      <p className={`text-xs ${isAvailable ? "text-[hsl(var(--success))]" : "text-[hsl(var(--warning))]"}`}>
                        {isAvailable
                          ? normalizedIconName === icon.icon.trim()
                            ? "Disponível no Phosphor."
                            : `Disponível no Phosphor como "${normalizedIconName}".`
                          : "Nome não encontrado no Phosphor (será usado fallback)."}
                      </p>
                      {suggestions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {suggestions.slice(0, 6).map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => updateFloatingIcon(icon.id, { icon: name })}
                              className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </Label>
                    <Label className="space-y-2">
                      <span>Tamanho ({icon.size}px)</span>
                      <Slider value={[icon.size]} onValueChange={([next]) => updateFloatingIcon(icon.id, { size: next })} min={18} max={96} step={1} />
                    </Label>
                    <Label className="space-y-2">
                      <span>Topo ({icon.top}%)</span>
                      <Slider value={[icon.top]} onValueChange={([next]) => updateFloatingIcon(icon.id, { top: next })} min={4} max={96} step={1} />
                    </Label>
                    <Label className="space-y-2">
                      <span>Esquerda ({icon.left}%)</span>
                      <Slider value={[icon.left]} onValueChange={([next]) => updateFloatingIcon(icon.id, { left: next })} min={4} max={96} step={1} />
                    </Label>
                    <Label className="space-y-2">
                      <span>Rotação ({icon.rotate}°)</span>
                      <Slider value={[icon.rotate]} onValueChange={([next]) => updateFloatingIcon(icon.id, { rotate: next })} min={-180} max={180} step={1} />
                    </Label>
                    <Label className="space-y-2">
                      <span>Opacidade ({icon.opacity}%)</span>
                      <Slider value={[icon.opacity]} onValueChange={([next]) => updateFloatingIcon(icon.id, { opacity: next })} min={0} max={100} step={1} />
                    </Label>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkle className="h-5 w-5" />
                Patrocinadores
              </CardTitle>
              <CardDescription>Adiciona ou remove patrocinadores exibidos no topo da home.</CardDescription>
            </div>
            <Button type="button" variant="outline" className="gap-2 w-full sm:w-auto" onClick={addSponsor}>
              <Plus className="h-4 w-4" />
              Novo patrocinador
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {preview.sponsors.map((sponsor) => (
              <div key={sponsor.id} className="grid gap-2 sm:gap-3 md:gap-4 rounded-lg sm:rounded-xl md:rounded-2xl border border-border/60 bg-background/80 p-3 sm:p-4 shadow-sm grid-cols-1 md:grid-cols-[1fr_1.2fr_auto]">
                <Label className="space-y-2">
                  <span>Nome</span>
                  <Input value={sponsor.name} onChange={(event) => updateSponsor(sponsor.id, { name: event.target.value })} />
                </Label>
                <Label className="space-y-2">
                  <span>URL do logotipo</span>
                  <Input
                    value={sponsor.imageUrl}
                    onChange={(event) => updateSponsor(sponsor.id, { imageUrl: event.target.value })}
                    placeholder="https://dominio.com/logo.png"
                  />
                </Label>
                <div className="flex items-end justify-end gap-2">
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-semibold transition-colors hover:bg-muted">
                    <Image className="mr-1.5 h-4 w-4" />
                    {uploadingSponsorId === sponsor.id ? "A carregar..." : "Carregar imagem"}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={uploadingSponsorId === sponsor.id}
                      onChange={(event) => {
                        const input = event.currentTarget;
                        void handleSponsorLogoFile(sponsor.id, input.files?.[0] ?? null).finally(() => {
                          input.value = "";
                        });
                      }}
                    />
                  </label>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeSponsor(sponsor.id)}>
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <Label className="space-y-2 md:col-span-3 col-span-1">
                  <span>Legenda opcional</span>
                  <Input value={sponsor.label ?? ""} onChange={(event) => updateSponsor(sponsor.id, { label: event.target.value || null })} />
                </Label>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3 sm:space-y-4 md:space-y-5">
        <Card className="border-border/60 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-5 w-5" />
              Pré-visualização ao Vivo
            </CardTitle>
            <CardDescription>O preview responde instantaneamente e o botão abaixo grava tudo no banco de dados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-5 md:space-y-6">
            <div
              className="relative overflow-hidden rounded-[18px] border border-border/60 bg-[#fffaf5] p-6 shadow-sm"
              style={{
                backgroundImage: preview.primaryGradient,
              }}
            >
              <div className="absolute inset-0 bg-white/82 backdrop-blur-[1px]" />
              {preview.heroMeshEnabled ? (
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage: "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    opacity: preview.heroBlobsIntensity / 200,
                  }}
                />
              ) : null}
              <div
                className="absolute -right-14 top-0 h-48 w-48 rounded-full blur-3xl"
                style={{ backgroundColor: `${preview.primaryColor}30`, opacity: preview.heroBlobsIntensity / 100 }}
              />
              <div
                className="absolute -left-10 bottom-0 h-40 w-40 rounded-full blur-3xl"
                style={{ backgroundColor: `${preview.accentColor}22`, opacity: preview.heroBlobsIntensity / 100 }}
              />

              {preview.heroFloatingIcons.map((item) => {
                const Icon = getHeroIconByName(item.icon);
                return (
                  <Icon
                    key={item.id}
                    className="pointer-events-none absolute"
                    style={{
                      top: `${item.top}%`,
                      left: `${item.left}%`,
                      width: item.size,
                      height: item.size,
                      transform: `translate(-50%, -50%) rotate(${item.rotate}deg)`,
                      color: preview.accentColor,
                      opacity: (item.opacity / 100) * (preview.heroIconsOpacity / 100),
                    }}
                  />
                );
              })}

              <div className="relative space-y-5">
                <div className="h-px w-full" style={dashedStyle} />

                <div className="grid gap-3 sm:grid-cols-2">
                  {preview.sponsors.map((sponsor) => (
                    <div key={sponsor.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white/88 p-3 shadow-sm">
                      <img src={sponsor.imageUrl} alt={sponsor.name} className="h-10 w-10 rounded-xl object-contain" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold" style={{ color: preview.titleColor }}>{sponsor.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{sponsor.label ?? "Patrocinador ativo"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button className="gap-2" onClick={onSave} disabled={isSaving}>
              <FloppyDisk className="h-4 w-4" />
              {isSaving ? "A aplicar..." : "Guardar ícones e patrocinadores"}
            </Button>
            <Button variant="outline" className="gap-2" asChild>
              <a href="/" target="_blank" rel="noreferrer">
                <Eye className="h-4 w-4" />
                Visualizar no Site
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

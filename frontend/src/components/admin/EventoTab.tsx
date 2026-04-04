import { type Dispatch, type SetStateAction, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Eye,
  FloppyDisk,
  Gradient,
  Image,
  LineSegments,
  Palette,
  Plus,
  Sparkle,
  TextAa,
  Trash,
} from "@/icons/phosphor";
import type { HeroFloatingIcon, HomeSocialConfigInput, HomeSponsor } from "@/lib/api";
import { defaultHeroFloatingIcons, defaultHeroSponsors, defaultHomeSocialConfig } from "@/lib/home-content";
import { getHeroIconByName, getHeroIconSuggestions, isHeroIconAvailable, normalizeHeroIconName } from "@/lib/phosphor-icons";

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

function parseRem(value: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatRem(value: number) {
  return `${value.toFixed(1)}rem`;
}

function buildFluidRem(minRem: number, maxRem: number, baseRem: number, vwSlope: number) {
  return `clamp(${minRem.toFixed(2)}rem, calc(${baseRem.toFixed(2)}rem + ${vwSlope.toFixed(2)}vw), ${maxRem.toFixed(2)}rem)`;
}

function resolveHeroConfig(value: HomeSocialConfigInput) {
  return {
    instagramUrl: value.instagramUrl ?? defaultHomeSocialConfig.instagramUrl,
    facebookUrl: value.facebookUrl ?? defaultHomeSocialConfig.facebookUrl,
    linkedinUrl: value.linkedinUrl ?? defaultHomeSocialConfig.linkedinUrl,
    courseEnrollmentEnabled: value.courseEnrollmentEnabled ?? defaultHomeSocialConfig.courseEnrollmentEnabled,
    firstYearContestEnabled: value.firstYearContestEnabled ?? defaultHomeSocialConfig.firstYearContestEnabled,
    primaryColor: value.primaryColor ?? defaultHomeSocialConfig.primaryColor,
    primaryGradient: value.primaryGradient ?? defaultHomeSocialConfig.primaryGradient,
    titleColor: value.titleColor ?? defaultHomeSocialConfig.titleColor,
    accentColor: value.accentColor ?? defaultHomeSocialConfig.accentColor,
    dashedColor: value.dashedColor ?? defaultHomeSocialConfig.dashedColor,
    dashedOpacity: value.dashedOpacity ?? defaultHomeSocialConfig.dashedOpacity,
    heroIconsOpacity: value.heroIconsOpacity ?? defaultHomeSocialConfig.heroIconsOpacity,
    heroBlobsIntensity: value.heroBlobsIntensity ?? defaultHomeSocialConfig.heroBlobsIntensity,
    heroMeshEnabled: value.heroMeshEnabled ?? defaultHomeSocialConfig.heroMeshEnabled,
    heroBadgeText: value.heroBadgeText ?? defaultHomeSocialConfig.heroBadgeText,
    heroTitlePrefix: value.heroTitlePrefix ?? defaultHomeSocialConfig.heroTitlePrefix,
    heroTitleHighlight: value.heroTitleHighlight ?? defaultHomeSocialConfig.heroTitleHighlight,
    heroSubtitleText: value.heroSubtitleText ?? defaultHomeSocialConfig.heroSubtitleText,
    heroSubtitleColor: value.heroSubtitleColor ?? defaultHomeSocialConfig.heroSubtitleColor,
    heroTitleMobileSize: value.heroTitleMobileSize ?? defaultHomeSocialConfig.heroTitleMobileSize,
    heroTitleTabletSize: value.heroTitleTabletSize ?? defaultHomeSocialConfig.heroTitleTabletSize,
    heroTitleDesktopSize: value.heroTitleDesktopSize ?? defaultHomeSocialConfig.heroTitleDesktopSize,
    heroSubtitleMobileSize: value.heroSubtitleMobileSize ?? defaultHomeSocialConfig.heroSubtitleMobileSize,
    heroSubtitleTabletSize: value.heroSubtitleTabletSize ?? defaultHomeSocialConfig.heroSubtitleTabletSize,
    heroSubtitleDesktopSize: value.heroSubtitleDesktopSize ?? defaultHomeSocialConfig.heroSubtitleDesktopSize,
    heroFloatingIcons: value.heroFloatingIcons && value.heroFloatingIcons.length > 0 ? value.heroFloatingIcons : defaultHeroFloatingIcons,
    sponsors: value.sponsors && value.sponsors.length > 0 ? value.sponsors : defaultHeroSponsors,
  };
}

export function EventoTab({ value, onChange, onSave, isSaving = false }: EventoTabProps) {
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
  const titleMobileRem = parseRem(preview.heroTitleMobileSize, 2.8);
  const titleTabletRem = parseRem(preview.heroTitleTabletSize, 4.2);
  const titleDesktopRem = parseRem(preview.heroTitleDesktopSize, 5.4);
  const subtitleMobileRem = parseRem(preview.heroSubtitleMobileSize, 1.05);
  const subtitleTabletRem = parseRem(preview.heroSubtitleTabletSize, 1.2);
  const subtitleDesktopRem = parseRem(preview.heroSubtitleDesktopSize, 1.35);

  const titleMaxRem = Math.max(titleTabletRem, titleDesktopRem);
  const titleMinRem = Math.max(1.9, Math.min(titleMobileRem * 0.78, titleMaxRem));
  const titleBaseRem = Math.max(1.1, Math.min(titleMobileRem * 0.56, titleMaxRem - 0.4));
  const titleFluidRem = buildFluidRem(titleMinRem, titleMaxRem, titleBaseRem, 4.1);

  const subtitleMaxRem = Math.max(subtitleTabletRem, subtitleDesktopRem);
  const subtitleMinRem = Math.max(0.96, Math.min(subtitleMobileRem * 0.88, subtitleMaxRem));
  const subtitleBaseRem = Math.max(0.78, Math.min(subtitleMobileRem * 0.72, subtitleMaxRem - 0.15));
  const subtitleFluidRem = buildFluidRem(subtitleMinRem, subtitleMaxRem, subtitleBaseRem, 1.55);

  return (
    <div className="grid gap-3 sm:gap-4 md:gap-5 lg:gap-6 grid-cols-1 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-5">
        <Card className="border-border/60 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-5 w-5" />
              Identidade Visual
            </CardTitle>
            <CardDescription>Controla a cor principal, gradiente e contraste do evento.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
            <Label className="space-y-2">
              <span>Cor principal</span>
              <Input type="color" value={preview.primaryColor} onChange={(event) => updateField("primaryColor", event.target.value)} className="h-11 w-full p-1" />
            </Label>
            <Label className="space-y-2">
              <span>Cor do prefixo do título</span>
              <Input type="color" value={preview.titleColor} onChange={(event) => updateField("titleColor", event.target.value)} className="h-11 w-full p-1" />
            </Label>
            <Label className="space-y-2">
              <span>Cor do destaque do título</span>
              <Input type="color" value={preview.accentColor} onChange={(event) => updateField("accentColor", event.target.value)} className="h-11 w-full p-1" />
            </Label>
            <Label className="space-y-2">
              <span>Cor do subtítulo</span>
              <Input type="color" value={preview.heroSubtitleColor} onChange={(event) => updateField("heroSubtitleColor", event.target.value)} className="h-11 w-full p-1" />
            </Label>
            <Label className="space-y-2 sm:col-span-2">
              <span>Gradiente da hero</span>
              <Textarea
                value={preview.primaryGradient}
                onChange={(event) => updateField("primaryGradient", event.target.value)}
                className="min-h-20"
              />
            </Label>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TextAa className="h-5 w-5" />
              Textos da Hero
            </CardTitle>
            <CardDescription>Separa o título em duas partes para aplicar cor e quebra responsiva com precisão.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
            <Label className="space-y-2 sm:col-span-2">
              <span>Badge</span>
              <Input value={preview.heroBadgeText} onChange={(event) => updateField("heroBadgeText", event.target.value)} />
            </Label>
            <Label className="space-y-2">
              <span>Título parte 1</span>
              <Input value={preview.heroTitlePrefix} onChange={(event) => updateField("heroTitlePrefix", event.target.value)} />
            </Label>
            <Label className="space-y-2">
              <span>Título parte 2</span>
              <Input value={preview.heroTitleHighlight} onChange={(event) => updateField("heroTitleHighlight", event.target.value)} />
            </Label>
            <Label className="space-y-2 sm:col-span-2">
              <span>Subtítulo</span>
              <Textarea
                value={preview.heroSubtitleText}
                onChange={(event) => updateField("heroSubtitleText", event.target.value)}
                className="min-h-24"
              />
            </Label>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gradient className="h-5 w-5" />
              Escalas Responsivas
            </CardTitle>
            <CardDescription>Ajusta título e subtítulo separadamente em mobile, tablet e desktop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              <div className="space-y-3 rounded-lg sm:rounded-xl md:rounded-2xl border border-border/60 bg-muted/20 p-3 sm:p-4">
              <p className="text-xs sm:text-sm font-semibold">Título</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Mobile</span>
                  <span>{preview.heroTitleMobileSize}</span>
                </div>
                <Slider
                  value={[parseRem(preview.heroTitleMobileSize, 2.8)]}
                  onValueChange={([next]) => updateField("heroTitleMobileSize", formatRem(next))}
                  min={1.8}
                  max={4.2}
                  step={0.1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Tablet</span>
                  <span>{preview.heroTitleTabletSize}</span>
                </div>
                <Slider
                  value={[parseRem(preview.heroTitleTabletSize, 4.2)]}
                  onValueChange={([next]) => updateField("heroTitleTabletSize", formatRem(next))}
                  min={2.4}
                  max={5.6}
                  step={0.1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Desktop</span>
                  <span>{preview.heroTitleDesktopSize}</span>
                </div>
                <Slider
                  value={[parseRem(preview.heroTitleDesktopSize, 5.4)]}
                  onValueChange={([next]) => updateField("heroTitleDesktopSize", formatRem(next))}
                  min={3.4}
                  max={7.2}
                  step={0.1}
                />
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4 rounded-lg sm:rounded-xl md:rounded-2xl border border-border/60 bg-muted/20 p-3 sm:p-4">
              <p className="text-xs sm:text-sm font-semibold">Subtítulo</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Mobile</span>
                  <span>{preview.heroSubtitleMobileSize}</span>
                </div>
                <Slider
                  value={[parseRem(preview.heroSubtitleMobileSize, 1.05)]}
                  onValueChange={([next]) => updateField("heroSubtitleMobileSize", formatRem(next))}
                  min={0.8}
                  max={2.2}
                  step={0.05}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Tablet</span>
                  <span>{preview.heroSubtitleTabletSize}</span>
                </div>
                <Slider
                  value={[parseRem(preview.heroSubtitleTabletSize, 1.2)]}
                  onValueChange={([next]) => updateField("heroSubtitleTabletSize", formatRem(next))}
                  min={0.9}
                  max={2.4}
                  step={0.05}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Desktop</span>
                  <span>{preview.heroSubtitleDesktopSize}</span>
                </div>
                <Slider
                  value={[parseRem(preview.heroSubtitleDesktopSize, 1.35)]}
                  onValueChange={([next]) => updateField("heroSubtitleDesktopSize", formatRem(next))}
                  min={1}
                  max={2.8}
                  step={0.05}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/85 shadow-sm backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LineSegments className="h-5 w-5" />
              Linhas, Mesh e Intensidade
            </CardTitle>
            <CardDescription>Afina as linhas tracejadas, a presença dos blobs e a densidade visual do topo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-5 md:space-y-6">
            <div className="grid gap-2 sm:gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2">
              <Label className="space-y-2">
                <span>Cor da linha tracejada</span>
                <Input type="color" value={preview.dashedColor} onChange={(event) => updateField("dashedColor", event.target.value)} className="h-11 w-full p-1" />
              </Label>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Opacidade da linha</span>
                  <span>{preview.dashedOpacity}%</span>
                </div>
                <Slider value={[preview.dashedOpacity]} onValueChange={([next]) => updateField("dashedOpacity", next)} min={0} max={100} step={1} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Opacidade dos ícones flutuantes</span>
                <span>{preview.heroIconsOpacity}%</span>
              </div>
              <Slider value={[preview.heroIconsOpacity]} onValueChange={([next]) => updateField("heroIconsOpacity", next)} min={0} max={100} step={1} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Intensidade dos blobs</span>
                <span>{preview.heroBlobsIntensity}%</span>
              </div>
              <Slider value={[preview.heroBlobsIntensity]} onValueChange={([next]) => updateField("heroBlobsIntensity", next)} min={0} max={100} step={1} />
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg sm:rounded-xl md:rounded-2xl border border-border/60 bg-muted/30 px-3 py-3 sm:px-4">
              <div>
                <p className="text-sm font-semibold">Hero mesh</p>
                <p className="text-xs text-muted-foreground">Ativa ou remove a textura técnica do fundo.</p>
              </div>
              <Switch checked={preview.heroMeshEnabled} onCheckedChange={(next) => updateField("heroMeshEnabled", next)} />
            </div>
          </CardContent>
        </Card>

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
                <div className="flex items-end justify-end">
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
              className="relative overflow-hidden rounded-[28px] border border-border/60 bg-[#fffaf5] p-6 shadow-sm"
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
                <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-sm" style={{ backgroundColor: `${preview.primaryColor}14`, color: preview.accentColor }}>
                  <Sparkle className="h-4 w-4" />
                  {preview.heroBadgeText}
                </div>

                <div className="space-y-3">
                  <h3
                    className="max-w-[11ch] font-heading font-extrabold tracking-tight leading-[1.03] text-[length:var(--hero-title-fluid-size)]"
                    style={{
                      color: preview.titleColor,
                      ["--hero-title-fluid-size" as string]: titleFluidRem,
                    }}
                  >
                    <span className="inline">{preview.heroTitlePrefix} </span>
                    <span className="inline-block" style={{ color: preview.accentColor }}>{preview.heroTitleHighlight}</span>
                  </h3>
                  <p
                    className="max-w-xl leading-relaxed text-[length:var(--hero-subtitle-fluid-size)]"
                    style={{
                      color: preview.heroSubtitleColor,
                      ["--hero-subtitle-fluid-size" as string]: subtitleFluidRem,
                    }}
                  >
                    {preview.heroSubtitleText}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg"
                    style={{ backgroundColor: preview.primaryColor }}
                  >
                    Botão primário
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border px-5 py-3 text-sm font-semibold"
                    style={{ borderColor: `${preview.titleColor}26`, color: preview.titleColor, backgroundColor: "rgba(255,255,255,0.82)" }}
                  >
                    Botão secundário
                  </button>
                </div>

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

            <div className="grid gap-4">
              <Card className="border-border/60 bg-background/80 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Links institucionais</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <Label className="space-y-2">
                    <span>Instagram</span>
                    <Input value={preview.instagramUrl ?? ""} onChange={(event) => updateField("instagramUrl", event.target.value || null)} placeholder="https://instagram.com/..." />
                  </Label>
                  <Label className="space-y-2">
                    <span>Facebook</span>
                    <Input value={preview.facebookUrl ?? ""} onChange={(event) => updateField("facebookUrl", event.target.value || null)} placeholder="https://facebook.com/..." />
                  </Label>
                  <Label className="space-y-2">
                    <span>LinkedIn</span>
                    <Input value={preview.linkedinUrl ?? ""} onChange={(event) => updateField("linkedinUrl", event.target.value || null)} placeholder="https://linkedin.com/..." />
                  </Label>
                </CardContent>
              </Card>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button className="gap-2" onClick={onSave} disabled={isSaving}>
              <FloppyDisk className="h-4 w-4" />
              {isSaving ? "A aplicar..." : "Guardar e Aplicar no Banco"}
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

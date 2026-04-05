import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import { type LaboratorioAgendaItem, type LaboratorioAgendaStatus } from "@/data/laboratorio-hub";
import { useLaboratorioHub } from "@app/lib/laboratorio-hub-state";

const agendaStatusOptions: LaboratorioAgendaStatus[] = ["aberto", "curadoria", "reservado", "encerrado"];

function buildNewAgendaDraft(moduleSlug: string): LaboratorioAgendaItem {
  const uniqueId = `agenda-${Date.now()}`;

  return {
    id: uniqueId,
    title: "",
    moduleSlug,
    date: "2026-04-20",
    startTime: "09:00",
    endTime: "11:00",
    location: "",
    format: "",
    audience: "",
    summary: "",
    status: "aberto",
    featured: false,
    ctaLabel: "Abrir módulo",
    ctaPath: moduleSlug === "arena" ? "/arena" : `/programas/${moduleSlug}`,
  };
}

export default function LaboratorioAdminAgendaPage() {
  const { agendaItems, modules, removeAgendaItem, upsertAgendaItem } = useLaboratorioHub();
  const [selectedId, setSelectedId] = useState(agendaItems[0]?.id ?? "");
  const [draft, setDraft] = useState<LaboratorioAgendaItem | null>(() =>
    agendaItems[0] ? { ...agendaItems[0] } : buildNewAgendaDraft(modules[0]?.slug ?? "arena"),
  );

  const selectedItem = useMemo(
    () => agendaItems.find((item) => item.id === selectedId) ?? null,
    [agendaItems, selectedId],
  );

  useEffect(() => {
    if (selectedItem) {
      setDraft({ ...selectedItem });
    }
  }, [selectedItem]);

  const handleCreate = () => {
    const next = buildNewAgendaDraft(modules[0]?.slug ?? "arena");
    setSelectedId(next.id);
    setDraft(next);
  };

  const handleSave = () => {
    if (!draft) return;
    upsertAgendaItem(draft);
    setSelectedId(draft.id);
    toast.success("Entrada da agenda atualizada.");
  };

  const handleRemove = () => {
    if (!draft) return;
    removeAgendaItem(draft.id);
    const next = agendaItems.find((item) => item.id !== draft.id);
    setSelectedId(next?.id ?? "");
    setDraft(next ? { ...next } : buildNewAgendaDraft(modules[0]?.slug ?? "arena"));
    toast.success("Entrada removida da agenda.");
  };

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 xl:grid-cols-[0.76fr_1.24fr]">
        <ContestCard className="shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">agenda.catalogo</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Agenda publicada</h3>
            </div>
            <Button type="button" variant="outline" className={cn("h-10 px-4", contestButtonClassNames.secondary)} onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Novo evento
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {agendaItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition-colors",
                  selectedId === item.id
                    ? "border-[#7bd3c6]/24 bg-[#7bd3c6]/10"
                    : "border-white/8 bg-white/[0.03] hover:border-[#7bd3c6]/16",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-white">{item.title || "Novo evento"}</p>
                  <ContestBadge tone={item.featured ? "accent" : "neutral"} size="compact">
                    {item.featured ? "destaque" : item.status}
                  </ContestBadge>
                </div>
                <p className="mt-2 text-sm text-[#8ea1b8]">{item.date} · {item.startTime} · {item.location}</p>
              </button>
            ))}
          </div>
        </ContestCard>

        <ContestCard className="shadow-none">
          {draft ? (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">agenda.editor</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">Editor de agenda</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className={cn("h-11 px-5", contestButtonClassNames.primary)} onClick={handleSave}>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar
                  </Button>
                  <Button type="button" variant="outline" className={cn("h-11 px-5", contestButtonClassNames.secondary)} onClick={handleRemove}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Título">
                  <Input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => current ? { ...current, title: event.target.value } : current)}
                    className="border-white/8 bg-white/[0.03] text-white"
                  />
                </Field>

                <Field label="Módulo">
                  <select
                    value={draft.moduleSlug}
                    onChange={(event) => setDraft((current) => current ? {
                      ...current,
                      moduleSlug: event.target.value,
                      ctaPath: event.target.value === "arena" ? "/arena" : `/programas/${event.target.value}`,
                    } : current)}
                    className="h-11 rounded-2xl border border-white/8 bg-white/[0.03] px-4 text-white"
                  >
                    {modules.map((module) => <option key={module.slug} value={module.slug}>{module.title}</option>)}
                  </select>
                </Field>

                <Field label="Data">
                  <Input
                    type="date"
                    value={draft.date}
                    onChange={(event) => setDraft((current) => current ? { ...current, date: event.target.value } : current)}
                    className="border-white/8 bg-white/[0.03] text-white"
                  />
                </Field>

                <Field label="Estado">
                  <select
                    value={draft.status}
                    onChange={(event) => setDraft((current) => current ? { ...current, status: event.target.value as LaboratorioAgendaStatus } : current)}
                    className="h-11 rounded-2xl border border-white/8 bg-white/[0.03] px-4 text-white"
                  >
                    {agendaStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>

                <Field label="Início">
                  <Input
                    type="time"
                    value={draft.startTime}
                    onChange={(event) => setDraft((current) => current ? { ...current, startTime: event.target.value } : current)}
                    className="border-white/8 bg-white/[0.03] text-white"
                  />
                </Field>

                <Field label="Fim">
                  <Input
                    type="time"
                    value={draft.endTime}
                    onChange={(event) => setDraft((current) => current ? { ...current, endTime: event.target.value } : current)}
                    className="border-white/8 bg-white/[0.03] text-white"
                  />
                </Field>

                <Field label="Local">
                  <Input
                    value={draft.location}
                    onChange={(event) => setDraft((current) => current ? { ...current, location: event.target.value } : current)}
                    className="border-white/8 bg-white/[0.03] text-white"
                  />
                </Field>

                <Field label="Formato">
                  <Input
                    value={draft.format}
                    onChange={(event) => setDraft((current) => current ? { ...current, format: event.target.value } : current)}
                    className="border-white/8 bg-white/[0.03] text-white"
                  />
                </Field>
              </div>

              <Field label="Público" className="mt-4">
                <Input
                  value={draft.audience}
                  onChange={(event) => setDraft((current) => current ? { ...current, audience: event.target.value } : current)}
                  className="border-white/8 bg-white/[0.03] text-white"
                />
              </Field>

              <Field label="Resumo" className="mt-4">
                <Textarea
                  value={draft.summary}
                  onChange={(event) => setDraft((current) => current ? { ...current, summary: event.target.value } : current)}
                  className="min-h-28 border-white/8 bg-white/[0.03] text-white"
                />
              </Field>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Texto do botão">
                  <Input
                    value={draft.ctaLabel}
                    onChange={(event) => setDraft((current) => current ? { ...current, ctaLabel: event.target.value } : current)}
                    className="border-white/8 bg-white/[0.03] text-white"
                  />
                </Field>
                <Field label="Destino">
                  <Input
                    value={draft.ctaPath}
                    onChange={(event) => setDraft((current) => current ? { ...current, ctaPath: event.target.value } : current)}
                    className="border-white/8 bg-white/[0.03] text-white"
                  />
                </Field>
              </div>

              <label className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={Boolean(draft.featured)}
                  onChange={(event) => setDraft((current) => current ? { ...current, featured: event.target.checked } : current)}
                  className="h-4 w-4 rounded border-white/20 bg-transparent"
                />
                Manter este evento em destaque na home e na agenda
              </label>
            </>
          ) : null}
        </ContestCard>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-sm font-medium text-white">{label}</p>
      {children}
    </div>
  );
}

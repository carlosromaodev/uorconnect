import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ContestBadge, ContestCard } from "@/components/challenges/contest-theme";
import { contestButtonClassNames } from "@/components/challenges/contest-theme.tokens";
import { cn } from "@/lib/utils";
import {
  type LaboratorioModule,
  type LaboratorioModuleAccessMode,
  type LaboratorioModuleStatus,
} from "@/data/laboratorio-modules";
import { useLaboratorioHub } from "@app/lib/laboratorio-hub-state";

const statusOptions: LaboratorioModuleStatus[] = ["operacional", "piloto", "curadoria", "planeado"];
const accessOptions: LaboratorioModuleAccessMode[] = ["aberto", "curado", "por-selecao", "competitivo"];

type ModuleDraft = {
  summary: string;
  status: LaboratorioModuleStatus;
  featured: boolean;
  cadence: string;
  accessMode: LaboratorioModuleAccessMode;
  operationalModel: string;
  adminSurface: string;
};

function buildDraft(module: LaboratorioModule): ModuleDraft {
  return {
    summary: module.summary,
    status: module.status,
    featured: Boolean(module.featured),
    cadence: module.cadence,
    accessMode: module.accessMode,
    operationalModel: module.operationalModel,
    adminSurface: module.adminSurface,
  };
}

export default function LaboratorioAdminProgramsPage() {
  const { modules, updateModule } = useLaboratorioHub();
  const [selectedSlug, setSelectedSlug] = useState(modules[0]?.slug ?? "");
  const [draft, setDraft] = useState<ModuleDraft | null>(() => modules[0] ? buildDraft(modules[0]) : null);

  const selectedModule = useMemo(
    () => modules.find((module) => module.slug === selectedSlug) ?? null,
    [modules, selectedSlug],
  );

  useEffect(() => {
    if (selectedModule) {
      setDraft(buildDraft(selectedModule));
    }
  }, [selectedModule]);

  const handleSave = () => {
    if (!selectedModule || !draft) return;

    updateModule(selectedModule.slug, {
      summary: draft.summary,
      status: draft.status,
      featured: draft.featured,
      cadence: draft.cadence,
      accessMode: draft.accessMode,
      operationalModel: draft.operationalModel,
      adminSurface: draft.adminSurface,
    });

    toast.success("Programa atualizado no Laboratório.");
  };

  return (
    <div className="grid gap-6">
      <section className="grid gap-6 xl:grid-cols-[0.74fr_1.26fr]">
        <ContestCard className="shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">programas.catalogo</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Catálogo de módulos</h3>
            </div>
            <ContestBadge tone="neutral">{modules.length}</ContestBadge>
          </div>

          <div className="mt-5 space-y-3">
            {modules.map((module) => (
              <button
                key={module.slug}
                type="button"
                onClick={() => setSelectedSlug(module.slug)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition-colors",
                  selectedSlug === module.slug
                    ? "border-[#7bd3c6]/24 bg-[#7bd3c6]/10"
                    : "border-white/8 bg-white/[0.03] hover:border-[#7bd3c6]/16",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-white">{module.title}</p>
                  <ContestBadge tone={module.featured ? "accent" : "neutral"} size="compact">
                    {module.featured ? "destaque" : "normal"}
                  </ContestBadge>
                </div>
                <p className="mt-2 text-sm text-[#8ea1b8]">{module.summary}</p>
              </button>
            ))}
          </div>
        </ContestCard>

        <ContestCard className="shadow-none">
          {selectedModule && draft ? (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-tech-mono text-[10px] uppercase tracking-[0.18em] text-[#7bd3c6]">programas.editor</p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">{selectedModule.title}</h3>
                </div>
                <Button type="button" className={cn("h-11 px-5", contestButtonClassNames.primary)} onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar módulo
                </Button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Estado">
                  <select
                    value={draft.status}
                    onChange={(event) => setDraft((current) => current ? { ...current, status: event.target.value as LaboratorioModuleStatus } : current)}
                    className="h-11 rounded-2xl border border-white/8 bg-white/[0.03] px-4 text-white"
                  >
                    {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>

                <Field label="Modo de entrada">
                  <select
                    value={draft.accessMode}
                    onChange={(event) => setDraft((current) => current ? { ...current, accessMode: event.target.value as LaboratorioModuleAccessMode } : current)}
                    className="h-11 rounded-2xl border border-white/8 bg-white/[0.03] px-4 text-white"
                  >
                    {accessOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Resumo" className="mt-4">
                <Textarea
                  value={draft.summary}
                  onChange={(event) => setDraft((current) => current ? { ...current, summary: event.target.value } : current)}
                  className="min-h-24 border-white/8 bg-white/[0.03] text-white"
                />
              </Field>

              <Field label="Cadência" className="mt-4">
                <Input
                  value={draft.cadence}
                  onChange={(event) => setDraft((current) => current ? { ...current, cadence: event.target.value } : current)}
                  className="border-white/8 bg-white/[0.03] text-white"
                />
              </Field>

              <Field label="Modelo operacional" className="mt-4">
                <Textarea
                  value={draft.operationalModel}
                  onChange={(event) => setDraft((current) => current ? { ...current, operationalModel: event.target.value } : current)}
                  className="min-h-28 border-white/8 bg-white/[0.03] text-white"
                />
              </Field>

              <Field label="Superfície administrativa" className="mt-4">
                <Textarea
                  value={draft.adminSurface}
                  onChange={(event) => setDraft((current) => current ? { ...current, adminSurface: event.target.value } : current)}
                  className="min-h-24 border-white/8 bg-white/[0.03] text-white"
                />
              </Field>

              <label className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(event) => setDraft((current) => current ? { ...current, featured: event.target.checked } : current)}
                  className="h-4 w-4 rounded border-white/20 bg-transparent"
                />
                Manter este módulo em destaque na home e nos programas
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

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  defaultLaboratorioAgenda,
  laboratorioCourseClusters,
  laboratorioMentorRoster,
  laboratorioOperationalSteps,
  laboratorioResourceCollections,
  laboratorioSpaces,
  type LaboratorioAgendaItem,
} from "@/data/laboratorio-hub";
import {
  laboratorioModules as defaultLaboratorioModules,
  type LaboratorioModule,
  type LaboratorioModuleAccessMode,
  type LaboratorioModuleStatus,
} from "@/data/laboratorio-modules";

const STORAGE_KEY = "uor_laboratorio_hub_v1";

type LaboratorioModuleOverride = {
  summary?: string;
  status?: LaboratorioModuleStatus;
  statusLabel?: string;
  featured?: boolean;
  cadence?: string;
  accessMode?: LaboratorioModuleAccessMode;
  operationalModel?: string;
  adminSurface?: string;
};

type StoredHubState = {
  agendaItems?: LaboratorioAgendaItem[];
  moduleOverrides?: Record<string, LaboratorioModuleOverride>;
};

type LaboratorioHubContextValue = {
  modules: LaboratorioModule[];
  featuredModules: LaboratorioModule[];
  agendaItems: LaboratorioAgendaItem[];
  updateModule: (slug: string, patch: LaboratorioModuleOverride) => void;
  upsertAgendaItem: (item: LaboratorioAgendaItem) => void;
  removeAgendaItem: (id: string) => void;
  resetHubState: () => void;
};

const LaboratorioHubContext = createContext<LaboratorioHubContextValue | null>(null);

const moduleStatusLabelMap: Record<LaboratorioModuleStatus, string> = {
  operacional: "Operacional",
  piloto: "Piloto",
  curadoria: "Curadoria",
  planeado: "Planeado",
};

function buildDefaultState(): StoredHubState {
  return {
    agendaItems: defaultLaboratorioAgenda,
    moduleOverrides: {},
  };
}

function sortAgendaItems(items: LaboratorioAgendaItem[]) {
  return [...items].sort((left, right) => {
    const leftDate = `${left.date}T${left.startTime}`;
    const rightDate = `${right.date}T${right.startTime}`;
    return leftDate.localeCompare(rightDate);
  });
}

function parseStoredState(): StoredHubState {
  if (typeof window === "undefined") {
    return buildDefaultState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return buildDefaultState();
    }

    const parsed = JSON.parse(raw) as StoredHubState;
    return {
      agendaItems: Array.isArray(parsed.agendaItems) && parsed.agendaItems.length
        ? sortAgendaItems(parsed.agendaItems)
        : defaultLaboratorioAgenda,
      moduleOverrides: parsed.moduleOverrides ?? {},
    };
  } catch {
    return buildDefaultState();
  }
}

function applyModuleOverrides(module: LaboratorioModule, override?: LaboratorioModuleOverride): LaboratorioModule {
  if (!override) {
    return module;
  }

  const status = override.status ?? module.status;

  return {
    ...module,
    ...override,
    status,
    statusLabel: override.statusLabel ?? moduleStatusLabelMap[status],
  };
}

export function LaboratorioHubProvider({ children }: { children: ReactNode }) {
  const [agendaItems, setAgendaItems] = useState<LaboratorioAgendaItem[]>(() => parseStoredState().agendaItems ?? defaultLaboratorioAgenda);
  const [moduleOverrides, setModuleOverrides] = useState<Record<string, LaboratorioModuleOverride>>(
    () => parseStoredState().moduleOverrides ?? {},
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const payload: StoredHubState = {
      agendaItems,
      moduleOverrides,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [agendaItems, moduleOverrides]);

  const modules = useMemo(
    () => defaultLaboratorioModules.map((module) => applyModuleOverrides(module, moduleOverrides[module.slug])),
    [moduleOverrides],
  );

  const featuredModules = useMemo(
    () => modules.filter((module) => module.featured),
    [modules],
  );

  const updateModule = (slug: string, patch: LaboratorioModuleOverride) => {
    setModuleOverrides((current) => ({
      ...current,
      [slug]: {
        ...current[slug],
        ...patch,
      },
    }));
  };

  const upsertAgendaItem = (item: LaboratorioAgendaItem) => {
    setAgendaItems((current) => {
      const next = current.some((entry) => entry.id === item.id)
        ? current.map((entry) => (entry.id === item.id ? item : entry))
        : [...current, item];

      return sortAgendaItems(next);
    });
  };

  const removeAgendaItem = (id: string) => {
    setAgendaItems((current) => current.filter((item) => item.id !== id));
  };

  const resetHubState = () => {
    setAgendaItems(defaultLaboratorioAgenda);
    setModuleOverrides({});
  };

  const value = useMemo<LaboratorioHubContextValue>(() => ({
    modules,
    featuredModules,
    agendaItems,
    updateModule,
    upsertAgendaItem,
    removeAgendaItem,
    resetHubState,
  }), [agendaItems, featuredModules, modules]);

  return (
    <LaboratorioHubContext.Provider value={value}>
      {children}
    </LaboratorioHubContext.Provider>
  );
}

export function useLaboratorioHub() {
  const context = useContext(LaboratorioHubContext);
  if (!context) {
    throw new Error("useLaboratorioHub must be used within LaboratorioHubProvider");
  }

  return context;
}

export {
  laboratorioCourseClusters,
  laboratorioMentorRoster,
  laboratorioOperationalSteps,
  laboratorioResourceCollections,
  laboratorioSpaces,
};

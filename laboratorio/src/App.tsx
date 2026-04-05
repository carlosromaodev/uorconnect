import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LaboratorioPwaBanner } from "@/components/features/LaboratorioPwaBanner";
import { ArenaStateProvider, useArenaClock, useArenaState } from "@app/lib/arena-state";
import { LaboratorioHubProvider } from "@app/lib/laboratorio-hub-state";
import { LaboratorioAdminShell } from "@app/components/LaboratorioAdminShell";
import LaboratorioAgendaPage from "@app/pages/LaboratorioAgendaPage";
import LaboratorioArenaChallengePage from "@app/pages/LaboratorioArenaChallengePage";
import LaboratorioArenaPage from "@app/pages/LaboratorioArenaPage";
import LaboratorioFunctioningPage from "@app/pages/LaboratorioFunctioningPage";
import LaboratorioHomePage from "@app/pages/LaboratorioHomePage";
import LaboratorioLobbyPage from "@app/pages/LaboratorioLobbyPage";
import LaboratorioLoginPage from "@app/pages/LaboratorioLoginPage";
import LaboratorioModuleDetailPage from "@app/pages/LaboratorioModuleDetailPage";
import LaboratorioProgramsPage from "@app/pages/LaboratorioProgramsPage";
import LaboratorioRankingPage from "@app/pages/LaboratorioRankingPage";
import LaboratorioResourcesPage from "@app/pages/LaboratorioResourcesPage";
import LaboratorioRulesPage from "@app/pages/LaboratorioRulesPage";
import LaboratorioAdminAgendaPage from "@app/pages/admin/LaboratorioAdminAgendaPage";
import LaboratorioAdminArenaPage from "@app/pages/admin/LaboratorioAdminArenaPage";
import LaboratorioAdminOverviewPage from "@app/pages/admin/LaboratorioAdminOverviewPage";
import LaboratorioAdminProgramsPage from "@app/pages/admin/LaboratorioAdminProgramsPage";
import LaboratorioAdminRankingPage from "@app/pages/admin/LaboratorioAdminRankingPage";
import LaboratorioAdminSecurityPage from "@app/pages/admin/LaboratorioAdminSecurityPage";

function normalizeBasePath(pathname?: string) {
  const rawPath = pathname?.trim();
  if (!rawPath || rawPath === "/") return undefined;

  const withLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

function isSafeRedirect(candidate?: string | null, fallback = "/") {
  return candidate && candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : fallback;
}

function LaboratorioLoginRoute() {
  const location = useLocation();
  const redirect = new URLSearchParams(location.search).get("redirect");

  return <LaboratorioLoginPage redirectTo={isSafeRedirect(redirect)} />;
}

function LaboratorioAdminRoute() {
  const { contestConfig } = useArenaState();
  const clock = useArenaClock(contestConfig);

  return <LaboratorioAdminShell contestConfig={contestConfig} clock={clock} />;
}

function LegacyChallengeRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate replace to={slug ? `/arena/${slug}` : "/arena"} />;
}

function LegacyChallengeSubmissionRedirect() {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate replace to={slug ? `/arena/${slug}` : "/arena"} />;
}

function LaboratorioNotFound() {
  return <Navigate replace to="/" />;
}

function AppRoutes() {
  const protect = (element: ReactNode) => (
    <ProtectedRoute loginPath="/login">{element}</ProtectedRoute>
  );

  return (
    <Routes>
      <Route path="/" element={<LaboratorioHomePage />} />
      <Route path="/login" element={<LaboratorioLoginRoute />} />
      <Route path="/programas" element={<LaboratorioProgramsPage />} />
      <Route path="/programas/:slug" element={<LaboratorioModuleDetailPage />} />
      <Route path="/agenda" element={<LaboratorioAgendaPage />} />
      <Route path="/funcionamento" element={<LaboratorioFunctioningPage />} />
      <Route path="/recursos" element={<LaboratorioResourcesPage />} />
      <Route path="/lobby" element={protect(<LaboratorioLobbyPage />)} />
      <Route path="/arena" element={<LaboratorioArenaPage />} />
      <Route path="/arena/:slug" element={protect(<LaboratorioArenaChallengePage />)} />
      <Route path="/ranking" element={<LaboratorioRankingPage />} />
      <Route path="/regras" element={<LaboratorioRulesPage />} />

      <Route path="/admin" element={<LaboratorioAdminRoute />}>
        <Route index element={<LaboratorioAdminOverviewPage />} />
        <Route path="programas" element={<LaboratorioAdminProgramsPage />} />
        <Route path="agenda" element={<LaboratorioAdminAgendaPage />} />
        <Route path="arena" element={<LaboratorioAdminArenaPage />} />
        <Route path="security" element={<LaboratorioAdminSecurityPage />} />
        <Route path="ranking" element={<LaboratorioAdminRankingPage />} />
      </Route>

      <Route path="/:slug/submeter" element={<LegacyChallengeSubmissionRedirect />} />
      <Route path="/:slug" element={<LegacyChallengeRedirect />} />
      <Route path="*" element={<LaboratorioNotFound />} />
    </Routes>
  );
}

const routerBasename = normalizeBasePath(import.meta.env.VITE_LAB_BASE_PATH);

const App = () => (
  <BrowserRouter basename={routerBasename} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <ArenaStateProvider>
      <LaboratorioHubProvider>
        <Toaster />
        <LaboratorioPwaBanner />
        <AppRoutes />
      </LaboratorioHubProvider>
    </ArenaStateProvider>
  </BrowserRouter>
);

export default App;

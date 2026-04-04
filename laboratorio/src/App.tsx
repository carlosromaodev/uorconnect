import type { ReactNode } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { getContestLinkPath } from "@/lib/contest-lab";
import Desafios from "@/pages/Desafios";
import DesafiosArena from "@/pages/DesafiosArena";
import DesafiosLobby from "@/pages/DesafiosLobby";
import DesafiosRanking from "@/pages/DesafiosRanking";
import DesafiosRegras from "@/pages/DesafiosRegras";
import DesafioDetalhe from "@/pages/DesafioDetalhe";
import DesafioSubmissao from "@/pages/DesafioSubmissao";
import LaboratorioAdmin from "@/pages/LaboratorioAdmin";
import { LaboratorioLoginPage } from "@/laboratorio/pages/LaboratorioLoginPage";

function isSafeRedirect(candidate?: string | null, fallback = "/lobby") {
  return candidate && candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : fallback;
}

function LaboratorioLoginRoute() {
  const location = useLocation();
  const redirect = new URLSearchParams(location.search).get("redirect");

  return <LaboratorioLoginPage redirectTo={isSafeRedirect(redirect, getContestLinkPath("/lobby"))} />;
}

function LaboratorioNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-xl rounded-[32px] border border-[#1d2732] bg-[linear-gradient(180deg,rgba(11,16,21,0.98),rgba(7,12,16,0.96))] p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.24)]">
        <p className="font-tech-mono text-[11px] uppercase tracking-[0.22em] text-[#00e5c8]">route.not_found</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">404</h1>
        <p className="mt-4 text-sm leading-7 text-[#7b8ca3]">
          A rota pedida não existe no runtime do Laboratório.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            to={getContestLinkPath("/")}
            className="inline-flex items-center justify-center rounded-full border border-[#00e5c8]/24 bg-[#00e5c8] px-5 py-3 text-sm font-semibold text-[#041013] shadow-[0_12px_30px_rgba(0,229,200,0.16)] transition-colors hover:bg-[#58f0db]"
          >
            Voltar ao Laboratório
          </Link>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const contestLoginPath = getContestLinkPath("/login");
  const protect = (element: ReactNode) => (
    <ProtectedRoute loginPath={contestLoginPath}>{element}</ProtectedRoute>
  );

  return (
    <Routes>
      <Route path="/" element={<Desafios />} />
      <Route path="/login" element={<LaboratorioLoginRoute />} />
      <Route path="/admin" element={<LaboratorioAdmin />} />
      <Route path="/lobby" element={protect(<DesafiosLobby />)} />
      <Route path="/arena" element={protect(<DesafiosArena />)} />
      <Route path="/ranking" element={<DesafiosRanking />} />
      <Route path="/regras" element={<DesafiosRegras />} />
      <Route path="/:slug" element={<DesafioDetalhe />} />
      <Route path="/:slug/submeter" element={protect(<DesafioSubmissao />)} />

      <Route path="/desafios" element={<Desafios />} />
      <Route path="/desafios/login" element={<LaboratorioLoginRoute />} />
      <Route path="/desafios/admin" element={<LaboratorioAdmin />} />
      <Route path="/desafios/lobby" element={protect(<DesafiosLobby />)} />
      <Route path="/desafios/arena" element={protect(<DesafiosArena />)} />
      <Route path="/desafios/ranking" element={<DesafiosRanking />} />
      <Route path="/desafios/regras" element={<DesafiosRegras />} />
      <Route path="/desafios/:slug" element={<DesafioDetalhe />} />
      <Route path="/desafios/:slug/submeter" element={protect(<DesafioSubmissao />)} />

      <Route path="*" element={<LaboratorioNotFound />} />
    </Routes>
  );
}

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Toaster />
    <AppRoutes />
  </BrowserRouter>
);

export default App;

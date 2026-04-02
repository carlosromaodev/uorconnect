import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Index from "./pages/Index";
import Agenda from "./pages/Agenda";
import Submeter from "./pages/Submeter";
import Projetos from "./pages/Projetos";
import ProjetoDetalhe from "./pages/ProjetoDetalhe";
import Cursos from "./pages/Cursos";
import CursoInscricao from "./pages/CursoInscricao";
import CourseEnrollmentReceipt from "./pages/CourseEnrollmentReceipt";
import Regras from "./pages/Regras";
import Sobre from "./pages/Sobre";
import Palestrantes from "./pages/Palestrantes";
import FAQ from "./pages/FAQ";
import Guia from "./pages/Guia";
import EventoAoVivo from "./pages/EventoAoVivo";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import SaasShowcase from "./pages/SaasShowcase";
import MinhaArea from "./pages/MinhaArea";
import SubmissionReceipt from "./pages/SubmissionReceipt";
import Desafios from "./pages/Desafios";
import DesafiosLobby from "./pages/DesafiosLobby";
import DesafiosArena from "./pages/DesafiosArena";
import DesafiosRanking from "./pages/DesafiosRanking";
import DesafiosRegras from "./pages/DesafiosRegras";
import DesafioDetalhe from "./pages/DesafioDetalhe";
import DesafioSubmissao from "./pages/DesafioSubmissao";
import LaboratorioAdmin from "./pages/LaboratorioAdmin";
import { getSaasShowcaseHref, isContestLabHost, isContestRoutePath, isSaasShowcaseHost } from "@/lib/contest-lab";

const queryClient = new QueryClient();

function SaasShowcaseRedirect() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSaasShowcaseHost(window.location.hostname)) return;

    const targetPath = location.pathname.replace(/^\/plataforma/, "") || "/";
    const href = getSaasShowcaseHref(`${targetPath}${location.search}${location.hash}`);
    window.location.replace(href);
  }, [location.hash, location.pathname, location.search]);

  return null;
}

const AppContent = () => {
  const location = useLocation();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const contestLabHost = isContestLabHost(hostname);
  const saasShowcaseHost = isSaasShowcaseHost(hostname);
  const contestRoute = isContestRoutePath(location.pathname, hostname);
  const isSaas = saasShowcaseHost || location.pathname.startsWith("/plataforma");
  const showChrome = !isSaas && !contestLabHost && !contestRoute;

  return (
    <div className="flex min-h-screen flex-col">
      {showChrome ? <Navbar /> : null}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={contestLabHost ? <Desafios /> : saasShowcaseHost ? <SaasShowcase /> : <Index />} />

          <Route path="/agenda" element={<Agenda />} />
          <Route path="/submeter" element={<Submeter />} />
          <Route path="/projetos" element={<Projetos />} />
          <Route path="/projeto/:slug" element={<ProjetoDetalhe />} />
          <Route path="/cursos" element={<Cursos />} />
          <Route path="/cursos/:id/inscricao" element={<CursoInscricao />} />
          <Route path="/cursos/inscricoes/:id" element={<CourseEnrollmentReceipt />} />
          <Route path="/regras" element={contestLabHost ? <DesafiosRegras /> : <Regras />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="/palestrantes" element={<Palestrantes />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/guia" element={<Guia />} />
          <Route path="/ao-vivo" element={<EventoAoVivo />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={contestLabHost ? <LaboratorioAdmin /> : <Admin />} />
          <Route path="/minha-area" element={<MinhaArea />} />
          <Route path="/submissoes/:id" element={<SubmissionReceipt />} />

          <Route path="/desafios" element={<Desafios />} />
          <Route path="/desafios/lobby" element={<DesafiosLobby />} />
          <Route path="/desafios/arena" element={<DesafiosArena />} />
          <Route path="/desafios/ranking" element={<DesafiosRanking />} />
          <Route path="/desafios/regras" element={<DesafiosRegras />} />
          <Route path="/desafios/:slug" element={<DesafioDetalhe />} />
          <Route path="/desafios/:slug/submeter" element={<DesafioSubmissao />} />

          <Route path="/lobby" element={<DesafiosLobby />} />
          <Route path="/arena" element={<DesafiosArena />} />
          <Route path="/ranking" element={<DesafiosRanking />} />
          <Route path="/regras-laboratorio" element={<DesafiosRegras />} />
          <Route path="/:slug" element={<DesafioDetalhe />} />
          <Route path="/:slug/submeter" element={<DesafioSubmissao />} />

          <Route path="/plataforma" element={<SaasShowcaseRedirect />} />
          <Route path="/plataforma/*" element={<SaasShowcaseRedirect />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {showChrome ? <Footer /> : null}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, type ReactNode, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  getContestAbsoluteUrl,
  getSaasShowcaseHref,
  isContestLabHost,
  isContestRoutePath,
  isSaasShowcaseHost,
} from "@/lib/contest-lab";

const queryClient = new QueryClient();
const LazyAnalyticsProvider = lazy(() =>
  import("./components/analytics/AnalyticsProvider").then((module) => ({ default: module.AnalyticsProvider })),
);
const Navbar = lazy(() => import("./components/Navbar"));
const Footer = lazy(() => import("./components/Footer"));
const PwaSystemBanner = lazy(() =>
  import("./components/features/PwaSystemBanner").then((module) => ({ default: module.PwaSystemBanner })),
);
const Index = lazy(() => import("./pages/Index"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Submeter = lazy(() => import("./pages/Submeter"));
const Projetos = lazy(() => import("./pages/Projetos"));
const ProjetoDetalhe = lazy(() => import("./pages/ProjetoDetalhe"));
const Cursos = lazy(() => import("./pages/Cursos"));
const CursoInscricao = lazy(() => import("./pages/CursoInscricao"));
const CourseEnrollmentReceipt = lazy(() => import("./pages/CourseEnrollmentReceipt"));
const Regras = lazy(() => import("./pages/Regras"));
const Sobre = lazy(() => import("./pages/Sobre"));
const Palestrantes = lazy(() => import("./pages/Palestrantes"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Guia = lazy(() => import("./pages/Guia"));
const EventoAoVivo = lazy(() => import("./pages/EventoAoVivo"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));
const Login = lazy(() => import("./pages/Login"));
const SaasShowcase = lazy(() => import("./pages/SaasShowcase"));
const MinhaArea = lazy(() => import("./pages/MinhaArea"));
const SubmissionReceipt = lazy(() => import("./pages/SubmissionReceipt"));

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="surface-card w-full max-w-md px-6 py-8 text-center">
        <p className="premium-kicker">A carregar módulo</p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-900">Preparando a área solicitada</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          O frontend está a carregar apenas o necessário para esta rota.
        </p>
      </div>
    </div>
  );
}

function ChromeFallback({ position = "top" }: { position?: "top" | "bottom" }) {
  if (position === "bottom") {
    return <div className="h-6" aria-hidden="true" />;
  }

  return <div className="h-[72px]" aria-hidden="true" />;
}

function AnalyticsShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <LazyAnalyticsProvider>{children}</LazyAnalyticsProvider>
    </Suspense>
  );
}

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

function ContestExperienceRedirect() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const targetPath = `${location.pathname}${location.search}${location.hash}` || "/desafios";
    const href = getContestAbsoluteUrl(targetPath);

    if (window.location.href === href) {
      return;
    }

    window.location.replace(href);
  }, [location.hash, location.pathname, location.search]);

  return null;
}

const AppContent = () => {
  const location = useLocation();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const saasShowcaseHost = isSaasShowcaseHost(hostname);
  const contestLabHost = isContestLabHost(hostname);
  const isSaas = saasShowcaseHost || location.pathname.startsWith("/plataforma");
  const isContestExperience = contestLabHost || isContestRoutePath(location.pathname, hostname);
  const showChrome = !isSaas && !isContestExperience;

  return (
    <div className="flex min-h-screen flex-col">
      {showChrome ? (
        <Suspense fallback={<ChromeFallback />}>
          <Navbar />
        </Suspense>
      ) : null}
      <main className="flex-1">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {contestLabHost ? (
              <>
                <Route path="*" element={<ContestExperienceRedirect />} />
              </>
            ) : (
              <>
                <Route path="/" element={saasShowcaseHost ? <SaasShowcase /> : <Index />} />

                <Route path="/agenda" element={<Agenda />} />
                <Route path="/submeter" element={<Submeter />} />
                <Route path="/projetos" element={<Projetos />} />
                <Route path="/projeto/:slug" element={<ProjetoDetalhe />} />
                <Route path="/cursos" element={<Cursos />} />
                <Route path="/cursos/:id/inscricao" element={<CursoInscricao />} />
                <Route path="/cursos/inscricoes/:id" element={<CourseEnrollmentReceipt />} />
                <Route path="/regras" element={<Regras />} />
                <Route path="/sobre" element={<Sobre />} />
                <Route path="/palestrantes" element={<Palestrantes />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/guia" element={<Guia />} />
                <Route path="/ao-vivo" element={<EventoAoVivo />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/minha-area" element={<MinhaArea />} />
                <Route path="/submissoes/:id" element={<SubmissionReceipt />} />

                <Route path="/desafios" element={<ContestExperienceRedirect />} />
                <Route path="/desafios/*" element={<ContestExperienceRedirect />} />

                <Route path="/plataforma" element={<SaasShowcaseRedirect />} />
                <Route path="/plataforma/*" element={<SaasShowcaseRedirect />} />
                <Route path="*" element={<NotFound />} />
              </>
            )}
          </Routes>
        </Suspense>
      </main>
      {showChrome ? (
        <Suspense fallback={null}>
          <PwaSystemBanner />
        </Suspense>
      ) : null}
      {showChrome ? (
        <Suspense fallback={<ChromeFallback position="bottom" />}>
          <Footer />
        </Suspense>
      ) : null}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AnalyticsShell>
          <AppContent />
        </AnalyticsShell>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

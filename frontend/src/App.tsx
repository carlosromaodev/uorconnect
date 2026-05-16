import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, type ReactNode, useEffect, useLayoutEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  getSaasShowcaseHref,
  isAdminAppHost,
  isSaasShowcaseHost,
} from "@/lib/runtime-hosts";

const queryClient = new QueryClient();
const LazyAnalyticsProvider = lazy(() =>
  import("./components/analytics/AnalyticsProvider").then((module) => ({ default: module.AnalyticsProvider })),
);
const Navbar = lazy(() => import("./components/Navbar"));
const Footer = lazy(() => import("./components/Footer"));

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
const VotacaoAoVivo = lazy(() => import("./pages/VotacaoAoVivo"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage"));
const Login = lazy(() => import("./pages/Login"));
const SaasShowcase = lazy(() => import("./pages/SaasShowcase"));
const MinhaArea = lazy(() => import("./pages/MinhaArea"));
const SubmissionReceipt = lazy(() => import("./pages/SubmissionReceipt"));
const PublicValidation = lazy(() => import("./pages/PublicValidation"));
const TeamInvitation = lazy(() => import("./pages/TeamInvitation"));
const TeamCredentialInvitation = lazy(() => import("./pages/TeamCredentialInvitation"));
const TeamMemberProfile = lazy(() => import("./pages/TeamMemberProfile"));
const CompletarPerfil = lazy(() => import("./pages/CompletarPerfil"));
const PassportReferralInvite = lazy(() => import("./pages/PassportReferralInvite"));
const FormadorCadastro = lazy(() => import("./pages/FormadorCadastro"));
const FormadorPainel = lazy(() => import("./pages/FormadorPainel"));

function RouteFallback() {
  return (
    <div className="min-h-[42vh] px-4 pt-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="site-loading-bar" role="status" aria-label="A carregar página">
          <span className="site-loading-bar__track">
            <span className="site-loading-bar__progress" />
          </span>
          <span className="site-loading-bar__label">A carregar UOR Connect</span>
        </div>
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

function ScrollToTopOnRouteChange() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (typeof window === "undefined" || !("scrollRestoration" in window.history)) return;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const scrollToTop = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      try {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } catch {
        try {
          window.scrollTo(0, 0);
        } catch (error) {
          void error;
        }
      }
    };

    scrollToTop();
    const frameId = window.requestAnimationFrame(scrollToTop);

    return () => window.cancelAnimationFrame(frameId);
  }, [pathname, search]);

  return null;
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

function AdminAppRedirect() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/admin") return;
    window.location.replace(`/admin${location.search}${location.hash}`);
  }, [location.hash, location.pathname, location.search]);

  return null;
}

const AppContent = () => {
  const location = useLocation();
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const adminAppHost = isAdminAppHost(hostname);
  const saasShowcaseHost = isSaasShowcaseHost(hostname);
  const isSaas = saasShowcaseHost || location.pathname.startsWith("/plataforma");
  const adminRoute = location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const liveDisplayRoute = location.pathname === "/votacao-ao-vivo" || location.pathname === "/votacoes/ao-vivo";
  const passportInviteRoute = location.pathname.startsWith("/desafio/convite/");
  const showChrome = !adminAppHost && !adminRoute && !isSaas && !liveDisplayRoute && !passportInviteRoute;

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
            {adminAppHost ? (
              <>
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<AdminAppRedirect />} />
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
                <Route path="/votacao-ao-vivo" element={<VotacaoAoVivo />} />
                <Route path="/votacoes/ao-vivo" element={<VotacaoAoVivo />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/minha-area" element={<MinhaArea />} />
                <Route path="/completar-perfil" element={<CompletarPerfil />} />
                <Route path="/submissoes/:id" element={<SubmissionReceipt />} />
                <Route path="/equipa/credencial/:token" element={<TeamCredentialInvitation />} />
                <Route path="/equipa/convite/:token" element={<TeamCredentialInvitation />} />
                <Route path="/equipa/perfil/:slug" element={<TeamMemberProfile />} />
                <Route path="/equipa/:token" element={<TeamInvitation />} />
                <Route path="/validar/:token" element={<PublicValidation />} />
                <Route path="/desafio/convite/:code" element={<PassportReferralInvite />} />
                <Route path="/formadores/cadastro" element={<FormadorCadastro />} />
                <Route path="/formadores/painel" element={<FormadorPainel />} />

                <Route path="/desafios" element={<Navigate to="/minha-area?tab=desafio" replace />} />
                <Route path="/desafios/*" element={<Navigate to="/minha-area?tab=desafio" replace />} />

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
        <ScrollToTopOnRouteChange />
        <AnalyticsShell>
          <AppContent />
        </AnalyticsShell>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

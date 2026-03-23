import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import Regras from "./pages/Regras";
import Sobre from "./pages/Sobre";
import Palestrantes from "./pages/Palestrantes";
import FAQ from "./pages/FAQ";
import Guia from "./pages/Guia";
import EventoAoVivo from "./pages/EventoAoVivo";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Login from "./pages/Login";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="flex flex-col min-h-screen">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/submeter" element={<Submeter />} />
              <Route path="/projetos" element={<Projetos />} />
              <Route path="/projeto/:slug" element={<ProjetoDetalhe />} />
              <Route path="/cursos" element={<Cursos />} />
              <Route path="/regras" element={<Regras />} />
              <Route path="/sobre" element={<Sobre />} />
              <Route path="/palestrantes" element={<Palestrantes />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/guia" element={<Guia />} />
              <Route path="/ao-vivo" element={<EventoAoVivo />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

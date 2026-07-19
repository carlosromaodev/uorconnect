import { Link } from "react-router-dom";
import { Instagram, Linkedin, Facebook, Mail, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  defaultHomeSocialConfig,
  UOR_EVENT_LEMA,
  UOR_EVENT_TITLE_HIGHLIGHT,
  UOR_EVENT_TITLE_PREFIX,
} from "@/lib/home-content";

export default function Footer() {
  const { data } = useQuery({
    queryKey: ["home-content"],
    queryFn: () => api.home.content(),
    staleTime: Infinity,
  });

  const social = data?.socialConfig ?? defaultHomeSocialConfig;

  return (
    <footer className="mt-16 border-t border-border bg-slate-50/80">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              <img src="/uorconnect-logo-navbar.png" alt="UOR Connect" className="h-10 w-auto max-w-[170px] object-contain" />
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {UOR_EVENT_TITLE_PREFIX} {UOR_EVENT_TITLE_HIGHLIGHT}. {UOR_EVENT_LEMA}.
            </p>
            <div className="flex items-center gap-2">
              {social.instagramUrl && (
                <a href={social.instagramUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
                  <Instagram size={18} />
                </a>
              )}
              {social.linkedinUrl && (
                <a href={social.linkedinUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[#0A66C2]/10 hover:text-[#0A66C2]">
                  <Linkedin size={18} />
                </a>
              )}
              {social.facebookUrl && (
                <a href={social.facebookUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[#1877F2]/10 hover:text-[#1877F2]">
                  <Facebook size={18} />
                </a>
              )}
            </div>
          </div>

          {/* Links rapidos */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Explorar</h4>
            <ul className="space-y-2.5">
              {[
                { to: "/projetos", label: "Projetos" },
                { to: "/cursos", label: "Cursos" },
                { to: "/agenda", label: "Agenda" },
                { to: "/palestrantes", label: "Palestrantes" },
                { to: "/submeter", label: "Submeter projeto" },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Recursos */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Recursos</h4>
            <ul className="space-y-2.5">
              {[
                { to: "/faq", label: "FAQ" },
                { to: "/guia", label: "Guia do participante" },
                { to: "/regras", label: "Regras" },
                { to: "/sobre", label: "Sobre o evento" },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="mb-4 text-sm font-semibold text-foreground">Contacto</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <MapPin size={16} className="mt-0.5 shrink-0 text-primary/70" />
                <span>Universidade Oscar Ribas<br />Luanda, Angola</span>
              </li>
              <li>
                <a href="mailto:neic@uor.ao" className="flex items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-primary">
                  <Mail size={16} className="shrink-0 text-primary/70" />
                  neic@uor.ao
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} UOR Connect
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            Feito pelo grupo CAVINOVA
          </p>
        </div>
      </div>
    </footer>
  );
}

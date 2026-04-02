import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X, Search } from "lucide-react";
import SearchDialog from "./SearchDialog";
import { getSaasShowcaseHref } from "@/lib/contest-lab";

const navItems = [
  { label: "Início", path: "/" },
  { label: "Agenda", path: "/agenda" },
  { label: "Palestrantes", path: "/palestrantes" },
  { label: "Submeter", path: "/submeter" },
  { label: "Projetos", path: "/projetos" },
  { label: "Cursos", path: "/cursos" },
  { label: "FAQ", path: "/faq" },
  { label: "Guia", path: "/guia" },
  { label: "Minha Área", path: "/minha-area" },
];

export default function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="UOR" className="h-9 md:h-10" />
            </Link>
          </div>

          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={getSaasShowcaseHref("/")}
              className="ml-1 inline-flex shrink-0 items-center whitespace-nowrap rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-px hover:bg-[#20bd5a]"
            >
              Agendar Evento
            </a>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="rounded-lg p-2.5 hover:bg-secondary transition-colors"
              aria-label="Pesquisar"
            >
              <Search className="h-5 w-5 text-muted-foreground" />
            </button>
            <button onClick={() => setOpen(!open)} className="lg:hidden rounded-lg p-2.5 hover:bg-secondary">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden border-t border-border bg-card px-4 pb-3 pt-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={getSaasShowcaseHref("/")}
              onClick={() => setOpen(false)}
              className="mt-2 block rounded-lg bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#20bd5a]"
            >
              Agendar para meu evento
            </a>
          </div>
        )}
      </nav>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

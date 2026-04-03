import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Bell, Menu, Search, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { api, getToken, isAuthError, setToken, type StudentOwnedSubmissionListItem } from "@/lib/api";
import SearchDialog from "./SearchDialog";
import { getSaasShowcaseHref } from "@/lib/contest-lab";

const APPROVAL_SEEN_STORAGE_KEY = "uor-approved-submissions-seen";

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

function readSeenApprovals() {
  try {
    const raw = window.localStorage.getItem(APPROVAL_SEEN_STORAGE_KEY);
    if (!raw) return new Set<number>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<number>();
    return new Set(parsed.filter((value) => typeof value === "number"));
  } catch {
    return new Set<number>();
  }
}

function writeSeenApprovals(ids: Set<number>) {
  try {
    window.localStorage.setItem(APPROVAL_SEEN_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // noop
  }
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function Navbar() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [approvedSubmissions, setApprovedSubmissions] = useState<StudentOwnedSubmissionListItem[]>([]);
  const [hasUnreadApprovals, setHasUnreadApprovals] = useState(false);

  const hasApprovalNotifications = approvedSubmissions.length > 0;

  useEffect(() => {
    let active = true;

    const token = getToken();
    if (!token) {
      setApprovedSubmissions([]);
      setHasUnreadApprovals(false);
      return () => {
        active = false;
      };
    }

    api.submissions.mine()
      .then((items) => {
        if (!active) return;

        const approved = items.filter((item) => item.status === "APPROVED");
        setApprovedSubmissions(approved);

        const seen = readSeenApprovals();
        const unread = approved.filter((item) => !seen.has(item.id));
        setHasUnreadApprovals(unread.length > 0);

        if (unread.length > 0) {
          const amount = unread.length;
          toast.success(
            amount === 1
              ? `Parabéns! O teu ${unread[0]?.typeLabel?.toLowerCase() ?? "projeto"} "${unread[0]?.name ?? ""}" foi aprovado. Já podes editar as informações na tua área.`
              : `${amount} dos teus projetos foram aprovados. Acede à tua área para editares as informações.`
          );
        }
      })
      .catch((error) => {
        if (!active) return;

        if (isAuthError(error)) {
          setToken(null);
          setApprovedSubmissions([]);
          setHasUnreadApprovals(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setOpen(false);
    setNotificationOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const markApprovalNotificationsAsRead = () => {
    if (!approvedSubmissions.length) return;
    const seen = readSeenApprovals();
    for (const submission of approvedSubmissions) {
      seen.add(submission.id);
    }
    writeSeenApprovals(seen);
    setHasUnreadApprovals(false);
  };

  const handleToggleNotifications = () => {
    setNotificationOpen((current) => {
      const next = !current;
      if (next) {
        markApprovalNotificationsAsRead();
      }
      return next;
    });
  };

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border/45 bg-white/68 shadow-sm backdrop-blur-2xl supports-[backdrop-filter]:bg-white/52">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logoworconnect.png" alt="UOR Connect" className="h-9 md:h-10" />
            </Link>
          </div>

          <div className="hidden xl:flex items-center gap-1">
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
              Marcar evento
            </a>
          </div>

          <div className="relative flex items-center gap-1">
            <button
              onClick={handleToggleNotifications}
              className="relative rounded-lg p-2.5 transition-colors hover:bg-secondary"
              aria-label="Notificações de aprovação"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {hasUnreadApprovals ? (
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[hsl(var(--success))]" />
              ) : null}
            </button>
            {hasApprovalNotifications ? (
              <Link
                to="/minha-area?tab=submissoes"
                className="hidden rounded-lg border border-border/60 bg-card/70 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-card sm:inline-flex"
              >
                Gerir Submissões
              </Link>
            ) : null}

            <button
              onClick={() => setSearchOpen(true)}
              className="rounded-lg p-2.5 hover:bg-secondary transition-colors"
              aria-label="Pesquisar"
            >
              <Search className="h-5 w-5 text-muted-foreground" />
            </button>
            <button onClick={() => setOpen(!open)} className="xl:hidden rounded-lg p-2.5 hover:bg-secondary" aria-label="Menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {notificationOpen && hasApprovalNotifications ? (
              <div className="absolute right-0 top-12 z-50 w-[360px] rounded-2xl border border-border/60 bg-card/95 p-4 shadow-lg backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <p className="text-sm font-semibold text-foreground">Aprovações Recentes</p>
                </div>
                <div className="space-y-3">
                  {approvedSubmissions.slice(0, 3).map((submission) => (
                    <div key={submission.id} className="rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-2">{submission.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {submission.typeLabel} aprovado • {dateLabel(submission.createdAt)}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Já podes editar as informações na tua área pessoal.
                      </p>
                    </div>
                  ))}
                </div>
                <Link
                  to="/minha-area?tab=submissoes"
                  onClick={() => setNotificationOpen(false)}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Gerir Submissões
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {open && (
          <div className="xl:hidden border-t border-border/60 bg-white/70 px-4 pb-3 pt-1 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/55">
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
            {hasApprovalNotifications ? (
              <Link
                to="/minha-area?tab=submissoes"
                onClick={() => setOpen(false)}
                className="mt-2 block rounded-lg border border-border/60 bg-card/80 px-3 py-2.5 text-sm font-semibold text-foreground"
              >
                Gerir Submissões
              </Link>
            ) : null}
            <a
              href={getSaasShowcaseHref("/")}
              onClick={() => setOpen(false)}
              className="mt-2 block rounded-lg bg-[#25D366] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#20bd5a]"
            >
              Marcar evento
            </a>
          </div>
        )}
      </nav>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

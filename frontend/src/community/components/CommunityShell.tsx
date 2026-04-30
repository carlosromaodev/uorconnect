import { createContext, Suspense, useContext, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, FolderOpen, GraduationCap, MessageCircle, User } from "lucide-react";

const CommunityBaseContext = createContext("");

export function useCommunityBase() {
  return useContext(CommunityBaseContext);
}

const NAV_ITEMS = [
  { path: "", label: "Feed", icon: Home },
  { path: "/projetos", label: "Projetos", icon: FolderOpen },
  { path: "/cursos", label: "Cursos", icon: GraduationCap },
  { path: "/mensagens", label: "Chat", icon: MessageCircle },
  { path: "/perfil", label: "Perfil", icon: User },
] as const;

function BottomNav() {
  const { pathname } = useLocation();
  const base = useCommunityBase();

  const isActive = (suffix: string) => {
    const full = base + suffix;
    if (suffix === "") return pathname === base || pathname === base + "/";
    return pathname.startsWith(full);
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-white/95 backdrop-blur-md safe-bottom">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-around px-2">
        {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              to={base + path || "/"}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-1"
            >
              {active && (
                <motion.div
                  layoutId="community-nav-active"
                  className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={`h-5 w-5 transition-colors ${active ? "text-primary" : "text-muted-foreground/60"}`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground/60"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-lg items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src="/uorconnect-logo-navbar.png" alt="UOR Connect" className="h-6" />
          <span className="text-sm font-bold tracking-tight">Comunidade</span>
        </div>
      </div>
    </header>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
    </div>
  );
}

export function CommunityShell({ children, basePath = "" }: { children: ReactNode; basePath?: string }) {
  return (
    <CommunityBaseContext.Provider value={basePath}>
      <div className="flex min-h-screen flex-col bg-[#fafaf9]">
        <TopBar />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-20 pt-4">
          <Suspense fallback={<ShellFallback />}>{children}</Suspense>
        </main>
        <BottomNav />
      </div>
    </CommunityBaseContext.Provider>
  );
}
